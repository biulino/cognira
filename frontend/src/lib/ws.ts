/**
 * Singleton WebSocket client with auto-reconnect and typed event emitter.
 *
 * Usage:
 *   import wsClient from "@/lib/ws";
 *   const off = wsClient.on("chat_msg", (data) => { ... });
 *   // cleanup:
 *   off();
 */

type Listener = (data: Record<string, unknown>) => void;

class WSClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1_000;
  private maxDelay = 30_000;
  private shouldConnect = false;

  /** Call once after the user has a valid JWT. */
  connect(token: string): void {
    this.shouldConnect = true;
    this._open(token);
  }

  /** Call on logout to permanently close. */
  disconnect(): void {
    this.shouldConnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  /** Subscribe to a named evento. Returns an unsubscribe function. */
  on(evento: string, cb: Listener): () => void {
    if (!this.listeners.has(evento)) {
      this.listeners.set(evento, new Set());
    }
    this.listeners.get(evento)!.add(cb);
    return () => this.listeners.get(evento)?.delete(cb);
  }

  private _open(token: string): void {
    if (this.ws && this.ws.readyState < WebSocket.CLOSING) return;

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/api/ws?token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this._scheduleReconnect(token);
      return;
    }

    this.ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as Record<string, unknown>;
        const evento = data.evento as string | undefined;
        if (evento) {
          this.listeners.get(evento)?.forEach((cb) => cb(data));
          // wildcard listeners
          this.listeners.get("*")?.forEach((cb) => cb(data));
        }
      } catch {
        // ignore malformed frames
      }
    };

    this.ws.onopen = () => {
      this.reconnectDelay = 1_000; // reset backoff on successful connection
    };

    this.ws.onclose = () => {
      if (this.shouldConnect) this._scheduleReconnect(token);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private _scheduleReconnect(token: string): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay);
      this._open(token);
    }, this.reconnectDelay);
  }
}

const wsClient = new WSClient();
export default wsClient;
