import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
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
assert.equal(
  env.NEXT_PUBLIC_SUPABASE_URL,
  "http://127.0.0.1:54321",
  "local-only test",
);
const client = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
const { error: signup } = await client.auth.signUp({
  email: `import-${Date.now()}@landbanker.test`,
  password: "LocalImportTest!42",
});
assert.equal(signup, null);
const { data: membership, error } = await client
  .from("workspace_memberships")
  .select("workspace_id")
  .single();
assert.equal(error, null);
const snapshot = {
  version: 1,
  source_project: "kcdzzbmkqtuwfzbeqcks",
  exported_at: new Date().toISOString(),
  parcels: [
    { id: "parcel-test", title: "Synthetic legacy parcel", lat: -37, lng: 144 },
  ],
  observations: [
    {
      id: "obs-test",
      title: "Synthetic visit",
      latitude: -37,
      longitude: 144,
      linked_parcel_id: "parcel-test",
    },
  ],
  media: [
    {
      id: "media-test",
      observation_id: "obs-test",
      storage_path: "unchanged-source/photo.png",
      storage_bucket: "legacy",
      mime_type: "image/png",
      size_bytes: 100,
    },
  ],
  layers: [
    {
      id: "layer-test",
      name: "Synthetic geometry",
      layer_kind: "geojson",
      layer_data: {
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "Point", coordinates: [144, -37] },
            },
          ],
        },
      },
    },
  ],
};
await mkdir("private-imports", { recursive: true });
await writeFile("private-imports/local-fixture.json", JSON.stringify(snapshot));
function run(flag) {
  return execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/import-maxqi.ts",
      "--snapshot",
      "private-imports/local-fixture.json",
      "--workspace",
      membership.workspace_id,
      "--local-test",
      flag,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        ...env,
        LAND_BANKER_PROJECT_REF: "land-banker-local",
        LAND_BANKER_IMPORT_SECRET_KEY: env.LAND_BANKER_SUPABASE_SECRET_KEY,
      },
    },
  );
}
run("--apply");
let report = JSON.parse(
  await readFile("private-imports/import-report.json", "utf8"),
);
assert.equal(report.created, 5);
assert.equal(report.verified, 5);
const { data: parcels } = await client.from("land_parcels").select("id");
await client
  .from("land_parcels")
  .update({ title: "Edited in Land Banker" })
  .eq("id", parcels[0].id);
run("--apply");
report = JSON.parse(
  await readFile("private-imports/import-report.json", "utf8"),
);
assert.equal(report.created, 0);
assert.equal(report.alreadyImported, 5);
run("--verify");
const { data: parcel } = await client
  .from("land_parcels")
  .select("title")
  .single();
assert.equal(
  parcel.title,
  "Edited in Land Banker",
  "repeat import preserves destination edits",
);
const { data: observation } = await client
  .from("field_observations")
  .select("linked_parcel_id")
  .single();
assert.equal(observation.linked_parcel_id, parcels[0].id);
const { data: media } = await client
  .from("field_observation_media")
  .select("upload_status,storage_path,observation_id")
  .single();
assert.equal(media.upload_status, "legacy_pending");
assert.equal(media.storage_path, null);
assert.equal(snapshot.media[0].storage_path, "unchanged-source/photo.png");
console.log(
  "PASS: actual database copy, mapped relationships, apply twice without overwrite, verify, pending media and unchanged synthetic source.",
);
