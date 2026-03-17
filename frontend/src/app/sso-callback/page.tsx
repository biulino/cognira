"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SSOCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    // Tokens are delivered in the URL fragment to avoid server logs
    const hash = window.location.hash.slice(1); // strip leading #
    const params = new URLSearchParams(hash);
    const at = params.get("access_token");
    const rt = params.get("refresh_token");

    if (at && rt) {
      localStorage.setItem("access_token", at);
      localStorage.setItem("refresh_token", rt);
      // Clear fragment from history before navigating
      window.history.replaceState(null, "", window.location.pathname);
      router.replace("/dashboard");
    } else {
      setError("Falha na autenticação SSO. Token não recebido.");
    }
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] flex items-center justify-center px-4">
        <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-sm w-full shadow text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Erro SSO</h2>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <a
            href="/login"
            className="inline-block px-6 py-2.5 bg-[#2D6BEE] text-white text-sm font-semibold rounded-xl hover:bg-[#1A52CC] transition"
          >
            Voltar ao login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-[#2D6BEE] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">A autenticar via SSO…</p>
      </div>
    </div>
  );
}
