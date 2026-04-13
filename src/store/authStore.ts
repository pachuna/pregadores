"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  role: string | null;
  congregationId: string | null;
  setTokens: (accessToken: string, refreshToken: string, role?: string, congregationId?: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      role: null,
      congregationId: null,
      setTokens: (accessToken, refreshToken, role, congregationId) =>
        set({ accessToken, refreshToken, role: role ?? null, congregationId: congregationId ?? null }),
      logout: () => set({ accessToken: null, refreshToken: null, role: null, congregationId: null }),
    }),
    {
      name: "pregadores-auth",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
