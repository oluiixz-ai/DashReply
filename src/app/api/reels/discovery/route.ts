import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type AnyRecord = Record<string, any>;
const USERNAME_RE = /^[a-z0-9._]{1,30}$/;

function firstString(...values: unknown[]): string | null {
  for (const value of values) if (typeof value === "string" && value.trim()) return value;
  return null;
}
function listFrom(payload: AnyRecord): AnyRecord[] {
  const candidates = [payload?.reels, payload?.data?.reels, payload?.data?.items, payload?.items, payload?.data, payload?.results];
  return candidates.find(Array.isArray) || [];
}
function normalize(item: AnyRecord, index: number) {
  const mediaUrl = firstString(item.video_url, item.videoUrl, item.media_url, item.mediaUrl, item.video, item.download_url, item.url);
  const thumbnailUrl = firstString(item.thumbnail_url, item.thumbnailUrl, item.display_url, item.displayUrl, item.cover_url, item.image_url, item.thumbnail);
  const permalink = firstString(item.permalink, item.permalink_url, item.url, item.shortcode ? `https://www.instagram.com/reel/${item.shortcode}/` : null);
  const timestamp = firstString(item.taken_at, item.timestamp, item.date, item.created_at, item.takenAt);
  return {
    id: String(item.id ?? item.pk ?? item.shortcode ?? permalink ?? index),
    caption: firstString(item.caption, item.text, item.title) || "",
    mediaType: "VIDEO",
    mediaUrl,
    thumbnailUrl,
    permalink,
    timestamp,
    provider: typeof item.provider === "string" ? item.provider : undefined,
    views: typeof item.play_count === "number" ? item.play_count : typeof item.view_count === "number" ? item.view_count : null,
  };
}
async function fetchInstaloader(username: string) {
  const base = process.env.INSTALOADER_SERVICE_URL?.replace(/\/$/, "");
  const token = process.env.INSTALOADER_SERVICE_TOKEN;
  if (!base || !token) throw new Error("Instaloader não configurado");
  const response = await fetch(`${base}/reels`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ handle: username, limit: 18 }),
    cache: "no-store",
    signal: AbortSignal.timeout(35000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.detail === "string" ? payload.detail : `Instaloader respondeu ${response.status}`);
  const rows = Array.isArray(payload?.reels) ? payload.reels : [];
  return rows.map((item: AnyRecord, index: number) => normalize({ ...item, provider: "Instaloader" }, index)).filter((item: ReturnType<typeof normalize>) => item.mediaUrl || item.thumbnailUrl || item.permalink);
}
async function fetchInScrape(username: string) {
  const key = process.env.INSCRAPE_API_KEY || process.env.INSCRAPE_KEY;
  if (!key) throw new Error("InScrape não configurado");
  const url = new URL("https://api.inscrape.dev/v1/instagram/reels");
  url.searchParams.set("handle", username);
  const response = await fetch(url, {
    headers: { "x-api-key": key, "Accept": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = payload?.error?.code || payload?.code;
    throw new Error(code === "INSUFFICIENT_CREDITS" || response.status === 402
      ? "Os créditos gratuitos do InScrape acabaram."
      : typeof payload?.error?.message === "string" ? payload.error.message : `InScrape respondeu ${response.status}`);
  }
  const rows = listFrom(payload);
  return rows.map((item, index) => normalize({ ...item, provider: "InScrape" }, index)).filter((item: ReturnType<typeof normalize>) => item.mediaUrl || item.thumbnailUrl || item.permalink);
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const username = new URL(request.url).searchParams.get("username")?.trim().replace(/^@/, "").toLowerCase();
  const configured = Boolean((process.env.INSTALOADER_SERVICE_URL && process.env.INSTALOADER_SERVICE_TOKEN) || process.env.INSCRAPE_API_KEY || process.env.INSCRAPE_KEY);
  if (!username) return NextResponse.json({ connected: configured, providers: {
    instaloader: Boolean(process.env.INSTALOADER_SERVICE_URL && process.env.INSTALOADER_SERVICE_TOKEN),
    inscrape: Boolean(process.env.INSCRAPE_API_KEY || process.env.INSCRAPE_KEY),
  } });
  if (!USERNAME_RE.test(username)) return NextResponse.json({ error: "Nome de usuário inválido." }, { status: 400 });
  if (!configured) return NextResponse.json({ error: "Configure INSCRAPE_API_KEY e/ou o serviço Instaloader para ativar a busca." }, { status: 503 });

  const failures: string[] = [];
  const providers: string[] = [];
  try {
    if (process.env.INSTALOADER_SERVICE_URL && process.env.INSTALOADER_SERVICE_TOKEN) {
      try {
        const media = await fetchInstaloader(username);
        if (media.length) providers.push("Instaloader");
        if (media.length) return NextResponse.json({ connected: true, profile: { username }, media, provider: "Instaloader", fallbackUsed: false });
        failures.push("Instaloader não encontrou Reels nesta consulta.");
      } catch (error) {
        failures.push(error instanceof Error ? error.message : "Falha no Instaloader.");
        console.warn("Instaloader provider failed; trying InScrape.", failures[failures.length - 1]);
      }
    }
    if (process.env.INSCRAPE_API_KEY || process.env.INSCRAPE_KEY) {
      try {
        const media = await fetchInScrape(username);
        if (media.length) providers.push("InScrape");
        return NextResponse.json({
          connected: true, profile: { username }, media, provider: "InScrape",
          fallbackUsed: Boolean(process.env.INSTALOADER_SERVICE_URL && process.env.INSTALOADER_SERVICE_TOKEN),
          note: failures.length ? "A busca foi concluída pelo provedor alternativo." : undefined,
        });
      } catch (error) {
        failures.push(error instanceof Error ? error.message : "Falha no InScrape.");
      }
    }
    return NextResponse.json({ error: `Não foi possível consultar @${username}. ${failures.join(" ")}` }, { status: 502 });
  } catch (error) {
    console.error("Reels discovery failed", error);
    return NextResponse.json({ error: "Não foi possível consultar este perfil agora." }, { status: 500 });
  }
}
