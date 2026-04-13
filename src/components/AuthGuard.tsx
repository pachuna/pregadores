"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/lib/api";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { accessToken, refreshToken, setTokens, logout } = useAuthStore();
  const router = useRouter();
  const [checking, setChecking] = useState(!accessToken && !!refreshToken);

  useEffect(() => {
    // Tem accessToken — autenticado
    if (accessToken) {
      setChecking(false);
      return;
    }

    // Sem nenhum token — vai para login
    if (!refreshToken) {
      router.replace("/login");
      return;
    }

    // Tem refreshToken mas sem accessToken — tenta renovar silenciosamente
    authApi
      .refresh(refreshToken)
      .then(({ data }) => {
        setTokens(data.accessToken, data.refreshToken, data.role, data.congregationId);
      })
      .catch(() => {
        logout();
        router.replace("/login");
      })
      .finally(() => {
        setChecking(false);
      });
  }, [accessToken, refreshToken, setTokens, logout, router]);

  if (checking) return null;
  if (!accessToken) return null;

  return <>{children}</>;
}
