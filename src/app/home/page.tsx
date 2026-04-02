"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { revisitsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import AuthGuard from "@/components/AuthGuard";
import RevisitsMap from "@/components/RevisitsMap";
import MobileBottomNav from "@/components/MobileBottomNav";
import {
  getLastKnownLocation,
  LOCATION_CACHE_MAX_AGE_MS,
  resolveUserLocation,
} from "@/lib/location";
import type { Revisit } from "@/lib/types";

type SheetLevel = "peek" | "mid" | "full";

const SHEET_HEIGHTS: Record<SheetLevel, number> = {
  peek: 148,
  mid: 352,
  full: 480,
};

const MIN_SHEET_HEIGHT = SHEET_HEIGHTS.peek;
const MAX_SHEET_HEIGHT = SHEET_HEIGHTS.full;

function calcDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export default function HomePage() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}

function HomeContent() {
  const [revisits, setRevisits] = useState<Revisit[]>([]);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [sheetLevel, setSheetLevel] = useState<SheetLevel>("mid");
  const [sheetHeight, setSheetHeight] = useState<number>(SHEET_HEIGHTS.mid);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragStartHeight, setDragStartHeight] = useState<number>(
    SHEET_HEIGHTS.mid,
  );
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  const sortedByDistance = userPos
    ? [...revisits]
        .map((item) => ({
          ...item,
          distanceKm: calcDistanceKm(userPos, {
            lat: item.latitude,
            lng: item.longitude,
          }),
        }))
        .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
    : revisits;

  const visibleItems =
    sheetLevel === "peek"
      ? sortedByDistance.slice(0, 1)
      : sheetLevel === "mid"
        ? sortedByDistance.slice(0, 4)
        : sortedByDistance;

  const loadRevisits = useCallback(async () => {
    try {
      const { data } = await revisitsApi.list();
      setRevisits(Array.isArray(data) ? data : []);
    } catch {
      setRevisits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const cached = getLastKnownLocation();
    if (cached) {
      setUserPos(cached);
    }

    resolveUserLocation({
      maxAgeMs: LOCATION_CACHE_MAX_AGE_MS,
      timeoutMs: 9000,
      enableHighAccuracy: false,
    }).then((pos) => {
      if (!active) {
        return;
      }

      if (pos) {
        setUserPos(pos);
      } else if (!cached) {
        setUserPos({ lat: -23.5505, lng: -46.6333 });
      }
    });

    loadRevisits();

    return () => {
      active = false;
    };
  }, [loadRevisits]);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  useEffect(() => {
    if (!isDraggingSheet) {
      setSheetHeight(SHEET_HEIGHTS[sheetLevel]);
    }
  }, [isDraggingSheet, sheetLevel]);

  const snapSheetByHeight = (height: number) => {
    const options = Object.entries(SHEET_HEIGHTS) as Array<[SheetLevel, number]>;
    const [closestLevel] = options.reduce((closest, current) => {
      return Math.abs(current[1] - height) < Math.abs(closest[1] - height)
        ? current
        : closest;
    });

    setSheetLevel(closestLevel);
  };

  const handleSheetDragEnd = () => {
    if (!isDraggingSheet) {
      return;
    }

    snapSheetByHeight(sheetHeight);
    setIsDraggingSheet(false);
    setDragStartY(null);
    setDragStartHeight(sheetHeight);
  };

  return (
    <div className="mobile-page flex flex-col min-h-screen">
      {/* Header */}
      <header
        className="sticky top-0 flex items-center justify-between px-4 py-3 shadow-md z-10"
        style={{ background: "var(--color-primary)" }}
      >
        <div>
          <p className="text-white/75 text-xs font-medium">Área do mapa</p>
          <h1 className="text-white text-lg font-bold leading-tight">Pregadores</h1>
        </div>
        <button
          className="btn-danger text-sm w-auto px-3"
          onClick={handleLogout}
          type="button"
        >
          Sair
        </button>
      </header>

      {/* Map */}
      <div className="mobile-content flex-1 relative px-3 pt-3">
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl h-[72vh] bg-white border border-[var(--color-border)]">
            <p className="text-[var(--color-text-light)]">
              Carregando mapa...
            </p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-[var(--color-border)] h-[72vh]">
            <RevisitsMap
              revisits={revisits}
              center={userPos || { lat: -23.5505, lng: -46.6333 }}
              userPos={userPos}
            />
          </div>
        )}

        <section
          className="home-sheet-enter absolute left-3 right-3 rounded-t-3xl border border-[var(--color-border)] bg-white/95 backdrop-blur-sm shadow-2xl"
          style={{
            bottom: "calc(5.2rem + env(safe-area-inset-bottom))",
            height: `${sheetHeight}px`,
            transition: isDraggingSheet
              ? "none"
              : "height 260ms cubic-bezier(0.2, 0.82, 0.2, 1)",
          }}
          aria-label="Painel de revisitas"
        >
          <div
            className="home-sheet-handle px-4 pt-2 pb-3 cursor-grab active:cursor-grabbing"
            onPointerDown={(event) => {
              if (event.clientY == null) {
                return;
              }
              event.currentTarget.setPointerCapture(event.pointerId);
              setIsDraggingSheet(true);
              setDragStartY(event.clientY);
              setDragStartHeight(sheetHeight);
            }}
            onPointerMove={(event) => {
              if (!isDraggingSheet || dragStartY == null) {
                return;
              }

              const delta = dragStartY - event.clientY;
              const nextHeight = Math.max(
                MIN_SHEET_HEIGHT,
                Math.min(MAX_SHEET_HEIGHT, dragStartHeight + delta),
              );

              setSheetHeight(nextHeight);
            }}
            onPointerUp={handleSheetDragEnd}
            onPointerCancel={handleSheetDragEnd}
          >
            <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-[var(--color-border)]" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--color-text-light)]">Próximas revisitas</p>
                <p className="text-lg font-bold text-[var(--color-primary-dark)] leading-tight">
                  {revisits.length} cadastradas
                </p>
              </div>
              <button
                className="btn-primary w-auto px-3 py-2 text-xs"
                onClick={() => router.push("/revisits/new")}
                type="button"
                style={{ background: "var(--color-accent)" }}
              >
                Nova
              </button>
            </div>
          </div>

          <div className="px-4 pb-4 overflow-auto h-[calc(100%-82px)]">
            {visibleItems.length === 0 ? (
              <p className="text-sm text-[var(--color-text-light)] text-center py-6">
                Nenhuma revisita cadastrada ainda.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {visibleItems.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                        <p className="text-xs text-[var(--color-text-light)] truncate">
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

            {sheetLevel !== "full" && sortedByDistance.length > visibleItems.length && (
              <button
                type="button"
                className="mt-3 w-full text-sm font-semibold text-[var(--color-primary)]"
                onClick={() => setSheetLevel("full")}
              >
                Ver todas as revisitas
              </button>
            )}
          </div>
        </section>
      </div>

      <MobileBottomNav />
    </div>
  );
}
