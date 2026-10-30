# Professional layers expansion — release record

31 October 2026 AEDT. Base: main `a3798192598779fdebbead4a70f1c0121c02c0fe`. This delivers a coherent first expansion, **not the complete requested roadmap**. VIC median rent remains blocked by source downloads; the remaining backlog below is not implemented.

## Existing architecture and audit

The current source, not earlier plans, was inspected. MapWorkspace owns the authenticated MapLibre scene. `layer_catalog` is the server-owned registry, `active_map_layers` stores per-user/workspace visibility, opacity and order, and LayerLibrary supplies Catalogue / Added to Map. The existing raster adapter uses bounded Web Mercator ArcGIS exports; the four direct query adapters provide VIC/NSW parcel and zoning selection. Property Planning is a separate authenticated saved-Property intersection workflow.

The hosted catalogue initially contained ten enabled real-service layers and two explicitly disabled releases. No demographic/market import or choropleth infrastructure existed. All use live ArcGIS services, not production mocks. Existing exact endpoints and source attributes are retained in `docs/OFFICIAL_DATA_INVENTORY.md`, `src/lib/map/official-map-catalog.ts`, `src/lib/planning/sources.ts` and the historical catalogue migrations.

| Existing product | Endpoint suffix / source | Coverage and status before expansion |
|---|---|---|
| VIC cadastre | VicPlan_PropertyAndParcel/MapServer/4 | VIC; real parcels, lot/plan/PFI/SPI; direct feature selection and raster catalogue entry |
| NSW cadastre | NSW_Land_Parcel_Property_Theme/MapServer/8 | NSW; real lots, cadid/lot/plan; direct feature selection and raster catalogue entry |
| VIC zoning | spatial.planning.vic.gov.au/gis/rest/services/planning_scheme_zones/MapServer/0 | VIC; actual zone codes, scheme and LGA; direct query, hover, selection and raster entry |
| NSW zoning | EPI_Primary_Planning_Layers/MapServer/2 | Mapped NSW EPIs; actual class/instrument/purpose; direct selection and raster entry |
| VIC all overlays | Vicplan_PlanningSchemeOverlays/MapServer/0 | Already implemented; preserved |
| VIC flood planning | Same service /14,15,16,32 | FO/LSIO/SBO/RFO planning controls, not complete flood risk mapping; preserved |
| VIC BMO | Same service /19 | Existing ID reused, not duplicated; licence/source metadata enriched |
| VIC heritage | Same service /9 | Existing ID reused, not duplicated; licence/source metadata enriched |
| NSW heritage | EPI_Primary_Planning_Layers/MapServer/0 | Existing mapped EPI heritage; preserved |
| NSW minimum lot size | EPI_Primary_Planning_Layers/MapServer/4 | Already implemented; preserved. Not measured parcel size or subdivision entitlement |
| NSW FSR / height | EPI_Primary_Planning_Layers/MapServer/1 and /5 | Existing reviewed disable decision retained; special-value/unit interpretation gates remain |

Historical licence uncertainty for unchanged entries is not retrospectively labelled resolved. Existing unit/Planning/browser regression suites are retained. Current authenticated production rendering is unverified without an account; endpoint success alone is not proof of map placement, legal interpretation or production UX.

Workspace KML/KMZ/GeoJSON layers, Properties, Research Areas, Observations, drafts, normalized features, RLS and memberships remain separate from public government products. No user records are imported into the official catalogue, no private workspace geometry enters provider caches, and no existing tenant data is modified.

## Implemented products and changes

See [the complete product register](PROFESSIONAL_LAYERS_REGISTRY.md) for every product's official URL, exact API, organisation, coverage, actual fields, period, frequency, licence and implementation status. There are **19 new catalogue products**, with two existing IDs (BMO and heritage) enriched in place. The resulting registry has 31 rows, including the two existing disabled FSR/height products.

The first three mandatory statistical products are implemented: nationwide SA2 population, VIC municipal annual property medians and VIC LGA recorded offences. Additional implemented products are nationwide SA2 SEIFA, complete-FY new dwelling approvals and VIC 2026 school locations. Eight individually selectable VIC overlays plus UGB, BPA, VPA precincts and two NSW planning references extend the existing controls.

