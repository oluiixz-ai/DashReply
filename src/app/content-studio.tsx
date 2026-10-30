"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, CalendarClock, Captions, Check, Copy, FileVideo, ImagePlus, Instagram, LayoutTemplate, Upload, Video, WandSparkles } from "lucide-react";

export default function ContentStudio() {
  const [videoUrl, setVideoUrl] = useState("");
  const [videoName, setVideoName] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [profileName, setProfileName] = useState("UnyFlick");
  const [handle, setHandle] = useState("@theunyfliick");
  const [topText, setTopText] = useState("👨🏻‍💼 POV: você encontrou a única página que mostra os melhores filmes para assistir");
  const [bottomText, setBottomText] = useState("Eles encontram uma piranha pré-histórica 🦈😱");
  const [captionText, setCaptionText] = useState("Digite ou cole aqui a legenda do vídeo...");
  const [showVerifiedBadge, setShowVerifiedBadge] = useState(true);
  const [draftStatus, setDraftStatus] = useState("");
  const [captionCopyStatus, setCaptionCopyStatus] = useState("");
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduleStatus, setScheduleStatus] = useState("");
  const [savedPlans, setSavedPlans] = useState<Array<{id:string; profileName:string; handle:string; captionText:string; scheduledAt:string; videoFileName:string; status:string}>>([]);
  const [renderStatus, setRenderStatus] = useState("");
  const [renderedUrl, setRenderedUrl] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  async function renderVideo() {
    const video = previewVideoRef.current;
    if (!video || !videoUrl) { setRenderStatus("Importe um vídeo primeiro."); return; }
    if (!("MediaRecorder" in window) || !HTMLCanvasElement.prototype.captureStream) {
      setRenderStatus("A exportação requer um navegador atualizado, como o Chrome."); return;
    }
    setIsRendering(true);
    setRenderProgress(0);
    setRenderStatus("Preparando a renderização...");
    if (renderedUrl) URL.revokeObjectURL(renderedUrl);
    setRenderedUrl("");
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setIsRendering(false); setRenderStatus("Não foi possível iniciar o renderizador."); return; }
    const draw = () => {
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 1080, 1920);
      // Avatar placeholder: no photo was uploaded, so show a neutral profile silhouette.
      ctx.fillStyle = "#e5e7eb"; ctx.beginPath(); ctx.arc(48, 78, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#9ca3af"; ctx.beginPath(); ctx.arc(48, 67, 11, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(48, 91, 19, 12, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#111"; ctx.font = "bold 46px Arial"; ctx.textAlign = "left";
      const displayName = (profileName || "Nome do perfil").slice(0, 28);
      ctx.fillText(displayName, 100, 75, 760);
      if (showVerifiedBadge) {
        const badgeX = Math.min(100 + ctx.measureText(displayName).width + 26, 1010);
        ctx.fillStyle = "#3897f0"; ctx.beginPath(); ctx.arc(badgeX, 59, 17, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(badgeX - 7, 59); ctx.lineTo(badgeX - 2, 64); ctx.lineTo(badgeX + 8, 53); ctx.stroke();
      }
      ctx.fillStyle = "#555"; ctx.font = "30px Arial"; ctx.fillText((handle || "@seuperfil").slice(0, 40), 100, 125, 900);
      ctx.fillStyle = "#111"; ctx.font = "bold 34px Arial"; ctx.textAlign = "left";
      const topWords = (topText || "").split(/\\s+/); let topLine = ""; let topY = 225;
      for (const word of topWords) {
        const next = topLine ? topLine + " " + word : word;
        if (ctx.measureText(next).width > 980 && topLine) { ctx.fillText(topLine, 50, topY, 980); topY += 42; topLine = word; }
        else topLine = next;
      }
      if (topLine) ctx.fillText(topLine, 50, topY, 980);
      if (video.readyState >= 2 && video.videoWidth) {
        const top = 300, height = 1150, scale = Math.max(1080 / video.videoWidth, height / video.videoHeight);
        const width = video.videoWidth * scale, vh = video.videoHeight * scale;
        ctx.save(); ctx.beginPath(); ctx.rect(0, top, 1080, height); ctx.clip();
        ctx.drawImage(video, (1080 - width) / 2, top + (height - vh) / 2, width, vh); ctx.restore();
      }
      // Do not draw fake subtitle placeholders; real synchronized subtitles are not implemented yet.
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 1450, 1080, 470);
      ctx.fillStyle = "#111"; ctx.font = "bold 64px Arial"; ctx.textAlign = "center";
      const text = bottomText || "Seu texto de destaque";
      const words = text.split(/\s+/); let line = ""; let y = 1630;
      for (const word of words) {
        const next = line ? line + " " + word : word;
        if (ctx.measureText(next).width > 940 && line) { ctx.fillText(line, 540, y, 940); y += 78; line = word; }
        else line = next;
      }
      if (line && y < 1880) ctx.fillText(line, 540, y, 940);
      ctx.textAlign = "left";
    };
    try {
      video.pause();
      setRenderStatus("Verificando o vídeo...");
      await new Promise<void>((resolve, reject) => {
        if (video.readyState >= 2 && video.videoWidth > 0) { resolve(); return; }
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          video.removeEventListener("loadeddata", onReady);
          video.removeEventListener("canplay", onReady);
          video.removeEventListener("error", onError);
          if (error) reject(error); else resolve();
        };
        const onReady = () => {
          if (video.readyState >= 2 && video.videoWidth > 0) finish();
        };
        const onError = () => finish(new Error("O navegador não conseguiu carregar esse arquivo de vídeo. Tente MP4 (H.264)."));
        const timer = setTimeout(() => finish(new Error("O vídeo não ficou pronto para renderização após 12 segundos. Reimporte o arquivo e tente novamente.")), 12000);
        video.addEventListener("loadeddata", onReady);
        video.addEventListener("canplay", onReady);
        video.addEventListener("error", onError);
        onReady();
      });
      video.currentTime = 0;
      if (video.readyState < 2) {
        setRenderStatus("Carregando o primeiro quadro do vídeo...");
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("O vídeo demorou para voltar ao início. Tente reimportá-lo.")), 8000);
          const onSeeked = () => { clearTimeout(timer); video.removeEventListener("seeked", onSeeked); resolve(); };
          video.addEventListener("seeked", onSeeked, { once: true });
        });
      }
      setRenderStatus("Preparando o quadro de saída...");
      draw();
      const canvasStream = canvas.captureStream(30);
      const source = video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream };
      const sourceStream = source.captureStream?.() || source.mozCaptureStream?.();
      const stream = new MediaStream([...canvasStream.getVideoTracks(), ...(sourceStream?.getAudioTracks() || [])]);
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { setIsRendering(false); setRenderStatus("Falha ao renderizar. Tente um vídeo menor."); };
      let safetyTimer: ReturnType<typeof setTimeout> | undefined;
      recorder.onstop = () => {
        if (safetyTimer) clearTimeout(safetyTimer);
        const url = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
        setRenderedUrl(url); setIsRendering(false); setRenderProgress(100);
        setRenderStatus("Renderização concluída. Baixe o WebM e confira o áudio antes de publicar.");
        stream.getTracks().forEach(track => track.stop()); video.pause(); video.currentTime = 0;
      };
      recorder.start(250);
      setRenderStatus("Renderizando em tempo real. Mantenha esta aba aberta.");
      const expectedDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 60;
      safetyTimer = setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
        setIsRendering(false);
        setRenderStatus("A renderização demorou mais que o esperado e foi interrompida. Tente novamente com um vídeo menor.");
      }, Math.min(Math.max(expectedDuration * 1500 + 15000, 45000), 30 * 60 * 1000));
      video.ontimeupdate = () => {
        if (Number.isFinite(video.duration) && video.duration > 0) {
          setRenderProgress(Math.min(99, Math.round((video.currentTime / video.duration) * 100)));
        }
      };
      let frame = 0;
      const paint = () => { draw(); if (!video.ended && !video.paused) frame = requestAnimationFrame(paint); };
      video.onended = () => { cancelAnimationFrame(frame); draw(); if (recorder.state !== "inactive") recorder.stop(); };
      await video.play(); paint();
    } catch (error) {
      setIsRendering(false);
      setRenderProgress(0);
      setRenderStatus(error instanceof Error ? error.message : "Falha ao renderizar o vídeo.");
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/content-schedule", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) return null;
        return response.json();
      })
      .then(data => { if (active && Array.isArray(data?.plans)) setSavedPlans(data.plans); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  function saveDraft() {
    const draft = { profileName, handle, topText, bottomText, captionText, showVerifiedBadge, savedAt: new Date().toISOString() };
    try {
      localStorage.setItem("dashreply-content-studio-draft", JSON.stringify(draft));
      setDraftStatus("Rascunho salvo neste navegador.");
    } catch {
      setDraftStatus("Não foi possível salvar o rascunho neste navegador.");
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem("dashreply-content-studio-draft");
      if (!raw) { setDraftStatus("Nenhum rascunho salvo neste navegador."); return; }
      const draft = JSON.parse(raw);
      if (typeof draft.profileName === "string") setProfileName(draft.profileName);
      if (typeof draft.handle === "string") setHandle(draft.handle);
      if (typeof draft.topText === "string") setTopText(draft.topText);
      if (typeof draft.bottomText === "string") setBottomText(draft.bottomText);
      if (typeof draft.captionText === "string") setCaptionText(draft.captionText);
      if (typeof draft.showVerifiedBadge === "boolean") setShowVerifiedBadge(draft.showVerifiedBadge);
      setDraftStatus("Rascunho carregado. O vídeo e a logo precisam ser selecionados novamente.");
    } catch {
      setDraftStatus("Não foi possível carregar o rascunho salvo.");
    }
  }

  async function saveSchedulePlan() {
    if (!videoName) { setScheduleStatus("Selecione um vídeo antes de planejar a publicação."); return; }
    if (!scheduledAt) { setScheduleStatus("Escolha a data e o horário desejados."); return; }
    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      setScheduleStatus("Escolha um horário futuro."); return;
    }
    setScheduleStatus("Verificando armazenamento do vídeo...");
    try {
      let videoUrlForPlan = uploadedVideoUrl;
      if (!videoUrlForPlan) videoUrlForPlan = await uploadVideoToR2();
      if (!videoUrlForPlan) { setScheduleStatus("Não foi possível armazenar o vídeo. Confira a mensagem de upload e tente novamente."); return; }
      setScheduleStatus("Salvando planejamento no banco de dados...");
      const response = await fetch("/api/content-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileName, handle, captionText, scheduledAt: scheduledDate.toISOString(), videoFileName: videoName, videoUrl: videoUrlForPlan })
      });
      const data = await response.json();
      if (!response.ok) { setScheduleStatus(data.error || "Não foi possível salvar o planejamento."); return; }
      setSavedPlans(current => [...current, data.plan].sort((a,b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()));
      setScheduleStatus("Vídeo armazenado no R2 e planejamento salvo. A publicação automática no Instagram ainda não está conectada.");
    } catch {
      setScheduleStatus("Falha de conexão ao salvar. Verifique a publicação e tente novamente.");
    }
  }

  async function uploadVideoToR2(file = videoFile) {
    if (!file) { setUploadStatus("Selecione um vídeo primeiro."); return ""; }
    setIsUploading(true);
    setUploadStatus("Preparando upload seguro...");
    try {
      const signed = await fetch("/api/r2-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type || "video/mp4", size: file.size })
      });
      const details = await signed.json();
      if (!signed.ok) throw new Error(details.error || "Não foi possível preparar o upload.");
      setUploadStatus("Enviando vídeo ao Cloudflare R2...");
      const put = await fetch(details.uploadUrl, { method: "PUT", headers: { "Content-Type": details.contentType }, body: file });
      if (!put.ok) throw new Error("O Cloudflare recusou o upload (" + put.status + "). Confira a regra CORS e as credenciais R2.");
      setUploadedVideoUrl(details.publicUrl);
      setUploadStatus("Vídeo enviado e armazenado no R2.");
      return details.publicUrl as string;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao enviar vídeo.";
      setUploadStatus(message);
      return "";
    } finally { setIsUploading(false); }
  }

  function selectVideo(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("video/")) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(file);
    setUploadedVideoUrl("");
    setUploadStatus("");
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
          <div><h2 className="font-semibold text-white">Modelo de publicação</h2><p className="mt-1 text-sm leading-5 text-zinc-400">Personalize o cabeçalho, o texto superior, o vídeo e o texto inferior para criar seu template reutilizável.</p></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-2 block text-xs font-medium text-zinc-300">Nome do perfil</span><input value={profileName} onChange={e=>setProfileName(e.target.value)} maxLength={60} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/></label>
          <label className="block"><span className="mb-2 block text-xs font-medium text-zinc-300">Usuário (@)</span><input value={handle} onChange={e=>setHandle(e.target.value)} maxLength={60} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/></label>
          <label className="block sm:col-span-2"><span className="mb-2 block text-xs font-medium text-zinc-300">Texto superior (acima do vídeo)</span><textarea value={topText} onChange={e=>setTopText(e.target.value)} maxLength={180} rows={2} placeholder="Ex.: 👨🏻‍💼 POV: você encontrou a página certa..." className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/></label>
          <label className="block sm:col-span-2"><span className="mb-2 block text-xs font-medium text-zinc-300">Texto de destaque inferior</span><textarea value={bottomText} onChange={e=>setBottomText(e.target.value)} maxLength={180} rows={2} className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/></label>
          <label className="block sm:col-span-2"><span className="mb-2 block text-xs font-medium text-zinc-300">Legenda da publicação (descrição do Reel)</span><textarea value={captionText} onChange={e=>{setCaptionText(e.target.value);setCaptionCopyStatus("");}} maxLength={2200} rows={4} placeholder="Escreva a descrição que acompanhará o Reel no Instagram, com emojis e hashtags..." className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/><span className="mt-1 block text-xs text-zinc-500">{captionText.length}/2200 caracteres · Não aparece dentro do vídeo.</span></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={async()=>{try{await navigator.clipboard.writeText(captionText);setCaptionCopyStatus("Legenda copiada! Cole no Instagram ao publicar.");}catch{setCaptionCopyStatus("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.");}}} className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 px-4 py-2.5 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/10"><Copy size={16}/>Copiar legenda</button>
          <button onClick={saveDraft} className="flex items-center justify-center gap-2 rounded-xl border border-violet-500/40 px-4 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-500/10"><Check size={16}/>Salvar rascunho</button>
          <button onClick={loadDraft} className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-zinc-800"><Upload size={16}/>Carregar rascunho</button>
        </div>
        {captionCopyStatus && <p role="status" className="mt-2 text-xs text-emerald-300">{captionCopyStatus}</p>}
        {draftStatus && <p role="status" className="mt-2 text-xs text-zinc-400">{draftStatus}</p>}
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
        {topText.trim() && <div className="px-3 py-2 text-[11px] font-semibold leading-snug text-zinc-900">{topText}</div>}
        <div className="relative aspect-[9/11] overflow-hidden bg-zinc-900">
          {videoUrl ? <video ref={previewVideoRef} src={videoUrl} controls playsInline className="h-full w-full object-cover"/> : <div className="flex h-full flex-col items-center justify-center gap-3 px-5 text-center text-white"><FileVideo size={38} className="text-zinc-500"/><span className="text-sm font-medium">Seu vídeo aparecerá aqui</span><span className="text-xs text-zinc-500">Importe um arquivo para ver a prévia</span></div>}
        </div>
        <div className="min-h-[104px] px-4 py-5"><div className="text-center text-[17px] font-extrabold leading-snug">{bottomText || "Seu texto de destaque"}</div></div>
      </div>
      <label className="mt-4 block"><span className="mb-2 block text-xs font-medium text-zinc-300">Link de referência (opcional)</span><input placeholder="Cole o link do Reel para referência" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"/></label>
      <div className="mt-4 space-y-2">
        <button onClick={renderVideo} disabled={isRendering} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-50"><WandSparkles size={17}/>{isRendering ? "Renderizando..." : "Renderizar vídeo com template"}</button>
        {renderStatus && <p role="status" className="text-xs leading-5 text-zinc-400">{renderStatus}</p>}
        {isRendering && <div className="space-y-1.5"><div className="h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-violet-500 transition-all" style={{width: `${renderProgress}%`}} /></div><p className="text-right text-[11px] text-zinc-500">{renderProgress > 0 ? `${renderProgress}% do vídeo` : "Iniciando vídeo..."}</p></div>}
        {renderedUrl && <a href={renderedUrl} download="dashreply-video.webm" className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 px-4 py-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10"><Upload size={16}/>Baixar vídeo renderizado (.webm)</a>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={()=>uploadVideoToR2()} disabled={isUploading || !videoFile} className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 px-3 py-2.5 text-xs text-emerald-300 disabled:opacity-50"><Upload size={15}/>{isUploading ? "Enviando..." : uploadedVideoUrl ? "Vídeo na nuvem" : "Enviar para nuvem"}</button><button onClick={()=>videoInput.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-2.5 text-xs text-zinc-200 hover:bg-zinc-800"><Video size={15}/>Trocar vídeo</button><button onClick={()=>{setShowScheduleForm(v=>!v);setScheduleStatus("");}} className="flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-3 py-2.5 text-xs font-semibold text-white hover:bg-violet-400"><CalendarClock size={15}/>Planejar horário</button></div>
      {uploadStatus && <p role="status" className="mt-2 text-xs leading-5 text-zinc-300">{uploadStatus}</p>}
      {savedPlans.length > 0 && <div className="mt-3 rounded-xl border border-zinc-800 p-3"><h3 className="mb-2 text-xs font-semibold text-zinc-200">Planejamentos salvos</h3><div className="space-y-2">{savedPlans.slice(0,5).map(plan => <div key={plan.id} className="rounded-lg bg-zinc-950/70 p-2"><div className="text-xs font-medium text-zinc-200">{new Date(plan.scheduledAt).toLocaleString("pt-BR", {dateStyle:"short",timeStyle:"short"})}</div><div className="mt-1 truncate text-[11px] text-zinc-400">{plan.videoFileName}</div><div className="mt-1 text-[10px] text-violet-300">{plan.status === "planned" ? "Planejado · publicação automática pendente" : plan.status}</div></div>)}</div></div>}
      {showScheduleForm && <div className="mt-3 space-y-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3"><p className="text-xs leading-5 text-zinc-300">Escolha quando você pretende publicar. Por enquanto, o horário fica salvo neste navegador e não envia o vídeo ao Instagram.</p><label className="block"><span className="mb-1.5 block text-xs text-zinc-400">Data e horário</span><input type="datetime-local" value={scheduledAt} min={new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)} onChange={e=>{setScheduledAt(e.target.value);setScheduleStatus("");}} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"/></label><button onClick={saveSchedulePlan} className="w-full rounded-lg bg-violet-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-violet-400">Salvar planejamento</button>{scheduleStatus && <p role="status" className="text-xs leading-5 text-zinc-300">{scheduleStatus}</p>}</div>}
      <p className="mt-3 text-[11px] leading-5 text-zinc-500">O vídeo fica no navegador. O planejamento de horário é local; publicação automática ainda não está conectada.</p>
    </aside>
  </section>;
}
