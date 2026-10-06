import type { Geometry, Position, FeatureCollection } from "geojson";
import { safeSimple } from "./drawing-edit";
export type DrawingKind = "Point" | "LineString" | "Polygon" | "Rectangle";
export function drawingGeometry(
  kind: DrawingKind,
  points: Position[],
): Geometry | null {
  if (!safeSimple(kind, points)) return null;
  if (kind === "Point")
    return points.length ? { type: "Point", coordinates: points[0] } : null;
  if (kind === "LineString")
    return points.length >= 2
      ? { type: "LineString", coordinates: points }
      : null;
  if (kind === "Rectangle") {
    if (points.length < 2) return null;
    const [a, b] = points;
    if (a[0] === b[0] || a[1] === b[1]) return null;
    return {
      type: "Polygon",
      coordinates: [[a, [b[0], a[1]], b, [a[0], b[1]], a]],
    };
  }
  return points.length >= 3
    ? { type: "Polygon", coordinates: [[...points, points[0]]] }
    : null;
}
export function editablePoints(geometry: Geometry): Position[] | null {
  if (geometry.type === "Point") return [geometry.coordinates];
  if (geometry.type === "LineString") return geometry.coordinates;
  // Do not silently discard holes or multipart geometry when editing imported data.
  if (geometry.type === "Polygon" && geometry.coordinates.length === 1)
    return geometry.coordinates[0].slice(0, -1);
  return null;
}
export function validGeometry(value: unknown): value is Geometry {
  if (!value || typeof value !== "object") return false;
  const g = value as { type: string; coordinates: unknown };
  const point = (p: unknown): boolean =>
    Array.isArray(p) &&
    p.length >= 2 &&
    p.length <= 3 &&
    p.every(Number.isFinite) &&
    Math.abs(p[0]) <= 180 &&
    Math.abs(p[1]) <= 90;
  const line = (p: unknown): boolean =>
    Array.isArray(p) && p.length >= 2 && p.every(point);
  const ring = (p: unknown): boolean =>
    Array.isArray(p) &&
    p.length >= 4 &&
    p.every(point) &&
    p[0][0] === p.at(-1)[0] &&
    p[0][1] === p.at(-1)[1];
  const polygon = (p: unknown): boolean =>
    Array.isArray(p) && p.length > 0 && p.every(ring);
  switch (g.type) {
    case "Point":
      return point(g.coordinates);
    case "MultiPoint":
      return (
        Array.isArray(g.coordinates) &&
        g.coordinates.length > 0 &&
        g.coordinates.every(point)
      );
    case "LineString":
      return line(g.coordinates);
    case "MultiLineString":
      return (
        Array.isArray(g.coordinates) &&
        g.coordinates.length > 0 &&
        g.coordinates.every(line)
      );
    case "Polygon":
      return polygon(g.coordinates);
    case "MultiPolygon":
      return (
        Array.isArray(g.coordinates) &&
        g.coordinates.length > 0 &&
        g.coordinates.every(polygon)
      );
    default:
      return false;
  }
}
export function validCollection(value: FeatureCollection) {
  return value.features.every(
    (f) => f.type === "Feature" && validGeometry(f.geometry),
  );
}
