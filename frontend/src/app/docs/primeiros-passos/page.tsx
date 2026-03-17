import Link from "next/link";
import { Rocket, LogIn, LayoutDashboard, User, Lock, ChevronRight, Info, Globe, ShieldCheck, Bell, Moon, LogOut, RefreshCw, Smartphone } from "lucide-react";

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

export default function PrimeirosPassosPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full text-xs font-semibold mb-3">
          <Rocket className="w-3.5 h-3.5" />
          Primeiros Passos
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Começar a usar a plataforma</h1>
        <p className="text-slate-500 text-base leading-relaxed">
          Guia de introdução ao Cognira — login, navegação e configuração inicial.
        </p>
      </div>

      <Section id="acesso" title="Aceder à plataforma">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          O Cognira é uma aplicação web acessível a partir de qualquer browser moderno (Chrome, Firefox, Edge, Safari). Não é necessário instalar nada.
        </p>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 mb-4 shadow-sm">
          <Globe className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-slate-400 mb-0.5">URL da plataforma</p>
            <p className="font-mono font-semibold text-slate-900 text-sm">https://q21.otokura.online</p>
          </div>
        </div>
        <Tip>Guardar o endereço nos favoritos do browser para acesso rápido.</Tip>
      </Section>

      <Section id="login" title="Fazer login">
        <Step n={1} title="Abrir a página de login">
          Navegar para o endereço da plataforma — o utilizador é direcionado automaticamente para a página de login.
        </Step>
        <Step n={2} title="Introduzir as credenciais">
          <p className="mb-2">Preencher o campo <strong>Username</strong> com o nome de utilizador e <strong>Password</strong> com a palavra-passe.</p>
          <Warning>A palavra-passe é sensível a maiúsculas/minúsculas. Verificar que o Caps Lock está desactivado.</Warning>
        </Step>
        <Step n={3} title="Autenticação de dois fatores (2FA)">
          Se a conta tiver 2FA activado, após introduzir a palavra-passe será solicitado um código de 6 dígitos gerado pela aplicação autenticadora (ex: Google Authenticator, Authy).
        </Step>
        <Step n={4} title="Dashboard">
          Após login bem-sucedido, o utilizador é redirecionado para o <strong>Dashboard</strong> principal.
        </Step>
        <Tip>Em caso de palavra-passe esquecida, contactar o administrador da plataforma para a reposição.</Tip>
      </Section>

      <Section id="navegacao" title="Navegar na plataforma">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          A plataforma tem uma barra de navegação lateral com três secções:
        </p>
        <div className="space-y-3">
          {[
            { group: "Principal", items: ["Dashboard — visão geral de métricas", "Estudos — lista de estudos de mercado", "Visitas — todas as visitas de campo"] },
            { group: "Gestão", items: ["Analistas — equipa de campo", "Estabelecimentos — pontos de venda", "Pagamentos — gestão financeira"] },
            { group: "Sistema", items: ["Utilizadores — gestão de contas (admin)", "Chat IA — assistente inteligente + logística", "Importar CSV — carga de dados em massa", "Mensagens — comunicação interna"] },
          ].map(({ group, items }) => (
            <div key={group} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{group}</p>
              <ul className="space-y-1">
                {items.map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <Warning>
          Algumas páginas são visíveis apenas consoante o perfil atribuído. Páginas não visíveis indicam ausência de permissão.
        </Warning>
      </Section>

      <Section id="perfil" title="Perfis e Permissões">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Cada utilizador tem um <strong>perfil global</strong> (<code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-xs">admin</code> ou <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-xs">utilizador</code>) e pode ter <strong>permissões por estudo</strong> (coordenador, analista, validador ou cliente). As permissões são configuradas pelo administrador.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { role: "admin", desc: "Acesso total ao sistema", color: "bg-purple-50 border-purple-200 text-purple-700" },
            { role: "coordenador", desc: "Gere estudos e equipas", color: "bg-blue-50 border-blue-200 text-blue-700" },
            { role: "analista", desc: "Executa visitas de campo", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
            { role: "validador", desc: "Valida visitas inseridas", color: "bg-orange-50 border-orange-200 text-orange-700" },
            { role: "cliente", desc: "Consulta resultados", color: "bg-teal-50 border-teal-200 text-teal-700" },
          ].map(({ role, desc, color }) => (
            <div key={role} className={`border rounded-xl p-3 ${color}`}>
              <p className="font-bold text-sm font-mono">{role}</p>
              <p className="text-xs opacity-80 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="logout" title="Terminar sessão">
        <p className="text-slate-600 text-sm leading-relaxed mb-3">
          Para terminar sessão, clicar no botão <strong>Sair</strong> no rodapé da barra de navegação lateral. A sessão será encerrada e o utilizador será redirecionado para a página de login.
        </p>
        <Warning>
          Por segurança, fechar sempre o browser ao utilizar a plataforma num dispositivo partilhado.
        </Warning>
      </Section>

      <Section id="novidades-4" title="Novidades — Wave 4 (Actual)">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Wave 4 introduz suporte completo a múltiplas grelhas de avaliação por estudo:
        </p>
        <div className="space-y-2">
          {[
            { label: "Multi-Grelha de Avaliação", desc: "Cada estudo pode ter N grelhas, uma por tipo de visita (presencial, drive-through, telefónica, auditoria, digital). Cada grelha tem secções temáticas com critérios ponderados." },
            { label: "Secções e Critérios", desc: "As grelhas são organizadas em secções temáticas (ex: 'Atendimento', 'Produto', 'Ambiente') com peso percentual. Cada secção tem critérios boolean, escala 1-5 ou texto livre." },
            { label: "Associação automática de grelha", desc: "Ao criar uma visita, a grelha correcta para o tipo de visita é associada automaticamente — sem configuração manual." },
            { label: "Relatório consolidado", desc: "Scores normalizados para 0–100% em todos os tipos de visita permitem comparação justa entre canais no dashboard do estudo." },
            { label: "API REST completa", desc: "GET/POST/PUT/DELETE /estudos/{id}/grelhas — criação da árvore completa (grelha + secções + critérios) num único pedido." },
            { label: "Painel de estudo actualizado", desc: "O detalhe do estudo mostra todas as grelhas com secções e contagem de critérios por secção." },
          ].map(({ label, desc }) => (
            <div key={label} className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="w-2 h-2 mt-1.5 rounded-full bg-indigo-400 shrink-0" />
              <div>
                <p className="font-semibold text-slate-900 text-sm mb-0.5">{label}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="novidades-5" title="Novidades — Sprint 4 (anterior)">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Sprint focado em segurança, IA visual e relatórios avançados:
        </p>
        <div className="space-y-2">
          {[
            { label: "Encriptação PII (Fernet)", desc: "Email, telefone, NIF, IBAN, morada e data de nascimento dos analistas são agora encriptados em repouso com AES-128-CBC + HMAC-SHA256. Dados legacy continuam compatíveis." },
            { label: "Cognira Módulo 3 — Fotos IA (GPT-4o Vision)", desc: "Análise automática de fotos de visitas por inteligência artificial. O sistema valida se a foto corresponde ao estabelecimento, detecta anomalias visuais e emite um veredicto (aprovada/rejeitada/inconclusiva) com nível de confiança." },
            { label: "Relatório de Pagamentos Avançado", desc: "Novo endpoint de relatório por analista/período com filtros por estudo e intervalo de datas. Detalhe por visita disponível em /api/pagamentos/relatorio/detalhe." },
            { label: "AI Chat com Function Calling", desc: "Chat IA reescrito com OpenAI Tools API — respostas conversacionais em PT-PT, sem SQL visível, confirmação obrigatória antes de qualquer escrita." },
            { label: "Chilling Periods & Blacklist com UI", desc: "Modal de restrições por analista na página /analistas com formulários inline para adicionar/remover períodos e proibições." },
            { label: "Permissões por Estudo com UI", desc: "Gestão visual de permissões por estudo na página /utilizadores." },
            { label: "Testes Automatizados", desc: "Suite pytest com 39 testes: PII encryption, MIME detection, state machine, autenticação. Executável com python -m pytest tests/." },
          ].map(({ label, desc }) => (
            <div key={label} className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-400 shrink-0" />
              <div>
                <p className="font-semibold text-slate-900 text-sm mb-0.5">{label}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="novidades-3" title="Novidades — Sprint 3">
        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          Funcionalidades de IA avançada e comunicação:
        </p>
        <div className="space-y-2">
          {[
            { label: "Chat de Logística", desc: "Reatribui visitas entre analistas por linguagem natural directamente no Chat IA (admin/coordenador)" },
            { label: "Mensagens Internas", desc: "Sistema de mensagens substitui SMS e telefone para comunicação com analistas" },
            { label: "Detecção de Anomalias", desc: "O Cognira IA analisa padrões dos analistas e detecta comportamentos fora do normal" },
            { label: "Validação com Cognira IA", desc: "Botão 'Validar com Cognira IA' no modal de visita — parecer imediato verde/amarelo/vermelho" },
            { label: "Dashboard por Perfil", desc: "Dashboard adaptado ao perfil do utilizador (admin, coordenador, analista, validador, cliente)" },
            { label: "Migração de Base de Dados", desc: "Nova tabela mensagens_sistema, migrações Alembic automáticas" },
          ].map(({ label, desc }) => (
            <div key={label} className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="w-2 h-2 mt-1.5 rounded-full bg-green-400 shrink-0" />
              <div>
                <p className="font-semibold text-slate-900 text-sm mb-0.5">{label}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <p className="font-bold text-slate-900 text-sm mb-3">Continua a aprender</p>
        <div className="grid gap-2">
          {[
            { href: "/docs/admin", label: "Guia do Administrador" },
            { href: "/docs/coordenador", label: "Guia do Coordenador" },
            { href: "/docs/analista", label: "Guia do Analista" },
            { href: "/docs/validador", label: "Guia do Validador" },
            { href: "/docs/cliente", label: "Guia do Cliente" },
          ].map(({ href, label }) => (
            <Link key={href} href={href} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-500 transition">
              <ChevronRight className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
