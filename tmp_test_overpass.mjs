// Script para testar a query Overpass com as 5 ruas do território A1
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

function normStr(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").trim();
}

// Centroid REAL do quarteirão (Nominatim)
const centLat = -23.6208, centLng = -46.5372;
const dLat = 0.006;
const dLng = 0.006 / Math.cos((centLat * Math.PI) / 180);
const bbox = `${centLat - dLat},${centLng - dLng},${centLat + dLat},${centLng + dLng}`;

const setLines = [];
for (let i = 0; i < streets.length; i++) {
  const kw = overpassKeyword(streets[i]);
  console.log(`Street ${i}: "${streets[i]}" -> keyword: "${kw}"`);
  setLines.push(`way["name"~"${kw}",i](${bbox})->.ws${i};`);
  setLines.push(`rel["name"~"${kw}",i](${bbox})->.rs${i};`);
  setLines.push(`(.ws${i}; .rs${i};)->.s${i};`);
}

const pairLines = [];
for (let i = 0; i < streets.length; i++)
  for (let j = i + 1; j < streets.length; j++)
    pairLines.push(`  node(w.ws${i})(w.ws${j});`);

const unionSets = streets.map((_, i) => `.s${i}`).join("; ");

// QUERY 1: Só shared nodes (rápida, sem geometria)
const queryNodes = `[out:json][timeout:15];
${setLines.join("\n")}
(
${pairLines.join("\n")}
);
out;`;

// QUERY 2: Só geometria dos ways (sem shared nodes)
const queryGeom = `[out:json][timeout:15];
${setLines.join("\n")}
(${unionSets};);
out geom;`;

console.log("\n=== TEST 1: Contagem de ways por rua (sem geometria) ===");
const queryCount = `[out:json][timeout:10];
${setLines.join("\n")}
.ws0 out count;
.ws1 out count;
.ws2 out count;
.ws3 out count;
.ws4 out count;`;

const res0 = await fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  body: "data=" + encodeURIComponent(queryCount),
  headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Test/1.0" },
  signal: AbortSignal.timeout(20000),
});
const text0 = await res0.text();
console.log("Status:", res0.status);
if (text0.startsWith("<")) {
  console.log(text0.substring(0, 300));
} else {
  console.log(text0.substring(0, 500));
}

await new Promise(r => setTimeout(r, 3000));

// TEST 2: Testar UMA rua com out geom
console.log("\n=== TEST 2: Geometria de Rua Santiago apenas ===");
const queryOne = `[out:json][timeout:10];
way["name"~"Santiago",i](${bbox});
out geom;`;
const res1b = await fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  body: "data=" + encodeURIComponent(queryOne),
  headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Test/1.0" },
  signal: AbortSignal.timeout(20000),
});
const text1b = await res1b.text();
console.log("Status:", res1b.status);
if (text1b.startsWith("<")) {
  console.log(text1b.substring(0, 300));
} else {
  const d = JSON.parse(text1b);
  console.log("Elements:", d.elements?.length);
  d.elements?.forEach(e => console.log(`  ${e.type} ${e.id} "${e.tags?.name}" pts:${e.geometry?.length}`));
}

await new Promise(r => setTimeout(r, 3000));

// TEST 3: Shared nodes apenas entre 2 ruas
console.log("\n=== TEST 3: Shared nodes Santiago × Madri ===");
const queryPair = `[out:json][timeout:10];
way["name"~"Santiago",i](${bbox})->.wA;
way["name"~"Madri",i](${bbox})->.wB;
node(w.wA)(w.wB);
out;`;
const res3 = await fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  body: "data=" + encodeURIComponent(queryPair),
  headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Test/1.0" },
  signal: AbortSignal.timeout(20000),
});
const text3 = await res3.text();
console.log("Status:", res3.status);
if (text3.startsWith("<")) {
  console.log(text3.substring(0, 300));
} else {
  const d = JSON.parse(text3);
  console.log("Shared nodes:", d.elements?.length);
  d.elements?.forEach(e => console.log(`  NODE ${e.id} lat=${e.lat} lon=${e.lon}`));
}

