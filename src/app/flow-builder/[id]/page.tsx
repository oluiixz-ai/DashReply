import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { automacoes } from "@/lib/db/schema";
import FlowBuilder from "./flow-builder";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) redirect("/login");
  const { id } = await params;
  if (!db || !/^\d+$/.test(id)) notFound();
  const rows = await db.select().from(automacoes).where(eq(automacoes.id, Number(id))).limit(1);
  if (!rows[0]) notFound();
  return <FlowBuilder automationId={rows[0].id} automationName={rows[0].nome} />;
}
