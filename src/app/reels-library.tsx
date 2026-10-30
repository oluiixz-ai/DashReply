"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Instagram, Plus, RefreshCw, Trash2, Users, Video, ShieldCheck, Search, PlayCircle, AlertCircle, Zap } from "lucide-react";

type SourceProfile = { username: string; url: string; addedAt: string; status: "pending"; };
type ReelMedia = { id: string; caption: string; mediaType: string; mediaUrl: string | null; thumbnailUrl: string | null; permalink: string | null; timestamp: string | null; provider?: string; views?: number | null };
type DiscoveryResult = { profile: { username: string; name?: string; biography?: string; profilePictureUrl?: string; followersCount?: number; mediaCount?: number }; media: ReelMedia[]; note?: string };

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
  return { username: username.toLowerCase(), url: `https://www.instagram.com/${username}/` };
}

export default function ReelsLibrary() {
  const [profiles, setProfiles] = useState<SourceProfile[]>([]);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [discoveryConnected, setDiscoveryConnected] = useState(false);
  const [providers, setProviders] = useState<{instaloader:boolean;inscrape:boolean}>({instaloader:false,inscrape:false});
  const [mediaByProfile, setMediaByProfile] = useState<Record<string, ReelMedia[]>>({});
  const [profileInfo, setProfileInfo] = useState<Record<string, DiscoveryResult["profile"]>>({});
  const [providerByProfile, setProviderByProfile] = useState<Record<string, string>>({});
  const [loadingProfile, setLoadingProfile] = useState("");
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true); setError("");
    try {
      const [response, discoveryResponse] = await Promise.all([
        fetch("/api/reels/library", { cache: "no-store" }),
        fetch("/api/reels/discovery", { cache: "no-store" }),
      ]);
      const data = await response.json();
      const discovery = await discoveryResponse.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar a biblioteca.");
      setProfiles(data.profiles || []);
      setDiscoveryConnected(Boolean(discovery.connected));
      setProviders(discovery.providers || {instaloader:false,inscrape:false});
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
      setProfiles(data.profiles || []); setValue(""); setNotice(`@${profile.username} foi adicionado à sua biblioteca.`);
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
      setMediaByProfile(current => { const next = { ...current }; delete next[username]; return next; });
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao remover."); }
  }

  async function discoverReels(username: string) {
    setLoadingProfile(username);
    setProfileErrors(current => ({ ...current, [username]: "" }));
    try {
      const response = await fetch(`/api/reels/discovery?username=${encodeURIComponent(username)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "Não foi possível consultar este perfil.");
      setMediaByProfile(current => ({ ...current, [username]: data.media || [] }));
      setProfileInfo(current => ({ ...current, [username]: data.profile }));
      setProviderByProfile(current => ({ ...current, [username]: data.provider || "Provedor" }));
    } catch (e) {
      setProfileErrors(current => ({ ...current, [username]: e instanceof Error ? e.message : "Falha ao consultar perfil." }));
    } finally { setLoadingProfile(""); }
  }

  const formatCount = (count?: number) => typeof count === "number" ? new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(count) : "—";

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#17152e] via-[#242052] to-[#4c1d95] p-6 text-white md:p-8">
        <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-violet-400/10 blur-2xl"/>
        <div className="relative max-w-3xl">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10"><Video size={22}/></div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-200">Inspiração e curadoria</p>
          <h2 className="mt-2 text-2xl font-bold md:text-3xl">Biblioteca de Reels</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-violet-100/80">Adicione um perfil público pelo link ou @usuário. O DashReply tenta consultar com Instaloader e usa o InScrape automaticamente como alternativa, sem conectar a conta de origem.</p>
        </div>
      </div>
      <div className="space-y-4 p-5 md:p-6">
        <div className="flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-violet-100 p-2 text-violet-700"><Zap size={18}/></div>
            <div><p className="text-sm font-semibold text-slate-900">Provedores de extração</p><p className="mt-1 text-xs leading-5 text-slate-600">Instaloader: {providers.instaloader ? "configurado" : "aguardando serviço"} · InScrape: {providers.inscrape ? "configurado" : "aguardando chave API"}</p></div>
          </div>
          <span className={discoveryConnected ? "rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700" : "rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800"}>{discoveryConnected ? "Busca habilitada" : "Configuração pendente"}</span>
        </div>
        <form onSubmit={addProfile} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1"><Instagram size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={value} onChange={e=>setValue(e.target.value)} placeholder="Cole o link do Instagram ou digite @usuario" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"/></div>
          <button disabled={saving||!value.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={17}/>{saving?"Adicionando…":"Adicionar perfil"}</button>
        </form>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-semibold text-slate-900">Perfis acompanhados</h3><p className="mt-1 text-xs text-slate-500">Consulte os Reels recentes dos perfis públicos adicionados.</p></div><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loading?"animate-spin":""}/>Atualizar lista</button></div>
      {loading ? <div className="py-14 text-center text-sm text-slate-500">Carregando perfis…</div> : profiles.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 px-5 py-12 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><Users size={22}/></div><h4 className="text-sm font-semibold text-slate-800">Sua biblioteca está vazia</h4><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">Adicione perfis públicos para organizar suas referências e consultar os Reels.</p></div> : <div className="divide-y divide-slate-100">{profiles.map(profile=>{
        const reels = mediaByProfile[profile.username];
        const info = profileInfo[profile.username];
        return <div key={profile.username} className="py-4 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-100 to-violet-100 text-violet-700"><Instagram size={20}/></div>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-900">@{profile.username}{info?.name ? ` · ${info.name}` : ""}</div><div className="mt-1 text-[11px] text-slate-500">{info ? `${formatCount(info.followersCount)} seguidores · ${formatCount(info.mediaCount)} publicações` : "Perfil salvo na biblioteca"}</div></div>
            <button onClick={()=>void discoverReels(profile.username)} disabled={!discoveryConnected||loadingProfile===profile.username} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-45">{loadingProfile===profile.username?<RefreshCw size={13} className="animate-spin"/>:<Search size={13}/>}Buscar Reels</button>
            <a href={profile.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:border-violet-200 hover:text-violet-700">Instagram <ExternalLink size={13}/></a>
            <button onClick={()=>void removeProfile(profile.username)} title="Remover perfil" aria-label={`Remover @${profile.username}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16}/></button>
          </div>
          {profileErrors[profile.username] && <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><AlertCircle size={15} className="mt-0.5 shrink-0"/>{profileErrors[profile.username]}</p>}
          {reels && <div className="mt-4 rounded-xl bg-slate-50 p-3 sm:p-4"><div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-700">Reels encontrados · {providerByProfile[profile.username]}</p><span className="text-[11px] text-slate-500">{reels.length} itens</span></div>{reels.length===0?<p className="py-5 text-center text-xs text-slate-500">Nenhum Reel foi retornado nesta consulta.</p>:<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{reels.map(item=><article key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="relative aspect-[4/3] bg-slate-100">{(item.thumbnailUrl||item.mediaUrl)&&<img src={item.thumbnailUrl||item.mediaUrl||""} alt="" loading="lazy" className="h-full w-full object-cover"/>}<span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[10px] text-white">Reel</span><PlayCircle size={27} className="absolute bottom-2 right-2 text-white drop-shadow"/></div><div className="p-3"><p className="line-clamp-3 min-h-10 text-xs leading-5 text-slate-700">{item.caption||"Publicação sem legenda"}</p><div className="mt-3 flex items-center justify-between gap-2"><span className="text-[10px] text-slate-400">{item.timestamp?new Date(item.timestamp).toLocaleDateString("pt-BR"):""}</span>{item.permalink&&<a href={item.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 hover:text-violet-900">Ver no Instagram <ExternalLink size={11}/></a>}</div>{item.mediaUrl&&<a href={item.mediaUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 hover:text-violet-700">Abrir vídeo <ExternalLink size={11}/></a>}</div></article>)}</div>}<p className="mt-3 text-[10px] leading-4 text-slate-500">Use ou importe conteúdos somente quando tiver autorização do titular e os direitos necessários sobre vídeo, imagem e áudio.</p></div>}
        </div>;
      })}</div>}
    </section>

    <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 md:p-5">
      <div className="flex items-start gap-3"><ShieldCheck size={19} className="mt-0.5 shrink-0 text-amber-700"/><div><h3 className="text-sm font-semibold text-amber-950">Disponibilidade dos provedores</h3><p className="mt-1 text-xs leading-5 text-amber-900/80">Perfis privados não são acessados. O Instagram pode limitar consultas e alterar a disponibilidade de dados. A biblioteca é para pesquisa e curadoria; ter acesso a um Reel público não concede direito de baixá-lo, editá-lo ou republicá-lo.</p></div></div>
    </section>
  </div>;
}
