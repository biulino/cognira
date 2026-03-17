"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useBranding } from "@/lib/branding";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { app_name, tagline, logo_url } = useBranding();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needs2FA, setNeeds2FA] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [ssoConfig, setSsoConfig] = useState<{ enabled: boolean; provider_name: string } | null>(null);
  const [signupEnabled, setSignupEnabled] = useState(false);

  useEffect(() => {
    api.get<{ enabled: boolean; provider_name: string }>("/auth/sso/config")
      .then(setSsoConfig)
      .catch(() => setSsoConfig({ enabled: false, provider_name: "SSO" }));
    api.get<{ valor: boolean }>("/configuracoes/public/signup_enabled")
      .then(r => setSignupEnabled(r.valor !== false))
      .catch(() => setSignupEnabled(false));
  }, []);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post<{ access_token: string; refresh_token: string; requires_2fa: boolean }>("/auth/login", { username, password });
      if (res.requires_2fa) {
        setNeeds2FA(true);
      } else {
        localStorage.setItem("access_token", res.access_token);
        localStorage.setItem("refresh_token", res.refresh_token);
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || t("auth.wrongCreds"));
    } finally {
      setLoading(false);
    }
  }

  async function handle2FA(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post<{ access_token: string; refresh_token: string }>("/auth/2fa/verify", {
        username,
        code: totpCode,
      });
      localStorage.setItem("access_token", res.access_token);
      localStorage.setItem("refresh_token", res.refresh_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || t("auth.invalid2fa"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo_url ?? "/logo.png"} alt={app_name} className="h-14 w-auto mb-5 mx-auto" />
          <h1 className="text-2xl font-bold text-[#111111] tracking-tight">{app_name}</h1>
          <p className="text-[#888888] text-sm mt-1">{tagline}</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
          {!needs2FA ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#333333] mb-1.5">
                  {t("auth.username")}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#F9F9F9] border border-[#E8E8E8] text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-[#2D6BEE] focus:border-[#2D6BEE] transition text-sm"
                  placeholder="username"
                  required
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#333333] mb-1.5">
                  {t("auth.password")}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-11 rounded-xl bg-[#F9F9F9] border border-[#E8E8E8] text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-[#2D6BEE] focus:border-[#2D6BEE] transition text-sm"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AAAAAA] hover:text-[#555555] transition"
                    tabIndex={-1}
                    aria-label={showPassword ? t("common.close") : t("auth.password")}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  <span>⚠</span> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#2D6BEE] hover:bg-[#1A52CC] active:bg-[#AA1500] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm shadow-[0_3px_14px_rgba(255,51,0,0.25)] active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    {t("auth.loginLoading")}
                  </span>
                ) : t("auth.loginBtn")}
              </button>

              {ssoConfig?.enabled && (
                <>
                  <div className="flex items-center gap-3 my-1">
                    <div className="flex-1 h-px bg-[#E8E8E8]" />
                    <span className="text-xs text-[#AAAAAA]">{t("auth.or")}</span>
                    <div className="flex-1 h-px bg-[#E8E8E8]" />
                  </div>
                  <a
                    href="/api/auth/sso/login"
                    className="w-full flex items-center justify-center gap-2 py-3 border border-[#E8E8E8] bg-white hover:bg-[#F9F9F9] text-[#333333] font-medium rounded-xl transition text-sm"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    {t("auth.ssoLogin", { provider: ssoConfig.provider_name })}
                  </a>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={handle2FA} className="space-y-5">
              <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F0F5FF] border border-[#FFD5CC] mb-3">
                  <ShieldCheck className="w-6 h-6 text-[#2D6BEE]" />
                </div>
                <p className="text-[#111111] font-medium">{t("auth.twoFaTitle")}</p>
                <p className="text-[#888888] text-sm mt-1">{t("auth.twoFaSubtitle")}</p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                className="w-full px-4 py-4 rounded-xl bg-[#F9F9F9] border border-[#E8E8E8] text-[#111111] text-center text-3xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[#2D6BEE] focus:border-[#2D6BEE] transition"
                required
                autoFocus
                autoComplete="one-time-code"
                placeholder="000000"
              />
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  <span>⚠</span> {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#2D6BEE] hover:bg-[#1A52CC] disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-sm shadow-[0_3px_14px_rgba(255,51,0,0.25)]"
              >
                {loading ? t("auth.verifying") : t("auth.verify")}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-[#AAAAAA] mt-6">Cognira © 2026 · CX Intelligence Platform</p>
        {signupEnabled && (
          <p className="text-center text-xs text-[#BBBBBB] mt-2">
            {t("auth.noAccount")}{" "}
            <a href="/signup" className="text-[#2D6BEE] hover:underline font-medium">
              {t("auth.createAccount")} →
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
