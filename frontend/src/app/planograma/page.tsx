"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutGrid, Plus, Trash2, Sparkles, Loader2, Upload,
  CheckCircle2, XCircle, AlertTriangle, Image as ImageIcon,
  ChevronDown, ClipboardCheck, ScanLine, Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Estudo {
  id: number;
  nome: string;
  cliente_nome?: string;
}

interface Planogram {
  id: number;
  estudo_id: number;
  nome: string;
  descricao?: string;
  categoria?: string;
  imagem_url?: string;
  criado_em: string;
}

interface Visita {
  id: number;
  estabelecimento_nome?: string;
  estado: string;
  inserida_em?: string;
}

interface Foto {
  id: number;
  url: string;
  nome_ficheiro: string;
}

interface Comparacao {
  id: number;
  planogram_id: number;
  visita_id: number;
  foto_id?: number;
  score_compliance?: number;
  ia_analise?: string;
  ia_items_corretos?: string[];
  ia_items_errados?: string[];
  ia_items_faltando?: string[];
  ia_recomendacoes?: string;
  analisado_em?: string;
  criado_em: string;
}

// ── Score pill ────────────────────────────────────────────────────────────────

function ScorePill({ score }: { score?: number }) {
  if (score === undefined || score === null) return <span className="text-slate-400 text-sm">—</span>;
  const color =
    score >= 80 ? "bg-emerald-100 text-emerald-700" :
    score >= 60 ? "bg-yellow-100 text-yellow-700" :
    "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-sm ${color}`}>
      {score.toFixed(0)}%
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlanogramaPage() {
  const { t } = useI18n();
  const [estudos, setEstudos] = useState<Estudo[]>([]);
  const [estudoId, setEstudoId] = useState<number | null>(null);
  const [planograms, setPlanograms] = useState<Planogram[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // New planogram form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategoria, setNewCategoria] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comparison panel
  const [selectedPlanogram, setSelectedPlanogram] = useState<Planogram | null>(null);
  const [selectedVisita, setSelectedVisita] = useState<number | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [selectedFoto, setSelectedFoto] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [comparacoes, setComparacoes] = useState<Comparacao[]>([]);
  const [loadingComp, setLoadingComp] = useState(false);

  // Load estudos on mount
  useEffect(() => {
    api.get<Estudo[]>("/estudos").then(r => setEstudos(r)).catch(() => {});
  }, []);

  const loadPlanograms = useCallback(async (eid: number) => {
    setLoading(true);
    try {
      const r = await api.get<Planogram[]>(`/planogramas/?estudo_id=${eid}`);
      setPlanograms(r);
    } catch {}
    setLoading(false);
  }, []);

  const loadVisitas = useCallback(async (eid: number) => {
    try {
      const r = await api.get<any>(`/visitas?estudo_id=${eid}&limit=100`);
      setVisitas(r.items ?? r);
    } catch {}
  }, []);

  useEffect(() => {
    if (estudoId) {
      loadPlanograms(estudoId);
      loadVisitas(estudoId);
    }
  }, [estudoId, loadPlanograms, loadVisitas]);

  const loadFotos = useCallback(async (visitaId: number) => {
    setFotos([]);
    setSelectedFoto(null);
    try {
      const r = await api.get<Foto[]>(`/visitas/${visitaId}/fotos`);
      setFotos(r);
    } catch {}
  }, []);

  useEffect(() => {
    if (selectedVisita) loadFotos(selectedVisita);
  }, [selectedVisita, loadFotos]);

  const loadComparacoes = useCallback(async (visitaId: number) => {
    setLoadingComp(true);
    setComparacoes([]);
    try {
      const r = await api.get<Comparacao[]>(`/planogramas/visita/${visitaId}`);
      setComparacoes(r);
    } catch {}
    setLoadingComp(false);
  }, []);

  const handleCreate = async () => {
    if (!newNome.trim() || !estudoId) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("estudo_id", String(estudoId));
    fd.append("nome", newNome.trim());
    if (newDesc) fd.append("descricao", newDesc);
    if (newCategoria) fd.append("categoria", newCategoria);
    if (newFile) fd.append("imagem", newFile);
    try {
      await api.upload<Planogram>("/planogramas/", fd);
      setNewNome(""); setNewDesc(""); setNewCategoria(""); setNewFile(null);
      setShowNewForm(false);
      loadPlanograms(estudoId!);
    } catch (e: any) {
      alert(e?.message || "Erro ao criar planograma.");
    }
    setUploading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminar planograma?")) return;
    try {
      await api.delete(`/planogramas/${id}`);
      setPlanograms(prev => prev.filter(p => p.id !== id));
      if (selectedPlanogram?.id === id) setSelectedPlanogram(null);
    } catch {}
  };

  const handleComparar = async () => {
    if (!selectedPlanogram || !selectedVisita || !selectedFoto) return;
    setAnalyzing(true);
    try {
      await api.post(`/planogramas/${selectedPlanogram.id}/comparar`, {
        visita_id: selectedVisita,
        foto_id: selectedFoto,
      });
      await loadComparacoes(selectedVisita);
    } catch (e: any) {
      alert(e?.message || "Erro na análise.");
    }
    setAnalyzing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-700 flex items-center justify-center">
              <LayoutGrid className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{t("planograma.title")}</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase tracking-wide">Wave 8</span>
          </div>
          <p className="text-slate-500 text-sm">Comparação automática entre planograma de referência e fotos reais de prateleira via GPT-4o Vision.</p>
        </div>
        {estudoId && (
          <button
            onClick={() => setShowNewForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Planograma
          </button>
        )}
      </div>

      {/* Study selector */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <label className="block text-xs font-semibold text-slate-500 mb-2">Seleccionar Estudo</label>
        <select
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={estudoId ?? ""}
          onChange={e => {
            const v = Number(e.target.value);
            setEstudoId(v || null);
            setSelectedPlanogram(null);
            setSelectedVisita(null);
          }}
        >
          <option value="">— Escolher estudo —</option>
          {estudos.map(e => (
            <option key={e.id} value={e.id}>{e.nome}{e.cliente_nome ? ` (${e.cliente_nome})` : ""}</option>
          ))}
        </select>
      </div>

      {/* New planogram form */}
      {showNewForm && estudoId && (
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-5 space-y-3">
          <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-indigo-600" />{t("planograma.newPlanograma")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Nome *</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={newNome} onChange={e => setNewNome(e.target.value)}
                placeholder="ex: Planograma Bebidas Q1 2026"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Categoria</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={newCategoria} onChange={e => setNewCategoria(e.target.value)}
                placeholder="ex: loja, callcenter, digital"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Descrição</label>
            <textarea
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={2} value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder={t("planograma.descriptionPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Imagem de referência</label>
            <div
              className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {newFile ? (
                <p className="text-sm text-indigo-600 font-medium">{newFile.name} ({(newFile.size / 1024).toFixed(0)} KB)</p>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Upload className="w-6 h-6 text-slate-400" />
                  <p className="text-sm text-slate-500">Clica para seleccionar imagem (JPEG / PNG / WebP, máx 20 MB)</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => setNewFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNewForm(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50">Cancelar</button>
            <button
              onClick={handleCreate}
              disabled={uploading || !newNome.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Criar Planograma
            </button>
          </div>
        </div>
      )}

      {/* Planogram grid */}
      {estudoId && (
        <div>
          <h2 className="text-sm font-semibold text-slate-600 mb-3">{t("planograma.studyPlanogramas")}</h2>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
          ) : planograms.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
              <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Nenhum planograma. Cria um para começar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {planograms.map(p => (
                <div
                  key={p.id}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${selectedPlanogram?.id === p.id ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200"}`}
                  onClick={() => { setSelectedPlanogram(p); setSelectedVisita(null); setComparacoes([]); }}
                >
                  {p.imagem_url ? (
                    <div className="h-36 bg-slate-100 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-36 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                      <ImageIcon className="w-10 h-10 text-slate-300" />
                    </div>
                  )}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{p.nome}</p>
                        {p.categoria && <p className="text-xs text-slate-500">{p.categoria}</p>}
                        {p.descricao && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{p.descricao}</p>}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(p.id); }}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 flex-shrink-0"
                        title={t("planograma.deletePlanogram")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Comparison panel */}
      {selectedPlanogram && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-slate-800">Análise de Conformidade — {selectedPlanogram.nome}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Visit selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Visita a comparar</label>
              <select
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={selectedVisita ?? ""}
                onChange={e => {
                  const v = Number(e.target.value);
                  setSelectedVisita(v || null);
                  if (v) loadComparacoes(v);
                }}
              >
                <option value="">— Escolher visita —</option>
                {visitas.map(v => (
                  <option key={v.id} value={v.id}>
                    #{v.id} — {v.estabelecimento_nome || "Sem nome"} ({v.estado})
                  </option>
                ))}
              </select>
            </div>

            {/* Photo selector */}
            {fotos.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Foto da visita</label>
                <select
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={selectedFoto ?? ""}
                  onChange={e => setSelectedFoto(Number(e.target.value) || null)}
                >
                  <option value="">— Escolher foto —</option>
                  {fotos.map(f => (
                    <option key={f.id} value={f.id}>{f.nome_ficheiro}</option>
                  ))}
                </select>
              </div>
            )}
            {selectedVisita && fotos.length === 0 && (
              <div className="flex items-center gap-2 text-slate-400 text-sm pt-6">
                <Info className="w-4 h-4" /> Esta visita não tem fotos.
              </div>
            )}
          </div>

          {/* Side-by-side preview */}
          {selectedVisita && selectedFoto && (() => {
            const foto = fotos.find(f => f.id === selectedFoto);
            return (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">{t("planograma.reference")}</p>
                  {selectedPlanogram.imagem_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedPlanogram.imagem_url} alt="Planograma" className="rounded-xl border border-slate-200 w-full object-cover max-h-52" />
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 h-36 flex items-center justify-center bg-slate-50">
                      <ImageIcon className="w-8 h-8 text-slate-300" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">Foto da Visita</p>
                  {foto?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={foto.url} alt="Foto visita" className="rounded-xl border border-slate-200 w-full object-cover max-h-52" />
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 h-36 flex items-center justify-center bg-slate-50">
                      <ScanLine className="w-8 h-8 text-slate-300" />
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <button
            onClick={handleComparar}
            disabled={analyzing || !selectedVisita || !selectedFoto}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {analyzing ? "A analisar com GPT-4o Vision…" : "Analisar Conformidade"}
          </button>

          {/* Previous comparisons */}
          {selectedVisita && (loadingComp || comparacoes.length > 0) && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Resultados desta Visita</h3>
              {loadingComp ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
              ) : (
                <div className="space-y-3">
                  {comparacoes.map(c => (
                    <div key={c.id} className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="w-4 h-4 text-indigo-500" />
                          <span className="font-semibold text-sm text-slate-700">Score de Conformidade</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ScorePill score={c.score_compliance} />
                          {c.analisado_em && (
                            <span className="text-xs text-slate-400">{new Date(c.analisado_em).toLocaleString("pt-PT")}</span>
                          )}
                        </div>
                      </div>

                      {c.ia_analise && (
                        <p className="text-sm text-slate-600 leading-relaxed">{c.ia_analise}</p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {c.ia_items_corretos && c.ia_items_corretos.length > 0 && (
                          <div className="bg-emerald-50 rounded-lg p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-xs font-semibold text-emerald-700">Conformes ({c.ia_items_corretos.length})</span>
                            </div>
                            <ul className="space-y-0.5">
                              {c.ia_items_corretos.map((item, i) => (
                                <li key={i} className="text-xs text-emerald-700">• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {c.ia_items_errados && c.ia_items_errados.length > 0 && (
                          <div className="bg-red-50 rounded-lg p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              <XCircle className="w-3.5 h-3.5 text-red-600" />
                              <span className="text-xs font-semibold text-red-700">Incorrectos ({c.ia_items_errados.length})</span>
                            </div>
                            <ul className="space-y-0.5">
                              {c.ia_items_errados.map((item, i) => (
                                <li key={i} className="text-xs text-red-700">• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {c.ia_items_faltando && c.ia_items_faltando.length > 0 && (
                          <div className="bg-yellow-50 rounded-lg p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-yellow-600" />
                              <span className="text-xs font-semibold text-yellow-700">Em Falta ({c.ia_items_faltando.length})</span>
                            </div>
                            <ul className="space-y-0.5">
                              {c.ia_items_faltando.map((item, i) => (
                                <li key={i} className="text-xs text-yellow-700">• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {c.ia_recomendacoes && (
                        <div className="bg-indigo-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-indigo-700 mb-1">{t("planograma.recommendations")}</p>
                          <p className="text-xs text-indigo-700 leading-relaxed">{c.ia_recomendacoes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!estudoId && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <LayoutGrid className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">Selecciona um estudo para gerir planogramas.</p>
          <p className="text-slate-400 text-sm mt-1">Carrega imagens de referência e compara com fotos reais via GPT-4o Vision.</p>
        </div>
      )}
    </div>
  );
}
