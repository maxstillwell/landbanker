import type { DrawingKind } from "./drawing";
export type XY = [number, number];
const same = (a: number[], b: number[]) => a[0] === b[0] && a[1] === b[1];
export const safePoint = (p: number[]) =>
  p.length === 2 &&
  p.every(Number.isFinite) &&
  Math.abs(p[0]) <= 180 &&
  Math.abs(p[1]) <= 90;
function cross(a: number[], b: number[], c: number[]) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function intersects(a: number[], b: number[], c: number[], d: number[]) {
  const x = cross(a, b, c),
    y = cross(a, b, d),
    z = cross(c, d, a),
    w = cross(c, d, b);
  const on = (a: number[], b: number[], p: number[]) =>
    Math.abs(cross(a, b, p)) < 1e-12 &&
    p[0] >= Math.min(a[0], b[0]) - 1e-12 &&
    p[0] <= Math.max(a[0], b[0]) + 1e-12 &&
    p[1] >= Math.min(a[1], b[1]) - 1e-12 &&
    p[1] <= Math.max(a[1], b[1]) + 1e-12;
  return (
    (x * y < 0 && z * w < 0) ||
    on(a, b, c) ||
    on(a, b, d) ||
    on(c, d, a) ||
    on(c, d, b)
  );
}
export function safeSimple(kind: DrawingKind, points: number[][]) {
  if (points.length > 200 || !points.every(safePoint)) return false;
  if (kind === "Point") return points.length === 1;
  if (kind === "Rectangle")
    return (
      points.length === 2 &&
      points[0][0] !== points[1][0] &&
      points[0][1] !== points[1][1]
    );
  if (kind === "LineString")
    return (
      points.length >= 2 &&
      points.every((p, i) => i === 0 || !same(p, points[i - 1]))
    );
  if (
    points.length < 3 ||
    new Set(points.map((p) => p.join(","))).size !== points.length
  )
    return false;
  let area = 0;
  // Offset coordinates to reduce cancellation for small shapes at Australian longitudes.
  const origin = points[0];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    area +=
      (a[0] - origin[0]) * (b[1] - origin[1]) -
      (b[0] - origin[0]) * (a[1] - origin[1]);
  }
  if (Math.abs(area) < 1e-14) return false;
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      if (
        intersects(
          points[i],
          points[(i + 1) % points.length],
          points[j],
          points[(j + 1) % points.length],
        )
      )
        return false;
    }
  return true;
}
export function translatePoints(
  kind: DrawingKind,
  points: XY[],
  delta: XY,
): XY[] | null {
  const next: XY[] = points.map((p) => [p[0] + delta[0], p[1] + delta[1]]);
  return safeSimple(kind, next) ? next : null;
}
export function insertVertex(
  kind: DrawingKind,
  points: XY[],
  segment: number,
): XY[] | null {
  if (
    !["LineString", "Polygon"].includes(kind) ||
    segment < 0 ||
    segment >= points.length ||
    (kind === "LineString" && segment === points.length - 1)
  )
    return null;
  const a = points[segment],
    b = points[(segment + 1) % points.length],
    next: XY[] = [...points];
  next.splice(segment + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  return safeSimple(kind, next) ? next : null;
}
export function deleteVertex(
  kind: DrawingKind,
  points: XY[],
  index: number,
): XY[] | null {
  if (
    !["LineString", "Polygon"].includes(kind) ||
    index < 0 ||
    index >= points.length
  )
    return null;
  const next = points.filter((_, i) => i !== index);
  return safeSimple(kind, next) ? next : null;
}
