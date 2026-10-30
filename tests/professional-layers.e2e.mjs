// Real disposable Auth / RLS / catalogue preferences. Deterministic provider
// geometry is a browser-workflow fixture; real services are checked separately
// by verify:professional-layers. This test refuses production destinations.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import { expect } from "@playwright/test";
import { chromium } from "./map-browser.mjs";

const origin = process.env.E2E_APP_URL || "http://localhost:3000";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
assert.match(
  await readFile(".env.local", "utf8"),
  /^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:54321$/m,
);
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
  "UPDATE public.layer_catalog SET enabled=true WHERE id='abs-population-growth'",
]);
const published = JSON.parse(
  await readFile("src/lib/layers/data/population.json", "utf8"),
)["211041273"];
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let requests = 0;
  await page.route(
    "**/api/layer-library/abs-population-growth/features?**",
    (route) => {
      requests++;
      const p = new URL(route.request().url()).searchParams,
        year = Number(p.get("period") || 2025),
        indicator = p.get("indicator") || "annual_growth";
      const value = published.erp[year - 2001],
        previous = published.erp[year - 2002];
      return route.fulfill({
        json: {
          partial: false,
          collection: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                id: "abs-population-growth:211041273",
                properties: {
                  layerId: "abs-population-growth",
                  areaCode: "211041273",
                  areaName: "Vermont South (workflow geometry fixture)",
                  indicator,
                  value:
                    indicator === "population"
                      ? value
                      : (value / previous - 1) * 100,
                  statistics: { population: value },
                  reference: `30 June ${year}`,
                  comparison:
                    indicator === "population" ? null : `30 June ${year - 1}`,
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
    },
  );
  await page.goto(origin + "/signup");
  await page.getByLabel("Your name").fill("Official layer workflow tester");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`official-layers-${Date.now()}@landbanker.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("LocalLayerWorkflow!42");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL("**/app/map");
  await page.locator(".maplibregl-canvas").waitFor();
  assert.equal(requests, 0, "disabled products make no feature requests");
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByRole("tab", { name: "Catalogue", exact: true }).click();
  await page
    .locator(".catalog-result")
    .filter({ hasText: "ABS population growth · SA2" })
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await page.getByRole("tab", { name: /Added to Map/ }).click();
  const card = page
    .locator(".active-layer")
    .filter({ hasText: "ABS population growth · SA2" });
  await expect(card.getByRole("checkbox")).toBeChecked();
  await expect(card).toContainText("Ready");
  await page
    .getByLabel("ABS population growth · SA2 indicator")
    .selectOption("population");
  await page
    .getByLabel("ABS population growth · SA2 year")
    .selectOption("2024");
  await expect(card).toContainText("Ready");
  await page
    .getByLabel("ABS population growth · SA2 year")
    .selectOption("2025");
  await expect(card).toContainText("Ready");
  await expect(
    card.getByLabel("ABS population growth · SA2 opacity"),
  ).toHaveValue("0.65");
  await page
    .getByRole("button", { name: "Close library", exact: true })
    .click();
  await expect
    .poll(async () => {
      await page.mouse.click(700, 400);
      return page
        .getByRole("region", { name: "Official area statistics" })
        .count();
    })
    .toBe(1);
  await expect(
    page.getByRole("region", { name: "Official area statistics" }),
  ).toContainText("12,250");
  await expect(
    page.getByRole("region", { name: "Official area statistics" }),
  ).toContainText("211041273");
  await expect(
    page.getByRole("region", { name: "Official area statistics" }),
  ).toContainText("30 June 2025");
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/professional-layers-desktop.png" });
  await page
    .getByRole("button", { name: "Close official area", exact: true })
    .click();
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await card.getByRole("checkbox").uncheck();
  await expect(card.getByRole("checkbox")).not.toBeChecked();
  const count = requests;
  await page.mouse.move(700, 400);
  await page.mouse.down();
  await page.mouse.move(760, 440, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(700); // Exceeds the viewport debounce, proving no disabled-layer reload.
  assert.equal(requests, count);
  const actual = await (
    await page.request.get(origin + "/api/layer-library")
  ).json();
  assert.equal(
    actual.active.find((x) => x.catalog_id === "abs-population-growth").visible,
    false,
    "real preference persisted under RLS",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  assert(box.x >= 0 && box.width <= 390, "layer controls fit a phone viewport");
  await page.screenshot({ path: "artifacts/professional-layers-mobile.png" });
  await card.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(card).toHaveCount(0);
  assert.deepEqual(errors, [], "no browser runtime exceptions");
  console.log(
    "PASS: official catalogue add/toggle/remove, real scoped preferences, indicator/year, legend, area Inspector, disabled network and desktop/mobile workflow. Provider geometry is a deterministic fixture; live government data verified separately.",
  );
} finally {
  await browser.close();
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
    "UPDATE public.layer_catalog SET enabled=false WHERE id='abs-population-growth'",
  ]);
}
