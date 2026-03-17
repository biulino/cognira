"use client";

import Link from "next/link";


// ─── Demo account definitions ────────────────────────────────────────────────

const PLATFORM_ACCOUNTS = [
  {
    role: "Superadmin",
    badge: "Gestão Global",
    color: "bg-red-50 border-red-200",
    badgeColor: "bg-red-100 text-red-700",
    labelColor: "text-red-800",
    email: "admin@estudosmercado.pt",
    password: "AdminSeguro2026!",
    note: "Acede ao painel global /super-admin — gere todos os tenants",
    access: ["Super-admin: gerir todos os tenants", "Criação de tenants e planos", "Providers de IA e pool de modelos"],
  },
  {
    role: "Tenant Admin",
    badge: "Administração do Tenant",
    color: "bg-indigo-50 border-indigo-200",
    badgeColor: "bg-indigo-100 text-indigo-700",
    labelColor: "text-indigo-800",
    email: "ana@testagency.com",
    password: "AdminDemo2026!",
    note: "Tenant: Test Agency — acede ao painel /tenant-admin",
    access: ["Painel de administração do tenant", "Gestão de utilizadores e branding", "Módulos, SLA e webhooks"],
  },
  {
    role: "Coordenador",
    badge: "Coordenação",
    color: "bg-violet-50 border-violet-200",
    badgeColor: "bg-violet-100 text-violet-700",
    labelColor: "text-violet-800",
    email: "coord@estudosmercado.pt",
    password: "CoordSeguro2026!",
    note: "Tenant: Cognira Demo",
    access: ["Gestão de estudos e visitas", "Validação e relatórios IA", "Chat interno e exportações"],
  },
  {
    role: "Validador",
    badge: "Controlo de Qualidade",
    color: "bg-amber-50 border-amber-200",
    badgeColor: "bg-amber-100 text-amber-700",
    labelColor: "text-amber-800",
    email: "validador@estudosmercado.pt",
    password: "ValidSeguro2026!",
    note: "Tenant: Cognira Demo",
    access: ["Validação de visitas e exceções", "Mensagens de visita"],
  },
  {
    role: "Analista",
    badge: "Campo",
    color: "bg-green-50 border-green-200",
    badgeColor: "bg-green-100 text-green-700",
    labelColor: "text-green-800",
    email: "ana.silva@demo.pt",
    password: "AnalistaDemo2026!",
    note: "Tenant: Cognira Demo",
    access: ["Dashboard pessoal", "Submissão de visitas e fotos", "Formações e certificações"],
  },
];

const CLIENT_PORTAL_ACCOUNTS = [
  { username: "cliente_vodafone", email: "cliente.vf@demo.pt",   password: "ClienteVF2026!",   label: "Vodafone" },
  { username: "cliente_nos",      email: "cliente.nos@demo.pt",  password: "ClienteNOS2026!",  label: "NOS" },
  { username: "cliente_mcd",      email: "cliente.mcd@demo.pt",  password: "ClienteMCD2026!",  label: "McDonald's" },
  { username: "cliente_galp",     email: "cliente.galp@demo.pt", password: "ClienteGALP2026!", label: "GALP" },
  { username: "cliente_fnac",     email: "cliente.fnac@demo.pt", password: "ClienteFNAC2026!", label: "FNAC" },
];

const FEATURES = [
  {
    icon: "🤖",
    badge: "Cognira Intelligence™",
    title: "IA proprietária em todo o workflow",
    desc: "Nove módulos de inteligência artificial: score preditivo, planeamento automático, detecção de anomalias, validação assistida, relatórios narrativos e chat de logística.",
  },
  {
    icon: "🗺️",
    badge: "Sprint 7",
    title: "Heatmap geográfico por score",
    desc: "Visualização de mapa interactivo com gradiente de cor por score médio por estabelecimento. Identifica zonas problemáticas num relance.",
  },
  {
    icon: "⏱️",
    badge: "Sprint 7",
    title: "SLA Monitor",
    desc: "Painel de visitas em atraso face aos limites operacionais. Alertas por estado com dias decorridos e threshold configurável.",
  },
  {
    icon: "🔍",
    badge: "Sprint 7",
    title: "Drill-down por critério",
    desc: "Análise de conformidade por critério de avaliação. Identifica os campos com mais falhas ou desvio padrão elevado.",
  },
  {
    icon: "📚",
    badge: "Sprint 7 · RAG",
    title: "Pesquisa semântica de documentos",
    desc: "Ingestão de briefings e guias de avaliação com embeddings OpenAI. Pesquisa por significado: encontra o conteúdo relevante mesmo sem palavras exactas.",
  },
  {
    icon: "🔔",
    badge: "Sprint 7",
    title: "Alertas configuráveis de score",
    desc: "Threshold global configurável. Lista em tempo real de estabelecimentos abaixo do limite com severidade (crítico / alto / médio) e delta.",
  },
  {
    icon: "📊",
    badge: "Fase 5",
    title: "Benchmarking cross-cliente",
    desc: "KPIs comparativos entre programas com masking para coordenadores. Posicionamento relativo por dimensão.",
  },
  {
    icon: "🛡️",
    badge: "Fase 5",
    title: "Detecção de fraude",
    desc: "Heurísticas multi-dimensional: intervalo suspeito, fotos duplicadas, score perfeito. Página dedicada com severidade e exportação.",
  },
  {
    icon: "🔐",
    badge: "Fase 4",
    title: "SSO / OIDC enterprise",
    desc: "Integração OIDC genérica com Authentik, Keycloak, Azure AD e Google. Auto-provisioning de utilizadores.",
  },
  {
    icon: "📱",
    badge: "Fase 4",
    title: "PWA offline-first",
    desc: "Cache stale-while-revalidate, manifest com shortcuts, push notifications e página offline personalizada.",
  },
  {
    icon: "📋",
    badge: "Fase 4",
    title: "Formulários dinâmicos",
    desc: "Builder visual de questionários com versionamento e submissão validada. Configurável por cliente e por onda.",
  },
  {
    icon: "🎓",
    badge: "Fase 4",
    title: "Formações e certificações",
    desc: "Gestão completa de formações de analistas com UI, registo de participação e histórico.",
  },
];

