export type MapLibreBasemap =
  "streets" | "light" | "dark" | "terrain" | "fiord" | "satellite" | "hybrid";

export const MAPLIBRE_BASEMAPS: Record<
  MapLibreBasemap,
  { label: string; styleUrl: string; description: string }
> = {
  hybrid: {
    label: "Hybrid",
    styleUrl: "https://ows.dea.ga.gov.au/",
    description: "Sentinel-2 bare-earth composite with OpenStreetMap place and road labels",
  },
  satellite: {
    label: "Satellite",
    styleUrl: "https://ows.dea.ga.gov.au/",
    description:
      "Sentinel-2 bare-earth composite through September 2020; Australian coverage",
  },
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
  fiord: {
    label: "Fiord",
    styleUrl: "https://tiles.openfreemap.org/styles/fiord",
    description: "OpenFreeMap Fiord vector/raster styling (no DEM terrain)",
  },
  terrain: {
    label: "Bright",
    styleUrl: "https://tiles.openfreemap.org/styles/bright",
    description: "OpenFreeMap Bright vector basemap (no elevation terrain)",
  },
};

export const OPENFREEMAP_ATTRIBUTION =
  "OpenFreeMap · © OpenMapTiles · OpenStreetMap contributors";

export function scopedMapLibrePreference(userId: string, workspaceId: string) {
  return `landos:maplibre:v1:${userId}:${workspaceId}:basemap`;
}

export function isMapLibreBasemap(value: unknown): value is MapLibreBasemap {
  return typeof value === "string" && Object.hasOwn(MAPLIBRE_BASEMAPS, value);
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

export function basemapAttribution(value: MapLibreBasemap) {
  return (
    (value === "satellite" || value === "hybrid"
      ? "© Commonwealth of Australia (Geoscience Australia) · Copernicus Sentinel data · CC BY 4.0"
      : OPENFREEMAP_ATTRIBUTION) +
    (value === "hybrid" ? ` · ${OPENFREEMAP_ATTRIBUTION}` : "") +
    (["light", "dark", "fiord"].includes(value)
      ? " · Design © CARTO / Stamen / Paul Norman (CC BY 3.0)"
      : "")
  );
}

/** DEA Sentinel-2 bare-earth true-colour composite, based on observations through September 2020. */
export function basemapStyle(
  value: MapLibreBasemap,
): string | import("maplibre-gl").StyleSpecification {
  if (value !== "satellite" && value !== "hybrid") return MAPLIBRE_BASEMAPS[value].styleUrl;
  return {
    version: 8,
    ...(value === "hybrid" ? { glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf" } : {}),
    sources: {
      ...(value === "hybrid" ? { openmaptiles: { type: "vector" as const, url: "https://tiles.openfreemap.org/planet", attribution: OPENFREEMAP_ATTRIBUTION } } : {}),
      "dea-satellite": {
        type: "raster",
        tiles: [
          "https://ows.dea.ga.gov.au/?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=s2_barest_earth&STYLE=simple_rgb&FORMAT=image%2Fpng&TILEMATRIXSET=WholeWorld_WebMercator&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
        ],
        tileSize: 256,
        bounds: [112.32, -43.94, 154.71, -8.82],
        maxzoom: 14,
        attribution:
          "© Commonwealth of Australia (Geoscience Australia) · Copernicus Sentinel data · CC BY 4.0",
      },
    },
    layers: [
      {
        id: "dea-satellite-background",
        type: "background",
        paint: { "background-color": "#26383a" },
      },
      { id: "dea-satellite-raster", type: "raster", source: "dea-satellite" },
      ...(value === "hybrid" ? [
        { id: "hybrid-road-labels", type: "symbol" as const, source: "openmaptiles", "source-layer": "transportation_name", minzoom: 12, layout: { "symbol-placement": "line" as const, "text-field": ["coalesce", ["get", "name:en"], ["get", "name"], ""] as import("maplibre-gl").ExpressionSpecification, "text-font": ["Noto Sans Regular"], "text-size": 11 }, paint: { "text-color": "#ffffff", "text-halo-color": "#26383a", "text-halo-width": 1.5 } },
        { id: "hybrid-place-labels", type: "symbol" as const, source: "openmaptiles", "source-layer": "place", layout: { "text-field": ["coalesce", ["get", "name:en"], ["get", "name"], ""] as import("maplibre-gl").ExpressionSpecification, "text-font": ["Noto Sans Regular"], "text-size": 13 }, paint: { "text-color": "#ffffff", "text-halo-color": "#26383a", "text-halo-width": 1.5 } },
      ] : []),
    ],
  };
}
