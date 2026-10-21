import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getInstagramAccessToken, getInstagramAccountId } from "@/lib/instagram-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApiCheck = { ok: boolean; httpStatus?: number; count?: number; error?: string; errorCode?: number; errorType?: string };

async function graphCheck(path: string, token: string): Promise<{ status: number; payload: any }> {
  const url = new URL(`https://graph.instagram.com/v26.0/${path}`);
  url.searchParams.set("access_token", token);
  const response = await fetch(url, { cache: "no-store" });
  return { status: response.status, payload: await response.json().catch(() => ({})) };
}

function summarize(response: { status: number; payload: any }): ApiCheck {
  const error = response.payload?.error;
  return {
    ok: response.status >= 200 && response.status < 300,
    httpStatus: response.status,
    ...(Array.isArray(response.payload?.data) ? { count: response.payload.data.length } : {}),
    ...(error?.message ? { error: String(error.message) } : {}),
    ...(typeof error?.code === "number" ? { errorCode: error.code } : {}),
    ...(error?.type ? { errorType: String(error.type) } : {}),
  };
}

export async function GET(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const accessToken = await getInstagramAccessToken();
  const configuredAccountId = await getInstagramAccountId();
  const configured = {
    appSecret: Boolean(process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET),
    verifyToken: Boolean(process.env.META_VERIFY_TOKEN),
    accessToken: Boolean(accessToken),
    instagramAccountId: Boolean(configuredAccountId),
  };

  let identity: { ok: boolean; id?: string; username?: string; matchesConfiguredAccount?: boolean; error?: string } = { ok: false };
  let mediaCheck: ApiCheck | null = null;
  let commentsCheck: ApiCheck | null = null;

  if (accessToken) {
    try {
      const me = await graphCheck("me?fields=id,username", accessToken);
      if (me.status >= 200 && me.status < 300 && typeof me.payload?.id === "string") {
        identity = {
          ok: true,
          id: me.payload.id,
          ...(typeof me.payload.username === "string" ? { username: me.payload.username } : {}),
          matchesConfiguredAccount: configuredAccountId ? me.payload.id === configuredAccountId : false,
        };
        if (configuredAccountId) {
          const media = await graphCheck(`${encodeURIComponent(configuredAccountId)}/media?fields=id,timestamp&limit=5`, accessToken);
          mediaCheck = summarize(media);
          const firstMediaId = Array.isArray(media.payload?.data) ? media.payload.data[0]?.id : null;
          if (media.status >= 200 && media.status < 300 && firstMediaId) {
            const comments = await graphCheck(`${encodeURIComponent(String(firstMediaId))}/comments?fields=id,text,timestamp&limit=5`, accessToken);
            commentsCheck = summarize(comments);
          } else if (media.status >= 200 && media.status < 300) {
            commentsCheck = { ok: false, error: "A API não retornou publicações para testar comentários." };
          }
        }
      } else {
        identity = { ok: false, error: me.payload?.error?.message || `Instagram API returned HTTP ${me.status}` };
      }
    } catch {
      identity = { ok: false, error: "Não foi possível consultar a identidade do token na API do Instagram." };
    }
  }

  const apiReady = Boolean(identity.ok && identity.matchesConfiguredAccount && mediaCheck?.ok && commentsCheck?.ok);
  return NextResponse.json({
    ...configured,
    configured: Object.values(configured).every(Boolean),
    webhookUrl: new URL("/api/webhook/instagram", request.url).toString(),
    tokenIdentity: identity,
    commentApiDiagnostic: {
      media: mediaCheck ?? { ok: false, error: "A consulta de publicações não foi executada." },
      comments: commentsCheck ?? { ok: false, error: "A consulta de comentários não foi executada." },
      apiReady,
      note: "Consulta apenas metadados e até cinco comentários da primeira publicação. Não envia respostas nem DMs.",
    },
  });
}
