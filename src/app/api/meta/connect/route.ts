import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Faça login no DashReply primeiro." }, { status: 401 });

  const appId = process.env.META_APP_ID || "993144227178687";
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.json({ error: "Configure META_APP_ID e META_APP_SECRET nas variáveis da Vercel." }, { status: 503 });
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return NextResponse.json({ error: "SESSION_SECRET não está configurado corretamente." }, { status: 503 });

  const redirectUri = new URL("/api/meta/callback", request.url).toString();
  const state = await new SignJWT({ email: session.email, purpose: "instagram-oauth" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(secret));

  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages");
  url.searchParams.set("state", state);
  url.searchParams.set("force_authentication", "1");

  return NextResponse.redirect(url);
}
