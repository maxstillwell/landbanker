import {
  openTools,
  openCustomLayers,
  openWorkspaceSettings,
  prepareDrawingSave,
  confirmDrawingSave,
} from "./workspace-browser.mjs";
import { expect } from "@playwright/test";
import { chromium } from "./map-browser.mjs";
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
  await openTools(page);
  await page
    .getByRole("button", { name: "Polygon / area", exact: true })
    .click();
  await page.mouse.click(100, 180);
  await page.mouse.click(260, 180);
  await page.mouse.click(200, 310);
  await expect(page.locator(".drawing-vertex")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Finish polygon", exact: true })
    .filter({ visible: true })
    .click();
  await prepareDrawingSave(page);
  await page.getByLabel("Shape name").fill("Potential development area");
  await page.getByLabel("New layer name").fill("Acquisition Analysis");
  await page
    .getByLabel("Notes", { exact: true })
    .fill("Synthetic local spatial test");
  await confirmDrawingSave(page);
  await page.getByText("Shape saved to Workspace.", { exact: true }).waitFor();
  await page.reload();
  if (await page.getByRole("button", { name: "Open Inspector" }).isVisible())
    await page.getByRole("button", { name: "Open Inspector" }).click();
  await openCustomLayers(page);
  await page
    .locator(".workspace-library details[open] > div > button:first-child")
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
  const offscreenId = crypto.randomUUID();
  const offscreen = {
    type: "Feature",
    id: offscreenId,
    properties: { name: "Off-screen fixture" },
    geometry: { type: "Point", coordinates: [150, -34] },
  };
  assert.equal(
    (
      await page.request.post(origin + "/api/layers", {
        headers: { Origin: origin },
        data: {
          id: layer.id,
          name: layer.name,
          geojson: {
            ...layer.geojson,
            features: [...layer.geojson.features, offscreen],
          },
        },
      })
    ).status(),
    200,
  );
  await page.reload();
  // The geometry itself is clickable, and editing loads the complete layer.
  if(await page.getByRole("button", {name:"Collapse Inspector"}).isVisible()) await page.getByRole("button", { name: "Collapse Inspector" }).click();
  await page.waitForTimeout(400);
  await page.mouse.click(185, 220);
  await expect(page.getByRole("button", { name: "Edit shape" })).toBeVisible();
  await page.getByRole("button", { name: "Edit shape" }).click();
  await expect(page.getByLabel("Drawing controls")).toBeVisible();
  const moveHandle = await page
    .getByRole("img", { name: "Move entire shape" })
    .boundingBox();
  await page.mouse.move(
    moveHandle.x + moveHandle.width / 2,
    moveHandle.y + moveHandle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    moveHandle.x + moveHandle.width / 2 + 12,
    moveHandle.y + moveHandle.height / 2 + 12,
    { steps: 5 },
  );
  await page.mouse.up();
  await page
    .getByLabel("Drawing controls")
    .getByRole("button", { name: "Finish polygon" })
    .click();
  await confirmDrawingSave(page);
  await expect(
    page.getByText("Shape saved to Workspace.", { exact: true }),
  ).toBeVisible();
  const completeAfterEdit = (
    await (await page.request.get(origin + "/api/layers?id=" + layer.id)).json()
  ).layer.geojson.features;
  const edited = completeAfterEdit.find((f) => f.id === featureId);
  assert.ok(completeAfterEdit.some((f) => f.id === offscreenId));
  assert.equal(edited.id, featureId);
  assert.notDeepEqual(edited.geometry, layer.geojson.features[0].geometry);
  assert.equal(
    (
      await page.request.post(origin + "/api/layers", {
        headers: { Origin: origin },
        data: { id: layer.id, name: layer.name, geojson: layer.geojson },
      })
    ).status(),
    200,
  );
  await page.reload();
  if (
    await page.getByRole("button", { name: "Collapse Inspector" }).isVisible()
  )
    if(await page.getByRole("button", {name:"Collapse Inspector"}).isVisible()) await page.getByRole("button", { name: "Collapse Inspector" }).click();
  await page.waitForTimeout(500);
  await page.mouse.click(185, 220);
  await expect(
    page.getByRole("button", { name: "Clear Selection" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear Selection" }).click();
  await expect(page.getByRole("button", { name: "Edit shape" })).toHaveCount(0);
  if(await page.getByRole("button", {name:"Collapse Inspector"}).isVisible()) await page.getByRole("button", { name: "Collapse Inspector" }).click();
  await page.waitForTimeout(400);
  await page.mouse.click(185, 220);
  await expect(
    page.getByRole("button", { name: "Delete shape" }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete shape" }).click();
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get(origin + "/api/layers?id=" + layer.id)
          ).json()
        ).layer.geojson.features.length,
    )
    .toBe(0);
  assert.equal(
    (
      await page.request.post(origin + "/api/layers", {
        headers: { Origin: origin },
        data: { id: layer.id, name: layer.name, geojson: layer.geojson },
      })
    ).status(),
    200,
  );
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
  if (
    (await page
      .getByRole("button", { name: "Layers", exact: true })
      .getAttribute("aria-pressed")) !== "true"
  )
    await page.getByRole("button", { name: "Layers", exact: true }).click();
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
  const initialLibrary = await (
    await page.request.get(origin + "/api/layer-library")
  ).json();
  const secondSource = initialLibrary.catalog.find(
    (l) => l.enabled && l.id !== initialLibrary.active[0].catalog_id,
  );
  assert.ok(secondSource);
  assert.equal(
    (
      await page.request.post(origin + "/api/layer-library", {
        headers: { Origin: origin },
        data: {
          id: secondSource.id,
          action: "save",
          opacity: 0.35,
          position: 1,
        },
      })
    ).status(),
    200,
  );
  await page.reload();
  if (
    (await page
      .getByRole("button", { name: "Layers", exact: true })
      .getAttribute("aria-pressed")) !== "true"
  )
    await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page
    .getByRole("button", { name: `${secondSource.name} move up`, exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get(origin + "/api/layer-library")).json())
          .active[0].catalog_id,
    )
    .toBe(secondSource.id);
  await page.reload();
  if (
    (await page
      .getByRole("button", { name: "Layers", exact: true })
      .getAttribute("aria-pressed")) !== "true"
  )
    await page.getByRole("button", { name: "Layers", exact: true }).click();
  assert.equal(
    await page
      .getByLabel(`${secondSource.name} opacity`, { exact: true })
      .inputValue(),
    "0.35",
  );
  const ordered = await (
    await page.request.get(origin + "/api/layer-library")
  ).json();
  assert.equal(ordered.active[0].catalog_id, secondSource.id);
  assert.equal(
    (
      await page.request.patch(origin + "/api/layer-library", {
        headers: { Origin: origin },
        data: { ids: [secondSource.id, secondSource.id] },
      })
    ).status(),
    400,
  );
  await page.reload();
  if (
    (await page
      .getByRole("button", { name: "Layers", exact: true })
      .getAttribute("aria-pressed")) !== "true"
  )
    await page.getByRole("button", { name: "Layers", exact: true }).click();
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
  assert.equal(
    library.active.find(
      (l) => l.catalog_id === initialLibrary.active[0].catalog_id,
    ).visible,
    false,
  );
  await openWorkspaceSettings(page);
  await page
    .getByRole("button", { name: "Choose workspace" })
    .filter({ visible: true })
    .click();
  await page.locator(".workspace-menu button").waitFor();
  await openWorkspaceSettings(page);
  await page
    .getByRole("button", { name: "Choose workspace" })
    .filter({ visible: true })
    .click();
  await page.setViewportSize({ width: 1280, height: 800 });
  const rects = await page.evaluate(() => ({
    map: document.querySelector(".map-canvas").getBoundingClientRect().width,
    inspector: document.querySelector(".inspector").getBoundingClientRect()
      .width,
  }));
  assert.ok(rects.map > 1200, "closed Inspector leaves the iPad map open");
  assert.ok(rects.inspector >= 280, "Inspector retains its usable width");
  await page.screenshot({ path: "artifacts/landos-ipad-spatial.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  const viewId = crypto.randomUUID();
  const savedView = await page.request.post(origin + "/api/views", {
    headers: { Origin: origin },
    data: {
      id: viewId,
      name: "Explicit spatial view",
      view: {
        latitude: -37.56,
        longitude: 143.85,
        zoom: 11,
        parcel_ids: [],
        layer_ids: [layer.id],
        official_layers: [],
      },
    },
  });
  assert.equal(savedView.status(), 200);
  const shared = await page.request.post(origin + "/api/shares", {
    headers: { Origin: origin },
    data: { resource_type: "saved_view", resource_ids: [viewId], days: 1 },
  });
  assert.equal(shared.status(), 200);
  const share = await shared.json(),
    token = new URL(share.url).pathname.split("/").at(-1);
  const anon = await browser.newContext(),
    publicPage = await anon.newPage();
  let publicResult = await publicPage.request.get(
    origin + "/api/published/" + token,
  );
  assert.equal(publicResult.status(), 200);
  let projection = await publicResult.json();
  assert.equal(projection.type, "view");
  assert.equal(projection.resources.length, 1);
  assert.ok(
    !JSON.stringify(projection).includes("Synthetic local spatial test"),
  );
  const later = {
    type: "Feature",
    id: crypto.randomUUID(),
    properties: { name: "Unshared future shape" },
    geometry: { type: "Point", coordinates: [144, -37] },
  };
  await page.request.post(origin + "/api/layers", {
    headers: { Origin: origin },
    data: {
      id: layer.id,
      name: layer.name,
      geojson: {
        ...layer.geojson,
        features: [...layer.geojson.features, later],
      },
    },
  });
  projection = await (
    await publicPage.request.get(origin + "/api/published/" + token)
  ).json();
  assert.equal(projection.resources[0].geojson.features.length, 1);
  assert.ok(!JSON.stringify(projection).includes("Unshared future shape"));
  await publicPage.goto(share.url);
  await publicPage
    .getByRole("heading", { name: "Explicit spatial view" })
    .waitFor();
  await publicPage.getByLabel("Read-only shared land map").waitFor();
  await publicPage.screenshot({ path: "artifacts/landos-public-view.png" });
  assert.equal(
    (
      await page.request.delete(origin + "/api/shares", {
        headers: { Origin: origin },
        data: { id: share.id },
      })
    ).status(),
    200,
  );
  assert.equal(
    (await publicPage.request.get(origin + "/api/published/" + token)).status(),
    404,
  );
  await anon.close();
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/landos-drawing-phone.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: phone polygon draw, measurement, name/layer/note save, reopen, stable identity, invalid-coordinate rejection, catalog add/toggle persistence, iPad adaptive layout, explicit shared view, private-note/future-feature exclusion and revoke.",
  );
} finally {
  await browser.close();
}
