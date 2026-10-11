// End-to-end lifecycle against a stateful GitHub API double; never writes to GitHub.
const {chromium}=require(process.env.RAYON_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const server=http.createServer((req,res)=>{try{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname)),body=fs.readFileSync(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(body);}catch{res.writeHead(404).end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();const errors=[],dialogs=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});
  const files=new Map(['tours/catalog.json','tours/sample.html'].map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')]));
  for(const tour of JSON.parse(files.get('tours/catalog.json')).tours){const p=tour.hasSource?'tours/data/'+tour.id+'.json':'tours/'+(tour.id==='sample'?'sample':'client-'+tour.id)+'.html';if(fs.existsSync(path.join(root,p)))files.set(p,fs.readFileSync(path.join(root,p),'utf8'));}
  const blobs=new Map(),trees=new Map(),commits=new Map();let head='initial',counter=0,serveCurrent=false,writes=0,denyWrite=true;
  await page.route('https://api.github.com/**',async route=>{
   const req=route.request(),url=new URL(req.url()),endpoint=url.pathname.replace('/repos/owner/site',''),method=req.method(),body=method==='GET'?null:req.postDataJSON();let result,status=200;
   if(method!=='GET')writes++;
   if(method==='POST'&&denyWrite){await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Resource not accessible by personal access token'})});return;}
   if(endpoint==='')result={permissions:{push:true}};
   else if(endpoint.startsWith('/git/ref/heads/'))result={object:{sha:head}};
   else if(endpoint.startsWith('/git/commits/')&&method==='GET')result={tree:{sha:'base-tree'}};
   else if(endpoint.startsWith('/contents/')){const file=decodeURIComponent(endpoint.slice('/contents/'.length));if(!files.has(file)){status=404;result={};}else{const sha='read-'+file;blobs.set(sha,files.get(file));result={sha,content:''};}}
   else if(endpoint.startsWith('/git/blobs/')&&method==='GET')result={content:Buffer.from(blobs.get(decodeURIComponent(endpoint.slice('/git/blobs/'.length)))).toString('base64')};
   else if(endpoint==='/git/blobs'){const sha='blob-'+(++counter);blobs.set(sha,body.content);result={sha};}
   else if(endpoint==='/git/trees'){const sha='tree-'+(++counter);trees.set(sha,body.tree);result={sha};}
   else if(endpoint==='/git/commits'){const sha='commit-'+(++counter);commits.set(sha,body);result={sha};}
   else if(endpoint.startsWith('/git/refs/heads/')){assert.equal(body.force,false);const commit=commits.get(body.sha);assert.equal(commit.parents[0],head);for(const entry of trees.get(commit.tree))entry.sha===null?files.delete(entry.path):files.set(entry.path,entry.content??blobs.get(entry.sha));head=body.sha;result={};}
   else throw Error('Unexpected API call '+endpoint);
   await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(result)});
  });
  await page.route('https://owner.github.io/site/tours/**',route=>{const file=new URL(route.request().url()).pathname.replace('/site/','');return route.fulfill({status:200,contentType:'text/html',headers:{'Access-Control-Allow-Origin':'*'},body:serveCurrent?files.get(file):files.get('tours/sample.html')});});
  async function login(){await page.goto(base+'/tour-admin.html');await page.locator('#tour-repo').fill('owner/site');await page.locator('#tour-token').fill('test-secret-token');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Editing the public sample'));}
  await login();await page.locator('#tour-new').click();await page.locator('#tour-title').fill('Launch test client');
  const editor=page.frameLocator('#tour-editor');
  await editor.locator('#fileInput').setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('not an image')});
  await page.waitForFunction(()=>!document.querySelector('#tour-publish').disabled);assert(dialogs.some(t=>t.includes('JPEG, PNG or WebP')));
  const sample=JSON.parse(fs.readFileSync(path.join(root,'tours/sample-source.json'),'utf8'));
  const buffer=Buffer.from(sample.scenes[0].image.split(',')[1],'base64');
  const wideImage=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=900;canvas.getContext('2d').fillRect(0,0,1600,900);return canvas.toDataURL('image/jpeg').split(',')[1];});
  await editor.locator('#fileInput').setInputFiles([{name:'Lounge.jpg',mimeType:'image/jpeg',buffer:Buffer.from(wideImage,'base64')},{name:'Study.jpg',mimeType:'image/jpeg',buffer}]);
  await page.waitForFunction(()=>document.querySelector('#tour-editor').contentDocument.querySelector('#sceneCount').textContent==='2 rooms');
  await page.locator('#tour-expiry').selectOption('7');
  await page.locator('#tour-save-draft').click();await page.waitForFunction(()=>document.querySelector('#draft-status').textContent.includes('Draft saved'));
  const drafts=await page.evaluate(()=>TourDrafts.list('owner/site:main'));assert.equal(drafts.length,1);assert(!JSON.stringify(drafts).includes('test-secret-token'));
  await page.locator('#tour-logout').click();await login();await page.getByText('Restore a saved browser draft',{exact:true}).click();await page.locator('#tour-drafts').selectOption(drafts[0].key);await page.locator('#tour-restore-draft').click();
  await page.waitForFunction(()=>document.querySelector('#tour-title').value==='Launch test client');
  assert.equal(await page.locator('#tour-expiry').inputValue(),'7');
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:900});
   await page.waitForFunction(()=>{const frame=document.querySelector('#tour-editor');return Math.abs(frame.clientHeight-frame.contentDocument.body.getBoundingClientRect().height)<3;});
   const layout=await editor.locator('body').evaluate(body=>({height:body.scrollHeight,viewport:innerHeight}));assert(layout.height<=layout.viewport+3,'Editor must not scroll vertically inside a box');
  }
  await page.locator('#tour-publish').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Resource not accessible by personal access token'));
  assert((await page.locator('#tour-status').textContent()).includes('Contents: Read and write'));
  await page.getByText('Fix GitHub publishing access',{exact:true}).click();await page.locator('#tour-replacement-token').fill('replacement-test-token');await page.locator('#tour-update-token').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Token replaced'));
  assert.equal(await editor.locator('#sceneCount').textContent(),'2 rooms');denyWrite=false;
  await page.locator('#tour-publish').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Tour published to GitHub'));
  const url=await page.locator('#tour-link').inputValue(),id=new URL(url).pathname.match(/client-([\w-]+)\.html$/)[1];
  const published=JSON.parse(files.get('tours/data/'+id+'.json'));
  assert.ok(Math.abs(Date.parse(published.expiresAt)-Date.now()-7*86400000)<60000);
  const entry=JSON.parse(files.get('tours/catalog.json')).tours.find(t=>t.id===id);assert.match(entry.thumbnail,/^data:image\/jpeg;base64,/);
  assert.equal(await page.locator('[data-tour-id="'+id+'"] img').count(),1);
  assert(files.has('tours/data/'+id+'.json'));assert(files.get('tours/client-'+id+'.html').includes('rayon-revision'));assert(!files.get('tours/client-'+id+'.html').includes('test-secret-token'));
  await page.locator('#tour-check-live').click();await page.waitForFunction(()=>document.querySelector('#tour-live-status').textContent.includes('older version'));
  serveCurrent=true;await page.locator('#tour-check-live').click();await page.waitForFunction(()=>document.querySelector('#tour-live-status').textContent.includes('Ready to share'));
  assert.equal(await page.locator('#tour-qr svg').count(),1);
  await page.locator('#tour-offline').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Tour taken offline'));
  assert(files.get('tours/client-'+id+'.html').includes('This tour is unavailable'));assert(!files.get('tours/client-'+id+'.html').includes('data:image'));assert(files.has('tours/data/'+id+'.json'));
  await page.locator('#tour-logout').click();await login();await page.locator('[data-tour-id="'+id+'"] [data-action=edit]').click();await page.waitForFunction(()=>document.querySelector('#tour-title').value==='Launch test client');
  await page.locator('#tour-publish').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Tour published to GitHub'));assert.equal(await page.locator('#tour-link').inputValue(),url);
  assert.equal(JSON.parse(files.get('tours/data/'+id+'.json')).expiresAt,published.expiresAt,'Editing must preserve the exact existing deadline');
  await page.locator('#tour-expiry').selectOption('custom');await page.locator('#tour-expires-at').fill('2020-01-01T12:00');
  const beforeInvalid=writes;await page.locator('#tour-publish').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('future expiry'));assert.equal(writes,beforeInvalid);
  await page.locator('#tour-expiry').selectOption('none');await page.locator('#tour-publish').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Tour published to GitHub'));assert.equal(JSON.parse(files.get('tours/data/'+id+'.json')).expiresAt,null);
  await page.locator('#tour-expiry').selectOption('custom');await page.locator('#tour-expires-at').fill('2030-01-01T12:00');await page.locator('#tour-publish').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Tour published to GitHub'));assert.ok(Date.parse(JSON.parse(files.get('tours/data/'+id+'.json')).expiresAt)>Date.now());
  const savedHead=head;
  let rejectDelete=true;page.removeAllListeners('dialog');page.on('dialog',async d=>{if(rejectDelete)await d.dismiss();else await d.accept();});
  const beforeCancel=writes;await page.locator('[data-tour-id="'+id+'"] [data-action=delete]').click();assert.equal(writes,beforeCancel);assert(files.has('tours/client-'+id+'.html'));
  rejectDelete=false;head='changed-elsewhere';const beforeConflict=writes;
  await page.locator('[data-tour-id="'+id+'"] [data-action=delete]').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('repository changed'));assert.equal(writes,beforeConflict);
  head=savedHead;denyWrite=true;
  await page.locator('[data-tour-id="'+id+'"] [data-action=delete]').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Resource not accessible'));assert(files.has('tours/client-'+id+'.html'));
  denyWrite=false;
  await page.locator('[data-tour-id="'+id+'"] [data-action=delete]').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Tour deleted from GitHub'));
  assert(!files.has('tours/client-'+id+'.html'));assert(!files.has('tours/data/'+id+'.json'));assert(!JSON.parse(files.get('tours/catalog.json')).tours.some(t=>t.id===id));assert.equal(await page.locator('[data-tour-id="'+id+'"]').count(),0);
  await page.locator('[data-tour-id="sample"] [data-action=edit]').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Editing the public sample'));
  await page.locator('#tour-gallery img').nth(1).waitFor();
  await page.evaluate(()=>document.querySelector('.tour-library').scrollIntoView());
  await page.screenshot({path:path.join(root,'tests/tour-library-desktop.png'),fullPage:false});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'tests/tour-library-mobile.png'),fullPage:false});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const before=writes;head='changed-elsewhere';await page.locator('#tour-title').fill('Conflicting edit');await page.locator('#tour-publish').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('repository changed'));assert.equal(writes,before);
  assert.deepEqual(errors,[]);console.log('PASS: gallery previews/mobile layout, expiry settings/drafts/renewal, cancelled and atomic deletion, permission and conflict protection, publishing, live checks, QR and offline/reopen.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
