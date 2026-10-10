const {chromium}=require(process.env.RAYON_PLAYWRIGHT || 'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png'}[path.extname(file)]||'application/octet-stream';const body=fs.readFileSync(file);res.writeHead(200,{'Content-Type':type});res.end(body);}catch{res.writeHead(404).end();}});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:1365,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message)); page.on('dialog',dialog=>dialog.accept());
    await page.goto(base+'/tours/sample.html');await page.locator('.sw').nth(1).waitFor();
    assert.equal(await page.locator('input[type=file]').count(),0);assert.equal(await page.getByText('Exit client preview').count(),0);
    await page.locator('.sw').nth(1).click();assert.match(await page.locator('#lbl').innerText(),/study/);
    await page.screenshot({path:path.join(root,'tests/sample-desktop.png')});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'tests/sample-mobile.png')});
    await page.setViewportSize({width:1365,height:900});
    let published=[];
    await page.route('https://api.github.com/**',async route=>{
      const req=route.request(),url=req.url(),method=req.method();let data;
      if(method==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PATCH'}});return;}
      if(method!=='GET')published.push({url,body:req.postDataJSON()});
      if(url.endsWith('/owner/site'))data={permissions:{push:true}};
      else if(url.includes('/git/ref/heads/'))data={object:{sha:'head'}};
      else if(url.endsWith('/git/commits/head'))data={tree:{sha:'tree'}};
      else if(url.includes('/contents/')){const file=url.split('/contents/')[1].split('?')[0];data={content:fs.readFileSync(path.join(root,file)).toString('base64')};}
      else data={sha:'newsha'};
      await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});
    });
    await page.goto(base+'/tour-admin.html');assert.equal(await page.locator('#tour-editor').getAttribute('src'),null);
    await page.locator('#tour-repo').fill('owner/site');await page.locator('#tour-token').fill('mock-token');await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Editing the public sample'));
    const frame=page.frameLocator('#tour-editor');await frame.locator('.swatch').nth(1).click();
    assert.match(await frame.locator('#sceneLabel').innerText(),/study/);
    const panorama=JSON.parse(fs.readFileSync(path.join(root,'tours/sample-source.json'),'utf8')).scenes[0].image.split(',')[1];
    await frame.locator('#fileInput').setInputFiles({name:'new-room.jpg',mimeType:'image/jpeg',buffer:Buffer.from(panorama,'base64')});
    await page.waitForFunction(()=>document.querySelector('#tour-editor').contentDocument.querySelector('#sceneCount').textContent==='3 rooms');
    await frame.locator('input[type=file]').last().setInputFiles({name:'replacement.jpg',mimeType:'image/jpeg',buffer:Buffer.from(panorama,'base64')});
    await page.waitForFunction(()=>Array.from(document.querySelector('#tour-editor').contentDocument.querySelectorAll('input[type=file]')).at(-1)?.value==='');
    await page.locator('#tour-preview').click();await page.frameLocator('#tour-preview-frame').locator('.sw').nth(1).waitFor();
    assert.equal(await page.frameLocator('#tour-preview-frame').locator('input[type=file]').count(),0);await page.locator('#tour-preview-close').click();
    await page.locator('#tour-new').click();await page.locator('#tour-title').fill('Client test');
    await page.locator('#tour-import').setInputFiles(path.join(root,'tours/sample-source.json'));
    await page.waitForFunction(()=>document.querySelector('#tour-import').disabled===false);
    await page.locator('#tour-publish').click();await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('Tour published to GitHub'));
    const link=await page.locator('#tour-link').inputValue();assert.match(link,/https:\/\/owner.github.io\/site\/tours\/client-[a-f0-9-]+.html/);
    assert.equal(await page.locator('#tour-qr svg').count(),1);
    const tree=published.find(call=>call.url.endsWith('/git/trees'));assert.match(tree.body.tree[0].path,/^tours\/client-/);
    assert.equal(published.find(call=>call.url.includes('/git/refs/')).body.force,false);
    await page.locator('#tour-title').fill('Client revised');await page.locator('#tour-publish').click();
    // Head mock stays old, so this must refuse rather than overwrite newer repository state.
    await page.waitForFunction(()=>document.querySelector('#tour-status').textContent.includes('repository changed'));
    await page.locator('#tour-logout').click();assert.equal(await page.locator('#tour-editor').getAttribute('src'),null);
    assert.deepEqual(errors,[]);console.log('Browser checks passed: sample desktop/mobile, room navigation, admin sign-in, editable import, client preview, publishing, QR, conflict protection, sign-out.');
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});


