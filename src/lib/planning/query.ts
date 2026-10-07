import area from "@turf/area";
import type { Feature, Geometry } from "geojson";
import type { CatalogLayer } from "../map/catalog-types";
import { esriRingsGeometry } from "../map/esri-rings";
import { planningSources } from "./sources";
import { recordProviderHealth } from "../provider-health";
import {
  esriProperty,
  propertyGeometry,
  propertyIntersection,
} from "./geometry";
import type {
  PlanningControl,
  PlanningLayerResult,
  PropertyPlanning,
} from "./types";

type Fetcher = typeof fetch;
class ProviderFailure extends Error {
  constructor(public readonly unavailable: boolean) {
    super("Official planning query failed");
  }
}
async function queryFeatures(
  url: string,
  fields: string[],
  geometry: string,
  fetcher: Fetcher,
  signal: AbortSignal,
): Promise<Feature<Geometry>[]> {
  const response = await fetcher(url + "/query", {
    method: "POST",
    redirect: "error",
    cache: "no-store",
    signal,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      f: "json",
      where: "1=1",
      geometry,
      geometryType: "esriGeometryPolygon",
      inSR: "4326",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: fields.join(","),
      returnGeometry: "true",
      resultRecordCount: "201",
    }),
  });
  if (!response.ok)
    throw new ProviderFailure(
      response.status === 429 || response.status >= 500,
    );
  // Bound provider data before parsing; never log submitted private boundaries.
  const reader = response.body?.getReader();
  if (!reader) throw new ProviderFailure(false);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8_000_000) {
      await reader.cancel();
      throw new ProviderFailure(false);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (
    data.error ||
    !Array.isArray(data.features) ||
    data.exceededTransferLimit ||
    data.features.length > 200
  )
    throw new ProviderFailure(false);
  return data.features.map(
    (f: {
      attributes: Record<string, unknown>;
      geometry: { rings: unknown };
    }) => ({
      type: "Feature",
      properties: f.attributes,
      geometry: esriRingsGeometry(f.geometry?.rings),
    }),
  );
}
function text(value: unknown): string | null {
  return (typeof value === "string" || typeof value === "number") &&
    String(value).trim()
    ? String(value).slice(0, 300)
    : null;
}
function metadata(properties: Record<string, unknown>, fields: string[]) {
  return Object.fromEntries(
    fields.map((f) => [
      f,
      typeof properties[f] === "number"
        ? (properties[f] as number)
        : text(properties[f]),
    ]),
  ) as Record<string, string | number | null>;
}
export async function queryPropertyPlanning(
  property: { id: string; state?: string | null; geometry: unknown },
  catalog: CatalogLayer[],
  fetcher: Fetcher = fetch,
): Promise<PropertyPlanning> {
  const queried_at = new Date().toISOString();
  const result: PropertyPlanning = {
    property_id: property.id,
    queried_at,
    area_m2: null,
    status: "supported",
    layers: [],
  };
  if (!["VIC", "NSW"].includes(property.state || ""))
    return { ...result, status: "unsupported_location" };
  const shape = propertyGeometry(property.geometry);
  if (!shape) return { ...result, status: "geometry_unavailable" };
  result.area_m2 = area(shape);
  const candidates = catalog.filter(
    (l) => l.enabled && l.state === property.state && planningSources[l.id],
  );
  if (!candidates.length) return { ...result, status: "unsupported_location" };
  const geometry = JSON.stringify(esriProperty(shape));
  // At most three catalog sources at once, 20 seconds total per source.
  for (let start = 0; start < candidates.length; start += 3) {
    const batch = await Promise.all(
      candidates
        .slice(start, start + 3)
        .map(async (layer): Promise<PlanningLayerResult> => {
          const adapter = planningSources[layer.id];
          const started = performance.now();
          const base: PlanningLayerResult = {
            catalog_layer_id: layer.id,
            name: layer.name,
            category: layer.category,
            provider: layer.provider,
            source_url: layer.source_url,
            endpoint: adapter.service,
            attribution: layer.attribution,
            limitation: layer.usage_notes,
            update_info: layer.update_frequency,
            queried_at,
            status: "no_result",
            message: "No matching control returned by the official source.",
            controls: [],
          };
          try {
            const signal = AbortSignal.timeout(20000);
            let candidatesCount = 0;
            const controls: PlanningControl[] = [];
            for (const id of adapter.ids) {
              const features = await queryFeatures(
                `${adapter.service}/${id}`,
                adapter.fields,
                geometry,
                fetcher,
                signal,
              );
              candidatesCount += features.length;
              if (candidatesCount > 200) throw new ProviderFailure(false);
              for (const f of features) {
                const clipped = propertyIntersection(shape, f.geometry);
                if (!clipped) continue;
                const p = f.properties || {};
                const identity = text(p.OBJECTID);
                if (!identity) throw new ProviderFailure(false);
                const code = text(p.ZONE_CODE || p.SYM_CODE || p.LAY_CLASS);
                const name =
                  text(
                    p.ZONE_DESCRIPTION || p.PURPOSE || p.H_NAME || p.LAY_NAME,
                  ) ||
                  code ||
                  adapter.controlType;
                const value =
                  p.LOT_SIZE == null
                    ? null
                    : `${text(p.LOT_SIZE) || "Value not supplied"} ${text(p.UNITS) || "(units not supplied)"}`;
                controls.push({
                  property_id: property.id,
                  catalog_layer_id: layer.id,
                  source_feature_id: `${id}:${identity}`,
                  control_type: adapter.controlType,
                  control_name: name,
                  control_code: code,
                  value,
                  relation: "intersects_property",
                  ...clipped,
                  source_metadata: metadata(p, adapter.fields),
                  queried_at,
                });
              }
            }
            recordProviderHealth(
              layer.id,
              layer.provider,
              "healthy",
              performance.now() - started,
            );
            return controls.length
              ? {
                  ...base,
                  status: "matched",
                  message: "Official controls intersect this property.",
                  controls,
                }
              : candidatesCount
                ? {
                    ...base,
                    status: "no_intersection",
                    message:
                      "Returned official geometry does not intersect this property.",
                  }
                : base;
          } catch (error) {
            const unavailable =
              (error instanceof ProviderFailure && error.unavailable) ||
              (error instanceof Error &&
                ["TimeoutError", "AbortError", "TypeError"].includes(
                  error.name,
                ));
            recordProviderHealth(
              layer.id,
              layer.provider,
              unavailable ? "unavailable" : "failed",
              performance.now() - started,
            );
            return {
              ...base,
              status: unavailable ? "source_unavailable" : "request_failed",
              message: unavailable
                ? "Official source temporarily unavailable. Your saved LandOS data is unaffected."
                : "Official source could not provide a complete, valid result. Retry; no planning conclusion is available.",
            };
          }
        }),
    );
    result.layers.push(...batch);
  }
  return result;
}
