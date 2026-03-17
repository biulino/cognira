"use client";
/**
 * /configuracoes/permissoes — Role Navigation Permissions Editor
 * Admin-only. Configure which nav sections each role can access.
 * Changes are persisted via PUT /api/configuracoes/nav_permissoes and
 * picked up immediately by AppShell on next load.
 */
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, RotateCcw, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// ── Nav items (mirrors AppShell ALL_ITEMS) ─────────────────────────────────
const NAV_ITEMS = [
  // Principal
  { key: "dashboard",        label: "Dashboard",            group: "Principal" },
  { key: "estudos",          label: "Estudos",              group: "Principal" },
  { key: "visitas",          label: "Visitas",              group: "Principal" },
  { key: "mapa",             label: "Mapa",                 group: "Principal" },
  { key: "portal",           label: "Portal Cliente",       group: "Principal" },
  { key: "portal-mapa",      label: "Mapa Resultados",      group: "Principal" },
  // Operações
  { key: "analistas",        label: "Analistas",            group: "Operações" },
  { key: "clientes",         label: "Clientes",             group: "Operações" },
  { key: "estabelecimentos", label: "Estabelecimentos",     group: "Operações" },
  { key: "pagamentos",       label: "Pagamentos",           group: "Operações" },
  { key: "formacoes",        label: "Formações",            group: "Operações" },
  { key: "callcenter",       label: "Call Center",          group: "Operações" },
  { key: "wizard",           label: "Wizard de Estudo",     group: "Operações" },
  // Análise
  { key: "relatorios",       label: "Relatórios",           group: "Análise" },
  { key: "benchmarking",     label: "Benchmarking",         group: "Análise" },
  { key: "alertas",          label: "Alertas Score",        group: "Análise" },
  { key: "fraude",           label: "Fraud Detection",      group: "Análise" },
  { key: "sla",              label: "SLA Monitor",          group: "Análise" },
  { key: "pesquisa",         label: "Pesquisa RAG",         group: "Análise" },
  // Distribuição
  { key: "questionarios",    label: "Questionários",        group: "Distribuição" },
  { key: "qrcodes",          label: "QR Surveys",           group: "Distribuição" },
  { key: "ingest",           label: "Importar CSV",         group: "Distribuição" },
  { key: "barcode",          label: "Scanner Código",       group: "Distribuição" },
  { key: "shelf-audit",      label: "Shelf Audit",          group: "Distribuição" },
  { key: "planograma",       label: "Planogram Compliance", group: "Distribuição" },
  // Comunicação
  { key: "mensagens",        label: "Mensagens",            group: "Comunicação" },
  { key: "chat",             label: "Chat IA",              group: "Comunicação" },
  { key: "chat-interno",     label: "Chat Interno",         group: "Comunicação" },
  // Enterprise
  { key: "utilizadores",     label: "Utilizadores",         group: "Enterprise" },
  { key: "webhooks",         label: "API & Webhooks",       group: "Enterprise" },
  { key: "audit",            label: "Audit Log",            group: "Enterprise" },
  { key: "configuracoes",    label: "Configurações",        group: "Enterprise" },
  { key: "planos",           label: "Suites & Módulos",     group: "Enterprise" },
  { key: "branding",         label: "White-Label",          group: "Enterprise" },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"];

const ROLES = [
  { key: "admin",       label: "Admin",       color: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700" },
  { key: "coordenador", label: "Coordenador", color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700" },
  { key: "validador",   label: "Validador",   color: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700" },
  { key: "analista",    label: "Analista",    color: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700" },
  { key: "cliente",     label: "Cliente",     color: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700" },
] as const;
type RoleKey = (typeof ROLES)[number]["key"];

// Mirrors AppShell DEFAULT_NAV — single source of truth displayed here
const DEFAULT_CONFIG: Record<RoleKey, string[]> = {
  admin:       ["dashboard","estudos","visitas","analistas","clientes","estabelecimentos","pagamentos","relatorios","fraude","benchmarking","utilizadores","mensagens","chat","chat-interno","questionarios","formacoes","ingest","callcenter","configuracoes","branding","mapa","sla","pesquisa","alertas","qrcodes","webhooks","audit","barcode","shelf-audit","planos","wizard","planograma"],
  coordenador: ["dashboard","estudos","visitas","analistas","clientes","estabelecimentos","pagamentos","relatorios","fraude","benchmarking","mensagens","chat","chat-interno","questionarios","formacoes","ingest","callcenter","mapa","sla","pesquisa","alertas","qrcodes","barcode","shelf-audit","wizard","planograma"],
  validador:   ["dashboard","estudos","visitas","mensagens","chat","chat-interno","callcenter","mapa","pesquisa"],
  analista:    ["dashboard","visitas","mensagens","chat-interno","mapa","barcode","shelf-audit"],
  cliente:     ["portal","portal-mapa","chat","benchmarking","relatorios","mensagens"],
};

const GROUPS = ["Principal", "Operações", "Análise", "Distribuição", "Comunicação", "Enterprise"] as const;

function makeConfig(src: Record<string, string[]>): Record<RoleKey, Set<string>> {
  const c: Record<string, Set<string>> = {};
  for (const r of ROLES) c[r.key] = new Set(src[r.key] ?? DEFAULT_CONFIG[r.key]);
  return c as Record<RoleKey, Set<string>>;
}

export default function PermissoesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [config, setConfig] = useState<Record<RoleKey, Set<string>>>(() => makeConfig(DEFAULT_CONFIG));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const checkAccess = useCallback(async () => {
    const me = await api.get<{ role_global: string }>("/auth/me");
    if (me.role_global !== "admin") { router.replace("/dashboard"); return false; }
    return true;
  }, [router]);

  const loadConfig = useCallback(async () => {
    try {
      const res = await api.get<{ valor: Record<string, string[]> }>("/configuracoes/nav_permissoes");
      setConfig(makeConfig(res.valor ?? {}));
    } catch {
      // fallback to defaults (already set in useState)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAccess().then((ok) => { if (ok) loadConfig(); });
  }, [checkAccess, loadConfig]);

  function toggle(role: RoleKey, key: NavKey) {
    setConfig(prev => {
      const next = { ...prev };
      const set = new Set(prev[role]);
      if (set.has(key)) set.delete(key); else set.add(key);
      next[role] = set;
      return next;
    });
    setSaved(false);
  }

  function toggleAll(key: NavKey, forceOn?: boolean) {
    setConfig(prev => {
      const next = { ...prev };
      const anyOff = ROLES.some(r => !prev[r.key].has(key));
      for (const r of ROLES) {
        const set = new Set(prev[r.key]);
        if (forceOn ?? anyOff) set.add(key); else set.delete(key);
        next[r.key] = set;
      }
      return next;
    });
    setSaved(false);
  }

  function resetToDefaults() {
    setConfig(makeConfig(DEFAULT_CONFIG));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const val: Record<string, string[]> = {};
      for (const r of ROLES) val[r.key] = Array.from(config[r.key]);
      await api.put("/configuracoes/nav_permissoes", { valor: val, descricao: "Permissões de navegação por role" });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Erro ao guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const byGroup = GROUPS.map(g => ({
    label: g,
    items: NAV_ITEMS.filter(i => i.group === g),
  }));

  // Count per role for the header badge
  const counts = Object.fromEntries(ROLES.map(r => [r.key, config[r.key].size])) as Record<RoleKey, number>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Sticky header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/configuracoes"
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">Permissões de Navegação</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Configure o menu visível para cada papel de utilizador</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4" /> Guardado
              </span>
            )}
            {error && (
              <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" /> {error}
              </span>
            )}
            <button onClick={resetToDefaults}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Repor padrões
            </button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              <Save className="w-3.5 h-3.5" /> {saving ? "A guardar…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-2 sm:px-8 py-6">
        {/* Role header pills with item counts */}
        <div className="flex flex-wrap gap-2 mb-5">
          {ROLES.map(r => (
            <span key={r.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${r.color}`}>
              {r.label}
              <span className="opacity-60">— {counts[r.key]} items</span>
            </span>
          ))}
        </div>

        {/* Difference callout: coordenador vs validador */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-5 py-3 mb-5 text-sm text-blue-800 dark:text-blue-300">
          <strong>Coordenador vs Validador:</strong> por padrão, Coordenador acede a {counts["coordenador"]} secções (inclui Analistas, Clientes, Estabelecimentos, Pagamentos, etc.) enquanto Validador acede apenas a {counts["validador"]} (visitas, chat, mapa). Use a grelha abaixo para personalizar.
        </div>

        {/* Permissions grid */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-700">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-gray-400 w-48">Secção</th>
                  {ROLES.map(r => (
                    <th key={r.key} className="text-center px-3 py-3 font-semibold min-w-[90px]">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${r.color}`}>
                        {r.label}
                      </span>
                    </th>
                  ))}
                  <th className="text-center px-3 py-3 font-semibold text-gray-400 dark:text-gray-500 w-12 text-xs">Todos</th>
                </tr>
              </thead>
              <tbody>
                {byGroup.map(group => (
                  <>
                    <tr key={group.label}>
                      <td colSpan={ROLES.length + 2}
                        className="px-5 py-2 bg-gray-50/80 dark:bg-slate-800/30 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 border-t border-b border-gray-100 dark:border-slate-800">
                        {group.label}
                      </td>
                    </tr>
                    {group.items.map(item => {
                      const allOn = ROLES.every(r => config[r.key].has(item.key));
                      return (
                        <tr key={item.key} className="border-t border-gray-100 dark:border-slate-800 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors">
                          <td className="px-5 py-2.5 font-medium text-gray-800 dark:text-gray-200">{item.label}</td>
                          {ROLES.map(r => {
                            const on = config[r.key].has(item.key);
                            return (
                              <td key={r.key} className="text-center px-3 py-2.5">
                                <button
                                  onClick={() => toggle(r.key, item.key)}
                                  title={on ? `Remover ${r.label}` : `Adicionar ${r.label}`}
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-all
                                    ${on
                                      ? "bg-blue-600 border-blue-600"
                                      : "border-gray-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500"
                                    }`}>
                                  {on && (
                                    <svg viewBox="0 0 12 10" className="w-3 h-2 fill-none stroke-white stroke-2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M1 5l3 4L11 1" />
                                    </svg>
                                  )}
                                </button>
                              </td>
                            );
                          })}
                          {/* Toggle all */}
                          <td className="text-center px-3 py-2.5">
                            <button
                              onClick={() => toggleAll(item.key)}
                              title={allOn ? "Remover de todos" : "Adicionar a todos"}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-all
                                ${allOn
                                  ? "bg-slate-400 border-slate-400"
                                  : "border-gray-200 dark:border-slate-700 hover:border-slate-400"
                                }`}>
                              {allOn && (
                                <svg viewBox="0 0 12 10" className="w-3 h-2 fill-none stroke-white stroke-2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 5l3 4L11 1" />
                                </svg>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 text-center">
          ℹ️ Os módulos do plano do cliente limitam adicionalmente as secções visíveis, independentemente das permissões aqui definidas.
          As alterações aplicam-se no próximo carregamento de página do utilizador.
        </p>
      </div>
    </div>
  );
}
