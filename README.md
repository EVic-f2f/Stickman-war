# Stickman-war

Interactive world-country map demo with clickable countries and NPC travel paths.

## Files

- `data/countries.geojson`: country boundary features (real polygons if fetched with the script below).
- `data/npc_paths.geojson`: inter-country route graph (land + ship/ocean links) between country centroids.
- `web/index.html`: remade primary map (Canvas-based, local-only, optimized for smooth interaction).
- `src/fetchCountriesGeoJson.js`: downloads real country boundary GeoJSON.
- `src/generateCountriesGeoJson.js`: generates NPC paths from country boundaries.
- `src/remakeMapData.js`: fully remakes local map data (countries + paths) without internet.
- `src/worldMapServer.js`: lightweight Node.js HTTP server.

## Get real country boundaries

```bash
node src/fetchCountriesGeoJson.js
```

## Generate NPC paths

```bash
node src/generateCountriesGeoJson.js
```

## Run the map

```bash
node src/worldMapServer.js
```

Then open `http://localhost:8000`.


## Controls

- NPC starts from Libya (`LY`) when available (otherwise random country for testing).
- Click a country to route NPC from its current country to the clicked country; NPC will stop at the destination capital when available (fallback: country center).
- Only the active NPC route is shown (no extra path clutter).
- Routing is land-preferred (smart mode), with ship links used when needed.
- Mouse wheel to zoom.
- Click + drag to pan.
- Double click to reset zoom.


## Entry point

- Primary remade map: `http://localhost:8000/web/index.html`

## Fully remake local map data (no internet)

```bash
node src/remakeMapData.js
```
