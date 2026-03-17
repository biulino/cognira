"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  PlusCircle,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  Send,
  Eye,
  ChevronRight,
  X,
  Mail,
  Loader2,
  Languages,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldType = "text" | "textarea" | "number" | "select" | "checkbox" | "scale" | "nps" | "csat";

interface Campo {
  id: string;
  tipo: FieldType;
  label: string;
  obrigatorio: boolean;
  opcoes?: string[]; // for select
}

interface JsonEstrutura {
  campos: Campo[];
}

interface Questionario {
  id: number;
  nome: string;
  estudo_id: number | null;
  versao: number;
  ativo: boolean;
  json_estrutura: JsonEstrutura;
  translations_json?: Record<string, { nome?: string; campos?: Record<string, string> }>;
  criado_em?: string;
}

type TranslationsState = Record<string, { nome?: string; campos?: Record<string, string> }>;

interface Submissao {
  id: number;
  visita_id: number | null;
  analista_id: number | null;
  json_respostas: Record<string, unknown>;
  criado_em: string;
}

interface Estudo {
  id: number;
  nome: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 8);
}

const SUPPORTED_LOCALES = [
  { code: "en", label: "EN 🇬🇧" },
  { code: "es", label: "ES 🇪🇸" },
  { code: "fr", label: "FR 🇫🇷" },
];

const FIELD_LABELS: Record<FieldType, string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  number: "Número",
  select: "Seleção",
  checkbox: "Sim / Não",
  scale: "Escala 1–5",
  nps: "NPS (0–10)",
  csat: "CSAT (1–5★)",
};

// ─── Campo editor ─────────────────────────────────────────────────────────────

function CampoEditor({
  campo,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  campo: Campo;
  index: number;
  total: number;
  onChange: (c: Campo) => void;
  onRemove: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const [opcoesText, setOpcoesText] = useState((campo.opcoes ?? []).join("\n"));

  function handleOpcoes(val: string) {
    setOpcoesText(val);
    onChange({ ...campo, opcoes: val.split("\n").map(s => s.trim()).filter(Boolean) });
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5 mr-1">
          <button onClick={() => onMove("up")} disabled={index === 0} className="text-slate-400 hover:text-slate-600 disabled:opacity-30">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onMove("down")} disabled={index === total - 1} className="text-slate-400 hover:text-slate-600 disabled:opacity-30">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
        <select
          value={campo.tipo}
          onChange={e => onChange({ ...campo, tipo: e.target.value as FieldType, opcoes: undefined })}
          className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
        >
          {(Object.keys(FIELD_LABELS) as FieldType[]).map(t => (
            <option key={t} value={t}>{FIELD_LABELS[t]}</option>
          ))}
        </select>
        <input
          value={campo.label}
          onChange={e => onChange({ ...campo, label: e.target.value })}
          placeholder="Etiqueta da pergunta"
          className="flex-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
        />
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={campo.obrigatorio}
            onChange={e => onChange({ ...campo, obrigatorio: e.target.checked })}
            className="rounded"
          />
          Obrig.
        </label>
        <button onClick={onRemove} className="text-red-400 hover:text-red-600 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {campo.tipo === "select" && (
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Opções (uma por linha)</label>
          <textarea
            rows={3}
            value={opcoesText}
            onChange={e => handleOpcoes(e.target.value)}
            placeholder={"Opção 1\nOpção 2\nOpção 3"}
            className="w-full text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 resize-none"
          />
        </div>
      )}
    </div>
  );
}

// ─── Formulário de submissão ──────────────────────────────────────────────────

