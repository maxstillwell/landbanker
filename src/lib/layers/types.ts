export type Indicator = {
  id: string;
  label: string;
  unit: "count" | "percent" | "aud" | "rate";
  breaks: number[];
};
export type DatasetMetadata = {
  licence: string;
  licence_url: string;
  licence_evidence: string;
  verified_on: string;
  version: string;
  coverage: string;
  geography: string;
  boundary_version: string;
  reference_period: string;
  updated: string;
  methodology: string;
  fields: string[];
  indicators?: Indicator[];
  periods?: string[];
  period_labels?: Record<string, string>;
  default_indicator?: string;
  default_period?: string;
};
export type LayerProduct = {
  id: string;
  name: string;
  state: "VIC" | "NSW" | "AU";
  category: string;
  provider: string;
  source_url: string;
  service_url: string;
  layer_ids: string;
  renderer: "arcgis_export" | "geojson";
  description: string;
  attribution: string;
  usage_notes: string;
  update_frequency: string | null;
  premium_tier: "free";
  min_zoom: number;
  enabled: boolean;
  release_status: "beta" | "disabled";
  dataset_metadata: DatasetMetadata;
  query: {
    protocol?: "wfs";
    url: string;
    fields: string[];
    code: string;
    name: string;
    where?: string;
    geometry: "polygon" | "line" | "point";
    local_data?: "vic-schools";
    color: string;
    statistics?:
      | "population"
      | "sales"
      | "crime"
      | "seifa"
      | "approvals"
      | "suburb-sales"
      | "suburb-crime"
      | "nsw-sales"
      | "nsw-rent"
      | "nsw-crime";
  };
};
export const CATALOGUE_CATEGORIES = [
  "Cadastre & Land",
  "Planning & Development",
  "Environment & Constraints",
  "Property Market",
  "Population & Demographics",
  "Crime & Community Safety",
  "Infrastructure & Amenities",
  "Agriculture & Rural Land",
] as const;
export function catalogueCategory(category: string, name: string) {
  if ((CATALOGUE_CATEGORIES as readonly string[]).includes(category))
    return category;
  const text = `${category} ${name}`.toLowerCase();
  return /parcel|cadast|property boundar/.test(text)
    ? CATALOGUE_CATEGORIES[0]
    : /flood|bushfire|environment|biodiversity|vegetation/.test(text)
      ? CATALOGUE_CATEGORIES[2]
      : /infrastructure|transport|school|hospital/.test(text)
        ? CATALOGUE_CATEGORIES[6]
        : CATALOGUE_CATEGORIES[1];
}
