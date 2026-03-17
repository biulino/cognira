/**
 * Client-side module catalog and hook.
 *
 * Module keys match backend CATALOGO_PLANOS in app/models/modulo.py.
 */
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface ModuloCatalogItem {
  key: string;
  label: string;
}

export interface PlanoCatalog {
  id: string;
  label: string;
  descricao: string;
  cor: string;
  modulos: ModuloCatalogItem[];
}

/** Maps a nav item key (in AppShell) to its required module key. */
export const NAV_REQUIRES_MODULE: Partial<Record<string, string>> = {
  estudos:       "estudos",
  visitas:       "visitas",
  analistas:     "analistas",
  pagamentos:    "pagamentos",
  relatorios:    "relatorios",
  mapa:          "mapa",
  callcenter:    "callcenter",
  "shelf-audit": "shelf_audit",
  barcode:       "barcode",
  questionarios: "questionarios",
  chat:          "chat_ia",
  alertas:       "alertas",
  sla:           "sla",
  benchmarking:  "benchmarking",
  fraude:        "fraude",
  pesquisa:      "rag",
  formacoes:     "formacoes",
  mensagens:       "mensagens",
  "chat-interno":  "chat_interno",
};

interface ModulosResponse {
  modulos: string[];
  all: boolean;
}

/**
 * Fetch and cache the current user's active module keys.
 * Returns null while loading (show everything until resolved).
 */
export function useModulos(): Set<string> | null {
  const [modulos, setModulos] = useState<Set<string> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    api
      .get<ModulosResponse>("/clientes/me/modulos")
      .then((res) => {
        if (res.all) {
          setModulos(null); // null means "all active"
        } else {
          setModulos(new Set(res.modulos));
        }
      })
      .catch(() => setModulos(null)); // on error: show everything
  }, []);

  return modulos;
}

/** Check if a nav item key is accessible given the active module set. */
export function isModuloActivo(
  navKey: string,
  activeModulos: Set<string> | null
): boolean {
  if (activeModulos === null) return true; // all enabled (admin / not configured)
  const required = NAV_REQUIRES_MODULE[navKey];
  if (!required) return true; // no module gate on this item
  return activeModulos.has(required);
}
