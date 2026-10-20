"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Zap } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível entrar.");
      router.replace("/"); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Erro inesperado."); }
    finally { setLoading(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-10 text-zinc-100"><div className="w-full max-w-[400px]"><div className="mb-8 flex items-center justify-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500 shadow-lg shadow-violet-950/50"><Zap size={22} fill="currentColor"/></div><div><div className="text-xl font-semibold tracking-tight">DashReply</div><div className="text-[11px] tracking-wider text-zinc-500">INSTAGRAM WORKSPACE</div></div></div><div className="rounded-2xl border border-zinc-800 bg-[#111114] p-7 shadow-2xl shadow-black/20"><div className="mb-6"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-violet-300"><LockKeyhole size={18}/></div><h1 className="text-xl font-semibold">Bem-vindo de volta</h1><p className="mt-1.5 text-sm text-zinc-400">Entre na sua área administrativa.</p></div><form onSubmit={submit} className="space-y-4"><label className="block"><span className="mb-2 block text-xs font-medium text-zinc-300">E-mail</span><input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-3 text-sm outline-none transition focus:border-violet-500"/></label><label className="block"><span className="mb-2 block text-xs font-medium text-zinc-300">Senha</span><div className="relative"><input type={visible?"text":"password"} required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha de administrador" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-3 pr-11 text-sm outline-none transition focus:border-violet-500"/><button type="button" aria-label={visible?"Ocultar senha":"Mostrar senha"} onClick={()=>setVisible(!visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200">{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>{error&&<div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs leading-5 text-red-300">{error}</div>}<button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-60">{loading?"Entrando...":"Entrar no painel"}{!loading&&<ArrowRight size={16}/>}</button></form></div><p className="mt-5 text-center text-[11px] leading-5 text-zinc-600">Acesso restrito ao administrador. Configure ADMIN_EMAIL, ADMIN_PASSWORD e SESSION_SECRET no ambiente de hospedagem.</p></div></main>;
}
