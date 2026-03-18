"use client";

import { useCallback, useEffect, useState } from "react";

const DB_NAME = "cognira-offline";
const DB_VERSION = 2; // bump when adding new stores
const DRAFT_STORE = "visits-drafts";

export interface VisitaDraft {
  id: string;       // nanoid / uuid used as key
  label: string;    // human-readable: estudo name + date
  data: Record<string, unknown>;
  savedAt: string;  // ISO timestamp
  syncedAt?: string;
}

// ── IndexedDB helpers ────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      // Existing store from v1 (pending-uploads) — preserved
      if (!db.objectStoreNames.contains("pending-uploads")) {
        db.createObjectStore("pending-uploads", { autoIncrement: true });
      }
      // New store for offline drafts
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        db.createObjectStore(DRAFT_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(storeName: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Save (create or update) a visita draft in IndexedDB */
export async function saveDraft(draft: VisitaDraft): Promise<void> {
  await idbPut(DRAFT_STORE, { ...draft, savedAt: new Date().toISOString() });
}

/** Load a single draft by ID */
export async function getDraft(id: string): Promise<VisitaDraft | undefined> {
  return idbGet<VisitaDraft>(DRAFT_STORE, id);
}

/** Delete a draft after successful sync */
export async function deleteDraft(id: string): Promise<void> {
  return idbDelete(DRAFT_STORE, id);
}

/** List all drafts, sorted newest first */
export async function listDrafts(): Promise<VisitaDraft[]> {
  const all = await idbGetAll<VisitaDraft>(DRAFT_STORE);
  return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

// ── React hook ───────────────────────────────────────────────────────────────

interface UseOfflineDraftReturn {
  drafts: VisitaDraft[];
  saveDraftFn: (id: string, label: string, data: Record<string, unknown>) => Promise<void>;
  removeDraft: (id: string) => Promise<void>;
  loadDraft: (id: string) => Promise<VisitaDraft | undefined>;
  refreshDrafts: () => Promise<void>;
}

export function useOfflineDraft(): UseOfflineDraftReturn {
  const [drafts, setDrafts] = useState<VisitaDraft[]>([]);

  const refreshDrafts = useCallback(async () => {
    try {
      const all = await listDrafts();
      setDrafts(all);
    } catch {
      // IndexedDB unavailable (SSR / private browsing)
    }
  }, []);

  useEffect(() => {
    refreshDrafts();
  }, [refreshDrafts]);

  const saveDraftFn = useCallback(
    async (id: string, label: string, data: Record<string, unknown>) => {
      await saveDraft({ id, label, data, savedAt: new Date().toISOString() });
      await refreshDrafts();
    },
    [refreshDrafts]
  );

  const removeDraft = useCallback(
    async (id: string) => {
      await deleteDraft(id);
      await refreshDrafts();
    },
    [refreshDrafts]
  );

  const loadDraft = useCallback(async (id: string) => {
    return getDraft(id);
  }, []);

  return { drafts, saveDraftFn, removeDraft, loadDraft, refreshDrafts };
}
