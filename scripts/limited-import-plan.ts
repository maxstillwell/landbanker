import { readFile, writeFile } from "node:fs/promises";
import { assertIndependentBackend } from "../src/lib/config";
import { limitedCopySQL } from "../src/lib/import/sql-plan";
import type { Snapshot } from "../src/lib/import/transform";
const args = process.argv.slice(2),
  value = (key: string) => args[args.indexOf(key) + 1];
for (const key of [
  "--snapshot",
  "--workspace",
  "--owner",
  "--project",
  "--output",
])
  if (!args.includes(key)) throw new Error(`Required ${key}`);
const project = value("--project");
if (project !== "gksyipjxhrolsgztfyer")
  throw new Error(
    "Limited connector copy must target the verified independent project",
  );
assertIndependentBackend(`https://${project}.supabase.co`);
const output = value("--output");
if (!output.startsWith("private-imports/") || !output.endsWith(".sql"))
  throw new Error("Reviewable SQL must stay in ignored private-imports");
const snapshot = JSON.parse(
  await readFile(value("--snapshot"), "utf8"),
) as Snapshot;
const sql = limitedCopySQL(
  snapshot,
  value("--workspace"),
  value("--owner"),
  args.includes("--verify-only"),
);
await writeFile(output, sql, { mode: 0o600 });
console.log(
  "Bounded copy plan written; no database connected, no source/destination mutation.",
);
