"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, revisitsApi, statsApi, presenceApi, type StatsData } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import AuthGuard from "@/components/AuthGuard";
import MobileBottomNav from "@/components/MobileBottomNav";
import RevisitEditModal from "@/components/RevisitEditModal";
import {
  getLastKnownLocation,
  LOCATION_CACHE_MAX_AGE_MS,
  resolveUserLocation,
} from "@/lib/location";
import type { Revisit } from "@/lib/types";

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function calcDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface StatCardProps {
  label: string;
  value: number | undefined;
  color?: "blue" | "green" | "red";
  pulse?: boolean;
}

function StatCard({ label, value, color, pulse }: StatCardProps) {
  const cardClass = color
    ? { blue: "bg-[rgba(37,99,255,0.1)] border-[rgba(37,99,255,0.25)]", green: "bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.25)]", red: "bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.25)]" }[color]
    : "bg-[var(--color-surface-card)] border-[var(--color-border)]";
  const valueClass = color
    ? { blue: "text-[#60a5fa]", green: "text-[#4ade80]", red: "text-[#f87171]" }[color]
    : "text-[var(--color-text)]";
  const labelClass = color
    ? { blue: "text-[#60a5fa]", green: "text-[#4ade80]", red: "text-[#f87171]" }[color]
    : "text-[var(--color-text-light)]";

  return (
    <div className={`rounded-xl border shadow-sm px-3 py-2 flex flex-col items-center ${cardClass}`}>
      <span className={`text-[10px] uppercase tracking-wide font-semibold leading-tight text-center flex items-center gap-1 ${labelClass}`}>
        {pulse && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
        )}
        {label}
      </span>
      <span className={`text-xl font-bold leading-tight ${valueClass}`}>{value ?? "—"}</span>
    </div>
  );
}

type QuickActionIcon = "plus" | "map" | "timer" | "congregation" | "admin";

interface QuickActionProps {
  label: string;
  icon: QuickActionIcon;
  accent?: boolean;
  onClick: () => void;
}

