# Professional Layers Phase 2

## Baseline — 31 October 2026 AEDT

Fetched latest main: `8beeaceed1e056224ead7428276fe89427afc8a4`. Working tree was clean. Phase 1 release/register/status and architecture/security/team instructions reviewed. Existing server-owned registry, per-user/workspace preferences, bounded feature API, import manifests, MapLibre renderer and Inspector are reused. Previous release: 29 available products; two retained disabled NSW products. New products will stage disabled until matching runtime/data and browser checks pass.

Local Docker and gh are absent; authenticated disposable integration runs use existing GitHub CI. Real production account acceptance remains unavailable. No credentials requested, auth bypass or private customer test data.

## Stability investigation

The old Field test searches for Add observation directly on a phone. The old `.field-action` is hidden; the current phone route is More → Observations → Add observation. Tests now follow real current UI controls while retaining GPS/photo/private storage/sync/recovery/isolation/share assertions. A genuine companion defect was found: phone Layers/Properties/More navigation did not pause/persist an Observation draft like the desktop rail. Those actions now await the existing pauseObservation operation. The test asserts draft preservation and map-click release across navigation.

The browser runner now executes every existing suite sequentially and returns failure if any suite fails, rather than stopping after the first failure and concealing later regressions. No suite/assertion is removed or skipped. Results and new product/source evidence will be recorded as work completes.

## Victoria source and geography evidence

Official VGV annual house/unit/vacant-land XLSX files: calendar years 2015–2025. Guide explanatory notes confirm the publisher uses gazetted neighbourhoods/localities sourced from LASSI. `^` means fewer than ten sales; `*` is a previous-year median carried forward due to zero sales. Carried values stay in published evidence but are missing for observed-price choropleths and growth. Preliminary 2026 columns are excluded. No sales-volume column exists in these suburb time-series files.

Official Vicmap Admin Locality WFS supplies stable PFI and VICNAMES identities. The 31 October attribute snapshot contains 2,973 distinct bounded localities with unique names. Import creates an explicit versioned exact-name-to-PFI crosswalk. It never fuzzy-matches, strips disambiguating qualifiers, merges a neighbourhood into a parent suburb or maps an LGA median onto a suburb. Matched price geography: 771 bounded localities across three property types. All unmatched source names are retained in vic-suburb-crosswalk.json, including Syndal and Sanctuary Lakes. WFS geometry is live current reference geometry; historical statistics do not reconstruct historical boundaries.

CSA June 2026 LGA workbook Table 03 contains 371,541 unique year/LGA/postcode/suburb/subgroup observations. Matched bounded locality geography: 2,850. Selected category counts and overall subgroup sums preserve source LGA/postcode labels. Published small sensitive homicide/sexual-offence counts are confidentiality-adjusted. Sums are not forced to reconcile with published LGA totals, absent categories are not inferred as zero, and no suburb crime rates or residential-only burglary counts are fabricated.

Dataset-specific CC BY 4.0 evidence: VGV DataVic house/unit/vacant-land time-series records, CSA recorded-offence DataVic record and Vicmap Locality Polygon DataVic record. Source URLs, file hashes, original periods, crosswalk and limitations are in suburb-import-manifest.json and the product metadata. Imports are server-side versioned JSON; browser receives bounded viewport features only. Geometry queries reuse the existing private/no-store authenticated API, caps and cache policy through a fixed WFS CRS84 adapter. No new database table, Auth/RLS policy or infrastructure.

Real WFS/source checks passed 12/12 across Vermont South, Glen Waverley, Mount Waverley, Box Hill, Point Cook and Melton. Results: PROFESSIONAL_LAYERS_SUBURB_VERIFICATION.json. Local lint/typecheck/68 tests/optimized build passed. Migration was tested inside a rollback transaction: two new disabled products, original 29 available products preserved. It has not yet been applied or activated.

## Rent access investigation

Official DFFH report page, current June 2026 LGA and suburb file endpoints, licensed September 2025 LGA endpoint, June 2025 LGA endpoint and December 2023 release all returned HTTP503 (85-byte error bodies). Exact resource URLs and responses are retained during investigation. DataVic metadata is available with CC BY 4.0 but is not the workbook. No third-party transformed data, estimates or substitute rent values are ingested. Rent remains unavailable; independent verified datasets continue.

## NSW research checkpoint

Official DCJ aggregate rent June 2026 and sales March 2026 XLSX files downloaded successfully after following the government's 302 redirects to /documents/. They contain LGA and postcode tables with repeated regional rollups: imports must select a single original geographic scope, not sum duplicate rows. Sales categories are Strata / Non Strata / Total, not exact universal house/unit definitions. Rent is new bonds, with separate dwelling/bedroom categories. s and - are suppressed/count-restricted markers, not numeric zero. DCJ policy licenses its material under CC BY 4.0 except listed exclusions; original workbook/notes require review of exceptions. Release B is not implemented or activated yet.
