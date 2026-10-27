# Map quality and basemap upgrade — 27 October 2026 AEDT

Branch: `codex/landos-map-quality-basemaps`.
Main/rollback baseline: `7673fec75203a51fc27b3f6ff7738e29869db807`.
Production target: https://landbanker.vercel.app (new upgrade deployment is not verified).
Owner authorizes implementation/testing/safe main integration/deployment without intermediate approvals. No MaxQI, Auth, RLS, Storage policy or database/schema change. No paid dependencies/services or Leaflet renderer.

## Implementation checkpoints

- `9f489c8`: zoom validation/error recovery, parcel-first selection/full geometry/halos, thematic zoning and five style swatches, source/licence research. Cloud CI [40453459170](https://github.com/maxstillwell/landbanker/actions/runs/40453459170) SUCCESS.
- `ef91953`: explicit zoning mode can inspect beneath a workspace analysis shape; contrast fixtures and cancelled-response-safe optional byte metrics. The functional scale, identity, tenant and security assertions remain enforced.
- `cf6f43f`: workspace rendered features retain their business identity in properties. Direct drawing/observation picking no longer relies on the tile renderer preserving string feature IDs. The real saved-analysis overlay regression passes.
- `40939df`: direct parcel picks keep the actual tapped ground point for the existing server re-verification API. Centroids can fall in holes/outside concave parcels; no security/API/schema contract is weakened. Full authoritative geometry and identifier are retained.

## Completed behavior

P0: `viewportZoom` validates finite values in [0,22] and floors to the containing request/cache level. 13.42→13 and 14.8→14; out-of-range, NaN, infinities, blank and invalid strings are rejected. The MapLibre camera remains fractional. Successful snapshots/cache hits clear stale errors; failed snapshots stop the old sync poll from masking the genuine failure. Error UI is compact, dismissible, accessible and has Retry.

P0: cadastral hits have priority over zoning hits. Full query features resolve through an explicit stable provider key rather than clipped render geometries. Parcel map clicks use the same OfficialParcel model/Inspector as search and map identify. White halo plus contrasting outline/subtle fill sits above planning fills; geometry survives pan/style changes. Fit to Parcel and Clear Selection are present. Lot/plan/identifier/source and clearly labelled boundary-derived area are shown; unknown property data is not invented.

P1: state-specific official zone-code display groups, seven colours, compact legend, opacity control without provider re-query on every slider change, borders, hover and persistent selected-zone halo. Explicit zoning mode can inspect below saved analysis polygons; normal workspace feature selection remains intact. Raw official codes/descriptions/provider/provenance remain available. NSW legacy environmental E codes are disambiguated from employment E codes using official descriptions; insufficient evidence stays neutral. Visual groups are explicitly not legal classifications.

P1: OpenFreeMap Liberty, Positron/Light, Bright (legacy stored key `terrain`), Dark and Fiord. Light is the default; account/Workspace camera preference wins. Accessible selector/swatches are illustrative. Same MapLibre instance reinstalls overlays, drawings, field features, catalogue opacity/visibility and selection on style load. Fiord errors fall back to Light with a visible notice. No Bright/Fiord DEM claim. Attribution remains visible; CARTO/Stamen/Paul Norman design attribution is included for Light, Dark and Fiord following their retrieved licences.

P2: [SATELLITE_RESEARCH.md](SATELLITE_RESEARCH.md) records exact candidate services, retrieved licence evidence, coverage/resolution/currency unknowns, restrictions and access results. DEA configuration declares CC BY 4.0; live capabilities/imagery are unverified. NSW imagery permission/coverage and suitable OpenAerialMap scenes are unverified. No Satellite option is fabricated or enabled.

## Validation

- Final lint, typecheck, 40 unit tests and production build PASS.
- All 13 browser/API/import workflows PASS on the stable-ID build. The complete suite also PASSes against the final tap-point/stable-ID build (`next start`); both target locations include actual saved-analysis overlay picking and selected-outline pixel checks.
- New regression uses Vermont South VIC (145.182,-37.856) and Lismore NSW (153.2773,-28.8135), authoritative-format synthetic public-provider fixtures and the real isolated Auth/database/Storage APIs. It asserts fractional zoom boundaries/retry, parcel-before-zone priority, actual selected-outline screenshot pixels after all five style switches, real saved-analysis shape picking followed by zoning inspection, opacity, one renderer and preserved workflow contracts.
- Existing Drawing/recovery, Field/photos/durable retry, Saved View restoration, public share scope/revoke/expiry/budgets/tenant isolation, Planning and two-device reconciliation pass. Source verification includes both states and the requested target locations.
- Synthetic provider/browser acceptance is distinct from live provider acceptance. Physical iPhone/iPad, real OpenFreeMap sprite/glyph/tile loading and current government source placement remain unverified in this environment.

## Actual release blocker

`npm run verify:map-sources` executed: all four official metadata requests failed with HTTP403 from the restricted network path. `npm run verify:basemaps` executed: all five live style requests failed with HTTP403. Production, DEA OWS, NSW imagery and OAM discovery requests are also denied. These are recorded failures/blockers, not passing or silently skipped checks. Provider-maintained GitHub documentation/style/licence/configuration sources were accessible and reviewed.

The supported network-only LandOS Development draft is saved, with `requires_publish: true`. Existing eight explicit domains are preserved; DEA OWS aliases, NSW imagery and OAM discovery hosts were added for the requested research. Saving the draft did not change the running instance. No credential values were requested or stored.

Main integration/deployment is held at the owner's required “after implementation and passing tests” gate because mandatory live-source verification cannot pass yet. Main remains the rollback baseline; no force-push, production data change or unverified deployment claim.

## Exact resume steps

1. Publish/apply the saved LandOS Development network draft in environment settings; recheck runtime readiness and actual host access.
2. Rerun `npm run verify:map-sources` and `npm run verify:basemaps`; resolve actual provider failures rather than treating accessibility as legal/visual acceptance.
3. Run real-source browser placement/picking/style/attribution checks at both target locations using the disposable local account/backend. Do not create fake production accounts or write to hosted Supabase for tests. Satellite remains disabled unless all product-level commercial-use, coverage, currency and rendering checks pass.
4. Confirm final branch CI. Fetch main, preserve any new changes, safely integrate/push without force under the owner's existing authorization. No new application-deployment approval is needed.
5. Inspect actual Vercel deployment and production revision/URL/worker asset. Use existing approved credentials if available; only request genuinely missing access through secure environment settings after diagnosing the actual operation. Do not infer a deployed SHA from Git push alone.
6. Record deployed SHA/URL, rollback baseline, live/browser limitations and the verified release outcome here and in STATUS.md.
