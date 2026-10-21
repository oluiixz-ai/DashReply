import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { automacoes } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const ativa = (body as Record<string, unknown> | null)?.ativa;
  if (typeof ativa !== "boolean") return NextResponse.json({ error: "Informe o status da automação." }, { status: 400 });

  try {
    const [row] = await db.update(automacoes).set({ ativa, atualizadoEm: new Date() }).where(eq(automacoes.id, id)).returning();
    if (!row) return NextResponse.json({ error: "Automação não encontrada." }, { status: 404 });
    return NextResponse.json({ id: row.id, status: row.ativa ? "Ativa" : "Pausada" });
  } catch (error) {
    console.error("Falha ao atualizar automação", error);
    return NextResponse.json({ error: "Não foi possível atualizar a automação." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  try {
    const [row] = await db.delete(automacoes).where(eq(automacoes.id, id)).returning({ id: automacoes.id });
    if (!row) return NextResponse.json({ error: "Automação não encontrada." }, { status: 404 });
    return NextResponse.json({ deleted: true, id: row.id });
  } catch (error) {
    console.error("Falha ao excluir automação", error);
    return NextResponse.json({ error: "Não foi possível excluir a automação." }, { status: 500 });
  }
}
