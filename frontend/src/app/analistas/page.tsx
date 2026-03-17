"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Search, UserCheck, UserX, Plus, Pencil, X, Loader2, Sparkles, AlertTriangle, TrendingUp, TrendingDown, Minus, Brain, Shield, Ban, Trash2, Clock, GraduationCap, Star, CheckCircle2, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Analista {
  id: number;
  nome: string | null;
  email: string | null;
  codigo_externo: string | null;
  activo: boolean;
  data_recrutamento: string | null;
}

interface Estudo { id: number; nome: string; }
interface Anomalia {
  analista_id: number;
  nome: string;
  codigo_externo: string | null;
  total_visitas: number;
  score_medio: number | null;
  desvio_std: number | null;
  flag: "alto" | "baixo" | "normal" | "sem_dados";
}
interface AnomaliaResult {
  anomalias: Anomalia[];
  populacao: { media: number; desvio_padrao: number; n_analistas: number };
  periodo_dias: number;
  gerado_em: string;
}

interface AnalistaForm {
  nome: string;
  email: string;
  codigo_externo: string;
  telefone: string;
  nif: string;
  iban: string;
  morada: string;
  data_nascimento: string;
}

const emptyForm: AnalistaForm = {
  nome: "", email: "", codigo_externo: "", telefone: "",
  nif: "", iban: "", morada: "", data_nascimento: "",
};

