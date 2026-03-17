"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  ClipboardCheck,
  Clock,
  Star,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BenchmarkRow {
  estudo_id: number | null;
  nome: string;
  estado: string;
  total_visitas: number;
  avg_pontuacao: number | null;
  taxa_aprovacao: number | null;
  duracao_media_min: number | null;
  num_analistas: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ScoreBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-300 text-xs">—</span>;
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 w-10 text-right">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function Trend({ value, benchmark }: { value: number | null; benchmark: number }) {
  if (value === null) return <Minus className="w-3.5 h-3.5 text-slate-300" />;
  if (value > benchmark + 5) return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
  if (value < benchmark - 5) return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-slate-400" />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BenchmarkingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    api.get<BenchmarkRow[]>("/estudos/benchmarking")
      .then(setRows)
      .catch((e: Error) => toast.error("Erro ao carregar benchmarking", e.message))
      .finally(() => setLoading(false));
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  // Global averages for comparison
  const withScore = rows.filter(r => r.avg_pontuacao !== null);
  const globalAvgScore = withScore.length
    ? withScore.reduce((s, r) => s + r.avg_pontuacao!, 0) / withScore.length
    : 0;
  const globalAvgAprov = rows.filter(r => r.taxa_aprovacao !== null).reduce((s, r) => s + r.taxa_aprovacao!, 0)
    / Math.max(1, rows.filter(r => r.taxa_aprovacao !== null).length);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("benchmarking.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Comparação de KPIs entre estudos
          </p>
        </div>
      </div>

      {/* Global stats */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Estudos", value: String(rows.length), icon: BarChart3, color: "text-indigo-600" },
            { label: t("benchmarking.avgScore"), value: globalAvgScore ? globalAvgScore.toFixed(1) : "—", icon: Star, color: "text-amber-500" },
            { label: "Taxa aprovação", value: globalAvgAprov ? `${globalAvgAprov.toFixed(1)}%` : "—", icon: ClipboardCheck, color: "text-emerald-600" },
            { label: "Total visitas", value: rows.reduce((s, r) => s + r.total_visitas, 0).toLocaleString("pt-PT"), icon: ClipboardCheck, color: "text-blue-600" },
          ].map(stat => (
            <div key={stat.label} className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
              <stat.icon className={`w-5 h-5 mb-2 ${stat.color}`} />
              <p className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estudo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Visitas</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[140px]">{t("benchmarking.avgScore")}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">{t("benchmarking.approvalRate")}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">{t("benchmarking.avgDuration")}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <Users className="w-3.5 h-3.5 inline" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">{t("benchmarking.vsAvg")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100 max-w-[180px]">
                      <span className="truncate block">{row.nome}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        row.estado === "activo" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                        "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                      }`}>
                        {row.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{row.total_visitas.toLocaleString("pt-PT")}</td>
                    <td className="px-4 py-3 min-w-[140px]"><ScoreBar value={row.avg_pontuacao} /></td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {row.taxa_aprovacao !== null ? `${row.taxa_aprovacao.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 text-xs">
                      {row.duracao_media_min !== null ? `${row.duracao_media_min.toFixed(0)} min` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{row.num_analistas}</td>
                    <td className="px-4 py-3 text-center">
                      <Trend value={row.avg_pontuacao} benchmark={globalAvgScore} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-14 text-slate-400">
              <BarChart3 className="w-8 h-8" />
              <p className="text-sm">{t("benchmarking.noData")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
