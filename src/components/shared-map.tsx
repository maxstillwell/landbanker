"use client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { SharedProjection } from "@/lib/map/share-types";
import { createArcGisExportLayer } from "@/lib/map/arcgis-export-layer";
export default function SharedMap({ share }: { share: SharedProjection }) {
  const node = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!node.current) return;
    const m = L.map(node.current).setView(
      share.view ? [share.view.latitude, share.view.longitude] : [-37, 144],
      share.view?.zoom || 7,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      referrerPolicy: "origin",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    const group = L.featureGroup().addTo(m);
    for (const resource of share.resources) {
      try {
        const geometry = resource.geometry || resource.geojson;
        if (geometry)
          L.geoJSON(geometry, {
            style: { color: "#526f4b", weight: 2, fillOpacity: 0.18 },
            pointToLayer: (_f, p) =>
              L.circleMarker(p, { radius: 7, color: "#526f4b" }),
          }).addTo(group);
        else if (resource.latitude != null && resource.longitude != null)
          L.circleMarker([resource.latitude, resource.longitude], {
            radius: 7,
            color: "#526f4b",
          }).addTo(group);
      } catch {
        /* Preserve remaining explicit shared resources if legacy geometry is invalid. */
      }
    }
    for (const official of share.official_layers || []) {
      if (official.renderer === "arcgis_export")
        createArcGisExportLayer(official.service_url, official.layer_ids, {
          opacity: Number(official.opacity),
          minZoom: official.min_zoom,
          attribution: official.attribution,
          referrerPolicy: "origin",
        }).addTo(m);
    }
    if (!share.view && group.getBounds().isValid())
      m.fitBounds(group.getBounds(), { padding: [24, 24], maxZoom: 17 });
    const observer = new ResizeObserver(() => m.invalidateSize({ pan: false }));
    observer.observe(node.current);
    return () => {
      observer.disconnect();
      m.remove();
    };
  }, [share]);
  return (
    <div
      ref={node}
      className="shared-map"
      aria-label="Read-only shared land map"
    />
  );
}
