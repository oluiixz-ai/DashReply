import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const configured = {
    appSecret: Boolean(process.env.META_APP_SECRET),
    verifyToken: Boolean(process.env.META_VERIFY_TOKEN),
    accessToken: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN),
    instagramAccountId: Boolean(process.env.INSTAGRAM_ACCOUNT_ID),
  };

  return NextResponse.json({
    ...configured,
    configured: Object.values(configured).every(Boolean),
    webhookUrl: new URL("/api/webhook/instagram", request.url).toString(),
  });
}
