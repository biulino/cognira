"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

interface SurveyField {
  id: number;
  label: string;
  tipo: string;
  obrigatorio: boolean;
  opcoes?: string[] | null;
}

interface SurveyData {
  questionario_id: number;
  nome: string;
  estudo_nome: string;
  campos: SurveyField[];
}

export default function PublicSurveyPage() {
  const params = useParams();
  const estudo_id = params.estudo_id as string;
  const token = params.token as string;

  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/public/survey/${estudo_id}/${token}`)
      .then(async r => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.detail || "Questionário não disponível");
        }
        return r.json();
      })
      .then(setSurvey)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [estudo_id, token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate required fields
    const missing = survey?.campos.filter(c => c.obrigatorio && !respostas[String(c.id)]?.trim());
    if (missing && missing.length > 0) {
      alert(`Por favor preencha: ${missing.map(c => c.label).join(", ")}`);
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch(`/api/public/survey/${estudo_id}/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respostas }),
      });
      if (!r.ok) throw new Error("Erro ao submeter");
      setSubmitted(true);
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-red-100 p-8 text-center shadow-sm">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Questionário indisponível</h2>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-emerald-100 p-8 text-center shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Obrigado!</h2>
          <p className="text-sm text-slate-500">A sua resposta foi registada com sucesso.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{survey?.estudo_nome}</p>
          <h1 className="text-xl font-bold text-slate-900">{survey?.nome}</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          {survey?.campos.map(campo => (
            <div key={campo.id}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {campo.label}
                {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
              </label>

              {campo.tipo === "texto" || campo.tipo === "text" ? (
                <input
                  type="text"
                  value={respostas[String(campo.id)] || ""}
                  onChange={e => setRespostas(p => ({...p, [String(campo.id)]: e.target.value}))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                  required={campo.obrigatorio}
                />
              ) : campo.tipo === "textarea" || campo.tipo === "texto_longo" ? (
                <textarea
                  rows={3}
                  value={respostas[String(campo.id)] || ""}
                  onChange={e => setRespostas(p => ({...p, [String(campo.id)]: e.target.value}))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand resize-none"
                  required={campo.obrigatorio}
                />
              ) : campo.tipo === "numero" || campo.tipo === "number" ? (
                <input
                  type="number"
                  value={respostas[String(campo.id)] || ""}
                  onChange={e => setRespostas(p => ({...p, [String(campo.id)]: e.target.value}))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                  required={campo.obrigatorio}
                />
              ) : campo.tipo === "escala" || campo.tipo === "nps" ? (
                <div className="flex gap-2 flex-wrap">
                  {Array.from({ length: campo.tipo === "nps" ? 11 : 5 }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRespostas(p => ({...p, [String(campo.id)]: String(i)}))}
                      className={`w-10 h-10 rounded-xl text-sm font-semibold border transition ${
                        respostas[String(campo.id)] === String(i)
                          ? "bg-brand text-white border-brand"
                          : "bg-white text-slate-600 border-slate-200 hover:border-brand/40"
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              ) : campo.tipo === "selecao" || campo.tipo === "select" ? (
                <select
                  value={respostas[String(campo.id)] || ""}
                  onChange={e => setRespostas(p => ({...p, [String(campo.id)]: e.target.value}))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                  required={campo.obrigatorio}
                >
                  <option value="">— Seleccione —</option>
                  {(campo.opcoes || []).map(op => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              ) : campo.tipo === "sim_nao" || campo.tipo === "boolean" ? (
                <div className="flex gap-3">
                  {["Sim", "Não"].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setRespostas(p => ({...p, [String(campo.id)]: v}))}
                      className={`px-6 py-2 rounded-xl text-sm font-semibold border transition ${
                        respostas[String(campo.id)] === v
                          ? "bg-brand text-white border-brand"
                          : "bg-white text-slate-600 border-slate-200 hover:border-brand/40"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  value={respostas[String(campo.id)] || ""}
                  onChange={e => setRespostas(p => ({...p, [String(campo.id)]: e.target.value}))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-brand hover:bg-brand/90 text-white font-semibold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? "A enviar…" : "Submeter Resposta"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Powered by Cognira Intelligence
        </p>
      </div>
    </div>
  );
}
