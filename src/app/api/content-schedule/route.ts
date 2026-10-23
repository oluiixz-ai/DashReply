import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getSql() {
  const url = process.env.DATABASE_URL;
  return url ? neon(url) : null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  try {
    const plans = await sql`SELECT id, profile_name AS "profileName", instagram_handle AS handle, caption_text AS "captionText", scheduled_at AS "scheduledAt", video_file_name AS "videoFileName", status, video_url AS "videoUrl", created_at AS "createdAt" FROM public.content_schedule_plans WHERE user_email = ${session.email} ORDER BY scheduled_at ASC LIMIT 100`;
    return NextResponse.json({ plans });
  } catch (error) {
    console.error("Failed to list content schedule plans", error);
    return NextResponse.json({ error: "Não foi possível carregar os planejamentos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const sql = getSql();
  if (!sql) return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  try {
    const body = await request.json();
    const profileName = typeof body.profileName === "string" ? body.profileName.slice(0, 100) : "";
    const handle = typeof body.handle === "string" ? body.handle.slice(0, 100) : "";
    const captionText = typeof body.captionText === "string" ? body.captionText.slice(0, 2200) : "";
    const videoFileName = typeof body.videoFileName === "string" ? body.videoFileName.slice(0, 255) : "";
    const scheduledAt = new Date(body.scheduledAt);
    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Escolha uma data e horário futuros." }, { status: 400 });
    }
    if (!videoFileName) return NextResponse.json({ error: "Selecione um vídeo antes de salvar o planejamento." }, { status: 400 });
    const rows = await sql`INSERT INTO public.content_schedule_plans (user_email, profile_name, instagram_handle, caption_text, scheduled_at, video_file_name, status) VALUES (${session.email}, ${profileName}, ${handle}, ${captionText}, ${scheduledAt.toISOString()}, ${videoFileName}, 'planned') RETURNING id, profile_name AS "profileName", instagram_handle AS handle, caption_text AS "captionText", scheduled_at AS "scheduledAt", video_file_name AS "videoFileName", status, created_at AS "createdAt"`;
    return NextResponse.json({ plan: rows[0], message: "Planejamento salvo no banco de dados. A publicação automática ainda precisa da conexão de mídia e permissões do Instagram." }, { status: 201 });
  } catch (error) {
    console.error("Failed to save content schedule plan", error);
    return NextResponse.json({ error: "Não foi possível salvar o planejamento." }, { status: 500 });
  }
}
