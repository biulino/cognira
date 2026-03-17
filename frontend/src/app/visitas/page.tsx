"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ClipboardList, Filter, Pencil, X, ChevronDown, ChevronUp,
  Search, ChevronLeft, ChevronRight, Download, Image, Upload, Trash2, Sparkles, AlertTriangle, CheckCircle2, Camera,
  WifiOff, MapPin, ShieldCheck, RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { useOfflineSync, useGeolocation } from "@/hooks/useOfflineSync";
import { useOfflineDraft, VisitaDraft } from "@/hooks/useOfflineDraft";
import { useI18n } from "@/lib/i18n";

// ── Types ────────────────────────────────────────────────
interface Estudo { id: number; nome: string; }
interface Onda   { id: number; estudo_id: number; label: string; }
interface Analista { id: number; nome: string; codigo_externo: string | null; }
interface Grelha { id: number; estudo_id: number; nome: string; tipo_visita: string | null; }

interface Visita {
  id: number;
  estudo_id: number;
  estado: string;
  tipo_visita: string;
  grelha_id: number | null;
  grelha_nome: string | null;
  pontuacao: number | null;
  pontuacao_estado: string;
  ia_veredicto: string | null;
  ia_mensagem: string | null;
  ia_critica_em: string | null;
  estabelecimento_id: number;
  estabelecimento_nome: string | null;
  analista_id: number | null;
  analista_nome: string | null;
  analista_codigo: string | null;
  onda_id: number | null;
  onda_label: string | null;
  planeada_em: string | null;
  realizada_inicio: string | null;
  realizada_fim: string | null;
  inserida_em: string | null;
  validada_em: string | null;
  caracterizacao: Record<string, string> | null;
  fotos_count: number;
}
interface VisitaListResponse {
  items: Visita[];
  total: number;
  page: number;
  page_size: number;
}
interface VisitaStats {
  total: number;
  por_estado: Record<string, number>;
  pontuacao_media: number | null;
}

