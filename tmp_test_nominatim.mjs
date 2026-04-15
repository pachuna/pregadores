// Teste FINAL: Nominatim + polygon_geojson + interseção geométrica
const streets = [
  "Avenida Nova Iorque",
  "Avenida Utinga",
  "Praça Mário Guindani",
  "Rua Madri",
  "Rua Santiago",
];

const CITY = "Santo André";
const STATE = "SP";

// Centroide aproximado (vem da geocodificação individual)
const centLat = -23.6208, centLng = -46.5372;

async function fetchStreetGeom(streetName)  {
  const q = `${streetName}, ${CITY}, ${STATE}`;
  const params = new URLSearchParams({
    q, format: "json", limit: "10", countrycodes: "br", polygon_geojson: "1",
  });
  const res = await fetch(
    "https://nominatim.openstreetmap.org/search?" + params.toString(),
    { headers: { "User-Agent": "Pregadores-App/1.0" }, signal: AbortSignal.timeout(8000) }
  );
  const data = await res.json();
  
  // Converte GeoJSON para arrays de {lat, lon}
  // Filtra só segmentos próximos ao centroide (< 600m)
  const geoms = [];
  for (const item of data) {
    const gj = item.geojson;
    if (!gj) continue;
    
    let coordArrays = [];
    if (gj.type === "LineString") coordArrays = [gj.coordinates];
    else if (gj.type === "MultiLineString") coordArrays = gj.coordinates;
    else if (gj.type === "Polygon") coordArrays = gj.coordinates; // outer ring + holes
    else if (gj.type === "Point") continue;
    
    for (const coords of coordArrays) {
      const pts = coords.map(c => ({ lat: c[1], lon: c[0] }));
      // Verifica se ALGUM ponto está a < 600m (~0.006°) do centroide
      const nearCentroid = pts.some(p =>
        Math.abs(p.lat - centLat) < 0.006 && Math.abs(p.lon - centLng) < 0.006
      );
      if (nearCentroid) geoms.push(pts);
    }
  }
  return geoms;
}

console.log("Buscando geometrias via Nominatim...\n");

const streetGeometries = new Map();
for (let i = 0; i < streets.length; i++) {
  if (i > 0) await new Promise(r => setTimeout(r, 1100)); // 1 req/s rate limit
  console.log(`[${i}] ${streets[i]}...`);
  const geoms = await fetchStreetGeom(streets[i]);
  streetGeometries.set(streets[i], geoms);
  console.log(`  => ${geoms.length} polilínias próximas ao centroide`);
  geoms.forEach((g, j) => console.log(`     [${j}] ${g.length} pts: (${g[0].lat.toFixed(5)},${g[0].lon.toFixed(5)}) → (${g[g.length-1].lat.toFixed(5)},${g[g.length-1].lon.toFixed(5)})`));
}

// Interseção geométrica
function segmentIntersect(a1, a2, b1, b2) {
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

console.log("\n=== CRUZAMENTOS ===\n");
const allCorners = [];

for (let i = 0; i < streets.length; i++) {
  for (let j = i + 1; j < streets.length; j++) {
    const pi = streetGeometries.get(streets[i]) || [];
    const pj = streetGeometries.get(streets[j]) || [];
    if (!pi.length || !pj.length) { console.log(`${streets[i]} x ${streets[j]}: SKIP`); continue; }

    const intersections = [];
    for (const segI of pi)
      for (const segJ of pj)
        for (let a = 0; a + 1 < segI.length; a++)
          for (let b = 0; b + 1 < segJ.length; b++) {
            const pt = segmentIntersect(segI[a], segI[a+1], segJ[b], segJ[b+1]);
            if (pt) intersections.push(pt);
          }

    if (intersections.length > 0) {
      console.log(`${streets[i]} x ${streets[j]}: ${intersections.length} INTERSEÇÕES`);
      intersections.forEach(p => console.log(`  -> ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`));
      allCorners.push(...intersections);
    } else {
      // Proximidade
      let best = null;
      for (const segI of pi)
        for (const segJ of pj)
          for (const a of segI)
            for (const b of segJ) {
              const d = Math.hypot(a.lat - b.lat, a.lon - b.lon);
              if (!best || d < best.dist) best = { dist: d, point: { lat: (a.lat+b.lat)/2, lng: (a.lon+b.lon)/2 } };
            }
      if (best && best.dist < 0.0011) {
        console.log(`${streets[i]} x ${streets[j]}: PROXIMIDADE ${(best.dist*111000).toFixed(0)}m`);
        console.log(`  -> ${best.point.lat.toFixed(6)}, ${best.point.lng.toFixed(6)}`);
        allCorners.push(best.point);
      } else {
        console.log(`${streets[i]} x ${streets[j]}: LONGE ${best ? (best.dist*111000).toFixed(0)+'m' : 'N/A'}`);
      }
    }
  }
}

// Dedup
const deduped = [];
const eps = 0.00015;
for (const p of allCorners)
  if (!deduped.some(q => Math.abs(q.lat - p.lat) < eps && Math.abs(q.lng - p.lng) < eps))
    deduped.push(p);

console.log(`\n=== CANTOS FINAIS: ${deduped.length} ===`);
deduped.forEach((p, i) => console.log(`  ${i}: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`));

// Sort angular
const cx = deduped.reduce((s,p) => s + p.lng, 0) / deduped.length;
const cy = deduped.reduce((s,p) => s + p.lat, 0) / deduped.length;
const sorted = [...deduped].sort((a,b) => Math.atan2(a.lat-cy, a.lng-cx) - Math.atan2(b.lat-cy, b.lng-cx));
console.log("\nPolígono ordenado:");
sorted.forEach((p,i) => console.log(`  ${i}: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`));
