# Land Banker architecture

Land Banker is an independent multi-tenant product. It is not a MaxQI wrapper. **NEVER BREAK MAXQI. COPY FIRST → VERIFY → CUT OVER LATER.**

## Boundaries

- Separate repository directory and Git history, intended remote `maxstillwell/land-banker` (private).
- Independent Next.js 16 / React 19 / TypeScript web app. Leaflet client map loaded dynamically.
- Independent Supabase Auth, Postgres, private Storage and migration history.
- SwiftUI app loads the configured Land Banker URL using persistent WKWebView, never MaxQI.
- All authenticated queries use the user's Supabase credential so database RLS remains authoritative. No service-role bypass for application CRUD.
- Optional server-only privileged share resolver reads token hashes and explicit safe projections; it cannot expose arbitrary tables or queries.
- MaxQI remains on its old backend. `/api/published/[token]` is a future consumer seam only. No production integration or flag changes made.

## Product flow

Register → Auth trigger creates profile + Personal Workspace + owner membership → authenticated map → location or map point → observation/text/photos → durable device queue → signed upload → Storage object verification → database record → other devices refresh.

## Web modules

`src/lib/supabase`: SSR and browser auth adapters; future native Auth can replace session transport without changing the domain.
`src/lib/workspace`: current active membership resolution; future workspace selector can use `lb_workspace` cookie but must always validate membership.
`src/lib/field-queue`: IndexedDB Blob/draft persistence keyed by user and workspace; pending/uploading/uploaded/failed state. No offline tiles.
`src/lib/native-bridge`: versioned message contract and location validation.
`src/lib/map`: generic geometry and copied ArcGIS adapter.
`src/app/api`: authenticated field, map, layers, saved views and manager-only sharing routes.
`src/lib/import`: pure mapping/transform independent of source credentials.

## Operational separation

Existing MaxQI and PROS Supabase refs are hard-blocked in runtime and migration helpers. No legacy password/cookie support. No MaxQI domain or database fallback. Public credentials only in web/iOS clients. Domains are configurable; private exports, import keys and local env files are excluded from Git.

## Future extension

Membership roles and normalized workspace records support teams without one database per user. Projects/tags/comments/custom fields/documents/billing/audit/webhooks remain future work. No billing now. Additional workspaces and role management should use a carefully audited manager service/RPC; client membership escalation is blocked in v1.
