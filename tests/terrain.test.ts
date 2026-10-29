import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Map as MapLibreMap } from "maplibre-gl";
import { terrainConfig, terrainElevation, visibleTerrainCoverage, applyTerrain, TERRAIN_SOURCE, elevationProfile, profileSummary, parcelElevation } from "../src/lib/map/terrain";

test("terrain requires a secure source and attribution", () => {
  assert.equal(terrainConfig("https://example.test/dem.json", ""), null);
  assert.equal(terrainConfig("http://example.test/dem.json", "source"), null);
  assert.equal(terrainConfig("https://example.test/dem.json", "source", "1024"), null);
  assert.equal(terrainConfig("https://example.test/dem.json", "source", "256")?.tileSize, 256);
  assert.equal(terrainConfig("https://example.test/dem.json", "source")?.tileSize, 512);
});

test("terrain setup reinstalls sources and divides exaggerated heights; missing data is unavailable and zero is valid", () => {
  const calls: unknown[] = [];
  let elevation: number | undefined = 150;
  const map = { getSource: () => undefined, addSource: (...v: unknown[]) => calls.push(v), getLayer: () => undefined, addLayer: (...v: unknown[]) => calls.push(v), getStyle: () => ({ layers: [] }), setTerrain: (v: unknown) => calls.push(v), getTerrain: () => ({}), terrain: { getDrawnElevationForLngLat: () => elevation } } as unknown as MapLibreMap;
  applyTerrain(map, { url: "https://example.test/dem.json", attribution: "source" }, true, true, 1.5);
  assert.equal((calls[0] as unknown[])[0], TERRAIN_SOURCE);
  assert.equal(((calls[0] as unknown[])[1] as { tileSize: number }).tileSize, 512);
  calls.length = 0;
  applyTerrain(map, {url: "https://example.test/dem.json", attribution: "source", tileSize: 256}, false, false, 1);
  assert.equal(((calls[0] as unknown[])[1] as { tileSize: number }).tileSize, 256);
  calls.length = 0;
  applyTerrain(map, { url: "https://example.test/dem.json", attribution: "source" }, true, true, 1.5);
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

 test("coverage reports missing rendered tiles rather than trusting the map centre", () => {
 const make = (entries: Array<(() => number) | null> | null) => ({getTerrain: () => ({}), terrain: {getCoverageIndex: () => entries && ({samplerPerTile: new Map(entries.map((v,i)=>[String(i),v]))})}} as unknown as MapLibreMap);
 assert.equal(visibleTerrainCoverage(make(null)), "unknown");
 assert.equal(visibleTerrainCoverage(make([])), "unknown");
 assert.equal(visibleTerrainCoverage(make([()=>0,null])), "partial");
 assert.equal(visibleTerrainCoverage(make([()=>0,()=>1])), "loaded");
 });

test('provider switching replaces only owned DEM resources and does not reload an unchanged source', () => {
 const sources = new Map<string, unknown>([['parcels', {}]]);
 const layers = new Set<string>(['parcel-boundaries']);
 const events: string[] = [];
 const m = {getSource:(id:string)=>sources.get(id),addSource:(id:string,s:unknown)=>{sources.set(id,s);events.push('add-source')},removeSource:(id:string)=>{sources.delete(id);events.push('remove-source')},getLayer:(id:string)=>layers.has(id),addLayer:(l:{id:string})=>{layers.add(l.id)},removeLayer:(id:string)=>layers.delete(id),getStyle:()=>({layers:[]}),setTerrain:()=>{}} as unknown as MapLibreMap;
 const a={url:'https://example.test/a.json',attribution:'A'};
 applyTerrain(m,a,true,true,1);applyTerrain(m,a,true,true,2);
 assert.equal(events.filter(e=>e==='add-source').length,1);
 applyTerrain(m,{tiles:['https://example.test/{z}/{x}/{y}.png'],attribution:'B',tileSize:256},true,true,1);
 assert.equal(events.filter(e=>e==='remove-source').length,1);
 assert.ok(sources.has('parcels'));assert.ok(layers.has('parcel-boundaries'));
});
