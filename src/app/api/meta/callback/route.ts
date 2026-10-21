import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { configuracoes } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resultRedirect(request: Request, kind: "success" | "error", message: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("instagram_connection", kind);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (providerError) return resultRedirect(request, "error", "A autorização do Instagram foi cancelada ou recusada.");
  if (!code || !state) return resultRedirect(request, "error", "A Meta não retornou o código de autorização esperado.");

  const sessionSecret = process.env.SESSION_SECRET;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const appId = process.env.INSTAGRAM_APP_ID;
  if (!sessionSecret || !appSecret || !appId || !db) return resultRedirect(request, "error", "A configuração do servidor está incompleta.");

  try {
    const verified = await jwtVerify(state, new TextEncoder().encode(sessionSecret));
    if (verified.payload.purpose !== "instagram-oauth" || typeof verified.payload.email !== "string") {
      return resultRedirect(request, "error", "O estado de segurança da conexão é inválido.");
    }

    const redirectUri = new URL("/api/meta/callback", request.url).toString();
    const form = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });
    const exchange = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      cache: "no-store",
    });
    const shortToken = await exchange.json().catch(() => ({}));
    if (!exchange.ok || !shortToken.access_token) {
      console.error("Instagram OAuth code exchange failed", { status: exchange.status, errorType: shortToken.error_type || null });
      return resultRedirect(request, "error", "A Meta recusou a troca do código. Confira a URL de retorno e as configurações do app.");
    }

    let accessToken = String(shortToken.access_token);
    let expiresIn: number | null = typeof shortToken.expires_in === "number" ? shortToken.expires_in : null;
    try {
      const longUrl = new URL("https://graph.instagram.com/access_token");
      longUrl.searchParams.set("grant_type", "ig_exchange_token");
      longUrl.searchParams.set("client_secret", appSecret);
      longUrl.searchParams.set("access_token", accessToken);
      const longResponse = await fetch(longUrl, { cache: "no-store" });
      const longPayload = await longResponse.json().catch(() => ({}));
      if (longResponse.ok && typeof longPayload.access_token === "string") {
        accessToken = longPayload.access_token;
        expiresIn = typeof longPayload.expires_in === "number" ? longPayload.expires_in : expiresIn;
      } else {
        console.warn("Instagram long-lived token exchange unavailable", { status: longResponse.status });
      }
    } catch {
      console.warn("Instagram long-lived token exchange request failed");
    }

    const meUrl = new URL("https://graph.instagram.com/v26.0/me");
    meUrl.searchParams.set("fields", "id,username");
    meUrl.searchParams.set("access_token", accessToken);
    const meResponse = await fetch(meUrl, { cache: "no-store" });
    const me = await meResponse.json().catch(() => ({}));
    if (!meResponse.ok || !me.id) return resultRedirect(request, "error", "A autorização foi recebida, mas não foi possível identificar a conta do Instagram.");

    const values = [
      { chave: "instagram_access_token", valor: accessToken, atualizadoEm: new Date() },
      { chave: "instagram_account_id", valor: String(me.id), atualizadoEm: new Date() },
      { chave: "instagram_username", valor: typeof me.username === "string" ? me.username : "", atualizadoEm: new Date() },
      { chave: "instagram_token_expires_at", valor: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : "", atualizadoEm: new Date() },
    ];
    for (const value of values) {
      await db.insert(configuracoes).values(value).onConflictDoUpdate({
        target: configuracoes.chave,
        set: { valor: value.valor, atualizadoEm: new Date() },
      });
    }
    return resultRedirect(request, "success", `Instagram @${String(me.username || "conectado")} conectado. Recarregue o painel para atualizar o status.`);
  } catch (error) {
    console.error("Instagram OAuth callback failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return resultRedirect(request, "error", "Não foi possível concluir a conexão. Tente novamente.");
  }
}
