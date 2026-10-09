const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const context={};context.window=context;
vm.runInNewContext(fs.readFileSync(path.join(root,'tour-data.js'),'utf8'),context);
vm.runInNewContext(fs.readFileSync(path.join(root,'tour-format.js'),'utf8'),context);
const payload=()=>({scenes:[{id:'room-1',name:'Room </script><script>alert(1)</script>',image:'data:image/jpeg;base64,YQ==',hotspots:[]}],floorplan:null,branding:null});
test('export is view-only and round-trips editable data without script injection',()=>{
  const data=payload(), html=context.TourFormat.build(data);
  assert.doesNotMatch(html,/btnExport|btnNewScene|btnEditMode|type="file"|Exit client preview|Authorization|window.storage/);
  assert.doesNotMatch(html,/<script>alert\(1\)/);
  assert.equal(context.TourData.parse(html).scenes[0].name,data.scenes[0].name);
  assert.match(html,/noindex,nofollow/);
  for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(!script[0].includes('application/json'))new vm.Script(script[1]);
});
test('arbitrary HTML and hostile image or hotspot data are rejected',()=>{
  assert.throws(()=>context.TourData.parse('<script>alert(1)</script>'));
  const data=payload();data.scenes[0].image='x" onerror="alert(1)';assert.throws(()=>context.TourData.validate(data));
  const bad=payload();bad.scenes[0].hotspots=[{id:'bad"]',type:'note',x:0,y:0,z:1}];assert.throws(()=>context.TourData.validate(bad));
});
test('client links are distinct and path traversal cannot be published',()=>{
  assert.equal(context.TourData.path('sample'),'tours/sample.html');
  assert.equal(context.TourData.path('12345678-1234-1234-1234-123456789012'),'tours/client-12345678-1234-1234-1234-123456789012.html');
  assert.throws(()=>context.TourData.path('../index'));
});
test('public routes point to the sample and never load the editor',()=>{
  assert.match(fs.readFileSync(path.join(root,'virtual-tours.html'),'utf8'),/url=virtual-tours-landing.html/);
  for(const file of ['virtual-tours-landing.html','RayonS360_sample_final.html','tours/RayonS360_final.html']){
    const html=fs.readFileSync(path.join(root,file),'utf8');assert.match(html,/sample.html/);assert.doesNotMatch(html,/tour-editor|btnNewScene|btnEditMode|tour-admin/);
  }
  assert.equal(context.TourData.parse(fs.readFileSync(path.join(root,'tours/sample.html'),'utf8')).scenes.length,2);
});
test('admin editor and authored JavaScript compile',()=>{
  for(const file of ['tour-admin.js','tour-data.js','tour-format.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'));
  const editor=fs.readFileSync(path.join(root,'tour-editor.html'),'utf8');
  for(const script of editor.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
  assert.match(editor,/window.TourEditor/);assert.doesNotMatch(editor,/window.storage/);
});
