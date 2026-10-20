import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { automacoes } from "@/lib/db/schema";

const createSchema = z.object({
  nome: z.string().trim().min(1).max(160),
  palavraChave: z.string().trim().min(1).max(200),
  tipoCorrespondencia: z.enum(["contains", "exact"]).default("contains"),
  escopo: z.enum(["all_posts", "selected_posts"]).default("all_posts"),
  postId: z.string().trim().max(120).optional().nullable(),
  respostaPublica: z.string().trim().max(1000).optional().nullable(),
  mensagemDirect: z.string().trim().max(2000).optional().nullable(),
  link: z.string().url().max(2000).optional().or(z.literal("")).nullable(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Banco não configurado. Configure DATABASE_URL no Vercel." }, { status: 503 });
  const rows = await db.select().from(automacoes).orderBy(desc(automacoes.criadoEm));
  return NextResponse.json({ automacoes: rows });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Banco não configurado. Configure DATABASE_URL no Vercel." }, { status: 503 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confira os campos da automação.", details: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;
  const [created] = await db.insert(automacoes).values({
    nome: data.nome,
    palavraChave: data.palavraChave,
    tipoCorrespondencia: data.tipoCorrespondencia,
    escopo: data.escopo,
    postId: data.postId || null,
    respostaPublica: data.respostaPublica || null,
    mensagemDirect: data.mensagemDirect || null,
    link: data.link || null,
    ativa: false,
  }).returning();
  return NextResponse.json({ automacao: created }, { status: 201 });
}
