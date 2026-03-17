"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  Images,
  Star,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

type Severidade = "alta" | "media" | "baixa";
type TipoAlerta = "intervalo_suspeito" | "foto_duplicada" | "pontuacao_perfeita";

interface Alerta {
  tipo: TipoAlerta;
  severidade: Severidade;
  descricao: string;
  visita_id: number;
  visita_id_b?: number;
  analista_id: number | null;
  analista_nome: string;
  detalhe: Record<string, unknown>;
}

interface FraudeResult {
  total: number;
  alertas: Alerta[];
}

interface Estudo { id: number; nome: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const SEV_STYLES: Record<Severidade, { bg: string; text: string; bar: string; label: string }> = {
  alta:  { bg: "bg-red-50 dark:bg-red-900/20",    text: "text-red-700 dark:text-red-400",    bar: "bg-red-500",    label: "Alta" },
  media: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", bar: "bg-amber-400",  label: "Média" },
  baixa: { bg: "bg-blue-50 dark:bg-blue-900/20",   text: "text-blue-700 dark:text-blue-400",   bar: "bg-blue-400",   label: "Baixa" },
};

const TIPO_META: Record<TipoAlerta, { label: string; icon: React.ElementType }> = {
  intervalo_suspeito: { label: "Intervalo suspeito",  icon: Clock },
  foto_duplicada:     { label: "Foto duplicada",      icon: Images },
  pontuacao_perfeita: { label: "Pontuação perfeita",  icon: Star },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FraudePage() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [estudos, setEstudos] = useState<Estudo[]>([]);
  const [selectedEstudo, setSelectedEstudo] = useState<string>("");
  const [threshold, setThreshold] = useState(30);
  const [result, setResult] = useState<FraudeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [filterTipo, setFilterTipo] = useState<TipoAlerta | "">("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    api.get<Estudo[]>("/estudos/").then(setEstudos).catch(() => {});
  }, [router]);

  async function runScan() {
    setLoading(true);
    setResult(null);
    setExpandedIdx(null);
    try {
      const params = new URLSearchParams({ min_intervalo_minutos: String(threshold) });
      if (selectedEstudo) params.set("estudo_id", selectedEstudo);
      const data = await api.get<FraudeResult>(`/visitas/fraude?${params}`);
      setResult(data);
      if (data.total === 0) toast.success(t("fraude.noAnomalies"));
      else toast.warning(`${data.total} alerta${data.total !== 1 ? "s" : ""} encontrado${data.total !== 1 ? "s" : ""}`);
    } catch (e: unknown) {
      toast.error("Erro ao executar análise", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const alertas = result?.alertas.filter(a => !filterTipo || a.tipo === filterTipo) ?? [];
  const counts = result ? {
    alta:  result.alertas.filter(a => a.severidade === "alta").length,
    media: result.alertas.filter(a => a.severidade === "media").length,
    baixa: result.alertas.filter(a => a.severidade === "baixa").length,
  } : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="p-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl">
          <ShieldAlert className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("fraude.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Análise heurística de padrões anómalos em visitas
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Estudo</label>
          <select
            value={selectedEstudo}
            onChange={e => setSelectedEstudo(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">{t("fraude.allStudies")}</option>
            {estudos.map(e => <option key={e.id} value={String(e.id)}>{e.nome}</option>)}
          </select>
        </div>
        <div className="w-48">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Intervalo mínimo (min)
          </label>
          <input
            type="number" min={5} max={120} value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <button
          onClick={runScan}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all active:scale-95 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "A analisar…" : "Executar análise"}
        </button>
      </div>

      {/* Summary cards */}
      {counts && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {(["alta", "media", "baixa"] as Severidade[]).map(sev => {
            const s = SEV_STYLES[sev];
            return (
              <div key={sev} className={`rounded-xl p-3 border ${s.bg} border-transparent`}>
                <p className={`text-xl font-bold ${s.text}`}>{counts[sev]}</p>
                <p className={`text-xs font-medium ${s.text} opacity-80`}>{s.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Type filter */}
      {result && result.total > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {(["", "intervalo_suspeito", "foto_duplicada", "pontuacao_perfeita"] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterTipo(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterTipo === t
                  ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
              }`}
            >
              {t === "" ? "Todos" : TIPO_META[t].label}
            </button>
          ))}
        </div>
      )}

      {/* No result yet */}
      {!result && !loading && (
        <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
          <ShieldAlert className="w-10 h-10" />
          <p className="text-sm">{t("fraude.runAnalysis")}</p>
        </div>
      )}

      {/* Empty state */}
      {result && result.total === 0 && (
        <div className="flex flex-col items-center gap-3 py-14 text-emerald-600 dark:text-emerald-400">
          <ShieldAlert className="w-10 h-10" />
          <p className="text-sm font-medium">{t("fraude.noAnomalies")}</p>
        </div>
      )}

      {/* Alerts list */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((alerta, idx) => {
            const s = SEV_STYLES[alerta.severidade];
            const meta = TIPO_META[alerta.tipo];
            const Icon = meta.icon;
            const expanded = expandedIdx === idx;
            return (
              <div key={idx} className={`rounded-2xl border overflow-hidden ${s.bg} border-transparent`}>
                <button
                  onClick={() => setExpandedIdx(expanded ? null : idx)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <div className={`w-1 self-stretch rounded-full ${s.bar} shrink-0`} />
                  <Icon className={`w-4 h-4 shrink-0 ${s.text}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${s.text}`}>{alerta.descricao}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {meta.label} · {alerta.analista_nome}
                      {alerta.visita_id && <> · Visita #{alerta.visita_id}</>}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${s.text} border border-current/20`}>
                    {s.label}
                  </span>
                  {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                </button>
                {expanded && (
                  <div className="px-5 pb-4 border-t border-black/5 pt-3">
                    <pre className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-black/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(alerta.detalhe, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
