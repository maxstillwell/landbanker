// Direct AWS terrain requests. Basemap styling is fixture-controlled to isolate
// DEM delivery; this is not a live official-parcel or imagery alignment test.
import { chromium } from './map-browser.mjs';
import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
assert.match(await readFile('.env.local','utf8'),/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:54321$/m);
const mobile=process.env.TERRAIN_MOBILE==='1';
const locations=process.env.TERRAIN_ONE ? [['Alps',148.263,-36.4]] : [['Vermont South',145.182,-37.858],['Balliang',144.307,-37.804],['Lismore',153.279,-28.813],['Dunoon',153.329,-28.685],['Alps',148.263,-36.4]];
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1024,height:768}});
const page=await context.newPage();page.setDefaultTimeout(45000);
const requests=[], responses=[], failures=[], errors=[], pending=[];
const aws=url=>url.startsWith('https://elevation-tiles-prod.s3.amazonaws.com/terrarium/');
page.on('request',r=>{if(aws(r.url()))requests.push(r.url())});
page.on('requestfailed',r=>{if(aws(r.url()))failures.push({url:r.url(),error:r.failure()?.errorText})});
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(!aws(r.url()))return;pending.push((async()=>{const headers=await r.allHeaders();let bytes=null;try{bytes=(await r.body()).length}catch{}responses.push({url:r.url(),status:r.status(),bytes,sources:headers['x-amz-meta-x-imagery-sources']||null,cacheControl:headers['cache-control']||null});})());});
const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');const cache=[];
cdp.on('Network.responseReceived',e=>{if(aws(e.response.url))cache.push({disk:e.response.fromDiskCache||false,serviceWorker:e.response.fromServiceWorker||false})});
let cameraKey;
const result=[];
async function sample(){await page.getByRole('button',{name:'Elevation at centre'}).click();const reading=page.getByText(/-?\d+\.\d m \(approx\.\)/);await expect(reading).toBeVisible({timeout:45000});return Number((await reading.innerText()).split(' ')[0]);}
try{
 await page.goto('http://localhost:3000/signup');await page.getByLabel('Your name').fill('Live AWS terrain test');await page.getByLabel('Email',{exact:true}).fill(`tilezen-${Date.now()}@landbanker.test`);await page.getByLabel('Password',{exact:true}).fill('LocalTerrainTest!42');await page.getByRole('button',{name:'Create account',exact:true}).click();await page.waitForURL('**/app/map');await expect(page.locator('.maplibregl-canvas')).toBeVisible({timeout:45000});
 await page.getByRole('button',{name:'Zoom in'}).click();await page.waitForTimeout(1800);
 cameraKey=await page.evaluate(()=>Object.keys(localStorage).find(k=>k.startsWith('landos:map-camera:v1:')));assert.ok(cameraKey);
 for(const [name,lon,lat] of locations){
  await page.evaluate(({key,lon,lat})=>localStorage.setItem(key,JSON.stringify({center:[lon,lat],zoom:12,basemap:'light'})),{key:cameraKey,lon,lat});await page.reload();await expect(page.locator('.maplibregl-canvas')).toBeVisible({timeout:45000});
  const before=requests.length;await page.getByRole('button',{name:'3D view'}).click();await expect.poll(()=>requests.length,{timeout:45000}).toBeGreaterThan(before);await page.waitForTimeout(3500);
  let elevation;await expect.poll(async()=>{try{elevation=await sample();return Number.isFinite(elevation)}catch{return false}},{timeout:60000,intervals:[2000]}).toBe(true);
  await page.getByRole('button',{name:'Hillshade',exact:true}).click();await expect(page.getByRole('button',{name:'Hillshade',exact:true})).toHaveAttribute('aria-pressed','true');
  result.push({name,centre:[lon,lat],elevation,requests:requests.length-before});console.log('LIVE AWS',JSON.stringify(result.at(-1)));
 }
 if(!mobile){
  const base=await sample();for(const size of ['1.5','2','1']){await page.getByLabel('Terrain exaggeration').selectOption(size);await page.waitForTimeout(1200);const reading=await sample();assert.ok(Math.abs(reading-base)<2,`unexaggerated elevation changed: ${base} vs ${reading}`)}
  const beforePan=new Set(requests);await page.mouse.move(400,300);await page.mouse.down();await page.mouse.move(750,300,{steps:8});await page.mouse.up();await expect.poll(()=>requests.some(r=>!beforePan.has(r)),{timeout:45000}).toBe(true);console.log('PAN additional distinct AWS tiles',new Set(requests.filter(r=>!beforePan.has(r))).size);
  const beforeZoom=requests.length;await page.getByRole('button',{name:'Zoom in'}).click();await page.waitForTimeout(3000);console.log('ZOOM additional AWS requests',requests.length-beforeZoom);
  if(await page.getByRole('button',{name:'Close library'}).isVisible()) await page.getByRole('button',{name:'Close library'}).click();await page.getByRole('button',{name:'Elevation profile'}).click();await page.mouse.click(350,300);await page.mouse.click(550,330);await page.getByRole('button',{name:'Finish profile'}).click();await expect(page.getByRole('region',{name:'Elevation profile'})).toContainText('vertical datum consistency is unverified');await page.getByRole('button',{name:'Close profile'}).click();
 }
 if(process.env.TERRAIN_SCREENSHOT)await page.screenshot({path:process.env.TERRAIN_SCREENSHOT,timeout:45000,animations:'disabled'});
 await page.getByRole('button',{name:'2D edit'}).click();await expect(page.getByRole('button',{name:'3D view'})).toBeVisible();
 await Promise.allSettled(pending);assert.equal(errors.length,0,errors.join('\n'));assert.ok(responses.some(r=>r.status===200&&r.bytes>0));
}finally{
 await Promise.allSettled(pending);await mkdir('artifacts',{recursive:true});const report={mobile,result,requests:requests.length,distinctRequests:new Set(requests).size,responses,failures,errors,cache};await writeFile(`artifacts/tilezen-live-${mobile?'mobile':'desktop'}.json`,JSON.stringify(report,null,2));console.log('AWS request summary',JSON.stringify({mobile,requests:requests.length,distinct:new Set(requests).size,responses:responses.length,failures:failures.length,meanBytes:responses.filter(r=>r.bytes!==null).reduce((n,r)=>n+r.bytes,0)/(responses.filter(r=>r.bytes!==null).length||1),diskCacheResponses:cache.filter(r=>r.disk).length}));await browser.close();
}
