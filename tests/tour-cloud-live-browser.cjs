const {chromium}=require(process.env.RAYON_PLAYWRIGHT),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try {
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const base='https://randznr.github.io/RayonStudio/';
  await page.goto(base+'tour-admin.html');
  await page.getByRole('heading',{name:'Studio sign in'}).waitFor();
  assert.equal(await page.locator('#tour-email').inputValue(),'randall@rayonstudio.net');
  assert.equal(await page.locator('#tour-offline-export').count(),1);
  assert.equal(await page.locator('#tour-optimize').count(),1);
  for(const path of ['tours/sample.html','tours/client-665f1be8-530a-461a-aacb-606fc3b16f13.html']) {
   await page.goto(base+path);
   await page.frameLocator('#cloud-view').locator('.sw').nth(1).waitFor({timeout:60000});
   assert.equal(await page.locator('#cloud-message').isVisible(),false);
   console.log(path+': cloud panorama rendered');
  }
  await page.goto(base+'tours/view.html?id=00000000-0000-4000-8000-000000000000');
  await page.getByRole('heading',{name:/unavailable/i}).waitFor();
  assert.equal(await page.locator('#cloud-view').count(),0);
  assert.deepEqual(errors,[]);
  console.log('Live studio sign-in form, legacy links, panorama rendering and unavailable-link handling passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
