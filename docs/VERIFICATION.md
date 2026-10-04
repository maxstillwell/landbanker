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
- Independent GitHub remote: repository creation denied by integration permissions. CI configuration exists but has not run on GitHub.
- Vercel Preview: no deployment yet. New repository or scoped CLI credential required.
- iOS compilation, Simulator execution, real GPS/camera/Photos/session relaunch: no Xcode on Linux and no remote macOS workflow run. Swift source and unsigned iPhone/iPad workflow provided; build result remains unverified.
- No cloud copy into Max's actual Workspace. No actual legacy media file copying. No MaxQI cutover.
