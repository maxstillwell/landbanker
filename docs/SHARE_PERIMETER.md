# Alpha 3 public share perimeter

The app's process-local limiter is not distributed protection. Public share token entropy, immutable scope, RLS and immediate no-store revoke/expiry remain necessary but do not replace abuse controls.

## Vercel Firewall diagnosis — 2026-10-08 AEDT

The independent LandOS Vercel project is `prj_afzfCidHE83CGne0ILQBJPKdBBi6` under the only connected team, `Maxstillwell's projects` (`team_uz00skMNo5QcnakBUYe8ZuVl`). The project and team APIs confirm access but do not return a billing-plan or WAF-entitlement field, so the current plan cannot be proven from this API response. The dashboard Billing page remains the authoritative plan check.

Official Vercel documentation now reads the activated configuration at `GET /v1/security/firewall/config?projectId=...`; a specific version uses `/v1/security/firewall/config/{configVersion}`. The connected tool calls the versioned form with `active` or `draft`. Both reads and the reviewed PUT returned HTTP 404 `Seawall Config not found`. A permission failure would normally be 403, so the evidence supports an uninitialised/unavailable Seawall configuration or a connected-tool/API-version mismatch rather than an application-code failure. The Vercel CLI also requires an interactive device login in this environment. No Firewall rule was applied and blind retries stopped.

`infra/firewall/landos-share-rules.json` remains the reviewed Path A artifact. After the dashboard exposes Firewall, an owner should initialise Firewall/WAF, confirm the plan entitlement, stage the Preview 600-request/IP/minute rule, test it, and publish it explicitly. Preserve any existing project rules and exclude all MaxQI projects/domains.

## Path B — deployed and accepted

No Vercel Marketplace storage integration is installed for this team, and provisioning Upstash requires the same interactive Vercel login/dashboard flow. Alpha 3 therefore uses the existing independent LandOS Supabase Postgres as the supported distributed counter store instead of an in-memory fallback or a new unapproved paid resource.

`/share/[token]` and `/api/published/[token]` now call one server-only database gateway. Vercel stores a 256-bit `LANDOS_SHARE_GATEWAY_SECRET` as a sensitive server variable; Supabase stores only its SHA-256 hash. The ordinary Supabase publishable credential remains least privilege and no service-role key is added to the Web or iOS app. The gateway checks the secret before resolution, returns one fixed status/projection envelope, and exposes no Workspace/table parameters.

The database atomically enforces fixed one-minute budgets of 120 requests per caller and 60 requests per share token across every Vercel instance. Caller addresses are HMAC-SHA-256 hashed by the Vercel server; share tokens use their existing SHA-256 identity. Raw IPs, tokens and the gateway secret are absent from rate-bucket rows and logs. Expired buckets are deleted through the indexed gateway path. The existing process-local limiter remains only an early defense.

The additive gateway migration and sensitive Vercel environment variable are installed. Production acceptance passed before cutover. Direct anonymous/authenticated execution of `resolve_landos_share` and `landos_share_status` is now revoked; authenticated execution of the gateway is also revoked. Only anon may call the protected gateway, and only the Vercel server possesses the required 256-bit capability. Existing public URLs did not change.

## Acceptance evidence — 2026-10-08 AEDT

- Production concurrent same-token requests returned 60 normal unavailable responses followed by 10 HTTP429 responses. A caller-budget series produced the same 60/10 split. The counter transaction is stored in Postgres, so all Vercel instances consume the same atomic budget; no process memory is authoritative.
- Unknown and malformed tokens return only the fixed unavailable result with `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. Direct old RPC calls are denied; gateway calls without the 256-bit server capability are denied.
- A synthetic valid shared View returned only its frozen minimal projection. Private observations, notes and media remained excluded.
- Revocation became unavailable immediately. An expired synthetic link returned only the fixed expired response. All hosted acceptance fixtures were deleted after testing.
- Local PostgreSQL, browser and API regressions cover valid, invalid, malformed, expired, revoked, wrong-capability and concurrent-limit paths plus old-RPC denial.

Hosted post-cutover read-back confirms the old grants are absent and only the protected gateway retains anon execution. Supabase Advisor now reports one intentional anon SECURITY DEFINER warning for that gateway plus leaked-password protection disabled; there is no authenticated gateway warning or missing-RLS finding. Path B satisfies the Alpha 3 distributed perimeter and direct-RPC exit criteria. Path A remains optional defense in depth after an owner enables or confirms Vercel Firewall entitlement in the dashboard; any WAF rule must be staged and explicitly published by an owner.

## Hosted function review — 2026-10-07

Read-back confirms empty search_path on every reviewed function. `record_workspace_change` is private SECURITY DEFINER with neither anon nor authenticated EXECUTE; `has_workspace_role` is private SECURITY DEFINER, authenticated-only for RLS evaluation and takes the current auth.uid rather than a caller-supplied user. Public `landos_workspace_changes` and `save_layer_features` are SECURITY INVOKER, authenticated-only with membership/RLS checks. `resolve_landos_share` and `landos_share_status` remain internal implementation functions but no longer grant execution to anon or authenticated roles. `landos_share_gateway` is the sole anonymous database capability: it requires the server-only capability, consumes distributed budgets and then invokes the narrow resolver. Owner/nonmember/anon feed checks and existing private Storage RLS tests pass. Advisor still reports the intentional gateway warning and leaked-password protection disabled. No Firewall enforcement is claimed; distributed Postgres enforcement is deployed.
