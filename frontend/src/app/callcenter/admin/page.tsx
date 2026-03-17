"use client";

import { useEffect, useState } from "react";
import { Settings, Plus, Edit2, Save, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Template {
  id: number;
  nome: string;
  descricao: string | null;
  cliente_id: number | null;
  campos: Campo[];
  activo: boolean;
  criado_em: string;
}

interface Campo {
  chave: string;
  label: string;
  tipo: "boolean" | "scale_5" | "number" | "text";
  peso: number;
}

interface Config {
  id: number;
  roles_upload: string[];
  max_ficheiro_mb: number;
  actualizado_em: string | null;
}

interface Cliente {
  id: number;
  nome: string;
}

const TIPO_OPTIONS = ["boolean", "scale_5", "number", "text"] as const;
const ALL_ROLES = ["admin", "coordenador", "validador", "utilizador"];

const blankCampo = (): Campo => ({ chave: "", label: "", tipo: "boolean", peso: 10 });

function CampoRow({
  campo,
  idx,
  onChange,
  onRemove,
}: {
  campo: Campo;
  idx: number;
  onChange: (idx: number, c: Campo) => void;
  onRemove: (idx: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-[1fr_1.2fr_100px_60px_32px] gap-2 items-center">
      <input
        value={campo.chave}
        onChange={e => onChange(idx, { ...campo, chave: e.target.value })}
        placeholder="chave_interna"
        className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono"
      />
      <input
        value={campo.label}
        onChange={e => onChange(idx, { ...campo, label: e.target.value })}
        placeholder="Etiqueta visível"
        className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
      />
      <select
        value={campo.tipo}
        onChange={e => onChange(idx, { ...campo, tipo: e.target.value as Campo["tipo"] })}
        className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
      >
        {TIPO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <input
        type="number"
        min={0}
        max={100}
        value={campo.peso}
        onChange={e => onChange(idx, { ...campo, peso: Number(e.target.value) })}
        className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-center"
      />
      <button
        type="button"
        onClick={() => onRemove(idx)}
        className="text-slate-400 hover:text-red-500 transition-colors"
        title={t("common.removeField")}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function TemplateForm({
  initial,
  clientes,
  onSave,
  onCancel,
}: {
  initial?: Template;
  clientes: Cliente[];
  onSave: (data: Partial<Template>) => Promise<void>;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState(initial?.nome ?? "");
  const { t } = useI18n();
  const [descricao, setDescricao] = useState(initial?.descricao ?? "");
  const [clienteId, setClienteId] = useState<string>(initial?.cliente_id ? String(initial.cliente_id) : "");
  const [campos, setCampos] = useState<Campo[]>(initial?.campos ?? [blankCampo()]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function updateCampo(idx: number, c: Campo) {
    setCampos(prev => prev.map((x, i) => i === idx ? c : x));
  }
  function removeCampo(idx: number) {
    setCampos(prev => prev.filter((_, i) => i !== idx));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!nome.trim()) { setErr("Nome obrigatório"); return; }
    setSaving(true);
    try {
      await onSave({
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        cliente_id: clienteId ? Number(clienteId) : undefined,
        campos,
      });
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Nome *</label>
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Cliente (opcional)</label>
          <select
            value={clienteId}
            onChange={e => setClienteId(e.target.value)}
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
          >
            <option value="">{t("callcenter.genericAll")}</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Descrição</label>
        <textarea
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          rows={2}
          className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
        />
      </div>

      {/* Campos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Campos de avaliação</label>
          <button
            type="button"
            onClick={() => setCampos(prev => [...prev, blankCampo()])}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar campo
          </button>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1.2fr_100px_60px_32px] gap-2 px-0.5">
            {["Chave", "Etiqueta", "Tipo", "Peso", ""].map(h => (
              <span key={h} className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{h}</span>
            ))}
          </div>
          {campos.map((c, i) => (
            <CampoRow key={i} campo={c} idx={i} onChange={updateCampo} onRemove={removeCampo} />
          ))}
          {campos.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-3">Sem campos. Clica em &quot;Adicionar campo&quot; para começar.</p>
          )}
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {err}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "A guardar…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

export default function CallCenterAdminPage() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Template form state
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Config edit state
  const [editConfig, setEditConfig] = useState(false);
  const [cfgRoles, setCfgRoles] = useState<string[]>([]);
  const [cfgMaxMb, setCfgMaxMb] = useState(100);
  const [savingCfg, setSavingCfg] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [t, cfg, c] = await Promise.all([
        api.get<Template[]>("/callcenter/templates"),
        api.get<Config>("/callcenter/configuracao"),
        api.get<Cliente[]>("/clientes/"),
      ]);
      setTemplates(t);
      setConfig(cfg);
      setCfgRoles(cfg.roles_upload);
      setCfgMaxMb(cfg.max_ficheiro_mb);
      setClientes(c);
    } catch (ex: unknown) {
      setError(ex instanceof Error ? ex.message : "Sem permissão ou erro de servidor");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function flash(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 4000);
  }

  async function createTemplate(data: Partial<Template>) {
    await api.post("/callcenter/templates", data);
    flash("Template criado com sucesso");
    setShowCreate(false);
    load();
  }

  async function updateTemplate(id: number, data: Partial<Template>) {
    await api.put(`/callcenter/templates/${id}`, data);
    flash("Template actualizado com sucesso");
    setEditingId(null);
    load();
  }

  async function saveConfig() {
    setSavingCfg(true);
    try {
      const updated = await api.put<Config>("/callcenter/configuracao", {
        roles_upload: cfgRoles,
        max_ficheiro_mb: cfgMaxMb,
      });
      setConfig(updated);
      setEditConfig(false);
      flash("Configuração guardada");
    } catch (ex: unknown) {
      setError(ex instanceof Error ? ex.message : "Erro ao guardar configuração");
    } finally {
      setSavingCfg(false);
    }
  }

  function toggleRole(role: string) {
    setCfgRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Administração Call Center</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gerir templates de avaliação e configuração do módulo
          </p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-700 dark:text-emerald-400 text-sm border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400 text-sm border border-red-200 dark:border-red-800">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error} — Esta página requer role <code className="font-mono bg-red-100 dark:bg-red-900/30 px-1 rounded">admin</code> ou <code className="font-mono bg-red-100 dark:bg-red-900/30 px-1 rounded">coordenador</code>.
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 dark:text-slate-500 animate-pulse">A carregar…</div>
      ) : (
        <>
          {/* ── CONFIGURAÇÃO ─────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Configuração Global</h2>
              {!editConfig && (
                <button
                  onClick={() => { setEditConfig(true); if (config) { setCfgRoles(config.roles_upload); setCfgMaxMb(config.max_ficheiro_mb); } }}
                  className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <Edit2 className="w-4 h-4" /> Editar
                </button>
              )}
            </div>

            {config && !editConfig && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Roles com permissão de upload</p>
                  <div className="flex flex-wrap gap-2">
                    {config.roles_upload.map(r => (
                      <span key={r} className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Tamanho máx. ficheiro</p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{config.max_ficheiro_mb} <span className="text-sm font-normal text-slate-500">MB</span></p>
                </div>
              </div>
            )}

            {editConfig && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Roles com permissão de upload</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_ROLES.map(role => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          cfgRoles.includes(role)
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-indigo-400"
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tamanho máx. (MB)</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={cfgMaxMb}
                    onChange={e => setCfgMaxMb(Number(e.target.value))}
                    className="w-32 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveConfig}
                    disabled={savingCfg}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {savingCfg ? "A guardar…" : "Guardar"}
                  </button>
                  <button
                    onClick={() => setEditConfig(false)}
                    className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ── TEMPLATES ────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                Templates de Avaliação
                <span className="ml-2 text-xs font-normal text-slate-400">({templates.length})</span>
              </h2>
              {!showCreate && (
                <button
                  onClick={() => { setShowCreate(true); setEditingId(null); }}
                  className="flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium"
                >
                  <Plus className="w-4 h-4" /> Novo Template
                </button>
              )}
            </div>

            {showCreate && (
              <div className="mb-4">
                <TemplateForm
                  clientes={clientes}
                  onSave={createTemplate}
                  onCancel={() => setShowCreate(false)}
                />
              </div>
            )}

            <div className="space-y-3">
              {templates.length === 0 && !showCreate && (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
                  Nenhum template criado ainda.
                </p>
              )}
              {templates.map(tmpl => (
                <div
                  key={tmpl.id}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                >
                  {editingId === tmpl.id ? (
                    <div className="p-4">
                      <TemplateForm
                        initial={tmpl}
                        clientes={clientes}
                        onSave={data => updateTemplate(tmpl.id, data)}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{tmpl.nome}</h3>
                            {tmpl.cliente_id && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                {clientes.find(c => c.id === tmpl.cliente_id)?.nome ?? `Cliente #${tmpl.cliente_id}`}
                              </span>
                            )}
                            {!tmpl.cliente_id && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                                Genérico
                              </span>
                            )}
                          </div>
                          {tmpl.descricao && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{tmpl.descricao}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {tmpl.campos.map(c => (
                              <span key={c.chave} className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                                {c.label} <span className="opacity-50">({c.tipo}, {c.peso}%)</span>
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => { setEditingId(tmpl.id); setShowCreate(false); }}
                          className="shrink-0 p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                          title={t("callcenter.editTemplate")}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
