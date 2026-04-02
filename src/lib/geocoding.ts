import type { LatLng } from "./location";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";

interface GeocodeResponse {
  status: string;
  results?: Array<{
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }>;
}

export async function reverseGeocodeCoordinates(coords: LatLng): Promise<string | null> {
  if (!MAPS_KEY) {
    return null;
  }

  const params = new URLSearchParams({
    latlng: `${coords.lat},${coords.lng}`,
    key: MAPS_KEY,
    language: "pt-BR",
  });

  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as GeocodeResponse;
  if (data.status !== "OK" || !data.results?.length) {
    return null;
  }

  return data.results[0]?.formatted_address ?? null;
}

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  if (!MAPS_KEY || !address.trim()) {
    return null;
  }

  const params = new URLSearchParams({
    address,
    key: MAPS_KEY,
    language: "pt-BR",
  });

  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as GeocodeResponse;
  if (data.status !== "OK" || !data.results?.length) {
    return null;
  }

  const first = data.results[0]?.geometry?.location;
  if (!first) {
    return null;
  }

  return {
    lat: first.lat,
    lng: first.lng,
  };
}
