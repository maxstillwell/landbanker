import type { Polygon, MultiPolygon } from "geojson";
// Area-weighted geometric centroid in geographic coordinates, including subtractive holes.
// It can lie outside a concave Property; it is not an observation/GPS location.
export function propertyCentroid(
  g: Polygon | MultiPolygon,
): [number, number] | null {
  let total = 0,
    x = 0,
    y = 0;
  for (const part of g.type === "Polygon" ? [g.coordinates] : g.coordinates) {
    part.forEach((ring, index) => {
      const origin = ring[0];
      let twice = 0,
        cx = 0,
        cy = 0;
      for (let i = 1; i < ring.length; i++) {
        const a = [ring[i - 1][0] - origin[0], ring[i - 1][1] - origin[1]],
          b = [ring[i][0] - origin[0], ring[i][1] - origin[1]],
          cross = a[0] * b[1] - b[0] * a[1];
        twice += cross;
        cx += (a[0] + b[0]) * cross;
        cy += (a[1] + b[1]) * cross;
      }
      if (!twice) return;
      const weight = Math.abs(twice) * (index === 0 ? 1 : -1);
      total += weight;
      x += (origin[0] + cx / (3 * twice)) * weight;
      y += (origin[1] + cy / (3 * twice)) * weight;
    });
  }
  return total > 0 && Number.isFinite(x / total) && Number.isFinite(y / total)
    ? [x / total, y / total]
    : null;
}
