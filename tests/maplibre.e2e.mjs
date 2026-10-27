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
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage(),
  errors = [],
  exports = [];
page.on("pageerror", (e) => errors.push(e.message));
const tile = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
await context.route("**/export?**", (route) => {
  exports.push(route.request());
  return route.fulfill({ contentType: "image/png", body: tile });
});
await context.route("**/query?**", (route) =>
  route.fulfill({
    json: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            ZONE_CODE: "SYNTHETIC-ZONE",
            ZONE_DESCRIPTION: "Synthetic workflow fixture",
          },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [142, -39],
                [146, -39],
                [146, -35],
                [142, -35],
                [142, -39],
              ],
            ],
          },
        },
      ],
    },
  }),
);
try {
  await page.goto(origin + "/signup");
  await page.getByLabel("Your name").fill("MapLibre integration");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`maplibre-${Date.now()}@landbanker.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("LocalMapLibreIntegration!42");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL("**/app/map");
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
  await expect(page.locator(".leaflet-container")).toHaveCount(0);
  const box = await page.locator(".map-canvas").boundingBox();
  assert(
    box.width > 900 && box.height === 1000,
    "MapLibre fills the map surface",
  );
  await page.getByRole("button", { name: "layers", exact: true }).click();
  const sources = page
    .getByRole("region", { name: "Official layers" })
    .or(page.getByLabel("Official layers", { exact: true }));
  await expect(sources).toContainText("Ready");
  // Official layers remain live while another Inspector tab is open.
  await page.getByRole("button", { name: "observations", exact: true }).click();
  await expect
    .poll(async () => {
      await page.mouse.click(450, 350);
      return page
        .getByRole("region", { name: "Official feature Inspector" })
        .count();
    })
    .toBe(1);
  await expect(
    page.getByRole("region", { name: "Official feature Inspector" }),
  ).toContainText("SYNTHETIC-ZONE");
  await page.getByRole("button", { name: "Close official feature" }).click();
  await page.getByRole("button", { name: "3D view", exact: true }).click();
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
  await page.getByRole("button", { name: "2D edit", exact: true }).click();
  await page.getByLabel("Basemap previews").click();
  await page.getByLabel("Basemap", { exact: true }).selectOption("dark");
  await page.getByLabel("Basemap previews").click();
  await page.mouse.move(450, 400);
  await page.mouse.down();
  await page.mouse.move(520, 440, { steps: 12 });
  await page.mouse.up();
  const camera = () =>
    page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) =>
        k.startsWith("landos:map-camera:v1:"),
      );
      return key ? JSON.parse(localStorage.getItem(key)) : null;
    });
  await expect.poll(async () => (await camera())?.basemap).toBe("dark");
  await page.waitForTimeout(1000); // Allow inertial pan to emit its final moveend.
  const savedCamera = await camera();
  await page.reload();
  await page.getByLabel("Basemap previews").click();
  await expect(page.getByLabel("Basemap", { exact: true })).toHaveValue("dark");
  await page.getByLabel("Basemap previews").click();
  await expect
    .poll(async () => (await camera())?.center)
    .toEqual(savedCamera.center);
  const library = await (
    await page.request.get(origin + "/api/layer-library")
  ).json();
  const source = library.catalog.find(
    (s) => s.enabled && s.state === "VIC" && s.renderer === "arcgis_export",
  );
  assert(source);
  const viewId = crypto.randomUUID();
  const view = {
    latitude: -37.5622,
    longitude: 143.8503,
    zoom: 14,
    parcel_ids: [],
    layer_ids: [],
    official_layers: [
      { catalog_id: source.id, visible: true, opacity: 0.35, position: 0 },
    ],
  };
  const headers = { Origin: origin };
  assert.equal(
    (
      await page.request.post(origin + "/api/views", {
        headers,
        data: { id: viewId, name: "Restored official view", view },
      })
    ).status(),
    200,
  );
  await page.reload();
  await page.getByRole("button", { name: "layers", exact: true }).click();
  await page
    .getByRole("button", { name: "Restored official view", exact: true })
    .click();
  await expect
    .poll(async () =>
      (
        await (await page.request.get(origin + "/api/layer-library")).json()
      ).active.some((s) => s.catalog_id === source.id && s.opacity === 0.35),
    )
    .toBe(true);
  await expect.poll(() => exports.length).toBeGreaterThan(0);
  const input = {
    resource_type: "saved_view",
    resource_ids: [viewId],
    days: 1,
  };
  const previewResponse = await page.request.post(origin + "/api/shares", {
    headers,
    data: { ...input, dry_run: true },
  });
  assert.equal(previewResponse.status(), 200);
  const preview = await previewResponse.json();
  const shareResponse = await page.request.post(origin + "/api/shares", {
    headers,
    data: { ...input, scope_hash: preview.scope_hash },
  });
  assert.equal(shareResponse.status(), 200);
  const share = await shareResponse.json();
  const visitor = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const officialRequests = [];
  await visitor.route("**/export?**", (route) => {
    officialRequests.push(route.request());
    return route.fulfill({ contentType: "image/png", body: tile });
  });
  const publicPage = await visitor.newPage();
  publicPage.on("pageerror", (e) => errors.push(e.message));
  await publicPage.goto(origin + new URL(share.url).pathname);
  await expect(publicPage.locator(".maplibregl-canvas")).toHaveCount(1);
  await expect.poll(() => officialRequests.length).toBeGreaterThan(0);
  const request = officialRequests[0],
    url = new URL(request.url());
  assert.equal(
    url.searchParams.get("layers"),
    `show:${source.layer_ids || "0"}`,
  );
  assert.match(
    url.searchParams.get("bbox"),
    /^-?[\d.]+,-?[\d.]+,-?[\d.]+,-?[\d.]+$/,
  );
  assert.equal(
    (await request.allHeaders()).referer,
    origin + "/",
    "public source requests expose no bearer token",
  );
  await expect(
    publicPage.getByRole("button", { name: "Add observation" }),
  ).toHaveCount(0);
  await mkdir("artifacts", { recursive: true });
  await publicPage.screenshot({
    path: "artifacts/maplibre-public-official.png",
  });
  await page.screenshot({ path: "artifacts/maplibre-workspace.png" });
  await visitor.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: one MapLibre canvas, official query placement/identify, same-scene camera switch, scoped camera/basemap restoration, Saved View official preferences and public official rendering without token disclosure.",
  );
} finally {
  await browser.close();
}
