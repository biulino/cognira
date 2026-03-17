"use client";
/**
 * /tenant-admin — Tenant Admin Panel
 * Guards: requires role_global="admin" AND is_superadmin=false
 * Provides a hub for tenant-level management (users, branding, modules, SLA, webhooks, audit).
 */
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users, Settings, Palette, Layers, ShieldAlert, Webhook, Activity,
  BarChart3, CreditCard, Building2, BellRing, ArrowRight,
  CheckCircle2, Clock, AlertTriangle, LogOut, ToggleLeft, ToggleRight, Brain, ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface TenantInfo {
  nome: string;
  nome_marca: string | null;
  slug: string;
  status: string;
  plano: { nome: string; max_utilizadores: number | null; max_clientes: number | null; max_visitas_mes: number | null } | null;
  trial_ends_at: string | null;
  cor_primaria: string | null;
  logo_url: string | null;
}

interface Stats {
  total_utilizadores: number;
  total_clientes: number;
  visitas_mes: number;
}

const QUICK_ACTIONS = [
  { href: "/tenant-admin/status", icon: Activity,   label: "Estado do Sistema",  desc: "Saúde dos serviços e subsistemas" },
  { href: "/utilizadores",    icon: Users,       label: "Utilizadores",      desc: "Gerir contas, roles e permissões" },
  { href: "/configuracoes",   icon: Settings,    label: "Configurações",     desc: "Permissões de navegação por role" },
  { href: "/configuracoes/branding", icon: Palette, label: "Branding",      desc: "Logo, cores e personalização" },
  { href: "/planos",          icon: Layers,      label: "Suites & Módulos",  desc: "Catálogo de módulos disponíveis" },
  { href: "/webhooks",        icon: Webhook,     label: "API & Webhooks",    desc: "Chaves de API e integrações" },
  { href: "/sla",             icon: BellRing,    label: "Monitor SLA",       desc: "Thresholds e alertas de SLA" },
  { href: "/audit",           icon: ShieldAlert, label: "Audit Log",         desc: "Registo de acções no tenant" },
  { href: "/pagamentos",      icon: CreditCard,  label: "Pagamentos",        desc: "Comissões e histórico financeiro" },
  { href: "/relatorios",      icon: BarChart3,   label: "Relatórios",        desc: "Exportações e análise de dados" },
  { href: "/clientes",        icon: Building2,   label: "Clientes",          desc: "Empresas-cliente no tenant" },
  { href: "/configuracoes/ai-routing", icon: Brain,        label: "Routing IA",       desc: "Escolher provider por tarefa de IA" },
  { href: "/configuracoes/permissoes", icon: ShieldCheck,  label: "Permissões Nav",   desc: "Gerir o que cada role pode ver" },
];

const STATUS_LABEL: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active:    { label: "Ativo",     color: "text-green-600 bg-green-50 border-green-200", icon: CheckCircle2 },
  trial:     { label: "Trial",     color: "text-amber-600 bg-amber-50 border-amber-200", icon: Clock },
  suspended: { label: "Suspenso",  color: "text-red-600 bg-red-50 border-red-200",       icon: AlertTriangle },
  cancelled: { label: "Cancelado", color: "text-slate-500 bg-slate-50 border-slate-200", icon: AlertTriangle },
};

