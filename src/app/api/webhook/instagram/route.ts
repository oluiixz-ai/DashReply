import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eventos } from "@/lib/db/schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.META_VERIFY_TOKEN && challenge) return new Response(challenge, { status: 200 });
  return NextResponse.json({ error: "Verificação do webhook inválida." }, { status: 403 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return NextResponse.json({ error: "Assinatura ausente." }, { status: 401 });
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  if (!db) return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  const changes = (body?.entry ?? []).flatMap((entry: any) => (entry?.changes ?? []).map((change: any) => ({ entryId: entry.id, field: change.field, value: change.value })));
  for (const item of changes) {
    const value = item.value ?? {};
    const commentId = value.id ?? value.comment_id;
    try {
      await db.insert(eventos).values({ tipo: String(item.field ?? "instagram_event"), commentId: commentId ? String(commentId) : null, instagramUserId: value.from?.id ? String(value.from.id) : null, status: "received", detalhe: value }).onConflictDoNothing();
    } catch (error) { console.error("Falha ao registrar evento do Instagram", error); }
  }
  return NextResponse.json({ received: true });
}
