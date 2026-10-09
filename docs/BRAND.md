# LandOS visual identity

LandOS is positioned as a professional GIS and land-intelligence workspace, not a property listing portal or real-estate agency. The system is original, geometric and asset-light: no stock imagery, third-party marks or generated photo assets are used.

## Current icon — Terrain Layers

The owner selected Terrain Layers on 2026-10-09. It is the sole current LandOS icon language: three translucent spatial planes represent map datasets, the neon-lime asymmetric parcel represents the active analysis, and continuous equal-interval contours establish the land context. The contour geometry is procedurally generated from an original synthetic elevation field; no external map, terrain dataset or raster artwork is embedded.

Use the complete mark for App Icon, favicon, home-screen and product-header icon applications. At small sizes, the three-plane silhouette and active parcel are primary; contour detail may recede naturally. Do not add pins, numbered nodes, houses, roofs or additional symbols. Do not redraw the contours as arbitrary decorative waves.

## Direction study

| Direction     | Core idea                                                                      | Strength                                                                                  | Risk                                                                              | Decision     |
| ------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------ |
| Survey Grid   | A cadastral parcel, intersecting analytical axes and a field observation point | Reads as survey/GIS at app-icon and favicon sizes; fits map, planning and field workflows | Requires disciplined spacing so it does not become visually busy                  | Superseded   |
| Contour Pulse | A topographic contour resolving into an observation point                      | Human, geographic and fluid                                                               | Loses precision at small sizes and leans toward recreation/outdoors               | Not selected |
| Terrain Axis  | Terrain planes forming a directional analytical arrow                          | Bold and authoritative                                                                    | Can read as an outdoor or civil-engineering brand rather than a spatial workspace | Not selected |

Comparable first-round boards are in `brand/concepts/`. Round 2 explorations and the selected Terrain Layers source are in `brand/round-2/`.

## Identity system

- **Mark:** three glass-like spatial planes over original topographic contours, with one neon active parcel. Keep the shapes, vertical spacing and perspective unchanged.
- **Wordmark:** `LandOS`, with `OS` in Terrain Green when colour is available. Use the supplied SVG rather than recreating the lockup for artwork.
- **Primary colours:** Terrain Ink `#11191E`, Deep Slate `#1A2227`, Terrain Green `#638A54`, Analysis Lime `#D4FC34`, Glass Blue `#759CA7`, Paper `#F4F3E9`.
- **UI neutrals:** Slate `#687A73`, Line `#D9DED3`, White `#FFFFFF`.
- **Typography:** Manrope for display/wordmark-like headings and DM Sans for UI/body, with system sans-serif fallbacks. Product function and accessibility take precedence over branding.
- **Minimum mark size:** 20 px digital. Below 32 px, use the mark alone. Clear space is at least one quarter of the mark width.
- **Contrast:** use Paper on Terrain Ink or Terrain Ink on Paper. Analysis Lime is reserved for active analytical geometry and should not be used as body text.

## Product application

- The landing page, sign-in flows, map header, public-share header, web metadata, manifest and iOS launch experience share the same mark, colours and naming.
- The app icon has an opaque square background. Its internal composition has a rounded safe field, while iOS applies the final platform mask.
- Map data colours and official-source symbology are not recoloured merely to match the brand. Provenance, legend meaning and workflow state remain authoritative.
- Motion is restrained. The native launch mark uses a short opacity/scale entrance and respects Reduce Motion.

## App Store screenshot templates

Editable SVG templates are supplied for 6.7-inch iPhone (`1290 × 2796`) and 12.9/13-inch iPad (`2064 × 2752`) portrait compositions. Replace bracketed copy and the dashed screenshot area only. Use captures from a reviewed build with publishable data; never imply an Apple approval, live data coverage, offline capability or signed-device result that has not been verified. Store requirements can change, so confirm accepted device sizes in App Store Connect when uploading.

Suggested sequence: map/workspace overview, official parcel search, property Planning, field observation/photos, drawing/layers, and explicit-scope sharing. Every caption must describe the visible verified behaviour.

## Source and regeneration

- Vector masters: `brand/landos-mark.svg`, `brand/landos-logo.svg`, `brand/landos-app-icon.svg`. Reproducible source: `brand/round-2/svg-finalists/render-c4-terrain-layers.cjs`.
- Web and iOS raster assets are deterministic derivatives. Run `npm run brand:assets` after editing the app-icon master.
- Do not edit generated PNGs by hand. Review at 16, 32, 60, 120, 180, 512 and 1024 px after regeneration.

## Human review and rollback

Before merge, review the three concept boards, mark legibility at 16/32 px, the unmasked 1024 px icon, iOS masked previews, landing/login/map/share lockups, launch timing with Reduce Motion, and all App Store copy. Final store screenshots and signed-device acceptance remain manual; no Apple review or approval is implied.

This identity is isolated from the database and all MaxQI/Supabase configuration. Before merge, rollback is simply to leave or close the branch. After merge, revert the Visual Identity branch merge commit, run the normal Web and four unsigned Simulator jobs, and redeploy the resulting Main commit. Reverting removes the new visual assets/components and restores the prior presentation without a schema, data or credential rollback.
