# Land Banker status

Updated: 2026-10-06 (Australia/Sydney). Resume with this file + ARCHITECTURE.md. **NEVER BREAK MAXQI.**

## Completed

- User reports hosted login success. Fixed OSM tile identification in commit 3ce76e2: app-only origin Referrer-Policy plus explicit Leaflet image policy; share/auth privacy unchanged. Same Leaflet map across Web/WKWebView, native application identifier appended. Details in BASEMAP.md. Lint/types/unit/production build and full local Field browser regression passed, including tile Referer assertion and real map screenshot. Main deployment dpl_CngB1qJ6EicHK5xW2mutLJyUCqcy and Preview dpl_FfAahr6BVhWonCC5RMDwGgPdm7FV READY. Main HTTP map/share headers verified. Web CI (including real field/copy browser workflows) and updated iPhone/iPad Simulator builds all passed in run 37378205490.
- Independent public repository: https://github.com/maxstillwell/landbanker. User explicitly authorized public source/technical docs. All initial local history published with identical commit/tree hashes. Credentials/photos/private MaxQI exports are excluded. Current files retain agent:agent ownership.
- Independent Vercel project landbanker, id prj_afzfCidHE83CGne0ILQBJPKdBBi6, current Vercel team. Main deployment https://landbanker.vercel.app and separate preview branch https://landbanker-git-preview-maxstillwells-projects.vercel.app. Both build successfully; Preview may require Vercel authentication.
- Supabase Auth/workspace/RLS/Storage migration and Web Field MVP verified against real independent LOCAL services: signup/login/recovery/logout, Personal Workspace, GPS, notes/photos/signed upload, desktop sync, durable failed-upload retry.
- Responsive iPhone sheet/iPad inspector/desktop map; GeoJSON/local polygon drafts with durable device storage + Save to Workspace; saved views and secure scoped/revocable share foundation.
- SwiftUI persistent WKWebView/native bridge/location/camera/PhotosUI/network/navigation shell. GitHub macos-15 unsigned iPhone AND iPad Simulator builds passed in run 37247783731; downloadable .app artifacts exist. CI URL defaults to configurable Vercel app URL. These are Simulator builds, not TestFlight/device-signed builds.
- Seven unit/queue tests + real PostgreSQL 17 RLS/security tests passed. Actual private source snapshot copied/re-applied/verified in LOCAL test Workspace: 62 parcels, 1 observation, 2 media metadata, 12 layers, 26 features = 103. Source unchanged; files not copied. No import into Max's cloud Workspace.
- Team branch/PR workflow and boundaries in TEAM.md; project rules in AGENTS.md.

## In Progress

Web cloud CI now passes after fixing PostgreSQL readiness race: use final TCP listener, not temporary bootstrap socket. Run 37248285240 passes Web real Auth/Storage/browser flow plus iPhone/iPad builds. Track https://github.com/maxstillwell/landbanker/actions.
Supabase access is restored through the explicit Landbanker account selector. Hosted foundation and index/RLS migrations already exist. Online signup form is enabled. Hosted end-to-end Auth/Storage/field workflow still needs verification; no claim of successful user login/photo sync yet.

## Build status

Local lint/typecheck/unit/RLS/production build and full browser workflow passed. Vercel builds READY. Initial GitHub Web lint/types/unit passed, then DB startup race failed; corrected in 20f33ca. iPhone/iPad Simulator builds succeeded. Corrected cloud run 37248285240 passed all three jobs on commit 20f33ca.

## Deployment

- Repository: maxstillwell/landbanker (Public, explicitly approved).
- Main: https://landbanker.vercel.app (new independent project only).
- Preview: https://landbanker-git-preview-maxstillwells-projects.vercel.app.
- App URL env configured separately for main/preview; backend URL points only to https://gksyipjxhrolsgztfyer.supabase.co. Active publishable key can now be retrieved through authorized tooling. Main signup page renders an enabled form; current env values and Preview auth behavior have not been audited in this access-check session.
- create_git_project described its initial deploy as preview, but get_deployment reported production target. A separate preview branch/deployment was then established and verified. No MaxQI aliases/domains changed.

## Database status

Verified Landbanker project gksyipjxhrolsgztfyer in landbanker organization zhpgbccgfasglutbekts, Tokyo, ACTIVE_HEALTHY, Postgres 17.11. Tools now require explicit link_id; select the Landbanker connection. Hosted migrations already present: 20261005013641 land_banker_foundation; 20261005013949 improve_rls_and_foreign_key_indexes. Eleven public tables all have RLS, 32 public policies, field-media private bucket with 25 MiB limit, one Auth user and one active owner Workspace. No business records/import mappings yet. Read-only rollback test confirmed authenticated nonmember isolation across Workspace/business tables; anon public-table grants absent. Security advisor: leaked-password protection disabled. Performance advisor: unused indexes only. Hosted migration SQL should be reconciled with repository history before further DDL; no duplicate initialization or hosted data changes made in this access-check session.
Only old projects were inspected read-only; existing MaxQI/PROS not paused/deleted/upgraded. Never substitute them for the new backend.

## Known issues / next

- Hosted login/confirmation/recovery/SMTP/Storage workflow verification and Max's real import remain pending. Existing Auth user identity/ownership was not inferred from counts.
- Legacy media file copy/checksums not implemented; metadata is legacy_pending. No source deletion.
- Explicit retry now; automatic backoff/native background transfer/device cleanup future work. No offline maps/billing/cutover.
- Full share UI/subset manifests/perimeter rate limiting pending. GeoJSON/polygon first; KML/KMZ/broader spatial editing and query pagination need expansion.
- iOS real-device permissions/camera/GPS/expired-session/relaunch/native recovery link testing remains. Unsigned Simulator builds do not establish these results.

## External blockers

Access blocker resolved (2026-10-05): explicit Landbanker link_id now routes tools to the correct organization/project. See [SUPABASE_ACCESS.md](SUPABASE_ACCESS.md) for verified results and prior diagnosis. Cloud CLI still has no configured login; use authorized connector tools.

1. No Supabase connector access blocker remains. Actual email delivery and hosted Auth URL configuration still need checking; missing external SMTP credentials would be a separate infrastructure dependency.
2. Apple signing/TestFlight later. Independent Simulator CI works without it.
   GitHub admin-settings/variables mutations are denied by integration (403); source content API publication works. HTTPS Git push returned 401, so API fallback preserved source history and hashes. Normal fetch/clone works; scripts/push-via-api.py handles committed main updates without force-pushing or overwriting concurrent changes.

## Exact next step

Web/Simulator CI passes; hosted access/schema/nonmember isolation confirmed. Reconcile the two already-applied hosted migrations with repository SQL before adding DDL. Check existing Vercel env and Auth site/redirect/email configuration without overwriting another developer's setup. Verify real login/recovery/photo/desktop flow, then identify Max's actual owner Workspace for dry-run → copy → verify existing private snapshot → later checksum-copy media. Continue iOS/backend and milestone 2. MaxQI continues reading its legacy backend.
