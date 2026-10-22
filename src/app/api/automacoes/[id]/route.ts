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
  const input = (body as Record<string, unknown> | null) ?? {};
  const ativa = input.ativa;
  const escopo = input.escopo;
  const hasPostIds = Object.prototype.hasOwnProperty.call(input, "postIds");
  let postId: string | null | undefined;
  if (ativa !== undefined && typeof ativa !== "boolean") return NextResponse.json({ error: "Status da automação inválido." }, { status: 400 });
  if (escopo !== undefined && !["all_posts", "specific_post", "selected_posts"].includes(String(escopo))) return NextResponse.json({ error: "Escopo inválido." }, { status: 400 });
  if (escopo === "selected_posts" || escopo === "specific_post") {
    if (!hasPostIds || !Array.isArray(input.postIds)) return NextResponse.json({ error: "Selecione as mídias antes de salvar." }, { status: 400 });
    const ids = input.postIds;
    const max = escopo === "specific_post" ? 1 : 5;
    if (ids.length < 1 || ids.length > max || ids.some((value) => typeof value !== "string" || !/^\\d{5,30}$/.test(value))) return NextResponse.json({ error: `Selecione de 1 a ${max} mídia(s) válida(s).` }, { status: 400 });
    postId = escopo === "specific_post" ? ids[0] as string : JSON.stringify(ids);
    if (postId.length > 120) return NextResponse.json({ error: "A seleção excede o limite de armazenamento. Reduza a quantidade de mídias." }, { status: 400 });
  } else if (escopo === "all_posts") {
    postId = null;
  }
  if (ativa === undefined && escopo === undefined && !hasPostIds) return NextResponse.json({ error: "Nenhuma alteração informada." }, { status: 400 });

  try {
    const update: Partial<typeof automacoes.$inferInsert> = { atualizadoEm: new Date() };
    if (typeof ativa === "boolean") update.ativa = ativa;
    if (typeof escopo === "string") update.escopo = escopo;
    if (postId !== undefined) update.postId = postId;
    const [row] = await db.update(automacoes).set(update).where(eq(automacoes.id, id)).returning();
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
