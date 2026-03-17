import { Eye } from "lucide-react";

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
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold shadow-sm">
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
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800 leading-relaxed my-4">
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

export default function ValidadorDocsPage() {
  return (
    <div>
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full text-xs font-semibold mb-3">
          <Eye className="w-3.5 h-3.5" />
          Perfil: Validador
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Guia do Validador</h1>
        <p className="text-slate-500 text-base leading-relaxed">
          O validador é responsável pela qualidade dos dados: revê os relatórios de visitas submetidos pelos analistas e aprova ou devolve para correcção.
        </p>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-8">
        <p className="font-bold text-orange-900 text-sm mb-3">Responsabilidades do Validador</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            "Rever visitas com estado 'inserida'",
            "Aprovar visitas correctas (→ validada)",
            "Devolver para correcção (→ corrigir)",
            "Rever correcções re-submetidas",
            "Garantir qualidade dos dados",
            "Coordenar com analistas",
          ].map(p => (
            <div key={p} className="flex items-center gap-2 text-sm text-orange-800">
              <span className="text-orange-400">✓</span> {p}
            </div>
          ))}
        </div>
      </div>

      <Section id="fila-validacao" title="Fila de Validação">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          As visitas que precisam de ser validadas têm o estado <em>inserida</em>. Este é o ponto de partida.
        </p>
        <Step n={1} title="Aceder a Principal → Visitas">
          No menu lateral, clica em <strong>Visitas</strong>.
        </Step>
        <Step n={2} title="Filtrar por estado 'inserida'">
          Clicar em <strong>Filtros</strong> e seleccionar <strong>inserida</strong> no dropdown de estado. Ficam visíveis apenas as visitas que aguardam revisão.
        </Step>
        <Step n={3} title="Ordena pela data">
          As visitas são apresentadas por ordem de criação. Revê primeiro as mais antigas para não deixar analistas à espera.
        </Step>
        <Tip>
          É também possível filtrar por estudo para organizar a fila por projecto, ao trabalhar em múltiplos estudos.
        </Tip>
      </Section>

      <Section id="validar" title="Validar uma Visita">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Para cada visita <em>inserida</em>, a decisão implica: aprovar ou devolver para correcção.
        </p>

        <h3 className="font-bold text-slate-800 text-sm mb-3">✅ Aprovar uma visita</h3>
        <Step n={1} title="Clicar no ícone ✏️ na linha da visita">
          O modal de edição abre.
        </Step>
        <Step n={2} title="Seleccionar 'validada' no dropdown">
          Escolher o estado <strong>validada</strong>.
        </Step>
        <Step n={3} title="Guardar">
          Clicar em <strong>Guardar</strong>. A visita passa para o estado <em>validada</em> e o analista é notificado.
        </Step>

        <h3 className="font-bold text-slate-800 text-sm mb-3 mt-6">🔄 Devolver para correcção</h3>
        <Step n={1} title="Clicar no ícone ✏️ na linha da visita">
          O modal de edição abre.
        </Step>
        <Step n={2} title="Seleccionar 'corrigir' no dropdown">
          Escolher o estado <strong>corrigir</strong>.
        </Step>
        <Step n={3} title="Indicar o motivo (recomendado)">
          Se aplicável, indicar o motivo da devolução no campo de texto — facilita a compreensão exacta do que necessita de correcção.
        </Step>
        <Step n={4} title="Guardar">
          Clicar em <strong>Guardar</strong>. A visita volta para o analista com estado <em>corrigir</em>.
        </Step>
        <Warning>
          O motivo da devolução deve ser específico. Motivos vagos dificultam a identificação do problema, atrasando o processo.
        </Warning>
      </Section>

      <Section id="rever-correcções" title="Rever Correcções">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Quando um analista corrige e re-submete, a visita passa para estado <em>corrigida</em>.
        </p>
        <Step n={1} title="Filtrar por estado 'corrigida'">
          Na página de visitas, filtra por <strong>corrigida</strong> para ver as visitas re-submetidas.
        </Step>
        <Step n={2} title="Rever as alterações">
          Verifica se as correcções pedidas foram implementadas correctamente.
        </Step>
        <Step n={3} title="Aprovar ou devolver novamente">
          Se as correcções estão correctas, muda para <strong>validada</strong>. Se ainda há problemas, muda novamente para <strong>corrigir</strong> com novo motivo.
        </Step>
      </Section>

      <Section id="criterios" title="Critérios de Qualidade">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O que verificar em cada visita antes de validar:
        </p>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {[
            { item: "Pontuação preenchida", desc: "O campo de pontuação tem um valor numérico válido" },
            { item: "Estado coerente", desc: "O estado da visita reflecte o que foi efectivamente realizado" },
            { item: "Datas correctas", desc: "A data de realização é coerente com o período do estudo" },
            { item: "Estabelecimento correcto", desc: "A visita está associada ao estabelecimento certo" },
            { item: "Tipo de visita adequado", desc: "O tipo (presencial, telefónica, etc.) é o correcto para este estudo" },
            { item: "Grelha de avaliação (Wave 4)", desc: "Visitas com grelha associada mostram o nome da grelha e o tipo de visita — confirma que correspondem ao canal realizado" },
          ].map(({ item, desc }) => (
            <div key={item} className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
              <span className="text-orange-400 text-sm flex-shrink-0">✓</span>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{item}</p>
                <p className="text-slate-400 text-xs">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="dashboard" title="Acompanhar a Qualidade">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O Dashboard mostra métricas de qualidade úteis para o validador:
        </p>
        <div className="space-y-3">
          {[
            { metric: "Visitas por validar", desc: "Total de visitas com estado 'inserida' aguardando revisão" },
            { metric: "Pontuação média", desc: "Média das pontuações das visitas validadas" },
            { metric: "Taxa de rejeição", desc: "Percentagem de visitas devolvidas para correcção" },
          ].map(({ metric, desc }) => (
            <div key={metric} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0 mt-1.5" />
              <div>
                <p className="font-semibold text-slate-900 text-sm">{metric}</p>
                <p className="text-slate-500 text-sm">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="faq" title="Perguntas Frequentes">
        <div className="space-y-4">
          {[
            {
              q: "Posso validar visitas de qualquer estudo?",
              a: "Não. Apenas são listadas e validáveis as visitas dos estudos com permissão de validador atribuída.",
            },
            {
              q: "O que faço com visitas com 'situacao_especial'?",
              a: "Visitas com situação especial requerem análise manual. Deverá ser contactado o coordenador do estudo para decidir se devem ser validadas, anuladas ou mantidas em espera.",
            },
            {
              q: "Posso desfazer uma validação?",
              a: "Sim. Um administrador ou o coordenador pode alterar o estado de uma visita validada de volta para 'inserida' ou outro estado. Deverá ser contactado o coordenador.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="font-semibold text-slate-900 text-sm mb-2">{q}</p>
              <p className="text-slate-600 text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="fotos-ia" title="Análise de Fotos com IA (Cognira Módulo 3)">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O validador pode usar a <strong>análise IA de fotos</strong> como apoio à validação. Cada foto de visita pode ser analisada pelo GPT-4o Vision para verificar a autenticidade e coerência.
        </p>
        <Step n={1} title="Abrir as fotos da visita">
          No modal de edição ou na lista de visitas, clica no botão de fotos (📷).
        </Step>
        <Step n={2} title="Analisar cada foto">
          Clicar em <strong>Analisar com IA</strong> em cada foto. O GPT-4o Vision avalia se a foto é coerente com o tipo de visita.
        </Step>
        <Step n={3} title="Utilizar o resultado na decisão">
          Fotos com veredicto <em>rejeitada</em> ou <em>inconclusiva</em> podem justificar a devolução da visita para correcção.
        </Step>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-4">
          {[
            { state: "aprovada", desc: "Foto válida e coerente", color: "bg-emerald-100 text-emerald-700" },
            { state: "rejeitada", desc: "Foto inválida ou suspeita", color: "bg-red-100 text-red-600" },
            { state: "inconclusiva", desc: "Requer revisão manual do validador", color: "bg-yellow-100 text-yellow-700" },
          ].map(({ state, desc, color }) => (
            <div key={state} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>{state}</span>
              <span className="text-sm text-slate-600">{desc}</span>
            </div>
          ))}
        </div>
        <Tip>
          Deve ser utilizada como ferramenta de apoio — a decisão final é sempre do validador.
        </Tip>
      </Section>

      <Section id="validacao-ia" title="Validação com Cognira IA">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          No modal de detalhe de uma visita encontras o botão <strong>"Validar com Cognira IA"</strong>. O modelo analisa as respostas inseridas pelo analista e emite um parecer imediato.
        </p>
        {[
          { color: "green", label: "Verde — Aprovado", desc: "Respostas consistentes, sem anomalias. A visita pode ser validada com confiança." },
          { color: "yellow", label: "Amarelo — Requer Atenção", desc: "O modelo detectou pontos duvidosos. Revê os campos assinalados antes de validar." },
          { color: "red", label: "Vermelho — Reprovar", desc: "Respostas inconsistentes ou suspeitas. Considera devolver para correcção." },
        ].map(({ color, label, desc }) => (
          <div key={label} className={`flex items-start gap-3 bg-white border rounded-xl p-4 shadow-sm mb-2 border-${color === "green" ? "green" : color === "yellow" ? "yellow" : "red"}-200`}>
            <span className={`w-3 h-3 mt-1 rounded-full shrink-0 bg-${color === "green" ? "green" : color === "yellow" ? "yellow" : "red"}-400`} />
            <div>
              <p className="font-semibold text-slate-900 text-sm mb-1">{label}</p>
              <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}
