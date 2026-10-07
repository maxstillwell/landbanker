# LandOS architecture

LandOS is an independent multi-tenant product. It is not a MaxQI wrapper. **NEVER BREAK MAXQI. COPY FIRST → VERIFY → CUT OVER LATER.**

## Boundaries

- Separate repository directory and Git history, remote `maxstillwell/landbanker` (currently public, created by the user).
- Independent Next.js 16 / React 19 / TypeScript web app. Leaflet client map loaded dynamically.
- Independent Supabase Auth, Postgres, private Storage and migration history.
- SwiftUI app loads the configured LandOS URL using persistent WKWebView, never MaxQI.
- Web, iPhone and iPad share the same Leaflet basemap and layers. CoreLocation supplies coordinates to this map; no separate MapKit renderer. Tile origin identification/privacy details are in BASEMAP.md.
- All authenticated queries use the user's Supabase credential so database RLS remains authoritative. No service-role bypass for application CRUD.
- Public share pages call a LandOS server gateway. It uses the publishable key plus a server-only 256-bit capability to invoke a narrow PostgreSQL projection and distributed budget transaction; no runtime service key or arbitrary table query.
- MaxQI remains on its old backend. `/api/published/[token]` is a future consumer seam only. No production integration or flag changes made.

## Product flow

Register → Auth trigger creates profile + Personal Workspace + owner membership → authenticated map → location or map point → observation/text/photos → durable device queue → signed upload → Storage object verification → database record → other devices refresh.

## Web modules

`src/lib/supabase`: SSR and browser auth adapters; future native Auth can replace session transport without changing the domain.
`src/lib/workspace`: current active membership resolution; workspace selector uses `lb_workspace` cookie and always validates membership.
`src/lib/field-queue`: IndexedDB Blob/draft persistence keyed by user and workspace; pending/uploading/uploaded/failed state. No offline tiles.
`src/lib/native-bridge`: versioned message contract and location validation.
`src/lib/map`: generic geometry and copied ArcGIS adapter.
`src/app/api`: authenticated field, map, layers, saved views and manager-only sharing routes.
`src/lib/import`: pure mapping/transform independent of source credentials.

## Operational separation

Existing MaxQI and PROS Supabase refs are hard-blocked in runtime and migration helpers. No legacy password/cookie support. No MaxQI domain or database fallback. Public credentials only in web/iOS clients. Domains are configurable; private exports, import keys and local env files are excluded from Git.

## Future extension

Membership roles and normalized workspace records support teams without one database per user. Projects/tags/comments/custom fields/documents/billing/audit/webhooks remain future work. No billing now. Additional workspaces and role management should use a carefully audited manager service/RPC; client membership escalation is blocked in v1.

## Spatial workspace milestone

Primary selection union coordinates Property, Observation and Drawing inspectors. Official parcel preview is separate from saved Workspace Property. Government address/boundary queries are authenticated, bounded server reads; save re-verifies the source. My Layers use atomic invoker RPC to preserve tenant RLS and normalized features. Official reference catalog is server-owned; per-user active-layer preference is tenant scoped. Web/iOS share all of these components. Map ResizeObserver handles sheet/orientation changes. Phone peek/half/full uses stable internal state names; iPad landscape map/inspector is 70/30.

Saved Views persist explicit current-map parcel/layer IDs and active official layer settings. Restore applies map/visibility/layer preferences. Sharing freezes an explicit manifest including Feature UUIDs, expiry/revoke and minimal public projection. Anonymous shared map has no mutation controls; no observation/photo publishing in this milestone.

## Bounded map reads

Authenticated /api/map returns stable 100-row pages per category with hasMore. UI loads further pages explicitly and refreshes only the number already loaded; map movement does not trigger Workspace-wide reads. Legacy raw metadata is excluded from map projection; radius-specific layer data is preserved, other duplicated payloads omitted. Photo signed URLs are batched in groups of 100, at most four requests concurrently. Optional bbox filters parcel/observation location points, not geometry intersections. Current UI cap is 1,000/category; full layer GeoJSON remains a payload risk and indexed feature viewport/cursor/delta loading is future work.

## Alpha 2 drawing recovery

The existing account/Workspace-scoped IndexedDB abstraction is upgraded in place to version 2, retaining finished drafts and adding an unfinished drawing session store. Each edit persists coordinates, drawing kind/name, layer target, timestamps and one edit snapshot. Reopening offers Continue/Discard; account/Workspace switching cannot expose another scope. Simple editing validates minimum vertices, closed rings, nonzero area and self-intersection before accepting changes. Imported holes/multipart or more than 200 vertices remain view-only. No database migration is required.

## Alpha 2 viewport and share boundaries

See PERFORMANCE.md for indexed envelope candidates, exact API intersection, bounded cursor/delta contract, normalized Feature loading, lazy full layers and short-lived signed-photo caching. Rendering uses viewport data; editing merges into a freshly read complete layer. Saved View creation derives resource IDs from rendered geometry, not paginated sidebar metadata.

Device draft database version 3 retains existing drawing/layer stores and adds account/Workspace-scoped copy-link URLs. Server share scope remains authoritative, with no-write preview, reviewed-scope hash on create, frozen feature IDs and token-only status. The server gateway validates token format, applies early budgets and calls one capability-protected Postgres function; Postgres atomically applies caller/token budgets across instances. Direct anon/auth execution of the old resolver/status functions is revoked. See SECURITY.md and SHARE_PERIMETER.md.

## Alpha 3 Property intelligence

Planning now uses Property-specific official spatial intersections rather than map-active layer names. `src/lib/planning` separates geometry, explicit provider adapters and the unified per-source result contract. The authenticated property route first checks Workspace RLS, then runs bounded official requests; the Inspector shows clipping coverage, provenance and independent source failure. See PLANNING.md. Catalog release status/checklist distinguish reviewed readiness from technical map availability; FSR/Height remain disabled for documented release gates.

Alpha 3 refinements keep query history in the existing account/Workspace-scoped IndexedDB abstraction (additive version 4 store). Government health uses fixed-schema platform events and bounded instance diagnostics, not a durable uptime claim; see OBSERVABILITY.md. SHARE_PERIMETER.md records the accepted Postgres-backed distributed perimeter and the separate optional Vercel Firewall 404 blocker.
