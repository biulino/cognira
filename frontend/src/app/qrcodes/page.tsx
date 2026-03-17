"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Copy, Check, Loader2, ExternalLink, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Estudo {
  id: number;
  nome: string;
  estado: string;
}

interface SurveyToken {
  estudo_id: number;
  token: string;
}

function buildSurveyUrl(estudo_id: number, token: string) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/survey/${estudo_id}/${token}`;
}

export default function QRCodePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [estudos, setEstudos] = useState<Estudo[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState<Record<number, SurveyToken>>({});
  const [loadingToken, setLoadingToken] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    api.get<Estudo[]>("/estudos/")
      .then(setEstudos)
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function getToken(estudo: Estudo) {
    if (tokens[estudo.id]) { setTokens(p => { const n = {...p}; delete n[estudo.id]; return n; }); return; }
    setLoadingToken(estudo.id);
    try {
      const r = await api.get<SurveyToken>(`/public/survey/token/${estudo.id}`);
      setTokens(p => ({...p, [estudo.id]: r}));
    } finally {
      setLoadingToken(null);
    }
  }

  async function copyUrl(estudo_id: number) {
    const t = tokens[estudo_id];
    if (!t) return;
    await navigator.clipboard.writeText(buildSurveyUrl(estudo_id, t.token));
    setCopied(estudo_id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <QrCode className="w-7 h-7 text-brand" />
          QR Code — Surveys Públicos
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Gere links e QR codes para surveys sem autenticação (kiosk / tablet)
        </p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mb-6 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{t("qrcodes.publicAccess")}</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            Qualquer pessoa com o link pode responder ao questionário activo deste estudo.
            O link é assinado com HMAC — não pode ser adivinhado mas pode ser partilhado.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
        </div>
      ) : estudos.length === 0 ? (
        <div className="text-center text-slate-400 py-20 text-sm">{t("qrcodes.noStudies")}</div>
      ) : (
        <div className="space-y-3">
          {estudos.map(e => (
            <div key={e.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{e.nome}</p>
                  <p className="text-xs text-slate-400 mt-0.5">ID {e.id} · {e.estado}</p>
                </div>
                <button
                  onClick={() => getToken(e)}
                  disabled={loadingToken === e.id}
                  className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand/90 text-white text-xs font-semibold rounded-xl transition disabled:opacity-50 flex-shrink-0"
                >
                  {loadingToken === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                  {tokens[e.id] ? "Ocultar" : "Gerar Link"}
                </button>
              </div>

              {tokens[e.id] && (
                <div className="px-5 pb-5 border-t border-slate-50 dark:border-slate-800 pt-4 space-y-4">
                  {/* URL display */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">{t("qrcodes.publicLink")}</label>
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2.5 border border-slate-100 dark:border-slate-700">
                      <span className="flex-1 text-xs text-slate-600 dark:text-slate-300 font-mono truncate">
                        {buildSurveyUrl(e.id, tokens[e.id].token)}
                      </span>
                      <button
                        onClick={() => copyUrl(e.id)}
                        className="flex-shrink-0 p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
                        title="Copiar"
                      >
                        {copied === e.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                      </button>
                      <a
                        href={buildSurveyUrl(e.id, tokens[e.id].token)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
                        title="Abrir"
                      >
                        <ExternalLink className="w-4 h-4 text-slate-500" />
                      </a>
                    </div>
                  </div>

                  {/* QR code via Google Charts API (free, no library needed) */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">QR Code</label>
                    <div className="flex items-start gap-4 flex-wrap">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(buildSurveyUrl(e.id, tokens[e.id].token))}`}
                        alt="QR Code"
                        width={180}
                        height={180}
                        className="rounded-xl border border-slate-100 dark:border-slate-700"
                      />
                      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 mt-1">
                        <p>Imprima este QR code e coloque no estabelecimento.</p>
                        <p>Ao ler com a câmara, o utilizador acede ao questionário sem precisar de conta.</p>
                        <p className="text-amber-600 dark:text-amber-400">O link não expira — regenere se quiser revogar o acesso.</p>
                        <a
                          href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(buildSurveyUrl(e.id, tokens[e.id].token))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand font-medium hover:underline mt-2"
                          download={`qr_estudo_${e.id}.png`}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Download QR (600×600)
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
