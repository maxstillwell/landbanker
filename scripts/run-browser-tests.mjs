// Run every existing suite, retain failures, and report all blocked workflows.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const suites = [
  ["tests/professional-layers.e2e.mjs"],
  ["--import", "tsx", "tests/suburb-layers.e2e.mjs"],
  ["--import", "tsx", "tests/nsw-layers.e2e.mjs"],
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
const failed = [], results = [];
const startedAt = new Date().toISOString();
for (const args of suites) {
  console.log(`\nE2E SUITE: ${args.at(-1)}`);
  const started = performance.now();
  const r = spawnSync(process.execPath, args, {
    stdio: "inherit",
    timeout: 300000,
  });
  const result = {suite:args.at(-1),status:r.status === 0 ? "pass" : "fail",milliseconds:Math.round(performance.now()-started),exitCode:r.status,signal:r.signal,error:r.error?.message || null};
  results.push(result);
  console.log("E2E RESULT: " + JSON.stringify(result));
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

mkdirSync("artifacts",{recursive:true});
writeFileSync("artifacts/e2e-report.json",JSON.stringify({startedAt,completedAt:new Date().toISOString(),total:suites.length,passed:suites.length-failed.length,failed,results},null,2)+"\n");
