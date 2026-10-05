export type CatalogLayer = {
  id: string;
  name: string;
  state: "VIC" | "NSW" | "AU";
  category: string;
  provider: string;
  service_url: string;
  renderer: "arcgis_export" | "tile";
  layer_ids: string | null;
  description: string;
  attribution: string;
  usage_notes: string;
  source_url: string;
  update_frequency: string | null;
  premium_tier: "free" | "pro" | "team";
  min_zoom: number;
  enabled: boolean;
};
export type ActiveLayer = {
  catalog_id: string;
  visible: boolean;
  opacity: number;
  position: number;
};
