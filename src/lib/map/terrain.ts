import { LngLat, type Map as MapLibreMap } from "maplibre-gl";
import { terrainTileJsonUrl } from "./maplibre-config";

export const TERRAIN_SOURCE = "landos-terrain-dem";
const HILLSHADE = "landos-terrain-hillshade";

/** Disabled until an operator configures a reviewed Terrarium TileJSON and attribution. */
export function terrainConfig(url: string | undefined, attribution: string | undefined, size?: string) {
  const safeUrl = terrainTileJsonUrl(url);
  if (size && size !== "256" && size !== "512") return null;
  return safeUrl && attribution?.trim() ? { url: safeUrl, attribution: attribution.trim(), tileSize: size === "256" ? 256 : 512 } : null;
}

export function applyTerrain(map: MapLibreMap, config: { url: string; attribution: string; tileSize?: number }, enabled: boolean, hillshade: boolean, exaggeration: number) {
  if (!map.getSource(TERRAIN_SOURCE)) map.addSource(TERRAIN_SOURCE, { type: "raster-dem", url: config.url, encoding: "terrarium", tileSize: config.tileSize ?? 512, attribution: config.attribution });
  if (hillshade && !map.getLayer(HILLSHADE)) map.addLayer({ id: HILLSHADE, type: "hillshade", source: TERRAIN_SOURCE }, map.getStyle().layers.find((layer) => layer.type === "symbol")?.id);
  if (!hillshade && map.getLayer(HILLSHADE)) map.removeLayer(HILLSHADE);
  map.setTerrain(enabled ? { source: TERRAIN_SOURCE, exaggeration } : null);
}

/** Only drawn DEM coverage is sampled; unlike queryTerrainElevation this distinguishes missing data from zero. */
export function terrainElevation(map: MapLibreMap, point: [number, number], exaggeration: number): number | null {
  if (!map.getTerrain() || !map.terrain || !Number.isFinite(exaggeration) || exaggeration <= 0) return null;
  const value = map.terrain.getDrawnElevationForLngLat(new LngLat(point[0], point[1]));
  return value === undefined || !Number.isFinite(value) ? null : value / exaggeration;
}

/** MapLibre's current terrain coverage index includes all drawn terrain tiles.
 * An unavailable sampler must not be mistaken for a zero-elevation tile.
 * A loaded tile can still contain source-data voids, so this is not proof of
 * individual pixel validity or survey-quality coverage.
 */
export function visibleTerrainCoverage(map: MapLibreMap): "unknown" | "partial" | "loaded" {
  if (!map.getTerrain() || !map.terrain) return "unknown";
  const index = map.terrain.getCoverageIndex();
  if (!index || !index.samplerPerTile.size) return "unknown";
  for (const sampler of index.samplerPerTile.values()) if (!sampler) return "partial";
  return "loaded";
}

export type Position = [number, number];
export type HeightSample = { distance: number; elevation: number | null };
export function distanceMeters(a: Position, b: Position) {
  const rad = Math.PI / 180, p1 = a[1] * rad, p2 = b[1] * rad;
  const dlat = (b[1] - a[1]) * rad, dlon = (b[0] - a[0]) * rad;
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dlon / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** Sample a polyline at a bounded number of points, keeping gaps explicit. */
export function elevationProfile(points: Position[], sample: (p: Position) => number | null, spacing = 30): HeightSample[] {
  if (points.length < 2 || !Number.isFinite(spacing) || spacing <= 0) return [];
  const lengths = points.slice(1).map((p, i) => distanceMeters(points[i], p));
  const total = lengths.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(total) || total === 0) return [];
  const count = Math.min(100, Math.max(1, Math.ceil(total / spacing)));
  return Array.from({ length: count + 1 }, (_, i) => {
    const distance = total * i / count;
    let remaining = distance, segment = 0;
    while (segment < lengths.length - 1 && remaining > lengths[segment]) remaining -= lengths[segment++];
    const f = lengths[segment] ? remaining / lengths[segment] : 0;
    const a = points[segment], b = points[segment + 1];
    const elevation = sample([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    return { distance, elevation: elevation !== null && Number.isFinite(elevation) ? elevation : null };
  });
}
export function profileSummary(profile: HeightSample[]) {
  if (profile.length < 2 || profile.some((p) => p.elevation === null)) return null;
  const values = profile.map((p) => p.elevation as number);
  const distance = profile.at(-1)!.distance;
  if (distance <= 0) return null;
  const rise = values.at(-1)! - values[0], gradient = rise / distance;
  return { min: Math.min(...values), max: Math.max(...values), average: values.reduce((a, b) => a + b, 0) / values.length, difference: Math.max(...values) - Math.min(...values), slopePercent: gradient * 100, slopeDegrees: Math.atan(gradient) * 180 / Math.PI };
}

/** Uniform interior grid estimates only: never return a partial parcel as complete. */
export function parcelElevation(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon, sample: (p: Position) => number | null) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const points = polygons.flat(2);
  if (!points.length || points.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) return null;
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  if (minX >= maxX || minY >= maxY || maxX - minX > 2 || maxY - minY > 2) return null;
  const inRing = (point: Position, ring: number[][]) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > point[1]) !== (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const heights: number[] = [];
  for (let x = 0; x < 20; x++) for (let y = 0; y < 20; y++) {
    const p: Position = [minX + (x + 0.5) * (maxX - minX) / 20, minY + (y + 0.5) * (maxY - minY) / 20];
    if (!polygons.some((polygon) => polygon.length && inRing(p, polygon[0]) && !polygon.slice(1).some((ring) => inRing(p, ring)))) continue;
    const height = sample(p);
    if (height === null || !Number.isFinite(height)) return null;
    heights.push(height);
  }
  if (!heights.length) return null;
  const min = Math.min(...heights), max = Math.max(...heights);
  return { min, max, difference: max - min, average: heights.reduce((a, b) => a + b, 0) / heights.length, samples: heights.length };
}
