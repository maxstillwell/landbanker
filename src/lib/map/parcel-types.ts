import type { Polygon, MultiPolygon } from "geojson";
export type SupportedState = "VIC" | "NSW";
export type AddressResult = {
  address: string;
  state: SupportedState;
  latitude: number;
  longitude: number;
  source: string;
};
export type OfficialParcel = AddressResult & {
  sourceId: string;
  lot: string | null;
  plan: string | null;
  geometry: Polygon | MultiPolygon;
  areaM2: number;
  sourceUrl: string;
  sourceUpdatedAt: string | null;
  retrievedAt: string;
};
