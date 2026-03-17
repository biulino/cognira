"use client";

import { useState } from "react";
import { ScanLine, ExternalLink, Plus } from "lucide-react";
import BarcodeScanner, { type BarcodeResult } from "@/components/BarcodeScanner";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";

interface ProductInfo {
  code: string;
  name?: string;
  brand?: string;
  description?: string;
  found: boolean;
}

export default function BarcodePage() {
  const { t } = useI18n();
  const [lookups, setLookups] = useState<ProductInfo[]>([]);
  const [loadingCode, setLoadingCode] = useState<string | null>(null);

  const handleDetect = async (result: BarcodeResult) => {
    // Skip if already looked up
    if (lookups.find(l => l.code === result.rawValue)) return;

    setLoadingCode(result.rawValue);
    try {
      const data = await api.get<ProductInfo>(`/visitas/barcode?code=${encodeURIComponent(result.rawValue)}`);
      setLookups(prev => [{ ...data, code: result.rawValue }, ...prev]);
    } catch {
      // Not found or no endpoint — still record the scan
      setLookups(prev => [{ code: result.rawValue, found: false }, ...prev]);
    } finally {
      setLoadingCode(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#2D6BEE] to-[#1A52CC] flex items-center justify-center shadow-sm">
              <ScanLine className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {t("barcode.title")}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("barcode.subtitle")}
              </p>
            </div>
          </div>
        </div>

        {/* Scanner */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm mb-6">
          <BarcodeScanner
            onDetect={handleDetect}
            showHistory={false}
          />
        </div>

        {/* Results / Lookup list */}
        {lookups.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                {t("barcode.detected")}
              </h2>
              <button
                onClick={() => setLookups([])}
                className="text-xs text-slate-400 hover:text-red-500 transition"
              >
                {t("barcode.clearHistory")}
              </button>
            </div>

            {lookups.map((item, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">
                      {item.code}
                    </p>
                    {loadingCode === item.code && (
                      <p className="text-xs text-slate-400 mt-1">{t("common.loading")}</p>
                    )}
                    {item.found && item.name && (
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1">
                        {item.name}
                      </p>
                    )}
                    {item.found && item.brand && (
                      <p className="text-xs text-slate-500 mt-0.5">{item.brand}</p>
                    )}
                    {item.found && item.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>
                    )}
                    {!item.found && loadingCode !== item.code && (
                      <p className="text-xs text-slate-400 mt-1 italic">
                        Produto não encontrado na base de dados local
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={`/visitas?barcode=${encodeURIComponent(item.code)}`}
                      title={t("barcode.addToVisit")}
                      className="p-2 rounded-lg bg-[#2D6BEE]/10 text-[#2D6BEE] hover:bg-[#2D6BEE]/20 transition"
                    >
                      <Plus className="w-4 h-4" />
                    </a>
                    <a
                      href={`https://www.barcodelookup.com/${encodeURIComponent(item.code)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t("barcode.searchExternal")}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
