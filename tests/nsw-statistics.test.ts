import assert from "node:assert/strict";
import test from "node:test";
import sales from "../src/lib/layers/data/nsw-sales.json";
import rent from "../src/lib/layers/data/nsw-rent.json";
import crime from "../src/lib/layers/data/nsw-crime.json";
import crosswalk from "../src/lib/layers/data/nsw-lga-crosswalk.json";
import { layerProduct } from "../src/lib/layers/products";
import { statistic } from "../src/lib/layers/statistics";
import { productOptions, featureQueryUrl } from "../src/lib/layers/query";

test("NSW aggregate market values match original Report 156 rows, units, bonds and quarters", () => {
  for (const [code, price, volume, weekly, bonds] of [
    ["14850", 680000, 233, 550, 204],
    ["17200", 1075000, 1164, 900, 6122],
    ["10750", 1056000, 1264, 670, 3055],
  ] as const) {
    assert.equal(sales[code]["2026Q1"].Total.median.value, price);
    assert.equal(sales[code]["2026Q1"].Total.sales.value, volume);
    assert.equal(rent[code]["2026Q2"]["Total / Total"].median.value, weekly);
    assert.equal(rent[code]["2026Q2"]["Total / Total"].new_bonds.value, bonds);
  }
  assert.equal(sales["14850"]["2026Q1"]["Non Strata"].median.value, 685000);
  assert.equal(sales["14850"]["2026Q1"].Strata.median.value, 620000);
  assert.equal(sales["14850"]["2026Q1"].Total.annual_change.value, 9.24);
  assert.equal(
    rent["14850"]["2026Q2"]["Total / Total"].annual_change.value,
    3.77,
  );
  assert.equal(
    rent["14850"]["2026Q2"]["Total / Total"].quarterly_change.value,
    0,
  );
  assert.equal(
    rent["14850"]["2026Q2"]["Total / Total"].total_bonds_held.value,
    3671,
  );
});

test("original NSW suppressions, absent geography and dwelling definitions are retained", () => {
  assert.deepEqual(sales["10600"]["2026Q1"].Strata.median, {
    value: null,
    source_marker: "-",
  });
  assert.equal(
    Object.hasOwn(sales, "10300"),
    false,
    "Balranald has no source sales row",
  );
  assert.deepEqual(rent["10300"]["2026Q2"]["Total / Total"].median, {
    value: null,
    source_marker: "-",
  });
  assert.equal(
    rent["10300"]["2026Q2"]["Total / Total"].total_bonds_held.value,
    100,
  );
  assert.deepEqual(Object.keys(sales["14850"]["2026Q1"]).sort(), [
    "Non Strata",
    "Strata",
    "Total",
  ]);
  assert.equal(Object.hasOwn(sales["14850"]["2026Q1"], "House"), false);
});

test("BOCSAR twelve-month sums match independent original monthly rows, preserving incident categories", () => {
  for (const [code, dwelling, vehicle, domestic] of [
    ["14850", 185, 122, 263],
    ["17200", 668, 675, 1204],
    ["10750", 711, 708, 2673],
  ] as const) {
    assert.equal(crime[code]["2026"].break_enter_dwelling, dwelling);
    assert.equal(crime[code]["2026"].motor_vehicle_theft, vehicle);
    assert.equal(crime[code]["2026"].domestic_violence_assault, domestic);
    assert.equal(Object.hasOwn(crime[code]["2026"], "rate"), false);
    assert.equal(Object.hasOwn(crime[code]["2026"], "offences"), false);
  }
});

test("reviewed NSW code transitions stay explicit and uncertain/special geographies remain unmapped", () => {
  const gundagai = crosswalk.dcj.find((r) => r.source_name === "Gundagai")!;
  assert.equal(gundagai.source_abs_code_2016, "13510");
  assert.equal(gundagai.code, "12160");
  const dubbo = crosswalk.dcj.find(
    (r) => r.source_name === "Western Plains Regional",
  )!;
  assert.equal(dubbo.source_abs_code_2016, "18230");
  assert.equal(dubbo.code, "12390");
  assert.equal(
    crosswalk.dcj.find((r) => r.source_name === "Armidale Regional")!.code,
    null,
  );
  assert.equal(
    crosswalk.dcj.find((r) => r.source_name === "Balranald")!.sales_source_row,
    false,
  );
  assert.deepEqual(
    crosswalk.bocsar
      .filter((r) => r.code === null)
      .map((r) => r.source_name)
      .sort(),
    ["In Custody", "Lord Howe Island", "Unincorporated Far West"],
  );
  assert.equal(Object.keys(sales).length, 126);
  assert.equal(Object.keys(rent).length, 127);
  assert.equal(Object.keys(crime).length, 128);
});

test("NSW runtime keeps original quarters, category medians, suppression and zero changes", () => {
  const price = layerProduct("nsw-median-sales")!;
  const weekly = layerProduct("nsw-median-rent")!;
  assert.equal(
    statistic(price, "14850", "2026Q1", "median_total").value,
    680000,
  );
  assert.equal(
    statistic(price, "14850", "2026Q1", "median_non_strata").value,
    685000,
  );
  const suppressed = statistic(price, "10600", "2026Q1", "median_strata");
  assert.equal(suppressed.value, null);
  assert.equal(suppressed.fields.median_price_aud_source_marker, "-");
  assert.equal(statistic(price, "10300", "2026Q1", "median_total").value, null);
  const change = statistic(weekly, "14850", "2026Q2", "quarterly_change");
  assert.equal(change.value, 0);
  assert.equal(change.reference, "June quarter 2026");
  assert.equal(change.comparison, "March quarter 2026");
  assert.equal(
    statistic(weekly, "14850", "2026Q2", "median_house_3").value,
    630,
  );
  assert.equal(statistic(weekly, "10300", "2026Q2", "median_all").value, null);
  assert.equal(
    statistic(weekly, "10300", "2026Q2", "total_bonds_held").value,
    100,
  );
  assert.equal(
    statistic(price, "14850", "2026Q1", "annual_change").comparison,
    "March quarter 2025",
  );
  assert.throws(
    () => productOptions(price, { period: "2026" }),
    /Unsupported reference period/,
  );
  assert.throws(
    () => productOptions(weekly, { period: "2026Q1" }),
    /Unsupported reference period/,
  );
  assert.equal(
    weekly.dataset_metadata.period_labels?.["2026Q2"],
    "June quarter 2026",
  );
});

test("NSW incident join uses exact official LGA codes and original annual categories", () => {
  const product = layerProduct("nsw-recorded-incidents")!;
  assert.equal(
    statistic(product, "14850", "2026", "break_enter_dwelling").value,
    185,
  );
  assert.equal(
    statistic(product, "14850", "2017", "break_enter_dwelling").value,
    191,
  );
  assert.equal(
    statistic(product, "14850", "2026", "domestic_violence_assault").value,
    263,
  );
  assert.equal(
    statistic(product, "99999", "2026", "break_enter_dwelling").value,
    null,
  );
  assert.throws(
    () => productOptions(product, { indicator: "rate" }),
    /Unsupported indicator/,
  );
  const url = new URL(
    featureQueryUrl(product, { bbox: [153.3, -28.7, 153.4, -28.6], zoom: 12 }),
  );
  assert.equal(url.searchParams.get("where"), "STATE_CODE_2021='1'");
  assert.equal(
    url.searchParams.get("outFields"),
    "LGA_CODE_2025,LGA_NAME_2025",
  );
});
