const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{}};vm.runInNewContext(fs.readFileSync('tour-cloud-config.js','utf8'),context);
const config=context.window.RayonCloudConfig;
async function get(path,headers={}){return fetch(config.url+path,{headers,signal:AbortSignal.timeout(45000)});}
(async()=>{
 for(const id of ['sample','665f1be8-530a-461a-aacb-606fc3b16f13']){
  const r=await get('/functions/v1/tour-view?id='+id);assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);
  const payload=await r.json();assert(payload.scenes.length>0);assert(payload.revision);console.log(id+': live, '+payload.scenes.length+' rooms');
 }
 for(const id of ['invalid','00000000-0000-4000-8000-000000000000']){const r=await get('/functions/v1/tour-view?id='+id);assert.equal(r.status,404);}
 const catalog=await get('/rest/v1/rayon_tours?select=id',{apikey:config.key});assert([401,403].includes(catalog.status));
 const privateObject=await get('/storage/v1/object/rayon-tours/sample/845351cf-3740-4375-b0cb-b04197c97d6b.json',{apikey:config.key});assert(!privateObject.ok);
 const settings=await get('/auth/v1/settings',{apikey:config.key});assert.equal(settings.status,200);const auth=await settings.json();assert(auth.external.email);assert(!auth.disable_signup);
 console.log('Unknown links denied; anonymous catalog and Storage denied; email signup enabled.');
})().catch(e=>{console.error(e);process.exitCode=1;});
