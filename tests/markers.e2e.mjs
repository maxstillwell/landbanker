import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { openTools } from "./workspace-browser.mjs";
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
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  hasTouch: true,
});
page.setDefaultTimeout(25000);
page.on("dialog", (d) => d.accept());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function cors(p) {
  await p.route("http://127.0.0.1:54321/**", async (route) => {
    const headers = {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
      "access-control-allow-headers":
        "authorization,apikey,content-type,x-client-info,prefer",
    };
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    const response = await route.fetch();
    return route.fulfill({
      response,
      headers: { ...response.headers(), ...headers },
    });
  });
}
async function signup(p, email) {
  await cors(p);
  await p.goto(origin + "/signup");
  await p.getByLabel("Your name").fill("Markers acceptance");
  await p.getByLabel("Email", { exact: true }).fill(email);
  await p.getByLabel("Password", { exact: true }).fill("LocalMarkerTest!42");
  await p.getByRole("button", { name: "Create account", exact: true }).click();
  await p.waitForURL("**/app/map");
  await expect(p.locator(".maplibregl-canvas")).toBeVisible();
}
async function library() {
  await openTools(page);
  await page.getByRole("button", { name: "Markers", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Map Markers" })).toBeVisible();
}
const panel = page.getByRole("dialog", { name: "Map Markers" });
const getRows = async (p) =>
  (await (await p.request.get(origin + "/api/markers")).json()).markers;
try {
  const email = `marker-${Date.now()}@landbanker.test`;
  await signup(page, email);
  await library();
  await panel
    .getByLabel("Category", { exact: true })
    .selectOption("Education & Community");
  await panel.getByLabel("Search icons", { exact: true }).fill("School");
  await expect(
    panel.getByRole("button", { name: "School", exact: true }),
  ).toHaveCount(1);
  await panel.getByRole("button", { name: "School", exact: true }).click();
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-tool",
    "marker-placement",
  );
  await page.waitForTimeout(250);
  await page.mouse.move(700, 300);
  await page.mouse.down();
  await page.mouse.move(850, 400, { steps: 5 });
  await page.mouse.up();
  assert.equal((await getRows(page)).length, 0);
  await expect(panel).toHaveCount(0);
  await page.mouse.click(740, 400);
  await panel
    .getByLabel("Marker Name", { exact: true })
    .fill("Research school");
  await panel
    .getByLabel("Description / Notes")
    .fill("Manual annotation, not an official school record.");
  await panel.getByLabel("Colour", { exact: true }).selectOption("blue");
  await panel.getByLabel("Size", { exact: true }).selectOption("large");
  await panel.getByLabel("Show Label", { exact: true }).check();
  await panel.getByLabel("Status", { exact: true }).selectOption("proposed");
  await panel.getByRole("button", { name: "Save marker", exact: true }).click();
  await expect(panel).toContainText("Marker saved to Workspace.");
  let rows = await getRows(page);
  assert.equal(rows.length, 1);
  const original = rows[0];
  await writeFile(
    "/tmp/landos-markers-test-user.json",
    JSON.stringify({
      email,
      password: "LocalMarkerTest!42",
      id: original.created_by,
      markerId: original.id,
    }),
    { mode: 0o600 },
  );
  assert.equal(original.icon, "school");
  await expect(
    panel.getByRole("button", { name: "Edit Research school", exact: true }),
  ).toBeVisible();
  await mkdir("artifacts/markers", { recursive: true });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "artifacts/markers/desktop.png" });
  await page.reload();
  await library();
  await panel.getByRole("button", { name: /My Markers/ }).click();
  await expect(
    panel.getByRole("button", { name: "Edit Research school", exact: true }),
  ).toBeVisible();
  const second = await browser.newPage();
  await cors(second);
  await second.goto(origin + "/login");
  await second.getByLabel("Email", { exact: true }).fill(email);
  await second
    .getByLabel("Password", { exact: true })
    .fill("LocalMarkerTest!42");
  await second.getByRole("button", { name: "Sign in", exact: true }).click();
  await second.waitForURL("**/app/map");
  assert.equal((await getRows(second))[0].id, original.id);
  const outsider = await browser.newPage();
  await signup(outsider, `other-marker-${Date.now()}@landbanker.test`);
  assert.equal((await getRows(outsider)).length, 0);
  const denied = await outsider.request.patch(origin + "/api/markers", {
    headers: { origin },
    data: {
      ...Object.fromEntries(
        Object.entries(original).filter(([key]) =>
          [
            "id",
            "latitude",
            "longitude",
            "icon",
            "name",
            "description",
            "color",
            "size",
            "show_label",
            "status",
            "linked_property_id",
            "linked_research_area_id",
          ].includes(key),
        ),
      ),
      expected_updated_at: original.updated_at,
    },
  });
  assert.ok(!denied.ok());
  await outsider.close();
  await second.close();
  console.log(
    "creation, pan guard, reload, independent session retrieval and unrelated workspace denial passed",
  );
  await panel
    .getByRole("button", { name: "Edit Research school", exact: true })
    .click();
  await panel
    .getByLabel("Marker Name", { exact: true })
    .fill("Research hospital");
  await panel.getByLabel("Icon", { exact: true }).selectOption("hospital");
  await panel.getByLabel("Colour", { exact: true }).selectOption("red");
  await panel.getByLabel("Size", { exact: true }).selectOption("small");
  await panel.getByLabel("Show Label", { exact: true }).uncheck();
  await panel.getByRole("button", { name: "Move", exact: true }).click();
  await page.waitForTimeout(250);
  await page.mouse.click(900, 500);
  await panel.getByRole("button", { name: "Save marker", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Edit Research hospital", exact: true }),
  ).toBeVisible();
  rows = await getRows(page);
  assert.equal(rows[0].name, "Research hospital");
  assert.equal(rows[0].icon, "hospital");
  assert.notEqual(rows[0].longitude, original.longitude);
  assert.equal(rows[0].created_by, original.created_by);
  await panel
    .getByRole("button", { name: "Locate Research hospital", exact: true })
    .click();
  await page.waitForTimeout(500);
  await panel
    .getByRole("button", { name: "Close markers", exact: true })
    .click();
  const canvas = await page.locator(".map-canvas").boundingBox();
  await page.mouse.click(
    canvas.x + canvas.width / 2,
    canvas.y + canvas.height / 2 - 15,
  );
  await expect(panel.getByLabel("Marker Name", { exact: true })).toHaveValue(
    "Research hospital",
  );
  await panel.getByRole("button", { name: "Duplicate", exact: true }).click();
  await panel.getByRole("button", { name: "Cancel", exact: true }).click();
  await panel.getByRole("button", { name: "Undo cancel", exact: true }).click();
  await panel.getByRole("button", { name: "Save marker", exact: true }).click();
  await expect(
    panel.getByRole("button", {
      name: "Delete Research hospital copy",
      exact: true,
    }),
  ).toBeVisible();
  assert.equal((await getRows(page)).length, 2);
  await panel
    .getByRole("button", { name: "Delete Research hospital copy", exact: true })
    .click();
  await expect(
    panel.getByRole("button", {
      name: "Delete Research hospital copy",
      exact: true,
    }),
  ).toHaveCount(0);
  assert.equal((await getRows(page)).length, 1);
  await panel.getByRole("button", { name: "Undo delete", exact: true }).click();
  await expect(
    panel.getByRole("button", {
      name: "Delete Research hospital copy",
      exact: true,
    }),
  ).toBeVisible();
  assert.equal((await getRows(page)).length, 2);
  await panel
    .getByRole("button", { name: "Delete Research hospital copy", exact: true })
    .click();
  await expect(
    panel.getByRole("button", {
      name: "Delete Research hospital copy",
      exact: true,
    }),
  ).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Close markers", exact: true })
    .click();
  console.log(
    "map selection, icon/style edit, explicit move, duplicate, cancel recovery and soft-delete Undo passed",
  );
  await page.getByRole("button", { name: "Map Display", exact: true }).click();
  await page.getByLabel("My Markers", { exact: true }).uncheck();
  await page.getByLabel("My Markers", { exact: true }).check();
  await page.getByRole("button", { name: "Map Display", exact: true }).click();
  await page.getByLabel("Basemap previews").click();
  await page
    .getByRole("group", { name: "Basemap styles" })
    .getByRole("button", { name: "Dark", exact: true })
    .click();
  await page.waitForTimeout(1000);
  assert.equal((await getRows(page)).length, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await library();
  await panel
    .getByRole("button", { name: "Icon Library", exact: true })
    .click();
  await panel.getByLabel("Category", { exact: true }).selectOption("All");
  await panel.getByLabel("Search icons", { exact: true }).fill("Important");
  await panel
    .getByRole("button", { name: "Important Location", exact: true })
    .click();
  await page.waitForTimeout(250);
  await expect(page.locator(".inspector.collapsed")).toBeVisible();
  await page.touchscreen.tap(190, 300);
  await panel.getByLabel("Marker Name", { exact: true }).fill("Mobile access");
  await panel.getByRole("button", { name: "Save marker", exact: true }).click();
  await expect(panel).toContainText("Mobile access");
  assert.equal((await getRows(page)).length, 2);
  await page.screenshot({ path: "artifacts/markers/mobile.png" });
  await panel
    .getByRole("button", { name: "Close markers", exact: true })
    .click();
  await expect(page.locator(".inspector.collapsed")).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "Display, basemap preservation and mobile sheet placement/save passed; no page errors",
  );
} catch (e) {
  console.log((await page.locator("body").innerText()).slice(-2500));
  await page.screenshot({ path: "/tmp/landos-markers-error.png" });
  throw e;
} finally {
  await browser.close();
}
