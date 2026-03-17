"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, CheckCircle, AlertCircle, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Estudo { id: number; nome: string; }
interface Preview { linhas_novas: number; linhas_actualizadas: number; erros: string[]; }

export default function IngestPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [estudos, setEstudos] = useState<Estudo[]>([]);
  const [estudoId, setEstudoId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    api.get<Estudo[]>("/estudos/").then(setEstudos).catch(() => {});
  }, [router]);

  async function handlePreview() {
    if (!file || !estudoId) return;
    setLoading(true); setPreview(null); setResult("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await api.upload<Preview>(`/ingest/csv/preview?estudo_id=${estudoId}`, fd);
      setPreview(res); setStep(2);
    } catch (err: unknown) {
      setResult("Erro: " + (err instanceof Error ? err.message : String(err)));
    } finally { setLoading(false); }
  }

  async function handleConfirm() {
    if (!file || !estudoId) return;
    setLoading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await api.upload<{ detail: string }>(`/ingest/csv/confirm?estudo_id=${estudoId}`, fd);
      setResult(res.detail || "Importação concluída");
      setPreview(null); setStep(3);
    } catch (err: unknown) {
      setResult("Erro: " + (err instanceof Error ? err.message : String(err)));
    } finally { setLoading(false); }
  }

  const selectedEstudo = estudos.find(e => e.id === Number(estudoId));

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{t("ingest.title")}</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Importar visitas a partir de um ficheiro CSV</p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {(["Seleccionar", "Preview", "Concluído"] as const).map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
              step > i + 1 ? "bg-emerald-500 text-white" :
              step === i + 1 ? "bg-blue-600 text-white" :
              "bg-slate-200 dark:bg-slate-700 text-slate-400"
            }`}>
              {step > i + 1 ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-sm font-medium ${
              step === i + 1 ? "text-slate-900 dark:text-white" : "text-slate-400"
            }`}>{label}</span>
            {i < 2 && <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />}
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100 dark:border-slate-800 p-6 space-y-6">
        {step !== 3 && (
          <>
            {/* Study picker */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Estudo</label>
              <select
                value={estudoId}
                onChange={(e) => setEstudoId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="">-- Escolha um estudo --</option>
                {estudos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>

            {/* File drop zone */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Ficheiro CSV</label>
              <label className={`flex flex-col items-center justify-center gap-3 w-full h-36 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                file
                  ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                  : "border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}>
                <input type="file" accept=".csv" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] || null); setStep(1); setPreview(null); }} />
                {file ? (
                  <>
                    <FileText className="w-8 h-8 text-blue-500" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">{file.name}</p>
                      <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t("ingest.dropzone")}</p>
                      <p className="text-xs text-slate-400">CSV</p>
                    </div>
                  </>
                )}
              </label>
            </div>
          </>
        )}

        {/* Preview result */}
        {preview && step === 2 && (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 space-y-3">
            <p className="font-semibold text-slate-900 dark:text-white text-sm">{t("ingest.preview")}</p>
            {selectedEstudo && <p className="text-xs text-slate-500">{selectedEstudo.nome}</p>}
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{preview.linhas_novas}</p>
                <p className="text-xs text-slate-500">Novas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{preview.linhas_actualizadas}</p>
                <p className="text-xs text-slate-500">Actualizadas</p>
              </div>
              {preview.erros?.length > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">{preview.erros.length}</p>
                  <p className="text-xs text-slate-500">Erros</p>
                </div>
              )}
            </div>
            {preview.erros?.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Erros encontrados
                </p>
                <ul className="text-xs text-red-500 space-y-0.5 max-h-24 overflow-y-auto">
                  {preview.erros.map((e: string, i: number) => <li key={i}>&bull; {e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Success */}
        {step === 3 && result && (
          <div className="text-center py-6">
            <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
            <p className="font-semibold text-slate-900 dark:text-white">{t("ingest.done")}</p>
            <p className="text-sm text-slate-500 mt-1">{result}</p>
            <button
              onClick={() => { setFile(null); setPreview(null); setResult(""); setEstudoId(""); setStep(1); }}
              className="mt-5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition"
            >
              Importar outro ficheiro
            </button>
          </div>
        )}

        {/* Error */}
        {result && result.startsWith("Erro:") && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {result}
          </div>
        )}

        {/* Actions */}
        {step !== 3 && (
          <div className="flex gap-3 pt-2">
            {step === 1 && (
              <button
                onClick={handlePreview}
                disabled={loading || !file || !estudoId}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-sm rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                {loading ? "A processar..." : "Ver pré-visualização"}
              </button>
            )}
            {step === 2 && preview && (
              <>
                <button
                  onClick={() => { setPreview(null); setStep(1); }}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-sm rounded-xl transition"
                >
                  Voltar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition disabled:opacity-50 active:scale-95"
                >
                  {loading ? "A importar..." : "Confirmar importação"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

