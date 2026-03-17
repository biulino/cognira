"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DOMPurify from "dompurify";
import {
  GraduationCap,
  Plus,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
  BookOpen,
  Award,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Estudo {
  id: number;
  nome: string;
}

interface Formacao {
  id: number;
  estudo_id: number;
  titulo: string;
  conteudo_html: string | null;
  documento_url_minio: string | null;
  obrigatoria: boolean;
}

interface Resultado {
  id: number;
  analista_id: number;
  formacao_id: number;
  pontuacao_obtida: number;
  aprovado: boolean;
  tentativa: number;
  realizado_em: string | null;
}

interface Certificacao {
  id: number;
  analista_id: number;
  estudo_id: number;
  certificado_em: string | null;
  valido_ate: string | null;
  estado: string;
}

interface UserMe {
  id: string;
  role_global: string;
  nome?: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FormacoesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [user, setUser] = useState<UserMe | null>(null);
  const [estudos, setEstudos] = useState<Estudo[]>([]);
  const [selectedEstudo, setSelectedEstudo] = useState<number | null>(null);
  const [formacoes, setFormacoes] = useState<Formacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [resultados, setResultados] = useState<Record<number, Resultado[]>>({});
  const [certificacoes, setCertificacoes] = useState<Certificacao[]>([]);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitulo, setNewTitulo] = useState("");
  const [newObrigatoria, setNewObrigatoria] = useState(true);

  const isAdmin = user?.role_global === "admin" || user?.role_global === "coordenador";

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }

    Promise.all([
      api.get<UserMe>("/auth/me"),
      api.get<Estudo[]>("/estudos/"),
    ])
      .then(([me, est]) => {
        setUser(me);
        setEstudos(est);
        if (est.length > 0) setSelectedEstudo(est[0].id);
      })
      .catch((e: Error) => toast.error("Erro ao carregar dados", e.message));
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load formações when study changes ────────────────────────────────────────

  useEffect(() => {
    if (selectedEstudo === null) return;
    setLoading(true);
    setFormacoes([]);
    setExpandedId(null);

    Promise.all([
      api.get<Formacao[]>(`/formacoes/?estudo_id=${selectedEstudo}`),
      // Certificacoes only meaningful for analista users; skip for admin/coordenador
      // (the endpoint expects an analista_id integer, not a UUID user id)
      Promise.resolve([] as Certificacao[]),
    ])
      .then(([f, c]) => {
        setFormacoes(f);
        setCertificacoes(c as Certificacao[]);
      })
      .catch((e: Error) => toast.error("Erro ao carregar formações", e.message))
      .finally(() => setLoading(false));
  }, [selectedEstudo, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load results when expanding ──────────────────────────────────────────────

  async function toggleExpand(id: number) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!resultados[id]) {
      try {
        const r = await api.get<Resultado[]>(`/formacoes/${id}/resultados`);
        setResultados((prev) => ({ ...prev, [id]: r }));
      } catch {
        // analistas may not have access — ignore
      }
    }
  }

  // ── Create formação ──────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitulo.trim() || selectedEstudo === null) return;
    setCreating(true);
    try {
      const f = await api.post<Formacao>("/formacoes/", {
        estudo_id: selectedEstudo,
        titulo: newTitulo.trim(),
        obrigatoria: newObrigatoria,
      });
      setFormacoes((prev) => [...prev, f]);
      setNewTitulo("");
      setShowCreate(false);
      toast.success("Formação criada com sucesso");
    } catch (e: unknown) {
      toast.error("Erro ao criar formação", (e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  // ── Delete formação ──────────────────────────────────────────────────────────

  async function handleDelete(id: number) {
    if (!confirm("Eliminar esta formação permanentemente?")) return;
    try {
      await api.delete(`/formacoes/${id}`);
      setFormacoes((prev) => prev.filter((f) => f.id !== id));
      toast.success("Formação eliminada");
    } catch (e: unknown) {
      toast.error("Erro ao eliminar", (e as Error).message);
    }
  }

  // ── Certificações ─────────────────────────────────────────────────────────────

  function hasCertificacao(estudo_id: number) {
    return certificacoes.some(
      (c) => c.estudo_id === estudo_id && c.estado === "activo"
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-blue-600" />
            Formações
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Módulos de formação e certificações por estudo
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-all shadow-sm active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nova formação
          </button>
        )}
      </div>

      {/* Study selector */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
          Estudo
        </label>
        <select
          value={selectedEstudo ?? ""}
          onChange={(e) => setSelectedEstudo(Number(e.target.value))}
          className="w-full sm:w-72 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {estudos.map((est) => (
            <option key={est.id} value={est.id}>
              {est.nome}
            </option>
          ))}
        </select>
      </div>

      {/* Certification badge */}
      {selectedEstudo !== null && hasCertificacao(selectedEstudo) && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-400 text-sm font-medium w-fit">
          <Award className="w-4 h-4" />
          Certificado activo para este estudo
        </div>
      )}

      {/* Create form */}
      {showCreate && isAdmin && (
        <form
          onSubmit={handleCreate}
          className="mb-6 p-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/50 space-y-3"
        >
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("formacoes.newFormacao")}</p>
          <input
            type="text"
            placeholder={t("formacoes.titlePlaceholder")}
            value={newTitulo}
            onChange={(e) => setNewTitulo(e.target.value)}
            required
            className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={newObrigatoria}
              onChange={(e) => setNewObrigatoria(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            Formação obrigatória
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-all"
            >
              {creating ? "A criar…" : "Criar"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && formacoes.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-slate-400 dark:text-slate-500">
          <BookOpen className="w-10 h-10" />
          <p className="text-sm">{t("formacoes.noFormacoes")}</p>
        </div>
      )}

      {/* Formações list */}
      {!loading && formacoes.length > 0 && (
        <div className="space-y-3">
          {formacoes.map((f) => (
            <div
              key={f.id}
              className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-800/50"
            >
              {/* Row header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => toggleExpand(f.id)}
                  className="flex items-center gap-3 flex-1 text-left group"
                >
                  {f.obrigatoria ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-medium shrink-0">
                      Obrigatória
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 font-medium shrink-0">
                      Opcional
                    </span>
                  )}
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100 flex-1">
                    {f.titulo}
                  </span>
                  {expandedId === f.id ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(f.id)}
                    className="text-slate-400 hover:text-red-500 transition shrink-0 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    title={t("common.delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Expanded content */}
              {expandedId === f.id && (
                <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700 pt-3 space-y-4">
                  {f.conteudo_html ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(f.conteudo_html) }}
                    />
                  ) : (
                    <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                      Sem conteúdo HTML disponível.
                    </p>
                  )}

                  {f.documento_url_minio && (
                    <a
                      href={f.documento_url_minio}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                    >
                      Ver documento
                    </a>
                  )}

                  {/* Resultados (admin/coordenador only) */}
                  {isAdmin && resultados[f.id] && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Resultados dos analistas
                      </p>
                      {resultados[f.id].length === 0 ? (
                        <p className="text-sm text-slate-400 italic">{t("formacoes.noResults")}</p>
                      ) : (
                        <div className="space-y-1.5">
                          {resultados[f.id].map((r) => (
                            <div
                              key={r.id}
                              className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300"
                            >
                              {r.aprovado ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                              )}
                              <span>Analista #{r.analista_id}</span>
                              <span className="text-slate-400">—</span>
                              <span>{r.pontuacao_obtida} pts · tentativa {r.tentativa}</span>
                              {r.realizado_em && (
                                <span className="text-slate-400 text-xs">
                                  {new Date(r.realizado_em).toLocaleDateString("pt-PT")}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
