import {
  openWorkspaceLibrary,
  enableReferenceLayer,
  selectBasemap,
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
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage(),
  errors = [],
  queries = [];
page.on("pageerror", (error) => errors.push(error.message));
const places = [
  {
    name: "Vermont South",
    state: "VIC",
    lng: 145.182,
    lat: -37.856,
    code: "GRZ1",
  },
  { name: "Lismore", state: "NSW", lng: 153.2773, lat: -28.8135, code: "R1" },
];
await context.route("**/query?**", (route) => {
  const url = new URL(route.request().url()),
    vic = url.hostname.includes("vic.gov.au");
  const point = places[vic ? 0 : 1],
    parcels = /PropertyAndParcel|Land_Parcel_Property/.test(url.pathname);
  const ring = (west, east) => [
    [west, point.lat - 0.01],
    [east, point.lat - 0.01],
    [east, point.lat + 0.01],
    [west, point.lat + 0.01],
    [west, point.lat - 0.01],
  ];
  const props = parcels
    ? vic
      ? {
          PARCEL_PFI: "QUALITY-VIC-42",
          PARCEL_SPI: "7\\PS42",
          PARCEL_LOT_NUMBER: "7",
          PARCEL_PLAN_NUMBER: "PS42",
        }
      : {
          cadid: "QUALITY-NSW-42",
          lotnumber: "7",
          planlabel: "DP42",
          lotidstring: "7/DP42",
        }
    : vic
      ? { ZONE_CODE: point.code, ZONE_DESCRIPTION: "General Residential Zone" }
      : {
          LAY_CLASS: point.code,
          LAY_NAME: "General Residential",
          SYM_CODE: point.code,
        };
  const values = [
    { properties: props, ring: ring(point.lng - 0.01, point.lng + 0.01) },
  ];
  if (!parcels)
    values.push({
      properties: vic
        ? { ZONE_CODE: "C1Z", ZONE_DESCRIPTION: "Commercial 1 Zone" }
        : { LAY_CLASS: "IN1", LAY_NAME: "General Industrial", SYM_CODE: "IN1" },
      ring: ring(point.lng + 0.01, point.lng + 0.02),
    });
  queries.push(url.toString());
  return route.fulfill({
    json: vic
      ? {
          type: "FeatureCollection",
          features: values.map(({ properties, ring }, i) => ({
            type: "Feature",
            id: i + 42,
            properties,
            geometry: { type: "Polygon", coordinates: [ring] },
          })),
        }
      : {
          features: values.map(({ properties, ring }) => ({
            attributes: properties,
            geometry: { rings: [ring] },
          })),
        },
  });
});
async function selectedOutlinePixels() {
  const png = (await page.locator(".map-canvas").screenshot()).toString(
    "base64",
  );
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = "data:image/png;base64," + data;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (
        pixels[i] < 8 &&
        Math.abs(pixels[i + 1] - 106) < 8 &&
        Math.abs(pixels[i + 2] - 134) < 8
      )
        count++;
    return count;
  }, png);
}
try {
  await page.goto(origin + "/signup");
  await page.getByLabel("Your name").fill("Map quality regression");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`quality-${Date.now()}@landbanker.test`);
  await page.getByLabel("Password", { exact: true }).fill("LocalMapQuality!42");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL("**/app/map");
  for (const zoom of [13.42, 14.8, 0, 22]) {
    const response = await page.request.get(
      `${origin}/api/map/viewport?kind=parcels&bbox=145,-38,146,-37&zoom=${zoom}`,
    );
    assert.equal(response.status(), 200, await response.text());
    assert.equal((await response.json()).zoom, Math.floor(zoom));
  }
  for (const zoom of ["-0.1", "22.1", "NaN", "Infinity", "", "oops"])
    assert.equal(
      (
        await page.request.get(
          `${origin}/api/map/viewport?bbox=145,-38,146,-37&zoom=${zoom}`,
        )
      ).status(),
      400,
    );
  for (const point of places) {
    const view = {
      id: crypto.randomUUID(),
      name: `Quality ${point.name}`,
      view: {
        latitude: point.lat,
        longitude: point.lng,
        zoom: 14.8,
        parcel_ids: [],
        layer_ids: [],
        official_layers: [],
      },
    };
    assert.equal(
      (
        await page.request.post(origin + "/api/views", {
          headers: { Origin: origin },
          data: view,
        })
      ).status(),
      200,
    );
    await page.reload();
    await openWorkspaceLibrary(page, "Saved Views");
    await page.getByRole("button", { name: view.name, exact: true }).click();
    await enableReferenceLayer(
      page,
      point.state === "VIC"
        ? "Victoria cadastral parcels"
        : "NSW cadastral parcels",
    );
    await expect(
      page.getByLabel("Official layers", { exact: true }),
    ).toContainText("Ready");
    await expect
      .poll(async () => {
        await page.mouse.click(500, 450);
        const details = page.locator(".property-details");
        return (await details.count()) ? details.textContent() : "";
      })
      .toContain(`QUALITY-${point.state}-42`);
    await expect(
      page.getByRole("button", { name: "Fit to Parcel", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".property-details")).toContainText(
      "Calculated area",
    );
    // Every style rebuild must reinstall sources and reapply the retained parcel.
    for (const style of ["light", "dark", "streets", "light", "dark"]) {
      await page.getByLabel("Basemap previews").click();
      await selectBasemap(page, style);
      await expect(page.locator(".property-details")).toContainText(
        `QUALITY-${point.state}-42`,
      );
      await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
      await expect(page.locator(".map-canvas")).toHaveAttribute(
        "data-basemap",
        style,
      );
      await expect
        .poll(selectedOutlinePixels, { timeout: 15000 })
        .toBeGreaterThan(80);
    }
    await page
      .getByRole("button", { name: "Clear Selection", exact: true })
      .click();
    // A real saved workspace polygon must retain normal picking priority, while
    // explicit zoning inspection can reach the planning zone beneath it.
    const overlayId = crypto.randomUUID();
    const ring = [
      [point.lng - 0.01, point.lat - 0.01],
      [point.lng + 0.01, point.lat - 0.01],
      [point.lng + 0.01, point.lat + 0.01],
      [point.lng - 0.01, point.lat + 0.01],
      [point.lng - 0.01, point.lat - 0.01],
    ];
    assert.equal(
      (
        await page.request.post(origin + "/api/layers", {
          headers: { Origin: origin },
          data: {
            id: overlayId,
            name: `Quality analysis ${point.state}`,
            geojson: {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  id: crypto.randomUUID(),
                  properties: { name: "Analysis over zoning" },
                  geometry: { type: "Polygon", coordinates: [ring] },
                },
              ],
            },
          },
        })
      ).status(),
      200,
    );
    assert.equal(
      (
        await page.request.post(origin + "/api/views", {
          headers: { Origin: origin },
          data: { ...view, view: { ...view.view, layer_ids: [overlayId] } },
        })
      ).status(),
      200,
    );
    await page.reload();
    await openWorkspaceLibrary(page, "Saved Views");
    await page.getByRole("button", { name: view.name, exact: true }).click();
    await expect
      .poll(async () => {
        await page.mouse.click(500, 450);
        return page
          .getByRole("button", { name: "Edit shape", exact: true })
          .count();
      })
      .toBe(1);
    if (
      (await page
        .getByRole("button", { name: "Layers", exact: true })
        .getAttribute("aria-pressed")) !== "true"
    )
      await page.getByRole("button", { name: "Layers", exact: true }).click();
    await enableReferenceLayer(page, point.state === "VIC" ? "Victoria planning zones" : "NSW land zoning");
    await page
      .getByRole("button", { name: "Inspect zoning", exact: true })
      .click();
    await expect
      .poll(async () => {
        await page.mouse.click(500, 450);
        const details = page.getByRole("region", {
          name: "Official feature Inspector",
        });
        return (await details.count()) ? details.textContent() : "";
      })
      .toContain(point.code);
    await expect(
      page.getByRole("region", { name: "Official feature Inspector" }),
    ).toContainText("Zoning details");
    const opacity = page.getByLabel("Zoning fill opacity", { exact: true });
    await opacity.fill("0.5");
    await expect(opacity).toHaveValue("0.5");
    await page
      .getByRole("button", { name: "Inspect parcels", exact: true })
      .click();
    await mkdir("artifacts", { recursive: true });
    await page.screenshot({ path: `artifacts/map-quality-${point.state}.png` });
  }
  // Genuine API failures must show; a successful retry must clear stale errors.
  await page.route("**/api/map/viewport?**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Synthetic backend unavailable" },
    }),
  );
  await page.getByRole("button", { name: "Refresh ↻", exact: true }).click();
  await expect(page.locator(".map-update-error")).toContainText(
    "Synthetic backend unavailable",
  );
  await page.unroute("**/api/map/viewport?**");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".map-update-error")).toHaveCount(0);
  assert(queries.length > 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: fractional zoom API boundaries and recovery; Vermont South/Lismore parcel-before-zone picking, authoritative IDs, distinct zone colours/opacity, five in-place styles, selection actions and one renderer.",
  );
} catch (error) {
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/map-quality-failure.png" });
  console.error(
    "Map quality page errors:",
    errors,
    "Notices:",
    await page.locator(".map-notice, .map-update-error").allTextContents(),
  );
  throw error;
} finally {
  await browser.close();
}
