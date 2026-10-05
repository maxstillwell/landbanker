# Land Banker status

Updated: 2026-10-05 (Australia/Sydney). Resume by reading this file + ARCHITECTURE.md. **NEVER BREAK MAXQI.**

## Completed

- Independent `/workspace/land-banker` git repository, current `agent:agent` ownership; source and release independent of MaxQI. Local commit/bundle provided. User created maxstillwell/landbanker; GitHub API confirms push/admin access, but the repository is Public. User explicitly approved PRIVATE repository before push. Integration PATCH to make it private returned HTTP 403 despite reported repository admin permission; manual visibility change is required. No source pushed.
- MaxQI source/schema/reuse audit; only generic map utilities copied/extracted. Excluded legacy auth/admin/passwords/layout/Obsidian. No MaxQI production modifications.
- Supabase email/password signup/login/logout/PKCE recovery/session; Personal Workspace trigger; multi-tenant schema, memberships and RLS; private Storage + user-authorized signed upload.
- Responsive full-map Web: iPhone three-state sheet, iPad portrait inspector/landscape 70:30 layout, desktop; GPS locate/follow/accuracy, observations/text/photos and durable account-scoped IndexedDB queue/retry.
- GeoJSON/local polygon draft editing, durable Local Draft + Save to Workspace, saved views; imported parcels/layers.
- Secure hash-based share foundation, selected parcel/layer create/revoke APIs and narrow anonymous read seam. Local scope/revoke tests pass. Full sharing UI/subset manifests pending.
- SwiftUI persistent WKWebView shell, formal native bridge, CoreLocation When In Use, camera/PhotosUI/network/share sheet/navigation. Unsigned iPhone/iPad macOS CI configured; compilation not yet executed.
- Copy-only safe/idempotent importer and private snapshot. All 103 transformed source records copied/re-applied/verified in LOCAL test Workspace. Source unchanged; legacy media metadata only. No cloud import into Max's account.
- Seven unit/queue tests, real PostgreSQL RLS checks, local real Auth/Storage/browser end-to-end checks. Details: VERIFICATION.md.

## In Progress

User chose Private before push; repository-visibility API is denied (403), so source push awaits manual Private setting. New Supabase project was created by the user in a separate landbanker organization; current connector is not authorized to access it. Cloud setup and iOS CI execution remain pending. Web Field MVP verified locally; first milestone is not yet a deployed/device-validated release. Milestone 2 foundations (retry, durable layers, saved views, secure sharing/tests, CI) implemented within available infrastructure.

## Build status

Web lint/typecheck/unit/RLS/production build passed. Browser full flow passes against local services; production-build verification results in VERIFICATION.md. GitHub CI and iOS Simulator builds unexecuted.

## Deployment

No Preview URL yet. User-created independent repo maxstillwell/landbanker is empty and Public; source push awaits manual Private setting (user choice confirmed). Vercel will link only this independent repo. No MaxQI deployments/domains/integration changed.

## Database status

User-created Landbanker project URL: https://gksyipjxhrolsgztfyer.supabase.co; screenshot indicates Tokyo ap-northeast-1 and separate landbanker organization. Current Supabase connection only lists old Max Qi projects and rejects access to the new ref. Project identity/schema status not yet remotely verified. No cloud migration applied by this agent. Existing MaxQI/PROS not paused/deleted/upgraded. Complete migration/config/setup and real isolated local stack provided. Only local synthetic/test accounts created. Max must register his own actual Land Banker account after cloud backend becomes available; import targets its owner Workspace.

## Known issues

- Real legacy media file copy/checksum tool remains future work; imported media clearly legacy_pending.
- No full offline maps. Device queue explicit retry; automatic backoff/native background transfer/secure device cleanup remain follow-ups.
- GeoJSON/polygon support first; broader planning/KML/KMZ/spatial analysis/editing needs expansion. Map list queries currently capped at 1,000 parcels/500 observations/100 layers/views; pagination needed for larger workspaces.
- No complete share UI/map subset manifests; public read is bounded explicit parcel/layer scope. Add perimeter rate limiting before public launch.
- Native recovery deep links/Simulator/device permission, expired-session and relaunch tests pending. iOS source build is unverified.
- Cloud email confirmation/SMTP/advisors and hosted RLS/Storage verification still required.
- No billing or MaxQI cutover.

## External blockers

1. GitHub repository visibility: user approved Private then push; changing visibility through integration is forbidden (PATCH 403). User must set Private in repository Settings/General/Danger Zone. Earlier public push was rejected by automatic approval; no public source egress occurred.
2. Supabase connector access to new landbanker organization/project. Reauthorize that organization; project creation/capacity blocker is now resolved by the user.
3. Apple signing/TestFlight credentials later; unsigned macOS CI only requires new remote to run.

## Exact next step

After GitHub confirms the repo is Private: connect **only** `maxstillwell/landbanker`, push local main, run CI including unsigned iPhone/iPad builds. Create separate Vercel project under current team and Preview deployment. After Supabase connection authorizes the user-created Tokyo project: verify identity/empty schema, apply guarded migrations, configure separate environment/Auth email URLs, run hosted security checks, deploy Preview with credentials configured at build time. Max signs up; verify owner Personal Workspace; dry-run → copy → verify private existing snapshot → later checksum-copy media. Validate iOS with Preview URL and continue remaining milestone 2 work. Keep MaxQI reading legacy backend.

Current handoff: independent local git history and `/workspace/land-banker-source.zip` + `/workspace/land-banker.bundle`, excluding credentials/private snapshot/build caches. Remote push awaits the authorized Private visibility setting; no push was executed after the automatic approval rejection. Do not fall back to the MaxQI repository.
