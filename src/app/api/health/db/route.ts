import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json(
      { ok: false, database: "missing", error: "DATABASE_URL não está configurada." },
      { status: 503 },
    );
  }

  try {
    const sql = neon(url);
    const rows = await sql`select current_database() as database, now() as checked_at`;
    const tables = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('automacoes', 'variacoes_resposta', 'contatos', 'eventos', 'fila_envios', 'configuracoes')
    `;
    const present = new Set(tables.map((row) => String(row.table_name)));
    const expected = ["automacoes", "variacoes_resposta", "contatos", "eventos", "fila_envios", "configuracoes"];
    const missingTables = expected.filter((table) => !present.has(table));

    return NextResponse.json({
      ok: missingTables.length === 0,
      database: "connected",
      databaseName: rows[0]?.database ?? null,
      checkedAt: rows[0]?.checked_at ?? null,
      tables: { present: expected.filter((table) => present.has(table)), missing: missingTables },
    }, { status: missingTables.length === 0 ? 200 : 503 });
  } catch (error) {
    console.error("DashReply database health check failed", error);
    return NextResponse.json(
      { ok: false, database: "error", error: "Não foi possível consultar o banco. Verifique DATABASE_URL e as permissões do Neon." },
      { status: 503 },
    );
  }
}
