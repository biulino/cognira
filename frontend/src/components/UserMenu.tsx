"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { LogOut, User, Globe, ChevronUp, Settings2 } from "lucide-react";
import { useI18n, LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";

interface UserMenuProps {
  username: string;
  email: string;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  onLogout: () => void;
}

function getInitials(username: string): string {
  const parts = username.split(/[_\s.@]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

function avatarBg(username: string): string {
  const palette = [
    "bg-orange-500", "bg-blue-500", "bg-green-500", "bg-purple-500",
    "bg-pink-500", "bg-teal-500", "bg-amber-500", "bg-indigo-500",
  ];
  let h = 0;
  for (const c of username) h = (h * 31 + c.charCodeAt(0)) % palette.length;
  return palette[h];
}

export default function UserMenu({ username, email, isSuperAdmin, isAdmin, onLogout }: UserMenuProps) {
  const { t, locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = username ? getInitials(username) : "?";
  const bg = username ? avatarBg(username) : "bg-slate-400";

  return (
    <div ref={ref} className="relative px-3 py-3 border-t border-slate-200/60 dark:border-slate-700/60">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <div className={`w-7 h-7 rounded-full ${bg} flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 ring-2 ring-white dark:ring-slate-900`}>
          {initials}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate leading-none">{username || "…"}</p>
          <p className="text-[10px] text-slate-400 truncate mt-0.5">{email || "…"}</p>
        </div>
        <ChevronUp className={`w-3 h-3 text-slate-400 flex-shrink-0 transition-transform duration-200 ${open ? "" : "rotate-180"}`} />
      </button>

      {/* Dropdown (opens upward) */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1.5 mx-px bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden z-50">
          {/* User header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{username}</p>
              <p className="text-[11px] text-slate-400 truncate">{email}</p>
            </div>
          </div>

          {/* Profile */}
          <div className="px-2 py-1.5">
            <Link
              href="/perfil"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <User className="w-4 h-4 text-slate-400" />
              <span>{t("usermenu.myProfile")}</span>
            </Link>
          </div>

          {/* Language */}
          <div className="px-4 pt-2 pb-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Globe className="w-3 h-3 text-slate-400" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{t("usermenu.language")}</p>
            </div>
            <div className="flex gap-1 flex-wrap">
              {LOCALES.map(l => (
                <button
                  key={l}
                  onClick={() => setLocale(l as Locale)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-medium transition-colors ${
                    l === locale
                      ? "bg-[#2D6BEE] text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {LOCALE_LABELS[l]}
                </button>
              ))}
            </div>
          </div>

          {/* Admin links */}
          {(isSuperAdmin || isAdmin) && (
            <div className="px-2 py-1 border-t border-slate-100 dark:border-slate-800">
              {isSuperAdmin && (
                <Link
                  href="/super-admin"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                >
                  <span className="w-4 h-4 flex items-center justify-center text-xs leading-none">⬡</span>
                  <span>{t("usermenu.platformPanel")}</span>
                </Link>
              )}
              {isAdmin && (
                <Link
                  href="/tenant-admin"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <Settings2 className="w-4 h-4" />
                  <span>{t("usermenu.adminPanel")}</span>
                </Link>
              )}
            </div>
          )}

          {/* Logout */}
          <div className="px-2 py-1.5 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>{t("nav.logout")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
