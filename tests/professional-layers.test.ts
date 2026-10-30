import test from "node:test";
import assert from "node:assert/strict";
import { LAYER_PRODUCTS, layerProduct } from "../src/lib/layers/products";
import { percentage, statistic } from "../src/lib/layers/statistics";
import {
  viewportInput,
  productOptions,
  featureQueryUrl,
  queryProduct,
} from "../src/lib/layers/query";
import {
  formatIndicator,
  thematicColor,
  legendRanges,
} from "../src/lib/layers/style";
import { catalogueCategory } from "../src/lib/layers/types";
import { installOfficialRasters } from "../src/lib/map/maplibre-official";
import type { Map } from "maplibre-gl";

test("population matches independent ABS published western-growth figures and retains exact reference years", () => {
  const p = layerProduct("abs-population-growth")!;
  assert.equal(statistic(p, "213041359", "2025", "population").value, 35856);
  assert.equal(statistic(p, "213041359", "2025", "annual_change").value, 4602);
  assert.equal(statistic(p, "211041273", "2025", "population").value, 12250);
  const ten = statistic(p, "211041273", "2025", "ten_year_growth");
  assert.equal(ten.comparison, "30 June 2015");
  assert.equal(statistic(p, "nonexistent", "2025", "population").value, null);
  assert.equal(percentage(0, 10), -100);
  assert.equal(percentage(10, 0), null);
  assert.equal(percentage(null, 10), null);
});
test("VGV annual LGA values retain house/unit/land medians and sales volumes from original workbook", () => {
  const p = layerProduct("vic-median-prices")!;
  assert.equal(statistic(p, "26980", "2025", "house").value, 1425000);
  assert.equal(statistic(p, "26980", "2025", "unit").value, 765000);
  assert.equal(statistic(p, "26980", "2025", "land").value, 1290000);
  assert.equal(statistic(p, "24650", "2025", "house").value, 642000);
  assert.equal(statistic(p, "26980", "2025", "house_sales").value, 1787);
  assert.equal(
    statistic(p, "26980", "2025", "house").reference,
    "Calendar year 2025",
  );
  assert.throws(() => productOptions(p, { period: "2026" }));
});
test("SEIFA retains national deciles and Census reference year; approvals retain complete FY and avoid counting component rows twice", () => {
  const seifa = layerProduct("abs-seifa")!,
    approvals = layerProduct("abs-building-approvals")!;
  assert.equal(statistic(seifa, "211041273", "2021", "irsad").value, 1073);
  assert.equal(statistic(seifa, "211041273", "2021", "ier_decile").value, 9);
  assert.equal(
    statistic(seifa, "211041273", "2021", "irsad").reference,
    "Census 2021",
  );
  assert.equal(
    statistic(approvals, "211041273", "2025-26", "new_dwellings").value,
    25,
  );
  assert.equal(
    statistic(approvals, "213041359", "2025-26", "new_dwellings").value,
    1682,
  );
  assert.equal(
    statistic(approvals, "211041273", "2025-26", "per_1000").value,
    (25 / 12250) * 1000,
  );
});
test("school points preserve original government attributes and only return the requested viewport", async () => {
  const p = layerProduct("vic-schools")!;
  const result = await queryProduct(p, {
    bbox: [145.15, -37.88, 145.21, -37.84],
    zoom: 14,
  });
  assert(
    result.collection.features.some(
      (f) => f.properties?.School_Name === "Livingstone Primary School",
    ),
  );
  assert(result.collection.features.every((f) => f.geometry.type === "Point"));
});
test("CSA offences are not incidents; published rate and subgroup aggregates match original LGA workbook", () => {
  const p = layerProduct("vic-recorded-offences")!;
  assert.equal(statistic(p, "26980", "2026", "offences").value, 11698);
  assert.equal(statistic(p, "26980", "2026", "rate").value, 6295.745205941);
  assert.equal(statistic(p, "26980", "2026", "burglary").value, 983);
  assert.equal(statistic(p, "24650", "2026", "motor_theft").value, 922);
  assert.equal(
    statistic(p, "26980", "2026", "offences").reference,
    "Year ending 30 June 2026",
  );
});
test("only bounded reviewed sources and genuine statistical periods can be queried", () => {
  const p = layerProduct("vic-median-prices")!;
  assert.throws(() =>
    viewportInput.parse({ bbox: [140, -39, 180, -20], zoom: 4 }),
  );
  assert.throws(() =>
    viewportInput.parse({ bbox: [145, -38, 144, -37], zoom: 12 }),
  );
  assert.throws(() => productOptions(p, { indicator: "arbitrary_sql" }));
  const input = {
    bbox: [145, -38, 146, -37] as [number, number, number, number],
    zoom: 12,
  };
  const url = new URL(featureQueryUrl(p, input));
  assert.equal(url.hostname, "geo.abs.gov.au");
  assert.equal(url.searchParams.get("resultRecordCount"), "250");
  assert.equal(url.searchParams.get("where"), "STATE_CODE_2021='2'");
  assert.throws(() => featureQueryUrl(p, { ...input, zoom: 2 }));
  assert.throws(() => featureQueryUrl(p, { ...input, point: [153, -28] }));
});
test("missing values differ from genuine zero and legends cover stable class boundaries", () => {
  assert.equal(formatIndicator(null), "No data");
  assert.equal(formatIndicator(0, "count"), "0");
  assert.equal(formatIndicator(1000, "aud"), "$1,000");
  const indicator = layerProduct("abs-population-growth")!.dataset_metadata
    .indicators![0];
  assert.equal(legendRanges(indicator).length, 6);
  assert.equal(thematicColor(indicator)[0], "case");
  assert.equal(
    catalogueCategory("Property", "NSW cadastral parcels"),
    "Cadastre & Land",
  );
});
test("catalogue enriches existing BMO/heritage IDs without duplicating them and distinguishes UGB/BPA", () => {
  assert.equal(
    new Set(LAYER_PRODUCTS.map((p) => p.id)).size,
    LAYER_PRODUCTS.length,
  );
  assert.equal(layerProduct("vic-ugb")!.query.geometry, "line");
  assert.notEqual(
    layerProduct("vic-bpa")!.service_url,
    layerProduct("vic-bushfire")!.service_url,
  );
  assert.equal(layerProduct("vic-vpa-precincts")!.query.name, "PSP_NAME");
});
test("public raster renderer never treats authenticated GeoJSON features as raster tiles", () => {
  let added = 0;
  installOfficialRasters(
    { addSource: () => added++, addLayer: () => added++ } as unknown as Map,
    [{ ...layerProduct("abs-population-growth")!, opacity: 0.6 }],
  );
  assert.equal(added, 0);
});
test("provider errors and transfer limits stay explicit; unknown statistical codes do not become zeros", async () => {
  const p = layerProduct("vic-median-prices")!,
    input = {
      bbox: [145, -38, 146, -37] as [number, number, number, number],
      zoom: 12,
    };
  const result = await queryProduct(p, input, async () =>
    Response.json({
      type: "FeatureCollection",
      exceededTransferLimit: true,
      features: [
        {
          type: "Feature",
          properties: { LGA_CODE_2025: "99999", LGA_NAME_2025: "Unknown" },
          geometry: null,
        },
      ],
    }),
  );
  assert.equal(result.partial, true);
  assert.equal(result.collection.features[0].properties?.value, null);
  await assert.rejects(() =>
    queryProduct(p, input, async () =>
      Response.json({ error: { message: "Provider failure" } }),
    ),
  );
  await assert.rejects(() =>
    queryProduct(p, input, async () => new Response("", { status: 503 })),
  );
});
