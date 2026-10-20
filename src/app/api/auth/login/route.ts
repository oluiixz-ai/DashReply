import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe e-mail e senha válidos." }, { status: 400 });
  const { email, password } = parsed.data;
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return NextResponse.json({ error: "Configure ADMIN_EMAIL e ADMIN_PASSWORD nas variáveis de ambiente." }, { status: 503 });
  if (email.toLowerCase() !== process.env.ADMIN_EMAIL.toLowerCase() || password !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  await createSession(email);
  return NextResponse.json({ ok: true });
}