export default function TenantAdminPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signupEnabled, setSignupEnabled] = useState<boolean | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);

  const checkAccess = useCallback(async () => {
    const me = await api.get<{ role_global: string; is_superadmin?: boolean }>("/auth/me");
    if (me.role_global !== "admin" || me.is_superadmin === true) {
      router.replace("/dashboard");
      return false;
    }
    return true;
  }, [router]);

  const fetchData = useCallback(async () => {
    try {
      const [t, u, c, v] = await Promise.all([
        api.get<TenantInfo>("/branding/tenant/me"),
        api.get<unknown[]>("/utilizadores/"),
        api.get<unknown[]>("/clientes/"),
        api.get<{ total: number; items: unknown[] }>("/visitas/"),
      ]);
      setTenant(t);
      // Load signup_enabled setting (defaults to true if not yet set)
      try {
        const cfg = await api.get<{ valor: boolean }>("/configuracoes/signup_enabled");
        setSignupEnabled(cfg.valor !== false);
      } catch {
        setSignupEnabled(true);
      }
      setStats({
        total_utilizadores: Array.isArray(u) ? u.length : 0,
        total_clientes: Array.isArray(c) ? c.length : 0,
        visitas_mes: (v as { total: number }).total ?? 0,
      });
    } catch {
      setError("Erro ao carregar dados do tenant.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAccess().then((ok) => { if (ok) fetchData(); });
  }, [checkAccess, fetchData]);

  const toggleSignup = async () => {
    if (signupLoading || signupEnabled === null) return;
    const newVal = !signupEnabled;
    setSignupLoading(true);
    try {
      await api.put("/configuracoes/signup_enabled", { valor: newVal });
      setSignupEnabled(newVal);
    } catch {
      setError("Erro ao atualizar configuração de registo.");
    } finally {
      setSignupLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const statusInfo = tenant ? STATUS_LABEL[tenant.status] ?? STATUS_LABEL.active : null;
  const StatusIcon = statusInfo?.icon ?? CheckCircle2;

  const trialEndsAt = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const daysLeft = trialEndsAt ? Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {tenant?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logo_url} alt="logo" className="h-7 w-auto" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                {tenant?.nome_marca?.[0] ?? tenant?.nome?.[0] ?? "T"}
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">{tenant?.nome_marca ?? tenant?.nome}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t("tenantAdmin.subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {statusInfo && (
              <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                <StatusIcon className="w-3 h-3" />
                {statusInfo.label}
                {daysLeft !== null && tenant?.status === "trial" && (
                  <span className="ml-1 opacity-70">· {daysLeft > 0 ? `${daysLeft}d` : "expirado"}</span>
                )}
              </span>
            )}
            <Link href="/dashboard" className="text-xs text-slate-500 hover:text-slate-700 transition-colors">
              ← App
            </Link>
            <button onClick={logout} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition-colors">
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
        )}

        {/* Tenant header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">{t("tenantAdmin.title")}</h1>
          <p className="text-slate-500 text-sm mt-1">
            Gerid o tenant <strong className="text-slate-700">{tenant?.nome}</strong>
            {tenant?.slug && <span className="ml-1 font-mono text-xs text-slate-400">#{tenant.slug}</span>}
          </p>
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 max-w-lg">
            <span className="mt-0.5 shrink-0">ℹ️</span>
            <span>Este painel gere <strong>este tenant</strong> — utilizadores, branding, módulos, SLA e integrações. Para gerir toda a plataforma (tenants, planos, providers de IA), aceda ao <strong>Painel de Plataforma</strong> com conta superadmin.</span>
          </div>
        </div>

        {/* KPI row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Utilizadores",   value: stats.total_utilizadores, icon: Users,      color: "text-blue-600",  bg: "bg-blue-50" },
              { label: "Clientes",       value: stats.total_clientes,     icon: Building2,  color: "text-violet-600",bg: "bg-violet-50" },
              { label: "Visitas este mês",value: stats.visitas_mes,       icon: BarChart3,  color: "text-green-600", bg: "bg-green-50" },
              { label: "Plano",          value: tenant?.plano?.nome ?? "—",icon: Layers,    color: "text-amber-600", bg: "bg-amber-50" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900 leading-none">{value}</p>
                  <p className="text-xs text-slate-400 mt-1">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Plan limits */}
        {tenant?.plano && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-8">
            <p className="text-sm font-semibold text-slate-700 mb-3">Limites do Plano — {tenant.plano.nome}</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-slate-400 text-xs mb-1">Utilizadores</p>
                <p className="font-semibold text-slate-800">
                  {stats?.total_utilizadores ?? "—"} / {tenant.plano.max_utilizadores ?? "∞"}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">Clientes</p>
                <p className="font-semibold text-slate-800">
                  {stats?.total_clientes ?? "—"} / {tenant.plano.max_clientes ?? "∞"}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">Visitas / mês</p>
                <p className="font-semibold text-slate-800">
                  {stats?.visitas_mes ?? "—"} / {tenant.plano.max_visitas_mes ?? "∞"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Signup toggle */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-8">
          <p className="text-sm font-semibold text-slate-700 mb-1">Registo de Novos Utilizadores</p>
          <p className="text-xs text-slate-400 mb-4">Controla se novos utilizadores podem criar conta na plataforma deste tenant.</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">
                {signupEnabled ? "Registo aberto" : "Registo fechado"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {signupEnabled
                  ? "Qualquer pessoa com acesso ao link pode registar-se."
                  : "Apenas convites manuais permitem criar conta."}
              </p>
            </div>
            <button
              onClick={toggleSignup}
              disabled={signupLoading || signupEnabled === null}
              className="flex items-center gap-2 text-sm font-semibold transition-colors disabled:opacity-40"
              aria-label="Alternar registo de utilizadores"
            >
              {signupEnabled ? (
                <ToggleRight className="w-9 h-9 text-blue-600" />
              ) : (
                <ToggleLeft className="w-9 h-9 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {/* Quick actions grid */}
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-4">{t("tenantAdmin.gestaoTenant")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {QUICK_ACTIONS.map(({ href, icon: Icon, label, desc }) => (
              <Link
                key={href}
                href={href}
                className="group bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-50 group-hover:bg-blue-50 border border-slate-200 group-hover:border-blue-200 flex items-center justify-center flex-shrink-0 transition-colors">
                  <Icon className="w-5 h-5 text-slate-500 group-hover:text-blue-600 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 flex-shrink-0 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
