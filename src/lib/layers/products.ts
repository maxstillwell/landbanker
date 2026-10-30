import type { DatasetMetadata, Indicator, LayerProduct } from "./types";

const vic =
  "https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/";
const overlays = `${vic}Vicplan_PlanningSchemeOverlays/MapServer`;
const overlaySource =
  "https://discover.data.vic.gov.au/dataset/vicmap-planning-planning-scheme-overlay-polygon";
const licence = "https://creativecommons.org/licenses/by/4.0/";
const absSource =
  "https://www.abs.gov.au/statistics/people/population/regional-population/2024-25";
const lgaService =
  "https://geo.abs.gov.au/arcgis/rest/services/ASGS2025/LGA/MapServer";
const lgaFields = ["LGA_CODE_2025", "LGA_NAME_2025"];
const metadata = (changes: Partial<DatasetMetadata>): DatasetMetadata => ({
  licence: "Creative Commons Attribution 4.0 International",
  licence_url: licence,
  licence_evidence: overlaySource,
  verified_on: "2026-10-31",
  version: "Live official service",
  coverage: "Victoria; mapped planning controls only",
  geography: "Planning control polygon",
  boundary_version: "Live Vicmap Planning",
  reference_period: "Current published service",
  updated: "Service publication may lag amendments",
  methodology:
    "Indicative mapping. Consult the current planning scheme; no feature is not no restriction.",
  fields: [],
  ...changes,
});
const overlayFields = [
  "PFI",
  "ZONE_CODE",
  "ZONE_DESCRIPTION",
  "LGA",
  "SCHEME_CODE",
  "GAZ_BEGIN_DATE",
];
const base = {
  state: "VIC" as const,
  provider: "Victorian Government · Department of Transport and Planning",
  renderer: "arcgis_export" as const,
  premium_tier: "free" as const,
  enabled: true,
  release_status: "beta" as const,
  min_zoom: 9,
  attribution:
    "© State of Victoria (Department of Transport and Planning). CC BY 4.0",
  update_frequency: "Weekly (catalogue; service currency may differ)",
  usage_notes:
    "Planning controls are not a planning certificate or a complete risk assessment.",
};
// Existing BMO and HO IDs are enriched in place; they are never duplicated.
const overlayProducts: LayerProduct[] = [
  ["vic-ddo", "Design and Development Overlay (DDO)", "7"],
  ["vic-dpo", "Development Plan Overlay (DPO)", "8"],
  ["vic-pao", "Public Acquisition Overlay (PAO)", "28"],
  ["vic-fo", "Floodway Overlay (FO)", "14"],
  ["vic-lsio", "Land Subject to Inundation Overlay (LSIO)", "15"],
  ["vic-sbo", "Special Building Overlay (SBO)", "16"],
  ["vic-bushfire", "Bushfire Management Overlay (BMO)", "19"],
  ["vic-eso", "Environmental Significance Overlay (ESO)", "3"],
  ["vic-vpo", "Vegetation Protection Overlay (VPO)", "5"],
  ["vic-heritage", "Heritage Overlay (HO)", "9"],
].map(([id, label, layer]) => ({
  ...base,
  id,
  name: `Victoria ${label}`,
  category: /FO|LSIO|SBO|BMO|ESO|VPO/.test(label)
    ? "Environment & Constraints"
    : "Planning & Development",
  source_url: overlaySource,
  service_url: overlays,
  layer_ids: layer,
  description: `${label} from Vicmap Planning. Individually selectable; schedules appear in the official code.`,
  dataset_metadata: metadata({ fields: overlayFields }),
  query: {
    url: `${overlays}/${layer}`,
    fields: overlayFields,
    code: "PFI",
    name: "ZONE_CODE",
    geometry: "polygon",
    color: "#b5895c",
  },
}));
const growth = `${vic}VicPlan_GrowthAreas/MapServer`;
const fire = `${vic}VicPlan_Bushfire/MapServer`;
const psp =
  "https://services5.arcgis.com/DmRfik4clMVydXO3/arcgis/rest/services/VPAGreenfieldPSPBoundary_ArcGIS_upload/FeatureServer";
