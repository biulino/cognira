"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Inbox,
  Send,
  PenSquare,
  MailOpen,
  Mail,
  ChevronLeft,
  Clock,
  User,
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  Mic,
  MicOff,
} from "lucide-react";
import { api } from "@/lib/api";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useI18n } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────
interface MsgIn {
  id: number;
  remetente_id: string;
  remetente_username: string;
  destinatario_id: string;
  assunto: string;
  corpo: string;
  lida: boolean;
  criada_em: string;
}

interface MsgOut {
  id: number;
  remetente_id: string;
  destinatario_id: string;
  destinatario_username: string;
  assunto: string;
  corpo: string;
  lida: boolean;
  criada_em: string;
}

interface User {
  id: string;
  username: string;
  role: string;
}

type Tab = "inbox" | "enviadas" | "escrever";

// ── Helpers ───────────────────────────────────────────────
function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  coordenador: "Coord.",
  validador: "Valid.",
  analista: "Analista",
  cliente: "Cliente",
};

// ── Main Page ─────────────────────────────────────────────
export default function MensagensPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("inbox");
  const [inbox, setInbox] = useState<MsgIn[]>([]);
  const [sent, setSent] = useState<MsgOut[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState<MsgIn | MsgOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string>("");
  const [myName, setMyName] = useState<string>("");

  // Compose state
  const [toId, setToId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendOk, setSendOk] = useState(false);
  const [sendErr, setSendErr] = useState("");

  // WebSocket for real-time + signaling
  const wsRef = useRef<WebSocket | null>(null);

  const {
    callState,
    incomingCall,
    remoteUserId,
    isMuted,
    callDuration,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    handleSignal,
  } = useWebRTC(wsRef);

  // Connect WebSocket once
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/api/ws?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "signal" && msg.from && msg.data) {
          handleSignal(msg.from, msg.data);
        }
      } catch { /* ignore */ }
    };
    return () => ws.close();
  // handleSignal changes on every render; we only want one WS — use stable ref trick below
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-attach onmessage when handleSignal changes (stable WS, fresh handler)
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "signal" && msg.from && msg.data) {
          handleSignal(msg.from, msg.data);
        }
      } catch { /* ignore */ }
    };
  }, [handleSignal]);

  const loadInbox = useCallback(() =>
    api.get<MsgIn[]>("/mensagens/").then(setInbox).catch(() => {}), []);
  const loadSent = useCallback(() =>
    api.get<MsgOut[]>("/mensagens/enviadas").then(setSent).catch(() => {}), []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }
    Promise.all([
      loadInbox(),
      loadSent(),
      api.get<User[]>("/mensagens/utilizadores").then(setUsers).catch(() => {}),
      api.get<{ id: string; username: string }>("/auth/me").then(me => {
        setMyId(me.id);
        setMyName(me.username);
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [router, loadInbox, loadSent]);

  const openMsg = async (msg: MsgIn | MsgOut) => {
    setOpen(msg);
    // Mark as read if inbox message and unread
    if ("remetente_username" in msg && !msg.lida) {
      await api.put(`/mensagens/${msg.id}/lida`).catch(() => {});
      setInbox(prev => prev.map(m => m.id === msg.id ? { ...m, lida: true } : m));
    }
  };

  const sendMsg = async () => {
    if (!toId || !subject.trim() || !body.trim()) return;
    setSending(true);
    setSendErr("");
    setSendOk(false);
    try {
      await api.post("/mensagens/", { destinatario_id: toId, assunto: subject, corpo: body });
      setSendOk(true);
      setToId(""); setSubject(""); setBody("");
      loadSent();
      setTimeout(() => setSendOk(false), 3000);
    } catch (e: unknown) {
      setSendErr(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  const unread = inbox.filter(m => !m.lida).length;

  // Name of the user we're calling/receiving from  
  const callPartnerName =
    incomingCall?.userName ??
    users.find(u => u.id === (callState !== "idle" ? remoteUserId : null))?.username ??
    "Utilizador";

  // Suppress unused warning — myId used in future call filtering
  void myId;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[#2D6BEE]/30 border-t-[#2D6BEE] rounded-full animate-spin" />
      </div>
    );
  }

  // ── Message detail view ────────────────────────────────
  if (open) {
    const isInbound = "remetente_username" in open;
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <button
          onClick={() => setOpen(null)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-900">{open.assunto}</h2>
            {isInbound && (
              <button
                onClick={() => startCall((open as MsgIn).remetente_id, myName)}
                disabled={callState !== "idle"}
                title="Ligar"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium rounded-lg transition disabled:opacity-30"
              >
                <Phone className="w-3.5 h-3.5" /> Ligar
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 mb-6 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              {isInbound
                ? `De: ${(open as MsgIn).remetente_username}`
                : `Para: ${(open as MsgOut).destinatario_username}`}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {new Date(open.criada_em).toLocaleString("pt-PT")}
            </span>
          </div>
          <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">{open.corpo}</div>
        </div>
      </div>
    );
  }

  // ── Main list view ─────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

      {/* ── Incoming call banner ── */}
      {callState === "receiving" && incomingCall && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl px-6 py-4 flex items-center gap-5 min-w-[300px]">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 animate-pulse">
            <PhoneCall className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{incomingCall.userName}</p>
            <p className="text-xs text-slate-500">{t("mensagens.incomingCall")}</p>
          </div>
          <button
            onClick={acceptCall}
            className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition"
            title="Atender"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            onClick={rejectCall}
            className="w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition"
            title="Rejeitar"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Active / connecting call overlay ── */}
      {(callState === "calling" || callState === "connecting" || callState === "active") && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white shadow-2xl rounded-2xl px-6 py-4 flex items-center gap-5 min-w-[280px]">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${callState === "active" ? "bg-emerald-600" : "bg-slate-700 animate-pulse"}`}>
            <PhoneCall className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{callPartnerName}</p>
            <p className="text-xs text-slate-400">
              {callState === "calling" ? "A chamar…" : callState === "connecting" ? "A ligar…" : fmtDuration(callDuration)}
            </p>
          </div>
          {callState === "active" && (
            <button
              onClick={toggleMute}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition ${isMuted ? "bg-amber-500 hover:bg-amber-600" : "bg-slate-700 hover:bg-slate-600"}`}
              title={isMuted ? "Activar microfone" : "Silenciar"}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={endCall}
            className="w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition"
            title="Terminar chamada"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Ended flash ── */}
      {callState === "ended" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white shadow-xl rounded-2xl px-5 py-3 flex items-center gap-3">
          <PhoneMissed className="w-4 h-4 text-slate-400" />
          <span className="text-sm">{t("mensagens.callEnded")}</span>
        </div>
      )}
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{t("mensagens.title")}</h1>
        <p className="text-slate-500 text-sm mt-0.5">Comunicação interna entre utilizadores</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 w-fit">
        {([
          { key: "inbox",    label: "Caixa de entrada", icon: Inbox,     badge: unread },
          { key: "enviadas", label: "Enviadas",          icon: Send,      badge: 0 },
          { key: "escrever", label: "Nova mensagem",     icon: PenSquare, badge: 0 },
        ] as const).map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
              tab === key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
            {badge > 0 && (
              <span className="ml-0.5 bg-[#2D6BEE] text-white text-xs rounded-full px-1.5 py-0.5 leading-none font-semibold">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── INBOX ── */}
      {tab === "inbox" && (
        <div className="space-y-2">
          {inbox.length === 0 ? (
            <EmptyState icon={Inbox} text="Sem mensagens na caixa de entrada" />
          ) : inbox.map(msg => (
            <div key={msg.id} className={`rounded-2xl border transition ${msg.lida ? "bg-white border-slate-200" : "bg-blue-50 border-blue-200"}`}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openMsg(msg)}
                  className="flex-1 text-left px-4 py-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {msg.lida
                        ? <MailOpen className="w-4 h-4 text-slate-400 shrink-0" />
                        : <Mail className="w-4 h-4 text-[#2D6BEE] shrink-0" />}
                      <div className="min-w-0">
                        <p className={`text-sm truncate ${msg.lida ? "font-medium text-slate-700" : "font-semibold text-slate-900"}`}>
                          {msg.remetente_username}
                        </p>
                        <p className={`text-sm truncate ${msg.lida ? "text-slate-500" : "text-slate-700"}`}>
                          {msg.assunto}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 mt-0.5">{fmtDate(msg.criada_em)}</span>
                  </div>
                </button>
                <button
                  onClick={() => startCall(msg.remetente_id, myName)}
                  disabled={callState !== "idle"}
                  title={`Ligar para ${msg.remetente_username}`}
                  className="mr-3 w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition disabled:opacity-30 shrink-0"
                >
                  <Phone className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ENVIADAS ── */}
      {tab === "enviadas" && (
        <div className="space-y-2">
          {sent.length === 0 ? (
            <EmptyState icon={Send} text="Nenhuma mensagem enviada" />
          ) : sent.map(msg => (
            <div key={msg.id} className="bg-white rounded-2xl border border-slate-200 transition hover:shadow-sm flex items-center gap-2">
              <button
                onClick={() => openMsg(msg)}
                className="flex-1 text-left px-4 py-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Send className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        Para: {msg.destinatario_username}
                      </p>
                      <p className="text-sm text-slate-500 truncate">{msg.assunto}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-slate-400">{fmtDate(msg.criada_em)}</span>
                    {msg.lida
                      ? <span className="text-xs text-emerald-600 font-medium">Lida</span>
                      : <span className="text-xs text-slate-400">{t("mensagens.unread")}</span>}
                  </div>
                </div>
              </button>
              <button
                onClick={() => startCall(msg.destinatario_id, myName)}
                disabled={callState !== "idle"}
                title={`Ligar para ${msg.destinatario_username}`}
                className="mr-3 w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition disabled:opacity-30 shrink-0"
              >
                <Phone className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── COMPOSE ── */}
      {tab === "escrever" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          {sendOk && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800 font-medium">
              ✓ Mensagem enviada com sucesso!
            </div>
          )}
          {sendErr && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {sendErr}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Destinatário</label>
            <select
              value={toId}
              onChange={e => setToId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/20 focus:border-[#2D6BEE]"
            >
              <option value="">{t("mensagens.selectUser")}</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.username} ({ROLE_LABELS[u.role] ?? u.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Assunto</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              maxLength={200}
              placeholder={t("mensagens.subjectPlaceholder")}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/20 focus:border-[#2D6BEE]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Mensagem</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={6}
              placeholder={t("mensagens.bodyPlaceholder")}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/20 focus:border-[#2D6BEE] resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={sendMsg}
              disabled={sending || !toId || !subject.trim() || !body.trim()}
              className="flex items-center gap-2 px-5 py-2.5 text-sm text-white bg-[#2D6BEE] hover:bg-[#1A52CC] rounded-xl font-medium transition disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
              {sending ? "A enviar…" : "Enviar mensagem"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <Icon className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
