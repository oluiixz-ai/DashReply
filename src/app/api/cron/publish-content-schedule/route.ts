import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API_VERSION = process.env.META_GRAPH_API_VERSION || "v25.0";

type DuePlan = {
  id: string;
  user_email: string;
  caption_text: string | null;
  video_file_name: string;
  video_url: string;
};

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

async function graphRequest(path: string, params: Record<string, string>, token: string, method: "GET" | "POST" = "POST") {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${path}`);
  const options: RequestInit = { method, headers: { Authorization: `Bearer ${token}` }, cache: "no-store" };
  if (method === "GET") {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  } else {
    const body = new URLSearchParams(params);
    options.headers = { ...options.headers, "Content-Type": "application/x-www-form-urlencoded" };
    options.body = body;
  }
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const detail = data?.error?.message || `Meta Graph API returned HTTP ${response.status}`;
    throw new Error(detail);
  }
  return data;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return jsonError("Não autorizado.", 401);

  const databaseUrl = process.env.DATABASE_URL;
  const token = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  const instagramId = process.env.INSTAGRAM_ACCOUNT_ID;
  if (!databaseUrl) return jsonError("DATABASE_URL não está configurado.", 503);
  if (!token || !instagramId) return jsonError("Configure INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_ACCOUNT_ID na Vercel.", 503);

  const sql = neon(databaseUrl);
  const summary = { checked: 0, published: 0, failed: 0, skipped: 0 };
  let plans: DuePlan[];
  try {
    // Claim only due plans once. The publishing status prevents parallel cron runs from processing the same row.
    plans = await sql`
      UPDATE public.content_schedule_plans
      SET status = 'publishing', updated_at = NOW()
      WHERE id IN (
        SELECT id FROM public.content_schedule_plans
        WHERE status = 'planned' AND scheduled_at <= NOW()
          AND video_url IS NOT NULL
        ORDER BY scheduled_at ASC
        LIMIT 5
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, user_email, caption_text, video_file_name, video_url
    ` as DuePlan[];
  } catch (error) {
    console.error("Failed to claim due content plans", error);
    return jsonError("Não foi possível buscar os agendamentos vencidos.", 500);
  }

  summary.checked = plans.length;
  for (const plan of plans) {
    try {
      // Meta's hosted-video publishing flow accepts public MP4/MOV files, not WebM.
      if (!/\.(mp4|mov)$/i.test(plan.video_file_name)) {
        throw new Error("Formato incompatível para publicação automática. Use MP4 ou MOV; o arquivo WebM precisa ser convertido antes.");
      }
      const mediaUrl = new URL(plan.video_url);
      if (mediaUrl.protocol !== "https:") throw new Error("O vídeo precisa ter uma URL HTTPS pública.");
      const container = await graphRequest(`${instagramId}/media`, {
        media_type: "REELS",
        video_url: plan.video_url,
        caption: (plan.caption_text || "").slice(0, 2200),
        share_to_feed: "true"
      }, token);
      const creationId = typeof container.id === "string" ? container.id : "";
      if (!creationId) throw new Error("A Meta não retornou o identificador do contêiner de mídia.");

      // Video processing is asynchronous; poll for up to about 5 minutes.
      let state = "";
      let detail = "";
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 15000));
        const status = await graphRequest(creationId, { fields: "status_code,status" }, token, "GET");
        state = String(status.status_code || "");
        detail = String(status.status || "");
        if (state === "FINISHED") break;
        if (state === "ERROR" || state === "EXPIRED") throw new Error(detail || `A Meta informou status ${state}.`);
      }
      if (state !== "FINISHED") throw new Error("A Meta ainda não terminou de processar o vídeo. O agendamento foi marcado como falha para evitar publicação duplicada; revise antes de tentar novamente.");

      const published = await graphRequest(`${instagramId}/media_publish`, { creation_id: creationId }, token);
      if (typeof published.id !== "string") throw new Error("A Meta não retornou o ID da publicação.");
      await sql`
        UPDATE public.content_schedule_plans
        SET status = 'published', instagram_media_id = ${published.id}, error_message = NULL, updated_at = NOW()
        WHERE id = ${plan.id}
      `;
      summary.published++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido na publicação.";
      console.error("Instagram scheduled publish failed", { planId: plan.id, error: message });
      try {
        await sql`
          UPDATE public.content_schedule_plans
          SET status = 'failed', error_message = ${message.slice(0, 2000)}, updated_at = NOW()
          WHERE id = ${plan.id}
        `;
      } catch (dbError) {
        console.error("Could not save content publishing error", dbError);
      }
      summary.failed++;
    }
  }
  return NextResponse.json({ ok: true, ...summary, message: "Fila de publicação processada. Confira o status de cada planejamento." });
}
