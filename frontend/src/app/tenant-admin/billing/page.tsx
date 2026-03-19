"use client";
/**
 * /tenant-admin/billing — Subscription & billing management
 * Requires role_global="admin" (same guard as tenant-admin)
 */
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CreditCard, CheckCircle2, Clock, AlertTriangle, ArrowLeft,
  ExternalLink, Zap, RefreshCw, Shield, ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";

interface BillingStatus {
  tenant_status: string;
  trial_ends_at: string | null;
  plano: string | null;
  plano_codigo: string | null;
  preco_mensal: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  stripe_configured: boolean;
}

interface PublicPlan {
  id: number;
  nome: string;
  codigo: string;
  descricao: string;
  preco_mensal: number;
  max_utilizadores: number | null;
  max_clientes: number | null;
  max_visitas_mes: number | null;
  trial_dias: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active:    { label: "Ativo",        color: "text-green-700 bg-green-50 border-green-200",  icon: CheckCircle2 },
  trial:     { label: "Trial",        color: "text-amber-700 bg-amber-50 border-amber-200",   icon: Clock },
  suspended: { label: "Suspenso",     color: "text-red-700 bg-red-50 border-red-200",          icon: AlertTriangle },
  cancelled: { label: "Cancelado",    color: "text-slate-600 bg-slate-50 border-slate-200",    icon: AlertTriangle },
};

