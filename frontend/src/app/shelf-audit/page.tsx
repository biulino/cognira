"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PackageSearch, Plus, Trash2, CheckCircle2, XCircle,
  ScanLine, ChevronDown, AlertTriangle, TrendingDown,
  Sparkles, Download, Loader2, ShieldCheck, ShieldAlert,
} from "lucide-react";
import BarcodeScanner, { type BarcodeResult } from "@/components/BarcodeScanner";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";

interface Visita {
  id: number;
  estabelecimento_nome?: string;
  estado: string;
  tipo_visita: string;
  inserida_em?: string;
}

interface ShelfItem {
  id?: number;
  visita_id: number;
  produto_nome: string;
  ean?: string;
  preco_esperado?: number;
  preco_real?: number;
  quantidade_esperada?: number;
  quantidade_real?: number;
  facings?: number;
  validade?: string;
  conforme: boolean;
  notas?: string;
  criado_em?: string;
}

interface Summary {
  total_itens: number;
  conformes: number;
  nao_conformes: number;
  compliance_rate: number | null;
  out_of_stock: number;
  desvios_preco: number;
}

interface IaAnalise {
  resumo?: string;
  itens_criticos?: string[];
  tendencias?: string;
  recomendacoes?: string[];
  risco?: string;
  dados?: {
    total_itens: number;
    compliance_rate_pct: number;
    out_of_stock: number;
  };
  erro?: string;
}

const emptyItem = (visita_id: number): ShelfItem => ({
  visita_id,
  produto_nome: "",
  ean: "",
  preco_esperado: undefined,
  preco_real: undefined,
  quantidade_esperada: undefined,
  quantidade_real: undefined,
  facings: undefined,
  validade: undefined,
  conforme: true,
  notas: "",
});

const riskColor = (risco?: string) => {
  if (!risco) return "text-slate-500 bg-slate-100 dark:bg-slate-800";
  const r = risco.toLowerCase();
  if (r.includes("alto")) return "text-red-700 bg-red-100 dark:bg-red-900/30";
  if (r.includes("médio") || r.includes("medio")) return "text-amber-700 bg-amber-100 dark:bg-amber-900/30";
  return "text-green-700 bg-green-100 dark:bg-green-900/30";
};

