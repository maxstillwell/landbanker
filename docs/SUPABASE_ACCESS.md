# Restore access to the independent backend

Target: [Landbanker project](https://supabase.com/dashboard/project/gksyipjxhrolsgztfyer), organization `landbanker`. Do not move this project or change MaxQI memberships, schema, policies, or data to resolve this connection issue.

## Resolved — 2026-10-05

Tools now expose an explicit account selector. Select the connection named **Landbanker** using its listed `link_id` on every Supabase call; do not use the old Supabase connection. Project lookup and SQL succeed. Verified organization `landbanker` (`zhpgbccgfasglutbekts`), project `gksyipjxhrolsgztfyer`, Tokyo, `ACTIVE_HEALTHY`, Postgres 17.11.

Existing hosted migrations `20261005013641_land_banker_foundation` and `20261005013949_improve_rls_and_foreign_key_indexes` were discovered; do not repeat initialization. Eleven business tables have RLS, 32 public policies, private field-media bucket (25 MiB), one Auth user and one active owner Workspace. A read-only transaction verified an authenticated identity without membership sees no Workspace/business records. Anonymous roles have no public-table grants. Business/import counts are currently zero.

Online /signup returns the enabled form without the backend-waiting message. Actual login/confirmation/recovery/photo workflow remains to be verified. Security advisor reports leaked-password protection disabled; performance advisor reports unused indexes only. Do not remove new indexes merely because the empty project has no usage.

The sections below record the prior blocker and fallback procedure, not the current access state.

## Verified 2026-10-05

- Supabase plugin is installed and enabled.
- Current connector lists only organization `Max Qi`, with projects `maxqi.com` and `PROS`.
- Direct lookup of `gksyipjxhrolsgztfyer` returns “You do not have permission to perform this action”.
- Managed cloud runtime has no configured Supabase credential or outbound identity. Normal `supabase projects list` returns `AccessTokenRequiredError`.
- Available plugin management tools cannot change Supabase OAuth account/organization grants or refresh the connector session. ChatGPT plugin read/write permission settings are separate from these grants.

These observations establish an access blocker. They do not establish whether the cause is the selected Supabase account, organization grant, or a stale connection in this chat. Database health, schema and migrations on the new project remain unverified.

## Account authorization step

1. Open the target project link above. Confirm the signed-in Supabase account can open it and the organization is `landbanker`.
2. In ChatGPT settings, find the connected Supabase app/plugin. Use its reconnect/reauthorize option if available; otherwise disconnect that ChatGPT connection and connect it again. This changes the connection, not the Supabase project or data.
3. During authorization, use the account from step 1. If organization selection is offered, explicitly select `landbanker`. If it is absent, stop and check the signed-in account and its organization membership; do not create another project as a workaround.
4. Reload ChatGPT and retry access. If this chat retains the old connection, open a new Codex task with the Land Banker repository and the instruction below. Opening a new chat is a diagnostic step, not a guarantee that access is fixed.

No password, access token, database password, service-role key, or secret key needs to be posted in chat.

## Resume instruction

> Continue maxstillwell/landbanker. Read AGENTS.md, docs/STATUS.md, docs/ARCHITECTURE.md and docs/SUPABASE_ACCESS.md. Verify Supabase access to project gksyipjxhrolsgztfyer before any write. If accessible, follow docs/HOSTED_SETUP.md: inspect schema/migration history, apply only missing migrations to this independent project, verify RLS/Storage, configure its publishable key on the independent Vercel project, configure Auth URLs and redeploy. NEVER BREAK MAXQI; do not use its database as a substitute.

## Success criteria

Project lookup succeeds for the exact new reference, and actual organization/project details are confirmed. Only then configure the hosted backend. Do not mark the issue resolved merely because the user completed an authorization screen.
