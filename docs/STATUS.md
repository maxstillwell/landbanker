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

Alpha 2 implementation **27bfe5ada32aed23e0a13c624d6a63c883d4037e** is published; Main and Preview READY. Cloud run **37552658585** completed successfully: Web and all four iPhone/iPad Debug/Release jobs passed. Software hardening is verified locally and in cloud CI; physical and distributed-public-perimeter acceptance is not complete. Further official sources and transactional change-feed reconciliation remain next work.

## Build status

Alpha 2 implementation **27bfe5a**, cloud run [37552658585](https://github.com/maxstillwell/landbanker/actions/runs/37552658585): Web lint/typecheck/unit/DB/build/browser workflows and all four unsigned iPhone/iPad Debug/Release jobs PASSED. Previous Preview implementation b08cfb4 also passed run 37552131375; the Main-only read socket reset is handled by one bounded ECONNRESET retry, verified with a deterministic reset server; HTTP errors are never retried.
Local latest: lint/types, 18 core + 3 private-media cache unit tests, disposable PostgreSQL RLS including viewport/expiry, Next production build and all nine integrated browser/import regressions PASSED. Tests are isolated local Auth/Postgres/Storage with synthetic users. Physical device results are not inferred from simulations.
Scale acceptance: 500 parcels, 500 observations, 502 user Features, ten active official references. Pan/selection/edit window 21 viewport requests, 622,830 response bytes; ten browser frames 669 ms. Full-layer edit retained all 502 identities. First-page bytes 68,560/45,758/48,406 and timings 171/120/176 ms. Synthetic local baseline only; see PERFORMANCE.md.

## Deployment

Main: https://landbanker.vercel.app
Preview: https://landbanker-git-preview-maxstillwells-projects.vercel.app (may require Vercel access).
Main/Preview implementation 27bfe5a READY (Main dpl_8jHgNV58xXduhpXdYVC8DSau5B44; Preview dpl_Bghu6KC5H4c4Rw512nAHXfKLirj9). Hosted login HTTP200/LandOS branding and unknown-share HTTP404/no-store checks pass. Previous b08cfb4 deployment runtime error/fatal count was empty at review; this is limited traffic evidence, not exhaustive monitoring. URLs/credentials remain environment configured. API publication fallback preserves commit/tree hashes, rejects concurrent changes and never force-pushes. No MaxQI deployment/domain changes.

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

Read STATUS/ARCHITECTURE/PRODUCT/ACCEPTANCE; implementation 27bfe5a is verified by cloud run 37552658585 and both deployments. Next finish authoritative NSW FSR/Height usage/coverage review (do not enable before review), then add through an own-backend additive catalog migration. Improve viewport UI deltas with deletion reconciliation and query-plan baselines; complete distributed Web/direct-RPC abuse controls and multi-instance tests; refine Property planning/relations. Execute ACCEPTANCE device matrix when signing becomes available. No full MaxQI import or production cutover.

## MaxQI safety verification

2026-10-07 read-only homepage and both protected Land routes: HTTP200 with expected access redirects. This is endpoint health, not exhaustive legacy acceptance. No MaxQI schema/Auth/RLS/Storage/API/publishing/source changes, full import or cutover in Alpha 2.

CI transport validation: deterministic local reset server confirms maxRetries=1 recovers exactly one ECONNRESET and never retries/hides HTTP500. The scale geometry regression still passes and retains 502 IDs. No application/database/iOS behavior change in this fix; CI pipefail retained and cookie/authorization output redacted.

## Alpha 3 current checkpoint — P0–P3 implemented

- P0: authenticated Property-specific official VIC/NSW planning intersection with true clipped area/coverage, multipart/holes, raw control values, provenance and distinct no-result/nonintersection/unavailable/failed/unsupported states. No-result is explicitly not proof of no restriction. Live public Ballarat/Dunoon source reads are documented separately from deterministic CI fixtures in PLANNING.md.
- P1: FSR/Height official pages establish CC Attribution and Weekly metadata. Dictionary downloads HTTP403 and latest legend HTTP502 block special/missing-value interpretation; both catalog entries remain disabled with release_checklist/reasons. Existing ten sources remain enabled beta. No invented height units/FSR interpretation.
- P2: saved Property full-boundary retrieval/persistent highlight, stable tiny-parcel centroid, Lot/Plan/source Overview and scoped paged Linked vs Nearby Field / Linked vs Spatially intersects Analysis / Saved View relations. Proximity never creates a relationship. Raw legacy metadata stays out of detail/map/relations payloads.
- P3: transactional per-Workspace revision allocation and retained deletion tombstones, RLS/read-only change tables, stable-watermark paging and automatic visible-map polling/focus refresh. Real two-browser create/update/delete reconciliation passes without reload. Media deletion refreshes the parent Observation; it never removes a surviving parent. The update-only timestamp no-op case avoids whole-layer invalidation storms. See SYNC.md for caps/retention/throughput limits.
- P4 foundation: reviewed staged Firewall JSON and SHARE_PERIMETER.md. Vercel active config GET and PUT both returned HTTP404 SeawallConfig not found; no rule applied. Current direct token-only Supabase RPC remains intentional, not gateway-protected. Distributed/direct-RPC acceptance is **open**, not launch-ready.

### Alpha 3 verification

Local PASS: lint/typecheck, 18 core + 9 planning/sync + 3 private-media unit tests, disposable PostgreSQL RLS including event forgery/tenant isolation/stable pages/media-parent invalidation, production build, all eleven browser/API/import workflows. After the final additive SQL fix, the targeted two-device/media-removal browser test also passed. Imports in tests are synthetic local source copies only; no new MaxQI import.

500-record regression: 500 parcels, 500 observations, 502 Features, ten persisted active layers. Latest full-suite pan window: 21 viewport requests, 686,020 response bytes, ten-frame timing 755 ms; first-page bytes 68,584/45,761/48,773 and timings 166/99/124 ms. Complete-layer editing retained 502 IDs. Synthetic local results, not physical/network production acceptance. The scale test explicitly exercises bounded overview snapshots and lazy full-geometry detail, rather than the compatibility full-layer endpoint.

Hosted additive migrations: catalog_release_review 20261007022214 (local 20261007021952), workspace_change_feed 20261007024059 (local 20261007022915), media_change_invalidation 20261007025256 (local 20261007030000). No existing migration was rewritten. Own-backend owner-positive/nonmember-negative/anon-denial rollback checks pass. There are now 16 exposed business/catalog/sync tables, all RLS-enabled. Advisors retain intentional share resolver/status anon/auth SECURITY DEFINER findings and leaked-password protection disabled; no new missing-RLS finding. No claim of concurrent-write throughput stress testing.

Alpha 3 source publication/cloud CI/deployment: pending this checkpoint's commit. Hosted app remains Alpha 2 until a new deployment is READY. Earlier Alpha 2 status above is historical and does not imply Alpha 3 deployment or launch approval.

### Known Alpha 3 limits / exact next step

Verify cloud CI and Main/Preview after publishing this tested P0–P3 unit. Then implement and provision a server-only least-privilege share gateway/shared budgets, test staged deployment before revoking old anon/auth RPC grants, and resolve independent LandOS Firewall configuration access (404) without changing MaxQI. Continue provider health/observability and selection/search refinements; real iPhone/iPad matrix only when signing is available. Do not mark Alpha 3 exit criteria complete until distributed/multi-instance/direct-RPC acceptance passes. Do not prune sync tombstones without a reset contract; 500/category viewport caps and explicit snapshots remain bounded reconciliation paths. No full import/photo copy/cutover.

MaxQI: no schema/Auth/RLS/Storage/API/publishing/site/data-source changes, no new source import or file copy in Alpha 3. All writes in this phase target only independent LandOS or disposable local fixtures.
