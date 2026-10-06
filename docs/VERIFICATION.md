# Verification — 2026-10-04

All work runs as uid/gid 1000, `agent:agent`; application source files retain that ownership. Independent source is `/workspace/land-banker`. No edits or writes to MaxQI production.

## Passed

- `npm run lint`: no errors or warnings.
- `npm run typecheck`: Next.js route type generation + TypeScript.
- `npm test`: seven meaningful validation/import/token/IndexedDB tests, including partial photo-upload recovery and account-scoped durable layer drafts.
- `npm run db:test`: real PostgreSQL 17, disposable container. Signup trigger, owner/viewer/suspended/anonymous access, cross-tenant reads/inserts, cross-workspace foreign keys, membership escalation, Storage isolation, immutable workspace and share scope/token, revoke.
- `npm run build`: optimized Next.js 16.3.8 production build, all application/API/auth/share routes compiled.
- `npm run local:start`: reproducible isolated GoTrue + PostgREST + Storage + Kong + Mailpit stack; no remote projects contacted.
- `npm run test:e2e`: real browser against real local services. Signup and Personal Workspace; Locate Me with mocked browser GPS ±8 m; text + actual PNG bytes → private signed Storage upload → completion check → another independently logged-in desktop context sees same database record; refresh preserves session; temporary API outage preserves record/photo through reload and explicit retry; other user sees empty own Workspace; foreign Origin rejected; logout protects map; Mailpit recovery email/PKCE/password update/new password login; layer/save-view APIs; anonymous explicit layer share reads only selected resource, revoke returns 404.
- Copy-only full private MaxQI snapshot into LOCAL test Workspace: 62 parcels, 1 observation, 2 pending media metadata rows, 12 layers, 26 features = 103. Interrupted run resumed safely; repeat apply creates 0; verify checks all 103 destination identities/workspaces/mappings. Existing relationships constrained by composite foreign keys. Original source data/files untouched.
- Synthetic importer exercises actual database copy twice and verify, preserving destination title edits and pending source media mapping.

Browser screenshots are ignored artifacts (synthetic test data only): iPhone, desktop, iPad landscape. Map tiles depend on internet; offline tiles are outside this milestone.

## Not verified / unavailable

- Independent hosted Supabase: creation rejected by active free-project capacity. Local tests do not replace cloud migration/advisor/confirmation/SMTP checks.
- Independent GitHub remote/CI initially unavailable on 2026-10-04; resolved by user-created repo and source publication on 2026-10-05. Current hosted results below supersede the initial limitation.
- Vercel Preview originally unavailable on 2026-10-04; main and Preview deployments are now READY. Current hosted results below.
- iOS compilation originally unverified on 2026-10-04; macOS iPhone/iPad unsigned Simulator builds passed on 2026-10-05. Simulator launch and real GPS/camera/Photos/session relaunch behavior still need validation.
- No cloud copy into Max's actual Workspace. No actual legacy media file copying. No MaxQI cutover.

## Hosted results — 2026-10-05

Independent source/history published to user-approved Public maxstillwell/landbanker; all recreated tree/commit hashes matched local originals. Vercel main and preview deployments READY; landing/signup HTTP 200 and backend-unconfigured message verified. Hosted signup/database/Storage end-to-end checks are pending connector access, not counted as passed.
GitHub run 37247783731: iPhone and iPad unsigned Simulator builds passed; Web lint/types/unit passed, then database readiness race failed. Fixed final TCP readiness in 20f33ca; local PostgreSQL RLS recheck passed, cloud run 37248285240 passed Web (including real local Auth/Storage/browser field tests), iPhone and iPad builds after the readiness fix. GitHub .app artifacts do not verify real-device behavior.

## LandOS spatial milestone — 2026-10-06

Supersedes original infrastructure blockers above: independent backend is ACTIVE_HEALTHY; user reports login success. Main/Preview b0991fd READY, Web + unsigned iPhone/iPad CI runs 37389762173 and 37389823419 passed. All local checks pass for the spatial checkpoint. Live VIC/NSW parcel address→official geometry→area→idempotent save/reload tested, with representative flood/zoning PNG exports.

Phone browser polygon/measurement/name/note/layer save/reopen and catalog add/toggle persistence passed; iPad 70/30 checked. New Saved View anonymous-map test passes exact scope, private-note exclusion, future-feature exclusion and revoke. PostgreSQL tests also cover token hash rejection, immutable Workspace, Feature RPC/preference isolation and no anon general reads. New bounded connector SQL adapter locally tested for safe literals, timestamps, registered-owner guard, repeat/edited-target preservation. Hosted copy limited to 10 source records / 17 target records; dry-run/copy/verify/repeat/source-unchanged checks pass. No actual media file copy, no NSW source parcel (none exists in inventory), no invented parcel relation, no full cloud import/cutover.

Hardware caveat remains: real iPhone camera/HEIC/background/lock/session-expiry/relaunch is not established by browser mocks or unsigned compilation. Pending queue persistence is verified locally; no complete offline map.

2026-10-06 reliability/performance: full local Field/spatial/public-view/two import adapter browser regression passed. New native-batch simulation passes early-save blocking, two private uploaded photos and interrupted-selection recovery after reload. New local scale regression passes 500 parcels/polygons + 500 observations, five stable deduplicated 100-row pages, payload reduction, bbox-point filter, invalid page/bbox rejection and browser Load more. Local response times 164/209/151/116/101 ms; these are not hosted performance claims. Original physical-device acceptance remains pending.

Catalog continuation: 10 active official layers persisted and displayed in inspector with 500 parcels/polygons and 500 observations; local page responses 104/94/96/89/100 ms. New seed migration passes full disposable PostgreSQL RLS regression. Official Victoria All Overlays and NSW Lot Size metadata/PNG export verified. Checkpoint 2407323 Main cloud run 37394863501 passed Web + unsigned iPhone + iPad; both Vercel branches READY.

Final Web file-picker safeguard: multi-photo Web selection now persists progress before EXIF/Blob reading and requires explicit recovery for partial/rejected/interrupted imports. Full local browser regression repeated and passed; Web two-photo save assertion passes alongside native batch and interrupted recovery. Catalog checkpoint 33de6a5 cloud run 37395240685 passed Web/iPhone/iPad, both branches READY. Read-only MaxQI homepage HTTP200 and protected /land + land subdomain access redirects HTTP200 confirmed; no production changes.

Final implementation 0718dd6: cloud main run 37395648724 PASSED Web and unsigned iPhone/iPad jobs, Main/Preview deployments READY. Checkpoint documentation changes afterward do not change verified app code. See ACCEPTANCE.md for physical hardware/browser acceptance and explicit limits.
