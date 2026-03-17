"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
  RefreshCw,
  FileText,
  Download,
  User,
  Calendar,
  Hash,
} from "lucide-react";
import { api } from "@/lib/api";
import wsClient from "@/lib/ws";
import { useI18n } from "@/lib/i18n";

interface ChamadaDetail {
  id: number;
  cliente_id: number;
  estudo_id: number | null;
  template_id: number | null;
  nome_ficheiro: string;
  tamanho: number | null;
  mime_type: string | null;
  estado: string;
  erro_mensagem: string | null;
  score_global: number | null;
  referencia_externa: string | null;
  agente_nome: string | null;
  data_chamada: string | null;
  criado_em: string;
  transcricao: string | null;
  dados_extraidos: Record<string, unknown> | null;
  relatorio: string | null;
}

const ESTADO_COLORS: Record<string, string> = {
  pendente: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  transcrevendo: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  a_analisar: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  concluido: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  erro: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const ESTADO_LABELS: Record<string, string> = {
  pendente: "Pendente",
  transcrevendo: "A Transcrever",
  a_analisar: "A Analisar",
  concluido: "Concluído",
  erro: "Erro",
};

const IN_PROGRESS = ["pendente", "transcrevendo", "a_analisar"];

type Tab = "transcricao" | "dados" | "relatorio";

// ── Minimal markdown renderer ─────────────────────────────────────────────────
function MdLine({ line }: { line: string }) {
  const trimmed = line.trim();
  if (!trimmed) return <div className="h-3" />;
  if (trimmed.startsWith("## ")) {
    return <h3 className="text-base font-bold text-slate-800 dark:text-white mt-4 mb-1">{trimmed.slice(3)}</h3>;
  }
  if (trimmed.startsWith("# ")) {
    return <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-5 mb-1">{trimmed.slice(2)}</h2>;
  }
  if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
    return (
      <div className="flex gap-2 text-sm text-slate-700 dark:text-slate-300 ml-3">
        <span className="mt-1 text-indigo-500 shrink-0">•</span>
        <span>{trimmed.slice(2)}</span>
      </div>
    );
  }
  // Bold inline: **text** → bold
  const parts = trimmed.split(/\*\*(.+?)\*\*/g);
  return (
    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
      {parts.map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p)}
    </p>
  );
}

function MarkdownView({ text }: { text: string }) {
  return (
    <div className="space-y-0.5">
      {text.split("\n").map((line, i) => <MdLine key={i} line={line} />)}
    </div>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-yellow-400" : "bg-red-400";
  const textColor = score >= 80 ? "text-emerald-700 dark:text-emerald-400" : score >= 60 ? "text-yellow-700 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-lg font-bold ${textColor}`}>{score.toFixed(1)}%</span>
    </div>
  );
}

function fmtBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ChamadaDetailPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [chamada, setChamada] = useState<ChamadaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("transcricao");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get<ChamadaDetail>(`/callcenter/${id}`);
      setChamada(data);
      if (data.estado === "concluido" && !audioUrl) {
        try {
          const res = await api.get<{ url: string }>(`/callcenter/${id}/audio-url`);
          setAudioUrl(res.url);
        } catch { /* not critical */ }
      }
    } catch {
      setError("Chamada não encontrada ou sem permissão de acesso.");
    } finally {
      setLoading(false);
    }
  }, [id, audioUrl]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Auto-refresh while pipeline is running (fallback; WS handles the fast path)
  useEffect(() => {
    if (!chamada || !IN_PROGRESS.includes(chamada.estado)) return;
    const t = setInterval(() => load(), 4000);
    return () => clearInterval(t);
  }, [chamada, load]);

  // WebSocket: reload immediately when pipeline finishes
  useEffect(() => {
    const off = wsClient.on("callcenter_concluido", (data) => {
      if ((data.chamada_id as number) === Number(id)) load();
    });
    return off;
  }, [id, load]);

  async function handleAction(action: "reprocessar" | "retranscrever") {
    setActionLoading(action);
    setActionMsg("");
    try {
      const res = await api.post<{ detail: string }>(`/callcenter/${id}/${action}`);
      setActionMsg(res.detail);
      await load();
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : "Erro");
    } finally {
      setActionLoading(null);
    }
  }

  function downloadPdf() {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const url = `${process.env.NEXT_PUBLIC_API_URL || "/api"}/callcenter/${id}/relatorio/pdf`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_chamada_${id}.pdf`;
    // Attach auth via query param workaround (presigned isn't possible for PDF)
    // The actual solution: open in new tab with auth header via XHR
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.blob())
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {});
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !chamada) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5" />
          {error || "Chamada não encontrada"}
        </div>
      </div>
    );
  }

  const isRunning = IN_PROGRESS.includes(chamada.estado);
  const isDone = chamada.estado === "concluido";
  const isError = chamada.estado === "erro";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Back + title */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/callcenter")}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Phone className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Chamada #{chamada.id}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-xs">
              {chamada.nome_ficheiro}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {isRunning && (
            <span className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              A processar…
            </span>
          )}
          {(isDone || isError) && (
            <>
              <button
                onClick={() => handleAction("reprocessar")}
                disabled={!!actionLoading}
                title="Re-analisa com GPT sem repetir a transcrição (mais barato)"
                className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 rounded-lg transition-colors disabled:opacity-50"
              >
                {actionLoading === "reprocessar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Reprocessar
              </button>
              <button
                onClick={() => handleAction("retranscrever")}
                disabled={!!actionLoading}
                title="Retranscreve o áudio do início (gasta crédito Whisper)"
                className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 rounded-lg transition-colors disabled:opacity-50"
              >
                {actionLoading === "retranscrever" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Retranscrever
              </button>
            </>
          )}
          {isDone && (
            <button
              onClick={downloadPdf}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
          )}
        </div>
      </div>

      {actionMsg && (
        <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm text-indigo-700 dark:text-indigo-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {actionMsg}
        </div>
      )}

      {/* Meta cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <Hash className="w-3 h-3" /> Referência
          </div>
          <div className="text-sm font-semibold text-slate-800 dark:text-white">
            {chamada.referencia_externa || "—"}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <User className="w-3 h-3" /> Agente
          </div>
          <div className="text-sm font-semibold text-slate-800 dark:text-white">
            {chamada.agente_nome || "—"}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <Calendar className="w-3 h-3" /> Data chamada
          </div>
          <div className="text-sm font-semibold text-slate-800 dark:text-white">
            {chamada.data_chamada
              ? new Date(chamada.data_chamada).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })
              : "—"}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            Estado
          </div>
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[chamada.estado] ?? ""}`}>
            {isRunning && <Loader2 className="w-3 h-3 animate-spin" />}
            {chamada.estado === "concluido" && <CheckCircle2 className="w-3 h-3" />}
            {chamada.estado === "erro" && <AlertCircle className="w-3 h-3" />}
            {chamada.estado === "pendente" && <Clock className="w-3 h-3" />}
            {ESTADO_LABELS[chamada.estado] ?? chamada.estado}
          </span>
        </div>
      </div>

      {/* Score */}
      {chamada.score_global != null && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Score Global de Atendimento
          </div>
          <ScoreBar score={chamada.score_global} />
        </div>
      )}

      {/* Error */}
      {isError && chamada.erro_mensagem && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold mb-0.5">Erro no processamento</div>
            {chamada.erro_mensagem}
          </div>
        </div>
      )}

      {/* Audio player */}
      {audioUrl && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Áudio • {chamada.tamanho ? fmtBytes(chamada.tamanho) : ""}
          </div>
          <audio
            controls
            className="w-full"
            src={audioUrl}
          >
            O teu browser não suporta playback de áudio.
          </audio>
        </div>
      )}

      {/* Pending/running placeholder */}
      {isRunning && !chamada.transcricao && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {chamada.estado === "transcrevendo"
              ? "A transcrever áudio com Whisper…"
              : "A analisar transcrição com IA…"}
          </p>
          <p className="text-xs text-slate-400 mt-1">Esta página actualiza automaticamente.</p>
        </div>
      )}

      {/* Tabs */}
      {(chamada.transcricao || chamada.dados_extraidos || chamada.relatorio) && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            {([
              { key: "transcricao", label: "Transcrição", show: !!chamada.transcricao },
              { key: "dados", label: "Dados Extraídos", show: !!chamada.dados_extraidos },
              { key: "relatorio", label: "Relatório", show: !!chamada.relatorio },
            ] as const).filter(t => t.show).map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === t.key
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">
            {activeTab === "transcricao" && chamada.transcricao && (
              <div className="max-h-96 overflow-y-auto rounded-lg bg-slate-50 dark:bg-slate-900/40 p-4">
                <pre className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {chamada.transcricao}
                </pre>
              </div>
            )}

            {activeTab === "dados" && chamada.dados_extraidos && (
              <div className="space-y-2">
                {Object.entries(chamada.dados_extraidos)
                  .filter(([k]) => !k.startsWith("_"))
                  .map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg"
                    >
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
                        {k.replace(/_/g, " ")}
                      </span>
                      <span className="text-sm text-slate-800 dark:text-white font-semibold">
                        {typeof v === "boolean"
                          ? (v ? "✓ Sim" : "✗ Não")
                          : String(v)}
                      </span>
                    </div>
                  ))}
                {!!chamada.dados_extraidos["_erro_extracao"] && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-300">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Erro parcial na extracção: {String(chamada.dados_extraidos["_erro_extracao"])}
                  </div>
                )}
              </div>
            )}

            {activeTab === "relatorio" && chamada.relatorio && (
              <div className="max-h-[600px] overflow-y-auto">
                <MarkdownView text={chamada.relatorio} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
