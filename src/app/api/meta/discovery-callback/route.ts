import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { configuracoes } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirect(request: Request, kind: "success" | "error", message: string) {
  const url = new URL("/biblioteca", request.url);
  url.searchParams.set("discovery_connection", kind);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.has("error")) return redirect(request, "error", "A autorização do Facebook foi cancelada ou recusada.");
  if (!code || !state) return redirect(request, "error", "A Meta não retornou o código de autorização.");

  const secret = process.env.SESSION_SECRET;
  const appId = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
  if (!secret || !appId || !appSecret || !db) return redirect(request, "error", "Configure as credenciais do Login do Facebook e o banco de dados.");

  try {
    const verified = await jwtVerify(state, new TextEncoder().encode(secret));
    if (verified.payload.purpose !== "reels-business-discovery" || typeof verified.payload.email !== "string") {
      return redirect(request, "error", "O estado de segurança da conexão é inválido.");
    }

    const redirectUri = new URL("/api/meta/discovery-callback", request.url).toString();
    const exchangeUrl = new URL("https://graph.facebook.com/v26.0/oauth/access_token");
    exchangeUrl.searchParams.set("client_id", appId);
    exchangeUrl.searchParams.set("client_secret", appSecret);
    exchangeUrl.searchParams.set("redirect_uri", redirectUri);
    exchangeUrl.searchParams.set("code", code);
    const exchange = await fetch(exchangeUrl, { cache: "no-store" });
    const exchangeData = await exchange.json().catch(() => ({}));
    if (!exchange.ok || typeof exchangeData.access_token !== "string") {
      console.error("Meta discovery OAuth exchange failed", { status: exchange.status, code: exchangeData?.error?.code });
      return redirect(request, "error", "Não foi possível trocar o código de autorização. Confira o Login do Facebook e a URL de retorno.");
    }

    let accessToken = exchangeData.access_token as string;
    const longUrl = new URL("https://graph.facebook.com/v26.0/oauth/access_token");
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", appId);
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("fb_exchange_token", accessToken);
    const longResponse = await fetch(longUrl, { cache: "no-store" });
    const longData = await longResponse.json().catch(() => ({}));
    if (longResponse.ok && typeof longData.access_token === "string") accessToken = longData.access_token;

    const pagesUrl = new URL("https://graph.facebook.com/v26.0/me/accounts");
    pagesUrl.searchParams.set("fields", "id,name,instagram_business_account{id,username}");
    pagesUrl.searchParams.set("limit", "100");
    pagesUrl.searchParams.set("access_token", accessToken);
    const pagesResponse = await fetch(pagesUrl, { cache: "no-store" });
    const pagesData = await pagesResponse.json().catch(() => ({}));
    const connectedPage = Array.isArray(pagesData?.data)
      ? pagesData.data.find((page: any) => typeof page?.instagram_business_account?.id === "string")
      : null;

    if (!pagesResponse.ok || !connectedPage?.instagram_business_account?.id) {
      console.error("Meta discovery page lookup failed", { status: pagesResponse.status, code: pagesData?.error?.code });
      return redirect(request, "error", "Nenhuma conta profissional do Instagram vinculada a uma Página do Facebook foi encontrada. Vincule a conta e tente novamente.");
    }

    const entries = [
      { chave: "reels_discovery_access_token", valor: accessToken },
      { chave: "reels_discovery_account_id", valor: String(connectedPage.instagram_business_account.id) },
      { chave: "reels_discovery_username", valor: String(connectedPage.instagram_business_account.username || "") },
      { chave: "reels_discovery_page_name", valor: String(connectedPage.name || "") },
    ];
    for (const entry of entries) {
      await db.insert(configuracoes).values({ ...entry, atualizadoEm: new Date() }).onConflictDoUpdate({
        target: configuracoes.chave,
        set: { valor: entry.valor, atualizadoEm: new Date() },
      });
    }
    return redirect(request, "success", "Conexão de descoberta concluída. Agora você pode consultar perfis profissionais públicos.");
  } catch (error) {
    console.error("Meta discovery OAuth callback failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return redirect(request, "error", "Não foi possível concluir a conexão. Tente novamente.");
  }
}
