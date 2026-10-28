import { chromium } from "./map-browser.mjs";
import { createClient } from "@supabase/supabase-js";
import { expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// This test only writes synthetic records to the isolated local backend.
const origin = process.env.E2E_APP_URL || "http://localhost:3000";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const env = Object.fromEntries((await readFile(".env.local", "utf8")).trim().split("\n").map((line) => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  const email = `boundary-${Date.now()}@landbanker.test`, password = "BoundaryLocalTest!42";
  await page.goto(origin + "/signup");
  await page.getByLabel("Your name").fill("Boundary fixture");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  try { await page.waitForURL("**/app/map"); }
  catch (error) { throw new Error(`Local signup did not reach the map: ${(await page.locator("[role=alert]").allTextContents()).join("; ")}`, { cause: error }); }
  const workspace = (await (await page.request.get(origin + "/api/workspaces")).json()).current;
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.LAND_BANKER_SUPABASE_SECRET_KEY);
  const id = crypto.randomUUID(), protectedId = crypto.randomUUID(), pointId = crypto.randomUUID();
  const original = { title: "Synthetic legacy property", workspace_id: workspace, latitude: -37.5622, longitude: 143.8503, notes: "Keep this note", metadata: { legacy_key: "keep" } };
  const pointGeometry = { type: "Point", coordinates: [143.8503, -37.5622] };
  const protectedGeometry = { type: "Polygon", coordinates: [[[143.85, -37.56], [143.86, -37.56], [143.86, -37.55], [143.85, -37.55], [143.85, -37.56]]] };
  const inserted = await admin.from("land_parcels").insert([{ ...original, id }, { ...original, id: protectedId, title: "Synthetic protected property", geometry: protectedGeometry }, { ...original, id: pointId, title: "Synthetic location point", geometry: pointGeometry }]);
  assert.equal(inserted.error, null);
  await page.route("**/api/parcels/lookup?**", async (route) => {
    await route.fulfill({ json: { parcels: [1, 2].map((n) => ({ state: "VIC", sourceId: `fixture-${n}`, address: `Candidate ${n}`, lot: String(n), plan: "SYNTHETIC", latitude: -37.5622, longitude: 143.8503, geometry: { type: "Polygon", coordinates: [[[143.85, -37.56], [143.86, -37.56], [143.86, -37.55], [143.85, -37.55], [143.85, -37.56]]] } })) } });
  });
  await page.reload();
  if (await page.getByRole("button", { name: "Open Inspector" }).isVisible()) await page.getByRole("button", { name: "Open Inspector" }).click();
  await page.getByRole("button", { name: "parcels", exact: true }).click();
  await page.getByRole("button").filter({ hasText: "Synthetic legacy property" }).click();
  await expect(page.getByText("Location only — boundary not linked.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Find official parcel boundary" }).click();
  await expect(page.getByText("Candidate 1", { exact: false })).toBeVisible();
  await page.getByLabel(/Candidate 1/).check();
  await page.getByLabel(/Candidate 2/).check();
  const previewOnly = await admin.from("land_parcels").select("geometry,metadata").eq("id", id).single();
  assert.equal(previewOnly.data.geometry, null);
  assert.deepEqual(previewOnly.data.metadata, original.metadata);
  await page.unroute("**/api/parcels/lookup?**");
  const headers = { Origin: origin };
  const fake = { state: "VIC", latitude: -37.5622, longitude: 143.8503, sourceId: "unverified" };
  let response = await page.request.post(`${origin}/api/properties/${id}/boundary`, { headers, data: { candidates: [fake] } });
  assert.equal(response.status(), 400);
  response = await page.request.post(`${origin}/api/properties/${protectedId}/boundary`, { headers, data: { confirmed: true, candidates: [fake] } });
  assert.equal(response.status(), 400);
  const protectedRow = await admin.from("land_parcels").select("geometry,metadata,notes").eq("id", protectedId).single();
  assert.deepEqual(protectedRow.data.geometry, protectedGeometry);
  assert.deepEqual(protectedRow.data.metadata, original.metadata);
  response = await page.request.post(`${origin}/api/properties/${id}/boundary`, { headers, data: { confirmed: true, candidates: [fake, fake] } });
  assert.equal(response.status(), 400);
  const before = await admin.from("land_parcels").select("geometry,metadata,notes").eq("id", id).single();
  assert.equal(before.data.geometry, null);
  assert.deepEqual(before.data.metadata, original.metadata);

  // Live official-provider verification: distinct, real candidate IDs are
  // attached only to this synthetic local property, never to the Balliang record.
  const parcels = [];
  for (const address of ["701 Sturt Street, Ballarat VIC", "1 Sturt Street, Ballarat VIC"]) {
    const search = await page.request.get(`${origin}/api/parcels/search?${new URLSearchParams({ q: address, state: "VIC", mode: "address" })}`);
    assert.equal(search.status(), 200, await search.text());
    const match = (await search.json()).results[0];
    assert.ok(match, `No official address match for ${address}`);
    const lookup = await page.request.get(`${origin}/api/parcels/lookup?${new URLSearchParams({ state: "VIC", address: "", latitude: String(match.latitude), longitude: String(match.longitude) })}`);
    assert.equal(lookup.status(), 200, await lookup.text());
    const parcel = (await lookup.json()).parcels[0];
    assert.ok(parcel?.geometry);
    parcels.push(parcel);
  }
  assert.notEqual(parcels[0].sourceId, parcels[1].sourceId);
  const candidates = parcels.map((p) => ({ state: p.state, sourceId: p.sourceId, latitude: p.latitude, longitude: p.longitude }));
  response = await page.request.post(`${origin}/api/properties/${id}/boundary`, { headers, data: { confirmed: true, candidates }, timeout: 60000 });
  assert.equal(response.status(), 200, await response.text());
  const after = await admin.from("land_parcels").select("geometry,metadata,notes,title").eq("id", id).single();
  assert.equal(after.data.geometry.type, "MultiPolygon");
  assert.equal(after.data.metadata.legacy_key, "keep");
  assert.equal(after.data.metadata.landos_boundary_association_v1.parcels.length, 2);
  assert.equal(after.data.notes, original.notes);
  assert.equal(after.data.title, original.title);
  response = await page.request.post(`${origin}/api/properties/${id}/boundary`, { headers, data: { confirmed: true, candidates } });
  assert.equal(response.status(), 400);
  response = await page.request.post(`${origin}/api/properties/${pointId}/boundary`, { headers, data: { confirmed: true, candidates: [candidates[0]] }, timeout: 60000 });
  assert.equal(response.status(), 200, await response.text());
  const pointAfter = await admin.from("land_parcels").select("geometry,metadata,notes").eq("id", pointId).single();
  assert.equal(pointAfter.data.geometry.type, "MultiPolygon");
  assert.deepEqual(pointAfter.data.metadata.landos_boundary_association_v1.original_geometry, pointGeometry);
  assert.equal(pointAfter.data.metadata.legacy_key, "keep");
  console.log("PASS: verified multi-parcel association on a synthetic property, metadata preservation and no geometry overwrite.");
} finally { await browser.close(); }
