# Independent infrastructure setup

Current actor: maxstillwell on GitHub, Max Qi organization on Supabase, current Vercel team `team_uz00skMNo5QcnakBUYe8ZuVl`. Linux files created by agent:agent. No additional accounts created.

## Historical setup blockers (resolved by user creation)

- Both GitHub GraphQL and REST createRepository attempts rejected: Resource not accessible by integration, HTTP 403. Existing repository access does not grant account-level creation. Create private `maxstillwell/landbanker` or authorize repository creation. Do not use maxqi.com as a fallback remote.
- Supabase project create in Max Qi organization: rejected because maxstillwell has reached 2 active free projects. Quote was $0/month, but creation still denied. Do not pause/delete/upgrade MaxQI or PROS automatically. Supply free capacity or explicitly authorize paid independent infrastructure later.

## After repository creation

`git remote add origin https://github.com/maxstillwell/landbanker.git`; push main. Remote must be independent. Configure GitHub App repository access as needed. CI builds Web + unsigned iPhone/iPad Simulator app.
Create Vercel project `land-banker`, linked only to this new repo under current Vercel team; initial deploy should be Preview. Configure separate Development/Preview/Production env credentials, no imported MaxQI variables. Use connected Vercel create_git_project or CLI. No real domain required.

## After new Supabase project

Use Australia/Sydney region if suitable. Apply guarded schema to new project only, configure public URL/publishable key, optional server-only share resolver secret, Auth URLs and email templates. Run `npm run infra:check`. Trigger signup creates user's Workspace. Never manufacture a Max user account or import into somebody else's workspace.

## Local cloud testing

`npm run local:start`; then `npm run build` and `npm run start` (or `npm run dev`). The startup script bootstraps isolated database roles, real GoTrue Auth/Storage migrations, Land Banker schema, managed-style local Storage grants and gateway config. It is repeatable and never contacts an existing project. Local generated secrets stay in ignored `.env` files; use this only in a disposable development workspace. Do not run `local-config.mjs` over a configured cloud `.env.local`.

Local Auth email auto-confirm is enabled ONLY for tests; Mailpit receives recovery emails. API binds to 127.0.0.1:54321 and mail UI to 127.0.0.1:54324. Containers currently keep data in their container filesystems; removing them discards only local test data. Private MaxQI snapshot remains separately ignored. CI uses this same stack, builds with its local environment configured first, and runs browser tests against the production build. `npm run test:e2e` is localhost-only, creates synthetic test accounts, exercises real Auth/Storage and a repeatable synthetic importer. No local setup is a production Supabase replacement.

Standard Supabase CLI stack was attempted but failed extracting large Postgres image due environment disk limit; stopped, no production interaction.

Preview/iOS URL must be Land Banker, set NEXT_PUBLIC_APP_URL/LAND_BANKER_APP_URL and GitHub repository variable LAND_BANKER_WEB_URL. Do not purchase or bind a domain yet.

## User-created infrastructure — 2026-10-05

GitHub: maxstillwell/landbanker, currently Public, empty; current integration has push/admin permission. Full source push was blocked by automatic approval review because public publication of source/docs was not explicit. User chose Private before push. Integration cannot change visibility (PATCH 403); manual GitHub Settings visibility change is required. No public source pushed. Credentials and private data are excluded regardless.

Supabase: screenshot URL https://gksyipjxhrolsgztfyer.supabase.co, Landbanker, Tokyo, new landbanker organization. Current connector lists only old Max Qi projects; get_project on new ref returns permission error. Reauthorize Supabase connection for new organization. Do not move the new backend into MaxQI or change old production resources.