The existing catalogue gains the requested eight categories, coverage filtering, statistical indicator/year selectors, sequential legends, missing-data display, hover, click-to-inspect and source/methodology details. No parallel layer manager is introduced. A pre-existing inspector condition hid official details after switching to Layers; official selection details now render independently of the Properties tab. The existing legend host allowlist now includes the actual VIC zoning hostname. Authenticated GeoJSON layers are explicitly omitted with a notice in public shared maps rather than sent to a raster export URL.

## Integration and geography

- Live planning products reuse ArcGIS raster exports and fixed-source feature identification. VPA uses a bounded GeoJSON viewport query. Sources are allowlisted in code; arbitrary upstream URLs/SQL cannot be supplied by clients.
- Statistical values and school points are controlled, versioned imports committed with source URLs and SHA-256 hashes. Original XLSX/ZIP/CSV downloads are not committed. `scripts/import-official-statistics.py` reproduces the imports using the six reviewed source files listed in `src/lib/layers/data/import-manifest.json`.
- Population: 2,454 official SA2 codes, ERP 2001–2025; selector 2011–2025 permits valid ten-year comparisons. Zero/missing denominators yield missing values, not zero growth.
- VGV: original 79 municipal series for 2015–2025. House/unit/vacant-house-block medians and volumes remain separate. Partial 2026 rows are deliberately excluded. The reviewed explicit identity crosswalk handles source spelling `Cardina` and CSA `Colac-Otway`; runtime joins use codes, never fuzzy names. This is not a suburb-price product.
- Crime: ten rolling years ending June, 79 LGAs. Published overall counts/rates are retained. Selected categories are sums of unique published Table 02 subgroups. A separate source audit found no duplicate subgroup keys but 250 LGA/year subgroup sums differ from overall Table 01 totals. Values are not reconciled or adjusted; methodology warns of this and of differing count/rate coverage. No unexplained denominator is invented.
- SEIFA: 2,366 published 2021 SA2 summary records; missing areas remain missing. Integer summary scores and national deciles for IRSAD, IRSD, IER and IEO are preserved. This is area socioeconomic context, not individual wealth/income.
- Approvals: 2,450 matched SA2 records from complete FY 2025–26. Twelve numeric months are required for a sum; source totals are never added to their own components. New-work total-sector rows are used. Per-1,000 uses June 2025 ERP on the same 2021 SA2 codes, with that denominator labelled.
- Schools: original 2026 Department of Education point coordinates and public school attributes. School/sector/entity/location identity is preserved. No admission, catchment, availability or quality inference.
- Statistical geometry uses official ASGS Edition 3 SA2 2021 and LGA 2025 boundaries, with display-only simplification. ABS LGA boundaries are statistical approximations, not legal boundaries. There is no property-level interpolation or use of simplified geometry for legal area/coverage analysis.
- New layers are off by default. Removed/hidden vector layers abort requests and remove their sources; disabled layers do not continuously poll. Queries debounce map movement, respect minimum zoom, cap geographic extent, return at most 250 features, cap upstream responses at 4 MB and time out. Partial and empty results have distinct messages. Errors are visible.
- Only public geometry is cached: 24-hour revalidation for statistical boundary queries, one hour for live planning feature queries. Private authenticated API responses remain private/no-store. Versioned imports refresh through reviewed source downloads, rerun, diff, tests and release; no paid infrastructure or unattended ingestion is added.
- Statistical period/indicator choices are session-local in this release; Saved Views do not yet freeze them. Public statistical/precinct maps are not implemented.

## Validation evidence

