# Collaborating on Land Banker

Repository: https://github.com/maxstillwell/landbanker

Read AGENTS.md, STATUS.md, ARCHITECTURE.md and SECURITY.md before work. **NEVER BREAK MAXQI**. Land Banker is independent; all migration/import work is copy-only. No MaxQI production auth/schema/policies/integration changes.

## Parallel development

Use separate checkouts/worktrees and branches: `codex/<task-name>`. Fetch main before starting; avoid editing the same files without coordination. Push branches and open PRs. Merge after relevant checks pass; rebase on new main rather than force-pushing shared branches.

Suggested first split: Backend/Web developer owns workspace RLS, observations, importer and deployment. iOS developer owns ios/, native bridge implementation, Simulator/device testing. Changes to the shared bridge contract in docs/BRIDGE.md and src/lib/native-bridge.ts must stay compatible with both clients. Coordinate CI edits across both tracks.

## Database and credentials

New Supabase target from user (connector access pending in current session): `gksyipjxhrolsgztfyer` (Landbanker, Tokyo). Verify actual project details and access before applying migrations. Existing MaxQI/PROS refs remain prohibited destinations. Never commit keys, .env files, MaxQI snapshots or reports. Latest user steering leaves the repository Public for now. User explicitly authorized public source and technical documentation publication. Credentials/photos/private MaxQI snapshot remain excluded from Git.

Generate new migration names via Supabase CLI. Do not edit a migration already applied remotely. Review pending migrations on other branches before applying changes. Use local disposable Supabase for tests, never another developer's hosted Workspace. Never create a fake Max account or import private data into demo/test deployments.

## Handoff

Update docs/STATUS.md with completed work, validation evidence, known issues, external blockers and exact next step. Include relevant lint/typecheck/test/build results in PR. Record iOS Simulator build status separately from device validation. Do not mark a feature done based only on source code.

Current external dependency: Supabase connection must include the new landbanker organization. No need to share service keys through chat; use approved environment/connector configuration.

The current cloud runtime authenticates GitHub API calls, but HTTPS Git pushes returned 401. Source history was published with identical tree/commit hashes through GitHub's API. Normal Git fetch/clone works. If you encounter the same issue, commit a single change based on current main, then `python3 scripts/push-via-api.py`; the script checks the parent, source scope and object hashes, and never force-pushes. It is a main-publication fallback, not a replacement for normal team branches/PRs.
