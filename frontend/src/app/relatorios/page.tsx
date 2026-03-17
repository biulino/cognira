"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, Download, FileSpreadsheet, FileText,
  TrendingUp, ClipboardList, CreditCard, Loader2, Sparkles, ChevronDown,
  Cloud, ArrowUpDown, SmilePlus, Mail,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Estudo {
  id: number;
  nome: string;
  estado: string;
}

interface VisitaStats {
  total: number;
  por_estado: Record<string, number>;
  pontuacao_media: number;
}

interface Pagamento {
  id: number;
  analista_id: number;
  valor_total: number;
  estado: string;
}

interface AnalistaReport {
  analista_id: number;
  analista_nome: string;
  total_pagamentos: number;
  valor_total: number;
  valor_base: number;
  valor_despesas: number;
}

interface CriterioScore {
  criterio_id: number;
  label: string;
  tipo: string;
  peso: number | null;
  total_respostas: number;
  conformidade_pct: number | null;
  score_medio: number | null;
}

interface WordCloudItem { palavra: string; score: number; frequencia: number; }
interface WordCloudResult { palavras: WordCloudItem[]; total_respostas: number; estudo_id: number; }

interface ComparativoResult {
  resumo: string;
  tendencia: string;
  variacao_score: number | null;
  destaques: string[];
  recomendacoes: string[];
  periodo_atual: { inicio: string; fim: string; total_visitas: number; score_medio: number | null };
  periodo_anterior: { inicio: string; fim: string; total_visitas: number; score_medio: number | null };
}

interface SentimentoResult {
  sentimento_global: string;
  score: number;
  confianca: number;
  temas: string[];
  palavras_positivas: string[];
  palavras_negativas: string[];
  resumo: string;
}

// ── helper to compute relative font size for word cloud ──────────────────────
function wcFontSize(score: number, max: number) {
  const ratio = max > 0 ? score / max : 0;
  return 0.75 + ratio * 1.75; // 0.75rem – 2.5rem
}

function wcColor(score: number, max: number) {
  const ratio = max > 0 ? score / max : 0;
  if (ratio > 0.7) return "text-brand font-bold";
  if (ratio > 0.4) return "text-indigo-500 dark:text-indigo-400 font-semibold";
  if (ratio > 0.2) return "text-slate-600 dark:text-slate-300";
  return "text-slate-400 dark:text-slate-500";
}

