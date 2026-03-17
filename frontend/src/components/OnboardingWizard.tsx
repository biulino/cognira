"use client";
/**
 * OnboardingWizard — Role-specific multi-step onboarding overlay.
 * Shows once per user per browser (persisted in localStorage as `onboarding_v2_done`).
 * Steps are tailored to each role (admin / coordenador / analista / validador / cliente).
 */
import { useState, useEffect, useCallback } from "react";
import {
  ArrowRight,
  ArrowLeft,
  X,
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Users,
  BarChart3,
  ShieldCheck,
  Phone,
  MessageSquare,
  MapPin,
  Smartphone,
  Wifi,
  Star,
  Zap,
  Check,
} from "lucide-react";
import { useBranding } from "@/lib/branding";

// ── Step definitions ──────────────────────────────────────────────────────────

interface Step {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  content: React.ReactNode;
  cta?: { label: string; href: string };
}

function buildSteps(role: string, appName: string): Step[] {
  const welcome: Step = {
    icon: <span className="text-5xl">👋</span>,
    title: `Bem-vindo ao ${appName}`,
    subtitle: "A plataforma de Mystery Shopping & inteligência de mercado",
    content: (
      <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
        <p>
          Está pronto para começar. Este assistente guia-o pelos passos iniciais
          para que possa tirar o máximo partido da plataforma.
        </p>
        <p>
          Utilize os botões <span className="font-semibold text-slate-800 dark:text-slate-200">Seguinte</span> e <span className="font-semibold text-slate-800 dark:text-slate-200">Anterior</span> para navegar.
          Pode <span className="font-semibold text-slate-800 dark:text-slate-200">saltar</span> a qualquer momento.
        </p>
      </div>
    ),
  };

  const byRole: Record<string, Step[]> = {
    admin: [
      welcome,
      {
        icon: <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/30"><LayoutDashboard className="w-8 h-8 text-blue-600 dark:text-blue-400" /></div>,
        title: "Arquitectura da plataforma",
        subtitle: "Clientes → Estudos → Ondas → Estabelecimentos → Visitas",
        content: (
          <div className="space-y-3">
            {[
              ["🏢 Clientes", "Cada empresa que contrata o serviço é um Cliente. Tem o seu portal, estudos e analistas."],
              ["📊 Estudos & Ondas", "Um Estudo agrupa múltiplas Ondas (rondas periódicas). Cada onda cobre um conjunto de estabelecimentos."],
              ["📍 Estabelecimentos", "Lojas, balcões, postos — os locais onde as visitas acontecem."],
              ["✅ Visitas", "Cada visita de campo gera um relatório com fotos, avaliações e análise IA."],
            ].map(([label, desc]) => (
              <div key={label as string} className="flex gap-3">
                <span className="text-base mt-0.5">{(label as string).split(" ")[0]}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{(label as string).slice(2)}</p>
                  <p className="text-xs text-slate-500">{desc as string}</p>
                </div>
              </div>
            ))}
          </div>
        ),
      },
      {
        icon: <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-900/30"><Users className="w-8 h-8 text-purple-600 dark:text-purple-400" /></div>,
        title: "Funções de utilizador",
        subtitle: "Cada utilizador tem um papel com permissões específicas",
        content: (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ["admin", "Acesso total. Configura clientes, utilizadores, branding e definições globais.", "#2D6BEE"],
              ["coordenador", "Gere estudos, valida visitas e supervisiona a equipa de analistas.", "#7C3AED"],
              ["analista", "Executa visitas de campo. Acede via mobile ou browser.", "#0EA5E9"],
              ["validador", "Revê e aprova visitas submetidas pelos analistas.", "#10B981"],
              ["cliente", "Acesso ao portal de resultados do seu programa.", "#F59E0B"],
            ].map(([r, desc, color]) => (
              <div key={r as string} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                <p className="font-bold text-xs mb-1" style={{ color: color as string }}>{r as string}</p>
                <p className="text-slate-500 text-[11px] leading-snug">{desc as string}</p>
              </div>
            ))}
          </div>
        ),
      },
      {
        icon: <div className="p-3 rounded-2xl bg-orange-50 dark:bg-orange-900/30"><Zap className="w-8 h-8 text-orange-500" /></div>,
        title: "9 módulos de IA",
        subtitle: "Cognira Intelligence™ — cada visita é analisada automaticamente",
        content: (
          <div className="space-y-2 text-xs">
            {[
              ["Score preditivo", "Prevê o resultado antes da visita acontecer"],
              ["Relatório narrativo", "Gera texto de análise completo automaticamente"],
              ["Insights & tendências", "Detecta padrões entre ondas"],
              ["Word cloud & sentimento", "Analisa respostas abertas dos questionários"],
              ["Shelf audit", "Analisa fotos para conformidade de exposição"],
              ["Planograma", "Compara planograma de referência com a realidade"],
              ["Call center", "Transcreve e pontua chamadas"],
              ["Detecção de fraude", "Detecta anomalias e visitas suspeitas"],
              ["Chat IA", "Assistente de logística e análise em linguagem natural"],
            ].map(([t, d]) => (
              <div key={t as string} className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{t as string}</span>
                  <span className="text-slate-400"> — {d as string}</span>
                </div>
              </div>
            ))}
          </div>
        ),
      },
      {
        icon: <span className="text-5xl">🚀</span>,
        title: "Pronto para começar!",
        subtitle: "Aqui ficam os primeiros passos sugeridos",
        content: (
          <div className="space-y-2">
            {[
              ["/clientes", "1. Cria o primeiro cliente"],
              ["/estudos", "2. Cria um estudo e primeira onda"],
              ["/utilizadores", "3. Convida analistas e coordenadores"],
              ["/configuracoes/branding", "4. Personaliza o branding da plataforma"],
            ].map(([href, label]) => (
              <a
                key={href as string}
                href={href as string}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-[#2D6BEE] transition group"
              >
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#2D6BEE] transition" />
                {label as string}
              </a>
            ))}
          </div>
        ),
      },
    ],
    coordenador: [
      welcome,
      {
        icon: <div className="p-3 rounded-2xl bg-violet-50 dark:bg-violet-900/30"><BookOpen className="w-8 h-8 text-violet-600" /></div>,
        title: "O seu espaço de trabalho",
        subtitle: "Estudos, ondas e equipas de analistas",
        content: (
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <p>Como coordenador, gere um ou mais estudos. Cada estudo tem ondas periódicas onde os analistas executam visitas a estabelecimentos.</p>
            <p>Pode monitorizar o progresso em tempo real no <strong className="text-slate-800 dark:text-white">Dashboard</strong> e no <strong className="text-slate-800 dark:text-white">Mapa</strong>.</p>
          </div>
        ),
      },
      {
        icon: <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-900/30"><ClipboardList className="w-8 h-8 text-sky-600" /></div>,
        title: "Ciclo de vida de uma visita",
        content: (
          <div className="space-y-2">
            {[
              ["🔵", "atribuído", "Analista foi designado para a visita"],
              ["🟡", "em_curso", "Visita em realização no campo"],
              ["🟠", "submetido", "Analista submeteu o relatório — aguarda validação"],
              ["🟢", "validado", "Validado por coordenador ou validador"],
              ["🔴", "rejeitado", "Devolvido com feedback para correcção"],
            ].map(([emoji, state, desc]) => (
              <div key={state as string} className="flex items-start gap-3 text-sm">
                <span className="text-base">{emoji as string}</span>
                <div>
                  <code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{state as string}</code>
                  <span className="text-slate-500 text-xs ml-2">{desc as string}</span>
                </div>
              </div>
            ))}
          </div>
        ),
      },
      {
        icon: <div className="p-3 rounded-2xl bg-green-50 dark:bg-green-900/30"><BarChart3 className="w-8 h-8 text-green-600" /></div>,
        title: "Relatórios & IA",
        content: (
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <p>Em cada visita validada, acede ao <strong className="text-slate-800 dark:text-white">relatório narrativo automático</strong> gerado por IA com base nas avaliações e fotos.</p>
            <p>No menu <strong className="text-slate-800 dark:text-white">Relatórios</strong> tens KPIs consolidados, exportação PDF multi-idioma e comparativo entre ondas.</p>
          </div>
        ),
        cta: { label: "Ver Relatórios", href: "/relatorios" },
      },
      {
        icon: <span className="text-5xl">✅</span>,
        title: "Pronto!",
        content: (
          <div className="space-y-2">
            {[
              ["/estudos", "Ver os meus estudos"],
              ["/visitas", "Visitas pendentes de validação"],
              ["/analistas", "Gerir equipa de analistas"],
            ].map(([href, label]) => (
              <a key={href as string} href={href as string} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-[#2D6BEE] transition group">
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#2D6BEE]" />
                {label as string}
              </a>
            ))}
          </div>
        ),
      },
    ],
    analista: [
      welcome,
      {
        icon: <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-900/30"><MapPin className="w-8 h-8 text-sky-600" /></div>,
        title: "O seu papel",
        subtitle: "Visitas de campo — o coração da plataforma",
        content: (
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <p>Como analista, recebe visitas atribuídas, executa-as no terreno e submete um relatório com fotos e avaliações.</p>
            <p>Acede à lista de visitas no menu <strong className="text-slate-800 dark:text-white">Visitas</strong>. Cada visita mostra o local, estudo e questões a avaliar.</p>
          </div>
        ),
      },
      {
        icon: <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30"><Smartphone className="w-8 h-8 text-indigo-600" /></div>,
        title: "Funciona no mobile",
        subtitle: "Optimizado para uso no terreno",
        content: (
          <div className="space-y-3">
            <div className="flex gap-3 text-sm">
              <Wifi className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">Modo offline</p>
                <p className="text-slate-500 text-xs">Trabalha sem internet. O relatório é guardado localmente e sincronizado quando recuperares sinal.</p>
              </div>
            </div>
            <div className="flex gap-3 text-sm">
              <Star className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">QR Codes & Barcode</p>
                <p className="text-slate-500 text-xs">Digitaliza produtos com a câmara para preenchimento automático de shelf audit.</p>
              </div>
            </div>
            <div className="flex gap-3 text-sm">
              <Phone className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">Chat de voz</p>
                <p className="text-slate-500 text-xs">Liga directamente ao coordenador a partir da conversa de chat interno.</p>
              </div>
            </div>
          </div>
        ),
      },
      {
        icon: <span className="text-5xl">🎯</span>,
        title: "Primeiro passo",
        content: (
          <div className="space-y-2">
            {[
              ["/visitas", "Ver as minhas visitas atribuídas"],
              ["/chat-interno", "Contactar o coordenador"],
            ].map(([href, label]) => (
              <a key={href as string} href={href as string} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-[#2D6BEE] transition group">
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#2D6BEE]" />
                {label as string}
              </a>
            ))}
          </div>
        ),
      },
    ],
    validador: [
      welcome,
      {
        icon: <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30"><ShieldCheck className="w-8 h-8 text-emerald-600" /></div>,
        title: "O seu papel",
        subtitle: "Revisão e validação de visitas submetidas",
        content: (
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <p>Como validador, revê os relatórios submetidos pelos analistas. Pode <strong className="text-slate-800 dark:text-white">validar</strong> ou <strong className="text-slate-800 dark:text-white">rejeitar</strong> com feedback.</p>
            <p>Visitas rejeitadas voltam ao analista para correcção. Visitas validadas ficam disponíveis nos relatórios do cliente.</p>
          </div>
        ),
      },
      {
        icon: <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-900/30"><ClipboardList className="w-8 h-8 text-sky-600" /></div>,
        title: "Fluxo de revisão",
        content: (
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <p>No menu <strong className="text-slate-800 dark:text-white">Visitas</strong>, filtre por estado <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">submetido</code> para ver as que aguardam revisão.</p>
            <p>Cada visita mostra fotos, respostas ao questionário e o relatório narrativo gerado pela IA — usa tudo para tomar uma decisão informada.</p>
          </div>
        ),
        cta: { label: "Ver Visitas", href: "/visitas" },
      },
    ],
    cliente: [
      welcome,
      {
        icon: <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/30"><BarChart3 className="w-8 h-8 text-blue-600" /></div>,
        title: "O seu portal",
        subtitle: "Resultados do seu programa de mystery shopping",
        content: (
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <p>No seu <strong className="text-slate-800 dark:text-white">Dashboard</strong> tem os principais KPIs do seu programa: score médio, conformidade, tendências ao longo do tempo.</p>
            <p>Acede ao <strong className="text-slate-800 dark:text-white">Portal</strong> para ver mapas geográficos de resultados e exportar relatórios em PDF.</p>
          </div>
        ),
      },
      {
        icon: <div className="p-3 rounded-2xl bg-green-50 dark:bg-green-900/30"><MessageSquare className="w-8 h-8 text-green-600" /></div>,
        title: "Comunicação directa",
        content: (
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <p>Usa o <strong className="text-slate-800 dark:text-white">Chat IA</strong> para fazer perguntas sobre os resultados em linguagem natural.</p>
            <p>Recebe notificações quando novas visitas são validadas ou quando o seu score altera significativamente.</p>
          </div>
        ),
        cta: { label: "Ver Portal", href: "/portal" },
      },
    ],
  };

  return byRole[role] ?? byRole["analista"];
}

// ── Component ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "onboarding_v2_done";

interface Props {
  role: string;
}

export default function OnboardingWizard({ role }: Props) {
  const { app_name } = useBranding();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!role) return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setVisible(true);
  }, [role]);

  const steps = buildSteps(role, app_name);
  const total = steps.length;

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, "1");
      setVisible(false);
    }, 300);
  }, []);

  const next = () => {
    if (step < total - 1) setStep((s) => s + 1);
    else dismiss();
  };

  const prev = () => setStep((s) => Math.max(0, s - 1));

  if (!visible || !role) return null;

  const current = steps[step];
  const isLast = step === total - 1;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
        exiting ? "opacity-0 scale-95" : "opacity-100"
      }`}
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg transition-all duration-300 overflow-hidden ${
          exiting ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
        }`}
      >
        {/* Progress bar */}
        <div className="h-1 bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-[#2D6BEE] transition-all duration-500"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <div className="flex items-center gap-2">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`rounded-full transition-all duration-200 ${
                  i === step
                    ? "w-6 h-2.5 bg-[#2D6BEE]"
                    : i < step
                    ? "w-2.5 h-2.5 bg-[#2D6BEE]/40"
                    : "w-2.5 h-2.5 bg-slate-200 dark:bg-slate-700"
                }`}
              />
            ))}
          </div>
          <button
            onClick={dismiss}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content — key change triggers re-render animation */}
        <div
          key={step}
          className="px-6 pt-5 pb-4 animate-in fade-in slide-in-from-right-4 duration-300"
          style={{ animationDuration: "250ms" }}
        >
          {/* Icon */}
          <div className="flex justify-center mb-4">{current.icon}</div>

          {/* Title */}
          <h2 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-1">
            {current.title}
          </h2>
          {current.subtitle && (
            <p className="text-sm text-slate-400 text-center mb-5">{current.subtitle}</p>
          )}
          {!current.subtitle && <div className="mb-4" />}

          {/* Step body */}
          <div>{current.content}</div>

          {/* Optional CTA */}
          {current.cta && (
            <a
              href={current.cta.href}
              onClick={dismiss}
              className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#2D6BEE]/10 text-[#2D6BEE] font-semibold text-sm hover:bg-[#2D6BEE]/20 transition"
            >
              {current.cta.label} <ArrowRight className="w-4 h-4" />
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={dismiss}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
          >
            Saltar introdução
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={prev}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Anterior
              </button>
            )}
            <button
              onClick={next}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold bg-[#2D6BEE] text-white hover:bg-[#1A52CC] shadow transition"
            >
              {isLast ? "Concluir" : "Seguinte"}
              {!isLast && <ArrowRight className="w-3.5 h-3.5" />}
              {isLast && <Check className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
