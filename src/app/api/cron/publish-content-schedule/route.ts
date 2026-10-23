import { NextResponse } from "next/server";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API_VERSION = process.env.META_GRAPH_API_VERSION || "v25.0";

type Plan = {
  id: string;
  caption_text: string | null;
  video_file_name: string;
  video_url: string;
  instagram_media_id: string | null;
};

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

async function graphRequest(
  path: string,
  params: Record<string, string>,
  token: string,
  method: "GET" | "POST" = "POST"
) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${path}`);
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  const options: RequestInit = { method, headers, cache: "no-store" };

  if (method === "GET") {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  } else {
    headers.set("Content-Type", "application/x-www-form-urlencoded");
    options.body = new URLSearchParams(params);
  }

  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(data?.error?.message || `Meta Graph API returned HTTP ${response.status}`);
  }
  return data;
}

async function markFailed(sql: NeonQueryFunction<false, false>, planId: string, message: string) {
  await sql`
    UPDATE public.content_schedule_plans
    SET status = 'failed', error_message = ${message.slice(0, 2000)}, updated_at = NOW()
    WHERE id = ${planId} AND status = 'publishing'
  `;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return jsonError("Não autorizado.", 401);
  }

  const databaseUrl = process.env.DATABASE_URL;
  const token = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  const instagramId = process.env.INSTAGRAM_ACCOUNT_ID;
  if (!databaseUrl) return jsonError("DATABASE_URL não está configurado.", 503);
  if (!token || !instagramId) return jsonError("Configure as credenciais da Meta na Vercel.", 503);

  const sql = neon(databaseUrl);
  const summary = { claimed: 0, containersCreated: 0, published: 0, waiting: 0, failed: 0 };

  // Claim due plans atomically. Processing is split across cron invocations:
  // this request creates the container; later requests check its status and publish it.
  let newPlans: Plan[];
  let pendingPlans: Plan[];
  try {
    // Recover interrupted claims that never persisted a Meta container ID.
    // The route has a 60-second execution limit, so 10 minutes is beyond a normal run.
    await sql`
      UPDATE public.content_schedule_plans
      SET status = 'planned',
          error_message = 'Recuperado automaticamente após interrupção antes de salvar o contêiner.',
          updated_at = NOW()
      WHERE status = 'publishing'
        AND instagram_media_id IS NULL
        AND updated_at < NOW() - INTERVAL '10 minutes'
    `;

    newPlans = await sql`
      UPDATE public.content_schedule_plans
      SET status = 'publishing', updated_at = NOW(), error_message = NULL
      WHERE id IN (
        SELECT id FROM public.content_schedule_plans
        WHERE status = 'planned' AND scheduled_at <= NOW() AND video_url IS NOT NULL
        ORDER BY scheduled_at ASC
        LIMIT 3
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, caption_text, video_file_name, video_url, instagram_media_id
    ` as Plan[];

    pendingPlans = await sql`
      SELECT id, caption_text, video_file_name, video_url, instagram_media_id
      FROM public.content_schedule_plans
      WHERE status = 'publishing' AND instagram_media_id IS NOT NULL
      ORDER BY updated_at ASC
      LIMIT 5
    ` as Plan[];
  } catch (error) {
    console.error("Failed to load content schedule plans", error);
    return jsonError("Não foi possível buscar os agendamentos.", 500);
  }

  summary.claimed = newPlans.length;

  for (const plan of newPlans) {
    try {
      if (!/\.(mp4|mov)$/i.test(plan.video_file_name)) {
        throw new Error("Formato incompatível. Use MP4 ou MOV; WebM precisa ser convertido antes.");
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
      if (!creationId) throw new Error("A Meta não retornou o identificador do contêiner.");

      await sql`
        UPDATE public.content_schedule_plans
        SET instagram_media_id = ${creationId}, updated_at = NOW(), error_message = NULL
        WHERE id = ${plan.id} AND status = 'publishing'
      `;
      summary.containersCreated++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao criar contêiner na Meta.";
      console.error("Could not create Instagram media container", { planId: plan.id, error: message });
      try { await markFailed(sql, plan.id, message); } catch (dbError) {
        console.error("Could not save container creation error", dbError);
      }
      summary.failed++;
    }
  }

  // Check containers created by this or a previous invocation; never sleep inside a function.
  // Refresh updated_at while waiting so a few long-running containers cannot starve later items.
  for (const plan of pendingPlans) {
    const containerId = plan.instagram_media_id;
    if (!containerId) continue;

    let status: any;
    try {
      status = await graphRequest(containerId, { fields: "status_code,status" }, token, "GET");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha temporária ao consultar o contêiner.";
      console.error("Could not check Instagram container status", { planId: plan.id, error: message });
      try {
        await sql`
          UPDATE public.content_schedule_plans
          SET error_message = ${message.slice(0, 2000)}, updated_at = NOW()
          WHERE id = ${plan.id} AND status = 'publishing' AND instagram_media_id = ${containerId}
        `;
      } catch (dbError) {
        console.error("Could not save temporary container status error", dbError);
      }
      summary.waiting++;
      continue;
    }

    const state = String(status.status_code || "");
    const detail = String(status.status || "");

    if (state === "PUBLISHED") {
      // A previous publish request may have succeeded even if saving its response failed.
      // Mark it complete without sending another media_publish request.
      try {
        await sql`
          UPDATE public.content_schedule_plans
          SET status = 'published', error_message = NULL, updated_at = NOW()
          WHERE id = ${plan.id} AND status = 'publishing' AND instagram_media_id = ${containerId}
        `;
        summary.published++;
      } catch (error) {
        console.error("Could not reconcile already-published Instagram container", { planId: plan.id, error });
        summary.waiting++;
      }
      continue;
    }

    if (state === "IN_PROGRESS" || (state !== "FINISHED" && state !== "ERROR" && state !== "EXPIRED")) {
      try {
        await sql`
          UPDATE public.content_schedule_plans
          SET error_message = NULL, updated_at = NOW()
          WHERE id = ${plan.id} AND status = 'publishing' AND instagram_media_id = ${containerId}
        `;
      } catch (error) {
        console.error("Could not refresh waiting Instagram container", { planId: plan.id, error });
      }
      summary.waiting++;
      continue;
    }

    if (state === "ERROR" || state === "EXPIRED") {
      const message = detail || `A Meta informou status ${state}.`;
      try { await markFailed(sql, plan.id, message); } catch (dbError) {
        console.error("Could not save failed Instagram container status", dbError);
      }
      summary.failed++;
      continue;
    }

    try {
      const published = await graphRequest(`${instagramId}/media_publish`, {
        creation_id: containerId
      }, token);
      const publishedId = typeof published.id === "string" ? published.id : "";
      if (!publishedId) throw new Error("A Meta não retornou o ID da publicação.");

      await sql`
        UPDATE public.content_schedule_plans
        SET status = 'published', instagram_media_id = ${publishedId},
            error_message = NULL, updated_at = NOW()
        WHERE id = ${plan.id} AND status = 'publishing' AND instagram_media_id = ${containerId}
      `;
      summary.published++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido na publicação.";
      console.error("Instagram scheduled publish failed", { planId: plan.id, error: message });

      // A publish request can time out after Meta accepted it. Recheck before failing.
      let shouldWait = false;
      try {
        const latest = await graphRequest(containerId, { fields: "status_code,status" }, token, "GET");
        const latestState = String(latest.status_code || "");
        if (latestState === "PUBLISHED") {
          await sql`
            UPDATE public.content_schedule_plans
            SET status = 'published', error_message = NULL, updated_at = NOW()
            WHERE id = ${plan.id} AND status = 'publishing' AND instagram_media_id = ${containerId}
          `;
          summary.published++;
          continue;
        }
        if (latestState === "IN_PROGRESS" || !latestState) {
          shouldWait = true;
        }
      } catch (reconcileError) {
        // The result is ambiguous; preserve the in-flight state rather than risk a duplicate.
        console.error("Could not reconcile uncertain Instagram publish result", { planId: plan.id, error: reconcileError });
        shouldWait = true;
      }

      if (shouldWait) {
        try {
          await sql`
            UPDATE public.content_schedule_plans
            SET error_message = ${message.slice(0, 2000)}, updated_at = NOW()
            WHERE id = ${plan.id} AND status = 'publishing' AND instagram_media_id = ${containerId}
          `;
        } catch (dbError) {
          console.error("Could not preserve uncertain publish state", dbError);
        }
        summary.waiting++;
      } else {
        try { await markFailed(sql, plan.id, message); } catch (dbError) {
          console.error("Could not save publishing error", dbError);
        }
        summary.failed++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    ...summary,
    message: "Processamento executado. Contêineres em processamento serão verificados na próxima execução."
  });
}
