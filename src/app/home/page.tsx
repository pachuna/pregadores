"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { revisitsApi, statsApi, type StatsData } from "@/lib/api";
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

type VisitHistoryItem = {
  date: string;
  summary: string;
};

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

function parseVisitHistory(revisit: Revisit): VisitHistoryItem[] {
  const notes = revisit.notes?.trim();
  if (!notes) {
    return [];
  }

  const parsed = notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^\[(\d{4}-\d{2}-\d{2})\]\s+(.+)$/);
      if (!match) {
        return null;
      }

      return {
        date: match[1],
        summary: match[2],
      };
    })
    .filter((item): item is VisitHistoryItem => item !== null);

  if (parsed.length > 0) {
    return [...parsed].reverse();
  }

  return [
    {
      date: revisit.visitDate.slice(0, 10),
      summary: notes,
    },
  ];
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
  const [selectedRevisit, setSelectedRevisit] = useState<Revisit | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [newVisitDate, setNewVisitDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [newVisitSummary, setNewVisitSummary] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [sheetLevel, setSheetLevel] = useState<SheetLevel>("peek");
  const [sheetHeight, setSheetHeight] = useState<number>(SHEET_HEIGHTS.peek);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragStartHeight, setDragStartHeight] = useState<number>(
    SHEET_HEIGHTS.peek,
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
    statsApi.get().then(({ data }) => setStats(data)).catch(() => {});

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

  useEffect(() => {
    if (!selectedRevisit) {
      return;
    }

    setEditName(selectedRevisit.name);
    setEditAddress(selectedRevisit.address);
    setEditIsActive(selectedRevisit.isActive);
    setNewVisitDate(new Date().toISOString().slice(0, 10));
    setNewVisitSummary("");
    setSaveError("");
  }, [selectedRevisit]);

  const handleSaveRevisit = async (): Promise<boolean> => {
    if (!selectedRevisit) {
      return false;
    }

    if (!editName.trim() || !editAddress.trim()) {
      setSaveError("Nome e endereço são obrigatórios.");
      return false;
    }

    setSaveError("");
    setIsSaving(true);
    try {
      const { data } = await revisitsApi.update(selectedRevisit.id, {
        name: editName.trim(),
        address: editAddress.trim(),
        isActive: editIsActive,
        newVisitDate,
        newVisitSummary: newVisitSummary.trim() || undefined,
      });

      setRevisits((prev) => prev.map((item) => (item.id === data.id ? data : item)));
      setSelectedRevisit(data);
      setNewVisitSummary("");
      return true;
    } catch {
      setSaveError("Não foi possível salvar a revisita.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const hasUnsavedChanges =
    !!selectedRevisit &&
    (editName.trim() !== selectedRevisit.name.trim() ||
      editAddress.trim() !== selectedRevisit.address.trim() ||
      editIsActive !== selectedRevisit.isActive ||
      newVisitSummary.trim().length > 0 ||
      newVisitDate !== new Date().toISOString().slice(0, 10));

  const handleRequestCloseModal = async () => {
    if (!selectedRevisit) {
      return;
    }

    if (!hasUnsavedChanges) {
      setSelectedRevisit(null);
      return;
    }

    setShowCloseConfirm(true);
  };

  const handleConfirmSaveAndClose = async () => {
    const saved = await handleSaveRevisit();
    if (saved) {
      setShowCloseConfirm(false);
      setSelectedRevisit(null);
    }
  };

  const handleDiscardAndClose = () => {
    setShowCloseConfirm(false);
    setSelectedRevisit(null);
  };

  const handleCancelClose = () => {
    setShowCloseConfirm(false);
  };

  const handleQuickRegisterToday = async () => {
    if (!selectedRevisit) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const summary = newVisitSummary.trim() || "Visita realizada.";

    if (!editName.trim() || !editAddress.trim()) {
      setSaveError("Nome e endereco sao obrigatorios.");
      return;
    }

    setSaveError("");
    setIsSaving(true);
    try {
      const { data } = await revisitsApi.update(selectedRevisit.id, {
        name: editName.trim(),
        address: editAddress.trim(),
        isActive: editIsActive,
        newVisitDate: today,
        newVisitSummary: summary,
      });

      setRevisits((prev) => prev.map((item) => (item.id === data.id ? data : item)));
      setSelectedRevisit(data);
      setNewVisitDate(today);
      setNewVisitSummary("");
    } catch {
      setSaveError("Nao foi possivel registrar a visita de hoje.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mobile-page flex flex-col min-h-screen">
      {/* Header */}
      <header className="mobile-header justify-between">
        <div>
          <p className="mobile-header__meta">
            Painel de Campo
          </p>
          <h1 className="mobile-header__title">Pregadores</h1>
        </div>
        <button
          className="text-sm w-auto px-3 py-2 rounded-lg border border-white/35 text-white font-semibold bg-white/10 hover:bg-white/20 transition-colors"
          onClick={handleLogout}
          type="button"
        >
          Sair
        </button>
      </header>

      {/* Stats Cards */}
      <div className="px-3 pt-2 pb-1">
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-xl bg-white/90 border border-[var(--color-border)] shadow-sm px-2 py-2 flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-light)] font-semibold leading-tight text-center">Pregadores</span>
            <span className="text-xl font-bold text-[var(--color-primary-dark)] leading-tight">
              {stats ? stats.totalUsers : "—"}
            </span>
          </div>
          <div className="rounded-xl bg-white/90 border border-[var(--color-border)] shadow-sm px-2 py-2 flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-light)] font-semibold leading-tight text-center">Revisitas</span>
            <span className="text-xl font-bold text-[var(--color-primary-dark)] leading-tight">
              {stats ? stats.totalRevisits : "—"}
            </span>
          </div>
          <div className="rounded-xl bg-green-50 border border-green-200 shadow-sm px-2 py-2 flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-wide text-green-700 font-semibold leading-tight text-center">Ativas</span>
            <span className="text-xl font-bold text-green-700 leading-tight">
              {stats ? stats.activeRevisits : "—"}
            </span>
          </div>
          <div className="rounded-xl bg-red-50 border border-red-200 shadow-sm px-2 py-2 flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-wide text-red-600 font-semibold leading-tight text-center">Inativas</span>
            <span className="text-xl font-bold text-red-500 leading-tight">
              {stats ? stats.inactiveRevisits : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="mobile-content flex-1 relative px-3 pt-3">
        {loading ? (
          <div className="flex items-center justify-center rounded-[1.1rem] h-[72vh] bg-white/95 border border-[var(--color-border)] shadow-[var(--shadow-soft)]">
            <p className="text-[var(--color-text-light)]">
              Carregando mapa...
            </p>
          </div>
        ) : (
          <div className="rounded-[1.1rem] overflow-hidden border border-[var(--color-border)] h-[72vh] shadow-[var(--shadow-soft)] bg-white">
            <RevisitsMap
              revisits={revisits}
              center={userPos || { lat: -23.5505, lng: -46.6333 }}
              userPos={userPos}
            />
          </div>
        )}

        <section
          className="home-sheet-enter absolute left-3 right-3 rounded-t-3xl border border-[var(--color-border)] bg-white/95 backdrop-blur-sm shadow-2xl flex flex-col overflow-hidden"
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
            className="home-sheet-handle px-4 pt-2 pb-3 cursor-grab active:cursor-grabbing shrink-0"
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
                <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-light)] font-semibold">
                  Proximas revisitas
                </p>
                <p className="text-lg font-bold text-[var(--color-primary-dark)] leading-tight">
                  {revisits.length} cadastradas
                </p>
              </div>
              <button
                className="inline-flex w-auto min-w-[74px] items-center justify-center rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary-soft)] px-3 py-1.5 text-[11px] font-semibold text-[var(--color-primary-dark)] shadow-sm transition-colors hover:bg-white"
                onClick={() => router.push("/revisits/new")}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                type="button"
              >
                Nova
              </button>
            </div>
          </div>

          <div className="px-4 pb-4 overflow-auto flex-1 min-h-0">
            {visibleItems.length === 0 ? (
              <p className="text-sm text-[var(--color-text-light)] text-center py-6">
                Nenhuma revisita cadastrada ainda.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {visibleItems.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] px-3 py-2.5 shadow-[0_4px_14px_rgba(22,34,52,0.06)] cursor-pointer transition-colors hover:bg-[var(--color-primary-soft)]"
                    onClick={() => setSelectedRevisit(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedRevisit(item);
                      }
                    }}
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

      {selectedRevisit && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] flex items-end justify-center p-3"
          aria-modal="true"
          role="dialog"
        >
          <section
            className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-strong)] p-4 max-h-[88vh] overflow-auto"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--color-text-light)]">
                  Editar revisita
                </p>
                <h2 className="text-xl font-bold text-[var(--color-primary-dark)] truncate mt-1">
                  {selectedRevisit.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleRequestCloseModal}
                className="w-8 h-8 rounded-md bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)] font-bold"
                aria-label="Fechar detalhes"
              >
                ×
              </button>
            </div>

            <div className="flex flex-col gap-3 text-sm text-[var(--color-text)]">
              <div>
                <label htmlFor="edit-name" className="input-label">
                  Nome
                </label>
                <input
                  id="edit-name"
                  className="input-field"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="edit-address" className="input-label">
                  Endereço
                </label>
                <input
                  id="edit-address"
                  className="input-field"
                  value={editAddress}
                  onChange={(event) => setEditAddress(event.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Status da revisita</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      editIsActive
                        ? "border-green-600 bg-green-100 text-green-800"
                        : "border-[var(--color-border)] bg-white text-[var(--color-text-light)]"
                    }`}
                    onClick={() => setEditIsActive(true)}
                  >
                    Ativa
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      !editIsActive
                        ? "border-slate-500 bg-slate-200 text-slate-700"
                        : "border-[var(--color-border)] bg-white text-[var(--color-text-light)]"
                    }`}
                    onClick={() => setEditIsActive(false)}
                  >
                    Inativa
                  </button>
                </div>
              </div>

              <div className="surface-note">
                <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--color-text-light)] mb-2">
                  Registrar nova visita
                </p>
                <div className="flex flex-col gap-2">
                  <div>
                    <label htmlFor="new-visit-date" className="input-label">
                      Data da visita
                    </label>
                    <input
                      id="new-visit-date"
                      type="date"
                      className="input-field"
                      value={newVisitDate}
                      onChange={(event) => setNewVisitDate(event.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="new-visit-summary" className="input-label">
                      O que aconteceu na visita
                    </label>
                    <textarea
                      id="new-visit-summary"
                      className="input-field"
                      rows={3}
                      placeholder="Ex.: retorno agendado para próxima semana"
                      value={newVisitSummary}
                      onChange={(event) => setNewVisitSummary(event.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="surface-note">
                <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--color-text-light)] mb-2">
                  Histórico de visitas
                </p>
                {parseVisitHistory(selectedRevisit).length === 0 ? (
                  <p className="text-xs text-[var(--color-text-light)]">
                    Ainda não há visitas registradas no histórico.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {parseVisitHistory(selectedRevisit).map((item, index) => (
                      <div key={`${item.date}-${index}`} className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2">
                        <p className="text-xs font-semibold text-[var(--color-primary-dark)]">
                          {new Date(`${item.date}T00:00:00`).toLocaleDateString("pt-BR")}
                        </p>
                        <p className="text-xs text-[var(--color-text)] mt-1">
                          {item.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {saveError && (
                <p className="text-sm text-[var(--color-danger)] text-center">
                  {saveError}
                </p>
              )}

              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveRevisit}
                disabled={isSaving}
              >
                {isSaving ? "Salvando..." : "Salvar alterações"}
              </button>

              <button
                type="button"
                className="w-full rounded-[10px] border border-[var(--color-primary)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-primary-dark)]"
                onClick={handleQuickRegisterToday}
                disabled={isSaving}
              >
                {isSaving ? "Registrando..." : "Registrar visita de hoje"}
              </button>
            </div>
          </section>
        </div>
      )}

      {selectedRevisit && showCloseConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center p-4 modal-fade-in">
          <section className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-strong)] p-4 modal-pop-in">
            <div className="mb-3 inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 8V12" />
                <circle cx="12" cy="16" r="0.7" fill="currentColor" stroke="none" />
                <path d="M10.3 3.9L2.7 17.2A1.5 1.5 0 0 0 4 19.5h16a1.5 1.5 0 0 0 1.3-2.3L13.7 3.9a1.5 1.5 0 0 0-2.4 0Z" />
              </svg>
            </div>
            <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--color-text-light)]">
              Confirmar fechamento
            </p>
            <h3 className="text-lg font-bold text-[var(--color-primary-dark)] mt-1">
              Há alterações não salvas
            </h3>
            <p className="text-sm text-[var(--color-text)] mt-2">
              Deseja salvar as alterações antes de fechar esta revisita?
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmSaveAndClose}
                disabled={isSaving}
              >
                {isSaving ? "Salvando..." : "Salvar e fechar"}
              </button>
              <button
                type="button"
                className="w-full rounded-[10px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-text)]"
                onClick={handleDiscardAndClose}
                disabled={isSaving}
              >
                Fechar sem salvar
              </button>
              <button
                type="button"
                className="w-full rounded-[10px] border border-[var(--color-primary)] bg-[var(--color-primary-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-primary-dark)]"
                onClick={handleCancelClose}
                disabled={isSaving}
              >
                Continuar editando
              </button>
            </div>
          </section>
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}
