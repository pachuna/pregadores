import axios from "axios";
import { useAuthStore } from "@/store/authStore";
import type { AuthTokens, Revisit, PioneerReport } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || "";

const api = axios.create({ baseURL: BASE_URL });
let refreshPromise: Promise<AuthTokens | null> | null = null;

function isRefreshEndpoint(url?: string) {
  return (url || "").includes("/api/auth/refresh");
}

function isAuthEndpoint(url?: string) {
  return (url || "").includes("/api/auth/");
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
      isRefreshEndpoint(requestUrl) ||
      isAuthEndpoint(requestUrl)
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
            setTokens(data.accessToken, data.refreshToken, data.role, data.congregationId, data.name);
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
  logout: (refreshToken: string) =>
    api.post<{ ok: boolean }>("/api/auth/logout", { refreshToken }),
  updateProfile: (name: string) =>
    api.patch<{ ok: boolean; name: string }>("/api/auth/profile", { name }),
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

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "ANCIAO" | "PUBLICADOR" | "SERVO_DE_CAMPO";
  congregationId: string | null;
  isBlocked: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { revisits: number };
}

export interface AdminUsersResponse {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  counts: Record<"ADMIN" | "ANCIAO" | "PUBLICADOR" | "SERVO_DE_CAMPO", number>;
}

export const adminApi = {
  listUsers: (params?: { page?: number; pageSize?: number; search?: string }) =>
    api.get<AdminUsersResponse>("/api/admin/users", { params }),
  updateUser: (
    id: string,
    data: {
      role?: "ADMIN" | "ANCIAO" | "PUBLICADOR" | "SERVO_DE_CAMPO";
      congregationId?: string | null;
      isBlocked?: boolean;
    }
  ) => api.patch<Omit<AdminUser, "_count">>(`/api/admin/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/api/admin/users/${id}`),
};

// ── Congregações ─────────────────────────────────────────────────────────────

export interface ActiveCongregation {
  id: string;
  name: string;
  city: string;
  state: string;
}

export interface CongregationJoinRequest {
  id: string;
  userId: string;
  congregationId: string;
  congregationName: string;
  congregationCity: string;
  congregationState: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  user?: { id: string; email: string; name: string | null };
  createdAt: string;
}

export interface CongregationMember {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "ANCIAO" | "PUBLICADOR" | "SERVO_DE_CAMPO";
  isBlocked: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  _count: { revisits: number };
}

