"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Loader2, ArrowLeft, Save } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface ModuloItem { key: string; label: string; }
interface Plano { id: string; label: string; descricao: string; cor: string; modulos: ModuloItem[]; }
interface ClienteModulosResp {
  cliente_id: number;
  catalogo: Plano[];
  flags: Record<string, boolean>;
}

const COR_CLASSES: Record<string, string> = {
  blue:    "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
  orange:  "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800",
  emerald: "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800",
  violet:  "bg-violet-50 border-violet-200 dark:bg-violet-900/20 dark:border-violet-800",
  rose:    "bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800",
  amber:   "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",
  teal:    "bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800",
  sky:     "bg-sky-50 border-sky-200 dark:bg-sky-900/20 dark:border-sky-800",
};

const DOT_CLASSES: Record<string, string> = {
  blue: "bg-blue-500", orange: "bg-orange-500", emerald: "bg-emerald-500",
  violet: "bg-violet-500", rose: "bg-rose-500", amber: "bg-amber-500",
  teal: "bg-teal-500", sky: "bg-sky-500",
};

export default function ClienteModulosPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const clienteId = Number(id);

  const [data, setData] = useState<ClienteModulosResp | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    api.get<ClienteModulosResp>(`/clientes/${clienteId}/modulos`)
      .then((res) => {
        setData(res);
        setFlags(res.flags);
        // Expand all planos by default
        setExpanded(new Set(res.catalogo.map(p => p.id)));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clienteId, router]);

  /** Toggle all modules in a plano. */
  const togglePlano = useCallback((plano: Plano, active: boolean) => {
    setFlags(prev => {
      const next = { ...prev };
      plano.modulos.forEach(m => { next[m.key] = active; });
      return next;
    });
  }, []);

  /** Toggle a single module. */
  const toggleModulo = useCallback((key: string, active: boolean) => {
    setFlags(prev => ({ ...prev, [key]: active }));
  }, []);

  const planoActive = (plano: Plano) =>
    plano.modulos.some(m => flags[m.key] !== false);

  const planoFull = (plano: Plano) =>
    plano.modulos.every(m => flags[m.key] !== false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const body = Object.entries(flags).map(([modulo, activo]) => ({ modulo, activo }));
      await api.put(`/clientes/${clienteId}/modulos`, body);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      alert((e as Error).message ?? "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );

  if (error) return (
    <div className="p-8 text-red-600">{error}</div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/clientes")}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Módulos do Cliente
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Activa ou desactiva planos e módulos individuais para este cliente
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {saved && (
            <span className="text-sm text-emerald-600 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> Guardado
            </span>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#2D6BEE] hover:bg-[#1A52CC] text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>

      {/* Planos */}
      <div className="space-y-3">
        {data?.catalogo.map((plano) => {
          const isOpen = expanded.has(plano.id);
          const active = planoActive(plano);
          const full = planoFull(plano);
          const partial = active && !full;
          const corCard = COR_CLASSES[plano.cor] ?? COR_CLASSES.blue;
          const corDot = DOT_CLASSES[plano.cor] ?? DOT_CLASSES.blue;

          return (
            <div key={plano.id} className={`border rounded-xl overflow-hidden ${corCard}`}>
              {/* Plano header */}
              <div className="flex items-center gap-3 px-5 py-4">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${corDot} ${!active ? "opacity-30" : ""}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm leading-tight">
                    {plano.label}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{plano.descricao}</p>
                </div>

                {/* Plano toggle */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    full ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                         : partial ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                         : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}>
                    {full ? "Activo" : partial ? "Parcial" : "Inactivo"}
                  </span>
                  <button
                    onClick={() => togglePlano(plano, !full)}
                    className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none overflow-hidden ${
                      active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                    }`}
                    title={active ? "Desactivar plano" : "Activar plano"}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      active ? "translate-x-5" : "translate-x-0"
                    }`} />
                  </button>
                  <button
                    onClick={() => setExpanded(prev => {
                      const next = new Set(prev);
                      isOpen ? next.delete(plano.id) : next.add(plano.id);
                      return next;
                    })}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Module list */}
              {isOpen && (
                <div className="border-t border-current/10 bg-white/50 dark:bg-black/10 divide-y divide-current/5">
                  {plano.modulos.map((mod) => {
                    const modActive = flags[mod.key] !== false;
                    return (
                      <div key={mod.key} className="flex items-center gap-3 px-6 py-2.5">
                        {modActive
                          ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          : <XCircle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                        }
                        <span className={`flex-1 text-sm ${modActive ? "text-slate-800 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}`}>
                          {mod.label}
                        </span>
                        <code className="text-[10px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {mod.key}
                        </code>
                        <button
                          onClick={() => toggleModulo(mod.key, !modActive)}
                          className={`relative w-8 h-4 rounded-full transition-colors focus:outline-none overflow-hidden ${
                            modActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                          }`}
                          title={modActive ? "Desactivar" : "Activar"}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                            modActive ? "translate-x-4" : "translate-x-0"
                          }`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom save */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#2D6BEE] hover:bg-[#1A52CC] text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar alterações
        </button>
      </div>
    </div>
  );
}