const pspFields = [
  "OBJECTID",
  "VPA_No",
  "PSP_NAME",
  "PRJ_TYPE",
  "STATUS_DESC",
  "LEAD_AGE",
  "Area_Ha",
  "GAZ_DATE",
  "WEB_URL",
  "PRJ_CAT",
];
const statMetadata = (changes: Partial<DatasetMetadata>) =>
  metadata({
    geography: "LGA",
    boundary_version: "ABS ASGS Edition 3 · LGA 2025",
    fields: lgaFields,
    coverage:
      "79 Victorian municipalities; unincorporated and non-spatial records excluded",
    ...changes,
  });
const metric = (
  id: string,
  label: string,
  unit: Indicator["unit"],
  breaks: number[],
): Indicator => ({ id, label, unit, breaks });
const populationIndicators = [
  metric(
    "annual_growth",
    "Annual population growth",
    "percent",
    [0, 1, 2, 3, 5],
  ),
  metric(
    "population",
    "Estimated resident population",
    "count",
    [1000, 5000, 10000, 20000, 40000],
  ),
  metric(
    "annual_change",
    "Annual population change",
    "count",
    [0, 100, 500, 1000, 2500],
  ),
  metric(
    "five_year_growth",
    "Five-year population growth",
    "percent",
    [0, 5, 10, 20, 40],
  ),
  metric(
    "ten_year_growth",
    "Ten-year population growth",
    "percent",
    [0, 10, 20, 40, 80],
  ),
];
const salesIndicators = [
  metric(
    "house",
    "Median house price",
    "aud",
    [400000, 600000, 800000, 1000000, 1500000],
  ),
  metric(
    "unit",
    "Median unit/apartment price",
    "aud",
    [300000, 450000, 600000, 800000, 1000000],
  ),
  metric(
    "land",
    "Median vacant house block price",
    "aud",
    [150000, 250000, 400000, 600000, 1000000],
  ),
  metric(
    "house_growth",
    "Annual median house price change",
    "percent",
    [-5, 0, 5, 10, 20],
  ),
  metric(
    "house_sales",
    "House sales volume",
    "count",
    [100, 500, 1000, 2000, 4000],
  ),
  metric(
    "unit_sales",
    "Unit/apartment sales volume",
    "count",
    [20, 100, 500, 1000, 2000],
  ),
  metric(
    "land_sales",
    "Vacant house block sales volume",
    "count",
    [10, 50, 200, 500, 1000],
  ),
];
const populationService =
  "https://geo.abs.gov.au/arcgis/rest/services/Hosted/SA2_Regional_Population_2025/FeatureServer";
