// Synthetic DEM only: confirms map requests new tiles during navigation.
import { chromium } from './map-browser.mjs';
import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
assert.match(await readFile('.env.local','utf8'), /^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:54321$/m);
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{}),args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1024,height:768}});const requests=new Set();
await context.route('https://terrain.fixture/**', async route=>{
 const url=new URL(route.request().url());
 if(url.pathname==='/tilejson.json')return route.fulfill({headers:{'access-control-allow-origin':'*'},json:{tilejson:'3.0.0',tiles:['https://terrain.fixture/{z}/{x}/{y}.png'],minzoom:0,maxzoom:14}});
 requests.add(url.pathname);return route.fulfill({headers:{'access-control-allow-origin':'*'},contentType:'image/png',body:await readFile(new URL('./fixtures/terrain-dem.png',import.meta.url))});
});
const p=await context.newPage();p.setDefaultTimeout(30000);
try {
 await p.goto('http://localhost:3000/signup');await p.getByLabel('Your name').fill('Terrain navigation fixture');await p.getByLabel('Email',{exact:true}).fill(`nav-dem-${Date.now()}@landbanker.test`);await p.getByLabel('Password',{exact:true}).fill('LocalTerrainTest!42');await p.getByRole('button',{name:'Create account',exact:true}).click();await p.waitForURL('**/app/map');
 await expect(p.locator('.maplibregl-canvas')).toBeVisible({timeout:30000});await p.getByRole('button',{name:'3D view'}).click();await expect.poll(()=>requests.size,{timeout:30000}).toBeGreaterThan(0);
 await p.waitForTimeout(3000);const before=new Set(requests);await p.mouse.move(400,300);await p.mouse.down();await p.mouse.move(750,300,{steps:8});await p.mouse.up();
 await expect.poll(()=>[...requests].filter(x=>!before.has(x)).length,{timeout:30000}).toBeGreaterThan(0);
 console.log(`PASS synthetic terrain navigation: ${before.size} initial distinct tiles, ${requests.size} after pan`);
} finally {await browser.close();}
