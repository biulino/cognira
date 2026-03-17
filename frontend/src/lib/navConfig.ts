import type { ElementType } from "react";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Users,
  MessageSquare,
  Upload,
  Building2,
  CreditCard,
  ShieldCheck,
  FileText,
  Phone,
  Briefcase,
  BarChart3,
  Settings2,
  Inbox,
  GraduationCap,
  ShieldAlert,
  ClipboardCheck,
  Map,
  Clock,
  Search,
  Bell,
  Webhook,
  QrCode,
  ScanLine,
  PackageSearch,
  MessagesSquare,
  Layers,
  Wand2,
  LayoutGrid,
  Palette,
} from "lucide-react";
import { isModuloActivo } from "@/lib/modulos";

export type NavItem = { href: string; label: string; icon: ElementType };
export type NavGroup = { label: string; items: NavItem[] };

export const ALL_ITEMS = {
  dashboard:        { href: "/dashboard",            label: "Dashboard",                  icon: LayoutDashboard },
  estudos:          { href: "/estudos",              label: "Estudos",                    icon: BookOpen },
  visitas:          { href: "/visitas",              label: "Visitas",                    icon: ClipboardList },
  analistas:        { href: "/analistas",            label: "Analistas",                  icon: Users },
  clientes:         { href: "/clientes",             label: "Clientes",                   icon: Briefcase },
  estabelecimentos: { href: "/estabelecimentos",     label: "Estabelecimentos",           icon: Building2 },
  pagamentos:       { href: "/pagamentos",           label: "Pagamentos",                 icon: CreditCard },
  relatorios:       { href: "/relatorios",           label: "Relatórios",                 icon: BarChart3 },
  utilizadores:     { href: "/utilizadores",         label: "Utilizadores",               icon: ShieldCheck },
  chat:             { href: "/chat",                 label: "Chat IA",                    icon: MessageSquare },
  mensagens:        { href: "/mensagens",            label: "Mensagens",                  icon: Inbox },
  ingest:           { href: "/ingest",               label: "Importar CSV",               icon: Upload },
  callcenter:       { href: "/callcenter",           label: "Call Center",                icon: Phone },
  docs:             { href: "/docs",                 label: "Documentação",               icon: FileText },
  formacoes:        { href: "/formacoes",            label: "Formações",                  icon: GraduationCap },
  configuracoes:    { href: "/configuracoes",        label: "Configurações",              icon: Settings2 },
  branding:         { href: "/configuracoes/branding", label: "White-Label",             icon: Palette },
  fraude:           { href: "/fraude",               label: "Deteção de Fraude",          icon: ShieldAlert },
  benchmarking:     { href: "/benchmarking",         label: "Benchmarking",               icon: BarChart3 },
  questionarios:    { href: "/questionarios",        label: "Questionários",              icon: ClipboardCheck },
  mapa:             { href: "/mapa",                 label: "Mapa",                       icon: Map },
  portal:           { href: "/portal",               label: "Portal Cliente",             icon: LayoutDashboard },
  "portal-mapa":    { href: "/portal/mapa",          label: "Mapa Resultados",            icon: Map },
  sla:              { href: "/sla",                  label: "Monitor SLA",                icon: Clock },
  pesquisa:         { href: "/pesquisa",             label: "Pesquisa RAG",               icon: Search },
  alertas:          { href: "/alertas",              label: "Alertas de Score",           icon: Bell },
  webhooks:         { href: "/webhooks",             label: "API & Webhooks",             icon: Webhook },
  qrcodes:          { href: "/qrcodes",              label: "Questionários QR",           icon: QrCode },
  audit:            { href: "/audit",                label: "Registo de Auditoria",       icon: ShieldAlert },
  barcode:          { href: "/barcode",              label: "Scanner de Código",          icon: ScanLine },
  "shelf-audit":    { href: "/shelf-audit",          label: "Auditoria de Prateleira",    icon: PackageSearch },
  "chat-interno":   { href: "/chat-interno",         label: "Chat Interno",               icon: MessagesSquare },
  planos:           { href: "/planos",               label: "Suites & Módulos",           icon: Layers },
  wizard:           { href: "/wizard",               label: "Assistente de Estudo",       icon: Wand2 },
  planograma:       { href: "/planograma",           label: "Conformidade Planograma",    icon: LayoutGrid },
} as const;

