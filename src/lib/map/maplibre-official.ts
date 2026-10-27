import type { Map } from "maplibre-gl";

export type OfficialRaster = {
  id: string;
  name: string;
  service_url: string;
  renderer: "arcgis_export" | "tile";
  layer_ids: string | null;
  attribution: string;
  min_zoom: number;
  opacity: number;
};
// Native XYZ raster source. ArcGIS exports use the tile's Web Mercator envelope;
// the service and sublayer selection still come from the reviewed catalog.
export function officialTileUrl(layer: OfficialRaster) {
  if (layer.renderer === "tile") return layer.service_url;
  const params = new URLSearchParams({
    bboxSR: "3857",
    imageSR: "3857",
    size: "256,256",
    dpi: "96",
    format: "png32",
    transparent: "true",
    layers: `show:${layer.layer_ids || "0"}`,
    f: "image",
  });
  return `${layer.service_url.replace(/\/$/, "")}/export?${params}&bbox={bbox-epsg-3857}`;
}
export function installOfficialRasters(map: Map, layers: OfficialRaster[]) {
  const ids: string[] = [];
  for (const [index, layer] of layers.entries()) {
    const id = `landos-reference-${index}-${layer.id}`;
    map.addSource(id, {
      type: "raster",
      tiles: [officialTileUrl(layer)],
      tileSize: 256,
      minzoom: layer.min_zoom,
      attribution: layer.attribution,
    });
    map.addLayer(
      {
        id,
        type: "raster",
        source: id,
        minzoom: layer.min_zoom,
        paint: { "raster-opacity": Math.max(0, Math.min(1, layer.opacity)) },
      },
      map.getLayer("landos-parcels-fill")
        ? "landos-parcels-fill"
        : map.getLayer("shared-fill")
          ? "shared-fill"
          : undefined,
    );
    ids.push(id);
  }
  return () => {
    for (const id of ids) {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    }
  };
}
