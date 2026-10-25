export type MapLibreBasemap = "streets" | "light" | "dark" | "terrain";

export const MAPLIBRE_BASEMAPS: Record<
  MapLibreBasemap,
  { label: string; styleUrl: string; description: string }
> = {
  streets: {
    label: "Streets",
    styleUrl: "https://tiles.openfreemap.org/styles/liberty",
    description: "OpenFreeMap Liberty vector streets",
  },
  light: {
    label: "Light",
    styleUrl: "https://tiles.openfreemap.org/styles/positron",
    description: "OpenFreeMap Positron vector base map",
  },
  dark: {
    label: "Dark",
    styleUrl: "https://tiles.openfreemap.org/styles/dark",
    description: "OpenFreeMap Dark vector base map",
  },
  terrain: {
    label: "Terrain",
    styleUrl: "https://tiles.openfreemap.org/styles/bright",
    description: "OpenFreeMap Bright vector terrain-oriented base map",
  },
};

export const OPENFREEMAP_ATTRIBUTION =
  "OpenFreeMap · © OpenMapTiles · OpenStreetMap contributors";

export function scopedMapLibrePreference(userId: string, workspaceId: string) {
  return `landos:maplibre:v1:${userId}:${workspaceId}:basemap`;
}

export function isMapLibreBasemap(value: unknown): value is MapLibreBasemap {
  return typeof value === "string" && value in MAPLIBRE_BASEMAPS;
}

export function terrainTileJsonUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
