import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { automacoes } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toClient(row: typeof automacoes.$inferSelect) {
  return {
    id: row.id,
    name: row.nome,
    keyword: row.palavraChave,
    scope: row.escopo === "specific_post" ? "Publicação selecionada" : row.escopo === "selected_posts" ? "Publicações selecionadas" : "Todas as publicações",
    status: row.ativa ? "Ativa" as const : "Pausada" as const,
    replies: 0,
    dms: 0,
  };
}

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  try {
    const rows = await db.select().from(automacoes).orderBy(desc(automacoes.criadoEm));
    return NextResponse.json({ automations: rows.map(toClient) });
  } catch (error) {
    console.error("Falha ao listar automações", error);
    return NextResponse.json({ error: "Não foi possível carregar as automações." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const input = body as Record<string, unknown>;
  const nome = typeof input.nome === "string" ? input.nome.trim() : "";
  const palavraChave = typeof input.palavraChave === "string" ? input.palavraChave.trim() : "";
  if (!nome || nome.length > 160 || !palavraChave || palavraChave.length > 200) {
    return NextResponse.json({ error: "Informe nome e palavra-chave válidos." }, { status: 400 });
  }
  try {
    const [row] = await db.insert(automacoes).values({
      nome,
      palavraChave,
      tipoCorrespondencia: "contains",
      escopo: "all_posts",
      ativa: false,
    }).returning();
    return NextResponse.json({ automation: toClient(row) }, { status: 201 });
  } catch (error) {
    console.error("Falha ao criar automação", error);
    return NextResponse.json({ error: "Não foi possível salvar a automação." }, { status: 500 });
  }
}
