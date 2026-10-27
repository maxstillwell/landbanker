"use client";
import { useEffect, useState, type RefObject } from "react";
import type { Map, GeoJSONSource, MapMouseEvent } from "maplibre-gl";
import {
  OFFICIAL_MAP_LAYERS,
  queryOfficialLayer,
  emptyOfficialCollection,
  type OfficialLayerId,
} from "@/lib/map/official-map-catalog";
const ids = Object.keys(OFFICIAL_MAP_LAYERS) as OfficialLayerId[];
const coverage = {
  VIC: [140.7, -39.3, 150.1, -33.8],
  NSW: [140.9, -37.7, 154.1, -28.0],
};
export function OfficialMapLayers({
  map,
  revision,
}: {
  map: RefObject<Map | null>;
  revision: number;
}) {
  const [visible, setVisible] = useState<Record<string, boolean>>(
    Object.fromEntries(ids.map((id) => [id, true])),
  );
  const [status, setStatus] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<{
    id: OfficialLayerId;
    properties: Record<string, unknown>;
  } | null>(null);
  useEffect(() => {
    const m = map.current;
    if (!m?.getSource("landos-parcels")) return;
    for (const id of ids) {
      const source = `official-${id}`,
        layer = OFFICIAL_MAP_LAYERS[id];
      if (m.getSource(source)) continue;
      m.addSource(source, { type: "geojson", data: emptyOfficialCollection() });
      m.addLayer(
        {
          id: `${source}-fill`,
          type: "fill",
          source,
          paint: {
            "fill-color": layer.color,
            "fill-opacity": layer.fillOpacity,
          },
        },
        "landos-parcels-fill",
      );
      m.addLayer(
        {
          id: `${source}-line`,
          type: "line",
          source,
          paint: { "line-color": layer.color, "line-width": 1.2 },
        },
        "landos-parcels-fill",
      );
    }
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout>;
    function load() {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      const b = m!.getBounds();
      const bbox: [number, number, number, number] = [
        Math.max(-180, b.getWest()),
        Math.max(-85, b.getSouth()),
        Math.min(180, b.getEast()),
        Math.min(85, b.getNorth()),
      ];
      for (const id of ids) {
        const layer = OFFICIAL_MAP_LAYERS[id],
          c = coverage[layer.state];
        const source = m!.getSource(`official-${id}`) as
          GeoJSONSource | undefined;
        const outside =
          bbox[0] > c[2] || bbox[2] < c[0] || bbox[1] > c[3] || bbox[3] < c[1];
        const state = !visible[id]
          ? "Off"
          : outside
            ? "Outside state"
            : m!.getZoom() < layer.minZoom
              ? `Zoom to ${layer.minZoom}+`
              : null;
        if (state) {
          source?.setData(emptyOfficialCollection());
          setStatus((s) => ({ ...s, [id]: state }));
          continue;
        }
        setStatus((s) => ({ ...s, [id]: "Loading" }));
        // Clear old extents while loading: stale polygons must not imply coverage.
        source?.setData(emptyOfficialCollection());
        void queryOfficialLayer(layer, bbox, signal)
          .then((result) => {
            if (signal.aborted) return;
            source?.setData(result.collection);
            setStatus((s) => ({
              ...s,
              [id]: result.exceededTransferLimit
                ? "Partial coverage — zoom in"
                : result.featureCount
                  ? "Ready"
                  : "No coverage here",
            }));
          })
          .catch(() => {
            if (!signal.aborted) {
              source?.setData(emptyOfficialCollection());
              setStatus((s) => ({ ...s, [id]: "Service unavailable" }));
            }
          });
      }
    }
    function schedule() {
      controller?.abort();
      clearTimeout(timer);
      timer = setTimeout(load, 300);
    }
    function select(event: MapMouseEvent) {
      const workspace = m!.queryRenderedFeatures(event.point, {
        layers: [
          "landos-parcels-fill",
          "landos-observations-point",
          "landos-features-fill",
          "landos-features-line",
          "landos-features-point",
        ].filter((id) => !!m!.getLayer(id)),
      });
      if (
        workspace.length ||
        document.querySelector(".map-drawing-bar") ||
        document.querySelector(".field-form")
      )
        return;
      const hit = m!.queryRenderedFeatures(event.point, {
        layers: ids.map((id) => `official-${id}-fill`),
      })[0];
      const id = hit?.properties?.officialLayerId as
        OfficialLayerId | undefined;
      if (id && OFFICIAL_MAP_LAYERS[id])
        setSelected({ id, properties: hit.properties });
    }
    m.on("moveend", schedule);
    m.on("click", select);
    schedule();
    return () => {
      clearTimeout(timer);
      controller?.abort();
      m.off("moveend", schedule);
      m.off("click", select);
    };
  }, [map, revision, visible]);
  return (
    <section aria-label="Official layers" className="maplibre-official-layers">
      <strong>Official parcels and zones</strong>
      {ids.map((id) => (
        <label key={id} className="maplibre-official-row">
          <input
            type="checkbox"
            checked={visible[id]}
            onChange={() => setVisible((s) => ({ ...s, [id]: !s[id] }))}
          />
          <span>
            <b>{OFFICIAL_MAP_LAYERS[id].label}</b>
            <small>{status[id] || "Waiting for map"}</small>
          </span>
        </label>
      ))}
      {selected ? (
        <div role="region" aria-label="Official feature Inspector">
          <button onClick={() => setSelected(null)}>
            Close official feature
          </button>
          <strong>{OFFICIAL_MAP_LAYERS[selected.id].label}</strong>
          <p>
            {OFFICIAL_MAP_LAYERS[selected.id].provider} ·{" "}
            {OFFICIAL_MAP_LAYERS[selected.id].dataset}
          </p>
          <dl>
            {OFFICIAL_MAP_LAYERS[selected.id].fields.map((field) => (
              <div key={field}>
                <dt>{field}</dt>
                <dd>{String(selected.properties[field] ?? "Not supplied")}</dd>
              </div>
            ))}
          </dl>
          <a
            href={OFFICIAL_MAP_LAYERS[selected.id].sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Official provenance
          </a>
          <p>
            No result is not no restriction. Use a saved Property’s Planning
            Inspector for source queries and coverage.
          </p>
        </div>
      ) : null}
    </section>
  );
}
