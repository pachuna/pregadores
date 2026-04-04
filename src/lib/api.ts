import axios from "axios";
import { useAuthStore } from "@/store/authStore";
import type { AuthTokens, Revisit } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || "";

const api = axios.create({ baseURL: BASE_URL });
let refreshPromise: Promise<AuthTokens | null> | null = null;

function isRefreshEndpoint(url?: string) {
  return (url || "").includes("/api/auth/refresh");
}

function redirectToLogin(reason: "session-expired" | "unauthorized") {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams({ reason });
  window.location.replace(`/login?${params.toString()}`);
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as
      | (typeof error.config & { _retry?: boolean })
      | undefined;
    const status = error.response?.status;
    const requestUrl = originalRequest?.url;

    if (
      status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isRefreshEndpoint(requestUrl)
    ) {
      return Promise.reject(error);
    }

    const { refreshToken, setTokens, logout } = useAuthStore.getState();
    if (!refreshToken) {
      logout();
      redirectToLogin("unauthorized");
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = api
          .post<AuthTokens>("/api/auth/refresh", { refreshToken })
          .then(({ data }) => {
            setTokens(data.accessToken, data.refreshToken);
            return data;
          })
          .catch(() => {
            logout();
            redirectToLogin("session-expired");
            return null;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const newTokens = await refreshPromise;
      if (!newTokens) {
        return Promise.reject(error);
      }

      originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
      return api(originalRequest);
    } catch {
      return Promise.reject(error);
    }
  },
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthTokens>("/api/auth/login", { email, password }),
  register: (email: string, password: string) =>
    api.post<AuthTokens>("/api/auth/register", { email, password }),
  google: (idToken: string) =>
    api.post<AuthTokens>("/api/auth/google", { idToken }),
  refresh: (refreshToken: string) =>
    api.post<AuthTokens>("/api/auth/refresh", { refreshToken }),
};

export const revisitsApi = {
  list: () => api.get<Revisit[]>("/api/revisits"),
  nearby: (lat: number, lng: number, radiusKm = 15) =>
    api.get<Revisit[]>("/api/revisits/nearby", {
      params: { latitude: lat, longitude: lng, radiusKm },
    }),
  create: (data: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    isActive?: boolean;
    notes?: string;
    visitDate: string;
  }) => api.post<Revisit>("/api/revisits", data),
  update: (
    id: string,
    data: {
      name?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      isActive?: boolean;
      newVisitDate?: string;
      newVisitSummary?: string;
    },
  ) => api.patch<Revisit>(`/api/revisits/${id}`, data),
  delete: (id: string) => api.delete(`/api/revisits/${id}`),
};

export interface StatsData {
  totalUsers: number;
  onlineUsers: number;
  totalRevisits: number;
  activeRevisits: number;
  inactiveRevisits: number;
}

export const statsApi = {
  get: () => api.get<StatsData>("/api/stats"),
};

export const presenceApi = {
  ping: () => api.post("/api/presence"),
};
