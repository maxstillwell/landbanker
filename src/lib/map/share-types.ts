import type { GeoJsonObject, FeatureCollection } from "geojson";
export type SharedProjection = {
  type: "parcels" | "layers" | "view";
  resources: {
    id: string;
    name?: string;
    title?: string;
    latitude?: number | null;
    longitude?: number | null;
    geometry?: GeoJsonObject | null;
    geojson?: FeatureCollection | null;
  }[];
  view?: { name: string; latitude: number; longitude: number; zoom: number };
  official_layers?: {
    id: string;
    name: string;
    service_url: string;
    renderer: "arcgis_export" | "tile";
    layer_ids: string;
    attribution: string;
    min_zoom: number;
    opacity: number;
  }[];
};