export const LAYER_PRODUCTS: LayerProduct[] = [
  ...overlayProducts,
  {
    ...base,
    id: "vic-ugb",
    name: "Victoria Urban Growth Boundary",
    category: "Planning & Development",
    service_url: growth,
    layer_ids: "1",
    min_zoom: 7,
    source_url:
      "https://discover.data.vic.gov.au/dataset/vicmap-planning-planning-scheme-urban-growth-line",
    description:
      "Statutory Urban Growth Boundary line around metropolitan Melbourne. This is the boundary, not the outside-UGB or investigation-area polygons.",
    dataset_metadata: metadata({
      geography: "Statutory boundary line",
      coverage: "Metropolitan Melbourne · 17 affected LGAs",
      fields: overlayFields,
      licence_evidence:
        "https://discover.data.vic.gov.au/dataset/vicmap-planning-planning-scheme-urban-growth-line",
    }),
    query: {
      url: `${growth}/1`,
      fields: overlayFields,
      code: "PFI",
      name: "LGA",
      geometry: "line",
      color: "#d4a95b",
    },
  },
  {
    ...base,
    id: "vic-bpa",
    name: "Victoria designated Bushfire Prone Areas (BPA)",
    category: "Environment & Constraints",
    service_url: fire,
    layer_ids: "1",
    update_frequency: null,
    source_url:
      "https://discover.data.vic.gov.au/dataset/designated-bushfire-prone-area-bpa",
    description:
      "Designated building-control Bushfire Prone Areas. Distinct from the planning-scheme Bushfire Management Overlay (BMO).",
    dataset_metadata: metadata({
      geography: "Designated BPA polygon",
      boundary_version: "BPA review 25B",
      reference_period: "Gazetted 16 June 2026; inspect feature gazettal date",
      licence_evidence:
        "https://discover.data.vic.gov.au/dataset/designated-bushfire-prone-area-bpa",
      fields: [
        "OBJECTID",
        "LGA_NAME",
        "PLAN_NUMBER",
        "GAZETTAL_DATE",
        "BPA_AREA_HA",
      ],
    }),
    query: {
      url: `${fire}/1`,
      fields: [
        "OBJECTID",
        "LGA_NAME",
        "PLAN_NUMBER",
        "GAZETTAL_DATE",
        "BPA_AREA_HA",
      ],
      code: "OBJECTID",
      name: "LGA_NAME",
      geometry: "polygon",
      color: "#b86d52",
    },
  },
  {
    ...base,
    id: "vic-vpa-precincts",
    name: "VPA precinct boundaries",
    category: "Planning & Development",
    service_url: psp,
    layer_ids: "0",
    renderer: "geojson",
    min_zoom: 8,
    provider: "Victorian Planning Authority",
    source_url:
      "https://discover.data.vic.gov.au/dataset/vpa-precinct-boundaries",
    update_frequency: "Irregular",
    attribution:
      "© Victorian Planning Authority. CC BY 4.0. Geometry simplified by LandOS for display.",
    description:
      "VPA greenfield, regional and urban renewal projects, including PSPs and other project types. Project status is supplied by VPA.",
    dataset_metadata: metadata({
      geography: "VPA project precinct",
      boundary_version: "VPA live precinct boundaries",
      coverage:
        "VPA projects across Victoria; not every precinct or development",
      reference_period: "Service edited 6 October 2026 (UTC)",
      updated: "2026-10-06",
      version: "VPA service dataLastEditDate 1791259287398",
      fields: pspFields,
      licence_evidence:
        "https://discover.data.vic.gov.au/dataset/vpa-precinct-boundaries",
      methodology:
        "Catalogue metadata last updated June 2024; live service reports October 2026 edits. A completed project is not evidence of permission for a particular property.",
    }),
    query: {
      url: `${psp}/0`,
      fields: pspFields,
      code: "OBJECTID",
      name: "PSP_NAME",
      geometry: "polygon",
      color: "#7a9d86",
    },
  },
  {
    ...base,
    id: "abs-population-growth",
    name: "ABS population growth · SA2",
    state: "AU",
    category: "Population & Demographics",
    provider: "Australian Bureau of Statistics",
    renderer: "geojson",
    service_url: populationService,
    layer_ids: "3",
    min_zoom: 7,
    source_url: absSource,
    attribution:
      "Derived from ABS Regional population 2024–25. © Commonwealth of Australia. CC BY 4.0. Geometry simplified by LandOS.",
    update_frequency: "Annually; versioned import after source review",
    description:
      "Estimated resident population and annual, five-year and ten-year growth. Latest release: 30 June 2025 estimates, released 31 March 2026.",
    dataset_metadata: metadata({
      licence_evidence:
        "https://www.abs.gov.au/website-privacy-copyright-and-disclaimer",
      version: "Regional population 2024–25 · 31 March 2026",
      coverage:
        "Australia-wide SA2; non-spatial special-purpose areas cannot be mapped",
      geography: "SA2",
      boundary_version: "ABS ASGS Edition 3 · SA2 2021",
      reference_period: "30 June 2001–2025",
      updated: "2026-03-31",
      fields: ["sa2_code_2021", "sa2_name_2021", "erp_2001…erp_2025"],
      indicators: populationIndicators,
      periods: Array.from({ length: 15 }, (_, i) => String(2025 - i)),
      default_indicator: "annual_growth",
      default_period: "2025",
      methodology:
        "ERP is an estimate of usual residents at 30 June. Percentage change = (current / comparison − 1) × 100 on consistent 2021 SA2 geography. Zero or unavailable denominator gives no data. Not Census counts or projections.",
    }),
    query: {
      url: `${populationService}/3`,
      fields: ["sa2_code_2021", "sa2_name_2021"],
      code: "sa2_code_2021",
      name: "sa2_name_2021",
      geometry: "polygon",
      color: "#548f87",
      statistics: "population",
    },
  },
  {
    ...base,
    id: "vic-median-prices",
    name: "Victoria median property prices · LGA",
    category: "Property Market",
    provider: "Valuer-General Victoria",
    renderer: "geojson",
    service_url: lgaService,
    layer_ids: "1",
    min_zoom: 7,
    source_url:
      "https://www.land.vic.gov.au/valuations/resources-and-reports/property-sales-statistics",
    update_frequency: "Annually; controlled import",
    attribution:
      "Derived from Valuer-General Victoria Year Summary 2025 and ABS LGA 2025 boundaries. CC BY 4.0. Geometry simplified by LandOS.",
    description:
      "Annual house, unit/apartment and vacant house block medians and sales volumes for 79 municipalities. LGA statistics, not suburb medians or a property valuation.",
    dataset_metadata: statMetadata({
      licence_evidence:
        "https://discover.data.vic.gov.au/dataset/victorian-property-sales-report-time-series",
      version: "VGV Year Summary 2025",
      reference_period: "Calendar years 2015–2025",
      updated: "2026-09-29",
      indicators: salesIndicators,
      periods: Array.from({ length: 11 }, (_, i) => String(2025 - i)),
      default_indicator: "house",
      default_period: "2025",
      fields: [
        ...lgaFields,
        "house",
        "unit",
        "land",
        "house_sales",
        "unit_sales",
        "land_sales",
      ],
      methodology:
        "Original municipal annual medians, joined via a reviewed VIC municipality → ABS LGA 2025 code crosswalk. No suburb or property interpolation. Partial 2026 rows excluded. Zero sales or missing/zero median gives no data. Annual change compares medians, not a quality-adjusted index.",
    }),
    query: {
      url: `${lgaService}/1`,
      fields: lgaFields,
      code: "LGA_CODE_2025",
      name: "LGA_NAME_2025",
      where: "STATE_CODE_2021='2'",
      geometry: "polygon",
      color: "#548f87",
      statistics: "sales",
    },
  },
  {
    ...base,
    id: "vic-recorded-offences",
    name: "Victoria recorded offences · LGA",
    category: "Crime & Community Safety",
    provider: "Crime Statistics Agency Victoria",
    renderer: "geojson",
    service_url: lgaService,
    layer_ids: "1",
    min_zoom: 7,
    source_url:
      "https://discover.data.vic.gov.au/dataset/data-tables-recorded-offences",
    update_frequency: "Quarterly; rolling annual observations",
    attribution:
      "Derived from Crime Statistics Agency Victoria, year ending June 2026, and ABS LGA 2025 boundaries. CC BY 4.0. Geometry simplified by LandOS.",
    description:
      "Recorded offences, published rates and selected offence categories. Counts describe police-recorded offences, not criminal incidents, individual risk or all crime.",
    dataset_metadata: statMetadata({
      licence_evidence:
        "https://discover.data.vic.gov.au/dataset/data-tables-recorded-offences",
      version: "CSA LGA recorded offences · June 2026",
      reference_period: "Years ending 30 June 2017–2026",
      updated: "2026-09-24",
      periods: Array.from({ length: 10 }, (_, i) => String(2026 - i)),
      default_period: "2026",
      default_indicator: "rate",
      indicators: [
        metric(
          "rate",
          "Recorded offence rate per 100,000 residents",
          "rate",
          [3000, 6000, 9000, 12000, 15000],
        ),
        metric(
          "offences",
          "Recorded offences",
          "count",
          [1000, 5000, 10000, 20000, 40000],
        ),
        ...[
          ["burglary", "Burglary / break and enter"],
          ["theft", "Theft"],
          ["motor_theft", "Motor vehicle theft"],
          ["assault", "Assault and related offences"],
        ].map(([id, label]) =>
          metric(id, label, "count", [100, 500, 1000, 2500, 5000]),
        ),
      ],
      fields: [
        ...lgaFields,
        "offences",
        "rate",
        "burglary",
        "theft",
        "motor_theft",
        "assault",
      ],
      methodology:
        "CSA Table 01 counts and published rates; Table 02 subgroup counts summed once by LGA/year/category. Published rates exclude justice institutions, immigration facilities, unincorporated and unknown locations; counts and rates can have different coverage. No new population denominator is invented. Derived subgroup sums can differ from the published overall totals; LandOS does not reconcile or adjust the source counts. Recorded offences differ from criminal incidents. Historical municipalities use the reviewed LGA 2025 identity crosswalk; no property-level inference.",
    }),
    query: {
      url: `${lgaService}/1`,
      fields: lgaFields,
      code: "LGA_CODE_2025",
      name: "LGA_NAME_2025",
      where: "STATE_CODE_2021='2'",
      geometry: "polygon",
      color: "#548f87",
      statistics: "crime",
    },
  },
];
const sa2Boundary = {
  url: `${populationService}/3`,
  fields: ["sa2_code_2021", "sa2_name_2021"],
  code: "sa2_code_2021",
  name: "sa2_name_2021",
  geometry: "polygon" as const,
  color: "#548f87",
};
LAYER_PRODUCTS.push(
  {
    ...base,
    id: "abs-seifa",
    name: "ABS SEIFA · SA2",
    state: "AU",
    category: "Population & Demographics",
    provider: "Australian Bureau of Statistics",
    renderer: "geojson",
    service_url: populationService,
    layer_ids: "3",
    min_zoom: 7,
    source_url:
      "https://www.abs.gov.au/statistics/people/people-and-communities/socio-economic-indexes-areas-seifa-australia/2021",
    update_frequency: "Census cycle; versioned import",
    description:
      "Four official area-level socioeconomic indexes and national deciles from Census 2021. These describe areas, not individual wealth or household income.",
    attribution:
      "Derived from ABS SEIFA 2021 and ASGS Edition 3 SA2 boundaries. © Commonwealth of Australia. CC BY 4.0. Geometry simplified by LandOS.",
    dataset_metadata: metadata({
      licence_evidence:
        "https://www.abs.gov.au/website-privacy-copyright-and-disclaimer",
      version: "SEIFA 2021 summary Table 1",
      coverage: "Australia-wide SA2; unavailable scores remain missing",
      geography: "SA2",
      boundary_version: "ABS ASGS Edition 3 · SA2 2021",
      reference_period: "Census 2021",
      updated: "2023-04-27",
      periods: ["2021"],
      default_period: "2021",
      default_indicator: "irsad",
      fields: [
        "sa2_code_2021",
        "sa2_name_2021",
        "irsad",
        "irsad_decile",
        "irsd",
        "irsd_decile",
        "ier",
        "ier_decile",
        "ieo",
        "ieo_decile",
      ],
      indicators: [
        ["irsad", "IRSAD · advantage and disadvantage"],
        ["irsd", "IRSD · disadvantage"],
        ["ier", "IER · economic resources"],
        ["ieo", "IEO · education and occupation"],
      ].flatMap(([id, label]) => [
        metric(id, `${label} score`, "count", [800, 900, 1000, 1050, 1100]),
        metric(
          `${id}_decile`,
          `${label} national decile`,
          "count",
          [2, 4, 6, 8, 10],
        ),
      ]),
      methodology:
        "Original ABS Table 1 integer summary scores and national deciles, joined by 2021 SA2 code. Decile 1 is most disadvantaged and 10 least disadvantaged / most advantaged for the relevant index. Indexes are relative area summaries, not individual wealth, income or a property appraisal.",
    }),
    query: { ...sa2Boundary, statistics: "seifa" },
  },
  {
    ...base,
    id: "abs-building-approvals",
    name: "ABS new dwelling approvals · SA2",
    state: "AU",
    category: "Property Market",
    provider: "Australian Bureau of Statistics",
    renderer: "geojson",
    service_url: populationService,
    layer_ids: "3",
    min_zoom: 7,
    source_url:
      "https://www.abs.gov.au/statistics/industry/building-and-construction/building-approvals-australia/aug-2026",
    update_frequency: "Monthly publication; complete FY import in this release",
    description:
      "New residential dwelling approvals in complete FY 2025–26, including houses and other residential dwellings. Approvals are permits, not construction starts or completions.",
    attribution:
      "Derived from ABS Building Approvals August 2026, Regional population 2024–25 and ASGS Edition 3 SA2 boundaries. CC BY 4.0. Geometry simplified by LandOS.",
    dataset_metadata: metadata({
      licence_evidence:
        "https://www.abs.gov.au/website-privacy-copyright-and-disclaimer",
      version: "August 2026 small-area CSV release, published 7 October 2026",
      coverage:
        "Australia-wide SA2; unmatched or suppressed monthly values remain missing",
      geography: "SA2",
      boundary_version: "ABS ASGS Edition 3 · SA2 2021",
      reference_period: "Complete FY 2025–26",
      updated: "2026-10-07",
      periods: ["2025-26"],
      default_period: "2025-26",
      default_indicator: "new_dwellings",
      fields: [
        "sa2_code_2021",
        "sa2_name_2021",
        "new_dwellings",
        "houses",
        "other_residential",
      ],
      indicators: [
        metric(
          "new_dwellings",
          "New dwellings approved",
          "count",
          [10, 50, 100, 250, 500],
        ),
        metric(
          "houses",
          "New houses approved",
          "count",
          [10, 50, 100, 250, 500],
        ),
        metric(
          "other_residential",
          "Other new residential dwellings approved",
          "count",
          [10, 50, 100, 250, 500],
        ),
        metric(
          "per_1000",
          "New dwellings per 1,000 residents (June 2025 ERP)",
          "rate",
          [1, 5, 10, 25, 50],
        ),
      ],
      methodology:
        "Original, unadjusted monthly dwl values summed over July 2025–June 2026 only when all 12 are numeric. type_work=1 (new), own_sector=9 (total sectors); type_bld=100, 110 and 150 used separately, without double-counting component rows. Per-1,000 metric uses 30 June 2025 ERP on the same 2021 SA2 codes. Not completions; no annual trend or FYTD comparison is inferred from this single complete year.",
    }),
    query: { ...sa2Boundary, statistics: "approvals" },
  },
);
const nswFlood =
  "https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/Hazard/MapServer";
