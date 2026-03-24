const fs = require('node:fs');
const path = require('node:path');

const COUNTRIES_PATH = path.resolve(__dirname, '..', 'data', 'countries.geojson');
const PATHS_OUTPUT_PATH = path.resolve(__dirname, '..', 'data', 'npc_paths.geojson');

const LAND_NEIGHBORS = 2;
const LAND_MAX_DISTANCE = 22; // degrees (centroid heuristic)
const SHIP_MIN_DISTANCE = 35;
const SHIP_TARGETS_PER_COUNTRY = 1;

function format(num) {
  return Number(num.toFixed(6));
}

function featureName(feature) {
  return (
    feature?.properties?.name ||
    feature?.properties?.ADMIN ||
    feature?.properties?.NAME ||
    feature?.properties?.sovereignt ||
    feature?.properties?.SOVEREIGNT ||
    feature?.properties?.iso_a3 ||
    'Unknown'
  );
}

function featureIso(feature) {
  return (
    feature?.properties?.iso2 ||
    feature?.properties?.ISO_A2 ||
    feature?.properties?.iso_a2 ||
    feature?.properties?.id ||
    feature?.properties?.ISO_A3 ||
    '??'
  );
}

function polygonCentroid(ring) {
  const coords = ring.slice(0, -1);
  let lonSum = 0;
  let latSum = 0;
  for (const [lon, lat] of coords) {
    lonSum += lon;
    latSum += lat;
  }
  return [lonSum / coords.length, latSum / coords.length];
}

function geometryCentroid(geometry) {
  if (!geometry) return [0, 0];

  if (geometry.type === 'Polygon') {
    return polygonCentroid(geometry.coordinates[0]);
  }

  if (geometry.type === 'MultiPolygon') {
    const centroids = geometry.coordinates.map((polygon) => polygonCentroid(polygon[0]));
    const total = centroids.length || 1;
    const lon = centroids.reduce((sum, c) => sum + c[0], 0) / total;
    const lat = centroids.reduce((sum, c) => sum + c[1], 0) / total;
    return [lon, lat];
  }

  if (geometry.type === 'Point') {
    return geometry.coordinates;
  }

  return [0, 0];
}

function distanceDegrees(a, b) {
  const dLon = Math.abs(a.lon - b.lon);
  const wrappedLon = Math.min(dLon, 360 - dLon);
  const dLat = a.lat - b.lat;
  return Math.sqrt(wrappedLon ** 2 + dLat ** 2);
}

function midpoint(a, b, mode) {
  const lon = (a.lon + b.lon) / 2;
  const latBase = (a.lat + b.lat) / 2;
  const curve = mode === 'ship' ? 12 : 4;
  const lat = latBase + (a.lat <= b.lat ? curve : -curve);
  return [format(lon), format(Math.max(-85, Math.min(85, lat)))];
}

function edgeKey(isoA, isoB, mode) {
  const [x, y] = [isoA, isoB].sort();
  return `${x}|${y}|${mode}`;
}

function buildPathFeature(a, b, mode, dist) {
  return {
    type: 'Feature',
    properties: {
      from: a.name,
      fromIso: a.iso,
      to: b.name,
      toIso: b.iso,
      mode,
      distance: format(dist),
    },
    geometry: {
      type: 'LineString',
      coordinates: [
        [format(a.lon), format(a.lat)],
        midpoint(a, b, mode),
        [format(b.lon), format(b.lat)],
      ],
    },
  };
}

function buildCountryNodes(countryFeatures) {
  return countryFeatures.map((feature) => {
    const [lon, lat] = geometryCentroid(feature.geometry);
    return {
      iso: featureIso(feature),
      name: featureName(feature),
      lon,
      lat,
    };
  });
}

function generateEdges(nodes) {
  const edges = new Map();

  for (const node of nodes) {
    const ranked = nodes
      .filter((other) => other.iso !== node.iso)
      .map((other) => ({ other, dist: distanceDegrees(node, other) }))
      .sort((a, b) => a.dist - b.dist);

    // Regional/land-style links.
    for (const { other, dist } of ranked.filter((r) => r.dist <= LAND_MAX_DISTANCE).slice(0, LAND_NEIGHBORS)) {
      const key = edgeKey(node.iso, other.iso, 'land');
      if (!edges.has(key)) edges.set(key, buildPathFeature(node, other, 'land', dist));
    }

    // Long-distance/ocean links for ship travel.
    for (const { other, dist } of ranked.filter((r) => r.dist >= SHIP_MIN_DISTANCE).slice(0, SHIP_TARGETS_PER_COUNTRY)) {
      const key = edgeKey(node.iso, other.iso, 'ship');
      if (!edges.has(key)) edges.set(key, buildPathFeature(node, other, 'ship', dist));
    }
  }

  return Array.from(edges.values());
}

function main() {
  if (!fs.existsSync(COUNTRIES_PATH)) {
    throw new Error(`Missing ${COUNTRIES_PATH}. Run: node src/fetchCountriesGeoJson.js`);
  }

  const countries = JSON.parse(fs.readFileSync(COUNTRIES_PATH, 'utf8'));
  if (!countries.features || !Array.isArray(countries.features)) {
    throw new Error('countries.geojson is missing a valid features array.');
  }

  const nodes = buildCountryNodes(countries.features);
  const pathFeatures = generateEdges(nodes);

  const npcPaths = {
    type: 'FeatureCollection',
    features: pathFeatures,
  };

  fs.writeFileSync(PATHS_OUTPUT_PATH, `${JSON.stringify(npcPaths, null, 2)}\n`);

  console.log(`Loaded ${countries.features.length} countries from data/countries.geojson.`);
  console.log(`Generated ${npcPaths.features.length} inter-country paths in data/npc_paths.geojson.`);
}

main();
