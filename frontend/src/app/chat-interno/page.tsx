"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Plus,
  Send,
  Phone,
  PhoneOff,
  PhoneCall,
  PhoneMissed,
  Mic,
  MicOff,
  Users,
  UserPlus,
  X,
  Check,
  Clock,
  Video,
} from "lucide-react";
import { api } from "@/lib/api";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useI18n } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Utilizador {
  id: string;
  username: string;
  role: string;
}

interface Conversa {
  id: number;
  nome: string | null;
  tipo: "direto" | "grupo";
  unread: number;
  ultimo_msg: string | null;
  ultimo_msg_em: string | null;
  membros: { id: string; username: string; role: string }[];
}

interface ChatMsg {
  id: number;
  remetente_id: string;
  remetente_username: string;
  texto: string;
  criada_em: string;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ChatInternoPage() {
  const { t } = useI18n();
  const router = useRouter();

  // Conversations
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selected, setSelected] = useState<Conversa | null>(null);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // Users (for new chat / group)
  const [utilizadores, setUtilizadores] = useState<Utilizador[]>([]);
  const [myId, setMyId] = useState("");
  const [myRole, setMyRole] = useState("");
  const [myUsername, setMyUsername] = useState("");

  // Modals
  const [showNewDirect, setShowNewDirect] = useState(false);
  const [showNewGrupo, setShowNewGrupo] = useState(false);
  const [grupoNome, setGrupoNome] = useState("");
  const [grupoMembros, setGrupoMembros] = useState<string[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // WebRTC
  const {
    callState,
    incomingCall,
    isMuted,
    callDuration,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    handleSignal,
  } = useWebRTC(wsRef);

  // ── WebSocket connection ────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${proto}://${window.location.host}/api/ws?token=${encodeURIComponent(token)}`
    );
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "signal" && msg.from && msg.data) {
          handleSignal(msg.from, msg.data);
        }
        // New chat message → refresh conversation list + current thread
        if (msg.evento === "chat_msg") {
          fetchConversas();
          if (selected && msg.conversa_id === selected.id) {
            fetchMsgs(selected.id);
          }
        }
      } catch { /* ignore */ }
    };
    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-attach onmessage when handleSignal or selected changes
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "signal" && msg.from && msg.data) {
          handleSignal(msg.from, msg.data);
        }
        if (msg.evento === "chat_msg") {
          fetchConversas();
          if (selected && msg.conversa_id === selected.id) {
            fetchMsgs(selected.id);
          }
        }
      } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSignal, selected]);

  // ── Data loading ────────────────────────────────────────────────────────────
  const fetchConversas = useCallback(() => {
    api.get<Conversa[]>("/chat-interno/conversas").then(setConversas).catch(() => {});
  }, []);

  const fetchMsgs = useCallback((cid: number) => {
    api
      .get<ChatMsg[]>(`/chat-interno/conversas/${cid}/mensagens`)
      .then((data) => {
        setMsgs(data);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.replace("/login"); return; }

    Promise.all([
      api.get<Conversa[]>("/chat-interno/conversas").then(setConversas),
      api.get<Utilizador[]>("/chat-interno/utilizadores").then(setUtilizadores),
      api
        .get<{ id: string; username: string; role_global: string }>("/auth/me")
        .then((me) => { setMyId(me.id); setMyRole(me.role_global); setMyUsername(me.username); }),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  // Poll message thread every 4 seconds while a convo is open
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selected) return;
    pollRef.current = setInterval(() => fetchMsgs(selected.id), 4_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, fetchMsgs]);

  // ── Open conversation ───────────────────────────────────────────────────────
  const openConversa = async (conv: Conversa) => {
    setSelected(conv);
    setMsgs([]);
    fetchMsgs(conv.id);
    // Mark as read
    await api.put(`/chat-interno/conversas/${conv.id}/ler`).catch(() => {});
    setConversas((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unread: 0 } : c))
    );
  };

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMsg = async () => {
    if (!selected || !texto.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/chat-interno/conversas/${selected.id}/mensagens`, { texto });
      setTexto("");
      fetchMsgs(selected.id);
      fetchConversas();
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  };

  // ── New direct conversation ─────────────────────────────────────────────────
  const startDirect = async (uid: string, andCall = false) => {
    setShowNewDirect(false);
    const conv = await api
      .post<Conversa>("/chat-interno/conversas/direto", { utilizador_id: uid })
      .catch(() => null);
    if (conv) {
      fetchConversas();
      await openConversa(conv);
      if (andCall) {
        // slight delay to let conversation state settle
        setTimeout(() => {
          const other = conv.membros.find((m) => m.id !== myId);
          if (other) startCall(other.id, myUsername);
        }, 300);
      }
    }
  };

  // ── Direct call from sidebar (without opening thread first) ──────────────
  const callFromSidebar = async (e: React.MouseEvent, conv: Conversa) => {
    e.stopPropagation();
    if (callState !== "idle") return;
    const other = conv.membros.find((m) => m.id !== myId);
    if (!other) return;
    await openConversa(conv);
    setTimeout(() => startCall(other.id, myUsername), 300);
  };

  // ── New group ───────────────────────────────────────────────────────────────
  const createGrupo = async () => {
    if (!grupoNome.trim() || grupoMembros.length === 0) return;
    const conv = await api
      .post<Conversa>("/chat-interno/conversas/grupo", {
        nome: grupoNome,
        membros: grupoMembros,
      })
      .catch(() => null);
    if (conv) {
      setShowNewGrupo(false);
      setGrupoNome("");
      setGrupoMembros([]);
      fetchConversas();
      openConversa(conv);
    }
  };

  // ── Add member ──────────────────────────────────────────────────────────────
  const addMember = async (uid: string) => {
    if (!selected) return;
    await api
      .post(`/chat-interno/conversas/${selected.id}/membros`, { utilizador_id: uid })
      .catch(() => {});
    setShowAddMember(false);
    fetchConversas();
  };

  // ── Other party for calling (1:1 only) ─────────────────────────────────────
  const otherUser = selected?.tipo === "direto"
    ? selected.membros.find((m) => m.id !== myId) ?? null
    : null;

  // total unread badge
  const totalUnread = conversas.reduce((s, c) => s + c.unread, 0);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#2D6BEE] border-t-transparent rounded-full" />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white dark:bg-slate-900 overflow-hidden">

      {/* ── Incoming call overlay ───────────────────────────────────────────── */}
      {callState === "receiving" && incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-5 min-w-[280px]">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-pulse">
              <PhoneCall className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Chamada recebida</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{incomingCall.userName}</p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => acceptCall()}
                className="flex items-center gap-2 px-5 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition"
              >
                <Phone className="w-4 h-4" /> Atender
              </button>
              <button
                onClick={() => rejectCall()}
                className="flex items-center gap-2 px-5 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition"
              >
                <PhoneMissed className="w-4 h-4" /> Rejeitar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active call banner ──────────────────────────────────────────────── */}
      {(callState === "active" || callState === "connecting") && (
        <div className="fixed bottom-6 right-6 z-40 bg-green-600 text-white rounded-2xl shadow-xl px-5 py-3 flex items-center gap-4">
          <div className="flex flex-col leading-tight">
            <span className="text-xs opacity-75">
              {callState === "connecting" ? "A ligar…" : "Em chamada"}
            </span>
            <span className="font-semibold">{otherUser?.username ?? "…"}</span>
          </div>
          {callState === "active" && (
            <span className="font-mono text-sm bg-green-700 rounded-lg px-2 py-0.5">
              {formatDuration(callDuration)}
            </span>
          )}
          <button
            onClick={() => toggleMute()}
            className="p-2 bg-green-700 hover:bg-green-800 rounded-xl transition"
            title={isMuted ? "Desmutar" : "Mutar"}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={() => endCall()}
            className="p-2 bg-red-500 hover:bg-red-600 rounded-xl transition"
            title="Desligar"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Left: conversation list ─────────────────────────────────────────── */}
      <aside className="w-72 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#2D6BEE]" />
            <h1 className="font-bold text-slate-900 dark:text-white">{t("chatInterno.title")}</h1>
            {totalUnread > 0 && (
              <span className="text-xs bg-[#2D6BEE] text-white rounded-full px-1.5 py-0.5 font-semibold leading-none">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowNewDirect(true)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={t("chatInterno.newConversation")}
            >
              <Plus className="w-4 h-4 text-slate-500" />
            </button>
            {(myRole === "admin" || myRole === "coordenador") && (
              <button
                onClick={() => setShowNewGrupo(true)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title={t("chatInterno.newGroup")}
              >
                <Users className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {conversas.length === 0 && (
            <p className="text-center text-slate-400 text-sm mt-8 px-4">
              Sem conversas. Cria uma nova com o botão +
            </p>
          )}
          {conversas.map((conv) => {
            const isActive = selected?.id === conv.id;
            const convName =
              conv.nome ??
              conv.membros.filter((m) => m.id !== myId).map((m) => m.username).join(", ") ??
              "Conversa";
            return (
              <div
                key={conv.id}
                className={`group w-full flex items-start border-b border-slate-100 dark:border-slate-800 ${isActive ? "bg-orange-50 dark:bg-slate-800/80 border-l-2 border-l-[#2D6BEE]" : "hover:bg-slate-50 dark:hover:bg-slate-800"} transition`}
              >
              <button
                onClick={() => openConversa(conv)}
                className="flex-1 text-left px-4 py-3 flex items-start gap-3 min-w-0"
              >
                <div className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                  conv.tipo === "grupo"
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                    : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                }`}>
                  {conv.tipo === "grupo" ? <Users className="w-4 h-4" /> : convName[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-sm font-semibold truncate ${isActive ? "text-[#2D6BEE]" : "text-slate-800 dark:text-slate-200"}`}>
                      {convName}
                    </span>
                    {conv.ultimo_msg_em && (
                      <span className="text-[10px] text-slate-400 flex-shrink-0">
                        {formatTime(conv.ultimo_msg_em)}
                      </span>
                    )}
                  </div>
                  {conv.ultimo_msg ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {conv.ultimo_msg}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Sem mensagens</p>
                  )}
                </div>
                {conv.unread > 0 && (
                  <span className="flex-shrink-0 text-xs bg-[#2D6BEE] text-white rounded-full w-5 h-5 flex items-center justify-center font-bold leading-none mt-1">
                    {conv.unread > 9 ? "9+" : conv.unread}
                  </span>
                )}
              </button>
              {conv.tipo === "direto" && callState === "idle" && (
                <button
                  onClick={(e) => callFromSidebar(e, conv)}
                  className="self-center mr-3 p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition opacity-0 group-hover:opacity-100"
                  title={`Ligar para ${conv.membros.find((m) => m.id !== myId)?.username ?? ""}`}
                >
                  <Phone className="w-3.5 h-3.5" />
                </button>
              )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── Right: message thread ───────────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Thread header */}
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                selected.tipo === "grupo"
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                  : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
              }`}>
                {selected.tipo === "grupo"
                  ? <Users className="w-4 h-4" />
                  : (selected.nome ?? selected.membros.find((m) => m.id !== myId)?.username ?? "?")[0]?.toUpperCase()
                }
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                  {selected.nome ??
                    selected.membros
                      .filter((m) => m.id !== myId)
                      .map((m) => m.username)
                      .join(", ")}
                </p>
                <p className="text-xs text-slate-400">
                  {selected.tipo === "grupo"
                    ? `${selected.membros.length} membros`
                    : selected.membros.find((m) => m.id !== myId)?.role ?? ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Add member — groups, admin/coordenador only */}
              {selected.tipo === "grupo" && (myRole === "admin" || myRole === "coordenador") && (
                <button
                  onClick={() => setShowAddMember(true)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-500"
                  title={t("chatInterno.addMember")}
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              )}
              {/* Voice call — 1:1 only, idle state */}
              {otherUser && callState === "idle" && (
                <button
                  onClick={() => startCall(otherUser.id, myUsername)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold shadow transition"
                  title="Iniciar chamada de voz"
                >
                  <Phone className="w-4 h-4" /> Ligar
                </button>
              )}
              {otherUser && callState === "calling" && (
                <button
                  onClick={() => endCall()}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold shadow transition animate-pulse"
                >
                  <PhoneOff className="w-4 h-4" /> A ligar… Cancelar
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {msgs.length === 0 && (
              <p className="text-center text-slate-400 text-sm mt-8">
                Ainda sem mensagens. Escreve algo!
              </p>
            )}
            {msgs.map((msg) => {
              const isMe = msg.remetente_id === myId;
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm ${
                    isMe
                      ? "bg-[#2D6BEE] text-white rounded-br-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm"
                  }`}>
                    {selected.tipo === "grupo" && !isMe && (
                      <p className="text-[10px] font-semibold mb-1 opacity-75">{msg.remetente_username}</p>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.texto}</p>
                    <p className={`text-[10px] mt-1 text-right ${isMe ? "opacity-60" : "text-slate-400"}`}>
                      {formatTime(msg.criada_em)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="flex items-end gap-2">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMsg();
                  }
                }}
                placeholder={t("chatInterno.messagePlaceholder")}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30 min-h-[42px] max-h-[120px] overflow-y-auto"
                style={{ height: "auto" }}
              />
              <button
                onClick={sendMsg}
                disabled={!texto.trim() || sending}
                className="p-2.5 rounded-xl bg-[#2D6BEE] text-white hover:bg-[#1A52CC] disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Seleciona uma conversa</p>
            <p className="text-sm mt-1">ou cria uma nova com o botão +</p>
          </div>
        </div>
      )}

      {/* ── Modal: Nova conversa direta ─────────────────────────────────────── */}
      {showNewDirect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowNewDirect(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-96 max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-bold text-slate-900 dark:text-white">Nova Conversa</h2>
              <button onClick={() => setShowNewDirect(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Clica em <Phone className="inline w-3 h-3 mb-0.5" /> para ligar direto ou em <MessageSquare className="inline w-3 h-3 mb-0.5" /> para abrir chat</p>
            <div className="overflow-y-auto p-3">
              {utilizadores
                .filter((u) => u.id !== myId)
                .map((u) => (
                  <div key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition group">
                    <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {u.username[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{u.username}</p>
                      <p className="text-xs text-slate-400">{u.role}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => startDirect(u.id, false)}
                        className="p-2 rounded-lg text-slate-500 hover:text-[#2D6BEE] hover:bg-orange-50 dark:hover:bg-orange-900/20 transition"
                        title="Abrir chat"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => startDirect(u.id, true)}
                        className="p-2 rounded-lg text-slate-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition"
                        title="Ligar"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Novo grupo ────────────────────────────────────────────────── */}
      {showNewGrupo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowNewGrupo(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-96 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-bold text-slate-900 dark:text-white">Novo Grupo</h2>
              <button onClick={() => setShowNewGrupo(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <input
                type="text"
                placeholder={t("chatInterno.groupNamePlaceholder")}
                value={grupoNome}
                onChange={(e) => setGrupoNome(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30"
              />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Membros</p>
              <div className="overflow-y-auto max-h-48 flex flex-col gap-1">
                {utilizadores
                  .filter((u) => u.id !== myId)
                  .map((u) => {
                    const selected = grupoMembros.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() =>
                          setGrupoMembros((prev) =>
                            selected ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                          )
                        }
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition text-left ${
                          selected
                            ? "bg-orange-50 dark:bg-orange-900/20 border border-[#2D6BEE]/30"
                            : "hover:bg-slate-50 dark:hover:bg-slate-700"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                          selected ? "bg-[#2D6BEE] border-[#2D6BEE]" : "border-slate-300 dark:border-slate-600"
                        }`}>
                          {selected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{u.username}</p>
                          <p className="text-xs text-slate-400">{u.role}</p>
                        </div>
                      </button>
                    );
                  })}
              </div>
              <button
                onClick={createGrupo}
                disabled={!grupoNome.trim() || grupoMembros.length === 0}
                className="w-full py-2.5 bg-[#2D6BEE] text-white rounded-xl font-medium text-sm hover:bg-[#1A52CC] disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Criar Grupo ({grupoMembros.length} membros)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Adicionar membro ao grupo ────────────────────────────────── */}
      {showAddMember && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAddMember(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-80 max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-bold text-slate-900 dark:text-white">Adicionar Membro</h2>
              <button onClick={() => setShowAddMember(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto p-3">
              {utilizadores
                .filter((u) => !selected.membros.some((m) => m.id === u.id))
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => addMember(u.id)}
                    className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 flex items-center justify-center text-sm font-bold">
                      {u.username[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{u.username}</p>
                      <p className="text-xs text-slate-400">{u.role}</p>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
