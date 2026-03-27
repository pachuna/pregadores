"use client";

import {
  APIProvider,
  Map,
  AdvancedMarker,
} from "@vis.gl/react-google-maps";
import { useState } from "react";

interface Props {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";

export default function LocationPickerMap({ lat, lng, onChange }: Props) {
  const [mapsLoadError, setMapsLoadError] = useState(false);

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
        defaultZoom={15}
        defaultCenter={{ lat, lng }}
        mapId="pregadores-picker"
        className="w-full h-full rounded-lg"
        gestureHandling="greedy"
        onClick={(e) => {
          const pos = e.detail?.latLng;
          if (pos) onChange(pos.lat, pos.lng);
        }}
      >
        <AdvancedMarker position={{ lat, lng }} title="Local selecionado" />
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
          <label className="input-label">Latitude</label>
          <input
            type="number"
            step="any"
            className="input-field text-sm"
            value={lat}
            onChange={(e) => onChange(Number(e.target.value), lng)}
          />
        </div>
        <div className="flex-1">
          <label className="input-label">Longitude</label>
          <input
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
