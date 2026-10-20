import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { automacoes } from "@/lib/db/schema";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Banco não configurado. Configure DATABASE_URL no Vercel." }, { status: 503 });
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  const parsed = z.object({ ativa: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe um status válido." }, { status: 400 });
  const [updated] = await db.update(automacoes).set({ ativa: parsed.data.ativa, atualizadoEm: new Date() }).where(eq(automacoes.id, id)).returning();
  if (!updated) return NextResponse.json({ error: "Automação não encontrada." }, { status: 404 });
  return NextResponse.json({ automacao: updated });
}
