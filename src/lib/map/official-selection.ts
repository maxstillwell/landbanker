import type { Feature, Polygon, MultiPolygon } from "geojson";
import type { OfficialMapLayer } from "./official-map-catalog";
import type { OfficialParcel } from "./parcel-types";
import { geometryMeasurement } from "./measurement";
import { propertyCentroid } from "../planning/centroid";

export function officialFeatureKey(
  layer: OfficialMapLayer,
  feature: Feature,
): string {
  const p = feature.properties || {};
  const key =
    layer.id === "vic-parcels"
      ? p.PARCEL_PFI || p.PARCEL_SPI
      : layer.id === "nsw-parcels"
        ? p.cadid
        : (p.OBJECTID ?? p.objectid ?? feature.id);
  // Geometry fallback is stable across response ordering; never use array indices.
  if (key != null) return `${layer.id}:${key}`;
  const geometry = JSON.stringify(feature.geometry);
  let hash = 2166136261;
  for (let i = 0; i < geometry.length; i++)
    hash = Math.imul(hash ^ geometry.charCodeAt(i), 16777619);
  return `${layer.id}:geometry:${geometry.length}:${hash >>> 0}`;
}
export function parcelFromOfficialFeature(
  layer: OfficialMapLayer,
  feature: Feature,
): OfficialParcel | null {
  if (
    !layer.id.endsWith("parcels") ||
    !feature.geometry ||
    !["Polygon", "MultiPolygon"].includes(feature.geometry.type)
  )
    return null;
  const p = feature.properties || {};
  const sourceId = p[layer.state === "VIC" ? "PARCEL_PFI" : "cadid"];
  if (sourceId == null) return null; // An unidentified polygon is never invented into a Property.
  const geometry = feature.geometry as Polygon | MultiPolygon;
  const centre = propertyCentroid(geometry);
  if (!centre) return null;
  const lot = p[layer.state === "VIC" ? "PARCEL_LOT_NUMBER" : "lotnumber"];
  const plan = p[layer.state === "VIC" ? "PARCEL_PLAN_NUMBER" : "planlabel"];
  return {
    state: layer.state,
    sourceId: String(sourceId),
    lot: lot == null ? null : String(lot),
    plan: plan == null ? null : String(plan),
    address: `Parcel ${p.PARCEL_SPI || p.lotidstring || sourceId}`,
    latitude: centre[1],
    longitude: centre[0],
    geometry,
    areaM2: geometryMeasurement(geometry).areaM2,
    source: layer.provider,
    sourceUrl: layer.sourceUrl,
    sourceUpdatedAt: null,
    retrievedAt: new Date().toISOString(),
  };
}
