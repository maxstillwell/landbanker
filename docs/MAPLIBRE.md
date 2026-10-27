# LandOS MapLibre / 3D engine evaluation

> Historical evaluation record. The authorized workflow rebuild supersedes the renderer decisions below. The supported workspace and public map now use MapLibre alone; `/app/map-3d` redirects to `/app/map`. Current implementation, evidence and deployment status: [MAPLIBRE_PROGRESS.md](MAPLIBRE_PROGRESS.md).

Updated: 2026-10-25. This document covers the isolated `codex/landos-maplibre-3d` experiment. It does not change MaxQI, LandOS database schema, Supabase configuration, RLS, Storage, Auth, existing Leaflet routes or public sharing.

## Decision for this iteration

LandOS keeps Leaflet as the production workflow renderer at `/app/map`. The MapLibre/WebGL experiment is a separate authenticated route at `/app/map-3d`.

This is deliberate. It lets LandOS validate a vector/WebGL map, pitch, building extrusion, responsive controls and real workspace data without replacing workflows that have already been security- and field-tested.

| Existing responsibility | Current renderer | MapLibre experiment | Migration status |
| --- | --- | --- | --- |
| Saved parcels and boundaries | Leaflet | GeoJSON source/layers | Read-only parity prototype |
| Field observation locations | Leaflet | GeoJSON source/layers | Read-only parity prototype |
| My Layers | Leaflet | GeoJSON source/layers | Read-only inspection prototype |
| GPS / Follow | Leaflet + existing native bridge | Same bridge, browser fallback | Prototype |
| VIC/NSW parcel search | Leaflet inspector | Existing secured search component | Prototype |
| Drawing, recovery, editing, undo | Leaflet | Not migrated | Remains Leaflet |
| Official planning/risk export overlays | Leaflet ArcGIS export utility | Not migrated | Remains Leaflet |
| Saved Views and public shares | Leaflet | Not migrated | Remains Leaflet |
| Auth, Workspaces, RLS, API data | Existing LandOS | Existing LandOS unchanged | No change |

The 3D route has an explicit **Open full LandOS workspace** action rather than silently dropping an unsupported workflow.

## Map engine and data-flow audit

The present renderer is `src/components/map-workspace.tsx`; it dynamically loads Leaflet and owns the finished Field, parcel, drawing, official layer, Saved View and share-adjacent workspace flow. `src/lib/hooks/use-viewport.ts` is Leaflet-map-specific and remains unchanged. `src/lib/map/arcgis-export-layer.ts` is a Leaflet tile layer that turns ArcGIS export services into viewport-aware raster images.

The experiment uses `maplibre-gl@6.16.0` in a client-only dynamic component, so WebGL never enters the server component graph. It reads the already-authenticated bounded first page of `/api/map` and the existing authenticated parcel-search APIs. It contains no service role credential, database credential, auth change or schema change. RLS is still the authorization boundary.

The prototype deliberately limits its map-page collection to the existing bounded first overview page. It is a renderer evaluation, not a replacement for the production viewport/change-feed contract. A future migration must adapt the existing viewport and incremental change-feed APIs before treating MapLibre as the high-record-count renderer.

## Basemap, cost and attribution

The selected prototype source is [OpenFreeMap](https://openfreemap.org/), using its documented public MapLibre style URLs:

- `https://tiles.openfreemap.org/styles/liberty`
- `https://tiles.openfreemap.org/styles/positron`
- `https://tiles.openfreemap.org/styles/dark`
- `https://tiles.openfreemap.org/styles/bright`

OpenFreeMap says its public instance is free, permits commercial use, has no API key/cookie/user database and can be self-hosted. It also says it currently provides **no SLA or personalised support** and may discontinue the public service. That makes it suitable for this no-paid-API prototype, not an unconditional production availability commitment. Before broad SaaS launch, review provider capacity and continuity; self-hosting remains the zero-key contingency rather than an implied present deployment.

MapLibre renders provider attribution automatically. The LandOS UI also displays a visible textual fallback:

`OpenFreeMap · © OpenMapTiles · OpenStreetMap contributors`

Source/terms checked on 2026-10-25:

- [OpenFreeMap Quick Start](https://openfreemap.org/quick_start/)
- [OpenFreeMap homepage, commercial use, attribution and SLA statements](https://openfreemap.org/)
- [OpenFreeMap Terms](https://openfreemap.org/tos/)
- [OpenStreetMap copyright and attribution](https://www.openstreetmap.org/copyright)

No Mapbox, MapTiler, Google Maps, Esri basemap key, paid imagery API or paid terrain provider is added. Satellite imagery is intentionally absent until a separately reviewed source and terms are chosen.

## 3D buildings and terrain

When an OpenFreeMap style exposes an OpenMapTiles `building` fill source layer, LandOS adds a `fill-extrusion` layer that prefers documented `render_height`/`height` and `render_min_height`/`min_height` values. The UI says that heights are source-derived and approximate. It does not invent heights where the provider supplies none.

Terrain is optional and disabled by default. `NEXT_PUBLIC_LANDOS_TERRAIN_TILEJSON_URL` may hold a reviewed HTTPS raster-DEM TileJSON URL. The app enables MapLibre terrain only when that configuration exists; it has no hidden default terrain host, no paid API and no claim that terrain is active otherwise.

For Australian terrain research, [Geoscience Australia's Digital Elevation Data page](https://www.ga.gov.au/scientific-topics/national-location-information/digital-elevation-data) identifies CC BY 4.0 metadata and documents ELVIS/Elevation and Depth access, including national SRTM-derived DEM products and higher-resolution packaged datasets. These are data discovery/download sources, not a ready-made globally hosted MapLibre raster-DEM tile endpoint. A future terrain release must:

1. Select a precise source and coverage/resolution suitable for each supported state.
2. Confirm dataset-level licence, attribution, currency and vertical datum.
3. Produce/host raster-DEM TileJSON with cache, quota and cost controls.
4. Test exaggeration, coastal gaps and low-zoom behaviour on mobile hardware.

## Responsive, accessibility and performance notes

The canvas uses a fixed full-screen map, desktop inspector and compact iPhone bottom inspector. It retains safe-area spacing, has labelled controls, keyboard-focus styling, native/browsers GPS handling, a desktop-only fullscreen control and reduced-motion-aware property fitting. A `ResizeObserver` calls `map.resize()` after responsive changes.

The current route uses static vector style URLs and applies data through long-lived GeoJSON sources rather than reinitialising the map on every render. Map style changes intentionally recreate only MapLibre style state and then restore workspace overlays. The production Leaflet map's established viewport/debounce/cache/change-feed strategy is left untouched.

## Migration stages and explicit acceptance gates

1. **Completed here — parallel prototype:** authenticated route, 2D/3D controls, safe building extrusion, optional terrain config, workspace overlays, search and basic property inspection.
2. **Stage B — measured parity:** adapt bounded viewport and incremental change-feed contracts, port official ArcGIS export layers or replace them with reviewed native vector/raster sources, and build feature-by-feature visual/data parity tests.
3. **Stage C — workflow parity:** migrate drawing/recovery/editing, Saved Views and share renderer only after unit/browser/physical-device acceptance passes. Keep a Leaflet fallback behind a feature flag.
4. **Stage D — controlled cutover:** security review, performance baselines on target iPhone/iPad, accessibility review, rollback tested, explicit owner approval. No MaxQI cutover is implied by any stage.

No production route replacement, deployment or merge is authorised by this document.
