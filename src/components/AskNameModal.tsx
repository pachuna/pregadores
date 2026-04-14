"use client";

import { useState } from "react";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function AskNameModal() {
  const setName = useAuthStore((s) => s.setName);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setError("Digite pelo menos 2 caracteres.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { data } = await authApi.updateProfile(trimmed);
      setName(data.name);
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 flex flex-col gap-4"
        style={{
          background: "var(--color-surface-card)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        {/* Ícone */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
          style={{ background: "var(--color-primary-soft)" }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="1.5"
            className="w-7 h-7"
            aria-hidden="true"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>

        <div className="text-center">
          <h2 className="text-lg font-bold text-[var(--color-text)]">
            Como gostaria de ser chamado?
          </h2>
          <p className="text-sm text-[var(--color-text-light)] mt-1">
            Seu nome aparecerá para os membros da congregação.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            className="input-field"
            placeholder="Seu nome"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={60}
            autoFocus
            autoComplete="given-name"
          />
          {error && (
            <p className="text-xs text-[var(--color-danger)] text-center">{error}</p>
          )}
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading || value.trim().length < 2}
          >
            {loading ? "Salvando..." : "Confirmar"}
          </button>
        </form>
      </div>
    </div>
  );
}
