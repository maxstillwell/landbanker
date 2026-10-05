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

Confirm production Auth Site URL/redirect allowlist after new project creation; for mobile recovery links use token-hash email template `/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` to avoid requiring the original browser's PKCE verifier. PKCE callback remains supported for same-device links. Add only exact configured LandOS origins, no broad wildcards for production.
