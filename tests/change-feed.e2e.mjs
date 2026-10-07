import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
const origin = process.env.E2E_APP_URL || "http://localhost:3000";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const env = Object.fromEntries(
  (await readFile(".env.local", "utf8"))
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.LAND_BANKER_SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {}),
  args: ["--no-sandbox"],
});
try {
  const contextA = await browser.newContext(),
    contextB = await browser.newContext();
  const a = await contextA.newPage(),
    b = await contextB.newPage();
  const email = `sync-${Date.now()}@landbanker.test`,
    password = "LocalSyncTest!42";
  await a.goto(origin + "/signup");
  await a.getByLabel("Your name").fill("Sync Owner");
  await a.getByLabel("Email", { exact: true }).fill(email);
  await a.getByLabel("Password", { exact: true }).fill(password);
  await a.getByRole("button", { name: "Create account", exact: true }).click();
  await a.waitForURL("**/app/map");
  await b.goto(origin + "/login");
  await b.getByLabel("Email", { exact: true }).fill(email);
  await b.getByLabel("Password", { exact: true }).fill(password);
  await b.getByRole("button", { name: "Sign in", exact: true }).click();
  await b.waitForURL("**/app/map");
  const initial = await b.request.get(origin + "/api/map/changes");
  assert.equal(initial.status(), 200, await initial.text());
  const initialData = await initial.json();
  let cursor = initialData.cursor;
  const layer = crypto.randomUUID(),
    feature = crypto.randomUUID();
  async function save(name, include = true) {
    const r = await a.request.post(origin + "/api/layers", {
      headers: { Origin: origin },
      data: {
        id: layer,
        name: "Sync analysis",
        geojson: {
          type: "FeatureCollection",
          features: include
            ? [
                {
                  type: "Feature",
                  id: feature,
                  properties: { name },
                  geometry: {
                    type: "Point",
                    coordinates: [143.8503, -37.5622],
                  },
                },
              ]
            : [],
        },
      },
    });
    assert.equal(r.status(), 200, await r.text());
  }
  async function sync() {
    const r = await b.request.get(`${origin}/api/map/changes?after=${cursor}`);
    assert.equal(r.status(), 200, await r.text());
    const value = await r.json();
    cursor = value.cursor;
    return value;
  }
  await save("Created on Device A");
  let value = await sync();
  assert(
    value.changes.some(
      (c) =>
        c.kind === "features" &&
        c.id === feature &&
        c.row.feature.properties.name === "Created on Device A",
    ),
  );
  // Device B also applies the real incremental feed automatically, without reload/Refresh.
  await b.getByRole("button", { name: "layers", exact: true }).click();
  await expect
    .poll(
      async () =>
        b
          .locator(".saved-layer summary")
          .filter({ hasText: "Sync analysis" })
          .count(),
      { timeout: 25000 },
    )
    .toBe(1);
  await b
    .locator(".saved-layer summary")
    .filter({ hasText: "Sync analysis" })
    .click();
  await b
    .getByRole("button", { name: "Created on Device A", exact: true })
    .waitFor();
  await save("Updated on Device A");
  value = await sync();
  assert(
    value.changes.some(
      (c) =>
        c.kind === "features" &&
        c.id === feature &&
        c.row.feature.properties.name === "Updated on Device A",
    ),
  );
  // Two Playwright pages share one headless browser. Bring Device B forward so
  // the production visibility guard resumes its incremental poll.
  await b.bringToFront();
  await b.evaluate(() => window.dispatchEvent(new Event("focus")));
  await b
    .getByRole("button", { name: "Updated on Device A", exact: true })
    .waitFor({ timeout: 25000 });
  await save("Deleted", false);
  value = await sync();
  assert(
    value.changes.some(
      (c) =>
        c.kind === "features" && c.id === feature && c.operation === "delete",
    ),
  );
  await b.bringToFront();
  await b.evaluate(() => window.dispatchEvent(new Event("focus")));
  await b
    .getByRole("button", { name: "Updated on Device A", exact: true })
    .waitFor({ state: "hidden", timeout: 25000 });
  const log = await admin
    .from("workspace_changes")
    .select("operation")
    .eq("workspace_id", initialData.workspace_id)
    .eq("object_id", feature);
  assert.ifError(log.error);
  assert(log.data.some((e) => e.operation === "delete"));
  const noMore = await sync();
  assert.equal(noMore.changes.length, 0);
  const observation = crypto.randomUUID();
  const createdObservation = await admin.from("field_observations").insert({
    id: observation,
    workspace_id: initialData.workspace_id,
    title: "Photo removal keeps this record",
    latitude: -37.5622,
    longitude: 143.8503,
  });
  assert.ifError(createdObservation.error);
  const media = await admin
    .from("field_observation_media")
    .insert({
      workspace_id: initialData.workspace_id,
      observation_id: observation,
      original_filename: "synthetic.jpg",
      mime_type: "image/jpeg",
      size_bytes: 1,
      upload_status: "pending",
    })
    .select("id")
    .single();
  assert.ifError(media.error);
  await sync();
  assert.ifError(
    (
      await admin
        .from("field_observation_media")
        .delete()
        .eq("id", media.data.id)
    ).error,
  );
  value = await sync();
  const parent = value.changes.find(
    (c) => c.kind === "observations" && c.id === observation,
  );
  assert.equal(
    parent?.operation,
    "upsert",
    "photo deletion must not tombstone the Observation",
  );
  assert.equal(parent.row.field_observation_media.length, 0);
  const invalid = await b.request.get(
    origin + "/api/map/changes?after=9223372036854775808",
  );
  assert.equal(invalid.status(), 400);
  const anon = await browser.newContext();
  assert.equal(
    (await anon.request.get(origin + "/api/map/changes")).status(),
    400,
  );
  await anon.close();
  console.log(
    "PASS: two-device real create/update/delete incremental API and automatic map UI reconciliation, no reload; photo deletion preserves parent; anonymous and cursor guards.",
  );
} finally {
  await browser.close();
}
