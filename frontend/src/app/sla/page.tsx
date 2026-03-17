"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Clock, AlertTriangle, RefreshCw, CheckCircle, Loader2, Settings2 } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface SlaAlert {
  visita_id: number;
  estado: string;
  days_elapsed: number;
  threshold_days: number;
  estabelecimento: string;
  estabelecimento_id: number;
  analista_nome: string | null;
  analista_id: number | null;
  estudo_id: number;
  ref_data: string;
}

interface SlaReport {
  total_alerts: number;
  thresholds: Record<string, number>;
  summary: Record<string, number>;
  alerts: SlaAlert[];
}

interface ClienteSla {
  id: number;
  nome: string;
  sla_visita_dias: number;
  sla_validacao_dias: number;
}

const ESTADO_COLORS: Record<string, string> = {
  planeada: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  inserida: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  corrigir: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  corrigir_email: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

function severityColor(days: number, threshold: number) {
  const ratio = days / threshold;
  if (ratio >= 3) return "text-red-600 dark:text-red-400 font-bold";
  if (ratio >= 2) return "text-orange-500 dark:text-orange-400 font-semibold";
  return "text-amber-500 dark:text-amber-400";
}

export default function SlaPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [report, setReport] = useState<SlaReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<ClienteSla[]>([]);
  const [showSlaConfig, setShowSlaConfig] = useState(false);
  const [savingClient, setSavingClient] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<number, { visita: string; validacao: string }>>({}); // clienteId -> values

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<SlaReport>("/visitas/sla");
      setReport(data);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Erro ao carregar SLA");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadClientes = useCallback(async () => {
    try {
      const data = await api.get<ClienteSla[]>("/clientes/?page_size=200");
      setClientes(data);
      const init: Record<number, { visita: string; validacao: string }> = {};
      for (const c of data) {
        init[c.id] = { visita: String(c.sla_visita_dias ?? 3), validacao: String(c.sla_validacao_dias ?? 2) };
      }
      setEditValues(init);
    } catch { /* non-admin may not have access */ }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    load();
    loadClientes();
  }, [load, loadClientes, router]);

  const STATES_ORDER = ["planeada", "inserida", "corrigir", "corrigir_email"];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Clock className="w-8 h-8 text-brand" />
            SLA Monitor
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Visitas em atraso face aos limites operacionais configurados
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {loading && !report && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STATES_ORDER.map((s) => (
              <div key={s} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-card">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 capitalize">{s.replace("_", " ")}</p>
                <p className={`text-2xl font-bold ${report.summary[s] > 0 ? "text-red-500" : "text-slate-300 dark:text-slate-600"}`}>
                  {report.summary[s] ?? 0}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  limite: {report.thresholds[s]}d
                </p>
              </div>
            ))}
          </div>

          {/* No alerts */}
          {report.total_alerts === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900">
              <CheckCircle className="w-12 h-12 text-emerald-500 mb-3" />
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">{t("sla.allOnTime")}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Nenhuma visita em atraso neste momento.
              </p>
            </div>
          )}

          {/* Alerts table */}
          {report.total_alerts > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-card overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {report.total_alerts} visita{report.total_alerts !== 1 ? "s" : ""} em atraso
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <th className="text-left text-xs font-semibold text-slate-500 py-3 px-4 uppercase">ID</th>
                      <th className="text-left text-xs font-semibold text-slate-500 py-3 px-4 uppercase">Estado</th>
                      <th className="text-left text-xs font-semibold text-slate-500 py-3 px-4 uppercase">Estabelecimento</th>
                      <th className="text-left text-xs font-semibold text-slate-500 py-3 px-4 uppercase">Analista</th>
                      <th className="text-right text-xs font-semibold text-slate-500 py-3 px-4 uppercase">{t("sla.daysLate")}</th>
                      <th className="text-right text-xs font-semibold text-slate-500 py-3 px-4 uppercase">Limite</th>
                      <th className="text-left text-xs font-semibold text-slate-500 py-3 px-4 uppercase">Desde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.alerts.map((a) => (
                      <tr
                        key={a.visita_id}
                        className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer"
                        onClick={() => router.push(`/visitas?id=${a.visita_id}`)}
                      >
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">#{a.visita_id}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLORS[a.estado] ?? "bg-slate-100 text-slate-600"}`}>
                            {a.estado.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-[180px] truncate">{a.estabelecimento}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-[140px] truncate">{a.analista_nome ?? "—"}</td>
                        <td className={`py-3 px-4 text-right ${severityColor(a.days_elapsed, a.threshold_days)}`}>
                          {a.days_elapsed}d
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-slate-400">{a.threshold_days}d</td>
                        <td className="py-3 px-4 text-xs text-slate-400">
                          {new Date(a.ref_data).toLocaleDateString("pt-PT")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Thresholds documentation + per-client config */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t("sla.slaLimits")}</p>
              {clientes.length > 0 && (
                <button
                  onClick={() => setShowSlaConfig(v => !v)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors"
                >
                  <Settings2 className="w-3 h-3" />
                  {showSlaConfig ? "Fechar" : "Configurar por cliente"}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-4">
              {Object.entries(report.thresholds).map(([s, d]) => (
                <div key={s} className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLORS[s] ?? "bg-slate-100 text-slate-600"}`}>
                    {s.replace("_", " ")}
                  </span>
                  <span className="text-xs text-slate-500">→ {d} dia{d !== 1 ? "s" : ""} (global)</span>
                </div>
              ))}
            </div>

            {/* Per-client SLA config */}
            {showSlaConfig && clientes.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-slate-500 mb-3">Configura thresholds contratuais por cliente. Quando definidos, sobrepõem os globais para visitas desse cliente.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {clientes.map(c => (
                    <div key={c.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                      <p className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate" title={c.nome}>{c.nome}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Visita (dias)</label>
                          <input
                            type="number" min={1} max={90}
                            value={editValues[c.id]?.visita ?? ""}
                            onChange={e => setEditValues(prev => ({ ...prev, [c.id]: { ...prev[c.id], visita: e.target.value } }))}
                            className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-sm bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">{t("sla.validationDays")}</label>
                          <input
                            type="number" min={1} max={90}
                            value={editValues[c.id]?.validacao ?? ""}
                            onChange={e => setEditValues(prev => ({ ...prev, [c.id]: { ...prev[c.id], validacao: e.target.value } }))}
                            className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-sm bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                          />
                        </div>
                      </div>
                      <button
                        disabled={savingClient === c.id}
                        onClick={async () => {
                          const vals = editValues[c.id];
                          if (!vals) return;
                          setSavingClient(c.id);
                          try {
                            await api.put(`/clientes/${c.id}/sla`, {
                              sla_visita_dias: parseInt(vals.visita) || 3,
                              sla_validacao_dias: parseInt(vals.validacao) || 2,
                            });
                            await loadClientes();
                            load();
                          } catch { /* ignore */ }
                          setSavingClient(null);
                        }}
                        className="w-full text-xs px-2 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {savingClient === c.id ? "A guardar…" : "Guardar"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
