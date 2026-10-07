export type PlanningStatus =
  | "matched"
  | "no_intersection"
  | "no_result"
  | "source_unavailable"
  | "request_failed"
  | "unsupported_location";
export type PlanningControl = {
  property_id: string;
  catalog_layer_id: string;
  source_feature_id: string;
  control_type: string;
  control_name: string;
  control_code: string | null;
  value: string | null;
  relation: "intersects_property";
  intersection_area_m2: number | null;
  intersection_percent: number | null;
  source_metadata: Record<string, string | number | null>;
  queried_at: string;
};
export type PlanningLayerResult = {
  catalog_layer_id: string;
  name: string;
  category: string;
  status: PlanningStatus;
  message: string;
  controls: PlanningControl[];
  provider: string;
  source_url: string;
  endpoint: string;
  attribution: string;
  limitation: string;
  update_info: string | null;
  queried_at: string;
};
export type PropertyPlanning = {
  property_id: string;
  queried_at: string;
  area_m2: number | null;
  status: "supported" | "unsupported_location" | "geometry_unavailable";
  layers: PlanningLayerResult[];
};
