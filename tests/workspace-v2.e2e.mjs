import {
  openTools,
  openWorkspaceSettings,
  confirmDrawingSave,
  prepareDrawingSave,
} from "./workspace-browser.mjs";
import { chromium } from "./map-browser.mjs";
import { expect } from "@playwright/test";
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
  viewport: { width: 1440, height: 900 },
  geolocation: { latitude: -37.856, longitude: 145.182, accuracy: 8 },
  permissions: ["geolocation"],
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await mkdir("artifacts", { recursive: true });
  await page.goto(origin + "/signup");
  await page.getByLabel("Your name").fill("Workspace V2");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`v2-${Date.now()}@landbanker.test`);
  await page.getByLabel("Password", { exact: true }).fill("WorkspaceV2Test!42");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL("**/app/map");
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Open Inspector" }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.__originalMapCanvas = document.querySelector(".maplibregl-canvas");
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "artifacts/v21-map-inspector-closed.png" });
  const initial = await page.locator(".map-canvas").boundingBox();
  assert(initial.width > 1300);
  assert.equal(initial.y, 0);
  const toolbar = await page.locator(".map-header").boundingBox();
  assert(
    toolbar.width < initial.width && toolbar.x > initial.x + initial.width / 2,
  );
  await openWorkspaceSettings(page);
  await expect(
    page.getByRole("button", { name: "Choose workspace" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Account and settings" }),
  ).toHaveAttribute("href", "/app/settings");
  await page.getByRole("button", { name: "3D view" }).click();
  await page.getByRole("button", { name: "2D edit" }).click();
  assert.equal(
    await page.evaluate(
      () =>
        window.__originalMapCanvas ===
        document.querySelector(".maplibregl-canvas"),
    ),
    true,
  );
  await page.getByRole("button", { name: "Set current view as Home" }).click();
  const home = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem(
        Object.keys(localStorage).find((k) => k.startsWith("landos:map-home:")),
      ),
    ),
  );
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(
    page.getByRole("button", { name: "Back to previous map view" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Back to previous map view" }).click();
  await expect(
    page.getByRole("button", { name: "Forward to next map view" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Forward to next map view" }).click();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const key = Object.keys(localStorage).find((k) =>
          k.startsWith("landos:map-camera:"),
        );
        return JSON.parse(localStorage.getItem(key)).zoom;
      }),
    )
    .toBeCloseTo(home.zoom, 1);
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await expect(page.getByLabel("Workspace library")).toBeVisible();
  await expect(page.getByText("Official parcels and zones")).toBeVisible();
  assert.equal(
    await page
      .locator(".workspace-library-content")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    true,
  );
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/workspace-v2-layers.png" });
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Search the map" })
    .getByRole("textbox")
    .fill("Ballarat");
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Search the map" }).getByRole("textbox"),
  ).toHaveValue("Ballarat");
  await page.getByRole("button", { name: "Close search" }).click();
  await page.getByRole("button", { name: "Open Inspector" }).click();
  await page.waitForTimeout(350);
  const smaller = await page.locator(".map-canvas").boundingBox();
  assert(initial.width - smaller.width > 300);
  const openToolbar = await page.locator(".map-header").boundingBox();
  assert(openToolbar.x + openToolbar.width <= smaller.x + smaller.width + 1);
  await page.screenshot({ path: "artifacts/v21-map-inspector-open.png" });
  await expect(
    page.getByRole("button", { name: "Compact inspector" }),
  ).toHaveCount(0);
  assert(
    (await page.locator(".inspector").boundingBox()).width <= 360,
    "fixed-width Inspector leaves the map usable",
  );
  await page.getByRole("button", { name: "Collapse Inspector" }).click();
  await page.waitForTimeout(350);
  assert(
    Math.abs(
      (await page.locator(".map-canvas").boundingBox()).width - initial.width,
    ) < 2,
  );
  assert.equal(
    await page.evaluate(
      () =>
        window.__originalMapCanvas ===
        document.querySelector(".maplibregl-canvas"),
    ),
    true,
  );
  await openTools(page);
  await expect(
    page.getByRole("button", { name: "Line / distance" }),
  ).toBeVisible();
  const cameraBefore = await page.evaluate(() => {
    const k = Object.keys(localStorage).find((k) =>
      k.startsWith("landos:map-camera:"),
    );
    return k ? JSON.parse(localStorage.getItem(k)).center : null;
  });
  const handle = page.getByRole("button", { name: "Move Spatial Tools" });
  const start = await handle.boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    start.x + start.width / 2 + 70,
    start.y + start.height / 2 + 30,
    { steps: 6 },
  );
  await page.mouse.up();
  const cameraAfter = await page.evaluate(() => {
    const k = Object.keys(localStorage).find((k) =>
      k.startsWith("landos:map-camera:"),
    );
    return k ? JSON.parse(localStorage.getItem(k)).center : null;
  });
  assert.deepEqual(cameraAfter, cameraBefore);
  const moved = await handle.boundingBox();
  assert(moved.x > start.x + 40);
  await page.reload();
  await openTools(page);
  await expect
    .poll(
      async () =>
        Math.abs(
          (
            await page
              .getByRole("button", { name: "Move Spatial Tools" })
              .boundingBox()
          ).x - moved.x,
        ),
      { timeout: 10000 },
    )
    .toBeLessThan(4);
  const restored = await page
    .getByRole("button", { name: "Move Spatial Tools" })
    .boundingBox();
  await page.getByRole("button", { name: "Move Spatial Tools" }).focus();
  await page.keyboard.press("ArrowRight");
  assert(
    (
      await page
        .getByRole("button", { name: "Move Spatial Tools" })
        .boundingBox()
    ).x >=
      restored.x + 9,
  );
  await page.getByRole("button", { name: "Reset Layout" }).click();
  await openTools(page);
  await page.getByRole("button", { name: "Radius", exact: true }).click();
  await page.getByLabel("Radius kilometres").fill("2");
  await page.getByRole("button", { name: "Create at map centre" }).click();
  await prepareDrawingSave(page);
  await expect(page.getByLabel("Shape name")).toHaveValue("2 km radius");
  await expect(page.locator(".local-layer")).toHaveCSS(
    "background-color",
    "rgb(16, 35, 38)",
  );
  assert.equal(
    await page
      .locator(".local-layer")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    true,
  );
  await page.waitForTimeout(400);
  await page.screenshot({ path: "artifacts/v21-dark-draft.png" });
  await confirmDrawingSave(page);
  await expect(page.getByText("Shape saved to Workspace.")).toBeVisible();
  await page.getByRole("button", { name: "Locate Me" }).click();
  await expect(page.getByText("Accuracy ±8 m", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Follow Me" }).click();
  await expect(
    page.getByRole("button", { name: "Stop following" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop following" }).click();
  await context.clearPermissions();
  await page.getByRole("button", { name: "Locate Me" }).click();
  await expect(
    page.getByText(
      "Location permission denied. Enable location access and try again.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss message" }).click();
  await page.getByLabel("Basemap previews").click();
  await expect(
    page.getByRole("button", { name: "Satellite", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Satellite", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Basemap previews").click();
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({ path: "artifacts/workspace-v2-ipad.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "artifacts/v21-phone.png" });
  const phoneToolbar = await page.locator(".map-header").boundingBox();
  assert(
    phoneToolbar.x >= 0 &&
      phoneToolbar.x + phoneToolbar.width <= 390 &&
      phoneToolbar.y >= 0,
  );
  const phoneInspector = await page.locator(".inspector").boundingBox();
  assert(
    phoneInspector.x >= 0 && phoneInspector.x + phoneInspector.width <= 391,
  );
  const phoneControls = await page.locator(".compact-location").boundingBox();
  const phoneAttribution = await page
    .locator(".maplibre-attribution")
    .boundingBox();
  assert(
    phoneControls.y >= phoneToolbar.y + phoneToolbar.height &&
      phoneControls.y + phoneControls.height <= phoneInspector.y,
  );
  assert(
    phoneControls.y + phoneControls.height <= phoneAttribution.y ||
      phoneAttribution.y + phoneAttribution.height <= phoneControls.y,
  );
  await page.getByRole("button", { name: "Collapse Inspector" }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/workspace-v2-phone-clean.png" });
  await openTools(page);
  const touch = await page
    .getByRole("button", { name: "Move Spatial Tools" })
    .boundingBox();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  const point = { x: touch.x + touch.width / 2, y: touch.y + touch.height / 2 };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: point.x + 35, y: point.y + 25 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert(
    (
      await page
        .getByRole("button", { name: "Move Spatial Tools" })
        .boundingBox()
    ).x >
      touch.x + 20,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await expect(
    page.getByRole("button", { name: "Search", exact: true }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: V2 dock, drawer, inspector sizing, map preservation, radius, GPS, attribution messaging and responsive widths.",
  );
} finally {
  await browser.close();
}
