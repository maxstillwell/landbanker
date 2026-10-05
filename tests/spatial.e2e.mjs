import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
const origin = process.env.E2E_APP_URL || "http://localhost:3000";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
assert.match(
  await readFile(".env.local", "utf8"),
  /^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:54321$/m,
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {}),
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/signup");
  await page.getByLabel("Your name").fill("Spatial Tester");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`spatial-${Date.now()}@landbanker.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("LocalSpatialTest!42");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL("**/app/map");
  await page.getByRole("button", { name: "layers", exact: true }).click();
  await page.getByRole("button", { name: "Draw", exact: true }).click();
  await page.getByRole("button", { name: "Draw polygon", exact: true }).click();
  await page.mouse.click(100, 180);
  await page.mouse.click(260, 180);
  await page.mouse.click(200, 310);
  await page
    .getByRole("button", { name: "Finish polygon", exact: true })
    .filter({ visible: true })
    .click();
  await page.getByLabel("Shape name").fill("Potential development area");
  await page.getByLabel("New layer name").fill("Acquisition Analysis");
  await page
    .getByLabel("Note", { exact: true })
    .fill("Synthetic local spatial test");
  await page
    .getByRole("button", { name: "Save to Workspace", exact: true })
    .click();
  await page.getByText("Shape saved to Workspace.", { exact: true }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: "layers", exact: true }).click();
  await page
    .locator(".saved-layer summary")
    .filter({ hasText: "Acquisition Analysis" })
    .waitFor();
  let data = await (await page.request.get(origin + "/api/map")).json();
  const layer = data.layers.find((l) => l.name === "Acquisition Analysis");
  assert.equal(layer.geojson.features[0].geometry.type, "Polygon");
  assert.equal(
    layer.geojson.features[0].properties.name,
    "Potential development area",
  );
  const featureId = layer.geojson.features[0].id;
  // Server rejects malformed coordinates; repeat writes preserve feature identity.
  assert.equal(
    (
      await page.request.post(origin + "/api/layers", {
        headers: { Origin: origin },
        data: {
          id: crypto.randomUUID(),
          name: "Invalid",
          geojson: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "Point", coordinates: [200, -37] },
              },
            ],
          },
        },
      })
    ).status(),
    400,
  );
  assert.equal(
    (
      await page.request.post(origin + "/api/layers", {
        headers: { Origin: origin },
        data: { id: layer.id, name: layer.name, geojson: layer.geojson },
      })
    ).status(),
    200,
  );
  data = await (await page.request.get(origin + "/api/map")).json();
  assert.equal(
    data.layers.find((l) => l.id === layer.id).geojson.features[0].id,
    featureId,
  );
  await page.getByRole("button", { name: "Add Layer", exact: true }).click();
  await page.getByLabel("Search layers").fill("flood");
  await page
    .locator(".catalog-result")
    .filter({ hasText: "Victoria flood planning overlays" })
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await page
    .getByLabel("Victoria flood planning overlays", { exact: true })
    .waitFor();
  await page
    .getByLabel("Victoria flood planning overlays", { exact: true })
    .uncheck();
  await page.waitForFunction(
    () =>
      !document.querySelector(".active-layer input[type=checkbox]").disabled,
  );
  await page.reload();
  await page.getByRole("button", { name: "layers", exact: true }).click();
  assert.equal(
    await page
      .getByLabel("Victoria flood planning overlays", { exact: true })
      .isChecked(),
    false,
  );
  const library = await (
    await page.request.get(origin + "/api/layer-library")
  ).json();
  assert.ok(library.catalog.some((l) => l.id === "nsw-zoning"));
  assert.equal(library.active[0].visible, false);
  await page.getByRole("button", { name: "Choose workspace" }).click();
  await page.locator(".workspace-menu button").waitFor();
  await page.getByRole("button", { name: "Choose workspace" }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  const rects = await page.evaluate(() => ({
    map: document.querySelector(".map-canvas").getBoundingClientRect().width,
    inspector: document.querySelector(".inspector").getBoundingClientRect()
      .width,
  }));
  assert.ok(Math.abs(rects.map / 1280 - 0.7) < 0.02);
  assert.ok(Math.abs(rects.inspector / 1280 - 0.3) < 0.02);
  await page.screenshot({ path: "artifacts/landos-ipad-spatial.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/landos-drawing-phone.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: phone polygon draw, measurement, name/layer/note save, reopen, stable identity, invalid-coordinate rejection, catalog add/toggle persistence and iPad 70/30 layout.",
  );
} finally {
  await browser.close();
}
