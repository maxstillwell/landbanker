// Local-only integration: the browser-facing HTTPS fixture forwards to static
// assets served by the local Next.js app. No third-party tile host is used.
import { chromium } from './map-browser.mjs';
import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
assert.match(await readFile('.env.local','utf8'), /^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:54321$/m);
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{}),args:['--no-sandbox']});
const context=await browser.newContext({viewport:process.env.TERRAIN_MOBILE ? {width:390,height:844} : {width:1024,height:768}});
const areas={alps:{dir:'terrain-poc',x:1867,y:1246,center:[148.263,-36.4]},vermont:{dir:'terrain-poc-vermont',x:1849,y:1257,center:[145.182,-37.858]},balliang:{dir:'terrain-poc-balliang',x:1844,y:1256,center:[144.307,-37.804]},lismore:{dir:'terrain-poc-lismore',x:1895,y:1195,center:[153.279,-28.813]},dunoon:{dir:'terrain-poc-dunoon',x:1896,y:1194,center:[153.329,-28.685]}};
const area=areas[process.env.TERRAIN_AREA || 'alps'];assert.ok(area, 'unknown terrain test area');
let tileRequests=0;
await context.route('https://terrain.fixture/**', async route=>{
 const path=new URL(route.request().url()).pathname; console.log('DEM request',path);
 if(path==='/tilejson.json') {
  const res=await fetch(`http://localhost:3000/${area.dir}/tilejson.json`);
  assert.equal(res.status,200);
  const tilejson=await res.json(); tilejson.tiles=['https://terrain.fixture/ga-alps/{z}/{x}/{y}.png'];
  return route.fulfill({headers:{'access-control-allow-origin':'*'},json:tilejson});
 }
 if(path===`/ga-alps/11/${area.x}/${area.y}.png`) {
  const res=await fetch(`http://localhost:3000/${area.dir}/11/${area.x}/${area.y}.png`);
  assert.equal(res.status,200);tileRequests++;
  return route.fulfill({headers:{'access-control-allow-origin':'*'},contentType:'image/png',body:Buffer.from(await res.arrayBuffer())});
 }
 return route.fulfill({status:404,headers:{'access-control-allow-origin':'*'}});
});
const page=await context.newPage();page.setDefaultTimeout(30000);
try {
 await page.goto('http://localhost:3000/signup');await page.getByLabel('Your name').fill('GA DEM proof');
 await page.getByLabel('Email',{exact:true}).fill(`ga-poc-${Date.now()}@landbanker.test`);await page.getByLabel('Password',{exact:true}).fill('LocalTerrainTest!42');
 await page.getByRole('button',{name:'Create account',exact:true}).click();await page.waitForURL('**/app/map');
 await expect(page.locator('.maplibregl-canvas')).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'3D view'}).click(); await expect(page.getByText(/Terrain data at the map centre is unavailable or still loading/)).toBeVisible(); await page.getByRole('button',{name:'2D edit'}).click();
 await page.getByRole('button',{name:'Zoom in'}).click(); await page.waitForTimeout(1800);
 await expect.poll(()=>page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('landos:map-camera:v1:')))).toBe(true);
 await page.evaluate(center=>{const k=Object.keys(localStorage).find(k=>k.startsWith('landos:map-camera:v1:'));localStorage.setItem(k,JSON.stringify({center,zoom:12,basemap:'light'}));},area.center);
 await page.reload();await expect(page.locator('.maplibregl-canvas')).toBeVisible({timeout:30000});await page.getByRole('button',{name:'3D view'}).click();
 await expect.poll(()=>tileRequests,{timeout:30000}).toBeGreaterThan(0).catch(async e => { console.log('Map state:',await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('landos:map-camera:v1:')))); throw e; });
 await expect.poll(async()=>{await page.getByRole('button',{name:'Elevation at centre'}).click();return page.getByText(/\d+\.\d m \(approx\.\)/).count()},{timeout:30000,intervals:[2000]}).toBeGreaterThan(0);
 console.log('GA SRTM static tile requests:',tileRequests,'centre elevation:',await page.getByText(/\d+\.\d m \(approx\.\)/).innerText());
 await page.getByRole('button',{name:'Hillshade'}).click(); await expect(page.getByRole('button',{name:'Hillshade'})).toHaveAttribute('aria-pressed','true');
 if(process.env.TERRAIN_SCREENSHOT) await page.screenshot({path:process.env.TERRAIN_SCREENSHOT,timeout:45000,animations:'disabled'});
} finally {await browser.close();}
