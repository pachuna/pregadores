"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
// import Image from "next/image";
import AuthGuard from "@/components/AuthGuard";
import MobileBottomNav from "@/components/MobileBottomNav";
import EditTerritoryModal from "@/components/EditTerritoryModal";
import { useAuthStore } from "@/store/authStore";
import { territoriesApi, type TerritoryDetail, type TerritoryHouse } from "@/lib/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "OK" | "FAIL" | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
        style={{ background: "rgba(255,255,255,0.06)", color: "var(--color-text-light)" }}>
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
        Sem visita
      </span>
    );
  }
  if (status === "OK") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
        style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"
          className="w-3 h-3" aria-hidden="true">
          <path d="M3 8l3.5 3.5L13 4.5" />
        </svg>
        Atendeu
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"
        className="w-3 h-3" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
      Não bater
    </span>
  );
}

// ── Visit Modal (bottom sheet) ────────────────────────────────────────────────

function VisitModal({
  house,
  onClose,
  onConfirm,
  loading,
}: {
  house: TerritoryHouse;
  onClose: () => void;
  onConfirm: (status: "OK" | "FAIL") => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="rounded-t-3xl px-5 pt-5 pb-8 flex flex-col gap-4"
        style={{ background: "var(--color-surface-elevated)", borderTop: "1px solid var(--color-border)" }}>
        {/* Handle */}
        <div className="w-10 h-1 rounded-full mx-auto mb-1"
          style={{ background: "var(--color-border)" }} />

        <div>
          <p className="text-xs text-[var(--color-text-light)] uppercase tracking-wide mb-0.5">Casa</p>
          <p className="text-lg font-bold text-[var(--color-text)]">{house.number}</p>
          {house.observation && (
            <p className="text-xs text-[var(--color-text-light)] mt-0.5">{house.observation}</p>
          )}
        </div>

        {/* Última visita */}
        {house.lastVisit && (
          <div className="rounded-xl px-3 py-2 flex items-center gap-2"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--color-border)" }}>
            <StatusBadge status={house.lastVisit.status} />
            <span className="text-xs text-[var(--color-text-light)]">
              em {formatDateTime(house.lastVisit.visitedAt)}
            </span>
          </div>
        )}

        <p className="text-sm text-[var(--color-text-light)]">Como foi a visita?</p>

        {/* Opções */}
        <button
          type="button"
          disabled={loading}
          onClick={() => onConfirm("OK")}
          className="w-full flex items-center gap-3 rounded-2xl px-4 py-4 text-left transition-opacity disabled:opacity-50"
          style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(34,197,94,0.2)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5"
              className="w-5 h-5" aria-hidden="true">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: "#4ade80" }}>Morador Atendeu</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(74,222,128,0.7)" }}>Conversa realizada com sucesso</p>
          </div>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => onConfirm("FAIL")}
          className="w-full flex items-center gap-3 rounded-2xl px-4 py-4 text-left transition-opacity disabled:opacity-50"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(239,68,68,0.18)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5"
              className="w-5 h-5" aria-hidden="true">
              <path d="M18.364 5.636l-12.728 12.728M5.636 5.636l12.728 12.728" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: "#f87171" }}>Pediu para Não Bater</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(248,113,113,0.7)" }}>Morador não quer ser visitado</p>
          </div>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-2xl text-sm font-medium"
          style={{ background: "var(--color-surface-card)", color: "var(--color-text-light)" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Street Accordion ──────────────────────────────────────────────────────────

function StreetAccordion({
  street,
  territoryId,
  onMarkVisit,
}: {
  street: TerritoryDetail["streets"][0];
  territoryId: string;
  onMarkVisit: (house: TerritoryHouse) => void;
}) {
  const [open, setOpen] = useState(false);

  const visitedCount = street.houses.filter((h) => h.lastVisit !== null).length;
  const okCount = street.houses.filter((h) => h.lastVisit?.status === "OK").length;
  const failCount = street.houses.filter((h) => h.lastVisit?.status === "FAIL").length;

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid var(--color-border)", background: "var(--color-surface-card)" }}>
      {/* Street header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 gap-2 transition-colors"
        style={{ background: open ? "rgba(37,99,255,0.08)" : "transparent" }}>

        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--color-primary-soft)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"
              className="w-4 h-4" aria-hidden="true">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text)] truncate">{street.name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-[var(--color-text-light)]">
                {street.houses.length} casas
              </span>
              {visitedCount > 0 && (
                <>
                  {okCount > 0 && (
                    <span className="text-xs font-medium" style={{ color: "#4ade80" }}>
                      {okCount} atenderam
                    </span>
                  )}
                  {failCount > 0 && (
                    <span className="text-xs font-medium" style={{ color: "#f87171" }}>
                      {failCount} não bater
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="w-4 h-4 shrink-0 transition-transform"
          style={{
            color: "var(--color-text-light)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
          aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Houses list */}
      {open && (
        <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
          {street.houses.length === 0 ? (
            <p className="text-sm text-[var(--color-text-light)] text-center py-4">
              Nenhuma casa cadastrada.
            </p>
          ) : (
            street.houses.map((house) => (
              <button
                key={house.id}
                type="button"
                onClick={() => onMarkVisit(house)}
                className="w-full flex items-center justify-between px-4 py-3 gap-3 text-left transition-colors hover:bg-white/5 active:bg-white/10">

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">
                    {house.number}
                  </p>
                  {house.observation && (
                    <p className="text-xs text-[var(--color-text-light)] truncate mt-0.5">
                      {house.observation}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <StatusBadge status={house.lastVisit?.status ?? null} />
                  {house.lastVisit && (
                    <span className="text-xs" style={{ color: "var(--color-text-light)" }}>
                      {formatDate(house.lastVisit.visitedAt)}
                    </span>
                  )}
                </div>

                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className="w-4 h-4 shrink-0" style={{ color: "var(--color-text-light)" }}
                  aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function TerritoryDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const canEdit = role === "ADMIN" || role === "ANCIAO" || role === "SERVO_DE_CAMPO";

  const [territory, setTerritory] = useState<TerritoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState<TerritoryHouse | null>(null);
  const [visitLoading, setVisitLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await territoriesApi.getById(id);
      setTerritory(data);
    } catch {
      setTerritory(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function showToast(msg: string, ok: boolean) {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ msg, ok });
    toastRef.current = setTimeout(() => setToast(null), 3000);
  }

  async function handleConfirmVisit(status: "OK" | "FAIL") {
    if (!selectedHouse || !territory) return;
    setVisitLoading(true);
    try {
      const { data: visit } = await territoriesApi.markVisit(territory.id, selectedHouse.id, status);
      // Atualiza localmente sem recarregar tudo
      setTerritory((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          streets: prev.streets.map((street) => ({
            ...street,
            houses: street.houses.map((house) =>
              house.id === selectedHouse.id
                ? { ...house, lastVisit: visit }
                : house
            ),
          })),
        };
      });
      setSelectedHouse(null);
      showToast(
        status === "OK" ? "Visita registrada como Atendeu!" : "Marcado: Não bater.",
        true
      );
    } catch {
      showToast("Erro ao registrar visita.", false);
    } finally {
      setVisitLoading(false);
    }
  }

  // Estatísticas gerais
  const totalHouses = territory?.streets.reduce((a, s) => a + s.houses.length, 0) ?? 0;
  const okCount = territory?.streets.reduce(
    (a, s) => a + s.houses.filter((h) => h.lastVisit?.status === "OK").length, 0
  ) ?? 0;
  const failCount = territory?.streets.reduce(
    (a, s) => a + s.houses.filter((h) => h.lastVisit?.status === "FAIL").length, 0
  ) ?? 0;
  const noVisit = totalHouses - okCount - failCount;

  if (loading) {
    return (
      <div className="mobile-page flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!territory) {
    return (
      <div className="mobile-page flex flex-col items-center justify-center min-h-screen gap-4 px-6">
        <p className="text-[var(--color-text-light)]">Território não encontrado.</p>
        <button type="button" onClick={() => router.back()} className="btn-primary">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="mobile-page min-h-screen pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 pt-safe py-3"
        style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
        <button
          type="button"
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-border)" }}
          aria-label="Voltar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="w-4 h-4 text-[var(--color-text)]" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--color-text-light)] uppercase tracking-wide">Território</p>
          <h1 className="text-lg font-bold text-[var(--color-text)] leading-tight">
            {territory.label ?? `Nº ${territory.number}`}
          </h1>
        </div>
        {territory.lastUpdate && (
          <span className="text-xs text-[var(--color-text-light)] shrink-0">
            Atualizado {formatDate(territory.lastUpdate)}
          </span>
        )}
        {canEdit && territory.territoryType === "STREETS" && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-border)" }}
            aria-label="Editar território"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="w-4 h-4 text-[var(--color-text)]" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
      </div>

      {/* Imagem do território */}
      {territory.imageUrl && (
        <div className="relative w-full" style={{ aspectRatio: "16/9", background: "var(--color-surface-card)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={territory.imageUrl}
            alt={`Mapa do Território ${territory.label ?? territory.number}`}
            className="w-full h-full object-contain"
          />
        </div>
      )}

      {/* Estatísticas */}
      <div className="px-4 py-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl px-3 py-2 text-center"
          style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <p className="text-xl font-bold" style={{ color: "#4ade80" }}>{okCount}</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(74,222,128,0.8)" }}>Atenderam</p>
        </div>
        <div className="rounded-xl px-3 py-2 text-center"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <p className="text-xl font-bold" style={{ color: "#f87171" }}>{failCount}</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(248,113,113,0.8)" }}>Não bater</p>
        </div>
        <div className="rounded-xl px-3 py-2 text-center"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--color-border)" }}>
          <p className="text-xl font-bold text-[var(--color-text-light)]">{noVisit}</p>
          <p className="text-xs text-[var(--color-text-light)] mt-0.5">Sem visita</p>
        </div>
      </div>

      {/* Progresso */}
      {totalHouses > 0 && (
        <div className="px-4 pb-4">
          <div className="flex justify-between text-xs text-[var(--color-text-light)] mb-1.5">
            <span>Progresso</span>
            <span>{Math.round(((okCount + failCount) / totalHouses) * 100)}% visitado</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.07)" }}>
            <div className="flex h-full">
              <div className="transition-all" style={{ width: `${(okCount / totalHouses) * 100}%`, background: "#4ade80" }} />
              <div className="transition-all" style={{ width: `${(failCount / totalHouses) * 100}%`, background: "#f87171" }} />
            </div>
          </div>
        </div>
      )}

      {/* Ruas */}
      <div className="px-4 pb-4">
        <h2 className="text-sm font-semibold text-[var(--color-text-light)] uppercase tracking-wide mb-3">
          Ruas — {territory.streets.length} total
        </h2>
        <div className="flex flex-col gap-2">
          {territory.streets.map((street) => (
            <StreetAccordion
              key={street.id}
              street={street}
              territoryId={territory.id}
              onMarkVisit={setSelectedHouse}
            />
          ))}
        </div>
      </div>

      {/* Modal de edição */}
      {editOpen && territory && (
        <EditTerritoryModal
          territoryId={territory.id}
          initialStreets={territory.streets.map((s) => ({ id: s.id, name: s.name }))}
          onClose={() => setEditOpen(false)}
          onUpdated={load}
        />
      )}

      {/* Modal de visita */}
      {selectedHouse && (
        <VisitModal
          house={selectedHouse}
          onClose={() => setSelectedHouse(null)}
          onConfirm={handleConfirmVisit}
          loading={visitLoading}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-28 left-4 right-4 z-50 rounded-2xl px-4 py-3 text-sm font-medium text-center shadow-lg transition-all"
          style={{
            background: toast.ok ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)",
            color: "#fff",
          }}>
          {toast.msg}
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}

export default function TerritoryDetailPage() {
  return (
    <AuthGuard>
      <TerritoryDetailContent />
    </AuthGuard>
  );
}
