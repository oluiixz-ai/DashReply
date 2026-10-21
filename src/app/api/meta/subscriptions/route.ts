import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRAPH_URL = "https://graph.instagram.com/v26.0/me/subscribed_apps";

function getAccessToken() {
  return process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
}

async function callInstagram(method: "GET" | "POST") {
  const token = getAccessToken();
  if (!token) {
    return NextResponse.json(
      { error: "Token ausente. Configure INSTAGRAM_ACCESS_TOKEN na Vercel." },
      { status: 503 },
    );
  }

  const url = new URL(GRAPH_URL);
  const init: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  };

  if (method === "POST") {
    url.searchParams.set("subscribed_fields", "comments,messages,live_comments");
  }

  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : "A API do Instagram recusou a solicitação.";
    console.error("Instagram subscribed_apps falhou", {
      status: response.status,
      errorCode: payload?.error?.code,
      errorType: payload?.error?.type,
    });
    return NextResponse.json(
      { ok: false, status: response.status, error: message, details: payload?.error?.error_subcode ?? null },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, action: method === "POST" ? "subscribe" : "check", result: payload });
}

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  return callInstagram("GET");
}

export async function POST() {
  if (!(await getSession())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  return callInstagram("POST");
}
