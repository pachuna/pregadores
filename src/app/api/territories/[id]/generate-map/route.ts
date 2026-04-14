import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { requireTerritoryManager } from "@/lib/auth-middleware";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
const TILE_SIZE = 256;
const OUTPUT_W = 800;
const OUTPUT_H = 600;

// ── Tile math ────────────────────────────────────────────────────────────────

function lngToTileF(lng: number, z: number): number {
  return ((lng + 180) / 360) * Math.pow(2, z);
}

function latToTileF(lat: number, z: number): number {
  const latRad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    Math.pow(2, z)
  );
}

async function downloadOsmTile(x: number, y: number, z: number): Promise<Buffer | null> {
  const maxTile = Math.pow(2, z) - 1;
  if (x < 0 || y < 0 || x > maxTile || y > maxTile) return null;
  const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Pregadores-App/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// ── Geocoding helpers ────────────────────────────────────────────────────────

async function geocodeGoogle(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  if (!MAPS_KEY) return null;
  const params = new URLSearchParams({ address, key: MAPS_KEY, language: "pt-BR", region: "br" });
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: string;
      results?: Array<{ geometry: { location: { lat: number; lng: number } } }>;
    };
    if (data.status !== "OK" || !data.results?.length) return null;
    const loc = data.results[0]?.geometry?.location;
    return loc ?? null;
  } catch {
    return null;
  }
}

