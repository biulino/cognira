"use client";
/**
 * BrandingContext — fetches white-label config from /api/branding.
 * Detects tenant subdomains automatically.
 * Provides app name, colors, logo, css_custom, tenant slug.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

export interface Branding {
  app_name: string;
  tagline: string;
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  favicon_url: string | null;
  css_custom?: string | null;
  tenant?: string | null;
  tenant_id?: number | null;
  tenant_status?: string | null;
}

const DEFAULTS: Branding = {
  app_name: "Cognira",
  tagline: "CX Intelligence Platform",
  primary_color: "#2D6BEE",
  secondary_color: "#0F1B3D",
  logo_url: "/logo.svg",
  favicon_url: null,
  css_custom: null,
  tenant: null,
  tenant_id: null,
};

const BrandingContext = createContext<Branding>(DEFAULTS);

/** Returns subdomain if the hostname looks like {sub}.{domain}.{tld} */
function detectSubdomain(): string | null {
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname;
  const parts = hostname.split(".");
  if (parts.length < 3) return null; // localhost or bare domain
  const sub = parts[0];
  const reserved = new Set(["www", "app", "api", "mail", "cdn", "assets", "cognira"]);
  return reserved.has(sub) ? null : sub;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULTS);

  useEffect(() => {
    const subdomain = detectSubdomain();
    const url = subdomain
      ? `/api/branding/tenant/${encodeURIComponent(subdomain)}`
      : "/api/branding";

    fetch(url)
      .then((r) => {
        if (!r.ok) return DEFAULTS;
        return r.json();
      })
      .then((data: Branding) => {
        const merged = { ...DEFAULTS, ...data };
        setBranding(merged);
        // Apply as CSS variables
        const root = document.documentElement;
        root.style.setProperty("--brand-primary", merged.primary_color);
        root.style.setProperty("--brand-secondary", merged.secondary_color);
        // Inject custom CSS if provided (tenant white-label)
        if (merged.css_custom) {
          let styleEl = document.getElementById("tenant-custom-css") as HTMLStyleElement | null;
          if (!styleEl) {
            styleEl = document.createElement("style");
            styleEl.id = "tenant-custom-css";
            document.head.appendChild(styleEl);
          }
          styleEl.textContent = merged.css_custom;
        }
        if (merged.app_name) document.title = merged.app_name;
        if (merged.favicon_url) {
          const link =
            (document.querySelector("link[rel='icon']") as HTMLLinkElement) ??
            Object.assign(document.createElement("link"), { rel: "icon" });
          link.href = merged.favicon_url;
          document.head.appendChild(link);
        }
      })
      .catch(() => {/* keep defaults */});
  }, []);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
