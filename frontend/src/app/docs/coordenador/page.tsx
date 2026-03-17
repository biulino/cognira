import React from "react";
import { Users } from "lucide-react";

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
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-sm">
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
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 leading-relaxed my-4">
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
      <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
      <div>
        <p className="font-semibold text-slate-900 text-sm">{title}</p>
        <p className="text-slate-500 text-sm mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export default function CoordenadorDocsPage() {
  return (
    <div>
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-semibold mb-3">
          <Users className="w-3.5 h-3.5" />
          Perfil: Coordenador
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Guia do Coordenador</h1>
        <p className="text-slate-500 text-base leading-relaxed">
          O coordenador gere os estudos atribuídos, supervisiona as equipas de campo e acompanha o progresso das visitas.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-8">
        <p className="font-bold text-blue-900 text-sm mb-3">O que pode fazer o Coordenador?</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            "Gerir os seus estudos atribuídos",
            "Planear e atribuir visitas",
            "Acompanhar o estado das visitas",
            "Ver a equipa de analistas",
            "Editar estado de visitas",
            "Consultar o dashboard de progresso",
            "Usar o Chat IA para insights",
            "Ver estabelecimentos do estudo",
            "Fazer upload e rever chamadas Call Center (se activado)",
            "Configurar grelhas de avaliação por tipo de visita (Wave 4)",
          ].map(p => (
            <div key={p} className="flex items-center gap-2 text-sm text-blue-800">
              <span className="text-blue-400">✓</span> {p}
            </div>
          ))}
        </div>
        <Warning>
          O coordenador só tem acesso aos estudos para os quais foi atribuído. Outros estudos não são visíveis.
        </Warning>
      </div>

      <Section id="visao-geral" title="Visão Geral do Papel">
        <p className="text-slate-600 text-sm leading-relaxed mb-4">
          O coordenador é o responsável por garantir que as visitas de um estudo são realizadas dentro do prazo e com qualidade. O fluxo de trabalho típico:
        </p>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {[
            { n: "1", label: "Planear visitas", desc: "Define quem vai onde e quando" },
            { n: "2", label: "Acompanhar inserções", desc: "Verifica se analistas estão a submeter" },
            { n: "3", label: "Gerir correcções", desc: "Ajuda analistas com visitas devolvidas" },
            { n: "4", label: "Fechar o estudo", desc: "Confirma que todas as visitas estão fechadas" },
          ].map(({ n, label, desc }) => (
            <div key={n} className="flex items-center gap-4 px-4 py-3.5 border-b border-slate-100 last:border-0">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{n}</div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{label}</p>
                <p className="text-slate-400 text-xs">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="estudos" title="Acompanhar os Estudos Atribuídos">
        <Step n={1} title="Aceder a Principal → Estudos">
          Serão apresentados apenas os estudos para os quais existe permissão de coordenador.
        </Step>
        <Step n={2} title="Consultar o detalhe do estudo">
          Abre os detalhes do estudo: descrição, datas, orçamento e listagem de visitas associadas.
        </Step>
        <Step n={3} title="Monitorizar o progresso">
          Utilizar os filtros de estado no dashboard e na página de visitas para ver quantas visitas estão em cada fase.
        </Step>
        <Tip>
          O Dashboard mostra os dados agregados dos estudos com acesso atribuído.
        </Tip>
      </Section>

      <Section id="visitas" title="Gestão de Visitas">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          A página <strong>Visitas</strong> é o principal espaço de trabalho do coordenador.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 mb-4">
          <span className="font-bold">📊 Stats strip: </span>No topo da página, ao seleccionar um estudo, aparece uma barra com a distribuição de visitas por estado e a pontuação média — em tempo real.
        </div>

        <h3 className="font-bold text-slate-800 text-sm mb-3">7 filtros disponíveis</h3>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-4">
          {([
            { f: "Estudo", desc: "Filtra todas as visitas pelo estudo (activa também a stats strip e o filtro de ondas)" },
            { f: "Onda", desc: "Carregado automaticamente ao seleccionar o estudo — filtra por fase/onda" },
            { f: "Estado", desc: "Foca num estado específico: inserida, corrigir, validada, etc." },
            { f: "Analista", desc: "Ver apenas visitas de um analista em particular" },
            { f: "Data início / Data fim", desc: "Intervalo de datas de realização" },
            { f: "Pesquisa", desc: "Texto livre — pesquisa por nome do estabelecimento ou analista" },
          ] as {f:string;desc:string}[]).map(({ f, desc }) => (
            <div key={f} className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
              <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 mt-0.5">{f}</span>
              <span className="text-sm text-slate-600">{desc}</span>
            </div>
          ))}
        </div>

        <h3 className="font-bold text-slate-800 text-sm mb-3 mt-6">Alterar o estado de uma visita</h3>
        <Step n={1} title="Localizar a visita">
          Na tabela ou nos cards mobile, localizar a visita a modificar.
        </Step>
        <Step n={2} title="Clicar no ícone ✏️">
          Um modal abre com o estado actual e um dropdown para seleccionar o novo estado.
        </Step>
        <Step n={3} title="Confirma">
          Clica em <strong>Guardar</strong>. O estado é actualizado imediatamente.
        </Step>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mt-4">
          <p className="text-sm font-bold text-slate-800 mb-2">Estados que o coordenador usa frequentemente:</p>
          <div className="space-y-2">
            {[
              { from: "nova", to: "planeada", desc: "Ao atribuir data e analista" },
              { from: "inserida", to: "corrigir", desc: "Quando o relatório requer revisão" },
              { from: "corrigida", to: "validada", desc: "Após confirmar as correcções" },
              { from: "qualquer", to: "anulada", desc: "Quando a visita não pode ser realizada" },
            ].map(({ from, to, desc }) => (
              <div key={from + to} className="flex items-center gap-2 text-sm text-slate-600">
                <span className="font-mono bg-slate-100 px-1.5 rounded text-xs">{from}</span>
                <span className="text-slate-300">→</span>
                <span className="font-mono bg-slate-100 px-1.5 rounded text-xs">{to}</span>
                <span className="text-slate-400">— {desc}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section id="analistas" title="Equipa de Analistas">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          A página <strong>Analistas</strong> (Gestão → Analistas) permite ver os analistas disponíveis e as suas métricas.
        </p>
        <Feature title="Lista de analistas" desc="Nome, contacto e número de visitas realizadas por cada analista." />
        <Feature title="Métricas de desempenho" desc="Taxa de conclusão e pontuação média das visitas de cada analista." />
        <Tip>
          Para adicionar analistas ou alterar permissões, contactar o administrador da plataforma.
        </Tip>
      </Section>

      <Section id="chat" title="Chat IA — Insights e Logística">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O Chat IA permite obter respostas rápidas sobre o progresso dos estudos atribuídos <strong>e reatribuir visitas em segundos por linguagem natural</strong>.
        </p>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-4 pt-3 pb-2">Exemplos de perguntas</p>
          {[
            "Quantas visitas estão inseridas no estudo X?",
            "Quais são os analistas com visitas em atraso?",
            "Qual a pontuação média das visitas fechadas?",
            "Há visitas com estado 'corrigir' há mais de 3 dias?",
          ].map(q => (
            <div key={q} className="px-4 py-2.5 border-t border-slate-100 text-sm text-slate-600 italic">
              "{q}"
            </div>
          ))}
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden shadow-sm">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider px-4 pt-3 pb-2">Logística — Reatribuição por Chat</p>
          {[
            "Muda todas as visitas do analista A003 para o A007",
            "Transfere as visitas do João Silva para a Ana Costa",
          ].map(q => (
            <div key={q} className="px-4 py-2.5 border-t border-amber-100 text-sm text-amber-800 italic">
              "{q}"
            </div>
          ))}
          <p className="px-4 py-3 text-xs text-amber-700 border-t border-amber-100">
            O sistema mostra um card de preview com a contagem de visitas e uma amostra. Confirmas ou cancelas — nada se altera sem confirmação explícita.
          </p>
        </div>
      </Section>

      <Section id="fotos-ia" title="Fotos de Visitas — Análise IA">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          As fotos submetidas pelos analistas podem agora ser analisadas automaticamente por <strong>GPT-4o Vision (Cognira Módulo 3)</strong>.
        </p>
        <Feature title="Análise por foto" desc="Cada foto pode ser analisada individualmente. O sistema verifica coerência, qualidade e autenticidade." />
        <Feature title="Veredictos automáticos" desc="Aprovada (verde), rejeitada (vermelha) ou inconclusiva (amarela) — com nível de confiança e motivo detalhado." />
        <Feature title="Apoio à validação" desc="Fotos rejeitadas pela IA podem indicar visitas que requerem atenção especial antes da validação." />
        <Tip>
          Usa a análise IA de fotos como triagem rápida — foca o teu tempo nas visitas assinaladas como problemáticas.
        </Tip>
      </Section>

      <Section id="callcenter" title="Call Center IA (se activado)">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Se o administrador activar o teu role em <strong>Configuração Call Center</strong>, podes fazer upload de gravações de chamadas telefónicas para análise automática por IA.
        </p>
        <Step n={1} title="Aceder a Sistema → Call Center">
          Abre a lista de chamadas já processadas. Podes filtrar por cliente, estado e usar a barra de pesquisa.
        </Step>
        <Step n={2} title="Efectuar upload de uma chamada">
          Clicar em <strong>Upload Chamada</strong>, seleccionar o ficheiro de áudio (mp3, wav, m4a, ogg, flac) e escolher o template de avaliação. O processamento é automático: Cognira Voice Engine transcreve e o Cognira Intelligence™ extrai os dados.
        </Step>
        <Step n={3} title="Consultar o resultado">
          Clicar na chamada para ver a transcrição, os dados estruturados e o relatório narrativo. É possível descarregar o PDF ou iniciar uma nova análise sem re-transcrever (<em>Reprocessar</em>).
        </Step>
        <Tip>
          O estado <strong>concluído</strong> em verde indica que a análise está completa. Um score abaixo de 70 pode indicar problemas de qualidade na chamada.
        </Tip>
        <Warning>
          Caso a opção de upload não esteja disponível, o administrador deverá activar o acesso em <em>/callcenter/admin → Configuração</em>.
        </Warning>
      </Section>

      <Section id="faq" title="Perguntas Frequentes">
        <div className="space-y-4">
          {[
            {
              q: "Não consigo ver um estudo. Porquê?",
              a: "Não. Apenas são listados os estudos com permissão de coordenador atribuída. O administrador deve ser contactado para adicionar o acesso.",
            },
            {
              q: "Posso criar novos estabelecimentos?",
              a: "Não. A criação e gestão de estabelecimentos é da responsabilidade do administrador ou via importação CSV.",
            },
            {
              q: "Como sei se um analista submeteu a visita?",
              a: "Filtra as visitas por estado 'inserida'. Todas as visitas neste estado foram submetidas pelo analista e aguardam revisão.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="font-semibold text-slate-900 text-sm mb-2">{q}</p>
              <p className="text-slate-600 text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="anomalias" title="Detecção de Anomalias em Analistas (Cognira IA)">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O painel de analistas inclui um botão <strong>"Analisar Anomalias"</strong>. O Cognira IA examina padrões de comportamento (velocidade de inserção, notas repetidas, outliers de pontuação) e devolve um relatório estruturado.
        </p>
        {[
          { step: "1", text: "Acede ao painel Analistas → clica 'Analisar Anomalias'" },
          { step: "2", text: "O Cognira IA analisa todos os analistas activos e identifica comportamentos fora do padrão" },
          { step: "3", text: "O relatório classifica anomalias como Crítica / Atenção / OK e sugere acções" },
        ].map(({ step, text }) => (
          <div key={step} className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-2">
            <span className="w-7 h-7 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center shrink-0">{step}</span>
            <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
          </div>
        ))}
      </Section>

      <Section id="mensagens" title="Mensagens Internas">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Substitui o SMS e o telefone. Envia instruções directamente para os analistas através da plataforma — o analista recebe o badge de notificação no menu lateral.
        </p>
        {[
          { step: "1", text: "Clica no ícone ✉ no menu lateral → 'Nova Mensagem'" },
          { step: "2", text: "Selecciona o destinatário (analista, validador ou admin), escreve o assunto e a mensagem" },
          { step: "3", text: "O analista vê o badge de não-lidas e responde pela mesma plataforma" },
        ].map(({ step, text }) => (
          <div key={step} className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-2">
            <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">{step}</span>
            <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
          </div>
        ))}
      </Section>

      <Section id="grelhas" title="Grelhas de Avaliação — Multi-Grelha (Wave 4)">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Cada estudo pode ter <strong>múltiplas grelhas de avaliação</strong>, uma por tipo de visita (presencial, drive-through, telefónica, auditoria, digital). Cada grelha é composta por <strong>secções temáticas</strong> com critérios ponderados — por exemplo, &quot;Atendimento&quot;, &quot;Produto&quot;, &quot;Ambiente&quot;.
        </p>
        <div className="space-y-2 mb-4">
          {[
            { step: "1", text: 'Abre o detalhe do estudo → secção "Grelhas de Avaliação"' },
            { step: "2", text: 'Clica "Nova Grelha" e define o nome, tipo de visita e versão' },
            { step: "3", text: "Adiciona secções (grupos temáticos) com peso em % — a soma deve dar 100%" },
            { step: "4", text: "Dentro de cada secção, adiciona critérios (boolean, escala 1-5 ou texto) com peso individual" },
            { step: "5", text: "Ao criar uma visita do tipo correspondente, a grelha é associada automaticamente" },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">{step}</span>
              <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800 mb-4">
          <p className="font-semibold mb-1">📊 Relatório Consolidado</p>
          <p className="leading-relaxed">Os scores de visitas com grelhas diferentes são normalizados para 0–100% e agregados automaticamente no dashboard do estudo, permitindo comparar resultados entre tipos de visita de forma justa.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "presencial", color: "bg-blue-100 text-blue-700" },
            { label: "drive-through", color: "bg-green-100 text-green-700" },
            { label: "telefónica", color: "bg-purple-100 text-purple-700" },
            { label: "auditoria", color: "bg-orange-100 text-orange-700" },
            { label: "digital", color: "bg-teal-100 text-teal-700" },
          ].map(({ label, color }) => (
            <span key={label} className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-center ${color}`}>{label}</span>
          ))}
        </div>
      </Section>
    </div>
  );
}
