import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getInstagramAccessToken, getInstagramAccountId } from "@/lib/instagram-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const accessToken = await getInstagramAccessToken();
  const accountId = await getInstagramAccountId();
  if (!accessToken || !accountId) {
    return NextResponse.json({ error: "Conecte uma conta profissional do Instagram antes de carregar as mídias." }, { status: 400 });
  }

  try {
    const url = new URL(`https://graph.instagram.com/v26.0/${encodeURIComponent(accountId)}/media`);
    url.searchParams.set("fields", "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp");
    url.searchParams.set("limit", "50");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.error) {
      console.error("Falha ao carregar mídias do Instagram", {
        status: response.status,
        message: payload?.error?.message ?? "Resposta inválida da API",
        code: payload?.error?.code,
      });
      return NextResponse.json({
        error: payload?.error?.message ? `A API do Instagram recusou a consulta: ${String(payload.error.message)}` : `Falha ao carregar mídias (HTTP ${response.status}).`,
      }, { status: 502 });
    }

    const media = (Array.isArray(payload?.data) ? payload.data : []).filter((item: any) => typeof item?.id === "string").map((item: any) => ({
      id: String(item.id),
      ...(typeof item.caption === "string" ? { caption: item.caption } : {}),
      ...(typeof item.media_type === "string" ? { media_type: item.media_type } : {}),
      ...(typeof item.media_url === "string" ? { media_url: item.media_url } : {}),
      ...(typeof item.thumbnail_url === "string" ? { thumbnail_url: item.thumbnail_url } : {}),
      ...(typeof item.permalink === "string" ? { permalink: item.permalink } : {}),
      ...(typeof item.timestamp === "string" ? { timestamp: item.timestamp } : {}),
    }));
    return NextResponse.json({ media, count: media.length });
  } catch (error) {
    console.error("Erro inesperado ao consultar mídias do Instagram", error);
    return NextResponse.json({ error: "Não foi possível consultar as mídias do Instagram." }, { status: 502 });
  }
}
