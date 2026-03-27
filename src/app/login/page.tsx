"use client";

import { useState } from "react";
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Hero */}
      <div
        className="w-full text-center py-10 mb-8 rounded-b-3xl"
        style={{ background: "var(--color-primary)" }}
      >
        <h1 className="text-4xl font-bold text-white tracking-wide">
          Pregadores
        </h1>
        <p className="text-white/80 mt-2">Gerenciamento de Revisitas</p>
      </div>

      {/* Card */}
      <div className="card w-full max-w-md">
        {/* Tabs */}
        <div className="flex mb-6 border-b border-[var(--color-border)]">
          <button
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
            <label className="input-label">Email</label>
            <input
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
            <label className="input-label">Senha</label>
            <input
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