export interface Congregation {
  id: string;
  name: string;
  jwEmail: string;
  state: string;
  city: string;
  status: "PENDING" | "ACTIVE" | "BLOCKED" | "REJECTED";
  createdById: string;
  createdBy?: { id: string; email: string };
  members?: CongregationMember[];
  _count?: { members: number };
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PushTarget = "ALL" | "ADMIN" | "ANCIAO" | "PUBLICADOR" | "congregation";

export const pushApi = {
  send: (data: {
    title: string;
    body: string;
    url?: string;
    target: PushTarget;
    congregationId?: string;
  }) => api.post<{ ok: boolean }>("/api/push/send", data),
};

export { type PioneerReport };

// ── Territórios ──────────────────────────────────────────────────────────────

export interface TerritoryListItem {
  id: string;
  number: number;
  label: string | null;
  territoryType: "IMAGE" | "STREETS";
  imageUrl: string | null;
  color: string;
  hidden: boolean;
  lastUpdate: string | null;
  totalStreets: number;
  totalHouses: number;
  lastVisitAt: string | null;
  lastSharedAt: string | null;
}

export interface HouseVisitSummary {
  id: string;
  status: "OK" | "FAIL";
  visitedAt: string;
}

export interface TerritoryHouse {
  id: string;
  number: string;
  observation: string | null;
  lastVisit: HouseVisitSummary | null;
}

export interface TerritoryStreet {
  id: string;
  name: string;
  lastUpdate: string | null;
  houses: TerritoryHouse[];
}

export interface TerritoryDetail {
  id: string;
  number: number;
  label: string | null;
  territoryType: "IMAGE" | "STREETS";
  imageUrl: string | null;
  color: string;
  hidden: boolean;
  lastUpdate: string | null;
  lastSharedAt: string | null;
  streets: TerritoryStreet[];
}

export const territoriesApi = {
  list: () => api.get<TerritoryListItem[]>("/api/territories"),
  getById: (id: string) => api.get<TerritoryDetail>(`/api/territories/${id}`),
  markVisit: (territoryId: string, houseId: string, status: "OK" | "FAIL") =>
    api.post<HouseVisitSummary>(`/api/territories/${territoryId}/visit`, { houseId, status }),
  create: (data: { label: string; color?: string; territoryType: "IMAGE" | "STREETS" }) =>
    api.post<TerritoryListItem>("/api/territories", data),
  uploadImage: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<{ imageUrl: string }>(`/api/territories/${id}/image`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  addStreet: (id: string, data: { name: string; houses?: string[] }) =>
    api.post<TerritoryStreet & { houses: TerritoryHouse[] }>(`/api/territories/${id}/streets`, data),
  removeStreet: (id: string, streetId: string) =>
    api.delete(`/api/territories/${id}/streets?streetId=${streetId}`),
  searchStreets: (q: string) =>
    api.get<{ results: Array<{ cep: string; logradouro: string; bairro: string; localidade: string; uf: string }> }>(
      "/api/territories/street-search",
      { params: { q } }
    ),
  generateMap: (id: string) =>
    api.post<{ imageUrl: string; center: { lat: number; lng: number }; zoom: number }>(
      `/api/territories/${id}/generate-map`
    ),
  delete: (id: string) =>
    api.delete<{ ok: boolean }>(`/api/territories/${id}`),
  share: (id: string, target: "congregation" | "ALL" | "ADMIN" = "congregation") =>
    api.post<{ ok: boolean; lastSharedAt: string; lastWorkedAt: string | null }>(
      `/api/territories/${id}/share`,
      { target }
    ),
  addHouse: (territoryId: string, streetId: string, data: { number: string; observation?: string }) =>
    api.post<TerritoryHouse>(`/api/territories/${territoryId}/streets/${streetId}/houses`, data),
  updateHouse: (territoryId: string, streetId: string, houseId: string, data: { number?: string; observation?: string }) =>
    api.patch<TerritoryHouse>(`/api/territories/${territoryId}/streets/${streetId}/houses/${houseId}`, data),
  deleteHouse: (territoryId: string, streetId: string, houseId: string) =>
    api.delete(`/api/territories/${territoryId}/streets/${streetId}/houses/${houseId}`),
};

export const pioneerApi = {
  list: (year: number, month: number) =>
    api.get<PioneerReport[]>("/api/pioneer", { params: { year, month } }),
  upsert: (data: {
    date: string;
    hours: number;
    minutes: number;
    creditHours: number;
    bibleStudies: number;
    goalHours: number;
    notes: string;
  }) => api.post<PioneerReport>("/api/pioneer", data),
};

export const congregationsApi = {
  list: () => api.get<Congregation[]>("/api/congregations"),
  getMine: () => api.get<Congregation | null>("/api/congregations"),
  getById: (id: string) => api.get<Congregation>(`/api/congregations/${id}`),
  create: (data: { name: string; jwEmail: string; state: string; city: string }) =>
    api.post<Congregation>("/api/congregations", data),
  update: (
    id: string,
    data: { name?: string; jwEmail?: string; state?: string; city?: string; status?: string; rejectionReason?: string }
  ) => api.patch<Congregation>(`/api/congregations/${id}`, data),
  addMember: (congregationId: string, userId: string, role?: "ANCIAO" | "PUBLICADOR") =>
    api.post(`/api/congregations/${congregationId}/members`, { userId, role }),
  updateMember: (
    congregationId: string,
    data: { userId: string; isBlocked?: boolean; role?: "ANCIAO" | "PUBLICADOR" | "SERVO_DE_CAMPO"; name?: string }
  ) => api.patch(`/api/congregations/${congregationId}/members`, data),
  removeMember: (congregationId: string, userId: string) =>
    api.delete(`/api/congregations/${congregationId}/members`, { data: { userId } }),
  delete: (id: string) =>
    api.delete<{ ok: boolean; message: string; membersUnlinked: number; territoriesRemoved: number }>(
      `/api/congregations/${id}`
    ),
  listActive: () =>
    api.get<{ congregations: ActiveCongregation[]; pendingRequest: CongregationJoinRequest | null }>(
      "/api/congregations/active"
    ),
  requestJoin: (congregationId: string) =>
    api.post<CongregationJoinRequest>(`/api/congregations/${congregationId}/join`),
  cancelJoin: (congregationId: string, requestId: string) =>
    api.delete(`/api/congregations/${congregationId}/join/${requestId}`),
  listJoinRequests: (congregationId: string) =>
    api.get<Array<CongregationJoinRequest & { user: { id: string; email: string; name: string | null } }>>(
      `/api/congregations/${congregationId}/join`
    ),
  respondJoin: (
    congregationId: string,
    requestId: string,
    action: "approve" | "reject",
    rejectionReason?: string
  ) =>
    api.patch<{ ok: boolean; action: string }>(
      `/api/congregations/${congregationId}/join/${requestId}`,
      { action, rejectionReason }
    ),
};

export default api;

