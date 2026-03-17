"use client";

import { useEffect } from "react";

interface Theme {
  cor_primaria: string;
  cor_secundaria: string;
  nome_marca: string;
  logo_url: string | null;
  favicon_url: string | null;
  css_custom: string | null;
}

const DEFAULT_THEME: Theme = {
  cor_primaria: "#1E40AF",
  cor_secundaria: "#3B82F6",
  nome_marca: "Cognira Intelligence",
  logo_url: null,
  favicon_url: null,
  css_custom: null,
};

export default function ThemeProvider() {
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "/api";

    fetch(`${apiBase}/theme`, { credentials: "omit" })
      .then((r) => (r.ok ? r.json() : DEFAULT_THEME))
      .catch(() => DEFAULT_THEME)
      .then((theme: Theme) => {
        const root = document.documentElement;
        root.style.setProperty("--brand-primary", theme.cor_primaria);
        root.style.setProperty("--brand-secondary", theme.cor_secundaria);

        // Update page title and meta
        if (theme.nome_marca && theme.nome_marca !== "Cognira Intelligence") {
          document.title = theme.nome_marca;
        }

        // Update favicon
        if (theme.favicon_url) {
          let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = theme.favicon_url;
        }

        // Inject custom CSS
        if (theme.css_custom) {
          const existing = document.getElementById("brand-custom-css");
          if (existing) existing.remove();
          const style = document.createElement("style");
          style.id = "brand-custom-css";
          style.textContent = theme.css_custom;
          document.head.appendChild(style);
        }
      });
  }, []);

  return null;
}
