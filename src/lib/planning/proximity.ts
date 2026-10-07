import booleanIntersects from "@turf/boolean-intersects";
import type { Position } from "geojson";
import { esriProperty, type PropertyGeometry } from "./geometry";
export function propertyBounds(
  shape: PropertyGeometry,
): [number, number, number, number] {
  let west = 180,
    south = 90,
    east = -180,
    north = -90;
  for (const ring of esriProperty(shape).rings)
    for (const p of ring) {
      west = Math.min(west, p[0]);
      south = Math.min(south, p[1]);
      east = Math.max(east, p[0]);
      north = Math.max(north, p[1]);
    }
  return [west, south, east, north];
}
export function nearProperty(
  shape: PropertyGeometry,
  point: Position,
  metres = 500,
): boolean {
  if (booleanIntersects(shape, { type: "Point", coordinates: point }))
    return true;
  // Local equirectangular distance to every boundary segment, including holes.
  // Appropriate for a 500m nearby filter in VIC/NSW, not a survey measurement.
  const sx = 111195 * Math.cos((point[1] * Math.PI) / 180),
    sy = 111195;
  for (const ring of esriProperty(shape).rings)
    for (let i = 1; i < ring.length; i++) {
      const a = [
          (ring[i - 1][0] - point[0]) * sx,
          (ring[i - 1][1] - point[1]) * sy,
        ],
        b = [(ring[i][0] - point[0]) * sx, (ring[i][1] - point[1]) * sy];
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        denom = dx * dx + dy * dy;
      const t = denom
        ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / denom))
        : 0;
      if (Math.hypot(a[0] + t * dx, a[1] + t * dy) <= metres) return true;
    }
  return false;
}
