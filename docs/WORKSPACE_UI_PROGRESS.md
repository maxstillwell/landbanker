# Workspace UI redesign — work in progress

Branch `codex/landos-workspace-ui` builds on the unmerged map-quality candidate `1e32bab`; current main/rollback reference was `7673fec75203a51fc27b3f6ff7738e29869db807` at the previous verification. Fetch main again before integration.

The owner's screenshot is the primary visual reference. Required outcome: collapsible left library and right Inspector, a single continuously mounted MapLibre scene, draggable keyboard/touch-accessible floating Layers/Spatial/Location controls, scoped device-local layout with reset and responsive phone/tablet behavior, verified commercial-use free satellite imagery and reliable GPS/follow, without weakening existing workflows or security.

An initial `FloatingMapWidget` component and dark widget styles are staged as a starting point only. It is deliberately not connected to the workspace yet: integration needs map/sidebar-aware constraints, mobile safe areas, resize observation, pointer-capture cleanup, a storage hydration/reset contract, keyboard/mouse/touch tests and visual review. Do not treat this component as completed acceptance. Existing map and workflows remain the active interface.

The source/licence research and current HTTP403 network blocker from `MAP_QUALITY_PROGRESS.md` and `SATELLITE_RESEARCH.md` remain relevant. A network-only LandOS Development draft was saved but requires publication. Do not fabricate satellite imagery, claim real-provider/browser testing, merge, or deploy before the explicitly required checks pass. Owner has already authorized deployment when ready; no intermediate application approval is needed.

Exact next step: inspect the workspace UI and current main, then integrate/test the widget and independent panels without remounting the map; add the Layers and Spatial tool controls to existing workflows, device-scoped restore/reset, responsive behavior, GPS states and screenshots. Complete live source/imagery licence and placement verification once network access is active, then run the existing full regression suite and safe main/deployment workflow.
