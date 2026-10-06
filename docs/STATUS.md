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

Reliability/performance checkpoint completed: prevent early Save while photos import, persist native selected-photo progress, explicitly recover interrupted selections, serial native image reads, bounded 100-row map pages, bulk private-photo URL signing, reduced legacy payloads, optional point-location bbox filter and browser Load more.

## Build status

Published core checkpoint `2407323`: GitHub main run **37394863501** passed Web and unsigned iPhone/iPad Simulator builds; Main and Preview Vercel deployments READY.
Current checkpoint: lint/types/11 unit tests/production build passed. Full local Field/spatial/sharing/import/native-batch/500-record browser regression passed. 500 parcels/polygons + 500 observations return five deduplicated 100-row pages, reduced legacy payloads, local page response 101–209 ms. Native photo-batch Swift changes also compiled successfully for both iPhone and iPad in cloud CI. Catalog expansion: local DB/RLS tests and 500-record/10-active-layer regression passed; live metadata/PNG verified.
Tests use isolated local Auth/Postgres/Storage and synthetic accounts. Simulator builds and bridge simulation do not prove physical iOS camera/HEIC/lock/background acceptance.

## Deployment

- Main: https://landbanker.vercel.app
- Preview: https://landbanker-git-preview-maxstillwells-projects.vercel.app (may require Vercel access).
- Main and Preview currently 33de6a5; catalog expansion cloud run 37395240685 passes all three jobs. Final Web file-picker batch progress safeguard is locally verified and ready for publication; no MaxQI deployment/domain changes.
- Auth/App URLs configured through environment. HTTPS git push is unavailable; scripts/push-via-api.py preserves commit hashes, rejects concurrent remote changes and never force-pushes.

## Database status

Independent hosted PG17.11, active healthy, 14 public tables with RLS, private field-media bucket. Hosted foundation/index history differs in timestamp from local baseline: do not replay initialization or blindly db push.
Additive hosted migrations: parcel_provenance, layer_features, layer_catalog, scoped_share_projection, catalog_expansion. All also tested locally. No PostGIS installed; valid GeoJSON JSONB retained.
Hosted owner-positive/nonmember-negative rollback assertions pass. Advisor has two intentional SECURITY DEFINER token-resolver execution warnings and leaked-password protection disabled; reviewed/documented, not warning-free. No missing-RLS finding.

## Known issues

- Real signed iPhone/iPad device checks still required: Camera/PhotosPicker, HEIC/large photos, lock/background/close/relaunch, expired session and device password recovery. Desktop/Web local sync passes; real hosted photo/device acceptance remains separate.
- Unfinished drawing points are not persisted until Finish; whole-object translation, vertex insertion/removal and dense/multipart editing need expansion. Current editor refuses unsafe geometry simplification.
- Address-first search; parcel identifier search, more road-name cases and broader state providers need expansion. Source response availability is external.
- Ten catalog layers; more official sources, Satellite/provider licensing and reorder need expansion. Owner development access is full; commercial gating enforcement remains future work, no billing.
- Paging limits UI to 1,000 records/category, API 100/page; optional bbox filters location points only, not spatial intersection. Whole layer GeoJSON still travels with its page. Incremental refresh/delta/cursor and PostGIS/indexed viewport loading remain next performance work.
- Limited-copy files are metadata only, not duplicated Storage objects. No full import until schema stabilizes and explicit milestone authorization. Public sharing perimeter rate limiting must be configured before broad launch.

## External blockers

Apple Developer signing/TestFlight credentials required only for real-device distribution. Supabase access is resolved; no backend access blocker. No blocker justifies changing MaxQI.

## Next / exact resume step

Publish the verified catalog follow-up, fast-forward Preview and confirm CI/READY. Then improve unfinished drawing persistence/touch editing, expand legally verified VIC/NSW official catalog, optimize incremental map loading and continue field/device verification. Do not execute full MaxQI import or production cutover.

## Latest continuation

Catalog expanded with Victoria All Overlays and NSW EPI Lot Size through additive independent migration 20261006003749 (hosted/local applied). Ten active layer preference + 500 polygon/parcel + 500 observation browser test passed (local pages 89–104 ms). No new frontend/source credentials, no MaxQI writes. Next safe unit after publication: persist unfinished geometry editing/drawing state using scoped local abstraction, enlarge touch handles and add safe object translation/vertex insertion; then expand official-source coverage and viewport feature loading.

Final Web file-picker continuation: expected/received progress is saved before EXIF reading, rejected or interrupted files require explicit recovery and cannot silently yield a partial successful Save. Local lint/types/production build/full Field+spatial+sharing+imports+Web/native photo-batch+ten-layer scale regression PASS. Current code publication/cloud verification next. MaxQI homepage and protected /land/subdomain routes checked read-only: HTTP 200, correct access redirects. This is endpoint health evidence, not a claim to have exercised every legacy function.
