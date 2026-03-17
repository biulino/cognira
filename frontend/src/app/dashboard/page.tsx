"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, ClipboardList, Users, TrendingUp, ArrowRight, Activity, AlertTriangle, CheckCircle2, Clock, BarChart3 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Estudo {
  id: number;
  nome: string;
  estado: string;
  cliente_id: number;
}

interface Stats {
  total: number;
  por_estado: Record<string, number>;
  pontuacao_media: number | null;
}

interface Permissao { estudo_id: number; role: string; }
interface Me {
  id: string;
  username: string;
  role_global: string;
  permissoes: Permissao[];
}

const STATE_COLORS: Record<string, string> = {
  fechada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  validada: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  inserida: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  nova: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  planeada: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  anulada: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const CHART_FILL: Record<string, string> = {
  fechada: "#10b981", validada: "#3b82f6", inserida: "#eab308",
  nova: "#94a3b8", planeada: "#a855f7", anulada: "#ef4444",
  corrigir: "#f97316", corrigida: "#14b8a6", para_alteracao: "#f59e0b",
  situacao_especial: "#ec4899", sem_alteracoes: "#64748b",
};

const ESTADO_LABELS: Record<string, string> = {
  nova: "Nova", planeada: "Planeada", inserida: "Inserida", validada: "Validada",
  fechada: "Fechada", anulada: "Anulada", corrigir: "A Corrigir",
  corrigida: "Corrigida", para_alteracao: "Para Alteração",
  situacao_especial: "Situação Especial", sem_alteracoes: "Sem Alterações",
};

function StateBadge({ estado }: { estado: string }) {
  const cls = STATE_COLORS[estado] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {ESTADO_LABELS[estado] ?? estado}
    </span>
  );
}