function trialDaysLeft(trial_ends_at: string | null): number | null {
  if (!trial_ends_at) return null;
  const diff = new Date(trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function fmt(n: number | null) {
  return n === null ? "∞" : n.toLocaleString();
}

function BillingContent() {
  const router = useRouter();
  const params = useSearchParams();

  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Handle return from Stripe
  useEffect(() => {
    if (params.get("billing") === "success") {
      setSuccessMsg("Subscrição activada! A conta foi actualizada.");
    }
    if (params.get("billing") === "cancelled") {
      setSuccessMsg("");
    }
  }, [params]);

  const loadData = useCallback(async () => {
    try {
      const me = await api.get<{ role_global: string; is_superadmin?: boolean }>("/auth/me");
      if (me.role_global !== "admin" || me.is_superadmin) {
        router.replace("/dashboard");
        return;
      }
      const [s, p] = await Promise.all([
        api.get<BillingStatus>("/billing/status"),
        api.get<PublicPlan[]>("/superadmin/planos/public").catch(() => []),
      ]);
      setStatus(s);
      setPlans(p.filter((x) => x.codigo !== "demo"));
    } catch {
      setError("Não foi possível carregar informação de billing.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCheckout = async (planCodigo?: string) => {
    setActionLoading(true);
    setError("");
    try {
      const res = await api.post<{ url: string }>("/billing/checkout", {
        plano_codigo: planCodigo || status?.plano_codigo || undefined,
      });
      window.location.href = res.url;
    } catch (e: unknown) {
      setError((e as { detail?: string })?.detail || "Erro ao iniciar checkout.");
      setActionLoading(false);
    }
  };

  const handlePortal = async () => {
    setActionLoading(true);
    setError("");
    try {
      const res = await api.post<{ url: string }>("/billing/portal", {});
      window.location.href = res.url;
    } catch (e: unknown) {
      setError((e as { detail?: string })?.detail || "Erro ao abrir portal.");
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[status?.tenant_status ?? ""] ?? STATUS_CONFIG.trial;
  const StatusIcon = statusCfg.icon;
  const daysLeft = trialDaysLeft(status?.trial_ends_at ?? null);
  const hasStripe = !!status?.stripe_customer_id;
  const isActive = status?.tenant_status === "active";
  const isTrial = status?.tenant_status === "trial";
  const isSuspended = ["suspended", "cancelled"].includes(status?.tenant_status ?? "");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href="/tenant-admin" className="text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <CreditCard className="w-5 h-5 text-indigo-600" />
          <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100">Subscrição & Billing</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Success banner */}
        {successMsg && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {/* Stripe not configured notice */}
        {!status?.stripe_configured && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
            <strong>Stripe não configurado.</strong> Para activar pagamentos, defina as variáveis
            <code className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded font-mono text-xs">STRIPE_SECRET_KEY</code>,
            <code className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded font-mono text-xs">STRIPE_WEBHOOK_SECRET</code> e
            <code className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded font-mono text-xs">STRIPE_PRICE_*</code> no servidor.
          </div>
        )}

        {/* Current subscription card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Plano actual</p>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {status?.plano ?? "—"}
              </h2>
              {status?.preco_mensal !== null && status?.preco_mensal !== undefined && (
                <p className="text-sm text-slate-500 mt-0.5">
                  {status.preco_mensal === 0 ? "Gratuito" : `€${status.preco_mensal}/mês`}
                </p>
              )}
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${statusCfg.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {statusCfg.label}
            </span>
          </div>

          {/* Trial countdown */}
          {isTrial && daysLeft !== null && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium mb-4 ${
              daysLeft <= 3
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-amber-50 border border-amber-200 text-amber-700"
            }`}>
              <Clock className="w-4 h-4 shrink-0" />
              {daysLeft === 0
                ? "O seu trial expirou. Active uma subscrição para continuar."
                : `${daysLeft} dia${daysLeft !== 1 ? "s" : ""} restante${daysLeft !== 1 ? "s" : ""} de trial.`
              }
            </div>
          )}

          {/* Subscription info */}
          {hasStripe && status?.stripe_subscription_status && (
            <div className="text-xs text-slate-400 mb-4">
              Stripe subscription: <span className="font-mono">{status.stripe_subscription_id}</span>
              {" · "}Estado: <span className="font-semibold capitalize">{status.stripe_subscription_status}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-2">
            {(isTrial || isSuspended) && status?.stripe_configured && (
              <button
                onClick={() => handleCheckout()}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {isSuspended ? "Reactivar subscrição" : "Activar subscrição"}
              </button>
            )}
            {isActive && hasStripe && status?.stripe_configured && (
              <button
                onClick={handlePortal}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
              >
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Gerir subscrição
              </button>
            )}
            {!actionLoading && (
              <button
                onClick={loadData}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-slate-400 hover:text-slate-600 text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Actualizar
              </button>
            )}
          </div>
        </div>

        {/* Plan comparison / upgrade */}
        {(isTrial || isSuspended) && plans.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Escolha um plano</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const isCurrent = plan.codigo === status?.plano_codigo;
                return (
                  <div
                    key={plan.id}
                    className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 flex flex-col gap-3 transition-shadow ${
                      isCurrent
                        ? "border-indigo-400 ring-1 ring-indigo-200 shadow-md"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 dark:text-white">{plan.nome}</span>
                        {isCurrent && (
                          <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">actual</span>
                        )}
                      </div>
                      <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                        {plan.preco_mensal === 0 ? "Gratuito" : `€${plan.preco_mensal}`}
                        {plan.preco_mensal > 0 && <span className="text-sm font-normal text-slate-400">/mês</span>}
                      </p>
                    </div>
                    <ul className="text-xs text-slate-500 space-y-1 flex-1">
                      <li>{fmt(plan.max_utilizadores)} utilizadores</li>
                      <li>{fmt(plan.max_clientes)} clientes</li>
                      <li>{fmt(plan.max_visitas_mes)} visitas/mês</li>
                      {plan.trial_dias > 0 && <li>{plan.trial_dias} dias de trial</li>}
                    </ul>
                    {status?.stripe_configured && (
                      <button
                        onClick={() => handleCheckout(plan.codigo)}
                        disabled={actionLoading}
                        className={`w-full flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-xl transition-colors ${
                          isCurrent
                            ? "bg-indigo-600 text-white hover:bg-indigo-700"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                        } disabled:opacity-50`}
                      >
                        {isCurrent ? "Subscrever" : "Escolher"} <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Security note */}
        <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500">
          <Shield className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
          Os pagamentos são processados de forma segura pelo Stripe. A Cognira não armazena dados de cartão de crédito.
          O Stripe está em conformidade com PCI DSS Nível 1.
        </div>

      </main>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}
