import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Map as MapLibreMap } from "maplibre-gl";
import { terrainConfig, terrainElevation, applyTerrain, TERRAIN_SOURCE, elevationProfile, profileSummary, parcelElevation } from "../src/lib/map/terrain";

test("terrain requires a secure source and attribution", () => {
  assert.equal(terrainConfig("https://example.test/dem.json", ""), null);
  assert.equal(terrainConfig("http://example.test/dem.json", "source"), null);
  assert.ok(terrainConfig("https://example.test/dem.json", "source"));
});

test("terrain setup reinstalls sources and divides exaggerated heights; missing data is unavailable and zero is valid", () => {
  const calls: unknown[] = [];
  let elevation: number | undefined = 150;
  const map = { getSource: () => undefined, addSource: (...v: unknown[]) => calls.push(v), getLayer: () => undefined, addLayer: (...v: unknown[]) => calls.push(v), getStyle: () => ({ layers: [] }), setTerrain: (v: unknown) => calls.push(v), getTerrain: () => ({}), terrain: { getDrawnElevationForLngLat: () => elevation } } as unknown as MapLibreMap;
  applyTerrain(map, { url: "https://example.test/dem.json", attribution: "source" }, true, true, 1.5);
  assert.equal((calls[0] as unknown[])[0], TERRAIN_SOURCE);
  assert.deepEqual(calls[2], { source: TERRAIN_SOURCE, exaggeration: 1.5 });
  assert.equal(terrainElevation(map, [0, 0], 1.5), 100);
  elevation = 0; assert.equal(terrainElevation(map, [0, 0], 1.5), 0);
  elevation = undefined; assert.equal(terrainElevation(map, [0, 0], 1.5), null);
});

 test("profile retains missing data and computes unexaggerated slope", () => {
 const p = elevationProfile([[145, -37], [145.001, -37]], ([lng]) => (lng - 145) * 10000, 20);
 const summary = profileSummary(p); assert.ok(summary); assert.ok(summary.slopePercent > 0); assert.equal(summary.min, 0);
 assert.equal(profileSummary(elevationProfile([[145,-37],[145.001,-37]], () => null)), null);
 });

test("parcel estimates respect holes, zero, and unavailable samples", () => {
 const geometry = {type:"Polygon" as const, coordinates: [[[0,0],[2,0],[2,2],[0,2],[0,0]], [[0.5,0.5],[1.5,0.5],[1.5,1.5],[0.5,1.5],[0.5,0.5]]]};
 const result = parcelElevation(geometry, ([x,y]) => x < 0.2 ? 0 : x+y);
 assert.ok(result); assert.equal(result.min, 0); assert.equal(result.samples, 300);
 assert.equal(parcelElevation(geometry, ([x]) => x > 1 ? null : 0), null);
});
