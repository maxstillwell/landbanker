# Supabase documentation review — 2026-10-04

Read before implementing:

- https://supabase.com/changelog.md
- https://supabase.com/docs/guides/auth/server-side/nextjs
- https://supabase.com/docs/guides/auth/managing-user-data
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes
- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

Applied explicit Data API GRANTs plus RLS, private security-definer membership helper with qualified names/search_path/revoked PUBLIC execution, trigger-only signup, SSR cookie refresh, getUser validation, private Storage and signed uploads. No reliance on user-editable metadata for authorization. Dependencies pinned with lockfile.

Confirm production Auth Site URL/redirect allowlist after new project creation; for mobile recovery links use token-hash email template `/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` to avoid requiring the original browser's PKCE verifier. PKCE callback remains supported for same-device links. Add only exact configured Land Banker origins, no broad wildcards for production.

## Hosted verification — 2026-10-05

- Dedicated Landbanker connector access verified for `gksyipjxhrolsgztfyer`; no MaxQI/PROS connection was used.
- Foundation and performance migrations applied. Hosted transaction/rollback tests passed signup bootstrap, tenant isolation, role restrictions, immutable workspace/share scope, composite foreign keys and private Storage policy enforcement.
- Security advisor: clean. Foreign-key and RLS init-plan findings were fixed in the follow-up migration. Remaining performance advisor findings are unused-index informational notices expected on an empty database.
- Auth Site URL is `https://landbanker.vercel.app`; six exact main/preview callback, confirmation and recovery callback URLs are allow-listed. Email signup and confirmation are enabled; minimum password length is 10.
- This new Free-plan project cannot customize email templates while using Supabase default SMTP. PKCE callbacks remain configured; the preferred cross-device token-hash templates require custom SMTP.
- `field-media` is private, limited to 25 MB JPEG/PNG/HEIC, and protected by read/insert/update/delete policies tied to registered media rows and workspace roles.

