"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Plus, Pencil, X, Loader2, CheckCircle, XCircle, Building2, LayoutGrid, Globe } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Cliente {
  id: number;
  nome: string;
  activo: boolean;
}

export default function ClientesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Cliente | null>(null);
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    api.get<Cliente[]>("/clientes/?page_size=200")
      .then(setClientes)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  function openCreate() {
    setEditTarget(null);
    setNome("");
    setShowModal(true);
  }

  function openEdit(c: Cliente) {
    setEditTarget(c);
    setNome(c.nome);
    setShowModal(true);
  }

  async function save() {
    if (!nome.trim()) return;
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await api.put<Cliente>(`/clientes/${editTarget.id}`, { nome: nome.trim() });
        setClientes(prev => prev.map(c => c.id === editTarget.id ? updated : c));
      } else {
        const created = await api.post<Cliente>("/clientes/", { nome: nome.trim() });
        setClientes(prev => [...prev, created]);
      }
      setShowModal(false);
    } catch (e: unknown) {
      alert((e as Error).message ?? "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: Cliente) {
    setTogglingId(c.id);
    try {
      if (c.activo) {
        await api.delete(`/clientes/${c.id}`);
        setClientes(prev => prev.map(x => x.id === c.id ? { ...x, activo: false } : x));
      } else {
        const updated = await api.put<Cliente>(`/clientes/${c.id}`, { nome: c.nome });
        setClientes(prev => prev.map(x => x.id === c.id ? updated : x));
      }
    } catch (e: unknown) {
      alert((e as Error).message ?? "Erro");
    } finally {
      setTogglingId(null);
    }
  }

  const activos = clientes.filter(c => c.activo).length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{t("clientes.title")}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{activos} activos de {clientes.length} total</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand/90 transition shadow"
        >
          <Plus className="w-4 h-4" />
          Novo
        </button>
      </div>

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
      )}

      {!loading && !error && clientes.length === 0 && (
        <div className="text-center py-20">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{t("clientes.noClientes")}</p>
        </div>
      )}

      {!loading && !error && clientes.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {clientes.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand/20 to-brand/40 flex items-center justify-center flex-shrink-0">
                        <Briefcase className="w-4 h-4 text-brand" />
                      </div>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{c.nome}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      c.activo
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {c.activo ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {c.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      <Link
                        href={`/clientes/${c.id}/portal`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 rounded-lg transition"
                        title="Configurar portal white-label"
                      >
                        <Globe className="w-3 h-3" />
                        <span className="hidden sm:inline">Portal</span>
                      </Link>
                      <Link
                        href={`/clientes/${c.id}/modulos`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 dark:bg-violet-900/20 dark:hover:bg-violet-900/40 rounded-lg transition"
                        title={t("clientes.manageModules")}
                      >
                        <LayoutGrid className="w-3 h-3" />
                        <span className="hidden sm:inline">{t("clientes.modules")}</span>
                      </Link>
                      <Link
                        href={`/estabelecimentos?cliente_id=${c.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-lg transition"
                        title={t("clientes.viewEstabs")}
                      >
                        <Building2 className="w-3 h-3" />
                        <span className="hidden sm:inline">Est.</span>
                      </Link>
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                        title={t("common.edit")}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleActive(c)}
                        disabled={togglingId === c.id}
                        className={`p-1.5 rounded-lg transition ${
                          c.activo
                            ? "text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                        }`}
                        title={c.activo ? "Desactivar" : "Activar"}
                      >
                        {togglingId === c.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : c.activo ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editTarget ? "Editar Cliente" : "Novo Cliente"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Nome do Cliente *</label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                onKeyDown={e => e.key === "Enter" && save()}
                placeholder={t("clientes.namePlaceholder")}
                autoFocus
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving || !nome.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand/90 disabled:opacity-50 transition"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editTarget ? "Actualizar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
