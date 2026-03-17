"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, ArrowRight, Plus, Search, X, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Estudo {
  id: number;
  nome: string;
  estado: string;
  cliente_id: number;
  criado_em: string;
  total_visitas: number;
}

interface Cliente {
  id: number;
  nome: string;
}

const ESTADO_COLOR: Record<string, string> = {
  activo: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  inactivo: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  arquivado: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function EstudosPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [estudos, setEstudos] = useState<Estudo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string>("");

  // Create-study modal state
  const [showModal, setShowModal] = useState(false);
  const [createNome, setCreateNome] = useState("");
  const [createClienteId, setCreateClienteId] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  function loadEstudos() {
    api.get<Estudo[]>("/estudos/")
      .then(setEstudos)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    loadEstudos();
    api.get<{ role_global: string }>("/auth/me").then(me => setRole(me.role_global ?? "")).catch(() => {});
    api.get<Cliente[]>("/clientes/").then(setClientes).catch(() => {/* non-critical */});
  }, [router]);

  async function handleCreate() {
    if (!createNome.trim()) { setCreateErr("O nome é obrigatório."); return; }
    if (!createClienteId) { setCreateErr("Seleccione um cliente."); return; }
    setCreating(true);
    setCreateErr(null);
    try {
      await api.post("/estudos/", { nome: createNome.trim(), cliente_id: Number(createClienteId) });
      setShowModal(false);
      setCreateNome("");
      setCreateClienteId("");
      setLoading(true);
      loadEstudos();
    } catch (e: unknown) {
      setCreateErr(e instanceof Error ? e.message : "Erro ao criar estudo");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, estudo: Estudo) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Apagar o estudo "${estudo.nome}"? Esta acção não pode ser desfeita.`)) return;
    try {
      await api.delete(`/estudos/${estudo.id}`);
      setEstudos(prev => prev.filter(x => x.id !== estudo.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro ao apagar estudo");
    }
  }

  const canDelete = ["admin", "coordenador"].includes(role);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{t("estudos.title")}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{estudos.length} estudo{estudos.length !== 1 ? "s" : ""} encontrado{estudos.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t("estudos.searchPlaceholder")}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30 focus:border-[#2D6BEE]"
          />
        </div>
        <button
          onClick={() => { setCreateErr(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#2D6BEE] hover:bg-[#1A52CC] text-white text-sm font-medium rounded-xl transition-all shadow-sm active:scale-95 flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> Novo
        </button>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}
        </div>
      )}
      {!loading && error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}
      {!loading && !error && estudos.length === 0 && (
        <div className="text-center py-20">
          <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">{t("estudos.noEstudos")}</p>
        </div>
      )}
      {!loading && !error && estudos.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {estudos.filter(e => !search || e.nome.toLowerCase().includes(search.toLowerCase())).map((e) => (
            <div key={e.id} className="relative group">
              <Link
                href={`/estudos/${e.id}`}
                className="block bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-card border border-slate-100 dark:border-slate-800 hover:shadow-card-hover hover:border-[#2D6BEE]/20 dark:hover:border-[#2D6BEE]/30 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-[#F0F5FF] dark:bg-[#2D6BEE]/20 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-4 h-4 text-[#2D6BEE]" />
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_COLOR[e.estado] ?? "bg-slate-100 text-slate-500"}`}>
                        {e.estado}
                      </span>
                    </div>
                    <h2 className="font-semibold text-slate-900 dark:text-white text-sm leading-snug group-hover:text-[#2D6BEE] dark:group-hover:text-[#2D6BEE] transition-colors">
                      {e.nome}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1.5">
                      Cliente #{e.cliente_id} &middot; {new Date(e.criado_em).toLocaleDateString("pt-PT")}
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {e.total_visitas} visita{e.total_visitas !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#2D6BEE] transition-colors flex-shrink-0 mt-1" />
                </div>
              </Link>
              {canDelete && (
                <button
                  onClick={(ev) => handleDelete(ev, e)}
                  title="Apagar estudo"
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-white dark:bg-slate-900 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition opacity-0 group-hover:opacity-100 shadow-sm border border-slate-100 dark:border-slate-700 z-10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Study Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-800 dark:text-white">Novo Estudo</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Nome do estudo *</label>
                <input
                  value={createNome}
                  onChange={e => setCreateNome(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                  placeholder="Ex: Auditoria Q1 2025"
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30 focus:border-[#2D6BEE]"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Cliente *</label>
                <select
                  value={createClienteId}
                  onChange={e => setCreateClienteId(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30 focus:border-[#2D6BEE]"
                >
                  <option value="">Seleccionar cliente…</option>
                  {clientes.map(c => <option key={c.id} value={String(c.id)}>{c.nome}</option>)}
                </select>
              </div>
              {createErr && <p className="text-xs text-red-600">{createErr}</p>}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 px-4 py-2 text-sm text-white bg-[#2D6BEE] hover:bg-[#1A52CC] rounded-xl font-medium transition disabled:opacity-50"
              >
                {creating ? "A criar…" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

