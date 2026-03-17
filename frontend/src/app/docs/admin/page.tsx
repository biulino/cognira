import { ShieldCheck, ChevronRight } from "lucide-react";

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
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-sm">
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
    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-800 leading-relaxed my-4">
      <span className="font-bold">💡 Dica: </span>{children}
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 leading-relaxed my-4">
      <span className="font-bold">⚠️ Atenção: </span>{children}
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0 mt-1.5" />
      <div>
        <p className="font-semibold text-slate-900 text-sm">{title}</p>
        <p className="text-slate-500 text-sm mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export default function AdminDocsPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full text-xs font-semibold mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          Perfil: Administrador
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Guia do Administrador</h1>
        <p className="text-slate-500 text-base leading-relaxed">
          O administrador tem acesso total ao sistema. Este guia cobre todas as funcionalidades disponíveis.
        </p>
      </div>

      {/* Permissions overview */}
      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 mb-8">
        <p className="font-bold text-purple-900 text-sm mb-3">Permissões do Administrador</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            "Ver todos os estudos e visitas",
            "Criar e editar estudos",
            "Gerir todos os utilizadores",
            "Activar/desactivar contas",
            "Alterar roles de utilizadores",
            "Aprovar pagamentos",
            "Relatório de pagamentos por analista/período",
            "Importar dados via CSV",
            "Acesso ao Chat IA (Function Calling) e Chat Interno",
            "Score preditivo e planeamento automático",
            "Análise de fotos com GPT-4o Vision (Cognira Módulo 3)",
            "Gerir chilling periods e blacklists de estabelecimentos",
            "Ver e editar estabelecimentos",
            "Editar estado de qualquer visita",
            "Gerir Call Center: templates e configuração",
            "Gerir encriptação PII e segurança de dados",
          ].map(p => (
            <div key={p} className="flex items-center gap-2 text-sm text-purple-800">
              <span className="text-purple-400">✓</span> {p}
            </div>
          ))}
        </div>
      </div>

      <Section id="utilizadores" title="Gestão de Utilizadores">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          A página <strong>Utilizadores</strong> (menu lateral, secção Sistema) permite gerir todas as contas da plataforma.
        </p>

        <h3 className="font-bold text-slate-800 text-sm mb-3">Ver todos os utilizadores</h3>
        <Step n={1} title="Aceder a Sistema → Utilizadores">
          No menu lateral, clica em <strong>Utilizadores</strong> na secção <em>Sistema</em>.
        </Step>
        <Step n={2} title="Interpreta a tabela">
          A tabela mostra: nome de utilizador, role global, estado (activo/inactivo), data de registo e se tem 2FA activo.
        </Step>

        <h3 className="font-bold text-slate-800 text-sm mb-3 mt-6">Activar / Desactivar uma conta</h3>
        <Step n={1} title="Localiza o utilizador">
          Na tabela de utilizadores, encontra a linha do utilizador que pretendes modificar.
        </Step>
        <Step n={2} title="Clicar no toggle de estado">
          Na coluna <strong>Estado</strong>, clica no botão para alternar entre activo e inactivo. Uma conta inactiva não consegue fazer login.
        </Step>
        <Warning>
          Não é possível desactivar a própria conta de administrador. Esta protecção existe para evitar o bloqueio acidental do sistema.
        </Warning>

        <h3 className="font-bold text-slate-800 text-sm mb-3 mt-6">Alterar o perfil (role) de um utilizador</h3>
        <Step n={1} title="Abrir o seletor de role">
          Na coluna <strong>Perfil</strong>, clica no dropdown com o role actual do utilizador.
        </Step>
        <Step n={2} title="Seleccionar o novo role">
          Escolhe entre: <code className="bg-slate-100 px-1.5 rounded font-mono text-xs">admin</code>, <code className="bg-slate-100 px-1.5 rounded font-mono text-xs">utilizador</code>, <code className="bg-slate-100 px-1.5 rounded font-mono text-xs">coordenador</code>, ou <code className="bg-slate-100 px-1.5 rounded font-mono text-xs">validador</code>.
        </Step>
        <Step n={3} title="Confirma a alteração">
          A alteração é guardada imediatamente. O utilizador terá o novo role na próxima vez que fizer login ou recarregar a página.
        </Step>
        <Tip>
          Os roles por estudo (coordenador, analista, validador, cliente) são configurados separadamente através das permissões de cada estudo — não aqui.
        </Tip>
      </Section>

      <Section id="estudos" title="Gestão de Estudos">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Os estudos são o núcleo da plataforma. Cada estudo representa um projecto de mystery shopping com datas, orçamento e equipas atribuídas.
        </p>
        <Feature title="Ver todos os estudos" desc="Aceder a Principal → Estudos para ver a lista completa com estado e contagem de visitas." />
        <Feature title="Criar um novo estudo" desc="Na página /estudos, clica em 'Novo Estudo' e preenche: nome, descrição, datas de início/fim e orçamento." />
        <Feature title="Editar um estudo" desc="Clicar no botão de edição na linha do estudo pretendido para alterar qualquer campo." />
        <Feature title="Arquivar/eliminar" desc="Estudos com visitas associadas não podem ser eliminados. Podem ser arquivados para remover da vista principal." />
        <Tip>
          Após criar um estudo, atribui permissões aos utilizadores que irão trabalhar nele (coordenadores, analistas, validadores, clientes) através da gestão de permissões do estudo.
        </Tip>
      </Section>

      <Section id="visitas" title="Monitorização de Visitas">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O administrador pode ver e editar todas as visitas de todos os estudos.
        </p>
        <Feature title="Filtrar visitas" desc="Utilizar o painel de Filtros para filtrar por estudo e/ou estado — botão 'Filtros' no canto superior direito de /visitas." />
        <Feature title="Editar estado de uma visita" desc="Clicar no ícone de lápis (✏️) na linha da visita, seleccionar o novo estado e, se necessário, indicar o motivo. Guardar para confirmar." />

        <h3 className="font-bold text-slate-800 text-sm mt-5 mb-3">Fluxo de estados de uma visita</h3>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {[
            { state: "nova", desc: "Visita criada, ainda não planeada", color: "bg-slate-100 text-slate-600" },
            { state: "planeada", desc: "Data e analista atribuídos", color: "bg-purple-100 text-purple-700" },
            { state: "inserida", desc: "Analista submeteu o relatório", color: "bg-yellow-100 text-yellow-700" },
            { state: "validada", desc: "Validador aprovou o relatório", color: "bg-blue-100 text-blue-700" },
            { state: "fechada", desc: "Visita concluída e encerrada", color: "bg-emerald-100 text-emerald-700" },
            { state: "corrigir", desc: "Validador pediu correcções", color: "bg-orange-100 text-orange-700" },
            { state: "anulada", desc: "Visita cancelada (com motivo)", color: "bg-red-100 text-red-600" },
          ].map(({ state, desc, color }) => (
            <div key={state} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>{state}</span>
              <span className="text-sm text-slate-600">{desc}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="pagamentos" title="Gestão de Pagamentos">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          A página <strong>Pagamentos</strong> (Gestão → Pagamentos) mostra todos os registos financeiros.
        </p>
        <Step n={1} title="Filtrar por estado">
          Utilizar o dropdown de estado para ver apenas os pagamentos pendentes, aprovados, pagos ou rejeitados.
        </Step>
        <Step n={2} title="Aprovar um pagamento">
          Na linha do pagamento, clicar no botão <strong>Aprovar</strong>. O estado passa de <em>pendente</em> para <em>aprovado</em>.
        </Step>
        <Tip>
          Os cards de resumo no topo mostram o total de pagamentos pendentes, aprovados, pagos e o valor total em euros.
        </Tip>

        <h3 className="font-bold text-slate-800 text-sm mb-3 mt-6">Relatório de Pagamentos por Analista/Período</h3>
        <p className="text-slate-600 text-sm mb-3 leading-relaxed">
          A página <strong>Relatórios</strong> inclui agora um relatório detalhado de pagamentos com filtros avançados.
        </p>
        <Feature title="Filtro por período" desc="Seleccionar data de início e data de fim para analisar pagamentos num intervalo específico." />
        <Feature title="Filtro por estudo" desc="Restringe os resultados a um estudo específico para análise mais focada." />
        <Feature title="Detalhe por visita" desc="O endpoint /api/pagamentos/relatorio/detalhe mostra cada pagamento com a visita, analista e valores associados." />
        <Feature title="Exportar" desc="Os dados podem ser exportados em Excel ou PDF directamente na página de relatórios." />
      </Section>

      <Section id="estabelecimentos" title="Gestão de Estabelecimentos">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Os estabelecimentos são os pontos de venda visitados nas visitas de mystery shopping.
        </p>
        <Feature title="Pesquisar estabelecimentos" desc="A barra de pesquisa filtra por nome, ID de loja ou região em tempo real." />
        <Feature title="Editar um estabelecimento" desc="Clica no ícone de lápis para editar: nome, ID externo, tipo de canal, região e responsável." />
      </Section>

      <Section id="ingest" title="Importação de Dados (CSV)">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          A página <strong>Importar CSV</strong> permite carregar dados em massa para a plataforma.
        </p>
        <Step n={1} title="Preparar o ficheiro CSV">
          O ficheiro deve ter as colunas correctas conforme o template. O template está disponível para download na página de importação.
        </Step>
        <Step n={2} title="Seleccionar o estudo de destino">
          Seleccionar o estudo de destino no dropdown.
        </Step>
        <Step n={3} title="Efectuar upload do ficheiro">
          Arrastar o ficheiro para a área de upload ou clicar para seleccionar. O sistema valida automaticamente o formato.
        </Step>
        <Step n={4} title="Confirmar a importação">
          Após validação, clicar em <strong>Importar</strong>. Será apresentado um resumo com o número de registos criados e eventuais erros.
        </Step>
        <Warning>
          A importação não pode ser desfeita automaticamente. Verifica sempre o ficheiro antes de confirmar.
        </Warning>
      </Section>

      <Section id="dashboard" title="Dashboard e Métricas">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O Dashboard apresenta uma visão agregada do sistema em tempo real.
        </p>
        <Feature title="Cards de resumo" desc="Total de visitas, estudos activos, analistas disponíveis e taxa de conclusão." />
        <Feature title="Gráfico de barras" desc="Distribuição das visitas por estado (nova, planeada, inserida, validada, fechada, etc.)." />
        <Feature title="Dados em tempo real" desc="Os dados actualizam automaticamente quando a página carrega." />
      </Section>

      <Section id="chat" title="Chat IA — Consultas e Logística (Function Calling)">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O assistente de IA usa <strong>Cognira Intelligence™</strong> para consultar a base de dados em tempo real e executar operações de logística — tudo através de linguagem natural, sem SQL visível, com <strong>confirmação obrigatória antes de qualquer escrita</strong>.
        </p>
        <Feature title="Consultar dados em tempo real" desc="Pergunta: 'Quantas visitas estão pendentes para o estudo X?' ou 'Qual o analista com mais visitas fechadas?' — o sistema consulta a BD e responde imediatamente." />
        <Feature title="Identificação automática de IDs de visitas" desc="Quando mencionas números como '1191' ou '1192', o sistema assume automaticamente que são IDs de visitas e pesquisa sem pedir esclarecimentos. Exemplo: 'quem é o analista da 1192?' funciona directamente." />
        <Feature title="Reatribuição de visitas por linguagem natural" desc="Escreve 'Reatribui a visita 1192 ao David Pereira' ou 'Muda todas as visitas do analista A001 para o A002' — o sistema mostra um card de preview com detalhes exactos antes de executar." />
        <Feature title="Confirmação obrigatória antes de qualquer escrita" desc="Todas as operações de reatribuição mostram um card de confirmação com origem, destino, número de visitas e uma amostra. Nenhuma alteração é feita sem clicares em 'Confirmar e executar'." />
        <Feature title="Respostas conversacionais" desc="O assistente responde em português de Portugal de forma natural e humanizada. Nunca mostra SQL, IDs internos ou dados em bruto." />
        <Tip>
          A reatribuição de visitas requer role <code className="bg-slate-100 px-1.5 rounded font-mono text-xs">admin</code> ou <code className="bg-slate-100 px-1.5 rounded font-mono text-xs">coordenador</code>. Visitas já <em>fechadas</em> ou <em>anuladas</em> nunca são afectadas.
        </Tip>
      </Section>

      <Section id="restricoes" title="Restrições a Analistas — Chilling Periods &amp; Blacklist">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O administrador pode configurar restrições específicas para cada analista: <strong>chilling periods</strong> (impedimento temporário de visitar um estabelecimento) e <strong>blacklist</strong> (proibição permanente ou definitiva). Estas restrições são respeitadas pelo sistema de planeamento.
        </p>

        <h3 className="font-bold text-slate-800 text-sm mb-3">Abrir restrições de um analista</h3>
        <Step n={1} title="Vai à lista de analistas">
          Em <strong>Gestão → Analistas</strong>, encontras a tabela de analistas activos.
        </Step>
        <Step n={2} title="Clica no botão de restrições (🛡)">
          Na coluna de acções de cada analista, clica no botão cor âmbar com ícone de escudo. Abre o modal de restrições desse analista.
        </Step>

        <h3 className="font-bold text-slate-800 text-sm mb-3 mt-6">Chilling Periods</h3>
        <p className="text-slate-600 text-sm mb-3 leading-relaxed">
          Um chilling period impede um analista de visitar um estabelecimento específico por um período definido de meses — útil quando o analista foi reconhecido ou existe conflito de interesse temporário.
        </p>
        <Feature title="Adicionar chilling period" desc="No modal, secção 'Chilling Periods', clica em 'Adicionar'. Preenche: id do estabelecimento, número de meses, data de início e data de fim. Clica em Guardar." />
        <Feature title="Ver chilling periods activos" desc="A lista mostra todos os períodos com estado activo/inactivo, datas e estabelecimento associado." />
        <Feature title="Remover um chilling period" desc="Clica no ícone de lixo (🗑) à direita do registo para remover imediatamente." />

        <h3 className="font-bold text-slate-800 text-sm mb-3 mt-6">Blacklist de Estabelecimentos</h3>
        <p className="text-slate-600 text-sm mb-3 leading-relaxed">
          A blacklist proíbe permanentemente (ou de forma marcada) um analista de visitar um estabelecimento específico — uso para conflitos graves, litígios ou pedido do cliente.
        </p>
        <Feature title="Adicionar à blacklist" desc="No modal, secção 'Blacklist', clica em 'Adicionar'. Preenche: id do estabelecimento, motivo (opcional) e se é permanente. Clica em Guardar." />
        <Feature title="Remover da blacklist" desc="Clica no ícone de lixo para remover a restrição. A remoção é imediata." />
        <Warning>
          Restrições de blacklist e chilling periods requerem role <code className="bg-slate-100 px-1.5 rounded font-mono text-xs">admin</code> ou <code className="bg-slate-100 px-1.5 rounded font-mono text-xs">coordenador</code>. Qualquer alteração é registada no log de auditoria.
        </Warning>
      </Section>

      <Section id="callcenter" title="Módulo Call Center IA">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O módulo Call Center permite fazer upload de gravações de chamadas telefónicas, que são automaticamente
          transcritas pelo Cognira Voice Engine e analisadas por Cognira Intelligence™ com base num template de avaliação configurável.
          O resultado inclui transcrição completa, dados extraídos estruturados, relatório narrativo e export PDF.
        </p>

        <h3 className="font-bold text-slate-800 text-sm mb-3 mt-6">Estados de uma chamada</h3>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-4">
          {[
            { state: "pendente", desc: "Ficheiro submetido, a aguardar processamento", color: "bg-slate-100 text-slate-600" },
            { state: "transcrevendo", desc: "Cognira Voice Engine em execução", color: "bg-blue-100 text-blue-700" },
            { state: "a_analisar", desc: "Cognira Intelligence™ a extrair dados e gerar relatório", color: "bg-purple-100 text-purple-700" },
            { state: "concluido", desc: "Pipeline completo — dados e relatório disponíveis", color: "bg-emerald-100 text-emerald-700" },
            { state: "erro", desc: "Falha no pipeline (mensagem de erro visível)", color: "bg-red-100 text-red-600" },
          ].map(({ state, desc, color }) => (
            <div key={state} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>{state}</span>
              <span className="text-sm text-slate-600">{desc}</span>
            </div>
          ))}
        </div>

        <h3 className="font-bold text-slate-800 text-sm mb-3 mt-6">Submeter uma chamada</h3>
        <Step n={1} title="Vai a Sistema → Call Center">
          Na sidebar, clica em <strong>Call Center</strong>. Verás a lista de chamadas já processadas.
        </Step>
        <Step n={2} title="Clica em 'Submeter Chamada'">
          Aparece um modal de upload. Arrasta o ficheiro de áudio (mp3, wav, m4a, ogg, flac, webm) ou clica para seleccionar.
        </Step>
        <Step n={3} title="Preenche os metadados">
          Selecciona o <strong>cliente</strong> (obrigatório), e opcionalmente: estudo, template de avaliação, referência externa, nome do agente e data/hora da chamada.
        </Step>
        <Step n={4} title="Submete e aguarda">
          O sistema aceita o ficheiro imediatamente (202 Accepted) e processa em background. A página auto-actualiza o estado a cada 4 segundos.
        </Step>
        <Warning>
          O ficheiro máximo é de 100 MB por defeito (configurável). Para melhor desempenho usa ficheiros comprimidos em mp3 sempre que possível.
        </Warning>

        <h3 className="font-bold text-slate-800 text-sm mb-3 mt-6">Reprocessar vs Retranscrever</h3>
        <Feature title="Reprocessar (barato)" desc="Mantém a transcrição existente e corre apenas o Cognira Intelligence™ para nova extracção de dados e relatório. Ideal quando mudas o template ou queres nova análise sem custo de transcrição." />
        <Feature title="Retranscrever (completo)" desc="Descarta a transcrição e corre o pipeline completo novamente: Cognira Voice Engine + Cognira Intelligence™. Usa apenas se a transcrição original estava incorrecta." />

        <h3 className="font-bold text-slate-800 text-sm mb-3 mt-6">Exportar PDF</h3>
        <Step n={1} title="Abre o detalhe da chamada">
          Clica numa chamada concluída na lista. Aparece a página de detalhe com 3 tabs: Transcrição, Dados Extraídos, Relatório.
        </Step>
        <Step n={2} title="Clica em 'Download PDF'">
          O botão está no topo direito da página de detalhe. O PDF inclui metadados, dados extraídos e relatório narrativo completo.
        </Step>

        <h3 className="font-bold text-slate-800 text-sm mb-3 mt-6">Administração (admin/coordenador)</h3>
        <Step n={1} title="Vai a /callcenter/admin">
          Esta página permite gerir <strong>templates de avaliação</strong> e a <strong>configuração global</strong> do módulo.
          Requer role <code className="bg-slate-100 px-1.5 rounded font-mono text-xs">admin</code> ou <code className="bg-slate-100 px-1.5 rounded font-mono text-xs">coordenador</code>.
        </Step>
        <Step n={2} title="Criar ou editar templates">
          Um template define os campos de avaliação (chave, etiqueta, tipo e peso). Pode ser genérico (todos os clientes) ou específico de um cliente.
        </Step>
        <Step n={3} title="Configuração global">
          Define quais os roles que podem fazer upload (por defeito: admin, coordenador, validador) e o tamanho máximo do ficheiro (por defeito: 100 MB).
        </Step>
        <Tip>
          O relatório é visível online no tab "Relatório" da página de detalhe, renderizado como Markdown formatado. O export PDF inclui o mesmo conteúdo em formato imprimível.
        </Tip>
      </Section>

      <Section id="anomalias" title="Detecção de Anomalias em Analistas (Cognira IA)">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O módulo de anomalias compara o score médio de cada analista com a média da população, sinalizando desvios estatisticamente significativos (≥ 2σ).
        </p>
        <Step n={1} title="Acede a Analistas">
          No topo da página de lista de analistas encontras o painel <strong>Detecção de Anomalias Cognira IA</strong>.
        </Step>
        <Step n={2} title="Selecciona o estudo e analisa">
          Escolhe um estudo no selector e clica em <strong>Analisar</strong>. O sistema analisa os últimos 90 dias.
        </Step>
        <Step n={3} title="Interpreta os resultados">
          A tabela mostra score médio, desvio em σ e uma flag: <strong className="text-red-600">Alto</strong> (score suspeitamente alto — possível fraude), <strong className="text-blue-600">Baixo</strong> (formação necessária) ou Normal.
        </Step>
      </Section>

      <Section id="validacao-ia" title="Validação de Visitas com Cognira IA">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Na modal de edição de visitas, o botão <strong>Analisar com Cognira IA</strong> envia as respostas, observações e mensagens da visita ao motor Cognira Intelligence™ que devolve uma recomendação: <em>aprovar</em>, <em>corrigir</em> ou <em>rever</em>.
        </p>
        <Feature title="Recomendação imediata" desc="O resultado aparece inline com cor semântica: verde/amarelo/vermelho conforme a recomendação." />
        <Feature title="Motivos e mensagem sugerida" desc="A IA lista os motivos da decisão e sugere uma mensagem de feedback para enviar ao analista." />
        <Feature title="Confiança" desc="Percentagem de confiança da análise (0–100%). Abaixo de 60% revê manualmente." />
      </Section>

      <Section id="mensagens" title="Mensagens Internas (substituição de SMS/telefone)">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          A plataforma tem um sistema de mensagens directas entre utilizadores — coordenadores podem comunicar com analistas directamente no site, sem SMS ou telefone.
        </p>
        <Step n={1} title="Acede a Mensagens">
          Clica no ícone de mensagens na barra de navegação (badge vermelho quando tens mensagens não lidas).
        </Step>
        <Step n={2} title="Nova mensagem">
          Selecciona o destinatário, escreve o assunto e o corpo da mensagem e envia.
        </Step>
        <Step n={3} title="Responder e acompanhar">
          O destinatário vê a mensagem na sua caixa de entrada. Quando abre, fica marcada como lida.
        </Step>
      </Section>

      <Section id="chat-interno" title="Chat Interno Real-Time">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O chat interno permite comunicação instantânea entre membros da equipa — conversas directas (1:1) e grupos temáticos. O balão flutuante está disponível em todas as páginas da aplicação.
        </p>
        <Step n={1} title="Abre o chat">
          Clica no ícone de balão de mensagens no canto inferior direito de qualquer página. O número de mensagens não lidas aparece em badge vermelho.
        </Step>
        <Step n={2} title="Inicia ou escolhe uma conversa">
          Na página <strong>/chat</strong> vês a lista de conversas (directas e grupos). Clica em <strong>Nova conversa</strong> para iniciar com um utilizador específico.
        </Step>
        <Step n={3} title="Grupos (admin/coordenador)">
          Admins e coordenadores podem criar grupos temáticos e gerir os membros. Todos os membros do grupo recebem as mensagens em real-time.
        </Step>
        <Feature title="Polling delta a 3 segundos" desc="As mensagens novas chegam automaticamente sem necessidade de recarregar a página. Apenas mensagens novas são pedidas ao servidor (polling delta)." />
        <Feature title="Balão flutuante universal" desc="O ícone de chat está visível em todas as páginas autenticadas. Clicar abre directamente a lista de conversas." />
      </Section>

      <Section id="seguranca-pii" title="Segurança de Dados — Encriptação PII">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          A plataforma protege os dados pessoais dos analistas com <strong>encriptação Fernet (AES-128-CBC + HMAC-SHA256)</strong> em repouso. Os campos encriptados são: email, telefone, NIF, IBAN, morada e data de nascimento.
        </p>
        <Feature title="Encriptação automática" desc="Todos os dados PII são encriptados automaticamente ao guardar e desencriptados ao ler. O processo é transparente para o utilizador." />
        <Feature title="Chave Fernet (PII_KEY)" desc="A chave de encriptação é gerida centralmente via variável de ambiente. Nunca é armazenada na base de dados." />
        <Feature title="Compatível com dados legacy" desc="Dados antigos (pré-encriptação) são lidos correctamente através de fallback automático. Não é necessária migração manual." />
        <Feature title="Campo 'nome' não encriptado" desc="O nome do analista é mantido em texto claro para permitir pesquisas SQL eficientes pelo agente de IA e filtros." />
        <Warning>
          A chave PII_KEY é crítica. Se for perdida, os dados encriptados tornam-se irrecuperáveis. Mantém sempre um backup seguro da chave.
        </Warning>
      </Section>

      <Section id="fotos-ia" title="Cognira Módulo 3 — Fotos IA (GPT-4o Vision)">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O módulo de análise de fotos usa <strong>GPT-4o Vision</strong> para validar automaticamente as fotos de visitas, detectando anomalias visuais e verificando a coerência com o estabelecimento visitado.
        </p>
        <Step n={1} title="Acede às fotos de uma visita">
          Na página de visitas, clica no botão de fotos (📷) para abrir o modal de galeria.
        </Step>
        <Step n={2} title="Clica em 'Analisar com IA'">
          Cada foto tem um botão de análise IA. O sistema envia a imagem ao GPT-4o Vision e recebe um veredicto.
        </Step>
        <Step n={3} title="Interpreta o resultado">
          O veredicto pode ser:
        </Step>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-4">
          {[
            { state: "aprovada", desc: "Foto válida — coerente com o tipo de visita e estabelecimento", color: "bg-emerald-100 text-emerald-700" },
            { state: "rejeitada", desc: "Foto inválida — não corresponde, está desfocada ou é suspeita", color: "bg-red-100 text-red-600" },
            { state: "inconclusiva", desc: "A IA não tem confiança suficiente — requer revisão manual", color: "bg-yellow-100 text-yellow-700" },
          ].map(({ state, desc, color }) => (
            <div key={state} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>{state}</span>
              <span className="text-sm text-slate-600">{desc}</span>
            </div>
          ))}
        </div>
        <Feature title="Nível de confiança" desc="Cada análise inclui uma percentagem de confiança (0–100%). Abaixo de 60% recomenda-se revisão manual." />
        <Feature title="Motivo detalhado" desc="A IA explica o motivo do veredicto em linguagem natural (ex: 'foto desfocada', 'sem identificação da loja')." />
        <Feature title="Dados persistidos" desc="O veredicto, confiança e motivo são guardados na base de dados junto com a foto para histórico e auditoria." />
        <Tip>
          A análise IA de fotos requer a chave OPENAI_API_KEY configurada. O custo é mínimo (∼$0.003 por foto).
        </Tip>
      </Section>

      <Section id="score-preditivo" title="Score Preditivo por Analista (Cognira IA)">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O módulo de score preditivo usa o histórico de visitas de cada analista para prever o score esperado nas próximas visitas, com intervalo de confiança e tendência.
        </p>
        <Step n={1} title="Acede ao perfil do analista">
          Na lista de analistas, clica no botão <strong>🧠 Score Preditivo</strong> (ícone de cérebro) à direita de cada linha.
        </Step>
        <Step n={2} title="Lê o modal de previsão">
          O modal mostra: score esperado, intervalo de confiança (min–max), tendência (📈 melhoria / 📉 declínio / ➡️ estável), factores positivos e negativos e recomendação de acção.
        </Step>
        <Tip>
          O score preditivo requer pelo menos 3 visitas com pontuação calculada para ser fiável. Com menos dados, a IA indica &quot;dados insuficientes&quot;.
        </Tip>
      </Section>

      <Section id="planeamento-ia" title="Planeamento Automático de Visitas (Cognira IA)">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          A IA distribui automaticamente os estabelecimentos pelos analistas disponíveis para uma onda, respeitando carga de trabalho, score histórico e capacidade mensal. O plano é gerado e apresentado para revisão antes de ser aplicado.
        </p>
        <Step n={1} title="Abre o estudo e vai à onda">
          Em <strong>Estudos → [estudo] → Ondas</strong>, cada onda tem um botão <strong>Planear com IA</strong>.
        </Step>
        <Step n={2} title="Gera o plano">
          Clica em <strong>Planear</strong>. A IA analisa os analistas activos, a carga actual e os estabelecimentos sem visitas planeadas nesta onda.
        </Step>
        <Step n={3} title="Revê e aplica">
          O modal apresenta o plano completo: quem visita o quê, porquê, e observações gerais. Podes aceitar ou fechar e ajustar manualmente.
        </Step>
        <Feature title="Distribuição equilibrada" desc="A IA tenta distribuir a carga de forma equitativa, priorizando analistas com menor carga e melhor score histórico." />
        <Feature title="Observações explicadas" desc="Para cada atribuição a IA indica a lógica usada (score, disponibilidade, histórico com o cliente)." />
      </Section>

      <Section id="grelhas" title="Grelhas de Avaliação — Multi-Grelha (Wave 4)">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O administrador pode criar e gerir <strong>múltiplas grelhas de avaliação</strong> por estudo, uma por tipo de visita. A estrutura hierárquica completa (grelha → secções → critérios) pode ser criada num único pedido API.
        </p>
        <div className="bg-slate-900 rounded-xl overflow-hidden shadow-sm mb-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-4 pt-3 pb-2">API Endpoints</p>
          {[
            { method: "GET", path: "/estudos/{id}/grelhas", desc: "Listagem de grelhas (com secções e critérios)" },
            { method: "POST", path: "/estudos/{id}/grelhas", desc: "Criar grelha com secções e critérios inline" },
            { method: "GET", path: "/estudos/{id}/grelhas/{gid}", desc: "Detalhe de uma grelha" },
            { method: "PUT", path: "/estudos/{id}/grelhas/{gid}", desc: "Actualizar grelha (substitui secções e critérios)" },
            { method: "DELETE", path: "/estudos/{id}/grelhas/{gid}", desc: "Eliminar grelha" },
          ].map(({ method, path, desc }) => (
            <div key={path} className="flex items-start gap-3 px-4 py-2.5 border-t border-slate-800">
              <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${method === "GET" ? "bg-blue-900 text-blue-300" : method === "POST" ? "bg-green-900 text-green-300" : method === "PUT" ? "bg-yellow-900 text-yellow-300" : "bg-red-900 text-red-300"}`}>{method}</span>
              <span className="font-mono text-xs text-slate-300 flex-shrink-0 mt-0.5">{path}</span>
              <span className="text-xs text-slate-400">{desc}</span>
            </div>
          ))}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-3">
          <p className="font-semibold text-slate-900 text-sm mb-2">Exemplo: criar grelha presencial para Vodafone</p>
          <pre className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg overflow-auto leading-relaxed">{`POST /estudos/1/grelhas
{
  "nome": "Vodafone Loja v1",
  "tipo_visita": "presencial",
  "secoes": [
    {
      "nome": "Acolhimento",
      "ordem": 1,
      "peso_secao": 0.30,
      "criterios": [
        { "label": "Saudação adequada", "peso": 0.5, "tipo": "boolean" },
        { "label": "Tempo de espera", "peso": 0.5, "tipo": "escala" }
      ]
    }
  ]
}`}</pre>
        </div>
        <Feature title="Associação automática" desc="Ao criar uma visita com tipo_visita='presencial', a plataforma associa automaticamente a grelha correspondente (grelha_id)." />
        <Feature title="Backward compatible" desc="Visitas sem grelha (dados legados) continuam a funcionar — o campo grelha_id é nullable." />
        <Feature title="Score normalizado" desc="Os scores são normalizados para 0–100% por grelha, permitindo comparação justa em estudos com múltiplos canais." />
      </Section>
    </div>
  );
}
