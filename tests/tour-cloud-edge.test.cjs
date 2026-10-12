const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('supabase/functions/tour-view/index.ts','utf8').replaceAll("')!","')").replace('(status: number, message: string)','(status, message)');
function endpoint(row,storageOK=true){
 let handler;const calls=[];
 vm.runInNewContext(source,{Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://test.supabase.co':'server-only'},serve:fn=>handler=fn},URL,Response,Date,
  fetch:async(url,options)=>{calls.push({url,options});return url.includes('/rest/v1/')?Response.json(row?[row]:[]):new Response(storageOK?'{}':'error',{status:storageOK?200:404});}});
 return {get:async(id,options={})=>handler(new Request('https://test.supabase.co/functions/v1/tour-view?id='+id,options)),calls};
}
const active={object_path:'sample/revision.json',published:true,revision:'revision',expires_at:null};
test('unknown or malformed links never read storage',async()=>{for(const id of ['../secret','00000000-0000-4000-8000-000000000000']){const api=endpoint(null);assert.equal((await api.get(id)).status,404);assert(!api.calls.some(c=>c.url.includes('/storage/')));}});
test('expired and offline tours deny access before reading any panorama',async()=>{for(const row of [{...active,published:false},{...active,expires_at:'2000-01-01T00:00:00Z'}]){const api=endpoint(row);assert([404,410].includes((await api.get('sample')).status));assert.equal(api.calls.length,1);}});
test('active view streams through the server without cache or service key exposure',async()=>{const api=endpoint(active),r=await api.get('sample');assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(r.headers.get('X-Tour-Remaining-Ms'),'-1');assert.equal(await r.text(),'{}');assert.equal(api.calls.length,2);});
test('status polling does not transfer panorama data',async()=>{const api=endpoint({...active,expires_at:new Date(Date.now()+60000).toISOString()}),r=await api.get('sample&status=1');assert.equal(r.status,200);assert(Number(r.headers.get('X-Tour-Remaining-Ms'))>0);assert.equal(api.calls.length,1);});
test('storage failures and write attempts fail closed',async()=>{assert.equal((await endpoint(active,false).get('sample')).status,503);assert.equal((await endpoint(active).get('sample',{method:'POST'})).status,405);});
