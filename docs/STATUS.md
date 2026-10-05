# Land Banker status

Updated: 2026-10-05 (Australia/Sydney). Resume with this file + ARCHITECTURE.md. **NEVER BREAK MAXQI.**

## Completed

- Independent public repository: https://github.com/maxstillwell/landbanker. User explicitly authorized public source/technical docs. All initial local history published with identical commit/tree hashes. Credentials/photos/private MaxQI exports are excluded. Current files retain agent:agent ownership.
- Independent Vercel project landbanker, id prj_afzfCidHE83CGne0ILQBJPKdBBi6, current Vercel team. Main deployment https://landbanker.vercel.app and separate preview branch https://landbanker-git-preview-maxstillwells-projects.vercel.app. Both build successfully; Preview may require Vercel authentication.
- Supabase Auth/workspace/RLS/Storage migration and Web Field MVP verified against real independent LOCAL services: signup/login/recovery/logout, Personal Workspace, GPS, notes/photos/signed upload, desktop sync, durable failed-upload retry.
- Responsive iPhone sheet/iPad inspector/desktop map; GeoJSON/local polygon drafts with durable device storage + Save to Workspace; saved views and secure scoped/revocable share foundation.
- SwiftUI persistent WKWebView/native bridge/location/camera/PhotosUI/network/navigation shell. GitHub macos-15 unsigned iPhone AND iPad Simulator builds passed in run 37247783731; downloadable .app artifacts exist. CI URL defaults to configurable Vercel app URL. These are Simulator builds, not TestFlight/device-signed builds.
- Seven unit/queue tests + real PostgreSQL 17 RLS/security tests passed. Actual private source snapshot copied/re-applied/verified in LOCAL test Workspace: 62 parcels, 1 observation, 2 media metadata, 12 layers, 26 features = 103. Source unchanged; files not copied. No import into Max's cloud Workspace.
- Team branch/PR workflow and boundaries in TEAM.md; project rules in AGENTS.md.
- Hosted Supabase access verified through the dedicated Landbanker connection. The foundation schema and a performance follow-up migration are applied only to `gksyipjxhrolsgztfyer`; hosted rollback-based signup/RLS/Storage isolation tests pass, security advisors are clean, and the remaining performance notices are expected unused-index info on an empty database.
- Hosted Auth uses `https://landbanker.vercel.app` as Site URL with exact main/preview callback, confirmation and recovery callback allow-list entries. Email signup and confirmation are enabled and the minimum password length is 10. The new Free-plan default SMTP/template restriction prevents custom cross-device token-hash templates until custom SMTP is supplied.
- Private `field-media` Storage is configured at 25 MB for JPEG/PNG/HEIC with four verified RLS policies. Vercel Production and Preview now have the target project URL and publishable client key; no service-role or secret key was added.

## In Progress

Web cloud CI now passes after fixing PostgreSQL readiness race: use final TCP listener, not temporary bootstrap socket. Run 37248285240 passes Web real Auth/Storage/browser flow plus iPhone/iPad builds. Track https://github.com/maxstillwell/landbanker/actions.
Production and Preview require a fresh Vercel build so the newly added public Supabase credential is embedded and signup becomes enabled. Source status/performance migration publication is also pending this handoff commit.

## Build status

Local lint/typecheck/unit/RLS/production build and full browser workflow passed. Vercel builds READY. Initial GitHub Web lint/types/unit passed, then DB startup race failed; corrected in 20f33ca. iPhone/iPad Simulator builds succeeded. Corrected cloud run 37248285240 passed all three jobs on commit 20f33ca.

## Deployment

- Repository: maxstillwell/landbanker (Public, explicitly approved).
- Main: https://landbanker.vercel.app (new independent project only).
- Preview: https://landbanker-git-preview-maxstillwells-projects.vercel.app.
- App URL env configured separately for main/preview; backend URL and publishable credential point only to https://gksyipjxhrolsgztfyer.supabase.co. No secret/service-role keys configured.
- create_git_project described its initial deploy as preview, but get_deployment reported production target. A separate preview branch/deployment was then established and verified. No MaxQI aliases/domains changed.

## Database status

Landbanker project `gksyipjxhrolsgztfyer`, Tokyo `ap-northeast-1`, PostgreSQL 17.11 is ACTIVE_HEALTHY in the separate landbanker organization. Hosted migration history contains `land_banker_foundation` and `improve_rls_and_foreign_key_indexes`. All 11 public tables have RLS, the private bucket and four object policies are present, and rollback tests leave 0 users/business rows/storage objects.
The dedicated Landbanker connection was used for every read/write. Existing MaxQI/PROS were not inspected or modified in this continuation.

## Known issues / next

- Hosted signup/confirmation/recovery and signed upload still need end-to-end validation after redeploy. Custom SMTP is not configured; the Free-plan default sender/template remains in use.
- Legacy media file copy/checksums not implemented; metadata is legacy_pending. No source deletion.
- Explicit retry now; automatic backoff/native background transfer/device cleanup future work. No offline maps/billing/cutover.
- Full share UI/subset manifests/perimeter rate limiting pending. GeoJSON/polygon first; KML/KMZ/broader spatial editing and query pagination need expansion.
- iOS real-device permissions/camera/GPS/expired-session/relaunch/native recovery link testing remains. Unsigned Simulator builds do not establish these results.

## External blockers

1. Custom Auth email templates now require custom SMTP on this new Free-plan project. Supply an SMTP provider before enabling the preferred cross-device token-hash confirmation/recovery templates; do not post SMTP credentials in chat.
2. Apple signing/TestFlight later. Independent Simulator CI works without it.
   GitHub admin-settings/variables mutations are denied by integration (403); source content API publication works. HTTPS Git push returned 401, so API fallback preserved source history and hashes. Normal fetch/clone works; scripts/push-via-api.py handles committed main updates without force-pushing or overwriting concurrent changes.

## Exact next step

Publish this status and the performance migration, redeploy main and preview so the public Supabase credential is present at build time, then validate the full hosted signup/confirmation/Personal Workspace/login/logout/recovery/note/photo/desktop-sync and tenant-isolation flow. Max signs up and owns Personal Workspace; dry-run → copy → verify existing private snapshot → later checksum-copy media. Configure custom SMTP/token-hash templates when credentials are available, then test iOS against the actual backend and continue milestone 2. MaxQI continues reading its legacy backend.

