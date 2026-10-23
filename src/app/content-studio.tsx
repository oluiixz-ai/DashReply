"use client";

import { useRef, useState } from "react";
import { BadgeCheck, CalendarClock, Captions, Check, FileVideo, ImagePlus, Instagram, LayoutTemplate, Upload, Video, WandSparkles } from "lucide-react";

export default function ContentStudio() {
  const [videoUrl, setVideoUrl] = useState("");
  const [videoName, setVideoName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [profileName, setProfileName] = useState("UnyFlick");
  const [handle, setHandle] = useState("@theunyfliick");
  const [bottomText, setBottomText] = useState("Eles encontram uma piranha pré-histórica 🦈😱");
  const [captionText, setCaptionText] = useState("Digite ou cole aqui a legenda do vídeo...");
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [showVerifiedBadge, setShowVerifiedBadge] = useState(true);
  const videoInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  function selectVideo(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("video/")) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(URL.createObjectURL(file));
    setVideoName(file.name);
  }

  function selectLogo(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    setLogoUrl(URL.createObjectURL(file));
  }

  return <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-800 bg-[#111114] p-5 md:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><LayoutTemplate size={21}/></div>
          <div><h2 className="font-semibold text-white">Modelo de publicação</h2><p className="mt-1 text-sm leading-5 text-zinc-400">Personalize o cabeçalho, o vídeo e o texto inferior para criar seu template reutilizável.</p></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-2 block text-xs font-medium text-zinc-300">Nome do perfil</span><input value={profileName} onChange={e=>setProfileName(e.target.value)} maxLength={60} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/></label>
          <label className="block"><span className="mb-2 block text-xs font-medium text-zinc-300">Usuário (@)</span><input value={handle} onChange={e=>setHandle(e.target.value)} maxLength={60} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/></label>
          <label className="block sm:col-span-2"><span className="mb-2 block text-xs font-medium text-zinc-300">Texto de destaque inferior</span><textarea value={bottomText} onChange={e=>setBottomText(e.target.value)} maxLength={180} rows={2} className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/></label>
          <label className="block sm:col-span-2"><span className="mb-2 block text-xs font-medium text-zinc-300">Legenda da publicação</span><textarea value={captionText} onChange={e=>setCaptionText(e.target.value)} maxLength={2200} rows={3} className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/></label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button onClick={()=>logoInput.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-3 text-sm text-zinc-200 transition hover:border-violet-500 hover:bg-violet-500/5"><ImagePlus size={17}/>{logoUrl ? "Trocar logo" : "Enviar logo do perfil"}</button>
          <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={e=>selectLogo(e.target.files?.[0])}/>
          <button onClick={()=>videoInput.current?.click()} className="flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"><Upload size={17}/>{videoUrl ? "Trocar vídeo" : "Importar vídeo"}</button>
          <input ref={videoInput} type="file" accept="video/*" className="hidden" onChange={e=>selectVideo(e.target.files?.[0])}/>
        </div>
        {videoName && <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200"><Check size={15}/><span className="truncate">{videoName}</span></div>}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-[#111114] p-5 md:p-6">
        <div className="mb-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-300"><Captions size={20}/></div><div><h2 className="font-semibold text-white">Legendas e publicação</h2><p className="mt-1 text-sm text-zinc-400">Prepare o texto que acompanhará o vídeo.</p></div></div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"><input type="checkbox" checked={showVerifiedBadge} onChange={e=>setShowVerifiedBadge(e.target.checked)} className="mt-1 accent-violet-500"/><span><span className="block text-sm font-medium text-zinc-200">Exibir selo de verificado</span><span className="mt-1 block text-xs leading-5 text-zinc-500">Mostra ou oculta o ícone azul ao lado do nome na prévia.</span></span></label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"><input type="checkbox" checked={showSubtitles} onChange={e=>setShowSubtitles(e.target.checked)} className="mt-1 accent-violet-500"/><span><span className="block text-sm font-medium text-zinc-200">Reservar espaço para legendas no vídeo</span><span className="mt-1 block text-xs leading-5 text-zinc-500">A geração e a sincronização automática de legendas serão conectadas à etapa de renderização.</span></span></label>
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-100/80">Esta primeira versão prepara a prévia e os campos do template. Renderização final, salvamento permanente e agendamento ainda precisam ser conectados ao processamento e à API oficial de publicação.</div>
      </div>
    </div>

    <aside className="h-fit rounded-2xl border border-zinc-800 bg-[#111114] p-5 xl:sticky xl:top-24">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Prévia ao vivo</h2><p className="mt-1 text-xs text-zinc-500">Modelo vertical 9:16</p></div><span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300">Editor</span></div>
      <div className="mx-auto max-w-[290px] overflow-hidden rounded-[24px] bg-white text-zinc-950 shadow-2xl">
        <div className="flex min-h-[76px] items-center gap-3 px-4 py-3">
          {logoUrl ? <img src={logoUrl} alt="Logo do perfil" className="h-11 w-11 rounded-full object-cover"/> : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-violet-300"><Instagram size={21}/></div>}
          <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-1"><div className="truncate text-sm font-bold">{profileName || "Nome do perfil"}</div>{showVerifiedBadge && <BadgeCheck aria-label="Perfil verificado" size={13} className="relative -top-1 shrink-0 fill-blue-500 text-blue-500 [&>path:last-child]:text-white"/>}</div><div className="truncate text-xs text-zinc-600">{handle || "@seuperfil"}</div></div>
        </div>
        <div className="relative aspect-[9/11] overflow-hidden bg-zinc-900">
          {videoUrl ? <video src={videoUrl} controls playsInline className="h-full w-full object-cover"/> : <div className="flex h-full flex-col items-center justify-center gap-3 px-5 text-center text-white"><FileVideo size={38} className="text-zinc-500"/><span className="text-sm font-medium">Seu vídeo aparecerá aqui</span><span className="text-xs text-zinc-500">Importe um arquivo para ver a prévia</span></div>}
          {videoUrl && showSubtitles && <div className="pointer-events-none absolute bottom-5 left-3 right-3 text-center"><span className="rounded bg-black/75 px-2 py-1 text-xs font-bold text-white">Prévia das legendas</span></div>}
        </div>
        <div className="min-h-[104px] px-4 py-5"><div className="text-center text-[17px] font-extrabold leading-snug">{bottomText || "Seu texto de destaque"}</div></div>
      </div>
      <label className="mt-4 block"><span className="mb-2 block text-xs font-medium text-zinc-300">Link de referência (opcional)</span><input placeholder="Cole o link do Reel para referência" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/></label>
      <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={()=>videoInput.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-2.5 text-xs text-zinc-200 hover:bg-zinc-800"><Video size={15}/>Trocar vídeo</button><button disabled className="flex items-center justify-center gap-2 rounded-xl bg-violet-500/40 px-3 py-2.5 text-xs font-semibold text-white/70" title="Disponível após conectar o renderizador"><CalendarClock size={15}/>Agendar</button></div>
      <p className="mt-3 text-[11px] leading-5 text-zinc-500">O vídeo selecionado fica nesta prévia local. Ele ainda não é enviado nem publicado.</p>
    </aside>
  </section>;
}
