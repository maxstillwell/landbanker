# LandOS visual identity v1

LandOS is positioned as a professional GIS and land-intelligence workspace, not a property listing portal or real-estate agency. The system is original, geometric and asset-light: no stock imagery, third-party marks or generated photo assets are used.

## Direction study

| Direction     | Core idea                                                                      | Strength                                                                                  | Risk                                                                              | Decision     |
| ------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------ |
| Survey Grid   | A cadastral parcel, intersecting analytical axes and a field observation point | Reads as survey/GIS at app-icon and favicon sizes; fits map, planning and field workflows | Requires disciplined spacing so it does not become visually busy                  | **Selected** |
| Contour Pulse | A topographic contour resolving into an observation point                      | Human, geographic and fluid                                                               | Loses precision at small sizes and leans toward recreation/outdoors               | Not selected |
| Terrain Axis  | Terrain planes forming a directional analytical arrow                          | Bold and authoritative                                                                    | Can read as an outdoor or civil-engineering brand rather than a spatial workspace | Not selected |

Comparable boards are in `brand/concepts/`. Survey Grid best matches the existing product because its parcel boundary, layered intersections and point marker map directly to Parcel, Layers/Planning and Field without implying listings, home sales or valuation.

## Identity system

- **Mark:** the irregular cream parcel is the object of record; lime axes represent layered spatial analysis; the clay point represents an observation or decision. Keep the shapes and proportions unchanged.
- **Wordmark:** `LandOS`, with `OS` in Mapping Green when colour is available. Use the supplied SVG rather than recreating the lockup for artwork.
- **Primary colours:** Survey Ink `#0B302D`, Mapping Green `#517A55`, Analysis Lime `#A8CB71`, Field Clay `#E29A55`, Paper `#F4F3E9`.
- **UI neutrals:** Slate `#687A73`, Line `#D9DED3`, White `#FFFFFF`.
- **Typography:** Manrope for display/wordmark-like headings and DM Sans for UI/body, with system sans-serif fallbacks. Product function and accessibility take precedence over branding.
- **Minimum mark size:** 20 px digital. Below 32 px, use the mark alone. Clear space is at least one quarter of the mark width.
- **Contrast:** use cream on Survey Ink or Survey Ink on cream. Analysis Lime is an accent, not body text on cream. Field Clay is a locator/accent, not a full-surface background.

## Product application

- The landing page, sign-in flows, map header, public-share header, web metadata, manifest and iOS launch experience share the same mark, colours and naming.
- The app icon has an opaque square background and no pre-rounded corners; iOS applies its own mask.
- Map data colours and official-source symbology are not recoloured merely to match the brand. Provenance, legend meaning and workflow state remain authoritative.
- Motion is restrained. The native launch mark uses a short opacity/scale entrance and respects Reduce Motion.

## App Store screenshot templates

Editable SVG templates are supplied for 6.7-inch iPhone (`1290 × 2796`) and 12.9/13-inch iPad (`2064 × 2752`) portrait compositions. Replace bracketed copy and the dashed screenshot area only. Use captures from a reviewed build with publishable data; never imply an Apple approval, live data coverage, offline capability or signed-device result that has not been verified. Store requirements can change, so confirm accepted device sizes in App Store Connect when uploading.

Suggested sequence: map/workspace overview, official parcel search, property Planning, field observation/photos, drawing/layers, and explicit-scope sharing. Every caption must describe the visible verified behaviour.

## Source and regeneration

- Vector masters: `brand/landos-mark.svg`, `brand/landos-logo.svg`, `brand/landos-app-icon.svg`.
- Web and iOS raster assets are deterministic derivatives. Run `npm run brand:assets` after editing the app-icon master.
- Do not edit generated PNGs by hand. Review at 16, 32, 60, 120, 180, 512 and 1024 px after regeneration.

## Human review and rollback

Before merge, review the three concept boards, mark legibility at 16/32 px, the unmasked 1024 px icon, iOS masked previews, landing/login/map/share lockups, launch timing with Reduce Motion, and all App Store copy. Final store screenshots and signed-device acceptance remain manual; no Apple review or approval is implied.

This identity is isolated from the database and all MaxQI/Supabase configuration. Before merge, rollback is simply to leave or close the branch. After merge, revert the Visual Identity branch merge commit, run the normal Web and four unsigned Simulator jobs, and redeploy the resulting Main commit. Reverting removes the new visual assets/components and restores the prior presentation without a schema, data or credential rollback.
