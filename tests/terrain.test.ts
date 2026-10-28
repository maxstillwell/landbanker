import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Map as MapLibreMap } from "maplibre-gl";
import { terrainConfig, terrainElevation, applyTerrain, TERRAIN_SOURCE } from "../src/lib/map/terrain";

test("terrain requires a secure source and attribution", () => {
  assert.equal(terrainConfig("https://example.test/dem.json", ""), null);
  assert.equal(terrainConfig("http://example.test/dem.json", "source"), null);
  assert.ok(terrainConfig("https://example.test/dem.json", "source"));
});

test("terrain setup reinstalls sources and divides exaggerated heights; missing or ambiguous zero is unavailable", () => {
  const calls: unknown[] = [];
  let elevation: number | null = 150;
  const map = { getSource: () => undefined, addSource: (...v: unknown[]) => calls.push(v), getLayer: () => undefined, addLayer: (...v: unknown[]) => calls.push(v), getStyle: () => ({ layers: [] }), setTerrain: (v: unknown) => calls.push(v), getTerrain: () => ({}), isSourceLoaded: () => true, queryTerrainElevation: () => elevation } as unknown as MapLibreMap;
  applyTerrain(map, { url: "https://example.test/dem.json", attribution: "source" }, true, true, 1.5);
  assert.equal((calls[0] as unknown[])[0], TERRAIN_SOURCE);
  assert.deepEqual(calls[2], { source: TERRAIN_SOURCE, exaggeration: 1.5 });
  assert.equal(terrainElevation(map, [0, 0], 1.5), 100);
  elevation = 0; assert.equal(terrainElevation(map, [0, 0], 1.5), null);
  elevation = null; assert.equal(terrainElevation(map, [0, 0], 1.5), null);
});
