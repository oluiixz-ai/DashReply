import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventos } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  try {
    const rows = await db.select().from(eventos).orderBy(desc(eventos.criadoEm)).limit(100);
    const events = rows.map((row) => {
      const detail = row.detalhe && typeof row.detalhe === "object" ? row.detalhe as Record<string, unknown> : {};
      const text = typeof detail.text === "string" ? detail.text : typeof detail.message === "string" ? detail.message : "";
      const from = detail.from && typeof detail.from === "object" ? detail.from as Record<string, unknown> : {};
      const media = detail.media && typeof detail.media === "object" ? detail.media as Record<string, unknown> : {};
      return {
        id: row.id,
        type: row.tipo,
        commentId: row.commentId,
        username: typeof from.username === "string" ? from.username : "",
        text,
        mediaId: typeof media.id === "string" ? media.id : "",
        status: row.status,
        error: row.erro,
        createdAt: row.criadoEm,
      };
    });
    return NextResponse.json({ events });
  } catch (error) {
    console.error("Falha ao listar eventos do Instagram", error);
    return NextResponse.json({ error: "Não foi possível carregar os eventos." }, { status: 500 });
  }
}
