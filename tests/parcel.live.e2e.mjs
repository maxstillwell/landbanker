// Optional live provider contract test. Local Auth/data only; public official GIS reads.
// Not part of deterministic CI: upstream government availability varies.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const origin = "http://localhost:3000";
const b = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  args: ["--no-sandbox"],
});
const c = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await c.newPage();
try {
  await p.goto(`${origin}/signup`);
  await p.getByLabel("Your name").fill("Local parcel tester");
  await p
    .getByLabel("Email", { exact: true })
    .fill(`parcel-${Date.now()}@landos.test`);
  await p.getByLabel("Password", { exact: true }).fill("LocalParcelTest!42");
  await p.getByRole("button", { name: "Create account", exact: true }).click();
  await p.waitForURL("**/app/map");
  for (const [state, q] of [
    ["VIC", "701 Sturt Street Ballarat"],
    ["NSW", "5 James Street Dunoon"],
  ]) {
    console.log("Testing", state, q);
    let r = await p.request.get(
      `${origin}/api/parcels/search?${new URLSearchParams({ state, q })}`,
    );
    let d = await r.json();
    assert.ok(r.ok(), JSON.stringify(d));
    assert.ok(d.results.length, `${state} official address match`);
    const address = d.results[0];
    r = await p.request.get(
      `${origin}/api/parcels/lookup?${new URLSearchParams({ ...address, latitude: String(address.latitude), longitude: String(address.longitude) })}`,
    );
    d = await r.json();
    assert.ok(r.ok(), JSON.stringify(d));
    assert.ok(d.parcels.length, `${state} official boundary`);
    const parcel = d.parcels[0];
    assert.ok(parcel.areaM2 > 0);
    r = await p.request.post(`${origin}/api/parcels`, {
      headers: { Origin: origin },
      data: parcel,
    });
    d = await r.json();
    assert.ok(r.ok(), JSON.stringify(d));
    const id = d.parcel.id;
    r = await p.request.post(`${origin}/api/parcels`, {
      headers: { Origin: origin },
      data: parcel,
    });
    d = await r.json();
    assert.equal(
      d.parcel.id,
      id,
      "repeat save uses same workspace-scoped identity",
    );
  }
  await p.reload();
  await p.getByRole("button", { name: "parcels", exact: true }).click();
  await p.getByLabel("Search address").fill("701 Sturt Street Ballarat");
  await p
    .getByRole("button", { name: "Search properties", exact: true })
    .click();
  await p.locator(".parcel-search .record-row").first().click();
  await p
    .getByRole("button", { name: "Save to Workspace", exact: true })
    .click();
  await p.getByText("Property saved to Workspace.", { exact: true }).waitFor();
  await p.screenshot({ path: "artifacts/landos-property-phone.png" });
  const data = await (await p.request.get(`${origin}/api/map`)).json();
  assert.equal(data.parcels.length, 2);
  assert.deepEqual(
    new Set(data.parcels.map((x) => x.state)),
    new Set(["VIC", "NSW"]),
  );
  assert.ok(
    data.parcels.every(
      (x) => x.geometry && x.workspace_id && x.source_parcel_id,
    ),
  );
  console.log(
    "PASS: live VIC/NSW address → official boundary → area → workspace save → repeat save → reload.",
  );
} finally {
  await b.close();
}
