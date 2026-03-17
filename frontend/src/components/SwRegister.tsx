"use client";
import { useEffect } from "react";

function urlBase64ToUint8Array(b64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

async function trySubscribePush(): Promise<void> {
  if (!("Notification" in window) || !("PushManager" in window)) return;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return;
  try {
    const token = localStorage.getItem("access_token");
    const res = await fetch("/api/push/public-key", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return; // push not configured — silently skip
    const { public_key } = await res.json();
    if (!public_key) return;
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key),
    });
    const json = sub.toJSON();
    if (!json.keys) return;
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      }),
    });
  } catch { /* push is optional */ }
}

export default function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => trySubscribePush())
      .catch(() => { /* non-fatal */ });
  }, []);
  return null;
}
