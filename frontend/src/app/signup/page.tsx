"use client";
/**
 * /signup — Public self-service tenant onboarding wizard.
 * Steps: Choose Plan → Company Info → Create Account → Done
 */
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface Plan {
  id: number;
  nome: string;
  codigo: string;
  descricao: string;
  preco_mensal: number;
  max_utilizadores: number | null;
  max_clientes: number | null;
  max_visitas_mes: number | null;
  trial_dias: number;
  features: Record<string, unknown>;
}

type Step = "plan" | "company" | "account" | "done";

const STEP_ORDER: Step[] = ["plan", "company", "account", "done"];

const COUNTRIES = [
  "Portugal", "Brasil", "Espanha", "França", "Alemanha", "Itália",
  "Reino Unido", "Estados Unidos", "Angola", "Moçambique", "Outro",
];

export default function SignupPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<Step>("plan");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [signupAllowed, setSignupAllowed] = useState<boolean | null>(null);

  // Form state
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [companyNome, setCompanyNome] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [country, setCountry] = useState("Portugal");
  const [ownerNome, setOwnerNome] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerTel, setOwnerTel] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [resultTenant, setResultTenant] = useState<{ slug: string; plano: string } | null>(null);

  useEffect(() => {
    fetch("/api/configuracoes/signup_enabled")
      .then(r => r.json())
      .then(d => setSignupAllowed(d.valor !== false))
      .catch(() => setSignupAllowed(true));
    fetch("/api/superadmin/planos/public")
      .then((r) => r.json())
      .then(setPlans)
      .catch(() => setPlans([]));
  }, []);

  // Auto-generate slug from company name
  useEffect(() => {
    if (slugManual) return;
    const generated = companyNome
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 40);
    setSlug(generated);
  }, [companyNome, slugManual]);

  const stepIdx = STEP_ORDER.indexOf(step);

  function next() {
    setError("");
    if (step === "plan" && !selectedPlan) { setError("Selecione um plano."); return; }
    if (step === "company") {
      if (!companyNome.trim()) { setError("Nome da empresa é obrigatório."); return; }
      if (!slug || slug.length < 3) { setError("Subdomínio inválido (mínimo 3 caracteres)."); return; }
    }
    if (step === "account") {
      if (!ownerNome.trim()) { setError("Nome é obrigatório."); return; }
      if (!ownerEmail.trim()) { setError("Email é obrigatório."); return; }
      if (password.length < 8) { setError("Password deve ter pelo menos 8 caracteres."); return; }
      if (password !== passwordConfirm) { setError("Passwords não coincidem."); return; }
      handleSubmit();
      return;
    }
    const nextIdx = stepIdx + 1;
    if (nextIdx < STEP_ORDER.length) setStep(STEP_ORDER[nextIdx]);
  }

  function back() {
    const prevIdx = stepIdx - 1;
    if (prevIdx >= 0) setStep(STEP_ORDER[prevIdx]);
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_nome: companyNome,
          slug,
          country,
          owner_nome: ownerNome,
          owner_email: ownerEmail,
          owner_telefone: ownerTel,
          password,
          plano_codigo: selectedPlan?.codigo ?? "starter",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Erro ao criar conta.");

      // Store token
      if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
      }
      setResultTenant({ slug: data.tenant.slug, plano: data.tenant.plano });
      setStep("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  const featureList = (plan: Plan) => {
    const f = plan.features ?? {};
    const items: string[] = [];
    items.push(`${plan.max_utilizadores ?? "∞"} utilizadores`);
    items.push(`${plan.max_clientes ?? "∞"} clientes`);
    items.push(`${plan.max_visitas_mes ?? "∞"} visitas/mês`);
    if (f.white_label) items.push("White-label completo");
    if (f.api_access) items.push("Acesso API");
    if (f.all_modules) items.push("Todos os módulos");
    if (f.priority_support) items.push("Suporte prioritário");
    return items;
  };

  if (signupAllowed === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center max-w-sm">
          <p className="text-white text-lg font-semibold mb-2">Registo desactivado</p>
          <p className="text-slate-400 text-sm mb-6">O registo público está desactivado. Contacte o administrador.</p>
          <Link href="/login" className="inline-block px-6 py-3 bg-[#2D6BEE] text-white rounded-xl font-medium text-sm hover:bg-[#1A52CC] transition">
            Voltar ao login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5">
        <Link href="/login" className="flex items-center gap-2">
          <span className="text-2xl font-bold text-white tracking-tight">Cognira</span>
          <span className="text-xs text-blue-300 font-medium border border-blue-500/40 rounded px-1.5 py-0.5">PRO</span>
        </Link>
        <Link href="/login" className="text-sm text-blue-300 hover:text-white transition-colors">
          Já tem conta? Entrar →
        </Link>
      </header>

      {/* Progress bar */}
      {step !== "done" && (
        <div className="flex items-center justify-center gap-2 mt-2 mb-6">
          {(["plan","company","account"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all duration-300
                ${stepIdx > i ? "bg-green-500 text-white" :
                  stepIdx === i ? "bg-blue-500 text-white ring-4 ring-blue-500/30" :
                  "bg-white/10 text-white/40"}`}>
                {stepIdx > i ? "✓" : i + 1}
              </div>
              <span className={`text-xs font-medium transition-colors ${stepIdx >= i ? "text-white" : "text-white/30"}`}>
                {s === "plan" ? "Plano" : s === "company" ? "Empresa" : "Conta"}
              </span>
              {i < 2 && <div className={`w-12 h-0.5 rounded ${stepIdx > i ? "bg-green-500" : "bg-white/10"}`} />}
            </div>
          ))}
        </div>
      )}

      {/* Card */}
      <main className="flex-1 flex items-start justify-center px-4 pb-16">
        {error && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-500/90 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium animate-in slide-in-from-top-2">
            <span>⚠</span> {error}
          </div>
        )}

        {step === "plan" && (
          <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h1 className="text-3xl font-bold text-white text-center mb-2">Escolha o seu plano</h1>
            <p className="text-blue-200 text-center mb-8">Todos os planos incluem {plans[0]?.trial_dias ?? 14} dias de trial grátis. Sem cartão de crédito.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {plans.map((plan) => {
                const isSelected = selectedPlan?.id === plan.id;
                const isPopular = plan.codigo === "professional";
                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={`relative text-left p-6 rounded-2xl border-2 transition-all duration-200 cursor-pointer
                      ${isSelected
                        ? "border-blue-500 bg-blue-500/20 ring-4 ring-blue-500/20"
                        : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
                      }`}
                  >
                    {isPopular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">
                        Mais Popular
                      </span>
                    )}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-white font-bold text-lg">{plan.nome}</p>
                        <p className="text-blue-200 text-xs mt-0.5">{plan.descricao}</p>
                      </div>
                      {isSelected && <span className="text-blue-400 text-xl">✓</span>}
                    </div>
                    <div className="mb-5">
                      <span className="text-3xl font-bold text-white">€{plan.preco_mensal}</span>
                      <span className="text-blue-300 text-sm">/mês</span>
                    </div>
                    <ul className="space-y-1.5">
                      {featureList(plan).map((f) => (
                        <li key={f} className="text-sm text-blue-100 flex items-center gap-1.5">
                          <span className="text-green-400 text-xs">✓</span> {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end mt-8">
              <button onClick={next} disabled={!selectedPlan}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 disabled:text-white/30 text-white font-semibold rounded-xl transition-colors">
                Continuar →
              </button>
            </div>
          </div>
        )}

        {step === "company" && (
          <div className="w-full max-w-lg bg-white/5 border border-white/10 rounded-2xl p-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <h1 className="text-2xl font-bold text-white mb-1">Dados da empresa</h1>
            <p className="text-blue-200 text-sm mb-6">Configure o seu espaço de trabalho.</p>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-blue-200 mb-1 block">Nome da Empresa *</label>
                <input value={companyNome} onChange={(e) => setCompanyNome(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-blue-400"
                  placeholder="Acme Mystery Shopping, Lda" autoFocus />
              </div>
              <div>
                <label className="text-sm text-blue-200 mb-1 block">Subdomínio *</label>
                <div className="flex items-center gap-0">
                  <input
                    value={slug}
                    onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 50)); setSlugManual(true); }}
                    className="flex-1 bg-white/10 border border-white/20 rounded-l-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-blue-400"
                    placeholder="acme"
                  />
                  <span className="bg-white/5 border border-l-0 border-white/20 rounded-r-lg px-3 py-2.5 text-blue-300 text-sm whitespace-nowrap">
                    .marketview.io
                  </span>
                </div>
                <p className="text-blue-300/60 text-xs mt-1">URL do seu portal: <span className="text-blue-300">{slug || "…"}.marketview.io</span></p>
              </div>
              <div>
                <label className="text-sm text-blue-200 mb-1 block">País</label>
                <select value={country} onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-400 appearance-none">
                  {COUNTRIES.map((c) => <option key={c} value={c} className="bg-slate-800">{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-between mt-8">
              <button onClick={back} className="px-5 py-2.5 text-blue-200 hover:text-white transition-colors">← Voltar</button>
              <button onClick={next} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors">
                Continuar →
              </button>
            </div>
          </div>
        )}

        {step === "account" && (
          <div className="w-full max-w-lg bg-white/5 border border-white/10 rounded-2xl p-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <h1 className="text-2xl font-bold text-white mb-1">Criar conta de administrador</h1>
            <p className="text-blue-200 text-sm mb-6">Será o administrador principal do seu workspace.</p>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-blue-200 mb-1 block">Nome completo *</label>
                <input value={ownerNome} onChange={(e) => setOwnerNome(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-blue-400"
                  placeholder="Ana Silva" autoFocus />
              </div>
              <div>
                <label className="text-sm text-blue-200 mb-1 block">Email *</label>
                <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-blue-400"
                  placeholder="ana@acmemystery.pt" />
              </div>
              <div>
                <label className="text-sm text-blue-200 mb-1 block">Telefone</label>
                <input type="tel" value={ownerTel} onChange={(e) => setOwnerTel(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-blue-400"
                  placeholder="+351 912 345 678" />
              </div>
              <div>
                <label className="text-sm text-blue-200 mb-1 block">Password *</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-blue-400"
                  placeholder={t("common.passwordMinLength")} />
                {password && (
                  <div className="mt-1 flex gap-1">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                        password.length > i * 3 + 4 ? (password.length >= 12 ? "bg-green-400" : "bg-amber-400") : "bg-white/20"
                      }`} />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm text-blue-200 mb-1 block">Confirmar password *</label>
                <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
                  className={`w-full bg-white/10 border rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none
                    ${passwordConfirm && password !== passwordConfirm ? "border-red-400" : "border-white/20 focus:border-blue-400"}`}
                  placeholder="Repita a password" />
              </div>
            </div>

            {/* Summary */}
            <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10 text-sm space-y-1">
              <p className="text-white/60">Resumo da sua conta:</p>
              <p className="text-white"><span className="text-white/50">Plano:</span> {selectedPlan?.nome} — €{selectedPlan?.preco_mensal}/mês</p>
              <p className="text-white"><span className="text-white/50">Portal:</span> {slug}.marketview.io</p>
              <p className="text-white/70 text-xs mt-1">✓ {selectedPlan?.trial_dias ?? 14} dias de trial grátis • Sem compromisso</p>
            </div>

            <div className="flex justify-between mt-6">
              <button onClick={back} className="px-5 py-2.5 text-blue-200 hover:text-white transition-colors">← Voltar</button>
              <button onClick={next} disabled={loading}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold rounded-xl transition-colors flex items-center gap-2">
                {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {loading ? "A criar…" : "Criar Conta Grátis"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && resultTenant && (
          <div className="w-full max-w-lg text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="text-7xl mb-6">🎉</div>
            <h1 className="text-3xl font-bold text-white mb-3">Conta criada com sucesso!</h1>
            <p className="text-blue-200 mb-8">
              O seu workspace <strong className="text-white">{resultTenant.slug}.marketview.io</strong> está pronto.
              Tem <strong className="text-white">{selectedPlan?.trial_dias ?? 14} dias</strong> de trial grátis no plano <strong className="text-white">{resultTenant.plano}</strong>.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-lg">
                Ir para o Dashboard →
              </button>
              <p className="text-white/40 text-sm">
                URL do portal:{" "}
                <a href={`https://${resultTenant.slug}.marketview.io`} target="_blank" rel="noreferrer"
                  className="text-blue-300 hover:underline">
                  {resultTenant.slug}.marketview.io
                </a>
              </p>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center text-white/20 text-xs pb-6">
        © {new Date().getFullYear()} Cognira. Ao registar-se, aceita os nossos{" "}
        <a href="#" className="hover:text-white/40 underline">Termos de Serviço</a> e{" "}
        <a href="#" className="hover:text-white/40 underline">Política de Privacidade</a>.
      </footer>
    </div>
  );
}
