import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  const configuredAccountId = process.env.INSTAGRAM_ACCOUNT_ID || null;

  const configured = {
    appSecret: Boolean(process.env.META_APP_SECRET),
    verifyToken: Boolean(process.env.META_VERIFY_TOKEN),
    accessToken: Boolean(accessToken),
    instagramAccountId: Boolean(configuredAccountId),
  };

  // Verify the identity associated with the configured token without ever returning the token.
  let identity: { ok: boolean; id?: string; username?: string; matchesConfiguredAccount?: boolean; error?: string } = {
    ok: false,
  };

  if (accessToken) {
    try {
      const url = new URL("https://graph.instagram.com/v26.0/me");
      url.searchParams.set("fields", "id,username");
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));

      if (response.ok && typeof payload?.id === "string") {
        identity = {
          ok: true,
          id: payload.id,
          ...(typeof payload.username === "string" ? { username: payload.username } : {}),
          matchesConfiguredAccount: configuredAccountId ? payload.id === configuredAccountId : false,
        };
      } else {
        identity = {
          ok: false,
          error: typeof payload?.error?.message === "string"
            ? payload.error.message
            : `Instagram API returned HTTP ${response.status}`,
        };
      }
    } catch {
      identity = { ok: false, error: "Não foi possível consultar a identidade do token na API do Instagram." };
    }
  }

  return NextResponse.json({
    ...configured,
    configured: Object.values(configured).every(Boolean),
    webhookUrl: new URL("/api/webhook/instagram", request.url).toString(),
    tokenIdentity: identity,
  });
}
