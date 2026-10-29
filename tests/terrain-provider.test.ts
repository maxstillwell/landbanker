import { test } from 'node:test';
import assert from 'node:assert/strict';
import { terrainProvider, availableTerrainProviders, TILEZEN_TEST_PROVIDER } from '../src/lib/map/terrain-provider';
const base = { id: 'fixture', label: 'Fixture', tileSize: 256 as const, attribution: 'Fixture' };
test('provider accepts either HTTPS TileJSON or XYZ and preserves unknown datum', () => {
 assert.equal(terrainProvider({...base,url:'https://example.test/dem.json'})?.datum, 'unknown');
 assert.ok(terrainProvider({...base,tiles:['https://example.test/{z}/{x}/{y}.png']}));
 assert.equal(terrainProvider({...base,url:'http://example.test/dem.json'}),null);
 assert.equal(terrainProvider({...base,url:'https://user:secret@example.test/dem.json'}),null);
 assert.equal(terrainProvider({...base,url:'https://example.test/dem.json',tiles:['https://example.test/{z}/{x}/{y}.png']}),null);
 assert.equal(terrainProvider({...base,tiles:['https://example.test/no-coordinates.png']}),null);
 assert.equal(terrainProvider({...base,tiles:['https://example.test/{z}/{x}/{y}.png'],maxzoom:16}),null);
 assert.equal(terrainProvider({...base,url:'https://example.test/dem.json',datumVerified:true})?.datumVerified,false);
 assert.equal(terrainProvider({...base,url:'https://example.test/dem.json',datum:'EGM96',datumVerified:true})?.datumVerified,true);
});
test('Tilezen testing source never enters a production provider list', () => {
 assert.deepEqual(availableTerrainProviders(null,true,false),[]);
 assert.deepEqual(availableTerrainProviders(null,false,true),[]);
 assert.deepEqual(availableTerrainProviders(null,true,true),[TILEZEN_TEST_PROVIDER]);
 assert.equal(TILEZEN_TEST_PROVIDER.datumVerified,false);
});
