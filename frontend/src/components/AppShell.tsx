"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Menu, X, Search } from "lucide-react";
import ChatBubble from "@/components/ChatBubble";
import OnboardingWizard from "@/components/OnboardingWizard";
import UserMenu from "@/components/UserMenu";
import { useI18n } from "@/lib/i18n";
import { useBranding } from "@/lib/branding";
import { useModulos } from "@/lib/modulos";
import wsClient from "@/lib/ws";
import { useAppContext } from "@/hooks/useAppContext";
import {
  HREF_TO_NAV_KEY,
  isPublicPath,
  navGroupsForRole,
} from "@/lib/navConfig";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { app_name, logo_url } = useBranding();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navSearch, setNavSearch] = useState("");
  const activeModulos = useModulos();
  const { role, isSuperAdmin, isAdmin, unreadMsgs, navPermissoes, username, userEmail } = useAppContext();

  // Superadmins always see the full nav — bypass tenant navPermissoes and module filters
  const navGroups = navGroupsForRole(
    isSuperAdmin ? "superadmin" : role,
    isSuperAdmin ? null : activeModulos,
    isSuperAdmin ? null : navPermissoes,
  );

  const noNav =
    isPublicPath(pathname);
  if (noNav) return <>{children}</>;

  const logout = () => {
    wsClient.disconnect();
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    router.push("/login");
  };

  const SidebarContent = () => (
    <>
      <div className="px-5 py-5 border-b border-slate-200/60 dark:border-slate-700/60">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo_url ?? "/logo.png"} alt={app_name} className="h-8 w-auto" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white text-sm leading-tight">
              {app_name}
            </p>
            <p className="text-[10px] text-slate-400 mt-0">CX Intelligence</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {/* Nav search */}
        <div className="relative px-0.5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            value={navSearch}
            onChange={e => setNavSearch(e.target.value)}
            placeholder={t("nav.searchPlaceholder")}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30 focus:border-[#2D6BEE]"
          />
        </div>
        {(() => {
          // Compute the most-specific nav href that matches the current pathname
          // so that e.g. /portal/mapa doesn't also light up /portal
          const allNavHrefs = navGroups.flatMap(g => g.items.map(i => i.href));
          const bestMatchHref = allNavHrefs
            .filter(h => pathname === h || pathname.startsWith(h + "/"))
            .sort((a, b) => b.length - a.length)[0] ?? pathname;
          return navGroups.map(({ label, items }) => {
          const filteredItems = navSearch
            ? items.filter(i => {
                const nk = HREF_TO_NAV_KEY[i.href];
                const lbl = nk ? (t(`nav.${nk}`) || i.label) : i.label;
                return lbl.toLowerCase().includes(navSearch.toLowerCase());
              })
            : items;
          if (filteredItems.length === 0) return null;
          return (
          <div key={label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-600">
              {t(`nav.groups.${label}`, {}) || label}
            </p>
            <div className="space-y-0.5">
              {filteredItems.map(({ href, label: itemLabel, icon: Icon }) => {
                const navKey = HREF_TO_NAV_KEY[href];
                const displayLabel = navKey ? (t(`nav.${navKey}`) || itemLabel) : itemLabel;
                const active = href === bestMatchHref;
                const badge = href === "/mensagens" && unreadMsgs > 0 ? unreadMsgs : 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? "bg-[#2D6BEE] text-white shadow-sm shadow-orange-200/60"
                        : "text-slate-600 hover:bg-[#F0F5FF] hover:text-[#1A52CC] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{displayLabel}</span>
                    {badge > 0 && (
                      <span className={`text-xs rounded-full px-1.5 py-0.5 leading-none font-semibold ${
                        active ? "bg-white/30 text-white" : "bg-[#2D6BEE] text-white"
                      }`}>
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
          );
        }); })()}
      </nav>

      <UserMenu
        username={username}
        email={userEmail}
        isSuperAdmin={isSuperAdmin}
        isAdmin={isAdmin}
        onLogout={logout}
      />
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col shadow-sm">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 px-4 h-14 shadow-sm">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition"
          aria-label={t("nav.openMenu")}
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo_url ?? "/logo.png"} alt={app_name} className="h-6 w-auto" />
          <span className="font-semibold text-sm text-slate-900 dark:text-white">{app_name}</span>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-900 flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-white">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-auto md:pt-0 pt-14">{children}</main>
      <ChatBubble />
      <OnboardingWizard role={role} />
    </div>
  );
}

