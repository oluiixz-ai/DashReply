"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Instagram, Plus, RefreshCw, Trash2, Users, Video, ShieldCheck, Search } from "lucide-react";

type SourceProfile = { username: string; url: string; addedAt: string; status: "pending"; };

function normalizeProfile(value: string) {
  const raw = value.trim();
  if (!raw) throw new Error("Informe um @usuário ou link do Instagram.");
  const candidate = raw.startsWith("@") ? raw.slice(1) : raw;
  let username = candidate;
  if (/^https?:\/\//i.test(candidate)) {
    const url = new URL(candidate);
    if (!/(^|\.)instagram\.com$/i.test(url.hostname)) throw new Error("Use um endereço do Instagram.");
    username = url.pathname.split("/").filter(Boolean)[0] || "";
  }
  username = username.replace(/^@/, "").replace(/\/$/, "");
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) throw new Error("Nome de usuário inválido.");
  return { username, url: `https://www.instagram.com/${username}/` };
}

export default function ReelsLibrary() {
  const [profiles, setProfiles] = useState<SourceProfile[]>([]);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/reels/library", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar a biblioteca.");
      setProfiles(data.profiles || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function addProfile(e: React.FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    let profile: ReturnType<typeof normalizeProfile>;
    try { profile = normalizeProfile(value); } catch (e) { setError(e instanceof Error ? e.message : "Perfil inválido."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/reels/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível adicionar o perfil.");
      setProfiles(data.profiles || []); setValue(""); setNotice(`@ ${profile.username} foi adicionado à sua biblioteca.`.replace("@ ", "@"));
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar."); }
    finally { setSaving(false); }
  }

  async function removeProfile(username: string) {
    if (!window.confirm(`Remover @${username} da biblioteca?`)) return;
    setError(""); setNotice("");
    try {
      const response = await fetch("/api/reels/library", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível remover.");
      setProfiles(data.profiles || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao remover."); }
  }

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#17152e] via-[#242052] to-[#4c1d95] p-6 text-white md:p-8">
        <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-violet-400/10 blur-2xl"/>
        <div className="relative max-w-3xl">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10"><Video size={22}/></div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-200">Inspiração e curadoria</p>
          <h2 className="mt-2 text-2xl font-bold md:text-3xl">Biblioteca de Reels</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-violet-100/80">Organize perfis públicos que você acompanha e reúna referências para seus próximos conteúdos. A importação de vídeos será liberada somente quando houver acesso legítimo ao arquivo e autorização de uso.</p>
        </div>
      </div>
      <div className="p-5 md:p-6">
        <form onSubmit={addProfile} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1"><Instagram size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={value} onChange={e=>setValue(e.target.value)} placeholder="Cole o link do Instagram ou digite @usuario" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"/></div>
          <button disabled={saving||!value.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={17}/>{saving?"Adicionando…":"Adicionar perfil"}</button>
        </form>
        {error && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-semibold text-slate-900">Perfis acompanhados</h3><p className="mt-1 text-xs text-slate-500">Sua lista de fontes e referências públicas.</p></div><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading?"animate-spin":""}/>Atualizar lista</button></div>
      {loading ? <div className="py-14 text-center text-sm text-slate-500">Carregando perfis…</div> : profiles.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 px-5 py-12 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><Users size={22}/></div><h4 className="text-sm font-semibold text-slate-800">Sua biblioteca está vazia</h4><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">Adicione perfis públicos para organizar suas referências. Você poderá abrir cada perfil diretamente no Instagram.</p></div> : <div className="divide-y divide-slate-100">{profiles.map(profile=><div key={profile.username} className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-100 to-violet-100 text-violet-700"><Instagram size={20}/></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-900">@{profile.username}</div><div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-amber-400"/>Perfil salvo · consulta de Reels ainda não conectada</div></div><a href={profile.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:border-violet-200 hover:text-violet-700">Abrir perfil <ExternalLink size={13}/></a><button onClick={()=>void removeProfile(profile.username)} title="Remover perfil" aria-label={`Remover @${profile.username}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16}/></button></div>)}</div>}
    </section>

    <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 md:p-5">
      <div className="flex items-start gap-3"><ShieldCheck size={19} className="mt-0.5 shrink-0 text-amber-700"/><div><h3 className="text-sm font-semibold text-amber-950">Sobre a consulta e importação</h3><p className="mt-1 text-xs leading-5 text-amber-900/80">Esta primeira versão salva e organiza os perfis, mas ainda não coleta automaticamente os Reels. A API oficial da Meta não oferece acesso irrestrito a vídeos de qualquer perfil público. Não usamos scraping nem serviços de download não verificados. A próxima etapa conectará uma fonte de dados compatível e permitirá importar apenas conteúdos cujo uso esteja autorizado.</p></div></div>
    </section>
  </div>;
}
