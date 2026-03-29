"use client";

import {
  APIProvider,
  Map,
  Marker,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import { useState } from "react";
import type { Revisit } from "@/lib/types";

interface Props {
  revisits: Revisit[];
  center: { lat: number; lng: number };
  userPos: { lat: number; lng: number } | null;
}

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";

export default function RevisitsMap({ revisits, center, userPos }: Props) {
  const [selected, setSelected] = useState<Revisit | null>(null);
  const [mapsLoadError, setMapsLoadError] = useState(false);

  // If there is no API key or Google Maps failed to load, show fallback list view
  if (!MAPS_KEY || mapsLoadError) {
    return (
      <FallbackView
        revisits={revisits}
        center={center}
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
        defaultZoom={13}
        defaultCenter={center}
        className="w-full h-full"
        gestureHandling="greedy"
      >
        {/* User position marker */}
        {userPos && (
          <Marker position={userPos} title="Você está aqui" />
        )}

        {/* Revisit markers */}
        {revisits.map((r) => (
          <Marker
            key={r.id}
            position={{ lat: r.latitude, lng: r.longitude }}
            title={r.name}
            onClick={() => setSelected(r)}
          />
        ))}

        {/* Info window */}
        {selected && (
          <InfoWindow
            position={{ lat: selected.latitude, lng: selected.longitude }}
            onCloseClick={() => setSelected(null)}
          >
            <div className="p-1">
              <h3 className="font-bold text-sm">{selected.name}</h3>
              <p className="text-xs text-gray-600">{selected.address}</p>
              {selected.notes && (
                <p className="text-xs mt-1 italic">{selected.notes}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {new Date(selected.visitDate).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </InfoWindow>
        )}
      </Map>
    </APIProvider>
  );
}

/** Fallback when no Google Maps API key is configured */
function FallbackView({
  revisits,
  center,
  hasMapsLoadError,
}: {
  revisits: Revisit[];
  center: { lat: number; lng: number };
  hasMapsLoadError: boolean;
}) {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="card mb-4 text-center">
        {hasMapsLoadError ? (
          <p className="text-sm text-[var(--color-text-light)]">
            Nao foi possivel carregar o Google Maps. Verifique se a chave e os
            dominios autorizados estao corretos no Google Cloud.
          </p>
        ) : (
          <p className="text-sm text-[var(--color-text-light)]">
            Configure <code>NEXT_PUBLIC_GOOGLE_MAPS_KEY</code> no{" "}
            <code>.env.local</code> para ver o mapa interativo.
          </p>
        )}
        <p className="text-xs text-[var(--color-text-light)] mt-1">
          Centro atual: {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
        </p>
      </div>

      {revisits.length === 0 ? (
        <p className="text-center text-[var(--color-text-light)]">
          Nenhuma revisita cadastrada.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {revisits.map((r) => (
            <div key={r.id} className="card">
              <h3 className="font-semibold">{r.name}</h3>
              <p className="text-sm text-[var(--color-text-light)]">
                {r.address}
              </p>
              {r.notes && <p className="text-sm italic mt-1">{r.notes}</p>}
              <p className="text-xs text-[var(--color-text-light)] mt-2">
                Visita: {new Date(r.visitDate).toLocaleDateString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
