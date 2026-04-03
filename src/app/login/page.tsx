"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              shape?: "pill" | "rectangular" | "circle" | "square";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              width?: number;
            },
          ) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || "";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

  useEffect(() => {
    if (typeof window === "undefined" || !GOOGLE_CLIENT_ID) {
      return;
    }

    let mounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const element = document.getElementById("google-signin-container");
    if (!element) {
      return;
    }

    const initGoogle = (attempt = 0) => {
      if (!mounted) {
        return;
      }

      const googleId = window.google?.accounts?.id;
      if (!googleId) {
        if (attempt < 20) {
          retryTimer = setTimeout(() => initGoogle(attempt + 1), 150);
        }
        return;
      }

      googleId.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          const credential = response.credential;
          if (!credential) {
            setError("Falha ao autenticar com Google.");
            return;
          }

          setError("");
          setGoogleLoading(true);
          try {
            const { data } = await authApi.google(credential);
            setTokens(data.accessToken, data.refreshToken);
            router.replace("/home");
          } catch {
            setError("Não foi possível entrar com Google.");
          } finally {
            setGoogleLoading(false);
          }
        },
      });

      element.innerHTML = "";
      googleId.renderButton(element, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: isRegister ? "signup_with" : "signin_with",
        width: Math.min(Math.floor(element.clientWidth), 420),
      });
    };

    if (window.google) {
      initGoogle();
      return () => {
        mounted = false;
      };
    }

    const existingScript = document.getElementById("google-identity-script");
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "google-identity-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => initGoogle();
      document.head.appendChild(script);
    } else {
      (existingScript as HTMLScriptElement).onload = () => initGoogle();
    }

    return () => {
      mounted = false;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [isRegister, router, setTokens]);

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
      <div className="w-full max-w-md text-center mb-7">
        <div
          className="rounded-3xl px-6 py-9 shadow-[var(--shadow-strong)] border"
          style={{
            background:
              "linear-gradient(145deg, var(--color-primary) 0%, var(--color-primary-dark) 62%, #2f4778 100%)",
            borderColor: "rgba(255,255,255,0.24)",
          }}
        >
          <p className="text-white/80 text-[11px] tracking-[0.22em] uppercase font-semibold">
            Território Digital
          </p>
          <h1 className="text-4xl font-black text-white tracking-wide mt-2">Pregadores</h1>
          <p className="text-white/85 mt-2 text-sm">Gerenciamento de Revisitas</p>
        </div>
      </div>

      <div className="card w-full max-w-md">
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
            <p className="text-sm text-[var(--color-danger)] text-center font-medium">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Carregando..." : isRegister ? "Criar Conta" : "Entrar"}
          </button>

          <div className="flex items-center gap-3 pt-1">
            <div className="h-px bg-[var(--color-border)] flex-1" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-light)]">
              ou
            </span>
            <div className="h-px bg-[var(--color-border)] flex-1" />
          </div>

          {GOOGLE_CLIENT_ID ? (
            <div>
              <div id="google-signin-container" className="w-full min-h-11" />
              {googleLoading && (
                <p className="text-xs text-center text-[var(--color-text-light)] mt-2">
                  Autenticando com Google...
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-center text-[var(--color-text-light)]">
              Configure NEXT_PUBLIC_GOOGLE_CLIENT_ID para habilitar login com Google.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
