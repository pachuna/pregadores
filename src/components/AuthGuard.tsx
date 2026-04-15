"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/lib/api";
import AskNameModal from "./AskNameModal";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { accessToken, refreshToken, name, setTokens, logout } = useAuthStore();
  const router = useRouter();
  const [checking, setChecking] = useState(!accessToken && !!refreshToken);

  useEffect(() => {
    // Tem accessToken — autenticado
    if (accessToken) {
      setChecking(false);
      return;
    }

    // Sem nenhum token — vai para login preservando a URL de origem
    if (!refreshToken) {
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      router.replace(`/login?redirect=${redirect}`);
      return;
    }

    // Tem refreshToken mas sem accessToken — tenta renovar silenciosamente
    authApi
      .refresh(refreshToken)
      .then(({ data }) => {
        setTokens(data.accessToken, data.refreshToken, data.role, data.congregationId, data.name);
      })
      .catch(() => {
        logout();
        const redirect = encodeURIComponent(window.location.pathname + window.location.search);
        router.replace(`/login?redirect=${redirect}`);
      })
      .finally(() => {
        setChecking(false);
      });
  }, [accessToken, refreshToken, setTokens, logout, router]);

  if (checking) return null;
  if (!accessToken) return null;

  return (
    <>
      {children}
      {!name && <AskNameModal />}
    </>
  );
}
