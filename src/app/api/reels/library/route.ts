import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { configuracoes } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const KEY = "reels_library_profiles";
function storageKey(email: string) { return `${KEY}:${email.toLowerCase()}`; }
type Profile = { username: string; url: string; addedAt: string; status: "pending" };

async function readProfiles(key: string): Promise<Profile[]> {
  if (!db) throw new Error("Banco de dados não configurado.");
  const [row] = await db.select({ valor: configuracoes.valor }).from(configuracoes).where(eq(configuracoes.chave, key)).limit(1);
  if (!row?.valor) return [];
  try {
    const parsed = JSON.parse(row.valor);
    return Array.isArray(parsed) ? parsed.filter((p): p is Profile => p && typeof p.username === "string" && typeof p.url === "string") : [];
  } catch { return []; }
}
async function writeProfiles(key: string, profiles: Profile[]) {
  if (!db) throw new Error("Banco de dados não configurado.");
  await db.insert(configuracoes).values({ chave: key, valor: JSON.stringify(profiles), atualizadoEm: new Date() }).onConflictDoUpdate({ target: configuracoes.chave, set: { valor: JSON.stringify(profiles), atualizadoEm: new Date() } });
}
function validUsername(value: unknown): value is string { return typeof value === "string" && /^[a-zA-Z0-9._]{1,30}$/.test(value); }

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try { const session = await getSession(); if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const profiles = await readProfiles(storageKey(session.email)); return NextResponse.json({ profiles }); }
  catch (error) { console.error("Reels library read failed", error); return NextResponse.json({ error: "Não foi possível acessar a biblioteca." }, { status: 500 }); }
}
export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    const session = await getSession(); if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const key = storageKey(session.email);
    const body = await request.json();
    if (!validUsername(body?.username)) return NextResponse.json({ error: "Nome de usuário inválido." }, { status: 400 });
    const username = body.username.toLowerCase();
    const profiles = await readProfiles(key);
    if (profiles.some(p => p.username.toLowerCase() === username)) return NextResponse.json({ error: "Este perfil já está na sua biblioteca." }, { status: 409 });
    if (profiles.length >= 100) return NextResponse.json({ error: "Limite de 100 perfis por biblioteca atingido." }, { status: 400 });
    const profile: Profile = { username, url: `https://www.instagram.com/${username}/`, addedAt: new Date().toISOString(), status: "pending" };
    const next = [profile, ...profiles];
    await writeProfiles(key, next);
    return NextResponse.json({ profiles: next, profile }, { status: 201 });
  } catch (error) { console.error("Reels library create failed", error); return NextResponse.json({ error: "Não foi possível salvar o perfil." }, { status: 500 }); }
}
export async function DELETE(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    const session = await getSession(); if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const key = storageKey(session.email);
    const body = await request.json();
    if (!validUsername(body?.username)) return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });
    const profiles = (await readProfiles(key)).filter(p => p.username.toLowerCase() !== body.username.toLowerCase());
    await writeProfiles(key, profiles);
    return NextResponse.json({ profiles });
  } catch (error) { console.error("Reels library delete failed", error); return NextResponse.json({ error: "Não foi possível remover o perfil." }, { status: 500 }); }
}
