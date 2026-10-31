// Run every existing suite, retain failures, and report all blocked workflows.
import { spawnSync } from "node:child_process";
const suites = [
  ["tests/professional-layers.e2e.mjs"],
  ["--import", "tsx", "tests/suburb-layers.e2e.mjs"],
  ["tests/field.e2e.mjs"],
  ["tests/spatial.e2e.mjs"],
  ["tests/import.e2e.mjs"],
  ["--import", "tsx", "tests/sql-import.e2e.ts"],
  ["tests/photo-batch.e2e.mjs"],
  ["tests/parcel-multiselect.e2e.mjs"],
  ["tests/drawing-recovery.e2e.mjs"],
  ["tests/parcels.e2e.mjs"],
  ["tests/share-hardening.e2e.mjs"],
  ["tests/planning.e2e.mjs"],
  ["tests/change-feed.e2e.mjs"],
  ["tests/maplibre.e2e.mjs"],
  ["tests/map-quality.e2e.mjs"],
  ["tests/workspace-v2.e2e.mjs"],
  ["tests/map-pages.e2e.mjs"],
];
const failed = [];
for (const args of suites) {
  console.log(`\nE2E SUITE: ${args.at(-1)}`);
  const r = spawnSync(process.execPath, args, {
    stdio: "inherit",
    timeout: 300000,
  });
  if (r.status !== 0) {
    failed.push(args.at(-1));
    console.error(r.error?.message || `Suite failed with exit ${r.status}`);
  }
}
console.log(
  JSON.stringify({
    total: suites.length,
    passed: suites.length - failed.length,
    failed,
  }),
);
if (failed.length) process.exitCode = 1;
