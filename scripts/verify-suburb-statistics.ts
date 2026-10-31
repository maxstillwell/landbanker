// Live official boundaries + independent published workbook values; no credentials.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
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
const areas = [
  {
    name: "VERMONT SOUTH",
    code: "205410022",
    point: [145.183, -37.858],
    house: 1525000,
    unit: 1010000,
    offences: 693,
  },
  {
    name: "GLEN WAVERLEY",
    code: "205409628",
    point: [145.165, -37.879],
    house: 1722000,
    unit: 905500,
    offences: 2870,
  },
  {
    name: "MOUNT WAVERLEY",
    code: "205409674",
    point: [145.129, -37.876],
    house: 1618000,
    unit: 1133000,
    offences: 1847,
  },
  {
    name: "BOX HILL",
    code: "205410187",
    point: [145.121, -37.819],
    house: 1699000,
    unit: 547000,
    offences: 2530,
  },
  {
    name: "POINT COOK",
    code: "205408993",
    point: [144.75, -37.904],
    house: 825000,
    unit: 594000,
    offences: 2706,
  },
  {
    name: "MELTON",
    code: "205409487",
    point: [144.583, -37.683],
    house: 525000,
    unit: 400000,
    offences: 2082,
  },
];
const results = [];
for (const area of areas) {
  const [x, y] = area.point;
  for (const id of [
    "vic-suburb-median-prices",
    "vic-suburb-recorded-offences",
  ]) {
    const started = performance.now();
    try {
      const r = await queryProduct(
        layerProduct(id)!,
        { bbox: [x - 0.004, y - 0.004, x + 0.004, y + 0.004], zoom: 14 },
        request,
      );
      const f = r.collection.features.find(
        (f) => f.properties?.areaCode === area.code,
      );
      assert(
        f,
        `${area.name}: official PFI not returned at representative location`,
      );
      assert.equal(f.properties?.areaName, area.name);
      if (id.includes("median")) {
        assert.equal(f.properties?.statistics.house, area.house);
        assert.equal(f.properties?.statistics.unit, area.unit);
      } else assert.equal(f.properties?.value, area.offences);
      assert(f.geometry, "real government geometry required");
      results.push({
        id,
        area: area.name,
        pfi: area.code,
        status: "pass",
        reference: f.properties?.reference,
        value: f.properties?.value,
        milliseconds: Math.round(performance.now() - started),
      });
    } catch (e) {
      results.push({ id, area: area.name, status: "fail", error: String(e) });
    }
  }
}
await mkdir("artifacts/professional-layers", { recursive: true });
await writeFile(
  "artifacts/professional-layers/suburb-live-verification.json",
  JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2),
);
console.log(JSON.stringify(results, null, 2));
if (results.some((r) => r.status === "fail")) process.exitCode = 1;