export default function ShelfAuditPage() {
  const { t } = useI18n();

  // Visit selection
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [selectedVisitaId, setSelectedVisitaId] = useState<number | null>(null);

  // Items
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  // AI analysis
  const [iaAnalise, setIaAnalise] = useState<IaAnalise | null>(null);
  const [iaLoading, setIaLoading] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);

  // Add-item form
  const [showForm, setShowForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [formData, setFormData] = useState<ShelfItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load recent visits
  useEffect(() => {
    api.get<{ items: Visita[] }>("/visitas?page_size=50")
      .then(data => setVisitas(data.items ?? []))
      .catch(() => {});
  }, []);

  const loadItems = useCallback(async (visitaId: number) => {
    setLoading(true);
    setIaAnalise(null);
    try {
      const [itemsData, summaryData] = await Promise.all([
        api.get<ShelfItem[]>(`/shelf-audit/${visitaId}`),
        api.get<Summary>(`/shelf-audit/${visitaId}/summary`),
      ]);
      setItems(itemsData);
      setSummary(summaryData);
    } catch (e) {
      setError((e as Error).message ?? "Erro ao carregar auditoria");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleVisitaChange = (id: number) => {
    setSelectedVisitaId(id);
    setItems([]);
    setSummary(null);
    setFormData(emptyItem(id));
    loadItems(id);
  };

  const handleIaAnalise = async () => {
    if (!selectedVisitaId) return;
    setIaLoading(true);
    setIaAnalise(null);
    try {
      const result = await api.post<IaAnalise>(`/shelf-audit/${selectedVisitaId}/analisar-ia`, {});
      setIaAnalise(result);
    } catch (e) {
      setIaAnalise({ erro: (e as Error).message ?? "Erro na análise IA" });
    } finally {
      setIaLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedVisitaId) return;
    setExporting(true);
    try {
      const response = await fetch(
        `/api/shelf-audit/export?visita_id=${selectedVisitaId}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` } }
      );
      if (!response.ok) throw new Error("Erro ao exportar");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shelf_audit_${selectedVisitaId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message ?? "Erro ao exportar");
    } finally {
      setExporting(false);
    }
  };

  // Barcode scan → prefill EAN and attempt lookup
  const handleBarcodeDetect = async (result: BarcodeResult) => {
    if (!formData) return;
    const ean = result.rawValue;
    setFormData(prev => prev ? { ...prev, ean } : prev);
    setShowScanner(false);

    try {
      const info = await api.get<{ found: boolean; name?: string; brand?: string }>(
        `/visitas/barcode?code=${encodeURIComponent(ean)}`
      );
      if (info.found && info.name) {
        setFormData(prev => prev ? { ...prev, ean, produto_nome: info.name ?? prev.produto_nome } : prev);
      }
    } catch { /* ignore lookup errors */ }
  };

  const handleSave = async () => {
    if (!formData || !formData.produto_nome.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await api.post<ShelfItem>("/shelf-audit/", {
        ...formData,
        preco_esperado: formData.preco_esperado ? Number(formData.preco_esperado) : null,
        preco_real: formData.preco_real ? Number(formData.preco_real) : null,
        quantidade_esperada: formData.quantidade_esperada ? Number(formData.quantidade_esperada) : null,
        quantidade_real: formData.quantidade_real ? Number(formData.quantidade_real) : null,
        facings: formData.facings ? Number(formData.facings) : null,
      });
      setItems(prev => [...prev, saved]);
      setFormData(emptyItem(formData.visita_id));
      setShowForm(false);
      // Refresh summary
      if (selectedVisitaId) {
        const s = await api.get<Summary>(`/shelf-audit/${selectedVisitaId}/summary`);
        setSummary(s);
      }
    } catch (e) {
      setError((e as Error).message ?? "Erro ao guardar item");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId: number) => {
    if (!confirm("Eliminar este item?")) return;
    await api.delete(`/shelf-audit/${itemId}`);
    setItems(prev => prev.filter(i => i.id !== itemId));
    if (selectedVisitaId) {
      const s = await api.get<Summary>(`/shelf-audit/${selectedVisitaId}/summary`);
      setSummary(s);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#2D6BEE] to-[#1A52CC] flex items-center justify-center shadow-sm">
            <PackageSearch className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {t("shelf.title")}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("shelf.subtitle")}
            </p>
          </div>
        </div>

        {/* Visit selector */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm mb-6">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {t("shelf.selectVisita")}
          </label>
          <div className="relative">
            <select
              value={selectedVisitaId ?? ""}
              onChange={e => e.target.value ? handleVisitaChange(Number(e.target.value)) : null}
              className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-[#2D6BEE]/40 focus:border-[#2D6BEE] outline-none"
            >
              <option value="">{t("shelf.chooseVisita")}</option>
              {visitas.map(v => (
                <option key={v.id} value={v.id}>
                  #{v.id} — {v.estado} — {v.tipo_visita}
                  {v.inserida_em ? ` — ${v.inserida_em.slice(0, 10)}` : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Summary cards */}
        {summary && summary.total_itens > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm text-center">
                <div className="text-2xl font-black text-slate-900 dark:text-white">{summary.total_itens}</div>
                <div className="text-xs text-slate-500 mt-0.5">{t("shelf.totalItens")}</div>
              </div>
              <div className={`rounded-2xl border p-4 shadow-sm text-center ${
                (summary.compliance_rate ?? 0) >= 80
                  ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                  : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
              }`}>
                <div className={`text-2xl font-black ${(summary.compliance_rate ?? 0) >= 80 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                  {summary.compliance_rate !== null ? `${summary.compliance_rate}%` : "—"}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{t("shelf.complianceRate")}</div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm text-center">
                <div className="text-2xl font-black text-amber-600">{summary.out_of_stock}</div>
                <div className="text-xs text-slate-500 mt-0.5">{t("shelf.outOfStock")}</div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm text-center">
                <div className="text-2xl font-black text-red-600">{summary.desvios_preco}</div>
                <div className="text-xs text-slate-500 mt-0.5">{t("shelf.priceDeviations")}</div>
              </div>
            </div>

            {/* AI + Export action bar */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={handleIaAnalise}
                disabled={iaLoading}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition shadow-sm"
              >
                {iaLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Sparkles className="w-4 h-4" />
                }
                {iaLoading ? "A analisar…" : "Análise IA"}
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition shadow-sm"
              >
                {exporting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Download className="w-4 h-4" />
                }
                {exporting ? "A exportar…" : "Exportar Excel"}
              </button>
            </div>
          </>
        )}

        {/* AI Analysis result */}
        {iaAnalise && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-violet-200 dark:border-violet-800 shadow-sm p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-violet-600" />
              <h2 className="font-bold text-slate-800 dark:text-slate-100">Análise IA</h2>
              {iaAnalise.risco && !iaAnalise.erro && (
                <span className={`ml-auto text-xs font-bold px-3 py-1 rounded-full ${riskColor(iaAnalise.risco)}`}>
                  Risco: {iaAnalise.risco}
                </span>
              )}
            </div>

            {iaAnalise.erro ? (
              <p className="text-sm text-red-500">{iaAnalise.erro}</p>
            ) : (
              <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
                {iaAnalise.resumo && (
                  <div>
                    <p className="font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide mb-1">Resumo</p>
                    <p>{iaAnalise.resumo}</p>
                  </div>
                )}
                {iaAnalise.itens_criticos && iaAnalise.itens_criticos.length > 0 && (
                  <div>
                    <p className="font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide mb-1 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-500" /> Itens Críticos
                    </p>
                    <ul className="space-y-0.5">
                      {iaAnalise.itens_criticos.map((item, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-red-400 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {iaAnalise.tendencias && (
                  <div>
                    <p className="font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide mb-1">Tendências</p>
                    <p>{iaAnalise.tendencias}</p>
                  </div>
                )}
                {iaAnalise.recomendacoes && iaAnalise.recomendacoes.length > 0 && (
                  <div>
                    <p className="font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide mb-1 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-green-500" /> Recomendações
                    </p>
                    <ol className="space-y-0.5 list-decimal list-inside">
                      {iaAnalise.recomendacoes.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Items list */}
        {selectedVisitaId && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t("shelf.items")}</h2>
              <button
                onClick={() => { setShowForm(true); setFormData(emptyItem(selectedVisitaId)); }}
                className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#2D6BEE] hover:bg-[#1A52CC] rounded-xl px-3 py-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                {t("shelf.addItem")}
              </button>
            </div>

            {loading ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">{t("common.loading")}</div>
            ) : items.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">{t("shelf.noItems")}</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map(item => (
                  <div key={item.id} className="flex items-start gap-4 px-5 py-4">
                    <div className="flex-shrink-0 mt-0.5">
                      {item.conforme
                        ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                        : <XCircle className="w-5 h-5 text-red-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                          {item.produto_nome}
                        </span>
                        {item.ean && (
                          <span className="font-mono text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                            {item.ean}
                          </span>
                        )}
                        {item.quantidade_real === 0 && (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {t("shelf.oos")}
                          </span>
                        )}
                        {item.preco_esperado && item.preco_real && Math.abs(item.preco_real - item.preco_esperado) > 0.01 && (
                          <span className="text-xs font-semibold text-red-700 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" /> {t("shelf.priceDeviation")}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                        {item.preco_real !== undefined && item.preco_real !== null && (
                          <span>💶 {Number(item.preco_real).toFixed(2)}€
                            {item.preco_esperado !== undefined && item.preco_esperado !== null
                              ? ` (esp. ${Number(item.preco_esperado).toFixed(2)}€)` : ""}
                          </span>
                        )}
                        {item.quantidade_real !== undefined && item.quantidade_real !== null && (
                          <span>📦 {item.quantidade_real} un.</span>
                        )}
                        {item.facings !== undefined && item.facings !== null && (
                          <span>🪟 {item.facings} facings</span>
                        )}
                        {item.validade && (
                          <span>📅 val. {String(item.validade).slice(0, 10)}</span>
                        )}
                      </div>
                      {item.notas && (
                        <p className="text-xs text-slate-400 mt-1 italic">{item.notas}</p>
                      )}
                    </div>
                    <button
                      onClick={() => item.id && handleDelete(item.id)}
                      className="flex-shrink-0 p-1.5 text-slate-300 hover:text-red-500 transition rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add item form */}
        {showForm && formData && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#2D6BEE]/30 shadow-lg p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t("shelf.newItem")}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 transition">✕</button>
            </div>

            {/* Barcode scan toggle */}
            <div className="mb-4">
              <button
                onClick={() => setShowScanner(s => !s)}
                className="flex items-center gap-2 text-sm font-semibold text-[#2D6BEE] hover:text-[#1A52CC] transition"
              >
                <ScanLine className="w-4 h-4" />
                {showScanner ? t("shelf.hideScanner") : t("shelf.scanBarcode")}
              </button>
              {showScanner && (
                <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                  <BarcodeScanner onDetect={handleBarcodeDetect} showHistory={false} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Product name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("shelf.produtoNome")} *</label>
                <input
                  value={formData.produto_nome}
                  onChange={e => setFormData({ ...formData, produto_nome: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D6BEE]/40 focus:border-[#2D6BEE]"
                  placeholder={t("shelfAudit.productName")}
                />
              </div>

              {/* EAN */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">EAN / Código</label>
                <input
                  value={formData.ean ?? ""}
                  onChange={e => setFormData({ ...formData, ean: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-[#2D6BEE]/40 focus:border-[#2D6BEE]"
                  placeholder="5601234567890"
                />
              </div>

              {/* Validade */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("shelf.validade")}</label>
                <input
                  type="date"
                  value={formData.validade ? String(formData.validade).slice(0, 10) : ""}
                  onChange={e => setFormData({ ...formData, validade: e.target.value || undefined })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D6BEE]/40 focus:border-[#2D6BEE]"
                />
              </div>

              {/* Preco esperado */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("shelf.precoEsperado")}</label>
                <input type="number" step="0.01" min="0"
                  value={formData.preco_esperado ?? ""}
                  onChange={e => setFormData({ ...formData, preco_esperado: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D6BEE]/40 focus:border-[#2D6BEE]"
                  placeholder="0.00"
                />
              </div>

              {/* Preco real */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("shelf.precoReal")}</label>
                <input type="number" step="0.01" min="0"
                  value={formData.preco_real ?? ""}
                  onChange={e => setFormData({ ...formData, preco_real: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D6BEE]/40 focus:border-[#2D6BEE]"
                  placeholder="0.00"
                />
              </div>

              {/* Quantidade esperada */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("shelf.qtdEsperada")}</label>
                <input type="number" min="0" step="1"
                  value={formData.quantidade_esperada ?? ""}
                  onChange={e => setFormData({ ...formData, quantidade_esperada: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D6BEE]/40 focus:border-[#2D6BEE]"
                  placeholder="0"
                />
              </div>

              {/* Quantidade real */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("shelf.qtdReal")}</label>
                <input type="number" min="0" step="1"
                  value={formData.quantidade_real ?? ""}
                  onChange={e => setFormData({ ...formData, quantidade_real: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D6BEE]/40 focus:border-[#2D6BEE]"
                  placeholder="0"
                />
              </div>

              {/* Facings */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("shelf.facings")}</label>
                <input type="number" min="0" step="1"
                  value={formData.facings ?? ""}
                  onChange={e => setFormData({ ...formData, facings: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D6BEE]/40 focus:border-[#2D6BEE]"
                  placeholder="0"
                />
              </div>

              {/* Conforme toggle */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t("shelf.conforme")}</label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, conforme: !formData.conforme })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${formData.conforme ? "bg-green-500" : "bg-red-400"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.conforme ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
                <span className={`text-xs font-semibold ${formData.conforme ? "text-green-600" : "text-red-500"}`}>
                  {formData.conforme ? t("common.yes") : t("common.no")}
                </span>
              </div>

              {/* Notes */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{t("shelf.notas")}</label>
                <textarea
                  value={formData.notas ?? ""}
                  onChange={e => setFormData({ ...formData, notas: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D6BEE]/40 focus:border-[#2D6BEE] resize-none"
                  placeholder={t("shelf.notasPlaceholder")}
                />
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSave}
                disabled={saving || !formData.produto_nome.trim()}
                className="flex-1 bg-[#2D6BEE] hover:bg-[#1A52CC] disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition"
              >
                {saving ? t("common.loading") : t("common.save")}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
