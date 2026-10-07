import area from "@turf/area";
import intersect from "@turf/intersect";
import booleanIntersects from "@turf/boolean-intersects";
import { featureCollection } from "@turf/helpers";
import type { Geometry, Polygon, MultiPolygon, Position } from "geojson";
import { validGeometry } from "../map/drawing";
export type PropertyGeometry = Polygon | MultiPolygon;

// Preserve every ring/part. Reject unsupported or excessive geometry explicitly.
export function propertyGeometry(value: unknown): PropertyGeometry | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { type?: string; geometry?: unknown };
  const g = v.type === "Feature" ? v.geometry : value;
  if (!g || typeof g !== "object") return null;
  const geometry = g as Geometry;
  if (
    (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") ||
    !validGeometry(geometry)
  )
    return null;
  if (JSON.stringify(geometry).length > 2_000_000) return null;
  const size = area(geometry);
  return Number.isFinite(size) && size > 0 ? geometry : null;
}
export function propertyIntersection(
  property: PropertyGeometry,
  control: Geometry,
) {
  if (!validGeometry(control)) throw new Error("Invalid official geometry");
  if (!booleanIntersects(property, control)) return null;
  if (control.type !== "Polygon" && control.type !== "MultiPolygon")
    return { intersection_area_m2: null, intersection_percent: null };
  const clipped = intersect(
    featureCollection([
      { type: "Feature", properties: {}, geometry: property },
      { type: "Feature", properties: {}, geometry: control },
    ]),
  );
  const clippedArea = clipped ? area(clipped) : 0;
  const percent = (clippedArea / area(property)) * 100;
  if (!Number.isFinite(percent) || percent > 100.0001)
    throw new Error("Invalid intersection area");
  return {
    intersection_area_m2: clippedArea,
    intersection_percent: Math.min(100, percent),
  };
}
function oriented(ring: Position[], outer: boolean) {
  const signed = ring
    .slice(1)
    .reduce((v, p, i) => v + ring[i][0] * p[1] - p[0] * ring[i][1], 0);
  return (outer ? signed < 0 : signed > 0) ? ring : [...ring].reverse();
}
// ArcGIS JSON requires clockwise shells and counter-clockwise holes.
export function esriProperty(property: PropertyGeometry) {
  const parts =
    property.type === "Polygon" ? [property.coordinates] : property.coordinates;
  return {
    rings: parts.flatMap((part) =>
      part.map((ring, i) => oriented(ring, i === 0)),
    ),
    spatialReference: { wkid: 4326 },
  };
}
