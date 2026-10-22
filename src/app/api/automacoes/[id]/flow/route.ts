import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { configuracoes } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const flowKey = (id: string) => "automation_flow_" + id;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  try {
    const rows = await db.select().from(configuracoes).where(eq(configuracoes.chave, flowKey(id))).limit(1);
    if (!rows[0]?.valor) return NextResponse.json({ flow: null });
    return NextResponse.json({ flow: JSON.parse(rows[0].valor) });
  } catch (error) {
    console.error("Falha ao carregar fluxo", error);
    return NextResponse.json({ error: "Não foi possível carregar o fluxo." }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const flow = body?.flow;
  if (!flow || !Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) return NextResponse.json({ error: "O fluxo deve conter nodes e edges." }, { status: 400 });
  if (flow.nodes.length > 80 || flow.edges.length > 160) return NextResponse.json({ error: "O fluxo excede os limites permitidos." }, { status: 400 });
  const value = JSON.stringify(flow);
  if (value.length > 200000) return NextResponse.json({ error: "O fluxo é muito grande." }, { status: 400 });
  try {
    await db.insert(configuracoes).values({ chave: flowKey(id), valor: value, atualizadoEm: new Date() }).onConflictDoUpdate({
      target: configuracoes.chave,
      set: { valor: value, atualizadoEm: new Date() },
    });
    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Falha ao salvar fluxo", error);
    return NextResponse.json({ error: "Não foi possível salvar o fluxo." }, { status: 500 });
  }
}
