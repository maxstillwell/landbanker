# LandOS status

Updated: 2026-10-07 UTC. Resume with STATUS.md, ARCHITECTURE.md, PRODUCT.md and ACCEPTANCE.md. **NEVER BREAK MAXQI.**

## Completed

- Independent LandOS Web/iPhone/iPad product, repository maxstillwell/landbanker, independent Vercel and Supabase gksyipjxhrolsgztfyer. Same Leaflet workspace in Web/WKWebView; native CoreLocation/Camera/PhotosPicker. Source/docs public publication is authorized; no private exports/secrets/photos committed. Current user/group ownership retained.
- Supabase signup/login/logout/reset/persistent session, Personal Workspace and membership RLS, private Storage and scoped durable Field queue. Existing Field/desktop sync/photo/native-batch/security regression remains passing.
- Alpha 2 P0: unfinished Point/Line/Polygon/Rectangle and edit sessions persist immediately with account/Workspace/type/coordinates/name/layer/timestamps/one Undo snapshot. Explicit Continue/Discard; 44px hit targets; safe translation, midpoint insertion, minimum-count deletion and Undo. Exact save/reopen tested; imported holes/multipart/dense geometry is explicitly view-only.
- P1: configurable Bundle/team, LandOS display name, permission strings, Release/archive settings, Debug/Release iPhone/iPad unsigned CI, TESTFLIGHT.md and complete pending physical ACCEPTANCE matrix. Native JPEG normalization retained; Web raw HEIC has a retained-photo/original-file fallback.
- P2: multi-word/unit/punctuation address parsing and explicit VIC/NSW choice/results; authoritative PFI/CADID and supported Lot/Plan query patterns. Live Ballarat/Dunoon/Old Northern Road and PFI/CADID verified. Canonical save = Workspace + state + official ID, repeat does not overwrite edits/duplicate. Saved-property filter/source/open/removal; FK-linked records block removal and cross-tenant deletion fails.
- P3: ten enabled authoritative catalog sources retained, atomic per-account/Workspace move up/down, topmost list layer renders above others, opacity/visibility/order restore. Provider/state/category/update/scope info and bounded lazy official PNG legend; live VIC flood legend verified. NSW FSR (service layer 1) and Height (5) metadata/PNG exports additionally checked, not yet enabled pending completed usage/coverage review.
- P4: indexed generated PostgreSQL box/GiST envelopes, SECURITY INVOKER candidates and exact API line/polygon/hole intersection; bbox/zoom/cursor/updated_since/limit contract. Map uses bounded viewport pages with debounce/dedupe/cancel/cache; overview pages omit whole GeoJSON. Lazy complete-layer reads before every merge/delete preserve off-screen features. Scoped signing cache with concurrency/scope/TTL/failure regression.
- P5: no-write share preview with explicit counts/exclusions; changed scope hash requires review; frozen feature IDs and 5,000-feature ceiling. Manager list/date/expiry/scope/copy/revoke; URL retained only in scoped device IndexedDB, DB hash only. Token-only expiry status, immediate no-store revoke/expiry, fixed expired message, bounded per-instance public Web/API rate budgets tested. Distributed/direct-RPC controls remain launch work.
- P7 foundation: Property Overview/Planning/Layers/Field/My Analysis components, explicit property-linked Field creation/reopen and FK-protected removal. Planning controls are not falsely presented as parcel-specific results. No CRM/valuation/documents.
- Existing MaxQI import remains only the previously verified 10-source-record test (17 derived target records); media metadata only, legacy_pending. Safe bounded/idempotent dry-run importer/mapping regression passes. No new import, source file copy, full migration or cutover.

## In progress

Alpha 2 source b08cfb4 is published and Main/Preview READY. Cloud run 37552017543: all four iOS jobs passed; Web hit a loopback socket reset at the scale test final read. A bounded read-only ECONNRESET retry and redacted server diagnostics are prepared; rerun cloud validation. Software hardening is locally verified; physical and distributed-public-perimeter acceptance is not complete. Further official sources and transactional change-feed reconciliation remain next work.

## Build status

