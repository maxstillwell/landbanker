# MapLibre workflow continuation

Resume branch: `codex/landos-map-foundation-rebuild`.
Verified remote starting checkpoint: `0ea31bc8e4d905673be1ffe6855eb99f719f041b`.
Pre-integration main/rollback reference: `d23121c3c7c5c408d9e159ec362538707d0d64a2`.

The owner authorized completion, testing, safe main integration, push and deployment on 27 October 2026. Earlier document approval gates are superseded for this work. Do not change MaxQI, Supabase security or hosted data; do not force-push or add paid services.

## Implementation checkpoints

- `7fe79b2`: pushed to the existing rebuild branch; established drawing, Field, Saved Views, viewport sync and Inspector moved to one MapLibre scene; catalog/public overlay adapter and native edit interactions added.
- Following checkpoint: same-origin MapLibre 6 worker, accessible GPS marker, scoped camera/basemap restore, public token-safe referrers, responsive container fix, obsolete renderer removal and dedicated MapLibre browser regression.

## Completed implementation

1. Drawing/edit/move/vertex insertion/deletion/Undo, account/Workspace recovery and whole-layer save logic retained. Complex/holed/multipart or over-200-vertex imports remain view-only as before.
2. Field GPS, native/web photo ingestion, private-media signing/upload and durable scoped offline/retry queue reused unchanged. GPS accuracy is a metre-radius polygon with an accessible native MapLibre point.
3. Existing Saved View scope/preview/save/visibility/official-layer restore retained. Restore resets the scene to its supported 2D camera contract. Device camera/basemap state is scoped to account/Workspace.
4. Public frozen projections render on MapLibre, including official catalog raster references. Source requests use origin-only referrers, never the share token.
5. Official direct VIC/NSW query controls, geographic picking and provenance retained; catalog order/opacity/preferences and Property Planning/related-record Inspectors reused.
6. Old experiment route redirects; Leaflet packages, old export adapter and dual-engine canvas components removed.

## Validation evidence

- Lint/typecheck/unit/build checks are being repeated after final source changes. Unit suite contains 37 tests, including metre-accuracy circles and Web Mercator official tile envelopes.
- Disposable PostgreSQL security/RLS/gateway and concurrent-writer regressions PASS. No hosted schema/security change.
- Individual Field, spatial/drawing save, drawing recovery/edit and dedicated native MapLibre regressions PASS. Native regression checks one canvas, official geometry picking, 2D/3D camera transition, scoped restoration, Saved View preferences and public official requests without token disclosure.
- Full twelve-workflow production-build run remains required before main integration. Workflow browser tests use synthetic basemap/provider fixtures and real disposable Auth/PostgREST/Storage. They are not live-government-source visual acceptance or physical-device acceptance.

## Release tasks

Run final checks and all twelve regressions against `next start`. Commit/push exact source, fetch/check main, merge without force-push after critical checks pass, and inspect GitHub CI/deployment evidence. Do not describe deployment as verified until the production revision and endpoints are confirmed.

## Known limitations

No offline basemap download, dense/multipart editing, real terrain DEM, verified 3D buildings, or physical iPhone/iPad acceptance is added. Official services remain dependent on coverage/provider availability; no result is not no restriction. Existing viewport/sidebar caps and disabled NSW FSR/Height release decisions are preserved. Public projection does not expose catalog ordering positions, so public reference order follows the existing projection order.

## Environment evidence

The initial checkout was old main, not the requested branch. Fetched and switched to the exact verified checkpoint without changes. Git network commands need the execution sandbox's escalated network path to reach the configured proxy. The local test configuration points exclusively to `127.0.0.1:54321`. No hosted database work is authorized or needed.

Vercel production/API and `api.github.com` are blocked by the enforced network policy (CONNECT 403); no Vercel credentials/outbound identities are configured. Git fetch/push works and public GitHub HTML is readable. Production target recorded by the project is `https://landbanker.vercel.app`; this is not yet a verified deployment for the new implementation.

The local test image registry `public.ecr.aws` is blocked. Matching Auth and Storage versions were obtained from `supabase/*` Docker Hub mirrors, PostgREST from its official Docker Hub repository and Kong from the official `kong:2.8.1` image, then tagged locally for the unchanged compose definition. This affects only disposable local fixtures.
