# NSW aggregate statistical products — Release B

Runtime **11f6537dbf1cb59e762f2b6fa0a55020eb4cc889** is on main / Production READY,
formal alias landbanker.vercel.app verified at dpl_BSNNtqEfbJBbgawhvJhFnrU6goyM.
All three products are available beta and opt-in. Catalogue verified: 36 entries /
34 available after disabled staging and guarded catalogue-only activation. Reuses the existing registry, authenticated
bounded feature API, ABS ArcGIS adapter, catalogue, choropleth and area Inspector.
No new table, Auth/RLS policy, user record or paid infrastructure.

| Product | Original observations | Matched coverage | Indicators |
| --- | --- | --- | --- |
| NSW median sale prices · LGA | DCJ Report 156; March quarter 2026; extracted 31 July 2026 | 126 of 127 source LGA labels | Total / Non Strata / Strata medians and sale volumes; published all-sales quarterly/annual median change |
| NSW median weekly rent · LGA | DCJ Report 156; June quarter 2026; extracted 31 July 2026 | 127 of 128 source LGA labels | New-bond weekly medians for all dwellings, House, Flat/Unit, three-bedroom houses and two-bedroom flats; all-dwelling new bonds, total bonds held and median changes |
| NSW recorded criminal incidents · LGA | BOCSAR monthly workbook January 1995–June 2026; release 16 September 2026 | 128 bounded councils; special/non-spatial records excluded | Dwelling/non-dwelling break and enter, motor vehicle theft, domestic/non-domestic violence assault; twelve-month sums ending June 2017–2026 |

## Exact originals and commercial reuse

