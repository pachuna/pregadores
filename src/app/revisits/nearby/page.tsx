"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { revisitsApi } from "@/lib/api";
import AuthGuard from "@/components/AuthGuard";
import MobileBottomNav from "@/components/MobileBottomNav";
import type { Revisit } from "@/lib/types";

export default function NearbyRevisitsPage() {
  return (
    <AuthGuard>
      <NearbyContent />
    </AuthGuard>
  );
}

function NearbyContent() {
  const router = useRouter();
  const [items, setItems] = useState<Revisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      const { data } = await revisitsApi.nearby(
        pos.coords.latitude,
        pos.coords.longitude,
        15,
      );
      const sorted = (Array.isArray(data) ? data : []).sort(
        (a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999),
      );
      setItems(sorted);
    } catch {
      setError("Não foi possível obter localização ou buscar revisitas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mobile-page min-h-screen flex flex-col">
      {/* Header */}
      <header
        className="sticky top-0 flex items-center px-4 py-3 shadow-md z-10"
        style={{ background: "var(--color-primary)" }}
      >
        <button
          type="button"
          aria-label="Voltar"
          title="Voltar"
          className="text-white text-2xl mr-3 leading-none"
          onClick={() => router.back()}
        >
          ←
        </button>
        <h1 className="text-white text-lg font-bold">Revisitas Próximas</h1>
      </header>

      <div className="mobile-content flex-1 overflow-auto p-4">
        {loading && (
          <p className="text-center text-[var(--color-text-light)] py-8 card">
            Buscando revisitas próximas...
          </p>
        )}

        {error && (
          <div className="card text-center">
            <p className="text-[var(--color-danger)]">{error}</p>
            <button className="btn-primary mt-4 max-w-xs mx-auto" onClick={load}>
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="text-center text-[var(--color-text-light)] py-8 card">
            Nenhuma revisita encontrada no raio de 15 km.
          </p>
        )}

        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          {items.map((r) => (
            <div key={r.id} className="card flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{r.name}</h3>
                <p className="text-sm text-[var(--color-text-light)] truncate">
                  {r.address}
                </p>
                <p className="text-xs text-[var(--color-text-light)] mt-1">
                  Última visita:{" "}
                  {new Date(r.visitDate).toLocaleDateString("pt-BR")}
                </p>
              </div>
              {r.distanceKm != null && (
                <span
                  className="shrink-0 text-xs font-bold px-2 py-1 rounded-full text-white"
                  style={{ background: "var(--color-accent)" }}
                >
                  {r.distanceKm < 1
                    ? `${(r.distanceKm * 1000).toFixed(0)} m`
                    : `${r.distanceKm.toFixed(1)} km`}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}
