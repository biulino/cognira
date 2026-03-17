"use client";
/**
 * /clientes/[id]/portal — Per-client portal branding config (admin only)
 */
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface PortalConfig {
  subdominio: string;
  nome_marca: string;
  cor_primaria: string;
  cor_secundaria: string;
  logo_url_minio: string | null;
  favicon_url: string | null;
  dominio_custom: string | null;
  css_custom: string | null;
  activo: boolean;
}

function authHeader() {
  const t = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default function ClientePortalPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<PortalConfig>({
    subdominio: "",
    nome_marca: "",
    cor_primaria: "#1E40AF",
    cor_secundaria: "#3B82F6",
    logo_url_minio: "",
    favicon_url: "",
    dominio_custom: "",
    css_custom: "",
    activo: true,
  });
  const [clienteNome, setClienteNome] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [cRes, pRes] = await Promise.all([
          fetch(`/api/clientes/${id}`, { headers: authHeader() as HeadersInit }),
          fetch(`/api/branding/clientes/${id}`, { headers: authHeader() as HeadersInit }),
        ]);
        if (cRes.ok) {
          const c = await cRes.json();
          setClienteNome(c.nome ?? "");
        }
        if (pRes.ok) {
          const p = await pRes.json();
          if (p && p.subdominio) {
            setForm({
              subdominio: p.subdominio ?? "",
              nome_marca: p.nome_marca ?? "",
              cor_primaria: p.cor_primaria ?? "#1E40AF",
              cor_secundaria: p.cor_secundaria ?? "#3B82F6",
              logo_url_minio: p.logo_url_minio ?? "",
              favicon_url: p.favicon_url ?? "",
              dominio_custom: p.dominio_custom ?? "",
              css_custom: p.css_custom ?? "",
              activo: p.activo ?? true,
            });
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function field(key: keyof PortalConfig) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };
  }

  async function save() {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch(`/api/branding/clientes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(authHeader() as Record<string, string>) },
        body: JSON.stringify({
          ...form,
          logo_url_minio: form.logo_url_minio || null,
          favicon_url: form.favicon_url || null,
          dominio_custom: form.dominio_custom || null,
          css_custom: form.css_custom || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Erro ao guardar");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const previewUrl = form.subdominio ? `${form.subdominio}.marketview.io` : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link href="/clientes" className="hover:text-slate-700 transition-colors">Clientes</Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">{clienteNome}</span>
        <span>/</span>
        <span className="text-slate-400">Portal</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Portal White-Label</h1>
          <p className="text-slate-500 text-sm mt-0.5">Configure a marca e o portal personalizado deste cliente.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30 rounded-xl text-green-700 dark:text-green-400 text-sm">
          ✓ Configuração guardada com sucesso.
        </div>
      )}

      <div className="space-y-6">
        {/* Identity */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
          <h2 className="font-semibold text-slate-800 dark:text-white mb-4">Identidade</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Nome de Marca *</label>
              <input value={form.nome_marca} onChange={field("nome_marca")}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:border-blue-400"
                placeholder="Acme Portugal" />
            </div>
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Subdomínio *</label>
              <div className="flex">
                <input value={form.subdominio} onChange={field("subdominio")}
                  className="flex-1 border border-r-0 border-slate-200 dark:border-slate-600 rounded-l-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:border-blue-400"
                  placeholder="acme" />
                <span className="bg-slate-50 dark:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-r-lg px-2 py-2 text-xs text-slate-400 whitespace-nowrap">
                  .marketview.io
                </span>
              </div>
            </div>
          </div>
          {previewUrl && (
            <p className="text-xs text-slate-400 mt-2">
              URL do portal:{" "}
              <a href={`https://${previewUrl}`} target="_blank" rel="noreferrer"
                className="text-blue-500 hover:underline">{previewUrl} ↗</a>
            </p>
          )}
        </section>

        {/* Colors */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
          <h2 className="font-semibold text-slate-800 dark:text-white mb-4">Cores</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Cor Primária</label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.cor_primaria}
                  onChange={(e) => setForm((f) => ({ ...f, cor_primaria: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer" />
                <input value={form.cor_primaria} onChange={field("cor_primaria")}
                  className="flex-1 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:border-blue-400 font-mono"
                  placeholder="#1E40AF" />
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Cor Secundária</label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.cor_secundaria}
                  onChange={(e) => setForm((f) => ({ ...f, cor_secundaria: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer" />
                <input value={form.cor_secundaria} onChange={field("cor_secundaria")}
                  className="flex-1 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:border-blue-400 font-mono"
                  placeholder="#3B82F6" />
              </div>
            </div>
          </div>
          {/* Color preview bar */}
          <div className="mt-4 flex rounded-lg overflow-hidden h-8">
            <div className="flex-1 transition-colors" style={{ backgroundColor: form.cor_primaria }} />
            <div className="flex-1 transition-colors" style={{ backgroundColor: form.cor_secundaria }} />
          </div>
        </section>

        {/* Assets */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
          <h2 className="font-semibold text-slate-800 dark:text-white mb-4">Imagens & Assets</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">URL do Logótipo</label>
              <input value={form.logo_url_minio ?? ""} onChange={field("logo_url_minio")}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:border-blue-400"
                placeholder="https://cdn.exemplo.com/logo.png" />
            </div>
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">URL do Favicon</label>
              <input value={form.favicon_url ?? ""} onChange={field("favicon_url")}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:border-blue-400"
                placeholder="https://cdn.exemplo.com/favicon.ico" />
            </div>
          </div>
        </section>

        {/* Advanced */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
          <h2 className="font-semibold text-slate-800 dark:text-white mb-1">Avançado</h2>
          <p className="text-slate-400 text-xs mb-4">Para clientes Enterprise com domínio próprio.</p>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Domínio Personalizado</label>
              <input value={form.dominio_custom ?? ""} onChange={field("dominio_custom")}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:border-blue-400"
                placeholder="reporting.cliente.com" />
              <p className="text-xs text-slate-400 mt-1">Aponte um CNAME para marketview.io na configuração DNS.</p>
            </div>
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">CSS Personalizado</label>
              <textarea value={form.css_custom ?? ""} onChange={field("css_custom")} rows={5}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:border-blue-400 font-mono"
                placeholder=":root { --brand-primary: #ff0000; }" />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="activo" checked={form.activo}
                onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                className="w-4 h-4 rounded" />
              <label htmlFor="activo" className="text-sm text-slate-700 dark:text-slate-300">Portal activo (visível para o cliente)</label>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <Link href="/clientes"
            className="px-5 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Cancelar
          </Link>
          <button onClick={save} disabled={saving || !form.subdominio || !form.nome_marca}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium rounded-xl text-sm transition-colors flex items-center gap-2">
            {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {saving ? "A guardar…" : "Guardar Portal"}
          </button>
        </div>
      </div>
    </div>
  );
}