- [DCJ published report/downloads](https://dcj.nsw.gov.au/about-us/families-and-communities-statistics/housing-rent-and-sales/rent-and-sales-report.html):
  [sales XLSX](https://dcj.nsw.gov.au/documents/about-us/families-and-communities-statistics/housing-and-rent-sales/sales-tables-march-2026-quarter.xlsx)
  and [rent XLSX](https://dcj.nsw.gov.au/documents/about-us/families-and-communities-statistics/housing-and-rent-sales/rent-tables-june-2026-quarter.xlsx).
  Original embedded explanatory-note images were reviewed. Their Crown copyright
  notice contains no separate non-commercial restriction. The [DCJ copyright
  policy](https://dcj.nsw.gov.au/statements/copyright-and-disclaimer.html) applies
  CC BY 4.0 except its stated exclusions. These are DCJ-hosted aggregate tables;
  no bulk individual property sale records are used. Required attribution, source
  date and LandOS modifications are retained. Latest report page rechecked
  31 October 2026 still links these quarters.
- [BOCSAR dataset page](https://bocsar.nsw.gov.au/statistics-dashboards/open-datasets/criminal-offences-data.html)
  links the [actual LGA XLSM](https://bocsarblob.blob.core.windows.net/bocsar-open-data/RCI_offencebymonth.xlsm).
  [The exact Data.NSW resource](https://data.nsw.gov.au/data/dataset/nsw-crime-and-policing-statistics/resource/1d5b2851-52e9-4327-a81b-19149c63f736)
  assigns Creative Commons Attribution to this external-hosted file. Preserve its
  [original licence-family link](https://opendefinition.org/licenses/cc-by/);
  do not infer a licence from DCJ's blanket policy, which excludes external hosts.
  Macros are never executed. The next provider release is December 2026; the
  finer suburb/postcode series only runs through 2025 and is not this product.
- Geometry: [ABS ASGS 2025 LGA service](https://geo.abs.gov.au/arcgis/rest/services/ASGS2025/LGA/MapServer/1),
  `LGA_CODE_2025`, `LGA_NAME_2025`, fixed `STATE_CODE_2021='1'` filter.
  [ABS copyright policy](https://www.abs.gov.au/website-privacy-copyright-and-disclaimer)
  supplies the applicable CC BY 4.0 boundary reuse terms.

Exact URLs, byte sizes, SHA-256 hashes, licence evidence, original periods and
refresh limits are in `src/lib/layers/data/nsw-import-manifest.json`.

## Ingestion, geography and meaning

`scripts/import-nsw-statistics.py` reads reviewed XLSX/XLSM cells offline. It
locks the five original hashes because market reporting dates are embedded in
images. It rejects changed originals until their notes/periods are reviewed.
Only the original statewide LGA scope is selected; repeated regional rollups
are never summed. Source sales prices in $000 are converted to AUD. `s` and `-`
markers and absent rows stay explicit; missing values are never zero-filled.
Only one sales and one rent quarter is imported. Published changes are not used
to reconstruct an invented historical median series. Source procedures changed
in September 2017.

Sales use contract dates, not settlements. The original upper/lower five-percent
exclusion and notification lag remain documented. Non Strata / Strata are not
universal detached-house / apartment definitions. Rent uses new bonds, excludes
social housing, and is distinct from advertised asking rents, occupied-stock
rents and Victoria's moving annual suburb figures. Total bonds held is a stock
measure. Neither product invents suburb or property-level precision.

`nsw-lga-crosswalk.json` retains original labels and explicit ABS 2016/2025 code
evidence. NSW-qualified duplicate names remain explicit. Official temporary
names Gundagai and Western Plains Regional map through the reviewed rename
evidence to 12160 and 12390. Armidale Regional's retired code remains unmapped;
similar names do not justify a boundary correspondence. Balranald has no source
sales row and suppressed rent medians. In Custody, Lord Howe Island and
Unincorporated Far West never become neighbouring LGA polygons. Source boundary
vintage is unspecified: current reference polygons do not reconstruct historical
boundaries or redistribute observations.

BOCSAR annual counts sum twelve original monthly observations for each exact
category/LGA. Missing months remain missing. No grand total, new population rate
or harmonised VIC/NSW ranking is invented.

Versioned JSON stays on the server. Only public simplified viewport geometry is
cached for 24 hours through the existing adapter; authenticated responses remain
private/no-store. Existing 15-second timeout, 4 MB cap, 250-feature bound and
opt-in/disabled request behaviour remain. Quarterly refresh is a controlled
review/import/diff/validation/release, with no unattended ingestion.

The existing period control now supports explicit quarter labels; annual and
Census controls retain their existing identifiers. No competing layer manager.

## Validation checkpoint

- Local lint, typecheck, 74 unit checks and optimized production build passed.
- Six NSW checks include independent original Lismore/Sydney/Blacktown values,
  suppressions, missing rows, a genuine zero quarterly rent change, code changes,
  category semantics and strict quarter handling.
- `scripts/verify-nsw-statistics.ts`: 21/21 actual ABS viewport/point/statistic
  joins passed across Lismore, Dunoon, Sydney, Blacktown, Gundagai and Dubbo.
  [Recorded evidence](PROFESSIONAL_LAYERS_NSW_VERIFICATION.json).
- New complete catalogue/Inspector desktop/mobile browser workflow is prepared,
  with real disposable Auth/RLS/preferences, actual imported observations and
  explicit fixture geometry. CI **41159657368** completed **18/18**, retaining all 17 prior workflows.
  The NSW path validates actual prices/rent/incidents, quarters, category/year
  changes, a genuine zero and retained code/year/value after using the existing
  phone sheet handle. Desktop/mobile evidence was reviewed. Real production-
  account acceptance remains unavailable and is not claimed.
- CLI created the migration at version 20261031013927; hosted version
  **20261031023910_professional_nsw_statistics** was applied after full acceptance
  and matching READY. The repository filename matches hosted history with
  unchanged SQL bytes. Three disabled entries were verified before guarded
  catalogue-only activation. No private records or Auth/RLS changes.
  [Acceptance](PROFESSIONAL_LAYERS_NSW_ACCEPTANCE.json),
  [production checks](PROFESSIONAL_LAYERS_NSW_PRODUCTION.json).
