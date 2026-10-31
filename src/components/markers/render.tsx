import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import { markerIcons } from "./icons";
import { MARKER_COLORS, MARKER_SIZES } from "@/lib/markers/catalog";
import type { MarkerInput } from "@/lib/markers/model";
export const MARKER_SOURCE = "landos-user-markers";
export const MARKER_LAYER = "landos-user-markers-symbol";
const LABELS = "landos-user-markers-label",
  HALO = "landos-user-markers-selected";
export function markerSvg(
  icon: MarkerInput["icon"],
  color: MarkerInput["color"],
) {
  const inner = renderToStaticMarkup(
    createElement(markerIcons[icon], {
      size: 24,
      strokeWidth: 1.9,
      color: "#14272b",
    }),
  ).replace("<svg ", '<svg x="12" y="9" ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="112" viewBox="0 0 48 56"><path d="M24 53 15 41a20 20 0 1 1 18 0Z" fill="#000" opacity=".2" transform="translate(0 2)"/><path d="M24 51 15 39a19 19 0 1 1 18 0Z" fill="${MARKER_COLORS[color]}" stroke="#112b30" stroke-width="2.5"/>${inner}</svg>`;
}
async function imageFor(svg: string) {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(new Error("Marker icon could not be rendered."));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function renderMarkers(
  map: MapLibreMap,
  rows: MarkerInput[],
  selected: string | null,
  isCurrent: () => boolean,
) {
  const unique = new Map(rows.map((r) => [`${r.icon}-${r.color}`, r]));
  for (const [key, r] of unique) {
    const id = `landos-marker-icon-${key}`;
    if (map.hasImage(id)) continue;
    const image = await imageFor(markerSvg(r.icon, r.color));
    if (!isCurrent()) return;
    if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: 2 });
  }
  if (!isCurrent()) return;
  const data: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: rows.map((r) => ({
      type: "Feature",
      id: r.id,
      properties: {
        id: r.id,
        sprite: `landos-marker-icon-${r.icon}-${r.color}`,
        scale: MARKER_SIZES[r.size],
        label: r.show_label ? r.name : "",
        selected: r.id === selected,
      },
      geometry: { type: "Point", coordinates: [r.longitude, r.latitude] },
    })),
  };
  if (!map.getSource(MARKER_SOURCE))
    map.addSource(MARKER_SOURCE, { type: "geojson", data });
  else (map.getSource(MARKER_SOURCE) as GeoJSONSource).setData(data);
  if (!map.getLayer(HALO))
    map.addLayer({
      id: HALO,
      type: "circle",
      source: MARKER_SOURCE,
      filter: ["==", ["get", "selected"], true],
      paint: {
        "circle-radius": 9,
        "circle-color": "#d8ff43",
        "circle-opacity": 0.25,
        "circle-stroke-color": "#fff",
        "circle-stroke-width": 2,
      },
    });
  if (!map.getLayer(MARKER_LAYER))
    map.addLayer({
      id: MARKER_LAYER,
      type: "symbol",
      source: MARKER_SOURCE,
      layout: {
        "icon-image": ["get", "sprite"],
        "icon-size": ["get", "scale"],
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-pitch-alignment": "viewport",
        "icon-rotation-alignment": "viewport",
      },
    });
  // Some satellite styles have no glyph endpoint. Preserve their imagery while
  // providing labels from the same free font service used by the current hybrid.
  if (!map.getStyle().glyphs)
    map.setGlyphs(
      "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    );
  if (!map.getLayer(LABELS))
    map.addLayer({
      id: LABELS,
      type: "symbol",
      source: MARKER_SOURCE,
      layout: {
        "text-field": ["get", "label"],
        "text-font": ["literal", ["Noto Sans Regular"]],
        "text-size": 12,
        "text-anchor": "top",
        "text-offset": [0, 0.3],
        "text-max-width": 14,
        "text-optional": true,
      },
      paint: {
        "text-color": "#fff",
        "text-halo-color": "#12282b",
        "text-halo-width": 2,
      },
    });
  for (const id of [HALO, MARKER_LAYER, LABELS])
    if (map.getLayer(id)) map.moveLayer(id);
}
export function removeMarkerLayers(map: MapLibreMap) {
  for (const id of [LABELS, MARKER_LAYER, HALO])
    if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(MARKER_SOURCE)) map.removeSource(MARKER_SOURCE);
  for (const id of map.listImages())
    if (id.startsWith("landos-marker-icon-")) map.removeImage(id);
}
