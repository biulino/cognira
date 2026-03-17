"use client";

import { useEffect, useState, Component, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ClipboardList, TrendingUp, Activity, Layers, CheckCircle2, Download, FileText, Settings, Brain, Sparkles, X, Loader2, AlertTriangle, CheckCircle, Info, Map } from "lucide-react";
import { api } from "@/lib/api";
import type { PlanoItem as GeoPlanoItem } from "@/components/PlanoMap";
import { useI18n } from "@/lib/i18n";

const PlanoMap = dynamic(() => import("@/components/PlanoMap"), { ssr: false, loading: () => <div className="h-[420px] bg-slate-50 rounded-xl flex items-center justify-center"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div> });

interface Estudo { id: number; nome: string; estado: string; cliente_id: number; }
interface Onda { id: number; label: string; }
interface Stats { total: number; por_estado: Record<string, number>; pontuacao_media: number | null; }
interface Visita {
  id: number; estado: string; tipo_visita: string;
  pontuacao: number | null; pontuacao_estado: string;
  analista_nome: string | null; estabelecimento_nome: string | null;
  planeada_em: string | null; realizada_inicio: string | null;
}
interface VisitaListResponse { items: Visita[]; total: number; }
interface AiInsight { tipo: "alerta" | "positivo" | "neutro"; titulo: string; detalhe: string; }
interface AiInsights { resumo: string; insights: AiInsight[]; proximas_acoes: string[]; gerado_em: string; periodo: string; }
interface AiReport { relatorio: string; estudo_nome: string; onda_label: string; gerado_em: string; }

const STATE_BAR_COLOR: Record<string, string> = {
  fechada: "bg-emerald-500", validada: "bg-blue-500", inserida: "bg-yellow-400",
  nova: "bg-slate-300", planeada: "bg-purple-400", anulada: "bg-red-400",
  corrigir: "bg-orange-400", corrigida: "bg-teal-400",
  para_alteracao: "bg-amber-400", situacao_especial: "bg-pink-400", sem_alteracoes: "bg-slate-400",
};
const STATE_BADGE: Record<string, string> = {
  fechada: "bg-emerald-100 text-emerald-700", validada: "bg-blue-100 text-blue-700",
  inserida: "bg-yellow-100 text-yellow-700", nova: "bg-slate-100 text-slate-600",
  planeada: "bg-purple-100 text-purple-700", anulada: "bg-red-100 text-red-600",
  corrigir: "bg-orange-100 text-orange-700", corrigida: "bg-teal-100 text-teal-700",
  para_alteracao: "bg-amber-100 text-amber-700", situacao_especial: "bg-pink-100 text-pink-700",
  activo: "bg-emerald-100 text-emerald-700", inactivo: "bg-slate-100 text-slate-500",
};
const ESTADO_LABELS: Record<string, string> = {
  nova: "Nova", planeada: "Planeada", inserida: "Inserida", validada: "Validada",
  fechada: "Fechada", anulada: "Anulada", corrigir: "A Corrigir", corrigida: "Corrigida",
  para_alteracao: "Para Alteração", situacao_especial: "Situação Especial",
  sem_alteracoes: "Sem Alterações", activo: "Activo", inactivo: "Inactivo",
};

function Badge({ estado }: { estado: string }) {
  const cls = STATE_BADGE[estado] ?? "bg-slate-100 text-slate-600";
  return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{ESTADO_LABELS[estado] ?? estado}</span>;
}

