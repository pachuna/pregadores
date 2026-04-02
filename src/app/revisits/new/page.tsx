"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { revisitsApi } from "@/lib/api";
import AuthGuard from "@/components/AuthGuard";
import LocationPickerMap from "@/components/LocationPickerMap";
import MobileBottomNav from "@/components/MobileBottomNav";

export default function NewRevisitPage() {
  return (
    <AuthGuard>
      <NewRevisitContent />
    </AuthGuard>
  );
}

function NewRevisitContent() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [lat, setLat] = useState(-23.5505);
  const [lng, setLng] = useState(-46.6333);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      setError("Nome e endereço são obrigatórios.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await revisitsApi.create({
        name: name.trim(),
        address: address.trim(),
        latitude: lat,
        longitude: lng,
        notes: notes.trim() || undefined,
        visitDate: new Date().toISOString(),
      });
      router.push("/home");
    } catch {
      setError("Falha ao salvar revisita.");
    } finally {
      setLoading(false);
    }
  };

  // Try to get user location on mount
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
      },
      () => {
        // Keep default Sao Paulo coordinates when location is denied/unavailable.
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }, []);

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
        <h1 className="text-white text-lg font-bold">Nova Revisita</h1>
      </header>

      <div className="mobile-content flex-1 overflow-auto p-4">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex flex-col gap-4">
          {/* Map */}
          <div className="card p-0 overflow-hidden" style={{ height: 300 }}>
            <LocationPickerMap
              lat={lat}
              lng={lng}
              onChange={(newLat, newLng) => {
                setLat(newLat);
                setLng(newLng);
              }}
            />
          </div>

          <p className="text-xs text-center text-[var(--color-text-light)]">
            📍 {lat.toFixed(6)}, {lng.toFixed(6)} — Toque no mapa para ajustar
          </p>

          {/* Fields */}
          <div className="card flex flex-col gap-4">
            <div>
              <label htmlFor="revisit-name" className="input-label">
                Nome *
              </label>
              <input
                id="revisit-name"
                className="input-field"
                placeholder="Nome da pessoa"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="revisit-address" className="input-label">
                Endereço *
              </label>
              <input
                id="revisit-address"
                className="input-field"
                placeholder="Rua, número, bairro"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="revisit-notes" className="input-label">
                O que foi falado
              </label>
              <textarea
                id="revisit-notes"
                className="input-field"
                placeholder="Anotações sobre a visita..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                style={{ resize: "vertical" }}
              />
            </div>

            {error && (
              <p className="text-sm text-[var(--color-danger)] text-center">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Revisita"}
            </button>
          </div>
        </form>
      </div>

      <MobileBottomNav />
    </div>
  );
}
