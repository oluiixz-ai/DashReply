import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { filaEnvios } from "@/lib/db/schema";
import { and, eq, lte } from "drizzle-orm";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
  const jobs = await db.select().from(filaEnvios).where(and(eq(filaEnvios.status, "pending"), lte(filaEnvios.executarEm, new Date()))).limit(20);
  return NextResponse.json({ processed: 0, pending: jobs.length, message: "Fila conectada; handlers de envio serão ativados após configurar a integração Meta." });
}
