// Teste: buscar cada rua individualmente no Overpass e calcular interseções
const streets = [
  "Avenida Nova Iorque",
  "Avenida Utinga",
  "Praça Mário Guindani",
  "Rua Madri",
  "Rua Santiago",
];

function overpassKeyword(streetName) {
  const PREFIXES = new Set([
    "rua","r","avenida","av","praça","praca","pça","pca",
    "alameda","al","travessa","tv","estrada","rodovia","largo","lgo","via","beco",
  ]);
  const words = streetName.replace(/\./g, "").trim().split(/\s+/);
  const meaningful = words.filter((w) => !PREFIXES.has(w.toLowerCase()));
  const word = meaningful.length > 0 ? meaningful[meaningful.length - 1] : words[words.length - 1];
  return word
    .replace(/[àáâãäÀÁÂÃÄ]/g, ".")
    .replace(/[èéêëÈÉÊË]/g, ".")
    .replace(/[ìíîïÌÍÎÏ]/g, ".")
    .replace(/[òóôõöÒÓÔÕÖ]/g, ".")
    .replace(/[ùúûüÙÚÛÜ]/g, ".")
    .replace(/[çÇ]/g, ".")
    .replace(/[ñÑ]/g, ".");
}

const centLat = -23.6208, centLng = -46.5372;
const dLat = 0.006;
const dLng = 0.006 / Math.cos((centLat * Math.PI) / 180);
const bbox = `${centLat - dLat},${centLng - dLng},${centLat + dLat},${centLng + dLng}`;

console.log("Bbox:", bbox);

// Busca cada rua individualmente (em PARALELO, não sequencial)
const streetGeometries = new Map();

const results = await Promise.all(streets.map(async (street, i) => {
  const kw = overpassKeyword(street);
  const query = `[out:json][timeout:10];(way["name"~"${kw}",i](${bbox});rel["name"~"${kw}",i](${bbox}););out geom;`;
  console.log(`Query ${i}: ${street} (kw: "${kw}")`);
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: "data=" + encodeURIComponent(query),
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Test/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { street, elements: [], error: res.status };
    const data = await res.json();
    return { street, elements: data.elements || [], error: null };
  } catch (e) {
    return { street, elements: [], error: e.message };
  }
}));

for (const r of results) {
  console.log(`\n--- ${r.street} ---`);
  if (r.error) { console.log(`  ERROR: ${r.error}`); continue; }
  console.log(`  Found: ${r.elements.length} elements`);
  const geoms = [];
  for (const el of r.elements) {
    console.log(`  ${el.type} ${el.id} "${el.tags?.name}"`);
    if (el.type === "way" && el.geometry?.length) {
      console.log(`    geometry: ${el.geometry.length} pts`);
      geoms.push(el.geometry);
    } else if (el.type === "relation" && el.members) {
      for (const m of el.members) {
        if (m.geometry?.length) {
          console.log(`    member ${m.role}: ${m.geometry.length} pts`);
          geoms.push(m.geometry);
        }
      }
    }
  }
  streetGeometries.set(r.street, geoms);
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

console.log("\n\n=== INTERSEÇÕES ===");
const allCorners = [];

for (let i = 0; i < streets.length; i++) {
  for (let j = i + 1; j < streets.length; j++) {
    const pi = streetGeometries.get(streets[i]) || [];
    const pj = streetGeometries.get(streets[j]) || [];
    
    const intersections = [];
    for (const segI of pi)
      for (const segJ of pj)
        for (let a = 0; a + 1 < segI.length; a++)
          for (let b = 0; b + 1 < segJ.length; b++) {
            const pt = segmentIntersect(segI[a], segI[a+1], segJ[b], segJ[b+1]);
            if (pt) intersections.push(pt);
          }
    
    // Proximidade
    let closest = null;
    for (const segI of pi)
      for (const segJ of pj)
        for (const a of segI)
          for (const b of segJ) {
            const d = Math.hypot(a.lat - b.lat, a.lon - b.lon);
            if (!closest || d < closest.dist) 
              closest = { dist: d, point: { lat: (a.lat+b.lat)/2, lng: (a.lon+b.lon)/2 } };
          }
    
    console.log(`${streets[i]} × ${streets[j]}:`);
    console.log(`  Interseções: ${intersections.length}`);
    intersections.forEach(p => console.log(`    ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`));
    if (closest) console.log(`  Closest: ${(closest.dist * 111000).toFixed(0)}m at ${closest.point.lat.toFixed(6)}, ${closest.point.lng.toFixed(6)}`);
    
    if (intersections.length > 0) {
      allCorners.push(...intersections);
    } else if (closest && closest.dist < 0.0006) {
      console.log(`  -> Using proximity corner`);
      allCorners.push(closest.point);
    }
  }
}

// Dedup
const deduped = [];
const eps = 0.00015;
for (const p of allCorners) {
  if (!deduped.some(q => Math.abs(q.lat - p.lat) < eps && Math.abs(q.lng - p.lng) < eps))
    deduped.push(p);
}

console.log(`\n=== CANTOS FINAIS: ${deduped.length} ===`);
deduped.forEach((p, i) => console.log(`  ${i}: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`));
