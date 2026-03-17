import {
  Sparkles, Camera, CalendarRange, TrendingUp, MessageSquare,
  Search, Brain, AlertTriangle, CheckCircle2, Phone, FileText,
  Zap, Bot, Cpu,
} from "lucide-react";

// ── Shared components ────────────────────────────────────────────────────────

function ModuleHeader({
  id, num, gradient, icon: Icon, title, subtitle,
}: { id: string; num: string; gradient: string; icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className={`rounded-t-2xl bg-gradient-to-r ${gradient} px-6 py-5`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-white/60 text-[10px] font-bold uppercase tracking-widest">
            {num === "CC" ? "Call Center IA" : `Módulo ${num}`}
          </div>
          <h2 className="text-white font-bold text-lg leading-tight">{title}</h2>
        </div>
      </div>
      <p className="text-white/80 text-sm mt-2 leading-relaxed">{subtitle}</p>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm text-slate-600 leading-relaxed">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#2D6BEE]/10 text-[#2D6BEE] text-xs font-bold flex items-center justify-center mt-0.5">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Endpoint({ method, path }: { method: "GET" | "POST" | "PUT"; path: string }) {
  const colors: Record<string, string> = { GET: "text-emerald-400", POST: "text-[#2D6BEE]", PUT: "text-amber-400" };
  return (
    <div className="bg-slate-900 rounded-xl px-4 py-2.5 font-mono text-xs text-slate-300 flex items-center gap-2 mt-3">
      <span className={`font-bold ${colors[method]}`}>{method}</span>
      <span>{path}</span>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{label}</span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function IADocsPage() {
  return (
    <div>
      {/* Hero */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-[#2D6BEE]/10 text-[#2D6BEE] px-3 py-1.5 rounded-full text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          Cognira Intelligence™
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3 leading-tight">
          Módulos de Inteligência
          <br />
          <span className="text-[#2D6BEE]">Artificial</span>
        </h1>
        <p className="text-slate-500 text-lg max-w-lg leading-relaxed">
          O motor Cognira Intelligence™ integra 9 módulos de IA para automatizar relatórios,
          detetar anomalias, planear visitas e muito mais — tudo sem sair da plataforma.
        </p>
      </div>

      {/* Overview pills */}
      <div className="flex flex-wrap gap-2 mb-10">
        {[
          ["#modulo-1", "01 Relatório Narrativo"],
          ["#modulo-3", "03 Fotos IA"],
          ["#modulo-4", "04 Planeamento Auto"],
          ["#modulo-5", "05 Insights"],
          ["#modulo-6", "06 Chat Logística"],
          ["#modulo-7", "07 Chat Semântico"],
          ["#modulo-8", "08 Score Preditivo"],
          ["#anomalias", "Anomalias"],
          ["#validacao-ia", "Validação IA"],
          ["#callcenter", "Call Center IA"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-[#2D6BEE] hover:text-[#2D6BEE] transition-colors shadow-sm"
          >
            <Sparkles className="w-3 h-3" />
            {label}
          </a>
        ))}
      </div>

      {/* ── Módulo 1 ──────────────────────────────────────────────────────── */}
      <section id="modulo-1" className="mb-10 scroll-mt-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <ModuleHeader
            id="modulo-1" num="01"
            gradient="from-violet-500 to-violet-700"
            icon={FileText}
            title="Relatório Narrativo"
            subtitle="Gera automaticamente um relatório narrativo completo do estudo em linguagem natural"
          />
          <div className="px-6 py-5">
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              Utiliza <strong>GPT-4.1</strong> para transformar os dados quantitativos de um estudo
              (pontuações, estados de visitas, analistas, estabelecimentos) num relatório executivo
              narrativo profissional em português. O relatório cobre: resumo executivo, pontos fortes,
              áreas de melhoria, desvios regionais e recomendações estratégicas. Pode ser filtrado
              por onda específica.
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Como Usar</p>
            <ol className="space-y-1.5 mb-4">
              <Step n={1}>Acede a <strong>Estudos → {"{"}estudo{"}"} → Relatório</strong>.</Step>
              <Step n={2}>Selecciona opcionalmente uma onda do dropdown.</Step>
              <Step n={3}>Clica <strong>"Gerar Relatório IA"</strong> — aguarda 5-15 segundos.</Step>
              <Step n={4}>O relatório aparece no painel lateral. Podes fazer download em PDF.</Step>
            </ol>
            <Endpoint method="POST" path="/api/estudos/{id}/relatorio-ia?onda_id={oid}" />
            <div className="flex flex-wrap gap-1.5 mt-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1 self-center">Roles:</span>
              <Tag label="admin" /><Tag label="coordenador" /><Tag label="validador" /><Tag label="cliente" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Módulo 3 ──────────────────────────────────────────────────────── */}
      <section id="modulo-3" className="mb-10 scroll-mt-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <ModuleHeader
            id="modulo-3" num="03"
            gradient="from-rose-500 to-rose-700"
            icon={Camera}
            title="Fotos IA — Cognira Vision Engine"
            subtitle="Analisa fotografias das visitas com GPT-4o Vision e emite veredicto de conformidade"
          />
          <div className="px-6 py-5">
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              Cada foto de uma visita pode ser submetida ao <strong>GPT-4o Vision</strong> para análise
              automática. O modelo retorna: <em>veredicto</em> (conforme / não-conforme / inconclusivo),
              <em>confiança</em> (0–100%), e <em>motivo</em> detalhado. Os resultados são persistidos
              na base de dados e ficam visíveis na galeria de fotos da visita. O contexto é passado
              juntamente com a imagem para o modelo interpretar o que deve ser validado.
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Como Usar</p>
            <ol className="space-y-1.5 mb-4">
              <Step n={1}>Abre o <strong>modal de fotos</strong> de uma visita (ícone câmara).</Step>
              <Step n={2}>Clica no ícone <strong>🤖 Analisar</strong> junto à foto pretendida.</Step>
              <Step n={3}>O resultado aparece imediatamente: veredicto colorido + confiança + justificação.</Step>
              <Step n={4}>O validador pode usar o parecer IA para aprovar ou rejeitar a visita.</Step>
            </ol>
            <Endpoint method="POST" path="/api/visitas/{id}/fotos/{foto_id}/analisar" />
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mt-3">
              <strong>Nota:</strong> A análise consome créditos OpenAI (GPT-4o Vision). Recomenda-se
              usar apenas em fotos relevantes para validação.
            </div>
            <div className="flex flex-wrap gap-1.5 mt-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1 self-center">Roles:</span>
              <Tag label="admin" /><Tag label="coordenador" /><Tag label="validador" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Módulo 4 ──────────────────────────────────────────────────────── */}
      <section id="modulo-4" className="mb-10 scroll-mt-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <ModuleHeader
            id="modulo-4" num="04"
            gradient="from-blue-500 to-blue-700"
            icon={CalendarRange}
            title="Planeamento Automático de Visitas"
            subtitle="Distribui estabelecimentos por analistas disponíveis de forma óptima para uma onda"
          />
          <div className="px-6 py-5">
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              Para uma onda de um estudo, o módulo 4 usa IA (GPT-4.1-nano) para sugerir o melhor plano
              de atribuição: que analista deve visitar que estabelecimento, tendo em conta disponibilidade,
              chilling periods, blacklist e carga de trabalho equilibrada. O plano é apresentado para
              revisão antes de ser aplicado — nenhuma visita é criada sem confirmação.
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Como Usar</p>
            <ol className="space-y-1.5 mb-4">
              <Step n={1}>Em <strong>Estudos → {"{"}estudo{"}"}</strong>, localiza a secção <strong>Ondas</strong>.</Step>
              <Step n={2}>Clica no ícone <strong>✨ Planear IA</strong> junto à onda desejada.</Step>
              <Step n={3}>O sistema mostra o plano sugerido: analista ↔ lista de estabelecimentos.</Step>
              <Step n={4}>Revê o plano e clica <strong>"Aplicar Plano"</strong> para criar as visitas com estado <code>planeada</code>.</Step>
            </ol>
            <Endpoint method="POST" path="/api/estudos/{id}/ondas/{oid}/planear-ia" />
            <div className="flex flex-wrap gap-1.5 mt-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1 self-center">Roles:</span>
              <Tag label="admin" /><Tag label="coordenador" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Módulo 5 ──────────────────────────────────────────────────────── */}
      <section id="modulo-5" className="mb-10 scroll-mt-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <ModuleHeader
            id="modulo-5" num="05"
            gradient="from-emerald-500 to-emerald-700"
            icon={TrendingUp}
            title="Insights Semanais"
            subtitle="Gera análise estratégica on-demand com tendências, alertas e próximas acções"
          />
          <div className="px-6 py-5">
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              O módulo 5 usa <strong>GPT-4.1</strong> para analisar os dados actuais do estudo e produzir
              um sumário executivo com: tendências de pontuação, analistas em destaque (positivo e negativo),
              estabelecimentos problemáticos, variações entre regiões e uma lista de <em>próximas acções
              sugeridas</em>. Ideal para reuniões semanais com o cliente.
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Como Usar</p>
            <ol className="space-y-1.5 mb-4">
              <Step n={1}>Em <strong>Estudos → {"{"}estudo{"}"}</strong>, scroll para a secção <strong>Insights</strong>.</Step>
              <Step n={2}>Clica <strong>"Gerar Insights"</strong>.</Step>
              <Step n={3}>Os insights aparecem organizados em categorias com ícones de prioridade.</Step>
              <Step n={4}>A lista "Próximas Acções" pode ser copiada directamente para uma apresentação.</Step>
            </ol>
            <Endpoint method="GET" path="/api/estudos/{id}/insights" />
            <div className="flex flex-wrap gap-1.5 mt-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1 self-center">Roles:</span>
              <Tag label="admin" /><Tag label="coordenador" /><Tag label="cliente" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Módulo 6 ──────────────────────────────────────────────────────── */}
      <section id="modulo-6" className="mb-10 scroll-mt-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <ModuleHeader
            id="modulo-6" num="06"
            gradient="from-amber-500 to-amber-700"
            icon={MessageSquare}
            title="Chat de Logística"
            subtitle="Reatribui visitas entre analistas através de linguagem natural no chat"
          />
          <div className="px-6 py-5">
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              O chat de logística (integrado no <strong>Chat IA</strong>) permite comandos como{" "}
              <em>"Reatribui a visita 123 ao analista João Silva"</em> ou{" "}
              <em>"Que visitas tem a Maria Costa esta semana?"</em>. Antes de executar qualquer
              alteração, o sistema <strong>mostra sempre um preview</strong> da operação para confirmação.
              Usa GPT-4.1 com Function Calling — nunca expõe SQL ao utilizador.
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Como Usar</p>
            <ol className="space-y-1.5 mb-4">
              <Step n={1}>Acede a <strong>Chat IA</strong> no menu lateral.</Step>
              <Step n={2}>Escreve o pedido em linguagem natural (ex: <em>"Reatribui visita 55 à Ana"</em>).</Step>
              <Step n={3}>O sistema mostra o preview da operação — visita, analista actual, novo analista.</Step>
              <Step n={4}>Confirma ou rejeita. A alteração só é feita após confirmação.</Step>
            </ol>
            <div className="flex flex-wrap gap-1.5 mt-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1 self-center">Roles:</span>
              <Tag label="admin" /><Tag label="coordenador" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Módulo 7 ──────────────────────────────────────────────────────── */}
      <section id="modulo-7" className="mb-10 scroll-mt-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <ModuleHeader
            id="modulo-7" num="07"
            gradient="from-cyan-500 to-cyan-700"
            icon={Search}
            title="Chat Semântico — text-to-SQL"
            subtitle="Responde a perguntas sobre os dados da plataforma em linguagem natural"
          />
          <div className="px-6 py-5">
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              O módulo 7 usa <strong>GPT-4.1-nano</strong> para traduzir perguntas em português para
              queries SQL seguras, executá-las na base de dados e devolver respostas conversacionais.
              Exemplos: <em>"Quantas visitas foram reprovadas no mês passado?"</em>,{" "}
              <em>"Qual o analista com melhor pontuação média no estudo Vodafone?"</em>,{" "}
              <em>"Mostra os estabelecimentos da região Norte sem visita esta onda."</em>
              O SQL nunca é exposto ao utilizador — apenas a resposta em linguagem natural.
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Como Usar</p>
            <ol className="space-y-1.5 mb-4">
              <Step n={1}>Acede a <strong>Chat IA</strong> no menu.</Step>
              <Step n={2}>Escreve qualquer pergunta sobre os dados da plataforma.</Step>
              <Step n={3}>O sistema responde com dados reais e sugere perguntas de seguimento.</Step>
              <Step n={4}>Os chips de sugestão na parte inferior aceleram a navegação de dados.</Step>
            </ol>
            <Endpoint method="POST" path="/api/chat" />
            <div className="flex flex-wrap gap-1.5 mt-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1 self-center">Roles:</span>
              <Tag label="admin" /><Tag label="coordenador" /><Tag label="cliente" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Módulo 8 ──────────────────────────────────────────────────────── */}
      <section id="modulo-8" className="mb-10 scroll-mt-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <ModuleHeader
            id="modulo-8" num="08"
            gradient="from-indigo-500 to-indigo-700"
            icon={Brain}
            title="Score Preditivo de Analistas"
            subtitle="Projecta a trajectória de desempenho de cada analista com intervalo de confiança"
          />
          <div className="px-6 py-5">
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              Para cada analista, o módulo 8 analisa o histórico de pontuações nas últimas visitas e usa
              GPT-4.1 para: calcular a <strong>tendência</strong> (subida / descida / estável),{" "}
              <strong>score projectado</strong> para as próximas visitas com intervalo de confiança,
              e listar os <strong>factores determinantes</strong> do desempenho. Útil para decisões de
              atribuição e formação proactiva.
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Como Usar</p>
            <ol className="space-y-1.5 mb-4">
              <Step n={1}>Acede a <strong>Analistas</strong> no menu.</Step>
              <Step n={2}>Clica no ícone <strong>🧠 Score Preditivo</strong> junto ao analista.</Step>
              <Step n={3}>Um modal mostra: score actual, tendência, projecção gráfica e factores.</Step>
              <Step n={4}>Usa a informação para decidir atribuições ou recomendar formação.</Step>
            </ol>
            <Endpoint method="GET" path="/api/analistas/{id}/score-preditivo" />
            <div className="flex flex-wrap gap-1.5 mt-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1 self-center">Roles:</span>
              <Tag label="admin" /><Tag label="coordenador" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Anomalias ─────────────────────────────────────────────────────── */}
      <section id="anomalias" className="mb-10 scroll-mt-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <ModuleHeader
            id="anomalias" num="—"
            gradient="from-orange-500 to-orange-700"
            icon={AlertTriangle}
            title="Detecção de Anomalias"
            subtitle="Identifica analistas cujo comportamento se desvia estatisticamente da média (±2σ)"
          />
          <div className="px-6 py-5">
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              O sistema calcula, para cada analista activo, a <strong>média e desvio-padrão</strong> das
              pontuações de todas as visitas do estudo. Analistas com pontuação média a mais de <strong>2
              desvios-padrão</strong> da média global são assinalados como anomalia — tanto positiva
              (sobre-desempenho suspeito) como negativa (sub-desempenho). Os alertas incluem contexto e
              sugestões de acção.
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Como Usar</p>
            <ol className="space-y-1.5 mb-4">
              <Step n={1}>Acede a <strong>Analistas</strong> e clica em <strong>"Anomalias"</strong>.</Step>
              <Step n={2}>A lista mostra analistas fora do range normal com o desvio calculado.</Step>
              <Step n={3}>Clica num analista para ver as visitas que contribuíram para a anomalia.</Step>
              <Step n={4}>Combina com o Score Preditivo para perceber se é uma tendência ou pontual.</Step>
            </ol>
            <Endpoint method="GET" path="/api/analistas/anomalias" />
            <div className="flex flex-wrap gap-1.5 mt-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1 self-center">Roles:</span>
              <Tag label="admin" /><Tag label="coordenador" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Validação IA ──────────────────────────────────────────────────── */}
      <section id="validacao-ia" className="mb-10 scroll-mt-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <ModuleHeader
            id="validacao-ia" num="—"
            gradient="from-teal-500 to-teal-700"
            icon={CheckCircle2}
            title="Validação Assistida por IA"
            subtitle="Emite parecer de aprovação ou rejeição para cada visita com justificação detalhada"
          />
          <div className="px-6 py-5">
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              Antes de aprovar ou rejeitar uma visita manualmente, o validador pode pedir ao motor Cognira IA
              um <strong>parecer preliminar</strong>. O sistema analisa: pontuações da grelha, campos de
              caracterização, fotos (se existirem resultados do Módulo 3) e histórico do analista. Retorna:
              recomendação (<em>aprovar / corrigir / rever</em>), confiança percentual e lista de motivos.
              O validador mantém sempre a decisão final.
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Como Usar</p>
            <ol className="space-y-1.5 mb-4">
              <Step n={1}>Abre o <strong>modal de detalhe</strong> de uma visita.</Step>
              <Step n={2}>Clica no botão <strong>✨ Validar com IA</strong>.</Step>
              <Step n={3}>O parecer aparece em 3–8 segundos com recomendação e justificação.</Step>
              <Step n={4}>Usa o parecer como apoio à decisão. Clica "Aprovar" ou "Corrigir" normalmente.</Step>
            </ol>
            <Endpoint method="POST" path="/api/visitas/{id}/validar-ia" />
            <div className="flex flex-wrap gap-1.5 mt-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1 self-center">Roles:</span>
              <Tag label="admin" /><Tag label="coordenador" /><Tag label="validador" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Call Center IA ────────────────────────────────────────────────── */}
      <section id="callcenter" className="mb-10 scroll-mt-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <ModuleHeader
            id="callcenter" num="CC"
            gradient="from-[#2D6BEE] to-[#1A52CC]"
            icon={Phone}
            title="Call Center IA — Cognira Voice Engine"
            subtitle="Pipeline completo: upload de áudio → transcrição Whisper → extracção GPT-4.1 → relatório PDF"
          />
          <div className="px-6 py-5">
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              O módulo Call Center IA é um subsistema completo para análise de chamadas telefónicas.
              O workflow é totalmente automatizado em background: o utilizador faz upload do ficheiro
              de áudio, o sistema transcreve com <strong>Whisper STT</strong>, extrai campos de avaliação
              configuráveis com <strong>GPT-4.1</strong> e gera um <strong>relatório PDF</strong> formatado
              sem dependências externas (puro Python). Os templates de avaliação são configuráveis por
              cliente — cada campo pode ser texto, número ou classificação.
            </p>

            <div className="grid sm:grid-cols-3 gap-3 mb-4">
              {[
                { icon: Cpu, title: "Whisper STT", desc: "Transcrição automática de áudio em qualquer língua" },
                { icon: Bot, title: "GPT-4.1 Extraction", desc: "Extracção estruturada de KPIs por template configurável" },
                { icon: FileText, title: "PDF Automático", desc: "Relatório formatado gerado sem dependências externas" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-slate-50 rounded-xl p-3">
                  <Icon className="w-4 h-4 text-[#2D6BEE] mb-1.5" />
                  <p className="text-xs font-semibold text-slate-800">{title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Como Usar</p>
            <ol className="space-y-1.5 mb-4">
              <Step n={1}>Acede a <strong>Call Center</strong> no menu.</Step>
              <Step n={2}>Clica <strong>"Nova Chamada"</strong> e faz upload do ficheiro de áudio (MP3/WAV/M4A, até 100 MB).</Step>
              <Step n={3}>O sistema processa em background — verás o estado <em>a processar</em> → <em>concluído</em>.</Step>
              <Step n={4}>Clica na chamada para ver transcrição, campos extraídos e score.</Step>
              <Step n={5}>Clica <strong>"Download PDF"</strong> para o relatório formatado.</Step>
              <Step n={6}>Em <strong>Call Center → Admin</strong>, configura os templates e campos de avaliação por cliente.</Step>
            </ol>

            <div className="bg-[#2D6BEE]/5 border border-[#2D6BEE]/20 rounded-xl p-3 text-xs text-slate-700 mb-4">
              <Zap className="w-3.5 h-3.5 text-[#2D6BEE] inline mr-1.5" />
              <strong>Template configurável:</strong> Em <em>Call Center → Administração</em>,
              o admin pode definir os campos de avaliação, pesos e texto de instruções para o GPT
              interpretar cada chamada conforme os critérios do cliente.
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1 self-center">Roles:</span>
              <Tag label="admin" /><Tag label="coordenador" /><Tag label="validador" /><Tag label="analista" />
            </div>
          </div>
        </div>
      </section>

      {/* Bottom: model reference */}
      <div className="bg-slate-900 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-slate-300" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Modelos utilizados</p>
          <p className="text-slate-400 text-xs mt-1 leading-relaxed">
            <strong className="text-slate-300">gpt-4.1-nano</strong> — Chat semântico (módulo 7), planeamento (módulo 4), score preditivo (módulo 8)
            &nbsp;·&nbsp;
            <strong className="text-slate-300">gpt-4.1</strong> — Relatório narrativo (módulo 1), insights (módulo 5), Call Center extracção
            &nbsp;·&nbsp;
            <strong className="text-slate-300">gpt-4o</strong> — Análise de fotos (módulo 3, Vision)
            &nbsp;·&nbsp;
            <strong className="text-slate-300">whisper-1</strong> — Transcrição de chamadas (Call Center)
          </p>
        </div>
      </div>
    </div>
  );
}
