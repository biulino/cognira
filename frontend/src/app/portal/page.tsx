"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  AlertCircle,
  Map,
  FileText,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────
interface EstudoSummary {
  id: number;
  nome: string;
  estado: string;
  total_visitas: number;
  pontuacao_media: number | null;
  por_estado: Record<string, number>;
}

interface TrendPoint {
  dia: string;
  total: number;
  media_pontuacao: number | null;
}

// ── Score badge ───────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-400 text-sm">—</span>;
  const cls =
    score >= 80
      ? "bg-emerald-100 text-emerald-700"
      : score >= 60
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-600";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-sm font-semibold ${cls}`}>
      {score.toFixed(1)}%
    </span>
  );
}

// ── Estado counts ─────────────────────────────────────────────────────────────
function EstadoBar({ por_estado }: { por_estado: Record<string, number> }) {
  const total = Object.values(por_estado).reduce((a, b) => a + b, 0) || 1;
  const Map2: [string, string, string][] = [
    ["fechada", "bg-emerald-500", "Concluídas"],
    ["validada", "bg-blue-500", "Validadas"],
    ["inserida", "bg-yellow-400", "Inseridas"],
    ["em_curso", "bg-indigo-400", "Em curso"],
    ["corrigir", "bg-orange-400", "Correcção"],
    ["anulada", "bg-red-400", "Anuladas"],
  ];
  return (
    <div className="w-full h-2 rounded-full overflow-hidden flex mt-2 bg-slate-100">
      {Map2.map(([estado, color]) => {
        const pct = ((por_estado[estado] ?? 0) / total) * 100;
        if (!pct) return null;
        return (
          <div
            key={estado}
            className={`h-full ${color}`}
            style={{ width: `${pct}%` }}
            title={`${estado}: ${por_estado[estado]}`}
          />
        );
      })}
    </div>
  );
}

// ── AI Resumo inline ──────────────────────────────────────────────────────────
function AiResumo({ estudoId }: { estudoId: number }) {
  const [resumo, setResumo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchResumo = async () => {
    setLoading(true);
    try {
      const r = await api.get<{ resumo: string }>(`/portal/resumo-ia/${estudoId}`);
      setResumo(r.resumo);
    } catch {
      setResumo("Não foi possível gerar o resumo. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3">
      {!resumo ? (
        <button
          onClick={fetchResumo}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-800 disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {loading ? "A gerar resumo IA..." : "Resumo IA"}
        </button>
      ) : (
        <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900 rounded-xl p-3 mt-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-xs font-semibold text-violet-700 dark:text-violet-400">Resumo IA</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{resumo}</p>
          <button
            onClick={() => setResumo(null)}
            className="text-xs text-slate-400 hover:text-slate-600 mt-2"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Trend chart for one study ─────────────────────────────────────────────────
function StudyTrend({ estudoId }: { estudoId: number }) {
  const [data, setData] = useState<TrendPoint[]>([]);

  useEffect(() => {
    api
      .get<TrendPoint[]>(`/portal/tendencias/${estudoId}?days=30`)
      .then(setData)
      .catch(() => {});
  }, [estudoId]);

  if (!data.length) return null;

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
        <TrendingUp className="w-3 h-3" /> Tendência (30 dias)
      </p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="dia"
            tick={{ fontSize: 9 }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis yAxisId="left" tick={{ fontSize: 9 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} domain={[0, 100]} />
          <Tooltip
            contentStyle={{ fontSize: 11 }}
            labelFormatter={(l: string) => `Dia ${l.slice(5)}`}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="total"
            name="Visitas"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="media_pontuacao"
            name="Pontuação"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PortalPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [estudos, setEstudos] = useState<EstudoSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ estudos: EstudoSummary[] }>("/portal/dashboard")
      .then((d) => setEstudos(d.estudos))
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!estudos.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-500">
        <BarChart3 className="w-12 h-12 opacity-30" />
        <p>{t("portal.noStudies")}</p>
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Portal do Cliente
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Acompanhe o estado dos seus estudos de mystery shopping em tempo real.
        </p>
      </div>

      <div className="grid gap-5">
        {estudos.map((est) => (
          <div
            key={est.id}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5 space-y-1"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">{est.nome}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {est.estado === "activo" ? "Em curso" : est.estado}
                </p>
              </div>
              <ScoreBadge score={est.pontuacao_media} />
            </div>

            {/* KPI row */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
              <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold text-slate-900 dark:text-white">
                  {est.total_visitas}
                </span>{" "}
                visitas
              </div>
              <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-slate-900 dark:text-white">
                  {est.por_estado.fechada ?? 0}
                </span>{" "}
                concluídas
              </div>
              {(est.por_estado.corrigir ?? 0) > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-orange-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-semibold">{est.por_estado.corrigir}</span> em correcção
                </div>
              )}
            </div>

            {/* Progress bar */}
            <EstadoBar por_estado={est.por_estado} />

            {/* AI Summary */}
            <AiResumo estudoId={est.id} />

            {/* Trend chart */}
            <StudyTrend estudoId={est.id} />

            {/* Actions */}
            <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-700 mt-3">
              <Link
                href={`/portal/mapa?estudo=${est.id}`}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                <Map className="w-3.5 h-3.5" />
                Mapa
              </Link>
              <Link
                href={`/relatorios?estudo=${est.id}`}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                <FileText className="w-3.5 h-3.5" />
                Relatórios
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Map link — below all study cards */}
      <div className="pt-2">
        <Link
          href="/portal/mapa"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-sm font-medium transition-colors border border-indigo-100"
        >
          <Map className="w-4 h-4" />
          Ver Mapa de Estabelecimentos
        </Link>
      </div>
    </main>
  );
}
