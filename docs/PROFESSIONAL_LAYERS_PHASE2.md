# Professional Layers Phase 2

## Baseline — 31 October 2026 AEDT

Fetched latest main: `8beeaceed1e056224ead7428276fe89427afc8a4`. Working tree was clean. Phase 1 release/register/status and architecture/security/team instructions reviewed. Existing server-owned registry, per-user/workspace preferences, bounded feature API, import manifests, MapLibre renderer and Inspector are reused. Previous release: 29 available products; two retained disabled NSW products. New products will stage disabled until matching runtime/data and browser checks pass.

Local Docker and gh are absent; authenticated disposable integration runs use existing GitHub CI. Real production account acceptance remains unavailable. No credentials requested, auth bypass or private customer test data.

## Stability investigation

The old Field test searches for Add observation directly on a phone. The old `.field-action` is hidden; the current phone route is More → Observations → Add observation. Tests now follow real current UI controls while retaining GPS/photo/private storage/sync/recovery/isolation/share assertions. A genuine companion defect was found: phone Layers/Properties/More navigation did not pause/persist an Observation draft like the desktop rail. Those actions now await the existing pauseObservation operation. The test asserts draft preservation and map-click release across navigation.

The browser runner now executes every existing suite sequentially and returns failure if any suite fails, rather than stopping after the first failure and concealing later regressions. No suite/assertion is removed or skipped. Results and new product/source evidence will be recorded as work completes.
