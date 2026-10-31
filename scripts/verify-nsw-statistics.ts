// Actual ABS polygons/official codes joined to independently checked original
// DCJ/BOCSAR observations. No customer data, credentials or production writes.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { layerProduct } from "../src/lib/layers/products";
import { queryProduct } from "../src/lib/layers/query";
const exec = promisify(execFile);
const pending = new Map<string, Promise<string>>();
const request: typeof fetch = async (url) => {
  const key = String(url);
  if (!pending.has(key))
    pending.set(
      key,
      exec(
        "curl",
        ["--fail", "--silent", "--show-error", "--max-time", "25", key],
        { maxBuffer: 4000000 },
      ).then((r) => r.stdout),
    );
  return new Response(await pending.get(key));
};
const products = [
  "nsw-median-sales",
  "nsw-median-rent",
  "nsw-recorded-incidents",
];
const areas = [
  {
    name: "Lismore",
    code: "14850",
    point: [153.28, -28.81],
    values: [680000, 550, 185],
  },
  {
    name: "Dunoon",
    code: "14850",
    point: [153.32, -28.68],
    values: [680000, 550, 185],
  },
  {
    name: "Sydney",
    code: "17200",
    point: [151.21, -33.87],
    values: [1075000, 900, 668],
  },
  {
    name: "Blacktown",
    code: "10750",
    point: [150.9, -33.77],
    values: [1056000, 670, 711],
  },
];
const results = [];
for (const area of areas)
  for (const [i, id] of products.entries()) {
    const [x, y] = area.point,
      started = performance.now();
    try {
      const r = await queryProduct(
        layerProduct(id)!,
        { bbox: [x - 0.005, y - 0.005, x + 0.005, y + 0.005], zoom: 14 },
        request,
      );
      const f = r.collection.features.find(
        (f) => f.properties?.areaCode === area.code,
      );
      assert(f, `${area.name}: expected official LGA code`);
      assert(f.geometry, "Actual ABS geometry required");
      assert.equal(f.properties?.value, area.values[i]);
      results.push({
        id,
        location: area.name,
        code: area.code,
        queryMode: "viewport",
        status: "pass",
        reference: f.properties?.reference,
        value: f.properties?.value,
        milliseconds: Math.round(performance.now() - started),
      });
    } catch (e) {
      results.push({
        id,
        location: area.name,
        status: "fail",
        error: String(e),
      });
    }
  }
for (const area of [
  areas[1],
  { name: "Gundagai", code: "12160", point: [148.1, -35.06] },
  { name: "Dubbo", code: "12390", point: [148.6, -32.25] },
])
  for (const id of products) {
    const [x, y] = area.point;
    try {
      const r = await queryProduct(
        layerProduct(id)!,
        {
          bbox: [x - 0.005, y - 0.005, x + 0.005, y + 0.005],
          zoom: 14,
          point: [x, y],
        },
        request,
      );
      const f = r.collection.features.find(
        (f) => f.properties?.areaCode === area.code,
      );
      assert(
        f,
        `${area.name}: actual point lookup and reviewed current LGA code required`,
      );
      if (area.name === "Dunoon")
        assert.equal(
          f.properties?.value,
          areas[1].values[products.indexOf(id)],
        );
      results.push({
        id,
        location: area.name,
        code: area.code,
        queryMode: "point",
        status: "pass",
        reference: f.properties?.reference,
        value: f.properties?.value,
      });
    } catch (e) {
      results.push({
        id,
        location: area.name,
        queryMode: "point",
        status: "fail",
        error: String(e),
      });
    }
  }
await mkdir("artifacts/professional-layers", { recursive: true });
await writeFile(
  "artifacts/professional-layers/nsw-live-verification.json",
  JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2) +
    "\n",
);
console.log(
  JSON.stringify(
    {
      total: results.length,
      passed: results.filter((r) => r.status === "pass").length,
      failed: results.filter((r) => r.status === "fail"),
    },
    null,
    2,
  ),
);
if (results.some((r) => r.status === "fail")) process.exitCode = 1;
