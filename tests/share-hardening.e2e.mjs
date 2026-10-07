import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
const env = Object.fromEntries(
  (await readFile(".env.local", "utf8"))
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
const origin = process.env.E2E_APP_URL || "http://localhost:3000";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const client = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.LAND_BANKER_SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
const email = `shares-${Date.now()}@landbanker.test`,
  password = "LocalShareHardening!42";
const signup = await client.auth.signUp({ email, password });
assert.ifError(signup.error);
const member = await client
  .from("workspace_memberships")
  .select("workspace_id")
  .single();
assert.ifError(member.error);
const workspaceId = member.data.workspace_id,
  layerId = crypto.randomUUID(),
  viewId = crypto.randomUUID();
const feature = {
  type: "Feature",
  id: crypto.randomUUID(),
  properties: { name: "Allowed shape", note: "PRIVATE ANALYSIS NOTE" },
  geometry: { type: "Point", coordinates: [151, -33] },
};
assert.ifError(
  (
    await client.rpc("save_layer_features", {
      p_workspace: workspaceId,
      p_id: layerId,
      p_name: "Shared analysis",
      p_geojson: { type: "FeatureCollection", features: [feature] },
    })
  ).error,
);
assert.ifError(
  (
    await client.from("saved_views").insert({
      id: viewId,
      workspace_id: workspaceId,
      name: "Alpha 2 review",
      view: {
        latitude: -33,
        longitude: 151,
        zoom: 14,
        parcel_ids: [],
        layer_ids: [layerId],
        official_layers: [],
      },
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
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await page.goto(origin + "/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/app/map");
  await page.getByRole("button", { name: "layers", exact: true }).click();
  const viewScope = {
    latitude: -33,
    longitude: 151,
    zoom: 14,
    parcel_ids: [],
    layer_ids: [layerId],
    official_layers: [],
  };
  const scopeResponse = await page.request.post(origin + "/api/views/preview", {
    headers: { Origin: origin },
    data: { view: viewScope },
  });
  assert.equal(scopeResponse.status(), 200);
  const scope = await scopeResponse.json();
  assert.equal(scope.features, 1);
  assert.equal(scope.user_layers, 1);
  assert.equal(scope.private_observations, "not_copied");
  assert(!JSON.stringify(scope).includes("PRIVATE"));
  const foreign = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  assert.ifError(
    (
      await foreign.auth.signUp({
        email: `foreign-view-${Date.now()}@landbanker.test`,
        password,
      })
    ).error,
  );
  const foreignMembership = await foreign
    .from("workspace_memberships")
    .select("workspace_id")
    .single();
  assert.ifError(foreignMembership.error);
  const foreignLayer = crypto.randomUUID();
  assert.ifError(
    (
      await foreign.rpc("save_layer_features", {
        p_workspace: foreignMembership.data.workspace_id,
        p_id: foreignLayer,
        p_name: "Private other-tenant layer",
        p_geojson: {
          type: "FeatureCollection",
          features: [{ ...feature, id: crypto.randomUUID() }],
        },
      })
    ).error,
  );
  const deniedPreview = await page.request.post(origin + "/api/views/preview", {
    headers: { Origin: origin },
    data: { view: { ...viewScope, layer_ids: [foreignLayer] } },
  });
  assert.equal(deniedPreview.status(), 400);
  assert(!Object.hasOwn(await deniedPreview.json(), "features"));
  await page
    .getByRole("button", { name: "Save current map view", exact: true })
    .click();
  const review = page.getByRole("region", { name: "Saved View preview" });
  await expect(review).toContainText(
    "Private observations, notes and photos are not copied",
  );
  await expect(review).toContainText("off-screen");
  assert.equal(
    (await client.from("saved_views").select("id")).data.length,
    1,
    "preview must not write a View",
  );
  await review
    .getByRole("button", { name: "Cancel view preview", exact: true })
    .click();
  await expect(review).toHaveCount(0);
  await page
    .getByRole("button", { name: "Save current map view", exact: true })
    .click();
  await page
    .getByLabel("View name", { exact: true })
    .fill("Reviewed private map");
  await page
    .getByRole("button", { name: "Save reviewed view", exact: true })
    .click();
  await page
    .getByText("Map View saved to Workspace.", { exact: true })
    .waitFor();
  await expect(
    page.getByRole("button", { name: "Reviewed private map", exact: true }),
  ).toBeVisible();
  assert.equal((await client.from("saved_views").select("id")).data.length, 2);
  await page
    .getByLabel("Saved View to share")
    .selectOption(viewId);
  await page.getByRole("button", { name: "Share view", exact: true }).click();
  await page.getByText("This link will include:", { exact: true }).waitFor();
  await expect(page.locator(".share-scope")).toContainText(
    "Private observations and photos",
  );
  assert.equal(
    (await (await page.request.get(origin + "/api/shares")).json()).shares
      .length,
    0,
    "preview does not create a link",
  );
  const extra = {
    ...feature,
    id: crypto.randomUUID(),
    properties: { name: "New shape" },
  };
  assert.ifError(
    (
      await client.rpc("save_layer_features", {
        p_workspace: workspaceId,
        p_id: layerId,
        p_name: "Shared analysis",
        p_geojson: { type: "FeatureCollection", features: [feature, extra] },
      })
    ).error,
  );
  await page
    .getByRole("button", { name: "Create read-only link", exact: true })
    .click();
  await page
    .getByText(
      "Share scope changed. Review it again before creating the link.",
      { exact: true },
    )
    .waitFor();
  await page.getByRole("button", { name: "Share view", exact: true }).click();
  await expect(page.locator(".share-scope")).toContainText(
    "2 current saved features",
  );
  await page
    .getByRole("button", { name: "Create read-only link", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Open shared view", exact: true })
    .waitFor();
  const url = await page
      .getByRole("link", { name: "Open shared view", exact: true })
      .getAttribute("href"),
    token = url.split("/").at(-1);
  const links = (await (await page.request.get(origin + "/api/shares")).json())
    .shares;
  assert.equal(links.length, 1);
  assert(!JSON.stringify(links).includes(token));
  assert(!JSON.stringify(links).includes("token_hash"));
  const publicContext = await browser.newContext(),
    visitor = await publicContext.newPage();
  assert.equal(
    (
      await visitor.request.post(origin + "/api/views/preview", {
        headers: { Origin: origin },
        data: { view: viewScope },
      })
    ).status(),
    400,
  );
  const projection = await visitor.request.get(
    `${origin}/api/published/${token}`,
  );
  assert.equal(projection.status(), 200);
  assert(!JSON.stringify(await projection.json()).includes("PRIVATE"));
  assert.equal(projection.headers()["cache-control"], "no-store");
  await page.reload();
  await page.getByRole("button", { name: "layers", exact: true }).click();
  assert.equal(
    await page
      .getByRole("link", { name: "Open shared view", exact: true })
      .getAttribute("href"),
    url,
  );
  await page.getByRole("button", { name: "Revoke link", exact: true }).click();
  await page.getByText("Share link revoked.", { exact: true }).waitFor();
  assert.equal(
    (await visitor.request.get(`${origin}/api/published/${token}`)).status(),
    404,
  );
  const expiredToken = randomBytes(32).toString("base64url");
  assert.ifError(
    (
      await admin.from("share_links").insert({
        workspace_id: workspaceId,
        created_by: signup.data.user.id,
        token_hash: createHash("sha256").update(expiredToken).digest("hex"),
        resource_type: "saved_view",
        resource_ids: [viewId],
        expires_at: new Date(Date.now() - 86400000).toISOString(),
        manifest: { name: "SECRET WORKSPACE METADATA" },
      })
    ).error,
  );
  const expired = await visitor.request.get(
    `${origin}/api/published/${expiredToken}`,
  );
  assert.equal(expired.status(), 410);
  assert.deepEqual(await expired.json(), {
    error: "This shared view has expired.",
  });
  await visitor.goto(`${origin}/share/${expiredToken}`);
  await visitor
    .getByText("This shared view has expired.", { exact: true })
    .waitFor();
  assert(!(await visitor.content()).includes("SECRET WORKSPACE METADATA"));
  let rateLimited = false;
  for (let i = 0; i < 65; i++) {
    const response = await visitor.request.get(
      `${origin}/api/published/${expiredToken}`,
    );
    if (response.status() === 429) {
      assert.equal(response.headers()["retry-after"], "60");
      rateLimited = true;
      break;
    }
  }
  assert(rateLimited, "same-instance public endpoint rate budget enforced");
  await publicContext.close();
  console.log(
    "PASS: Saved View scope counts/no-write/cancel/save and owner/foreign/anon guards; explicit/fresh share scope, no preview writes, scope-change rejection, device URL persistence, manager list without tokens, private exclusions, immediate revoke, expiry without metadata, bounded public rate limiting.",
  );
} finally {
  await browser.close();
}
