# MapLibre workflow continuation

Resume branch: `codex/landos-map-foundation-rebuild`.
Verified remote starting checkpoint: `0ea31bc8e4d905673be1ffe6855eb99f719f041b`.
Pre-integration main/rollback reference: `d23121c3c7c5c408d9e159ec362538707d0d64a2`.

The owner authorized completion, testing, safe main integration, push and deployment on 27 October 2026. Earlier document approval gates are superseded for this work. Do not change MaxQI, Supabase security or hosted data; do not force-push or add paid services.

## Implementation checkpoints

- `7fe79b2`: pushed to the existing rebuild branch; established drawing, Field, Saved Views, viewport sync and Inspector moved to one MapLibre scene; catalog/public overlay adapter and native edit interactions added.
- `e392c34`: same-origin MapLibre 6 worker, accessible GPS marker, scoped camera/basemap restore, public token-safe referrers, responsive container fix, obsolete renderer removal and dedicated MapLibre browser regression.
- `4a3bf0c`: official references keep querying/rendering across Inspector tabs; picking opens the Layers Inspector; provider waits are bounded to 12 seconds. Dedicated cross-tab regression and full twelve-workflow production-build suite PASS.
- `5cd203f`: disposable test compose uses verified Docker Hub sources for the same Auth/PostgREST/Storage/Kong versions. No hosted Supabase configuration/security is modified. Startup and the real Field/private Storage/retry/share regression PASS after the image-source change.

## Completed implementation

1. Drawing/edit/move/vertex insertion/deletion/Undo, account/Workspace recovery and whole-layer save logic retained. Complex/holed/multipart or over-200-vertex imports remain view-only as before.
2. Field GPS, native/web photo ingestion, private-media signing/upload and durable scoped offline/retry queue reused unchanged. GPS accuracy is a metre-radius polygon with an accessible native MapLibre point.
3. Existing Saved View scope/preview/save/visibility/official-layer restore retained. Restore resets the scene to its supported 2D camera contract. Device camera/basemap state is scoped to account/Workspace.
4. Public frozen projections render on MapLibre, including official catalog raster references. Source requests use origin-only referrers, never the share token.
5. Official direct VIC/NSW query controls, geographic picking and provenance retained; catalog order/opacity/preferences and Property Planning/related-record Inspectors reused.
6. Old experiment route redirects; Leaflet packages, old export adapter and dual-engine canvas components removed.

## Validation evidence

- Final lint, typecheck and production `next build --webpack` PASS. All 37 unit tests PASS, including metre-accuracy circles and Web Mercator official tile envelopes.
- Disposable PostgreSQL security/RLS/gateway and concurrent-writer regressions PASS. No hosted schema/security change.
- Individual Field, spatial/drawing save, drawing recovery/edit and dedicated native MapLibre regressions PASS. Native regression checks one canvas, official geometry picking, 2D/3D camera transition, scoped restoration, Saved View preferences and public official requests without token disclosure.
- All twelve browser/API/import workflows PASS against the final `next start` build. This includes 500 parcels/500 observations, complete-layer 502-feature editing, drawing recovery, Field/photos/retry, parcel search/identify, Saved Views and frozen shares/revoke/expiry/rate limits, Planning tenant guards, two-device create/update/delete reconciliation and native MapLibre rendering/restoration/public overlays.
- Workflow browser tests use synthetic basemap/provider fixtures and real disposable Auth/PostgREST/Storage. They are not live-government-source visual acceptance or physical-device acceptance. Native MapLibre tests verify real geometry picking with the version-matched local worker.
- Cloud run `40440276372` for `e392c34` passed all four unsigned simulator builds but failed while bootstrapping the disposable backend, before browser tests. The verified-image fix is under independent CI run `40441056691`; await its result before main integration.

## Release tasks

Local required checks and twelve production-build regressions are complete. Await independent CI for the tested-image fix, then fetch/check main and merge without force-push. The owner already authorized main integration and deployment. Inspect main CI and deployment evidence; do not describe deployment as verified until its production revision and endpoints are confirmed.

## Known limitations

No offline basemap download, dense/multipart editing, real terrain DEM, verified 3D buildings, or physical iPhone/iPad acceptance is added. Official services remain dependent on coverage/provider availability; no result is not no restriction. Existing viewport/sidebar caps and disabled NSW FSR/Height release decisions are preserved. Public projection does not expose catalog ordering positions, so public reference order follows the existing projection order.

## Environment evidence

The initial checkout was old main, not the requested branch. Fetched and switched to the exact verified checkpoint without changes. Git network commands need the execution sandbox's escalated network path to reach the configured proxy. The local test configuration points exclusively to `127.0.0.1:54321`. No hosted database work is authorized or needed.

Vercel production/API and `api.github.com` are blocked by the enforced network policy (CONNECT 403); no Vercel credentials/outbound identities are configured. Git fetch/push works and public GitHub HTML is readable. Production target recorded by the project is `https://landbanker.vercel.app`; this is not yet a verified deployment for the new implementation.

The local test image registry `public.ecr.aws` is blocked. Matching Auth and Storage versions were obtained from `supabase/*` Docker Hub mirrors, PostgREST from its official Docker Hub repository and Kong from the official `kong:2.8.1` image. These tested sources now appear directly in the disposable compose definition; all runtime/security settings are unchanged. This affects only disposable local fixtures.

A network-only environment draft was saved using the supported setup workflow. It adds `api.github.com`, `api.vercel.com`, `landbanker.vercel.app`, `tiles.openfreemap.org` and the four configured VIC/NSW official query hosts. The existing package-manager preset and scripts are preserved. The tool reports `requires_publish: true`; the draft is not active runtime access. The user must publish/apply it in environment settings before blocked deployment/live-source verification can resume. No credential values were requested or saved.
