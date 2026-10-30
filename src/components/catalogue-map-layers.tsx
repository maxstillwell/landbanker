"use client";
import { useEffect, useState, type RefObject } from "react";
import {
  Popup,
  type Map as LibreMap,
  type MapMouseEvent,
  type GeoJSONSource,
} from "maplibre-gl";
import type { Feature, FeatureCollection } from "geojson";
import type { ActiveLayer, CatalogLayer } from "@/lib/map/catalog-types";
import {
  formatIndicator,
  thematicColor,
  legendRanges,
  NO_DATA_COLOR,
} from "@/lib/layers/style";
import { timeoutFetch } from "@/lib/network";

export type LayerOptions = Record<
  string,
  { period: string; indicator: string }
>;
export type CatalogueSelection = { layer: CatalogLayer; feature: Feature };
const empty = (): FeatureCollection => ({
  type: "FeatureCollection",
  features: [],
});
export function useCatalogueMapLayers({
  map,
  revision,
  catalog,
  active,
  options,
  blocked,
  onPick,
}: {
  map: RefObject<LibreMap | null>;
  revision: number;
  catalog: CatalogLayer[];
  active: ActiveLayer[];
  options: LayerOptions;
  blocked: boolean;
  onPick: () => void;
}) {
  const [status, setStatus] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<CatalogueSelection | null>(null);
  useEffect(() => {
    const m = map.current;
    if (!m?.getSource("landos-parcels")) return;
    // Existing raster renderer owns planning tiles; this hook owns only new
    // GeoJSON sources plus click identification for reviewed catalogue products.
    const layers = active
      .filter((a) => a.visible)
      .map((a) => ({
        active: a,
        layer: catalog.find((c) => c.id === a.catalog_id && c.enabled),
      }))
      .filter(
        (x): x is { active: ActiveLayer; layer: CatalogLayer } =>
          !!x.layer?.dataset_metadata?.version,
      );
    const vector = [...layers]
      .filter((x) => x.layer.renderer === "geojson")
      .sort((a, b) => b.active.position - a.active.position);
    const owned: string[] = [];
    const collections = new Map<string, FeatureCollection>();
    let controller = new AbortController(),
      clickController = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let live = true;
    setSelected(null);
    for (const { layer, active: item } of vector) {
      const id = `catalogue-${layer.id}`;
      const meta = layer.dataset_metadata!;
      const indicator = meta.indicators?.find(
        (i) =>
          i.id === (options[layer.id]?.indicator || meta.default_indicator),
      );
      m.addSource(id, {
        type: "geojson",
        data: empty(),
        attribution: layer.attribution,
      });
      m.addLayer(
        {
          id: `${id}-fill`,
          type: "fill",
          source: id,
          minzoom: layer.min_zoom,
          paint: {
            "fill-color": indicator ? thematicColor(indicator) : "#7a9d86",
            "fill-opacity": item.opacity,
          },
        },
        "landos-parcels-fill",
      );
      m.addLayer(
        {
          id: `${id}-line`,
          type: "line",
          source: id,
          minzoom: layer.min_zoom,
          paint: {
            "line-color": "#53766e",
            "line-width": 1,
            "line-opacity": item.opacity,
          },
        },
        "landos-parcels-fill",
      );
      m.addLayer(
        {
          id: `${id}-point`,
          type: "circle",
          source: id,
          minzoom: layer.min_zoom,
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-color": "#dbb77a",
            "circle-radius": 5,
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 1,
            "circle-opacity": item.opacity,
          },
        },
        "landos-parcels-fill",
      );
      owned.push(id);
    }
    const bounds = () => {
      const b = m.getBounds();
      return [
        Math.max(-180, b.getWest()),
        Math.max(-85, b.getSouth()),
        Math.min(180, b.getEast()),
        Math.min(85, b.getNorth()),
      ];
    };
    async function request(
      layer: CatalogLayer,
      signal: AbortSignal,
      point?: [number, number],
    ) {
      const meta = layer.dataset_metadata!;
      const params = new URLSearchParams({
        bbox: bounds().join(","),
        zoom: String(m!.getZoom()),
        ...(meta.indicators
          ? {
              period: options[layer.id]?.period || meta.default_period!,
              indicator:
                options[layer.id]?.indicator || meta.default_indicator!,
            }
          : {}),
        ...(point ? { point: point.join(",") } : {}),
      });
      const response = await timeoutFetch(
        `/api/layer-library/${encodeURIComponent(layer.id)}/features?${params}`,
        { signal },
        20000,
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Official layer unavailable");
      return result as { collection: FeatureCollection; partial: boolean };
    }
    function load() {
      controller.abort();
      controller = new AbortController();
      const signal = controller.signal;
      for (const { layer } of layers.filter(
        (x) => x.layer.renderer === "arcgis_export",
      ))
        setStatus((s) => ({
          ...s,
          [layer.id]:
            m!.getZoom() < layer.min_zoom
              ? `Zoom to ${layer.min_zoom}+`
              : "Official planning mapping · click to inspect",
        }));
      for (const { layer } of vector) {
        const source = m!.getSource(`catalogue-${layer.id}`) as GeoJSONSource;
        source?.setData(empty());
        collections.delete(layer.id);
        if (m!.getZoom() < layer.min_zoom) {
          setStatus((s) => ({
            ...s,
            [layer.id]: `Zoom to ${layer.min_zoom}+`,
          }));
          continue;
        }
        const b = bounds();
        if (
          layer.state === "VIC" &&
          (b[0] > 150.1 || b[2] < 140.7 || b[1] > -33.8 || b[3] < -39.3)
        ) {
          setStatus((s) => ({ ...s, [layer.id]: "Outside Victoria" }));
          continue;
        }
        setStatus((s) => ({ ...s, [layer.id]: "Loading…" }));
        void request(layer, signal)
          .then((result) => {
            if (signal.aborted || !live) return;
            source?.setData(result.collection);
            collections.set(layer.id, result.collection);
            const count = result.collection.features.length,
              missing = result.collection.features.filter(
                (f) => f.properties?.value == null,
              ).length;
            setStatus((s) => ({
              ...s,
              [layer.id]: result.partial
                ? "Partial display — zoom in"
                : !count
                  ? "No mapped coverage here"
                  : layer.dataset_metadata?.indicators && missing === count
                    ? "No statistics for these areas / period"
                    : "Ready",
            }));
          })
          .catch((e) => {
            if (!signal.aborted && live)
              setStatus((s) => ({
                ...s,
                [layer.id]:
                  e instanceof Error ? e.message : "Service unavailable",
              }));
          });
      }
    }
    const popup = new Popup({ closeButton: false, closeOnClick: false });
    function schedule() {
      controller.abort();
      clearTimeout(timer);
      popup.remove();
      setSelected(null);
      timer = setTimeout(load, 300);
    }
    function workspaceHit(e: MapMouseEvent) {
      return (
        m!.queryRenderedFeatures(
          [
            [e.point.x - 10, e.point.y - 10],
            [e.point.x + 10, e.point.y + 10],
          ],
          {
            layers: [
              "landos-parcels-fill",
              "landos-parcels-point",
              "landos-features-fill",
              "landos-features-line",
              "landos-features-point",
              "landos-observations-point",
              "official-vic-parcels-fill",
              "official-nsw-parcels-fill",
              "official-vic-zoning-fill",
              "official-nsw-zoning-fill",
            ].filter((id) => !!m!.getLayer(id)),
          },
        ).length > 0
      );
    }
    function pick(e: MapMouseEvent) {
      if (blocked || workspaceHit(e)) return;
      const hits = m!.queryRenderedFeatures(e.point, {
        layers: owned.flatMap((id) => [`${id}-fill`, `${id}-point`]),
      });
      const hit = hits[0];
      if (hit) {
        const layer = layers.find(
          (x) => x.layer.id === hit.properties.layerId,
        )?.layer;
        const feature =
          layer &&
          collections
            .get(layer.id)
            // Vector-tile encoding can coerce GeoJSON string IDs to numbers.
            // The official code property survives tiling and identifies the
            // original, unclipped feature within this reviewed product.
            ?.features.find(
              (f) =>
                String(f.properties?.areaCode) ===
                String(hit.properties.areaCode),
            );
        if (layer && feature) {
          setSelected({ layer, feature });
          onPick();
          popup.remove();
        }
        return;
      }
      // Raster layers have no client geometry; identify the topmost applicable
      // official control at the click. At most four requests run concurrently.
      clickController.abort();
      clickController = new AbortController();
      const signal = clickController.signal;
      const raster = layers
        .filter(
          (x) =>
            x.layer.renderer === "arcgis_export" &&
            m!.getZoom() >= x.layer.min_zoom,
        )
        .sort((a, b) => a.active.position - b.active.position);
      void (async () => {
        for (let i = 0; i < raster.length; i += 4) {
          const results = await Promise.all(
            raster.slice(i, i + 4).map(async ({ layer }) => {
              try {
                const result = await request(layer, signal, [
                  e.lngLat.lng,
                  e.lngLat.lat,
                ]);
                return { layer, result };
              } catch {
                if (!signal.aborted && live)
                  setStatus((s) => ({
                    ...s,
                    [layer.id]: "Feature identification unavailable",
                  }));
                return null;
              }
            }),
          );
          if (signal.aborted || !live) return;
          const match = results.find(
            (x) => x?.result.collection.features.length,
          );
          if (match) {
            setSelected({
              layer: match.layer,
              feature: match.result.collection.features[0],
            });
            onPick();
            return;
          }
        }
      })();
    }
    function hover(e: MapMouseEvent) {
      if (blocked || !owned.length) {
        popup.remove();
        return;
      }
      const hit = m!.queryRenderedFeatures(e.point, {
        layers: owned.flatMap((id) => [`${id}-fill`, `${id}-point`]),
      })[0];
      const layer =
        hit && layers.find((x) => x.layer.id === hit.properties.layerId)?.layer;
      if (!hit || !layer) {
        popup.remove();
        return;
      }
      const meta = layer.dataset_metadata!,
        indicator = meta.indicators?.find(
          (i) =>
            i.id === (options[layer.id]?.indicator || meta.default_indicator),
        );
      popup
        .setLngLat(e.lngLat)
        .setText(
          `${hit.properties.areaName}${indicator ? ` · ${indicator.label}: ${formatIndicator(hit.properties.value, indicator.unit)} · ${hit.properties.reference}` : ""}`,
        )
        .addTo(m!);
    }
    const leave = () => popup.remove();
    const rasterFor = (sourceId?: string) =>
      layers.find(
        (x) =>
          x.layer.renderer === "arcgis_export" &&
          sourceId?.endsWith(`-${x.layer.id}`),
      )?.layer;
    const sourceLoading = (e: { sourceId?: string }) => {
      const layer = rasterFor(e.sourceId);
      if (layer)
        setStatus((s) => ({ ...s, [layer.id]: "Loading official mapping…" }));
    };
    const sourceReady = (e: {
      sourceId?: string;
      isSourceLoaded?: boolean;
    }) => {
      const layer = rasterFor(e.sourceId);
      if (layer && e.isSourceLoaded)
        setStatus((s) => ({ ...s, [layer.id]: "Ready · click to inspect" }));
    };
    const sourceError = (e: unknown) => {
      const layer = rasterFor(
        e && typeof e === "object" && "sourceId" in e
          ? String(e.sourceId)
          : undefined,
      );
      if (layer)
        setStatus((s) => ({
          ...s,
          [layer.id]: "Official map service unavailable",
        }));
    };
    m.on("sourcedataloading", sourceLoading);
    m.on("sourcedata", sourceReady);
    m.on("error", sourceError);
    m.on("moveend", schedule);
    m.on("click", pick);
    m.on("mousemove", hover);
    m.getCanvas().addEventListener("mouseleave", leave);
    schedule();
    return () => {
      live = false;
      clearTimeout(timer);
      controller.abort();
      clickController.abort();
      popup.remove();
      m.off("moveend", schedule);
      m.off("click", pick);
      m.off("mousemove", hover);
      m.getCanvas().removeEventListener("mouseleave", leave);
      m.off("sourcedataloading", sourceLoading);
      m.off("sourcedata", sourceReady);
      m.off("error", sourceError);
      for (const id of owned) {
        if (m.getLayer(`${id}-point`)) m.removeLayer(`${id}-point`);
        if (m.getLayer(`${id}-line`)) m.removeLayer(`${id}-line`);
        if (m.getLayer(`${id}-fill`)) m.removeLayer(`${id}-fill`);
        if (m.getSource(id)) m.removeSource(id);
      }
    };
  }, [map, revision, catalog, active, options, blocked, onPick]);
  return { status, selected, setSelected };
}
export function StatisticalLegend({
  layer,
  indicatorId,
}: {
  layer: CatalogLayer;
  indicatorId?: string;
}) {
  const meta = layer.dataset_metadata;
  const indicator = meta?.indicators?.find(
    (i) => i.id === (indicatorId || meta.default_indicator),
  );
  if (!indicator) return null;
  return (
    <div className="statistical-legend" aria-label={`${layer.name} legend`}>
      <strong>{indicator.label}</strong>
      {legendRanges(indicator).map((x) => (
        <div key={x.label}>
          <i style={{ background: x.color }} />
          {x.label}
        </div>
      ))}
      <div>
        <i style={{ background: NO_DATA_COLOR }} />
        No data
      </div>
    </div>
  );
}
export function CatalogueFeatureInspector({
  selection,
  onClose,
}: {
  selection: CatalogueSelection;
  onClose: () => void;
}) {
  const { layer, feature } = selection,
    meta = layer.dataset_metadata!,
    p = feature.properties || {};
  const indicator = meta.indicators?.find((i) => i.id === p.indicator);
  const values =
    typeof p.statistics === "string" ? JSON.parse(p.statistics) : p.statistics;
  return (
    <section aria-label="Official area statistics">
      <button onClick={onClose}>Close official area</button>
      <h3>{String(p.areaName)}</h3>
      <p>
        {meta.geography} · {String(p.areaCode)} · {meta.boundary_version}
      </p>
      {indicator ? (
        <>
          <strong>
            {indicator.label}: {formatIndicator(p.value, indicator.unit)}
          </strong>
          <p>
            {String(p.reference)}
            {p.comparison ? ` · compared with ${p.comparison}` : ""}
          </p>
        </>
      ) : null}
      <dl>
        {(values
          ? Object.entries(values)
          : meta.fields.map((k) => [k, p[k]])
        ).map(([key, value]) => {
          const metric = meta.indicators?.find((i) => i.id === key);
          return (
            <div key={key}>
              <dt>{metric?.label || key}</dt>
              <dd>
                {metric
                  ? formatIndicator(value, metric.unit)
                  : value == null
                    ? "Not supplied"
                    : /DATE/.test(key) && typeof value === "number"
                      ? new Date(value).toISOString().slice(0, 10)
                      : String(value)}
              </dd>
            </div>
          );
        })}
      </dl>
      <p>
        {layer.provider} · Updated: {meta.updated}
      </p>
      <p>{meta.methodology}</p>
      <p>{layer.attribution}</p>
      <a href={layer.source_url} target="_blank" rel="noreferrer">
        Original official source
      </a>
      {typeof p.WEB_URL === "string" &&
      /^https:\/\/(www\.)?vpa\.vic\.gov\.au\//.test(p.WEB_URL) ? (
        <p>
          <a href={p.WEB_URL} target="_blank" rel="noreferrer">
            VPA project page
          </a>
        </p>
      ) : null}
    </section>
  );
}
