"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import wsClient from "@/lib/ws";
import { isPublicPath } from "@/lib/navConfig";

export interface AppContext {
  role: string;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  unreadMsgs: number;
  navPermissoes: Record<string, string[]> | null;
  username: string;
  userEmail: string;
}

export function useAppContext(): AppContext {
  const pathname = usePathname();
  const [role, setRole] = useState<string>("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [navPermissoes, setNavPermissoes] = useState<Record<string, string[]> | null>(null);
  const [username, setUsername] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    // Don't fire API calls on public pages — avoids 401→redirect→loop
    if (isPublicPath(pathname)) return;
    const token = localStorage.getItem("access_token");
    if (!token) return;

    wsClient.connect(token);

    api.get<{ valor: Record<string, string[]> }>("/configuracoes/nav_permissoes")
      .then(r => setNavPermissoes(r.valor))
      .catch(() => {});

    api.get<{ role_global: string; is_superadmin?: boolean; permissoes?: { estudo_id: number; role: string }[] }>("/auth/me")
      .then((me) => {
        // Derive effective nav role: role_global unless it's the generic "utilizador",
        // in which case we infer from the most-permissive study permission.
        const g = me.role_global ?? "";
        let effective = g;
        if (g === "utilizador" || g === "") {
          const roles = (me.permissoes ?? []).map(p => p.role);
          if (roles.includes("coordenador")) effective = "coordenador";
          else if (roles.includes("analista")) effective = "analista";
          else if (roles.includes("validador")) effective = "validador";
          else if (roles.includes("cliente")) effective = "cliente";
          else effective = "utilizador";
        }
        setRole(effective);
        localStorage.setItem("role", effective);
        setIsSuperAdmin(me.is_superadmin === true);
        setIsAdmin(g === "admin" && me.is_superadmin !== true);
        setUsername((me as any).username ?? "");
        setUserEmail((me as any).email ?? "");
      })
      .catch(() => {});

    // Poll unread messages every 60 seconds
    const fetchUnread = () =>
      api.get<{ count: number }>("/mensagens/nao-lidas")
        .then(r => setUnreadMsgs(r.count ?? 0))
        .catch(() => {});
    fetchUnread();
    const iv = setInterval(fetchUnread, 60_000);
    return () => clearInterval(iv);
  }, [pathname]); // re-run on navigation so a new login is reflected immediately

  // Real-time: increment unread badge when a new system message arrives
  useEffect(() => {
    const off = wsClient.on("mensagem_nova", () => setUnreadMsgs(n => n + 1));
    return off;
  }, []);

  return { role, isSuperAdmin, isAdmin, unreadMsgs, navPermissoes, username, userEmail };
}
