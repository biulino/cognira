"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Save,
  RotateCcw,
  CheckCircle2,
  ShieldAlert,
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Users,
  Building2,
  CreditCard,
  BarChart3,
  ShieldCheck,
  MessageSquare,
  Upload,
  Phone,
  Briefcase,
  Webhook,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// ── Nav item definitions (must match AppShell) ────────────────────────────────
const NAV_ITEMS: { key: string; label: string; icon: React.ElementType; desc: string }[] = [
  { key: "dashboard",        label: "Dashboard",         icon: LayoutDashboard, desc: "Página inicial com métricas" },
  { key: "estudos",          label: "Estudos",           icon: BookOpen,        desc: "Lista de estudos de mercado" },
  { key: "visitas",          label: "Visitas",           icon: ClipboardList,   desc: "Gestão de visitas de campo" },
  { key: "analistas",        label: "Analistas",         icon: Users,           desc: "Equipa de campo" },
  { key: "clientes",         label: "Clientes",          icon: Briefcase,       desc: "Base de clientes" },
  { key: "estabelecimentos", label: "Estabelecimentos",  icon: Building2,       desc: "Pontos de venda" },
  { key: "pagamentos",       label: "Pagamentos",        icon: CreditCard,      desc: "Gestão financeira" },
  { key: "relatorios",       label: "Relatórios",        icon: BarChart3,       desc: "KPIs e relatórios" },
  { key: "utilizadores",     label: "Utilizadores",      icon: ShieldCheck,     desc: "Gestão de contas (admin only)" },
  { key: "chat",             label: "Chat IA",           icon: MessageSquare,   desc: "Assistente + logística" },
  { key: "ingest",           label: "Importar CSV",      icon: Upload,          desc: "Carga de dados em massa" },
  { key: "callcenter",       label: "Call Center",       icon: Phone,           desc: "Transcrição e análise de chamadas" },
  { key: "webhooks",          label: "API & Webhooks",    icon: Webhook,         desc: "Chaves API e webhooks" },
];

const ROLES = ["admin", "coordenador", "validador", "analista", "cliente"] as const;
type Role = typeof ROLES[number];

const ROLE_LABELS: Record<Role, string> = {
  admin:       "🛡️ Administrador",
  coordenador: "👥 Coordenador",
  validador:   "👁️ Validador",
  analista:    "📋 Analista",
  cliente:     "💼 Cliente",
};

const ROLE_COLORS: Record<Role, string> = {
  admin:       "border-red-200 bg-red-50",
  coordenador: "border-blue-200 bg-blue-50",
  validador:   "border-yellow-200 bg-yellow-50",
  analista:    "border-green-200 bg-green-50",
  cliente:     "border-purple-200 bg-purple-50",
};

type NavPermissoes = Record<Role, string[]>;

