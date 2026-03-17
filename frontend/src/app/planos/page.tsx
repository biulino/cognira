"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Building2,
  Check,
  X,
  ChevronDown,
  Layers,
  ToggleLeft,
  ToggleRight,
  Search,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ModuloItem {
  key: string;
  label: string;
}

interface Plano {
  id: string;
  label: string;
  descricao: string;
  cor: string;
  modulos: ModuloItem[];
}

interface PlanoCatalogResponse {
  catalogo: Plano[];
}

// GET /clientes/{id}/modulos returns { cliente_id, catalogo, flags: {key: bool} }
interface ClienteModulosResponse {
  cliente_id: number;
  catalogo: Plano[];
  flags: Record<string, boolean>;
}

interface Cliente {
  id: number;
  nome: string;
  activo: boolean;
}

// Tailwind color map for plano cards
const COR_CLASSES: Record<string, { bg: string; text: string; badge: string; dot: string }> = {
  blue:    { bg: "bg-blue-50 dark:bg-blue-900/20",    text: "text-blue-700 dark:text-blue-300",    badge: "bg-blue-100 text-blue-700",    dot: "bg-blue-500" },
  orange:  { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-300", badge: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-900/20",text: "text-emerald-700 dark:text-emerald-300",badge: "bg-emerald-100 text-emerald-700",dot: "bg-emerald-500" },
  violet:  { bg: "bg-violet-50 dark:bg-violet-900/20", text: "text-violet-700 dark:text-violet-300", badge: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
  rose:    { bg: "bg-rose-50 dark:bg-rose-900/20",     text: "text-rose-700 dark:text-rose-300",     badge: "bg-rose-100 text-rose-700",     dot: "bg-rose-500" },
  amber:   { bg: "bg-amber-50 dark:bg-amber-900/20",   text: "text-amber-700 dark:text-amber-300",   badge: "bg-amber-100 text-amber-700",   dot: "bg-amber-500" },
  teal:    { bg: "bg-teal-50 dark:bg-teal-900/20",     text: "text-teal-700 dark:text-teal-300",     badge: "bg-teal-100 text-teal-700",     dot: "bg-teal-500" },
  sky:     { bg: "bg-sky-50 dark:bg-sky-900/20",       text: "text-sky-700 dark:text-sky-300",       badge: "bg-sky-100 text-sky-700",       dot: "bg-sky-500" },
};

function colorFor(cor: string) {
  return COR_CLASSES[cor] ?? COR_CLASSES.blue;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function PlanosPage() {
  const { t } = useI18n();
  const router = useRouter();

  const [catalogo, setCatalogo] = useState<Plano[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<number | null>(null);
  const [flags, setFlags] = useState<Map<string, boolean>>(new Map()); // modulo key → activo
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [myRole, setMyRole] = useState("");
  const [search, setSearch] = useState("");

  // ── Load catalog and clients ────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }

    Promise.all([
      api.get<PlanoCatalogResponse>("/clientes/catalogo"),
      api.get<{ id: string; role_global: string }>("/auth/me"),
      api.get<Cliente[]>("/clientes/").catch(() => [] as Cliente[]),
    ])
      .then(([catalog, me, cls]) => {
        setCatalogo(catalog.catalogo);
        setMyRole(me.role_global);
        setClientes(cls);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  // ── Load flags for selected client ─────────────────────────────────────────
  const loadFlags = useCallback((clienteId: number) => {
    api
      .get<ClienteModulosResponse>(`/clientes/${clienteId}/modulos`)
      .then((res) => {
        const map = new Map<string, boolean>();
        Object.entries(res.flags ?? {}).forEach(([k, v]) => map.set(k, v));
        setFlags(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedCliente !== null) loadFlags(selectedCliente);
  }, [selectedCliente, loadFlags]);

  // ── Toggle a module for the selected client ─────────────────────────────────
  const toggleModulo = (key: string) => {
    if (selectedCliente === null) return;
    setFlags((prev) => {
      const next = new Map(prev);
      next.set(key, !(next.get(key) ?? true));
      return next;
    });
  };

  // ── Save flags ──────────────────────────────────────────────────────────────
  const saveFlags = async () => {
    if (selectedCliente === null) return;
    setSaving(true);
    setSaved(false);
    // Collect all module keys from catalog
    const allKeys = catalogo.flatMap((p) => p.modulos.map((m) => m.key));
    const body = allKeys.map((key) => ({
      modulo: key,
      activo: flags.get(key) ?? true,
    }));
    try {
      await api.put(`/clientes/${selectedCliente}/modulos`, body);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* errors already handled by api client */ } finally {
      setSaving(false);
    }
  };

  // ── Enable / disable entire plan ────────────────────────────────────────────
  const togglePlano = (plano: Plano, enable: boolean) => {
    if (selectedCliente === null) return;
    setFlags((prev) => {
      const next = new Map(prev);
      plano.modulos.forEach((m) => next.set(m.key, enable));
      return next;
    });
  };

  const filteredCatalogo = search.trim()
    ? catalogo.filter(
        (p) =>
          p.label.toLowerCase().includes(search.toLowerCase()) ||
          p.modulos.some((m) => m.label.toLowerCase().includes(search.toLowerCase()))
      )
    : catalogo;

  // ── Computed counts ─────────────────────────────────────────────────────────
  const totalModulos = catalogo.flatMap((p) => p.modulos).length;
  const activeCount = catalogo
    .flatMap((p) => p.modulos)
    .filter((m) => flags.get(m.key) ?? true).length;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#2D6BEE] border-t-transparent rounded-full" />
      </div>
    );
  }

  const isAdmin = myRole === "admin";

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-6 h-6 text-[#2D6BEE]" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("planos.title")}</h1>
          </div>
          <p className="text-sm text-slate-500">
            Catálogo de funcionalidades disponíveis por suite.
            {isAdmin && " Seleciona um cliente para gerir os módulos activos."}
          </p>
        </div>

        {/* Client selector — admin only */}
        {isAdmin && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedCliente ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedCliente(v ? Number(v) : null);
                  setFlags(new Map());
                }}
                className="pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30 appearance-none cursor-pointer min-w-[220px]"
              >
                <option value="">— Catálogo (visualização) —</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {selectedCliente !== null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{activeCount}</span>/{totalModulos} activos
                </span>
                <button
                  onClick={saveFlags}
                  disabled={saving}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                    saved
                      ? "bg-green-500 text-white"
                      : "bg-[#2D6BEE] hover:bg-[#1A52CC] text-white disabled:opacity-50"
                  }`}
                >
                  {saved ? <><Check className="w-4 h-4" /> Guardado</> : saving ? "A guardar…" : "Guardar alterações"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder={t("planos.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30"
        />
      </div>

      {/* Plan grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredCatalogo.map((plano) => {
          const c = colorFor(plano.cor);
          const allActive = plano.modulos.every((m) => flags.get(m.key) ?? true);
          const noneActive = plano.modulos.every((m) => !(flags.get(m.key) ?? true));
          const someActive = !allActive && !noneActive;

          return (
            <div
              key={plano.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Plan header */}
              <div className={`px-5 py-4 ${c.bg} border-b border-slate-200/50 dark:border-slate-700/50`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                      <h2 className={`text-base font-bold ${c.text}`}>{plano.label}</h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{plano.descricao}</p>
                  </div>

                  {/* Plan-level toggle — admin + client selected */}
                  {isAdmin && selectedCliente !== null && (
                    <div className="flex flex-col gap-1 flex-shrink-0 ml-2">
                      <button
                        onClick={() => togglePlano(plano, true)}
                        title={t("planos.activateAll")}
                        className={`p-1.5 rounded-lg transition text-xs font-medium ${
                          allActive
                            ? "bg-green-500 text-white"
                            : "bg-white dark:bg-slate-800 text-slate-500 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20"
                        }`}
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => togglePlano(plano, false)}
                        title={t("planos.deactivateAll")}
                        className={`p-1.5 rounded-lg transition text-xs font-medium ${
                          noneActive
                            ? "bg-red-500 text-white"
                            : "bg-white dark:bg-slate-800 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        }`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Status pill */}
                {isAdmin && selectedCliente !== null && (
                  <div className="mt-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      allActive ? "bg-green-100 text-green-700" :
                      noneActive ? "bg-slate-100 text-slate-500" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {allActive ? "Todos activos" : noneActive ? "Todos inactivos" : `${plano.modulos.filter(m => flags.get(m.key) ?? true).length}/${plano.modulos.length} activos`}
                    </span>
                  </div>
                )}
              </div>

              {/* Module list */}
              <div className="px-5 py-3 space-y-1">
                {plano.modulos.map((mod) => {
                  const activo = flags.get(mod.key) ?? true;
                  const canToggle = isAdmin && selectedCliente !== null;
                  return (
                    <div
                      key={mod.key}
                      className={`flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                        canToggle ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-2 px-2 rounded-lg transition" : ""
                      }`}
                      onClick={() => canToggle && toggleModulo(mod.key)}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activo ? c.dot : "bg-slate-300 dark:bg-slate-600"}`} />
                        <div>
                          <p className={`text-sm font-medium ${activo ? "text-slate-800 dark:text-slate-200" : "text-slate-400 dark:text-slate-600"}`}>
                            {mod.label}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">{mod.key}</p>
                        </div>
                      </div>
                      {canToggle ? (
                        activo ? (
                          <ToggleRight className={`w-5 h-5 ${c.text} flex-shrink-0`} />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                        )
                      ) : (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${c.badge}`}>
                          {mod.key}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {filteredCatalogo.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhuma suite encontrada para &quot;{search}&quot;</p>
        </div>
      )}
    </div>
  );
}
