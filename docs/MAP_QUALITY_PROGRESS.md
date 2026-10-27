# Map quality and basemap upgrade — 27 October 2026 AEDT

Branch: `codex/landos-map-quality-basemaps`.
Rollback/main baseline: `7673fec75203a51fc27b3f6ff7738e29869db807`.
Owner authorizes implementation/testing/safe main integration/deployment without intermediate approvals. No MaxQI, Auth, RLS, Storage policy or database/schema change.

Implementation in progress: validated integer request zoom with fractional camera preserved; parcel-first picking from stable IDs/full provider query geometry; shared official search/identify selection and persistent halo; thematic zoning, explicit zoning inspection, opacity/legend/hover; Light default and five style swatches; compact genuine error/retry UI.

Network: current runtime denies production Vercel, OpenFreeMap style endpoints and DEA OWS with proxy HTTP403. The prior network draft is still inactive. Official provider-maintained GitHub sources are readable. Do not claim live-provider checks or production deployment passed. Keep checkpoints and exact remaining steps here.
