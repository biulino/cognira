import Link from "next/link";
import {
  ShieldCheck,
  Users,
  ClipboardList,
  Eye,
  Building2,
  Rocket,
  ArrowRight,
  Sparkles,
  LayoutGrid,
  BookOpen,
} from "lucide-react";

const ROLES = [
  {
    slug: "primeiros-passos",
    label: "Primeiros Passos",
    icon: Rocket,
    desc: "Como fazer login, navegar na plataforma e configurar a sua conta.",
    color: "from-slate-500 to-slate-700",
    border: "border-slate-200",
    badge: "Começa aqui",
    badgeCls: "bg-slate-100 text-slate-600",
  },
  {
    slug: "admin",
    label: "Administrador",
    icon: ShieldCheck,
    desc: "Gestão total da plataforma: utilizadores, estudos, aprovações e configurações.",
    color: "from-purple-500 to-purple-700",
    border: "border-purple-100",
    badge: "role_global: admin",
    badgeCls: "bg-purple-100 text-purple-600",
  },
  {
    slug: "coordenador",
    label: "Coordenador",
    icon: Users,
    desc: "Coordena equipas de campo, gere estudos atribuídos e acompanha o progresso.",
    color: "from-blue-500 to-blue-700",
    border: "border-blue-100",
    badge: "role por estudo",
    badgeCls: "bg-blue-100 text-blue-600",
  },
  {
    slug: "analista",
    label: "Analista de Campo",
    icon: ClipboardList,
    desc: "Executa visitas de mystery shopping e regista os dados na plataforma.",
    color: "from-emerald-500 to-emerald-700",
    border: "border-emerald-100",
    badge: "role por estudo",
    badgeCls: "bg-emerald-100 text-emerald-600",
  },
  {
    slug: "validador",
    label: "Validador",
    icon: Eye,
    desc: "Revê e valida as visitas inseridas, garantindo a qualidade dos dados.",
    color: "from-orange-500 to-orange-700",
    border: "border-orange-100",
    badge: "role por estudo",
    badgeCls: "bg-orange-100 text-orange-600",
  },
  {
    slug: "cliente",
    label: "Cliente",
    icon: Building2,
    desc: "Consulta resultados do estudo contratado e acompanha métricas de qualidade.",
    color: "from-teal-500 to-teal-700",
    border: "border-teal-100",
    badge: "role por estudo",
    badgeCls: "bg-teal-100 text-teal-600",
  },
];

export default function DocsHome() {
  return (
    <div>
      {/* Hero */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-[#2D6BEE]/10 text-[#2D6BEE] px-3 py-1.5 rounded-full text-xs font-semibold mb-4">
          <BookOpen className="w-3.5 h-3.5" />
          Documentação Oficial
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3 leading-tight">
          Bem-vindo à Documentação
          <br />
          <span className="text-[#2D6BEE]">Cognira CX Intelligence</span>
        </h1>
        <p className="text-slate-500 text-lg max-w-lg leading-relaxed">
          Guias completos para cada perfil de utilizador. Encontra o teu perfil abaixo e começa.
        </p>
      </div>

      {/* What is it */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2D6BEE] to-[#1A52CC] flex items-center justify-center flex-shrink-0 shadow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 mb-2">O que é o Cognira?</h2>
            <p className="text-slate-600 text-sm leading-relaxed">
            O <strong>Cognira</strong> é uma plataforma de{" "}
              <strong>CX Intelligence</strong> para gestão end-to-end de programas de experiência do cliente — mystery shopping, estudos de satisfação, contact center IA e inquéritos. Inclui 14+ módulos Cognira Intelligence™ (word cloud, sentimento, auto-QC, coaching, score preditivo, planeamento IA, relatórios narrativos, chat semântico e mais), <strong>multi-grelha de avaliação</strong> (N grelhas por estudo com secções e critérios ponderados por tipo de visita), encriptação PII Fernet, SSO/OIDC enterprise, PWA offline, QR surveys e Call Center IA com transcrição Whisper.
            </p>
          </div>
        </div>
      </div>

      {/* Quick links: IA + Features */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <Link
          href="/docs/ia"
          className="group bg-gradient-to-br from-[#2D6BEE] to-[#1A52CC] rounded-2xl p-4 text-white hover:shadow-lg transition-all hover:-translate-y-0.5"
        >
          <Sparkles className="w-5 h-5 mb-2 opacity-90" />
          <p className="font-bold text-sm">Cognira Intelligence™</p>
          <p className="text-white/70 text-xs mt-0.5 leading-relaxed">14+ módulos IA explicados</p>
        </Link>
        <Link
          href="/docs/funcionalidades"
          className="group bg-slate-900 rounded-2xl p-4 text-white hover:shadow-lg transition-all hover:-translate-y-0.5"
        >
          <LayoutGrid className="w-5 h-5 mb-2 opacity-90" />
          <p className="font-bold text-sm">Funcionalidades</p>
          <p className="text-white/70 text-xs mt-0.5 leading-relaxed">Catálogo completo</p>
        </Link>
      </div>

      {/* Role cards */}
      <h2 className="text-lg font-bold text-slate-900 mb-4">Guia por perfil</h2>
      <div className="grid gap-4">
        {ROLES.map(({ slug, label, icon: Icon, desc, color, border, badge, badgeCls }) => (
          <Link
            key={slug}
            href={`/docs/${slug}`}
            className={`group bg-white rounded-2xl border ${border} p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 flex items-start gap-4`}
          >
            <div
              className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0 shadow-sm`}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-bold text-slate-900 text-sm">{label}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeCls}`}>
                  {badge}
                </span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#2D6BEE] group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
          </Link>
        ))}
      </div>

      {/* Roles explanation */}
      <div className="mt-10 bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <h3 className="font-bold text-amber-900 text-sm mb-2">💡 Como funcionam os perfis?</h3>
        <p className="text-amber-800 text-sm leading-relaxed">
          Existem dois níveis de permissão: <strong>role_global</strong> (aplica-se a toda a
          plataforma, ex: <code className="bg-amber-100 px-1 rounded">admin</code>) e{" "}
          <strong>role por estudo</strong> (aplica-se apenas a estudos específicos, ex:{" "}
          <code className="bg-amber-100 px-1 rounded">coordenador</code>,{" "}
          <code className="bg-amber-100 px-1 rounded">analista</code>,{" "}
          <code className="bg-amber-100 px-1 rounded">validador</code>,{" "}
          <code className="bg-amber-100 px-1 rounded">cliente</code>). Um utilizador pode ter papéis
          diferentes em estudos diferentes.
        </p>
      </div>

      {/* API docs link */}
      <div className="mt-6 bg-slate-900 rounded-2xl p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4 text-slate-300" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Documentação da API</p>
            <p className="text-slate-400 text-xs mt-0.5">Swagger UI com todos os endpoints, schemas e exemplos interactivos.</p>
          </div>
        </div>
        <a
          href="/api/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 inline-flex items-center gap-1.5 bg-[#2D6BEE] hover:bg-[#1A52CC] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Abrir Swagger <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
