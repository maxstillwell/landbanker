# Independent hosted setup

Repository https://github.com/maxstillwell/landbanker and Vercel project landbanker are established. The user explicitly authorized public source/docs; no credentials/private snapshots/photos are published.

Backend from user: https://gksyipjxhrolsgztfyer.supabase.co, new landbanker organization, Tokyo. Current session tools cannot access it; user reports reauthorization complete. Refresh the connection/session and verify organizations/project before writing anything. MaxQI and PROS remain forbidden destinations.

## After connector access succeeds

1. Confirm project identity/status and inspect existing public tables/migration history/storage buckets. If another developer or Git integration already applied schema, verify rather than duplicate it.
2. Check current Supabase docs/changelog, then apply committed migrations to this new project. Run security/performance advisors and actual tenant-isolation tests. Do not update old MaxQI RLS/schema.
3. Retrieve active publishable credential through tooling; configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY on independent Vercel project. Optional server-only sharing secret must stay server-side and outside Git. No key/password posting in chat is required.
4. Main Auth site URL: https://landbanker.vercel.app. Allow exact callback/confirm/reset routes on this app and https://landbanker-git-preview-maxstillwells-projects.vercel.app. Configure confirmation/recovery email templates according to SUPABASE_REVIEW.md; recovery currently supports PKCE callback and token_hash confirmation route. Configure actual email delivery.
5. Redeploy after public env is configured at BUILD time. Re-test signup/confirmation/Personal Workspace/login/logout/password recovery/location/note/photo/desktop sync and tenant isolation. Current deployment intentionally disables signup while the backend is incomplete.
6. Max registers his own account; import targets his active owner Workspace. Never fabricate Max's account or publish/import private data to a demonstration Workspace. COPY/VERIFY; no source removal or MaxQI cutover.

Vercel app URL env differs for main/preview. No custom domain purchase/binding or MaxQI integration changed. Preview protection may require Vercel login; native release URL/access should be verified before device tests.
