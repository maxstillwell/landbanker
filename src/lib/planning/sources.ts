export type PlanningAdapter = {
  service: string;
  ids: number[];
  controlType: string;
  fields: string[];
};
const vicOverlays =
  "https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/Vicplan_PlanningSchemeOverlays/MapServer";
const nswPlanning =
  "https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer";
const vicFields = [
  "OBJECTID",
  "PFI",
  "ZONE_CODE",
  "ZONE_DESCRIPTION",
  "GAZ_BEGIN_DATE",
  "LGA",
  "SCHEME_CODE",
];
const nswFields = [
  "OBJECTID",
  "LAY_NAME",
  "LAY_CLASS",
  "SYM_CODE",
  "EPI_NAME",
  "CURRENCY_DATE",
  "PUBLISHED_DATE",
  "COMMENCED_DATE",
];
// Explicit verified endpoints and fields. A client or catalog URL cannot turn this into an arbitrary proxy.
export const planningSources: Record<string, PlanningAdapter> = {
  "vic-zoning": {
    service:
      "https://spatial.planning.vic.gov.au/gis/rest/services/planning_scheme_zones/MapServer",
    ids: [0],
    controlType: "Zone",
    fields: vicFields,
  },
  "vic-planning-overlays": {
    service: vicOverlays,
    ids: [0],
    controlType: "Overlay",
    fields: vicFields,
  },
  "vic-flood": {
    service: vicOverlays,
    ids: [14, 15, 16, 32],
    controlType: "Flood overlay",
    fields: vicFields,
  },
  "vic-bushfire": {
    service: vicOverlays,
    ids: [19],
    controlType: "Bushfire overlay",
    fields: vicFields,
  },
  "vic-heritage": {
    service: vicOverlays,
    ids: [9],
    controlType: "Heritage overlay",
    fields: vicFields,
  },
  "nsw-zoning": {
    service: nswPlanning,
    ids: [2],
    controlType: "Zone",
    fields: nswFields.concat("PURPOSE"),
  },
  "nsw-heritage": {
    service: nswPlanning,
    ids: [0],
    controlType: "Heritage",
    fields: nswFields
      .filter((field) => field !== "SYM_CODE")
      .concat("H_NAME", "H_ID", "SIG"),
  },
  "nsw-minimum-lot-size": {
    service: nswPlanning,
    ids: [4],
    controlType: "Minimum Lot Size",
    fields: nswFields.concat("LOT_SIZE", "UNITS"),
  },
};
