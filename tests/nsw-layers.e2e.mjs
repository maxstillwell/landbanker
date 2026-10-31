// Real disposable Auth/RLS/preferences and imported official observations.
// Geometry is an explicit workflow fixture; live ABS joins have separate checks.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import { expect } from "@playwright/test";
import { chromium } from "./map-browser.mjs";
import { layerProduct } from "../src/lib/layers/products.ts";
import { statistic } from "../src/lib/layers/statistics.ts";
const origin = process.env.E2E_APP_URL || "http://localhost:3000";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
assert.match(
  await readFile(".env.local", "utf8"),
  /^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:54321$/m,
);
const ids = ["nsw-median-sales", "nsw-median-rent", "nsw-recorded-incidents"];
function stage(enabled) {
  execFileSync("docker", [
    "exec",
    "land-banker-local-db-1",
    "psql",
    "-h",
    "127.0.0.1",
    "-U",
    "postgres",
    "-d",
    "landbanker",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `UPDATE public.layer_catalog SET enabled=${enabled} WHERE id IN ('${ids.join("','")}')`,
  ]);
}
stage(true);
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let requests = 0;
  for (const id of ids)
    await page.route(`**/api/layer-library/${id}/features?**`, (route) => {
      requests++;
      const product = layerProduct(id),
        p = new URL(route.request().url()).searchParams;
      const indicator =
        p.get("indicator") || product.dataset_metadata.default_indicator;
      const s = statistic(
        product,
        "14850",
        p.get("period") || product.dataset_metadata.default_period,
        indicator,
      );
      return route.fulfill({
        json: {
          partial: false,
          collection: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                id: `${id}:14850`,
                properties: {
                  layerId: id,
                  areaCode: "14850",
                  areaName: "Lismore (workflow geometry fixture)",
                  indicator,
                  value: s.value,
                  statistics: s.fields,
                  reference: s.reference,
                  comparison: s.comparison,
                },
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [140, -40],
                      [155, -40],
                      [155, -25],
                      [140, -25],
                      [140, -40],
                    ],
                  ],
                },
              },
            ],
          },
        },
      });
    });
  await page.goto(origin + "/signup");
  await page.getByLabel("Your name").fill("Local NSW acceptance");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`nsw-${Date.now()}@landbanker.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("NswLocalWorkflow!42");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL("**/app/map");
  await page.locator(".maplibregl-canvas").waitFor();
  assert.equal(requests, 0);
  const region = page.getByRole("region", { name: "Official area statistics" });
  for (const [index, id] of ids.entries()) {
    const product = layerProduct(id),
      name = product.name;
    await page.getByRole("button", { name: "Layers", exact: true }).click();
    await page.getByRole("tab", { name: "Catalogue", exact: true }).click();
    await page
      .locator(".catalog-result")
      .filter({ hasText: name })
      .getByRole("button", { name: "Add", exact: true })
      .click();
    await page.getByRole("tab", { name: /Added to Map/ }).click();
    const card = page.locator(".active-layer").filter({ hasText: name });
    await expect(card).toContainText("Ready");
    if (index < 2)
      await expect(page.getByLabel(`${name} period`)).toContainText(
        index === 0 ? "March quarter 2026" : "June quarter 2026",
      );
    await page
      .getByRole("button", { name: "Close library", exact: true })
      .click();
    await expect
      .poll(async () => {
        await page.mouse.click(700, 400);
        return region.count();
      })
      .toBe(1);
    await expect(region).toContainText("14850");
    await expect(region).toContainText(["$680,000", "$550", "185"][index]);
    await expect(region).toContainText(
      ["March quarter 2026", "June quarter 2026", "Year ending 30 June 2026"][
        index
      ],
    );
    const choose = async (indicator) => {
      await page.getByRole("button", { name: "Layers", exact: true }).click();
      await page.getByLabel(`${name} indicator`).selectOption(indicator);
      await page
        .getByRole("button", { name: "Close library", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Open Inspector", exact: true })
        .click();
    };
    if (index === 0) {
      await choose("median_non_strata");
      await expect(region).toContainText("$685,000");
      await expect(region).toContainText("Non Strata");
      await choose("annual_change");
      await expect(region.locator("strong")).toContainText("9.2%");
      await expect(region).toContainText("compared with March quarter 2025");
    } else if (index === 1) {
      await choose("median_house_3");
      await expect(region).toContainText("$630");
      await expect(region).toContainText("House / 3 Bedrooms");
      await choose("quarterly_change");
      await expect(region.locator("strong")).toContainText("0%");
      await expect(region).toContainText("compared with March quarter 2026");
      await expect(region).toContainText("not advertised asking rents");
    } else {
      await page.getByRole("button", { name: "Layers", exact: true }).click();
      await page.getByLabel(`${name} year`).selectOption("2017");
      await page
        .getByRole("button", { name: "Close library", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Open Inspector", exact: true })
        .click();
      await expect(region).toContainText("Year ending 30 June 2017");
      await expect(region).toContainText("191");
      await choose("motor_vehicle_theft");
      await expect(region.locator("strong")).toContainText("90");
      await page.setViewportSize({ width: 390, height: 844 });
      // Entering the phone layout intentionally collapses the existing sheet.
      await page.getByRole("button", {name:"Open Inspector",exact:true}).click();
      await expect(region).toBeVisible();
      await expect(region).toContainText("14850");
      await expect(region).toContainText("Year ending 30 June 2017");
      await expect(region.locator("strong")).toContainText("90");
    }
    await expect(
      region.getByRole("link", {
        name: product.dataset_metadata.licence,
        exact: true,
      }),
    ).toHaveAttribute("href", product.dataset_metadata.licence_url);
    await region
      .getByText("Methodology and geographic limits", { exact: true })
      .click();
    await expect(region).toContainText("current", { ignoreCase: true });
    await region
      .getByText("Methodology and geographic limits", { exact: true })
      .click();
    await mkdir("artifacts", { recursive: true });
    await page.screenshot({ path: `artifacts/nsw-${id}-inspector.png` });
    await page.getByRole("button", { name: "Layers", exact: true }).click();
    await card.getByRole("checkbox").uncheck();
    await page.getByRole("button", { name: "Close library", exact: true }).click();
    const before = requests;
    const panX = page.viewportSize().width * 0.6;
    await page.mouse.move(panX, 180);
    await page.mouse.down();
    await page.mouse.move(panX + 40, 210, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(700);
    assert.equal(
      requests,
      before,
      "Disabled NSW product makes no viewport requests",
    );
    await page.getByRole("button", { name: "Layers", exact: true }).click();
    await card.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(card).toHaveCount(0);
    await page
      .getByRole("button", { name: "Close library", exact: true })
      .click();
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: NSW aggregate sales/rent/incidents, original quarters, category/year changes, actual values, zero change, attribution and opt-in desktop/mobile workflow; fixture geometry.",
  );
} catch (error) {
  await mkdir("artifacts", { recursive: true });
  await (
    browser
      .contexts()[0]
      ?.pages()[0]
      ?.screenshot({ path: "artifacts/nsw-layers-failure.png" }) ||
    Promise.resolve()
  ).catch(() => {});
  throw error;
} finally {
  await browser.close();
  stage(false);
}
