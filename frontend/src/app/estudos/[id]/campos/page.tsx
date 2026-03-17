"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X, Save, ChevronUp, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Campo {
  chave: string;
  label: string;
  tipo: "text" | "number" | "select" | "boolean";
  opcoes: string[];
  obrigatorio: boolean;
}

interface Estudo { id: number; nome: string; }

const TIPO_OPTIONS = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "select", label: "Seleção" },
  { value: "boolean", label: "Sim/Não" },
] as const;

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

const blank = (): Campo => ({ chave: "", label: "", tipo: "text", opcoes: [], obrigatorio: false });

export default function CamposConfigPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const estudoId = params.id as string;

  const [estudo, setEstudo] = useState<Estudo | null>(null);
  const [campos, setCampos] = useState<Campo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }

    Promise.all([
      api.get<Estudo>(`/estudos/${estudoId}`),
      api.get<Campo[]>(`/estudos/${estudoId}/campos`),
      api.get<{ role_global: string }>("/auth/me"),
    ])
      .then(([e, c, me]) => {
        const r = (me as { role_global: string }).role_global;
        if (!["admin", "coordenador"].includes(r)) {
          router.replace(`/estudos/${estudoId}`);
          return;
        }
        setEstudo(e);
        setCampos(c.length ? c : []);
      })
      .catch(() => router.replace(`/estudos/${estudoId}`))
      .finally(() => setLoading(false));
  }, [estudoId, router]);

  function updateCampo(idx: number, patch: Partial<Campo>) {
    setCampos(prev =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const updated = { ...c, ...patch };
        // Auto-generate chave from label if chave was auto-derived
        if ("label" in patch && (!c.chave || c.chave === slugify(c.label))) {
          updated.chave = slugify(patch.label ?? "");
        }
        return updated;
      })
    );
    setSaved(false);
  }

  function move(idx: number, dir: -1 | 1) {
    setCampos(prev => {
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
    setSaved(false);
  }

  function removeCampo(idx: number) {
    setCampos(prev => prev.filter((_, i) => i !== idx));
    setSaved(false);
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      for (const c of campos) {
        if (!c.chave || !c.label) {
          setError("Todos os campos precisam de chave e etiqueta.");
          return;
        }
      }
      const chaves = campos.map(c => c.chave);
      if (new Set(chaves).size !== chaves.length) {
        setError("Chaves duplicadas. Cada campo precisa de uma chave única.");
        return;
      }
      const result = await api.put<Campo[]>(`/estudos/${estudoId}/campos`, campos);
      setCampos(result);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link
        href={`/estudos/${estudoId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        {estudo?.nome ?? `Estudo #${estudoId}`}
      </Link>

      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Configurar campos</h1>
          <p className="text-xs text-slate-500 mt-1">
            Defina os campos de caracterização das visitas para este estudo.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-[#2D6BEE] hover:bg-[#e02d00] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm flex-shrink-0"
        >
          <Save className="w-4 h-4" />
          {saving ? "A guardar…" : t("common.save")}
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">
          Configuração guardada com sucesso.
        </div>
      )}

      {/* Column headers */}
      {campos.length > 0 && (
        <div className="grid grid-cols-[1fr_1.2fr_96px_auto] gap-2 px-3 mb-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Chave</span>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Etiqueta</span>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Tipo</span>
          <span />
        </div>
      )}

      <div className="space-y-2 mb-4">
        {campos.map((c, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2">
            <div className="grid grid-cols-[1fr_1.2fr_96px_auto] gap-2 items-center">
              <input
                value={c.chave}
                onChange={e => updateCampo(idx, { chave: e.target.value })}
                placeholder="chave_interna"
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2D6BEE]/40 w-full min-w-0"
              />
              <input
                value={c.label}
                onChange={e => updateCampo(idx, { label: e.target.value })}
                placeholder="Etiqueta visível"
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2D6BEE]/40 w-full min-w-0"
              />
              <select
                value={c.tipo}
                onChange={e => updateCampo(idx, { tipo: e.target.value as Campo["tipo"] })}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2D6BEE]/40"
              >
                {TIPO_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                <label className="flex items-center gap-1 cursor-pointer" title="Obrigatório">
                  <input
                    type="checkbox"
                    checked={c.obrigatorio}
                    onChange={e => updateCampo(idx, { obrigatorio: e.target.checked })}
                    className="rounded accent-[#2D6BEE]"
                  />
                  <span className="text-xs text-slate-500 hidden sm:inline">Obrig.</span>
                </label>
                <div className="flex flex-col mx-0.5">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    title={t("estudos.moveUp")}
                    className="text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === campos.length - 1}
                    title={t("estudos.moveDown")}
                    className="text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeCampo(idx)}
                  title={t("common.removeField")}
                  className="text-slate-300 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {c.tipo === "select" && (
              <div className="flex items-start gap-2 pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500 flex-shrink-0 pt-1.5">Opções:</span>
                <div className="flex-1">
                  <input
                    value={c.opcoes.join(", ")}
                    onChange={e =>
                      updateCampo(idx, {
                        opcoes: e.target.value
                          .split(",")
                          .map(s => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Opção 1, Opção 2, Opção 3"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2D6BEE]/40"
                  />
                  <p className="text-xs text-slate-400 mt-1">Separadas por vírgula</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => { setCampos(prev => [...prev, blank()]); setSaved(false); }}
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-[#2D6BEE] border border-dashed border-slate-300 hover:border-[#2D6BEE]/50 rounded-xl px-4 py-2.5 w-full justify-center transition-colors"
      >
        <Plus className="w-4 h-4" /> Adicionar campo
      </button>

      {campos.length === 0 && (
        <p className="text-center text-sm text-slate-400 mt-4">
          Nenhum campo configurado ainda.
        </p>
      )}
    </div>
  );
}
