"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Search, Pencil, X } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Estabelecimento {
  id: number;
  cliente_id: number;
  nome: string;
  id_loja_externo: string | null;
  tipo_canal: string | null;
  regiao: string | null;
  responsavel: string | null;
  activo: boolean;
}

interface Cliente {
  id: number;
  nome: string;
}

interface EditForm {
  nome: string;
  id_loja_externo: string;
  tipo_canal: string;
  regiao: string;
  responsavel: string;
}

function EstabelecimentosContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Estabelecimento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [clienteFilter, setClienteFilter] = useState<string>(searchParams.get("cliente_id") ?? "");
  const [editing, setEditing] = useState<Estabelecimento | null>(null);
  const [form, setForm] = useState<EditForm>({
    nome: "", id_loja_externo: "", tipo_canal: "", regiao: "", responsavel: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    const url = clienteFilter
      ? `/estabelecimentos/?page_size=500&cliente_id=${clienteFilter}`
      : `/estabelecimentos/?page_size=500`;
    Promise.all([
      api.get<Estabelecimento[]>(url),
      api.get<Cliente[]>("/clientes/?page_size=200"),
    ])
      .then(([est, cli]) => { setItems(est); setClientes(cli); })
      .finally(() => setLoading(false));
  }, [router, clienteFilter]);

  function openEdit(e: Estabelecimento) {
    setEditing(e);
    setForm({
      nome: e.nome,
      id_loja_externo: e.id_loja_externo ?? "",
      tipo_canal: e.tipo_canal ?? "",
      regiao: e.regiao ?? "",
      responsavel: e.responsavel ?? "",
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await api.put<Estabelecimento>(`/estabelecimentos/${editing.id}`, {
        cliente_id: editing.cliente_id,
        nome: form.nome,
        id_loja_externo: form.id_loja_externo || null,
        tipo_canal: form.tipo_canal || null,
        regiao: form.regiao || null,
        responsavel: form.responsavel || null,
      });
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  const filtered = items.filter(e =>
    e.nome.toLowerCase().includes(search.toLowerCase()) ||
    (e.id_loja_externo ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (e.regiao ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const FIELDS: { key: keyof EditForm; label: string }[] = [
    { key: "nome", label: "Nome" },
    { key: "id_loja_externo", label: "ID Loja Externo" },
    { key: "tipo_canal", label: "Tipo Canal" },
    { key: "regiao", label: "Região" },
    { key: "responsavel", label: "Responsável" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-900 dark:text-white">{t("estabelecimentos.editEstab")}</h3>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            {FIELDS.map(({ key, label }) => (
              <div key={key} className="mb-3">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
                <input
                  value={form[key]}
                  onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            ))}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditing(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition">
                Cancelar
              </button>
              <button onClick={saveEdit} disabled={saving || !form.nome} className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
                {saving ? "A guardar..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{t("estabelecimentos.title")}</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {loading ? "A carregar..." : `${filtered.length} estabelecimentos`}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("estabelecimentos.searchPlaceholder")}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-card transition"
          />
        </div>
        <select
          value={clienteFilter}
          onChange={e => { setClienteFilter(e.target.value); setLoading(true); }}
          className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-card transition text-slate-700 dark:text-slate-300"
        >
          <option value="">{t("estabelecimentos.allClients")}</option>
          {clientes.map(c => (
            <option key={c.id} value={String(c.id)}>{c.nome}</option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...Array(6)].map((_, i) => <div key={i} className="h-14 animate-pulse bg-slate-50 dark:bg-slate-800/50" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">{t("estabelecimentos.noData")}</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    {["ID", "Nome", "Cliente", "ID Loja", "Canal", "Região", "Responsável", "Estado"].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                    <th className="px-5 py-3.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">{e.id}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200 max-w-[200px] truncate">{e.nome}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{clientes.find(c => c.id === e.cliente_id)?.nome ?? "—"}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">{e.id_loja_externo ?? "—"}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{e.tipo_canal ?? "—"}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{e.regiao ?? "—"}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{e.responsavel ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${e.activo ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>
                          {e.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-400 hover:text-blue-600 transition" title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(e => (
                <div key={e.id} className="px-4 py-3.5 flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">{e.nome}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{e.id_loja_externo ?? ""}{e.regiao ? ` · ${e.regiao}` : ""}</p>
                    <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${e.activo ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                      {e.activo ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <button onClick={() => openEdit(e)} className="ml-3 p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-400 hover:text-blue-600 transition flex-shrink-0">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function EstabelecimentosPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400 text-sm">A carregar...</div>}>
      <EstabelecimentosContent />
    </Suspense>
  );
}
