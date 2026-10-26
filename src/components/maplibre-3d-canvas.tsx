"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection } from "geojson";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { mapLibreCollections } from "@/lib/map/maplibre-geojson";
import type { MapData, LocationFix, Parcel, Observation, SpatialLayer } from "@/lib/types";

type View = { latitude: number; longitude: number; zoom: number };
type Props = {
  data: MapData;
  initialView: View;
  location: LocationFix | null;
  onViewChange: (view: View) => void;
  onSelectParcel: (parcel: Parcel) => void;
  onSelectObservation: (observation: Observation) => void;
  onSelectFeature: (layer: SpatialLayer, featureId: string) => void;
};

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#d8dfca" } },
    { id: "osm", type: "raster", source: "osm" },
  ],
};

function empty(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function source(map: Map, id: string) {
  return map.getSource(id) as GeoJSONSource | undefined;
}

function setData(map: Map, id: string, value: FeatureCollection) {
  source(map, id)?.setData(value);
}

function addWorkspaceLayers(map: Map) {
  map.addSource("landos-parcels", { type: "geojson", data: empty() });
  map.addLayer({
    id: "landos-parcel-fill",
    type: "fill",
    source: "landos-parcels",
    paint: { "fill-color": "#a8cb71", "fill-opacity": 0.16 },
  });
  map.addLayer({
    id: "landos-parcel-line",
    type: "line",
    source: "landos-parcels",
    paint: { "line-color": "#25493d", "line-width": 2.5 },
  });
  map.addSource("landos-observations", { type: "geojson", data: empty() });
  map.addLayer({
    id: "landos-observations-circle",
    type: "circle",
    source: "landos-observations",
    paint: {
      "circle-radius": 7,
      "circle-color": "#e29a55",
      "circle-stroke-color": "#fffaf0",
      "circle-stroke-width": 2,
    },
  });
  map.addSource("landos-features", { type: "geojson", data: empty() });
  map.addLayer({
    id: "landos-features-fill",
    type: "fill",
    source: "landos-features",
    paint: { "fill-color": "#86bccc", "fill-opacity": 0.16 },
  });
  map.addLayer({
    id: "landos-features-line",
    type: "line",
    source: "landos-features",
    paint: { "line-color": "#397b88", "line-width": 2 },
  });
  map.addLayer({
    id: "landos-features-point",
    type: "circle",
    source: "landos-features",
    filter: ["==", ["geometry-type"], "Point"],
    paint: { "circle-radius": 6, "circle-color": "#397b88" },
  });
  map.addSource("landos-location", { type: "geojson", data: empty() });
  map.addLayer({
    id: "landos-location-point",
    type: "circle",
    source: "landos-location",
    paint: {
      "circle-radius": 7,
      "circle-color": "#4b91f1",
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 3,
    },
  });
  map.addSource("openfreemap-buildings", {
    type: "vector",
    url: "https://tiles.openfreemap.org/planet",
  });
  map.addLayer({
    id: "landos-3d-buildings",
    type: "fill-extrusion",
    source: "openfreemap-buildings",
    "source-layer": "building",
    minzoom: 13,
    paint: {
      "fill-extrusion-color": "#b5a790",
      "fill-extrusion-height": [
        "coalesce",
        ["to-number", ["get", "render_height"], 0],
        ["to-number", ["get", "height"], 0],
        0,
      ],
      "fill-extrusion-base": [
        "coalesce",
        ["to-number", ["get", "render_min_height"], 0],
        ["to-number", ["get", "min_height"], 0],
        0,
      ],
      "fill-extrusion-opacity": 0.82,
    },
  });
}

export default function MapLibre3DCanvas({
  data,
  initialView,
  location,
  onViewChange,
  onSelectParcel,
  onSelectObservation,
  onSelectFeature,
}: Props) {
  const node = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const dataRef = useRef(data);
  const initialViewRef = useRef(initialView);
  const callbacksRef = useRef({ onSelectParcel, onSelectObservation, onSelectFeature, onViewChange });
  const [notice, setNotice] = useState("");
  const collections = useMemo(() => mapLibreCollections(data), [data]);
  useEffect(() => {
    dataRef.current = data;
    callbacksRef.current = { onSelectParcel, onSelectObservation, onSelectFeature, onViewChange };
  }, [data, onSelectFeature, onSelectObservation, onSelectParcel, onViewChange]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    setData(map, "landos-parcels", collections.parcels);
    setData(map, "landos-observations", collections.observations);
    setData(map, "landos-features", collections.workspace.collection);
  }, [collections]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    setData(
      map,
      "landos-location",
      location
        ? {
            type: "FeatureCollection",
            features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [location.longitude, location.latitude] } }],
          }
        : empty(),
    );
  }, [location]);
  useEffect(() => {
    if (!node.current) return;
    let map: Map;
    try {
      map = new maplibregl.Map({
        container: node.current,
        style: OSM_STYLE,
        center: [initialViewRef.current.longitude, initialViewRef.current.latitude],
        zoom: initialViewRef.current.zoom,
        pitch: 55,
        bearing: -18,
        maxPitch: 70,
      });
    } catch {
      setNotice("3D is unavailable in this browser. Switch back to 2D.");
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");
    const ready = () => {
      try {
        if (!map.getSource("landos-parcels")) addWorkspaceLayers(map);
        const current = mapLibreCollections(dataRef.current);
        setData(map, "landos-parcels", current.parcels);
        setData(map, "landos-observations", current.observations);
        setData(map, "landos-features", current.workspace.collection);
      } catch {
        setNotice("3D base map loaded, but workspace overlays are temporarily unavailable.");
      }
    };
    const click = (event: maplibregl.MapMouseEvent) => {
      const result = map.queryRenderedFeatures(event.point, {
        layers: ["landos-parcel-fill", "landos-observations-circle", "landos-features-fill", "landos-features-line", "landos-features-point"].filter((id) => Boolean(map.getLayer(id))),
      })[0];
      if (!result) return;
      const id = String(result.id || "");
      const callbacks = callbacksRef.current;
      if (result.properties?.kind === "parcel") {
        const parcel = dataRef.current.parcels.find((item) => item.id === id);
        if (parcel) callbacks.onSelectParcel(parcel);
      } else if (result.properties?.kind === "observation") {
        const observation = dataRef.current.observations.find((item) => item.id === id);
        if (observation) callbacks.onSelectObservation(observation);
      } else if (result.properties?.kind === "workspace-feature") {
        const item = mapLibreCollections(dataRef.current).workspace.index.get(id);
        const layer = item && dataRef.current.layers.find((candidate) => candidate.id === item.layerId);
        if (item && layer) callbacks.onSelectFeature(layer, String(item.feature.id));
      }
    };
    const reportView = () => {
      const center = map.getCenter();
      callbacksRef.current.onViewChange({ latitude: center.lat, longitude: center.lng, zoom: map.getZoom() });
    };
    map.on("style.load", ready);
    map.on("click", click);
    map.on("moveend", reportView);
    map.on("error", () => setNotice("Some 3D source data is unavailable. The base map is still usable."));
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(node.current);
    return () => {
      reportView();
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);
  return (
    <div className="map-3d-surface">
      <div ref={node} className="map-3d-canvas" aria-label="LandOS 3D map" />
      <p className="map-3d-status">3D buildings are approximate OpenStreetMap/OpenFreeMap data. Switch to 2D to draw or edit.</p>
      {notice ? <p className="map-3d-error" role="status">{notice}</p> : null}
    </div>
  );
}
