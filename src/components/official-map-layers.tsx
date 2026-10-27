"use client";
import { useEffect, useState, useRef, type RefObject } from "react";
import type { Feature, FeatureCollection } from "geojson";
import { parcelFromOfficialFeature } from "@/lib/map/official-selection";
import type { OfficialParcel } from "@/lib/map/parcel-types";
import { ZONE_CATEGORIES } from "@/lib/map/zoning-style";
import { setSceneData, geometryBounds } from "@/lib/map/maplibre-scene";
import type {
  Map,
  GeoJSONSource,
  MapMouseEvent,
  ExpressionSpecification,
} from "maplibre-gl";
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
export function useOfficialMapLayers({
  map,
  revision,
  blocked,
  onPick,
  onParcel,
}: {
  map: RefObject<Map | null>;
  revision: number;
  blocked: boolean;
  onPick: () => void;
  onParcel: (parcel: OfficialParcel) => void;
}) {
  const [visible, setVisible] = useState<Record<string, boolean>>(
    Object.fromEntries(ids.map((id) => [id, true])),
  );
  const cache = useRef<Partial<Record<OfficialLayerId, FeatureCollection>>>({});
  const [mode, setMode] = useState<"parcel" | "zoning">("parcel");
  const [opacity, setOpacity] = useState(0.3);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<{
    id: OfficialLayerId;
    properties: Record<string, unknown>;
    feature: Feature;
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
            "fill-color": id.endsWith("zoning")
              ? ([
                  "match",
                  ["get", "zoneCategory"],
                  "residential",
                  ZONE_CATEGORIES.residential.color,
                  "commercial",
                  ZONE_CATEGORIES.commercial.color,
                  "industrial",
                  ZONE_CATEGORIES.industrial.color,
                  "rural",
                  ZONE_CATEGORIES.rural.color,
                  "conservation",
                  ZONE_CATEGORIES.conservation.color,
                  "special",
                  ZONE_CATEGORIES.special.color,
                  ZONE_CATEGORIES.unknown.color,
                ] as ExpressionSpecification)
              : layer.color,
            "fill-opacity": id.endsWith("zoning") ? 0.3 : layer.fillOpacity,
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
            cache.current[id] = result.collection;
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
      if (workspace.length || blocked) return;
      const hits = m!.queryRenderedFeatures(event.point, {
        layers: ids
          .filter((id) => mode !== "zoning" || id.endsWith("zoning"))
          .map((id) => `official-${id}-fill`),
      });
      const hit =
        mode === "parcel"
          ? hits.find((f) =>
              String(f.properties?.officialLayerId).endsWith("parcels"),
            ) || hits[0]
          : hits[0];
      const id = hit?.properties?.officialLayerId as
        OfficialLayerId | undefined;
      if (!id || !OFFICIAL_MAP_LAYERS[id]) return;
      // queryRenderedFeatures geometries may be clipped to tiles. Resolve the
      // provider's full query feature by stable identity before inspecting/fitting.
      const feature = cache.current[id]?.features.find(
        (f) => String(f.id) === String(hit.properties?.officialFeatureKey),
      );
      if (!feature) return;
      if (id.endsWith("parcels")) {
        const parcel = parcelFromOfficialFeature(
          OFFICIAL_MAP_LAYERS[id],
          feature,
        );
        if (parcel) {
          setSelected(null);
          onParcel(parcel);
          return;
        }
      }
      setSelected({ id, properties: feature.properties || {}, feature });
      onPick();
    }
    let hovered = "";
    function hover(event: MapMouseEvent) {
      if (blocked) return;
      const hit = m!.queryRenderedFeatures(event.point, {
        layers: ids
          .filter((id) => id.endsWith("zoning"))
          .map((id) => `official-${id}-fill`),
      })[0];
      const key = String(hit?.properties?.officialFeatureKey || "");
      if (key === hovered) return;
      hovered = key;
      const id = hit?.properties?.officialLayerId as
        OfficialLayerId | undefined;
      const feature = id
        ? cache.current[id]?.features.find((f) => String(f.id) === key)
        : undefined;
      setSceneData(m!, "hover", feature ? [feature] : []);
      m!.getCanvas().style.cursor = feature ? "pointer" : "";
    }
    function leave() {
      hovered = "";
      setSceneData(m!, "hover", []);
      m!.getCanvas().style.cursor = "";
    }
    m.on("mousemove", hover);
    m.getCanvas().addEventListener("mouseleave", leave);
    m.on("moveend", schedule);
    m.on("click", select);
    schedule();
    return () => {
      clearTimeout(timer);
      controller?.abort();
      m.off("moveend", schedule);
      m.off("click", select);
      m.off("mousemove", hover);
      m.getCanvas().removeEventListener("mouseleave", leave);
    };
  }, [map, revision, visible, blocked, onPick, onParcel, mode]);
  useEffect(() => {
    setSceneData(
      map.current,
      "zoning-selection",
      selected ? [selected.feature] : [],
    );
  }, [map, selected, revision]);
  useEffect(() => {
    const m = map.current;
    for (const id of ids.filter((id) => id.endsWith("zoning")))
      if (m?.getLayer(`official-${id}-fill`))
        m.setPaintProperty(`official-${id}-fill`, "fill-opacity", opacity);
  }, [map, revision, opacity]);
  return {
    visible,
    setVisible,
    status,
    selected,
    setSelected,
    mode,
    setMode,
    opacity,
    setOpacity,
    fit: () => {
      if (selected)
        map.current?.fitBounds(geometryBounds(selected.feature), {
          padding: 60,
          maxZoom: 18,
        });
    },
  };
}
export function OfficialMapLayers({
  controller,
}: {
  controller: ReturnType<typeof useOfficialMapLayers>;
}) {
  const {
    visible,
    setVisible,
    status,
    selected,
    setSelected,
    mode,
    setMode,
    opacity,
    setOpacity,
    fit,
  } = controller;
  return (
    <section aria-label="Official layers" className="maplibre-official-layers">
      <strong>Official parcels and zones</strong>
      <div role="group" aria-label="Official inspection mode">
        <button
          aria-pressed={mode === "parcel"}
          onClick={() => setMode("parcel")}
        >
          Inspect parcels
        </button>
        <button
          aria-pressed={mode === "zoning"}
          onClick={() => setMode("zoning")}
        >
          Inspect zoning
        </button>
      </div>
      <label>
        Zoning fill opacity
        <input
          aria-label="Zoning fill opacity"
          type="range"
          min="0"
          max="0.7"
          step="0.05"
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
        />
      </label>
      <div className="zoning-legend" aria-label="Zoning colour legend">
        {Object.entries(ZONE_CATEGORIES).map(([id, value]) => (
          <span key={id}>
            <i style={{ background: value.color }} />
            {value.label}
          </span>
        ))}
      </div>
      <small>
        Visual groups for orientation only. Official zone codes and planning
        instruments determine legal meaning.
      </small>
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
          <strong>
            {selected.id.endsWith("parcels")
              ? "Parcel details"
              : "Zoning details"}{" "}
            · {OFFICIAL_MAP_LAYERS[selected.id].label}
          </strong>
          <button onClick={fit}>
            {selected.id.endsWith("parcels")
              ? "Fit to Parcel"
              : "Fit selected zone"}
          </button>
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
