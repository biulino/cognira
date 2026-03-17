"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wand2,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  BookOpen,
  LayoutList,
  Puzzle,
  Info,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Cliente {
  id: number;
  nome: string;
}

interface CampoConfig {
  chave: string;
  label: string;
  tipo: "text" | "number" | "select" | "boolean";
  opcoes: string[];
  obrigatorio: boolean;
}

interface Criterio {
  label: string;
  peso: number;
  tipo: "boolean" | "escala" | "texto";
  ordem: number;
}

interface Secao {
  nome: string;
  ordem: number;
  peso_secao: number;
  criterios: Criterio[];
}

interface GrelhaConfig {
  nome: string;
  tipo_visita: string;
  secoes: Secao[];
}

interface WizardSugestao {
  nome_estudo: string;
  campos: CampoConfig[];
  grelha: GrelhaConfig;
  modulos_sugeridos: string[];
  justificacao: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BRIEFING_PLACEHOLDERS: Record<string, string> = {
  "Restauração & Fast-food": "Ex: Queremos avaliar a qualidade do atendimento nos nossos 50 restaurantes em Portugal. Interessa-nos saber se os colaboradores seguem o script de boas-vindas, tempo de espera, limpeza das instalações e cross-selling. O estudo vai durar 6 meses com 2 visitas mensais por restaurante.",
  "Grande Distribuição / Retalho": "Ex: Pretendemos auditar 120 lojas da cadeia para verificar conformidade de preços no linear, disponibilidade de produto, limpeza e execução de montras. Frequência mensal durante 1 ano.",
  "Banca & Seguros": "Ex: Queremos avaliar a experiência do cliente em 30 balcões bancários: tempo de espera, abordagem proactiva, apresentação de produtos e conformidade regulatória. Estudo de 3 meses com visitas presenciais e telefónicas.",
  "Telecomunicações": "Ex: Avaliar a qualidade de atendimento em lojas próprias e franchisadas: apresentação do portfólio, argumentação de vendas, resolução de reclamações e upsell. Cobertura nacional em 90 pontos de venda.",
  "Automóvel": "Ex: Mystery shopping a 40 concessionários para avaliar receção do cliente, apresentação de modelos, test-drive, argumentação de financiamento e follow-up pós-visita. Duas rondas por ano.",
  "Saúde & Farmácia": "Ex: Auditar 80 farmácias para verificar conformidade na dispensa de medicamentos, aconselhamento ao balcão, merchandising e limpeza. Visitas mensais durante 6 meses.",
  "Hotelaria & Turismo": "Ex: Avaliar a experiência de hóspede em 20 hotéis: check-in, quarto, pequeno-almoço, spa e check-out. Estudo semestral com análise comparativa entre unidades.",
  "Energia & Utilities": "Ex: Avaliar centros de atendimento e lojas de energia: tempo de resposta, clareza na explicação de tarifas, resolução de problemas e venda de serviços adicionais.",
  "Serviços Públicos": "Ex: Monitorizar a qualidade do atendimento presencial em 50 repartições: tempo de espera, cortesia, resolução de situações e sinalética. Visitas trimestrais.",
  "E-commerce & Logística": "Ex: Auditar centros de distribuição e pontos de recolha: tempos de processamento, conformidade de embalagem, experiência de entrega e gestão de devoluções.",
  "Moda & Beleza": "Ex: Avaliar 60 lojas de moda: receção do cliente, conhecimento do produto, fitting room experience, cross-selling e visual merchandising. Duas visitas por loja por mês.",
  "Outro": "Descreve o que queres avaliar: sector, número de locais, critérios de qualidade, frequência de visitas e duração do estudo. Quanto mais detalhe forneceres, melhor será o resultado da IA.",
};

const SECTORES = [
  "Restauração & Fast-food",
  "Grande Distribuição / Retalho",
  "Banca & Seguros",
  "Telecomunicações",
  "Automóvel",
  "Saúde & Farmácia",
  "Hotelaria & Turismo",
  "Energia & Utilities",
  "Serviços Públicos",
  "E-commerce & Logística",
  "Moda & Beleza",
  "Outro",
];

const TIPOS_ESTUDO = [
  "Deixar para a IA decidir",
  "Mystery Shopping",
  "Auditoria de Qualidade",
  "Compliance Check",
  "Shelf Audit",
  "Customer Experience",
  "Avaliação de Serviço",
  "Outro",
];

const TIPO_VISITA_LABELS: Record<string, string> = {
  presencial: "Presencial",
  telefonica: "Telefónica",
  "drive-through": "Drive-through",
  online: "Online",
};

const MODULO_LABELS: Record<string, string> = {
  callcenter: "Call Center",
  chat_interno: "Chat Interno",
  formacoes: "Formações",
  questionarios: "Questionários",
  shelf_audit: "Shelf Audit",
  rag: "Pesquisa RAG",
  webhooks: "Webhooks / API",
  push_notifications: "Notificações Push",
};

const CAMPO_TIPO_LABELS: Record<string, string> = {
  text: "Texto",
  number: "Número",
  select: "Lista",
  boolean: "Sim/Não",
};

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

function StepIndicator({
  step,
  current,
  label,
}: {
  step: number;
  current: number;
  label: string;
}) {
  const done = current > step;
  const active = current === step;
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
          done
            ? "bg-emerald-500 text-white"
            : active
            ? "bg-violet-600 text-white ring-4 ring-violet-200 dark:ring-violet-900"
            : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
        }`}
      >
        {done ? <Check className="w-4 h-4" /> : step}
      </div>
      <span
        className={`text-sm font-medium hidden sm:block ${
          active
            ? "text-violet-700 dark:text-violet-300"
            : done
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-slate-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function WizardPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState<number | "">("");
  const [sector, setSector] = useState(SECTORES[0]);
  const [tipoEstudo, setTipoEstudo] = useState("Deixar para a IA decidir");
  const [briefing, setBriefing] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Step 2 state — AI result
  const [sugestao, setSugestao] = useState<WizardSugestao | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editCampos, setEditCampos] = useState<CampoConfig[]>([]);
  const [editGrelha, setEditGrelha] = useState<GrelhaConfig | null>(null);
  const [editModulos, setEditModulos] = useState<string[]>([]);

