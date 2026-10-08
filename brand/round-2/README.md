# LandOS App Icon Redesign — Round 2

This directory began as design exploration only. The owner later selected a refined **Concept B — Spatial Data Overlay / 多维空间数据图层** direction supplied after the original A/B/C board. The untouched review checkpoint remains on `codex/landos-app-icon-round-2-review`; the selected production-intent implementation lives on `codex/landos-spatial-overlay-icon-v2`.

The selected vector review copy is `concept-b-spatial-data-overlay-v2.svg`. Its canonical source is `brand/landos-app-icon.svg`; generated 32/60/120/1024 and iOS-mask previews use the `selected-spatial-data-overlay-*` filenames in `previews/`.

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

Regenerate the original comparison board with `npm run brand:round2`. Regenerate the owner-selected production icon derivatives with `npm run brand:assets`.