export default function ConfiguracoesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [me, setMe] = useState<{ role_global: string } | null>(null);
  const [permissions, setPermissions] = useState<NavPermissoes | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [copyProtection, setCopyProtection] = useState(true);
  const [savingCopy, setSavingCopy] = useState(false);
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [savingSignup, setSavingSignup] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    Promise.all([
      api.get<{ role_global: string }>("/auth/me"),
      api.get<{ chave: string; valor: NavPermissoes }>("/configuracoes/nav_permissoes"),
      api.get<{ valor: boolean }>("/configuracoes/seguranca_copia").catch(() => ({ valor: true })),
      api.get<{ valor: boolean }>("/configuracoes/signup_enabled").catch(() => ({ valor: true })),
    ]).then(([m, cfg, cpCfg, signupCfg]) => {
      setMe(m);
      if (m.role_global !== "admin") { router.replace("/dashboard"); return; }
      setPermissions(cfg.valor as NavPermissoes);
      setCopyProtection(cpCfg.valor !== false);
      setSignupEnabled(signupCfg.valor !== false);
    }).catch(() => router.replace("/dashboard"))
      .finally(() => setLoading(false));
  }, [router]);

  const toggle = useCallback((role: Role, itemKey: string) => {
    setPermissions(prev => {
      if (!prev) return prev;
      const current = prev[role] ?? [];
      const next = current.includes(itemKey)
        ? current.filter(k => k !== itemKey)
        : [...current, itemKey];
      return { ...prev, [role]: next };
    });
    setSaved(false);
  }, []);

  const resetToDefaults = useCallback(async () => {
    try {
      const defaults = await api.get<NavPermissoes>("/configuracoes/nav/defaults");
      setPermissions(defaults);
      setSaved(false);
    } catch { /* ignore */ }
  }, []);

  const savePermissions = useCallback(async () => {
    if (!permissions) return;
    setSaving(true);
    setErr("");
    try {
      await api.put("/configuracoes/nav_permissoes", {
        valor: permissions,
        descricao: "Itens de navegação visíveis por role",
      });
      setSaved(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  }, [permissions]);

  if (loading || !me || !permissions) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[#2D6BEE]/30 border-t-[#2D6BEE] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-5 h-5 text-slate-500" />
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{t("configuracoes.title")}</h1>
          </div>
          <p className="text-slate-500 text-sm">Define quais os itens de navegação visíveis para cada role.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Repor padrão
          </button>
          <button
            onClick={savePermissions}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-[#2D6BEE] hover:bg-[#1A52CC] rounded-xl font-medium transition disabled:opacity-50"
          >
            {saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "A guardar…" : saved ? "Guardado" : t("common.save")}
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{err}</p>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-800">
        As alterações têm efeito imediato — na próxima navegação cada utilizador verá apenas os itens activos para o seu role.
      </div>

      {/* Security: Copy protection toggle */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-slate-900 text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-500" />
            Segurança de cópia
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Bloqueia DevTools (F12), clique direito e seleção de texto. Desativar para aceder ao modo de desenvolvimento.
          </p>
        </div>
        <button
          disabled={savingCopy}
          onClick={async () => {
            setSavingCopy(true);
            const newVal = !copyProtection;
            try {
              await api.put("/configuracoes/seguranca_copia", {
                valor: newVal,
                descricao: "Proteção anti-cópia e anti-devtools",
              });
              setCopyProtection(newVal);
            } catch { /* toast auto-fires */ }
            finally { setSavingCopy(false); }
          }}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-50 ${copyProtection ? "bg-emerald-500" : "bg-slate-200"}`}
        >
          <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${copyProtection ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>

      {/* Signup toggle */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-slate-900 text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            Registo público
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Permite que novos utilizadores se registem autonomamente na página de login. Desativar para modo convite-apenas.
          </p>
          {signupEnabled && (
            <a
              href="/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-[#2D6BEE] hover:underline"
            >
              Ver página de registo →
            </a>
          )}
        </div>
        <button
          disabled={savingSignup}
          onClick={async () => {
            setSavingSignup(true);
            const newVal = !signupEnabled;
            try {
              await api.put("/configuracoes/signup_enabled", {
                valor: newVal,
                descricao: "Registo público activo/inactivo",
              });
              setSignupEnabled(newVal);
            } catch { /* toast auto-fires */ }
            finally { setSavingSignup(false); }
          }}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-50 ${signupEnabled ? "bg-emerald-500" : "bg-slate-200"}`}
        >
          <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${signupEnabled ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>

      {/* Role grids */}
      <div className="grid gap-6">
        {ROLES.map(role => {
          const active = permissions[role] ?? [];
          return (
            <div key={role} className={`rounded-2xl border p-5 ${ROLE_COLORS[role]}`}>
              <h2 className="font-semibold text-slate-900 mb-4 text-base">{ROLE_LABELS[role]}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {NAV_ITEMS.map(item => {
                  const Icon = item.icon;
                  const on = active.includes(item.key);
                  // "dashboard" always forced on; "utilizadores" forced on for admin
                  const forced = item.key === "dashboard" || (item.key === "utilizadores" && role === "admin");
                  return (
                    <button
                      key={item.key}
                      onClick={() => !forced && toggle(role, item.key)}
                      disabled={forced}
                      title={item.desc}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition text-left border ${ 
                        on
                          ? "bg-white border-slate-300 text-slate-800 shadow-sm"
                          : "bg-white/40 border-slate-200/60 text-slate-400"
                      } ${forced ? "opacity-70 cursor-default" : "cursor-pointer hover:shadow"}`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${on ? "text-[#2D6BEE]" : "text-slate-300"}`} />
                      <span className="text-xs font-medium truncate">{item.label}</span>
                      <span className={`ml-auto w-2 h-2 rounded-full shrink-0 ${on ? "bg-emerald-400" : "bg-slate-200"}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
