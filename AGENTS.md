<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Land Banker project boundaries

Read docs/STATUS.md, docs/ARCHITECTURE.md, docs/SECURITY.md and docs/TEAM.md before starting or resuming work. Use independent branches/worktrees and PRs for concurrent developers.

NEVER BREAK MAXQI. Do not modify MaxQI production schemas, Auth, RLS, Storage policies, password-protected viewers, APIs or publishing. No cutover in this phase. Imports copy source data, verify, preserve originals. Land Banker business data belongs in its independent Supabase project and is scoped by workspace membership/RLS. Never include secrets or private MaxQI data in Git.

Repository destination is maxstillwell/landbanker. Latest user leaves visibility Public for now; user explicitly authorized public source/documentation push to this repository. Secrets, photos and private source snapshots remain excluded. Honor confirmed publication scope and check visibility before initial push. Current hosted setup blockers and verified/unverified build results are in STATUS.md. Update status with exact next steps when handing off.
