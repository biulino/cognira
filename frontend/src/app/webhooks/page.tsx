"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Webhook,
  Key,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface ApiKeyItem {
  id: string;
  nome: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_rpm: number;
  activo: boolean;
  ultimo_uso: string | null;
  criado_em: string;
}

interface WebhookSub {
  id: string;
  url: string;
  eventos: string[];
  activo: boolean;
  falhas_consecutivas: number;
  criado_em: string;
}

interface Delivery {
  id: string;
  evento: string;
  status_code: number | null;
  erro: string | null;
  tentativa: number;
  criado_em: string;
}

export default function WebhooksPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"keys" | "webhooks">("keys");

  // API Keys state
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState("read");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // Webhooks state
  const [subs, setSubs] = useState<WebhookSub[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  // Deliveries
  const [viewDeliveries, setViewDeliveries] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [keysRes, subsRes, eventsRes] = await Promise.all([
        api.get<ApiKeyItem[]>("/webhooks/api-keys"),
        api.get<WebhookSub[]>("/webhooks/subscriptions"),
        api.get<string[]>("/webhooks/events"),
      ]);
      setKeys(keysRes);
      setSubs(subsRes);
      setEvents(eventsRes);
    } catch {
      /* handled by api interceptor */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (!["admin", "coordenador"].includes(payload.role)) {
        router.replace("/dashboard");
        return;
      }
    } catch { router.replace("/login"); return; }
    loadData();
  }, [router, loadData]);

  /* ── API Key Actions ── */
  const createKey = async () => {
    if (!newKeyName.trim()) return;
    const res = await api.post<{ key: string }>("/webhooks/api-keys", {
      nome: newKeyName,
      scopes: newKeyScopes.split(",").map((s: string) => s.trim()),
    });
    setCreatedKey(res.key);
    setNewKeyName("");
    loadData();
  };

  const revokeKey = async (id: string) => {
    await api.delete(`/webhooks/api-keys/${id}`);
    loadData();
  };

  /* ── Webhook Actions ── */
  const createSub = async () => {
    if (!newUrl.trim() || newEvents.length === 0) return;
    const res = await api.post<{ id: string; secret: string }>("/webhooks/subscriptions", {
      url: newUrl,
      eventos: newEvents,
    });
    setCreatedSecret(res.secret);
    setNewUrl("");
    setNewEvents([]);
    loadData();
  };

  const deleteSub = async (id: string) => {
    await api.delete(`/webhooks/subscriptions/${id}`);
    loadData();
  };

  const toggleSub = async (sub: WebhookSub) => {
    await api.put(`/webhooks/subscriptions/${sub.id}`, { activo: !sub.activo });
    loadData();
  };

  const loadDeliveries = async (subId: string) => {
    setViewDeliveries(subId);
    const res = await api.get<Delivery[]>(`/webhooks/deliveries/${subId}`);
    setDeliveries(res);
  };

  const toggleEvent = (ev: string) => {
    setNewEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Webhook className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              API &amp; Webhooks
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gerir chaves de API e subscrições de webhooks
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm w-fit">
          <button
            onClick={() => setTab("keys")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "keys"
                ? "bg-blue-600 text-white"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <Key className="inline w-4 h-4 mr-1" /> Chaves API
          </button>
          <button
            onClick={() => setTab("webhooks")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "webhooks"
                ? "bg-blue-600 text-white"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <Webhook className="inline w-4 h-4 mr-1" /> Webhooks
          </button>
        </div>

        {/* ── API Keys Tab ── */}
        {tab === "keys" && (
          <div className="space-y-6">
            {/* Create key form */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                Nova Chave API
              </h2>
              <div className="flex gap-3 flex-wrap">
                <input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder={t("webhooks.keyNamePlaceholder")}
                  className="flex-1 min-w-[200px] px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <select
                  value={newKeyScopes}
                  onChange={(e) => setNewKeyScopes(e.target.value)}
                  className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="read">{t("webhooks.readOnly")}</option>
                  <option value="read,write">Leitura + Escrita</option>
                  <option value="read,write,admin">{t("webhooks.fullAccess")}</option>
                </select>
                <button
                  onClick={createKey}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" /> Criar
                </button>
              </div>

              {createdKey && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-300">
                      Guarde esta chave — não será mostrada novamente
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-white dark:bg-gray-800 rounded font-mono text-sm break-all">
                      {createdKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(createdKey)}
                      className="p-2 text-gray-500 hover:text-blue-600"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Keys list */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300">Nome</th>
                    <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300">Prefixo</th>
                    <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300">Scopes</th>
                    <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300">Estado</th>
                    <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300">Último uso</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {keys.map((k) => (
                    <tr key={k.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{k.nome}</td>
                      <td className="px-4 py-3 font-mono text-gray-500">{k.key_prefix}…</td>
                      <td className="px-4 py-3">
                        {k.scopes.map((s) => (
                          <span key={s} className="inline-block px-2 py-0.5 mr-1 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            {s}
                          </span>
                        ))}
                      </td>
                      <td className="px-4 py-3">
                        {k.activo ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-4 h-4" /> Activa
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-500">
                            <XCircle className="w-4 h-4" /> Revogada
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {k.ultimo_uso ? new Date(k.ultimo_uso).toLocaleString("pt-PT") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {k.activo && (
                          <button
                            onClick={() => revokeKey(k.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title="Revogar chave"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {keys.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                        Nenhuma chave API criada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Webhooks Tab ── */}
        {tab === "webhooks" && (
          <div className="space-y-6">
            {/* Create subscription */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                Nova Subscrição
              </h2>
              <div className="space-y-4">
                <input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="URL do endpoint (https://...)"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Eventos
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {events.map((ev) => (
                      <button
                        key={ev}
                        onClick={() => toggleEvent(ev)}
                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                          newEvents.includes(ev)
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400"
                        }`}
                      >
                        {ev}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={createSub}
                  disabled={!newUrl.trim() || newEvents.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> Criar subscrição
                </button>
              </div>

              {createdSecret && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-300">
                      Signing secret — guarde agora
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-white dark:bg-gray-800 rounded font-mono text-sm break-all">
                      {createdSecret}
                    </code>
                    <button
                      onClick={() => copyToClipboard(createdSecret)}
                      className="p-2 text-gray-500 hover:text-blue-600"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Subscriptions list */}
            <div className="space-y-4">
              {subs.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${sub.activo ? "bg-green-500" : "bg-red-500"}`} />
                        <span className="font-mono text-sm text-gray-900 dark:text-white break-all">
                          {sub.url}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {sub.eventos.map((ev) => (
                          <span
                            key={ev}
                            className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                      {sub.falhas_consecutivas > 0 && (
                        <div className="flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle className="w-3 h-3" />
                          {sub.falhas_consecutivas} falha(s) consecutiva(s)
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleSub(sub)}
                        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title={sub.activo ? "Desactivar" : "Activar"}
                      >
                        {sub.activo ? (
                          <Eye className="w-4 h-4 text-green-600" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => loadDeliveries(sub.id)}
                        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title={t("webhooks.viewDeliveries")}
                      >
                        <RefreshCw className="w-4 h-4 text-blue-500" />
                      </button>
                      <button
                        onClick={() => deleteSub(sub.id)}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                        title={t("common.delete")}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>

                  {/* Deliveries panel */}
                  {viewDeliveries === sub.id && (
                    <div className="mt-4 border-t dark:border-gray-700 pt-4">
                      <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Últimas entregas
                      </h3>
                      {deliveries.length === 0 ? (
                        <p className="text-sm text-gray-400">{t("webhooks.noDeliveries")}</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {deliveries.map((d) => (
                            <div
                              key={d.id}
                              className="flex items-center justify-between text-xs p-2 rounded bg-gray-50 dark:bg-gray-750"
                            >
                              <div className="flex items-center gap-2">
                                {d.status_code && d.status_code < 300 ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                                )}
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                  {d.evento}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-gray-500">
                                <span>{d.status_code ?? "erro"}</span>
                                <span>{new Date(d.criado_em).toLocaleString("pt-PT")}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {subs.length === 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center text-gray-400">
                  Nenhuma subscrição de webhook configurada
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
