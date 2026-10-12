const {chromium}=require(process.env.RAYON_PLAYWRIGHT),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),pending=path.join(root,'backend/pending');
const server=http.createServer((req,res)=>{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1);let file=path.resolve(root,name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(['tour-admin.html','tour-admin.js'].includes(name)&&fs.existsSync(path.join(pending,name)))file=path.join(pending,name);try{res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const payload=JSON.parse(fs.readFileSync(path.join(root,'tours/sample-source.json'),'utf8'));
  let rows=[{id:'sample',title:'Studio sample',revision:'00000000-0000-4000-8000-000000000001',object_path:'sample/initial.json',published:true,rooms:2,expires_at:null}];
  const objects=new Map([['sample/initial.json',payload]]);let expired=false,remaining=-1;
  await page.route('https://zxhajwejsicweucptity.supabase.co/**',async route=>{
   const req=route.request(),url=new URL(req.url()),method=req.method();let body={},status=200,headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*','Access-Control-Expose-Headers':'X-Tour-Remaining-Ms','X-Tour-Remaining-Ms':String(remaining)};
   if(method==='OPTIONS'){await route.fulfill({status:204,headers});return;}
   if(url.pathname.includes('/auth/v1/token'))body={access_token:'mock',refresh_token:'mock-refresh',user:{email:'randall@rayonstudio.net',email_confirmed_at:'2026-01-01'}};
   else if(url.pathname.includes('/auth/v1/logout'))body={};
   else if(url.pathname.includes('/functions/v1/tour-view')){if(expired){status=410;body={message:'This tour has expired.'};}else body=url.searchParams.has('status')?{revision:rows[0].revision}:payload;}
   else if(url.pathname.includes('/rest/v1/rayon_tours')){
    const id=url.searchParams.get('id')?.replace('eq.',''),rev=url.searchParams.get('revision')?.replace('eq.','');
    if(method==='GET')body=id?rows.filter(r=>r.id===id):rows;
    if(method==='POST'){const row=req.postDataJSON();rows.push(row);body=[row];}
    if(method==='PATCH'){const row=rows.find(r=>r.id===id&&r.revision===rev);if(row)Object.assign(row,req.postDataJSON());body=row?[row]:[];}
    if(method==='DELETE'){body=rows.filter(r=>r.id===id&&r.revision===rev);rows=rows.filter(r=>!body.includes(r));}
   }else if(url.pathname.includes('/storage/v1/object/')){
    const key=url.pathname.split('/rayon-tours/')[1];
    if(method==='GET')body=objects.get(key);
    if(method==='POST')objects.set(key,req.postDataJSON());
    if(method==='DELETE')for(const p of req.postDataJSON().prefixes)objects.delete(p);
   }else throw Error('Unexpected request '+url);
   await route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(base+'/tour-admin.html');await page.locator('#tour-password').fill('test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Editing the public sample'));
  await page.locator('.tour-card-preview').click();await page.locator('#tour-title').fill('Updated studio tour');await page.locator('#tour-expiry').selectOption('7');await page.locator('#tour-publish').click();
  await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Tour published.'));
  assert.equal(rows[0].title,'Updated studio tour');assert(rows[0].expires_at);assert.equal(objects.size,1);assert.match(await page.locator('#tour-link').inputValue(),/view.html\?id=sample/);
  await page.locator('#tour-check-live').click();await page.waitForFunction(()=>document.querySelector('#tour-live-status').textContent.includes('Ready to share'));
  await page.locator('#tour-new').click();await page.locator('#tour-import').setInputFiles(path.join(root,'tours/sample-source.json'));await page.waitForFunction(()=>!document.querySelector('#tour-import').disabled);await page.locator('#tour-title').fill('Client cloud');await page.locator('#tour-publish').click();
  await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Tour published.'));assert.equal(rows.length,2);
  await page.locator('#tour-offline').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('taken offline'));assert.equal(rows.find(r=>r.title==='Client cloud').published,false);
  await page.getByRole('button',{name:'Delete Client cloud',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Tour deleted.'));assert.equal(rows.length,1);
  await page.goto(base+'/tours/view.html?id=sample');await page.frameLocator('#cloud-view').locator('.sw').nth(1).waitFor();assert.equal(await page.locator('#cloud-message').isVisible(),false);
  expired=true;await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForFunction(()=>document.querySelector('#cloud-message').textContent.includes('expired'));assert.equal(await page.locator('#cloud-view').count(),0);
  expired=false;remaining=1400;await page.goto(base+'/tours/view.html?id=sample');await page.waitForFunction(()=>document.querySelector('#cloud-message').textContent.includes('expired'));assert.equal(await page.locator('#cloud-view').count(),0);
  assert.deepEqual(errors,[]);console.log('Cloud gallery, publishing, expiry, offline, deletion and viewer lifecycle passed (mock API).');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
