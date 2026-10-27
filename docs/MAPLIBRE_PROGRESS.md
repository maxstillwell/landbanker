# MapLibre workflow continuation

Resume branch: `codex/landos-map-foundation-rebuild`.
Verified remote starting checkpoint: `0ea31bc8e4d905673be1ffe6855eb99f719f041b`.
Pre-integration main/rollback reference: `d23121c3c7c5c408d9e159ec362538707d0d64a2`.

The owner authorized completion, testing, safe main integration, push and deployment on 27 October 2026. Earlier document approval gates are superseded for this work. Do not change MaxQI, Supabase security or hosted data; do not force-push or add paid services.

## In progress

- Port the established workspace's drawing/recovery, Field/private-photo queue, viewport/change-feed, Saved Views and Inspector to one native MapLibre scene.
- Retain the checkpoint's direct official-source foundation and restore catalog overlays on private/public maps.
- Run lint/typecheck/unit/build, disposable database and browser integration regressions; adapt renderer-specific assertions.
- Commit and push durable checkpoints; merge only after critical regression checks pass. Verify GitHub/Vercel revision and production URL.

## Environment evidence

The initial checkout was old main, not the requested branch. Fetched and switched to the exact verified checkpoint without changes. Git network commands need the execution sandbox's escalated network path to reach the configured proxy. The local test configuration points exclusively to `127.0.0.1:54321`. No hosted database work is authorized or needed.
