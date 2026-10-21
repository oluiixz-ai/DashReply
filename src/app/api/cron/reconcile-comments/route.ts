import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { automacoes, eventos } from "@/lib/db/schema";
import { getInstagramAccessToken, getInstagramAccountId } from "@/lib/instagram-token";
import { getInstagramAccessToken, getInstagramAccountId } from "@/lib/instagram-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type IGComment = {
  id?: string;
  text?: string;
  timestamp?: string;
  from?: { id?: string; username?: string };
  media?: { id?: string };
};

async function graphGet(path: string, token: string) {
  const url = new URL(`https://graph.instagram.com/v26.0/${path}`);
  url.searchParams.set("access_token", token);
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Instagram API returned HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

function matches(text: string, keyword: string, mode: string) {
  const body = text.trim().toLocaleLowerCase("pt-BR");
  const needle = keyword.trim().toLocaleLowerCase("pt-BR");
  if (!needle) return false;
  if (mode === "exact") return body === needle;
  if (mode === "starts_with") return body.startsWith(needle);
  return body.includes(needle);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!db) return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });

  const token = await getInstagramAccessToken();
  const accountId = await getInstagramAccountId();
  if (!token || !accountId) {
    return NextResponse.json({ error: "Token ou ID da conta do Instagram não configurado." }, { status: 503 });
  }

  try {
    const rules = await db.select().from(automacoes).where(eq(automacoes.ativa, true));
    if (!rules.length) return NextResponse.json({ ok: true, scannedMedia: 0, commentsSeen: 0, matched: 0, message: "Nenhuma automação ativa." });

    const mediaIds = new Set<string>();
    for (const rule of rules) {
      if (rule.escopo === "specific_post" && rule.postId) mediaIds.add(rule.postId);
      else if (rule.escopo !== "selected_posts") {
        // For all-post automations, scan the account's latest 10 media items.
        const media = await graphGet(`${encodeURIComponent(accountId)}/media?fields=id,timestamp&limit=10`, token);
        for (const item of (Array.isArray(media.data) ? media.data : [])) {
          if (item?.id) mediaIds.add(String(item.id));
        }
      }
    }

    const cutoff = Date.now() - 72 * 60 * 60 * 1000;
    let commentsSeen = 0;
    let recorded = 0;
    let matched = 0;
    const errors: string[] = [];

    for (const mediaId of mediaIds) {
      try {
        const result = await graphGet(`${encodeURIComponent(mediaId)}/comments?fields=id,text,timestamp,from,media&limit=100`, token);
        const comments: IGComment[] = Array.isArray(result.data) ? result.data : [];
        for (const comment of comments) {
          if (!comment.id || !comment.text || !comment.timestamp) continue;
          if (Date.parse(comment.timestamp) < cutoff) continue;
          commentsSeen += 1;
          const [inserted] = await db.insert(eventos).values({
            tipo: "comments_poll",
            commentId: String(comment.id),
            instagramUserId: comment.from?.id ? String(comment.from.id) : null,
            status: "received",
            detalhe: { source: "polling", mediaId, text: comment.text, timestamp: comment.timestamp, username: comment.from?.username ?? null },
          }).onConflictDoNothing().returning({ id: eventos.id });

          // A previously recorded webhook/poll event means this comment has already been seen.
          if (!inserted) continue;
          recorded += 1;

          const applicableRules = rules.filter((rule) => {
            if (rule.escopo === "specific_post" && rule.postId !== mediaId) return false;
            if (rule.escopo === "selected_posts") return false;
            return matches(comment.text!, rule.palavraChave, rule.tipoCorrespondencia);
          });
          if (!applicableRules.length) {
            await db.update(eventos).set({ status: "no_match" }).where(eq(eventos.id, inserted.id));
            continue;
          }
          const rule = applicableRules[0];
          await db.update(eventos).set({ automacaoId: rule.id, status: "matched_dry_run" }).where(eq(eventos.id, inserted.id));
          matched += 1;
        }
      } catch (error) {
        errors.push(`${mediaId}: ${error instanceof Error ? error.message : "falha desconhecida"}`);
      }
    }

    console.info("Instagram comment reconciliation completed", { scannedMedia: mediaIds.size, commentsSeen, recorded, matched, errorCount: errors.length });
    return NextResponse.json({ ok: errors.length === 0, scannedMedia: mediaIds.size, commentsSeen, recorded, matched, errors, sendingEnabled: false });
  } catch (error) {
    console.error("Instagram comment reconciliation failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao consultar comentários." }, { status: 502 });
  }
}
