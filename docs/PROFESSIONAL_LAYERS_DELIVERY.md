# LandOS professional layers — delivery, 31 October 2026 AEDT

Core releases A and B are deployed as opt-in beta products. The complete roadmap is **not finished**: mandatory VIC rent remains blocked by official-file access, and the backlog below is not implemented. Production: https://landbanker.vercel.app. Verified catalogue: **36 entries / 34 available**; NSW FSR/height remain disabled.

## 1. Existing architecture findings

Current main was inspected before extension. The existing MapWorkspace/MapLibre scene, server-owned layer_catalog, user/workspace-scoped active_map_layers, Catalogue / Added to Map, ArcGIS export/direct-query adapters and Property Planning were reused. Statistical imports and choropleths were added within that architecture, with no competing layer manager. [Initial audit](PROFESSIONAL_LAYERS_RELEASE.md), [exact existing services/attributes](OFFICIAL_DATA_INVENTORY.md).

Cadastre, VIC/NSW zoning, flood references, NSW minimum lot size and heritage remain. BMO/heritage IDs were enriched in place. Properties, Research Areas, Observations and uploaded KML/KMZ/GeoJSON remain separate from official products. No private production records/preferences, Auth/RLS architecture, MaxQI schemas or maxqi.com source were changed. Historical licence uncertainty for unchanged legacy entries is not retrospectively labelled resolved.

Real fixes include phone Observation draft preservation, the existing parcel-search entry, private feature listing/selection and Undo, Saved View visibility restoration, and preventing delayed full-geometry responses from reopening the Inspector after navigation to Layers. A deterministic delayed-real-API test covers that race. Original geometry, isolation and performance assertions remain.

## 2. New layers implemented

Phase 1 added 19 products and enriched two existing IDs: selectable VIC overlays, statutory UGB, BPA distinct from BMO, VPA precincts, NSW flood/BFPL, national population/SEIFA/approvals, VIC LGA medians/crime and VIC school points. [Complete register: each URL, API, organisation, coverage, period, frequency, licence, fields and status](PROFESSIONAL_LAYERS_REGISTRY.md).

This continuation adds five available beta products:

| Product | Organisation / source | Coverage / period | Refresh / licence | Actual statistical fields |
| --- | --- | --- | --- | --- |
| VIC suburb median property prices | [Valuer-General Victoria](https://www.land.vic.gov.au/valuations/resources-and-reports/property-sales-statistics) | 771 matched bounded localities across property types; calendar years 2015–2025 | Annual controlled import; dataset-specific CC BY 4.0 and Vicmap attribution | house, unit, land, original markers; observed annual house median change |
| VIC suburb recorded offences | [Crime Statistics Agency](https://discover.data.vic.gov.au/dataset/data-tables-recorded-offences) | 2,850 matched localities; years ending June 2017–2026 | Quarterly source / rolling annual observations; CC BY 4.0 | Published subgroup sum, burglary, theft, motor theft, assault, source LGA/postcode |
| NSW median sale prices · LGA | [DCJ Report 156](https://dcj.nsw.gov.au/about-us/families-and-communities-statistics/housing-rent-and-sales/rent-and-sales-report.html) | 126 matched LGAs; March quarter 2026, contract dates | Quarterly controlled import; DCJ CC BY 4.0 | Total / Non Strata / Strata medians and volumes; published quarterly/annual changes and markers |
| NSW median weekly rent · LGA | [DCJ Report 156](https://dcj.nsw.gov.au/about-us/families-and-communities-statistics/housing-rent-and-sales/rent-and-sales-report.html) | 127 matched LGAs; June quarter 2026, private-market new bonds | Quarterly controlled import; DCJ CC BY 4.0 | Weekly medians for selected original dwelling/bedroom categories, new bonds, total bonds held, changes and markers |
| NSW recorded criminal incidents · LGA | [BOCSAR](https://bocsar.nsw.gov.au/statistics-dashboards/open-datasets/criminal-offences-data.html) | 128 bounded councils; years ending June 2017–2026 | Quarterly source / monthly observations; exact resource Creative Commons Attribution, ABS boundaries CC BY 4.0 | Dwelling/non-dwelling break and enter, motor vehicle theft, domestic/non-domestic violence assault; twelve-month sums |

[Exact VIC files, hashes and licence evidence](../src/lib/layers/data/suburb-import-manifest.json), [exact NSW files and evidence](../src/lib/layers/data/nsw-import-manifest.json), [NSW methodology](PROFESSIONAL_LAYERS_NSW.md). The BOCSAR external file has dataset-specific Data.NSW licensing evidence; it is not licensed by assuming DCJ's website policy covers external hosts. No raw individual NSW property sales or proprietary property sources were ingested.

## 3. Data integration

Live planning reuses the existing ArcGIS adapters. A fixed Vicmap Locality WFS adapter supports bounded viewport queries and explicit CRS84 point filters. Periodic statistics are versioned server-side JSON imports, not browser spreadsheet parsing or new statistical database tables. Supabase changes are existing platform-catalogue entries only. No new paid infrastructure.

Vicmap PFI/VICNAMES, official SA2 2021 codes and ABS LGA 2025 reference codes/polygons are explicit. Reviewed crosswalks retain source names and evidence. Runtime joins use codes. Unmatched neighbourhoods, uncertain Armidale Regional correspondence and special/non-spatial crime records remain unavailable. Current reference polygons do not reconstruct historical boundaries; ABS LGA approximations are not legal property boundaries. No LGA median is painted onto a suburb or property.

Public statistical geometry has a 24-hour cache; other live planning queries retain the existing shorter cache. Authenticated responses remain private/no-store. Existing viewport/zoom restrictions, 250-feature / 4 MB caps, 15-second timeout, abort/removal and disabled-network behaviour remain. Nationwide polygons and raw workbooks are not downloaded to the browser. Refresh requires reviewing original files, licence/period/geography, rerunning import, diffing hashes/values, checking and releasing.

VGV carried-forward zero-sales medians remain published evidence but are missing for observed-price/growth mapping. NSW s/- markers never become zero. Original annual and quarter periods remain distinct. New-bond rents are not asking rents or VIC moving annual medians; Strata/Non Strata are not universal unit/house categories. VIC/NSW crime definitions are not harmonised, and no incompatible new rates are invented.

## 4. Testing

- Lint, typecheck, **74 unit checks**, real disposable PostgreSQL/Supabase database/RLS/concurrency tests and optimized build passed.
- **18/18 browser suites passed**, CI [41159657368](https://github.com/maxstillwell/landbanker/actions/runs/41159657368), runtime 11f6537. Main run **41160734952** on the identical runtime also succeeded. All 17 prior workflows remain, covering Auth/storage/preferences, private CRUD/import/edit preservation, Saved Views/public sharing, current controls, source periods/values, responsive layout and original performance budgets.
- Four unsigned iPhone/iPad Debug/Release Simulator builds passed. Physical-device acceptance is not inferred.
- Actual provider checks: **48/48** common checks, **14/14** VIC locality/value/point checks, **21/21** NSW boundary/statistic joins. Locations include Vermont South, Glen/Mount Waverley, Box Hill, Point Cook, Melton, Lismore/Dunoon, Sydney, Blacktown, Gundagai and Dubbo. These are point-in-time checks, not an availability SLA.
- Original-file cross-checks include Vermont South 2025 house $1,525,000 / unit $1,010,000 and 2026 crime subgroup sum 693; Lismore March-2026 total sale median $680,000 / 233 sales, June-2026 rent $550 / 204 new bonds / zero quarterly change, and June-2026 dwelling break/enter count 185. Codes, units and reference periods match.
- Workflow geometry is an explicit deterministic fixture; imported statistics and disposable Auth/RLS are real. Actual government geometry has separate live tests. Desktop/mobile evidence was reviewed; no production mock data was added.
- Production home/login return 200, map redirects to login, and private catalogue/new feature APIs reject anonymous reads with Sign in required and no-store.
- **No real production account was available.** Authenticated production placement/toggles/private CRUD and physical-device performance are not claimed. Releases remain beta, not an unconditional professional-ready certification.
- The two inherited Supabase warnings remain: the intentional capability-protected [anonymous share gateway](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) and [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No Auth/RLS change was made to silence them.

Evidence: [A acceptance](PROFESSIONAL_LAYERS_PHASE2_ACCEPTANCE.json), [B acceptance](PROFESSIONAL_LAYERS_NSW_ACCEPTANCE.json), [VIC live checks](PROFESSIONAL_LAYERS_SUBURB_VERIFICATION.json), [NSW live checks](PROFESSIONAL_LAYERS_NSW_VERIFICATION.json).

## 5. Deployment

| Release | Runtime SHA | Vercel Production | Hosted migration |
| --- | --- | --- | --- |
| VIC finer geography / stability | 712baed15f19100fd43c4b60be9e8631d53bdde3 | dpl_4ixje8hqbVAo1VqFDfjV5xcomsBy, READY | 20261031021458_professional_suburb_layers |
| NSW aggregates | 11f6537dbf1cb59e762f2b6fa0a55020eb4cc889 | dpl_BSNNtqEfbJBbgawhvJhFnrU6goyM, READY; formal alias verified | 20261031023910_professional_nsw_statistics |

Direct main workflow, no PR. A technically necessary CI branch had Vercel deployments disabled; no Preview was created. Ref updates used expected-head leases/fast-forwards. Catalogue migrations were applied to verified Landbanker project gksyipjxhrolsgztfyer only, after complete acceptance and matching READY; entries were verified disabled before guarded availability activation.

Final database check: **36 entries / 34 available**, both VIC suburb and all three NSW entries enabled, catalogue RLS retained, FSR/height disabled. No user preferences/workspace data changed. Migration filenames match actual hosted history with unchanged SQL bytes. Rollback disables only affected catalogue IDs and restores a prior runtime if needed, retaining workspace data/preferences and existing schema/release gates.

The final documentation / migration-filename alignment commit follows the tested runtime without changing application or imported-data code. The local executor disconnected after production verification; documentation was recovered/synchronized through the GitHub connector. Remote main is authoritative; final local checkout refresh was unavailable.

## 6. Remaining backlog — not completed

| Work | Reason |
| --- | --- |
| **VIC median weekly rent — mandatory** | Current June-2026 and specifically licensed September-2025 originals still return HTTP503 / 85-byte non-Excel bodies from this environment. Exact downloaded version/licence must be checked. No third-party values substituted. [Access evidence](PROFESSIONAL_LAYERS_RENT_ACCESS.json). |
| VIC / NSW population projections | Exact workbook/licence, assumptions and geographic version need verification; keep projections separate from observed ERP. |
| NSW public schools | Original master file/licence, point attributes and import checks remain. VIC school points are already available. |
| Railway/tram/bus stops | Current VIC/NSW GTFS access/licence, identity/deduplication and controlled import remain. No routing engine or paid feed added. |
| More NSW market quarters, finer crime and compatible rates | Current original sale/rent quarters only. No historical medians inferred from changes. Older suburb/postcode crime needs geography review; rates need compatible denominators. |
| Saved View statistical period/indicator persistence and statistical public shares | Existing visibility/opacity/order restoration works; these additional manifests/shares are not implemented. |
| Hospitals, open space, income/employment, air quality, traffic, future infrastructure | Lower-priority candidates, not advertised as available. |
| Real production-account and physical-device acceptance | Requires an authorised real account/device; disposable-stack or build success is not a substitute. |

Next data priority is acquiring a valid, commercially reusable official VIC rent original and verifying its original geography/period before ingestion.
