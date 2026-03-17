"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  MessageCircle,
  X,
  ChevronLeft,
  Send,
  Plus,
  Users,
  User,
  Check,
  CheckCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import wsClient from "@/lib/ws";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatUser {
  id: string;
  username: string;
  role: string;
}

interface Conversa {
  id: number;
  nome: string;
  tipo: "direto" | "grupo";
  ultimo_msg: string | null;
  ultimo_msg_em: string | null;
  unread: number;
  membros: ChatUser[];
}

interface Msg {
  id: number;
  conversa_id: number;
  remetente_id: string;
  remetente_username: string;
  texto: string;
  criada_em: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500",
  coordenador: "bg-orange-500",
  validador: "bg-yellow-500",
  analista: "bg-green-500",
  cliente: "bg-purple-500",
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "chat" | "nova-direto" | "novo-grupo">("list");
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [activeConv, setActiveConv] = useState<Conversa | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [meId, setMeId] = useState("");
  const [meRole, setMeRole] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConversas, setLoadingConversas] = useState(false);

  // New group state
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMsgTs = useRef<string | null>(null);

  // ── Draggable bubble ────────────────────────────────────────────────────────
  const [bubblePos, setBubblePos] = useState({ bottom: 20, right: 20 });
  const dragData = useRef<{ startX: number; startY: number; origBottom: number; origRight: number } | null>(null);
  const didDrag = useRef(false);

  const onBubblePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    dragData.current = {
      startX: e.clientX,
      startY: e.clientY,
      origBottom: bubblePos.bottom,
      origRight: bubblePos.right,
    };
    didDrag.current = false;
    (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
  };

  const onBubblePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragData.current) return;
    const dx = e.clientX - dragData.current.startX;
    const dy = e.clientY - dragData.current.startY;
    if (!didDrag.current && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
    didDrag.current = true;
    const newRight = Math.max(8, Math.min(window.innerWidth - 64, dragData.current.origRight - dx));
    const newBottom = Math.max(8, Math.min(window.innerHeight - 64, dragData.current.origBottom - dy));
    setBubblePos({ right: newRight, bottom: newBottom });
  };

  const onBubblePointerUp = () => {
    if (!didDrag.current) {
      setOpen(o => !o);
    }
    dragData.current = null;
    didDrag.current = false;
  };

  // ── init: get meId ──────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    api.get<{ id: string; role_global: string }>("/auth/me")
      .then(me => { setMeId(me.id); setMeRole(me.role_global); })
      .catch(() => {});
  }, []);

  // ── unread polling (always on, every 30s) ────────────────────────────────────
  useEffect(() => {
    if (!meId) return;
    const poll = () =>
      api.get<{ count: number }>("/chat-interno/nao-lidas")
        .then(r => setUnreadTotal(r.count))
        .catch(() => {});
    poll();
    const iv = setInterval(poll, 30_000);
    return () => clearInterval(iv);
  }, [meId]);

  // ── load conversations when panel opens ─────────────────────────────────────
  const loadConversas = useCallback(async () => {
    setLoadingConversas(true);
    try {
      const data = await api.get<Conversa[]>("/chat-interno/conversas");
      setConversas(data);
      setUnreadTotal(data.reduce((s, c) => s + c.unread, 0));
    } catch { /* ignore */ }
    finally { setLoadingConversas(false); }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.get<ChatUser[]>("/chat-interno/utilizadores");
      setUsers(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (open && meId) {
      loadConversas();
      loadUsers();
    }
  }, [open, meId, loadConversas, loadUsers]);

  // ── message polling when in a conversation (fallback; WS handles real-time) ─
  const loadMsgs = useCallback(async (convId: number, sinceTs?: string) => {
    const url = sinceTs
      ? `/chat-interno/conversas/${convId}/mensagens?desde=${encodeURIComponent(sinceTs)}`
      : `/chat-interno/conversas/${convId}/mensagens`;
    try {
      const data = await api.get<Msg[]>(url);
      if (data.length > 0) {
        if (sinceTs) {
          setMsgs(prev => [...prev, ...data]);
        } else {
          setMsgs(data);
        }
        lastMsgTs.current = data[data.length - 1].criada_em;
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (view === "chat" && activeConv) {
      loadMsgs(activeConv.id);
      api.put(`/chat-interno/conversas/${activeConv.id}/ler`).catch(() => {});
      pollRef.current = setInterval(() => {
        loadMsgs(activeConv.id, lastMsgTs.current ?? undefined);
      }, 15_000); // fallback; WS handles the fast path
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [view, activeConv, loadMsgs]);

  // ── WebSocket: react to new chat messages immediately ────────────────────────
  useEffect(() => {
    const off = wsClient.on("chat_msg", (data) => {
      const convId = data.conversa_id as number;
      if (view === "chat" && activeConv?.id === convId) {
        // Fetch only the new messages since the last known timestamp
        loadMsgs(convId, lastMsgTs.current ?? undefined);
        api.put(`/chat-interno/conversas/${convId}/ler`).catch(() => {});
      } else {
        // Update unread badge on the conversation list
        setConversas(prev =>
          prev.map(c => c.id === convId ? { ...c, unread: c.unread + 1 } : c)
        );
        setUnreadTotal(n => n + 1);
      }
    });
    return off;
  }, [view, activeConv, loadMsgs]);

  // ── scroll to bottom on new messages ────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMsg = useCallback(async () => {
    if (!activeConv || !texto.trim() || sending) return;
    setSending(true);
    const t = texto.trim();
    setTexto("");
    // Optimistic
    const tmpMsg: Msg = {
      id: Date.now(),
      conversa_id: activeConv.id,
      remetente_id: meId,
      remetente_username: "eu",
      texto: t,
      criada_em: new Date().toISOString(),
    };
    setMsgs(prev => [...prev, tmpMsg]);
    try {
      await api.post(`/chat-interno/conversas/${activeConv.id}/mensagens`, { texto: t });
      lastMsgTs.current = tmpMsg.criada_em;
    } catch { /* reset if fail */ } finally { setSending(false); }
    inputRef.current?.focus();
  }, [activeConv, texto, sending, meId]);

  // ── Open a conversation ─────────────────────────────────────────────────────
  const openConv = useCallback((conv: Conversa) => {
    setActiveConv(conv);
    setMsgs([]);
    lastMsgTs.current = null;
    setView("chat");
  }, []);

  // ── Start direct chat ───────────────────────────────────────────────────────
  const startDirectChat = useCallback(async (userId: string) => {
    try {
      const conv = await api.post<Conversa>("/chat-interno/conversas/direto", {
        utilizador_id: userId,
      });
      setConversas(prev => {
        const existing = prev.find(c => c.id === conv.id);
        if (existing) return prev;
        return [conv, ...prev];
      });
      openConv(conv);
    } catch { /* ignore */ }
  }, [openConv]);

  // ── Create group ────────────────────────────────────────────────────────────
  const createGroup = useCallback(async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    try {
      const conv = await api.post<Conversa>("/chat-interno/conversas/grupo", {
        nome: groupName.trim(),
        membros: selectedMembers,
      });
      setConversas(prev => [conv, ...prev]);
      setGroupName("");
      setSelectedMembers([]);
      openConv(conv);
    } catch { /* ignore */ }
  }, [groupName, selectedMembers, openConv]);

  const toggleMember = (id: string) => {
    setSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // ── Key handler ─────────────────────────────────────────────────────────────
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  };

  if (!meId) return null;

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed z-50 flex flex-col items-end gap-3" style={{ bottom: bubblePos.bottom, right: bubblePos.right }}>

      {/* ── Chat Panel ────────────────────────────────────────────────────────── */}
      {open && (
        <div className="w-[360px] max-w-[calc(100vw-2.5rem)] h-[520px] max-h-[calc(100vh-5rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-[#2D6BEE] text-white px-4 py-3 flex items-center gap-2.5 shrink-0">
            {view !== "list" && (
              <button
                onClick={() => { setView("list"); loadConversas(); }}
                className="p-0.5 hover:bg-white/20 rounded-lg transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              {view === "list" && <span className="font-semibold text-sm">Chat Interno</span>}
              {view === "chat" && (
                <span className="font-semibold text-sm truncate">
                  {activeConv?.nome ?? "Conversa"}
                </span>
              )}
              {view === "nova-direto" && <span className="font-semibold text-sm">Nova conversa</span>}
              {view === "novo-grupo" && <span className="font-semibold text-sm">Criar grupo</span>}
            </div>
            <button onClick={() => setOpen(false)} className="p-0.5 hover:bg-white/20 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── CONVERSATION LIST ──────────────────────────────────────────── */}
          {view === "list" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Actions */}
              <div className="flex gap-2 px-3 py-2.5 border-b border-slate-100 shrink-0">
                <button
                  onClick={() => setView("nova-direto")}
                  className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-[#2D6BEE] bg-slate-50 hover:bg-orange-50 border border-slate-200 px-2.5 py-1.5 rounded-lg transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Mensagem
                </button>
                {(meRole === "admin" || meRole === "coordenador") && (
                  <button
                    onClick={() => setView("novo-grupo")}
                    className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-[#2D6BEE] bg-slate-50 hover:bg-orange-50 border border-slate-200 px-2.5 py-1.5 rounded-lg transition"
                  >
                    <Users className="w-3.5 h-3.5" /> Novo grupo
                  </button>
                )}
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {loadingConversas && (
                  <div className="flex justify-center py-8">
                    <div className="w-5 h-5 border-2 border-[#2D6BEE]/30 border-t-[#2D6BEE] rounded-full animate-spin" />
                  </div>
                )}
                {!loadingConversas && conversas.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <MessageCircle className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma conversa ainda</p>
                    <p className="text-xs mt-1">Clica em &quot;Mensagem&quot; para começar</p>
                  </div>
                )}
                {conversas.map(conv => {
                  const other = conv.tipo === "direto"
                    ? conv.membros.find(m => m.id !== meId)
                    : null;
                  const avatar = other ?? { username: conv.nome ?? "?", role: "admin" };
                  return (
                    <button
                      key={conv.id}
                      onClick={() => openConv(conv)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition text-left border-b border-slate-50"
                    >
                      <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold ${ROLE_COLORS[avatar.role] ?? "bg-slate-400"}`}>
                        {conv.tipo === "grupo"
                          ? <Users className="w-4 h-4" />
                          : initials(avatar.username)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className={`text-sm truncate ${conv.unread > 0 ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}>
                            {conv.nome ?? avatar.username}
                          </span>
                          {conv.ultimo_msg_em && (
                            <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                              {timeAgo(conv.ultimo_msg_em)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <p className="text-xs text-slate-400 truncate flex-1">
                            {conv.ultimo_msg ?? "Sem mensagens"}
                          </p>
                          {conv.unread > 0 && (
                            <span className="bg-[#2D6BEE] text-white text-[10px] font-bold rounded-full w-4.5 h-4.5 min-w-[18px] flex items-center justify-center shrink-0">
                              {conv.unread > 99 ? "99+" : conv.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── ACTIVE CONVERSATION ────────────────────────────────────────── */}
          {view === "chat" && activeConv && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Members bar (group only) */}
              {activeConv.tipo === "grupo" && (
                <div className="px-3 py-1.5 border-b border-slate-100 text-xs text-slate-400 shrink-0">
                  {activeConv.membros.map(m => m.username).join(", ")}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                {msgs.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-slate-300">
                    <MessageCircle className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-xs">Começa a conversa!</p>
                  </div>
                )}
                {msgs.map((msg, i) => {
                  const isMe = msg.remetente_id === meId;
                  const showName = !isMe && activeConv.tipo === "grupo" &&
                    (i === 0 || msgs[i - 1].remetente_id !== msg.remetente_id);
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      {showName && (
                        <span className="text-[10px] text-slate-400 mb-0.5 px-1">
                          {msg.remetente_username}
                        </span>
                      )}
                      <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                        isMe
                          ? "bg-[#2D6BEE] text-white rounded-br-sm"
                          : "bg-slate-100 text-slate-800 rounded-bl-sm"
                      }`}>
                        {msg.texto}
                      </div>
                      <span className="text-[10px] text-slate-300 mt-0.5 px-1">
                        {timeAgo(msg.criada_em)}
                        {isMe && <CheckCheck className="w-3 h-3 inline ml-0.5 text-slate-300" />}
                      </span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-3 py-2.5 border-t border-slate-100 flex gap-2 items-end shrink-0">
                <input
                  ref={inputRef}
                  type="text"
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Escreve uma mensagem…"
                  className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/20 focus:border-[#2D6BEE]"
                />
                <button
                  onClick={sendMsg}
                  disabled={!texto.trim() || sending}
                  className="bg-[#2D6BEE] hover:bg-[#1A52CC] disabled:opacity-40 text-white rounded-xl p-2 transition shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── NEW DIRECT CHAT ─────────────────────────────────────────────── */}
          {view === "nova-direto" && (
            <div className="flex-1 overflow-y-auto">
              <p className="text-xs text-slate-400 px-4 py-2">Selecciona um utilizador:</p>
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => startDirectChat(u.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${ROLE_COLORS[u.role] ?? "bg-slate-400"}`}>
                    {initials(u.username)}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-800">{u.username}</p>
                    <p className="text-xs text-slate-400 capitalize">{u.role}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── NEW GROUP ───────────────────────────────────────────────────── */}
          {view === "novo-grupo" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="px-4 py-3 space-y-2 border-b border-slate-100 shrink-0">
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="Nome do grupo…"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/20 focus:border-[#2D6BEE]"
                />
                <button
                  onClick={createGroup}
                  disabled={!groupName.trim() || selectedMembers.length === 0}
                  className="w-full text-sm bg-[#2D6BEE] hover:bg-[#1A52CC] disabled:opacity-40 text-white rounded-xl py-2 font-medium transition"
                >
                  Criar grupo ({selectedMembers.length} membros)
                </button>
              </div>
              <p className="text-xs text-slate-400 px-4 py-2 shrink-0">Selecciona membros:</p>
              <div className="flex-1 overflow-y-auto">
                {users.map(u => {
                  const selected = selectedMembers.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleMember(u.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 transition ${selected ? "bg-orange-50" : "hover:bg-slate-50"}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${ROLE_COLORS[u.role] ?? "bg-slate-400"}`}>
                        {initials(u.username)}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-slate-800">{u.username}</p>
                        <p className="text-xs text-slate-400 capitalize">{u.role}</p>
                      </div>
                      {selected && <Check className="w-4 h-4 text-[#2D6BEE]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Floating Bubble ───────────────────────────────────────────────────── */}
      <button
        onPointerDown={onBubblePointerDown}
        onPointerMove={onBubblePointerMove}
        onPointerUp={onBubblePointerUp}
        className="w-14 h-14 bg-[#2D6BEE] hover:bg-[#1A52CC] text-white rounded-full shadow-lg hover:shadow-xl transition-colors flex items-center justify-center relative cursor-grab active:cursor-grabbing select-none touch-none"
        aria-label="Chat interno"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!open && unreadTotal > 0 && (
          <span className="absolute -top-1 -right-1 bg-white text-[#2D6BEE] text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow border border-[#2D6BEE]/20">
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </span>
        )}
      </button>
    </div>
  );
}
