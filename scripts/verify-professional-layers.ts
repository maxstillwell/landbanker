// Live government-service acceptance. No credentials, database writes or mocks.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { LAYER_PRODUCTS } from "../src/lib/layers/products";
import { queryProduct } from "../src/lib/layers/query";
const exec = promisify(execFile);
const request: typeof fetch = async (url) => {
  const { stdout } = await exec(
    "curl",
    ["--fail", "--silent", "--show-error", "--max-time", "25", String(url)],
    { maxBuffer: 4_000_000 },
  );
  return new Response(stdout, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
const locations = [
  {
    name: "Vermont South",
    bbox: [145.15, -37.88, 145.21, -37.84] as [number, number, number, number],
  },
  {
    name: "Western growth areas",
    bbox: [144.55, -37.82, 144.7, -37.7] as [number, number, number, number],
  },
  {
    name: "Dunoon / Lismore",
    bbox: [153.2, -28.85, 153.35, -28.65] as [number, number, number, number],
  },
];
const results: object[] = [];
for (const location of locations) {
  const products = LAYER_PRODUCTS.filter(
    (p) =>
      p.state === "AU" ||
      (p.state === "NSW") === (location.name === "Dunoon / Lismore"),
  );
  for (let i = 0; i < products.length; i += 3) {
    await Promise.all(
      products.slice(i, i + 3).map(async (product) => {
        const started = performance.now();
        try {
          const result = await queryProduct(
            product,
            { bbox: location.bbox, zoom: 14 },
            request,
          );
          assert(
            result.collection.features.every((f) => f.properties?.areaCode),
          );
          if (product.query.statistics)
            assert(
              result.collection.features.some(
                (f) => typeof f.properties?.value === "number",
              ),
              "No numeric statistics at representative location",
            );
          results.push({
            id: product.id,
            location: location.name,
            status: "pass",
            features: result.collection.features.length,
            partial: result.partial,
            sample: result.collection.features
              .slice(0, 2)
              .map((f) => f.properties),
            milliseconds: Math.round(performance.now() - started),
          });
        } catch (e) {
          results.push({
            id: product.id,
            location: location.name,
            status: "fail",
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }),
    );
  }
}
// Cross-check the imported annual population against the live ABS fields,
// using the same official SA2 code, not a similarly named region.
const abs = LAYER_PRODUCTS.find((p) => p.id === "abs-population-growth")!;
try {
  const q = new URLSearchParams({
    f: "geojson",
    where: "sa2_name_2021='Rockbank - Mount Cottrell'",
    outFields: "sa2_code_2021,erp_2024,erp_2025",
    returnGeometry: "false",
  });
  const official = await (await request(`${abs.query.url}/query?${q}`)).json();
  const { statistic } = await import("../src/lib/layers/statistics");
  const p = official.features[0].properties;
  assert.equal(
    statistic(abs, String(p.sa2_code_2021), "2025", "population").value,
    p.erp_2025,
  );
  assert.equal(p.erp_2025, 35856);
  assert.equal(p.erp_2025 - p.erp_2024, 4602);
  results.push({
    id: "population-independent-crosscheck",
    status: "pass",
    official: p,
  });
} catch (e) {
  results.push({
    id: "population-independent-crosscheck",
    status: "fail",
    error: String(e),
  });
}
await mkdir("artifacts/professional-layers", { recursive: true });
await writeFile(
  "artifacts/professional-layers/live-verification.json",
  JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2),
);
console.log(
  JSON.stringify(
    results.map((r) => {
      const { sample: _sample, ...summary } = r as Record<string, unknown>;
      void _sample;
      return summary;
    }),
    null,
    2,
  ),
);
if (results.some((r) => (r as { status: string }).status === "fail"))
  process.exitCode = 1;
