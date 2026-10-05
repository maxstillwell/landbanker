import area from "@turf/area";
import type { Geometry, Feature } from "geojson";
export function distanceMetres(a: number[], b: number[]) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dlat = rad(b[1] - a[1]),
    dlng = rad(b[0] - a[0]);
  const x =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dlng / 2) ** 2;
  return (
    6371008.8 *
    2 *
    Math.atan2(Math.sqrt(Math.min(1, x)), Math.sqrt(Math.max(0, 1 - x)))
  );
}
export function geometryMeasurement(geometry: Geometry) {
  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon")
    return {
      areaM2: area({ type: "Feature", properties: {}, geometry } as Feature),
      distanceM: 0,
    };
  if (geometry.type === "LineString")
    return {
      areaM2: 0,
      distanceM: geometry.coordinates
        .slice(1)
        .reduce(
          (total, p, i) => total + distanceMetres(geometry.coordinates[i], p),
          0,
        ),
    };
  return { areaM2: 0, distanceM: 0 };
}
export function formatArea(m2: number) {
  return m2 >= 10000
    ? `${(m2 / 10000).toLocaleString("en-AU", { maximumFractionDigits: 2 })} ha`
    : `${Math.round(m2).toLocaleString("en-AU")} m²`;
}
export function formatDistance(m: number) {
  return m >= 1000
    ? `${(m / 1000).toFixed(2)} km`
    : `${Math.round(m).toLocaleString("en-AU")} m`;
}