async function geocodeNominatim(
  q: string
): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({ q, format: "json", limit: "1", countrycodes: "br" });
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      { headers: { "User-Agent": "Pregadores-App/1.0" }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

/** Geocodifica uma rua: Google primeiro (paralelo), Nominatim como fallback */
async function geocodeStreet(
  name: string, city: string, state: string
): Promise<{ lat: number; lng: number } | null> {
  let c = await geocodeGoogle(`${name}, ${city} - ${state}, Brasil`);
  if (!c) c = await geocodeNominatim(`${name}, ${city}, ${state}, Brasil`);
  return c;
}

// ── (overpassKeyword e normStr removidos — agora usa Nominatim) ──────────────

// ── Interseção geométrica entre segmentos ────────────────────────────────────

function segmentIntersect(
  a1: { lat: number; lon: number }, a2: { lat: number; lon: number },
  b1: { lat: number; lon: number }, b2: { lat: number; lon: number }
): { lat: number; lng: number } | null {
  const ax = a2.lon - a1.lon, ay = a2.lat - a1.lat;
  const bx = b2.lon - b1.lon, by = b2.lat - b1.lat;
  const d = ax * by - ay * bx;
  if (Math.abs(d) < 1e-12) return null;
  const cx = b1.lon - a1.lon, cy = b1.lat - a1.lat;
  const t = (cx * by - cy * bx) / d;
  const u = (cx * ay - cy * ax) / d;
  if (t < -0.01 || t > 1.01 || u < -0.01 || u > 1.01) return null;
  return { lat: a1.lat + t * ay, lng: a1.lon + t * ax };
}

function polylineIntersections(
  p1: Array<{ lat: number; lon: number }>,
  p2: Array<{ lat: number; lon: number }>
): Array<{ lat: number; lng: number }> {
  const out: Array<{ lat: number; lng: number }> = [];
  for (let i = 0; i + 1 < p1.length; i++)
    for (let j = 0; j + 1 < p2.length; j++) {
      const pt = segmentIntersect(p1[i], p1[i + 1], p2[j], p2[j + 1]);
      if (pt) out.push(pt);
    }
  return out;
}

function dedupePoints(pts: Array<{ lat: number; lng: number }>, eps = 0.0003): Array<{ lat: number; lng: number }> {
  const out: Array<{ lat: number; lng: number }> = [];
  for (const p of pts)
    if (!out.some((q) => Math.abs(q.lat - p.lat) < eps && Math.abs(q.lng - p.lng) < eps))
      out.push(p);
  return out;
}

// ── Encontra os cantos do quarteirão ─────────────────────────────────────────
//
// Estratégia:
//
// 1. Geocodifica cada rua individualmente → centroide bruto do quarteirão.
// 2. Busca geometria de cada rua no Nominatim (polygon_geojson=1) — SEQUENCIAL, 1.1s entre requests.
// 3. Calcula interseções geometricamente + detecção por proximidade.
// 4. Combina, deduplica e filtra outliers por distância ao centroide.

type Coord = { lat: number; lon: number };

/** Encontra o par de pontos mais próximos entre duas polilínias */
function closestApproach(
  p1: Coord[], p2: Coord[]
): { dist: number; point: { lat: number; lng: number } } | null {
  let best: { dist: number; point: { lat: number; lng: number } } | null = null;
  for (const a of p1)
    for (const b of p2) {
      const d = Math.hypot(a.lat - b.lat, a.lon - b.lon);
      if (!best || d < best.dist)
        best = { dist: d, point: { lat: (a.lat + b.lat) / 2, lng: (a.lon + b.lon) / 2 } };
    }
  return best;
}

/** Busca geometria de UMA rua no Nominatim com polygon_geojson=1 */
async function fetchStreetGeomNominatim(
  streetName: string,
  city: string,
  state: string,
  centLat: number,
  centLng: number
): Promise<Coord[][]> {
  const q = `${streetName}, ${city}, ${state}`;
  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "10",
    countrycodes: "br",
    polygon_geojson: "1",
  });
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: { "User-Agent": "Pregadores-App/1.0" },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) {
      console.error(`[generate-map] Nominatim HTTP ${res.status} para "${streetName}"`);
      return [];
    }
    const data = (await res.json()) as Array<{
      geojson?: {
        type: string;
        coordinates: number[][] | number[][][] | number[][][][];
      };
    }>;

    const geoms: Coord[][] = [];
    for (const item of data) {
      const gj = item.geojson;
      if (!gj) continue;

      let coordArrays: number[][][] = [];
      if (gj.type === "LineString") coordArrays = [gj.coordinates as number[][]];
      else if (gj.type === "MultiLineString") coordArrays = gj.coordinates as number[][][];
      else if (gj.type === "Polygon") coordArrays = gj.coordinates as number[][][];
      else if (gj.type === "Point") continue;

      for (const coords of coordArrays) {
        const pts: Coord[] = (coords as number[][]).map((c) => ({ lat: c[1], lon: c[0] }));
        // Filtra só segmentos com algum ponto a < 600m (~0.006°) do centroide
        const nearCentroid = pts.some(
          (p) => Math.abs(p.lat - centLat) < 0.006 && Math.abs(p.lon - centLng) < 0.006
        );
        if (nearCentroid) geoms.push(pts);
      }
    }
    return geoms;
  } catch (err) {
    console.error(`[generate-map] Nominatim erro para "${streetName}":`, err);
    return [];
  }
}

