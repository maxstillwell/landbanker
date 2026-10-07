import type { GeoJsonObject, FeatureCollection } from "geojson";
export type Parcel = {
  id: string;
  workspace_id: string;
  title: string;
  latitude: number | null;
  longitude: number | null;
  geometry: GeoJsonObject | null;
  notes: string | null;
  status: string;
  metadata: Record<string, unknown>;
  address?: string | null;
  state?: "VIC" | "NSW" | null;
  hectares?: number | null;
  source?: string | null;
  source_parcel_id?: string | null;
  saved_at?: string;
  source_updated_at?: string | null;
  source_url?: string | null;
  lot?: string | null;
  plan?: string | null;
  retrieved_at?: string | null;
};
export type Observation = {
  id: string;
  workspace_id: string;
  latitude: number;
  longitude: number;
  title: string;
  notes: string | null;
  observed_at: string;
  linked_parcel_id?: string | null;
  metadata: Record<string, unknown>;
  field_observation_media: Media[];
};
export type Media = {
  id: string;
  observation_id: string;
  workspace_id: string;
  storage_path: string | null;
  mime_type: string;
  original_filename: string;
  captured_at: string | null;
  upload_status: string;
  url?: string;
  metadata: Record<string, unknown>;
};
export type SpatialLayer = {
  id: string;
  workspace_id: string;
  name: string;
  layer_kind: string;
  geojson: FeatureCollection | null;
  layer_data: Record<string, unknown>;
  metadata: Record<string, unknown>;
};
export type LocationFix = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};
export type MapData = {
  parcels: Parcel[];
  observations: Observation[];
  layers: SpatialLayer[];
  savedViews: { id: string; name: string; view: Record<string, unknown> }[];
};
