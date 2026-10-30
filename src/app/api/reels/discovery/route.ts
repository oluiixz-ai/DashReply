import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { configuracoes } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function setting(key: string) {
  if (!db) return null;
  const [row] = await db.select({ valor: configuracoes.valor }).from(configuracoes).where(eq(configuracoes.chave, key)).limit(1);
  return row?.valor || null;
}

export async function GET(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    const accessToken = await setting("reels_discovery_access_token");
    const accountId = await setting("reels_discovery_account_id");
    const connectedUsername = await setting("reels_discovery_username");
    const pageName = await setting("reels_discovery_page_name");
    const username = new URL(request.url).searchParams.get("username")?.trim().replace(/^@/, "").toLowerCase();

    if (!accessToken || !accountId) {
      return NextResponse.json({ connected: false, error: "Conecte uma conta profissional vinculada a uma Página do Facebook para habilitar a descoberta oficial." }, { status: 200 });
    }
    if (!username) return NextResponse.json({ connected: true, connectedUsername, pageName });
    if (!/^[a-z0-9._]{1,30}$/.test(username)) return NextResponse.json({ error: "Nome de usuário inválido." }, { status: 400 });

    const fields = "username,name,biography,profile_picture_url,followers_count,media_count,media.limit(15){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp}";
    const graphUrl = new URL(`https://graph.facebook.com/v26.0/${encodeURIComponent(accountId)}`);
    graphUrl.searchParams.set("fields", `business_discovery.username(${username}){${fields}}`);
    graphUrl.searchParams.set("access_token", accessToken);
    const response = await fetch(graphUrl, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.error || !payload?.business_discovery) {
      const code = payload?.error?.code;
      const message = typeof payload?.error?.message === "string" ? payload.error.message : "";
      console.error("Instagram Business Discovery failed", { status: response.status, code, message });
      const personalAccountHint = code === 100 || code === 10
        ? " A descoberta oficial só retorna contas profissionais públicas (Empresa ou Criador); perfis pessoais, privados ou não elegíveis não são compatíveis."
        : "";
      return NextResponse.json({ error: (message || "A Meta não retornou dados para este perfil.") + personalAccountHint, code }, { status: 422 });
    }

    const profile = payload.business_discovery;
    const media = Array.isArray(profile.media?.data) ? profile.media.data : [];
    return NextResponse.json({
      connected: true,
      profile: {
        username: profile.username,
        name: profile.name,
        biography: profile.biography,
        profilePictureUrl: profile.profile_picture_url,
        followersCount: profile.followers_count,
        mediaCount: profile.media_count,
      },
      media: media.map((item: any) => ({
        id: String(item.id),
        caption: typeof item.caption === "string" ? item.caption : "",
        mediaType: typeof item.media_type === "string" ? item.media_type : "UNKNOWN",
        mediaUrl: typeof item.media_url === "string" ? item.media_url : null,
        thumbnailUrl: typeof item.thumbnail_url === "string" ? item.thumbnail_url : null,
        permalink: typeof item.permalink === "string" ? item.permalink : null,
        timestamp: typeof item.timestamp === "string" ? item.timestamp : null,
      })),
      note: "A Meta pode omitir o arquivo de mídia em alguns resultados. A disponibilidade do link não concede direitos de reutilização.",
    });
  } catch (error) {
    console.error("Reels discovery request failed", error);
    return NextResponse.json({ error: "Não foi possível consultar a Biblioteca de Reels." }, { status: 500 });
  }
}
