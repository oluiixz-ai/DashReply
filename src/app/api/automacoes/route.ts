import { NextResponse } from "next/server";
import { desc, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { automacoes, eventos } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toClient(row: typeof automacoes.$inferSelect, metrics: { replies: number; dms: number } = { replies: 0, dms: 0 }) {
  return {
    id: row.id,
    name: row.nome,
    keyword: row.palavraChave,
    scope: row.escopo === "specific_post" ? "Publicação selecionada" : row.escopo === "selected_posts" ? "Publicações selecionadas" : "Todas as publicações",
    mediaIds: (() => { if (!row.postId) return []; try { const parsed = JSON.parse(row.postId); return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [String(parsed)]; } catch { return [row.postId]; } })(),
    status: row.ativa ? "Ativa" as const : "Pausada" as const,
    replies: metrics.replies,
    dms: metrics.dms,
  };
}

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  try {
    const rows = await db.select().from(automacoes).orderBy(desc(automacoes.criadoEm));
    const ids = rows.map((row) => row.id);
    const eventRows = ids.length
      ? await db.select({ automacaoId: eventos.automacaoId, detalhe: eventos.detalhe })
          .from(eventos)
          .where(inArray(eventos.automacaoId, ids))
      : [];
    const metrics = new Map<number, { replies: number; dms: number }>();
    for (const event of eventRows) {
      if (!event.automacaoId || !event.detalhe || typeof event.detalhe !== "object") continue;
      const delivery = (event.detalhe as Record<string, unknown>).delivery;
      if (!delivery || typeof delivery !== "object") continue;
      const result = delivery as Record<string, unknown>;
      const current = metrics.get(event.automacaoId) ?? { replies: 0, dms: 0 };
      if (result.publicReplySent === true) current.replies += 1;
      if (result.privateReplySent === true) current.dms += 1;
      metrics.set(event.automacaoId, current);
    }
    return NextResponse.json({
      automations: rows.map((row) => toClient(row, metrics.get(row.id) ?? { replies: 0, dms: 0 })),
    });
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
  const respostaPublica = typeof input.respostaPublica === "string" ? input.respostaPublica.trim() : "";
  const mensagemDirect = typeof input.mensagemDirect === "string" ? input.mensagemDirect.trim() : "";
  const rawLinkButton = input.linkButton && typeof input.linkButton === "object" ? input.linkButton as Record<string, unknown> : null;
  const linkButton = rawLinkButton ? {
    selectionButtonText: typeof rawLinkButton.selectionButtonText === "string" ? rawLinkButton.selectionButtonText.trim() : "",
    followupMessage: typeof rawLinkButton.followupMessage === "string" ? rawLinkButton.followupMessage.trim() : "",
    linkButtonText: typeof rawLinkButton.linkButtonText === "string" ? rawLinkButton.linkButtonText.trim() : "",
    linkButtonUrl: typeof rawLinkButton.linkButtonUrl === "string" ? rawLinkButton.linkButtonUrl.trim() : "",
  } : null;
  if (linkButton) {
    if (!mensagemDirect) return NextResponse.json({ error: "Preencha a mensagem inicial da DM para mostrar o botão de seleção." }, { status: 400 });
    let parsedUrl: URL | null = null;
    try { parsedUrl = new URL(linkButton.linkButtonUrl); } catch { /* validated below */ }
    if (!linkButton.selectionButtonText || linkButton.selectionButtonText.length > 20 || !linkButton.followupMessage || linkButton.followupMessage.length > 1000 || !linkButton.linkButtonText || linkButton.linkButtonText.length > 20 || !parsedUrl || parsedUrl.protocol !== "https:") {
      return NextResponse.json({ error: "Configure os dois textos de botão, a mensagem de acompanhamento e uma URL HTTPS válida. Os textos dos botões devem ter até 20 caracteres." }, { status: 400 });
    }
  }
  if (respostaPublica.length > 1000 || mensagemDirect.length > 2000) {
    return NextResponse.json({ error: "A resposta pública deve ter até 1.000 caracteres e a DM até 2.000." }, { status: 400 });
  }
  if (!nome || nome.length > 160 || !palavraChave || palavraChave.length > 200) {
    return NextResponse.json({ error: "Informe nome e palavra-chave válidos." }, { status: 400 });
  }
  try {
    const [row] = await db.insert(automacoes).values({
      nome,
      palavraChave,
      tipoCorrespondencia: "contains",
      escopo: "all_posts",
      respostaPublica: respostaPublica || null,
      mensagemDirect: mensagemDirect || null,
      ativa: false,
    }).returning();
    if (row && linkButton) {
      await db.insert(configuracoes).values({ chave: "automation_link_button_" + row.id, valor: JSON.stringify(linkButton), atualizadoEm: new Date() }).onConflictDoUpdate({
        target: configuracoes.chave,
        set: { valor: JSON.stringify(linkButton), atualizadoEm: new Date() },
      });
    }
    return NextResponse.json({ automation: toClient(row) }, { status: 201 });
  } catch (error) {
    console.error("Falha ao criar automação", error);
    return NextResponse.json({ error: "Não foi possível salvar a automação." }, { status: 500 });
  }
}
