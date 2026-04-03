"use client";

import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import { useState } from "react";

interface Props {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  onAddressResolved?: (address: string) => void;
}

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";

interface GeocodeResponse {
  results?: Array<{ formatted_address?: string }>;
}

interface GoogleMapsGeocoder {
  geocode: (request: { location: { lat: number; lng: number } }) => Promise<GeocodeResponse>;
}

interface GoogleMapsNamespace {
  Geocoder?: new () => GoogleMapsGeocoder;
}

function toCoordinate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "function") {
    try {
      const result = value();
      return typeof result === "number" && Number.isFinite(result)
        ? result
        : null;
    } catch {
      return null;
    }
  }

  return null;
}

async function reverseGeocodeWithMaps(
  lat: number,
  lng: number,
): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const maps = (
    window as Window & { google?: { maps?: GoogleMapsNamespace } }
  ).google?.maps;
  if (!maps?.Geocoder) {
    return null;
  }

  const geocoder = new maps.Geocoder();

  try {
    const result = await geocoder.geocode({ location: { lat, lng } });
    if (!result?.results?.length) {
      return null;
    }

    return result.results[0]?.formatted_address ?? null;
  } catch {
    return null;
  }
}

export default function LocationPickerMap({
  lat,
  lng,
  onChange,
  onAddressResolved,
}: Props) {
  const [mapsLoadError, setMapsLoadError] = useState(false);
  const centerKey = `${lat.toFixed(6)}-${lng.toFixed(6)}`;

  if (!MAPS_KEY || mapsLoadError) {
    return (
      <FallbackPicker
        lat={lat}
        lng={lng}
        onChange={onChange}
        hasMapsLoadError={mapsLoadError}
      />
    );
  }

  return (
    <APIProvider
      apiKey={MAPS_KEY}
      onError={(error) => {
        console.error("Google Maps load error:", error);
        setMapsLoadError(true);
      }}
    >
      <Map
        key={centerKey}
        defaultZoom={15}
        defaultCenter={{ lat, lng }}
        className="w-full h-full rounded-lg"
        gestureHandling="greedy"
        onClick={(e) => {
          const pos = e.detail?.latLng;
          if (!pos) {
            return;
          }

          const nextLat = toCoordinate((pos as { lat?: unknown }).lat);
          const nextLng = toCoordinate((pos as { lng?: unknown }).lng);

          if (nextLat == null || nextLng == null) {
            return;
          }

          onChange(nextLat, nextLng);

          if (onAddressResolved) {
            reverseGeocodeWithMaps(nextLat, nextLng).then((resolvedAddress) => {
              if (resolvedAddress) {
                onAddressResolved(resolvedAddress);
              }
            });
          }
        }}
      >
        <Marker position={{ lat, lng }} title="Local selecionado" />
      </Map>
    </APIProvider>
  );
}

function FallbackPicker({
  lat,
  lng,
  onChange,
  hasMapsLoadError,
}: Props & { hasMapsLoadError: boolean }) {
  return (
    <div className="w-full h-full rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-col items-center justify-center gap-3 p-4">
      {hasMapsLoadError ? (
        <p className="text-sm text-[var(--color-text-light)] text-center">
          Falha ao carregar Google Maps. Revise chave e dominios autorizados no
          Google Cloud.
        </p>
      ) : (
        <p className="text-sm text-[var(--color-text-light)] text-center">
          Configure <code>NEXT_PUBLIC_GOOGLE_MAPS_KEY</code> para selecionar no
          mapa.
        </p>
      )}
      <div className="flex gap-2 w-full max-w-xs">
        <div className="flex-1">
          <label htmlFor="latitude" className="input-label">
            Latitude
          </label>
          <input
            id="latitude"
            type="number"
            step="any"
            className="input-field text-sm"
            value={lat}
            onChange={(e) => onChange(Number(e.target.value), lng)}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="longitude" className="input-label">
            Longitude
          </label>
          <input
            id="longitude"
            type="number"
            step="any"
            className="input-field text-sm"
            value={lng}
            onChange={(e) => onChange(lat, Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
