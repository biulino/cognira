"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import {
  BookOpen, ShieldCheck, Users, ClipboardList, Eye, Building2,
  Rocket, Menu, X, ExternalLink, ChevronRight, Sparkles, Search,
  LayoutGrid,
} from "lucide-react";

// ── Static search index ──────────────────────────────────────────────────────
interface SearchItem { label: string; href: string; category: string; }

const SEARCH_INDEX: SearchItem[] = [
  { label: "Visão Geral", href: "/docs", category: "Geral" },
  { label: "Todas as Funcionalidades", href: "/docs/funcionalidades", category: "Geral" },
  { label: "Cognira Intelligence™ — Todos os Módulos IA", href: "/docs/ia", category: "IA" },
  { label: "MFA / TOTP — Autenticação 2 Factores", href: "/docs/primeiros-passos", category: "Geral" },
  // Admin
  { label: "Administrador — Utilizadores e Roles", href: "/docs/admin#utilizadores", category: "Admin" },
  { label: "Administrador — Estudos e Ondas", href: "/docs/admin#estudos", category: "Admin" },
  { label: "Administrador — Pagamentos", href: "/docs/admin#pagamentos", category: "Admin" },
  { label: "Administrador — SSO / OIDC enterprise", href: "/docs/admin#sso", category: "Admin" },
  { label: "Administrador — Ingest CSV", href: "/docs/admin#ingest", category: "Admin" },
  { label: "Administrador — Configurações", href: "/docs/admin#configuracoes", category: "Admin" },
  // Coordenador
  { label: "Coordenador — Planeamento IA de Visitas", href: "/docs/coordenador#planeamento", category: "Coordenador" },
  { label: "Coordenador — Chilling Periods & Blacklist", href: "/docs/coordenador#chilling", category: "Coordenador" },
  { label: "Coordenador — Benchmarking cross-cliente", href: "/docs/coordenador#benchmarking", category: "Coordenador" },
  { label: "Coordenador — Detecção de Fraude", href: "/docs/coordenador#fraude", category: "Coordenador" },
  // Analista
  { label: "Analista — Inserir Visita", href: "/docs/analista#visita", category: "Analista" },
  { label: "Analista — Fotos e Câmara Nativa", href: "/docs/analista#fotos", category: "Analista" },
  { label: "Analista — Questionários Dinâmicos", href: "/docs/analista#questionarios", category: "Analista" },
  { label: "Analista — Formações e Certificações", href: "/docs/analista#formacoes", category: "Analista" },
  // Validador
  { label: "Validador — Fila de Validação", href: "/docs/validador#validacao", category: "Validador" },
  { label: "Validador — Validação Assistida por IA", href: "/docs/validador#ia", category: "Validador" },
  // Cliente
  { label: "Cliente — Dashboard e Métricas", href: "/docs/cliente#dashboard", category: "Cliente" },
  { label: "Cliente — Chat IA de Resultados", href: "/docs/cliente#chat", category: "Cliente" },
  // IA Modules
  { label: "Módulo 1 — Relatório Narrativo (GPT-4.1)", href: "/docs/ia#modulo-1", category: "IA" },
  { label: "Módulo 3 — Análise de Fotos (GPT-4o Vision)", href: "/docs/ia#modulo-3", category: "IA" },
  { label: "Módulo 4 — Planeamento Automático de Visitas", href: "/docs/ia#modulo-4", category: "IA" },
  { label: "Módulo 5 — Insights Semanais", href: "/docs/ia#modulo-5", category: "IA" },
  { label: "Módulo 6 — Chat de Logística", href: "/docs/ia#modulo-6", category: "IA" },
  { label: "Módulo 7 — Chat Semântico text-to-SQL", href: "/docs/ia#modulo-7", category: "IA" },
  { label: "Módulo 8 — Score Preditivo de Analistas", href: "/docs/ia#modulo-8", category: "IA" },
  { label: "Anomalias — Detecção de Desvios (±2σ)", href: "/docs/ia#anomalias", category: "IA" },
  { label: "Validação Assistida por IA", href: "/docs/ia#validacao-ia", category: "IA" },
  { label: "Call Center IA — Cognira Voice Engine + STT", href: "/docs/ia#callcenter", category: "IA" },
  // Funcionalidades
  { label: "Estudos, Ondas e Campos Configuráveis", href: "/docs/funcionalidades#estudos", category: "Funcionalidades" },
  { label: "Visitas de CX Intelligence", href: "/docs/funcionalidades#visitas", category: "Funcionalidades" },
  { label: "Exportação Excel e PDF Narrativo", href: "/docs/funcionalidades#relatorios", category: "Funcionalidades" },
  { label: "Encriptação PII (Fernet AES-128)", href: "/docs/funcionalidades#pii", category: "Segurança" },
  { label: "SSO / OIDC (Authentik, Keycloak, Azure AD)", href: "/docs/funcionalidades#sso", category: "Segurança" },
  { label: "PWA Offline & Câmara Nativa", href: "/docs/funcionalidades#pwa", category: "Funcionalidades" },
  { label: "Detecção de Fraude em Visitas", href: "/docs/funcionalidades#fraude", category: "Funcionalidades" },
  { label: "Benchmarking cross-cliente", href: "/docs/funcionalidades#benchmarking", category: "Funcionalidades" },
  { label: "Questionários Dinâmicos no Campo", href: "/docs/funcionalidades#questionarios", category: "Funcionalidades" },
  { label: "Mensagens Internas", href: "/docs/funcionalidades#mensagens", category: "Funcionalidades" },
  { label: "Formações e Certificações de Analistas", href: "/docs/funcionalidades#formacoes", category: "Funcionalidades" },
  { label: "Testes Automáticos pytest", href: "/docs/funcionalidades#testes", category: "Funcionalidades" },
  // Wave 3
  { label: "Rascunhos Offline Persistentes (useOfflineDraft)", href: "/docs/funcionalidades#offline-drafts", category: "PWA" },
  { label: "Internacionalização i18n PT/EN/ES/FR (useI18n)", href: "/docs/funcionalidades#i18n", category: "Funcionalidades" },
  { label: "Scanner de Código de Barras (BarcodeDetector API)", href: "/docs/funcionalidades#barcode", category: "Funcionalidades" },
  { label: "Service Worker v5 — visits-drafts IndexedDB store", href: "/docs/funcionalidades#offline-drafts", category: "PWA" },
  // Wave 4
  { label: "Multi-Grelha de Avaliação (Wave 4)", href: "/docs/funcionalidades#multi-grid", category: "Funcionalidades" },
  { label: "Grelhas de Avaliação por Tipo de Visita", href: "/docs/coordenador#grelhas", category: "Coordenador" },
  { label: "Secções e Critérios Ponderados por Grelha", href: "/docs/coordenador#grelhas", category: "Coordenador" },
  { label: "Multi-Grelha — API Grelhas", href: "/docs/admin#grelhas", category: "Admin" },
];

