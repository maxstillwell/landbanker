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
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  async function signup(name) {
    await page.goto(origin + "/signup");
    await page.getByLabel("Your name").fill(name);
    const signupEmail = `parcel-${Date.now()}@landbanker.test`;
    await page.getByLabel("Email", { exact: true }).fill(signupEmail);
    await page
      .getByLabel("Password", { exact: true })
      .fill("LocalParcelTest!42");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await page.waitForURL("**/app/map");
    return signupEmail;
  }
  const accountEmail = await signup("Parcel Test");
  // Deterministic result hierarchy/history fixture; live provider checks remain separate below.
  await page.route("**/api/parcels/search?**", async (route) => {
    if (
      new URL(route.request().url()).searchParams.get("q") !==
      "Recent local search"
    )
      return route.continue();
    await route.fulfill({
      json: {
        results: [],
        parcels: [1, 2].map((n) => ({
          address: "Synthetic multiple-parcel address",
          state: "VIC",
          source: "Local test provider",
          sourceId: `SYNTHETIC-${n}`,
          lot: String(n),
          plan: "PS123",
          areaM2: 1000,
          latitude: -37.5,
          longitude: 143.8,
        })),
      },
    });
  });
  await page.getByRole("button", { name: "parcels", exact: true }).click();
  await page
    .getByLabel("Search address", { exact: true })
    .fill("Recent local search");
  await page
    .getByRole("button", { name: "Search properties", exact: true })
    .click();
  await expect(
    page
      .getByRole("button")
      .filter({ hasText: "Synthetic multiple-parcel address" }),
  ).toHaveCount(2);
  await expect(page.locator(".parcel-search")).toContainText("Lot 1 · PS123");
  await expect(page.locator(".parcel-search")).toContainText("1,000 m²");
  await expect(
    page.getByRole("button", { name: "Save to Workspace", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "parcels", exact: true }).click();
  await page.getByText("Recent searches", { exact: true }).click();
  await page
    .getByRole("button", {
      name: "Recent local search · VIC · Address",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Search address", { exact: true })).toHaveValue(
    "Recent local search",
  );
  if (process.env.LANDOS_LIVE_OFFICIAL_TEST === "1") {
    for (const [state, q] of [
      ["VIC", "701 Sturt Street, Ballarat VIC 3350"],
      ["NSW", "5 James St, Dunoon NSW"],
    ]) {
      const search = await page.request.get(
        `${origin}/api/parcels/search?${new URLSearchParams({ q, state })}`,
      );
      assert.equal(search.status(), 200, await search.text());
      const addresses = (await search.json()).results;
      assert.ok(addresses.length);
      const address = addresses[0];
      const lookup = await page.request.get(
        `${origin}/api/parcels/lookup?${new URLSearchParams({ ...address, latitude: String(address.latitude), longitude: String(address.longitude) })}`,
      );
      assert.equal(lookup.status(), 200, await lookup.text());
      const parcel = (await lookup.json()).parcels[0];
      assert.ok(parcel.geometry);
      for (let i = 0; i < 2; i++) {
        const saved = await page.request.post(origin + "/api/parcels", {
          headers: { Origin: origin },
          data: parcel,
        });
        assert.equal(saved.status(), 200, await saved.text());
      }
      const identifier = await page.request.get(
        `${origin}/api/parcels/search?${new URLSearchParams({ state, mode: "identifier", q: `${state === "VIC" ? "PFI" : "CADID"}: ${parcel.sourceId}` })}`,
      );
      assert.equal(identifier.status(), 200, await identifier.text());
      assert(
        (await identifier.json()).parcels.some(
          (p) => p.sourceId === parcel.sourceId,
        ),
      );
      const map = await (await page.request.get(origin + "/api/map")).json();
      assert.equal(
        map.parcels.filter((p) => p.source_parcel_id === parcel.sourceId)
          .length,
        1,
      );
    }
    const multi = await page.request.get(
      `${origin}/api/parcels/search?state=NSW&q=Old%20Northern%20Road`,
    );
    assert.equal(multi.status(), 200, await multi.text());
    assert((await multi.json()).results.length > 1);
  }
  if (process.env.LANDOS_LIVE_OFFICIAL_TEST === "1") {
    const library = await (
      await page.request.get(origin + "/api/layer-library")
    ).json();
    const flood = library.catalog.find(
      (l) => l.name === "Victoria flood planning overlays",
    );
    assert.ok(flood);
    const legend = await page.request.get(
      `${origin}/api/layer-library/${flood.id}/legend`,
    );
    assert.equal(legend.status(), 200, await legend.text());
    assert((await legend.json()).symbols.length > 0);
  }
  // Deterministic local fixture verifies the saved-property inspector/filter/removal and tenant perimeter.
  const auth = (await admin.auth.admin.listUsers()).data.users.find(
    (u) => u.email === accountEmail,
  );
  assert.ok(auth);
  const member = await admin
    .from("workspace_memberships")
    .select("workspace_id")
    .eq("user_id", auth.id)
    .single();
  assert.ifError(member.error);
  const id = crypto.randomUUID();
  const seeded = await admin.from("land_parcels").insert({
    id,
    workspace_id: member.data.workspace_id,
    title: "Synthetic saved property",
    address: "Synthetic local road",
    state: "VIC",
    source: "Test source",
    source_parcel_id: "TEST-42",
    latitude: -37,
    longitude: 145,
    hectares: 2,
    created_by: auth.id,
    metadata: {
      source_url: "https://plan-gis.mapshare.vic.gov.au/",
      retrieved_at: new Date().toISOString(),
      private_test_value: "must-not-travel",
    },
  });
  assert.ifError(seeded.error);
  await page.reload();
  await page.getByRole("button", { name: "parcels", exact: true }).click();
  await page.getByLabel("Search saved properties").fill("TEST-42");
  await page
    .getByRole("button")
    .filter({ hasText: "Synthetic saved property" })
    .click();
  await expect(
    page
      .locator(".property-details")
      .getByRole("link", { name: "Official source" }),
  ).toBeVisible();
  const payload = await (await page.request.get(origin + "/api/map")).json();
  assert(!JSON.stringify(payload).includes("must-not-travel"));
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Remove from Workspace", exact: true })
    .click();
  await page
    .getByText("Property removed from Workspace.", { exact: true })
    .waitFor();
  assert(
    !(await (await page.request.get(origin + "/api/map")).json()).parcels.some(
      (p) => p.id === id,
    ),
  );
  const protectedId = crypto.randomUUID();
  assert.ifError(
    (
      await admin.from("land_parcels").insert({
        id: protectedId,
        workspace_id: member.data.workspace_id,
        title: "Tenant A property",
        state: "VIC",
        source_parcel_id: "LINKED-42",
        latitude: -37,
        longitude: 145,
      })
    ).error,
  );
  await page.reload();
  await page.getByRole("button", { name: "parcels", exact: true }).click();
  await page.getByLabel("Search saved properties").fill("LINKED-42");
  await page
    .getByRole("button")
    .filter({ hasText: "Tenant A property" })
    .click();
  await page.getByRole("button", { name: "Field", exact: true }).click();
  await page
    .getByRole("button", { name: "Add property observation", exact: true })
    .click();
  await page
    .getByText("Linked property: Tenant A property", { exact: true })
    .waitFor();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Linked field inspection");
  await page
    .getByRole("button", { name: "Save to Workspace ↗", exact: true })
    .click();
  await page
    .getByText("Saved to Workspace. Available on your other devices.", {
      exact: true,
    })
    .waitFor();
  const fieldRecord = (
    await (await page.request.get(origin + "/api/map")).json()
  ).observations.find((o) => o.title === "Linked field inspection");
  assert.equal(fieldRecord.linked_parcel_id, protectedId);
  await page.reload();
  await page.getByRole("button", { name: "parcels", exact: true }).click();
  await page.getByLabel("Search saved properties").fill("LINKED-42");
  await page
    .getByRole("button")
    .filter({ hasText: "Tenant A property" })
    .click();
  await page.getByRole("button", { name: "Field", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Linked field inspection · 0 photos",
      exact: true,
    })
    .waitFor();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Remove from Workspace", exact: true })
    .click();
  await page
    .getByText(
      "This property has linked records. Preserve or relink those records before removing it.",
      { exact: true },
    )
    .waitFor();
  await page.goto(origin + "/app/settings");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await signup("Parcel Other Test");
  await page.getByRole("button", { name: "parcels", exact: true }).click();
  await expect(page.getByText("Recent searches", { exact: true })).toHaveCount(
    0,
  );
  const denied = await page.request.delete(
    `${origin}/api/parcels?id=${protectedId}`,
    { headers: { Origin: origin } },
  );
  assert.equal(denied.status(), 400);
  assert(
    (
      await admin
        .from("land_parcels")
        .select("id")
        .eq("id", protectedId)
        .single()
    ).data,
  );
  console.log(
    `PASS: saved-property filter/source/removal, minimal provenance, tenant-safe deletion, multi-parcel choice and scoped recent-search reload${process.env.LANDOS_LIVE_OFFICIAL_TEST === "1" ? ", live VIC/NSW address/identifier lookup and duplicate prevention" : ""}.`,
  );
} finally {
  await browser.close();
}
