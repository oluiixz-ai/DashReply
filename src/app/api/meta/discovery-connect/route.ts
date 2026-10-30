import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Faça login no DashReply primeiro." }, { status: 401 });

  const appId = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
  const secret = process.env.SESSION_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.json({ error: "A descoberta oficial exige configurar META_APP_ID e META_APP_SECRET (ou FACEBOOK_APP_ID e FACEBOOK_APP_SECRET) para o Login do Facebook no painel da Meta." }, { status: 503 });
  }
  if (!secret || secret.length < 32) return NextResponse.json({ error: "SESSION_SECRET não está configurado corretamente." }, { status: 503 });

  const redirectUri = new URL("/api/meta/discovery-callback", request.url).toString();
  const state = await new SignJWT({ email: session.email, purpose: "reels-business-discovery" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(secret));

  const url = new URL("https://www.facebook.com/v26.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "instagram_basic,pages_show_list,pages_read_engagement");
  url.searchParams.set("state", state);
  url.searchParams.set("auth_type", "rerequest");
  return NextResponse.redirect(url);
}