P0/P1 implementation **492ff40**, cloud run **37548356471**: Web + all four unsigned iPhone/iPad Debug/Release jobs PASSED. b08cfb4 source deployed READY. Web CI transport fix is being published; do not report cloud Web PASS until the new run passes.
Local latest: lint/types, 18 core + 3 private-media cache unit tests, disposable PostgreSQL RLS including viewport/expiry, Next production build and all nine integrated browser/import regressions PASSED. Tests are isolated local Auth/Postgres/Storage with synthetic users. Physical device results are not inferred from simulations.
Scale acceptance: 500 parcels, 500 observations, 502 user Features, ten active official references. Pan/selection/edit window 21 viewport requests, 622,830 response bytes; ten browser frames 669 ms. Full-layer edit retained all 502 identities. First-page bytes 68,560/45,758/48,406 and timings 171/120/176 ms. Synthetic local baseline only; see PERFORMANCE.md.

## Deployment

Main: https://landbanker.vercel.app
Preview: https://landbanker-git-preview-maxstillwells-projects.vercel.app (may require Vercel access).
Main/Preview source b08cfb4 READY; anonymous hosted login/unknown-share status checks pass, recent new-deployment error/fatal log count is empty. Cloud Web transport fix publication is pending. URLs/credentials remain environment configured. API publication fallback preserves commit/tree hashes, rejects concurrent changes and never force-pushes. No MaxQI deployment/domain changes.

## Database status

Hosted independent PG17.11; 14 exposed business/catalog tables with RLS, private field-media. No PostGIS. New own-backend migrations hosted/local applied: viewport_foundation (local 20261006235348, hosted 20261007001027), share_status (local 20261007000311, hosted 20261007001040). Prior foundation/provenance/Features/catalog/share projection/catalog expansion remain intact. Hosted history timestamps differ from repo: do not blindly replay initialization/db push.
Hosted owner-positive/nonmember-negative viewport and anonymous execution denial rollback checks PASS. Advisor: both token-only capability functions have intentional anon/auth SECURITY DEFINER execute findings; leaked-password protection remains disabled. No missing-RLS finding; see SECURITY.md/remediation links.

## Known issues / remaining work

- Signed physical iPhone/iPad acceptance, App Store assets/privacy/review and Apple credentials remain required; device matrix is Pending. No real camera/HEIC/lock/rotation/relaunch pass claimed.
- Browser HEIC codec support varies; original retained, native safe JPEG path unchanged.
- Complex holes/multipart/dense imported geometry remains view-only; simple edit limit 200 vertices.
- Address/state/provider availability and unsupported identifier variants remain explicit. Inspector paging capped at 1,000/category; viewport matching capped at 500/category. Delta API works; UI uses bounded snapshots until deletion tombstones/transactional change-feed semantics are implemented.
- Ten enabled official sources; FSR/Height technical verification is documented in LAYERS.md. Finish usage/coverage review before catalog enablement; broader risk/growth coverage and Satellite remain future work.
- Public limiter is process-local, not distributed. Vercel WAF and direct Supabase RPC controls must be completed before broad launch; exact requirements in SECURITY.md. No public projection cache can delay revoke/expiry.
- Property-specific planning intersection and exhaustive linked-resource paging/analysis associations remain foundation work. Test-import media remains legacy_pending; no full import while schema is evolving.

## External blockers

Apple Developer/team/signing/App Store Connect agreement needed for signed device distribution only. Supabase access resolved. Do not ask for secrets in chat/source or pause other work for signing.

## Next / exact resume step

Check published Alpha 2 commit Web + four iOS CI jobs and both Vercel deployments, fix any actual regression. Then finish authoritative NSW FSR/Height usage/coverage review and enable through an additive catalog migration, improve viewport UI deltas with deletion reconciliation and query-plan baselines, complete distributed Web/direct-RPC abuse controls, refine Property planning/relations. Execute ACCEPTANCE device matrix when signing becomes available. No full MaxQI import or production cutover.

## MaxQI safety verification

2026-10-07 read-only homepage and both protected Land routes: HTTP200 with expected access redirects. This is endpoint health, not exhaustive legacy acceptance. No MaxQI schema/Auth/RLS/Storage/API/publishing/source changes, full import or cutover in Alpha 2.

CI transport validation: deterministic local reset server confirms maxRetries=1 recovers exactly one ECONNRESET and never retries/hides HTTP500. The scale geometry regression still passes and retains 502 IDs. No application/database/iOS behavior change in this fix; CI pipefail retained and cookie/authorization output redacted.