function QuickAction({ label, icon, accent, onClick }: QuickActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-4 flex flex-col items-start gap-2 transition-all active:scale-[0.97] shadow-sm ${
        accent
          ? "bg-[#2563ff] border-[#2563ff] text-white"
          : "bg-[var(--color-surface-card)] border-[var(--color-border)] text-[var(--color-text)]"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          accent ? "bg-white/20" : "bg-[var(--color-primary-soft)]"
        }`}
      >
        <QuickActionIcon icon={icon} accent={accent} />
      </div>
      <span className="text-sm font-semibold leading-tight">{label}</span>
    </button>
  );
}

function QuickActionIcon({ icon, accent }: { icon: QuickActionIcon; accent?: boolean }) {
  const cls = `w-5 h-5 ${accent ? "text-white" : "text-[var(--color-accent)]"}`;
  if (icon === "plus") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={cls} aria-hidden="true">
        <path d="M12 5V19" /><path d="M5 12H19" />
      </svg>
    );
  }
  if (icon === "map") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls} aria-hidden="true">
        <path d="M3 6.5L8.5 4L15.5 6.5L21 4V17.5L15.5 20L8.5 17.5L3 20V6.5Z" />
        <path d="M8.5 4V17.5" /><path d="M15.5 6.5V20" />
      </svg>
    );
  }
  if (icon === "timer") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls} aria-hidden="true">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2.5" />
        <path d="M9.5 2.5h5" /><path d="M12 2.5V5" />
      </svg>
    );
  }
  if (icon === "congregation") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls} aria-hidden="true">
        <path d="M3 9.5L12 4l9 5.5V20H3V9.5Z" />
        <path d="M9 20v-6h6v6" /><path d="M12 4v3" />
      </svg>
    );
  }
  if (icon === "admin") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls} aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        <path d="M16 11l1.5 1.5L20 10" />
      </svg>
    );
  }
  return null;
}

// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function HomePage() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}

function HomeContent() {
  const [revisits, setRevisits] = useState<Revisit[]>([]);
  const [selectedRevisit, setSelectedRevisit] = useState<Revisit | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const logout = useAuthStore((s) => s.logout);
  const role = useAuthStore((s) => s.role);
  const congregationId = useAuthStore((s) => s.congregationId);
  const name = useAuthStore((s) => s.name);
  const router = useRouter();

  const loadRevisits = useCallback(async () => {
    try {
      const { data } = await revisitsApi.list();
      setRevisits(Array.isArray(data) ? data : []);
    } catch {
      setRevisits([]);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const cached = getLastKnownLocation();
    if (cached) setUserPos(cached);

    resolveUserLocation({
      maxAgeMs: LOCATION_CACHE_MAX_AGE_MS,
      timeoutMs: 9000,
      enableHighAccuracy: false,
    }).then((pos) => {
      if (!active) return;
      if (pos) setUserPos(pos);
    });

    loadRevisits();
    statsApi.get().then(({ data }) => setStats(data)).catch(() => {});
    presenceApi.ping().catch(() => {});

    const heartbeatId = setInterval(() => {
      presenceApi.ping().catch(() => {});
      statsApi.get().then(({ data }) => setStats(data)).catch(() => {});
    }, 30_000);

    return () => {
      active = false;
      clearInterval(heartbeatId);
    };
  }, [loadRevisits]);

  const nearestRevisits = userPos
    ? [...revisits]
        .map((r) => ({
          ...r,
          distanceKm: calcDistanceKm(userPos, { lat: r.latitude, lng: r.longitude }),
        }))
        .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
        .slice(0, 3)
    : revisits.slice(0, 3);

  const congregationHref = role === "ADMIN" ? "/admin" : "/congregations";
  const congregationLabel = role === "ADMIN" ? "Admin" : "Congregação";
  const adminHasCongregation = role === "ADMIN" && !!congregationId;

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // melhor esforço
    } finally {
      logout();
      router.replace("/login");
    }
  };

  return (
    <div className="mobile-page flex flex-col min-h-screen">
      {/* Header */}
      <header className="mobile-header justify-between">
        <div>
          <p className="mobile-header__meta">{getGreeting()}</p>
          <h1 className="mobile-header__title">
            {name ? name : "Pregadores"}
          </h1>
        </div>
        <button
          className="text-sm w-auto px-3 py-2 rounded-lg border border-white/35 text-white font-semibold bg-white/10 hover:bg-white/20 transition-colors"
          onClick={handleLogout}
          type="button"
        >
          Sair
        </button>
      </header>

      <div className="px-4 pt-3 flex flex-col gap-5 pb-28">
        {/* Stats */}
        <div className="flex flex-col gap-2">
          {(role === "ANCIAO" || role === "ADMIN") && (
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Pregadores" value={stats?.totalUsers} />
              <StatCard label="Trabalhando" value={stats?.onlineUsers} color="blue" pulse />
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Revisitas" value={stats?.totalRevisits} />
            <StatCard label="Ativas" value={stats?.activeRevisits} color="green" />
            <StatCard label="Inativas" value={stats?.inactiveRevisits} color="red" />
          </div>
        </div>

        {/* Ações rápidas */}
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-white/70 mb-2">
            Ações rápidas
          </p>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction
              label="Nova Revisita"
              icon="plus"
              accent
              onClick={() => router.push("/revisits/new")}
            />
            <QuickAction
              label="Ver no Mapa"
              icon="map"
              onClick={() => router.push("/mapa")}
            />
            <QuickAction
              label="Pioneiro"
              icon="timer"
              onClick={() => router.push("/pioneiro")}
            />
            <QuickAction
              label={congregationLabel}
              icon={role === "ADMIN" ? "admin" : "congregation"}
              onClick={() => router.push(congregationHref)}
            />
            {adminHasCongregation && (
              <QuickAction
                label="Congregação"
                icon="congregation"
                onClick={() => router.push("/congregations")}
              />
            )}
          </div>
        </div>

        {/* Próximas revisitas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-white/70">
              {userPos ? "Revisitas próximas" : "Revisitas recentes"}
            </p>
            {revisits.length > 3 && (
              <button
                type="button"
                className="text-[11px] font-semibold text-white/80 underline-offset-2 hover:underline"
                onClick={() => router.push("/revisits/nearby")}
              >
                Ver todas
              </button>
            )}
          </div>

          {nearestRevisits.length === 0 ? (
            <div className="rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-border)] px-4 py-6 text-center">
              <p className="text-sm text-white/70">Nenhuma revisita cadastrada ainda.</p>
              <button
                type="button"
                className="mt-3 text-sm font-semibold text-white underline-offset-2 hover:underline"
                onClick={() => router.push("/revisits/new")}
              >
                Criar primeira revisita
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {nearestRevisits.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-border)] px-3 py-2.5 shadow-sm cursor-pointer transition-all hover:bg-[var(--color-surface-elevated)] active:scale-[0.98]"
                  onClick={() => setSelectedRevisit(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedRevisit(item);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="font-semibold text-sm text-[var(--color-text)] truncate">
                          {item.name}
                        </h3>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                            item.isActive
                              ? "bg-[rgba(34,197,94,0.15)] text-[#4ade80]"
                              : "bg-[rgba(255,255,255,0.06)] text-[var(--color-text-light)]"
                          }`}
                        >
                          {item.isActive ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-light)] truncate mt-0.5">
                        {item.address}
                      </p>
                    </div>
                    {item.distanceKm != null && (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                        style={{ background: "var(--color-primary)" }}
                      >
                        {item.distanceKm < 1
                          ? `${(item.distanceKm * 1000).toFixed(0)} m`
                          : `${item.distanceKm.toFixed(1)} km`}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedRevisit && (
        <RevisitEditModal
          revisit={selectedRevisit}
          onClose={() => setSelectedRevisit(null)}
          onUpdate={(updated) => {
            setRevisits((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setSelectedRevisit(updated);
          }}
          onDelete={(id) => {
            setRevisits((prev) => prev.filter((r) => r.id !== id));
            setSelectedRevisit(null);
          }}
        />
      )}

      <MobileBottomNav />
    </div>
  );
}
