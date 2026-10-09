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
  const blobs=new Map(),trees=new Map(),commits=new Map();let head='initial',counter=0,serveCurrent=false,writes=0;
  await page.route('https://api.github.com/**',async route=>{
   const req=route.request(),url=new URL(req.url()),endpoint=url.pathname.replace('/repos/owner/site',''),method=req.method(),body=method==='GET'?null:req.postDataJSON();let result,status=200;
   if(method!=='GET')writes++;
   if(endpoint==='')result={permissions:{push:true}};
   else if(endpoint.startsWith('/git/ref/heads/'))result={object:{sha:head}};
   else if(endpoint.startsWith('/git/commits/')&&method==='GET')result={tree:{sha:'base-tree'}};
   else if(endpoint.startsWith('/contents/')){const file=decodeURIComponent(endpoint.slice('/contents/'.length));if(!files.has(file)){status=404;result={};}else{const sha='read-'+file;blobs.set(sha,files.get(file));result={sha,content:''};}}
   else if(endpoint.startsWith('/git/blobs/')&&method==='GET')result={content:Buffer.from(blobs.get(decodeURIComponent(endpoint.slice('/git/blobs/'.length)))).toString('base64')};
   else if(endpoint==='/git/blobs'){const sha='blob-'+(++counter);blobs.set(sha,body.content);result={sha};}
   else if(endpoint==='/git/trees'){const sha='tree-'+(++counter);trees.set(sha,body.tree);result={sha};}
   else if(endpoint==='/git/commits'){const sha='commit-'+(++counter);commits.set(sha,body);result={sha};}
   else if(endpoint.startsWith('/git/refs/heads/')){assert.equal(body.force,false);const commit=commits.get(body.sha);assert.equal(commit.parents[0],head);for(const entry of trees.get(commit.tree))files.set(entry.path,entry.content??blobs.get(entry.sha));head=body.sha;result={};}
   else throw Error('Unexpected API call '+endpoint);
   await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(result)});
  });
  await page.route('https://owner.github.io/site/tours/**',route=>{const file=new URL(route.request().url()).pathname.replace('/site/','');return route.fulfill({status:200,contentType:'text/html',headers:{'Access-Control-Allow-Origin':'*'},body:serveCurrent?files.get(file):files.get('tours/sample.html')});});
  async function login(){await page.goto(base+'/tour-admin.html');await page.locator('#tour-repo').fill('owner/site');await page.locator('#tour-token').fill('test-secret-token');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Editing the public sample'));}
  await login();await page.locator('#tour-new').click();await page.locator('#tour-title').fill('Launch test client');
  const editor=page.frameLocator('#tour-editor');
  await editor.locator('#fileInput').setInputFiles(path.join(root,'Images/RAYONSLOGO copy.png'));
  await page.waitForFunction(()=>!document.querySelector('#tour-publish').disabled);assert(dialogs.some(t=>t.includes('2:1')));
  const sample=JSON.parse(fs.readFileSync(path.join(root,'tours/sample-source.json'),'utf8'));
  const buffer=Buffer.from(sample.scenes[0].image.split(',')[1],'base64');
  await editor.locator('#fileInput').setInputFiles([{name:'Lounge.jpg',mimeType:'image/jpeg',buffer},{name:'Study.jpg',mimeType:'image/jpeg',buffer}]);
  await page.waitForFunction(()=>document.querySelector('#tour-editor').contentDocument.querySelector('#sceneCount').textContent==='2 rooms');
  await page.locator('#tour-save-draft').click();await page.waitForFunction(()=>document.querySelector('#draft-status').textContent.includes('Draft saved'));
  const drafts=await page.evaluate(()=>TourDrafts.list('owner/site:main'));assert.equal(drafts.length,1);assert(!JSON.stringify(drafts).includes('test-secret-token'));
  await page.locator('#tour-logout').click();await login();await page.locator('details summary').click();await page.locator('#tour-drafts').selectOption(drafts[0].key);await page.locator('#tour-restore-draft').click();
  await page.waitForFunction(()=>document.querySelector('#tour-title').value==='Launch test client');
  await page.locator('#tour-publish').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Tour published to GitHub'));
  const url=await page.locator('#tour-link').inputValue(),id=JSON.parse(files.get('tours/catalog.json')).tours.find(t=>t.id!=='sample').id;
  assert(files.has('tours/data/'+id+'.json'));assert(files.get('tours/client-'+id+'.html').includes('rayon-revision'));assert(!files.get('tours/client-'+id+'.html').includes('test-secret-token'));
  await page.locator('#tour-check-live').click();await page.waitForFunction(()=>document.querySelector('#tour-live-status').textContent.includes('older version'));
  serveCurrent=true;await page.locator('#tour-check-live').click();await page.waitForFunction(()=>document.querySelector('#tour-live-status').textContent.includes('Ready to share'));
  assert.equal(await page.locator('#tour-qr svg').count(),1);
  await page.locator('#tour-offline').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Tour taken offline'));
  assert(files.get('tours/client-'+id+'.html').includes('This tour is unavailable'));assert(!files.get('tours/client-'+id+'.html').includes('data:image'));assert(files.has('tours/data/'+id+'.json'));
  await page.locator('#tour-logout').click();await login();await page.locator('#tour-select').selectOption(id);await page.waitForFunction(()=>document.querySelector('#tour-title').value==='Launch test client');
  await page.locator('#tour-publish').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Tour published to GitHub'));assert.equal(await page.locator('#tour-link').inputValue(),url);
  const before=writes;head='changed-elsewhere';await page.locator('#tour-title').fill('Conflicting edit');await page.locator('#tour-publish').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('repository changed'));assert.equal(writes,before);
  assert.deepEqual(errors,[]);console.log('PASS: bulk panoramas, invalid image rejection, persistent draft restore, atomic source/viewer publication, stale/live checks, QR, offline/reopen and republish with stable link, conflict protection.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
