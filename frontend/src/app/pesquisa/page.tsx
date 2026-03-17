"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, BookOpen, Trash2, Plus, Loader2, X, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Estudo {
  id: number;
  nome: string;
}

interface SearchResult {
  id: number;
  estudo_id: number;
  titulo: string;
  conteudo: string;
  similarity: number;
  criado_em: string | null;
}

interface Documento {
  id: number;
  estudo_id: number;
  titulo: string;
  chars: number;
  criado_em: string | null;
}

type Tab = "pesquisa" | "documentos" | "ingest";

export default function PesquisaPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pesquisa");

  // Estudos
  const [estudos, setEstudos] = useState<Estudo[]>([]);
  const [estudoId, setEstudoId] = useState<number | "">("");

  // Search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Ingest
  const [ingestTitulo, setIngestTitulo] = useState("");
  const [ingestConteudo, setIngestConteudo] = useState("");
  const [ingestStudoId, setIngestStudoId] = useState<number | "">("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);

  // Documents list
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    api.get<Estudo[]>("/estudos/").then(setEstudos).catch(() => {});
  }, [router]);

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const data = await api.post<SearchResult[]>("/rag/search", {
        query,
        estudo_id: estudoId || undefined,
        top_k: 8,
      });
      setResults(data);
    } catch (e: unknown) {
      setSearchError((e as Error).message ?? "Erro na pesquisa");
    } finally {
      setSearching(false);
    }
  }, [query, estudoId]);

  const loadDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const data = await api.get<Documento[]>(
        "/rag/documentos" + (estudoId ? `?estudo_id=${estudoId}` : "")
      );
      setDocs(data);
    } catch {
      setDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  }, [estudoId]);

  useEffect(() => {
    if (tab === "documentos") loadDocs();
  }, [tab, loadDocs]);

  const handleIngest = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!ingestStudoId || !ingestTitulo.trim() || !ingestConteudo.trim()) return;
      setIngesting(true);
      setIngestMsg(null);
      try {
        await api.post("/rag/ingest", {
          estudo_id: ingestStudoId,
          titulo: ingestTitulo,
          conteudo: ingestConteudo,
        });
        setIngestMsg("Documento ingerido com sucesso.");
        setIngestTitulo("");
        setIngestConteudo("");
      } catch (e: unknown) {
        setIngestMsg("Erro: " + ((e as Error).message ?? "desconhecido"));
      } finally {
        setIngesting(false);
      }
    },
    [ingestStudoId, ingestTitulo, ingestConteudo]
  );

  const handleDeleteDoc = useCallback(
    async (docId: number) => {
      try {
        await api.delete(`/rag/documentos/${docId}`);
        setDocs((prev) => prev.filter((d) => d.id !== docId));
      } catch {
        alert("Erro ao apagar documento.");
      }
    },
    []
  );

  function similarityBadge(s: number) {
    const pct = Math.round(s * 100);
    const color =
      pct >= 80
        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        : pct >= 60
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
    return (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
        {pct}% similar
      </span>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "pesquisa", label: "Pesquisa semântica" },
    { key: "documentos", label: "Documentos" },
    { key: "ingest", label: "Adicionar documento" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Search className="w-8 h-8 text-brand" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Pesquisa Semântica
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            RAG — Pesquisa de documentos por significado com IA
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 text-sm rounded-lg transition-all font-medium ${
              tab === t.key
                ? "bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PESQUISA TAB ─────────────────────────────────── */}
      {tab === "pesquisa" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-card p-5 space-y-4">
            {/* Estudo filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
                Filtrar por estudo (opcional)
              </label>
              <select
                value={estudoId}
                onChange={(e) => setEstudoId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="">{t("pesquisa.allStudies")}</option>
                {estudos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Query */}
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder={t("pesquisa.queryPlaceholder")}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <button
                onClick={doSearch}
                disabled={searching || !query.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-60"
              >
                {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Pesquisar
              </button>
            </div>
          </div>

          {searchError && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <X size={14} /> {searchError}
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {results.length} resultado{results.length !== 1 ? "s" : ""} encontrado{results.length !== 1 ? "s" : ""}
              </p>
              {results.map((r) => (
                <div
                  key={r.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-card p-5"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-brand shrink-0 mt-0.5" />
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                        {r.titulo}
                      </span>
                    </div>
                    {similarityBadge(r.similarity)}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-4">
                    {r.conteudo}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">Estudo #{r.estudo_id}</p>
                </div>
              ))}
            </div>
          )}

          {!searching && results.length === 0 && query && (
            <div className="text-center py-16 text-slate-400 text-sm">
              Nenhum resultado encontrado para "{query}"
            </div>
          )}
        </div>
      )}

      {/* ── DOCUMENTOS TAB ───────────────────────────────── */}
      {tab === "documentos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <select
              value={estudoId}
              onChange={(e) => {
                setEstudoId(e.target.value ? Number(e.target.value) : "");
              }}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
            >
              <option value="">{t("pesquisa.allStudies")}</option>
              {estudos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
            <button
              onClick={loadDocs}
              className="text-xs text-brand hover:underline"
              disabled={loadingDocs}
            >
              {loadingDocs ? "A carregar…" : "Actualizar"}
            </button>
          </div>

          {loadingDocs && (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-slate-400" />
            </div>
          )}

          {!loadingDocs && docs.length === 0 && (
            <div className="text-center py-16 text-slate-400 text-sm">
              Nenhum documento ingerido ainda.
            </div>
          )}

          {docs.map((d) => (
            <div
              key={d.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-card px-5 py-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {d.titulo}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Estudo #{d.estudo_id} · {d.chars.toLocaleString()} caracteres ·{" "}
                  {d.criado_em ? new Date(d.criado_em).toLocaleDateString("pt-PT") : "—"}
                </p>
              </div>
              <button
                onClick={() => handleDeleteDoc(d.id)}
                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"
                title="Apagar documento"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── INGEST TAB ───────────────────────────────────── */}
      {tab === "ingest" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-card p-6">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-5">
            <Plus size={16} className="text-brand" />
            Adicionar documento ao índice RAG
          </h2>
          <form onSubmit={handleIngest} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
                Estudo *
              </label>
              <select
                value={ingestStudoId}
                onChange={(e) => setIngestStudoId(e.target.value ? Number(e.target.value) : "")}
                required
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="">{t("pesquisa.selectStudy")}</option>
                {estudos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
                Título *
              </label>
              <input
                type="text"
                value={ingestTitulo}
                onChange={(e) => setIngestTitulo(e.target.value)}
                required
                placeholder="Ex: Briefing Onda 3 — Atendimento"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
                Conteúdo *
              </label>
              <textarea
                value={ingestConteudo}
                onChange={(e) => setIngestConteudo(e.target.value)}
                required
                rows={8}
                placeholder="Cole o texto do briefing, guia de avaliação ou outro documento relevante…"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono leading-relaxed resize-y"
              />
            </div>
            {ingestMsg && (
              <div
                className={`rounded-lg p-3 text-sm ${
                  ingestMsg.startsWith("Erro")
                    ? "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400"
                    : "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400"
                }`}
              >
                {ingestMsg}
              </div>
            )}
            <button
              type="submit"
              disabled={ingesting || !ingestStudoId || !ingestTitulo.trim() || !ingestConteudo.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-60"
            >
              {ingesting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  A ingerir…
                </>
              ) : (
                <>
                  <BookOpen size={14} />
                  Guardar e indexar
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
