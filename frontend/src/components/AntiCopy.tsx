"use client";

import { useEffect, useState } from "react";

/**
 * Anti-copy & anti-devtools protection.
 * Checks GET /api/configuracoes/seguranca_copia for {"valor": true/false}.
 * Defaults to enabled if the setting doesn't exist or isn't accessible.
 * Admin can toggle it in Configurações.
 */
export default function AntiCopy() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) { setEnabled(false); return; }

    fetch("/api/configuracoes/seguranca_copia", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        // If setting exists and valor is false, disable protection
        if (data && data.valor === false) {
          setEnabled(false);
        } else {
          setEnabled(true);
        }
      })
      .catch(() => setEnabled(true)); // default on if can't fetch
  }, []);

  useEffect(() => {
    if (enabled !== true) return;

    function blockCtx(e: MouseEvent) { e.preventDefault(); }
    function blockKeys(e: KeyboardEvent) {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key)) ||
        (e.ctrlKey && e.key === "u")
      ) {
        e.preventDefault();
      }
    }

    document.addEventListener("contextmenu", blockCtx);
    document.addEventListener("keydown", blockKeys);

    // Add user-select:none to body
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    return () => {
      document.removeEventListener("contextmenu", blockCtx);
      document.removeEventListener("keydown", blockKeys);
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
    };
  }, [enabled]);

  return null;
}
