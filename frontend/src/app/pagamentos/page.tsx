"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Check, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Pagamento {
  id: number;
  visita_id: number;
  analista_id: number;
  valor_base: number;
  valor_despesas: number;
  valor_total: number;
  estado: string;
  pago_em: string | null;
}

const ESTADO_COLORS: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  aprovado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  pago: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  rejeitado: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

export default function PagamentosPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState("");
  const [search, setSearch] = useState("");
  const [approving, setApproving] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    load();
  }, [router]);

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ page_size: "100" });
    if (filterEstado) params.set("estado", filterEstado);
    api.get<Pagamento[]>(`/pagamentos/?${params}`)
      .then(setItems)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [filterEstado]);

  async function approve(id: number) {
    setApproving(id);
    try {
      const updated = await api.put<Pagamento>(`/pagamentos/${id}/aprovar`, {});
      setItems(prev => prev.map(p => p.id === id ? updated : p));
    } catch {}
    setApproving(null);
  }

  const total = items.reduce((s, p) => s + p.valor_total, 0);
  const filtered = items.filter(p => !search || String(p.visita_id).includes(search) || String(p.analista_id).includes(search));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{t("pagamentos.title")}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {loading ? "A carregar..." : `${items.length} registos · Total: €${total.toFixed(2)}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t("common.searchPlaceholder")}
              className="pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-card transition w-40"
            />
          </div>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-card transition"
          >
            <option value="">{t("pagamentos.all")}</option>
            <option value="pendente">Pendente</option>
            <option value="aprovado">Aprovado</option>
            <option value="pago">Pago</option>
            <option value="rejeitado">Rejeitado</option>
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Pendentes", count: items.filter(p => p.estado === "pendente").length, color: "text-yellow-600" },
          { label: "Aprovados", count: items.filter(p => p.estado === "aprovado").length, color: "text-emerald-600" },
          { label: "Pagos", count: items.filter(p => p.estado === "pago").length, color: "text-blue-600" },
          { label: "Total €", count: `€${total.toFixed(0)}`, color: "text-slate-700 dark:text-slate-200" },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card border border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{count}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 animate-pulse bg-slate-50 dark:bg-slate-800/50" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <CreditCard className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">{t("pagamentos.noPayments")}</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    {["ID", "Visita", "Analista", "Base", "Despesas", "Total", "Estado", "Aprovado em", ""].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">{p.id}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">#{p.visita_id}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">#{p.analista_id}</td>
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-700 dark:text-slate-300">€{p.valor_base.toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">€{p.valor_despesas.toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-sm font-bold text-slate-900 dark:text-white">€{p.valor_total.toFixed(2)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[p.estado] ?? "bg-slate-100 text-slate-500"}`}>
                          {p.estado}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">
                        {p.pago_em ? new Date(p.pago_em).toLocaleDateString("pt-PT") : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        {p.estado === "pendente" && (
                          <button
                            onClick={() => approve(p.id)}
                            disabled={approving === p.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-medium transition disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {approving === p.id ? "..." : "Aprovar"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(p => (
                <div key={p.id} className="px-4 py-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[p.estado] ?? "bg-slate-100 text-slate-500"}`}>{p.estado}</span>
                    <span className="text-xs text-slate-400 font-mono">#{p.id}</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">€{p.valor_total.toFixed(2)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Visita #{p.visita_id} · Analista #{p.analista_id}</p>
                  {p.estado === "pendente" && (
                    <button onClick={() => approve(p.id)} disabled={approving === p.id} className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium">
                      <Check className="w-3.5 h-3.5" />
                      {approving === p.id ? "..." : "Aprovar"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
