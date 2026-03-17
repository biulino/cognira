import { Building2, BarChart3, ChevronRight } from "lucide-react";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10 scroll-mt-6">
      <h2 className="text-xl font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">{title}</h2>
      {children}
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 mb-5">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center text-sm font-bold shadow-sm">
        {n}
      </div>
      <div>
        <p className="font-semibold text-slate-900 mb-1">{title}</p>
        <div className="text-slate-600 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-sm text-teal-800 leading-relaxed my-4">
      <span className="font-bold">💡 Dica: </span>{children}
    </div>
  );
}

export default function ClienteDocsPage() {
  return (
    <div>
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-teal-100 text-teal-700 px-3 py-1.5 rounded-full text-xs font-semibold mb-3">
          <Building2 className="w-3.5 h-3.5" />
          Perfil: Cliente
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Guia do Cliente</h1>
        <p className="text-slate-500 text-base leading-relaxed">
          O cliente tem acesso aos resultados do estudo contratado. Este guia apresenta como consultar e interpretar os dados.
        </p>
      </div>

      <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 mb-8">
        <p className="font-bold text-teal-900 text-sm mb-2">Acesso do Cliente</p>
        <p className="text-teal-800 text-sm leading-relaxed mb-3">
          O acesso é <strong>exclusivamente de leitura</strong> nos estudos contratados. É possível consultar resultados e métricas, mas não alterar dados.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            "Ver resultados do estudo",
            "Consultar pontuações por local",
            "Ver estado das visitas",
            "Aceder ao dashboard de métricas",
            "Usar o Chat IA para insights",
            "Ver mapa de estabelecimentos",
          ].map(p => (
            <div key={p} className="flex items-center gap-2 text-sm text-teal-800">
              <span className="text-teal-400">✓</span> {p}
            </div>
          ))}
        </div>
      </div>

      <Section id="dashboard" title="Dashboard — Painel Principal">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O Dashboard apresenta uma visão geral do estudo com os indicadores mais importantes.
        </p>
        <Step n={1} title="Aceder a Principal → Dashboard">
          Após login, o utilizador é redirecionado para o Dashboard automaticamente.
        </Step>
        <Step n={2} title="Interpretar os cards de resumo">
          Os cards mostram: total de visitas, visitas concluídas, pontuação média e taxa de cobertura dos estabelecimentos.
        </Step>
        <Step n={3} title="Analisar o gráfico de barras">
          O gráfico mostra a distribuição das visitas por estado (planeada, inserida, validada, fechada). Idealmente, a maior fatia deve estar em <em>fechada</em>.
        </Step>
        <Tip>
          Recarregar a página para ver os dados mais recentes.
        </Tip>
      </Section>

      <Section id="visitas" title="Consultar Visitas do Estudo">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          A página de Visitas mostra o detalhe de cada visita realizada no estudo.
        </p>
        <Step n={1} title="Aceder a Principal → Visitas">
          Clicar em <strong>Visitas</strong> no menu lateral.
        </Step>
        <Step n={2} title="Filtrar pelo estudo">
          Clicar em <strong>Filtros</strong> e seleccionar o estudo — ficam visíveis apenas as visitas relevantes.
        </Step>
        <Step n={3} title="Interpretar a tabela">
          Para cada visita são apresentados: estado actual, estudo, pontuação (barra visual), data e tipo.
        </Step>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mt-4">
          <p className="text-sm font-bold text-slate-800 mb-3">Interpretar os estados</p>
          <div className="space-y-2">
            {[
              { state: "planeada", desc: "Visita agendada, ainda não realizada", color: "bg-purple-100 text-purple-700" },
              { state: "inserida", desc: "Analista submeteu — em revisão", color: "bg-yellow-100 text-yellow-700" },
              { state: "validada", desc: "Aprovada pelo validador", color: "bg-blue-100 text-blue-700" },
              { state: "fechada", desc: "Concluída definitivamente", color: "bg-emerald-100 text-emerald-700" },
              { state: "anulada", desc: "Cancelada (não conta para resultados)", color: "bg-red-100 text-red-600" },
            ].map(({ state, desc, color }) => (
              <div key={state} className="flex items-center gap-3 text-sm">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${color}`}>{state}</span>
                <span className="text-slate-600">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section id="pontuacoes" title="Interpretar Pontuações">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Cada visita tem uma pontuação que reflecte a qualidade do serviço avaliado.
        </p>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {[
            { range: "80 – 100%", label: "Excelente", color: "bg-emerald-500", desc: "Serviço acima das expectativas" },
            { range: "60 – 79%", label: "Bom", color: "bg-yellow-400", desc: "Serviço dentro do esperado com margem de melhoria" },
            { range: "0 – 59%", label: "A melhorar", color: "bg-red-400", desc: "Serviço abaixo dos padrões de qualidade" },
          ].map(({ range, label, color, desc }) => (
            <div key={range} className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0">
              <div className={`w-3 h-3 rounded-full ${color} flex-shrink-0`} />
              <span className="font-mono text-sm font-semibold text-slate-700 w-20">{range}</span>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{label}</p>
                <p className="text-slate-400 text-xs">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <Tip>
          A barra de pontuação em cada linha de visita usa o código de cores acima. Verde = excelente, amarelo = bom, vermelho = a melhorar.
        </Tip>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800 mt-4">
          <p className="font-semibold mb-1">📊 Scores por Canal de Visita (Wave 4)</p>
          <p className="leading-relaxed">Se o teu estudo tiver múltiplos tipos de visita (ex: presencial e drive-through), cada tipo utiliza uma <strong>grelha de avaliação própria</strong>. Os scores são normalizados para 0–100% em todos os tipos, permitindo comparação directa no dashboard — mesmo que os critérios sejam diferentes.</p>
        </div>
      </Section>

      <Section id="estabelecimentos" title="Localizar Estabelecimentos Avaliados">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          É possível consultar todos os estabelecimentos avaliados no estudo.
        </p>
        <Step n={1} title="Aceder a Gestão → Estabelecimentos">
          A página mostra todos os pontos de venda.
        </Step>
        <Step n={2} title="Pesquisar por nome ou região">
          Usa a barra de pesquisa para filtrar por nome do estabelecimento, ID da loja ou região geográfica.
        </Step>
      </Section>

      <Section id="chat" title="Chat IA — Perguntas sobre o teu Estudo">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O assistente de IA permite obter insights rápidos em linguagem natural.
        </p>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-4 pt-3 pb-2">Ideias de perguntas</p>
          {[
            "Qual o estabelecimento com a pontuação mais baixa?",
            "Quantas visitas foram concluídas este mês?",
            "Quais as regiões com melhor desempenho?",
            "Qual a pontuação média do estudo?",
            "Há estabelecimentos que ainda não foram visitados?",
          ].map(q => (
            <div key={q} className="px-4 py-2.5 border-t border-slate-100 text-sm text-slate-600 italic">
              "{q}"
            </div>
          ))}
        </div>
      </Section>

      <Section id="seguranca" title="Segurança dos Dados">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          A plataforma implementa medidas de segurança avançadas para proteger os teus dados e os dados das visitas:
        </p>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {[
            { item: "Encriptação PII", desc: "Dados pessoais dos analistas encriptados com Fernet (AES-128-CBC + HMAC-SHA256) em repouso" },
            { item: "Autenticação 2FA", desc: "Suporte a autenticação de dois factores (TOTP) para proteção adicional da conta" },
            { item: "HTTPS", desc: "Todas as comunicações são encriptadas em trânsito via TLS" },
            { item: "Isolação de dados", desc: "O acesso é restrito aos estudos com permissão atribuída — dados de outros clientes são completamente inacessíveis" },
            { item: "Antivírus", desc: "Todos os ficheiros uploaded são verificados por ClamAV antes de serem armazenados" },
            { item: "Auditoria", desc: "Todas as acções ficam registadas no log de auditoria para compliance" },
          ].map(({ item, desc }) => (
            <div key={item} className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
              <span className="text-teal-400 text-sm flex-shrink-0">✓</span>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{item}</p>
                <p className="text-slate-400 text-xs">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="faq" title="Perguntas Frequentes">
        <div className="space-y-4">
          {[
            {
              q: "Quando ficam disponíveis os resultados completos do estudo?",
              a: "Os resultados aparecem em tempo real à medida que as visitas são validadas e fechadas. O estudo estará completo quando todas as visitas planeadas tiverem o estado 'fechada'.",
            },
            {
              q: "Posso exportar os dados para Excel?",
              a: "De momento, a exportação deve ser solicitada ao gestor do estudo, que pode fornecer um export CSV através da funcionalidade de administração.",
            },
            {
              q: "Vejo visitas com estado 'planeada' há muito tempo. É normal?",
              a: "Pode indicar atrasos no campo. Contactar o coordenador do estudo para obter informação actualizada sobre o progresso.",
            },
            {
              q: "Posso ver resultados de outros estudos que não contratei?",
              a: "Não. O acesso é estritamente limitado aos estudos com permissão atribuída. Dados de outros clientes são completamente inacessíveis.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="font-semibold text-slate-900 text-sm mb-2">{q}</p>
              <p className="text-slate-600 text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
