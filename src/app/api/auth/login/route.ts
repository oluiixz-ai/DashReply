import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe e-mail e senha válidos." }, { status: 400 });

  const { email, password } = parsed.data;
  const accounts = [
    { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
    { email: process.env.TESTER_EMAIL, password: process.env.TESTER_PASSWORD },
  ].filter((account): account is { email: string; password: string } =>
    Boolean(account.email && account.password)
  );

  if (accounts.length === 0) {
    return NextResponse.json({ error: "Configure as credenciais nas variáveis de ambiente." }, { status: 503 });
  }

  const account = accounts.find(
    (candidate) =>
      candidate.email.toLowerCase() === email.toLowerCase() &&
      candidate.password === password
  );
  if (!account) return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });

  await createSession(account.email);
  return NextResponse.json({ ok: true });
}
