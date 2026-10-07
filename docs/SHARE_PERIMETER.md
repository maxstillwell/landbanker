# Alpha 3 public share perimeter — deployment pending

The app's process-local limiter is not distributed protection. Public share token entropy, immutable scope, RLS and immediate no-store revoke/expiry remain necessary but do not replace abuse controls.

## Reviewed Vercel rule foundation

`infra/firewall/landos-share-rules.json` is a review artifact, not an applied configuration. It covers only GET `/share/*` and `/api/published/*` in the independent LandOS project: Preview has a 600-request/IP/60-second distributed platform budget; Production has observation-only logging. Confirm plan limits, actual global/regional enforcement and traffic before promoting any blocking Production rule. A high shared-IP budget avoids accidental field-team lockout during staging.

On 2026-10-07, both reading active configuration and submitting this configuration for project prj_afzfCidHE83CGne0ILQBJPKdBBi6 returned HTTP404 `SeawallConfig not found`. No firewall rule was applied. The connected account needs a usable Firewall configuration/plan/permission through the Vercel dashboard or an authorized integration. This is not an automatic approval rejection. Preserve and merge existing rules after a successful read; never blindly overwrite unrelated project rules. MaxQI projects and domains are excluded.

## Direct Supabase RPC perimeter — still pending

Vercel rules cannot cover calls directly to Supabase `resolve_landos_share` or `landos_share_status`. They currently intentionally accept an unpredictable share token using the publishable credential. A public launch requires a server-only gateway capability or dedicated least-privilege role with a shared database budget, followed by revoking direct anon/auth execution on the old resolver/status. The gateway must verify its server credential, freeze the same projection, preserve immediate expiry/revocation, and expose no arbitrary Workspace read. Do not revoke the existing grants before server configuration, gateway tests and new deployment are verified; doing so would break existing share links.

Current Vercel environment metadata contains app/Supabase URLs and publishable credentials only; no server gateway credential has been provisioned. Do not put any new gateway secret in NEXT_PUBLIC variables, browser/iOS code, Git, logs or documentation. No service role should be used for ordinary user CRUD.

## Required acceptance

- Two separate application instances must consume the same caller/token budgets; 429 must be no-store with Retry-After.
- Unknown/malformed tokens cannot enumerate Workspace or reveal private metadata; direct RPC without a server credential must fail.
- Valid shared view still returns only frozen resources; private observations, notes and media remain excluded.
- Revoke is immediately unavailable; expiry reveals only the fixed expired message.
- Test staged rules with normal/shared-IP usage and repeated abusive requests, record actual platform enforcement, then review a Production blocking rule.

These requirements remain open. Alpha 3 is not cleared for broad public launch by this artifact.