process.exit(0);
const els = data.elements || [];
const ways = els.filter((e) => e.type === "way");
const rels = els.filter((e) => e.type === "relation");
const nodes = els.filter((e) => e.type === "node");

console.log(`\nTotal: ${els.length} elements (${ways.length} ways, ${rels.length} rels, ${nodes.length} nodes)`);

ways.forEach((w) =>
  console.log(`  WAY ${w.id} "${w.tags?.name}" - ${w.geometry?.length || 0} pts`)
);
rels.forEach((r) =>
  console.log(`  REL ${r.id} "${r.tags?.name}" - ${r.members?.length || 0} members`)
);
nodes.forEach((n) =>
  console.log(`  NODE ${n.id} lat=${n.lat} lon=${n.lon}`)
);

// Simular matching de geometrias
console.log("\n=== MATCHING GEOMETRIAS ===");
const streetPolylines = new Map();
for (const el of els) {
  if (el.type === "node") continue;
  const name = el.tags?.name;
  if (!name) continue;
  const osmNorm = normStr(name);
  const matched = streets.find((n) => {
    const kw = normStr(overpassKeyword(n).replace(/\./g, "a"));
    return osmNorm.includes(kw);
  });
  if (!matched) {
    console.log(`  NOT MATCHED: "${name}" (norm: "${osmNorm}")`);
    continue;
  }
  console.log(`  MATCHED: "${name}" -> "${matched}" (${el.type})`);
  
  // Extract geometries
  const geoms = [];
  if (el.type === "way" && el.geometry?.length) {
    geoms.push(el.geometry);
  } else if (el.type === "relation" && el.members) {
    for (const m of el.members) {
      if (m.geometry?.length) geoms.push(m.geometry);
    }
  }
  
  if (!streetPolylines.has(matched)) streetPolylines.set(matched, []);
  streetPolylines.get(matched).push(...geoms);
}

console.log("\n=== RUAS COM GEOMETRIA ===");
for (const [name, geoms] of streetPolylines) {
  console.log(`  "${name}": ${geoms.length} polilínias, total ${geoms.reduce((s,g) => s+g.length, 0)} pts`);
}

// Test geometric intersections
console.log("\n=== INTERSEÇÕES GEOMÉTRICAS ===");
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

for (let i = 0; i < streets.length; i++) {
  for (let j = i + 1; j < streets.length; j++) {
    const pi = streetPolylines.get(streets[i]) || [];
    const pj = streetPolylines.get(streets[j]) || [];
    let found = 0;
    for (const segI of pi)
      for (const segJ of pj) {
        for (let a = 0; a + 1 < segI.length; a++)
          for (let b = 0; b + 1 < segJ.length; b++) {
            const pt = segmentIntersect(segI[a], segI[a+1], segJ[b], segJ[b+1]);
            if (pt) { found++; if (found <= 3) console.log(`    -> ${pt.lat.toFixed(6)}, ${pt.lng.toFixed(6)}`); }
          }
      }
    console.log(`  ${streets[i]} × ${streets[j]}: ${found} interseções geométricas`);
    
    // Proximity check
    if (found === 0 && pi.length > 0 && pj.length > 0) {
      let bestDist = Infinity, bestPt = null;
      for (const segI of pi)
        for (const segJ of pj)
          for (const a of segI)
            for (const b of segJ) {
              const d = Math.hypot(a.lat - b.lat, a.lon - b.lon);
              if (d < bestDist) { bestDist = d; bestPt = { lat: (a.lat+b.lat)/2, lng: (a.lon+b.lon)/2 }; }
            }
      console.log(`    Closest approach: ${(bestDist * 111000).toFixed(0)}m at ${bestPt?.lat.toFixed(6)}, ${bestPt?.lng.toFixed(6)}`);
    }
  }
}
