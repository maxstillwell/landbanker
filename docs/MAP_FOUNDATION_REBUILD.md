# LandOS map foundation rebuild

## Status

**Gate A — architecture and source verification is in progress.**

This rebuild is being developed only on `codex/landos-map-foundation-rebuild`. It is not merged or deployed. It does not modify MaxQI, the independent Supabase project, Auth, RLS, Storage, migrations, or API contracts.

## Decision

The production map will be one MapLibre GL JS scene. It will own both 2D and 3D camera states. LandOS will not ship a Leaflet map underneath a MapLibre canvas, a hidden fallback map, or two map pages for the same workspace.

The current `main` implementation is a rollback point only. It exposed two concrete problems during testing:

1. the public `tile.openstreetmap.org` endpoint returns `x-blocked: Access denied` for LandOS requests; it is not a production basemap dependency;
2. layering a MapLibre canvas over an existing Leaflet/ArcGIS workspace duplicates tile, event, camera and GPU work and cannot provide dependable 3D.

## Target architecture

```text
LandOS workspace shell
│
├─ map controller
│  ├─ authoritative camera (center, zoom, bearing, pitch)
│  ├─ selection (one primary map feature)
│  ├─ interactions (select, draw, measure, locate, follow)
│  └─ loading/error state
│
├─ one MapLibre GL JS instance
│  ├─ configured basemap source + attribution
│  ├─ workspace GeoJSON sources (parcels, observations, drawings)
│  ├─ official-source registry (verified raster/vector/query adapters)
│  └─ 2D / 3D camera transition in the same scene
│
└─ existing LandOS business services (reused unchanged)
   ├─ Supabase Auth / workspace RLS / private media
   ├─ parcels + planning APIs
   ├─ geometry, measurement and spatial intersection
   ├─ field observations, photos, saved views and shares
   └─ VIC/NSW provider health and provenance
```

## Reuse audit

| Area | Decision | Reason |
|---|---|---|
| Supabase/Auth/RLS/Storage | Reuse unchanged | Security boundary is already independent and tested. |
| `/api/parcels`, `/api/properties/*`, planning services | Reuse unchanged | They are server-side, official-source-backed business APIs. |
| `official-parcels.ts`, Esri ring conversion, geometry/measurement/intersection | Reuse | Renderer-neutral spatial logic. |
| Map data types and GeoJSON conversion | Reuse/refine | Correct model for long-lived MapLibre sources. |
| Field drafts, observations, media queue, saved views, sharing contracts | Reuse | Map UI must consume the existing contracts, not duplicate data. |
| Leaflet map lifecycle, Leaflet draw/edit handlers, `arcgis-export-layer.ts` display layer | Replace | These are renderer-specific and are the source of the dual-engine architecture. |
| Current MapLibre overlay and `/app/map-3d` prototype UI | Remove at Gate E | Neither is a production foundation; retain Git history only. |

## Source/rendering rules

- No direct dependency on the volunteer OSM raster endpoint.
- Every provider URL comes from a typed, environment-aware basemap/catalog configuration.
- A source is not "integrated" until service reachability, response, geographic placement, toggle, attribution and error state have passed the verification matrix.
- Prefer a provider's documented cached tile/vector service where it is licensed and available. Dynamic ArcGIS `/export` remains a measured fallback, not the default architecture.
- 3D buildings use a verified vector building source. Real terrain is deferred until a legally reusable raster-DEM TileJSON source is verified; camera pitch is never described as terrain.

## Gate sequence

1. **A — source and architecture verification:** this document, the inventory, real VIC/NSW service queries and licensing review.
2. **B — map foundation:** one MapLibre map with an approved free-first basemap, selected parcel, and verified official VIC/NSW layers.
3. **C — spatial workflows:** drawing/editing, measurement, GPS, field, views and share rendering on that one scene.
4. **D — 3D and UI polish:** camera transitions, verified buildings, verified DEM terrain, responsive map-first UI.
5. **E — cleanup:** remove Leaflet and obsolete experiments only after regression and device acceptance pass.

## Current evidence

On 27 October 2026 AEDT, direct checks from the LandOS development environment found:

| Check | Result |
|---|---|
| OSM public raster tile | HTTP 200 carrying `x-blocked: Access denied` — unsuitable for LandOS |
| CARTO OSM-derived raster sample | HTTP 200 with `Access-Control-Allow-Origin: *`; candidate only, licence/capacity review pending |
| VIC planning overlays MapServer | reachable; `Map,Query,Data`; 36 layers |
| NSW EPI planning MapServer | reachable; `Map,Query,Data`; 7 layers |
| VIC dynamic export sample | HTTP 200, about 1.49 s for a 256px sample |
| NSW dynamic export sample | HTTP 200, about 0.43 s for a 256px sample |

This proves availability, not client-map placement or commercial reuse approval. Those are Gate B requirements.
