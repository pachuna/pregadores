export interface LatLng {
  lat: number;
  lng: number;
}

interface CachedLocation {
  lat: number;
  lng: number;
  timestamp: number;
}

const LOCATION_CACHE_KEY = "pregadores-user-location";
export const LOCATION_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

function isBrowser() {
  return typeof window !== "undefined";
}

export function getCachedLocation(): CachedLocation | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LOCATION_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachedLocation;
    if (
      typeof parsed?.lat !== "number" ||
      typeof parsed?.lng !== "number" ||
      typeof parsed?.timestamp !== "number"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function setCachedLocation(position: LatLng) {
  if (!isBrowser()) {
    return;
  }

  try {
    const payload: CachedLocation = {
      ...position,
      timestamp: Date.now(),
    };
    window.localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures (private mode, quota, etc).
  }
}

export function getFreshCachedLocation(maxAgeMs = LOCATION_CACHE_MAX_AGE_MS): LatLng | null {
  const cached = getCachedLocation();
  if (!cached) {
    return null;
  }

  const ageMs = Date.now() - cached.timestamp;
  if (ageMs > maxAgeMs) {
    return null;
  }

  return { lat: cached.lat, lng: cached.lng };
}

export function getLastKnownLocation(): LatLng | null {
  const cached = getCachedLocation();
  if (!cached) {
    return null;
  }

  return { lat: cached.lat, lng: cached.lng };
}

export async function resolveUserLocation(options?: {
  maxAgeMs?: number;
  timeoutMs?: number;
  enableHighAccuracy?: boolean;
}): Promise<LatLng | null> {
  const maxAgeMs = options?.maxAgeMs ?? LOCATION_CACHE_MAX_AGE_MS;
  const timeoutMs = options?.timeoutMs ?? 9000;
  const enableHighAccuracy = options?.enableHighAccuracy ?? false;

  const fresh = getFreshCachedLocation(maxAgeMs);
  if (fresh) {
    return fresh;
  }

  const fallback = getLastKnownLocation();

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return fallback;
  }

  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy,
        timeout: timeoutMs,
        maximumAge: 0,
      });
    });

    const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    setCachedLocation(next);
    return next;
  } catch {
    return fallback;
  }
}
