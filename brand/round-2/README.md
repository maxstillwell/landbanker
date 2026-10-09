# LandOS App Icon Redesign — Round 2

## Final selection — Terrain Layers

The owner selected `svg-finalists/landos-c4-terrain-layers.svg` on 2026-10-09 as the final LandOS icon language. It combines three translucent analytical planes, an asymmetric active parcel and original equal-interval synthetic terrain contours. `svg-finalists/render-c4-terrain-layers.cjs` is the reproducible vector generator. The selected artwork is promoted to `brand/landos-app-icon.svg` and `brand/landos-mark.svg`; generated Web and iOS icon assets derive from that master.

The earlier concepts remain in this directory as design history and rollback references. They are not current LandOS identity assets.

## Spatial Data Overlay v3 — focused icon review

The owner-requested Spatial Data Overlay exploration is isolated in
`concept-b-spatial-data-overlay-v3.svg`. It follows the supplied visual reference
with three perspective data planes, bright analytical nodes, connecting paths and
a dense topographic contour field. The SVG remains a full square; rounded corners
are applied only in iOS review previews.

Generate the focused review assets with `npm run brand:overlay-review`.

The round began as design exploration. The final selection above now supplies the formal App Icon, Web icon/mark and iOS asset catalog. Broader interface restyling remains separate from this icon decision.

## Concepts

### A — Signature L

A custom geometric L is the sole hero. Its diagonal inset suggests a cross-section of land without becoming a map, pin or surveying symbol. The cobalt/navy base and electric-lime cut aim for a premium international software character.

Small-size review: the L silhouette remains clear at 32 px. The lime stratum remains visible; the coral terminal becomes a compact accent. At 60 and 120 px, the chamfer, cut and terminal are all distinct.

### B — LandOS Monogram

An interlocking L and O creates an ownable LO ligature rather than ordinary typed initials. The O is a soft technical frame and the L anchors the lower-left silhouette. Plum, mint and coral deliberately move away from the first-round forest palette.

Small-size review: at 32 px the mark reads as a bold monogram; the internal overlap is clearer from 60 px upward. The silhouette stays distinct from Concept A because it is centred, rounded and interlocking rather than directional.

### C — Wordmark Icon

The full name is treated as a two-level custom typographic block: LAND above a dominant OS. This is the better typographic solution than squeezing a conventional one-line wordmark into an App Icon. It uses constructed vector capitals, not live text.

Small-size review: LAND is intentionally secondary and becomes a texture at 32 px while OS carries recognition. LAND is readable at 60 px and fully clear at 120/1024 px. The warm orange/coral field gives this option a very different shelf presence.

## Review assets

- `comparison-board.svg` — self-contained vector comparison board.
- `previews/comparison-board.png` — review-ready raster board.
- `concept-a-signature-l.svg`, `concept-b-landos-monogram.svg`, `concept-c-wordmark-icon.svg` — original 1024-square scalable sources with no pre-rounded corners.
- `previews/concept-{a,b,c}-{32,60,120,1024}.png` — exact-size readability checks.
- `previews/concept-{a,b,c}-ios-mask.png` — rounded-square iOS mask simulations.

Light and dark iPhone home-screen simulations are included on the comparison board. They are visual scale checks, not screenshots from an Apple build.

## Constraints and ownership

All geometry is original and repository-native. No third-party marks, type artwork, stock assets, map symbols, houses, roofs or location pins are used. Existing Visual Identity v1 assets remain unchanged as reference/rollback material. No MaxQI, Supabase, database or LandOS business code is touched.

Regenerate the selected source with `node brand/round-2/svg-finalists/render-c4-terrain-layers.cjs`, promote it to the formal vector masters, then run `npm run brand:assets`. Regenerate the older comparison assets with `npm run brand:round2` only when reviewing the archived concepts.
