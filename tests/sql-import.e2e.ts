import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { limitedCopySQL } from "../src/lib/import/sql-plan";
import type { Snapshot } from "../src/lib/import/transform";
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
const client = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
const signup = await client.auth.signUp({
  email: `sql-import-${Date.now()}@landbanker.test`,
  password: "LocalSqlImportTest!42",
});
assert.equal(signup.error, null);
const owner = signup.data.user!.id;
const membership = await client
  .from("workspace_memberships")
  .select("workspace_id")
  .single();
assert.equal(membership.error, null);
const workspace = membership.data!.workspace_id;
const snapshot: Snapshot = {
  version: 1,
  source_project: "kcdzzbmkqtuwfzbeqcks",
  exported_at: new Date().toISOString(),
  parcels: [
    {
      id: "sql-source",
      title: "Synthetic SQL copy",
      lat: -37,
      lng: 144,
      notes: "O'Brien; $copy$ '); DELETE FROM public.land_parcels; --",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
    },
  ],
  observations: [],
  media: [],
  layers: [],
};
const args = [
  "compose",
  "--env-file",
  "infra/local/.env",
  "-f",
  "infra/local/compose.yml",
  "exec",
  "-T",
  "db",
  "psql",
  "-h",
  "127.0.0.1",
  "-U",
  "postgres",
  "-d",
  "landbanker",
  "-v",
  "ON_ERROR_STOP=1",
];
const run = (sql: string) =>
  execFileSync("docker", args, {
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
const sql = limitedCopySQL(snapshot, workspace, owner);
run(sql);
let rows = await client.from("land_parcels").select("*");
assert.equal(rows.error, null);
assert.equal(rows.data!.length, 1);
assert.equal(rows.data![0].notes, snapshot.parcels[0].notes);
assert.equal(
  new Date(rows.data![0].created_at).toISOString(),
  "2024-01-01T00:00:00.000Z",
);
await client
  .from("land_parcels")
  .update({ title: "Edited LandOS target" })
  .eq("id", rows.data![0].id);
run(sql);
run(limitedCopySQL(snapshot, workspace, owner, true));
rows = await client.from("land_parcels").select("*");
assert.equal(rows.data!.length, 1);
assert.equal(rows.data![0].title, "Edited LandOS target");
assert.throws(() =>
  run(limitedCopySQL(snapshot, workspace, crypto.randomUUID())),
);
assert.throws(() =>
  limitedCopySQL(
    {
      ...snapshot,
      parcels: Array.from({ length: 11 }, (_, i) => ({ id: String(i) })),
    },
    workspace,
    owner,
  ),
);
console.log(
  "PASS: bounded connector SQL copy, timestamps, literal injection safety, repeat without overwrite, verify-only and registered-owner guard.",
);