export default function DashboardPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [estudos, setEstudos]           = useState<Estudo[]>([]);
  const [stats, setStats]               = useState<Stats | null>(null);
  const [estudosStats, setEstudosStats] = useState<Record<number, Stats>>({});
  const [me, setMe]                     = useState<Me | null>(null);
  const [loading, setLoading]           = useState(true);
  const [mounted, setMounted]           = useState(false);
  const [timeline, setTimeline]         = useState<{dia: string; total: number}[]>([]);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }

    Promise.all([
      api.get<Me>("/auth/me"),
      api.get<Estudo[]>("/estudos/"),
    ])
      .then(async ([m, e]) => {
        setMe(m); setEstudos(e);

        const ceIds = m.permissoes.filter(p => p.role === "cliente").map(p => p.estudo_id);
        const isCliente = !!(m && !["admin", "coordenador", "validador", "analista"].includes(m.role_global) && ceIds.length > 0);

        // For cliente users aggregate stats only over their estudos; otherwise use global endpoint
        const [s, tl] = await Promise.all([
          isCliente && ceIds.length > 0
            ? Promise.all(ceIds.map(id =>
                api.get<Stats>(`/visitas/stats?estudo_id=${id}`).catch(() => null)
              )).then(results => {
                const valid = results.filter(Boolean) as Stats[];
                const por: Record<string, number> = {};
                let total = 0; let scoreSum = 0; let scoreCount = 0;
                valid.forEach(s => {
                  total += s.total;
                  Object.entries(s.por_estado).forEach(([k, v]) => { por[k] = (por[k] ?? 0) + v; });
                  if (s.pontuacao_media != null) { scoreSum += s.pontuacao_media * s.total; scoreCount += s.total; }
                });
                return { total, por_estado: por, pontuacao_media: scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : null } as Stats;
              })
            : api.get<Stats>("/visitas/stats"),
          api.get<{dia: string; total: number}[]>("/visitas/timeline?days=30"),
        ]);
        setStats(s); setTimeline(tl);

        // Fetch per-study stats in the background
        Promise.all(
          (e as Estudo[]).map(estudo =>
            api.get<Stats>(`/visitas/stats?estudo_id=${estudo.id}`)
              .then(st => [estudo.id, st] as [number, Stats])
              .catch(() => null)
          )
        ).then(results => {
          const map: Record<number, Stats> = {};
          results.forEach(r => { if (r) map[r[0]] = r[1]; });
          setEstudosStats(map);
        });
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  // Determine if this user is in "cliente" mode (no elevated global role)
  const clienteEstudoIds = me?.permissoes.filter(p => p.role === "cliente").map(p => p.estudo_id) ?? [];
  const isClienteOnly = !!(me && !["admin", "coordenador", "validador", "analista"].includes(me.role_global) && clienteEstudoIds.length > 0);
  const visibleEstudos = isClienteOnly ? estudos.filter(e => clienteEstudoIds.includes(e.id)) : estudos;
  const role = me?.role_global ?? "";

  // Role-specific stat cards
  const pendingReview = (stats?.por_estado?.inserida ?? 0) + (stats?.por_estado?.corrigida ?? 0);
  const needsCorrection = stats?.por_estado?.corrigir ?? 0;
  const pending = (stats?.por_estado?.nova ?? 0) + (stats?.por_estado?.planeada ?? 0);

  const statCards = (() => {
    if (role === "analista") return [
      { label: "Minhas Visitas", value: stats?.total ?? 0, icon: ClipboardList, color: "text-blue-600", bg: "bg-blue-50", href: "/visitas" },
      { label: "Pendentes", value: pending, icon: Clock, color: "text-purple-600", bg: "bg-purple-50", href: "/visitas" },
      { label: "Fechadas", value: stats?.por_estado?.fechada ?? 0, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", href: "/visitas" },
      { label: "Pontuação Média", value: stats?.pontuacao_media != null ? `${stats.pontuacao_media}%` : "—", icon: TrendingUp, color: "text-orange-600", bg: "bg-orange-50", href: "/visitas" },
    ];
    if (role === "cliente") return [
      { label: "Estudos", value: visibleEstudos.length, icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50", href: "/estudos" },
      { label: "Total Visitas", value: stats?.total ?? 0, icon: ClipboardList, color: "text-emerald-600", bg: "bg-emerald-50", href: "/visitas" },
      { label: "Visitas Fechadas", value: stats?.por_estado?.fechada ?? 0, icon: CheckCircle2, color: "text-purple-600", bg: "bg-purple-50", href: "/visitas" },
      { label: "Pontuação Média", value: stats?.pontuacao_media != null ? `${stats.pontuacao_media}%` : "—", icon: TrendingUp, color: "text-orange-600", bg: "bg-orange-50", href: "/visitas" },
    ];
    if (role === "validador") return [
      { label: "Para Validar", value: pendingReview, icon: ClipboardList, color: "text-yellow-600", bg: "bg-yellow-50", href: "/visitas" },
      { label: "Total Visitas", value: stats?.total ?? 0, icon: Activity, color: "text-blue-600", bg: "bg-blue-50", href: "/visitas" },
      { label: "Pontuação Média", value: stats?.pontuacao_media != null ? `${stats.pontuacao_media}%` : "—", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", href: "/visitas" },
      { label: "Anuladas", value: stats?.por_estado?.anulada ?? 0, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50", href: "/visitas" },
    ];
    // admin + coordenador
    return [
      { label: "Estudos Activos", value: visibleEstudos.filter(e => e.estado === "activo").length, icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50", href: "/estudos" },
      { label: "Total Visitas", value: stats?.total ?? 0, icon: ClipboardList, color: "text-emerald-600", bg: "bg-emerald-50", href: "/visitas" },
      { label: "A Corrigir", value: needsCorrection, icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50", href: "/visitas" },
      { label: "Pontuação Média", value: stats?.pontuacao_media != null ? `${stats.pontuacao_media}%` : "—", icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50", href: "/relatorios" },
    ];
  })();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          {role === "analista" || isClienteOnly ? `Olá, ${me?.username ?? ""}` : "Dashboard"}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {role === "analista" ? "As suas visitas" :
           isClienteOnly ? "Os seus estudos" :
           role === "validador" ? "Visitas aguardando validação" :
           "Visão geral da plataforma"}
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
            {statCards.map(({ label, value, icon: Icon, color, bg, href }) => (
              <Link key={label} href={href} className="group bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-card border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-card-hover transition-all cursor-pointer">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 group-hover:text-blue-600 transition-colors">{value}</p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${bg}`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                </div>
                <p className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 mt-2 transition-opacity flex items-center gap-1">{t("dashboard.viewDetails")} <ArrowRight className="w-3 h-3" /></p>
              </Link>
            ))}
          </div>

          {/* Role-specific alerts / quick actions */}
          {(role === "admin" || role === "coordenador") && needsCorrection > 0 && (
            <div className="mb-6 flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-800">{needsCorrection} visita{needsCorrection !== 1 ? "s" : ""} aguarda{needsCorrection === 1 ? "" : "m"} correcção</p>
                <p className="text-xs text-orange-600 mt-0.5">{t("dashboard.correctionAlert")}</p>
              </div>
              <Link href="/visitas" className="text-xs font-semibold text-orange-700 hover:text-orange-900 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-lg transition-colors">{t("dashboard.viewVisits")}</Link>
            </div>
          )}
          {(role === "admin" || role === "coordenador") && (
            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              <Link href="/relatorios" className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-3.5 hover:border-blue-200 hover:shadow-sm transition-all group">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600">{t("dashboard.reports")}</span>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 ml-auto" />
              </Link>
              <Link href="/analistas" className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-3.5 hover:border-blue-200 hover:shadow-sm transition-all group">
                <Users className="w-5 h-5 text-emerald-500" />
                <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600">{t("dashboard.analysts")}</span>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 ml-auto" />
              </Link>
              <Link href="/pagamentos" className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-3.5 hover:border-blue-200 hover:shadow-sm transition-all group">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600">{t("dashboard.payments")}</span>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 ml-auto" />
              </Link>
            </div>
          )}
          {role === "validador" && pendingReview > 0 && (
            <div className="mb-6 flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl px-5 py-4">
              <Clock className="w-5 h-5 text-yellow-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-800">{pendingReview} visita{pendingReview !== 1 ? "s" : ""} para validar</p>
                <p className="text-xs text-yellow-600 mt-0.5">Estados: inserida / corrigida.</p>
              </div>
              <Link href="/visitas" className="text-xs font-semibold text-yellow-700 hover:text-yellow-900 bg-yellow-100 hover:bg-yellow-200 px-3 py-1.5 rounded-lg transition-colors">Validar</Link>
            </div>
          )}

          {/* Visitas por Estudo — replaces old single donut */}
          {mounted && visibleEstudos.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">{t("dashboard.studyVisits")}</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t("dashboard.distributions")}</p>
                </div>
                <Link
                  href="/visitas"
                  className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  <span>{stats?.total ?? 0}</span>
                  <span className="font-normal text-blue-500">total</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span className="sr-only">Ver todas</span>
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleEstudos.map(estudo => {
                  const eStats = estudosStats[estudo.id];
                  const pieData = eStats
                    ? Object.entries(eStats.por_estado)
                        .filter(([, v]) => v > 0)
                        .sort(([, a], [, b]) => b - a)
                        .map(([e, v]) => ({ name: ESTADO_LABELS[e] ?? e, value: v, fill: CHART_FILL[e] ?? "#94a3b8" }))
                    : [];
                  const total = eStats?.total ?? 0;
                  const statsLoaded = estudo.id in estudosStats;
                  return (
                    <div
                      key={estudo.id}
                      onClick={() => router.push(`/visitas?estudo_id=${estudo.id}`)}
                      className="group bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-card border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-card-hover transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0 mr-3">
                          <h3 className="font-semibold text-slate-900 dark:text-white text-sm leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">{estudo.nome}</h3>
                          <div className="mt-1.5"><StateBadge estado={estudo.estado} /></div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {statsLoaded ? (
                            <>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{total}</p>
                              <p className="text-xs text-slate-400 mt-0.5">visitas</p>
                            </>
                          ) : (
                            <div className="w-10 h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                          )}
                        </div>
                      </div>
                      {statsLoaded ? (
                        pieData.length > 0 ? (
                          <div className="flex items-center gap-3 mt-2">
                            <div style={{ width: 72, height: 72, flexShrink: 0 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={22} outerRadius={32} dataKey="value" paddingAngle={2} strokeWidth={0}>
                                    {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                  </Pie>
                                  <Tooltip
                                    contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e2e8f0", padding: "4px 8px" }}
                                    formatter={(v: number, name: string) => [v, name]}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                              {pieData.slice(0, 5).map(entry => (
                                <div key={entry.name} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.fill }} />
                                  <span className="truncate">{entry.name}</span>
                                  <span className="ml-auto font-semibold text-slate-700 dark:text-slate-300">{entry.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 text-center py-4">{t("dashboard.noVisits")}</p>
                        )
                      ) : (
                        <div className="flex items-center gap-3 mt-2">
                          <div className="w-[72px] h-[72px] rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse flex-shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            {[...Array(3)].map((_, i) => <div key={i} className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />)}
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 mt-3 transition-opacity flex items-center gap-1">
                        Ver visitas <ArrowRight className="w-3 h-3" />
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 30-day trend */}
          {mounted && timeline.length > 1 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-card border border-slate-100 dark:border-slate-800 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-900 dark:text-white">{t("dashboard.last30Days")}</h2>
                <span className="text-xs text-slate-400">{timeline.reduce((s, d) => s + d.total, 0)} total</span>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={timeline} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="dia"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={(v: string) => v.slice(5)} // MM-DD
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                    formatter={(v: number) => [v, "Visitas"]}
                    labelFormatter={(l: string) => l}
                  />
                  <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Studies */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-900 dark:text-white text-sm">{t("dashboard.manageStudies")}</h2>
              {!isClienteOnly && role !== "analista" && (
                <Link href="/estudos" className="text-blue-600 hover:text-blue-500 text-sm flex items-center gap-1">
                  Ver todos <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleEstudos.map((e) => (
                <Link
                  key={e.id}
                  href={`/estudos/${e.id}`}
                  className="group flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl px-4 py-3 shadow-card border border-slate-100 dark:border-slate-800 hover:shadow-card-hover hover:border-blue-200 dark:hover:border-blue-900 transition-all"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <h3 className="font-medium text-slate-800 dark:text-white text-sm leading-snug group-hover:text-blue-600 transition-colors truncate">{e.nome}</h3>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StateBadge estado={e.estado} />
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

