import { chromium } from "@playwright/test";
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
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const email = `planning-${Date.now()}@landbanker.test`;
  await page.goto(origin + "/signup");
  await page.getByLabel("Your name").fill("Planning Test");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("LocalPlanningTest!42");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL("**/app/map");
  const users = await admin.auth.admin.listUsers({ perPage: 1000 });
  const owner = users.data.users.find((u) => u.email === email);
  assert.ok(owner);
  const membership = await admin
    .from("workspace_memberships")
    .select("workspace_id")
    .eq("user_id", owner.id)
    .single();
  assert.ifError(membership.error);
  const id = crypto.randomUUID();
  assert.ifError(
    (
      await admin.from("land_parcels").insert({
        id,
        workspace_id: membership.data.workspace_id,
        title: "Planning sample property",
        state: "VIC",
        latitude: -37,
        longitude: 144,
        created_by: owner.id,
      })
    ).error,
  );
  // Real API/RLS, no boundary means no provider network dependency in mandatory CI.
  const path = `/api/properties/${id}/planning`;
  const allowed = await page.request.get(origin + path);
  assert.equal(allowed.status(), 200, await allowed.text());
  assert.equal((await allowed.json()).status, "geometry_unavailable");
  const shape = {
    type: "Polygon",
    coordinates: [
      [
        [144, -37],
        [144.001, -37],
        [144.001, -36.999],
        [144, -36.999],
        [144, -37],
      ],
    ],
  };
  assert.ifError(
    (
      await admin
        .from("land_parcels")
        .update({
          geometry: shape,
          metadata: { private_extra: "must-not-travel" },
        })
        .eq("id", id)
    ).error,
  );
  const linkedId = crypto.randomUUID(),
    nearbyId = crypto.randomUUID();
  assert.ifError(
    (
      await admin.from("field_observations").insert([
        {
          id: linkedId,
          workspace_id: membership.data.workspace_id,
          title: "Explicit property visit",
          latitude: -36.9995,
          longitude: 144.0005,
          linked_parcel_id: id,
        },
        {
          id: nearbyId,
          workspace_id: membership.data.workspace_id,
          title: "Nearby unlinked visit",
          latitude: -36.9995,
          longitude: 144.002,
        },
      ])
    ).error,
  );
  const layerId = crypto.randomUUID(),
    linkedFeature = crypto.randomUUID(),
    intersectFeature = crypto.randomUUID();
  assert.ifError(
    (
      await admin.from("spatial_layers").insert({
        id: layerId,
        workspace_id: membership.data.workspace_id,
        name: "Property analysis",
      })
    ).error,
  );
  assert.ifError(
    (
      await admin.from("spatial_features").insert([
        {
          id: linkedFeature,
          workspace_id: membership.data.workspace_id,
          layer_id: layerId,
          feature: {
            type: "Feature",
            id: linkedFeature,
            properties: { name: "Linked distant analysis", parcel_id: id },
            geometry: { type: "Point", coordinates: [145, -37] },
          },
        },
        {
          id: intersectFeature,
          workspace_id: membership.data.workspace_id,
          layer_id: layerId,
          feature: {
            type: "Feature",
            id: intersectFeature,
            properties: { name: "Intersecting analysis" },
            geometry: shape,
          },
        },
      ])
    ).error,
  );
  assert.ifError(
    (
      await admin.from("saved_views").insert({
        workspace_id: membership.data.workspace_id,
        name: "Property review view",
        view: { parcel_ids: [id] },
      })
    ).error,
  );
  const detail = await (
    await page.request.get(`${origin}/api/properties/${id}`)
  ).json();
  assert.equal(detail.property.centroid.length, 2);
  assert(!JSON.stringify(detail).includes("must-not-travel"));
  const linked = await (
    await page.request.get(
      `${origin}/api/properties/${id}/relations?mode=linked`,
    )
  ).json();
  assert.deepEqual(
    linked.observations.map((o) => o.id),
    [linkedId],
  );
  const nearby = await (
    await page.request.get(
      `${origin}/api/properties/${id}/relations?mode=nearby`,
    )
  ).json();
  assert.equal(nearby.observations.length, 2);
  assert.equal(
    nearby.observations.find((o) => o.id === nearbyId).linked_parcel_id,
    null,
  );
  const analysis = await (
    await page.request.get(
      `${origin}/api/properties/${id}/relations?mode=analysis`,
    )
  ).json();
  assert.deepEqual(
    analysis.linked.map((f) => f.id),
    [linkedFeature],
  );
  assert.deepEqual(
    analysis.intersects.map((f) => f.id),
    [intersectFeature],
  );
  assert.equal(analysis.views[0].name, "Property review view");
  const publicContext = await browser.newContext();
  const anon = await publicContext.request.get(origin + path);
  assert.equal(anon.status(), 400);
  assert.equal((await anon.json()).error, "Sign in required");
  await publicContext.close();
  // Fixture replaces only the browser response for deterministic rendering checks.
  await page.route("**" + path, (route) =>
    route.fulfill({
      json: {
        property_id: id,
        status: "supported",
        area_m2: 20000,
        queried_at: new Date().toISOString(),
        layers: [
          {
            catalog_layer_id: "vic-zoning",
            name: "Victoria zoning",
            category: "Planning",
            provider: "Victorian Government",
            source_url: "https://www.planning.vic.gov.au/",
            endpoint:
              "https://spatial.planning.vic.gov.au/gis/rest/services/planning_scheme_zones/MapServer",
            attribution: "Victorian Government",
            limitation: "Indicative mapping, not a planning certificate.",
            update_info: null,
            status: "matched",
            message: "Official controls intersect this property.",
            queried_at: new Date().toISOString(),
            controls: [
              {
                property_id: id,
                catalog_layer_id: "vic-zoning",
                source_feature_id: "0:42",
                control_type: "Zone",
                control_name: "Farming Zone",
                control_code: "FZ",
                value: null,
                relation: "intersects_property",
                intersection_area_m2: 8460,
                intersection_percent: 42.3,
                source_metadata: { ZONE_CODE: "FZ" },
                queried_at: new Date().toISOString(),
              },
            ],
          },
          {
            catalog_layer_id: "vic-flood",
            name: "Victoria flood planning overlays",
            category: "Risk",
            provider: "Victorian Government",
            source_url: "https://www.planning.vic.gov.au/",
            endpoint: "https://plan-gis.mapshare.vic.gov.au/",
            attribution: "Victorian Government",
            limitation: "Absence is not evidence of no flood risk.",
            update_info: null,
            status: "source_unavailable",
            message:
              "Official source temporarily unavailable. Your saved LandOS data is unaffected.",
            controls: [],
            queried_at: new Date().toISOString(),
          },
        ],
      },
    }),
  );
  await page.reload();
  await page.getByRole("button", { name: "parcels", exact: true }).click();
  await page
    .getByRole("button")
    .filter({ hasText: "Planning sample property" })
    .click();
  await page.getByRole("button", { name: "Planning", exact: true }).click();
  await page.getByText("Zone: Farming Zone (FZ)", { exact: true }).waitFor();
  await page.getByText("42.3% of property", { exact: false }).waitFor();
  await page
    .getByText(
      "Official source temporarily unavailable. Your saved LandOS data is unaffected.",
      { exact: true },
    )
    .waitFor();
  await page
    .getByText("Source, provenance and limitations", { exact: true })
    .click();
  await page.getByText("Official feature ID: 0:42", { exact: true }).waitFor();
  await page
    .getByText("Provider: Victorian Government", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Planning", exact: true }).click();
  await page.getByText("Zone: Farming Zone (FZ)", { exact: true }).waitFor();
  await page.unroute("**" + path);
  await page.getByRole("button", { name: "Field", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Explicit property visit · 0 photos",
      exact: true,
    })
    .waitFor();
  await page.getByRole("button", { name: "Nearby", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Nearby unlinked visit · 0 photos",
      exact: true,
    })
    .waitFor();
  await page.getByRole("button", { name: "My Analysis", exact: true }).click();
  await page.getByText("Linked distant analysis", { exact: true }).waitFor();
  await page.getByText("Intersecting analysis", { exact: true }).waitFor();
  await page.getByText("Property review view", { exact: true }).waitFor();
  await page.goto(origin + "/app/settings");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto(origin + "/signup");
  await page.getByLabel("Your name").fill("Other Planning User");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`planning-other-${Date.now()}@landbanker.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("LocalPlanningTest!42");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL("**/app/map");
  const denied = await page.request.get(origin + path);
  assert.equal(denied.status(), 400);
  assert.equal(
    (await denied.json()).error,
    "Property unavailable in this Workspace",
  );
  for (const suffix of [
    "",
    "/relations?mode=analysis",
    "/relations?mode=nearby",
  ]) {
    const other = await page.request.get(
      `${origin}/api/properties/${id}${suffix}`,
    );
    assert.equal(other.status(), 400);
  }
  console.log(
    "PASS: planning API owner/other-workspace/anonymous isolation, readable Zone/Overlays coverage, provenance/failure inspector and persistent property selection.",
  );
} finally {
  await browser.close();
}
