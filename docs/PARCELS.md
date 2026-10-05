# Parcel search and saved Property

Manual address search → official address point → official boundary preview → calculated area/provenance → Save to Workspace. Viewing an official parcel does not create workspace data. Saves are server-verified against the official point query and use deterministic workspace/source identity; retry does not overwrite an existing saved Property.

Coverage: Victoria and NSW only. Sources verified against live metadata and query responses:

- VIC addresses: VicPlan PropertyAndParcel MapServer/2 (Vicmap address fields). Filter house number and road name to avoid slow unbounded searches; locality search is limited to returned official addresses.
- VIC boundaries: same service /4. PFI, lot, plan and WGS84 Polygon/MultiPolygon.
- NSW addresses: Spatial Services NSW_Geocoded_Addressing_Theme MapServer/1, house number plus address filter.
- NSW boundaries: Spatial Services NSW_Land_Parcel_Property_Theme MapServer/8. Uses native ArcGIS JSON converted to GeoJSON; this service rejects the GeoJSON response format.

Public official government service endpoints only; attribution shown in inspector. API metadata does not establish a blanket commercial redistribution license: provider terms remain applicable. Review https://www.land.vic.gov.au/maps-and-spatial/spatial-data and https://www.spatial.nsw.gov.au/products_and_services/web_services before wider redistribution/export. No property ownership/title claim; area is calculated from returned boundary, not a legal survey. Source lastupdate recorded when supplied; VIC parcel registration date is not presented as an update date. Retrieved time is separate. Street address label comes from selected search result and can be customized in future, not proof of title.

No PostGIS extension currently installed on independent backend. Preserve valid GeoJSON-compatible JSONB rather than migrate existing data to a new geometry format during this milestone. New provenance columns are additive; legacy parcels remain valid with null official source fields. Current queried address point is the map location; precise polygon centroid/point-on-surface can be added with a spatial index phase.

Requests bounded to 15 seconds; empty/unavailable coverage is explicit. No autocomplete polling. No government writes. Optional `tests/parcel.live.e2e.mjs` verifies live VIC/NSW public services into LOCAL test workspaces only; government availability is not a deterministic CI dependency.
