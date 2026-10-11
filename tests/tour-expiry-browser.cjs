const {chromium}=require(process.env.RAYON_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');global.window=global;require('../tour-data.js');require('../tour-format.js');
const baseData=TourData.parse(fs.readFileSync(path.join(root,'tours/sample.html'),'utf8'));
assert.throws(()=>TourData.validate({...baseData,expiresAt:'not-a-date'}));
assert.throws(()=>TourData.validate({...baseData,expiresAt:123}));
assert.equal(TourData.parse(TourFormat.build({...baseData,expiresAt:'2030-01-01T00:00:00.000Z'})).expiresAt,'2030-01-01T00:00:00.000Z');
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://local').pathname;try{
 let body,type='text/html';
 if(pathname==='/tours/expired.html')body=TourFormat.build({...baseData,expiresAt:new Date(Date.now()-1000).toISOString()});
 else if(pathname==='/tours/short.html')body=TourFormat.build({...baseData,expiresAt:new Date(Date.now()+2500).toISOString()});
 else if(pathname==='/tours/long.html')body=TourFormat.build({...baseData,expiresAt:new Date(Date.now()+3600000).toISOString()});
 else {body=fs.readFileSync(path.join(root,decodeURIComponent(pathname)));type=({'.js':'application/javascript','.png':'image/png','.svg':'image/svg+xml','.css':'text/css'})[path.extname(pathname)]||type;}
 res.setHeader('Content-Type',type);res.end(body);
}catch{res.writeHead(404).end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/tours/expired.html');await page.getByRole('heading',{name:'This tour has expired.'}).waitFor();assert.equal(await page.locator('#c').count(),0);assert.equal(await page.locator('#whatsapp-chat').count(),0);
 await page.goto(base+'/tours/short.html');await page.locator('#c').waitFor();await page.getByRole('heading',{name:'This tour has expired.'}).waitFor({timeout:8000});assert.equal(await page.locator('#c').count(),0);
 await page.screenshot({path:path.join(root,'tests/tour-expired.png')});
 await page.goto(base+'/tours/long.html');await page.locator('#c').waitFor();await page.evaluate(()=>{const oldNow=Date.now;Date.now=()=>oldNow()+7200000;document.dispatchEvent(new Event('visibilitychange'));});await page.getByRole('heading',{name:'This tour has expired.'}).waitFor();
 await page.goto(base+'/tours/sample.html');await page.locator('#c').waitFor();assert.equal(await page.getByRole('heading',{name:'This tour has expired.'}).count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: expiry validation/round-trip, expired arrival, automatic expiry in an open tab, resumed-tab expiry, and no-expiry viewer.');
}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
