# MaxQI reuse audit

Source: `maxstillwell/maxqi.com`, commit `a3598ef83b6da840c7886fff3d3a78c20f52e477`. Vercel production previously verified at the same commit. Source snapshot is copied into a separate audit directory; no edits to source.

## Generic material reused

- `lib/land/arcgis-export-layer.ts`: copied unchanged into `src/lib/map/arcgis-export-layer.ts`. Generic Leaflet ArcGIS export tile adapter, no backend dependence. Available for subsequent official layer adapters.
- `lib/land/strategic-intersection.ts`: extracted area/intersection logic into smaller generic `overlapHectares`; preserve null on invalid input, no invented area.
- Leaflet map lifecycle, feature groups, parcel boundary rendering, marker and inspector concepts reimplemented as independent responsive workspace. Whole 3,083-line component deliberately not copied.
- Field observation and media concepts: title, notes, coordinates, dates, parcel link, signed upload → object → metadata completion. EXIF extraction and private media previews retained as concepts.
- Spatial layer payload/radius/polygon/GeoJSON conversion is understood by importer; individual features are mapped and relationships retained.

## Must not carry over

`lib/land/auth.ts`, `lib/admin/auth.ts`, shared passwords, legacy signed cookies, `/admin`, corporate layouts/marketing content, Obsidian publishing/sync, MaxQI service-role query wrappers, MaxQI domains/configuration, hard-coded existing backend IDs as active connections.

## Production schema analysis

Read-only catalogue inspection: parcels include research/market attributes and GeoJSON; observations link to parcel ID; media link to observation and private storage path; layers embed geometries in `layer_data` rather than a separate feature table. There is no separate legacy `spatial_features` table. Import derives 26 normalized feature records from 12 layers and retains raw payload and lineage. All extra parcel/planning fields remain in destination metadata for lossless preservation until promoted to normalized fields.

Existing MaxQI viewer remains password-protected and read-only, owner writes remain on its current auth, all existing tables/RLS/storage/APIs remain untouched.
