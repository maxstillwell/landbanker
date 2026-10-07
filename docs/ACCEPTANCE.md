# LandOS acceptance checks

Use the independent LandOS app only: https://landbanker.vercel.app. Preview may require Vercel access. Never change/test destructive operations on MaxQI production. Simulator compilation is not physical-device acceptance.

## Web and phone browser

1. Log in (or register a separate test account). Confirm Personal Workspace and settings/logout/recovery.
2. Locate → Add observation → title/notes → choose two photos → Save. Save must remain disabled while photos import. Refresh/reopen, then log into the same account on desktop: confirm notes, location and both private photos.
3. Create another draft, interrupt connection before Save, confirm visible pending/failed status, reconnect and Retry. Reopen the browser and resume the local draft rather than recreating it. Device drafts belong to that account/Workspace.
4. Parcels → select VIC → search `701 Sturt Street Ballarat` (or NSW `5 James Street Dunoon`) → choose official parcel → verify boundary, metric area and source → Save to Workspace → refresh. Repeat Save must not duplicate the property. Also choose Identify parcel on map, tap within a supported VIC/NSW parcel, explicitly select when multiple boundaries are returned, then verify the same preview/save flow.
5. Layers → Draw → polygon → Finish → verify area → give shape/layer a name → Save to Workspace → reopen. Select saved Feature, edit its vertices, save and verify persistence. Imported holes/multipart remain viewable; do not force unsafe editing.
6. Layers → Add Layer → search `flood` (VIC overlays) or `zoning` (VIC/NSW) → Add → visibility/opacity → refresh. NSW minimum lot size is a planning control, not actual parcel area or assured subdivision permission.
7. On iPad landscape confirm map/inspector approximately 70/30; portrait uses floating inspector. Exercise peek/half/full phone sheet and ensure map resizes.
8. Save a named View; Share it; open in a separate logged-out browser. Only explicit scope should appear. Add a new Feature to the original layer and ensure the old View link does not expand. Revoke: public link must become unavailable.

## Signed physical iPhone/iPad app (not tested)

Requires Apple signing/TestFlight. Use the configured LandOS URL; never MaxQI /land. Check login/session/logout/relaunch/expired session, When In Use GPS denial/grant/accuracy/Follow, native Camera, PhotosPicker multi-select, JPEG/PNG/HEIC/large originals, capture time, photo GPS not overriding observation coordinates, lock/background/foreground/close during selection/upload, network timeout/reconnect and desktop sync. Native photos normalize to bounded JPEG before transfer. Raw Web HEIC preview depends on browser codec support; cross-browser preview conversion remains work.

Expected interruption result: completed blobs stay in the account-scoped device queue. Incomplete selections show imported/expected counts and require reselection or explicit Continue with imported photos. Original photos not yet transferred must be reselected; complete offline maps are not provided.

## Automated evidence

`npm run test:e2e` against isolated local services covers Field/Auth/private Storage/desktop sync/retry, two-user isolation, Draw/My Layers/reopen, official catalog preferences, iPad layout, Saved View public scope/revoke, bounded import adapter and 500 parcels/polygons + 500 observations with ten active layer preferences. Government source availability is verified separately, not a mandatory CI external dependency.

Private imported legacy media is intentionally marked legacy_pending: metadata copied, source files untouched. Limited hosted copy is ten source records only; no full import/cutover. Use STATUS.md for current verified checkpoint and remaining work.

## Alpha 3 signed-device result matrix (not executed yet)

Record PASS, FAIL or NOT TESTED for every row on both iPhone and iPad, with device model, iOS version, build number, environment, date and evidence. Do not infer a result from Simulator compilation.

| Check                                                        | iPhone     | iPad       |
| ------------------------------------------------------------ | ---------- | ---------- |
| Login / session persistence / logout / expired session       | NOT TESTED | NOT TESTED |
| GPS denied / granted / accuracy / Follow                     | NOT TESTED | NOT TESTED |
| Camera / PhotosPicker multi-select                           | NOT TESTED | NOT TESTED |
| JPEG / PNG / HEIC / large photo / capture time               | NOT TESTED | NOT TESTED |
| Photo GPS does not overwrite observation position            | NOT TESTED | NOT TESTED |
| Lock / background / foreground / app close-reopen            | NOT TESTED | NOT TESTED |
| Network interruption / timeout / retry / desktop sync        | NOT TESTED | NOT TESTED |
| Unfinished drawing refresh / close / kill / Continue-Discard | NOT TESTED | NOT TESTED |
| Move / insert / delete / Undo / save-reopen geometry         | NOT TESTED | NOT TESTED |
| Portrait / landscape / sheet-inspector usability             | NOT TESTED | NOT TESTED |
| Rotate during active edit and upload                         | NOT TESTED | NOT TESTED |

Native HEIC remains normalized to JPEG. Raw Web HEIC failure displays a clear preserved-photo fallback and original-file link; no conversion service introduced. TestFlight signing/configuration steps are in TESTFLIGHT.md.

## Alpha 2 automated hardening

Local production tests cover unfinished polygon/line/rectangle recovery, scoped Continue/Discard, 44px handles, translation/Undo, insertion/deletion/minimum geometry and exact save/reopen; official VIC/NSW address/PFI/CADID identity, map identify and repeat save; layer order/opacity; indexed/exact viewport geometry, cursor/delta and 500 parcels/500 observations/502 features/ten references; complete-layer edit preserves off-screen feature IDs. Share preview has no writes, changed scope requires review, manager listing excludes tokens, retained URL reopens, revoke/expiry/private exclusions and distributed gateway/direct-RPC denial pass. Physical device/signing remains a separate NOT TESTED acceptance class.

## Alpha 3 software acceptance checkpoint

Property Planning uses full multipart/hole boundary and real clipped coverage/provenance, with source failure/no-result/unsupported distinctions; deterministic API/UI tests are separate from public live VIC/NSW source read verification. Linked/Nearby/Spatially intersects relations remain distinct. Cross-device create/update/delete plus media-parent invalidation pass. Concurrent writer/rollback cursor correctness is tested in disposable PostgreSQL. Recent searches survive reload but remain account/Workspace/device scoped. Personal View scope preview has no writes, counts all selected-layer features (including off-screen), cancels/confirms and rejects foreign/anonymous requests; frozen public sharing/private exclusions remain separate. Fixed diagnostic payload tests reject geometry/photo URL/extra fields and unauthenticated callers; Field durable retry still passes.

Distributed share perimeter is **PASS** through the production Postgres-backed gateway: concurrent caller/token limits, valid projection, malformed/invalid tokens, immediate revoke, expiry and no-store/no-referrer behavior passed. Direct anon/auth execution of the old resolver/status RPCs is revoked and regression-tested. Optional Vercel Firewall defense in depth remains unavailable through the connected API and is not part of this PASS. FSR/Height review is **COMPLETE — DISABLED** pending safe display semantics and representative coverage validation. Alerts/retention and signed physical acceptance remain open. No full MaxQI import/photo copy/cutover.
