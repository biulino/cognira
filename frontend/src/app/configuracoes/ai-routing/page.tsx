"use client";
/**
 * /configuracoes/ai-routing — Tenant AI Routing overrides.
 * Tenant-admin only (role_global="admin" + NOT is_superadmin).
 * Shows which provider from the platform pool handles each AI task for THIS tenant.
 * No API keys are ever shown here.
 */
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Brain, Save, ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SafeProvider {
  id: string;
  name: string;
  type: string;
  base_url: string;
  enabled: boolean;
  models: Record<string, string>;
}

type TaskKey = "chat" | "transcription" | "embeddings" | "vision" | "scoring";

// ── Constants ─────────────────────────────────────────────────────────────────

const TASKS: { key: TaskKey; label: string; description: string; icon: string }[] = [
  { key: "chat",          label: "Chat IA",         description: "Conversação e análise de dados via LLM",         icon: "💬" },
  { key: "transcription", label: "Transcrição",     description: "Speech-to-text para contact center",             icon: "🎤" },
  { key: "embeddings",    label: "Embeddings",      description: "Vectorização semântica para RAG e pesquisa",     icon: "🧠" },
  { key: "vision",        label: "Visão (Foto IA)", description: "Análise de imagem em visitas e planogramas",     icon: "📸" },
  { key: "scoring",       label: "Scoring",         description: "Avaliação automática de chamadas e visitas",     icon: "📊" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function AIRoutingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [providers, setProviders] = useState<SafeProvider[]>([]);
  const [routing, setRouting] = useState<Record<TaskKey, string | null>>({
    chat: null, transcription: null, embeddings: null, vision: null, scoring: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [noPool, setNoPool] = useState(false);

  const checkAccess = useCallback(async () => {
    const me = await api.get<{ role_global: string; is_superadmin?: boolean }>("/auth/me");
    if (me.role_global !== "admin" || me.is_superadmin === true) router.replace("/dashboard");
  }, [router]);

  useEffect(() => {
    checkAccess().then(async () => {
      try {
        const [poolRes, routingRes] = await Promise.all([
          api.get<{ providers: SafeProvider[] }>("/ai-providers/pool"),
          api.get<{ routing: Record<TaskKey, string | null> }>("/ai-providers/tenant-routing"),
        ]);
        const pool = poolRes.providers ?? [];
        setProviders(pool);
        setNoPool(pool.length === 0);
        setRouting(routingRes.routing ?? { chat: null, transcription: null, embeddings: null, vision: null, scoring: null });
      } catch {
        setError("Erro ao carregar configuração de IA.");
      } finally {
        setLoading(false);
      }
    });
  }, [checkAccess]);

  const setRoute = (task: TaskKey, providerId: string | null) => {
    setRouting(r => ({ ...r, [task]: providerId || null }));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await api.put<{ routing: Record<TaskKey, string | null> }>("/ai-providers/tenant-routing", { routing });
      setRouting(res.routing);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao guardar.");
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
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-700 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <Brain className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">Routing de IA</p>
              <p className="text-xs text-slate-400 mt-0.5">Preferências por tarefa</p>
            </div>
          </div>
          <button
            onClick={save}
            disabled={saving || noPool}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "A guardar…" : saved ? "Guardado!" : "Guardar"}
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 leading-relaxed">
            Escolha qual fornecedor de IA é utilizado para cada tarefa neste tenant. Os fornecedores disponíveis são geridos pela plataforma — as credenciais de acesso nunca são expostas aqui.
          </div>
        </div>

        {/* No pool warning */}
        {noPool && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <strong>{t("configuracoes.noProviders")}</strong> O administrador da plataforma ainda não configurou nenhum provider de IA. A plataforma usará a infraestrutura Cognira interna para todas as tarefas.
            </div>
          </div>
        )}

        {/* Routing table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Atribuição por tarefa</p>
          </div>
          <div className="divide-y divide-slate-100">
            {TASKS.map(task => {
              const selectedProvider = providers.find(p => p.id === routing[task.key]);
              return (
                <div key={task.key} className="flex items-center gap-4 px-5 py-4">
                  <span className="text-xl flex-shrink-0 w-8 text-center">{task.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{task.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{task.description}</p>
                    {selectedProvider && (
                      <p className="text-xs text-blue-600 mt-1 font-mono truncate">{selectedProvider.base_url}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 min-w-0 w-52">
                    <select
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      value={routing[task.key] ?? ""}
                      onChange={e => setRoute(task.key, e.target.value || null)}
                      disabled={noPool}
                    >
                      <option value="">Cognira Internal (padrão)</option>
                      {providers.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {selectedProvider?.models?.[task.key] && (
                      <p className="text-xs text-slate-400 mt-1 truncate px-1 font-mono">
                        {selectedProvider.models[task.key]}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Provider reference */}
        {providers.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fornecedores disponíveis</p>
            </div>
            <div className="divide-y divide-slate-100">
              {providers.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400 font-mono truncate">{p.base_url}</p>
                  </div>
                  <span className="text-xs text-slate-400 capitalize flex-shrink-0">{p.type?.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
