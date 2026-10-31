import test from "node:test";
import assert from "node:assert/strict";
import { layerProduct } from "../src/lib/layers/products";
import { statistic } from "../src/lib/layers/statistics";
import { featureQueryUrl, queryProduct } from "../src/lib/layers/query";
import crosswalk from "../src/lib/layers/data/vic-suburb-crosswalk.json";

test("VGV suburb medians match six original 2025 workbook rows, independently of LGA medians", () => {
  const product = layerProduct("vic-suburb-median-prices")!;
  for (const [code, house, unit] of [
    ["205410022", 1525000, 1010000],
    ["205409628", 1722000, 905500],
    ["205409674", 1618000, 1133000],
    ["205410187", 1699000, 547000],
    ["205408993", 825000, 594000],
    ["205409487", 525000, 400000],
  ] as const) {
    assert.equal(statistic(product, code, "2025", "house").value, house);
    assert.equal(statistic(product, code, "2025", "unit").value, unit);
  }
  assert.equal(statistic(product, "205410022", "2024", "house").value, 1485000);
  assert.equal(
    statistic(product, "205410022", "2025", "house_growth").value,
    (1525000 / 1485000 - 1) * 100,
  );
  assert.equal(statistic(product, "205410022", "2025", "land").value, null);
  assert.equal(
    statistic(product, "26980", "2025", "house").value,
    null,
    "an LGA code is not a suburb identity",
  );
});
test("zero-sales carried medians remain published evidence but never become current observations or growth", () => {
  const product = layerProduct("vic-suburb-median-prices")!;
  const carried = statistic(product, "205408326", "2020", "house");
  assert.equal(carried.value, null);
  assert.equal(carried.fields.house, null);
  assert.equal(carried.fields.house_published_carried_forward, 927500);
  assert.equal(carried.fields.house_source_marker, "*");
  assert.equal(
    statistic(product, "205408326", "2021", "house_growth").value,
    null,
  );
});
test("market neighbourhood names without a bounded identity stay unmatched; gazetted PFIs are explicit", () => {
  assert.equal(crosswalk.rows["VERMONT SOUTH"].pfi, "205410022");
  assert(crosswalk.unmatched.prices_house.includes("SYNDAL"));
  assert(crosswalk.unmatched.prices_house.includes("SANCTUARY LAKES"));
  assert.equal(crosswalk.boundary_count, 2973);
});
test("CSA suburb sums preserve source year and categories without synthetic rates or LGA redistribution", () => {
  const product = layerProduct("vic-suburb-recorded-offences")!;
  for (const [code, value] of [
    ["205410022", 693],
    ["205409628", 2870],
    ["205409674", 1847],
    ["205410187", 2530],
    ["205408993", 2706],
    ["205409487", 2082],
  ] as const)
    assert.equal(statistic(product, code, "2026", "offences").value, value);
  assert.equal(statistic(product, "205410022", "2026", "burglary").value, 46);
  assert.equal(
    statistic(product, "205410022", "2026", "motor_theft").value,
    49,
  );
  assert.equal(statistic(product, "205410022", "2026", "rate").value, null);
  assert.equal(statistic(product, "absent", "2026", "offences").value, null);
  assert.equal(
    statistic(product, "205410022", "2026", "offences").reference,
    "Year ending 30 June 2026",
  );
});
test("fixed WFS adapter uses longitude/latitude CRS84 and official code properties, with bounded count", async () => {
  const product = layerProduct("vic-suburb-median-prices")!;
  const input = {
    bbox: [145.15, -37.88, 145.21, -37.84] as [number, number, number, number],
    zoom: 14,
  };
  const url = new URL(featureQueryUrl(product, input));
  assert.equal(url.hostname, "opendata.maps.vic.gov.au");
  assert.equal(url.searchParams.get("count"), "250");
  assert.equal(
    url.searchParams.get("srsName"),
    "urn:ogc:def:crs:OGC:1.3:CRS84",
  );
  assert(url.searchParams.get("bbox")!.startsWith("145.15000,-37.88000"));
  const result = await queryProduct(product, input, async () =>
    Response.json({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: null,
          properties: { pfi: "205410022", locality_name: "VERMONT SOUTH" },
        },
      ],
    }),
  );
  assert.equal(result.collection.features[0].properties?.value, 1525000);
  assert.equal(result.collection.features[0].properties?.areaCode, "205410022");
});