function SubmissaoForm({ q, onClose }: { q: Questionario; onClose: () => void }) {
  const toast = useToast();
  const [respostas, setRespostas] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Validate required
    for (const c of q.json_estrutura.campos) {
      if (c.obrigatorio) {
        const val = respostas[c.id];
        if (val === undefined || val === "" || val === null) {
          toast.error("Campo obrigatório", `Preencha "${c.label}"`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      await api.post(`/questionarios/${q.id}/submissoes`, { json_respostas: respostas });
      toast.success("Submetido", "Respostas guardadas com sucesso");
      onClose();
    } catch (e: unknown) {
      toast.error("Erro", (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-white">{q.nome}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {q.json_estrutura.campos.map(campo => (
            <div key={campo.id}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                {campo.label}
                {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
              </label>
              {campo.tipo === "text" && (
                <input type="text" value={(respostas[campo.id] as string) ?? ""} onChange={e => setRespostas(r => ({ ...r, [campo.id]: e.target.value }))}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100" />
              )}
              {campo.tipo === "number" && (
                <input type="number" value={(respostas[campo.id] as string) ?? ""} onChange={e => setRespostas(r => ({ ...r, [campo.id]: e.target.value }))}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100" />
              )}
              {campo.tipo === "textarea" && (
                <textarea rows={3} value={(respostas[campo.id] as string) ?? ""} onChange={e => setRespostas(r => ({ ...r, [campo.id]: e.target.value }))}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 resize-none" />
              )}
              {campo.tipo === "select" && (
                <select value={(respostas[campo.id] as string) ?? ""} onChange={e => setRespostas(r => ({ ...r, [campo.id]: e.target.value }))}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                  <option value="">— escolher —</option>
                  {(campo.opcoes ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
              {campo.tipo === "checkbox" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!respostas[campo.id]} onChange={e => setRespostas(r => ({ ...r, [campo.id]: e.target.checked }))}
                    className="w-4 h-4 rounded" />
                  <span className="text-sm text-slate-600 dark:text-slate-300">Sim</span>
                </label>
              )}
              {campo.tipo === "scale" && (
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button"
                      onClick={() => setRespostas(r => ({ ...r, [campo.id]: String(n) }))}
                      className={`w-10 h-10 rounded-xl border-2 text-sm font-semibold transition-colors ${
                        respostas[campo.id] === String(n)
                          ? "border-indigo-500 bg-indigo-500 text-white"
                          : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-indigo-300"
                      }`}>{n}</button>
                  ))}
                </div>
              )}
              {campo.tipo === "csat" && (
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button"
                      onClick={() => setRespostas(r => ({ ...r, [campo.id]: String(n) }))}
                      className={`text-2xl transition-colors ${
                        Number(respostas[campo.id] ?? 0) >= n ? "text-amber-400" : "text-slate-200 dark:text-slate-600"
                      }`}>★</button>
                  ))}
                </div>
              )}
              {campo.tipo === "nps" && (
                <div>
                  <div className="flex gap-1 flex-wrap">
                    {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                      <button key={n} type="button"
                        onClick={() => setRespostas(r => ({ ...r, [campo.id]: String(n) }))}
                        className={`w-9 h-9 rounded-lg border-2 text-xs font-semibold transition-colors ${
                          respostas[campo.id] === String(n)
                            ? "border-indigo-500 bg-indigo-500 text-white"
                            : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-indigo-300"
                        }`}>{n}</button>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-1 px-0.5">
                    <span>Muito prov\u00e1vel</span><span>N\u00e3o recomendaria</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </form>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Cancelar
          </button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-70">
            <Send className="w-4 h-4" />
            {saving ? "A submeter…" : "Submeter"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuestionariosPage() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [role, setRole] = useState<string>("");
  const [estudos, setEstudos] = useState<Estudo[]>([]);
  const [studoId, setStudoId] = useState<string>("");
  const [questionarios, setQuestionarios] = useState<Questionario[]>([]);
  const [loading, setLoading] = useState(true);

  // Builder state
  const [showBuilder, setShowBuilder] = useState(false);
  const [editing, setEditing] = useState<Questionario | null>(null);
  const [nome, setNome] = useState("");
  const [campos, setCampos] = useState<Campo[]>([]);
  const [saving, setSaving] = useState(false);

  // Submissões
  const [viewSubs, setViewSubs] = useState<Questionario | null>(null);
  const [submissoes, setSubmissoes] = useState<Submissao[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);

  // Submit form
  const [submitQ, setSubmitQ] = useState<Questionario | null>(null);

  // Email distribution
  const [emailModal, setEmailModal] = useState<Questionario | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailAssunto, setEmailAssunto] = useState("");
  const [emailMensagem, setEmailMensagem] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  // Translations (8.9)
  const [builderTab, setBuilderTab] = useState<"campos" | "traducoes">("campos");
  const [selectedLocale, setSelectedLocale] = useState("en");
  const [translations, setTranslations] = useState<TranslationsState>({});
  const [savingT, setSavingT] = useState(false);

  async function sendEmails() {
    if (!emailModal) return;
    const emails = emailInput.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
    if (emails.length === 0) { toast.error("Erro", "Introduz pelo menos um email"); return; }
    setEmailSending(true);
    try {
      const res = await api.post<{ enviados: number; erros: { email: string; erro: string }[] }>(
        `/questionarios/${emailModal.id}/enviar-email`,
        { emails, assunto: emailAssunto || undefined, mensagem: emailMensagem || undefined },
      );
      toast.success("Enviado", `${res.enviados} email(s) enviado(s)${res.erros.length ? ` · ${res.erros.length} erro(s)` : ""}`);
      if (res.erros.length === 0) {
        setEmailModal(null);
        setEmailInput("");
        setEmailAssunto("");
        setEmailMensagem("");
      }
    } catch (e: unknown) {
      toast.error("Erro SMTP", (e as Error).message);
    } finally {
      setEmailSending(false);
    }
  }

  const loadQuestionarios = useCallback(async () => {
    setLoading(true);
    try {
      const params = studoId ? `?estudo_id=${studoId}` : "";
      const data = await api.get<Questionario[]>(`/questionarios/${params}`);
      setQuestionarios(data);
    } catch (e: unknown) {
      toast.error("Erro", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [studoId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    // Role may be cached in localStorage (set by AppShell) or fetched fresh
    const cached = localStorage.getItem("role");
    if (cached) {
      setRole(cached);
    } else {
      api.get<{ role_global: string; permissoes?: { estudo_id: number; role: string }[] }>("/auth/me")
        .then(me => {
          const g = me.role_global ?? "";
          let effective = g;
          if (g === "utilizador" || g === "") {
            const roles = (me.permissoes ?? []).map(p => p.role);
            if (roles.includes("coordenador")) effective = "coordenador";
            else if (roles.includes("analista")) effective = "analista";
            else if (roles.includes("validador")) effective = "validador";
            else if (roles.includes("cliente")) effective = "cliente";
          }
          setRole(effective);
          localStorage.setItem("role", effective);
        }).catch(() => {});
    }
    api.get<Estudo[]>("/estudos/?page_size=200").then(setEstudos).catch(() => {});
    loadQuestionarios();
  }, [router, loadQuestionarios]);

  function openBuilder(q?: Questionario) {
    if (q) {
      setEditing(q);
      setNome(q.nome);
      setCampos(q.json_estrutura.campos.map(c => ({ ...c })));
      setTranslations(q.translations_json || {});
    } else {
      setEditing(null);
      setNome("");
      setCampos([]);
      setTranslations({});
    }
    setBuilderTab("campos");
    setSelectedLocale("en");
    setShowBuilder(true);
  }

  async function saveTranslations() {
    if (!editing) return;
    setSavingT(true);
    try {
      await api.put(`/questionarios/${editing.id}/translations`, { translations_json: translations });
      toast.success("Traduções", "Traduções guardadas com sucesso");
    } catch (e: unknown) {
      toast.error("Erro", (e as Error).message);
    } finally {
      setSavingT(false);
    }
  }

  function setLocaleField(locale: string, field: string, value: string) {
    setTranslations(prev => ({ ...prev, [locale]: { ...prev[locale], [field]: value } }));
  }

  function setLocaleFieldCampo(locale: string, campoId: string, value: string) {
    setTranslations(prev => ({
      ...prev,
      [locale]: { ...prev[locale], campos: { ...(prev[locale]?.campos || {}), [campoId]: value } },
    }));
  }

  function addCampo(tipo: FieldType) {
    setCampos(cs => [...cs, { id: uid(), tipo, label: "", obrigatorio: false }]);
  }

  function moveCampo(i: number, dir: "up" | "down") {
    setCampos(cs => {
      const arr = [...cs];
      const j = dir === "up" ? i - 1 : i + 1;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  }

  async function saveQuestionario() {
    if (!nome.trim()) { toast.error("Validação", "Nome obrigatório"); return; }
    setSaving(true);
    try {
      const body = {
        nome: nome.trim(),
        estudo_id: studoId ? Number(studoId) : null,
        json_estrutura: { campos },
      };
      if (editing) {
        await api.put(`/questionarios/${editing.id}`, body);
        toast.success("Guardado", "Questionário actualizado");
      } else {
        await api.post("/questionarios/", body);
        toast.success("Criado", "Novo questionário criado");
      }
      setShowBuilder(false);
      loadQuestionarios();
    } catch (e: unknown) {
      toast.error("Erro", (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteQ(q: Questionario) {
    if (!confirm(`Eliminar "${q.nome}"?`)) return;
    try {
      await api.delete(`/questionarios/${q.id}`);
      toast.success("Eliminado", q.nome);
      loadQuestionarios();
    } catch (e: unknown) {
      toast.error("Erro", (e as Error).message);
    }
  }

  async function openSubs(q: Questionario) {
    setViewSubs(q);
    setSubsLoading(true);
    try {
      const data = await api.get<Submissao[]>(`/questionarios/${q.id}/submissoes`);
      setSubmissoes(data);
    } catch (e: unknown) {
      toast.error("Erro", (e as Error).message);
    } finally {
      setSubsLoading(false);
    }
  }

  const canManage = role === "admin" || role === "coordenador";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
            <ClipboardCheck className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("questionarios.title")}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Formulários dinâmicos para visitas de campo</p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => openBuilder()}
            className="flex items-center gap-2 bg-violet-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-violet-700 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Novo questionário
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-5">
        <select
          value={studoId}
          onChange={e => setStudoId(e.target.value)}
          className="text-sm border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
        >
          <option value="">{t("questionarios.allStudies")}</option>
          {estudos.map(e => <option key={e.id} value={String(e.id)}>{e.nome}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : questionarios.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
          <ClipboardCheck className="w-8 h-8" />
          <p className="text-sm">{t("questionarios.noQuestionarios")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {questionarios.map(q => (
            <div key={q.id}
              className="flex items-center gap-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{q.nome}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    q.ativo ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-slate-100 text-slate-400 dark:bg-slate-700"
                  }`}>{q.ativo ? "activo" : "inactivo"}</span>
                  <span className="text-xs text-slate-400 shrink-0">v{q.versao}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{q.json_estrutura.campos.length} campo(s)</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setSubmitQ(q)}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 px-2 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Submeter
                </button>
                {canManage && (
                  <>
                    <button
                      onClick={() => { setEmailModal(q); setEmailAssunto(`Questionário: ${q.nome}`); setEmailInput(""); setEmailMensagem(""); }}
                      className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 px-2 py-1.5 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Email
                    </button>
                    <button
                      onClick={() => openSubs(q)}
                      className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Ver
                    </button>
                    <button
                      onClick={() => openBuilder(q)}
                      className="text-xs text-violet-600 hover:text-violet-700 px-2 py-1.5 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors flex items-center gap-1"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      onClick={() => deleteQ(q)}
                      className="text-xs text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Builder modal ─────────────────────────────────────────────────── */}
      {showBuilder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-800 dark:text-white">
                {editing ? "Editar questionário" : "Novo questionário"}
              </h2>
              <button onClick={() => setShowBuilder(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            {/* Tab bar */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 px-5">
              <button
                onClick={() => setBuilderTab("campos")}
                className={`text-sm px-4 py-2.5 font-medium border-b-2 transition-colors -mb-px ${builderTab === "campos" ? "border-violet-600 text-violet-700 dark:text-violet-400" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              >Campos</button>
              {editing && (
                <button
                  onClick={() => setBuilderTab("traducoes")}
                  className={`flex items-center gap-1.5 text-sm px-4 py-2.5 font-medium border-b-2 transition-colors -mb-px ${builderTab === "traducoes" ? "border-violet-600 text-violet-700 dark:text-violet-400" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                >
                  <Languages className="w-3.5 h-3.5" />
                  Traduções
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {builderTab === "campos" ? (
                <>
                  {/* Nome */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Nome do questionário</label>
                    <input value={nome} onChange={e => setNome(e.target.value)} placeholder={t("questionarios.namePlaceholder")}
                      className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100" />
                  </div>
                  {/* Campos */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Campos ({campos.length})</label>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {(["text", "textarea", "number", "select", "checkbox", "scale", "nps", "csat"] as FieldType[]).map(t => (
                          <button key={t} onClick={() => addCampo(t)}
                            className="text-xs px-2 py-1 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 hover:bg-violet-100 transition-colors">
                            + {FIELD_LABELS[t].split(" ")[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                    {campos.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                        Adicione campos acima
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {campos.map((c, i) => (
                          <CampoEditor key={c.id} campo={c} index={i} total={campos.length}
                            onChange={nc => setCampos(cs => cs.map((x, j) => j === i ? nc : x))}
                            onRemove={() => setCampos(cs => cs.filter((_, j) => j !== i))}
                            onMove={dir => moveCampo(i, dir)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* ── Translations tab ── */
                <div className="space-y-4">
                  <p className="text-xs text-slate-500">Define traduções para cada idioma. O português (PT) é a língua base — edita-o na tab Campos.</p>
                  {/* Locale selector */}
                  <div className="flex gap-2">
                    {SUPPORTED_LOCALES.map(loc => (
                      <button
                        key={loc.code}
                        onClick={() => setSelectedLocale(loc.code)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          selectedLocale === loc.code
                            ? "bg-violet-600 text-white"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >{loc.label}</button>
                    ))}
                  </div>
                  {/* Name translation */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Nome do questionário</label>
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-slate-400 w-36 shrink-0 truncate">PT: {nome || "—"}</span>
                      <input
                        value={translations[selectedLocale]?.nome ?? ""}
                        onChange={e => setLocaleField(selectedLocale, "nome", e.target.value)}
                        placeholder={`Tradução em ${SUPPORTED_LOCALES.find(l => l.code === selectedLocale)?.label ?? selectedLocale}…`}
                        className="flex-1 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                  {/* Field label translations */}
                  {campos.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Perguntas ({campos.length})</label>
                      <div className="space-y-2">
                        {campos.map(c => (
                          <div key={c.id} className="flex gap-2 items-center">
                            <span className="text-xs text-slate-400 w-36 shrink-0 truncate" title={c.label}>PT: {c.label || "(sem etiqueta)"}</span>
                            <input
                              value={translations[selectedLocale]?.campos?.[c.id] ?? ""}
                              onChange={e => setLocaleFieldCampo(selectedLocale, c.id, e.target.value)}
                              placeholder={`Tradução de "${c.label || c.id}"…`}
                              className="flex-1 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setShowBuilder(false)}
                className="text-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Cancelar
              </button>
              {builderTab === "campos" ? (
                <button onClick={saveQuestionario} disabled={saving || !nome.trim()}
                  className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-70">
                  <Save className="w-4 h-4" />
                  {saving ? "A guardar…" : "Guardar"}
                </button>
              ) : (
                <button onClick={saveTranslations} disabled={savingT}
                  className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-70">
                  <Languages className="w-4 h-4" />
                  {savingT ? "A guardar…" : "Guardar Traduções"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Submissões modal ──────────────────────────────────────────────── */}
      {viewSubs && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-800 dark:text-white">
                Submissões — {viewSubs.nome}
              </h2>
              <button onClick={() => setViewSubs(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4">
              {subsLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />)}
                </div>
              ) : submissoes.length === 0 ? (
                <div className="text-center text-slate-400 py-10 text-sm">{t("questionarios.noSubmissions")}</div>
              ) : (
                <div className="space-y-3">
                  {submissoes.map(s => (
                    <details key={s.id} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl group">
                      <summary className="px-4 py-2.5 cursor-pointer text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform" />
                        <span className="font-medium">Submissão #{s.id}</span>
                        <span className="text-slate-400 text-xs ml-auto">{new Date(s.criado_em).toLocaleString("pt-PT")}</span>
                      </summary>
                      <div className="px-4 pb-3">
                        <pre className="text-xs bg-slate-100 dark:bg-slate-900 rounded-lg p-3 overflow-x-auto text-slate-600 dark:text-slate-300">
                          {JSON.stringify(s.json_respostas, null, 2)}
                        </pre>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Submit form modal ────────────────────────────────────────────── */}
      {submitQ && <SubmissaoForm q={submitQ} onClose={() => setSubmitQ(null)} />}

      {/* ─── Email distribution modal (8A.2) ─────────────────────────────── */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-sky-600" />
                <h2 className="text-base font-semibold text-slate-800 dark:text-white">Enviar por Email — {emailModal.nome}</h2>
              </div>
              <button onClick={() => setEmailModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Destinatários (um por linha ou separados por vírgula)</label>
                <textarea
                  rows={4}
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder={"exemplo@empresa.pt\noutro@empresa.pt"}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Assunto</label>
                <input
                  value={emailAssunto}
                  onChange={e => setEmailAssunto(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Mensagem personalizada (opcional)</label>
                <textarea
                  rows={2}
                  value={emailMensagem}
                  onChange={e => setEmailMensagem(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 resize-none"
                />
              </div>
              <p className="text-xs text-slate-400">O email incluirá um link directo para o questionário. Requer SMTP configurado em Configurações do Sistema.</p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setEmailModal(null)} className="text-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={sendEmails} disabled={emailSending || !emailInput.trim()}
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition-colors disabled:opacity-70">
                {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {emailSending ? "A enviar…" : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
