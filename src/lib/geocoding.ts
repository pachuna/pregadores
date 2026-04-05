import type { LatLng } from "./location";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";

export interface PlaceAutocompleteSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
}

interface PlacesAutocompleteResponse {
  suggestions?: Array<{
    placePrediction: {
      placeId: string;
      text: { text: string };
      structuredFormat: {
        mainText: { text: string };
        secondaryText?: { text: string };
      };
    };
  }>;
}

interface PlaceDetailsResponse {
  location?: {
    latitude: number;
    longitude: number;
  };
}

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

export async function geocodePlaceId(placeId: string): Promise<LatLng | null> {
  if (!MAPS_KEY || !placeId) {
    return null;
  }

  const params = new URLSearchParams({
    place_id: placeId,
    key: MAPS_KEY,
    language: "pt-BR",
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
  );
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

  return { lat: first.lat, lng: first.lng };
}

export async function getPlaceAutocompleteSuggestions(
  input: string,
): Promise<PlaceAutocompleteSuggestion[]> {
  if (!MAPS_KEY || !input.trim()) {
    return [];
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": MAPS_KEY,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify({ input: input.trim(), languageCode: "pt-BR" }),
    },
  );

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as PlacesAutocompleteResponse;
  if (!data.suggestions?.length) {
    return [];
  }

  return data.suggestions.slice(0, 5).map((s) => ({
    placeId: s.placePrediction.placeId,
    mainText: s.placePrediction.structuredFormat.mainText.text,
    secondaryText: s.placePrediction.structuredFormat.secondaryText?.text ?? "",
    description: s.placePrediction.text.text,
  }));
}

export async function getPlaceLocation(placeId: string): Promise<LatLng | null> {
  if (!MAPS_KEY || !placeId) {
    return null;
  }

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": MAPS_KEY,
        "X-Goog-FieldMask": "location",
      },
    },
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as PlaceDetailsResponse;
  if (!data.location) {
    return null;
  }

  return { lat: data.location.latitude, lng: data.location.longitude };
}
