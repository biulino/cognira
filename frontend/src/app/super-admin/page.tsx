"use client";
/**
 * /super-admin — Super Admin Platform Dashboard
 * Guards: requires is_superadmin=true
 */
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

interface Stats {
  total_tenants: number;
  active_tenants: number;
  trial_tenants: number;
  suspended_tenants: number;
  total_users: number;
  mrr: number;
}

interface Plan {
  id: number;
  nome: string;
  codigo: string;
  preco_mensal: number;
}

interface Tenant {
  id: number;
  slug: string;
  nome: string;
  nome_marca: string | null;
  status: string;
  plano: Plan | null;
  trial_ends_at: string | null;
  owner_nome: string;
  owner_email: string;
  pais: string | null;
  criado_em: string;
  utilizadores_count?: number;
  notas?: string;
}

interface Superuser {
  id: number;
  username: string;
  activo: boolean;
}

type Tab = "dashboard" | "tenants" | "plans" | "superusers";

const STATUS_STYLES: Record<string, string> = {
  active:    "bg-green-500/20 text-green-300 border-green-500/30",
  trial:     "bg-amber-500/20 text-amber-300 border-amber-500/30",
  suspended: "bg-red-500/20 text-red-300 border-red-500/30",
  cancelled: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

function authHeader() {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function SuperAdminPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [stats, setStats] = useState<Stats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [superusers, setSuperusers] = useState<Superuser[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Tenant admin modal
  const [adminModal, setAdminModal] = useState<{ tenantId: number; tenantNome: string } | null>(null);
  // Platform superuser modal
  const [superuserModal, setSuperuserModal] = useState(false);

  const checkAccess = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { headers: authHeader() as HeadersInit });
      if (!res.ok) { router.replace("/login"); return; }
      const user = await res.json();
      if (!user.is_superadmin) { router.replace("/dashboard"); return; }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/superadmin/stats", { headers: authHeader() as HeadersInit });
    if (res.ok) setStats(await res.json());
  }, []);

  const fetchTenants = useCallback(async () => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/superadmin/tenants?${params}`, { headers: authHeader() as HeadersInit });
    if (res.ok) setTenants(await res.json());
  }, [query, statusFilter]);

  const fetchPlans = useCallback(async () => {
    const res = await fetch("/api/superadmin/planos", { headers: authHeader() as HeadersInit });
    if (res.ok) setPlans(await res.json());
  }, []);

  const fetchSuperusers = useCallback(async () => {
    const res = await fetch("/api/superadmin/platform-superusers", { headers: authHeader() as HeadersInit });
    if (res.ok) setSuperusers(await res.json());
  }, []);

  useEffect(() => {
    checkAccess().then(() => {
      setLoading(false);
      fetchStats();
      fetchTenants();
      fetchPlans();
      fetchSuperusers();
    });
  }, [checkAccess, fetchStats, fetchTenants, fetchPlans, fetchSuperusers]);

  useEffect(() => {
    if (tab === "tenants") fetchTenants();
  }, [tab, query, statusFilter, fetchTenants]);

  async function setTenantStatus(id: number, status: string) {
    await fetch(`/api/superadmin/tenants/${id}/status?status=${status}`, {
      method: "PATCH",
      headers: authHeader() as HeadersInit,
    });
    fetchTenants();
    fetchStats();
    if (selectedTenant?.id === id) setSelectedTenant((t) => t ? { ...t, status } : t);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const TABS: { key: Tab; icon: string; label: string }[] = [
    { key: "dashboard",  icon: "⬡",  label: "Dashboard" },
    { key: "tenants",    icon: "🏢", label: "Tenants" },
    { key: "plans",      icon: "📦", label: t("superAdmin.plansTitle") },
    { key: "superusers", icon: "🔑", label: "Superusers" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-slate-900 border-r border-white/5 flex-col">
        <div className="px-5 py-5 border-b border-white/5">
          <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">Cognira</p>
          <p className="text-white font-bold mt-0.5">Super Admin</p>
          <p className="text-white/30 text-[10px] mt-0.5">Plataforma · Todos os tenants</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {TABS.map(({ key, icon, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${tab === key ? "bg-blue-600 text-white" : "text-white/60 hover:text-white hover:bg-white/5"}`}>
              <span>{icon}</span> {label}
            </button>
          ))}
          <div className="pt-3 mt-3 border-t border-white/10">
            <p className="text-[10px] text-white/30 uppercase tracking-widest px-3 mb-1">Configurações</p>
            <button onClick={() => router.push("/configuracoes/ai-providers")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-white/60 hover:text-white hover:bg-white/5">
              <span>🤖</span> {t("superAdmin.aiProviders")}
            </button>
          </div>
        </nav>
        <div className="p-3 border-t border-white/5">
          <button onClick={() => router.push("/dashboard")}
            className="w-full text-xs text-white/40 hover:text-white/70 py-2 transition-colors">
            {t("superAdmin.backToApp")}
          </button>
        </div>
      </aside>

      {/* Mobile header + horizontal tabs */}
      <div className="md:hidden bg-slate-900 border-b border-white/10 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Cognira</p>
            <p className="text-white font-bold text-sm leading-tight">Super Admin</p>
          </div>
          <button onClick={() => router.push("/dashboard")}
            className="ml-auto text-xs text-white/40 hover:text-white/70 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
            {t("superAdmin.backToAppMobile")}
          </button>
        </div>
        <div className="flex overflow-x-auto px-2 pb-2 gap-1 scrollbar-none">
          {TABS.map(({ key, icon, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${tab === key ? "bg-blue-600 text-white" : "text-white/60 hover:text-white hover:bg-white/5"}`}>
              <span>{icon}</span> {label}
            </button>
          ))}
          <button onClick={() => router.push("/configuracoes/ai-providers")}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-purple-300 hover:text-white hover:bg-white/5">
            🤖 {t("superAdmin.aiProviders")}
          </button>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 overflow-auto min-h-0">

        {/* ── Dashboard ── */}
        {tab === "dashboard" && stats && (
          <div className="px-4 py-6 sm:p-8">
            <h1 className="text-2xl font-bold mb-1">{t("superAdmin.platformOverview")}</h1>
            <p className="text-white/40 text-sm mb-8">{t("superAdmin.overviewSubtitle")}</p>

            {/* KPI grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: t("superAdmin.totalTenants"),    value: stats.total_tenants,    emoji: "🏢" },
                { label: t("superAdmin.activeCount"),    value: stats.active_tenants,   emoji: "✅" },
                { label: t("superAdmin.inTrial"),        value: stats.trial_tenants,    emoji: "⏳" },
                { label: t("superAdmin.suspendedCount"), value: stats.suspended_tenants, emoji: "🚫" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <p className="text-3xl mb-1">{kpi.emoji}</p>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-sm text-white/50">{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* MRR + users */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-gradient-to-br from-blue-600/30 to-purple-600/20 border border-blue-500/30 rounded-xl p-6">
                <p className="text-white/50 text-sm mb-1">{t("superAdmin.mrr")}</p>
                <p className="text-4xl font-bold text-white">€{stats.mrr.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}</p>
                <p className="text-blue-300 text-xs mt-1">{t("superAdmin.activeOnly")}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <p className="text-white/50 text-sm mb-1">{t("superAdmin.totalUsers")}</p>
                <p className="text-4xl font-bold">{stats.total_users}</p>
                <p className="text-white/30 text-xs mt-1">{t("superAdmin.allTenants")}</p>
              </div>
            </div>

            {/* Platform Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
              <button onClick={() => router.push("/configuracoes/ai-providers")}
                className="text-left bg-purple-600/10 border border-purple-500/20 hover:border-purple-500/40 rounded-xl p-5 transition-colors group">
                <p className="text-2xl mb-2">🤖</p>
                <p className="text-sm font-semibold text-purple-200 group-hover:text-white transition-colors">{t("superAdmin.aiProviders")}</p>
                <p className="text-xs text-white/40 mt-0.5">{t("superAdmin.llmConfig")}</p>
              </button>
            </div>

            {/* Recent tenants */}
            <h2 className="text-lg font-semibold mb-3">{t("superAdmin.recentTenants")}</h2>
            <TenantTable tenants={tenants.slice(0, 8)} onStatusChange={setTenantStatus} onSelect={setSelectedTenant} />
            {tenants.length > 8 && (
              <button onClick={() => setTab("tenants")} className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                {t("superAdmin.viewAll", { count: String(tenants.length) })}
              </button>
            )}
          </div>
        )}

        {/* ── Tenants ── */}
        {tab === "tenants" && (
          <div className="px-4 py-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">Tenants</h1>
                <p className="text-white/40 text-sm">{t("superAdmin.tenantsFound", { count: String(tenants.length) })}</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-5">
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-400"
                placeholder={t("superAdmin.searchPlaceholder")} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none appearance-none">
                <option value="" className="bg-slate-800">{t("superAdmin.allStatuses")}</option>
                <option value="active" className="bg-slate-800">{t("superAdmin.statusActive")}</option>
                <option value="trial" className="bg-slate-800">{t("superAdmin.statusTrial")}</option>
                <option value="suspended" className="bg-slate-800">{t("superAdmin.statusSuspended")}</option>
                <option value="cancelled" className="bg-slate-800">{t("superAdmin.statusCancelled")}</option>
              </select>
            </div>

            <TenantTable tenants={tenants} onStatusChange={setTenantStatus} onSelect={setSelectedTenant} />
          </div>
        )}

        {/* ── Plans ── */}
        {tab === "plans" && (
          <div className="px-4 py-6 sm:p-8">
            <h1 className="text-2xl font-bold mb-6">{t("superAdmin.plansTitle")}</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan as Plan & { descricao?: string; max_utilizadores?: number | null; max_clientes?: number | null; max_visitas_mes?: number | null; trial_dias?: number; features?: Record<string, unknown>; is_public?: boolean; is_active?: boolean }} />
              ))}
            </div>
          </div>
        )}

        {/* ── Superusers ── */}
        {tab === "superusers" && (
          <div className="px-4 py-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">{t("superAdmin.superusersTitle")}</h1>
                <p className="text-white/40 text-sm">{t("superAdmin.superusersSubtitle")}</p>
              </div>
              <button onClick={() => setSuperuserModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
                {t("superAdmin.addSuperuser")}
              </button>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 border-b border-white/10">
                    <th className="text-left py-3 px-5 font-medium">{t("superAdmin.colUsername")}</th>
                    <th className="text-left py-3 px-5 font-medium">{t("superAdmin.colState")}</th>
                    <th className="text-left py-3 px-5 font-medium">{t("superAdmin.colId")}</th>
                  </tr>
                </thead>
                <tbody>
                  {superusers.map((u) => (
                    <tr key={u.id} className="border-b border-white/5">
                      <td className="py-3 px-5 font-medium text-white font-mono">{u.username}</td>
                      <td className="py-3 px-5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                          u.activo ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-gray-500/20 text-gray-300 border-gray-500/30"
                        }`}>{u.activo ? t("superAdmin.statusActive") : t("superAdmin.inactive")}</span>
                      </td>
                      <td className="py-3 px-5 text-white/40 text-xs">{u.id}</td>
                    </tr>
                  ))}
                  {superusers.length === 0 && (
                    <tr><td colSpan={3} className="py-10 text-center text-white/30">{t("superAdmin.noSuperusers")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Tenant Detail Drawer */}
      {selectedTenant && (
        <TenantDrawer
          tenant={selectedTenant}
          onClose={() => setSelectedTenant(null)}
          onStatusChange={setTenantStatus}
          onCreateAdmin={(id, nome) => { setSelectedTenant(null); setAdminModal({ tenantId: id, tenantNome: nome }); }}
        />
      )}

      {adminModal && (
        <CreateAdminModal
          tenantId={adminModal.tenantId}
          tenantNome={adminModal.tenantNome}
          onClose={() => setAdminModal(null)}
          onCreated={() => { setAdminModal(null); fetchTenants(); }}
        />
      )}

      {superuserModal && (
        <CreateSuperuserModal
          onClose={() => setSuperuserModal(false)}
          onCreated={() => { setSuperuserModal(false); fetchSuperusers(); }}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TenantTable({ tenants, onStatusChange, onSelect }: {
  tenants: Tenant[];
  onStatusChange: (id: number, status: string) => void;
  onSelect: (tenant: Tenant) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      {/* Mobile: cards */}
      <div className="sm:hidden space-y-3">
        {tenants.map((tenant) => (
          <div key={tenant.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <button onClick={() => onSelect(tenant)} className="text-left min-w-0">
                <p className="font-medium text-white truncate">{tenant.nome}</p>
                <p className="text-white/40 text-xs truncate">{tenant.owner_email}</p>
              </button>
              <span className={`flex-shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[tenant.status] ?? "bg-white/10 text-white/60"}`}>
                {tenant.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50 mb-3">
              <span className="font-mono">{tenant.slug}</span>
              <span>{tenant.plano?.nome ?? "—"}</span>
              <span>{new Date(tenant.criado_em).toLocaleDateString("pt-PT")}</span>
            </div>
            <div className="flex gap-2">
              {tenant.status !== "active" && (
                <button onClick={() => onStatusChange(tenant.id, "active")}
                  className="px-2.5 py-1 bg-green-500/20 text-green-300 rounded-lg text-xs hover:bg-green-500/40 transition-colors">
                  {t("superAdmin.activate")}
                </button>
              )}
              {tenant.status !== "suspended" && (
                <button onClick={() => onStatusChange(tenant.id, "suspended")}
                  className="px-2.5 py-1 bg-red-500/20 text-red-300 rounded-lg text-xs hover:bg-red-500/40 transition-colors">
                  {t("superAdmin.suspend")}
                </button>
              )}
              <button onClick={() => onSelect(tenant)}
                className="px-2.5 py-1 bg-white/10 text-white/60 rounded-lg text-xs hover:bg-white/20 transition-colors ml-auto">
                {t("superAdmin.colActions")} →
              </button>
            </div>
          </div>
        ))}
        {tenants.length === 0 && (
          <p className="text-center text-white/30 py-10">{t("superAdmin.noTenants")}</p>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/40 border-b border-white/10">
              <th className="text-left py-2 pr-4 font-medium">{t("superAdmin.colTenant")}</th>
              <th className="text-left py-2 pr-4 font-medium">{t("superAdmin.colSlug")}</th>
              <th className="text-left py-2 pr-4 font-medium">{t("superAdmin.colPlan")}</th>
              <th className="text-left py-2 pr-4 font-medium">{t("superAdmin.colStatus")}</th>
              <th className="text-left py-2 pr-4 font-medium">{t("superAdmin.createdAt")}</th>
              <th className="text-right py-2 font-medium">{t("superAdmin.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="border-b border-white/5 hover:bg-white/3 group">
                <td className="py-3 pr-4">
                  <button onClick={() => onSelect(tenant)} className="text-left hover:text-blue-300 transition-colors">
                    <p className="font-medium text-white">{tenant.nome}</p>
                    <p className="text-white/40 text-xs">{tenant.owner_email}</p>
                  </button>
                </td>
                <td className="py-3 pr-4 text-white/60 font-mono text-xs">{tenant.slug}</td>
                <td className="py-3 pr-4 text-white/70">{tenant.plano?.nome ?? "—"}</td>
                <td className="py-3 pr-4">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[tenant.status] ?? "bg-white/10 text-white/60"}`}>
                    {tenant.status}
                  </span>
                </td>
                <td className="py-3 pr-4 text-white/40 text-xs">
                  {new Date(tenant.criado_em).toLocaleDateString("pt-PT")}
                </td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {tenant.status !== "active" && (
                      <button onClick={() => onStatusChange(tenant.id, "active")}
                      className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs hover:bg-green-500/40 transition-colors">
                        {t("superAdmin.activate")}
                      </button>
                    )}
                    {tenant.status !== "suspended" && (
                      <button onClick={() => onStatusChange(tenant.id, "suspended")}
                        className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs hover:bg-red-500/40 transition-colors">
                        {t("superAdmin.suspend")}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-white/30">{t("superAdmin.noTenants")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PlanCard({ plan }: { plan: Plan & { descricao?: string; max_utilizadores?: number | null; max_clientes?: number | null; max_visitas_mes?: number | null; trial_dias?: number; features?: Record<string, unknown>; is_public?: boolean; is_active?: boolean } }) {
  const { t } = useI18n();
  return (
    <div className={`bg-white/5 border rounded-xl p-5 ${!plan.is_active ? "opacity-50" : "border-white/10"}`}>
      <div className="flex justify-between items-start mb-3">
        <p className="font-bold text-white">{plan.nome}</p>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${plan.is_public ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-white/10 text-white/40 border-white/10"}`}>
          {plan.is_public ? t("superAdmin.publicLabel") : t("superAdmin.privateLabel")}
        </span>
      </div>
      <p className="text-2xl font-bold text-white mb-1">€{plan.preco_mensal}<span className="text-sm text-white/40">{t("superAdmin.perMonth")}</span></p>
      <p className="text-white/50 text-xs mb-3">{plan.descricao}</p>
      <div className="space-y-1 text-xs text-white/60">
        <p>👤 {plan.max_utilizadores ?? "∞"} {t("superAdmin.usersLabel")}</p>
        <p>🏢 {plan.max_clientes ?? "∞"} {t("superAdmin.clientsLabel")}</p>
        <p>📋 {plan.max_visitas_mes ?? "∞"} {t("superAdmin.visitsPerMonth")}</p>
        <p>⏳ {plan.trial_dias ?? 14} {t("superAdmin.trialDaysLabel")}</p>
      </div>
    </div>
  );
}

interface TenantUser { id: string; username: string; role_global: string; activo: boolean; }

function TenantDrawer({ tenant, onClose, onStatusChange, onCreateAdmin }: {
  tenant: Tenant;
  onClose: () => void;
  onStatusChange: (id: number, status: string) => void;
  onCreateAdmin: (id: number, nome: string) => void;
}) {
  const { t } = useI18n();
  const trialEndsAt = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const daysLeft = trialEndsAt ? Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000) : null;
  const [users, setUsers] = useState<TenantUser[]>([]);
  useEffect(() => {
    fetch(`/api/superadmin/tenants/${tenant.id}/users`, { headers: authHeader() as HeadersInit })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setUsers(Array.isArray(data) ? data : []));
  }, [tenant.id]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:flex-row" onClick={onClose}>
      <div className="hidden md:block flex-1" />
      <div className="w-full md:w-96 mt-auto md:mt-0 max-h-[85vh] md:max-h-none md:h-full bg-slate-900 border-t md:border-t-0 md:border-l border-white/10 rounded-t-2xl md:rounded-none flex flex-col overflow-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="font-bold text-white text-lg">{tenant.nome}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl transition-colors">✕</button>
        </div>
        <div className="flex-1 p-5 space-y-5 text-sm overflow-auto">
          <div>
            <p className="text-white/40 text-xs mb-1 uppercase tracking-wide">{t("superAdmin.colStatus")}</p>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${STATUS_STYLES[tenant.status] ?? "bg-white/10 text-white/60"}`}>
              {tenant.status}
            </span>
            {daysLeft !== null && tenant.status === "trial" && (
              <p className={`text-xs mt-1 ${daysLeft < 3 ? "text-red-400" : "text-amber-300"}`}>
                {daysLeft > 0 ? t("superAdmin.daysLeft", { n: String(daysLeft) }) : t("superAdmin.trialExpired")}
              </p>
            )}
          </div>

          {[
            [t("superAdmin.drawerSlug"), tenant.slug],
            [t("superAdmin.drawerBrandName"), tenant.nome_marca ?? "—"],
            [t("superAdmin.colPlan"), tenant.plano?.nome ?? "—"],
            [t("superAdmin.drawerCountry"), tenant.pais ?? "—"],
          ].map(([label, value]) => (
            <div key={label as string}>
              <p className="text-white/40 text-xs mb-0.5 uppercase tracking-wide">{label}</p>
              <p className="text-white font-medium">{value as string}</p>
            </div>
          ))}

          <div>
            <p className="text-white/40 text-xs mb-0.5 uppercase tracking-wide">{t("superAdmin.drawerOwner")}</p>
            <p className="text-white font-medium">{tenant.owner_nome}</p>
            <p className="text-blue-300 text-xs">{tenant.owner_email}</p>
          </div>

          <div>
            <p className="text-white/40 text-xs mb-0.5 uppercase tracking-wide">{t("superAdmin.drawerPortalUrl")}</p>
            <a href={`https://${tenant.slug}.marketview.io`} target="_blank" rel="noreferrer"
              className="text-blue-400 hover:underline text-xs font-mono">
              {tenant.slug}.marketview.io ↗
            </a>
          </div>

          <div>
            <p className="text-white/40 text-xs mb-0.5 uppercase tracking-wide">{t("superAdmin.drawerRegisteredAt")}</p>
            <p className="text-white/70">{new Date(tenant.criado_em).toLocaleDateString("pt-PT", { dateStyle: "long" })}</p>
          </div>

          <div>
            <p className="text-white/40 text-xs mb-1 uppercase tracking-wide">{t("superAdmin.drawerUsers")} ({users.length})</p>
            {users.length === 0 ? (
              <p className="text-white/30 text-xs">{t("superAdmin.noUsers")}</p>
            ) : (
              <div className="space-y-1">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between bg-white/5 rounded px-3 py-1.5">
                    <span className="text-white/80 font-mono text-xs">{u.username}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white/40 text-[10px]">{u.role_global}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.activo ? "bg-green-400" : "bg-red-400"}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-white/10 space-y-2">
          <button onClick={() => onCreateAdmin(tenant.id, tenant.nome)}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
            👤 {t("superAdmin.createTenantAdminBtn")}
          </button>
          {tenant.status !== "active" && (
            <button onClick={() => onStatusChange(tenant.id, "active")}
              className="w-full py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors">
              ✓ {t("superAdmin.activateTenant")}
            </button>
          )}
          {tenant.status === "active" && (
            <button onClick={() => onStatusChange(tenant.id, "suspended")}
              className="w-full py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">
              ⚠ {t("superAdmin.suspendTenant")}
            </button>
          )}
          {tenant.status !== "trial" && (
            <button onClick={() => onStatusChange(tenant.id, "trial")}
              className="w-full py-2 bg-amber-600/60 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors">
              ⏳ {t("superAdmin.reactivateTrial")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create Tenant Admin Modal ─────────────────────────────────────────────────

function CreateAdminModal({ tenantId, tenantNome, onClose, onCreated }: {
  tenantId: number;
  tenantNome: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenantId}/admin`, {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" } as HeadersInit,
        body: JSON.stringify({ username, email, password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.detail ?? t("superAdmin.errorCreateAdmin"));
        return;
      }
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">{t("superAdmin.createTenantAdmin")}</h2>
            <p className="text-white/40 text-sm mt-0.5">{tenantNome}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl transition-colors">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1 uppercase tracking-wide">Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-400"
              placeholder="admin_empresa" />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1 uppercase tracking-wide">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-400"
              placeholder="admin@empresa.pt" />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1 uppercase tracking-wide">{t("superAdmin.passwordMin")}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-400"
              placeholder="••••••••" />
          </div>
          {err && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-white/10 text-white/60 hover:text-white rounded-lg text-sm transition-colors">
              {t("superAdmin.cancel")}
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? t("superAdmin.creating") : t("superAdmin.createAdmin")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Create Platform Superuser Modal ───────────────────────────────────────────

function CreateSuperuserModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      const res = await fetch("/api/superadmin/platform-superusers", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" } as HeadersInit,
        body: JSON.stringify({ username, email, password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.detail ?? t("superAdmin.errorCreateSuperuser"));
        return;
      }
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">{t("superAdmin.newSuperuser")}</h2>
            <p className="text-white/40 text-sm mt-0.5">{t("superAdmin.noAffiliation")}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl transition-colors">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1 uppercase tracking-wide">Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-400"
              placeholder="superadmin" />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1 uppercase tracking-wide">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-400"
              placeholder="super@plataforma.io" />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1 uppercase tracking-wide">{t("superAdmin.passwordMin")}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-400"
              placeholder="••••••••" />
          </div>
          {err && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-white/10 text-white/60 hover:text-white rounded-lg text-sm transition-colors">
              {t("superAdmin.cancel")}
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? t("superAdmin.creating") : t("superAdmin.createSuperuserBtn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
