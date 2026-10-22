"use client";

import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "./theme-toggle";
import { Activity, ArrowDownRight, ArrowUpRight, Bell, Bot, Check, ChevronDown, CircleHelp, Command, ExternalLink, Image as ImageIcon, Instagram, LayoutDashboard, LifeBuoy, MessageCircle, MoreHorizontal, Plus, Power, Search, Send, Settings2, ShieldCheck, Sparkles, Trash2, Users, Workflow, X, Zap } from "lucide-react";

type Automation = { id: number; name: string; keyword: string; scope: string; status: "Ativa" | "Pausada"; replies: number; dms: number; mediaIds?: string[] };
type InstagramMedia = { id: string; caption?: string; media_type?: string; media_url?: string; thumbnail_url?: string; permalink?: string; timestamp?: string };
const nav = [
  { label: "Visão geral", href: "/", icon: LayoutDashboard }, { label: "Automações", href: "/automacoes", icon: Workflow }, { label: "Contatos", href: "/contatos", icon: Users }, { label: "Caixa de saída", href: "/caixa-de-saida", icon: Send }, { label: "Eventos recebidos", href: "/eventos", icon: Activity }, { label: "Atividade", href: "/atividade", icon: Activity },
];

export default function Home({ initialSection = "Visão geral" }: { initialSection?: string }) {
  const [active, setActive] = useState(initialSection);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [mediaAutomation, setMediaAutomation] = useState<Automation | null>(null);
  const [mediaItems, setMediaItems] = useState<InstagramMedia[]>([]);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaSaving, setMediaSaving] = useState(false);
  const [mediaPage, setMediaPage] = useState(0);
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [publicReply, setPublicReply] = useState("");
  const [directMessage, setDirectMessage] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [metaStatus, setMetaStatus] = useState<{appSecret:boolean;verifyToken:boolean;accessToken:boolean;instagramAccountId:boolean;webhookUrl:string}|null>(null);
  const [instagramUsername, setInstagramUsername] = useState<string | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState<"check" | "subscribe" | null>(null);
  const [subscriptionResult, setSubscriptionResult] = useState<Record<string, unknown> | null>(null);
  const [subscriptionMessage, setSubscriptionMessage] = useState("");
  const [events, setEvents] = useState<Array<{id:number;type:string;commentId:string|null;username:string;text:string;mediaId:string;status:string;error:string|null;createdAt:string}>>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [diagnosticResult, setDiagnosticResult] = useState<Record<string, any> | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  async function runDiagnostic() {
    setDiagnosticLoading(true); setDiagnosticResult(null);
    try {
      const response = await fetch("/api/meta/status", { cache: "no-store" });
      const data = await response.json();
      setDiagnosticResult(data);
    } catch {
      setDiagnosticResult({ error: "Não foi possível consultar o diagnóstico." });
    } finally { setDiagnosticLoading(false); }
  }
  async function manageSubscriptions(action: "check" | "subscribe") {
    setSubscriptionLoading(action); setSubscriptionMessage(""); setSubscriptionResult(null);
    try {
      const response = await fetch("/api/meta/subscriptions", { method: action === "subscribe" ? "POST" : "GET", cache: "no-store" });
      const data = await response.json(); setSubscriptionResult(data);
      if (!response.ok) setSubscriptionMessage(data.error || `Falha na solicitação (HTTP ${response.status}).`);
      else setSubscriptionMessage(action === "check" ? "Consulta concluída. Confira o resultado abaixo." : "Solicitação enviada à API da Meta. Confira o resultado abaixo.");
    } catch { setSubscriptionMessage("Não foi possível consultar a API. Tente novamente."); }
    finally { setSubscriptionLoading(null); }
  }
  useEffect(() => {
    let cancelled = false;
    fetch("/api/meta/status", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => {
      const identity = d?.tokenIdentity;
      if (!cancelled && identity?.ok && identity?.matchesConfiguredAccount && typeof identity.username === "string") setInstagramUsername(identity.username);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connection = params.get("instagram_connection");
    const message = params.get("message");
    if (connection && message) {
      setNotice(message);
      window.history.replaceState({}, "", window.location.pathname);
      if (connection === "success") setActive("Configurações");
    }
  }, []);
  useEffect(() => {
    if (active !== "Configurações") return;
    let cancelled = false;
    fetch("/api/meta/status", { cache: "no-store" }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Falha ao consultar integração"); return d; }).then(d => { if (!cancelled) setMetaStatus(d); }).catch(() => { if (!cancelled) setMetaStatus(null); });
    return () => { cancelled = true; };
  }, [active]);
  useEffect(() => {
    let cancelled = false;
    async function loadAutomations() {
      try {
        const response = await fetch("/api/automacoes", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar as automações.");
        if (!cancelled) setAutomations(data.automations ?? []);
      } catch (error) {
        if (!cancelled) setNotice(error instanceof Error ? error.message : "Erro ao carregar automações.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAutomations();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!["Eventos recebidos", "Contatos", "Caixa de saída", "Atividade"].includes(active)) return;
    let cancelled = false;
    async function loadEvents() {
      setEventsLoading(true); setEventsError("");
      try {
        const response = await fetch("/api/eventos", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar os eventos.");
        if (!cancelled) setEvents(data.events ?? []);
      } catch (error) {
        if (!cancelled) setEventsError(error instanceof Error ? error.message : "Falha ao carregar eventos.");
      } finally { if (!cancelled) setEventsLoading(false); }
    }
    loadEvents();
    return () => { cancelled = true; };
  }, [active]);

  const filtered = useMemo(() => automations.filter(a => `${a.name} ${a.keyword}`.toLowerCase().includes(search.toLowerCase())), [automations, search]);

  async function createAutomation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !keyword.trim() || saving) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/automacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: name.trim(), palavraChave: keyword.trim(), respostaPublica: publicReply.trim() || null, mensagemDirect: directMessage.trim() || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar a automação.");
      setAutomations(prev => [data.automation, ...prev]);
      setName(""); setKeyword(""); setPublicReply(""); setDirectMessage(""); setShowModal(false); setActive("Automações");
      setNotice("Automação salva no banco de dados como rascunho. Configure a integração oficial da Meta antes de ativar envios reais.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Erro ao salvar automação.");
    } finally {
      setSaving(false);
    }
  }

  async function openMediaSelector(automation: Automation) {
    setMediaAutomation(automation);
    setMediaPage(0);
    setSelectedMediaIds(automation.mediaIds ?? []);
    setMediaItems([]);
    setMediaLoading(true);
    setShowModal(false);
    setNotice("");
    try {
      const response = await fetch("/api/instagram/media", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar as publicações do Instagram.");
      setMediaItems(data.media ?? []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao carregar as mídias do Instagram.");
    } finally {
      setMediaLoading(false);
    }
  }

  async function saveMediaSelection() {
    if (!mediaAutomation || selectedMediaIds.length === 0 || mediaSaving) return;
    setMediaSaving(true);
    setNotice("");
    try {
      const response = await fetch(`/api/automacoes/${mediaAutomation.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escopo: "selected_posts", postIds: selectedMediaIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar a seleção.");
      setAutomations(items => items.map(item => item.id === mediaAutomation.id ? { ...item, scope: "Publicações selecionadas", mediaIds: selectedMediaIds } : item));
      setMediaAutomation(null);
      setNotice(`Seleção salva: ${selectedMediaIds.length} mídia(s). A automação só corresponderá a comentários nessas publicações.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao salvar as mídias selecionadas.");
    } finally {
      setMediaSaving(false);
    }
  }

  async function toggleAutomation(automation: Automation) {
    if (automation.scope === "Publicações selecionadas" && !(automation.mediaIds?.length)) {
      setNotice("Selecione pelo menos uma publicação antes de ativar esta automação.");
      return;
    }
    const ativa = automation.status !== "Ativa";
    const previous = automations;
    setAutomations(items => items.map(item => item.id === automation.id ? { ...item, status: ativa ? "Ativa" : "Pausada" } : item));
    try {
      const response = await fetch(`/api/automacoes/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativa }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar a automação.");
      setNotice(ativa ? "Automação ativada no banco. Os envios reais dependem da integração Meta." : "Automação pausada e alteração salva.");
    } catch (error) {
      setAutomations(previous);
      setNotice(error instanceof Error ? error.message : "Erro ao atualizar automação.");
    }
  }

  async function deleteAutomation(automation: Automation) {
    if (!window.confirm(`Excluir a automação "${automation.name}"? Essa ação não pode ser desfeita.`)) return;
    try {
      const response = await fetch(`/api/automacoes/${automation.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível excluir a automação.");
      setAutomations(items => items.filter(item => item.id !== automation.id));
      setNotice(`Automação "${automation.name}" excluída.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Erro ao excluir automação.");
    }
  }

  return <main className="min-h-screen md:flex">
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-zinc-800/80 bg-[#0d0d10] p-5 md:flex">
      <div className="mb-9 px-1"><img src="/logo.svg" alt="DashReply — Instagram Workspace" className="h-auto w-full max-w-[205px] object-contain" /><div className="mt-1 pl-1 text-[10px] tracking-[.14em] text-zinc-500">INSTAGRAM WORKSPACE</div></div>
      <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[.18em] text-zinc-600">Workspace</div>
      <nav className="space-y-1">{nav.map(item => { const Icon = item.icon; return <a key={item.label} href={item.href} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${active === item.label ? "bg-violet-500/15 text-violet-200" : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100"}`}><Icon size={17}/>{item.label}</a> })}</nav>
      <div className="mb-3 mt-9 px-2 text-[10px] font-semibold uppercase tracking-[.18em] text-zinc-600">Preferências</div>
      <a href="/configuracoes" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] ${active === "Configurações" ? "bg-violet-500/15 text-violet-200" : "text-zinc-400 hover:bg-zinc-800/70"}`}><Settings2 size={17}/>Configurações</a>
      <div className="mt-auto rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"><div className="mb-2 flex items-center gap-2 text-xs font-medium"><Sparkles size={15} className="text-violet-300"/> Seu espaço de trabalho</div><p className="mb-3 text-xs leading-5 text-zinc-500">Configure a API oficial da Meta para colocar suas automações em funcionamento.</p><button onClick={() => setActive("Configurações")} className="text-xs font-medium text-violet-300 hover:text-violet-200">Configurar integração <span aria-hidden="true">→</span></button></div>
      <div className="mt-5 flex items-center gap-3 border-t border-zinc-800 pt-4"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold">AD</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">Administrador</div><div className="text-[11px] text-zinc-500">Plano inicial</div></div><MoreHorizontal size={18} className="text-zinc-500"/></div>
    </aside>
    <section className="min-w-0 flex-1">
      <header className="flex h-[68px] items-center justify-between border-b border-zinc-800/80 px-5 md:px-9"><div className="flex items-center gap-2 text-xs text-zinc-500"><span>Workspace</span><span>/</span><span className="text-zinc-200">{active}</span></div><div className="flex items-center gap-3"><button aria-label="Ajuda" className="hidden rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 sm:block"><CircleHelp size={17}/></button><button aria-label="Notificações" className="relative rounded-lg p-2 text-zinc-400 hover:bg-zinc-800"><Bell size={17}/><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-violet-400"/></button><div className="h-7 border-l border-zinc-800"/><ThemeToggle /><a href="/api/meta/connect" title="Conectar ou trocar conta do Instagram" className="flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-1.5 transition hover:bg-violet-500/20"><div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-fuchsia-500 to-orange-400"><Instagram size={14}/></div><span className="text-xs text-zinc-200">{instagramUsername ? `@${instagramUsername}` : "Conectar Instagram"}</span><ChevronDown size={14} className="text-zinc-400"/></a></div></header>
      <div className="mx-auto max-w-[1400px] p-5 md:p-9">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2 text-xs text-zinc-500"><span className={`h-1.5 w-1.5 rounded-full ${loading ? "bg-amber-400" : "bg-emerald-400"}`}/>{loading ? "Sincronizando dados" : "Dados persistidos no Neon"}</div><h1 className="text-2xl font-semibold tracking-tight md:text-[30px]">{active === "Visão geral" ? "Visão geral" : active}</h1><p className="mt-2 text-sm text-zinc-400">Acompanhe suas conversas e transforme comentários em conexões.</p></div><button onClick={() => { setShowModal(true); setNotice(""); }} className="flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-400"><Plus size={17}/> Nova automação</button></div>
        {notice && <div className="mb-5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">{notice}</div>}
        {active === "Eventos recebidos" && <section className="mb-7 rounded-2xl border border-zinc-800 bg-[#111114] p-5 md:p-7">
          <div className="mb-5"><h2 className="text-base font-semibold">Eventos recebidos do Instagram</h2><p className="mt-1 text-sm text-zinc-400">Histórico dos webhooks que chegaram ao DashReply.</p></div>
          {eventsError && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{eventsError}</div>}
          <div className="mb-4 flex justify-end"><button onClick={()=>setActive("Visão geral")} className="hidden">Recarregar</button><button onClick={()=>{setEventsError("");setEventsLoading(true);fetch("/api/eventos",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Falha ao carregar");setEvents(d.events??[])}).catch(e=>setEventsError(e instanceof Error?e.message:"Falha ao carregar")).finally(()=>setEventsLoading(false))}} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800">Atualizar</button></div>
          {eventsLoading ? <p className="py-8 text-center text-sm text-zinc-400">Carregando eventos…</p> : events.length === 0 ? <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center"><Activity className="mx-auto mb-3 text-zinc-500" size={24}/><p className="text-sm font-medium text-zinc-200">Nenhum evento recebido ainda</p><p className="mt-2 text-xs leading-5 text-zinc-500">Comente “Quero” em uma publicação e volte aqui. Se nada aparecer, verificaremos os logs do webhook.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="text-[10px] uppercase tracking-wider text-zinc-500"><tr><th className="px-3 py-3">Data</th><th className="px-3 py-3">Evento</th><th className="px-3 py-3">Usuário</th><th className="px-3 py-3">Conteúdo</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">ID comentário</th></tr></thead><tbody className="divide-y divide-zinc-800">{events.map(ev=><tr key={ev.id} className="align-top"><td className="whitespace-nowrap px-3 py-3 text-xs text-zinc-400">{new Date(ev.createdAt).toLocaleString("pt-BR")}</td><td className="px-3 py-3 text-xs text-zinc-300">{ev.type}</td><td className="px-3 py-3 text-xs text-zinc-300">{ev.username ? "@"+ev.username : "—"}</td><td className="max-w-[260px] px-3 py-3 text-xs text-zinc-300 break-words">{ev.text || "Sem texto no payload"}</td><td className="px-3 py-3"><span className="rounded-md bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300">{ev.status}</span></td><td className="max-w-[160px] break-all px-3 py-3 text-[10px] text-zinc-500">{ev.commentId || "—"}</td></tr>)}</tbody></table></div>}
          <p className="mt-4 text-[11px] text-zinc-500">Mostrando até 100 eventos recentes. O sistema está em modo de teste e não envia respostas automáticas.</p>
        </section>}
        {active === "Configurações" && <section className="mb-7 rounded-2xl border border-zinc-800 bg-[#111114] p-5 md:p-7"><h2 className="mb-2 text-base font-semibold">Integração oficial do Instagram</h2><p className="mb-4 text-sm leading-6 text-zinc-400">Conecte sua conta profissional pelo fluxo oficial da Meta. O token recebido é guardado no banco e nunca exibido na tela.</p><a href="/api/meta/connect" className="mb-5 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-400"><Instagram size={16}/> Conectar conta do Instagram <ExternalLink size={14}/></a><div className="mb-5"><button onClick={runDiagnostic} disabled={diagnosticLoading} className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-60">{diagnosticLoading ? "Executando diagnóstico…" : "Executar diagnóstico da conexão"}</button></div>{diagnosticResult && <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><h3 className="mb-2 text-sm font-semibold">Resultado do diagnóstico</h3><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-zinc-300">{JSON.stringify(diagnosticResult, null, 2)}</pre></div>}<div className="mb-5 grid gap-3 sm:grid-cols-2">{[{label:"META_APP_SECRET",ok:metaStatus?.appSecret},{label:"META_VERIFY_TOKEN",ok:metaStatus?.verifyToken},{label:"META_ACCESS_TOKEN",ok:metaStatus?.accessToken},{label:"INSTAGRAM_ACCOUNT_ID",ok:metaStatus?.instagramAccountId}].map(item=><div key={item.label} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3"><code className="text-xs text-zinc-300">{item.label}</code><span className={item.ok ? "text-xs text-emerald-300" : "text-xs text-amber-300"}>{metaStatus ? (item.ok ? "Configurado" : "Pendente") : "Verificando…"}</span></div>)}</div><div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><div className="mb-1 text-xs text-zinc-500">URL do webhook</div><code className="break-all text-xs text-violet-200">{metaStatus?.webhookUrl ?? "https://dash-reply-2der.vercel.app/api/webhook/instagram"}</code></div><div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-200/90">A recepção e o envio reais ainda dependem de configurar e validar as permissões da API Graph da Meta.</div><div className="flex flex-wrap gap-3"><button onClick={()=>window.open("https://developers.facebook.com/apps/","_blank","noopener,noreferrer")} className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm text-white">Abrir Meta for Developers ↗</button><button onClick={()=>window.open("https://vercel.com/oluiixz-3231/dash-reply-2der/settings/environment-variables","_blank","noopener,noreferrer")} className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300">Variáveis da Vercel ↗</button></div><div className="mt-6 border-t border-zinc-800 pt-5"><h3 className="mb-2 text-sm font-semibold">Inscrição dos webhooks</h3><p className="mb-4 text-xs leading-5 text-zinc-400">Confira se a conta do Instagram está inscrita para enviar eventos ao DashReply. Isso não envia respostas nem mensagens.</p><div className="flex flex-wrap gap-3"><button disabled={subscriptionLoading!==null} onClick={()=>manageSubscriptions("check")} className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 disabled:opacity-50">{subscriptionLoading==="check"?"Consultando...":"Verificar inscrição"}</button><button disabled={subscriptionLoading!==null} onClick={()=>manageSubscriptions("subscribe")} className="rounded-xl bg-fuchsia-600 px-4 py-2.5 text-sm text-white disabled:opacity-50">{subscriptionLoading==="subscribe"?"Ativando...":"Ativar webhooks"}</button></div>{subscriptionMessage && <p role="status" className="mt-4 rounded-xl border border-zinc-700 p-3 text-sm text-zinc-200">{subscriptionMessage}</p>}{subscriptionResult && <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/40 p-4 text-xs text-zinc-300">{JSON.stringify(subscriptionResult,null,2)}</pre>}</div></section>}
        {active === "Visão geral" && <section><div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[{label:"Automações criadas",value:String(automations.length).padStart(2,"0"),change:`${automations.filter(a=>a.status === "Ativa").length} ativas`,icon:Workflow,up:true},{label:"Respostas públicas",value:"—",change:"aguardando integração Meta",icon:MessageCircle,up:true},{label:"Mensagens enviadas",value:"—",change:"aguardando integração Meta",icon:Send,up:true},{label:"Contatos alcançados",value:"0",change:"aguardando eventos reais",icon:Users,up:true}].map((k) => { const Icon = k.icon; return <div key={k.label} className="rounded-2xl border border-zinc-800/90 bg-[#111114] p-5"><div className="mb-5 flex items-center justify-between"><span className="text-xs text-zinc-400">{k.label}</span><div className="rounded-lg bg-zinc-800/70 p-2 text-zinc-400"><Icon size={16}/></div></div><div className="mb-2 text-[28px] font-semibold tracking-tight">{k.value}</div><div className="flex items-center gap-1.5 text-[11px] text-zinc-500"><span className="flex items-center gap-1 text-emerald-400"><ArrowUpRight size={13}/>{k.label === "Automações criadas" ? k.change : ""}</span>{k.label !== "Automações criadas" && k.change}</div></div> })}
        </div>
        <div className="mb-7 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <div className="rounded-2xl border border-zinc-800/90 bg-[#111114] p-5 md:p-6"><div className="mb-1 flex items-center justify-between"><h2 className="text-sm font-semibold">Atividade das automações</h2><button className="flex items-center gap-1 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-[11px] text-zinc-400">Últimos 7 dias <ChevronDown size={13}/></button></div><p className="mb-5 text-xs text-zinc-500">Visão ilustrativa de respostas e mensagens</p><div className="flex h-[155px] items-end gap-3 border-b border-zinc-800 pb-2 sm:gap-5">{[{d:"Seg",a:40,b:20},{d:"Ter",a:65,b:35},{d:"Qua",a:50,b:29},{d:"Qui",a:82,b:42},{d:"Sex",a:60,b:38},{d:"Sáb",a:93,b:55},{d:"Dom",a:72,b:45}].map(v=><div key={v.d} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="flex h-[125px] w-full items-end justify-center gap-1"><div style={{height:`${v.a}%`}} className="w-[35%] rounded-t-sm bg-violet-500/80"/><div style={{height:`${v.b}%`}} className="w-[35%] rounded-t-sm bg-fuchsia-400/50"/></div><span className="text-[10px] text-zinc-500">{v.d}</span></div>)}</div><div className="mt-4 flex gap-5 text-[11px] text-zinc-400"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm bg-violet-500"/>Respostas públicas</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm bg-fuchsia-400/70"/>Mensagens diretas</span></div></div>
          <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/60 via-[#171321] to-[#111114] p-6"><div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-violet-500/10 blur-3xl"/><div className="relative"><div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10 text-violet-200"><Sparkles size={20}/></div><div className="mb-2 text-xs font-medium text-violet-300">DICA RÁPIDA</div><h2 className="mb-2 text-lg font-semibold">Conversa que começa no comentário</h2><p className="mb-5 text-sm leading-6 text-zinc-400">Configure palavras-chave para responder publicamente e continuar a conversa na DM, de forma organizada.</p><button onClick={() => setShowModal(true)} className="flex items-center gap-2 text-sm font-medium text-violet-200 hover:text-white">Criar minha primeira regra <ArrowUpRight size={15}/></button></div></div>
        </div></section>}
        {(active === "Visão geral" || active === "Automações") && <section><div className="overflow-hidden rounded-2xl border border-zinc-800/90 bg-[#111114]"><div className="flex flex-col justify-between gap-3 border-b border-zinc-800 p-5 sm:flex-row sm:items-center"><div><h2 className="text-sm font-semibold">Suas automações</h2><p className="mt-1 text-xs text-zinc-500">Gerencie as regras de resposta do Instagram</p></div><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar automação..." className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-xs outline-none placeholder:text-zinc-600 focus:border-violet-500 sm:w-56"/></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead className="bg-zinc-900/40 text-[10px] uppercase tracking-wider text-zinc-500"><tr><th className="px-5 py-3 font-medium">Nome da automação</th><th className="px-4 py-3 font-medium">Palavra-chave</th><th className="px-4 py-3 font-medium">Escopo</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Resultados</th><th className="px-4 py-3"/></tr></thead><tbody className="divide-y divide-zinc-800/80">{filtered.map(a=><tr key={a.id} className="transition hover:bg-zinc-900/40"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-violet-300"><Bot size={17}/></div><div><div className="text-xs font-medium text-zinc-200">{a.name}</div><div className="mt-1 text-[10px] text-zinc-500">Comentário → DM</div></div></div></td><td className="px-4 py-4"><span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300">{a.keyword}</span></td><td className="px-4 py-4 text-xs text-zinc-400">{a.scope}</td><td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] ${a.status === "Ativa" ? "bg-emerald-500/10 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}><span className={`h-1.5 w-1.5 rounded-full ${a.status === "Ativa" ? "bg-emerald-400" : "bg-zinc-500"}`}/>{a.status}</span></td><td className="px-4 py-4 text-xs text-zinc-400">{a.replies} respostas <span className="text-zinc-600">/</span> {a.dms} DMs</td><td className="px-4 py-4"><div className="flex items-center gap-1"><button aria-label={`Selecionar mídias de ${a.name}`} title="Selecionar mídias" onClick={()=>openMediaSelector(a)} className="rounded-lg p-2 text-violet-300 hover:bg-violet-500/10"><ImageIcon size={16}/></button><button aria-label={a.status === "Ativa" ? `Desligar ${a.name}` : `Ligar ${a.name}`} title={a.status === "Ativa" ? "Desligar automação" : "Ligar automação"} onClick={()=>toggleAutomation(a)} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-medium transition ${a.status === "Ativa" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20" : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`}><Power size={15}/>{a.status === "Ativa" ? "Ligada" : "Desligada"}</button><button aria-label={`Excluir ${a.name}`} title="Excluir automação" onClick={()=>deleteAutomation(a)} className="rounded-lg p-2 text-red-400 hover:bg-red-500/10 hover:text-red-300"><Trash2 size={16}/></button></div></td></tr>)}</tbody></table>{filtered.length===0&&<div className="p-8 text-center text-sm text-zinc-500">{loading ? "Carregando automações..." : "Nenhuma automação salva ainda."}</div>}</div>
          <div className="flex items-center justify-between border-t border-zinc-800 px-5 py-3 text-[11px] text-zinc-500"><span>Exibindo {filtered.length} de {automations.length} automações</span><span className="flex items-center gap-1"><ShieldCheck size={13}/>{loading ? "Carregando do banco..." : "Sincronizado com o banco"}</span></div>
        </div></section>}
        {active === "Contatos" && <section className="mb-7 rounded-2xl border border-zinc-800 bg-[#111114] p-5 md:p-7"><h2 className="text-base font-semibold">Contatos identificados nos eventos</h2><p className="mt-1 mb-5 text-sm text-zinc-400">Lista de usuários encontrados nos últimos 100 webhooks. Não representa todos os seguidores ou todas as conversas.</p>{eventsLoading ? <p className="py-8 text-center text-sm text-zinc-400">Carregando…</p> : [...new Map(events.filter(ev=>ev.username).map(ev=>[ev.username,ev])).values()].length ? <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-[10px] uppercase tracking-wider text-zinc-500"><tr><th className="px-3 py-3">Usuário</th><th className="px-3 py-3">Último evento</th><th className="px-3 py-3">Conteúdo</th><th className="px-3 py-3">Status</th></tr></thead><tbody className="divide-y divide-zinc-800">{[...new Map(events.filter(ev=>ev.username).map(ev=>[ev.username,ev])).values()].map(ev=><tr key={ev.username}><td className="px-3 py-3 text-sm text-zinc-200">@{ev.username}</td><td className="px-3 py-3 text-xs text-zinc-400">{new Date(ev.createdAt).toLocaleString("pt-BR")}</td><td className="px-3 py-3 text-xs text-zinc-300">{ev.text||"—"}</td><td className="px-3 py-3 text-xs text-zinc-400">{ev.status}</td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-400">{eventsError||"Nenhum contato identificado nos eventos recebidos."}</p>}</section>}
        {active === "Caixa de saída" && <section className="mb-7 rounded-2xl border border-zinc-800 bg-[#111114] p-5 md:p-7"><h2 className="text-base font-semibold">Caixa de saída</h2><p className="mt-1 mb-5 text-sm text-zinc-400">Resultados de envio registrados no histórico de eventos. Esta versão ainda não possui fila de mensagens agendadas.</p>{eventsLoading ? <p className="py-8 text-center text-sm text-zinc-400">Carregando…</p> : events.filter(ev=>["sent","partially_sent","send_failed","matched_dry_run"].includes(ev.status)).length ? <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-[10px] uppercase tracking-wider text-zinc-500"><tr><th className="px-3 py-3">Data</th><th className="px-3 py-3">Usuário</th><th className="px-3 py-3">Comentário</th><th className="px-3 py-3">Resultado</th></tr></thead><tbody className="divide-y divide-zinc-800">{events.filter(ev=>["sent","partially_sent","send_failed","matched_dry_run"].includes(ev.status)).map(ev=><tr key={ev.id}><td className="px-3 py-3 text-xs text-zinc-400">{new Date(ev.createdAt).toLocaleString("pt-BR")}</td><td className="px-3 py-3 text-xs text-zinc-300">{ev.username?"@"+ev.username:"—"}</td><td className="px-3 py-3 text-xs text-zinc-300">{ev.text||"—"}</td><td className="px-3 py-3 text-xs text-zinc-300">{ev.status}{ev.error?` — ${ev.error}`:""}</td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-400">{eventsError||"Nenhuma tentativa de envio registrada."}</p>}<button onClick={()=>{setEventsError("");setEventsLoading(true);fetch("/api/eventos",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Falha ao carregar");setEvents(d.events??[])}).catch(e=>setEventsError(e instanceof Error?e.message:"Falha ao carregar")).finally(()=>setEventsLoading(false))}} className="mt-4 rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200">Atualizar</button></section>}
        {active === "Atividade" && <section className="mb-7 rounded-2xl border border-zinc-800 bg-[#111114] p-5 md:p-7"><h2 className="text-base font-semibold">Atividade registrada</h2><p className="mt-1 mb-5 text-sm text-zinc-400">Histórico real de eventos do banco; métricas ilustrativas não são exibidas nesta seção.</p>{eventsLoading ? <p className="py-8 text-center text-sm text-zinc-400">Carregando…</p> : events.length ? <div className="space-y-2">{events.map(ev=><div key={ev.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"><div className="flex flex-wrap justify-between gap-2 text-xs"><span className="text-zinc-200">{ev.type} · {ev.status}</span><span className="text-zinc-500">{new Date(ev.createdAt).toLocaleString("pt-BR")}</span></div><p className="mt-2 text-sm text-zinc-300">{ev.text||"Evento sem texto"}</p><p className="mt-1 text-xs text-zinc-500">{ev.username?"@"+ev.username:"Usuário não identificado"}{ev.error?` · ${ev.error}`:""}</p></div>)}</div> : <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-400">{eventsError||"Nenhuma atividade registrada."}</p>}</section>}
        <footer className="flex flex-col gap-2 py-6 text-[11px] text-zinc-600 sm:flex-row sm:items-center sm:justify-between"><span>DashReply © 2026 · Feito para simplificar suas conversas.</span><span className="flex items-center gap-4"><button className="hover:text-zinc-300">Documentação</button><button className="hover:text-zinc-300">Suporte</button><button className="hover:text-zinc-300"><ExternalLink size={12} className="inline"/> Status da API</button></span></footer>
      </div>
    </section>
    {mediaAutomation && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"><div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-zinc-700 bg-[#121215] p-5 shadow-2xl md:p-6"><div className="mb-4 flex items-start justify-between gap-4"><div><div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><ImageIcon size={18}/></div><h2 className="text-lg font-semibold">Selecionar mídias</h2><p className="mt-1 text-xs leading-5 text-zinc-400">Automação: {mediaAutomation.name}. Marque até 5 publicações ou Reels que podem disparar esta regra.</p><p className="mt-1 text-xs text-violet-300">{selectedMediaIds.length}/5 selecionadas</p></div><button onClick={()=>setMediaAutomation(null)} aria-label="Fechar seletor" className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800"><X size={18}/></button></div>{mediaLoading ? <div className="flex flex-1 items-center justify-center py-16 text-sm text-zinc-400">Carregando publicações do Instagram…</div> : mediaItems.length === 0 ? <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center"><ImageIcon className="mx-auto mb-3 text-zinc-500" size={24}/><p className="text-sm text-zinc-200">Nenhuma mídia retornada</p><p className="mt-2 text-xs text-zinc-500">Confira a conexão da conta profissional e as permissões da API da Meta.</p></div> : <div className="flex min-h-0 flex-1 flex-col"><div className="grid flex-1 content-start gap-3 overflow-y-auto py-1 sm:grid-cols-2 lg:grid-cols-3">{mediaItems.slice(mediaPage * 3, mediaPage * 3 + 3).map(media=>{const checked=selectedMediaIds.includes(media.id);const disabled=!checked&&selectedMediaIds.length>=5;return <label key={media.id} className={`overflow-hidden rounded-xl border ${checked?"border-violet-400 bg-violet-500/10":"border-zinc-800 bg-zinc-950/60"} ${disabled?"opacity-50":""}`}><div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-900">{(media.thumbnail_url||media.media_url)&&<img src={media.thumbnail_url||media.media_url} alt={media.caption||"Mídia do Instagram"} loading="lazy" className="absolute inset-0 block h-full w-full object-cover"/>}<span className="absolute left-2 top-2 rounded-md bg-black/75 px-2 py-1 text-[10px] text-white">{media.media_type||"Mídia"}</span><span className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md ${checked?"bg-violet-500 text-white":"bg-black/70 text-transparent"}`}><Check size={15}/></span></div><div className="p-3"><div className="mb-2 line-clamp-3 min-h-10 text-xs text-zinc-200">{media.caption||"Publicação sem legenda"}</div><div className="flex items-center justify-between gap-2"><span className="text-[10px] text-zinc-500">{media.timestamp?new Date(media.timestamp).toLocaleDateString("pt-BR"):""}</span>{media.permalink&&<a href={media.permalink} target="_blank" rel="noreferrer" onClick={e=>{e.preventDefault();e.stopPropagation();window.open(media.permalink,"_blank","noopener,noreferrer")}} className="text-[10px] text-violet-300 hover:text-violet-200">Abrir ↗</a>}</div><input type="checkbox" checked={checked} disabled={disabled} onChange={()=>setSelectedMediaIds(ids=>checked?ids.filter(id=>id!==media.id):ids.length<5?[...ids,media.id]:ids)} className="sr-only"/></div></label>})}</div><div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3"><span className="text-xs text-zinc-500">Página {mediaPage+1} de {Math.max(1,Math.ceil(mediaItems.length/3))} · {mediaItems.length} mídias</span><div className="flex gap-2"><button onClick={()=>setMediaPage(page=>Math.max(0,page-1))} disabled={mediaPage===0} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 disabled:cursor-not-allowed disabled:opacity-35">Anterior</button><button onClick={()=>setMediaPage(page=>Math.min(Math.ceil(mediaItems.length/3)-1,page+1))} disabled={mediaPage>=Math.ceil(mediaItems.length/3)-1} className="rounded-lg border border-violet-500/50 px-3 py-2 text-xs text-violet-200 disabled:cursor-not-allowed disabled:opacity-35">Próxima página <span aria-hidden="true">→</span></button></div></div></div>}<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4"><button onClick={()=>setSelectedMediaIds([])} disabled={selectedMediaIds.length===0||mediaSaving} className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 disabled:opacity-40">Limpar seleção</button><div className="flex gap-3"><button onClick={()=>setMediaAutomation(null)} className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300">Cancelar</button><button onClick={saveMediaSelection} disabled={selectedMediaIds.length===0||mediaSaving||mediaLoading} className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{mediaSaving?"Salvando…":"Salvar seleção"}</button></div></div></div></div>}
    {showModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-[#121215] p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><Workflow size={18}/></div><h2 className="text-lg font-semibold">Nova automação</h2><p className="mt-1 text-xs text-zinc-400">Crie um rascunho de regra para comentários.</p></div><button onClick={()=>setShowModal(false)} className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-800">✕</button></div><form onSubmit={createAutomation} className="space-y-4"><label className="block"><span className="mb-2 block text-xs font-medium text-zinc-300">Nome da automação</span><input value={name} onChange={e=>setName(e.target.value)} required placeholder="Ex.: Enviar catálogo no direct" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-violet-500"/></label><label className="block"><span className="mb-2 block text-xs font-medium text-zinc-300">Palavra-chave do comentário</span><input value={keyword} onChange={e=>setKeyword(e.target.value)} required placeholder="Ex.: quero" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-violet-500"/></label><label className="block"><span className="mb-2 block text-xs font-medium text-zinc-300">Resposta pública (opcional)</span><textarea value={publicReply} onChange={e=>setPublicReply(e.target.value)} maxLength={1000} rows={2} placeholder="Ex.: Te enviei os detalhes no direct!" className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-violet-500"/></label><label className="block"><span className="mb-2 block text-xs font-medium text-zinc-300">Mensagem na DM (opcional)</span><textarea value={directMessage} onChange={e=>setDirectMessage(e.target.value)} maxLength={2000} rows={3} placeholder="Escreva a mensagem privada que será enviada a quem comentar." className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-violet-500"/></label><div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-200/80">A regra será criada como rascunho. O envio permanece bloqueado até habilitarmos explicitamente o envio real e validar as permissões da Meta.</div><div className="flex gap-3 pt-1"><button type="button" onClick={()=>setShowModal(false)} className="flex-1 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800">Cancelar</button><button type="submit" disabled={saving} className="flex-1 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Salvando..." : "Criar rascunho"}</button></div></form></div></div>}
  </main>;
}
