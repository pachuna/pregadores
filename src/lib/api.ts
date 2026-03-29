import axios from "axios";
import { useAuthStore } from "@/store/authStore";
import type { AuthTokens, Revisit } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || "";

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthTokens>("/api/auth/login", { email, password }),
  register: (email: string, password: string) =>
    api.post<AuthTokens>("/api/auth/register", { email, password }),
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
    notes?: string;
    visitDate: string;
  }) => api.post<Revisit>("/api/revisits", data),
};
