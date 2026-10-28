import type { Map as MapLibreMap } from "maplibre-gl";
import { terrainTileJsonUrl } from "./maplibre-config";

export const TERRAIN_SOURCE = "landos-terrain-dem";
const HILLSHADE = "landos-terrain-hillshade";

/** Disabled until an operator configures a reviewed Terrarium TileJSON and attribution. */
export function terrainConfig(url: string | undefined, attribution: string | undefined) {
  const safeUrl = terrainTileJsonUrl(url);
  return safeUrl && attribution?.trim() ? { url: safeUrl, attribution: attribution.trim() } : null;
}

export function applyTerrain(map: MapLibreMap, config: { url: string; attribution: string }, enabled: boolean, hillshade: boolean, exaggeration: number) {
  if (!map.getSource(TERRAIN_SOURCE)) map.addSource(TERRAIN_SOURCE, { type: "raster-dem", url: config.url, encoding: "terrarium", tileSize: 512, attribution: config.attribution });
  if (hillshade && !map.getLayer(HILLSHADE)) map.addLayer({ id: HILLSHADE, type: "hillshade", source: TERRAIN_SOURCE }, map.getStyle().layers.find((layer) => layer.type === "symbol")?.id);
  if (!hillshade && map.getLayer(HILLSHADE)) map.removeLayer(HILLSHADE);
  map.setTerrain(enabled ? { source: TERRAIN_SOURCE, exaggeration } : null);
}

/** Zero is ambiguous in MapLibre: it can indicate missing tiles, so report it unavailable. */
export function terrainElevation(map: MapLibreMap, point: [number, number], exaggeration: number): number | null {
  if (!map.getTerrain() || !map.isSourceLoaded(TERRAIN_SOURCE) || !Number.isFinite(exaggeration) || exaggeration <= 0) return null;
  const value = map.queryTerrainElevation(point);
  return value === null || value === 0 || !Number.isFinite(value) ? null : value / exaggeration;
}
