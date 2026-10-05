# Collaborating on Land Banker

Repository: https://github.com/maxstillwell/landbanker

Read AGENTS.md, STATUS.md, ARCHITECTURE.md and SECURITY.md before work. **NEVER BREAK MAXQI**. Land Banker is independent; all migration/import work is copy-only. No MaxQI production auth/schema/policies/integration changes.

## Parallel development

Use separate checkouts/worktrees and branches: `codex/<task-name>`. Fetch main before starting; avoid editing the same files without coordination. Push branches and open PRs. Merge after relevant checks pass; rebase on new main rather than force-pushing shared branches.

Suggested first split: Backend/Web developer owns workspace RLS, observations, importer and deployment. iOS developer owns ios/, native bridge implementation, Simulator/device testing. Changes to the shared bridge contract in docs/BRIDGE.md and src/lib/native-bridge.ts must stay compatible with both clients. Coordinate CI edits across both tracks.

## Database and credentials

New Supabase target from user: `gksyipjxhrolsgztfyer` (Landbanker, Tokyo). Verify actual project details and access before applying migrations. Existing MaxQI/PROS refs remain prohibited destinations. Never commit keys, .env files, MaxQI snapshots or reports. The user chose a Private repository before initial source push; it is currently Public/empty until the manual visibility change. Never push this source publicly without explicit publication scope approval.

Generate new migration names via Supabase CLI. Do not edit a migration already applied remotely. Review pending migrations on other branches before applying changes. Use local disposable Supabase for tests, never another developer's hosted Workspace. Never create a fake Max account or import private data into demo/test deployments.

## Handoff

Update docs/STATUS.md with completed work, validation evidence, known issues, external blockers and exact next step. Include relevant lint/typecheck/test/build results in PR. Record iOS Simulator build status separately from device validation. Do not mark a feature done based only on source code.

Current external dependency: Supabase connection must include the new landbanker organization. No need to share service keys through chat; use approved environment/connector configuration.
