import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
// Real local Supabase Auth/PostgREST/Storage. Never point this test at production.
const origin = process.env.E2E_APP_URL || "http://localhost:3000";
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const localEnv = await readFile(".env.local", "utf8");
assert.match(
  localEnv,
  /^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:54321$/m,
  "isolated local backend required",
);
if (process.env.NEXT_PUBLIC_SUPABASE_URL)
  assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {}),
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: -33.8688, longitude: 151.2093, accuracy: 8 },
  permissions: ["geolocation"],
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const email = `field-${Date.now()}@landbanker.test`;
let password = "LocalFieldTest!42";
async function login(p, mail = email) {
  await p.goto(`${origin}/login`);
  await p.getByLabel("Email", { exact: true }).fill(mail);
  await p.getByLabel("Password", { exact: true }).fill(password);
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForURL("**/app/map");
}
try {
  await page.goto(`${origin}/signup`);
  await page.getByLabel("Your name").fill("Local Field Tester");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL("**/app/map", { timeout: 60000 });
  await page.getByRole("button", { name: "Locate Me", exact: true }).click();
  await page.getByText("Accuracy ±8 m", { exact: true }).waitFor();
  const bluePoint = page.locator('path[fill="#4b91f1"]').last();
  await bluePoint.waitFor({ state: "visible" });
  const pointBox = await bluePoint.boundingBox();
  const sheetBox = await page.locator(".inspector").boundingBox();
  assert.ok(
    pointBox.y > 100 && pointBox.y + pointBox.height < sheetBox.y - 70,
    "GPS point is visible above mobile sheet/action button",
  );
  await page.getByRole("button", { name: "Add observation" }).click();
  const title = `Field inspection ${Date.now()}`;
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page
    .getByLabel("Field notes")
    .fill("Gate access confirmed. Desktop should see this exact record.");
  // Valid one-pixel PNG, uploaded to actual local private Storage.
  await page.locator("input[type=file][multiple]").setInputFiles({
    name: "field.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByText("pending · field.png").waitFor();
  await page.getByRole("button", { name: "Save to Workspace" }).click();
  await page
    .getByText("Saved to Workspace. Available on your other devices.")
    .waitFor({ timeout: 45000 });
  let data = await (await page.request.get(`${origin}/api/map`)).json();
  const observation = data.observations.find((o) => o.title === title);
  assert.ok(observation, "saved observation exists");
  assert.equal(observation.latitude, -33.8688);
  assert.equal(observation.field_observation_media.length, 1);
  assert.equal(
    observation.field_observation_media[0].upload_status,
    "uploaded",
  );
  const signed = await page.request.get(
    observation.field_observation_media[0].url,
  );
  assert.equal(signed.status(), 200, "signed photo is readable");
  await mkdir("artifacts", { recursive: true });
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll(".leaflet-tile")].filter(
        (image) => image.complete && image.naturalWidth > 0,
      ).length >= 4,
  );
  await page.screenshot({ path: "artifacts/iphone-field.png", fullPage: true });
  await page.reload();
  await page.getByRole("button", { name: "Add observation" }).waitFor();
  assert.match(page.url(), /\/app\/map$/, "session survives reload");
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const desktop = await desktopContext.newPage();
  await login(desktop);
  const desktopData = await (
    await desktop.request.get(`${origin}/api/map`)
  ).json();
  assert.ok(
    desktopData.observations.some((o) => o.id === observation.id),
    "independent desktop session sees same record",
  );
  await desktop.waitForFunction(
    () =>
      [...document.querySelectorAll(".leaflet-tile")].filter(
        (image) => image.complete && image.naturalWidth > 0,
      ).length >= 8,
  );
  await desktop.screenshot({ path: "artifacts/desktop-field.png" });
  await desktop.setViewportSize({ width: 1180, height: 820 });
  await desktop.waitForFunction(() =>
    [...document.querySelectorAll(".leaflet-tile")].every(
      (image) => image.complete,
    ),
  );
  await desktop.screenshot({ path: "artifacts/ipad-landscape.png" });
  // Temporary API outage: record/photo must survive a reload and explicit retry.
  await page.getByRole("button", { name: "Add observation" }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Weak signal durable retry");
  await page.locator("input[type=file][multiple]").setInputFiles({
    name: "retry.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByText("pending · retry.png").waitFor();
  await page.route("**/api/observations", (r) => r.abort());
  await page.getByRole("button", { name: "Save to Workspace" }).click();
  await page
    .getByText("Saved on this device. Retry when reception improves.")
    .waitFor();
  await page.reload();
  await page.getByText("Weak signal durable retry", { exact: true }).waitFor();
  await page.unroute("**/api/observations");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page
    .getByText("Saved to Workspace. Available on your other devices.")
    .waitFor({ timeout: 45000 });
  data = await (await page.request.get(`${origin}/api/map`)).json();
  assert.equal(
    data.observations.filter((o) => o.title === "Weak signal durable retry")
      .length,
    1,
  );
  assert.equal(
    data.observations.find((o) => o.title === "Weak signal durable retry")
      .field_observation_media.length,
    1,
  );
  const layerId = crypto.randomUUID();
  const layer = await page.request.post(`${origin}/api/layers`, {
    headers: { Origin: origin },
    data: {
      id: layerId,
      name: "Explicit shared layer",
      geojson: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { label: "Shared point" },
            geometry: { type: "Point", coordinates: [151.2093, -33.8688] },
          },
        ],
      },
    },
  });
  assert.equal(layer.status(), 200);
  const view = await page.request.post(`${origin}/api/views`, {
    headers: { Origin: origin },
    data: {
      id: crypto.randomUUID(),
      name: "Inspection view",
      view: { latitude: -33.8688, longitude: 151.2093, zoom: 16 },
    },
  });
  assert.equal(view.status(), 200);
  const share = await page.request.post(`${origin}/api/shares`, {
    headers: { Origin: origin },
    data: { resource_type: "spatial_layer", resource_ids: [layerId], days: 1 },
  });
  assert.equal(share.status(), 200);
  const link = await share.json();
  const token = new URL(link.url).pathname.split("/").pop();
  const anonymous = await browser.newContext();
  const publicResponse = await anonymous.request.get(
    `${origin}/api/published/${token}`,
  );
  assert.equal(publicResponse.status(), 200);
  const published = await publicResponse.json();
  assert.equal(published.resources.length, 1);
  assert.equal(published.resources[0].id, layerId);
  assert.equal(published.resources[0].metadata, undefined);
  assert.equal(
    published.observations,
    undefined,
    "no unrelated records published",
  );
  const revoked = await page.request.delete(`${origin}/api/shares`, {
    headers: { Origin: origin },
    data: { id: link.id },
  });
  assert.equal(revoked.status(), 200);
  assert.equal(
    (await anonymous.request.get(`${origin}/api/published/${token}`)).status(),
    404,
  );
  await anonymous.close();
  const attack = await page.request.post(`${origin}/api/observations`, {
    headers: { Origin: "https://untrusted.invalid" },
    data: {},
  });
  assert.equal(attack.status(), 400, "foreign-origin write rejected");
  const secondContext = await browser.newContext();
  const second = await secondContext.newPage();
  await second.goto(`${origin}/signup`);
  await second.getByLabel("Your name").fill("Separate Tenant");
  await second
    .getByLabel("Email", { exact: true })
    .fill(`tenant-${Date.now()}@landbanker.test`);
  await second.getByLabel("Password", { exact: true }).fill(password);
  await second
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await second.waitForURL("**/app/map");
  const isolated = await (await second.request.get(`${origin}/api/map`)).json();
  assert.equal(
    isolated.observations.length,
    0,
    "different user sees only own workspace",
  );
  await secondContext.close();
  await page.goto(`${origin}/app/settings`);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("**/login");
  await page.goto(`${origin}/app/map`);
  await page.waitForURL("**/login?**");
  await page.goto(`${origin}/forgot-password`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send recovery email" }).click();
  await page
    .getByText("If an account exists, a recovery email will arrive shortly.")
    .waitFor();
  let mail;
  for (let i = 0; i < 20; i++) {
    const inbox = await (
      await fetch("http://127.0.0.1:54324/api/v1/messages")
    ).json();
    mail = inbox.messages.find((m) => m.To?.some((t) => t.Address === email));
    if (mail) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  assert.ok(mail, "real recovery email received by local Mailpit");
  const detail = await (
    await fetch(`http://127.0.0.1:54324/api/v1/message/${mail.ID}`)
  ).json();
  const href = detail.HTML.match(
    /href="([^"]*auth\/v1\/verify[^"]*)"/,
  )?.[1]?.replaceAll("&amp;", "&");
  assert.ok(href, "recovery link exists");
  await page.goto(href);
  await page.waitForURL("**/app/reset-password", { timeout: 30000 });
  password = "LocalChangedPassword!42";
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Save password" }).click();
  await page.waitForURL("**/app/map");
  await page.goto(`${origin}/app/settings`);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("**/login");
  await login(page);
  console.log(
    "PASS: real signup/workspace, GPS/photo upload, desktop sync, session reload, durable retry, tenant isolation, CSRF rejection, logout, recovery email/password reset, layers/views and scoped anonymous sharing/revoke.",
  );
  assert.deepEqual(errors, [], "no browser runtime errors");
  await desktopContext.close();
} finally {
  await browser.close();
}
