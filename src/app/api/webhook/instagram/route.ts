import { createHmac, timingSafeEqual } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { automacoes, eventos } from "@/lib/db/schema";
import { getInstagramAccessToken, getInstagramAccountId } from "@/lib/instagram-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.META_VERIFY_TOKEN && challenge) {
    console.info("Instagram webhook verification succeeded");
    return new Response(challenge, { status: 200 });
  }

  console.warn("Instagram webhook verification rejected", {
    mode,
    hasToken: Boolean(token),
    hasChallenge: Boolean(challenge),
    hasVerifyTokenConfigured: Boolean(process.env.META_VERIFY_TOKEN),
  });
  return NextResponse.json({ error: "Verificação do webhook inválida." }, { status: 403 });
}

async function graphPost(path: string, token: string, payload: Record<string, unknown>) {
  const response = await fetch(`https://graph.instagram.com/v26.0/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok && !body?.error, status: response.status, body };
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const secrets = [
    { label: "META_APP_SECRET", value: process.env.META_APP_SECRET },
    { label: "INSTAGRAM_APP_SECRET", value: process.env.INSTAGRAM_APP_SECRET },
    { label: "FACEBOOK_APP_SECRET", value: process.env.FACEBOOK_APP_SECRET },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  if (secrets.length === 0 || !signature?.startsWith("sha256=")) {
    console.warn("Instagram webhook rejected: missing app secret or signature", {
      configuredSecretNames: secrets.map((item) => item.label),
      hasSignature: Boolean(signature),
    });
    return NextResponse.json({ error: "Assinatura ausente." }, { status: 401 });
  }

  const receivedBuffer = Buffer.from(signature);
  const matchedSecret = secrets.find(({ value }) => {
    const expected = "sha256=" + createHmac("sha256", value).update(raw).digest("hex");
    const expectedBuffer = Buffer.from(expected);
    return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
  });

  if (!matchedSecret) {
    console.warn("Instagram webhook rejected: invalid signature", {
      configuredSecretNames: secrets.map((item) => item.label),
      bodyLength: raw.length,
    });
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!db) {
    console.error("Instagram webhook received but database is not configured");
    return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  }

  const entries = Array.isArray(body?.entry) ? body.entry : [];
  const changes = entries.flatMap((entry: any) =>
    (Array.isArray(entry?.changes) ? entry.changes : []).map((change: any) => ({
      entryId: entry.id,
      field: String(change.field ?? "instagram_event"),
      value: change.value ?? {},
    })),
  );

  console.info("Instagram webhook accepted", {
    object: body?.object ?? null,
    signatureMatchedSecret: matchedSecret.label,
    entryCount: entries.length,
    changeCount: changes.length,
    fields: changes.map((item: any) => item.field),
  });

  let recorded = 0;
  let matched = 0;
  let sent = 0;
  const sendingEnabled = process.env.INSTAGRAM_AUTOMATIONS_SEND_ENABLED === "true";

  for (const item of changes) {
    const value = item.value;
    const commentIdValue = value.id ?? value.comment_id ?? value.commentId;
    const commentId = commentIdValue ? String(commentIdValue) : null;
    const textValue = typeof value.text === "string" ? value.text.trim() : "";
    const mediaIdValue = value.media?.id ?? value.media_id ?? value.mediaId;
    const mediaId = mediaIdValue ? String(mediaIdValue) : null;
    const senderIdValue = value.from?.id ?? value.user_id ?? value.sender_id;
    const senderId = senderIdValue ? String(senderIdValue) : null;

    try {
      const [inserted] = await db.insert(eventos).values({
        tipo: item.field,
        commentId,
        instagramUserId: senderId,
        status: "received",
        detalhe: { entryId: item.entryId, ...value },
      }).onConflictDoNothing().returning({ id: eventos.id });

      if (!inserted) {
        console.info("Instagram webhook duplicate ignored", { field: item.field, commentId });
        continue;
      }
      recorded += 1;

      if (item.field !== "comments" || !textValue || !commentId) continue;

      // Newest active rule wins if multiple rules use the same keyword.
      const activeRules = await db.select().from(automacoes)
        .where(eq(automacoes.ativa, true)).orderBy(desc(automacoes.id));
      const normalizedText = textValue.toLocaleLowerCase("pt-BR");
      const rule = activeRules.find((candidate) => {
        const keyword = candidate.palavraChave.trim().toLocaleLowerCase("pt-BR");
        if (!keyword) return false;
        if (candidate.escopo === "specific_post" && (!mediaId || candidate.postId !== mediaId)) return false;
        if (candidate.escopo === "selected_posts") {
          if (!mediaId || !candidate.postId) return false;
          let selectedIds: string[] = [];
          try {
            const parsed = JSON.parse(candidate.postId);
            if (Array.isArray(parsed)) selectedIds = parsed.filter((value): value is string => typeof value === "string");
          } catch {
            selectedIds = [];
          }
          if (!selectedIds.includes(mediaId)) return false;
        }
        if (candidate.tipoCorrespondencia === "exact") return normalizedText === keyword;
        if (candidate.tipoCorrespondencia === "starts_with") return normalizedText.startsWith(keyword);
        return normalizedText.includes(keyword);
      });

      if (!rule) {
        await db.update(eventos).set({ status: "no_match" }).where(eq(eventos.id, inserted.id));
        console.info("Instagram comment did not match an active automation", { commentId });
        continue;
      }

      matched += 1;
      const publicText = rule.respostaPublica?.trim();
      const directText = rule.mensagemDirect?.trim();
      if (!sendingEnabled || (!publicText && !directText)) {
        await db.update(eventos).set({
          automacaoId: rule.id,
          status: "matched_dry_run",
        }).where(eq(eventos.id, inserted.id));
        console.info("Instagram comment matched automation in dry-run", {
          commentId, automationId: rule.id, sendingEnabled, hasPublicReply: Boolean(publicText), hasPrivateReply: Boolean(directText),
        });
        continue;
      }

      const accessToken = await getInstagramAccessToken();
      const accountId = await getInstagramAccountId();
      if (!accessToken || !accountId) {
        await db.update(eventos).set({
          automacaoId: rule.id,
          status: "send_failed",
          erro: "Token de acesso ou ID da conta do Instagram não configurado.",
        }).where(eq(eventos.id, inserted.id));
        continue;
      }

      const failures: string[] = [];
      let sentAny = false;

      // Public comment reply. This is independent of the private reply.
      if (publicText) {
        const result = await graphPost(`${encodeURIComponent(commentId)}/replies`, accessToken, { message: publicText });
        if (result.ok) sentAny = true;
        else failures.push(`Resposta pública HTTP ${result.status}: ${String(result.body?.error?.message ?? "erro da API")}`);
      }

      // Instagram Private Replies: one private reply per comment, using comment_id as recipient.
      if (directText) {
        const result = await graphPost(`${encodeURIComponent(accountId)}/messages`, accessToken, {
          recipient: { comment_id: commentId },
          message: { text: directText },
        });
        if (result.ok) sentAny = true;
        else failures.push(`DM privada HTTP ${result.status}: ${String(result.body?.error?.message ?? "erro da API")}`);
      }

      const finalStatus = failures.length ? (sentAny ? "partially_sent" : "send_failed") : "sent";
      await db.update(eventos).set({
        automacaoId: rule.id,
        status: finalStatus,
        erro: failures.length ? failures.join(" | ").slice(0, 4000) : null,
      }).where(eq(eventos.id, inserted.id));
      if (sentAny) sent += 1;
      console.info("Instagram automation delivery result", {
        commentId, automationId: rule.id, status: finalStatus,
        publicReplyConfigured: Boolean(publicText), privateReplyConfigured: Boolean(directText),
      });
    } catch (error) {
      console.error("Falha ao processar evento do Instagram", {
        field: item.field,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    received: true,
    recorded,
    matched,
    sent,
    sendingEnabled,
    fields: changes.map((item: any) => item.field),
  });
}
