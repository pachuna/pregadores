"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { revisitsApi } from "@/lib/api";
import AuthGuard from "@/components/AuthGuard";
import LocationPickerMap from "@/components/LocationPickerMap";
import MobileBottomNav from "@/components/MobileBottomNav";
import { geocodeAddress, reverseGeocodeCoordinates } from "@/lib/geocoding";
import {
  getLastKnownLocation,
  LOCATION_CACHE_MAX_AGE_MS,
  resolveUserLocation,
} from "@/lib/location";

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
  const [isActive, setIsActive] = useState(true);
  const [lat, setLat] = useState(-23.5505);
  const [lng, setLng] = useState(-46.6333);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const skipNextReverseRef = useRef(false);
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        isActive,
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

  useEffect(() => {
    let active = true;

    const cached = getLastKnownLocation();
    if (cached) {
      setLat(cached.lat);
      setLng(cached.lng);
    }

    resolveUserLocation({
      maxAgeMs: LOCATION_CACHE_MAX_AGE_MS,
      timeoutMs: 9000,
      enableHighAccuracy: false,
    }).then((position) => {
      if (!active || !position) {
        return;
      }

      setLat(position.lat);
      setLng(position.lng);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (skipNextReverseRef.current) {
      skipNextReverseRef.current = false;
      return;
    }

    reverseGeocodeCoordinates({ lat, lng })
      .then((resolvedAddress) => {
        if (!active || !resolvedAddress) {
          return;
        }

        setAddress(resolvedAddress);
      })
      .catch(() => {
        // Keep manual address when reverse geocoding fails.
      });

    return () => {
      active = false;
    };
  }, [lat, lng]);

  useEffect(() => {
    return () => {
      if (addressDebounceRef.current) {
        clearTimeout(addressDebounceRef.current);
      }
    };
  }, []);

  const handleAddressChange = (value: string) => {
    setAddress(value);

    if (addressDebounceRef.current) {
      clearTimeout(addressDebounceRef.current);
    }

    if (!value.trim() || value.trim().length < 5) {
      return;
    }

    addressDebounceRef.current = setTimeout(() => {
      geocodeAddress(value.trim())
        .then((coords) => {
          if (!coords) {
            return;
          }

          skipNextReverseRef.current = true;
          setLat(coords.lat);
          setLng(coords.lng);
        })
        .catch(() => {
          // Keep typed address when geocoding fails.
        });
    }, 700);
  };

  const handleMapPointChange = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);

    reverseGeocodeCoordinates({ lat: newLat, lng: newLng })
      .then((resolvedAddress) => {
        if (!resolvedAddress) {
          return;
        }
        setAddress(resolvedAddress);
      })
      .catch(() => {
        // Keep current address when reverse geocoding fails.
      });
  };

  return (
    <div className="mobile-page min-h-screen flex flex-col">
      {/* Header */}
      <header className="mobile-header">
        <button
          type="button"
          aria-label="Voltar"
          title="Voltar"
          className="mobile-back-btn"
          onClick={() => router.back()}
        >
          ←
        </button>
        <div>
          <p className="mobile-header__meta">
            Cadastro
          </p>
          <h1 className="mobile-header__title">Nova Revisita</h1>
        </div>
      </header>

      <div className="mobile-content flex-1 overflow-auto p-4">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex flex-col gap-4">
          {/* Map */}
          <div className="card p-0 overflow-hidden" style={{ height: 320 }}>
            <LocationPickerMap
              lat={lat}
              lng={lng}
              onChange={handleMapPointChange}
              onAddressResolved={(resolvedAddress) => {
                setAddress(resolvedAddress);
              }}
            />
          </div>

          <div className="surface-note text-center">
            <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--color-text-light)]">
              Coordenadas atuais
            </p>
            <p className="text-xs text-[var(--color-text)] mt-1">
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </p>
            <p className="text-[11px] text-[var(--color-text-light)] mt-1">
              Toque no mapa para ajustar o ponto.
            </p>
          </div>

          {/* Fields */}
          <div className="card flex flex-col gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-light)] font-semibold">
                Dados da visita
              </p>
              <h2 className="text-xl font-bold text-[var(--color-primary-dark)] mt-1">
                Informacoes da revisita
              </h2>
            </div>

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
                onChange={(e) => handleAddressChange(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="input-label">Status da revisita</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? "border-green-600 bg-green-100 text-green-800"
                      : "border-[var(--color-border)] bg-white text-[var(--color-text-light)]"
                  }`}
                  onClick={() => setIsActive(true)}
                >
                  Ativa
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    !isActive
                      ? "border-slate-500 bg-slate-200 text-slate-700"
                      : "border-[var(--color-border)] bg-white text-[var(--color-text-light)]"
                  }`}
                  onClick={() => setIsActive(false)}
                >
                  Inativa
                </button>
              </div>
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
