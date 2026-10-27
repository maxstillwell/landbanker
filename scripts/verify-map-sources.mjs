#!/usr/bin/env node

/**
 * Read-only Gate A verification for the official source inventory.
 * It does not write to Supabase or download/store provider data.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const checks = [
  {
    id: "vic-zoning",
    url: "https://spatial.planning.vic.gov.au/gis/rest/services/planning_scheme_zones/MapServer/0",
    point: { longitude: 143.8503, latitude: -37.5622 },
  },
  {
    id: "nsw-parcels",
    url: "https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Land_Parcel_Property_Theme/MapServer/8",
    point: { longitude: 153.005, latitude: -28.676 },
  },
  {
    id: "nsw-zoning",
    url: "https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer/2",
    point: { longitude: 153.005, latitude: -28.676 },
  },
];

async function request(url) {
  // The managed cloud environment routes outbound HTTPS through curl's proxy
  // configuration. This Gate A script remains read-only and deliberately uses
  // only the fixed official URLs declared above.
  const { stdout } = await execFileAsync(
    "curl",
    ["--fail", "--silent", "--show-error", "--location", "--max-time", "30", url],
    { maxBuffer: 2 * 1024 * 1024 },
  );
  const body = JSON.parse(stdout);
  if (body.error) throw new Error(body.error.message || "provider error");
  return body;
}

async function verify(check) {
  const started = performance.now();
  const metadata = await request(`${check.url}?f=pjson`);
  const params = new URLSearchParams({
    f: "json",
    where: "1=1",
    geometry: `${check.point.longitude},${check.point.latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    returnCountOnly: "true",
  });
  const result = await request(`${check.url}/query?${params}`);
  return {
    id: check.id,
    geometryType: metadata.geometryType || null,
    wkid: metadata.extent?.spatialReference?.wkid || null,
    capabilities: metadata.capabilities || null,
    intersectingFeatures: result.count ?? null,
    durationMs: Math.round(performance.now() - started),
  };
}

const results = [];
for (const check of checks) {
  try {
    results.push({ status: "pass", ...(await verify(check)) });
  } catch (error) {
    results.push({
      id: check.id,
      status: "fail",
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
}

console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
if (results.some((result) => result.status === "fail")) process.exitCode = 1;
