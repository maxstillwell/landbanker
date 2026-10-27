"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import * as maplibregl from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { installOfficialRasters } from "@/lib/map/maplibre-official";
import { geometryBounds } from "@/lib/map/maplibre-scene";
import {
  MAPLIBRE_BASEMAPS,
  OPENFREEMAP_ATTRIBUTION,
} from "@/lib/map/maplibre-config";
import type { SharedProjection } from "@/lib/map/share-types";

function resources(share: SharedProjection): FeatureCollection {
  const features: Feature[] = [];
  for (const item of share.resources) {
    const value = item.geometry || item.geojson;
    if (value?.type === "FeatureCollection")
      features.push(...(value as FeatureCollection).features);
    else if (value && "type" in value)
      features.push({
        type: "Feature",
        properties: { title: item.title || item.name || "Shared property" },
        geometry: value as Geometry,
      });
    else if (item.latitude != null && item.longitude != null)
      features.push({
        type: "Feature",
        properties: { title: item.title || item.name || "Shared property" },
        geometry: {
          type: "Point",
          coordinates: [item.longitude, item.latitude],
        },
      });
  }
  return { type: "FeatureCollection", features };
}
export default function SharedMap({ share }: { share: SharedProjection }) {
  const node = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState("");
  const data = useMemo(() => resources(share), [share]);
  useEffect(() => {
    if (!node.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: node.current,
        transformRequest: (url) => ({ url, referrerPolicy: "strict-origin" }),
        style: MAPLIBRE_BASEMAPS.streets.styleUrl,
        center: share.view
          ? [share.view.longitude, share.view.latitude]
          : [144, -37],
        zoom: share.view?.zoom ?? 7,
      });
    } catch {
      setNotice(
        "MapLibre could not start. Open this shared view in a browser with WebGL enabled.",
      );
      return;
    }
    map.on("style.load", () => {
      map.addSource("shared-resources", { type: "geojson", data });
      map.addLayer({
        id: "shared-fill",
        type: "fill",
        source: "shared-resources",
        paint: { "fill-color": "#526f4b", "fill-opacity": 0.18 },
      });
      map.addLayer({
        id: "shared-line",
        type: "line",
        source: "shared-resources",
        paint: { "line-color": "#526f4b", "line-width": 2 },
      });
      map.addLayer({
        id: "shared-point",
        type: "circle",
        source: "shared-resources",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 7,
          "circle-color": "#526f4b",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
        },
      });
      installOfficialRasters(map, share.official_layers || []);
      if (!share.view) {
        const bounds = geometryBounds(data);
        if (!bounds.isEmpty())
          map.fitBounds(bounds, { padding: 40, maxZoom: 17, duration: 0 });
      }
    });
    map.on("error", () =>
      setNotice("Map source unavailable. Shared items remain protected."),
    );
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(node.current);
    return () => {
      observer.disconnect();
      map.remove();
    };
  }, [data, share.view, share.official_layers]);
  return (
    <>
      <div
        ref={node}
        className="shared-map"
        aria-label="Read-only shared land map"
      />
      <p className="shared-map-attribution">{OPENFREEMAP_ATTRIBUTION}</p>
      {notice ? <p role="status">{notice}</p> : null}
    </>
  );
}
