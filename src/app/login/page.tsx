"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setTokens = useAuthStore((s) => s.setTokens);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "session-expired") {
      setError("Sua sessão expirou. Faça login novamente.");
      router.replace("/login");
      return;
    }
    if (reason === "unauthorized") {
      setError("Faça login para continuar.");
      router.replace("/login");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = isRegister
        ? await authApi.register(email, password)
        : await authApi.login(email, password);
      setTokens(data.accessToken, data.refreshToken);
      router.replace("/home");
    } catch {
      setError(isRegister ? "Falha ao criar conta." : "Credenciais inválidas.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-page min-h-screen px-4 pt-10 pb-8 flex flex-col items-center">
      <div className="w-full max-w-md text-center mb-6">
        <div
          className="rounded-3xl px-6 py-8 shadow-lg border"
          style={{
            background:
              "linear-gradient(145deg, var(--color-primary) 0%, var(--color-primary-dark) 62%, #2f4778 100%)",
            borderColor: "rgba(255,255,255,0.2)",
          }}
        >
          <p className="text-white/70 text-xs tracking-[0.18em] uppercase">JW Style</p>
          <h1 className="text-4xl font-bold text-white tracking-wide mt-2">Pregadores</h1>
          <p className="text-white/80 mt-2 text-sm">Gerenciamento de Revisitas</p>
        </div>
      </div>

      <div className="card w-full max-w-md border border-[var(--color-border)]">
        {/* Tabs */}
        <div className="flex mb-6 border-b border-[var(--color-border)]">
          <button
            type="button"
            className={`flex-1 pb-2 text-center font-semibold transition-colors ${
              !isRegister
                ? "border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]"
                : "text-[var(--color-text-light)]"
            }`}
            onClick={() => setIsRegister(false)}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`flex-1 pb-2 text-center font-semibold transition-colors ${
              isRegister
                ? "border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]"
                : "text-[var(--color-text-light)]"
            }`}
            onClick={() => setIsRegister(true)}
          >
            Criar Conta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="input-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input-field"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="input-label">
              Senha
            </label>
            <input
              id="password"
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </div>

          {error && (
            <p className="text-sm text-[var(--color-danger)] text-center">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Carregando..." : isRegister ? "Criar Conta" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
