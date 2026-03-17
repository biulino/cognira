"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Send, Bot, User, Loader2, Sparkles, AlertTriangle, CheckCircle2, ArrowRightLeft, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Estudo { id: number; nome: string; }

interface LogisticaPreview {
  acao: string;
  analista_origem_id: number;
  analista_origem_nome: string;
  analista_destino_id: number;
  analista_destino_nome: string;
  estudo_id: number | null;
  visitas_count: number;
  visita_ids?: number[];  // present for specific-ID reassignments
  visitas_sample: Array<{ id: number; estado: string; estudo: string; estabelecimento: string }>;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sql?: string;
  sugestoes?: string[];
  logistica_preview?: LogisticaPreview;
  logistica_done?: { alteradas: number };
}

const EXEMPLOS = [
  "Quantas visitas existem por estado?",
  "Qual a pontuação média do estudo Novo Banco?",
  "Quais os analistas com mais visitas?",
  "Muda todas as visitas do analista A001 para o A002",
  "Lista as 5 últimas visitas inseridas",
];

export default function ChatPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [estudos, setEstudos] = useState<Estudo[]>([]);
  const [estudoId, setEstudoId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const SESSION_KEY = "chat_ai_session_id";

  // Load session from localStorage and restore history
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    api.get<Estudo[]>("/estudos/").then(setEstudos).catch(() => {});

    const storedSession = localStorage.getItem(SESSION_KEY);
    if (storedSession) {
      setSessionId(storedSession);
      setLoadingHistory(true);
      // Use raw fetch to avoid globalToast when session expired/deleted
      const t = localStorage.getItem("access_token");
      fetch(`/api/chat/sessao/${storedSession}`, {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((data: { session_id: string; mensagens: Array<{ role: string; content: string; ts: string }> }) => {
          const restored: Message[] = data.mensagens
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
          setMessages(restored);
        })
        .catch(() => {
          // Session not found (expired/deleted) — clear and start fresh
          localStorage.removeItem(SESSION_KEY);
          setSessionId(null);
        })
        .finally(() => setLoadingHistory(false));
    }
  }, [router]);

  function novaConversa() {
    if (sessionId) {
      api.delete(`/chat/sessao/${sessionId}`).catch(() => {});
    }
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setMessages([]);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res = await api.post<{ resposta: string; session_id: string; sql_executado: string | null; sugestoes?: string[]; logistica_preview?: LogisticaPreview }>("/chat", {
        mensagem: msg,
        estudo_id: estudoId,
        session_id: sessionId,
      });
      // Persist session_id from first response onwards
      if (res.session_id && res.session_id !== sessionId) {
        setSessionId(res.session_id);
        localStorage.setItem(SESSION_KEY, res.session_id);
      }
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: res.resposta,
        sql: res.sql_executado ?? undefined,
        sugestoes: res.sugestoes ?? [],
        logistica_preview: res.logistica_preview ?? undefined,
      }]);
    } catch (err: unknown) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erro: " + (err instanceof Error ? err.message : String(err)) }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function confirmLogistica(preview: LogisticaPreview, msgIndex: number) {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        analista_origem_id: preview.analista_origem_id,
        analista_destino_id: preview.analista_destino_id,
        estudo_id: preview.estudo_id,
      };
      if (preview.visita_ids && preview.visita_ids.length > 0) {
        payload.visita_ids = preview.visita_ids;
      }
      const res = await api.post<{ alteradas: number }>("/chat/logistica/executa", payload);
      setMessages((prev) => prev.map((m, i) =>
        i === msgIndex ? { ...m, logistica_preview: undefined, logistica_done: res } : m
      ));
    } catch (err: unknown) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erro ao executar: " + (err instanceof Error ? err.message : String(err)) }]);
    } finally {
      setLoading(false);
    }
  }

  function cancelLogistica(msgIndex: number) {
    setMessages((prev) => prev.map((m, i) =>
      i === msgIndex ? { ...m, logistica_preview: undefined } : m
    ));
    setMessages((prev) => [...prev, { role: "assistant", content: "Operação cancelada. Nenhuma visita foi alterada." }]);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-sm shrink-0">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-slate-900 dark:text-white text-sm">{t("chat.title")}</h1>
              <p className="text-xs text-slate-400 truncate">Interroga os dados em linguagem natural</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={novaConversa}
              title={t("chat.newConversation")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-orange-600 text-xs font-medium transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("chat.newConversation")}</span>
            </button>
            <select
              value={estudoId ?? ""}
              onChange={(e) => setEstudoId(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 transition max-w-[160px]"
            >
              <option value="">{t("chat.allStudies")}</option>
              {estudos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {loadingHistory && (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
            </div>
          )}
          {!loadingHistory && messages.length === 0 && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400/20 to-orange-600/20 mb-4">
                <Bot className="w-8 h-8 text-orange-500 dark:text-orange-400" />
              </div>
              <p className="font-semibold text-slate-900 dark:text-white mb-1">{t("chat.assistant")}</p>
              <p className="text-sm text-slate-400 max-w-xs mx-auto mb-8">
                Faz perguntas sobre os teus estudos de mystery shopping em português.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 max-w-lg mx-auto text-left">
                {EXEMPLOS.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => send(ex)}
                    className="px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 hover:border-orange-300 hover:text-orange-600 dark:hover:border-orange-700 dark:hover:text-orange-400 text-left transition shadow-card active:scale-[0.98]"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                m.role === "user"
                  ? "bg-orange-500"
                  : "bg-gradient-to-br from-orange-400 to-orange-600"
              }`}>
                {m.role === "user"
                  ? <User className="w-4 h-4 text-white" />
                  : <Bot className="w-4 h-4 text-white" />}
              </div>
              <div className={`max-w-[80%] space-y-2 ${m.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${ 
                  m.role === "user"
                    ? "bg-orange-500 text-white rounded-tr-sm"
                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800 shadow-card rounded-tl-sm"
                }`}>
                  {m.content.split("\n").map((line, j) => (
                    <span key={j}>{line}{j < m.content.split("\n").length - 1 && <br />}</span>
                  ))}
                </div>
                {m.sql && (
                  <details className="w-full">
                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 select-none">
                      Ver SQL executado
                    </summary>
                    <pre className="mt-1.5 px-3 py-2.5 rounded-xl bg-slate-900 text-emerald-400 text-xs overflow-x-auto">
                      {m.sql}
                    </pre>
                  </details>
                )}
                {m.role === "assistant" && m.sugestoes && m.sugestoes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {m.sugestoes.map((s, si) => (
                      <button
                        key={si}
                        onClick={() => send(s)}
                        disabled={loading}
                        className="text-xs px-2.5 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <Sparkles className="w-2.5 h-2.5" /> {s}
                      </button>
                    ))}
                  </div>
                )}

                {/* ── Logistics preview card ── */}
                {m.role === "assistant" && m.logistica_preview && (
                  <div className="w-full border border-amber-200 bg-amber-50 rounded-2xl p-4 space-y-3 text-sm">
                    <div className="flex items-center gap-2 text-amber-800 font-semibold">
                      <ArrowRightLeft className="w-4 h-4" />
                      Reatribuição de Visitas — Confirmar
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white rounded-xl p-3 border border-amber-100">
                        <p className="text-slate-400 font-medium mb-0.5">De</p>
                        <p className="font-semibold text-slate-800">{m.logistica_preview.analista_origem_nome}</p>
                        <p className="text-slate-500">ID {m.logistica_preview.analista_origem_id}</p>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-amber-100">
                        <p className="text-slate-400 font-medium mb-0.5">Para</p>
                        <p className="font-semibold text-slate-800">{m.logistica_preview.analista_destino_nome}</p>
                        <p className="text-slate-500">ID {m.logistica_preview.analista_destino_id}</p>
                      </div>
                    </div>
                    <p className="text-amber-800 text-xs font-medium">
                      {m.logistica_preview.visitas_count} visita(s) activa(s) serão reatribuídas
                      {m.logistica_preview.estudo_id ? ` no estudo ${m.logistica_preview.estudo_id}` : " (todos os estudos)"}
                    </p>
                    {m.logistica_preview.visitas_sample.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-amber-700 hover:text-amber-900 select-none">Ver amostra ({m.logistica_preview.visitas_sample.length} visita(s))</summary>
                        <div className="mt-2 space-y-1">
                          {m.logistica_preview.visitas_sample.map((v) => (
                            <div key={v.id} className="flex gap-2 text-slate-600">
                              <span className="font-mono text-slate-400">#{v.id}</span>
                              <span>{v.estabelecimento}</span>
                              <span className="bg-slate-100 px-1.5 rounded">{v.estado}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => confirmLogistica(m.logistica_preview!, i)}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar e Executar
                      </button>
                      <button
                        onClick={() => cancelLogistica(i)}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition disabled:opacity-50"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" /> Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Logistics done badge ── */}
                {m.role === "assistant" && m.logistica_done && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-xs text-green-800 font-medium w-full">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    {m.logistica_done.alteradas} visita(s) reatribuída(s) com sucesso.
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-card">
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder=""
              rows={1}
              className="w-full px-4 py-3 pr-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition resize-none"
              style={{ minHeight: "48px", maxHeight: "160px" }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 160) + "px";
              }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="absolute right-2 bottom-2 w-10 h-10 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-slate-300 dark:text-slate-600 mt-2">
          Consultas em tempo real · Reatribuição de visitas por linguagem natural (admin/coordenador)
        </p>
      </div>
    </div>
  );
}
