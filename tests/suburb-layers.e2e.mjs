// Disposable real Auth/RLS/preferences, real imported observations, workflow
// geometry fixture. Exact government geometry/values are verified separately.
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
const ids = ["vic-suburb-median-prices", "vic-suburb-recorded-offences"];
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
  await page.route("**/api/layer-library/vic-suburb-*/features?**", (route) => {
    requests++;
    const url = new URL(route.request().url());
    const id = url.pathname.split("/")[3];
    const product = layerProduct(id),
      p = url.searchParams;
    const indicator =
      p.get("indicator") || product.dataset_metadata.default_indicator;
    const stats = statistic(
      product,
      "205410022",
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
              id: id + ":205410022",
              properties: {
                layerId: id,
                areaCode: "205410022",
                areaName: "VERMONT SOUTH (workflow geometry fixture)",
                indicator,
                value: stats.value,
                statistics: stats.fields,
                reference: stats.reference,
                comparison: stats.comparison,
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
  await page.getByLabel("Your name").fill("Local suburb acceptance");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`suburb-${Date.now()}@landbanker.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("SuburbLocalWorkflow!42");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL("**/app/map");
  await page.locator(".maplibregl-canvas").waitFor();
  assert.equal(requests, 0);
  const region = page.getByRole("region", { name: "Official area statistics" });
  for (const id of ids) {
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
    await page
      .getByRole("button", { name: "Close library", exact: true })
      .click();
    await expect
      .poll(async () => {
        await page.mouse.click(700, 400);
        return region.count();
      })
      .toBe(1);
    await expect(region).toContainText("205410022");
    await expect(region).toContainText("Gazetted suburb / bounded locality");
    await expect(region).toContainText(
      id.includes("median") ? "$1,525,000" : "693",
    );
    if (id.includes("median")) {
      await page.getByRole("button", { name: "Layers", exact: true }).click();
      await page.getByLabel(name + " year").selectOption("2024");
      await page
        .getByRole("button", { name: "Close library", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Open Inspector", exact: true })
        .click();
      await expect(region).toContainText("Calendar year 2024");
      await expect(region).toContainText("$1,485,000");
      await page.getByRole("button", { name: "Layers", exact: true }).click();
      await page.getByLabel(name + " indicator").selectOption("unit");
      await page
        .getByRole("button", { name: "Close library", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Open Inspector", exact: true })
        .click();
      await expect(region).toContainText("Median unit price: $970,000");
      await expect(region.getByRole("link",{name:"Creative Commons Attribution 4.0 International",exact:true})).toHaveAttribute("href","https://creativecommons.org/licenses/by/4.0/");
      await region.getByText("Methodology and geographic limits",{exact:true}).click();
      await expect(region).toContainText("zero sales");
      await expect(region).toContainText("205410022");
      await region.getByText("Methodology and geographic limits",{exact:true}).click();

      await mkdir("artifacts", { recursive: true });
      await page.screenshot({ path: "artifacts/suburb-inspector.png" });
    }
    await page.getByRole("button", { name: "Layers", exact: true }).click();
    await card.getByRole("checkbox").uncheck();
    await expect(card.getByRole("checkbox")).not.toBeChecked();
    const count = requests;
    await page.mouse.move(700, 400);
    await page.mouse.down();
    await page.mouse.move(750, 430, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(700);
    assert.equal(
      requests,
      count,
      "disabled suburb layer does not reload on movement",
    );
    await card.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(card).toHaveCount(0);
    await page
      .getByRole("button", { name: "Close library", exact: true })
      .click();
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: VIC suburb prices/crime add, real preferences, official PFI, actual medians/counts, selected area retained through year/indicator changes and Inspector, disabled network, remove; workflow geometry fixture.",
  );
} finally {
  await browser.close();
  stage(false);
}
