# Commercial basemap strategy

Keep the shared Leaflet renderer in Web and WKWebView for this milestone. Native GPS supplies coordinates, not a separate Apple map. Existing OSM street layer is a prototype dependency, not a production capacity commitment. No offline tile downloads.

| Option | Fit | Before commercial adoption |
| --- | --- | --- |
| OSM public raster tiles | Prototype street map | Follow https://operations.osmfoundation.org/policies/tiles/: attribution, identifiable origin, normal caching, no bulk/offline prefetch. Best effort with no SLA; avoid building paid SaaS capacity on volunteer infrastructure. |
| MapTiler | Hosted OSM-derived raster/vector, straightforward Leaflet raster path | Check plan limits, attribution, caching/offline terms; restrict public client key to allowed origins. https://www.maptiler.com/cloud/ |
| Mapbox | Hosted raster/vector/satellite, strong SDK ecosystem | Review request/MAU pricing and redistribution/cache terms; restrict public tokens. Rendering migration to GL is optional, not required for raster integration. https://docs.mapbox.com/ |
| Esri basemap services | Australian professional mapping and imagery | Review required account/API key, service usage terms and pricing; an anonymously reachable World Imagery URL is not proof of SaaS licensing. https://developers.arcgis.com/documentation/mapping-and-location-services/mapping/basemaps/ |
| MapLibre GL JS | Open renderer for large vector datasets | Renderer, not a tile service. Requires a licensed hosted or self-hosted source and a separate GL migration/gesture/style review. https://maplibre.org/maplibre-gl-js/docs/ |
| Self-hosted OSM-derived tiles | Infrastructure/data control at scale | Operational cost, updates, ODbL obligations, storage/CDN and capacity; higher maintenance than hosted provider. |

Recommend evaluating a licensed hosted street + satellite provider while preserving current geometry, Workspace data and Leaflet controls. Use environment-based provider/key configuration and server-owned catalog metadata. Domain/repo/backend names remain stable. Do not immediately migrate renderer or pretend public OSM/Esri endpoints offer contracted commercial capacity. Actual vendor quote/current account terms are required before selecting a paid production plan; no billing integration in this milestone.
