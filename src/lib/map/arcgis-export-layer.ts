import L from "leaflet";

type ArcGisLayerOptions = L.TileLayerOptions & {
  arcgisLayers: string;
  layerDefs?: string;
};

type ArcGisLayerInstance = L.TileLayer & {
  _map: L.Map;
  _url: string;
  options: ArcGisLayerOptions;
};

const ArcGisExportTileLayer = L.TileLayer.extend({
  getTileUrl(this: ArcGisLayerInstance, coords: L.Coords) {
    const tileSize = this.getTileSize();
    const northWestPoint = coords.scaleBy(tileSize);
    const southEastPoint = northWestPoint.add(tileSize);
    const northWest = this._map.unproject(northWestPoint, coords.z);
    const southEast = this._map.unproject(southEastPoint, coords.z);
    const northWestMetres = L.CRS.EPSG3857.project(northWest);
    const southEastMetres = L.CRS.EPSG3857.project(southEast);
    const params = new URLSearchParams({
      bbox: [
        northWestMetres.x,
        southEastMetres.y,
        southEastMetres.x,
        northWestMetres.y,
      ].join(","),
      bboxSR: "3857",
      imageSR: "3857",
      size: `${tileSize.x},${tileSize.y}`,
      dpi: "96",
      format: "png32",
      transparent: "true",
      layers: `show:${this.options.arcgisLayers}`,
      f: "image",
    });
    if (this.options.layerDefs) params.set("layerDefs", this.options.layerDefs);
    return `${this._url}/export?${params}`;
  },
}) as unknown as {
  new (url: string, options: ArcGisLayerOptions): L.TileLayer;
};

export function createArcGisExportLayer(
  serviceUrl: string,
  arcgisLayers: string,
  options: L.TileLayerOptions & { layerDefs?: string } = {},
) {
  return new ArcGisExportTileLayer(serviceUrl, {
    tileSize: 256,
    updateWhenIdle: true,
    keepBuffer: 3,
    ...options,
    arcgisLayers,
  } as ArcGisLayerOptions) as L.TileLayer;
}
