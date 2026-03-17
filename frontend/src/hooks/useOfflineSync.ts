"use client";

import { useState, useEffect, useCallback } from "react";

/** Online/offline status + pending upload count from SW */
export function useOfflineSync() {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => {
      setOnline(true);
      // Trigger background sync when back online
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          if ("sync" in reg) {
            (reg as any).sync.register("sync-uploads");
          } else {
            navigator.serviceWorker.controller?.postMessage({ type: "MANUAL_SYNC" });
          }
        });
      }
    };
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // Listen for SW messages about pending count
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "PENDING_COUNT") {
        setPendingCount(event.data.count);
      }
      if (event.data?.type === "SYNC_COMPLETE") {
        setPendingCount(event.data.remaining);
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);

    // Ask for current pending count
    navigator.serviceWorker?.controller?.postMessage({ type: "GET_PENDING_COUNT" });

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      navigator.serviceWorker?.removeEventListener("message", handler);
    };
  }, []);

  const manualSync = useCallback(() => {
    navigator.serviceWorker?.controller?.postMessage({ type: "MANUAL_SYNC" });
  }, []);

  return { online, pendingCount, manualSync };
}

/** Capture current geolocation as a promise */
export function useGeolocation() {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback((): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        const err = "Geolocalização não suportada";
        setError(err);
        reject(new Error(err));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPosition(loc);
          setError(null);
          resolve(loc);
        },
        (err) => {
          setError(err.message);
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    });
  }, []);

  return { position, error, capture };
}
