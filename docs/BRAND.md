# LandOS visual identity v2

LandOS is positioned as a professional GIS and land-intelligence workspace, not a property listing portal or real-estate agency. The system is original, geometric and asset-light: no stock imagery, third-party marks or generated photo assets are used.

## Selected direction

The owner superseded the first-round Survey Grid direction and selected **Concept B — Spatial Data Overlay / 多维空间数据图层** after Round 2 review. The selected mark uses three perspective data planes, a luminous active parcel and a small connected-node system. It communicates LandOS Layers, parcel/boundary analysis and linked land records without houses, roofs, pins, numbers or surveying clip art.

The first identity remains available in Git history and on `codex/landos-visual-identity-v1`. Round 2 exploratory alternatives remain on `codex/landos-app-icon-round-2-review`. The selected implementation is isolated on `codex/landos-spatial-overlay-icon-v2` until merge approval.

## Identity system

- **Mark:** three offset planes represent composable spatial layers; the bright upper parcel represents the active analysis selection; restrained nodes and connectors represent linked records and tools. Keep the layer order and proportions unchanged.
- **Wordmark:** `LandOS`, with `OS` in Spatial Green when colour is available. Use the supplied SVG rather than recreating the lockup for artwork.
- **Primary colours:** Night `#0A0F1D`, Deep Slate `#1A253B`, Signature Lime `#D4FC34`, Analysis Lime `#A3E635`, Spatial Green `#10B981`, Data Blue `#3B82F6`.
- **UI neutrals:** Slate `#687A73`, Line `#D9DED3`, White `#FFFFFF`.
- **Typography:** Manrope for display/wordmark-like headings and DM Sans for UI/body, with system sans-serif fallbacks. Product function and accessibility take precedence over branding.
- **Minimum mark size:** 20 px digital. Below 32 px, use the mark alone. Clear space is at least one quarter of the mark width.
- **Contrast:** use cream on Night or Night on cream. Signature Lime is reserved for selected data, nodes and short accents; it is not body text on light surfaces.

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

Before merge, review the selected mark at 16/32/60/120 px, the unmasked 1024 px icon, iOS masked previews, landing/login/map/share lockups, launch timing with Reduce Motion, and all App Store copy. Final store screenshots and signed-device acceptance remain manual; no Apple review or approval is implied.

This identity is isolated from the database and all MaxQI/Supabase configuration. Before merge, rollback is simply to leave or close the branch. After merge, revert the Visual Identity branch merge commit, run the normal Web and four unsigned Simulator jobs, and redeploy the resulting Main commit. Reverting removes the new visual assets/components and restores the prior presentation without a schema, data or credential rollback.
