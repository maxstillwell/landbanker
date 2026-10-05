import type { Polygon, MultiPolygon, Position } from "geojson";
function signedArea(ring: Position[]) {
  return (
    ring
      .slice(1)
      .reduce((v, p, i) => v + ring[i][0] * p[1] - p[0] * ring[i][1], 0) / 2
  );
}
function contains(ring: Position[], p: Position) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
// Ring containment, not winding alone, preserves holes and disjoint cadastral parts.
export function esriRingsGeometry(value: unknown): Polygon | MultiPolygon {
  if (!Array.isArray(value) || !value.length || value.length > 2000)
    throw new Error("Invalid official boundary rings");
  const rings = value as Position[][];
  if (
    rings.some(
      (r) =>
        !Array.isArray(r) ||
        r.length < 4 ||
        r.some(
          (p) =>
            !Array.isArray(p) ||
            p.length < 2 ||
            !Number.isFinite(p[0]) ||
            !Number.isFinite(p[1]) ||
            Math.abs(p[0]) > 180 ||
            Math.abs(p[1]) > 90,
        ) ||
        r[0][0] !== r.at(-1)?.[0] ||
        r[0][1] !== r.at(-1)?.[1],
    )
  )
    throw new Error("Invalid official boundary coordinates");
  const sizes = rings.map((r) => Math.abs(signedArea(r)));
  const parents = rings.map(
    (ring, i) =>
      rings
        .map((_r, j) => j)
        .filter(
          (j) => j !== i && sizes[j] > sizes[i] && contains(rings[j], ring[0]),
        )
        .sort((a, b) => sizes[a] - sizes[b])[0] ?? -1,
  );
  const depths = parents.map((p) => {
    let d = 0;
    while (p !== -1) {
      d++;
      p = parents[p];
      if (d > rings.length) throw new Error("Invalid boundary nesting");
    }
    return d;
  });
  const polygons = rings.flatMap((ring, i) =>
    depths[i] % 2 === 0
      ? [
          [
            ring,
            ...rings.filter((_r, j) => parents[j] === i && depths[j] % 2 === 1),
          ],
        ]
      : [],
  );
  if (!polygons.length) throw new Error("No official parcel area returned");
  return polygons.length === 1
    ? { type: "Polygon", coordinates: polygons[0] }
    : { type: "MultiPolygon", coordinates: polygons };
}
