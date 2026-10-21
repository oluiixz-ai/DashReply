import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { automacoes, eventos } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.META_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verificação do webhook inválida." }, { status: 403 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const secret = process.env.META_APP_SECRET;

  if (!secret || !signature?.startsWith("sha256=")) {
    return NextResponse.json({ error: "Assinatura ausente." }, { status: 401 });
  }

  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!db) return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });

  const changes = (body?.entry ?? []).flatMap((entry: any) =>
    (entry?.changes ?? []).map((change: any) => ({
      entryId: entry.id,
      field: String(change.field ?? "instagram_event"),
      value: change.value ?? {},
    })),
  );

  let recorded = 0;
  let matched = 0;

  for (const item of changes) {
    const value = item.value;
    const commentIdValue = value.id ?? value.comment_id;
    const commentId = commentIdValue ? String(commentIdValue) : null;
    const textValue = typeof value.text === "string" ? value.text.trim() : "";
    const mediaId = value.media?.id ? String(value.media.id) : null;
    const senderId = value.from?.id ? String(value.from.id) : null;

    try {
      // A comment ID is unique, so Meta retries cannot create duplicate processing records.
      const [inserted] = await db.insert(eventos).values({
        tipo: item.field,
        commentId,
        instagramUserId: senderId,
        status: "received",
        detalhe: { entryId: item.entryId, ...value },
      }).onConflictDoNothing().returning({ id: eventos.id });

      if (!inserted) continue;
      recorded += 1;

      // This stage only matches and records. It deliberately does not send replies or DMs.
      if (item.field !== "comments" || !textValue) continue;

      const activeRules = await db.select().from(automacoes).where(eq(automacoes.ativa, true));
      const normalizedText = textValue.toLocaleLowerCase("pt-BR");
      const rule = activeRules.find((candidate) => {
        const keyword = candidate.palavraChave.trim().toLocaleLowerCase("pt-BR");
        if (!keyword) return false;
        if (candidate.escopo === "specific_post" && candidate.postId !== mediaId) return false;
        if (candidate.escopo === "selected_posts") return false; // Selected-post filtering needs an explicit post list.
        if (candidate.tipoCorrespondencia === "exact") return normalizedText === keyword;
        if (candidate.tipoCorrespondencia === "starts_with") return normalizedText.startsWith(keyword);
        return normalizedText.includes(keyword);
      });

      if (!rule) {
        await db.update(eventos).set({ status: "no_match" }).where(eq(eventos.id, inserted.id));
        continue;
      }

      await db.update(eventos).set({
        automacaoId: rule.id,
        status: "matched_dry_run",
      }).where(eq(eventos.id, inserted.id));
      matched += 1;
    } catch (error) {
      console.error("Falha ao processar evento do Instagram", error);
    }
  }

  return NextResponse.json({
    received: true,
    recorded,
    matched,
    sendingEnabled: false,
  });
}
