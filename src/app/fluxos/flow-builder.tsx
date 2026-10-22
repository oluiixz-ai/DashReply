"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Bot, Clock3, GitBranch, MessageSquare, Plus, Save, Trash2, Zap } from "lucide-react";

type NodeItem = { id: string; type: "trigger" | "message" | "delay" | "condition"; title: string; detail: string; x: number; y: number };
const initialNodes: NodeItem[] = [
  { id: "trigger", type: "trigger", title: "Comentário recebido", detail: "Palavra-chave: QUERO", x: 48, y: 56 },
  { id: "message", type: "message", title: "Enviar mensagem no Direct", detail: "Resposta automática ao usuário", x: 390, y: 56 },
];
const palette = [
  { type: "message" as const, title: "Mensagem", icon: MessageSquare, detail: "Configure uma mensagem para o Direct" },
  { type: "delay" as const, title: "Aguardar", icon: Clock3, detail: "Aguardar 5 minutos" },
  { type: "condition" as const, title: "Condição", icon: GitBranch, detail: "Verificar uma condição" },
];
const colors: Record<NodeItem["type"], string> = { trigger: "border-emerald-500/50 bg-emerald-500/10", message: "border-violet-500/50 bg-violet-500/10", delay: "border-amber-500/50 bg-amber-500/10", condition: "border-cyan-500/50 bg-cyan-500/10" };

export default function FlowBuilder() {
  const [nodes, setNodes] = useState<NodeItem[]>(initialNodes);
  const [flowName, setFlowName] = useState("Novo fluxo do Instagram");
  const [notice, setNotice] = useState("");
  useEffect(() => { try { const saved = localStorage.getItem("dashreply-flow-draft"); if (saved) { const data = JSON.parse(saved); if (Array.isArray(data.nodes)) setNodes(data.nodes); if (typeof data.flowName === "string") setFlowName(data.flowName); } } catch {} }, []);
  function addNode(type: NodeItem["type"], title: string, detail: string) {
    setNodes(current => [...current, { id: crypto.randomUUID(), type, title, detail, x: 48 + (current.length % 3) * 342, y: 250 + Math.floor(current.length / 3) * 180 }]);
  }
  function updateNode(id: string, detail: string) { setNodes(current => current.map(n => n.id === id ? { ...n, detail } : n)); }
  function save() { localStorage.setItem("dashreply-flow-draft", JSON.stringify({ flowName, nodes })); setNotice("Rascunho salvo neste navegador."); }
  return <main className="min-h-screen bg-[#09090b] text-zinc-100">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4 md:px-8">
      <div className="flex items-center gap-3"><a href="/automacoes" className="rounded-lg border border-zinc-700 p-2 hover:bg-zinc-800" aria-label="Voltar às automações"><ArrowLeft size={17}/></a><img src="/icon.svg" alt="" className="h-9 w-9"/><div><div className="text-xs text-zinc-500">DASHREPLY / CONSTRUTOR DE FLUXOS</div><input aria-label="Nome do fluxo" value={flowName} onChange={e=>setFlowName(e.target.value)} className="mt-1 w-72 max-w-full bg-transparent text-lg font-semibold outline-none focus:ring-1 focus:ring-violet-500"/></div></div>
      <button onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold hover:bg-violet-400"><Save size={16}/> Salvar rascunho</button>
    </header>
    <div className="grid gap-5 p-5 md:grid-cols-[230px_1fr] md:p-8">
      <aside className="rounded-2xl border border-zinc-800 bg-[#111114] p-4"><h2 className="mb-1 text-sm font-semibold">Blocos do fluxo</h2><p className="mb-4 text-xs leading-5 text-zinc-500">Adicione etapas ao seu fluxo.</p>
        <button onClick={()=>addNode("trigger","Novo gatilho","Comentário com palavra-chave")} className="mb-2 flex w-full items-center gap-3 rounded-xl border border-emerald-500/30 p-3 text-left hover:bg-emerald-500/10"><Zap size={17} className="text-emerald-300"/><span className="text-sm">Gatilho</span></button>
        {palette.map(item=>{const Icon=item.icon;return <button key={item.type} onClick={()=>addNode(item.type,item.title,item.detail)} className="mb-2 flex w-full items-center gap-3 rounded-xl border border-zinc-700 p-3 text-left hover:border-violet-500/50 hover:bg-zinc-900"><Icon size={17} className="text-violet-300"/><span className="text-sm">{item.title}</span></button>})}
        <div className="mt-5 rounded-xl bg-zinc-900 p-3 text-xs leading-5 text-zinc-500">Este editor salva rascunhos localmente. A ativação e o envio real exigem salvar o fluxo no servidor e validar a integração da Meta.</div>
      </aside>
      <section className="min-h-[620px] overflow-auto rounded-2xl border border-zinc-800 bg-[#0d0d10] p-5">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Área de trabalho</h2><p className="mt-1 text-xs text-zinc-500">{nodes.length} blocos no fluxo</p></div><button onClick={()=>setNodes(initialNodes)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800">Restaurar exemplo</button></div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{nodes.map((node,index)=>{const Icon=node.type==="trigger"?Zap:node.type==="message"?MessageSquare:node.type==="delay"?Clock3:GitBranch;return <div key={node.id} className={`relative rounded-xl border p-4 shadow-lg shadow-black/20 ${colors[node.type]}`}>
          {index>0&&<div className="absolute -top-4 left-1/2 h-4 border-l border-dashed border-zinc-600"/>}
          <div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Icon size={16}/><span className="text-sm font-semibold">{node.title}</span></div>{node.type!=="trigger"&&<button onClick={()=>setNodes(current=>current.filter(n=>n.id!==node.id))} title="Excluir bloco" className="rounded-md p-1 text-zinc-400 hover:bg-red-500/10 hover:text-red-300"><Trash2 size={15}/></button>}</div>
          <textarea aria-label={`Configuração de ${node.title}`} value={node.detail} onChange={e=>updateNode(node.id,e.target.value)} rows={3} className="w-full resize-y rounded-lg border border-white/10 bg-black/20 p-2 text-xs leading-5 text-zinc-300 outline-none focus:border-violet-400"/>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-500"><Bot size={12}/> Etapa {index+1}</div>
        </div>})}
        <button onClick={()=>addNode("message","Enviar mensagem no Direct","Digite a mensagem automática")} className="flex min-h-32 items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-400 hover:border-violet-500 hover:text-violet-300"><Plus size={17}/> Adicionar etapa</button></div>
        {notice&&<p role="status" className="mt-5 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-300">{notice}</p>}
      </section>
    </div>
  </main>;
}
