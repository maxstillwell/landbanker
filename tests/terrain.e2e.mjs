import { chromium } from './map-browser.mjs';
import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
assert.match(await readFile('.env.local', 'utf8'), /^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:54321$/m);
// Start the local app with NEXT_PUBLIC_TERRAIN_TILEJSON_URL=https://terrain.fixture/tilejson.json and a test attribution.

const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{}),args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1024,height:768}});const page=await context.newPage();
page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(30000); const errors=[];page.on('pageerror',e=>errors.push(e.message)); page.on('requestfailed',r=>console.log('REQUEST FAILED',new URL(r.url()).origin,r.failure()?.errorText)); page.on('console',m=>{if(m.type()==='error') console.log('BROWSER',m.text().slice(0,300))});
await context.route('https://terrain.fixture/**',async route=>(console.log('TERRAIN', route.request().url().replace(/\/\d+\/\d+\/\d+\.png/, '/tile.png')), route.request().url().endsWith('tilejson.json') ? route.fulfill({headers:{'access-control-allow-origin':'*'},json:{tilejson:'3.0.0',tiles:['https://terrain.fixture/{z}/{x}/{y}.png'],minzoom:0,maxzoom:14}}):route.fulfill({headers:{'access-control-allow-origin':'*'},contentType:'image/png',body:await readFile(new URL('./fixtures/terrain-dem.png', import.meta.url))})));
try {
 await page.goto('http://localhost:3000/signup');await page.getByLabel('Your name').fill('Terrain Fixture');await page.getByLabel('Email',{exact:true}).fill(`terrain-${Date.now()}@landbanker.test`);await page.getByLabel('Password',{exact:true}).fill('LocalTerrainTest!42');await page.getByRole('button',{name:'Create account',exact:true}).click();await page.waitForURL('**/app/map',{timeout:12000}).catch(async e=>{console.log('SIGNUP PAGE:', (await page.locator('body').innerText()).slice(0,1200)); throw e;});
 await expect(page.locator('.maplibregl-canvas')).toBeVisible({timeout:30000});await page.getByRole('button',{name:'3D view'}).click();await expect(page.getByRole('button',{name:'2D edit'})).toBeVisible();
 await page.waitForTimeout(4000);await page.getByRole('button',{name:'Elevation at centre'}).click();await expect(page.getByText(/\d+\.\d m \(approx\.\)/)).toBeVisible({timeout:10000}).catch(async e=>{console.log('PAGE STATE:',(await page.locator('body').innerText()).slice(0,2500)); throw e});
 console.log('CHECK: loaded DEM elevation'); await page.getByLabel('Terrain exaggeration').selectOption('2');console.log('CHECK: exaggeration selected'); await page.getByRole('button',{name:'Hillshade'}).click();await expect(page.getByRole('button',{name:'Hillshade'})).toHaveAttribute('aria-pressed','true');
 console.log('CHECK: elevation and hillshade passed'); await page.getByRole('button',{name:'Elevation profile'}).click();await page.mouse.click(400,350);await page.mouse.click(600,400);await page.getByRole('button',{name:'Finish profile'}).click();await expect(page.getByRole('region',{name:'Elevation profile'})).toBeVisible();
 if (process.env.TERRAIN_SCREENSHOT) await page.screenshot({path:process.env.TERRAIN_SCREENSHOT,timeout:30000,animations:'disabled'});await page.getByRole('button',{name:'Close profile'}).click();await page.getByRole('button',{name:'2D edit'}).click();await expect(page.getByRole('button',{name:'3D view'})).toBeVisible();
 if(errors.length) throw new Error(errors.join('\n')); console.log('PASS: fixture DEM, centre elevation, terrain toggle, exaggeration, hillshade, drawn profile, return to 2D.');
} finally {await browser.close()}
