// ─── Cache versioning ────────────────────────────────────────────────────────
// Bump this on every deploy to force all devices to discard stale caches.
const CACHE_VERSION = "v6";
const STATIC_CACHE  = `estudos-static-${CACHE_VERSION}`;
const API_CACHE     = `estudos-api-${CACHE_VERSION}`;
const ALL_CACHES    = [STATIC_CACHE, API_CACHE];
const OFFLINE_DB    = "q21-offline";
const OFFLINE_STORE = "pending-uploads";
const DRAFT_STORE   = "visits-drafts";

// Pages to pre-cache on install so the app shell works offline immediately
const PRECACHE_URLS = ["/", "/login", "/dashboard", "/offline", "/offline.html"];

// ─── Install: pre-cache app shell ────────────────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting(); // activate immediately without waiting for old tabs to close
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {
        // Some offline pages may not exist yet; ignore failures
      })
    )
  );
});

// ─── Activate: clean up stale caches ─────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !ALL_CACHES.includes(k))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim()) // take control of all open tabs
  );
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    /\.(ico|png|jpg|jpeg|svg|webp|woff2?|css)$/.test(url.pathname)
  );
}

function isApiCall(url) {
  return url.pathname.startsWith("/api/");
}

function isNavigationRequest(request) {
  return request.mode === "navigate";
}

async function fromCacheThenNetwork(request, cacheName) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(cacheName).then((c) => c.put(request, clone));
      }
      return response;
    })
    .catch(() => null);

  // Return cached immediately; update in background (stale-while-revalidate)
  if (cached) {
    fetchPromise; // fire-and-forget background update
    return cached;
  }
  // No cache: wait for network
  const network = await fetchPromise;
  return network || new Response("Offline", { status: 503, statusText: "Offline" });
}

async function networkThenCache(request, cacheName, fallbackToOfflinePage) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(cacheName).then((c) => c.put(request, clone));
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackToOfflinePage) {
      // Serve app shell so the user sees something meaningful
      const shell = await caches.match("/offline.html") || await caches.match("/");
      if (shell) return shell;
    }
    return new Response(JSON.stringify({ detail: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ─── Fetch strategy ───────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // 1. Static assets (JS/CSS/fonts/images): cache-first, update in background
  if (isStaticAsset(url)) {
    event.respondWith(fromCacheThenNetwork(event.request, STATIC_CACHE));
    return;
  }

  // 2. API calls: network-first, fall back to cached response (stale data)
  if (isApiCall(url)) {
    event.respondWith(networkThenCache(event.request, API_CACHE, false));
    return;
  }

  // 3. Navigation (page loads): network-first, fall back to app shell
  if (isNavigationRequest(event.request)) {
    event.respondWith(networkThenCache(event.request, STATIC_CACHE, true));
    return;
  }

  // 4. Everything else: try cache, then network
  event.respondWith(
    caches.match(event.request).then((c) => c || fetch(event.request).catch(() =>
      new Response("", { status: 503 })
    ))
  );
});

// ─── Push notifications ───────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const { title = "Cognira", body = "", url = "/" } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});

// ─── IndexedDB helpers for offline queue ──────────────────────────────────────
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB, 2);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
        db.createObjectStore(OFFLINE_STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        db.createObjectStore(DRAFT_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueOfflineUpload(url, body, headers, meta) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, "readwrite");
    tx.objectStore(OFFLINE_STORE).add({
      url,
      body: Array.from(new Uint8Array(body)),
      headers,
      meta,
      timestamp: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getPendingUploads() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, "readonly");
    const req = tx.objectStore(OFFLINE_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function removePendingUpload(id) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, "readwrite");
    tx.objectStore(OFFLINE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Intercept POST/PUT when offline → queue them ─────────────────────────────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "POST" && event.request.method !== "PUT") return;
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith("/api/")) return;

  // Only queue upload endpoints (fotos, visitas state changes)
  const queuable = /\/(fotos|visitas)/.test(url.pathname);
  if (!queuable) return;

  event.respondWith(
    event.request.clone().arrayBuffer().then(async (body) => {
      try {
        const response = await fetch(event.request);
        return response;
      } catch {
        // Offline — queue for later
        const headers = {};
        for (const [k, v] of event.request.headers.entries()) {
          if (k !== "content-length") headers[k] = v;
        }
        await queueOfflineUpload(
          event.request.url,
          body,
          headers,
          { method: event.request.method, pathname: url.pathname }
        );
        // Return a synthetic success so the UI doesn't break
        return new Response(
          JSON.stringify({ queued: true, detail: "Guardado offline — será enviado quando houver rede" }),
          { status: 202, headers: { "Content-Type": "application/json" } }
        );
      }
    })
  );
});

// ─── Background Sync: replay queued uploads ───────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-uploads") {
    event.waitUntil(replayPendingUploads());
  }
});

async function replayPendingUploads() {
  const pending = await getPendingUploads();
  for (const item of pending) {
    try {
      const body = new Uint8Array(item.body).buffer;
      const response = await fetch(item.url, {
        method: item.meta.method,
        headers: item.headers,
        body,
      });
      if (response.ok || response.status < 500) {
        await removePendingUpload(item.id);
      }
    } catch {
      // Still offline — leave in queue for next sync
      break;
    }
  }
  // Notify all clients about sync completion
  const allClients = await clients.matchAll({ type: "window" });
  for (const client of allClients) {
    client.postMessage({ type: "SYNC_COMPLETE", remaining: (await getPendingUploads()).length });
  }
}

// ─── Draft store helpers ──────────────────────────────────────────────────────
async function saveDraftSW(draft) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE, "readwrite");
    tx.objectStore(DRAFT_STORE).put({ ...draft, savedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getDraftsSW() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE, "readonly");
    const req = tx.objectStore(DRAFT_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteDraftSW(id) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE, "readwrite");
    tx.objectStore(DRAFT_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Periodic sync (fallback if Background Sync API not available) ────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "MANUAL_SYNC") {
    replayPendingUploads();
  }
  if (event.data?.type === "GET_PENDING_COUNT") {
    getPendingUploads().then((items) => {
      event.source.postMessage({ type: "PENDING_COUNT", count: items.length });
    });
  }
  if (event.data?.type === "SAVE_DRAFT") {
    saveDraftSW(event.data.draft).then(() => {
      event.source?.postMessage({ type: "DRAFT_SAVED", id: event.data.draft.id });
    }).catch(() => {});
  }
  if (event.data?.type === "GET_DRAFTS") {
    getDraftsSW().then((drafts) => {
      event.source?.postMessage({ type: "DRAFTS_LIST", drafts });
    }).catch(() => {});
  }
  if (event.data?.type === "DELETE_DRAFT") {
    deleteDraftSW(event.data.id).then(() => {
      event.source?.postMessage({ type: "DRAFT_DELETED", id: event.data.id });
    }).catch(() => {});
  }
});
