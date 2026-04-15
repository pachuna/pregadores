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
  const [emailTab, setEmailTab] = useState<"login" | "register">("login");
  const [showEmailSection, setShowEmailSection] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const accessToken = useAuthStore((s) => s.accessToken);
  const setTokens = useAuthStore((s) => s.setTokens);
  const router = useRouter();

  const getRedirect = () => {
    if (typeof window === "undefined") return "/home";
    const r = new URLSearchParams(window.location.search).get("redirect");
    return r && r.startsWith("/") ? r : "/home";
  };

  useEffect(() => {
    if (accessToken) {
      router.replace(getRedirect());
    }
  }, [accessToken, router]);

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
            setTokens(data.accessToken, data.refreshToken, data.role, data.congregationId, data.name);
            router.replace(getRedirect());
          } catch (err: unknown) {
            const message =
              typeof err === "object" &&
              err !== null &&
              "response" in err &&
              typeof (err as { response?: { data?: { error?: string } } }).response?.data
                ?.error === "string"
                ? (err as { response: { data: { error: string } } }).response.data.error
                : "Não foi possível entrar com Google.";
            setError(message);
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
        text: "continue_with",
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
  }, [router, setTokens]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoginLoading(true);
    try {
      const { data } = await authApi.login(email.trim(), password);
      setTokens(data.accessToken, data.refreshToken, data.role, data.congregationId, data.name);
      router.replace(getRedirect());
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error === "string"
          ? (err as { response: { data: { error: string } } }).response.data.error
          : "Email ou senha incorretos.";
      setError(message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setRegisterLoading(true);
    try {
      const { data } = await authApi.register(email.trim(), password);
      setTokens(data.accessToken, data.refreshToken, data.role, data.congregationId, data.name);
      router.replace(getRedirect());
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error === "string"
          ? (err as { response: { data: { error: string } } }).response.data.error
          : "Não foi possível criar sua conta.";
      setError(message);
    } finally {
      setRegisterLoading(false);
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
          <h1 className="text-4xl font-bold text-white tracking-wide mt-2">Pregadores</h1>
          <p className="text-white/80 mt-2 text-sm">Gerenciamento de Revisitas</p>
        </div>
      </div>

      <div className="card w-full max-w-md border border-[var(--color-border)]">
        <div className="mb-6 border-b border-[var(--color-border)] pb-2">
          <h2 className="text-center font-semibold text-[var(--color-primary)]">Entrar com Google</h2>
        </div>

        <div className="flex flex-col gap-4">
          {error && (
            <p className="text-sm text-[var(--color-danger)] text-center">
              {error}
            </p>
          )}

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

          <div className="flex items-center gap-3 pt-1">
            <div className="h-px bg-[var(--color-border)] flex-1" />
            <span className="text-xs text-[var(--color-text-light)]">ou</span>
            <div className="h-px bg-[var(--color-border)] flex-1" />
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]/60 p-3">
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => { setShowEmailSection((prev) => !prev); setError(""); }}
            >
              {showEmailSection ? "Ocultar acesso por email" : "Entrar com email e senha"}
            </button>

            {showEmailSection && (
              <div className="mt-4">
                {/* Abas Login / Criar Conta */}
                <div className="flex rounded-xl overflow-hidden border border-[var(--color-border)] mb-4">
                  <button
                    type="button"
                    onClick={() => { setEmailTab("login"); setError(""); }}
                    className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                      emailTab === "login"
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-transparent text-[var(--color-text-light)] hover:bg-[var(--color-border)]"
                    }`}
                  >
                    Entrar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEmailTab("register"); setError(""); }}
                    className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                      emailTab === "register"
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-transparent text-[var(--color-text-light)] hover:bg-[var(--color-border)]"
                    }`}
                  >
                    Criar conta
                  </button>
                </div>

                {/* Formulário Login */}
                {emailTab === "login" && (
                  <form onSubmit={handleLogin} className="flex flex-col gap-3">
                    <div>
                      <label htmlFor="login-email" className="input-label">Email</label>
                      <input
                        id="login-email"
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
                      <label htmlFor="login-password" className="input-label">Senha</label>
                      <input
                        id="login-password"
                        type="password"
                        className="input-field"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                      />
                    </div>
                    <button type="submit" className="btn-primary" disabled={loginLoading}>
                      {loginLoading ? "Entrando..." : "Entrar"}
                    </button>
                  </form>
                )}

                {/* Formulário Criar Conta */}
                {emailTab === "register" && (
                  <form onSubmit={handleCreateAccount} className="flex flex-col gap-3">
                    <div>
                      <label htmlFor="register-email" className="input-label">Email</label>
                      <input
                        id="register-email"
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
                      <label htmlFor="register-password" className="input-label">Senha</label>
                      <input
                        id="register-password"
                        type="password"
                        className="input-field"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        autoComplete="new-password"
                      />
                    </div>
                    <button type="submit" className="btn-primary" disabled={registerLoading}>
                      {registerLoading ? "Criando conta..." : "Criar conta"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