export default function AnalistasPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [analistas, setAnalistas] = useState<Analista[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Analista | null>(null);
  const [form, setForm] = useState<AnalistaForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Anomaly detection (Module 4)
  const [estudos, setEstudos] = useState<Estudo[]>([]);
  const [anomaliaEstudo, setAnomaliaEstudo] = useState("");
  const [anomaliaResult, setAnomaliaResult] = useState<AnomaliaResult | null>(null);
  const [anomaliaLoading, setAnomaliaLoading] = useState(false);
  const [showAnomalias, setShowAnomalias] = useState(false);
  const [anomaliaError, setAnomaliaError] = useState<string | null>(null);

  // Score preditivo (Module 7)
  interface ScorePreditivoResult {
    score_previsto: number;
    intervalo: [number, number];
    tendencia: "melhoria" | "declínio" | "estável";
    confianca: number;
    fatores: string[];
    recomendacao: string;
    analista_id: number;
    gerado_em: string;    erro?: string;  }
  const [scoreModal, setScoreModal] = useState<{ analista: Analista } | null>(null);
  const [scoreResult, setScoreResult] = useState<ScorePreditivoResult | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);

  // Coaching IA
  interface CoachingArea { area: string; impacto: "alto" | "medio" | "baixo"; sugestao: string; }
  interface CoachingResult {
    score_geral: "excelente" | "bom" | "medio" | "precisa_melhoria";
    pontos_fortes: string[];
    areas_melhoria: CoachingArea[];
    recomendacoes: string[];
    resumo: string;
    prioridade_foco: string;
    metricas: { total_visitas: number; score_medio: number | null; taxa_anulacao_pct: number; duracao_media_minutos: number | null; };
    analista_id: number;
    erro?: string;
  }
  const [coachingModal, setCoachingModal] = useState<{ analista: Analista } | null>(null);
  const [coachingResult, setCoachingResult] = useState<CoachingResult | null>(null);
  const [coachingLoading, setCoachingLoading] = useState(false);

  const openCoachingModal = async (a: Analista) => {
    setCoachingModal({ analista: a });
    setCoachingResult(null);
    setCoachingLoading(true);
    try {
      const res = await api.get<CoachingResult>(`/analistas/${a.id}/coaching-ia`);
      setCoachingResult(res.erro ? null : res);
    } catch { setCoachingResult(null); } finally { setCoachingLoading(false); }
  };

  // Restrições — Chilling Periods + Blacklist
  interface ChillingPeriodItem { id: number; estabelecimento_id: number; meses: number; inicio_em: string; fim_em: string; activo: boolean; }
  interface BlacklistItem { id: number; estabelecimento_id: number; motivo: string | null; permanente: boolean; }
  const [restricoesModal, setRestricoesModal] = useState<{ analista: Analista } | null>(null);
  const [chilling, setChilling] = useState<ChillingPeriodItem[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistItem[]>([]);
  const [restricoesLoading, setRestricoesLoading] = useState(false);
  const [addingRestriction, setAddingRestriction] = useState<"chilling" | "blacklist" | null>(null);
  const [savingRestriction, setSavingRestriction] = useState(false);
  const [chillingForm, setChillingForm] = useState({ estabelecimento_id: "", meses: "6", inicio_em: "", fim_em: "" });
  const [blacklistForm, setBlacklistForm] = useState({ estabelecimento_id: "", motivo: "", permanente: false });

  const openScoreModal = async (a: Analista) => {
    setScoreModal({ analista: a });
    setScoreResult(null);
    setScoreLoading(true);
    try {
      const res = await api.get<ScorePreditivoResult>(`/analistas/${a.id}/score-preditivo`);
      // backend returns {erro: "..."} when no data available
      setScoreResult(res.erro ? null : res);
    } catch { setScoreResult(null); } finally { setScoreLoading(false); }
  };

  const openRestricoesModal = async (a: Analista) => {
    setRestricoesModal({ analista: a });
    setChilling([]);
    setBlacklist([]);
    setAddingRestriction(null);
    setRestricoesLoading(true);
    try {
      const [cp, bl] = await Promise.all([
        api.get<ChillingPeriodItem[]>(`/analistas/${a.id}/chilling-periods`),
        api.get<BlacklistItem[]>(`/analistas/${a.id}/blacklist`),
      ]);
      setChilling(cp);
      setBlacklist(bl);
    } catch { } finally { setRestricoesLoading(false); }
  };

  const removeChilling = async (cpId: number) => {
    if (!restricoesModal) return;
    await api.delete(`/analistas/${restricoesModal.analista.id}/chilling-periods/${cpId}`);
    setChilling(prev => prev.filter(c => c.id !== cpId));
  };

  const addChilling = async () => {
    if (!restricoesModal || !chillingForm.estabelecimento_id || !chillingForm.inicio_em || !chillingForm.fim_em) return;
    setSavingRestriction(true);
    try {
      const cp = await api.post<ChillingPeriodItem>(`/analistas/${restricoesModal.analista.id}/chilling-periods`, {
        estabelecimento_id: parseInt(chillingForm.estabelecimento_id),
        meses: parseInt(chillingForm.meses),
        inicio_em: chillingForm.inicio_em,
        fim_em: chillingForm.fim_em,
      });
      setChilling(prev => [cp, ...prev]);
      setAddingRestriction(null);
      setChillingForm({ estabelecimento_id: "", meses: "6", inicio_em: "", fim_em: "" });
    } catch (e: unknown) { alert((e instanceof Error ? e.message : null) ?? "Erro"); }
    finally { setSavingRestriction(false); }
  };

  const removeBlacklist = async (blId: number) => {
    if (!restricoesModal) return;
    await api.delete(`/analistas/${restricoesModal.analista.id}/blacklist/${blId}`);
    setBlacklist(prev => prev.filter(b => b.id !== blId));
  };

  const addBlacklist = async () => {
    if (!restricoesModal || !blacklistForm.estabelecimento_id) return;
    setSavingRestriction(true);
    try {
      const bl = await api.post<BlacklistItem>(`/analistas/${restricoesModal.analista.id}/blacklist`, {
        estabelecimento_id: parseInt(blacklistForm.estabelecimento_id),
        motivo: blacklistForm.motivo || null,
        permanente: blacklistForm.permanente,
      });
      setBlacklist(prev => [bl, ...prev]);
      setAddingRestriction(null);
      setBlacklistForm({ estabelecimento_id: "", motivo: "", permanente: false });
    } catch (e: unknown) { alert((e instanceof Error ? e.message : null) ?? "Erro"); }
    finally { setSavingRestriction(false); }
  };

  async function runAnomalias() {
    if (!anomaliaEstudo) return;
    setAnomaliaLoading(true);
    setAnomaliaError(null);
    setShowAnomalias(false);
    try {
      const res = await api.get<AnomaliaResult>(`/analistas/anomalias?estudo_id=${anomaliaEstudo}&dias=90`);
      setAnomaliaResult(res);
      setShowAnomalias(true);
    } catch (e: unknown) {
      setAnomaliaError((e instanceof Error ? e.message : null) ?? "Erro ao obter anomalias. Verifica se o estudo tem visitas com pontuação.");
    } finally { setAnomaliaLoading(false); }
  }

  function load() {
    return api.get<Analista[]>("/analistas/?page_size=200")
      .then(setAnalistas)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    load();
    api.get<Estudo[]>("/estudos/").then(setEstudos).catch(() => {});
  }, [router]);

  const filtered = analistas.filter((a) => {
    const q = search.toLowerCase();
    return (
      (a.nome?.toLowerCase().includes(q) ?? false) ||
      (a.email?.toLowerCase().includes(q) ?? false) ||
      (a.codigo_externo?.toLowerCase().includes(q) ?? false)
    );
  });

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(a: Analista) {
    setEditTarget(a);
    setForm({ nome: a.nome ?? "", email: a.email ?? "", codigo_externo: a.codigo_externo ?? "", telefone: "", nif: "", iban: "", morada: "", data_nascimento: "" });
    setShowModal(true);
  }

  async function saveAnalista() {
    if (!form.nome || !form.email) return;
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await api.put<Analista>(`/analistas/${editTarget.id}`, form);
        setAnalistas(prev => prev.map(a => a.id === editTarget.id ? updated : a));
      } else {
        const created = await api.post<Analista>("/analistas/", form);
        setAnalistas(prev => [...prev, created]);
      }
      setShowModal(false);
    } catch (e: unknown) {
      alert((e as Error).message ?? "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(a: Analista) {
    setTogglingId(a.id);
    try {
      if (a.activo) {
        await api.delete(`/analistas/${a.id}`);
        setAnalistas(prev => prev.map(x => x.id === a.id ? { ...x, activo: false } : x));
      } else {
        const updated = await api.put<Analista>(`/analistas/${a.id}`, {
          nome: a.nome ?? "", email: a.email ?? "",
          codigo_externo: a.codigo_externo ?? "",
        });
        setAnalistas(prev => prev.map(x => x.id === a.id ? { ...x, activo: updated.activo } : x));
      }
    } catch (e: unknown) {
      alert((e as Error).message ?? "Erro");
    } finally {
      setTogglingId(null);
    }
  }

  const activos = analistas.filter((a) => a.activo).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{t("analistas.title")}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{activos} activos de {analistas.length} total</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand/90 transition shadow"
        >
          <Plus className="w-4 h-4" />
          Novo
        </button>
      </div>

      {/* Cognira Module 4 — Anomaly Detection Panel */}
      <div className="mb-6 bg-white border border-slate-100 rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="text-sm font-semibold text-slate-800">Cognira Detecção de Anomalias</span>
            <span className="text-xs text-slate-400 hidden sm:inline">— analistas fora da norma (±2σ)</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={anomaliaEstudo}
              onChange={e => setAnomaliaEstudo(e.target.value)}
              className="flex-1 sm:flex-none min-w-0 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">{t("pesquisa.selectStudy")}</option>
              {estudos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <button
              onClick={runAnomalias}
              disabled={!anomaliaEstudo || anomaliaLoading}
              className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition shrink-0"
            >
              {anomaliaLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Analisar
            </button>
          </div>
        </div>

        {anomaliaError && (
          <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-2 text-xs text-red-600 bg-red-50">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {anomaliaError}
          </div>
        )}

        {showAnomalias && anomaliaResult && (
          <div className="border-t border-slate-100 px-5 py-4">
            {anomaliaResult.anomalias.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">
                Nenhum analista com dados suficientes (mínimo 3 visitas com pontuação calculada no período).
              </p>
            ) : (
              <>
                <p className="text-xs text-slate-400 mb-3">
                  Média da população: <strong>{anomaliaResult.populacao.media}%</strong> ·
                  Desvio-padrão: <strong>{anomaliaResult.populacao.desvio_padrao}pp</strong> ·
                  Últimos {anomaliaResult.periodo_dias} dias
                </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-100">
                    <th className="pb-2 font-medium">Analista</th>
                    <th className="pb-2 font-medium text-right">Visitas</th>
                    <th className="pb-2 font-medium text-right">Score Médio</th>
                    <th className="pb-2 font-medium text-right">Desvio (σ)</th>
                    <th className="pb-2 font-medium text-center">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {anomaliaResult.anomalias.map(a => (
                    <tr key={a.analista_id} className={`border-b border-slate-50 ${a.flag === "alto" ? "bg-red-50/40" : a.flag === "baixo" ? "bg-yellow-50/40" : ""}`}>
                      <td className="py-2 font-medium text-slate-800">{a.nome} <span className="text-slate-400 font-normal">{a.codigo_externo}</span></td>
                      <td className="py-2 text-right text-slate-500">{a.total_visitas}</td>
                      <td className="py-2 text-right font-semibold text-slate-700">{a.score_medio != null ? `${a.score_medio}%` : "—"}</td>
                      <td className="py-2 text-right text-slate-500">{a.desvio_std != null ? (a.desvio_std > 0 ? "+" : "") + a.desvio_std : "—"}</td>
                      <td className="py-2 text-center">
                        {a.flag === "alto"
                          ? <span className="inline-flex items-center gap-1 text-red-600 font-semibold"><TrendingUp className="w-3.5 h-3.5" /> alto</span>
                          : a.flag === "baixo"
                          ? <span className="inline-flex items-center gap-1 text-yellow-600 font-semibold"><TrendingDown className="w-3.5 h-3.5" /> baixo</span>
                          : <span className="inline-flex items-center gap-1 text-slate-400"><Minus className="w-3.5 h-3.5" /> normal</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      {!loading && !error && (
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder={t("analistas.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-card"
          />
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">{error}</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">
            {search ? "Nenhum analista encontrado para a pesquisa." : "Nenhum analista encontrado."}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100 dark:border-slate-800 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Analista</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Código</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estado</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">{(a.nome ?? "?")[0].toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">{a.nome ?? "—"}</p>
                          <p className="text-xs text-slate-400">{a.email ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">{a.codigo_externo ?? "—"}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        a.activo
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {a.activo ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                        {a.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openCoachingModal(a)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition"
                          title={t("analistas.coaching")}
                        >
                          <GraduationCap className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openScoreModal(a)}
                          className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition"
                          title="Score Preditivo IA"
                        >
                          <Brain className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openRestricoesModal(a)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition"
                          title="Chilling Periods &amp; Blacklist"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(a)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                          title={t("common.edit")}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(a)}
                          disabled={togglingId === a.id}
                          className={`p-1.5 rounded-lg transition ${
                            a.activo
                              ? "text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                          }`}
                          title={a.activo ? "Desactivar" : "Activar"}
                        >
                          {togglingId === a.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : a.activo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((a) => (
              <div key={a.id} className="px-4 py-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">{(a.nome ?? "?")[0].toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">{a.nome ?? "—"}</p>
                  <p className="text-xs text-slate-400 truncate">{a.email ?? "—"}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openCoachingModal(a)}
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition"
                    title={t("analistas.coaching")}
                  >
                    <GraduationCap className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openScoreModal(a)}
                    className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition"
                    title="Score Preditivo IA"
                  >
                    <Brain className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openRestricoesModal(a)}
                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition"
                    title="Chilling Periods &amp; Blacklist"
                  >
                    <Shield className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEdit(a)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                    title={t("common.edit")}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleActive(a)}
                    disabled={togglingId === a.id}
                    className={`p-1.5 rounded-lg transition ${
                      a.activo
                        ? "text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    }`}
                    title={a.activo ? "Desactivar" : "Activar"}
                  >
                    {togglingId === a.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : a.activo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Restrições Modal — Chilling Periods + Blacklist */}
      {restricoesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Restrições — {restricoesModal.analista.nome}</h2>
              </div>
              <button onClick={() => setRestricoesModal(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-4 space-y-6">
              {restricoesLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div>
              ) : (
                <>
                  {/* ── Chilling Periods ── */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{t("analistas.chillingPeriods")}</h3>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{chilling.length}</span>
                      </div>
                      {addingRestriction !== "chilling" && (
                        <button onClick={() => setAddingRestriction("chilling")} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                          <Plus className="w-3.5 h-3.5" /> Adicionar
                        </button>
                      )}
                    </div>

                    {addingRestriction === "chilling" && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">ID Estabelecimento *</label>
                            <input type="number" value={chillingForm.estabelecimento_id} onChange={e => setChillingForm(f => ({...f, estabelecimento_id: e.target.value}))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: 42" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Período (meses)</label>
                            <input type="number" min="1" max="36" value={chillingForm.meses} onChange={e => setChillingForm(f => ({...f, meses: e.target.value}))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Início *</label>
                            <input type="date" value={chillingForm.inicio_em} onChange={e => setChillingForm(f => ({...f, inicio_em: e.target.value}))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Fim *</label>
                            <input type="date" value={chillingForm.fim_em} onChange={e => setChillingForm(f => ({...f, fim_em: e.target.value}))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setAddingRestriction(null)} className="text-xs text-slate-500 px-3 py-1.5 rounded-lg hover:bg-slate-100">Cancelar</button>
                          <button onClick={addChilling} disabled={savingRestriction} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
                            {savingRestriction && <Loader2 className="w-3 h-3 animate-spin" />} Guardar
                          </button>
                        </div>
                      </div>
                    )}

                    {chilling.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">{t("analistas.noChillingPeriods")}</p>
                    ) : (
                      <div className="space-y-2">
                        {chilling.map(cp => (
                          <div key={cp.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                            <div>
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Loja #{cp.estabelecimento_id} · {cp.meses} meses</p>
                              <p className="text-xs text-slate-400">{cp.inicio_em} → {cp.fim_em}</p>
                            </div>
                            <button onClick={() => removeChilling(cp.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Blacklist ── */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Ban className="w-4 h-4 text-red-500" />
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{t("analistas.blacklist")}</h3>
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{blacklist.length}</span>
                      </div>
                      {addingRestriction !== "blacklist" && (
                        <button onClick={() => setAddingRestriction("blacklist")} className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1">
                          <Plus className="w-3.5 h-3.5" /> Adicionar
                        </button>
                      )}
                    </div>

                    {addingRestriction === "blacklist" && (
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 mb-3 space-y-3">
                        <div>
                          <label className="text-xs font-medium text-slate-600 mb-1 block">ID Estabelecimento *</label>
                          <input type="number" value={blacklistForm.estabelecimento_id} onChange={e => setBlacklistForm(f => ({...f, estabelecimento_id: e.target.value}))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="Ex: 42" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600 mb-1 block">Motivo</label>
                          <input type="text" value={blacklistForm.motivo} onChange={e => setBlacklistForm(f => ({...f, motivo: e.target.value}))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="Motivo opcional" />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input type="checkbox" checked={blacklistForm.permanente} onChange={e => setBlacklistForm(f => ({...f, permanente: e.target.checked}))} className="rounded" />
                          Permanente
                        </label>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setAddingRestriction(null)} className="text-xs text-slate-500 px-3 py-1.5 rounded-lg hover:bg-slate-100">Cancelar</button>
                          <button onClick={addBlacklist} disabled={savingRestriction} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1">
                            {savingRestriction && <Loader2 className="w-3 h-3 animate-spin" />} Guardar
                          </button>
                        </div>
                      </div>
                    )}

                    {blacklist.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Nenhum estabelecimento em blacklist.</p>
                    ) : (
                      <div className="space-y-2">
                        {blacklist.map(bl => (
                          <div key={bl.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                            <div>
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Loja #{bl.estabelecimento_id} {bl.permanente && <span className="ml-1 text-red-600 font-bold">· Permanente</span>}</p>
                              {bl.motivo && <p className="text-xs text-slate-400">{bl.motivo}</p>}
                            </div>
                            <button onClick={() => removeBlacklist(bl.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex-shrink-0 flex justify-end">
              <button onClick={() => setRestricoesModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium transition">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Coaching IA Modal (Module 14) */}
      {coachingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Coaching IA — {coachingModal.analista.nome}</h2>
              </div>
              <button onClick={() => setCoachingModal(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1">
              {coachingLoading && (
                <div className="flex flex-col items-center py-10 gap-3">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                  <p className="text-sm text-slate-400">{t("analistas.generatingCoaching")}</p>
                </div>
              )}
              {!coachingLoading && !coachingResult && (
                <p className="text-sm text-red-500 text-center py-6">Não foi possível gerar coaching. O analista precisa de visitas nos últimos 90 dias.</p>
              )}
              {!coachingLoading && coachingResult && (
                <div className="space-y-4">
                  {/* Score geral badge */}
                  <div className={`flex items-center gap-3 p-4 rounded-xl ${
                    coachingResult.score_geral === "excelente" ? "bg-emerald-50 dark:bg-emerald-900/20" :
                    coachingResult.score_geral === "bom" ? "bg-blue-50 dark:bg-blue-900/20" :
                    coachingResult.score_geral === "medio" ? "bg-amber-50 dark:bg-amber-900/20" :
                    "bg-red-50 dark:bg-red-900/20"
                  }`}>
                    <Star className={`w-6 h-6 ${
                      coachingResult.score_geral === "excelente" ? "text-emerald-600" :
                      coachingResult.score_geral === "bom" ? "text-blue-600" :
                      coachingResult.score_geral === "medio" ? "text-amber-600" : "text-red-600"
                    }`} />
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Desempenho geral</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 capitalize">{coachingResult.score_geral.replace("_", " ")}</p>
                    </div>
                    <div className="ml-auto text-right text-xs text-slate-400">
                      <div>{coachingResult.metricas.total_visitas} visitas</div>
                      <div>Score médio: {coachingResult.metricas.score_medio?.toFixed(1) ?? "–"}%</div>
                    </div>
                  </div>
                  {/* Resumo */}
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{coachingResult.resumo}</p>
                  {/* Pontos fortes */}
                  {coachingResult.pontos_fortes.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Pontos fortes</p>
                      <ul className="space-y-1">
                        {coachingResult.pontos_fortes.map((p, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Áreas de melhoria */}
                  {coachingResult.areas_melhoria.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Áreas a melhorar</p>
                      <div className="space-y-2">
                        {coachingResult.areas_melhoria.map((area, i) => (
                          <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{area.area}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                area.impacto === "alto" ? "bg-red-100 text-red-600" :
                                area.impacto === "medio" ? "bg-amber-100 text-amber-600" :
                                "bg-slate-100 text-slate-500"
                              }`}>{area.impacto}</span>
                            </div>
                            <p className="text-xs text-slate-500">{area.sugestao}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Prioridade foco */}
                  <div className="flex items-start gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                    <ArrowRight className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-indigo-600 mb-0.5">Foco prioritário</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{coachingResult.prioridade_foco}</p>
                    </div>
                  </div>
                  {/* Recomendações */}
                  {coachingResult.recomendacoes.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recomendações</p>
                      <ol className="space-y-1 list-decimal list-inside">
                        {coachingResult.recomendacoes.map((r, i) => (
                          <li key={i} className="text-sm text-slate-600 dark:text-slate-400">{r}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex-shrink-0 flex justify-end">
              <button onClick={() => setCoachingModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium transition">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Score Preditivo Modal (Module 7) */}
      {scoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Score Preditivo — {scoreModal.analista.nome}</h2>
              </div>
              <button onClick={() => setScoreModal(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              {scoreLoading && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                  <p className="text-sm text-slate-400">{t("analistas.calculating")}</p>
                </div>
              )}
              {!scoreLoading && !scoreResult && (
                <p className="text-sm text-red-500 text-center py-6">Não foi possível calcular o score. Verifica se o analista tem visitas registadas.</p>
              )}
              {!scoreLoading && scoreResult && (
                <div className="space-y-4">
                  {/* Main score */}
                  <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Score previsto</p>
                      <p className="text-3xl font-bold text-purple-700">{scoreResult.score_previsto?.toFixed(1) ?? "–"}%</p>
                      <p className="text-xs text-slate-400 mt-0.5">Intervalo: {scoreResult.intervalo?.[0]?.toFixed(1) ?? "–"}% – {scoreResult.intervalo?.[1]?.toFixed(1) ?? "–"}%</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                        scoreResult.tendencia === "melhoria" ? "bg-emerald-100 text-emerald-700" :
                        scoreResult.tendencia === "declínio" ? "bg-red-100 text-red-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {scoreResult.tendencia === "melhoria" ? <TrendingUp className="w-4 h-4" /> :
                         scoreResult.tendencia === "declínio" ? <TrendingDown className="w-4 h-4" /> :
                         <Minus className="w-4 h-4" />}
                        {scoreResult.tendencia}
                      </span>
                      <p className="text-xs text-slate-400 mt-1">Confiança {Math.round(scoreResult.confianca * 100)}%</p>
                    </div>
                  </div>
                  {/* Factors */}
                  {scoreResult.fatores.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">{t("analistas.factors")}</p>
                      <ul className="space-y-1">
                        {scoreResult.fatores.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Recommendation */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <p className="text-xs font-semibold text-slate-600 mb-1">Recomendação</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{scoreResult.recomendacao}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editTarget ? "Editar Analista" : t("analistas.newAnalista")}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {[
                { label: "Nome *", key: "nome", type: "text", required: true },
                { label: "Email *", key: "email", type: "email", required: true },
                { label: "Código Externo", key: "codigo_externo", type: "text" },
                { label: "Telefone", key: "telefone", type: "tel" },
                { label: "NIF", key: "nif", type: "text" },
                { label: "IBAN", key: "iban", type: "text" },
                { label: "Morada", key: "morada", type: "text" },
                { label: "Data Nascimento", key: "data_nascimento", type: "date" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">{label}</label>
                  <input
                    type={type}
                    value={form[key as keyof AnalistaForm]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={saveAnalista}
                disabled={saving || !form.nome || !form.email}
                className="flex items-center gap-2 px-5 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand/90 disabled:opacity-50 transition"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editTarget ? "Actualizar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
