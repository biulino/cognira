import { ClipboardList } from "lucide-react";

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
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold shadow-sm">
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
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800 leading-relaxed my-4">
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

export default function AnalistaDocsPage() {
  return (
    <div>
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold mb-3">
          <ClipboardList className="w-3.5 h-3.5" />
          Perfil: Analista de Campo
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Guia do Analista</h1>
        <p className="text-slate-500 text-base leading-relaxed">
          O analista é o responsável por executar as visitas de mystery shopping no terreno e registar os dados na plataforma.
        </p>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-8">
        <p className="font-bold text-emerald-900 text-sm mb-3">O que faz o Analista?</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            "Ver as visitas atribuídas",
            "Consultar o estabelecimento a visitar",
            "Submeter relatório de visita",
            "Fazer upload de fotos de visita",
            "Actualizar estado para 'inserida'",
            "Responder a pedidos de correcção",
            "Usar o Chat IA para dúvidas",
          ].map(p => (
            <div key={p} className="flex items-center gap-2 text-sm text-emerald-800">
              <span className="text-emerald-400">✓</span> {p}
            </div>
          ))}
        </div>
      </div>

      <Section id="fluxo" title="Fluxo de Trabalho do Analista">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O ciclo de trabalho típico do analista:
        </p>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-4">
          {[
            { estado: "planeada", acao: "Visita ainda não realizada — prepara-te para ir ao terreno" },
            { estado: "inserida", acao: "Relatório submetido — aguarda validação" },
            { estado: "corrigir", acao: "Validador solicitou correcções — actualização do relatório necessária" },
            { estado: "corrigida", acao: "Correcções enviadas — aguarda re-validação" },
            { estado: "validada", acao: "Validador aprovou — visita aceite" },
            { estado: "fechada", acao: "Encerrada pelo coordenador — processo concluído" },
          ].map(({ estado, acao }) => (
            <div key={estado} className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
              <span className="font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 mt-0.5">{estado}</span>
              <span className="text-sm text-slate-600">{acao}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="ver-visitas" title="Ver Visitas Atribuídas">
        <Step n={1} title="Aceder a Principal → Visitas">
          No menu lateral, clica em <strong>Visitas</strong>.
        </Step>
        <Step n={2} title="Filtrar pelo estudo">
          Clicar em <strong>Filtros</strong> e seleccionar o estudo no dropdown — ficam visíveis apenas as visitas do projecto.
        </Step>
        <Step n={3} title="Filtrar pelo analista">
          Utilizar o filtro <strong>Analista</strong> para visualizar apenas as visitas atribuídas. Combinar com o filtro de estado <em>planeada</em> para listar as visitas por realizar.
        </Step>
        <Tip>
          No mobile, os cards de visita são mais fáceis de ler. A informação principal (estado, estabelecimento, data) está visível de um relance.
        </Tip>
      </Section>

      <Section id="submeter" title="Submeter uma Visita">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Após realizar a visita no terreno, deves submeter o relatório na plataforma.
        </p>
        <Step n={1} title="Localiza a visita na lista">
          Filtra por estado <strong>planeada</strong> para encontrar facilmente as visitas por realizar.
        </Step>
        <Step n={2} title="Clicar no ícone ✏️ para editar">
          O modal de edição abre com o estado actual (<em>planeada</em>).
        </Step>
        <Step n={3} title="Alterar o estado para 'inserida'">
          No dropdown de novo estado, selecciona <strong>inserida</strong>.
        </Step>
        <Step n={4} title="Guarda">
          Clica em <strong>Guardar</strong>. A visita passa para estado <em>inserida</em> e o coordenador/validador recebe a notificação para rever.
        </Step>
        <Warning>
          O estado deve ser alterado para <em>inserida</em> apenas quando todos os dados estiverem correctamente preenchidos.
        </Warning>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800 mt-4">
          <p className="font-semibold mb-1">📋 Tipo de Visita e Grelha de Avaliação (Wave 4)</p>
          <p className="leading-relaxed">Cada visita tem um <strong>tipo</strong> (presencial, drive-through, telefónica, auditoria…) e a plataforma associa automaticamente a <strong>grelha de critérios</strong> correcta para esse tipo. Não precisas de fazer nada — o sistema selecciona a grelha correspondente ao criar a visita.</p>
        </div>
      </Section>

      <Section id="correcções" title="Responder a Pedidos de Correcção">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Se o validador detectar problemas no teu relatório, a visita volta para estado <em>corrigir</em>.
        </p>
        <Step n={1} title="Identificar visitas com estado 'corrigir'">
          Filtra as visitas por estado <strong>corrigir</strong> para ver quais precisam da tua atenção.
        </Step>
        <Step n={2} title="Verificar o motivo da devolução">
          O motivo da correcção é indicado nos detalhes da visita.
        </Step>
        <Step n={3} title="Corrigir e re-submeter">
          Efectuar as correcções necessárias e alterar o estado para <strong>corrigida</strong> para indicar que está pronta para re-validação.
        </Step>
        <Tip>
          Se existirem dúvidas sobre o que foi pedido, utilizar o <strong>Chat IA</strong> para obter ajuda ou contactar directamente o coordenador.
        </Tip>
      </Section>

      <Section id="fotos" title="Upload e Análise de Fotos">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Muitas visitas requerem fotos como prova de presença. Após submeter a visita, é possível adicionar fotos directamente na plataforma.
        </p>
        <Step n={1} title="Abrir o modal de fotos">
          Na lista de visitas, clica no botão de fotos (📷) na linha da visita. O modal de galeria abre.
        </Step>
        <Step n={2} title="Efectuar upload das fotos">
          Arrastar as fotos para a área de upload ou clicar para seleccionar. Os formatos aceites são JPEG, PNG e WebP. Cada ficheiro é verificado automaticamente por antivírus (ClamAV).
        </Step>
        <Step n={3} title="Análise IA (Cognira Módulo 3)">
          Após o upload, o coordenador ou validador pode activar a <strong>análise IA</strong> da foto. O GPT-4o Vision verifica se a foto é coerente com o tipo de visita e o estabelecimento.
        </Step>
        <Warning>
          As fotos devem ser claras, bem iluminadas e mostrar o estabelecimento de forma inequívoca. Fotos desfocadas ou irrelevantes podem ser rejeitadas pela IA.
        </Warning>
      </Section>

      <Section id="estabelecimentos" title="Consultar Estabelecimentos">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Antes de ir ao terreno, podes consultar os detalhes do estabelecimento a visitar.
        </p>
        <Step n={1} title="Aceder a Gestão → Estabelecimentos">
          Utilizar a barra de pesquisa para localizar o estabelecimento pelo nome ou ID de loja.
        </Step>
        <Step n={2} title="Consultar os detalhes">
          Cada estabelecimento tem: nome, ID de loja externo, tipo de canal, região e responsável.
        </Step>
      </Section>

      <Section id="faq" title="Perguntas Frequentes">
        <div className="space-y-4">
          {[
            {
              q: "Não consigo ver as minhas visitas. Porquê?",
              a: "Confirmar que o filtro está aplicado ao estudo correcto. Se o problema persistir, o coordenador ou administrador pode ter que verificar as permissões.",
            },
            {
              q: "Submeti a visita com informação errada. Posso corrigir?",
              a: "Sim, mas apenas se ainda estiver no estado 'inserida'. Pede ao coordenador para devolver para 'corrigir'. Depois podes actualizar e re-submeter.",
            },
            {
              q: "A minha visita ficou 'anulada'. O que aconteceu?",
              a: "Uma visita anulada significa que foi cancelada (ex: estabelecimento fechado, falta de condições). Neste caso, o coordenador ou administrador indicará os próximos passos.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="font-semibold text-slate-900 text-sm mb-2">{q}</p>
              <p className="text-slate-600 text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="mensagens" title="Mensagens — Comunicação Directa">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O coordenador pode enviar-te instruções directamente pela plataforma, substituindo o SMS e o telefone. Quando tiveres mensagens não lidas verás um badge vermelho no ícone de mensagens no menu lateral.
        </p>
        {[
          { step: "1", text: "Clicar no ícone ✉ (Mensagens) no menu lateral" },
          { step: "2", text: "Na caixa de entrada verás todas as mensagens recebidas — clica para ler" },
          { step: "3", text: "É possível responder directamente ao coordenador pela mesma caixa" },
        ].map(({ step, text }) => (
          <div key={step} className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-2">
            <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">{step}</span>
            <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
          </div>
        ))}
      </Section>
    </div>
  );
}