async function getBlockCorners(
  streetNames: string[],
  city: string,
  state: string
): Promise<Array<{ lat: number; lng: number }>> {
  if (streetNames.length < 2) return [];

  // ── Passo 1: geocodifica cada rua → centroide do quarteirão ─────────────
  console.log("[generate-map] Geocodificando ruas:", streetNames);
  const roughCoords = await Promise.all(
    streetNames.map((name) => geocodeStreet(name, city, state))
  );
  const validCoords = roughCoords.filter((c): c is { lat: number; lng: number } => c !== null);
  console.log("[generate-map] Ruas geocodificadas:", validCoords.length, "de", streetNames.length);

  if (validCoords.length < 2) return [];

  const centLat = validCoords.reduce((s, c) => s + c.lat, 0) / validCoords.length;
  const centLng = validCoords.reduce((s, c) => s + c.lng, 0) / validCoords.length;
  console.log("[generate-map] Centroide bruto:", centLat.toFixed(6), centLng.toFixed(6));

  // ── Passo 2: busca geometria de CADA rua no Nominatim (sequencial, 1.1s entre requests) ─
  const streetPolylines = new Map<string, Coord[][]>();
  for (let i = 0; i < streetNames.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1100)); // Nominatim rate limit: 1 req/s
    const geoms = await fetchStreetGeomNominatim(streetNames[i], city, state, centLat, centLng);
    if (geoms.length > 0) {
      streetPolylines.set(streetNames[i], geoms);
    }
    console.log(`[generate-map]   ${streetNames[i]}: ${geoms.length} polilínias`);
  }
  console.log("[generate-map] Ruas com geometria:", streetPolylines.size, "de", streetNames.length);

  // ── Passo 3: calcula interseções geométricas entre todos os pares ───────
  const allCorners: Array<{ lat: number; lng: number }> = [];

  for (let i = 0; i < streetNames.length; i++) {
    for (let j = i + 1; j < streetNames.length; j++) {
      const pi = streetPolylines.get(streetNames[i]) ?? [];
      const pj = streetPolylines.get(streetNames[j]) ?? [];
      if (!pi.length || !pj.length) continue;

      // Interseções geométricas
      let foundIntersection = false;
      for (const segI of pi)
        for (const segJ of pj) {
          const pts = polylineIntersections(segI, segJ);
          if (pts.length > 0) {
            foundIntersection = true;
            allCorners.push(...pts);
          }
        }

      // Se não há interseção: proximidade (ruas/praças que terminam perto)
      if (!foundIntersection) {
        let bestForPair: { dist: number; point: { lat: number; lng: number } } | null = null;
        for (const segI of pi)
          for (const segJ of pj) {
            const ca = closestApproach(segI, segJ);
            if (ca && (!bestForPair || ca.dist < bestForPair.dist))
              bestForPair = ca;
          }
        // ~80m threshold para proximidade
        if (bestForPair && bestForPair.dist < 0.00075) {
          console.log(`[generate-map]   Proximidade ${streetNames[i]} × ${streetNames[j]}: ${(bestForPair.dist * 111000).toFixed(0)}m`);
          allCorners.push(bestForPair.point);
        } else if (bestForPair) {
          console.log(`[generate-map]   Sem cruzamento ${streetNames[i]} × ${streetNames[j]}: ${(bestForPair.dist * 111000).toFixed(0)}m (longe)`);
        }
      } else {
        console.log(`[generate-map]   Cruzamento ${streetNames[i]} × ${streetNames[j]}: OK`);
      }
    }
  }

  // ── Passo 4: Deduplicar, filtrar outliers, limitar a N+1 cantos ─────────
  const deduped = dedupePoints(allCorners);

  // Filtra outliers: remove pontos a mais de 2× a distância mediana do centroide
  const distances = deduped.map((p) => Math.hypot(p.lat - centLat, p.lng - centLng));
  const sortedDists = [...distances].sort((a, b) => a - b);
  const medianDist = sortedDists[Math.floor(sortedDists.length / 2)] || 0.003;
  const maxAllowed = Math.max(medianDist * 2.5, 0.002); // pelo menos ~220m
  const filtered = deduped.filter((_, idx) => distances[idx] <= maxAllowed);
  console.log("[generate-map] Deduplicados:", deduped.length, "→ Após outlier filter:", filtered.length,
    `(mediana: ${(medianDist * 111000).toFixed(0)}m, max: ${(maxAllowed * 111000).toFixed(0)}m)`);

  // Se ainda tiver cantos demais, pega os N+1 mais próximos do centroide (N = número de ruas)
  const maxCorners = streetNames.length + 1;
  let finalCorners = filtered;
  if (finalCorners.length > maxCorners) {
    finalCorners = [...finalCorners]
      .sort((a, b) =>
        Math.hypot(a.lat - centLat, a.lng - centLng) - Math.hypot(b.lat - centLat, b.lng - centLng)
      )
      .slice(0, maxCorners);
    console.log(`[generate-map] Limitado a ${maxCorners} cantos (${streetNames.length} ruas + 1)`);
  }

  console.log("[generate-map] Cantos finais:", finalCorners.length);
  return finalCorners;
}

// ── Ordena pontos como polígono (sort angular no centroide) ──────────────────

function sortPolygon(pts: Array<{ lat: number; lng: number }>): Array<{ lat: number; lng: number }> {
  if (pts.length < 3) return pts;
  const cx = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  return [...pts].sort(
    (a, b) => Math.atan2(a.lat - cy, a.lng - cx) - Math.atan2(b.lat - cy, b.lng - cx)
  );
}

