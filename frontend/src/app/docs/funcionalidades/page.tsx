import {
  LayoutGrid, Database, MapPin, ClipboardCheck, BarChart3,
  FileText, Shield, KeyRound, Wifi, Smartphone, TrendingUp,
  AlertTriangle, GraduationCap, MessageCircle, Sparkles,
  CheckCircle2, Zap, Lock, Users, Globe, Clock, Map, BookOpen, Bell,
  ScanLine, Languages, WifiOff, ShoppingCart,
} from "lucide-react";

// ── Shared card ─────────────────────────────────────────────────────────────

function FeatureCard({
  id, icon: Icon, color, title, badge, children,
}: {
  id: string; icon: React.ElementType; color: string; title: string; badge?: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-8 scroll-mt-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${color}`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-slate-900 text-base">{title}</h2>
              {badge && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2D6BEE]/10 text-[#2D6BEE] uppercase tracking-wider">
                  {badge}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-slate-600 text-sm leading-relaxed">{children}</div>
      </div>
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 mr-1">
      {children}
    </span>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-slate-600">
      <span className="flex-shrink-0 w-1 h-1 rounded-full bg-[#2D6BEE] mt-2" />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FuncionalidadesPage() {
  return (
    <div>
      {/* Hero */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-[#2D6BEE]/10 text-[#2D6BEE] px-3 py-1.5 rounded-full text-xs font-semibold mb-4">
          <LayoutGrid className="w-3.5 h-3.5" />
          Plataforma Cognira
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3 leading-tight">
          Todas as Funcionalidades
        </h1>
        <p className="text-slate-500 text-lg leading-relaxed max-w-lg">
          A plataforma Cognira Mystery Shopping cobre todo o ciclo de vida de um estudo —
          desde a configuração até à análise IA. Aqui está o catálogo completo.
        </p>
      </div>

      {/* Jump links */}
      <div className="flex flex-wrap gap-2 mb-10">
        {[
          ["#estudos", "Estudos & Ondas"],
          ["#visitas", "Visitas de Campo"],
          ["#questionarios", "Questionários"],
          ["#validacao", "Validação"],
          ["#relatorios", "Relatórios"],
          ["#sla", "SLA Monitor"],
          ["#heatmap", "Heatmap"],
          ["#drill-down", "Drill-down"],
          ["#fraude", "Fraude"],
          ["#benchmarking", "Benchmarking"],
          ["#rag", "Pesquisa RAG"],
          ["#alertas", "Alertas Score"],
          ["#pii", "PII & Crypto"],
          ["#sso", "SSO / OIDC"],
          ["#pwa", "PWA Offline"],
          ["#offline-drafts", "Rascunhos Offline"],
          ["#i18n", "Internacionalização"],
          ["#barcode", "Barcode Scanner"],
          ["#shelf-audit", "Shelf Audit"],
          ["#mensagens", "Mensagens"],
          ["#formacoes", "Formações"],
          ["#testes", "Testes Auto"],
          ["#chat-interno-rt", "Chat Interno WebRTC"],
          ["#planos-modulos", "Planos & Módulos"],
          ["#wizard", "AI Study Wizard"],
          ["#planograma", "Planogram Compliance"],
          ["#sla-contractual", "SLA Contractual"],
          ["#questionarios-i18n", "Questionários Multi-idioma"],
          ["#relatorios-i18n", "Relatórios Multi-idioma"],
          ["#offline-drafts-8-1", "Offline Drafts"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-[#2D6BEE] hover:text-[#2D6BEE] transition-colors shadow-sm"
          >
            {label}
          </a>
        ))}
      </div>

      {/* ── Estudos e Ondas ────────────────────────────────────────────────── */}
      <FeatureCard id="estudos" icon={Database} color="from-violet-500 to-violet-700" title="Estudos e Ondas">
        <p className="mb-3">
          Um <strong>Estudo</strong> é o projecto-base que agrega todas as visitas de mystery shopping
          para um cliente. Cada estudo pode ter múltiplas <strong>Ondas</strong> (rondas periódicas),
          cada uma com datas de início/fim, grelha de avaliação própria e estabelecimentos-alvo.
        </p>
        <ul className="space-y-1.5">
          <Bullet>Campos configuráveis de caracterização do estabelecimento por estudo</Bullet>
          <Bullet>Grelha de avaliação com secções, perguntas e pesos personalizados</Bullet>
          <Bullet>Chilling periods e blacklist por analista/estabelecimento</Bullet>
          <Bullet>Estado da onda: planeamento → em curso → fechada → arquivada</Bullet>
        </ul>
        <div className="mt-3">
          <Pill><Users className="w-3 h-3" />Admin</Pill>
          <Pill>Coordenador</Pill>
        </div>
      </FeatureCard>

      {/* ── Visitas de Campo ───────────────────────────────────────────────── */}
      <FeatureCard id="visitas" icon={MapPin} color="from-blue-500 to-blue-700" title="Visitas de Campo">
        <p className="mb-3">
          As visitas são a unidade de trabalho principal. São criadas no planeamento IA (Módulo 4)
          ou manualmente, e percorrem o ciclo: <code>planeada → em_curso → submetida → aprovada/reprovada</code>.
        </p>
        <ul className="space-y-1.5">
          <Bullet>Preenchimento online e offline (PWA com service worker)</Bullet>
          <Bullet>Upload de fotos com análise automática por IA (Módulo 3)</Bullet>
          <Bullet>Campos de caracterização dinâmicos por estudo</Bullet>
          <Bullet>Questionários dinâmicos associados a secções da grelha</Bullet>
          <Bullet>Geolocalização do estabelecimento com lat/lng</Bullet>
          <Bullet>Reatribuição via Chat de Logística (Módulo 6)</Bullet>
        </ul>
        <div className="mt-3">
          <Pill>Analista</Pill><Pill>Coordenador</Pill><Pill>Admin</Pill>
        </div>
      </FeatureCard>

      {/* ── Questionários Dinâmicos ────────────────────────────────────────── */}
      <FeatureCard id="questionarios" icon={ClipboardCheck} color="from-teal-500 to-teal-700" title="Questionários Dinâmicos">
        <p className="mb-3">
          Para além da grelha de avaliação, cada estudo pode ter <strong>questionários</strong>
          com perguntas dinâmicas de vário tipo: <em>texto, número, sim/não, opção múltipla, escala</em>.
          As respostas ficam armazenadas e são usadas pelos módulos IA como contexto adicional.
        </p>
        <ul className="space-y-1.5">
          <Bullet>Criação e edição de questionários por administrador ou coordenador</Bullet>
          <Bullet>Perguntas condicionais (mostrar com base em resposta anterior)</Bullet>
          <Bullet>Exportação das respostas em Excel com os dados da visita</Bullet>
        </ul>
        <div className="mt-3">
          <Pill>Admin</Pill><Pill>Coordenador</Pill><Pill>Analista</Pill>
        </div>
      </FeatureCard>

      {/* ── Validação ─────────────────────────────────────────────────────── */}
      <FeatureCard id="validacao" icon={CheckCircle2} color="from-emerald-500 to-emerald-700" title="Fila de Validação">
        <p className="mb-3">
          Todas as visitas submetidas entram numa fila de validação. O validador revê os dados,
          as fotos e pode solicitar ao motor IA um <strong>parecer preliminar</strong> (Validação IA).
          Pode aprovar, reprovar com motivo, ou enviar para correcção.
        </p>
        <ul className="space-y-1.5">
          <Bullet>Filtros por estudo, onda, analista, estado e data</Bullet>
          <Bullet>Parecer IA com recomendação + confiança + motivos</Bullet>
          <Bullet>Aprovação em batch para visitas de baixo risco</Bullet>
          <Bullet>Histórico de decisões por visita auditável</Bullet>
        </ul>
        <div className="mt-3">
          <Pill>Validador</Pill><Pill>Coordenador</Pill><Pill>Admin</Pill>
        </div>
      </FeatureCard>

      {/* ── Relatórios ────────────────────────────────────────────────────── */}
      <FeatureCard id="relatorios" icon={FileText} color="from-amber-500 to-amber-700" title="Relatórios Excel e PDF" badge="Export">
        <p className="mb-3">
          Relatórios completos em dois formatos para consumo externo e apresentação aos clientes.
        </p>
        <ul className="space-y-1.5">
          <Bullet><strong>Excel:</strong> exportação completa de visitas com todos os campos e respostas, formatação profissional com cabeçalhos coloridos</Bullet>
          <Bullet><strong>PDF Narrativo:</strong> gerado pelo Módulo 1 IA — relatório executivo em linguagem natural pronto a entregar</Bullet>
          <Bullet><strong>PDF Call Center:</strong> resultado formatado de cada chamada analisada (Módulo CC)</Bullet>
          <Bullet><strong>Pagamentos:</strong> exportação de folhas de pagamento a analistas por estudo e onda</Bullet>
        </ul>
        <div className="mt-3">
          <Pill>Admin</Pill><Pill>Coordenador</Pill><Pill>Cliente</Pill>
        </div>
      </FeatureCard>

      {/* ── SLA Monitor ───────────────────────────────────────────────────── */}
      <FeatureCard id="sla" icon={Clock} color="from-orange-500 to-orange-700" title="SLA Monitor" badge="Sprint 7">
        <p className="mb-3">
          Painel de controlo para visitas em atraso face aos limites operacionais configurados.
          Cada estado de visita tem um threshold em dias; o monitor mostra todas as visitas que
          ultrapassaram o tempo máximo.
        </p>
        <ul className="space-y-1.5">
          <Bullet>Thresholds por estado: planeada (2d), inserida (3d), corrigir (2d)</Bullet>
          <Bullet>KPI cards por estado com contagem de alertas</Bullet>
          <Bullet>Tabela ordenada por dias de atraso com severidade visual</Bullet>
          <Bullet>Filtro por estudo; link directo para a visita em atraso</Bullet>
        </ul>
        <div className="mt-3">
          <Pill><Users className="w-3 h-3" />Admin</Pill>
          <Pill>Coordenador</Pill>
        </div>
      </FeatureCard>

      {/* ── Heatmap ───────────────────────────────────────────────────────── */}
      <FeatureCard id="heatmap" icon={Map} color="from-teal-600 to-emerald-700" title="Heatmap Geográfico por Score" badge="Sprint 7">
        <p className="mb-3">
          Visualização de mapa interactivo com cor por score médio por estabelecimento.
          Permite identificar concentrações geográficas de baixa qualidade num relance.
        </p>
        <ul className="space-y-1.5">
          <Bullet>Toggle termómetro: activar/desactivar modo heatmap</Bullet>
          <Bullet>Gradiente verde→amarelo→vermelho baseado no score normalizado</Bullet>
          <Bullet>Legenda interactiva com escala de pontuação</Bullet>
          <Bullet>Filtro por estudo e onda; integrado na página /mapa existente</Bullet>
        </ul>
        <div className="mt-3">
          <Pill>Admin</Pill><Pill>Coordenador</Pill>
        </div>
      </FeatureCard>

      {/* ── Drill-down ────────────────────────────────────────────────────── */}
      <FeatureCard id="drill-down" icon={BarChart3} color="from-purple-500 to-purple-700" title="Drill-down por Critério" badge="Sprint 7">
        <p className="mb-3">
          Análise detalhada de conformidade por critério de avaliação — vai além do score global
          e mostra quais os campos específicos com mais falhas ou maior variabilidade.
        </p>
        <ul className="space-y-1.5">
          <Bullet>Taxa de conformidade (%) por critério, ordenada do pior para o melhor</Bullet>
          <Bullet>Desvio padrão por critério — identifica o que tem mais variabilidade</Bullet>
          <Bullet>Filtro por estudo e onda; accordion expansível por secção</Bullet>
          <Bullet>Integrado na página /relatorios como secção dedicada</Bullet>
        </ul>
        <div className="mt-3">
          <Pill>Admin</Pill><Pill>Coordenador</Pill><Pill>Validador</Pill>
        </div>
      </FeatureCard>

      {/* ── Fraude ────────────────────────────────────────────────────────── */}
      <FeatureCard id="fraude" icon={AlertTriangle} color="from-rose-500 to-rose-700" title="Detecção de Fraude" badge="IA">
        <p className="mb-3">
          O sistema aplica heurísticas automáticas para sinalizar visitas potencialmente fraudulentas.
          As regras incluem: tempo de preenchimento anormalmente curto, coordenadas GPS inconsistentes,
          respostas repetidas entre visitas do mesmo analista, e scores perfeitos em secções difíceis.
        </p>
        <ul className="space-y-1.5">
          <Bullet>Score de risco de fraude (0–100%) por visita</Bullet>
          <Bullet>Alertas na fila de validação para visitas de risco elevado</Bullet>
          <Bullet>Histórico de sinalizações por analista para detectar padrões</Bullet>
        </ul>
        <div className="mt-3">
          <Pill>Admin</Pill><Pill>Coordenador</Pill><Pill>Validador</Pill>
        </div>
      </FeatureCard>

      {/* ── Benchmarking ──────────────────────────────────────────────────── */}
      <FeatureCard id="benchmarking" icon={BarChart3} color="from-cyan-500 to-cyan-700" title="Benchmarking Cross-Cliente">
        <p className="mb-3">
          Compara o desempenho de estabelecimentos dentro do mesmo estudo, entre ondas, e (quando
          autorizado pelo admin) entre clientes do mesmo sector de actividade. Os dados são
          anonimizados antes de qualquer comparação cross-cliente.
        </p>
        <ul className="space-y-1.5">
          <Bullet>Rankings de estabelecimentos por secção da grelha</Bullet>
          <Bullet>Evolução temporal por estabelecimento (ondas anteriores vs. actual)</Bullet>
          <Bullet>Comparação regional — média por distrito/região</Bullet>
          <Bullet>Exportação de tabelas de benchmark em Excel</Bullet>
        </ul>
        <div className="mt-3">
          <Pill>Admin</Pill><Pill>Coordenador</Pill><Pill>Cliente</Pill>
        </div>
      </FeatureCard>

      {/* ── RAG ───────────────────────────────────────────────────────────── */}
      <FeatureCard id="rag" icon={BookOpen} color="from-violet-600 to-purple-700" title="Pesquisa Semântica RAG" badge="Sprint 7 · IA">
        <p className="mb-3">
          Sistema de <strong>Retrieval-Augmented Generation</strong> para indexar e pesquisar
          documentos de briefing por significado. Utiliza embeddings OpenAI (<code>text-embedding-3-small</code>)
          e pgvector para busca por similaridade coseno.
        </p>
        <ul className="space-y-1.5">
          <Bullet>Ingestão de chunks de texto (briefings, guias) com geração automática de embedding</Bullet>
          <Bullet>Pesquisa por query em linguagem natural — top-k resultados ordenados por similaridade</Bullet>
          <Bullet>Filtro por estudo; listagem e remoção de documentos indexados</Bullet>
          <Bullet>API: POST /rag/ingest · POST /rag/search · GET /rag/documentos</Bullet>
        </ul>
        <div className="mt-3">
          <Pill>Admin</Pill><Pill>Coordenador</Pill><Pill>Validador (leitura)</Pill>
        </div>
      </FeatureCard>

      {/* ── Alertas ───────────────────────────────────────────────────────── */}
      <FeatureCard id="alertas" icon={Bell} color="from-red-500 to-rose-700" title="Alertas Configuráveis de Score" badge="Sprint 7">
        <p className="mb-3">
          Monitorização contínua de estabelecimentos com score médio abaixo do threshold configurado.
          Permite definir um limite global e consultar em tempo real quais os pontos de venda
          a necessitar de atenção.
        </p>
        <ul className="space-y-1.5">
          <Bullet>Threshold global editável pelo admin via painel deslizante</Bullet>
          <Bullet>Severity automática: crítico (&lt;75% do threshold), alto (&lt;90%), médio</Bullet>
          <Bullet>KPI cards com contagem por severidade; tabela ordenada pelo pior score</Bullet>
          <Bullet>Threshold persistido em configuracoes_sistema (chave alertas_score)</Bullet>
        </ul>
        <div className="mt-3">
          <Pill>Admin</Pill><Pill>Coordenador</Pill>
        </div>
      </FeatureCard>

      {/* ── PII ───────────────────────────────────────────────────────────── */}
      <FeatureCard id="pii" icon={Lock} color="from-slate-600 to-slate-800" title="Encriptação PII — Fernet AES-128" badge="Segurança">
        <p className="mb-3">
          Os campos de dados pessoais (nome, email, NIF, IBAN dos analistas) são <strong>encriptados
          em repouso</strong> com <strong>Fernet</strong> (AES-128-CBC + HMAC-SHA256) antes de serem
          persistidos na base de dados. A chave de encriptação é gerida via variável de ambiente
          e nunca fica armazenada junto aos dados.
        </p>
        <ul className="space-y-1.5">
          <Bullet>Encriptação transparente — a API desencripta automaticamente ao servir os dados</Bullet>
          <Bullet>Dados pessoais nunca aparecem em logs ou traces</Bullet>
          <Bullet>Rotação de chave suportada sem downtime (migrações progressivas)</Bullet>
          <Bullet>Auditable — cada entidade PII regista o campo encriptado com prefixo identificador</Bullet>
        </ul>
        <div className="mt-3 text-xs text-slate-500">
          Chave configurada em <code className="bg-slate-100 px-1 rounded">FERNET_KEY</code> no <code className="bg-slate-100 px-1 rounded">.env</code>.
        </div>
      </FeatureCard>

      {/* ── SSO ───────────────────────────────────────────────────────────── */}
      <FeatureCard id="sso" icon={KeyRound} color="from-indigo-500 to-indigo-700" title="SSO / OIDC Enterprise" badge="Sprint 5">
        <p className="mb-3">
          Suporte completo para Single Sign-On via protocolo <strong>OpenID Connect (OIDC)</strong>.
          Compatível com qualquer IdP: <em>Authentik, Keycloak, Azure AD, Google Workspace, Okta</em>.
          O fluxo é Authorization Code com PKCE — a plataforma nunca vê a password do utilizador.
        </p>
        <ul className="space-y-1.5">
          <Bullet>Botão "Login com SSO" na página de login (activado por variável de ambiente)</Bullet>
          <Bullet>Auto-provisionamento de conta na primeira autenticação via SSO</Bullet>
          <Bullet>Mapeamento de grupos/claims do IdP para roles da plataforma</Bullet>
          <Bullet>Coexistência com login tradicional (email + password + 2FA)</Bullet>
        </ul>
        <div className="bg-slate-900 rounded-xl px-4 py-2.5 font-mono text-xs text-slate-300 mt-3">
          <span className="text-emerald-400 font-bold">OIDC_ISSUER</span>
          {" = "}<span className="text-slate-400">https://auth.empresa.com/realms/cognira</span>
        </div>
      </FeatureCard>

      {/* ── PWA ───────────────────────────────────────────────────────────── */}
      <FeatureCard id="pwa" icon={Wifi} color="from-green-500 to-green-700" title="PWA Offline & Câmara Nativa" badge="Sprint 5">
        <p className="mb-3">
          A plataforma é uma <strong>Progressive Web App</strong> instalável em qualquer dispositivo.
          Um service worker com estratégia <em>stale-while-revalidate</em> garante que as páginas
          funcionam offline. A câmara nativa é acessível directamente no browser móvel para
          captura de fotos nas visitas de campo.
        </p>
        <ul className="space-y-1.5">
          <Bullet>Instalável no ecrã inicial (iOS Safari, Android Chrome, desktop)</Bullet>
          <Bullet>Modo offline: formulários de visita acessíveis sem rede</Bullet>
          <Bullet>Push notifications para alertas de validação e novas visitas atribuídas</Bullet>
          <Bullet>Câmara nativa sem necessidade de app store</Bullet>
          <Bullet>Página offline branded quando não há cache e não há rede</Bullet>
        </ul>
      </FeatureCard>

      {/* ── Mensagens ─────────────────────────────────────────────────────── */}
      <FeatureCard id="mensagens" icon={MessageCircle} color="from-pink-500 to-pink-700" title="Mensagens Internas">
        <p className="mb-3">
          Sistema de mensagens internas entre utilizadores da plataforma — sem saída para email externo.
          Coordenadores comunicam com analistas, admins comunicam com coordenadores. As mensagens
          ficam associadas ao estudo/onda para contexto.
        </p>
        <ul className="space-y-1.5">
          <Bullet>Mensagens individuais e de grupo por estudo</Bullet>
          <Bullet>Notificação em-app (badge no ícone de mensagens)</Bullet>
          <Bullet>Histórico de mensagens pesquisável</Bullet>
          <Bullet>Mensagens de sistema automáticas (visita aprovada, plano criado, etc.)</Bullet>
        </ul>
        <div className="mt-3">
          <Pill>Todos os perfis</Pill>
        </div>
      </FeatureCard>

      {/* ── Formações ─────────────────────────────────────────────────────── */}
      <FeatureCard id="formacoes" icon={GraduationCap} color="from-yellow-500 to-yellow-700" title="Formações e Certificações">
        <p className="mb-3">
          Módulo de e-learning interno para formação e certificação de analistas. Permite criar
          cursos com conteúdo texto/vídeo, quizzes e emissão de certificados digitais após
          conclusão com aprovação.
        </p>
        <ul className="space-y-1.5">
          <Bullet>Criação de cursos com secções, materiais e quizzes por administrador</Bullet>
          <Bullet>Progresso individual por analista — admin vê percentagem de conclusão</Bullet>
          <Bullet>Certificados gerados em PDF com data e ID único verificável</Bullet>
          <Bullet>Pré-requisito: analistas só podem ser atribuídos a visitas após certificação</Bullet>
        </ul>
        <div className="mt-3">
          <Pill>Admin</Pill><Pill>Analista</Pill>
        </div>
      </FeatureCard>

      {/* ── Testes ────────────────────────────────────────────────────────── */}
      <FeatureCard id="testes" icon={Shield} color="from-slate-500 to-slate-700" title="Testes Automáticos — pytest" badge="CI">
        <p className="mb-3">
          O backend tem uma suite pytest com <strong>42+ testes de integração</strong> que cobrem
          todos os endpoints, RBAC, encriptação PII, lógica de negócio e módulos IA (com mock
          do OpenAI). Os testes correm em base de dados isolada e nunca afectam dados de produção.
        </p>
        <ul className="space-y-1.5">
          <Bullet>Testes de autenticação: JWT, refresh, 2FA, SSO callback</Bullet>
          <Bullet>Testes de RBAC: verificação de isolamento por role e cliente</Bullet>
          <Bullet>Testes PII: dados encriptados correctamente em repouso</Bullet>
          <Bullet>Testes IA: módulos retornam schema correcto com mocks OpenAI</Bullet>
          <Bullet>Testes de validação de visitas, planeamento e exportação</Bullet>
        </ul>
        <div className="bg-slate-900 rounded-xl px-4 py-2.5 font-mono text-xs text-slate-300 mt-3">
          <span className="text-emerald-400">$</span> docker exec backend pytest tests/ -v --tb=short
        </div>
      </FeatureCard>

      {/* ── Rascunhos Offline (PWA Complete) ──────────────────────────────── */}
      <FeatureCard id="offline-drafts" icon={WifiOff} color="from-green-600 to-teal-700" title="Rascunhos Offline Persistentes" badge="Wave 3 · PWA">
        <p className="mb-3">
          Extensão completa do modo offline: para além de sincronizar uploads em fila, a plataforma
          agora <strong>persiste formulários de visita como rascunhos</strong> no IndexedDB do browser.
          O analista pode preencher parcialmente uma visita sem rede e retomá-la mais tarde.
        </p>
        <ul className="space-y-1.5">
          <Bullet><strong>Auto-save</strong> — o formulário guarda automaticamente um rascunho a cada alteração enquanto offline</Bullet>
          <Bullet>Rascunhos listados com data/hora e label da visita; botão "Retomar" carrega o estado guardado</Bullet>
          <Bullet>Após submissão com sucesso, o rascunho é automaticamente eliminado</Bullet>
          <Bullet>Service worker v5 — nova <code>visits-drafts</code> store no IndexedDB, partilhada entre SW e página</Bullet>
          <Bullet>Hook <code>useOfflineDraft()</code> — <code>saveDraftFn</code>, <code>loadDraft</code>, <code>removeDraft</code>, <code>listDrafts</code></Bullet>
        </ul>
        <div className="bg-slate-900 rounded-xl px-4 py-2.5 font-mono text-xs text-slate-300 mt-3 space-y-1">
          <div><span className="text-blue-400">import</span> <span className="text-yellow-300">{"{ useOfflineDraft }"}</span> <span className="text-blue-400">from</span> <span className="text-emerald-400">&apos;@/hooks/useOfflineDraft&apos;</span>;</div>
          <div><span className="text-yellow-300">const</span>{" { saveDraftFn, drafts, removeDraft } "} = <span className="text-blue-300">useOfflineDraft</span>();</div>
        </div>
        <div className="mt-3">
          <Pill>Analista</Pill><Pill>Coordenador</Pill>
        </div>
      </FeatureCard>

      {/* ── Internacionalização ───────────────────────────────────────────── */}
      <FeatureCard id="i18n" icon={Languages} color="from-blue-500 to-indigo-700" title="Internacionalização (i18n) PT/EN/ES/FR" badge="Wave 3">
        <p className="mb-3">
          A interface suporta quatro idiomas: <strong>Português (PT), Inglês (EN), Espanhol (ES) e Francês (FR)</strong>.
          A implementação usa um <strong>React Context</strong> nativo — sem dependências npm extra —
          com ficheiros JSON de mensagens e persistência automática em <code>localStorage</code>.
        </p>
        <ul className="space-y-1.5">
          <Bullet><strong>Selecção de idioma</strong> via dropdown 🌐 no rodapé da barra lateral — disponível em todos os ecrãs autenticados</Bullet>
          <Bullet>Idioma guardado por browser; ao abrir nova sessão é restaurado automaticamente</Bullet>
          <Bullet>Fallback para Português se uma chave não existir na tradução seleccionada</Bullet>
          <Bullet>Suporte a variáveis nas mensagens: <code>{'"{ count } resultado(s)"'}</code></Bullet>
          <Bullet>Hook: <code>{'const { t, locale, setLocale } = useI18n()'}</code></Bullet>
          <Bullet>Ficheiros de locale em <code>src/locales/pt.json</code>, <code>en.json</code>, <code>es.json</code>, <code>fr.json</code></Bullet>
        </ul>
        <div className="bg-slate-900 rounded-xl px-4 py-2.5 font-mono text-xs text-slate-300 mt-3 space-y-1">
          <div><span className="text-blue-400">import</span> <span className="text-yellow-300">{"{ useI18n }"}</span> <span className="text-blue-400">from</span> <span className="text-emerald-400">&apos;@/lib/i18n&apos;</span>;</div>
          <div><span className="text-yellow-300">const</span>{" { t } "} = <span className="text-blue-300">useI18n</span>();</div>
          <div><span className="text-blue-300">t</span>(<span className="text-emerald-400">&quot;common.save&quot;</span>) <span className="text-slate-500">{"// → \"Save\" | \"Guardar\" | \"Enregistrer\""}</span></div>
        </div>
        <div className="mt-3">
          <Pill>Todos os perfis</Pill>
        </div>
      </FeatureCard>

      {/* ── Barcode Scanner ───────────────────────────────────────────────── */}
      <FeatureCard id="barcode" icon={ScanLine} color="from-orange-500 to-red-600" title="Scanner de Código de Barras" badge="Wave 3">
        <p className="mb-3">
          Leitura de códigos de barras directamente no browser usando a <strong>BarcodeDetector API</strong>
          nativa (Chrome/Edge/Android). Não requer app nativa nem biblioteca third-party.
          Ideal para analistas que precisam de registar SKUs de produtos em visitas de campo.
        </p>
        <ul className="space-y-1.5">
          <Bullet><strong>Câmara em tempo real</strong> — detecção automática frame-a-frame sem clicar; overlay de mira visual</Bullet>
          <Bullet><strong>Introdução manual</strong> — fallback para browsers sem BarcodeDetector (Firefox, Safari ≤17)</Bullet>
          <Bullet>Formatos suportados: EAN-13, EAN-8, UPC-A, UPC-E, Code 39, Code 128, QR Code, DataMatrix, PDF417, Aztec</Bullet>
          <Bullet>Histórico de leituras na sessão com botão copiar para clipboard</Bullet>
          <Bullet>Botão <strong>&quot;Adicionar a Visita&quot;</strong> — passa o código como parâmetro para <code>/visitas?barcode=xxx</code></Bullet>
          <Bullet>Link externo para lookup na base barcodelookup.com para identificação rápida de produto</Bullet>
        </ul>
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mt-3 text-xs text-amber-800">
          <strong>Compatibilidade:</strong> BarcodeDetector API disponível em Chrome 83+, Edge 83+, Android Chrome/WebView.
          Em Safari e Firefox activa automaticamente o modo de introdução manual.
        </div>
        <div className="mt-3">
          <Pill>Analista</Pill><Pill>Coordenador</Pill><Pill>Admin</Pill>
        </div>
      </FeatureCard>

      {/* ── Multi-Grid ─────────────────────────────────────────────────────── */}
      <FeatureCard id="multi-grid" icon={LayoutGrid} color="from-indigo-500 to-violet-700" title="Multi-Grelha de Avaliação" badge="Wave 4">
        <p className="mb-3">
          Um mesmo estudo pode ter <strong>N grelhas de avaliação independentes</strong>, uma por tipo de visita —
          por exemplo, <em>presencial</em>, <em>drive-through</em>, <em>drive-thru Wash</em> e <em>telefónica</em>.
          Cada grelha tem <strong>secções temáticas</strong> com peso próprio, garantindo a correcta
          ponderação do score final por canal.
        </p>
        <ul className="space-y-1.5">
          <Bullet><strong>Grelhas</strong> — criadas por estudo; cada uma com nome, versão e tipo de visita associado</Bullet>
          <Bullet><strong>Secções</strong> — agrupam critérios por tema (ex: "Atendimento e Fila", "Produto e Qualidade"); suportam peso em %</Bullet>
          <Bullet><strong>Critérios</strong> — Boolean, Escala 1-5 ou Texto livre; cada um com peso individual dentro da secção</Bullet>
          <Bullet>A <strong>visita herda a grelha</strong> correspondente ao seu tipo no momento da criação (automático ou manual)</Bullet>
          <Bullet><strong>Relatório consolidado</strong> — scores normalizados 0–100% por grelha, agregados num dashboard único por estudo</Bullet>
          <Bullet>API REST: <code>GET /estudos/{"{id}"}/grelhas</code> · <code>POST /estudos/{"{id}"}/grelhas</code> com secções e critérios inline</Bullet>
        </ul>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
          {["presencial","drive_through","telefonica","auditoria","digital"].map(t => (
            <span key={t} className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-mono text-center capitalize">{t.replace("_","-")}</span>
          ))}
        </div>
        <div className="mt-3">
          <Pill>Admin</Pill><Pill>Coordenador</Pill>
        </div>
      </FeatureCard>

      {/* ── Shelf Audit ──────────────────────────────────────────────────── */}
      <FeatureCard id="shelf-audit" icon={ShoppingCart} color="from-emerald-500 to-teal-700" title="Auditoria de Prateleira (Shelf Audit)" badge="Wave 5">
        <p className="mb-3">
          Módulo dedicado à auditoria de conformidade de lineares e prateleiras — ideal para programas
          de <strong>retalho alimentar, FMCG e grandes superfícies</strong>. Regista por visita quais os
          produtos presentes, preços, quantidades reais vs esperadas, facings e validade, usando
          leitura de código de barras directamente da câmara.
        </p>
        <ul className="space-y-1.5">
          <Bullet><strong>Por visita</strong> — cada visita tem a sua lista de itens de auditoria, independente das outras</Bullet>
          <Bullet><strong>Scan EAN/QR</strong> — usa o <code>BarcodeScanner</code> da câmara para lookup automático de produto via <code>GET /api/visitas/barcode?code=</code></Bullet>
          <Bullet><strong>Campos por item</strong> — produto, EAN, validade, preço esperado vs real, quantidade esperada vs real, facings, conformidade, notas</Bullet>
          <Bullet><strong>Dashboard de conformidade</strong> — sumário em tempo real: total itens, conformes, não-conformes, taxa compliance (%), out-of-stock, desvios de preço</Bullet>
          <Bullet>API: <code>GET /api/shelf-audit/{"{visitaId}"}</code> · <code>GET /api/shelf-audit/{"{visitaId}"}/summary</code> · <code>POST/PUT/DELETE /api/shelf-audit/</code></Bullet>
        </ul>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
          {["EAN Scan","Preço Real vs Esperado","Facings","Out-of-Stock"].map(t => (
            <span key={t} className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold text-center">{t}</span>
          ))}
        </div>
        <div className="mt-3">
          <Pill>Admin</Pill><Pill>Coordenador</Pill><Pill>Analista</Pill>
        </div>
      </FeatureCard>

      {/* ── Chat Interno WebRTC ──────────────────────────────────────── */}
      <FeatureCard id="chat-interno-rt" icon={MessageCircle} color="from-sky-500 to-sky-700" title="Chat Interno Real-Time com Chamadas WebRTC" badge="Wave 6">
        <p className="mb-3">
          Sistema de comunicação interna com <strong>mensagens em tempo real via WebSocket</strong> e
          <strong> chamadas de voz P2P</strong> usando WebRTC com servidor TURN/coturn. Suporta grupos
          e mensagens directas, badge de não-lidas no header e balão flutuante em todas as páginas.
        </p>
        <ul className="space-y-1.5">
          <Bullet><strong>Chamadas voice WebRTC</strong> — ligações P2P directas, SDP offer/answer, ICE candidate queuing e relay TURN quando NAT não permite ligação directa</Bullet>
          <Bullet><strong>Overlay de chamada recebida</strong> — popup de entrada com aceitar/recusar; banner de chamada activa com temporizador e mute</Bullet>
          <Bullet><strong>TURN credentials on-demand</strong> — credenciais coturn geradas via HMAC-SHA256 com expiração, sem exposição de segredos no frontend</Bullet>
          <Bullet><strong>Real-time messages</strong> — WebSocket relay em <code>ws.py</code>; polling de fallback a 3s; hook <code>useWebRTC.ts</code> com máquina de estados (idle → calling → receiving → connecting → active → ended)</Bullet>
          <Bullet>Grupos, DMs, badge de não-lidas, histórico persistente em PostgreSQL</Bullet>
        </ul>
        <div className="mt-3">
          <Pill>Todos os roles</Pill>
        </div>
      </FeatureCard>

      {/* ── Planos & Módulos ─────────────────────────────────────────────── */}
      <FeatureCard id="planos-modulos" icon={LayoutGrid} color="from-blue-600 to-blue-800" title="Planos & Módulos por Cliente" badge="Wave 6">
        <p className="mb-3">
          Sistema de <strong>activação granular de funcionalidades</strong> por cliente.
          8 planos agrupam 22 módulos independentes que podem ser activados ou desactivados
          individualmente. O menu lateral (AppShell) adapta-se automaticamente aos módulos
          activos, ocultando secções não licenciadas.
        </p>
        <ul className="space-y-1.5">
          <Bullet><strong>8 planos disponíveis</strong>: Mystery Shopping, Call Center, Shelf Audit, Sondagens & Questionários, Cognira Intelligence™, Formações, Pagamentos, Comunicação</Bullet>
          <Bullet><strong>22 módulos granulares</strong>: estudos, visitas, analistas, multi_grid, mapa, relatorios, callcenter, shelf_audit, barcode, questionarios, survey_portal, chat_ia, alertas, sla, benchmarking, fraude, rag, formacoes, pagamentos, mensagens, chat_interno, push</Bullet>
          <Bullet><code>GET /api/clientes/{'{id}'}/modulos</code> — retorna catálogo completo com flags activas por cliente</Bullet>
          <Bullet><code>PUT /api/clientes/{'{id}'}/modulos</code> — salva mapa de flags <code>{'{key: bool}'}</code> (idempotente, admin only)</Bullet>
          <Bullet><strong>Module gating no AppShell</strong> — sidebar filtra itens de menu com base nos módulos activos do cliente autenticado</Bullet>
        </ul>
        <div className="mt-3">
          <Pill><Lock className="w-3 h-3" />Admin</Pill>
        </div>
      </FeatureCard>

      {/* ── AI Study Wizard ──────────────────────────────────────────────── */}
      <FeatureCard id="wizard" icon={Sparkles} color="from-violet-500 to-purple-700" title="AI Study Wizard" badge="Wave 7">
        <p className="mb-3">
          Wizard multi-step que usa <strong>GPT-4.1</strong> para gerar automaticamente a estrutura
          completa de um novo estudo com base num briefing em linguagem natural. Reduz o tempo de
          configuração de um estudo de horas para segundos.
        </p>
        <ul className="space-y-1.5">
          <Bullet><strong>Passo 1 — Briefing</strong>: o utilizador descreve o sector, objectivos e tipo de visita em linguagem natural</Bullet>
          <Bullet><strong>Passo 2 — Sugestão IA</strong>: GPT-4.1 gera nome, campos de caracterização, critérios de avaliação com pesos e módulos recomendados por sector via <code>POST /api/wizard/sugestao</code></Bullet>
          <Bullet><strong>Passo 3 — Revisão</strong>: draft completamente editável — ajusta campos, pesos, critérios e módulos antes de criar</Bullet>
          <Bullet><strong>Passo 4 — Aplicar</strong>: <code>POST /api/wizard/aplicar</code> cria estudo + campos + grelha de avaliação + activa módulos numa única request atómica</Bullet>
          <Bullet>Sugestão de módulos por sector: retalho alimentar, telecomunicações, restauração, banca, automóvel, etc.</Bullet>
        </ul>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
          {["Briefing NL","GPT-4.1 Draft","Revisão humana","One-click apply"].map(t => (
            <span key={t} className="px-2 py-1 rounded-lg bg-violet-50 text-violet-700 font-semibold text-center">{t}</span>
          ))}
        </div>
        <div className="mt-3">
          <Pill>Admin</Pill><Pill>Coordenador</Pill>
        </div>
      </FeatureCard>

      {/* Wave 8 ─────────────────────────────────────────────────────────── */}

      <FeatureCard id="planograma" icon={LayoutGrid} color="from-indigo-500 to-blue-700" title="Planogram Compliance" badge="Wave 8.4">
        <Bullet><strong>Planogramas de referência</strong>: upload de imagem (JPEG/PNG/WebP, max 20 MB) com ClamAV scan + MinIO <code>planogramas</code>; organização por estudo e categoria</Bullet>
        <Bullet><strong>Análise GPT-4o Vision</strong>: <code>POST /api/planogramas/&#123;id&#125;/comparar</code> compara planograma de referência vs foto real da visita com score 0–100</Bullet>
        <Bullet><strong>Resultado detalhado</strong>: <code>score_compliance</code>, <code>ia_items_corretos</code>, <code>ia_items_errados</code>, <code>ia_items_faltando</code> e recomendações textuais</Bullet>
        <Bullet><strong>Histórico por visita</strong>: <code>GET /api/planogramas/visita/&#123;id&#125;</code> — todas as comparações de uma visita com ScorePill visual</Bullet>
        <Bullet><strong>Frontend</strong>: página <code>/planograma</code> com selector de estudo, grid de planogramas, painél de comparação lado-a-lado</Bullet>
        <div className="mt-3">
          <Pill>Admin</Pill><Pill>Coordenador</Pill>
        </div>
      </FeatureCard>

      <FeatureCard id="sla-contractual" icon={Clock} color="from-amber-500 to-orange-600" title="SLA Contractual por Cliente" badge="Wave 8.8">
        <Bullet><strong>Thresholds por cliente</strong>: <code>sla_visita_dias</code> (planeada → realização) e <code>sla_validacao_dias</code> (inserida → validação) configuráveis via <code>PUT /api/clientes/&#123;id&#125;/sla</code></Bullet>
        <Bullet><strong>Prioridade</strong>: quando definidos, sobrepõem os limites globais no monitor SLA para visitas desse cliente</Bullet>
        <Bullet><strong>Monitor SLA actualizado</strong>: página <code>/sla</code> mostra alertas com threshold efectivo e inclui painel “Configurar por cliente” colisável para administração directa</Bullet>
        <Bullet><strong>Retrocompatível</strong>: clientes sem thresholds contratuais continuam a usar os globais (padrão: visita 3d, validação 2d)</Bullet>
        <div className="mt-3">
          <Pill>Admin</Pill>
        </div>
      </FeatureCard>

      <FeatureCard id="questionarios-i18n" icon={Languages} color="from-teal-500 to-cyan-700" title="Questionários Multi-idioma" badge="Wave 8.9">
        <Bullet><strong>Traduções por locale</strong>: coluna <code>translations_json</code> JSONB em <code>questionarios</code> guarda <code>&#123; &quot;en&quot;: &#123; &quot;nome&quot;: ..., &quot;campos&quot;: &#123; campoId: tr...&#125; &#125;&#125;</code></Bullet>
        <Bullet><strong>API locale-aware</strong>: <code>GET /api/questionarios/?locale=en</code> devolve questínario com nome e etiquetas traduzidas; PT é sempre a base</Bullet>
        <Bullet><strong>Endpoint de traduções</strong>: <code>PUT /api/questionarios/&#123;id&#125;/translations</code> com <code>&#123;&quot;translations_json&quot;: &#123; &quot;en&quot;: ...&#125;&#125;</code></Bullet>
        <Bullet><strong>Builder com tab Traduções</strong>: idiomas EN/ES/FR disponíveis; input lado-a-lado com etiqueta original (PT) para cada campo</Bullet>
        <div className="mt-3">
          <Pill>Admin</Pill><Pill>Coordenador</Pill>
        </div>
      </FeatureCard>
      <div className="bg-gradient-to-r from-[#2D6BEE] to-[#1A52CC] rounded-2xl p-6 flex items-start gap-4 mt-4">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-base mb-1">Cognira Intelligence™</p>
          <p className="text-white/80 text-sm leading-relaxed">
            Para os módulos de Inteligência Artificial — Relatório Narrativo, Fotos IA, Planeamento Auto,
            Insights, Chat de Logística, Chat Semântico, Score Preditivo, Anomalias, Validação IA,
            Call Center IA, Shelf Audit IA (Wave 5), Chat WebRTC (Wave 6), AI Study Wizard (Wave 7)
            e Planogram Compliance (Wave 8.4), Relatórios Multi-idioma (Wave 8.5)
            — consulta a documentação completa em{" "}
            <a href="/docs/ia" className="text-white font-semibold underline underline-offset-2">Módulos IA</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
