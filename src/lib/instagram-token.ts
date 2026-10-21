import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { configuracoes } from "@/lib/db/schema";

export async function getInstagramAccessToken() {
  if (db) {
    try {
      const [stored] = await db.select({ valor: configuracoes.valor }).from(configuracoes).where(eq(configuracoes.chave, "instagram_access_token")).limit(1);
      if (stored?.valor) return stored.valor;
    } catch {
      // OAuth token may not have been stored yet; fall back to configured environment variables.
    }
  }
  return process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || null;
}

export async function getInstagramAccountId() {
  if (db) {
    try {
      const [stored] = await db.select({ valor: configuracoes.valor }).from(configuracoes).where(eq(configuracoes.chave, "instagram_account_id")).limit(1);
      if (stored?.valor) return stored.valor;
    } catch {
      // Fall back to the configured account ID.
    }
  }
  return process.env.INSTAGRAM_ACCOUNT_ID || null;
}
