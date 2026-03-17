"use client";
/**
 * /configuracoes/branding — Admin white-label / branding settings
 * Lets administrators customise the platform name, tagline, colors, and logo URL.
 * Changes take effect immediately for all users on next page load.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Palette,
  Save,
  ArrowLeft,
  Eye,
  RefreshCw,
  Type,
  Link as LinkIcon,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Branding } from "@/lib/branding";
import { useI18n } from "@/lib/i18n";

const DEFAULTS: Branding = {
  app_name: "Cognira",
  tagline: "Mystery Shopping Platform",
  primary_color: "#2D6BEE",
  secondary_color: "#1E40AF",
  logo_url: null,
  favicon_url: null,
};

type SaveState = "idle" | "saving" | "ok" | "error";

function ColorSwatch({ color, onChange }: { color: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
      />
      <input
        type="text"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        maxLength={7}
        placeholder="#2D6BEE"
        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30"
      />
    </div>
  );
}

export default function BrandingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState<Branding>(DEFAULTS);
  const [original, setOriginal] = useState<Branding>(DEFAULTS);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }

    Promise.all([
      api.get<{ role_global: string }>("/auth/me"),
      fetch("/api/branding").then((r) => r.json()),
    ])
      .then(([me, branding]: [any, Branding]) => {
        if (me.role_global !== "admin") { router.replace("/dashboard"); return; }
        setIsAdmin(true);
        const merged = { ...DEFAULTS, ...branding };
        setForm(merged);
        setOriginal(merged);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const set = (k: keyof Branding, v: string | null) =>
    setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaveState("saving");
    try {
      const keys: (keyof Branding)[] = ["app_name", "tagline", "primary_color", "secondary_color", "logo_url", "favicon_url"];
      await Promise.all(
        keys.map((k) =>
          api.put(`/branding/${k}`, { valor: form[k] ?? null })
        )
      );
      setOriginal(form);
      setSaveState("ok");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const reset = () => setForm(original);
  const resetToDefaults = () => setForm(DEFAULTS);

  const isDirty = JSON.stringify(form) !== JSON.stringify(original);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#2D6BEE] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition text-slate-500"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#2D6BEE]/10">
              <Palette className="w-5 h-5 text-[#2D6BEE]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">White-Label & Branding</h1>
              <p className="text-sm text-slate-500">Personaliza o nome, cores e logo da plataforma</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={resetToDefaults}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              title="Repor valores padrão"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Repor
            </button>
            <button
              onClick={save}
              disabled={!isDirty || saveState === "saving"}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                saveState === "ok"
                  ? "bg-green-500 text-white"
                  : saveState === "error"
                  ? "bg-red-500 text-white"
                  : isDirty
                  ? "bg-[#2D6BEE] hover:bg-[#1A52CC] text-white shadow"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              {saveState === "saving" ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : saveState === "ok" ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : saveState === "error" ? (
                <AlertCircle className="w-3.5 h-3.5" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {saveState === "saving" ? "A guardar…" : saveState === "ok" ? "Guardado!" : saveState === "error" ? "Erro" : "Guardar"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Form */}
          <div className="lg:col-span-3 space-y-5">
            {/* Identity */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center gap-2 mb-5">
                <Type className="w-4 h-4 text-slate-400" />
                <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Identidade</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Nome da Plataforma
                  </label>
                  <input
                    type="text"
                    value={form.app_name}
                    onChange={(e) => set("app_name", e.target.value)}
                    placeholder="Cognira"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Tagline
                  </label>
                  <input
                    type="text"
                    value={form.tagline}
                    onChange={(e) => set("tagline", e.target.value)}
                    placeholder="Mystery Shopping Platform"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30"
                  />
                </div>
              </div>
            </div>

            {/* Colors */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center gap-2 mb-5">
                <Palette className="w-4 h-4 text-slate-400" />
                <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Cores</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Cor Primária
                  </label>
                  <ColorSwatch color={form.primary_color} onChange={(v) => set("primary_color", v)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Cor Secundária
                  </label>
                  <ColorSwatch color={form.secondary_color} onChange={(v) => set("secondary_color", v)} />
                </div>
              </div>
            </div>

            {/* Assets */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center gap-2 mb-5">
                <LinkIcon className="w-4 h-4 text-slate-400" />
                <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Assets</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                URLs públicos para logo e favicon. Deixa em branco para usar os assets padrão da plataforma.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Logo URL
                  </label>
                  <input
                    type="url"
                    value={form.logo_url ?? ""}
                    onChange={(e) => set("logo_url", e.target.value || null)}
                    placeholder="https://cdn.example.com/logo.png"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Favicon URL
                  </label>
                  <input
                    type="url"
                    value={form.favicon_url ?? ""}
                    onChange={(e) => set("favicon_url", e.target.value || null)}
                    placeholder="https://cdn.example.com/favicon.ico"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div className="lg:col-span-2">
            <div className="sticky top-6">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Pré-visualização</span>
              </div>

              {/* Login preview */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 mb-4 shadow-sm">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Ecrã de Login</p>
                <div className="bg-[#F9F9F9] rounded-xl p-4 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.logo_url || "/logo.png"}
                    alt={form.app_name}
                    className="h-10 w-auto mx-auto mb-3 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }}
                  />
                  <p className="font-bold text-lg text-[#111111]">{form.app_name || "—"}</p>
                  <p className="text-xs text-[#888888] mt-0.5">{form.tagline || "—"}</p>
                </div>
              </div>

              {/* Sidebar preview */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Sidebar</p>
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.logo_url || "/logo.png"}
                      alt={form.app_name}
                      className="h-6 w-auto object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }}
                    />
                    <p className="text-xs font-semibold text-slate-800 truncate">{form.app_name || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    {["Dashboard", "Estudos", "Visitas"].map((item, i) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs"
                        style={i === 0 ? { backgroundColor: form.primary_color, color: "#fff" } : { color: "#666" }}
                      >
                        <div className="w-2.5 h-2.5 rounded-sm" style={i === 0 ? { backgroundColor: "rgba(255,255,255,0.4)" } : { backgroundColor: "#ddd" }} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {isDirty && (
                <button onClick={reset} className="mt-3 text-xs text-slate-400 hover:text-slate-600 transition w-full text-center">
                  ↩ Descartar alterações
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
