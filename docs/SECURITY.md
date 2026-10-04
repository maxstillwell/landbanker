# Security boundaries

Latest Supabase changelog and Auth/SSR/RLS/Storage documentation checked before implementation, including explicit Data API grants and PostgreSQL changes. Details and URLs in SUPABASE_REVIEW.md.

- RLS required on every exposed table; `TO authenticated` alone is never the policy.
- Private helper checks `auth.uid()` and active workspace membership. Fixed search path, qualified names, no supplied target user, execution revoked from PUBLIC/anon. Avoids membership-policy recursion, not a generic authorization bypass.
- Private signup trigger creates constant owner role for the newly inserted auth.users identity; metadata used only for display. No remotely callable privileged bootstrap.
- Business updates cannot change workspace. Composite FK prevents cross-tenant relationships.
- User credential for all app CRUD/signed upload; service key is never in client or iOS. Optional server-only share resolver is isolated and reads minimal explicit scope.
- Signed private media URLs expire after 5 minutes. Signed uploads require registered media row and private bucket RLS. Completion verifies object name and byte size.
- Same-origin checks on mutation APIs. PKCE SSR cookies; getUser on protected pages/API for current authenticated identity; proxy refresh. No MaxQI passwords or cookies.
- 256-bit random share tokens, SHA-256 stored, expiry mandatory, read-only, revoke supported. Anonymous database grants absent. Invalid/revoked/expired tokens return unavailable. Public projections omit internal notes and arbitrary metadata. No-referrer and no-store, share page noindex. Future public launch requires shared-endpoint rate limiting at deployment perimeter.
- Local queue contains private text/photos; physically accessible browser device can access them. Scoped by logged-in user and workspace and not exposed across in-app accounts, persists on logout to avoid losing unsent work. Device cleanup/encryption policy is future work.
- `.env*`, source exports, reports and storage-copy credentials excluded from Git. Independent backend guard rejects MaxQI and PROS projects.

Validation: real PostgreSQL 17 tests cover bootstrap, different users, viewer/suspended memberships, anonymous access, role escalation, cross-workspace FK, and storage writes. More tests include workspace immutability and share scope. Full hosted security/advisors and iOS permission tests remain pending independent cloud backend/macOS CI.
