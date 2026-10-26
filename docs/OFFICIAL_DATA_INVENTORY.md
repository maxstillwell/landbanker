# Official GIS data inventory — Gate A

Updated 27 October 2026 AEDT. This is an evidence inventory, not a claim that every entry is already rendered in the rebuilt map.

## Verification method

Each ArcGIS REST layer below was queried on 27 October 2026 AEDT using its official `?f=pjson` endpoint. The listed geometry, spatial reference, capabilities and record limit are returned service metadata. Point-intersection queries were also run against representative VIC (Bunninyong) and NSW (Dunoon) locations where noted. Provider licensing remains **pending formal source-terms review** unless explicitly documented by the provider; a reachable public endpoint is not commercial-reuse approval.

Repeat the minimum Gate A verification with `npm run verify:map-sources`. It is read-only: it checks one VIC planning service plus NSW parcel/planning services and emits metadata, intersecting feature counts and timing without writing LandOS or provider data.

| ID | State | Official provider / dataset | REST layer | Geometry / CRS | Service methods | Coverage / update / reuse status | Gate A result |
|---|---|---|---|---|---|---|---|
| `vic-parcels` | VIC | Victorian Government — VicPlan Property and Parcel / Parcel | `VicPlan_PropertyAndParcel/MapServer/4` | Polygon / EPSG:4283 | Map, Query, Data; max 1,000 | Victoria; update & commercial-reuse terms pending review | Metadata reachable. The Bunninyong test point was not inside a parcel, so a saved-parcel test coordinate is still required. |
| `vic-zoning` | VIC | Victorian Government — Planning Scheme Zones / All Zones | `planning_scheme_zones/MapServer/0` | Polygon / EPSG:102171 | Map, Query, Data; max 2,000 | Victoria; update & commercial-reuse terms pending review | Reachable; representative Bunninyong point query returned 1 feature. |
| `vic-planning-overlays` | VIC | Victorian Government — VicPlan Planning Scheme Overlays / All Overlays | `Vicplan_PlanningSchemeOverlays/MapServer/0` | Polygon / EPSG:102171 | Map, Query, Data; max 1,000 | Victoria; update & commercial-reuse terms pending review | Reachable metadata; map-placement test pending. |
| `vic-flood` | VIC | Victorian Government — Floodway Overlay | `Vicplan_PlanningSchemeOverlays/MapServer/14,15,16,32` | Polygon / EPSG:102171 | Map, Query, Data; max 1,000 | Planning overlay coverage varies; terms pending review | Reachable metadata; no feature at the representative Bunninyong point is valid empty coverage, not a failure. |
| `vic-bushfire` | VIC | Victorian Government — Bushfire Management Overlay | `Vicplan_PlanningSchemeOverlays/MapServer/19` | Polygon / EPSG:102171 | Map, Query, Data; max 1,000 | Planning overlay coverage varies; terms pending review | Reachable metadata; no feature at the representative Bunninyong point is valid empty coverage, not a failure. |
| `vic-heritage` | VIC | Victorian Government — Heritage Overlay | `Vicplan_PlanningSchemeOverlays/MapServer/9` | Polygon / EPSG:102171 | Map, Query, Data; max 1,000 | Planning overlay coverage varies; terms pending review | Reachable metadata; map-placement test pending. |
| `nsw-parcels` | NSW | NSW Spatial Services — NSW Land Parcel Property Theme / Lot | `NSW_Land_Parcel_Property_Theme/MapServer/8` | Polygon / EPSG:102100 | Map, Query, Data; max 2,000 | NSW; update & commercial-reuse terms pending review | Reachable; representative Dunoon point query returned 1 feature. |
| `nsw-zoning` | NSW | NSW Government — EPI Primary Planning Layers / Land Zoning | `EPI_Primary_Planning_Layers/MapServer/2` | Polygon / EPSG:4283 | Map, Query, Data; max 10,000 | NSW EPI coverage; terms pending review | Reachable; representative Dunoon point query returned 1 feature. |
| `nsw-heritage` | NSW | NSW Government — EPI Primary Planning Layers / Heritage | `EPI_Primary_Planning_Layers/MapServer/0` | Polygon / EPSG:4283 | Map, Query, Data; max 10,000 | NSW EPI coverage; terms pending review | Reachable metadata; map-placement test pending. |
| `nsw-minimum-lot-size` | NSW | NSW Government — EPI Primary Planning Layers / Lot Size | `EPI_Primary_Planning_Layers/MapServer/4` | Polygon / EPSG:4283 | Map, Query, Data; max 10,000 | NSW EPI coverage; terms pending review | Reachable; representative Dunoon point query returned 1 feature. |

## Source URLs

- VIC parcels: <https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/VicPlan_PropertyAndParcel/MapServer/4>
- VIC zones: <https://spatial.planning.vic.gov.au/gis/rest/services/planning_scheme_zones/MapServer/0>
- VIC overlays: <https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/Vicplan_PlanningSchemeOverlays/MapServer>
- NSW parcels: <https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Land_Parcel_Property_Theme/MapServer/8>
- NSW EPI: <https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer>

## Gate B acceptance matrix

For each enabled entry, record a dated test with a real location proving: service response, correct MapLibre placement, visibility toggle, source/attribution display, error-versus-empty state, and parcel selection/identification where applicable. Attach a browser screenshot and bounded network timing. Do not mark a layer complete from REST metadata alone.
