import area from "@turf/area";
import intersect from "@turf/intersect";
import { featureCollection } from "@turf/helpers";
import type { Feature, Polygon, MultiPolygon } from "geojson";
// Generic extraction of MaxQI strategic overlap: preserve null for invalid upstream geometry.
export function overlapHectares(
  a: Feature<Polygon | MultiPolygon>,
  b: Feature<Polygon | MultiPolygon>,
) {
  try {
    const total = area(a);
    if (!Number.isFinite(total) || total <= 0) return null;
    const result = intersect(featureCollection([a, b]));
    return result ? area(result) / 10000 : 0;
  } catch {
    return null;
  }
}
export function geojsonFeatures(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as { type?: string; features?: unknown[] };
  return (
    v.type === "FeatureCollection" &&
    Array.isArray(v.features) &&
    v.features.every((f) =>
      Boolean(
        f &&
        typeof f === "object" &&
        (f as { type?: string }).type === "Feature" &&
        (f as { geometry?: unknown }).geometry,
      ),
    )
  );
}
