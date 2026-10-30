import type { FeatureCollection } from "geojson";
import { z } from "zod";
import type { LayerProduct } from "./types";
import { statistic } from "./statistics";
import schools from "./data/vic-schools.json";

export const viewportInput = z.object({
  bbox: z
    .tuple([
      z.number().min(-180).max(180),
      z.number().min(-85).max(85),
      z.number().min(-180).max(180),
      z.number().min(-85).max(85),
    ])
    .refine(
      (b) =>
        b[0] < b[2] && b[1] < b[3] && b[2] - b[0] <= 12 && b[3] - b[1] <= 12,
      "Zoom in to load this layer",
    ),
  zoom: z.number().min(0).max(24),
  period: z.string().max(10).optional(),
  indicator: z.string().max(40).optional(),
  point: z
    .tuple([z.number().min(-180).max(180), z.number().min(-85).max(85)])
    .optional(),
});
export type LayerViewport = z.infer<typeof viewportInput>;
export function productOptions(
  product: LayerProduct,
  input: Pick<LayerViewport, "period" | "indicator">,
) {
  const m = product.dataset_metadata;
  const period = input.period || m.default_period || "";
  const indicator = input.indicator || m.default_indicator || "";
  if (m.periods && !m.periods.includes(period))
    throw new Error("Unsupported reference period");
  if (m.indicators && !m.indicators.some((i) => i.id === indicator))
    throw new Error("Unsupported indicator");
  return { period, indicator };
}
export function featureQueryUrl(product: LayerProduct, input: LayerViewport) {
  if (input.zoom < product.min_zoom)
    throw new Error(`Zoom to ${product.min_zoom}+`);
  const point = input.point;
  if (
    point &&
    (point[0] < input.bbox[0] ||
      point[0] > input.bbox[2] ||
      point[1] < input.bbox[1] ||
      point[1] > input.bbox[3])
  )
    throw new Error("Point is outside the viewport");
  const params = new URLSearchParams({
    f: "geojson",
    where: product.query.where || "1=1",
    geometry: point
      ? point.join(",")
      : input.bbox.map((x) => x.toFixed(5)).join(","),
    geometryType: point ? "esriGeometryPoint" : "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: product.query.fields.join(","),
    returnGeometry: point ? "false" : "true",
    resultRecordCount: point ? "10" : "250",
    // Display-only generalisation; no area/coverage analysis uses this geometry.
    maxAllowableOffset: Math.max(
      0.00001,
      (input.bbox[2] - input.bbox[0]) / 1500,
    ).toFixed(6),
    geometryPrecision: "5",
    ...(point && product.query.geometry === "line"
      ? { distance: "30", units: "esriSRUnit_Meter" }
      : {}),
  });
  return `${product.query.url}/query?${params}`;
}
async function boundedJson(response: Response) {
  if (!response.ok) throw new Error("Official service temporarily unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty official service response");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4_000_000) {
        await reader.cancel();
        throw new Error("Official response too large; zoom in");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const c of chunks) {
    body.set(c, offset);
    offset += c.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}
export async function queryProduct(
  product: LayerProduct,
  input: LayerViewport,
  request: typeof fetch = fetch,
): Promise<{
  collection: FeatureCollection;
  partial: boolean;
  period: string;
  indicator: string;
}> {
  const options = productOptions(product, input);
  if (product.query.local_data === "vic-schools") {
    if (input.zoom < product.min_zoom)
      throw new Error(`Zoom to ${product.min_zoom}+`);
    const [west, south, east, north] = input.bbox;
    const matches = schools.filter((f) => {
      const [x, y] = f.geometry.coordinates;
      return x >= west && x <= east && y >= south && y <= north;
    });
    return {
      collection: {
        type: "FeatureCollection" as const,
        features: matches
          .slice(0, 250)
          .map((f) => ({
            ...f,
            type: "Feature" as const,
            id: `${product.id}:${f.properties.location_id}`,
            geometry: { ...f.geometry, type: "Point" as const },
            properties: {
              ...f.properties,
              layerId: product.id,
              areaCode: f.properties.location_id,
              areaName: f.properties.School_Name,
              value: null,
            },
          })),
      },
      partial: matches.length > 250,
      ...options,
    };
  }
  const url = featureQueryUrl(product, input);
  // Public government geometry only. No user geometry, credentials or private
  // workspace records ever enter this cache. Fixed URLs prevent an open proxy.
  const payload = await boundedJson(
    await request(url, {
      signal: AbortSignal.timeout(15000),
      redirect: "error",
      next: { revalidate: product.query.statistics ? 86400 : 3600 },
    }),
  );
  if (
    payload.error ||
    payload.type !== "FeatureCollection" ||
    !Array.isArray(payload.features)
  )
    throw new Error("Invalid official service response");
  const features = (payload as FeatureCollection).features
    .slice(0, input.point ? 10 : 250)
    .map((f) => {
      const source = f.properties || {};
      const code = String(source[product.query.code] ?? "");
      if (!code) throw new Error("Official geography code missing");
      const stats = product.query.statistics
        ? statistic(product, code, options.period, options.indicator)
        : null;
      const fields = Object.fromEntries(
        product.query.fields.map((k) => [k, source[k] ?? null]),
      );
      return {
        ...f,
        id: `${product.id}:${code}`,
        properties: {
          ...fields,
          layerId: product.id,
          areaCode: code,
          areaName: String(source[product.query.name] ?? code),
          value: stats?.value ?? null,
          ...(stats
            ? {
                statistics: stats.fields,
                reference: stats.reference,
                comparison: stats.comparison,
                indicator: options.indicator,
              }
            : {}),
        },
      };
    });
  return {
    collection: { type: "FeatureCollection" as const, features },
    partial:
      Boolean(payload.exceededTransferLimit) ||
      payload.features.length >= (input.point ? 10 : 250),
    ...options,
  };
}