  // Step 3 state
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<{ estudo_id: number } | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    api.get<Cliente[]>("/clientes/").then(setClientes).catch(() => {});
  }, [router]);

  // ---- Step 1: submit briefing to AI ----
  async function handleGetSugestao() {
    if (!briefing.trim() || !clienteId) return;
    setLoadingAI(true);
    setAiError(null);
    try {
      const result = await api.post<WizardSugestao>("/wizard/sugestao", {
        briefing,
        sector,
        tipo_estudo: tipoEstudo === "Deixar para a IA decidir" ? "" : tipoEstudo,
      });
      setSugestao(result);
      setEditNome(result.nome_estudo);
      setEditCampos(result.campos ?? []);
      setEditGrelha(result.grelha ?? null);
      setEditModulos(result.modulos_sugeridos ?? []);
      setStep(2);
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "Erro ao contactar a IA.");
    } finally {
      setLoadingAI(false);
    }
  }

  // ---- Step 3: apply to DB ----
  async function handleAplicar() {
    if (!clienteId) return;
    setApplying(true);
    setApplyError(null);
    try {
      const result = await api.post<{ estudo_id: number }>("/wizard/aplicar", {
        cliente_id: clienteId,
        nome_estudo: editNome,
        campos: editCampos,
        grelha: editGrelha,
        modulos_sugeridos: editModulos,
      });
      setApplied(result);
      setStep(3);
    } catch (e: unknown) {
      setApplyError(e instanceof Error ? e.message : "Erro ao aplicar.");
    } finally {
      setApplying(false);
    }
  }

  // ---- Campo helpers ----
  function updateCampo(idx: number, patch: Partial<CampoConfig>) {
    setEditCampos((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function removeCampo(idx: number) {
    setEditCampos((prev) => prev.filter((_, i) => i !== idx));
  }
  function addCampo() {
    setEditCampos((prev) => [
      ...prev,
      { chave: `campo_${prev.length + 1}`, label: "Novo campo", tipo: "text", opcoes: [], obrigatorio: true },
    ]);
  }

  // ---- Grelha helpers ----
  function updateSecao(si: number, patch: Partial<Secao>) {
    if (!editGrelha) return;
    const secoes = editGrelha.secoes.map((s, i) => (i === si ? { ...s, ...patch } : s));
    setEditGrelha({ ...editGrelha, secoes });
  }
  function updateCriterio(si: number, ci: number, patch: Partial<Criterio>) {
    if (!editGrelha) return;
    const secoes = editGrelha.secoes.map((s, i) => {
      if (i !== si) return s;
      return { ...s, criterios: s.criterios.map((c, j) => (j === ci ? { ...c, ...patch } : c)) };
    });
    setEditGrelha({ ...editGrelha, secoes });
  }
  function removeCriterio(si: number, ci: number) {
    if (!editGrelha) return;
    const secoes = editGrelha.secoes.map((s, i) => {
      if (i !== si) return s;
      return { ...s, criterios: s.criterios.filter((_, j) => j !== ci) };
    });
    setEditGrelha({ ...editGrelha, secoes });
  }
  function addCriterio(si: number) {
    if (!editGrelha) return;
    const secoes = editGrelha.secoes.map((s, i) => {
      if (i !== si) return s;
      const n = s.criterios.length + 1;
      return { ...s, criterios: [...s.criterios, { label: `Critério ${n}`, peso: 0.1, tipo: "boolean" as const, ordem: n }] };
    });
    setEditGrelha({ ...editGrelha, secoes });
  }

  // ---- Render ----
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/30">
          <Wand2 className="w-6 h-6 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Wizard de Estudo com IA
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Descreve o que queres avaliar — a IA configura o estudo por ti.
          </p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-4 mb-8">
        <StepIndicator step={1} current={step} label="Briefing" />
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        <StepIndicator step={2} current={step} label={t("wizard.reviewEdit")} />
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        <StepIndicator step={3} current={step} label="Concluído" />
      </div>

      {/* ================================================================ STEP 1 */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
            {/* Client */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cliente *
              </label>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">— seleccionar cliente —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            {/* Sector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sector de Actividade *
                </label>
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {SECTORES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tipo de Estudo *
                </label>
                <select
                  value={tipoEstudo}
                  onChange={(e) => setTipoEstudo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {TIPOS_ESTUDO.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Briefing */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Briefing <span className="text-slate-400 font-normal">(descreve o que queres avaliar)</span> *
              </label>
              <textarea
                rows={6}
                value={briefing}
                onChange={(e) => setBriefing(e.target.value)}
                placeholder={BRIEFING_PLACEHOLDERS[sector] ?? BRIEFING_PLACEHOLDERS["Outro"]}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">{briefing.length} caracteres — quanto mais detalhe, melhor o resultado da IA.</p>
            </div>

            {aiError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {aiError}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleGetSugestao}
              disabled={!clienteId || !briefing.trim() || loadingAI}
              className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-colors"
            >
              {loadingAI ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  A gerar sugestão…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Gerar com IA
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ STEP 2 */}
      {step === 2 && sugestao && (
        <div className="space-y-6">
          {/* Justification banner */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
            <Info className="w-5 h-5 text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-violet-800 dark:text-violet-300 mb-0.5">{t("wizard.aiJustification")}</p>
              <p className="text-sm text-violet-700 dark:text-violet-400">{sugestao.justificacao}</p>
            </div>
          </div>

          {/* Study name */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nome do Estudo
            </label>
            <input
              type="text"
              value={editNome}
              onChange={(e) => setEditNome(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* CAMPOS */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <LayoutList className="w-5 h-5 text-slate-500" />
              <h2 className="font-semibold text-slate-800 dark:text-white">{t("wizard.characterizationFields")}</h2>
              <span className="ml-auto text-xs text-slate-400">{editCampos.length} campos</span>
            </div>
            <div className="space-y-3">
              {editCampos.map((campo, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                  <input
                    className="col-span-3 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
                    value={campo.chave}
                    onChange={(e) => updateCampo(idx, { chave: e.target.value })}
                    placeholder="chave"
                    title="Chave (identificador)"
                  />
                  <input
                    className="col-span-4 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
                    value={campo.label}
                    onChange={(e) => updateCampo(idx, { label: e.target.value })}
                    placeholder="label"
                    title="Label visível"
                  />
                  <select
                    className="col-span-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
                    value={campo.tipo}
                    onChange={(e) => updateCampo(idx, { tipo: e.target.value as CampoConfig["tipo"] })}
                    title={t("common.type")}
                  >
                    {Object.entries(CAMPO_TIPO_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <label className="col-span-2 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={campo.obrigatorio}
                      onChange={(e) => updateCampo(idx, { obrigatorio: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    Req.
                  </label>
                  <button
                    onClick={() => removeCampo(idx)}
                    className="col-span-1 text-red-400 hover:text-red-600 transition-colors flex justify-center"
                    title={t("common.removeField")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addCampo}
                className="flex items-center gap-1 text-violet-600 dark:text-violet-400 text-xs font-medium hover:text-violet-800 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar campo
              </button>
            </div>
          </div>

          {/* GRELHA */}
          {editGrelha && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-5 h-5 text-slate-500" />
                <h2 className="font-semibold text-slate-800 dark:text-white">{t("wizard.evaluationGrid")}</h2>
              </div>
              <div className="flex flex-wrap gap-3 mb-4">
                <input
                  className="flex-1 min-w-[180px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  value={editGrelha.nome}
                  onChange={(e) => setEditGrelha({ ...editGrelha, nome: e.target.value })}
                  placeholder={t("wizard.gridName")}
                />
                <select
                  className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  value={editGrelha.tipo_visita}
                  onChange={(e) => setEditGrelha({ ...editGrelha, tipo_visita: e.target.value })}
                >
                  {Object.entries(TIPO_VISITA_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                {editGrelha.secoes.map((secao, si) => (
                  <div key={si} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-700/50 px-4 py-2 flex items-center gap-3">
                      <input
                        className="flex-1 bg-transparent text-sm font-semibold text-slate-800 dark:text-white focus:outline-none"
                        value={secao.nome}
                        onChange={(e) => updateSecao(si, { nome: e.target.value })}
                      />
                      <label className="text-xs text-slate-500">Peso</label>
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        className="w-16 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs px-2 py-1 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                        value={secao.peso_secao}
                        onChange={(e) => updateSecao(si, { peso_secao: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                      {secao.criterios.map((crit, ci) => (
                        <div key={ci} className="flex items-center gap-2 px-4 py-2">
                          <input
                            className="flex-1 text-sm text-slate-800 dark:text-white bg-transparent focus:outline-none"
                            value={crit.label}
                            onChange={(e) => updateCriterio(si, ci, { label: e.target.value })}
                          />
                          <select
                            className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs px-2 py-1 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                            value={crit.tipo}
                            onChange={(e) => updateCriterio(si, ci, { tipo: e.target.value as Criterio["tipo"] })}
                          >
                            <option value="boolean">{t("wizard.trueOrFalse")}</option>
                            <option value="escala">Escala 0–5</option>
                            <option value="texto">Texto</option>
                          </select>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            className="w-16 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs px-2 py-1 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                            value={crit.peso}
                            onChange={(e) => updateCriterio(si, ci, { peso: parseFloat(e.target.value) || 0 })}
                            title="Peso"
                          />
                          <button
                            onClick={() => removeCriterio(si, ci)}
                            className="text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <div className="px-4 py-2">
                        <button
                          onClick={() => addCriterio(si)}
                          className="flex items-center gap-1 text-violet-600 dark:text-violet-400 text-xs font-medium hover:text-violet-800 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Adicionar critério
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MÓDULOS */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Puzzle className="w-5 h-5 text-slate-500" />
              <h2 className="font-semibold text-slate-800 dark:text-white">{t("wizard.suggestedModules")}</h2>
              <span className="text-xs text-slate-400 ml-1">(serão activados para o cliente)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(MODULO_LABELS).map(([key, label]) => {
                const active = editModulos.includes(key);
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm transition-colors ${
                      active
                        ? "bg-violet-50 border-violet-300 text-violet-800 dark:bg-violet-900/30 dark:border-violet-700 dark:text-violet-300"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) =>
                        setEditModulos((prev) =>
                          e.target.checked ? [...prev, key] : prev.filter((m) => m !== key)
                        )
                      }
                      className="rounded border-slate-300 accent-violet-600"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>

          {applyError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {applyError}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </button>
            <button
              onClick={handleAplicar}
              disabled={applying || !editNome.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-colors"
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  A criar estudo…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Aplicar e Criar Estudo
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ STEP 3 */}
      {step === 3 && applied && (
        <div className="text-center py-12 space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mx-auto flex items-center justify-center">
            <Check className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Estudo criado com sucesso!
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              O estudo <strong className="text-slate-700 dark:text-slate-200">{editNome}</strong> foi configurado e está pronto a usar.
            </p>
          </div>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => router.push(`/estudos`)}
              className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Ver Estudos
            </button>
            <button
              onClick={() => {
                setStep(1);
                setBriefing("");
                setSugestao(null);
                setApplied(null);
                setClienteId("");
              }}
              className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors"
            >
              <Wand2 className="w-4 h-4" />
              Novo Wizard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
