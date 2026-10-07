import { chromium, expect } from "@playwright/test";
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
const featureLayerId = crypto.randomUUID();
const crossingId = crypto.randomUUID(),
  holeId = crypto.randomUUID();
const features = parcels.map((p, i) => ({
  type: "Feature",
  id: crypto.randomUUID(),
  properties: { name: `Synthetic feature ${i}` },
  geometry: p.geometry,
}));
features.push({
  type: "Feature",
  id: crossingId,
  properties: { name: "Crossing line" },
  geometry: {
    type: "LineString",
    coordinates: [
      [143, -37],
      [145, -37],
    ],
  },
});
features.push({
  type: "Feature",
  id: holeId,
  properties: { name: "Viewport inside hole" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [143, -38],
        [145, -38],
        [145, -36],
        [143, -36],
        [143, -38],
      ],
      [
        [143.5, -37.5],
        [143.5, -36.5],
        [144.5, -36.5],
        [144.5, -37.5],
        [143.5, -37.5],
      ],
    ],
  },
});
assert.equal(
  (
    await client.rpc("save_layer_features", {
      p_workspace: workspace_id,
      p_id: featureLayerId,
      p_name: "Scale features",
      p_geojson: { type: "FeatureCollection", features },
    })
  ).error,
  null,
);
// Its stored point is outside the test viewport, but its polygon intersects it.
assert.equal(
  (
    await client
      .from("land_parcels")
      .update({ latitude: -30, longitude: 150 })
      .eq("id", parcels[0].id)
  ).error,
  null,
);
const otherClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
assert.equal(
  (
    await otherClient.auth.signUp({
      email: `other-viewport-${Date.now()}@landbanker.test`,
      password,
    })
  ).error,
  null,
);
const rejected = await otherClient.rpc("landos_viewport_candidates", {
  p_workspace: workspace_id,
  p_kind: "features",
  p_bbox: [143, -38, 145, -36],
});
assert.equal(rejected.error, null);
assert.deepEqual(rejected.data, []);
const anonClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
assert.ok(
  (
    await anonClient.rpc("landos_viewport_candidates", {
      p_workspace: workspace_id,
      p_kind: "features",
      p_bbox: [143, -38, 145, -36],
    })
  ).error,
);
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
  const library = await (
    await page.request.get(origin + "/api/layer-library")
  ).json();
  const sources = library.catalog.filter((l) => l.enabled);
  assert.ok(sources.some((l) => l.id === "vic-planning-overlays"));
  assert.ok(sources.some((l) => l.id === "nsw-minimum-lot-size"));
  assert.ok(sources.length >= 10);
  for (const [position, source] of sources.slice(0, 10).entries()) {
    assert.equal(
      (
        await page.request.post(origin + "/api/layer-library", {
          headers: { Origin: origin },
          data: {
            id: source.id,
            action: "save",
            visible: true,
            opacity: 0.5,
            position,
          },
        })
      ).status(),
      200,
    );
  }
  await page.reload();
  await page.getByRole("button", { name: "layers", exact: true }).click();
  await page.locator(".active-layer").last().waitFor();
  assert.equal(await page.locator(".active-layer").count(), 10);
  assert.equal(
    (await (await page.request.get(origin + "/api/layer-library")).json())
      .active.length,
    10,
  );
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
  await page.getByRole("button", { name: "parcels", exact: true }).click();
  await page
    .locator(".record-row")
    .filter({ hasText: "Synthetic property 1" })
    .first()
    .click();
  for (let i = 0; i < 3; i++)
    await page.locator(".leaflet-control-zoom-out").click();
  await expect
    .poll(async () => page.locator(".leaflet-overlay-pane path").count(), {
      timeout: 30000,
    })
    .toBeGreaterThan(900);
  let panRequests = 0,
    panBytes = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/map/viewport?")) panRequests++;
  });
  page.on("response", async (r) => {
    if (r.url().includes("/api/map/viewport?") && r.status() === 200)
      panBytes += (await r.body()).length;
  });
  await page.mouse.move(400, 350);
  await page.mouse.down();
  await page.mouse.move(445, 375, { steps: 12 });
  await page.mouse.up();
  const frameMs = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const start = performance.now();
        let count = 0;
        function frame() {
          if (++count === 10) resolve(performance.now() - start);
          else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }),
  );
  assert(frameMs < 2000, "ten frames remain responsive during scale pan");
  await page.getByRole("button", { name: "layers", exact: true }).click();
  await page
    .locator(".saved-layer summary")
    .filter({ hasText: "Scale features" })
    .click();
  await page
    .getByRole("button", { name: "Synthetic feature 0", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit shape", exact: true }).click();
  await page
    .getByLabel("Drawing name", { exact: true })
    .fill("Edited viewport shape");
  await page.getByLabel("Drawing controls").getByRole("button", { name: "Finish polygon", exact: true }).click();
  await page
    .getByRole("button", { name: "Save to Workspace", exact: true })
    .click();
  await page.getByText("Shape saved to Workspace.", { exact: true }).waitFor();
  const complete = (
    await (
      await page.request.get(`${origin}/api/layers?id=${featureLayerId}`)
    ).json()
  ).layer.geojson.features;
  assert.equal(
    complete.length,
    502,
    "editing a viewport shape preserves all off-screen features",
  );
  assert.equal(
    complete.find((f) => f.id === features[0].id).properties.name,
    "Edited viewport shape",
  );
  assert.deepEqual(
    new Set(complete.map((f) => f.id)),
    new Set(features.map((f) => f.id)),
  );
  console.log(
    `Browser scale pan: ${panRequests} viewport requests, ${panBytes} response bytes, ten-frame timing ${Math.round(frameMs)} ms; complete-layer edit retained 502 feature IDs.`,
  );
  const viewportTimings = [],
    viewportSizes = [];
  for (const kind of ["parcels", "observations", "features"]) {
    const start = performance.now();
    const response = await page.request.get(
      `${origin}/api/map/viewport?kind=${kind}&bbox=143.99,-37.00001,144.01,-36.94&zoom=14&limit=100`,
    );
    assert.equal(response.status(), 200, await response.text());
    const text = await response.text();
    viewportTimings.push(Math.round(performance.now() - start));
    viewportSizes.push(Buffer.byteLength(text));
    const result = JSON.parse(text);
    assert.equal(result.rows.length, 100);
    assert(result.next_cursor);
    const next = await page.request.get(
      `${origin}/api/map/viewport?kind=${kind}&bbox=143.99,-37.00001,144.01,-36.94&zoom=14&limit=100&cursor=${result.next_cursor}`,
    );
    assert.equal(next.status(), 200);
    assert(
      !(await next.json()).rows.some((row) =>
        result.rows.some((prev) => prev.id === row.id),
      ),
    );
  }
  const exact = await page.request.get(
    `${origin}/api/map/viewport?kind=features&bbox=144.0002,-37.000005,144.0008,-36.999995&zoom=18`,
  );
  assert.equal(exact.status(), 200, await exact.text());
  const exactRows = (await exact.json()).rows;
  assert(exactRows.some((row) => row.id === crossingId));
  assert(!exactRows.some((row) => row.id === holeId));
  const geometryMatch = await page.request.get(
    `${origin}/api/map/viewport?kind=parcels&bbox=143.999,-37.00001,144.002,-36.99999`,
  );
  assert(
    (await geometryMatch.json()).rows.some((row) => row.id === parcels[0].id),
  );
  const beforeUpdate = new Date().toISOString();
  assert.equal(
    (
      await client
        .from("land_parcels")
        .update({ title: "Delta parcel" })
        .eq("id", parcels[0].id)
    ).error,
    null,
  );
  const delta = await page.request.get(
    `${origin}/api/map/viewport?kind=parcels&bbox=143.99,-37.00001,144.01,-36.94&updated_since=${encodeURIComponent(beforeUpdate)}`,
  );
  assert.equal(delta.status(), 200, await delta.text());
  assert.deepEqual(
    (await delta.json()).rows.map((p) => p.id),
    [parcels[0].id],
  );
  const overview = await (
    await page.request.get(origin + "/api/map?overview=1")
  ).json();
  assert(overview.layers.every((layer) => !layer.geojson));
  assert(overview.parcels.every((parcel) => !parcel.geometry));
  assert.equal(
    (
      await page.request.get(
        origin + "/api/map/viewport?bbox=0,0,1,1&limit=501",
      )
    ).status(),
    400,
  );
  console.log(
    `Viewport baseline: three first-page requests; bytes ${viewportSizes.join(", ")}; ms ${viewportTimings.join(", ")}; 502 normalized features, exact crossing/hole and point-outside polygon intersection, cursor/delta, anonymous/nonmember isolation passed.`,
  );
  console.log(
    "PASS: 500 parcels/polygons and 500 observations and 10 persisted active official layers; stable 100-row pages, deduplication, bounded payloads, point bbox filter, validation and browser load-more. Local page response ms: " +
      timings.join(", "),
  );
} finally {
  await browser.close();
}
