# Land Banker status

Updated: 2026-10-04. Resume by reading this file + ARCHITECTURE.md. **NEVER BREAK MAXQI.**

## Completed

- Independent `/workspace/land-banker` git repository, current `agent:agent` ownership; source and release independent of MaxQI. Local commit/bundle provided; remote permission blocked.
- MaxQI source/schema/reuse audit; only generic map utilities copied/extracted. Excluded legacy auth/admin/passwords/layout/Obsidian. No MaxQI production modifications.
- Supabase email/password signup/login/logout/PKCE recovery/session; Personal Workspace trigger; multi-tenant schema, memberships and RLS; private Storage + user-authorized signed upload.
- Responsive full-map Web: iPhone three-state sheet, iPad portrait inspector/landscape 70:30 layout, desktop; GPS locate/follow/accuracy, observations/text/photos and durable account-scoped IndexedDB queue/retry.
- GeoJSON/local polygon draft editing, durable Local Draft + Save to Workspace, saved views; imported parcels/layers.
- Secure hash-based share foundation, selected parcel/layer create/revoke APIs and narrow anonymous read seam. Local scope/revoke tests pass. Full sharing UI/subset manifests pending.
- SwiftUI persistent WKWebView shell, formal native bridge, CoreLocation When In Use, camera/PhotosUI/network/share sheet/navigation. Unsigned iPhone/iPad macOS CI configured; compilation not yet executed.
- Copy-only safe/idempotent importer and private snapshot. All 103 transformed source records copied/re-applied/verified in LOCAL test Workspace. Source unchanged; legacy media metadata only. No cloud import into Max's account.
- Seven unit/queue tests, real PostgreSQL RLS checks, local real Auth/Storage/browser end-to-end checks. Details: VERIFICATION.md.

## In Progress

Cloud provisioning/remote push and iOS execution are blocked externally. Web Field MVP verified locally; first milestone is not yet a deployed/device-validated release. Milestone 2 foundations (retry, durable layers, saved views, secure sharing/tests, CI) implemented within available infrastructure.

## Build status

Web lint/typecheck/unit/RLS/production build passed. Browser full flow passes against local services; production-build verification results in VERIFICATION.md. GitHub CI and iOS Simulator builds unexecuted.

## Deployment

No public Preview URL. Independent GitHub creation rejected HTTP 403; Vercel project cannot yet link new remote. No MaxQI deployments/domains/integration changed.

## Database status

Independent cloud Supabase creation under current Max Qi org rejected: two active free projects limit. Existing MaxQI/PROS not paused/deleted/upgraded. Complete migration/config/setup and real isolated local stack provided. Only local synthetic/test accounts created. Max must register his own actual Land Banker account after cloud backend becomes available; import targets its owner Workspace.

## Known issues

- Real legacy media file copy/checksum tool remains future work; imported media clearly legacy_pending.
- No full offline maps. Device queue explicit retry; automatic backoff/native background transfer/secure device cleanup remain follow-ups.
- GeoJSON/polygon support first; broader planning/KML/KMZ/spatial analysis/editing needs expansion. Map list queries currently capped at 1,000 parcels/500 observations/100 layers/views; pagination needed for larger workspaces.
- No complete share UI/map subset manifests; public read is bounded explicit parcel/layer scope. Add perimeter rate limiting before public launch.
- Native recovery deep links/Simulator/device permission, expired-session and relaunch tests pending. iOS source build is unverified.
- Cloud email confirmation/SMTP/advisors and hosted RLS/Storage verification still required.
- No billing or MaxQI cutover.

## External blockers

1. GitHub integration lacks independent private repo creation permission (GraphQL + REST 403). Create `maxstillwell/land-banker` or expand repository-creation access.
2. Independent Supabase project capacity. Existing free projects must remain intact; provide capacity/approved independent paid infrastructure.
3. Apple signing/TestFlight credentials later; unsigned macOS CI only requires new remote to run.

## Exact next step

When remote access is available: connect **only** `maxstillwell/land-banker`, push local main, run CI including unsigned iPhone/iPad builds. Create separate Vercel project under current team and Preview deployment. When independent Supabase capacity is available: create Sydney project, apply guarded migrations, configure separate environment/Auth email URLs, run hosted security checks, deploy Preview with credentials configured at build time. Max signs up; verify owner Personal Workspace; dry-run → copy → verify private existing snapshot → later checksum-copy media. Validate iOS with Preview URL and continue remaining milestone 2 work. Keep MaxQI reading legacy backend.

Current handoff: independent local git history and `/workspace/land-banker-source.zip` + `/workspace/land-banker.bundle`, excluding credentials/private snapshot/build caches. Remote push cannot proceed without creation permission. Do not fall back to the MaxQI repository.
