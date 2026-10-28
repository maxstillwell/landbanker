# Observation and parcel interaction fix

Rollback baseline: `48d004aea6f1bdd2c99a2b55989b917f67f9ae8e`.

An active observation draft previously intercepted map clicks even when another Inspector tab appeared selected, and closing the Inspector left that mode active. Switching tools or Inspector sections, closing the Inspector, or using **Save draft and close** now persists the device draft and releases map selection; **Resume** restores the draft. Active uploads and photo imports must finish before pausing. Existing drafts and photos are retained.

Saved parcel GeoJSON Features are unwrapped before rendering, so their Polygon/MultiPolygon boundaries can be selected and highlighted. Point-only records remain locations: no cadastral boundary is invented. The Inspector offers an official-boundary search and explicit confirmation; no real account data was inspected or changed during this fix, and the Balliang records have not been verified.

The local map-pages fixture creates synthetic records in an isolated backend. Functional checks now run before the unchanged 2,000 ms ten-frame assertion, so slow software rendering cannot prevent them from running. On this release candidate all map-pages functional checks passed, including the complete-layer edit retaining 502 feature IDs; the performance assertion still failed at 2,512 ms under SwiftShader. Existing evidence and the release exception are in MAP_PERFORMANCE_RELEASE.md. Lint, typecheck, 41 unit tests and production build passed; final-build observation switching/recovery and map-quality browser regressions passed, and the parcel regression passed on the preceding build.