// ── Helpers ──────────────────────────────────────────────
const STATE_COLORS: Record<string, string> = {
  fechada:          "bg-emerald-100 text-emerald-700",
  validada:         "bg-blue-100 text-blue-700",
  inserida:         "bg-yellow-100 text-yellow-700",
  nova:             "bg-slate-100 text-slate-600",
  planeada:         "bg-purple-100 text-purple-700",
  anulada:          "bg-red-100 text-red-600",
  corrigir:         "bg-orange-100 text-orange-700",
  corrigida:        "bg-teal-100 text-teal-700",
  para_alteracao:   "bg-amber-100 text-amber-700",
  situacao_especial:"bg-pink-100 text-pink-700",
  sem_alteracoes:   "bg-slate-100 text-slate-500",
};
const ESTADO_LABELS: Record<string, string> = {
  nova: "Nova", planeada: "Planeada", inserida: "Inserida",
  validada: "Validada", fechada: "Fechada", anulada: "Anulada",
  corrigir: "A Corrigir", corrigida: "Corrigida",
  para_alteracao: "Para Alteração", situacao_especial: "Situação Especial",
  sem_alteracoes: "Sem Alterações",
};
const FILTER_ESTADOS = ["","nova","planeada","inserida","validada","fechada","anulada","corrigir","corrigida","para_alteracao","situacao_especial","sem_alteracoes"];

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Sub-components ───────────────────────────────────────
function Badge({ estado }: { estado: string }) {
  const cls = STATE_COLORS[estado] ?? "bg-slate-100 text-slate-500";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cls}`}>
      {ESTADO_LABELS[estado] ?? estado}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: score + "%" }} />
      </div>
      <span className="text-xs font-semibold text-slate-600">{score.toFixed(0)}%</span>
    </div>
  );
}

const STATS_ORDER = ["nova","planeada","inserida","corrigir","corrigir_email","corrigida","para_alteracao","sem_alteracoes","situacao_especial","validada","fechada","anulada"];

function StatsStrip({ stats }: { stats: VisitaStats }) {
  const ordered = STATS_ORDER
    .map(s => ({ key: s, count: stats.por_estado[s] ?? 0 }))
    .filter(x => x.count > 0);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      <div className="overflow-x-auto px-4 py-3">
        <div className="flex items-center gap-0.5 min-w-max">
          <div className="flex items-center gap-1.5 pr-3 border-r border-slate-100 mr-2">
            <span className="text-sm font-bold text-slate-800">{stats.total.toLocaleString("pt-PT")}</span>
            <span className="text-xs text-slate-400">visitas</span>
          </div>
          {ordered.map(({ key, count }) => {
            const pct = stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : "0";
            const cls = STATE_COLORS[key] ?? "bg-slate-100 text-slate-500";
            return (
              <div key={key} className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${cls}`}>
                  {ESTADO_LABELS[key] ?? key}
                </span>
                <span className="text-xs font-semibold text-slate-700 tabular-nums">{count.toLocaleString("pt-PT")}</span>
                <span className="text-[10px] text-slate-400 tabular-nums">({pct}%)</span>
              </div>
            );
          })}
          {stats.pontuacao_media != null && (
            <div className="flex items-center gap-1.5 pl-3 border-l border-slate-100 ml-2">
              <span className="text-xs text-slate-400">média</span>
              <span className={`text-xs font-bold ${
                stats.pontuacao_media >= 80 ? "text-emerald-600"
                : stats.pontuacao_media >= 60 ? "text-yellow-600"
                : "text-red-500"
              }`}>
                {stats.pontuacao_media.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CaractCell({ data }: { data: Record<string, string> | null }) {
  const [open, setOpen] = useState(false);
  if (!data) return <span className="text-slate-300 text-xs">—</span>;
  const entries = Object.entries(data).filter(([, v]) => v);
  if (!entries.length) return <span className="text-slate-300 text-xs">—</span>;
  const previewVals = entries.slice(0, 4).map(([, v]) => String(v)).join(" · ");
  const hasMore = entries.length > 4;
  return (
    <div className="max-w-[220px]">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-start gap-1 text-xs text-slate-600 hover:text-[#2D6BEE] text-left transition-colors w-full"
      >
        <span className="line-clamp-2 flex-1">{previewVals}{hasMore ? ` +${entries.length - 4}` : ""}</span>
        {open ? <ChevronUp className="w-3 h-3 flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-3 h-3 flex-shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="mt-1.5 p-2.5 bg-white border border-slate-200 rounded-lg shadow-lg text-xs space-y-1 z-20 relative min-w-[200px]">
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-start gap-2">
              <span className="text-slate-400 flex-shrink-0 min-w-[70px]">{k}:</span>
              <span className="text-slate-700 font-medium">{String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 50;

// ── Edit modal ───────────────────────────────────────────
const ALL_ESTADOS = ["nova","planeada","inserida","validada","fechada","anulada","corrigir","corrigida","para_alteracao","situacao_especial","sem_alteracoes"];

// ── Fotos Modal ──────────────────────────────────────────
interface Foto { id: number; visita_id: number; nome_ficheiro: string; tamanho: number | null; mime_type: string | null; url: string; }

function FotosModal({ visita, onClose }: { visita: Visita; onClose: () => void }) {
  const [fotos, setFotos]       = useState<Foto[]>([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<Foto | null>(null);
  const { online, pendingCount } = useOfflineSync();
  const { capture } = useGeolocation();
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Open the native camera by programmatically clicking a hidden input with capture set.
  // Using a button + programmatic click (not a <label>) ensures iOS WebKit correctly
  // reads the capture attribute at trigger time.
  function openCamera() {
    const el = cameraInputRef.current;
    if (!el) return;
    el.setAttribute("capture", "environment");
    el.setAttribute("accept", "image/*");
    el.click();
  }

  useEffect(() => {
    api.get<Foto[]>(`/visitas/${visita.id}/fotos`).then(setFotos).catch(() => {}).finally(() => setLoading(false));
  }, [visita.id]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      // Capture geolocation and attach as metadata
      try {
        const geo = await capture();
        form.append("latitude", String(geo.lat));
        form.append("longitude", String(geo.lng));
      } catch { /* geo optional */ }
      const res = await api.upload<Foto & { queued?: boolean }>(`/visitas/${visita.id}/fotos`, form);
      if ((res as any).queued) {
        alert("Foto guardada offline — será enviada quando houver rede.");
      } else {
        setFotos(prev => [...prev, res]);
      }
    } catch (ex: any) { alert(ex?.message ?? "Erro ao fazer upload"); }
    finally { setUploading(false); e.target.value = ""; }
  }

  async function deleteFoto(foto: Foto) {
    if (!confirm("Eliminar esta foto?")) return;
    try {
      await api.delete(`/visitas/${visita.id}/fotos/${foto.id}`);
      setFotos(prev => prev.filter(f => f.id !== foto.id));
    } catch (ex: any) { alert(ex?.message ?? "Erro"); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-60 flex items-center justify-center" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.url} alt={lightbox.nome_ficheiro} className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Offline banner */}
        {(!online || pendingCount > 0) && (
          <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-xs text-amber-700 flex-shrink-0">
            <WifiOff className="w-3.5 h-3.5" />
            {!online ? "Modo offline — fotos serão enviadas quando houver rede" : `${pendingCount} upload(s) pendente(s)`}
          </div>
        )}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-slate-800">Fotos da visita #{visita.id}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{fotos.length} foto{fotos.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Camera capture – mobile native camera */}
            <button
              type="button"
              onClick={openCamera}
              disabled={uploading}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${uploading ? "opacity-50 pointer-events-none" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}
              title="Tirar foto com câmara">
              <Camera className="w-3.5 h-3.5" /> Câmara
            </button>
            <input ref={cameraInputRef} type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
            {/* File picker – gallery / filesystem */}
            <label className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${uploading ? "opacity-50 pointer-events-none" : "bg-blue-600 hover:bg-blue-500 text-white"}`}>
              <Upload className="w-3.5 h-3.5" /> {uploading ? "A enviar…" : "Galeria"}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => <div key={i} className="aspect-square rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : fotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Image className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">Sem fotos. Use o botão Upload para adicionar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {fotos.map(f => (
                <div key={f.id} className="group relative aspect-square rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={f.nome_ficheiro} className="w-full h-full object-cover cursor-pointer" onClick={() => setLightbox(f)} />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-end justify-between p-2 opacity-0 group-hover:opacity-100">
                    <span className="text-white text-[10px] truncate max-w-[80%]">{f.nome_ficheiro}</span>
                    <button onClick={() => deleteFoto(f)} className="p-1 rounded-lg bg-red-500 hover:bg-red-600 text-white transition">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ───────────────────────────────────────────
function EditModal({ visita, onClose, onSaved, onDraftSaved }: {
  visita: Visita;
  onClose: () => void;
  onSaved: (updated: Visita) => void;
  onDraftSaved?: () => void;
}) {
  const { t } = useI18n();
  const [estado, setEstado] = useState(visita.estado);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const { online } = useOfflineSync();
  const { saveDraftFn } = useOfflineDraft();

  // Stored IA result (from server) — auto-displayed without button click
  const storedIa = visita.ia_veredicto ? {
    recomendacao: visita.ia_veredicto,
    mensagem_sugerida: visita.ia_mensagem ?? "",
    confianca: null as number | null,
    motivos: [] as string[],
  } : null;

  const [iaResult, setIaResult] = useState<{ recomendacao: string; confianca: number | null; motivos: string[]; mensagem_sugerida: string; alertas?: string[] } | null>(storedIa);
  const [iaLoading, setIaLoading] = useState(false);

  // Lock body scroll and handle Escape key while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When validator selects "corrigir" and there's an IA suggestion, offer to use it
  const iaSuggestion = iaResult?.mensagem_sugerida;

  async function runIaValidation() {
    setIaLoading(true);
    try {
      const res = await api.post<typeof iaResult>(`/visitas/${visita.id}/validar-ia`, {});
      setIaResult(res);
    } catch { /* IA not available */ }
    finally { setIaLoading(false); }
  }

  async function save() {
    if (!online) {
      // Persist as offline draft — will be synced when back online
      await saveDraftFn(
        `estado-${visita.id}-${Date.now()}`,
        `Visita #${visita.id}: ${visita.estado} → ${estado}`,
        { type: "estado_change", visitaId: visita.id, newEstado: estado, prevEstado: visita.estado, motivo: motivo || null }
      );
      onDraftSaved?.();
      onClose();
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const updated = await api.put<Visita>(`/visitas/${visita.id}/estado`, {
        estado,
        motivo_anulacao: motivo || null,
      });
      onSaved(updated);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h3 className="font-semibold text-slate-800">{t("visitas.editState")}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Visita #{visita.id}</label>
            <p className="text-xs text-slate-400">Estado actual: <Badge estado={visita.estado} /></p>
          </div>

          {/* Cognira Module 6 — Validation Assistant */}
          <div>
            <button
              onClick={runIaValidation}
              disabled={iaLoading}
              className="w-full flex items-center justify-center gap-2 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl px-3 py-2 transition disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {iaLoading ? "A analisar com IA…" : visita.ia_veredicto ? "Re-analisar com Cognira IA" : "Analisar com Cognira IA"}
            </button>
            {iaResult && !("erro" in iaResult) && (
              <div className={`mt-2 rounded-xl p-3 border text-xs ${
                iaResult.recomendacao === "aprovar" ? "bg-emerald-50 border-emerald-200" :
                iaResult.recomendacao === "corrigir" ? "bg-yellow-50 border-yellow-200" :
                "bg-red-50 border-red-200"
              }`}>
                <div className="flex items-center gap-2 mb-1.5 font-semibold">
                  {iaResult.recomendacao === "aprovar"
                    ? <><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-emerald-800">Recomendação: Aprovar</span></>
                    : iaResult.recomendacao === "corrigir"
                    ? <><AlertTriangle className="w-4 h-4 text-yellow-600" /><span className="text-yellow-800">Recomendação: Corrigir</span></>
                    : <><AlertTriangle className="w-4 h-4 text-red-600" /><span className="text-red-800">Recomendação: Rever</span></>
                  }
                  {iaResult.confianca != null && (
                    <span className="ml-auto text-slate-400">{Math.round(iaResult.confianca * 100)}% confiança</span>
                  )}
                  {visita.ia_critica_em && !iaLoading && (
                    <span className="ml-auto text-slate-400 text-[10px]">Auto-análise</span>
                  )}
                </div>
                {iaResult.motivos?.length > 0 && (
                  <ul className="space-y-0.5 text-slate-600 mb-2">
                    {iaResult.motivos.map((m, i) => <li key={i}>• {m}</li>)}
                  </ul>
                )}
                {iaResult.mensagem_sugerida && (
                  <p className="text-slate-500 italic border-t border-current/20 pt-1.5 mt-1">"{iaResult.mensagem_sugerida}"</p>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Novo estado</label>
            <select value={estado} onChange={e => setEstado(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30 focus:border-[#2D6BEE]">
              {ALL_ESTADOS.map(s => (
                <option key={s} value={s}>{ESTADO_LABELS[s] ?? s}</option>
              ))}
            </select>
          </div>
          {/* When marking corrigir and IA has a suggestion, offer to use it */}
          {(estado === "corrigir" || estado === "anulada") && iaSuggestion && estado !== "anulada" && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <p className="text-xs font-medium text-yellow-800 mb-1.5">Sugestão Cognira IA para o analista:</p>
              <p className="text-xs text-yellow-700 italic mb-2">"{iaSuggestion}"</p>
              <button
                onClick={() => setMotivo(iaSuggestion)}
                className="text-xs text-yellow-700 underline hover:text-yellow-900"
              >
                Usar esta mensagem
              </button>
            </div>
          )}
          {(estado === "corrigir" || estado === "anulada") && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                {estado === "corrigir" ? "Mensagem para o analista" : "Motivo (opcional)"}
              </label>
              <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
                placeholder={estado === "corrigir" && iaSuggestion ? "(deixar vazio usa a sugestão da IA)" : ""}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30 focus:border-[#2D6BEE] resize-none" />
            </div>
          )}
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
        {!online && (
          <div className="px-6 py-2 bg-amber-50 border-t border-amber-100 flex items-center gap-1.5 text-xs text-amber-700">
            <WifiOff className="w-3 h-3" />
            Offline — será guardado como rascunho para sincronizar depois
          </div>
        )}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition">
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 px-4 py-2 text-sm text-white bg-[#2D6BEE] hover:bg-[#1A52CC] rounded-xl font-medium transition disabled:opacity-50">
            {saving ? "A guardar…" : online ? "Guardar" : "Guardar offline"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────
function VisitasPageInner() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Reference data
  const [estudos, setEstudos]   = useState<Estudo[]>([]);
  const [ondas, setOndas]       = useState<Onda[]>([]);
  const [analistas, setAnalistas] = useState<Analista[]>([]);
  const [grelhasDisponiveis, setGrelhasDisponiveis] = useState<Grelha[]>([]);

  // Filter state — initialise from URL query params if present
  const [filterEstudo, setFilterEstudo]   = useState(() => searchParams.get("estudo_id") ?? "");
  const [filterEstado, setFilterEstado]   = useState("");
  const [filterOnda, setFilterOnda]       = useState(() => searchParams.get("onda_id") ?? "");
  const [filterAnalista, setFilterAnalista] = useState("");
  const [filterDataIni, setFilterDataIni] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");
  const [search, setSearch]               = useState("");
  const [showFilters, setShowFilters]     = useState(() => !!(searchParams.get("estudo_id") || searchParams.get("onda_id")));

  // Re-sync filter state from URL on browser back/forward navigation
  useEffect(() => {
    const urlEstudo = searchParams.get("estudo_id") ?? "";
    const urlOnda   = searchParams.get("onda_id") ?? "";
    setFilterEstudo(curr => curr !== urlEstudo ? urlEstudo : curr);
    setFilterOnda(curr => curr !== urlOnda ? urlOnda : curr);
  }, [searchParams]);

  // Results
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);

  // Edit modal
  const [editing, setEditing] = useState<Visita | null>(null);
  // Fotos modal
  const [fotosVisita, setFotosVisita] = useState<Visita | null>(null);

  // 8.1 — Offline drafts
  const { online } = useOfflineSync();
  const { drafts, removeDraft, refreshDrafts } = useOfflineDraft();
  interface ConflictState { draft: VisitaDraft; serverEstado: string; }
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [syncingDraft, setSyncingDraft] = useState<string | null>(null);
  // Cognira IA inline analysis
  const [iaLoading, setIaLoading] = useState<number | null>(null);
  const [iaResult, setIaResult] = useState<{ id: number; recomendacao: string; motivo: string } | null>(null);

  // 8E.3 Auto-QC
  interface QcFlag { tipo: string; descricao: string; severidade: string; }
  interface QcResult { veredicto: string; confianca: number; flags: QcFlag[]; recomendacao: string; necessita_revisao_humana: boolean; }
  const [qcLoading, setQcLoading] = useState<number | null>(null);
  const [qcResult, setQcResult] = useState<{ id: number } & QcResult | null>(null);

  async function runAutoQc(v: Visita) {
    setQcLoading(v.id);
    setQcResult(null);
    try {
      const r = await api.post<QcResult>(`/visitas/${v.id}/auto-qc`, {});
      setQcResult({ id: v.id, ...r });
    } catch {
      setQcResult({ id: v.id, veredicto: "erro", confianca: 0, flags: [], recomendacao: "Falha no Auto-QC", necessita_revisao_humana: false });
    } finally {
      setQcLoading(null);
    }
  }

  // Wave 6.3 — GPS proof-of-presence
  const [gpsLoading, setGpsLoading] = useState<number | null>(null);
  const [gpsResult, setGpsResult] = useState<{ id: number; distancia_m: number | null } | null>(null);

  async function runGpsCheckin(v: Visita) {
    if (!navigator.geolocation) { alert("Geolocalização não disponível neste dispositivo."); return; }
    setGpsLoading(v.id);
    setGpsResult(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await api.post<{ visita_id: number; distancia_m: number | null }>(
            `/visitas/${v.id}/gps-checkin`,
            { lat: pos.coords.latitude, lon: pos.coords.longitude }
          );
          setGpsResult({ id: v.id, distancia_m: r.distancia_m });
        } catch {
          setGpsResult({ id: v.id, distancia_m: null });
        } finally {
          setGpsLoading(null);
        }
      },
      () => {
        alert("Não foi possível obter a localização.");
        setGpsLoading(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const [stats, setStats] = useState<VisitaStats | null>(null);

  // ── Load reference data once ─────────────────────────
  useEffect(() => {
    api.get<Estudo[]>("/estudos/?page_size=200").then(setEstudos).catch(console.error);
    api.get<Analista[]>("/analistas/?page_size=500").then(setAnalistas).catch(console.error);
  }, []);

  // When estudo changes, reload ondas and grids
  useEffect(() => {
    if (filterEstudo) {
      api.get<Onda[]>(`/estudos/${filterEstudo}/ondas`).then(setOndas).catch(() => setOndas([]));
      api.get<Grelha[]>(`/estudos/${filterEstudo}/grelhas`).then(setGrelhasDisponiveis).catch(() => setGrelhasDisponiveis([]));
    } else {
      setOndas([]);
      setFilterOnda("");
      setGrelhasDisponiveis([]);
    }
  }, [filterEstudo]);

  // Load stats when estudo filter changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterEstudo) params.set("estudo_id", filterEstudo);
    api.get<VisitaStats>(`/visitas/stats?${params}`)
      .then(setStats)
      .catch(console.error);
  }, [filterEstudo]);

  // ── Load visitas ─────────────────────────────────────
  const load = useCallback(async (pg: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pg), page_size: String(PAGE_SIZE) });
      if (filterEstudo)   params.set("estudo_id", filterEstudo);
      if (filterEstado)   params.set("estado", filterEstado);
      if (filterOnda)     params.set("onda_id", filterOnda);
      if (filterAnalista) params.set("analista_id", filterAnalista);
      if (filterDataIni)  params.set("data_inicio", filterDataIni + "T00:00:00");
      if (filterDataFim)  params.set("data_fim", filterDataFim + "T23:59:59");
      if (search)         params.set("search", search);
      const data = await api.get<VisitaListResponse>(`/visitas/?${params}`);
      setVisitas(data.items);
      setTotal(data.total);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("401")) router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [filterEstudo, filterEstado, filterOnda, filterAnalista, filterDataIni, filterDataFim, search, router]);

  useEffect(() => { setPage(1); }, [filterEstudo, filterEstado, filterOnda, filterAnalista, filterDataIni, filterDataFim, search]);
  useEffect(() => { load(page); }, [page, load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const activeFilterCount = [filterEstudo, filterEstado, filterOnda, filterAnalista, filterDataIni, filterDataFim, search].filter(Boolean).length;

  function clearFilters() {
    setFilterEstudo(""); setFilterEstado(""); setFilterOnda("");
    setFilterAnalista(""); setFilterDataIni(""); setFilterDataFim(""); setSearch("");
  }

  async function syncDraft(draft: VisitaDraft) {
    const d = draft.data as { type: string; visitaId: number; newEstado: string; prevEstado: string; motivo: string | null };
    setSyncingDraft(draft.id);
    try {
      const current = await api.get<Visita>(`/visitas/${d.visitaId}`);
      if (current.estado !== d.prevEstado && current.estado !== d.newEstado) {
        setConflict({ draft, serverEstado: current.estado });
        setSyncingDraft(null);
        return;
      }
      await api.put(`/visitas/${d.visitaId}/estado`, { estado: d.newEstado, motivo_anulacao: d.motivo });
      await removeDraft(draft.id);
      load(page);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao sincronizar");
    } finally {
      setSyncingDraft(null);
    }
  }

  async function runIaAnalysis(v: Visita) {
    setIaLoading(v.id);
    setIaResult(null);
    try {
      const result = await api.post<{ recomendacao?: string; motivos?: string[]; motivo?: string; erro?: string }>(`/visitas/${v.id}/validar-ia`, {});
      if (result.erro) {
        setIaResult({ id: v.id, recomendacao: "erro", motivo: result.erro });
        return;
      }
      const motivo = result.motivos?.join("; ") ?? result.motivo ?? "";
      setIaResult({ id: v.id, recomendacao: result.recomendacao ?? "rever", motivo });
      // Update ia_veredicto in the list without a full reload
      setVisitas(prev => prev.map(x => x.id === v.id ? { ...x, ia_veredicto: result.recomendacao ?? null } : x));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha na análise IA";
      setIaResult({ id: v.id, recomendacao: "erro", motivo: msg });
    } finally {
      setIaLoading(null);
    }
  }

  async function downloadPdf(visitaId: number) {
    const token = localStorage.getItem("access_token");
    const res = await fetch(`/api/visitas/${visitaId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `visita_${visitaId}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header — single row on all screens */}
      <div className="flex items-center gap-2">
        {/* Icon + title (desktop) */}
        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
          <div className="p-2.5 bg-[#F0F5FF] rounded-xl">
            <ClipboardList className="w-5 h-5 text-[#2D6BEE]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Visitas</h1>
            {!loading && (
              <p className="text-xs text-slate-400 mt-0.5">
                {total.toLocaleString("pt-PT")} visita{total !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
        {/* Title only on mobile */}
        <h1 className="sm:hidden text-lg font-semibold text-slate-800 flex-shrink-0">Visitas</h1>
        {/* Search — flex-1, takes remaining space */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t("visitas.searchPlaceholder")}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30 focus:border-[#2D6BEE]"
          />
        </div>
        {/* Filters toggle */}
        <button
          onClick={() => setShowFilters(f => !f)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition flex-shrink-0 ${
            activeFilterCount > 0
              ? "bg-[#F0F5FF] border-[#2D6BEE]/30 text-[#1A52CC]"
              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filtros</span>
          {activeFilterCount > 0 && (
            <span className="bg-[#2D6BEE] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-semibold leading-none">
              {activeFilterCount}
            </span>
          )}
        </button>
        {/* Excel download — icon only */}
        <button
          onClick={async () => {
            const token = localStorage.getItem("access_token");
            const params = new URLSearchParams();
            if (filterEstudo) params.set("estudo_id", filterEstudo);
            if (filterOnda) params.set("onda_id", filterOnda);
            if (filterEstado) params.set("estado", filterEstado);
            const url = `/api/visitas/export/excel${params.toString() ? `?${params}` : ""}`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) return;
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `visitas${filterEstudo ? `_estudo${filterEstudo}` : ""}.xlsx`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
          }}
          title="Exportar Excel"
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition flex-shrink-0"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Estudo */}
            <select value={filterEstudo} onChange={e => setFilterEstudo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30 focus:border-[#2D6BEE]">
              <option value="">{t("visitas.allStudies")}</option>
              {estudos.map(e => <option key={e.id} value={String(e.id)}>{e.nome}</option>)}
            </select>
            {/* Estado */}
            <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30 focus:border-[#2D6BEE]">
              <option value="">{t("visitas.allStates")}</option>
              {FILTER_ESTADOS.filter(Boolean).map(s => (
                <option key={s} value={s}>{ESTADO_LABELS[s] ?? s}</option>
              ))}
            </select>
            {/* Onda */}
            <select value={filterOnda} onChange={e => setFilterOnda(e.target.value)}
              disabled={!ondas.length}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30 focus:border-[#2D6BEE] disabled:opacity-40">
              <option value="">{t("visitas.allWaves")}</option>
              {ondas.map(o => <option key={o.id} value={String(o.id)}>{o.label}</option>)}
            </select>
            {/* Analista */}
            <select value={filterAnalista} onChange={e => setFilterAnalista(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30 focus:border-[#2D6BEE]">
              <option value="">{t("visitas.allAnalysts")}</option>
              {analistas.map(a => (
                <option key={a.id} value={String(a.id)}>
                  {a.nome}{a.codigo_externo ? ` (${a.codigo_externo})` : ""}
                </option>
              ))}
            </select>
            {/* Data início */}
            <div>
              <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase tracking-wide">De</label>
              <input type="date" value={filterDataIni} onChange={e => setFilterDataIni(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30 focus:border-[#2D6BEE]" />
            </div>
            {/* Data fim */}
            <div>
              <label className="block text-[10px] font-medium text-slate-400 mb-1 uppercase tracking-wide">Até</label>
              <input type="date" value={filterDataFim} onChange={e => setFilterDataFim(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30 focus:border-[#2D6BEE]" />
            </div>
          </div>
          {activeFilterCount > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <button onClick={clearFilters}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#2D6BEE] transition">
                <X className="w-3.5 h-3.5" />
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stats strip */}
      {stats && <StatsStrip stats={stats} />}

      {/* Offline drafts panel — 8.1 */}
      {drafts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <WifiOff className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">
              {drafts.length} rascunho{drafts.length !== 1 ? "s" : ""} offline pendente{drafts.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="space-y-2">
            {drafts.map(draft => (
              <div key={draft.id} className="flex items-center justify-between gap-3 bg-white border border-amber-100 rounded-xl px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{draft.label}</p>
                  <p className="text-[10px] text-slate-400">{new Date(draft.savedAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => syncDraft(draft)}
                    disabled={!online || syncingDraft === draft.id}
                    title={online ? "Sincronizar agora" : "Sem rede"}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncingDraft === draft.id ? "animate-spin" : ""}`} />
                    Sync
                  </button>
                  <button
                    onClick={() => removeDraft(draft.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition"
                    title={t("visitas.deleteDraft")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#2D6BEE]/30 border-t-[#2D6BEE] rounded-full animate-spin" />
          </div>
        ) : visitas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <ClipboardList className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">{t("visitas.noVisitas")}</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Onda</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo/Grelha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Analista</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Estabelecimento</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("visitas.caract")}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Realizada</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Inserida</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Pontuação</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visitas.map(v => (
                    <>
                    <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">{v.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Badge estado={v.estado} />
                          {v.ia_veredicto && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-fit ${
                              v.ia_veredicto === "aprovar" ? "bg-emerald-100 text-emerald-700" :
                              v.ia_veredicto === "corrigir" ? "bg-yellow-100 text-yellow-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              IA: {v.ia_veredicto}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-[110px]">
                        <span className="truncate block">{v.onda_label ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[120px]">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] capitalize mb-0.5">{v.tipo_visita}</span>
                        {v.grelha_nome && <span className="truncate block text-slate-400 text-[10px]">{v.grelha_nome}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-700 font-medium truncate max-w-[120px]">
                          {v.analista_nome ?? "—"}
                        </div>
                        {v.analista_codigo && (
                          <div className="text-[10px] text-slate-400 font-mono">{v.analista_codigo}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-[130px]">
                        <span className="truncate block">{v.estabelecimento_nome ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <CaractCell data={v.caracterizacao} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {fmtDate(v.realizada_inicio)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {fmtDate(v.inserida_em)}
                      </td>
                      <td className="px-4 py-3 w-28">
                        {v.pontuacao != null && v.pontuacao_estado !== "nao_avaliada"
                          ? <ScoreBar score={v.pontuacao} />
                          : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setFotosVisita(v)}
                            className={`p-1.5 rounded-lg transition ${v.fotos_count > 0 ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50" : "text-red-400 hover:text-red-500 hover:bg-red-50"}`}
                            title={v.fotos_count > 0 ? `${v.fotos_count} foto(s)` : "Sem fotos"}>
                            <Image className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => downloadPdf(v.id)}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition"
                            title={t("visitas.exportPdf")}>
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditing(v)}
                            className="p-1.5 rounded-lg hover:bg-[#F0F5FF] text-slate-400 hover:text-[#2D6BEE] transition">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => runIaAnalysis(v)}
                            disabled={iaLoading === v.id}
                            className="p-1.5 rounded-lg hover:bg-violet-50 text-slate-400 hover:text-violet-600 transition disabled:opacity-40"
                            title="Analisar com Cognira IA">
                            {iaLoading === v.id
                              ? <span className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin block" />
                              : <Sparkles className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => runAutoQc(v)}
                            disabled={qcLoading === v.id}
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition disabled:opacity-40"
                            title="Auto-QC">
                            {qcLoading === v.id
                              ? <span className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin block" />
                              : <ShieldCheck className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => runGpsCheckin(v)}
                            disabled={gpsLoading === v.id}
                            className="p-1.5 rounded-lg hover:bg-teal-50 text-slate-400 hover:text-teal-600 transition disabled:opacity-40"
                            title="GPS Check-in">
                            {gpsLoading === v.id
                              ? <span className="w-3.5 h-3.5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin block" />
                              : <MapPin className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {iaResult?.id === v.id && (
                      <tr className="bg-violet-50/60">
                        <td colSpan={10} className="px-4 py-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                iaResult.recomendacao === "aprovar" ? "bg-emerald-100 text-emerald-700" :
                                iaResult.recomendacao === "corrigir" ? "bg-yellow-100 text-yellow-700" :
                                iaResult.recomendacao === "erro" ? "bg-red-100 text-red-600" :
                                "bg-red-100 text-red-700"
                              }`}>
                                <Sparkles className="w-3 h-3" />
                                Cognira: {iaResult.recomendacao}
                              </span>
                              <span className="text-xs text-slate-600">{iaResult.motivo}</span>
                            </div>
                            <button onClick={() => setIaResult(null)} className="text-slate-400 hover:text-slate-600 text-sm leading-none">&times;</button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {qcResult?.id === v.id && (
                      <tr className="bg-amber-50/60">
                        <td colSpan={10} className="px-4 py-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-col gap-1 w-full">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  qcResult.veredicto === "aprovado" ? "bg-emerald-100 text-emerald-700" :
                                  qcResult.veredicto === "suspeito" ? "bg-yellow-100 text-yellow-700" :
                                  qcResult.veredicto === "erro" ? "bg-red-100 text-red-600" :
                                  "bg-red-100 text-red-700"
                                }`}>
                                  <ShieldCheck className="w-3 h-3" />
                                  QC: {qcResult.veredicto} · {Math.round(qcResult.confianca * 100)}%
                                </span>
                                {qcResult.necessita_revisao_humana && (
                                  <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">Revisão humana necessária</span>
                                )}
                                <span className="text-xs text-slate-600">{qcResult.recomendacao}</span>
                              </div>
                              {qcResult.flags.length > 0 && (
                                <ul className="text-xs text-slate-600 space-y-0.5 mt-1">
                                  {qcResult.flags.map((f, i) => (
                                    <li key={i} className={`flex items-center gap-1.5 ${
                                      f.severidade === "alta" ? "text-red-600" :
                                      f.severidade === "média" ? "text-yellow-700" : "text-slate-500"
                                    }`}>
                                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                      <span className="font-medium">[{f.tipo}]</span> {f.descricao}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <button onClick={() => setQcResult(null)} className="text-slate-400 hover:text-slate-600 text-sm leading-none flex-shrink-0">&times;</button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {gpsResult?.id === v.id && (
                      <tr className="bg-teal-50/60">
                        <td colSpan={10} className="px-4 py-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                gpsResult.distancia_m === null
                                  ? "bg-slate-100 text-slate-600"
                                  : gpsResult.distancia_m <= 200
                                  ? "bg-emerald-100 text-emerald-700"
                                  : gpsResult.distancia_m <= 500
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                              }`}>
                                <MapPin className="w-3 h-3" />
                                GPS Check-in registado
                                {gpsResult.distancia_m !== null && ` · ${Math.round(gpsResult.distancia_m)}m do estabelecimento`}
                              </span>
                            </div>
                            <button onClick={() => setGpsResult(null)} className="text-slate-400 hover:text-slate-600 text-sm leading-none flex-shrink-0">&times;</button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-slate-100">
              {visitas.map(v => (
                <div key={v.id} className="flex flex-col">
                  <div className="px-4 py-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge estado={v.estado} />
                      <span className="text-xs text-slate-400 font-mono">#{v.id}</span>
                    </div>
                    {v.onda_label && (
                      <p className="text-xs text-slate-500 mb-0.5">{v.onda_label}</p>
                    )}
                    <p className="text-xs font-medium text-slate-700 truncate">
                      {v.analista_nome ?? "Analista desconhecido"}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{v.estabelecimento_nome ?? "—"}</p>
                    <p className="text-xs text-slate-400 mt-1">{fmtDate(v.realizada_inicio)}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setFotosVisita(v)}
                      className={`p-2 rounded-xl transition ${v.fotos_count > 0 ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50" : "text-red-400 hover:text-red-500 hover:bg-red-50"}`}
                      title={v.fotos_count > 0 ? `${v.fotos_count} foto(s)` : "Sem fotos"}>
                      <Image className="w-4 h-4" />
                    </button>
                    <button onClick={() => downloadPdf(v.id)}
                      className="p-2 rounded-xl hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition"
                      title="PDF">
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditing(v)}
                      className="p-2 rounded-xl hover:bg-[#F0F5FF] text-slate-400 hover:text-[#2D6BEE] transition">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => runIaAnalysis(v)}
                      disabled={iaLoading === v.id}
                      className="p-2 rounded-xl hover:bg-violet-50 text-slate-400 hover:text-violet-600 transition disabled:opacity-40"
                      title="Analisar com Cognira IA">
                      {iaLoading === v.id
                        ? <span className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin block" />
                        : <Sparkles className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => runAutoQc(v)}
                      disabled={qcLoading === v.id}
                      className="p-2 rounded-xl hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition disabled:opacity-40"
                      title="Auto-QC">
                      {qcLoading === v.id
                        ? <span className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin block" />
                        : <ShieldCheck className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {/* IA result panel — mobile */}
                {iaResult?.id === v.id && (
                  <div className="px-4 pb-3">
                    <div className="flex items-start justify-between gap-2 bg-violet-50 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          iaResult.recomendacao === "aprovar" ? "bg-emerald-100 text-emerald-700" :
                          iaResult.recomendacao === "corrigir" ? "bg-yellow-100 text-yellow-700" :
                          iaResult.recomendacao === "erro" ? "bg-red-100 text-red-600" :
                          "bg-red-100 text-red-700"
                        }`}>
                          <Sparkles className="w-3 h-3" />
                          Cognira: {iaResult.recomendacao}
                        </span>
                        {iaResult.motivo && <span className="text-xs text-slate-600 break-words">{iaResult.motivo}</span>}
                      </div>
                      <button onClick={() => setIaResult(null)} className="text-slate-400 hover:text-slate-600 text-base leading-none flex-shrink-0">&times;</button>
                    </div>
                  </div>
                )}
                {/* QC result panel — mobile */}
                {qcResult?.id === v.id && (
                  <div className="px-4 pb-3">
                    <div className="flex items-start justify-between gap-2 bg-amber-50 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          qcResult.veredicto === "aprovado" ? "bg-emerald-100 text-emerald-700" :
                          qcResult.veredicto === "suspeito" ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          <ShieldCheck className="w-3 h-3" />
                          QC: {qcResult.veredicto} · {Math.round(qcResult.confianca * 100)}%
                        </span>
                        {qcResult.recomendacao && <span className="text-xs text-slate-600">{qcResult.recomendacao}</span>}
                      </div>
                      <button onClick={() => setQcResult(null)} className="text-slate-400 hover:text-slate-600 text-base leading-none flex-shrink-0">&times;</button>
                    </div>
                  </div>
                )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/40">
                <p className="text-xs text-slate-500">
                  Página {page} de {totalPages} · {total.toLocaleString("pt-PT")} visitas
                </p>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:border-[#2D6BEE]/40 hover:text-[#2D6BEE] disabled:opacity-30 disabled:cursor-not-allowed transition">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                    let pg: number;
                    if (totalPages <= 7) pg = i + 1;
                    else if (page <= 4) pg = i + 1;
                    else if (page >= totalPages - 3) pg = totalPages - 6 + i;
                    else pg = page - 3 + i;
                    return (
                      <button key={pg} onClick={() => setPage(pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition ${
                          pg === page
                            ? "bg-[#2D6BEE] text-white"
                            : "border border-slate-200 text-slate-600 hover:bg-white hover:border-[#2D6BEE]/40 hover:text-[#2D6BEE]"
                        }`}>
                        {pg}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:border-[#2D6BEE]/40 hover:text-[#2D6BEE] disabled:opacity-30 disabled:cursor-not-allowed transition">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Fotos modal */}
      {fotosVisita && (
        <FotosModal
          visita={fotosVisita}
          onClose={() => setFotosVisita(null)}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <EditModal
          visita={editing}
          onClose={() => setEditing(null)}
          onSaved={updated => {
            setVisitas(vs => vs.map(v => v.id === updated.id ? { ...v, estado: updated.estado } : v));
            setEditing(null);
          }}
          onDraftSaved={() => { refreshDrafts(); setEditing(null); }}
        />
      )}

      {/* Conflict resolution modal — 8.1 */}
      {conflict && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Conflito de sincronização
              </h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-slate-600">
                A visita <span className="font-semibold">#{(conflict.draft.data as {visitaId: number}).visitaId}</span> foi alterada por outro utilizador enquanto estava offline.
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-slate-400 mb-1 font-medium">Estado atual (servidor)</p>
                  <span className="font-semibold text-slate-800">{conflict.serverEstado}</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-amber-600 mb-1 font-medium">{t("status.draft")}</p>
                  <span className="font-semibold text-amber-800">{(conflict.draft.data as {newEstado: string}).newEstado}</span>
                </div>
              </div>
              <p className="text-xs text-slate-400">Escolha qual versão manter:</p>
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-slate-100">
              <button
                onClick={async () => { await removeDraft(conflict.draft.id); setConflict(null); }}
                className="flex-1 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
              >
                Manter servidor
              </button>
              <button
                onClick={async () => {
                  const d = conflict.draft.data as { visitaId: number; newEstado: string; motivo: string | null };
                  setSyncingDraft(conflict.draft.id);
                  try {
                    await api.put(`/visitas/${d.visitaId}/estado`, { estado: d.newEstado, motivo_anulacao: d.motivo });
                    await removeDraft(conflict.draft.id);
                    load(page);
                  } catch { /* ignore */ }
                  setConflict(null);
                  setSyncingDraft(null);
                }}
                className="flex-1 px-3 py-2 text-sm text-white bg-amber-600 hover:bg-amber-700 rounded-xl font-medium transition"
              >
                Usar rascunho
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VisitasPage() {
  return (
    <Suspense fallback={null}>
      <VisitasPageInner />
    </Suspense>
  );
}
