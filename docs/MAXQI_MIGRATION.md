# Copy-only MaxQI import

**COPY FIRST. VERIFY. CUT OVER LATER. NEVER MOVE FIRST.**

Source project `kcdzzbmkqtuwfzbeqcks` is only opened for SELECT/export. Destination runtime rejects this project and PROS. Importer never receives a live source client: it consumes a local versioned snapshot. Snapshot and credentials must remain outside Git.

## Current inventory / dry run

Read-only snapshot: 62 parcels, 1 observation, 2 media metadata rows, 12 spatial layers. Transformation derives 26 spatial features. Source records and files retained. All 103 transformed records were copied into an isolated LOCAL test Workspace, recovered from an interrupted run, re-applied with zero new rows, and verified. This test account is not Max's account. No production data changed and no destination cloud import has been executed. Synthetic tests additionally verify preservation of edited destination data.

## Repeatable procedure

1. Register your Land Banker account against the independent backend; verify Personal Workspace and owner membership.
2. Export with `node --import tsx scripts/export-maxqi.ts` using a server-only read-only source credential. All fetches paginated and ordered. Or produce the same snapshot using read-only SQL. Never pass source keys into the web app.
3. `npm run import:maxqi -- --snapshot private-imports/maxqi.json --workspace <UUID>` performs dry run without any database connection.
4. Configure independent destination URL, matching `LAND_BANKER_PROJECT_REF`, `LAND_BANKER_IMPORT_SECRET_KEY`. A registered owner membership must already exist.
5. Add `--apply`: deterministic workspace-scoped UUIDs, insert-only records and unique mappings; repeat runs skip existing imported records. Existing source hashes changing are reported, not blindly updated. Crash recovery recognizes existing legacy lineage before adding a missing mapping. Never overwrite edited Land Banker rows.
6. Add `--verify`: verify destination identity/workspace and persisted migration mapping; composite foreign keys enforce workspace consistency; source missing relationships abort before apply. Archive reports in ignored private-imports. Compare counts/hashes/mapping and sample geometry/location/date values.
7. Media phase 1 copies metadata only. `legacy_pending` with original bucket/path mapping explicitly communicates missing files. Subsequent file-copy tool must read original → checksum → new Storage → checksum → set status, preserve originals and fail safely. It is not yet implemented.

For tests only, `--local-test` accepts loopback with explicit `LAND_BANKER_PROJECT_REF=land-banker-local`; the blocked production refs still apply. Never use this switch to bypass cloud project verification.

Import is resumable at record granularity, not one giant transaction. Partial runs can be repeated. No automatic deletions when source records disappear. Local browser-only legacy drafts must first be exported explicitly; they do not exist in the database snapshot.

Future MaxQI consumer seam `/api/published/[token]` resolves only explicit resources and excludes private notes, agent contacts and unrelated workspace records. MaxQI currently continues to read legacy backend. Production cutover requires separate validation and authorization later.
