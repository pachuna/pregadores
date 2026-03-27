"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { revisitsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import AuthGuard from "@/components/AuthGuard";
import RevisitsMap from "@/components/RevisitsMap";
import type { Revisit } from "@/lib/types";

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
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

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
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserPos({ lat: -23.5505, lng: -46.6333 }), // fallback SP
      );
    }
    loadRevisits();
  }, [loadRevisits]);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 shadow-md z-10"
        style={{ background: "var(--color-primary)" }}
      >
        <h1 className="text-white text-lg font-bold">
          Pregadores{" "}
          <span className="text-white/70 font-normal text-sm">
            ({revisits.length} revisitas)
          </span>
        </h1>
        <button className="btn-danger text-sm" onClick={handleLogout}>
          Sair
        </button>
      </header>

      {/* Map */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[var(--color-text-light)]">
              Carregando mapa...
            </p>
          </div>
        ) : (
          <RevisitsMap
            revisits={revisits}
            center={userPos || { lat: -23.5505, lng: -46.6333 }}
            userPos={userPos}
          />
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="flex gap-3 p-4 bg-white border-t border-[var(--color-border)]">
        <button
          className="btn-primary flex-1"
          onClick={() => router.push("/revisits/nearby")}
        >
          📍 Próximas
        </button>
        <button
          className="btn-primary flex-1"
          style={{ background: "var(--color-accent)" }}
          onClick={() => router.push("/revisits/new")}
        >
          + Revisita
        </button>
      </div>
    </div>
  );
}
