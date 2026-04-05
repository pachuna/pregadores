"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  role: string | null;
  setTokens: (accessToken: string, refreshToken: string, role?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      role: null,
      setTokens: (accessToken, refreshToken, role) =>
        set({ accessToken, refreshToken, role: role ?? null }),
      logout: () => set({ accessToken: null, refreshToken: null, role: null }),
    }),
    {
      name: "pregadores-auth",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
