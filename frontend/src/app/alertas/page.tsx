"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, AlertTriangle, RefreshCw, CheckCircle, Settings2, Loader2, Sparkles, X, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface AlertaScore {
  estabelecimento_id: number;
  estabelecimento: string;
  avg_score: number;
  threshold: number;
  delta: number;
  total_visitas: number;
  severity: "critico" | "alto" | "medio";
}

interface AlertasReport {
  threshold: number;
  total: number;
  alertas: AlertaScore[];
}

interface AlertaConfig {
  threshold: number;
  chave: string;
}

interface AcaoItem {
  acao: string;
  responsavel: string;
  prazo_dias: number;
}

interface PlanoIA {
  problema_principal?: string;
  causas_previstas?: string[];
  prioridade?: string;
  acoes_imediatas?: AcaoItem[];
  acoes_medio_prazo?: AcaoItem[];
  kpis_acompanhamento?: string[];
  impacto_estimado?: string;
  mensagem_gestor?: string;
  metricas?: Record<string, unknown>;
}

const SEVERITY_STYLE: Record<string, string> = {
  critico: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  alto: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medio: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const SEVERITY_LABEL: Record<string, string> = {
  critico: "Crítico",
  alto: "Alto",
  medio: "Médio",
};

const PRIORIDADE_STYLE: Record<string, string> = {
  critica: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  alta: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  media: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function AlertasPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [report, setReport] = useState<AlertasReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Config editing
  const [config, setConfig] = useState<AlertaConfig | null>(null);
  const [editThreshold, setEditThreshold] = useState<number>(70);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // Study filter
  const [estudoId, setEstudoId] = useState<number | "">("");
  const [estudos, setEstudos] = useState<{ id: number; nome: string }[]>([]);

  // AI Corrective Action modal
  const [planoModal, setPlanoModal] = useState<{ alerta: AlertaScore; plano: PlanoIA | null } | null>(null);
  const [loadingPlano, setLoadingPlano] = useState<number | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<AlertasReport>(
        "/alertas/score" + (estudoId ? `?estudo_id=${estudoId}` : "")
      );
      setReport(data);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Erro ao carregar alertas");
    } finally {
      setLoading(false);
    }
  }, [estudoId]);

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await api.get<AlertaConfig>("/alertas/config");
      setConfig(cfg);
      setEditThreshold(cfg.threshold);
    } catch {
      // non-admin users may not see this — silently ignore
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    api.get<{ id: number; nome: string }[]>("/estudos/").then(setEstudos).catch(() => {});
    loadConfig();
    loadReport();
  }, [router, loadReport, loadConfig]);

  const handleSaveConfig = useCallback(async () => {
    setSavingConfig(true);
    setConfigMsg(null);
    try {
      await api.put("/alertas/config", { threshold: editThreshold });
      setConfigMsg("Configuração guardada.");
      await loadConfig();
      await loadReport();
    } catch (e: unknown) {
      setConfigMsg("Erro: " + ((e as Error).message ?? "desconhecido"));
    } finally {
      setSavingConfig(false);
    }
  }, [editThreshold, loadConfig, loadReport]);

  const handlePlanoIA = useCallback(async (alerta: AlertaScore) => {
    setLoadingPlano(alerta.estabelecimento_id);
    setPlanoModal({ alerta, plano: null });
    try {
      const url = `/alertas/${alerta.estabelecimento_id}/acao-corretiva` +
        (estudoId ? `?estudo_id=${estudoId}` : "");
      const plano = await api.post<PlanoIA>(url, {});
      setPlanoModal({ alerta, plano });
    } catch (e: unknown) {
      setPlanoModal({ alerta, plano: { problema_principal: "Erro ao gerar plano: " + ((e as Error).message ?? "desconhecido") } });
    } finally {
      setLoadingPlano(null);
    }
  }, [estudoId]);

  const criticos = report?.alertas.filter((a) => a.severity === "critico").length ?? 0;
  const altos = report?.alertas.filter((a) => a.severity === "alto").length ?? 0;
  const medios = report?.alertas.filter((a) => a.severity === "medio").length ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Bell className="w-8 h-8 text-brand" />
            Alertas de Score
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Estabelecimentos abaixo do threshold de qualidade configurado
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50"
          >
            <Settings2 size={14} />
            Configurar
          </button>
          <button
            onClick={loadReport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Config panel */}
      {showConfig && (
        <div className="mb-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <Settings2 size={14} />
            Configuração de alertas
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                Threshold global (0–100)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={editThreshold}
                  onChange={(e) => setEditThreshold(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-10 text-sm font-bold text-slate-900 dark:text-white text-right">
                  {editThreshold}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Estabelecimentos com score médio abaixo de <strong>{editThreshold}</strong> aparecem como alerta.
              </p>
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-60"
            >
              {savingConfig ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Guardar
            </button>
          </div>
          {configMsg && (
            <p className={`text-xs mt-2 ${configMsg.startsWith("Erro") ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
              {configMsg}
            </p>
          )}
        </div>
      )}

      {/* Study filter */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">{t("alertas.filterStudy")}</label>
        <select
          value={estudoId}
          onChange={(e) => setEstudoId(e.target.value ? Number(e.target.value) : "")}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
        >
          <option value="">{t("common.all")}</option>
          {estudos.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
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
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-card">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total alertas</p>
              <p className={`text-2xl font-bold ${report.total > 0 ? "text-red-500" : "text-slate-300 dark:text-slate-600"}`}>
                {report.total}
              </p>
              <p className="text-xs text-slate-400 mt-1">threshold: {report.threshold}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-card">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t("alertas.critical")}</p>
              <p className={`text-2xl font-bold ${criticos > 0 ? "text-red-600" : "text-slate-300 dark:text-slate-600"}`}>
                {criticos}
              </p>
              <p className="text-xs text-slate-400 mt-1">&lt; {Math.round(report.threshold * 0.75)}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-card">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t("alertas.high")}</p>
              <p className={`text-2xl font-bold ${altos > 0 ? "text-orange-500" : "text-slate-300 dark:text-slate-600"}`}>
                {altos}
              </p>
              <p className="text-xs text-slate-400 mt-1">&lt; {Math.round(report.threshold * 0.90)}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-card">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Médios</p>
              <p className={`text-2xl font-bold ${medios > 0 ? "text-amber-500" : "text-slate-300 dark:text-slate-600"}`}>
                {medios}
              </p>
              <p className="text-xs text-slate-400 mt-1">abaixo do limite</p>
            </div>
          </div>

          {/* No alerts */}
          {report.total === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <CheckCircle className="w-12 h-12 text-green-400" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Todos os estabelecimentos estão acima do threshold ({report.threshold}).
              </p>
            </div>
          )}

          {/* Alerts table */}
          {report.total > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Estabelecimento
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Score médio
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Delta
                      </th>
                      <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Severidade
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Visitas
                      </th>
                      <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        IA
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {report.alertas.map((a) => (
                      <tr key={a.estabelecimento_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <AlertTriangle
                            size={13}
                            className={
                              a.severity === "critico"
                                ? "text-red-500"
                                : a.severity === "alto"
                                ? "text-orange-500"
                                : "text-amber-500"
                            }
                          />
                          {a.estabelecimento}
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-slate-800 dark:text-slate-200">
                          {a.avg_score}
                        </td>
                        <td className="px-5 py-3 text-right text-red-500 font-semibold">
                          {a.delta.toFixed(1)}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEVERITY_STYLE[a.severity]}`}>
                            {SEVERITY_LABEL[a.severity]}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-slate-500 dark:text-slate-400">
                          {a.total_visitas}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            onClick={() => handlePlanoIA(a)}
                            disabled={loadingPlano === a.estabelecimento_id}
                            title="Gerar Plano de Acção IA"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/50 disabled:opacity-50 transition-colors"
                          >
                            {loadingPlano === a.estabelecimento_id
                              ? <Loader2 size={11} className="animate-spin" />
                              : <Sparkles size={11} />}
                            Plano IA
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Corrective Action Modal */}
      {planoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={16} className="text-violet-500" />
                  <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">{t("alertas.aiPlan")}</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {planoModal.alerta.estabelecimento}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Score: <strong>{planoModal.alerta.avg_score}</strong> · Threshold: {planoModal.alerta.threshold} · Delta: {planoModal.alerta.delta.toFixed(1)}
                </p>
              </div>
              <button
                onClick={() => setPlanoModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {(!planoModal.plano || loadingPlano === planoModal.alerta.estabelecimento_id) && (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
                  <p className="text-sm text-slate-500">{t("alertas.generating")}</p>
                </div>
              )}

              {planoModal.plano && (
                <>
                  {/* Problema + prioridade */}
                  {planoModal.plano.problema_principal && (
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl p-4">
                      <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">Problema principal</p>
                      <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{planoModal.plano.problema_principal}</p>
                      {planoModal.plano.prioridade && (
                        <span className={`mt-2 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORIDADE_STYLE[planoModal.plano.prioridade] ?? "bg-slate-100 text-slate-600"}`}>
                          Prioridade: {planoModal.plano.prioridade}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Causas */}
                  {planoModal.plano.causas_previstas && planoModal.plano.causas_previstas.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Causas previstas</p>
                      <ul className="space-y-1">
                        {planoModal.plano.causas_previstas.map((c, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                            <ChevronRight size={14} className="mt-0.5 text-violet-400 flex-shrink-0" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Acções imediatas */}
                  {planoModal.plano.acoes_imediatas && planoModal.plano.acoes_imediatas.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">{t("alertas.immediateActions")}</p>
                      <div className="space-y-2">
                        {planoModal.plano.acoes_imediatas.map((a, i) => (
                          <div key={i} className="bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-lg p-3">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{a.acao}</p>
                            <div className="flex gap-3 mt-1">
                              <span className="text-xs text-orange-600 dark:text-orange-400">👤 {a.responsavel}</span>
                              <span className="text-xs text-orange-600 dark:text-orange-400">⏱ {a.prazo_dias}d</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Acções médio prazo */}
                  {planoModal.plano.acoes_medio_prazo && planoModal.plano.acoes_medio_prazo.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Acções médio prazo</p>
                      <div className="space-y-2">
                        {planoModal.plano.acoes_medio_prazo.map((a, i) => (
                          <div key={i} className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-lg p-3">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{a.acao}</p>
                            <div className="flex gap-3 mt-1">
                              <span className="text-xs text-blue-600 dark:text-blue-400">👤 {a.responsavel}</span>
                              <span className="text-xs text-blue-600 dark:text-blue-400">⏱ {a.prazo_dias}d</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* KPIs */}
                  {planoModal.plano.kpis_acompanhamento && planoModal.plano.kpis_acompanhamento.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">{t("alertas.kpis")}</p>
                      <div className="flex flex-wrap gap-2">
                        {planoModal.plano.kpis_acompanhamento.map((k, i) => (
                          <span key={i} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Impacto */}
                  {planoModal.plano.impacto_estimado && (
                    <div className="bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 rounded-xl p-4">
                      <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">Impacto estimado</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{planoModal.plano.impacto_estimado}</p>
                    </div>
                  )}

                  {/* Mensagem gestor */}
                  {planoModal.plano.mensagem_gestor && (
                    <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 rounded-xl p-4">
                      <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-1">Mensagem para o gestor</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 italic">&ldquo;{planoModal.plano.mensagem_gestor}&rdquo;</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setPlanoModal(null)}
                className="px-4 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

