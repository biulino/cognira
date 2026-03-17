"use client";
/**
 * /configuracoes/ai-providers — Multi-provider AI configuration
 * Admin-only. Configure LLM / transcription / embedding / vision providers
 * and route each AI task to the desired provider.
 */
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
  ArrowLeft,
  Copy,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProviderType = "openai_compat" | "anthropic" | "custom" | "q21_internal";

interface ProviderModels {
  chat?: string;
  transcription?: string;
  embeddings?: string;
  vision?: string;
  scoring?: string;
}

interface AIProvider {
  id: string;
  name: string;
  type: ProviderType;
  base_url: string;
  api_key: string;
  enabled: boolean;
  models: ProviderModels;
  notes?: string;
}

type TaskKey = "chat" | "transcription" | "embeddings" | "vision" | "scoring";

interface AIConfig {
  providers: AIProvider[];
  routing: Record<TaskKey, string | null>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PROVIDER_TYPES: { value: ProviderType; label: string; description: string; defaultUrl: string }[] = [
  {
    value: "q21_internal",
    label: "Cognira Internal",
    description: "Infraestrutura de IA gerida pela Cognira (padrão)",
    defaultUrl: "https://api.openai.com/v1",
  },
  {
    value: "openai_compat",
    label: "OpenAI Compatible",
    description: "Qualquer endpoint compatível com API OpenAI (vLLM, Ollama, Together, etc.)",
    defaultUrl: "https://api.openai.com/v1",
  },
  {
    value: "anthropic",
    label: "Anthropic",
    description: "Claude (claude-3-5-sonnet, claude-3-opus, etc.)",
    defaultUrl: "https://api.anthropic.com",
  },
  {
    value: "custom",
    label: "Custom HTTP",
    description: "Endpoint REST personalizado com API key",
    defaultUrl: "",
  },
];

const TASKS: { key: TaskKey; label: string; description: string; icon: string }[] = [
  { key: "chat",          label: "Chat IA",        description: "Conversação e análise de dados via LLM",         icon: "💬" },
  { key: "transcription", label: "Transcrição",    description: "Speech-to-text para contact center",             icon: "🎤" },
  { key: "embeddings",    label: "Embeddings",     description: "Vectorização semântica para RAG e pesquisa",     icon: "🧠" },
  { key: "vision",        label: "Visão (Foto IA)", description: "Análise de imagem em visitas e planogramas",    icon: "📸" },
  { key: "scoring",       label: "Scoring",        description: "Avaliação automática de chamadas e visitas",     icon: "📊" },
];

const EMPTY_PROVIDER = (): AIProvider => ({
  id: crypto.randomUUID(),
  name: "",
  type: "openai_compat",
  base_url: "https://api.openai.com/v1",
  api_key: "",
  enabled: true,
  models: {},
  notes: "",
});

const MASK = "••••••••";

// ── Component ─────────────────────────────────────────────────────────────────

export default function AIProvidersPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [config, setConfig] = useState<AIConfig>({ providers: [], routing: { chat: null, transcription: null, embeddings: null, vision: null, scoring: null } });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const checkAccess = useCallback(async () => {
    const me = await api.get<{ role_global: string; is_superadmin?: boolean }>("/auth/me");
    if (!me.is_superadmin) router.replace("/dashboard");
  }, [router]);

  useEffect(() => {
    checkAccess().then(async () => {
      try {
        const data = await api.get<AIConfig>("/ai-providers");
        setConfig(data);
      } catch {
        // First time: use defaults
      } finally {
        setLoading(false);
      }
    });
  }, [checkAccess]);

  const addProvider = () => {
    const p = EMPTY_PROVIDER();
    setConfig(c => ({ ...c, providers: [...c.providers, p] }));
    setExpandedId(p.id);
  };

  const removeProvider = (id: string) => {
    setConfig(c => ({
      ...c,
      providers: c.providers.filter(p => p.id !== id),
      routing: Object.fromEntries(
        Object.entries(c.routing).map(([k, v]) => [k, v === id ? null : v])
      ) as AIConfig["routing"],
    }));
  };

  const updateProvider = (id: string, patch: Partial<AIProvider>) => {
    setConfig(c => ({
      ...c,
      providers: c.providers.map(p => p.id === id ? { ...p, ...patch } : p),
    }));
  };

  const updateModel = (id: string, task: TaskKey, model: string) => {
    setConfig(c => ({
      ...c,
      providers: c.providers.map(p =>
        p.id === id ? { ...p, models: { ...p.models, [task]: model } } : p
      ),
    }));
  };

  const setRouting = (task: TaskKey, providerId: string | null) => {
    setConfig(c => ({ ...c, routing: { ...c.routing, [task]: providerId } }));
  };

  const handleTypeChange = (id: string, type: ProviderType) => {
    const def = PROVIDER_TYPES.find(t => t.value === type);
    updateProvider(id, { type, base_url: def?.defaultUrl ?? "" });
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const saved = await api.put<AIConfig>("/ai-providers", config);
      setConfig(saved);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao guardar configuração.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-700 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <Brain className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">Fornecedores de IA</p>
              <p className="text-xs text-slate-400 mt-0.5">Configuração multi-provider</p>
            </div>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "A guardar…" : saved ? "Guardado!" : "Guardar"}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 flex gap-3">
          <Brain className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 leading-relaxed">
            <strong>Infraestrutura de IA multi-provider.</strong> Configure os endpoints, API keys e modelos de cada fornecedor. Em seguida, atribua cada tarefa de IA (chat, transcrição, embeddings, visão, scoring) ao fornecedor desejado. As API keys são guardadas cifradas e mascaradas no ecrã.
          </div>
        </div>

