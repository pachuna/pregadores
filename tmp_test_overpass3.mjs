// Teste FINAL: queries sequenciais com delay + retry + interseção + proximidade
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

async function fetchStreet(keyword, retries = 2) {
  const query = `[out:json][timeout:10];(way["name"~"${keyword}",i](${bbox});rel["name"~"${keyword}",i](${bbox}););out geom;`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));
    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Test/1.0" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429 || res.status === 504) {
        console.log(`  RETRY ${attempt+1}/${retries+1}: ${res.status}`);
        continue;
      }
      if (!res.ok) return [];
      const data = await res.json();
      return data.elements || [];
    } catch (e) {
      console.log(`  ERROR attempt ${attempt+1}: ${e.message}`);
    }
  }
  return [];
}

// Sequencial com delay
const streetGeometries = new Map();
for (let i = 0; i < streets.length; i++) {
  if (i > 0) await new Promise(r => setTimeout(r, 300));
  const kw = overpassKeyword(streets[i]);
  console.log(`\n[${i}] ${streets[i]} (kw: "${kw}")...`);
  const elements = await fetchStreet(kw);
  const geoms = [];
  for (const el of elements) {
    if (el.type === "way" && el.geometry?.length) {
      console.log(`  way ${el.id} "${el.tags?.name}" ${el.geometry.length} pts`);
      geoms.push(el.geometry);
    } else if (el.type === "relation" && el.members) {
      for (const m of el.members) {
        if (m.geometry?.length) {
          console.log(`  rel member ${m.role}: ${m.geometry.length} pts`);
          geoms.push(m.geometry);
        }
      }
    }
  }
  streetGeometries.set(streets[i], geoms);
  console.log(`  => ${geoms.length} polilínias`);
}

// Interseções
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
    if (!pi.length || !pj.length) { console.log(`${streets[i]} × ${streets[j]}: SKIP (sem geometria)`); continue; }

    let found = false;
    const intersections = [];
    for (const segI of pi)
      for (const segJ of pj)
        for (let a = 0; a + 1 < segI.length; a++)
          for (let b = 0; b + 1 < segJ.length; b++) {
            const pt = segmentIntersect(segI[a], segI[a+1], segJ[b], segJ[b+1]);
            if (pt) { intersections.push(pt); found = true; }
          }

    if (found) {
      console.log(`${streets[i]} × ${streets[j]}: ${intersections.length} interseções`);
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
      const dm = best ? (best.dist * 111000).toFixed(0) : "N/A";
      if (best && best.dist < 0.0011) {
        console.log(`${streets[i]} × ${streets[j]}: PROXIMIDADE ${dm}m -> ${best.point.lat.toFixed(6)}, ${best.point.lng.toFixed(6)}`);
        allCorners.push(best.point);
      } else {
        console.log(`${streets[i]} × ${streets[j]}: LONGE ${dm}m`);
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