export default function IntroPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20">

      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-extrabold">Q</div>
            <span className="text-sm font-bold text-slate-800">Cognira <span className="text-indigo-600">by Cognira</span></span>
          </div>
          <span className="text-xs text-slate-400 bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full font-medium">
            🔒 Acesso Privado — Demo
          </span>
        </div>
      </header>

      {/* Hero — sem CTAs comerciais */}
      <section className="max-w-5xl mx-auto px-6 pt-12 pb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight mb-3">
          Plataforma de Mystery Shopping
        </h1>
        <p className="max-w-xl mx-auto text-base text-slate-500 dark:text-slate-400 leading-relaxed">
          Acesso demo completo à plataforma. Use as credenciais abaixo para explorar cada perfil de utilizador.
        </p>
      </section>

      {/* Credentials Panel */}
      <section className="max-w-5xl mx-auto px-6 pb-12">

        {/* Access links */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-lg transition-all"
          >
            <span>→</span> Entrar na Plataforma
          </Link>
          <Link
            href="/tenant-admin"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all shadow-sm"
          >
            <span>⚙</span> Painel Tenant Admin
          </Link>
        </div>

        {/* Platform accounts */}
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Contas da plataforma</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {PLATFORM_ACCOUNTS.map((acc) => (
            <div key={acc.role} className={`rounded-2xl border p-5 ${acc.color}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-bold ${acc.labelColor}`}>{acc.role}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${acc.badgeColor}`}>{acc.badge}</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">{acc.note}</p>
              <div className="bg-white/80 rounded-xl p-3 mb-3 space-y-1.5 font-mono text-xs">
                <div className="flex gap-2">
                  <span className="text-slate-400 w-16 shrink-0">Email</span>
                  <span className="text-slate-800 font-semibold break-all">{acc.email}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-slate-400 w-16 shrink-0">Password</span>
                  <span className="text-slate-800 font-semibold">{acc.password}</span>
                </div>
              </div>
              <ul className="space-y-1">
                {acc.access.map((a) => (
                  <li key={a} className={`text-xs flex items-center gap-1.5 ${acc.labelColor} opacity-80`}>
                    <span>✓</span> {a}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Client portal accounts */}
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Portal Cliente — acesso por empresa</h2>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Empresa</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Password</th>
              </tr>
            </thead>
            <tbody>
              {CLIENT_PORTAL_ACCOUNTS.map((c, i) => (
                <tr key={c.username} className={i < CLIENT_PORTAL_ACCOUNTS.length - 1 ? "border-b border-slate-100" : ""}>
                  <td className="px-4 py-3 font-semibold text-slate-700">{c.label}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.email}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-center text-xs text-slate-400">
          URL: <span className="font-mono text-slate-600">https://q21.otokura.online</span> &nbsp;·&nbsp; Tenant Demo: <span className="font-mono text-slate-600">Cognira Demo</span>
        </p>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="border-t border-slate-100 dark:border-slate-800 mb-12" />
      </div>

      {/* Features grid */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-center text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
          Funcionalidades da plataforma
        </h2>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-10">
          Desenvolvida internamente pela Cognira. Cada módulo pensado exclusivamente para mystery shopping.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <div className="inline-block text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md mb-2">
                {f.badge}
              </div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                {f.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer — sem CTAs comerciais */}
      <footer className="border-t border-slate-100 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 py-8 text-center">
        <p className="text-xs text-slate-400">
          © 2026 Cognira — Especialistas em Consultoria de Serviço ao Cliente &nbsp;·&nbsp; Documento confidencial
        </p>
      </footer>
    </div>
  );
}