function ScoreChip({ score }: { score: number }) {
  const color = score >= 80 ? "text-emerald-600 bg-emerald-50" : score >= 60 ? "text-yellow-600 bg-yellow-50" : "text-red-600 bg-red-50";
  return <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${color}`}>{score.toFixed(0)}%</span>;
}

async function downloadFile(apiPath: string, filename: string) {
  const token = localStorage.getItem("access_token");
  const res = await fetch(apiPath, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Simple error boundary for PlanoMap ───────────────────────────────────────
class PlanoMapErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[420px] bg-slate-50 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <p className="text-sm">Não foi possível renderizar o mapa de rotas.</p>
          <button
            className="text-xs text-indigo-500 underline"
            onClick={() => this.setState({ hasError: false })}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function EstudoDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const estudoId = params.id as string;

  const [estudo, setEstudo] = useState<Estudo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [ondas, setOndas] = useState<Onda[]>([]);
  const [grelhas, setGrelhas] = useState<{ id: number; nome: string; tipo_visita: string | null; versao: number; secoes: { id: number; nome: string; criterios: { id: number; label: string }[] }[] }[]>([]);
  const [recent, setRecent] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("");
  const [aiInsights, setAiInsights] = useState<AiInsights | null>(null);
  const [aiReport, setAiReport] = useState<AiReport | null>(null);
  const [aiLoading, setAiLoading] = useState<"insights" | "report" | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Module #4 — Planeamento automático
  interface PlanoItem extends GeoPlanoItem { score_medio: number | null; visitas_mes: number; estabelecimentos: {id: number; nome: string}[]; }
  interface PlanoResult { plano: PlanoItem[]; observacoes: string; total_visitas_planeadas: number; gerado_em: string; geo_disponivel?: boolean; erro?: string; }
  const [planeamentoModal, setPlaneamentoModal] = useState<{ onda: Onda } | null>(null);
  const [planoResult, setPlanoResult] = useState<PlanoResult | null>(null);
  const [planoLoading, setPlanoLoading] = useState(false);
  const [planoApplying, setPlanoApplying] = useState(false);
  const [planoApplied, setPlanoApplied] = useState<{criadas: number; ignoradas: number; mensagem: string} | null>(null);
  const [planoTab, setPlanoTab] = useState<"lista" | "mapa">("lista");

  const openPlaneamento = async (onda: Onda) => {
    setPlaneamentoModal({ onda });
    setPlanoResult(null);
    setPlanoApplied(null);
    setPlanoTab("lista");
    setPlanoLoading(true);
    try {
      const res = await api.post<PlanoResult>(`/estudos/${estudoId}/ondas/${onda.id}/planear-ia`, {});
      setPlanoResult(res);
    } catch (e: unknown) {
      setPlanoResult({ erro: e instanceof Error ? e.message : "Sem permissão ou erro ao gerar plano.", plano: [], observacoes: "", total_visitas_planeadas: 0, gerado_em: "" });
    } finally { setPlanoLoading(false); }
  };

  const aplicarPlano = async () => {
    if (!planeamentoModal || !planoResult) return;
    if (!confirm(`Criar ${planoResult.total_visitas_planeadas} visita(s) com estado "planeada" para a onda ${planeamentoModal.onda.label}?\n\nPodes sempre rever ou alterar as visitas depois.`)) return;
    setPlanoApplying(true);
    try {
      const res = await api.post<{criadas: number; ignoradas: number; mensagem: string}>(
        `/estudos/${estudoId}/ondas/${planeamentoModal.onda.id}/aplicar-plano`,
        { plano: planoResult.plano }
      );
      setPlanoApplied(res);
    } catch (e: unknown) {
      alert((e instanceof Error ? e.message : null) ?? "Erro ao aplicar plano.");
    } finally { setPlanoApplying(false); }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }

    Promise.all([
      api.get<Estudo>(`/estudos/${estudoId}`),
      api.get<Stats>(`/visitas/stats?estudo_id=${estudoId}`),
      api.get<Onda[]>(`/estudos/${estudoId}/ondas`),
      api.get<VisitaListResponse>(`/visitas/?estudo_id=${estudoId}&page=1&page_size=6`),
      api.get<{ role_global: string }>("/auth/me"),
    ])
      .then(([e, s, o, v, me]) => {
        setEstudo(e);
        setStats(s);
        setOndas(o);
        setRecent(Array.isArray(v) ? v : v.items ?? []);
        setRole((me as { role_global: string }).role_global ?? "");
      })
      .catch(() => router.replace("/dashboard"))
      .finally(() => setLoading(false));
    // Load grids independently (non-critical)
    api.get<typeof grelhas>(`/estudos/${estudoId}/grelhas`).then(setGrelhas).catch(() => {});
  }, [estudoId, router]);

  const canConfigureCampos = ["admin", "coordenador"].includes(role);

  const sorted = stats ? Object.entries(stats.por_estado).filter(([, n]) => n > 0).sort(([, a], [, b]) => b - a) : [];
  const maxCount = sorted[0]?.[1] ?? 1;

  async function loadInsights() {
    setAiLoading("insights"); setAiError(null);
    try { setAiInsights(await api.get<AiInsights>(`/estudos/${estudoId}/insights`)); }
    catch { setAiError("Erro ao gerar insights. Tenta novamente."); }
    finally { setAiLoading(null); }
  }

  async function loadReport(ondaId?: number) {
    setAiLoading("report"); setAiError(null);
    try {
      const url = ondaId ? `/estudos/${estudoId}/relatorio-ia?onda_id=${ondaId}` : `/estudos/${estudoId}/relatorio-ia`;
      setAiReport(await api.post<AiReport>(url, {}));
      setShowReport(true);
    } catch { setAiError("Erro ao gerar relatório IA. Tenta novamente."); }
    finally { setAiLoading(null); }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/estudos" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> Estudos
      </Link>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : estudo && stats ? (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">{estudo.nome}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge estado={estudo.estado} />
                <span className="text-xs text-slate-400">Cliente #{estudo.cliente_id}</span>
                {ondas.length > 0 && <span className="text-xs text-slate-400">{ondas.length} onda{ondas.length !== 1 ? "s" : ""}</span>}
              </div>
            </div>
            <div className="flex flex-col sm:items-end gap-2">
              {/* Export actions — full width on mobile so buttons wrap properly */}
              <div className="w-full sm:w-auto flex flex-wrap gap-2">
              <button
                onClick={() => downloadFile(`/api/visitas/export/excel?estudo_id=${estudoId}`, `visitas_estudo${estudoId}.xlsx`)}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" /> Excel
              </button>
              <button
                onClick={() => downloadFile(`/api/estudos/${estudoId}/relatorio/pdf`, `relatorio_estudo${estudoId}.pdf`)}
                className="inline-flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors shadow-sm"
              >
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
              <button
                onClick={loadInsights}
                disabled={aiLoading === "insights"}
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors shadow-sm"
                title="Cognira Intelligence — Insights baseados nos dados dos últimos 30 dias"
              >
                {aiLoading === "insights" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Insights IA
              </button>
              <button
                onClick={() => loadReport()}
                disabled={aiLoading === "report"}
                className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors shadow-sm"
                title={t("estudos.aiReport")}
              >
                {aiLoading === "report" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />} Relatório IA
              </button>
              <Link
                href={`/visitas?estudo_id=${estudoId}`}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
              >
                <ClipboardList className="w-4 h-4" />
                Ver visitas
                <ArrowRight className="w-4 h-4" />
              </Link>
              </div>
              {/* Configuração — só admin/coordenador */}
              {canConfigureCampos && (
                <div className="flex items-center gap-2 border-t border-slate-100 pt-2">
                  <span className="text-xs text-slate-400">Configuração:</span>
                  <Link
                    href={`/estudos/${estudoId}/campos`}
                    className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    title={t("estudos.configFields")}
                  >
                    <Settings className="w-3 h-3" /> Campos de caracterização
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* AI Error */}
          {aiError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {aiError}
              <button onClick={() => setAiError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}

          {/* Cognira Intelligence — Insights panel */}
          {aiInsights && (
            <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 shadow-card p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900 text-sm">Cognira Intelligence — Insights</h2>
                    <p className="text-xs text-slate-400">{aiInsights.periodo} · {new Date(aiInsights.gerado_em).toLocaleString("pt-PT")}</p>
                  </div>
                </div>
                <button onClick={() => setAiInsights(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-sm text-slate-700 mb-4 italic">{aiInsights.resumo}</p>
              <div className="space-y-2.5 mb-4">
                {aiInsights.insights.map((ins, i) => (
                  <div key={i} className={`flex gap-3 p-3 rounded-xl ${
                    ins.tipo === "alerta" ? "bg-red-50 border border-red-100" :
                    ins.tipo === "positivo" ? "bg-emerald-50 border border-emerald-100" :
                    "bg-slate-50 border border-slate-100"
                  }`}>
                    {ins.tipo === "alerta" ? <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" /> :
                     ins.tipo === "positivo" ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" /> :
                     <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />}
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{ins.titulo}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{ins.detalhe}</p>
                    </div>
                  </div>
                ))}
              </div>
              {aiInsights.proximas_acoes.length > 0 && (
                <div className="bg-indigo-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-indigo-800 mb-2">Próximas acções recomendadas</p>
                  <ul className="space-y-1">
                    {aiInsights.proximas_acoes.map((a, i) => (<li key={i} className="text-xs text-indigo-700 flex gap-1.5"><span className="font-bold">{i+1}.</span>{a}</li>))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total visitas", value: stats.total, icon: ClipboardList, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Fechadas", value: stats.por_estado.fechada ?? 0, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Pontuação média", value: stats.pontuacao_media != null ? `${stats.pontuacao_media}%` : "—", icon: TrendingUp, color: "text-orange-600", bg: "bg-orange-50" },
              { label: "Ondas", value: ondas.length, icon: Layers, color: "text-purple-600", bg: "bg-purple-50" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white rounded-2xl p-4 shadow-card border border-slate-100">
                <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mb-2`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Estado breakdown */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900 text-sm">Visitas por estado</h2>
              <Activity className="w-4 h-4 text-slate-400" />
            </div>
            <div className="space-y-2.5">
              {sorted.map(([estado, count]) => (
                <div key={estado} className="flex items-center gap-3">
                  <div className="w-28 flex-shrink-0">
                    <Badge estado={estado} />
                  </div>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${STATE_BAR_COLOR[estado] ?? "bg-slate-400"}`}
                      style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 w-8 text-right">{count}</span>
                  <span className="text-xs text-slate-400 w-10 text-right">{Math.round((count / stats.total) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Grids de Avaliação */}
          {grelhas.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 mb-6">
              <h2 className="font-semibold text-slate-900 text-sm mb-3">Grelhas de Avaliação ({grelhas.length})</h2>
              <div className="space-y-3">
                {grelhas.map(g => (
                  <div key={g.id} className="border border-slate-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm text-slate-800">{g.nome}</span>
                      {g.tipo_visita && (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold capitalize">{g.tipo_visita.replace("_", "-")}</span>
                      )}
                      <span className="ml-auto text-[10px] text-slate-400">v{g.versao}</span>
                    </div>
                    {g.secoes.length > 0 && (
                      <div className="space-y-1">
                        {g.secoes.map(s => (
                          <div key={s.id} className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-medium text-slate-600">{s.nome}</span>
                            <span className="text-slate-300">·</span>
                            <span>{s.criterios.length} critério{s.criterios.length !== 1 ? "s" : ""}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ondas */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 mb-6">
            <h2 className="font-semibold text-slate-900 text-sm mb-3">Ondas & Planeamento IA</h2>
            {ondas.length === 0 ? (
              <p className="text-xs text-slate-400">Sem ondas criadas para este estudo. Cria ondas para poder usar o planeamento automático.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {ondas.map(o => (
                  <div key={o.id} className="flex items-center gap-1">
                    <Link
                      href={`/visitas?estudo_id=${estudoId}&onda_id=${o.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200 text-xs font-medium text-slate-700 transition-colors"
                    >
                      <Layers className="w-3 h-3" /> {o.label}
                    </Link>
                    <button
                      onClick={() => openPlaneamento(o)}
                      title={t("estudos.aiPlan")}
                      className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-medium transition ${!canConfigureCampos ? "hidden" : ""}`}
                    >
                      <Brain className="w-3 h-3" /> Planear
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent visits preview */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-sm">Visitas recentes</h2>
              <Link href={`/visitas?estudo_id=${estudoId}`} className="text-blue-600 hover:text-blue-500 text-xs flex items-center gap-1 font-medium">
                Ver todas <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="text-center py-10 text-slate-400 text-sm">Sem visitas</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {recent.map(v => (
                  <div key={v.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="text-xs text-slate-400 font-mono w-10 flex-shrink-0">#{v.id}</span>
                    <Badge estado={v.estado} />
                    <span className="flex-1 text-xs text-slate-500 truncate">
                      {v.estabelecimento_nome ?? `Estab. #${v.id}`}
                      {v.analista_nome ? ` · ${v.analista_nome}` : ""}
                    </span>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {v.realizada_inicio ? new Date(v.realizada_inicio).toLocaleDateString("pt-PT") : "—"}
                    </span>
                    {v.pontuacao != null && v.pontuacao_estado !== "nao_avaliada" && (
                      <ScoreChip score={v.pontuacao} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* Cognira Intelligence — Narrative Report Modal */}
      {showReport && aiReport && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mt-10 mb-10">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Cognira Intelligence — Relatório Narrativo</h2>
                  <p className="text-xs text-slate-400">{aiReport.estudo_nome} · {aiReport.onda_label} · {new Date(aiReport.gerado_em).toLocaleString("pt-PT")}</p>
                </div>
              </div>
              <button onClick={() => setShowReport(false)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">{aiReport.relatorio}</div>
            </div>
            <div className="flex justify-between items-center gap-3 p-4 border-t border-slate-100 flex-wrap">
              {ondas.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {ondas.map(o => (
                    <button key={o.id} onClick={() => loadReport(o.id)} disabled={aiLoading === "report"} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-violet-100 hover:text-violet-700 text-slate-600 font-medium transition-colors disabled:opacity-60">
                      {aiLoading === "report" ? <Loader2 className="w-3 h-3 animate-spin inline" /> : null} Gerar para {o.label}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setShowReport(false)} className="ml-auto px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-700 transition-colors">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Module #4 — Planeamento automático de visitas */}
      {planeamentoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">Planeamento IA</h2>
                  <p className="text-xs text-slate-400">{planeamentoModal.onda.label} · sugestão para revisão</p>
                </div>
              </div>
              <button onClick={() => { setPlaneamentoModal(null); setPlanoApplied(null); }} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab switcher — only shown when plan has geo data */}
            {!planoLoading && planoResult && !planoResult.erro && planoResult.geo_disponivel && (
              <div className="flex border-b border-slate-100 px-6 shrink-0">
                {(["lista", "mapa"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setPlanoTab(tab)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
                      planoTab === tab
                        ? "border-purple-500 text-purple-700"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab === "lista" ? <ClipboardList className="w-4 h-4" /> : <Map className="w-4 h-4" />}
                    {tab === "lista" ? "Lista" : "Mapa de Rotas"}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {planoLoading && (
                <div className="flex flex-col items-center py-10 gap-3">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                  <p className="text-sm text-slate-400">A gerar plano de visitas…</p>
                </div>
              )}
              {!planoLoading && !planoResult && (
                <p className="text-sm text-red-500 text-center py-8">Não foi possível gerar o plano. Verifica se existem estabelecimentos e analistas activos.</p>
              )}
              {!planoLoading && planoResult && planoResult.erro && (
                <p className="text-sm text-red-500 text-center py-8">{planoResult.erro}</p>
              )}
              {/* Sucesso após aplicar */}
              {planoApplied && (
                <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Plano aplicado com sucesso!</p>
                    <p className="text-xs text-emerald-700 mt-0.5">{planoApplied.mensagem}</p>
                  </div>
                </div>
              )}
              {!planoLoading && planoResult && !planoResult.erro && (
                <div className="space-y-4">
                  {/* Summary bar */}
                  {planoTab === "lista" && (
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl">
                    <div>
                      <span className="text-sm font-semibold text-purple-700">Total a criar</span>
                      <p className="text-xs text-purple-500 mt-0.5">Requer aprovação — nada foi criado ainda</p>
                    </div>
                    <span className="text-2xl font-bold text-purple-800">{planoResult.total_visitas_planeadas}</span>
                  </div>
                  )}

                  {/* MAP TAB */}
                  {planoTab === "mapa" && planoResult.geo_disponivel && (
                    <PlanoMapErrorBoundary>
                      <PlanoMap plano={planoResult.plano.filter(p => p.geo_rota && p.geo_rota.length > 0)} />
                    </PlanoMapErrorBoundary>
                  )}

                  {/* LIST TAB */}
                  {planoTab === "lista" && planoResult.plano.map((item, i) => (
                    <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-800 truncate">{item.analista_nome}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {item.score_medio != null && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              item.score_medio >= 80 ? 'bg-emerald-100 text-emerald-700' :
                              item.score_medio >= 60 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>{item.score_medio}%</span>
                          )}
                          <span className="text-xs text-slate-400">{item.visitas_mes} vis./mês</span>
                          {item.distancia_total_km != null && (
                            <span className="text-xs text-slate-400">{item.distancia_total_km} km</span>
                          )}
                          <span className="text-xs text-slate-400">{item.estabelecimentos.length} atribuído{item.estabelecimentos.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="px-4 py-2 space-y-1">
                        {item.estabelecimentos.map((e, j) => (
                          <p key={j} className="text-xs text-slate-600">
                            {item.geo_rota ? <span className="inline-flex w-4.5 h-4.5 mr-1 items-center justify-center bg-purple-100 text-purple-700 rounded-full text-[10px] font-bold">{j + 1}</span> : null}
                            · {e.nome}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}

                  {planoTab === "lista" && planoResult.observacoes && (
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <p className="text-xs font-semibold text-slate-600 mb-1">Observações da IA</p>
                      <p className="text-sm text-slate-700 whitespace-pre-line">{planoResult.observacoes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center gap-3 shrink-0">
              <button onClick={() => { setPlaneamentoModal(null); setPlanoApplied(null); }} className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition">
                {planoApplied ? 'Fechar' : 'Cancelar'}
              </button>
              {planoResult && !planoResult.erro && !planoApplied && (
                <button
                  onClick={aplicarPlano}
                  disabled={planoApplying || planoLoading}
                  className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition"
                >
                  {planoApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {planoApplying ? 'A criar visitas…' : 'Aplicar Plano'}
                </button>
              )}
              {planoApplied && (
                <button
                  onClick={() => { setPlanoResult(null); setPlanoApplied(null); openPlaneamento(planeamentoModal.onda); }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition"
                >
                  <Brain className="w-4 h-4" /> Gerar novo plano
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
