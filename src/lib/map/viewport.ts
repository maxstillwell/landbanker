import type { Geometry, Position } from "geojson";
export type Bbox = [number, number, number, number];
const usable = (p: Position) =>
  Array.isArray(p) &&
  p.length >= 2 &&
  Number.isFinite(p[0]) &&
  Number.isFinite(p[1]) &&
  Math.abs(p[0]) <= 180 &&
  Math.abs(p[1]) <= 90;
const inside = (p: Position, b: Bbox) =>
  usable(p) && p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
function segment(a: Position, c: Position, b: Bbox): boolean {
  if (!usable(a) || !usable(c)) return false;
  let lo = 0,
    hi = 1;
  const dx = c[0] - a[0],
    dy = c[1] - a[1];
  const ps = [-dx, dx, -dy, dy],
    qs = [a[0] - b[0], b[2] - a[0], a[1] - b[1], b[3] - a[1]];
  for (let i = 0; i < 4; i++) {
    if (ps[i] === 0) {
      if (qs[i] < 0) return false;
      continue;
    }
    const t = qs[i] / ps[i];
    if (ps[i] < 0) lo = Math.max(lo, t);
    else hi = Math.min(hi, t);
    if (lo > hi) return false;
  }
  return true;
}
const line = (points: Position[], b: Bbox) =>
  points.length >= 2 &&
  points.every(usable) &&
  (points.some((p) => inside(p, b)) ||
    points.slice(1).some((p, i) => segment(points[i], p, b)));
function inRing(p: Position, ring: Position[]) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      c = ring[j];
    if (
      a[1] > p[1] !== c[1] > p[1] &&
      p[0] < ((c[0] - a[0]) * (p[1] - a[1])) / (c[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function polygon(rings: Position[][], b: Bbox) {
  if (!rings.length || !rings.every((r) => r.length >= 4 && r.every(usable)))
    return false;
  if (rings.some((r) => line(r, b))) return true;
  return [
    [b[0], b[1]],
    [b[2], b[1]],
    [b[2], b[3]],
    [b[0], b[3]],
  ].some(
    (p) => inRing(p, rings[0]) && !rings.slice(1).some((r) => inRing(p, r)),
  );
}
export function intersectsViewport(
  g: Geometry | null | undefined,
  b: Bbox,
): boolean {
  if (!g) return false;
  try {
    switch (g.type) {
      case "Point":
        return inside(g.coordinates, b);
      case "MultiPoint":
        return g.coordinates.some((p) => inside(p, b));
      case "LineString":
        return line(g.coordinates, b);
      case "MultiLineString":
        return g.coordinates.some((p) => line(p, b));
      case "Polygon":
        return polygon(g.coordinates, b);
      case "MultiPolygon":
        return g.coordinates.some((p) => polygon(p, b));
      case "GeometryCollection":
        return g.geometries.some((p) => intersectsViewport(p, b));
    }
  } catch {
    /* Malformed legacy/imported geometry must not break the whole viewport. */
  }
  return false;
}
