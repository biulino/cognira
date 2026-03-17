"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Filter, Loader2, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

interface AuditEntry {
  id: number;
  utilizador_id: string | null;
  entidade: string;
  entidade_id: string | null;
  acao: string;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  ip: string | null;
  criado_em: string;
}

interface AuditResponse {
  total: number;
  page: number;
  page_size: number;
  items: AuditEntry[];
}

interface EntityCount { entidade: string; total: number; }
interface AcaoCount { acao: string; total: number; }

const ACAO_COLORS: Record<string, string> = {
  criado: "bg-emerald-100 text-emerald-700",
  atualizado: "bg-blue-100 text-blue-700",
  eliminado: "bg-red-100 text-red-600",
  login: "bg-violet-100 text-violet-700",
  logout: "bg-slate-100 text-slate-600",
  onboarding: "bg-indigo-100 text-indigo-700",
  sso_login: "bg-purple-100 text-purple-700",
  estado_alterado: "bg-amber-100 text-amber-700",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [entidades, setEntidades] = useState<EntityCount[]>([]);
  const [acoes, setAcoes] = useState<AcaoCount[]>([]);
  const [filEntidade, setFilEntidade] = useState("");
  const [filAcao, setFilAcao] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async (pg: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pg),
        page_size: String(PAGE_SIZE),
        ...(filEntidade && { entidade: filEntidade }),
        ...(filAcao && { acao: filAcao }),
      });
      const r = await api.get<AuditResponse>(`/audit/?${params}`);
      setEntries(r.items);
      setTotal(r.total);
    } catch {
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }, [filEntidade, filAcao, router]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    Promise.all([
      api.get<EntityCount[]>("/audit/entidades"),
      api.get<AcaoCount[]>("/audit/acoes"),
    ]).then(([ents, acs]) => {
      setEntidades(ents);
      setAcoes(acs);
    }).catch(() => {});
  }, [router]);

  useEffect(() => { setPage(1); }, [filEntidade, filAcao]);
  useEffect(() => { load(page); }, [page, load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <ShieldCheck className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Audit Log</h1>
            {!loading && (
              <p className="text-xs text-slate-400 mt-0.5">{total.toLocaleString("pt-PT")} registos</p>
            )}
          </div>
        </div>
        <button
          onClick={() => load(page)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <select
          value={filEntidade}
          onChange={e => setFilEntidade(e.target.value)}
          className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-brand/40"
        >
          <option value="">Todas as entidades</option>
          {entidades.map(e => (
            <option key={e.entidade} value={e.entidade}>{e.entidade} ({e.total})</option>
          ))}
        </select>
        <select
          value={filAcao}
          onChange={e => setFilAcao(e.target.value)}
          className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-brand/40"
        >
          <option value="">Todas as acções</option>
          {acoes.map(a => (
            <option key={a.acao} value={a.acao}>{a.acao} ({a.total})</option>
          ))}
        </select>
        {(filEntidade || filAcao) && (
          <button
            onClick={() => { setFilEntidade(""); setFilAcao(""); }}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-slate-300" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center text-slate-400 py-16 text-sm">Sem registos para os filtros seleccionados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase">Data / Hora</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase">Entidade</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase">ID</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase">Acção</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase">Utilizador</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3 uppercase">IP</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <>
                    <tr
                      key={entry.id}
                      onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                      className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(entry.criado_em)}</td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-700 dark:text-slate-300">{entry.entidade}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">{entry.entidade_id ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${ACAO_COLORS[entry.acao] ?? "bg-slate-100 text-slate-600"}`}>
                          {entry.acao}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                        {entry.utilizador_id ? entry.utilizador_id.slice(0, 8) + "…" : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{entry.ip ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        {(entry.dados_anteriores || entry.dados_novos) ? (expanded === entry.id ? "▲" : "▼") : ""}
                      </td>
                    </tr>
                    {expanded === entry.id && (entry.dados_anteriores || entry.dados_novos) && (
                      <tr key={`${entry.id}-detail`} className="bg-slate-50 dark:bg-slate-800/30">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {entry.dados_anteriores && (
                              <div>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Antes</p>
                                <pre className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl p-3 overflow-x-auto">
                                  {JSON.stringify(entry.dados_anteriores, null, 2)}
                                </pre>
                              </div>
                            )}
                            {entry.dados_novos && (
                              <div>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Depois</p>
                                <pre className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl p-3 overflow-x-auto">
                                  {JSON.stringify(entry.dados_novos, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
            <p className="text-xs text-slate-500">
              Página {page} de {totalPages} · {total.toLocaleString("pt-PT")} registos
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
