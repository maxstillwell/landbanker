# Gate B — MapLibre foundation evidence

Status: **implemented; browser screenshot acceptance pending.** This branch is unmerged and undeployed.

## Implementation

- `/app/map` now resolves to the one-instance MapLibre workspace on this branch; it does not mount Leaflet.
- OpenFreeMap Liberty is the configurable MapLibre basemap. Its attribution is persistently visible.
- `official-map-catalog.ts` has fixed official VIC/NSW parcel/zoning sources. It queries only the current MapLibre viewport with a 240ms move-end debounce, aborts superseded requests, caps each response at 500 features and skips cadastral requests below zoom 13.
- Official features are direct government-service responses rendered as MapLibre GeoJSON sources; NSW ArcGIS JSON rings are converted with the existing validated ring converter. There is no proxy, caching layer, fake geometry or ArcGIS dynamic export tile layer in the new path.
- Each official layer has an independent visibility control and explicit `Loading`, `Ready`, `No coverage here`, `Zoom to N+`, `Service unavailable`, and `Off / outside state` states.
- A click on an official feature produces its provider, dataset, configured official fields and provenance link in the inspector.
- Terrain and 3D work are absent by design; they are Gate D work.

## Real source network evidence — 27 October 2026 AEDT

Queries use a small WGS84 viewport, `spatialRel=esriSpatialRelIntersects`, returned geometry, `outSR=4326`, a 500-feature cap and no cache/proxy.

| Location / source | HTTP | Features | Transfer limit | Response time | Bytes |
|---|---:|---:|---|---:|---:|
| Vermont South — VIC Parcel | 200 | 303 | false | 2.873 s | 415,158 |
| Vermont South — VIC Planning Zones | 200 | 4 | false | 1.963 s | 28,674 |
| Lismore — NSW Lot | 200 | 121 | false | 2.388 s | 145,019 |
| Lismore — NSW Land Zoning | 200 | 12 | false | 4.560 s | 1,858,639 |

The NSW zoning response is materially larger/slower than the other samples. It is retained as evidence, not hidden; Gate B browser acceptance must confirm the 500-feature cap and move-end abort prevent duplicate visible-map requests.

## Automated checks

- `npm run verify:map-sources` — PASS: VIC zoning, NSW parcel and NSW zoning each return a real intersecting feature.
- `npm run lint` — PASS.
- `npm run typecheck` — PASS.
- `npm test` — PASS.
- `npm run build` — PASS.

## Remaining acceptance evidence

The current cloud session does not expose a permitted interactive/browser screenshot surface. Therefore no desktop screenshots are fabricated or claimed. Before Gate B can be accepted, capture real authenticated desktop screenshots at Vermont South and Lismore showing the basemap, each parcel/zoning toggle, a parcel click inspector and browser network request counts. This is a visual acceptance gap, not a data-source or build failure.
