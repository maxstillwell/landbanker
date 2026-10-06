import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
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
const origin = process.env.E2E_APP_URL || "http://localhost:3000";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const client = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
const email = `paging-${Date.now()}@landbanker.test`,
  password = "LocalPagesTest!42";
assert.equal((await client.auth.signUp({ email, password })).error, null);
const { data: membership, error } = await client
  .from("workspace_memberships")
  .select("workspace_id")
  .single();
assert.equal(error, null);
const workspace_id = membership.workspace_id;
const parcels = Array.from({ length: 500 }, (_, i) => ({
  id: crypto.randomUUID(),
  workspace_id,
  title: `Synthetic property ${i}`,
  latitude: -37 + i * 0.0001,
  longitude: 144,
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [144, -37 + i * 0.0001],
        [144.001, -37 + i * 0.0001],
        [144.001, -36.99999 + i * 0.0001],
        [144, -37 + i * 0.0001],
      ],
    ],
  },
  metadata: { legacy_payload: "x".repeat(20000) },
}));
const observations = Array.from({ length: 500 }, (_, i) => ({
  id: crypto.randomUUID(),
  workspace_id,
  title: `Synthetic field ${i}`,
  latitude: -37 + i * 0.0001,
  longitude: 144,
  observed_at: new Date(Date.now() - i * 1000).toISOString(),
}));
for (let i = 0; i < 500; i += 100) {
  assert.equal(
    (await client.from("land_parcels").insert(parcels.slice(i, i + 100))).error,
    null,
  );
  assert.equal(
    (
      await client
        .from("field_observations")
        .insert(observations.slice(i, i + 100))
    ).error,
    null,
  );
}
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {}),
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  await page.goto(origin + "/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/app/map");
  const parcelIds = new Set(),
    observationIds = new Set(),
    timings = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now(),
      response = await page.request.get(origin + "/api/map?page=" + i);
    assert.equal(response.status(), 200);
    const raw = await response.text(),
      data = JSON.parse(raw);
    timings.push(Math.round(performance.now() - start));
    assert.equal(data.parcels.length, 100);
    assert.equal(data.observations.length, 100);
    assert.ok(
      raw.length < 200000,
      "raw legacy metadata excluded from map payload",
    );
    assert.equal(data.pagination.hasMore.parcels, i < 4);
    for (const p of data.parcels) parcelIds.add(p.id);
    for (const o of data.observations) observationIds.add(o.id);
  }
  assert.equal(parcelIds.size, 500);
  assert.equal(observationIds.size, 500);
  const bbox = await (
    await page.request.get(
      origin + "/api/map?bbox=143.9,-37.001,144.1,-36.9995",
    )
  ).json();
  assert.ok(bbox.parcels.length > 0 && bbox.parcels.length < 100);
  assert.equal(
    (await page.request.get(origin + "/api/map?page=-1")).status(),
    400,
  );
  assert.equal(
    (await page.request.get(origin + "/api/map?bbox=0,0,-1,-1")).status(),
    400,
  );
  for (let i = 0; i < 4; i++) {
    const button = page.getByRole("button", {
      name: "Load more Workspace data",
      exact: true,
    });
    await button.click();
    await page
      .getByRole("button", { name: "Loading…", exact: true })
      .waitFor({ state: "hidden" });
  }
  await page
    .getByRole("button", { name: "Load more Workspace data", exact: true })
    .waitFor({ state: "hidden" });
  console.log(
    "PASS: 500 parcels/polygons and 500 observations; stable 100-row pages, deduplication, bounded payloads, point bbox filter, validation and browser load-more. Local page response ms: " +
      timings.join(", "),
  );
} finally {
  await browser.close();
}
