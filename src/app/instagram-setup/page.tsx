"use client";

import { useState } from "react";

type Result = {
  ok?: boolean;
  action?: string;
  result?: unknown;
  error?: string;
  status?: number;
};

export default function InstagramSetupPage() {
  const [loading, setLoading] = useState<"check" | "subscribe" | null>(null);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function run(action: "check" | "subscribe") {
    setLoading(action);
    setMessage("");
    setResult(null);
    try {
      const response = await fetch("/api/meta/subscriptions", {
        method: action === "subscribe" ? "POST" : "GET",
        cache: "no-store",
      });
      const data = (await response.json()) as Result;
      setResult(data);
      if (!response.ok) {
        setMessage(data.error || `Falha na solicitação (HTTP ${response.status}).`);
      } else if (action === "subscribe") {
        setMessage("Solicitação de inscrição enviada à API do Instagram. Confira o resultado abaixo.");
      } else {
        setMessage("Consulta concluída. Confira as inscrições retornadas pela API.");
      }
    } catch {
      setMessage("Não foi possível acessar o endpoint. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <a href="/dashboard" className="text-sm underline">← Voltar ao painel</a>
      <section className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6">
        <h1 className="text-2xl font-semibold">Integração do Instagram</h1>
        <p className="mt-2 text-sm opacity-80">
          Verifique e ative a inscrição da conta conectada nos webhooks do Instagram Login.
          Esta etapa não envia respostas a comentários nem mensagens diretas.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => run("check")}
            disabled={loading !== null}
            className="rounded-xl border px-4 py-2 disabled:opacity-50"
          >
            {loading === "check" ? "Consultando..." : "Verificar inscrição"}
          </button>
          <button
            type="button"
            onClick={() => run("subscribe")}
            disabled={loading !== null}
            className="rounded-xl bg-fuchsia-600 px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {loading === "subscribe" ? "Ativando..." : "Ativar webhooks"}
          </button>
        </div>

        {message && (
          <p role="status" className="mt-5 rounded-xl border p-3 text-sm">
            {message}
          </p>
        )}

        {result && (
          <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/30 p-4 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}
