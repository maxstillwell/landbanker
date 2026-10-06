import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const email = `drawing-${Date.now()}@landbanker.test`,
    password = "LocalDrawingAlpha2!42";
  await page.goto(origin + "/signup");
  await page.getByLabel("Your name").fill("Drawing Recovery");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL("**/app/map");
  const controls = page.getByLabel("Drawing controls");
  async function start(name) {
    await page.getByRole("button", { name: "layers", exact: true }).click();
    await page.getByRole("button", { name: "Draw", exact: true }).click();
    await page.getByRole("button", { name, exact: true }).click();
  }
  async function points() {
    return page.evaluate(async () => {
      const r = indexedDB.open("land-banker-layer-draft-v1", 2);
      await new Promise((resolve) => (r.onsuccess = resolve));
      const db = r.result;
      const rows = await new Promise((resolve) => {
        const q = db.transaction("drawing").objectStore("drawing").getAll();
        q.onsuccess = () => resolve(q.result);
      });
      db.close();
      return rows[0]?.points;
    });
  }
  async function waitPoints(n) {
    await expect
      .poll(async () => (await points())?.length, { timeout: 15000 })
      .toBe(n);
  }
  await start("Draw polygon");
  await page.mouse.click(90, 170);
  await page.mouse.click(280, 170);
  await page.mouse.click(270, 300);
  await page.mouse.click(100, 310);
  await waitPoints(4);
  const initial = await points();
  const hit = await page.locator(".drawing-vertex").first().boundingBox();
  assert.equal(hit.width, 44);
  assert.equal(hit.height, 44);
  await page.reload();
  await page.getByText("Unfinished drawing found", { exact: true }).waitFor();
  assert.equal(await controls.count(), 0);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  assert.deepEqual(await points(), initial);
  const move = page.getByRole("img", { name: "Move entire shape" });
  const b = await move.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 35, b.y + b.height / 2 + 25, {
    steps: 8,
  });
  await page.mouse.up();
  await expect
    .poll(async () => JSON.stringify(await points()))
    .not.toBe(JSON.stringify(initial));
  const moved = await points();
  assert.notDeepEqual(moved, initial);
  await controls.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => JSON.stringify(await points()))
    .toBe(JSON.stringify(initial));
  assert.deepEqual(await points(), initial);
  await page
    .getByRole("img", { name: "Add vertex after 1", exact: true })
    .click();
  await waitPoints(5);
  await page.getByRole("img", { name: "Vertex 2", exact: true }).click();
  await controls
    .getByRole("button", { name: "Delete vertex", exact: true })
    .click();
  await waitPoints(4);
  await controls.getByRole("button", { name: "Undo", exact: true }).click();
  await waitPoints(5);
  const beforeSecondMove = await points();
  const moveAgain = await page
    .getByRole("img", { name: "Move entire shape" })
    .boundingBox();
  await page.mouse.move(
    moveAgain.x + moveAgain.width / 2,
    moveAgain.y + moveAgain.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    moveAgain.x + moveAgain.width / 2 + 20,
    moveAgain.y + moveAgain.height / 2 + 15,
    { steps: 6 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => JSON.stringify(await points()))
    .not.toBe(JSON.stringify(beforeSecondMove));
  const translated = await points();
  assert.notDeepEqual(translated, initial);
  await controls
    .getByRole("button", { name: "Finish polygon", exact: true })
    .click();
  await page.getByLabel("Shape name").fill("Alpha 2 polygon");
  await page.getByLabel("New layer name").fill("Hardening geometry");
  await page
    .getByRole("button", { name: "Save to Workspace", exact: true })
    .click();
  await page.getByText("Shape saved to Workspace.", { exact: true }).waitFor();
  const saved = await (await page.request.get(origin + "/api/map")).json();
  const layer = saved.layers.find((l) => l.name === "Hardening geometry");
  assert.equal(layer.geojson.features[0].geometry.coordinates[0].length, 6);
  assert.deepEqual(
    layer.geojson.features[0].geometry.coordinates[0].slice(0, -1),
    translated,
  );
  await page.reload();
  const reopened = await (await page.request.get(origin + "/api/map")).json();
  assert.deepEqual(
    reopened.layers.find((l) => l.id === layer.id).geojson,
    layer.geojson,
  );
  assert.equal(
    await page.getByText("Unfinished drawing found", { exact: true }).count(),
    0,
  );
  await start("Draw line");
  await page.mouse.click(90, 170);
  await page.mouse.click(280, 250);
  await waitPoints(2);
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await page.reload();
  await page.getByText("Unfinished drawing found", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("img", { name: "Vertex 1", exact: true }).click();
  await controls
    .getByRole("button", { name: "Delete vertex", exact: true })
    .click();
  await page
    .getByText(
      "Keep at least 2 line points or 3 unique polygon vertices. This deletion is not safe.",
    )
    .waitFor();
  assert.equal((await points()).length, 2);
  await page.reload();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await page
    .getByText("Unfinished drawing found", { exact: true })
    .waitFor({ state: "hidden" });
  await page.reload();
  assert.equal(
    await page.getByText("Unfinished drawing found", { exact: true }).count(),
    0,
  );
  await start("Add point");
  await page.mouse.click(100, 170);
  await waitPoints(1);
  const workspaceA = (
    await (await page.request.get(origin + "/api/workspaces")).json()
  ).current;
  const env = Object.fromEntries(
    (await readFile(".env.local", "utf8"))
      .trim()
      .split("\n")
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1)];
      }),
  );
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
  const auth = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const signed = await auth.auth.signInWithPassword({ email, password });
  assert.equal(signed.error, null);
  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.LAND_BANKER_SUPABASE_SECRET_KEY,
  );
  const workspaceB = crypto.randomUUID(),
    userId = signed.data.user.id;
  assert.equal(
    (
      await admin
        .from("workspaces")
        .insert({
          id: workspaceB,
          name: "Secondary synthetic Workspace",
          created_by: userId,
        })
    ).error,
    null,
  );
  assert.equal(
    (
      await admin
        .from("workspace_memberships")
        .insert({
          workspace_id: workspaceB,
          user_id: userId,
          role: "owner",
          status: "active",
        })
    ).error,
    null,
  );
  async function switchWorkspace(id) {
    assert.equal(
      (
        await page.request.post(origin + "/api/workspaces", {
          headers: { Origin: origin },
          data: { id },
        })
      ).status(),
      200,
    );
    await page.reload();
  }
  await switchWorkspace(workspaceB);
  assert.equal(
    await page.getByText("Unfinished drawing found", { exact: true }).count(),
    0,
  );
  await switchWorkspace(workspaceA);
  await page.getByText("Unfinished drawing found", { exact: true }).waitFor();
  await page.goto(origin + "/app/settings");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("**/login");
  await page.goto(origin + "/signup");
  await page.getByLabel("Your name").fill("Other drawing account");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`drawing-b-${Date.now()}@landbanker.test`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL("**/app/map");
  assert.equal(
    await page.getByText("Unfinished drawing found", { exact: true }).count(),
    0,
  );
  await page.goto(origin + "/app/settings");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("**/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/app/map");
  await page.getByText("Unfinished drawing found", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await page
    .getByText("Unfinished drawing found", { exact: true })
    .waitFor({ state: "hidden" });
  await start("Draw rectangle");
  await page.mouse.click(100, 170);
  await page.mouse.click(270, 290);
  await waitPoints(2);
  await page.reload();
  await page.getByText("Unfinished drawing found", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const rectangleBefore = await points(),
    rb = await page
      .getByRole("img", { name: "Move entire shape" })
      .boundingBox();
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);
  await page.mouse.down();
  await page.mouse.move(rb.x + rb.width / 2 + 20, rb.y + rb.height / 2 + 15, {
    steps: 6,
  });
  await page.mouse.up();
  await expect
    .poll(async () => JSON.stringify(await points()))
    .not.toBe(JSON.stringify(rectangleBefore));
  await controls
    .getByRole("button", { name: "Finish shape", exact: true })
    .click();
  await page.getByLabel("Shape name").fill("Rectangle moved");
  await page.getByLabel("New layer name").fill("Rectangle alpha");
  await page
    .getByRole("button", { name: "Save to Workspace", exact: true })
    .click();
  await page.getByText("Shape saved to Workspace.", { exact: true }).waitFor();
  const rectData = await (await page.request.get(origin + "/api/map")).json(),
    rect = rectData.layers.find((l) => l.name === "Rectangle alpha");
  assert.equal(rect.geojson.features[0].geometry.coordinates[0].length, 5);
  await page.reload();
  const rectReload = await (await page.request.get(origin + "/api/map")).json();
  assert.deepEqual(
    rectReload.layers.find((l) => l.id === rect.id).geojson,
    rect.geojson,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: polygon reload/resume, 44px touch targets, whole move/Undo, midpoint insertion/deletion/Undo, save/reopen identity, line background/reload, invalid deletion blocked, discard, two-account/two-Workspace isolation and rectangle move/save/reopen.",
  );
} finally {
  await browser.close();
}