export default function RelatoriosPage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const fmtLocale = ({ pt: "pt-PT", en: "en-GB", es: "es-ES", fr: "fr-FR" } as Record<string, string>)[locale] ?? "pt-PT";
  const [estudos, setEstudos] = useState<Estudo[]>([]);
  const [stats, setStats] = useState<VisitaStats | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [analistaReport, setAnalistaReport] = useState<AnalistaReport[]>([]);
  const [resumoIA, setResumoIA] = useState<Record<number, string>>({});
  const [loadingIA, setLoadingIA] = useState<number | null>(null);
  const [criterioEstudo, setCriterioEstudo] = useState<number | null>(null);
  const [criteriosData, setCriteriosData] = useState<CriterioScore[]>([]);
  const [loadingCriterios, setLoadingCriterios] = useState(false);
  const [userRole, setUserRole] = useState<string>("");

  // 8E — AI Analytics state
  const [wordClouds, setWordClouds] = useState<Record<number, WordCloudResult | null>>({});
  const [comparativos, setComparativos] = useState<Record<number, ComparativoResult | null>>({});
  const [sentimentos, setSentimentos] = useState<Record<number, SentimentoResult | null>>({});
  const [loadingAi, setLoadingAi] = useState<Record<string, boolean>>({});

  // 8F.3 — Email report state
  const [emailInputs, setEmailInputs] = useState<Record<number, string>>({});
  const [showEmailForm, setShowEmailForm] = useState<Record<number, boolean>>({});
  const [sendingEmail, setSendingEmail] = useState<number | null>(null);
  const [emailMsg, setEmailMsg] = useState<Record<number, string>>({});

  async function loadWordCloud(estudo_id: number) {
    const key = `wc-${estudo_id}`;
    if (wordClouds[estudo_id] !== undefined) { setWordClouds(p => { const n = {...p}; delete n[estudo_id]; return n; }); return; }
    setLoadingAi(p => ({...p, [key]: true}));
    try {
      const r = await api.get<WordCloudResult>(`/estudos/${estudo_id}/word-cloud`);
      setWordClouds(p => ({...p, [estudo_id]: r}));
    } catch { setWordClouds(p => ({...p, [estudo_id]: null})); }
    finally { setLoadingAi(p => ({...p, [key]: false})); }
  }

  async function loadComparativo(estudo_id: number) {
    const key = `comp-${estudo_id}`;
    if (comparativos[estudo_id] !== undefined) { setComparativos(p => { const n = {...p}; delete n[estudo_id]; return n; }); return; }
    setLoadingAi(p => ({...p, [key]: true}));
    try {
      const r = await api.get<ComparativoResult | {erro: string}>(`/estudos/${estudo_id}/comparativo-temporal`);
      if (r && 'erro' in r) { setComparativos(p => ({...p, [estudo_id]: null})); }
      else { setComparativos(p => ({...p, [estudo_id]: r as ComparativoResult})); }
    } catch { setComparativos(p => ({...p, [estudo_id]: null})); }
    finally { setLoadingAi(p => ({...p, [key]: false})); }
  }

  async function loadSentimento(estudo_id: number) {
    const key = `sent-${estudo_id}`;
    if (sentimentos[estudo_id] !== undefined) { setSentimentos(p => { const n = {...p}; delete n[estudo_id]; return n; }); return; }
    setLoadingAi(p => ({...p, [key]: true}));
    try {
      const r = await api.get<SentimentoResult | {erro: string}>(`/estudos/${estudo_id}/sentimento`);
      if (r && 'erro' in r) { setSentimentos(p => ({...p, [estudo_id]: null})); }
      else { setSentimentos(p => ({...p, [estudo_id]: r as SentimentoResult})); }
    } catch { setSentimentos(p => ({...p, [estudo_id]: null})); }
    finally { setLoadingAi(p => ({...p, [key]: false})); }
  }

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }

    interface MeWithPerms {
      role_global: string;
      permissoes: { estudo_id: number; role: string }[];
    }

    // First get user role + permissions, then load data appropriately
    api.get<MeWithPerms>("/auth/me").then(me => {
      setUserRole(me.role_global);
      const isStaff = ["admin", "coordenador"].includes(me.role_global);
      const ceIds = (me.permissoes ?? []).filter(p => p.role === "cliente").map(p => p.estudo_id);
      const isCliente = !isStaff && ceIds.length > 0;

      const estudosPromise = api.get<Estudo[]>("/estudos/");

      // Stats: aggregate per-estudo for clients, global for staff
      const statsPromise: Promise<VisitaStats | null> = isCliente && ceIds.length > 0
        ? Promise.all(
            ceIds.map(id => api.get<VisitaStats>(`/visitas/stats?estudo_id=${id}`).catch(() => null))
          ).then(results => {
            const valid = results.filter(Boolean) as VisitaStats[];
            if (valid.length === 0) return null;
            const por: Record<string, number> = {};
            let total = 0; let scoreSum = 0; let scoreCount = 0;
            valid.forEach(s => {
              total += s.total;
              Object.entries(s.por_estado).forEach(([k, v]) => { por[k] = (por[k] ?? 0) + v; });
              if (s.pontuacao_media != null) { scoreSum += s.pontuacao_media * s.total; scoreCount += s.total; }
            });
            return { total, por_estado: por, pontuacao_media: scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : 0 } as VisitaStats;
          })
        : api.get<VisitaStats>("/visitas/stats").catch(() => null);

      // Pagamentos: only for staff
      const pagamentosPromise = isStaff
        ? api.get<Pagamento[]>("/pagamentos/?page_size=1000").catch(() => [])
        : Promise.resolve([] as Pagamento[]);

      const analistaReportPromise = isStaff
        ? api.get<AnalistaReport[]>("/pagamentos/relatorio/analistas").catch(() => [])
        : Promise.resolve([] as AnalistaReport[]);

      Promise.allSettled([estudosPromise, statsPromise, pagamentosPromise, analistaReportPromise]).then(([eR, sR, pR, arR]) => {
        if (eR.status === "fulfilled") setEstudos(eR.value as Estudo[]);
        if (sR.status === "fulfilled" && sR.value) setStats(sR.value as VisitaStats);
        if (pR.status === "fulfilled") setPagamentos(Array.isArray(pR.value) ? pR.value as Pagamento[] : []);
        if (arR.status === "fulfilled") setAnalistaReport(Array.isArray(arR.value) ? arR.value as AnalistaReport[] : []);
      }).finally(() => setLoading(false));
    }).catch(() => { router.replace("/login"); });
  }, [router]);

  async function downloadExcel(estudoId: number, estudoNome: string) {
    setDownloading(`excel-${estudoId}`);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`/api/visitas/export/excel?estudo_id=${estudoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao exportar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `visitas_${estudoNome.replace(/\s+/g, "_")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setDownloading(null);
    }
  }

  async function downloadPDF(estudoId: number, estudoNome: string) {
    setDownloading(`pdf-${estudoId}`);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`/api/estudos/${estudoId}/relatorio/pdf?locale=${locale}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao exportar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio_${estudoNome.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setDownloading(null);
    }
  }

  async function loadCriterios(estudoId: number) {
    if (criterioEstudo === estudoId) { setCriterioEstudo(null); setCriteriosData([]); return; }
    setLoadingCriterios(true);
    setCriterioEstudo(estudoId);
    try {
      const data = await api.get<CriterioScore[]>(`/visitas/criterios-score?estudo_id=${estudoId}`);
      setCriteriosData(Array.isArray(data) ? data : []);
    } catch { setCriteriosData([]); } finally { setLoadingCriterios(false); }
  }

  async function sendRelatorioEmail(estudoId: number) {
    const email = (emailInputs[estudoId] || "").trim();
    if (!email) return;
    setSendingEmail(estudoId);
    setEmailMsg(p => ({ ...p, [estudoId]: "" }));
    try {
      await api.post(`/estudos/${estudoId}/relatorio-email`, { destinatario: email });
      setEmailMsg(p => ({ ...p, [estudoId]: `✓ Relatório enviado para ${email}` }));
      setShowEmailForm(p => ({ ...p, [estudoId]: false }));
      setEmailInputs(p => ({ ...p, [estudoId]: "" }));
    } catch (e: unknown) {
      setEmailMsg(p => ({ ...p, [estudoId]: `Erro: ${e instanceof Error ? e.message : "falha no envio"}` }));
    } finally {
      setSendingEmail(null);
    }
  }

  // Payment summary by state
  const pagSummary = pagamentos.reduce<Record<string, { count: number; total: number }>>((acc, p) => {
    if (!acc[p.estado]) acc[p.estado] = { count: 0, total: 0 };
    acc[p.estado].count++;
    acc[p.estado].total += p.valor_total;
    return acc;
  }, {});
  const totalPago = pagamentos.filter(p => p.estado === "pago").reduce((s, p) => s + p.valor_total, 0);
  const totalPendente = pagamentos.filter(p => p.estado === "pendente").reduce((s, p) => s + p.valor_total, 0);

  const ESTADO_COLORS: Record<string, string> = {
    fechada: "bg-emerald-500",
    validada: "bg-blue-500",
    inserida: "bg-indigo-400",
    planeada: "bg-sky-400",
    nova: "bg-slate-400",
    corrigir: "bg-amber-500",
    anulada: "bg-red-400",
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-brand" />
          Relatórios
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Visão geral e exportações de dados
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-card">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Visitas</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats?.total ?? 0}</p>
              <ClipboardList className="w-4 h-4 text-slate-300 mt-2" />
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-card">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Fechadas</p>
              <p className="text-2xl font-bold text-emerald-600">{stats?.por_estado?.fechada ?? 0}</p>
              <TrendingUp className="w-4 h-4 text-emerald-300 mt-2" />
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-card">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Score Médio</p>
              <p className="text-2xl font-bold text-blue-600">{stats?.pontuacao_media ?? 0}%</p>
              <BarChart3 className="w-4 h-4 text-blue-300 mt-2" />
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-card">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Pagamentos</p>
              <p className="text-2xl font-bold text-violet-600">{pagamentos.length}</p>
              <CreditCard className="w-4 h-4 text-violet-300 mt-2" />
            </div>
          </div>

          {/* Distribuição por estado */}
          {stats && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-card">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
                Distribuição de Visitas por Estado
              </h2>
              <div className="space-y-2.5">
                {Object.entries(stats.por_estado)
                  .sort((a, b) => b[1] - a[1])
                  .map(([estado, count]) => {
                    const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                    const color = ESTADO_COLORS[estado] ?? "bg-slate-400";
                    return (
                      <div key={estado} className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 w-32 capitalize flex-shrink-0">{estado.replace(/_/g, " ")}</span>
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-12 text-right">{count}</span>
                        <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Resumo Pagamentos */}
          {pagamentos.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-card">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
                Resumo de Pagamentos
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Total Pago</p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                    {totalPago.toLocaleString(fmtLocale, { style: "currency", currency: "EUR" })}
                  </p>
                </div>
                <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Pendente</p>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                    {totalPendente.toLocaleString(fmtLocale, { style: "currency", currency: "EUR" })}
                  </p>
                </div>
                <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">Registos</p>
                  <p className="text-xl font-bold text-slate-700 dark:text-slate-300">{pagamentos.length}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="text-left text-xs font-semibold text-slate-500 py-2 uppercase">Estado</th>
                      <th className="text-right text-xs font-semibold text-slate-500 py-2 uppercase">Nº</th>
                      <th className="text-right text-xs font-semibold text-slate-500 py-2 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(pagSummary).map(([estado, data]) => (
                      <tr key={estado} className="border-b border-slate-50 dark:border-slate-800/50">
                        <td className="py-2.5 capitalize text-slate-600 dark:text-slate-400">{estado}</td>
                        <td className="py-2.5 text-right text-slate-700 dark:text-slate-300">{data.count}</td>
                        <td className="py-2.5 text-right font-semibold text-slate-900 dark:text-white">
                          {data.total.toLocaleString(fmtLocale, { style: "currency", currency: "EUR" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagamentos por Analista */}
          {analistaReport.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-card">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                Pagamentos por Analista
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                Totais agrupados por analista, ordenados por valor total
              </p>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-xs min-w-[480px]">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="text-left text-[11px] font-semibold text-slate-500 py-2 pr-3 uppercase">Analista</th>
                      <th className="text-right text-[11px] font-semibold text-slate-500 py-2 pr-3 uppercase">Pag.</th>
                      <th className="text-right text-[11px] font-semibold text-slate-500 py-2 pr-3 uppercase">Base</th>
                      <th className="text-right text-[11px] font-semibold text-slate-500 py-2 pr-3 uppercase">Desp.</th>
                      <th className="text-right text-[11px] font-semibold text-slate-500 py-2 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analistaReport.map((row) => (
                      <tr key={row.analista_id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="py-2 pr-3 font-medium text-slate-800 dark:text-slate-200">{row.analista_nome}</td>
                        <td className="py-2 pr-3 text-right text-slate-600 dark:text-slate-400">{row.total_pagamentos}</td>
                        <td className="py-2 pr-3 text-right text-slate-600 dark:text-slate-400">
                          {row.valor_base.toLocaleString(fmtLocale, { style: "currency", currency: "EUR" })}
                        </td>
                        <td className="py-2 pr-3 text-right text-slate-600 dark:text-slate-400">
                          {row.valor_despesas.toLocaleString(fmtLocale, { style: "currency", currency: "EUR" })}
                        </td>
                        <td className="py-2 text-right font-bold text-slate-900 dark:text-white">
                          {row.valor_total.toLocaleString(fmtLocale, { style: "currency", currency: "EUR" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                      <td className="py-2.5 text-xs font-semibold text-slate-500 uppercase">Total</td>
                      <td className="py-2.5 text-right font-semibold text-slate-700 dark:text-slate-300">
                        {analistaReport.reduce((s, r) => s + r.total_pagamentos, 0)}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-slate-700 dark:text-slate-300">
                        {analistaReport.reduce((s, r) => s + r.valor_base, 0).toLocaleString(fmtLocale, { style: "currency", currency: "EUR" })}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-slate-700 dark:text-slate-300">
                        {analistaReport.reduce((s, r) => s + r.valor_despesas, 0).toLocaleString(fmtLocale, { style: "currency", currency: "EUR" })}
                      </td>
                      <td className="py-2.5 text-right font-bold text-slate-900 dark:text-white">
                        {analistaReport.reduce((s, r) => s + r.valor_total, 0).toLocaleString(fmtLocale, { style: "currency", currency: "EUR" })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Análise por Critério */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-card">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
              Análise por Critério
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Conformidade detalhada por critério de avaliação para cada estudo
            </p>
            <div className="space-y-2">
              {estudos.map((e) => (
                <div key={e.id} className="border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
                  <button
                    onClick={() => loadCriterios(e.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    <span className="truncate">{e.nome}</span>
                    <ChevronDown
                      size={16}
                      className={`flex-shrink-0 ml-2 transition-transform ${criterioEstudo === e.id ? "rotate-180" : ""}`}
                    />
                  </button>
                  {criterioEstudo === e.id && (
                    <div className="px-4 pb-4">
                      {loadingCriterios ? (
                        <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> A carregar critérios...
                        </div>
                      ) : criteriosData.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2">Sem dados de avaliação para este estudo.</p>
                      ) : (
                        <div className="space-y-2.5 mt-1">
                          {criteriosData.map((c) => {
                            const pct = c.conformidade_pct ?? 0;
                            const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-yellow-400" : "bg-red-400";
                            return (
                              <div key={c.criterio_id}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-xs" title={c.label}>{c.label}</span>
                                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex-shrink-0 ml-2">
                                    {c.conformidade_pct != null ? `${c.conformidade_pct}%` : "—"}
                                  </span>
                                </div>
                                <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{c.total_respostas} resposta{c.total_respostas !== 1 ? "s" : ""} · {c.tipo}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Exportações por Estudo */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-card">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
              Exportar por Estudo
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Download de Excel ou relatório PDF para cada estudo
            </p>
            <div className="space-y-3">
              {estudos.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{e.nome}</p>
                      <p className="text-xs text-slate-400 mt-0.5">ID {e.id} · {e.estado}</p>
                    </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    <button
                      onClick={async () => {
                        if (resumoIA[e.id]) { setResumoIA(p => { const n = {...p}; delete n[e.id]; return n; }); return; }
                        setLoadingIA(e.id);
                        try {
                          const r = await api.get<{ resumo: string }>(`/portal/resumo-ia/${e.id}`);
                          setResumoIA(p => ({ ...p, [e.id]: r.resumo }));
                        } catch { /* silent */ } finally { setLoadingIA(null); }
                      }}
                      disabled={loadingIA === e.id}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-100 hover:bg-violet-200 text-violet-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition"
                    >
                      {loadingIA === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {resumoIA[e.id] ? "Fechar IA" : "Resumo IA"}
                    </button>
                    <button
                      onClick={() => loadWordCloud(e.id)}
                      disabled={loadingAi[`wc-${e.id}`]}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-100 hover:bg-sky-200 text-sky-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition"
                    >
                      {loadingAi[`wc-${e.id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                      {wordClouds[e.id] !== undefined ? "Fechar Nuvem" : "Word Cloud"}
                    </button>
                    <button
                      onClick={() => loadComparativo(e.id)}
                      disabled={loadingAi[`comp-${e.id}`]}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition"
                    >
                      {loadingAi[`comp-${e.id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpDown className="w-3.5 h-3.5" />}
                      {comparativos[e.id] !== undefined ? "Fechar Comp." : "Comparativo"}
                    </button>
                    <button
                      onClick={() => loadSentimento(e.id)}
                      disabled={loadingAi[`sent-${e.id}`]}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition"
                    >
                      {loadingAi[`sent-${e.id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SmilePlus className="w-3.5 h-3.5" />}
                      {sentimentos[e.id] !== undefined ? "Fechar Sent." : "Sentimento"}
                    </button>
                    <button
                      onClick={() => downloadExcel(e.id, e.nome)}
                      disabled={!!downloading}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition"
                    >
                      {downloading === `excel-${e.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                      )}
                      Excel
                    </button>
                    <button
                      onClick={() => downloadPDF(e.id, e.nome)}
                      disabled={!!downloading}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition"
                    >
                      {downloading === `pdf-${e.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                      PDF
                    </button>
                    <button
                      onClick={() => setShowEmailForm(p => ({ ...p, [e.id]: !p[e.id] }))}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg transition"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Email
                    </button>
                    <a
                      href={`/estudos/${e.id}`}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Ver
                    </a>
                  </div>
                  </div>{/* end name+buttons row */}

                  {/* 8F.3 — Email form */}
                  {showEmailForm[e.id] && (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="email"
                        value={emailInputs[e.id] ?? ""}
                        onChange={ev => setEmailInputs(p => ({ ...p, [e.id]: ev.target.value }))}
                        placeholder="destinatario@exemplo.pt"
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-500"
                      />
                      <button
                        onClick={() => sendRelatorioEmail(e.id)}
                        disabled={sendingEmail === e.id || !(emailInputs[e.id] || "").trim()}
                        className="flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                      >
                        {sendingEmail === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                        Enviar
                      </button>
                    </div>
                  )}
                  {emailMsg[e.id] && (
                    <p className={`mt-1.5 text-xs ${emailMsg[e.id].startsWith("✓") ? "text-emerald-600" : "text-red-500"}`}>
                      {emailMsg[e.id]}
                    </p>
                  )}

                  {resumoIA[e.id] && (
                    <div className="mt-3 bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900 rounded-xl p-3">
                      <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 flex items-center gap-1.5 mb-1.5"><Sparkles className="w-3 h-3" />Resumo IA</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{resumoIA[e.id]}</p>
                    </div>
                  )}

                  {/* 8E.2 Word Cloud */}
                  {e.id in wordClouds && (
                    wordClouds[e.id] === null ? (
                      <div className="mt-3 text-xs text-slate-400 text-center py-2">Sem respostas de texto suficientes para esta análise.</div>
                    ) : wordClouds[e.id] && (
                      <div className="mt-3 bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900 rounded-xl p-4">
                        <p className="text-xs font-semibold text-sky-700 dark:text-sky-400 flex items-center gap-1.5 mb-3">
                          <Cloud className="w-3.5 h-3.5" />Nuvem de Palavras · {wordClouds[e.id]!.total_respostas} resposta{wordClouds[e.id]!.total_respostas !== 1 ? "s" : ""}
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-2 leading-relaxed">
                          {(() => {
                            const palavras = wordClouds[e.id]!.palavras;
                            const maxScore = palavras[0]?.score ?? 1;
                            return palavras.map(p => (
                              <span
                                key={p.palavra}
                                className={wcColor(p.score, maxScore)}
                                style={{ fontSize: `${wcFontSize(p.score, maxScore)}rem` }}
                                title={`freq: ${p.frequencia}`}
                              >
                                {p.palavra}
                              </span>
                            ));
                          })()}
                        </div>
                      </div>
                    )
                  )}

                  {/* 8E.5 Comparativo Temporal */}
                  {e.id in comparativos && (
                    comparativos[e.id] === null ? (
                      <div className="mt-3 text-xs text-slate-400 text-center py-2">Dados insuficientes para comparação temporal.</div>
                    ) : comparativos[e.id] && (
                      <div className="mt-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                            <ArrowUpDown className="w-3.5 h-3.5" />Comparativo Temporal
                          </p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            comparativos[e.id]!.tendencia === "melhoria" ? "bg-emerald-100 text-emerald-700" :
                            comparativos[e.id]!.tendencia === "declínio" ? "bg-red-100 text-red-600" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {comparativos[e.id]!.tendencia.toUpperCase()}
                            {comparativos[e.id]!.variacao_score != null && ` ${comparativos[e.id]!.variacao_score! >= 0 ? "+" : ""}${comparativos[e.id]!.variacao_score!.toFixed(1)}pp`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">{comparativos[e.id]!.resumo}</p>
                        {comparativos[e.id]!.destaques.length > 0 && (
                          <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 list-disc list-inside">
                            {comparativos[e.id]!.destaques.map((d, i) => <li key={i}>{d}</li>)}
                          </ul>
                        )}
                      </div>
                    )
                  )}

                  {/* 8E.1 Sentiment Analysis */}
                  {e.id in sentimentos && (
                    sentimentos[e.id] === null ? (
                      <div className="mt-3 text-xs text-slate-400 text-center py-2">Sem respostas de texto para análise de sentimento.</div>
                    ) : sentimentos[e.id] && (
                      <div className="mt-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                            <SmilePlus className="w-3.5 h-3.5" />Análise de Sentimento
                          </p>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              sentimentos[e.id]!.sentimento_global === "positivo" ? "bg-emerald-100 text-emerald-700" :
                              sentimentos[e.id]!.sentimento_global === "negativo" ? "bg-red-100 text-red-600" :
                              "bg-slate-100 text-slate-500"
                            }`}>
                              {sentimentos[e.id]!.sentimento_global.toUpperCase()}
                            </span>
                            <span className="text-[10px] text-slate-500">{Math.round(sentimentos[e.id]!.score * 100)}% · confiança {Math.round(sentimentos[e.id]!.confianca * 100)}%</span>
                          </div>
                        </div>
                        {/* Score gauge */}
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                          <div className={`h-full rounded-full transition-all ${
                            sentimentos[e.id]!.score >= 0.6 ? "bg-emerald-400" :
                            sentimentos[e.id]!.score <= 0.4 ? "bg-red-400" : "bg-amber-400"
                          }`} style={{ width: `${Math.round(sentimentos[e.id]!.score * 100)}%` }}/>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">{sentimentos[e.id]!.resumo}</p>
                        {sentimentos[e.id]!.temas.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {sentimentos[e.id]!.temas.map((t, i) => (
                              <span key={i} className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