        {/* Providers list */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Fornecedores</h2>
            <button
              onClick={addProvider}
              className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar fornecedor
            </button>
          </div>

          {config.providers.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center">
              <Brain className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-500">Nenhum fornecedor configurado</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">Adicione pelo menos um fornecedor para activar as funcionalidades de IA.</p>
              <button onClick={addProvider} className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                + Adicionar primeiro fornecedor
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {config.providers.map(provider => {
                const isExpanded = expandedId === provider.id;
                const showKey = showKeys[provider.id] ?? false;
                return (
                  <div key={provider.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    {/* Provider header row */}
                    <div
                      className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : provider.id)}
                    >
                      <button
                        onClick={e => { e.stopPropagation(); updateProvider(provider.id, { enabled: !provider.enabled }); }}
                        className="flex-shrink-0"
                        aria-label="Ativar/desativar"
                      >
                        {provider.enabled
                          ? <ToggleRight className="w-7 h-7 text-blue-600" />
                          : <ToggleLeft className="w-7 h-7 text-slate-400" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{provider.name || <span className="text-slate-400 italic">Sem nome</span>}</p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{PROVIDER_TYPES.find(t => t.value === provider.type)?.label} · {provider.base_url || "URL não definido"}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${
                        provider.enabled ? "text-green-600 bg-green-50 border-green-200" : "text-slate-500 bg-slate-50 border-slate-200"
                      }`}>
                        {provider.enabled ? "Activo" : "Inactivo"}
                      </span>
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                    </div>

                    {/* Expanded form */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Name */}
                          <div>
                            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Nome do fornecedor</label>
                            <input
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                              placeholder="ex: Cognira Internal, vLLM Prod, Anthropic..."
                              value={provider.name}
                              onChange={e => updateProvider(provider.id, { name: e.target.value })}
                            />
                          </div>
                          {/* Type */}
                          <div>
                            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tipo</label>
                            <select
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
                              value={provider.type}
                              onChange={e => handleTypeChange(provider.id, e.target.value as ProviderType)}
                            >
                              {PROVIDER_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                            <p className="text-xs text-slate-400 mt-1">{PROVIDER_TYPES.find(t => t.value === provider.type)?.description}</p>
                          </div>
                        </div>

                        {/* Base URL */}
                        <div>
                          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Base URL</label>
                          <input
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                            placeholder="https://api.example.com/v1"
                            value={provider.base_url}
                            onChange={e => updateProvider(provider.id, { base_url: e.target.value })}
                          />
                        </div>

                        {/* API Key */}
                        <div>
                          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">API Key</label>
                          <div className="flex gap-2">
                            <input
                              type={showKey ? "text" : "password"}
                              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                              placeholder="sk-..."
                              value={provider.api_key}
                              onChange={e => updateProvider(provider.id, { api_key: e.target.value })}
                            />
                            <button
                              onClick={() => setShowKeys(s => ({ ...s, [provider.id]: !s[provider.id] }))}
                              className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors"
                              title={showKey ? "Ocultar chave" : "Mostrar chave"}
                            >
                              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            {provider.api_key && provider.api_key !== MASK && (
                              <button
                                onClick={() => { navigator.clipboard.writeText(provider.api_key); }}
                                className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors"
                                title="Copiar"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1">Guardada encriptada. Mascarada após guardar.</p>
                        </div>

                        {/* Models per task */}
                        <div>
                          <label className="text-xs font-semibold text-slate-600 mb-2 block">Modelos por tarefa</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {TASKS.map(task => (
                              <div key={task.key} className="flex items-center gap-2">
                                <span className="text-base flex-shrink-0 w-6 text-center">{task.icon}</span>
                                <div className="flex-1">
                                  <input
                                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                    placeholder={`Modelo para ${task.label}`}
                                    value={provider.models[task.key] ?? ""}
                                    onChange={e => updateModel(provider.id, task.key, e.target.value)}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-slate-400 mt-2">Deixe em branco para usar o modelo padrão do fornecedor. Exemplo: <span className="font-mono">gpt-4.1-nano</span>, <span className="font-mono">claude-3-5-haiku</span>, <span className="font-mono">mistral-small</span>.</p>
                        </div>

                        {/* Notes */}
                        <div>
                          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Notas internas</label>
                          <textarea
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                            rows={2}
                            placeholder="Use para fins de produção, testes, etc."
                            value={provider.notes ?? ""}
                            onChange={e => updateProvider(provider.id, { notes: e.target.value })}
                          />
                        </div>

                        {/* Delete */}
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => removeProvider(provider.id)}
                            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remover fornecedor
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Task routing */}
        <section>
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Encaminhamento de tarefas</h2>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-500">Para cada tarefa de IA, seleccione qual o fornecedor a utilizar. Se nenhum estiver seleccionado, a plataforma usa a infraestrutura Cognira interna.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {TASKS.map(task => {
                const activeProviders = config.providers.filter(p => p.enabled);
                return (
                  <div key={task.key} className="flex items-center gap-4 px-5 py-3.5">
                    <span className="text-xl flex-shrink-0">{task.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{task.label}</p>
                      <p className="text-xs text-slate-400">{task.description}</p>
                    </div>
                    <select
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 min-w-[160px]"
                      value={config.routing[task.key] ?? ""}
                      onChange={e => setRouting(task.key, e.target.value || null)}
                    >
                      <option value="">Cognira Internal (padrão)</option>
                      {activeProviders.map(p => (
                        <option key={p.id} value={p.id}>{p.name || p.id.slice(0, 8)}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
