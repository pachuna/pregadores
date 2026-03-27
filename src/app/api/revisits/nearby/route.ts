import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth-middleware";

/**
 * Calcula distância em km entre dois pontos usando fórmula de Haversine.
 */
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;
  const userId = auth;

  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get("latitude");
  const lngStr = searchParams.get("longitude");
  const radiusStr = searchParams.get("radiusKm");

  if (!latStr || !lngStr) {
    return NextResponse.json(
      { error: "Parâmetros latitude e longitude são obrigatórios" },
      { status: 400 }
    );
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  const radiusKm = radiusStr ? parseFloat(radiusStr) : 15;

  if (isNaN(lat) || isNaN(lng) || isNaN(radiusKm)) {
    return NextResponse.json(
      { error: "Parâmetros devem ser números válidos" },
      { status: 400 }
    );
  }

  const allRevisits: Array<{
    id: string;
    latitude: number;
    longitude: number;
    [key: string]: unknown;
  }> = await prisma.revisit.findMany({
    where: { userId },
  });

  const nearby = allRevisits
    .map((r) => ({
      ...r,
      distanceKm: Math.round(haversineKm(lat, lng, r.latitude, r.longitude) * 100) / 100,
    }))
    .filter((r) => r.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return NextResponse.json(nearby);
}
