"use client";
/**
 * /perfil — User profile page.
 * Accessible to any authenticated user.
 * Features: read-only account info, change password, language preference, 2FA status.
 */
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, User, Lock, Globe, ShieldCheck, ShieldOff,
  CheckCircle2, AlertTriangle, Eye, EyeOff, Save,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n, LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";

interface Me {
  id: string;
  username: string;
  email: string;
  role_global: string;
  totp_activo: boolean;
  is_superadmin?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  superadmin:  "Super Admin",
  admin:       "Admin",
  coordenador: "Coordenador",
  analista:    "Analista",
  validador:   "Validador",
  cliente:     "Cliente",
  utilizador:  "Utilizador",
};

const ROLE_COLORS: Record<string, string> = {
  superadmin:  "bg-violet-100 text-violet-700 border-violet-200",
  admin:       "bg-blue-100 text-blue-700 border-blue-200",
  coordenador: "bg-orange-100 text-orange-700 border-orange-200",
  analista:    "bg-green-100 text-green-700 border-green-200",
  validador:   "bg-amber-100 text-amber-700 border-amber-200",
  cliente:     "bg-slate-100 text-slate-600 border-slate-200",
  utilizador:  "bg-slate-100 text-slate-600 border-slate-200",
};

function getInitials(username: string): string {
  const parts = username.split(/[_\s.@]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

function avatarBg(username: string): string {
  const palette = [
    "bg-orange-500", "bg-blue-500", "bg-green-500", "bg-purple-500",
    "bg-pink-500", "bg-teal-500", "bg-amber-500", "bg-indigo-500",
  ];
  let h = 0;
  for (const c of username) h = (h * 31 + c.charCodeAt(0)) % palette.length;
  return palette[h];
}

export default function PerfilPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  // Password change form
  const [pwAtual, setPwAtual] = useState("");
  const [pwNova, setPwNova] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [showAtual, setShowAtual] = useState(false);
  const [showNova, setShowNova] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwError, setPwError] = useState("");

  useEffect(() => {
    api.get<Me>("/auth/me")
      .then(data => { setMe(data); setLoading(false); })
      .catch(() => router.replace("/login"));
  }, [router]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSuccess("");
    setPwError("");
    if (pwNova !== pwConfirm) { setPwError(t("perfil.passwordMismatch")); return; }
    if (pwNova.length < 8) { setPwError(t("perfil.passwordTooShort")); return; }
    setPwLoading(true);
    try {
      await api.post("/auth/change-password", { password_atual: pwAtual, password_nova: pwNova });
      setPwSuccess(t("perfil.passwordSuccess"));
      setPwAtual(""); setPwNova(""); setPwConfirm("");
    } catch (err: unknown) {
      const msg = (err as { detail?: string })?.detail;
      setPwError(msg ?? t("perfil.passwordError"));
    } finally {
      setPwLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#2D6BEE] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const role = me?.is_superadmin ? "superadmin" : (me?.role_global ?? "utilizador");
  const initials = me ? getInitials(me.username) : "?";
  const bg = me ? avatarBg(me.username) : "bg-slate-400";
  const pwMatch = pwNova && pwConfirm && pwNova === pwConfirm;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            <h1 className="text-sm font-bold text-slate-900">{t("perfil.title")}</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* Account info card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center text-white text-xl font-bold flex-shrink-0`}>
              {initials}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{me?.username}</h2>
              <p className="text-sm text-slate-500">{me?.email}</p>
              <div className="mt-1">
                <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${ROLE_COLORS[role] ?? ROLE_COLORS.utilizador}`}>
                  {ROLE_LABELS[role] ?? role}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Username</p>
              <p className="text-sm font-medium text-slate-700 font-mono">{me?.username}</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Email</p>
              <p className="text-sm font-medium text-slate-700 truncate">{me?.email}</p>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Lock className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">{t("perfil.changePassword")}</h3>
          </div>

          {pwSuccess && (
            <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              {pwSuccess}
            </div>
          )}
          {pwError && (
            <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {pwError}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* Current password */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t("perfil.currentPassword")}</label>
              <div className="relative">
                <input
                  type={showAtual ? "text" : "password"}
                  value={pwAtual}
                  onChange={e => setPwAtual(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full pr-10 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30 focus:border-[#2D6BEE] transition"
                  placeholder="Introduza a password actual"
                />
                <button
                  type="button"
                  onClick={() => setShowAtual(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showAtual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t("perfil.newPassword")}</label>
              <div className="relative">
                <input
                  type={showNova ? "text" : "password"}
                  value={pwNova}
                  onChange={e => setPwNova(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  className="w-full pr-10 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2D6BEE]/30 focus:border-[#2D6BEE] transition"
                  placeholder={t("common.passwordMinLength")}
                />
                <button
                  type="button"
                  onClick={() => setShowNova(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showNova ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwNova && pwNova.length < 8 && (
                  <p className="text-xs text-amber-600 mt-1">{t("perfil.passwordTooShort")}</p>
              )}
            </div>

            {/* Confirm new password */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t("perfil.confirmPassword")}</label>
              <div className="relative">
                <input
                  type="password"
                  value={pwConfirm}
                  onChange={e => setPwConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 transition ${
                    pwConfirm && !pwMatch
                      ? "border-red-300 focus:ring-red-200 focus:border-red-400"
                      : pwMatch
                      ? "border-green-300 focus:ring-green-200 focus:border-green-400"
                      : "border-slate-200 focus:ring-[#2D6BEE]/30 focus:border-[#2D6BEE]"
                  }`}
                  placeholder={t("common.repeatPassword")}
                />
                {pwMatch && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                )}
              </div>
              {pwConfirm && !pwMatch && (
                <p className="text-xs text-red-500 mt-1">{t("perfil.passwordMismatch")}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={pwLoading || !pwAtual || !pwNova || !pwConfirm || !pwMatch}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#2D6BEE] text-white text-sm font-semibold rounded-xl hover:bg-[#1A52CC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {pwLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {pwLoading ? t("perfil.savingPassword") : t("perfil.savePassword")}
            </button>
          </form>
        </div>

        {/* Language preference */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">{t("usermenu.language")}</h3>
          </div>
          <div className="flex gap-2 flex-wrap">
            {LOCALES.map(l => (
              <button
                key={l}
                onClick={() => setLocale(l as Locale)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  l === locale
                    ? "bg-[#2D6BEE] text-white border-[#2D6BEE] shadow-sm shadow-orange-200"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100"
                }`}
              >
                {LOCALE_LABELS[l]}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            {t("perfil.languageDesc")}
          </p>
        </div>

        {/* 2FA status */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            {me?.totp_activo
              ? <ShieldCheck className="w-4 h-4 text-green-500" />
              : <ShieldOff className="w-4 h-4 text-slate-400" />
            }
            <h3 className="text-sm font-bold text-slate-800">{t("perfil.twoFa")}</h3>
          </div>
          {me?.totp_activo ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">{t("perfil.twoFaActive")}</p>
                <p className="text-xs text-green-600 mt-0.5">{t("perfil.twoFaActiveDesc")}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">{t("perfil.twoFaInactive")}</p>
                <p className="text-xs text-amber-600 mt-0.5">{t("perfil.twoFaInactiveDesc")}</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
