"use client";
/**
 * /tenant-admin/status — Platform & infrastructure health dashboard.
 * Guards: requires role_global="admin" (tenant admin OR superadmin).
 * Auto-refreshes every 30 seconds. Manual refresh available.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, XCircle,
  Database, HardDrive, Shield, Brain, Cpu, Clock, Activity,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Check {
  id: string;
  label: string;
  icon: string;
  ok: boolean | null;
  latency_ms: number;
  detail: string;
}

interface StatusResponse {
  status: "healthy" | "degraded";
  version: string;
  environment: string;
  checks: Check[];
}

const SERVICE_ICONS: Record<string, React.ElementType> = {
  database:   Database,
  pgvector:   Brain,
  storage:    HardDrive,
  antivirus:  Shield,
  ai:         Cpu,
};

function StatusBadge({ ok }: { ok: boolean | null }) {
  if (ok === null)
    return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
        <Clock className="w-3 h-3" />
        N/A
      </span>
    );
  if (ok)
    return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
        <CheckCircle2 className="w-3 h-3" />
        Operacional
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
      <XCircle className="w-3 h-3" />
      Falha
    </span>
  );
}

function LatencyBar({ ms, ok }: { ms: number; ok: boolean | null }) {
  const color =
    ok === false ? "bg-red-400" :
    ms < 50  ? "bg-green-400" :
    ms < 200 ? "bg-amber-400" :
               "bg-red-400";
  const pct = Math.min(100, (ms / 500) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-500 w-14 text-right">{ms} ms</span>
    </div>
  );
}

export default function StatusPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [data, setData]         = useState<StatusResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [error, setError]       = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await api.get<StatusResponse>("/status");
      setData(res);
      setLastChecked(new Date());
      setError("");
    } catch {
      setError("Não foi possível obter o estado do sistema.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    api
      .get<{ role_global: string; is_superadmin?: boolean }>("/auth/me")
      .then((me) => {
        if (me.role_global !== "admin" && me.is_superadmin !== true) {
          router.replace("/dashboard");
          return;
        }
        fetchStatus();
        timerRef.current = setInterval(() => fetchStatus(true), 30_000);
      })
      .catch(() => router.replace("/login"));
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [router, fetchStatus]);

  const overallOk = data?.status === "healthy";
  const failCount = data?.checks.filter(c => c.ok === false).length ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/tenant-admin"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <h1 className="text-sm font-bold text-slate-900">Estado do Sistema</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastChecked && (
              <span className="text-xs text-slate-400">
                Actualizado às {lastChecked.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
            <button
              onClick={() => fetchStatus()}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Overall status banner */}
        {!loading && data && (
          <div className={`mb-8 rounded-2xl border p-5 flex items-center gap-4 ${
            overallOk
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
              overallOk ? "bg-green-100" : "bg-red-100"
            }`}>
              {overallOk ? "✅" : "⚠️"}
            </div>
            <div className="flex-1">
              <p className={`text-lg font-bold ${overallOk ? "text-green-800" : "text-red-800"}`}>
                {overallOk ? "Todos os sistemas operacionais" : `${failCount} sistema(s) com falha`}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                v{data.version} · {data.environment}
                {lastChecked && ` · verificado às ${lastChecked.toLocaleTimeString("pt-PT")}`}
              </p>
            </div>
            <div className="text-3xl">{overallOk ? "🟢" : "🔴"}</div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl" />
                  <div className="flex-1">
                    <div className="h-3.5 bg-slate-100 rounded w-32 mb-2" />
                    <div className="h-2.5 bg-slate-100 rounded w-20" />
                  </div>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {/* Service cards */}
        {data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.checks.map((check) => {
              const Icon = SERVICE_ICONS[check.id] ?? Activity;
              const cardBg =
                check.ok === false ? "border-red-200 bg-red-50/40" :
                check.ok === null  ? "border-slate-200 bg-white" :
                                     "border-green-200 bg-green-50/20";
              return (
                <div key={check.id} className={`border rounded-2xl p-5 transition-all ${cardBg}`}>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                        check.ok === false ? "bg-red-100" :
                        check.ok === null  ? "bg-slate-100" :
                                             "bg-green-100"
                      }`}>
                        {check.icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{check.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[180px]">{check.detail}</p>
                      </div>
                    </div>
                    <StatusBadge ok={check.ok} />
                  </div>
                  <LatencyBar ms={check.latency_ms} ok={check.ok} />
                </div>
              );
            })}
          </div>
        )}

        {/* Auto-refresh notice */}
        <p className="mt-6 text-center text-xs text-slate-400">
          Actualização automática a cada 30 segundos
        </p>
      </div>
    </div>
  );
}
