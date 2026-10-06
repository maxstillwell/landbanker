import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(origin + "/signup");
  await page.getByLabel("Your name").fill("Photo Batch Tester");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`photo-${Date.now()}@landbanker.test`);
  await page.getByLabel("Password", { exact: true }).fill("LocalPhotosTest!42");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL("**/app/map");
  await page.getByRole("button", { name: "Add observation" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Native batch test");
  const id = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open("land-banker-field-queue-v1");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const rows = await new Promise((resolve) => {
      const r = db.transaction("drafts").objectStore("drafts").getAll();
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    return rows[0].id;
  });
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  async function emit(type, payload) {
    await page.evaluate(
      ({ type, payload }) =>
        window.LandBankerBridge.receive({ version: 1, type, payload }),
      { type, payload: { observationId: id, ...payload } },
    );
  }
  const save = page.getByRole("button", { name: "Save to Workspace" });
  await emit("photoSelectionStarted", { count: 2 });
  assert.equal(await save.isDisabled(), true);
  await emit("photoSelected", {
    base64,
    mimeType: "image/png",
    filename: "one.png",
  });
  await page.getByText("pending · one.png").waitFor();
  assert.equal(await save.isDisabled(), true);
  await emit("photoSelected", {
    base64,
    mimeType: "image/png",
    filename: "two.png",
  });
  await emit("photoSelectionFinished", { count: 2, failed: 0 });
  await page.getByText("pending · two.png").waitFor();
  await save.click();
  await page
    .getByText("Saved to Workspace. Available on your other devices.")
    .waitFor({ timeout: 45000 });
  const data = await (await page.request.get(origin + "/api/map")).json();
  const record = data.observations.find((o) => o.title === "Native batch test");
  assert.equal(record.field_observation_media.length, 2);
  assert.ok(record.field_observation_media.every((m) => m.url));
  await page.getByRole("button", { name: "Add observation" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Interrupted selection");
  await page.evaluate(async () => {
    const r = indexedDB.open("land-banker-field-queue-v1");
    await new Promise((resolve) => (r.onsuccess = resolve));
    const db = r.result;
    const t = db.transaction("drafts", "readwrite");
    const store = t.objectStore("drafts");
    const rows = await new Promise((resolve) => {
      const r = store.getAll();
      r.onsuccess = () => resolve(r.result);
    });
    store.put({
      ...rows[0],
      photoSelection: { expected: 3, received: 0, finished: false, failed: 0 },
    });
    await new Promise((resolve) => (t.oncomplete = resolve));
    db.close();
  });
  await page.reload();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page
    .getByText("Photo selection is incomplete.", { exact: false })
    .waitFor();
  assert.equal(await save.isDisabled(), true);
  await page
    .getByRole("button", { name: "Continue with imported photos" })
    .click();
  await page
    .locator("input[type=file][multiple]")
    .setInputFiles(
      ["three.png", "four.png"].map((name) => ({
        name,
        mimeType: "image/png",
        buffer: Buffer.from(base64, "base64"),
      })),
    );
  await page.getByText("pending · four.png").waitFor();
  await save.click();
  await page
    .getByText("Saved to Workspace. Available on your other devices.")
    .waitFor({ timeout: 45000 });
  const webData = await (await page.request.get(origin + "/api/map")).json();
  assert.equal(
    webData.observations.find((o) => o.title === "Interrupted selection")
      .field_observation_media.length,
    2,
  );
  console.log(
    "PASS: native batch blocks early save, both photos persist/upload, interrupted selection requires explicit recovery after reload.",
  );
} finally {
  await browser.close();
}