const nswFire =
  "https://portal.data.nsw.gov.au/arcgis/rest/services/Bush_Fire_Prone_Land_MIL1/MapServer";
const floodFields = [
  "OBJECTID",
  "EPI_NAME",
  "LGA_NAME",
  "PUBLISHED_DATE",
  "COMMENCED_DATE",
  "CURRENCY_DATE",
  "AMENDMENT",
  "LAY_CLASS",
  "EPI_TYPE",
  "COMMENT",
];
const fireFields = [
  "OBJECTID",
  "StartDate",
  "LastUpdate",
  "Category",
  "Guideline",
  "d_Category",
  "d_Guidelin",
];
LAYER_PRODUCTS.push(
  {
    ...base,
    id: "nsw-flood-planning",
    name: "NSW EPI flood planning · limited coverage",
    state: "NSW",
    category: "Environment & Constraints",
    provider: "NSW Department of Planning, Housing and Infrastructure",
    service_url: nswFlood,
    layer_ids: "1",
    min_zoom: 13,
    source_url:
      "https://www.planningportal.nsw.gov.au/opendata/dataset/epi-flood",
    update_frequency: "As needed; councils maintain current flood mapping",
    description:
      "Mapped EPI flood planning controls. Since July 2021 councils maintain flood mapping; this service may be incomplete or outdated. Not comprehensive flood risk mapping.",
    attribution:
      "© State Government of NSW and NSW Department of Planning, Housing and Infrastructure 2018",
    usage_notes:
      "Contact the relevant council for current flood studies and planning controls. No mapped result does not mean flood-free land.",
    dataset_metadata: metadata({
      licence: "Creative Commons Attribution (NSW Planning Portal)",
      licence_url: "https://www.opendefinition.org/licenses/cc-by",
      licence_evidence:
        "https://www.planningportal.nsw.gov.au/opendata/dataset/epi-flood",
      coverage: "Mapped NSW EPIs only; incomplete and potentially outdated",
      geography: "EPI flood planning polygon",
      boundary_version: "NSW EPI Hazard service",
      reference_period:
        "Per-feature currency date; catalogue edition 22 May 2019",
      updated: "See CURRENCY_DATE / relevant council",
      fields: floodFields,
      methodology:
        "Official catalogue warns that councils are responsible for accurate flood mapping from 14 July 2021. This layer is a limited planning reference, not a complete flood extent or a risk model.",
    }),
    query: {
      url: `${nswFlood}/1`,
      fields: floodFields,
      code: "OBJECTID",
      name: "LAY_CLASS",
      geometry: "polygon",
      color: "#5894b8",
    },
  },
  {
    ...base,
    id: "nsw-bushfire-prone",
    name: "NSW Bush Fire Prone Land",
    state: "NSW",
    category: "Environment & Constraints",
    provider: "NSW Rural Fire Service / NSW Government",
    service_url: nswFire,
    layer_ids: "0",
    min_zoom: 10,
    source_url: "https://data.nsw.gov.au/data/en/dataset/bush-fire-prone-land",
    update_frequency: "As needed; council / NSW RFS certification",
    description:
      "Council-prepared, NSW RFS-certified bush fire prone land, vegetation categories and buffers. Non-designation does not guarantee absence of bushfire loss.",
    attribution:
      "NSW Rural Fire Service and NSW councils. Creative Commons Attribution, Data.NSW Bush Fire Prone Land.",
    dataset_metadata: metadata({
      licence: "Creative Commons Attribution (Data.NSW)",
      licence_url: "https://www.opendefinition.org/licenses/cc-by",
      licence_evidence:
        "https://data.nsw.gov.au/data/en/dataset/bush-fire-prone-land",
      coverage:
        "NSW certified mapping; per-feature guide/version and update dates vary",
      geography: "Bush fire prone land polygon",
      boundary_version: "NSW BFPL service",
      reference_period: "Per-feature StartDate / LastUpdate",
      updated: "See LastUpdate; dataset catalogue 29 October 2025",
      fields: fireFields,
      methodology:
        "Vegetation categories and buffers follow the guideline version recorded on each feature. Confirm current council/RFS mapping and Section 10.7 planning information. No result is not evidence of no bushfire risk.",
    }),
    query: {
      url: `${nswFire}/0`,
      fields: fireFields,
      code: "OBJECTID",
      name: "d_Category",
      geometry: "polygon",
      color: "#b86d52",
    },
  },
);
const schoolFields = [
  "School_No",
  "School_Name",
  "School_Type",
  "School_Status",
  "Education_Sector",
  "Address_Line_1",
  "Address_Line_2",
  "Address_Town",
  "Address_Postcode",
  "LGA_Name",
];
LAYER_PRODUCTS.push({
  ...base,
  id: "vic-schools",
  name: "Victoria school locations · 2026",
  category: "Infrastructure & Amenities",
  provider: "Victorian Department of Education",
  renderer: "geojson",
  service_url: "https://content.vic.gov.au/DE-School-Locations%20-2026",
  layer_ids: "0",
  min_zoom: 10,
  source_url: "https://discover.data.vic.gov.au/dataset/school-locations-2026",
  update_frequency: "Annually",
  description:
    "Registered government and non-government school locations, type, sector and address. Locations do not determine school zones or catchment eligibility.",
  attribution:
    "© State of Victoria (Department of Education), School Locations 2026. CC BY 4.0.",
  dataset_metadata: metadata({
    licence_evidence:
      "https://discover.data.vic.gov.au/dataset/school-locations-2026",
    version: "School Locations 2026 · 19 October 2026",
    coverage: "Victoria registered school locations, all sectors",
    geography: "School location point",
    boundary_version: "Original source X/Y coordinates",
    reference_period: "2026 registration dataset",
    updated: "2026-10-19",
    fields: schoolFields,
    methodology:
      "Original Department of Education school locations. A school location, proximity or sector is not a statement about enrolment availability, admission eligibility, catchment or school quality. Confirm with the school / relevant official school-zone service.",
  }),
  query: {
    url: "https://content.vic.gov.au/DE-School-Locations%20-2026",
    fields: schoolFields,
    code: "location_id",
    name: "School_Name",
    geometry: "point",
    color: "#dbb77a",
    local_data: "vic-schools",
  },
});
export function layerProduct(id: string) {
  return LAYER_PRODUCTS.find((p) => p.id === id);
}
export function publicProduct(product: LayerProduct) {
  const { query: _query, ...catalog } = product;
  void _query;
  return catalog;
}
