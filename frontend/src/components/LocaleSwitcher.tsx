"use client";

import { useI18n, LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";

export default function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Change language / Idioma / Langue"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                   text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800
                   transition-all border border-slate-200 dark:border-slate-700"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{LOCALE_LABELS[locale]}</span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute bottom-full mb-1 right-0 z-50 bg-white dark:bg-slate-900
                     border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg
                     overflow-hidden min-w-[7rem]"
        >
          {LOCALES.map(l => (
            <li key={l} role="option" aria-selected={l === locale}>
              <button
                onClick={() => { setLocale(l as Locale); setOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors
                  ${l === locale
                    ? "bg-[#2D6BEE] text-white font-semibold"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
              >
                {LOCALE_LABELS[l as Locale]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
