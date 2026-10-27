import { officialFeatureKey } from "./official-selection";
import { officialZoneCode, zoneCategory } from "./zoning-style";
import { timeoutFetch } from "../network";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { esriRingsGeometry } from "./esri-rings";

export type OfficialLayerId =
  "vic-parcels" | "vic-zoning" | "nsw-parcels" | "nsw-zoning";
export type OfficialLayerState = "VIC" | "NSW";

export type OfficialMapLayer = {
  id: OfficialLayerId;
  state: OfficialLayerState;
  label: string;
  provider: string;
  dataset: string;
  serviceUrl: string;
  layerId: number;
  requestFormat: "geojson" | "esri-json";
  fields: string[];
  minZoom: number;
  color: string;
  fillOpacity: number;
  sourceUrl: string;
};

// Fixed, reviewed official source definitions. This is intentionally not a
// user-editable URL registry and performs no proxying or provider-data caching.
export const OFFICIAL_MAP_LAYERS: Record<OfficialLayerId, OfficialMapLayer> = {
  "vic-parcels": {
    id: "vic-parcels",
    state: "VIC",
    label: "Victoria cadastral parcels",
    provider: "Victorian Government · VicPlan",
    dataset: "VicPlan Property and Parcel — Parcel",
    serviceUrl:
      "https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/VicPlan_PropertyAndParcel/MapServer",
    layerId: 4,
    requestFormat: "geojson",
    fields: [
      "PARCEL_PFI",
      "PARCEL_SPI",
      "PARCEL_LOT_NUMBER",
      "PARCEL_PLAN_NUMBER",
    ],
    minZoom: 13,
    color: "#24564d",
    fillOpacity: 0.03,
    sourceUrl: "https://www.land.vic.gov.au/maps-and-spatial/spatial-data",
  },
  "vic-zoning": {
    id: "vic-zoning",
    state: "VIC",
    label: "Victoria planning zones",
    provider: "Victorian Government",
    dataset: "Planning Scheme Zones — All Zones",
    serviceUrl:
      "https://spatial.planning.vic.gov.au/gis/rest/services/planning_scheme_zones/MapServer",
    layerId: 0,
    requestFormat: "geojson",
    fields: ["ZONE_CODE", "ZONE_DESCRIPTION", "LGA", "SCHEME_CODE"],
    minZoom: 9,
    color: "#8d5b2e",
    fillOpacity: 0.13,
    sourceUrl:
      "https://www.planning.vic.gov.au/schemes-and-amendments/browse-planning-schemes",
  },
  "nsw-parcels": {
    id: "nsw-parcels",
    state: "NSW",
    label: "NSW cadastral parcels",
    provider: "NSW Spatial Services",
    dataset: "NSW Land Parcel Property Theme — Lot",
    serviceUrl:
      "https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Land_Parcel_Property_Theme/MapServer",
    layerId: 8,
    requestFormat: "esri-json",
    fields: ["cadid", "lotnumber", "planlabel", "lotidstring"],
    minZoom: 13,
    color: "#24564d",
    fillOpacity: 0.03,
    sourceUrl:
      "https://www.spatial.nsw.gov.au/products_and_services/web_services",
  },
  "nsw-zoning": {
    id: "nsw-zoning",
    state: "NSW",
    label: "NSW land zoning",
    provider: "NSW Government",
    dataset: "EPI Primary Planning Layers — Land Zoning",
    serviceUrl:
      "https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer",
    layerId: 2,
    requestFormat: "esri-json",
    fields: ["LAY_NAME", "LAY_CLASS", "SYM_CODE", "EPI_NAME", "PURPOSE"],
    minZoom: 9,
    color: "#8d5b2e",
    fillOpacity: 0.13,
    sourceUrl: "https://www.planningportal.nsw.gov.au/spatialviewer",
  },
};

export type OfficialLayerResult = {
  collection: FeatureCollection;
  featureCount: number;
  exceededTransferLimit: boolean;
};

type EsriFeature = {
  attributes?: Record<string, unknown>;
  geometry?: { rings?: unknown };
};

function queryUrl(
  layer: OfficialMapLayer,
  bbox: [number, number, number, number],
) {
  const params = new URLSearchParams({
    f: layer.requestFormat === "geojson" ? "geojson" : "json",
    where: "1=1",
    geometry: bbox.join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: layer.fields.join(","),
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: "500",
  });
  return `${layer.serviceUrl}/${layer.layerId}/query?${params}`;
}

export async function queryOfficialLayer(
  layer: OfficialMapLayer,
  bbox: [number, number, number, number],
  signal?: AbortSignal,
): Promise<OfficialLayerResult> {
  const response = await timeoutFetch(queryUrl(layer, bbox), { signal }, 12000);
  if (!response.ok)
    throw new Error(`${layer.label} returned HTTP ${response.status}.`);
  const payload = (await response.json()) as {
    error?: { message?: string };
    features?: Array<Feature | EsriFeature>;
    exceededTransferLimit?: boolean;
    type?: string;
  };
  if (payload.error)
    throw new Error(
      payload.error.message || `${layer.label} could not be queried.`,
    );
  const features: Feature[] =
    layer.requestFormat === "geojson"
      ? ((payload.features || []) as Feature[])
      : (payload.features || []).flatMap((feature) => {
          const input = feature as EsriFeature;
          try {
            const geometry = esriRingsGeometry(
              input.geometry?.rings,
            ) as Geometry;
            return [
              {
                type: "Feature" as const,
                properties: input.attributes || {},
                geometry,
              },
            ];
          } catch {
            return [];
          }
        });
  const tagged = features.map((feature) => ({
    ...feature,
    id: officialFeatureKey(layer, feature),
    properties: {
      ...(feature.properties || {}),
      officialFeatureKey: officialFeatureKey(layer, feature),
      officialLayerId: layer.id,
      zoneCode: officialZoneCode(layer.state, feature.properties || {}),
      zoneCategory: zoneCategory(
        layer.state,
        officialZoneCode(layer.state, feature.properties || {}),
        feature.properties?.LAY_NAME || feature.properties?.ZONE_DESCRIPTION,
      ),
      officialLayerLabel: layer.label,
      officialProvider: layer.provider,
      officialDataset: layer.dataset,
    },
  }));
  return {
    collection: { type: "FeatureCollection", features: tagged },
    featureCount: tagged.length,
    exceededTransferLimit: Boolean(payload.exceededTransferLimit),
  };
}

export function emptyOfficialCollection(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}