- Lint, Next type generation/typecheck, **63 tests** (53 existing plus 10 new), and optimized production build passed on the release source.
- Final live run: **44/44 checks passed**, `2026-10-30T21:45:28.081Z` UTC, including Vermont South, western growth areas and Dunoon/Lismore. Queries use real government responses. Earlier 34/34 and 42/42 runs passed; an intervening 44-check run had widespread HTTP403 responses, followed by successful focused probes and the final full rerun. This is not an availability SLA.
- Independent ABS online cross-check: Rockbank–Mount Cottrell SA2 `213041359`, 2025 ERP 35,856; 2024 ERP 31,254; annual increase 4,602. Workbook checks include Vermont South ERP 12,250, Whitehorse 2025 house median $1,425,000 / unit $765,000 / 1,787 house sales, and Whitehorse 2026 recorded offences 11,698. SEIFA and approval values are checked against their original workbook/CSV rows.
- Existing source verification: VIC parcels, VIC zones and NSW parcels passed; NSW zoning's query returned HTTP403 in that run. Its code and endpoint were unchanged. No all-clear is inferred for every legacy service.
- Migration tested in rollback transactions on the verified independent Landbanker project, including staged enablement, unchanged FSR/height gates, retained RLS and denied client catalogue writes. Applied migration version: `20261030214609_professional_layers`. Post-apply: 31 catalogue rows, seven GeoJSON products, ten existing enabled products; new products remain staged pending matching production deployment.
- `npm run db:test` was actually attempted and failed because Docker is absent. `npm run test:e2e` was actually attempted and stopped because the isolated `.env.local`/Supabase stack is absent. The subsequent GitHub CI run 41134243734 passed the database/RLS/concurrency suite and production build. Its legacy Field browser test failed at tests/field.e2e.mjs:87 waiting for Add observation; baseline a379819 CI run 41018168917 failed at the identical locator and line. Full legacy E2E is not claimed passed. A targeted official-layer browser workflow has been added ahead of that existing suite, retaining all original tests and thresholds. Existing two advisor warnings (share capability SECURITY DEFINER and disabled leaked-password protection) remain; no Auth changes were made.
- Production browser access to `/app/map` reached the normal login page. No real account was available. Authenticated map placement/toggles/selection, responsive layouts, real-device performance and private CRUD regressions remain unverified for this release. Compiler/unit/source checks are not substitutes for those checks.

## Deployment and operational state

Direct main publication is authorised. The GitHub/Vercel target is `maxstillwell/landbanker` / `landbanker`, team `team_uz00skMNo5QcnakBUYe8ZuVl`, production `https://landbanker.vercel.app`. The previous production SHA is the audit base above. The new source must reach READY before `scripts/activate-professional-layers.sql` is applied. Implementation commit ed2d5b2b9a4001c702e24018e6334aa190d768d2 reached Production READY (deployment dpl_D6b1gB88ELvR4nTosvYxxPeNknJR). Seven marketing routes and login returned 200, /app/map redirected to login, and both catalogue and feature API returned 400 Sign in required / no-store to anonymous requests. New entries remain staged while targeted browser acceptance is checked. Final activation and any later documentation/test commit are recorded in STATUS.md and the delivery message.

Rollback: disable only the new catalogue IDs, restore the previous application deployment if needed, preserve metadata/schema additions and all workspace data. Do not drop columns, remove user preferences or rewrite existing release gates to roll back.

## Remaining backlog — not implemented

| Product/work | Current evidence and reason remaining |
|---|---|
| **VIC median weekly rent (mandatory)** | Official report latest June 2026; specifically licensed DataVic LGA resource is September 2025. The report endpoint, licensed download and underlying XLSX returned HTTP503/reset. The DFFH general website copyright restricts commercial reuse; use dataset-specific CC BY evidence and confirm the exact downloaded version. No data or substitute estimates ingested. Resume this first. |
| VIC suburb medians | Official 2015–2025 house/unit/land workbooks exist. Municipal medians ship now; suburb products still need verified original suburb boundaries/code mapping, workbook import and representative value checks. |
| NSW aggregate sales and rent | Official latest aggregate tables: March 2026 sales / June 2026 rent. Workbook-specific exceptions, suppression, strata definitions and original geography/version need review and ingestion. No raw individual sales or proprietary records ingested. Not implemented, not a claim that reuse is prohibited. |
| NSW crime | BOCSAR publishes LGA monthly data through June 2026 and suburb/postcode through 2025. Original downloads, external-host licensing, confidentiality and geography/denominator compatibility still require a controlled import and checks. |
| VIC / NSW projections | VIF2023 and NSW 2024 projections identified. Need exact workbook/licence, assumptions and compatible region versions; implement as separate projected indicators. Observed ERP is already available and is never labelled a projection. |
| NSW schools | Official public-school master dataset identified; ingestion, source-specific licence and point checks remain. VIC all-sector locations implemented first. |
| Railway/tram/bus stops | Official VIC and NSW GTFS sources identified. Need current feed/licence/API-access review, stop deduplication and versioned import. Routing engine not planned. |
| Hospitals, open space, income, employment, air quality, traffic, future infrastructure | Lower priority candidates; not implemented or advertised as available. |
| Statistical public shares, persisted indicator/year, nationwide low-zoom tiles | Explicit follow-up work. Current bounded viewport approach avoids large nationwide client downloads. |
| Authenticated acceptance | Run the existing isolated database/E2E suites in Docker-capable CI and then verify a real authorised production session at desktop/tablet/phone sizes before any professional-ready claim. |
