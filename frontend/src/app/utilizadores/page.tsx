"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserX, UserCheck, UserPlus, Trash2, Key } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Utilizador {
  id: string;
  username: string;
  email: string;
  role_global: string;
  totp_activo: boolean;
  activo: boolean;
  criado_em: string;
}

interface Permissao { id: string; utilizador_id: string; estudo_id: number; role: string; }
interface Estudo { id: number; nome: string; }

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  coordenador: "bg-blue-100 text-blue-700",
  validador: "bg-purple-100 text-purple-700",
  utilizador: "bg-slate-100 text-slate-600",
};

const ROLES = ["admin", "coordenador", "validador", "utilizador"];
const PERM_ROLES = ["coordenador", "analista", "validador", "cliente"];

// ── Create user modal ──────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (u: Utilizador) => void }) {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole]         = useState("utilizador");
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr("");
    try {
      const u = await api.post<Utilizador>("/utilizadores/", { username, email, password, role_global: role });
      onCreated(u);
    } catch (ex: any) { setErr(ex?.message ?? "Erro"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{t("utilizadores.createUser")}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {err && <p className="text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2">{err}</p>}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Username</label>
            <input required value={username} onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Password</label>
            <input required type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t("utilizadores.globalRole")}</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition disabled:opacity-50">
              {saving ? "A criar..." : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Permissions panel ──────────────────────────────────────────────────────────
function PermissoesPanel({ user, estudos, onClose }: { user: Utilizador; estudos: Estudo[]; onClose: () => void }) {
  const { t } = useI18n();
  const [perms, setPerms]         = useState<Permissao[]>([]);
  const [loading, setLoading]     = useState(true);
  const [estudoId, setEstudoId]   = useState("");
  const [role, setRole]           = useState("analista");
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    api.get<Permissao[]>(`/utilizadores/${user.id}/permissoes`)
      .then(setPerms)
      .finally(() => setLoading(false));
  }, [user.id]);

  async function addPerm() {
    if (!estudoId) return;
    setSaving(true);
    try {
      const p = await api.post<Permissao>(`/utilizadores/${user.id}/permissoes`, { estudo_id: parseInt(estudoId), role });
      setPerms(prev => {
        const existing = prev.find(x => x.estudo_id === parseInt(estudoId));
        return existing ? prev.map(x => x.id === existing.id ? p : x) : [...prev, p];
      });
      setEstudoId("");
    } catch (ex: any) { alert(ex?.message ?? "Erro"); }
    finally { setSaving(false); }
  }

  async function removePerm(perm: Permissao) {
    try {
      await api.delete(`/utilizadores/${user.id}/permissoes/${perm.id}`);
      setPerms(prev => prev.filter(x => x.id !== perm.id));
    } catch (ex: any) { alert(ex?.message ?? "Erro"); }
  }

  const estudoName = (id: number) => estudos.find(e => e.id === id)?.nome ?? `Estudo #${id}`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-slate-800">{t("utilizadores.permissionsStudy")}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{user.username}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <p className="text-sm text-slate-400">{t("common.loading")}</p>
          ) : perms.length === 0 ? (
            <p className="text-sm text-slate-400">Sem permissões atribuídas</p>
          ) : (
            <div className="space-y-2">
              {perms.map(p => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl">
                  <span className="text-sm text-slate-700 truncate flex-1">{estudoName(p.estudo_id)}</span>
                  <span className={`mx-3 text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[p.role] ?? "bg-slate-100 text-slate-600"}`}>{p.role}</span>
                  <button onClick={() => removePerm(p)} className="text-red-400 hover:text-red-600 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <p className="text-xs font-medium text-slate-500 mb-2">{t("utilizadores.addPermission")}</p>
          <div className="flex flex-wrap gap-2">
            <select value={estudoId} onChange={e => setEstudoId(e.target.value)}
              className="flex-1 min-w-[140px] px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">{t("utilizadores.selectStudy")}</option>
              {estudos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              {PERM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={addPerm} disabled={!estudoId || saving}
              className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50">
              {saving ? "..." : "Adicionar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function UtilizadoresPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [items, setItems]           = useState<Utilizador[]>([]);
  const [estudos, setEstudos]       = useState<Estudo[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [toggling, setToggling]     = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [permUser, setPermUser]     = useState<Utilizador | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    Promise.all([
      api.get<Utilizador[]>("/utilizadores/"),
      api.get<Estudo[]>("/estudos/"),
    ])
      .then(([u, e]) => { setItems(u); setEstudos(e); })
      .catch(e => setError(e?.message ?? "Acesso negado — apenas administradores"))
      .finally(() => setLoading(false));
  }, [router]);

  async function toggleActive(u: Utilizador) {
    setToggling(u.id);
    try {
      const updated = await api.put<Utilizador>(`/utilizadores/${u.id}/toggle`, {});
      setItems(prev => prev.map(x => x.id === u.id ? updated : x));
    } catch (e: any) { alert(e?.message ?? "Erro"); }
    finally { setToggling(null); }
  }

  async function changeRole(u: Utilizador, role: string) {
    try {
      const updated = await api.put<Utilizador>(`/utilizadores/${u.id}/role`, { role_global: role });
      setItems(prev => prev.map(x => x.id === u.id ? updated : x));
    } catch (e: any) { alert(e?.message ?? "Erro"); }
  }

  async function deleteUser(u: Utilizador) {
    if (!confirm(`Desactivar permanentemente a conta "${u.username}"?`)) return;
    try {
      await api.delete(`/utilizadores/${u.id}`);
      setItems(prev => prev.map(x => x.id === u.id ? { ...x, activo: false } : x));
    } catch (e: any) { alert(e?.message ?? "Erro"); }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{t("utilizadores.title")}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {loading ? "A carregar..." : `${items.length} conta${items.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-sm"
        >
          <UserPlus className="w-4 h-4" /> Criar utilizador
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl bg-red-50 border border-red-100 p-4 text-red-700 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-100">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse bg-slate-50" />)}
          </div>
        ) : items.length === 0 && !error ? (
          <div className="text-center py-20">
            <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">{t("utilizadores.noUsers")}</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {[t("utilizadores.username"), "Email", "Role", "2FA", "Estado", "Registado em", "Acções"].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-slate-800">{u.username}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 max-w-[160px] truncate">{u.email}</td>
                      <td className="px-4 py-3.5">
                        <select value={u.role_global} onChange={e => changeRole(u, e.target.value)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${ROLE_COLORS[u.role_global] ?? "bg-slate-100 text-slate-600"}`}>
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${u.totp_activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {u.totp_activo ? "On" : "Off"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${u.activo ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-400">
                        {new Date(u.criado_em).toLocaleDateString("pt-PT")}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setPermUser(u)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition">
                            <Key className="w-3.5 h-3.5" /> Permissões
                          </button>
                          <button onClick={() => toggleActive(u)} disabled={toggling === u.id}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50 ${u.activo ? "bg-red-50 hover:bg-red-100 text-red-600" : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"}`}>
                            {u.activo ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            {toggling === u.id ? "..." : u.activo ? "Desactivar" : "Activar"}
                          </button>
                          <button onClick={() => deleteUser(u)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-slate-100">
              {items.map(u => (
                <div key={u.id} className="px-4 py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="font-semibold text-slate-800">{u.username}</p>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role_global] ?? "bg-slate-100"}`}>{u.role_global}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2 truncate">{u.email}</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setPermUser(u)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 text-xs font-medium">
                      <Key className="w-3 h-3" /> Permissões
                    </button>
                    <button onClick={() => toggleActive(u)} disabled={toggling === u.id}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium disabled:opacity-50 ${u.activo ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
                      {u.activo ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                      {toggling === u.id ? "..." : u.activo ? "Desactivar" : "Activar"}
                    </button>
                    <select value={u.role_global} onChange={e => changeRole(u, e.target.value)}
                      className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button onClick={() => deleteUser(u)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={u => { setItems(prev => [u, ...prev]); setShowCreate(false); }}
        />
      )}
      {permUser && (
        <PermissoesPanel
          user={permUser}
          estudos={estudos}
          onClose={() => setPermUser(null)}
        />
      )}
    </div>
  );
}
