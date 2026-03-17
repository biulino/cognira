"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  Upload,
  Filter,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Cliente {
  id: number;
  nome: string;
}
interface Estudo {
  id: number;
  nome: string;
  cliente_id: number;
}
interface Template {
  id: number;
  nome: string;
  cliente_id: number | null;
}
interface Chamada {
  id: number;
  cliente_id: number;
  estudo_id: number | null;
  template_id: number | null;
  nome_ficheiro: string;
  tamanho: number | null;
  mime_type: string | null;
  estado: string;
  erro_mensagem: string | null;
  score_global: number | null;
  referencia_externa: string | null;
  agente_nome: string | null;
  data_chamada: string | null;
  criado_em: string;
}

const ESTADO_COLORS: Record<string, string> = {
  pendente: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  transcrevendo: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  a_analisar: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  concluido: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  erro: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const ESTADO_LABELS: Record<string, string> = {
  pendente: "Pendente",
  transcrevendo: "A Transcrever",
  a_analisar: "A Analisar",
  concluido: "Concluído",
  erro: "Erro",
};

const ESTADO_ICONS: Record<string, React.ReactNode> = {
  pendente: <Clock className="w-3 h-3" />,
  transcrevendo: <Loader2 className="w-3 h-3 animate-spin" />,
  a_analisar: <Loader2 className="w-3 h-3 animate-spin" />,
  concluido: <CheckCircle2 className="w-3 h-3" />,
  erro: <AlertCircle className="w-3 h-3" />,
};

function StateBadge({ estado }: { estado: string }) {
  const cls = ESTADO_COLORS[estado] ?? "bg-slate-100 text-slate-500";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {ESTADO_ICONS[estado]}
      {ESTADO_LABELS[estado] ?? estado}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{score.toFixed(0)}%</span>
    </div>
  );
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const PAGE_SIZE = 50;
const FILTER_ESTADOS = ["", "pendente", "transcrevendo", "a_analisar", "concluido", "erro"];

export default function CallCenterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [estudos, setEstudos] = useState<Estudo[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [chamadas, setChamadas] = useState<Chamada[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [filterCliente, setFilterCliente] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadClienteId, setUploadClienteId] = useState("");
  const [uploadEstudoId, setUploadEstudoId] = useState("");
  const [uploadTemplateId, setUploadTemplateId] = useState("");
  const [uploadRefExt, setUploadRefExt] = useState("");
  const [uploadAgente, setUploadAgente] = useState("");
  const [uploadDataChamada, setUploadDataChamada] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<Cliente[]>("/clientes/"),
      api.get<Estudo[]>("/estudos/"),
    ]).then(([c, e]) => {
      setClientes(c);
      setEstudos(e);
    }).catch(() => {});

    // Try to load templates (may fail if not coordenador/admin — silently ignore)
    api.get<Template[]>("/callcenter/templates").then(setTemplates).catch(() => {});
  }, []);

  useEffect(() => {
    fetchChamadas(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCliente, filterEstado]);

  async function fetchChamadas(p: number, reset = false) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), page_size: String(PAGE_SIZE) });
      if (filterCliente) params.set("cliente_id", filterCliente);
      if (filterEstado) params.set("estado", filterEstado);
      const data = await api.get<Chamada[]>(`/callcenter/?${params}`);
      setChamadas(prev => reset ? data : [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
      setPage(p);
    } catch {
      // unauthorised or other error — stay silent
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile || !uploadClienteId) return;
    setUploadError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("cliente_id", uploadClienteId);
      if (uploadEstudoId) fd.append("estudo_id", uploadEstudoId);
      if (uploadTemplateId) fd.append("template_id", uploadTemplateId);
      if (uploadRefExt) fd.append("referencia_externa", uploadRefExt);
      if (uploadAgente) fd.append("agente_nome", uploadAgente);
      if (uploadDataChamada) fd.append("data_chamada", new Date(uploadDataChamada).toISOString());

      await api.upload<Chamada>("/callcenter/upload", fd);
      setShowUpload(false);
      setUploadFile(null);
      setUploadClienteId("");
      setUploadEstudoId("");
      setUploadTemplateId("");
      setUploadRefExt("");
      setUploadAgente("");
      setUploadDataChamada("");
      fetchChamadas(1, true);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Erro ao submeter chamada");
    } finally {
      setUploading(false);
    }
  }

  const estudosFiltrados = uploadClienteId
    ? estudos.filter(e => e.cliente_id === Number(uploadClienteId))
    : estudos;

  const templatesFiltrados = uploadClienteId
    ? templates.filter(t => !t.cliente_id || t.cliente_id === Number(uploadClienteId))
    : templates;

  function clienteNome(id: number) {
    return clientes.find(c => c.id === id)?.nome ?? `#${id}`;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Phone className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t("callcenter.title")}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Transcrição e análise de qualidade de chamadas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchChamadas(1, true)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
            title={t("common.refresh")}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              showFilters || filterCliente || filterEstado
                ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <Filter className="w-4 h-4" /> Filtros
          </button>
          <button
            onClick={() => { setShowUpload(true); setUploadError(""); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" /> Submeter Chamada
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <select
            value={filterCliente}
            onChange={e => { setFilterCliente(e.target.value); }}
            className="text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5"
          >
            <option value="">{t("callcenter.allClients")}</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select
            value={filterEstado}
            onChange={e => { setFilterEstado(e.target.value); }}
            className="text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5"
          >
            <option value="">{t("callcenter.allStates")}</option>
            {FILTER_ESTADOS.filter(Boolean).map(s => (
              <option key={s} value={s}>{ESTADO_LABELS[s] ?? s}</option>
            ))}
          </select>
          {(filterCliente || filterEstado) && (
            <button
              onClick={() => { setFilterCliente(""); setFilterEstado(""); }}
              className="text-sm text-red-500 hover:text-red-700 px-2"
            >
              Limpar
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading && chamadas.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : chamadas.length === 0 ? (
          <div className="text-center py-16 text-slate-500 dark:text-slate-400">
            <Phone className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{t("callcenter.noCallsFound")}</p>
            <p className="text-sm mt-1">Submete o primeiro áudio para começar.</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 w-12">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Referência</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Agente</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Score</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Tamanho</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Submetido</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {chamadas.map(c => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                    onClick={() => router.push(`/callcenter/${c.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-400 dark:text-slate-500">{c.id}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {c.referencia_externa || <span className="text-slate-400">—</span>}
                      </span>
                      <div className="text-xs text-slate-400 mt-0.5 truncate max-w-36" title={c.nome_ficheiro}>
                        {c.nome_ficheiro}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {c.agente_nome || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {clienteNome(c.cliente_id)}
                    </td>
                    <td className="px-4 py-3">
                      <StateBadge estado={c.estado} />
                      {c.estado === "erro" && c.erro_mensagem && (
                        <div className="text-xs text-red-500 mt-1 max-w-48 truncate" title={c.erro_mensagem}>
                          {c.erro_mensagem}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.score_global != null ? (
                        <ScoreBar score={c.score_global} />
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                      {c.tamanho ? fmtBytes(c.tamanho) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                      {new Date(c.criado_em).toLocaleDateString("pt-PT")}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      <ChevronRight className="w-4 h-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasMore && (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => fetchChamadas(page + 1)}
                  disabled={loading}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                >
                  {loading ? "A carregar..." : "Ver mais"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t("callcenter.submitCall")}</h2>
              <button
                onClick={() => setShowUpload(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              {/* File picker */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Ficheiro de áudio *
                </label>
                <div
                  className="border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-400 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  {uploadFile ? (
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      <span className="font-medium">{uploadFile.name}</span>
                      <span className="text-slate-400 ml-2">({fmtBytes(uploadFile.size)})</span>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400">
                      <Upload className="w-6 h-6 mx-auto mb-1" />
                      Clica para seleccionar mp3, wav, m4a, ogg, flac, webm
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.webm"
                    className="hidden"
                    onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              {/* Cliente */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Cliente *
                </label>
                <select
                  required
                  value={uploadClienteId}
                  onChange={e => { setUploadClienteId(e.target.value); setUploadEstudoId(""); }}
                  className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2"
                >
                  <option value="">{t("common.selectPlaceholder")}</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              {/* Estudo (optional) */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Estudo <span className="text-slate-400">(opcional)</span>
                </label>
                <select
                  value={uploadEstudoId}
                  onChange={e => setUploadEstudoId(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2"
                >
                  <option value="">{t("common.none")}</option>
                  {estudosFiltrados.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>

              {/* Template (optional) */}
              {templates.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                    Template de avaliação <span className="text-slate-400">(opcional)</span>
                  </label>
                  <select
                    value={uploadTemplateId}
                    onChange={e => setUploadTemplateId(e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2"
                  >
                    <option value="">{t("common.none")}</option>
                    {templatesFiltrados.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
              )}

              {/* Row: referência + agente */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                    Referência externa
                  </label>
                  <input
                    type="text"
                    value={uploadRefExt}
                    onChange={e => setUploadRefExt(e.target.value)}
                    placeholder="ex: CALL-2026-001"
                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                    Nome do agente
                  </label>
                  <input
                    type="text"
                    value={uploadAgente}
                    onChange={e => setUploadAgente(e.target.value)}
                    placeholder="ex: João Silva"
                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2"
                  />
                </div>
              </div>

              {/* Data da chamada */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Data/hora da chamada
                </label>
                <input
                  type="datetime-local"
                  value={uploadDataChamada}
                  onChange={e => setUploadDataChamada(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2"
                />
              </div>

              {uploadError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {uploadError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile || !uploadClienteId}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "A submeter…" : "Submeter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
