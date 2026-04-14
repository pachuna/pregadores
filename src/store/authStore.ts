"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  role: string | null;
  congregationId: string | null;
  name: string | null;
  setTokens: (accessToken: string, refreshToken: string, role?: string, congregationId?: string | null, name?: string | null) => void;
  setName: (name: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      role: null,
      congregationId: null,
      name: null,
      setTokens: (accessToken, refreshToken, role, congregationId, name) =>
        set({ accessToken, refreshToken, role: role ?? null, congregationId: congregationId ?? null, name: name ?? null }),
      setName: (name) => set({ name }),
      logout: () => set({ accessToken: null, refreshToken: null, role: null, congregationId: null, name: null }),
    }),
    {
      name: "pregadores-auth",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