const ROLES = [
  { slug: "primeiros-passos", label: "Primeiros Passos", icon: Rocket },
  { slug: "admin", label: "Administrador", icon: ShieldCheck },
  { slug: "coordenador", label: "Coordenador", icon: Users },
  { slug: "analista", label: "Analista de Campo", icon: ClipboardList },
  { slug: "validador", label: "Validador", icon: Eye },
  { slug: "cliente", label: "Cliente", icon: Building2 },
];

interface Permissao { estudo_id: number; role: string; }
interface Me { role_global: string; permissoes: Permissao[]; }

function getVisibleSlugs(me: Me | null): string[] {
  if (!me) return ["primeiros-passos"];
  if (me.role_global === "admin")
    return ["primeiros-passos", "admin", "coordenador", "analista", "validador", "cliente"];
  const slugs = new Set<string>(["primeiros-passos"]);
  if (["coordenador", "analista", "validador"].includes(me.role_global)) slugs.add(me.role_global);
  for (const p of me.permissoes) {
    if (["coordenador", "analista", "validador", "cliente"].includes(p.role)) slugs.add(p.role);
  }
  return Array.from(slugs);
}

function NavItem({
  href, active, icon: Icon, label, onClose,
}: { href: string; active: boolean; icon: React.ElementType; label: string; onClose?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
        active
          ? "bg-[#2D6BEE] text-white shadow-sm"
          : "text-slate-600 hover:bg-[#2D6BEE]/10 hover:text-[#2D6BEE]"
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {active && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
    </Link>
  );
}

function SidebarContent({ onClose, visibleSlugs }: { onClose?: () => void; visibleSlugs: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchItem[]>([]);
  const [showSug, setShowSug] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (q.length < 2) { setSuggestions([]); setShowSug(false); return; }
    const filtered = SEARCH_INDEX.filter(({ label, category }) => {
      const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      return norm(label).includes(q) || norm(category).includes(q);
    }).slice(0, 8);
    setSuggestions(filtered);
    setShowSug(filtered.length > 0);
  }, [query]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSug(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function goTo(href: string) {
    setQuery(""); setShowSug(false); onClose?.(); router.push(href);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-5 border-b border-slate-200">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2D6BEE] to-[#1A52CC] flex items-center justify-center shadow-sm">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm leading-tight">Cognira Docs</p>
            <p className="text-[10px] text-slate-400">Documentação da Plataforma</p>
          </div>
        </div>
        <Link
          href="/dashboard"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-xs bg-[#2D6BEE] hover:bg-[#1A52CC] text-white px-3 py-1.5 rounded-lg font-medium transition"
        >
          <ExternalLink className="w-3 h-3" />
          Ir para a aplicação
        </Link>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-slate-100" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={t("docs.searchPlaceholder")}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSug(true)}
            className="w-full pl-8 pr-7 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30 focus:border-[#2D6BEE]/60 transition"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setShowSug(false); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          {/* Suggestions dropdown */}
          {showSug && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
              {suggestions.map((item, i) => (
                <button
                  key={i}
                  onClick={() => goTo(item.href)}
                  className="w-full text-left px-3 py-2.5 hover:bg-[#2D6BEE]/5 transition-colors border-b border-slate-50 last:border-0"
                >
                  <p className="text-xs font-medium text-slate-800 truncate leading-snug">{item.label}</p>
                  <p className="text-[10px] text-[#2D6BEE] font-semibold mt-0.5">{item.category}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 pt-1 pb-2">
          Conteúdo
        </p>
        <NavItem href="/docs" active={pathname === "/docs"} icon={BookOpen} label="Visão Geral" onClose={onClose} />
        <NavItem href="/docs/funcionalidades" active={pathname === "/docs/funcionalidades"} icon={LayoutGrid} label="Funcionalidades" onClose={onClose} />

        <div className="pt-3 pb-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 pb-2">
            Cognira Intelligence™
          </p>
        </div>
        <NavItem href="/docs/ia" active={pathname.startsWith("/docs/ia")} icon={Sparkles} label="Módulos IA" onClose={onClose} />

        <div className="pt-3 pb-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 pb-2">
            Guia por Perfil
          </p>
        </div>
        {ROLES.filter(r => visibleSlugs.includes(r.slug)).map(({ slug, label, icon: Icon }) => (
          <NavItem
            key={slug}
            href={`/docs/${slug}`}
            active={pathname === `/docs/${slug}`}
            icon={Icon}
            label={label}
            onClose={onClose}
          />
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-slate-100">
        <p className="text-[10px] text-slate-400 text-center">
          Cognira CX Intelligence · v3.0 · Wave 3
        </p>
      </div>
    </div>
  );
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [visibleSlugs, setVisibleSlugs] = useState<string[]>(["primeiros-passos"]);
  const [meLoaded, setMeLoaded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then((me: Me | null) => { setVisibleSlugs(getVisibleSlugs(me)); setMeLoaded(true); })
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    if (!meLoaded) return;
    const m = pathname.match(/^\/docs\/(admin|coordenador|analista|validador|cliente)$/);
    if (m && !visibleSlugs.includes(m[1])) router.replace("/docs");
  }, [pathname, visibleSlugs, meLoaded, router]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 z-40 shadow-sm">
        <SidebarContent visibleSlugs={visibleSlugs} />
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2D6BEE] to-[#1A52CC] flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-sm text-slate-900">Cognira Docs</span>
        </div>
        <button
          onClick={() => setMobileOpen(v => !v)}
          className="p-2 rounded-xl hover:bg-slate-100 transition"
        >
          {mobileOpen ? <X className="w-5 h-5 text-slate-600" /> : <Menu className="w-5 h-5 text-slate-600" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 pt-14">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 h-full bg-white border-r border-slate-200 flex flex-col shadow-xl">
            <SidebarContent onClose={() => setMobileOpen(false)} visibleSlugs={visibleSlugs} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="lg:ml-64 pt-16 lg:pt-0">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 py-10 lg:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
