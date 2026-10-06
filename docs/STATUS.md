# LandOS status

Updated: 2026-10-06 UTC. Resume with STATUS.md, PRODUCT.md and ARCHITECTURE.md. **NEVER BREAK MAXQI.** Historical checkpoint notes are in STATUS_HISTORY.md; this file is the current state.

## Completed

- Independent product branding **LandOS — The operating system for land.** Web and iOS share Leaflet through persistent WKWebView; CoreLocation supplies GPS, not a separate Apple map.
- Independent public repository `maxstillwell/landbanker` (source/docs publication explicitly authorized), Vercel project and Supabase project `gksyipjxhrolsgztfyer`. Stable repository/domain/database/bridge identifiers retained. Files owned by current agent user/group.
- Supabase signup/login/logout/recovery/persistent session; Personal Workspace, membership-based RLS, private photos/signed upload, scoped durable device draft/retry foundation. User reports hosted login success.
- VIC/NSW address search, official cadastral boundary, metric area, source provenance and idempotent Save to Workspace. Live address lookup/save/reopen verified against both official sources; state coverage is explicitly limited.
- Point/Line/Polygon/Rectangle, area/distance, draggable vertices, Undo, named shape/note saved into My Layers, normalized Features and atomic RLS-protected save. Finished device drafts persist; imported holes/multipart are preserved rather than silently simplified.
- Ten enabled official VIC/NSW catalog sources; search/add/remove/visibility/opacity and per-user Workspace preferences. Live VIC flood and NSW zoning image exports verified. No claim of nationwide or NSW flood coverage.
- Compact safe-area header, verified Workspace selector, contextual selection/inspector, peek/half/full phone sheet, clear Locate/Follow and accuracy, map resize handling, iPad landscape 70/30.
- Saved View explicit resource/layer/viewport restore; expiring/revocable read-only public link. Frozen Feature manifest excludes later additions. Public projection strips private notes/extra geometry metadata and uses publishable credential plus token-only database RPC.
- Limited hosted MaxQI **10-source-record test only**: 4 parcels, 1 observation, 2 media metadata, 3 layers / 7 derived Features = 17 target records. Dry run, insert-only copy, mapping verification, repeat/no-overwrite and fresh source-unchanged comparison passed. Original files untouched; media remains legacy_pending. Source contains no NSW parcel or parcel-linked observation; NSW layers used instead, no invented relationships.

## In progress

Alpha 2 hardening is in progress. P0 unfinished drawing recovery and simple geometry editing are implemented and verified locally. P1 non-signing TestFlight preparation is ready; physical acceptance remains pending Apple signing. Next: P2 parcel search and saved-property management. No full MaxQI import/cutover.

## Build status

Verified implementation checkpoint **0718dd6**, cloud main run **37395648724**: all Web + unsigned iPhone + iPad jobs PASSED. Both Vercel Main/Preview READY. Follow-up documentation commits do not change this verified implementation.
Alpha 2 local lint/types/13 unit tests/disposable PostgreSQL RLS/production build/full Field+spatial+public sharing+both import adapters+native/Web photo-batch+500-record/ten-layer regression PASSED. Prior native Swift photo-batch changes compile for both Simulator types. New Debug/Release iPhone/iPad CI matrix is awaiting cloud validation.
Tests use isolated local Auth/Postgres/Storage and synthetic accounts. Simulator builds/bridge simulation do not prove physical camera/HEIC/lock/background acceptance. Read ACCEPTANCE.md before manual testing.

## Deployment

- Main: https://landbanker.vercel.app
- Preview: https://landbanker-git-preview-maxstillwells-projects.vercel.app (may require Vercel access).
- Main and Preview serve the verified implementation 0718dd6; checkpoint documentation is subsequently fast-forwarded without app-code changes. No MaxQI deployment/domain changes.
- Auth/App URLs configured through environment. HTTPS git push is unavailable; scripts/push-via-api.py preserves commit hashes, rejects concurrent remote changes and never force-pushes.

## Database status

Independent hosted PG17.11, active healthy, 14 public tables with RLS, private field-media bucket. Hosted foundation/index history differs in timestamp from local baseline: do not replay initialization or blindly db push.
Additive hosted migrations: parcel_provenance, layer_features, layer_catalog, scoped_share_projection, catalog_expansion. All also tested locally. No PostGIS installed; valid GeoJSON JSONB retained.
Hosted owner-positive/nonmember-negative rollback assertions pass. Advisor has two intentional SECURITY DEFINER token-resolver execution warnings and leaked-password protection disabled; reviewed/documented, not warning-free. No missing-RLS finding.

## Known issues

- Raw Web HEIC preview has an explicit retained-photo/original-file fallback; native photos normalize to JPEG. Real HEIC device acceptance remains pending.
- Real signed iPhone/iPad device checks still required: Camera/PhotosPicker, HEIC/large photos, lock/background/close/relaunch, expired session and device password recovery. Desktop/Web local sync passes; real hosted photo/device acceptance remains separate.
- Unfinished drawings now persist immediately in scoped IndexedDB with Continue/Discard; simple geometry supports 44px hit targets, translation, insertion/deletion and one-edit Undo. Holes/multipart/dense imported geometry remains explicitly view-only.
- Address-first search; parcel identifier search, more road-name cases and broader state providers need expansion. Source response availability is external.
- Ten catalog layers; more official sources, Satellite/provider licensing and reorder need expansion. Owner development access is full; commercial gating enforcement remains future work, no billing.
- Paging limits UI to 1,000 records/category, API 100/page; optional bbox filters location points only, not spatial intersection. Whole layer GeoJSON still travels with its page. Incremental refresh/delta/cursor and PostGIS/indexed viewport loading remain next performance work.
- Limited-copy files are metadata only, not duplicated Storage objects. No full import until schema stabilizes and explicit milestone authorization. Public sharing perimeter rate limiting must be configured before broad launch.

## External blockers

Apple Developer signing/TestFlight credentials required only for real-device distribution. Supabase access is resolved; no backend access blocker. No blocker justifies changing MaxQI.

## Next / exact resume step

Continue P2: inspect authoritative VIC/NSW search fields, handle multi-word/unit/punctuation address cases, add only verified parcel identifiers, strengthen canonical save identity and saved-property management. Then P3 layer quality/order/legend, P4 viewport/incremental queries and P5 share hardening. Read ACCEPTANCE.md and TESTFLIGHT.md; do not execute full MaxQI import or production cutover.

## Latest continuation

Catalog expansion migration 20261006003749 is hosted/local applied: Victoria All Overlays and NSW EPI Lot Size, enabled total ten. Local scale test passes 500 parcels/polygons + 500 observations with ten persisted active layer preferences. Native and Web file-picker batches persist expected/received counts before ingestion; incomplete/rejected selections require explicit recovery. Full local regression passes. Physical iOS acceptance checklist is in ACCEPTANCE.md.

MaxQI homepage and both protected Land routes checked read-only: HTTP200 with expected access redirects. This proves endpoint health, not every legacy workflow. No production MaxQI changes; limited-copy source rows and original files verified unchanged.


## Alpha 2 local checkpoint

P0 production-browser regression passed polygon/line interruption and explicit recovery/discard, account/Workspace isolation, translation/Undo, midpoint insertion, safe vertex deletion, exact saved/reopened geometry, and rectangle translation. Existing full Field/spatial/import/photo/paging/share regression also passed against isolated local services. P1 adds configurable signing/bundle settings, Release configuration, four unsigned Simulator CI jobs, physical-device checklist and Web HEIC preview fallback. Cloud validation is pending publication of this checkpoint. No hosted schema or MaxQI changes in this unit.
