const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

import { globalToast } from "./globalToast";

// Errors that should NOT automatically fire a toast (caller handles them)
const SILENT_PATHS = ["/auth/login", "/auth/refresh", "/auth/2fa"];

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      // For auth endpoints, just throw so the form can show the error
      const isAuthEndpoint = path.startsWith("/auth/");
      if (isAuthEndpoint) {
        const body = await res.json().catch(() => ({ detail: "Credenciais inválidas" }));
        throw new Error(body.detail || "Credenciais inválidas");
      }
      // Try refresh
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${localStorage.getItem("access_token")}`;
        const retry = await fetch(`${this.baseUrl}${path}`, {
          ...options,
          headers,
        });
        if (!retry.ok) {
          throw new Error(await retry.text());
        }
        return retry.json();
      }
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
      throw new Error("Sessão expirada");
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      const msg = body.detail || res.statusText;
      const isAuthPath = SILENT_PATHS.some((p) => path.startsWith(p));
      if (!isAuthPath && typeof window !== "undefined") globalToast.error("Erro", msg);
      throw new Error(msg);
    }

    if (res.status === 204 || res.headers.get("content-length") === "0") {
      return undefined as unknown as T;
    }

    return res.json();
  }

  private async tryRefresh(): Promise<boolean> {
    const refreshToken = typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      return true;
    } catch {
      return false;
    }
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }

  async upload<T>(path: string, formData: FormData): Promise<T> {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      const msg = body.detail || res.statusText;
      if (typeof window !== "undefined") globalToast.error("Erro no upload", msg);
      throw new Error(msg);
    }

    return res.json();
  }
}

export const api = new ApiClient(API_BASE);
