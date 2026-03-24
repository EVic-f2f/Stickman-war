const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const COUNTRIES_IN = path.join(DATA_DIR, 'countries.geojson');
const COUNTRIES_OUT = path.join(DATA_DIR, 'countries.geojson');
const PATHS_OUT = path.join(DATA_DIR, 'npc_paths.geojson');

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const LAND_NEIGHBORS = 2;
const LAND_MAX_DISTANCE = 22;
const SHIP_MIN_DISTANCE = 35;

function f(n) { return Number(n.toFixed(6)); }
function clampLat(lat) { return Math.max(-85, Math.min(85, lat)); }
function wrapLon(lon) { while (lon > 180) lon -= 360; while (lon < -180) lon += 360; return lon; }

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return Math.abs(h >>> 0);
}

function noise(seed, i, scale = 1) {
  const x = Math.sin((seed + i * 374761393) % 1000000) * 43758.5453;
  return (x - Math.floor(x)) * scale;
}

function makePolygon(lon, lat, iso) {
  const seed = hash(iso);
  const pts = [];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count;
    const rLon = 2.2 + noise(seed, i, 2.4);
    const rLat = 1.5 + noise(seed, i + 17, 1.9);
    const x = wrapLon(lon + Math.cos(a) * rLon);
    const y = clampLat(lat + Math.sin(a) * rLat);
    pts.push([f(x), f(y)]);
  }
  pts.push(pts[0]);
  return pts;
}

function distance(a, b) {
  const dLon = Math.abs(a.lon - b.lon);
  const wLon = Math.min(dLon, 360 - dLon);
  const dLat = a.lat - b.lat;
  return Math.sqrt(wLon ** 2 + dLat ** 2);
}

function midpoint(a, b, ship) {
  const lon = (a.lon + b.lon) / 2;
  const lat = (a.lat + b.lat) / 2 + (ship ? 10 : 3) * (a.lat <= b.lat ? 1 : -1);
  return [f(lon), f(clampLat(lat))];
}

function key(a, b, mode) { return [a, b].sort().join('|') + '|' + mode; }

function main() {
  const base = JSON.parse(fs.readFileSync(COUNTRIES_IN, 'utf8'));
  const entries = base.features.map((ft) => ({
    iso: (ft.properties?.iso2 || ft.properties?.ISO_A2 || '').toUpperCase() || '??',
    name: ft.properties?.name || ft.properties?.ADMIN || 'Unknown',
  }));

  // de-dup by iso
  const uniq = new Map();
  for (const e of entries) if (!uniq.has(e.iso)) uniq.set(e.iso, e);
  const countries = Array.from(uniq.values()).sort((a, b) => a.name.localeCompare(b.name));

  const nodes = countries.map((c, i) => {
    const t = countries.length === 1 ? 0 : i / (countries.length - 1);
    const r = Math.sqrt(t) * 0.48;
    const th = i * GOLDEN_ANGLE;
    const nx = 0.5 + r * Math.cos(th);
    const ny = 0.5 + r * Math.sin(th);
    const lon = (nx - 0.5) * 360;
    const lat = (0.5 - ny) * 170;
    return { ...c, lon: f(lon), lat: f(lat), polygon: makePolygon(lon, lat, c.iso) };
  });

  const countryGeo = {
    type: 'FeatureCollection',
    features: nodes.map((n) => ({
      type: 'Feature',
      properties: { iso2: n.iso, name: n.name },
      geometry: { type: 'Polygon', coordinates: [n.polygon] },
    })),
  };

  const edges = new Map();
  for (const n of nodes) {
    const ranked = nodes.filter((o) => o.iso !== n.iso).map((o) => ({ o, d: distance(n, o) })).sort((a, b) => a.d - b.d);
    for (const { o, d } of ranked.filter((r) => r.d <= LAND_MAX_DISTANCE).slice(0, LAND_NEIGHBORS)) {
      const k = key(n.iso, o.iso, 'land');
      if (!edges.has(k)) {
        edges.set(k, {
          type: 'Feature',
          properties: { from: n.name, fromIso: n.iso, to: o.name, toIso: o.iso, mode: 'land', distance: f(d) },
          geometry: { type: 'LineString', coordinates: [[n.lon, n.lat], midpoint(n, o, false), [o.lon, o.lat]] },
        });
      }
    }
    const shipTarget = ranked.find((r) => r.d >= SHIP_MIN_DISTANCE);
    if (shipTarget) {
      const o = shipTarget.o; const d = shipTarget.d;
      const k = key(n.iso, o.iso, 'ship');
      if (!edges.has(k)) {
        edges.set(k, {
          type: 'Feature',
          properties: { from: n.name, fromIso: n.iso, to: o.name, toIso: o.iso, mode: 'ship', distance: f(d) },
          geometry: { type: 'LineString', coordinates: [[n.lon, n.lat], midpoint(n, o, true), [o.lon, o.lat]] },
        });
      }
    }
  }

  const pathsGeo = { type: 'FeatureCollection', features: Array.from(edges.values()) };

  fs.writeFileSync(COUNTRIES_OUT, JSON.stringify(countryGeo, null, 2) + '\n');
  fs.writeFileSync(PATHS_OUT, JSON.stringify(pathsGeo, null, 2) + '\n');

  console.log(`Remade local map: ${nodes.length} countries, ${pathsGeo.features.length} paths.`);
}

main();