// ── Zoom ideal ───────────────────────────────────────────────────────────────

function chooseZoom(pts: Array<{ lat: number; lng: number }>): number {
  if (!pts.length) return 17;
  const latR = Math.max(...pts.map((p) => p.lat)) - Math.min(...pts.map((p) => p.lat));
  const lngR = Math.max(...pts.map((p) => p.lng)) - Math.min(...pts.map((p) => p.lng));
  const r = Math.max(latR, lngR);
  if (r < 0.002) return 18;
  if (r < 0.004) return 17;
  if (r < 0.008) return 16;
  if (r < 0.015) return 15;
  if (r < 0.04) return 14;
  return 13;
}

// ── Gera mapa com OSM tiles + sharp (só polígono, sem pins) ──────────────────

async function buildOsmMapImage(
  centerLat: number,
  centerLng: number,
  zoom: number,
  polygon: Array<{ lat: number; lng: number }>
): Promise<Buffer> {
  const halfCols = Math.ceil(OUTPUT_W / TILE_SIZE / 2) + 1;
  const halfRows = Math.ceil(OUTPUT_H / TILE_SIZE / 2) + 1;

  const centerTileXf = lngToTileF(centerLng, zoom);
  const centerTileYf = latToTileF(centerLat, zoom);
  const centerTileX = Math.floor(centerTileXf);
  const centerTileY = Math.floor(centerTileYf);

  const startX = centerTileX - halfCols;
  const startY = centerTileY - halfRows;
  const numCols = halfCols * 2 + 1;
  const numRows = halfRows * 2 + 1;
  const canvasW = numCols * TILE_SIZE;
  const canvasH = numRows * TILE_SIZE;

  // Baixa todos os tiles em paralelo
  const tilePromises: Promise<{ col: number; row: number; buf: Buffer | null }>[] = [];
  for (let row = 0; row < numRows; row++)
    for (let col = 0; col < numCols; col++)
      tilePromises.push(
        downloadOsmTile(startX + col, startY + row, zoom).then((buf) => ({ col, row, buf }))
      );
  const tiles = await Promise.all(tilePromises);

  function coordToPixel(lat: number, lng: number): { x: number; y: number } {
    return {
      x: Math.round((lngToTileF(lng, zoom) - startX) * TILE_SIZE),
      y: Math.round((latToTileF(lat, zoom) - startY) * TILE_SIZE),
    };
  }

  const compositeInputs: sharp.OverlayOptions[] = tiles
    .filter((t) => t.buf !== null)
    .map((t) => ({ input: t.buf as Buffer, top: t.row * TILE_SIZE, left: t.col * TILE_SIZE }));

  const overlays: sharp.OverlayOptions[] = [];

  // Polígono do quarteirão
  if (polygon.length >= 3) {
    const pixels = polygon.map((p) => coordToPixel(p.lat, p.lng));
    const pointsStr = pixels.map((p) => `${p.x},${p.y}`).join(" ");
    const circles = pixels
      .map(
        (p) =>
          `<circle cx="${p.x}" cy="${p.y}" r="7" fill="#e53e3e" opacity="0.95" stroke="#fff" stroke-width="2"/>`
      )
      .join("");
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}">
      <polygon points="${pointsStr}" fill="rgba(229,62,62,0.13)" stroke="#e53e3e" stroke-width="4" stroke-linejoin="round" stroke-opacity="0.88"/>
      ${circles}
    </svg>`;
    overlays.push({ input: Buffer.from(svgStr), top: 0, left: 0 });
  }

  const canvas = await sharp({
    create: { width: canvasW, height: canvasH, channels: 3, background: { r: 200, g: 200, b: 200 } },
  })
    .composite([...compositeInputs, ...overlays])
    .jpeg({ quality: 88 })
    .toBuffer();

  const cropLeft = Math.max(0, Math.round((centerTileXf - startX) * TILE_SIZE - OUTPUT_W / 2));
  const cropTop = Math.max(0, Math.round((centerTileYf - startY) * TILE_SIZE - OUTPUT_H / 2));
  const safeCropLeft = Math.min(cropLeft, canvasW - OUTPUT_W);
  const safeCropTop = Math.min(cropTop, canvasH - OUTPUT_H);

  return sharp(canvas)
    .extract({ left: safeCropLeft, top: safeCropTop, width: OUTPUT_W, height: OUTPUT_H })
    .jpeg({ quality: 88 })
    .toBuffer();
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/territories/[id]/generate-map
 *
 * 1. Geocodifica cada rua individualmente (Google → Nominatim) → centroide bruto.
 * 2. Nominatim com polygon_geojson=1 → geometria completa de cada rua.
 * 3. Detecta cruzamentos via interseção geométrica de polilínias + proximidade.
 * 4. Ordena como polígono e desenha contorno vermelho no mapa OSM.
 *
 * Sem pins — sempre polígono. Se encontrar poucos cantos, mostra mapa sem overlay.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTerritoryManager(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      congregationId: true,
      congregation: { select: { state: true, city: true } },
    },
  });

  const territory = await prisma.territory.findUnique({
    where: { id },
    include: { streets: { select: { name: true } } },
  });

  if (!territory)
    return NextResponse.json({ error: "Território não encontrado." }, { status: 404 });
  if (territory.congregationId !== user?.congregationId && auth.role !== "ADMIN")
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  if (territory.streets.length === 0)
    return NextResponse.json({ error: "O território não possui ruas." }, { status: 400 });

  const state = user?.congregation?.state ?? "";
  const city = user?.congregation?.city ?? "";
  const streetNames = territory.streets.map((s) => s.name);

  // ── Passo 1: encontra cantos do quarteirão ───────────────────────────────
  const rawCorners = await getBlockCorners(streetNames, city, state);
  let polygon = rawCorners.length >= 3 ? sortPolygon(rawCorners) : [];
  console.log("[generate-map] Polígono final:", polygon.length, "cantos");

  // ── Centro e zoom ────────────────────────────────────────────────────────
  let centerLat: number, centerLng: number;
  if (polygon.length >= 3) {
    centerLat = polygon.reduce((s, p) => s + p.lat, 0) / polygon.length;
    centerLng = polygon.reduce((s, p) => s + p.lng, 0) / polygon.length;
  } else {
    // Sem polígono: geocodifica as ruas para pelo menos centralizar o mapa
    const coords = await Promise.all(streetNames.map((n) => geocodeStreet(n, city, state)));
    const valid = coords.filter((c): c is { lat: number; lng: number } => c !== null);
    if (valid.length === 0)
      return NextResponse.json(
        { error: "Não foi possível localizar nenhuma rua. Verifique os nomes." },
        { status: 422 }
      );
    centerLat = valid.reduce((s, c) => s + c.lat, 0) / valid.length;
    centerLng = valid.reduce((s, c) => s + c.lng, 0) / valid.length;
  }

  const zoom = polygon.length >= 3 ? chooseZoom(polygon) : 17;

  // ── Passo 2: gera imagem ─────────────────────────────────────────────────
  let imgBuffer: Buffer;
  try {
    imgBuffer = await buildOsmMapImage(centerLat, centerLng, zoom, polygon);
  } catch (err) {
    console.error("[generate-map] Erro ao gerar imagem:", err);
    return NextResponse.json({ error: "Falha ao gerar a imagem do mapa." }, { status: 500 });
  }

  // ── Salva em public/territorios/{id}.jpg ─────────────────────────────────
  const uploadDir = path.join(process.cwd(), "public", "territorios");
  await mkdir(uploadDir, { recursive: true });
  const filename = `${id}.jpg`;
  await writeFile(path.join(uploadDir, filename), imgBuffer);

  const imageUrl = `/territorios/${filename}?v=${Date.now()}`;
  await prisma.territory.update({ where: { id }, data: { imageUrl } });

  return NextResponse.json({
    imageUrl,
    center: { lat: centerLat, lng: centerLng },
    zoom,
    corners: polygon.length,
  });
}