export const ITEM_KEYS = Object.keys(ALL_ITEMS) as (keyof typeof ALL_ITEMS)[];

export const HREF_TO_NAV_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(ALL_ITEMS).map(([k, { href }]) => [href, k])
);

export const DEFAULT_NAV: Record<string, string[]> = {
  superadmin:  Object.keys(ALL_ITEMS),
  admin:       ["dashboard","estudos","visitas","analistas","clientes","estabelecimentos","pagamentos","relatorios","fraude","benchmarking","utilizadores","mensagens","chat","chat-interno","questionarios","formacoes","ingest","callcenter","configuracoes","branding","mapa","sla","pesquisa","alertas","qrcodes","webhooks","audit","barcode","shelf-audit","planos","wizard","planograma"],
  coordenador: ["dashboard","estudos","visitas","analistas","clientes","estabelecimentos","pagamentos","relatorios","fraude","benchmarking","mensagens","chat","chat-interno","questionarios","formacoes","ingest","callcenter","mapa","sla","pesquisa","alertas","qrcodes","barcode","shelf-audit","wizard","planograma"],
  validador:   ["dashboard","estudos","visitas","mensagens","chat","chat-interno","callcenter","mapa","pesquisa"],
  analista:    ["dashboard","visitas","mensagens","chat-interno","mapa","barcode","shelf-audit"],
  cliente:     ["portal","portal-mapa","chat","benchmarking","relatorios","mensagens"],
};

export const KEY_GROUP: Record<string, string> = {
  // Principal — the daily core
  dashboard: "Principal", estudos: "Principal", visitas: "Principal",
  mapa: "Principal",
  portal: "Principal", "portal-mapa": "Principal",

  // Operações — people & places management
  analistas: "Operações", clientes: "Operações", estabelecimentos: "Operações",
  pagamentos: "Operações", formacoes: "Operações", callcenter: "Operações",
  wizard: "Operações",

  // Análise — intelligence & reporting
  relatorios: "Análise", benchmarking: "Análise", alertas: "Análise",
  fraude: "Análise", sla: "Análise", pesquisa: "Análise",

  // Distribuição — survey & data collection channels
  questionarios: "Distribuição", qrcodes: "Distribuição", ingest: "Distribuição",
  barcode: "Distribuição", "shelf-audit": "Distribuição", planograma: "Distribuição",

  // Comunicação — messaging
  mensagens: "Comunicação", chat: "Comunicação", "chat-interno": "Comunicação",

  // Enterprise — admin & governance
  utilizadores: "Enterprise", webhooks: "Enterprise", audit: "Enterprise",
  configuracoes: "Enterprise", planos: "Enterprise", branding: "Enterprise",
};

export const GROUP_ORDER = ["Principal", "Operações", "Análise", "Distribuição", "Comunicação", "Enterprise", "Ajuda"];

/** Returns true for pages that render without the authenticated shell. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/" ||
    pathname === "/intro" ||
    pathname === "/landing" ||
    pathname.startsWith("/docs") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/super-admin") ||
    pathname.startsWith("/tenant-admin")
  );
}

export function navGroupsForRole(
  role: string,
  activeModulos: Set<string> | null,
  navConfig?: Record<string, string[]> | null,
): NavGroup[] {
  const i = ALL_ITEMS;
  const allowed: string[] = (navConfig?.[role] ?? DEFAULT_NAV[role]) ?? ["dashboard"];

  const groups: Record<string, NavItem[]> = {};
  ITEM_KEYS.forEach(key => {
    if (!allowed.includes(key)) return;
    if (!isModuloActivo(key, activeModulos)) return;
    const group = KEY_GROUP[key] ?? "Ferramentas";
    (groups[group] ||= []).push(i[key]);
  });
  groups["Ajuda"] = [i.docs];

  return GROUP_ORDER
    .filter(g => (groups[g]?.length ?? 0) > 0)
    .map(g => ({ label: g, items: groups[g] }));
}
