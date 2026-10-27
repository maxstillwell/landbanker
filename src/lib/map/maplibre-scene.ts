import {
  getVersion,
  setWorkerUrl,
  LngLatBounds,
  type Map,
  type GeoJSONSource,
} from "maplibre-gl";
import type { Feature, FeatureCollection, Geometry } from "geojson";

// MapLibre 6's module-relative worker URL is lost when Next bundles the engine.
// Serve the matching npm worker locally; no CDN/runtime version mismatch.
setWorkerUrl(`/maplibre/${getVersion()}/maplibre-gl-worker.mjs`);

export type LatLng = { lat: number; lng: number };
export const latLng = (lat: number, lng: number): LatLng => ({ lat, lng });
export const emptyCollection = (): FeatureCollection => ({
  type: "FeatureCollection",
  features: [],
});
export function geometryBounds(value: unknown): LngLatBounds {
  const bounds = new LngLatBounds();
  function visit(v: unknown) {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) {
      if (typeof v[0] === "number" && typeof v[1] === "number") {
        if (Number.isFinite(v[0]) && Number.isFinite(v[1]))
          bounds.extend([v[0], v[1]]);
      } else v.forEach(visit);
    } else {
      const o = v as Record<string, unknown>;
      visit(o.coordinates);
      visit(o.geometry);
      visit(o.geometries);
      visit(o.features);
    }
  }
  visit(value);
  return bounds;
}
export function setView(
  map: Map | null,
  position: [number, number],
  zoom: number,
) {
  map?.jumpTo({ center: [position[1], position[0]], zoom });
}
export function geometryFeature(
  geometry: Geometry,
  properties: Record<string, unknown> = {},
): Feature {
  return { type: "Feature", geometry, properties };
}
export function circleFeature(
  latitude: number,
  longitude: number,
  radius: number,
  color: string,
): Feature {
  const ring = Array.from({ length: 65 }, (_, i) => {
    const a = (i * Math.PI) / 32,
      d = radius / 6371008.8;
    const lat = (latitude * Math.PI) / 180,
      lng = (longitude * Math.PI) / 180;
    const y = Math.asin(
      Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(a),
    );
    const x =
      lng +
      Math.atan2(
        Math.sin(a) * Math.sin(d) * Math.cos(lat),
        Math.cos(d) - Math.sin(lat) * Math.sin(y),
      );
    return [(x * 180) / Math.PI, (y * 180) / Math.PI];
  });
  ring[64] = ring[0];
  return geometryFeature({ type: "Polygon", coordinates: [ring] }, { color });
}
export const SCENE_SOURCES = [
  "parcels",
  "observations",
  "features",
  "local",
  "draft",
  "selected",
  "official",
  "gps",
  "drawing",
] as const;
export function installScene(map: Map) {
  for (const name of SCENE_SOURCES) {
    const id = `landos-${name}`;
    if (map.getSource(id)) continue;
    map.addSource(id, { type: "geojson", data: emptyCollection() });
    const color =
      name === "observations"
        ? "#e58e64"
        : name === "gps"
          ? "#4b91f1"
          : ["drawing", "draft", "local", "official"].includes(name)
            ? "#ffa65a"
            : name === "selected"
              ? "#fff3b0"
              : name === "parcels"
                ? "#bed86a"
                : "#86bccc";
    map.addLayer({
      id: `${id}-fill`,
      type: "fill",
      source: id,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "fill-color": ["coalesce", ["get", "color"], color],
        "fill-opacity": 0.14,
      },
    });
    map.addLayer({
      id: `${id}-line`,
      type: "line",
      source: id,
      filter: ["!=", ["geometry-type"], "Point"],
      paint: {
        "line-color": ["coalesce", ["get", "color"], color],
        "line-width": name === "selected" ? 4 : 2,
      },
    });
    map.addLayer({
      id: `${id}-point`,
      type: "circle",
      source: id,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-color": color,
        "circle-radius": 7,
        "circle-stroke-color": "#fffaf0",
        "circle-stroke-width": 2,
      },
    });
  }
}
export function setSceneData(
  map: Map | null,
  name: (typeof SCENE_SOURCES)[number],
  features: Feature[],
) {
  (map?.getSource(`landos-${name}`) as GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features,
  });
}
