const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const path = require('node:path');
const root = path.join(__dirname, '..');
function element(tag = '') {
  return {tag, value:'', textContent:'', hidden:false, children:[], files:[], disabled:false,
    append(...nodes) { this.children.push(...nodes); if (this.tag === 'select' && !this.value) this.value = nodes[0]?.value || ''; },
    replaceChildren(...nodes) { this.children = nodes; if (this.tag === 'select') this.value = nodes[0]?.value || ''; },
    setAttribute() {}, removeAttribute() {}, addEventListener() {}, showModal() {this.open = true;}, close() {this.open = false;}
  };
}
function environment(script, options = {}) {
  const nodes = new Map(), calls = [];
  const $ = id => { if (!nodes.has(id)) nodes.set(id, element(id === '#album-select' ? 'select' : '')); return nodes.get(id); };
  const document = {querySelector:$, querySelectorAll:() => [...nodes.values()], createElement:element};
  let ref = 'original-head';
  const context = {document, console, URL, URLSearchParams, TextDecoder, Uint8Array, atob, crypto:webcrypto,
    location:{search:'?project=residential', hash:''}, confirm:() => true,
    window:{addEventListener() {}, RAYONS_ALBUMS:options.data},
    fetch:async (url, args) => {
      calls.push({url, ...args, body:args.body && JSON.parse(args.body)});
      if (options.deny) return {ok:false, status:401};
      let result;
      if (url.endsWith('/owner/site')) result = {permissions:{push:true}};
      else if (url.includes('/git/ref/heads/')) result = {object:{sha:ref}};
      else if (url.includes('/git/commits/original-head')) result = {tree:{sha:'original-tree'}};
      else if (url.includes('/contents/albums-data.js')) result = {content:Buffer.from(fs.readFileSync(path.join(root,'albums-data.js'))).toString('base64')};
      else if (url.endsWith('/git/trees')) result = {sha:'new-tree'};
      else if (url.endsWith('/git/commits')) result = {sha:'new-head'};
      else if (url.endsWith('/git/blobs')) result = {sha:'image-blob'};
      else if (url.includes('/git/refs/heads/')) result = {};
      else throw new Error('Unexpected request: ' + url);
      return {ok:true, status:200, json:async () => result};
    },
    createImageBitmap:async () => ({close(){}}),
    FileReader:class { readAsDataURL() {this.result = 'data:image/png;base64,aW1hZ2U='; this.onload();} }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, script), 'utf8'), context);
  return {$, calls, context, changeHead:() => {ref = 'someone-elses-head';}};
}
const submit = {preventDefault(){}};
async function login(app) {
  app.$('#repository').value = 'owner/site'; app.$('#branch').value = 'main'; app.$('#token').value = 'test-secret';
  await app.$('#login').onsubmit(submit);
}
test('admin authenticates and publishes album manifest in one non-forced commit', async () => {
  const app = environment('admin.js'); await login(app);
  assert.equal(app.$('#login').hidden, true);
  assert.equal(app.$('#token').value, '');
  app.$('#album-title').value = 'Test residence'; app.$('#project').value = 'project-0';
  app.$('#create').onsubmit(submit);
  await app.$('#publish').onclick();
  const tree = app.calls.find(call => call.url.endsWith('/git/trees'));
  assert.equal(tree.body.base_tree, 'original-tree');
  assert.match(tree.body.tree[0].content, /Test residence/);
  assert.equal(tree.body.tree[0].content.includes('test-secret'), false);
  const update = app.calls.find(call => call.method === 'PATCH');
  assert.deepEqual(update.body, {sha:'new-head', force:false});
  app.$('#logout').onclick(); assert.equal(app.$('#workspace').hidden, true);
});
test('invalid credentials cannot open workspace or write to GitHub', async () => {
  const app = environment('admin.js', {deny:true}); app.$('#workspace').hidden = true; await login(app);
  assert.equal(app.$('#workspace').hidden, true); assert.equal(app.$('#token').value, '');
  assert.match(app.$('#admin-status').textContent, /Sign-in failed/);
  assert.equal(app.calls.some(call => call.method !== 'GET'), false);
});
test('uploaded images and their manifest are published together; unsupported files are rejected', async () => {
  const app = environment('admin.js'); await login(app);
  app.$('#album-title').value = 'Images'; app.$('#project').value = 'project-0'; app.$('#create').onsubmit(submit);
  const photo = new Blob(['image'], {type:'image/png'}); photo.name = 'Living room.png';
  app.$('#upload').files = [photo]; await app.$('#upload').onchange();
  app.$('#upload').files = [{type:'text/html', size:10, name:'unsafe.html'}]; await app.$('#upload').onchange();
  assert.match(app.$('#admin-status').textContent, /Use JPEG/);
  await app.$('#publish').onclick();
  const tree = app.calls.find(call => call.url.endsWith('/git/trees')).body.tree;
  assert.equal(tree.length, 2);
  assert.match(tree[0].path, /^assets\/albums\/.+\.png$/);
  assert.equal(tree[0].sha, 'image-blob');
  assert.match(tree[1].content, /Living room.png/);
  assert.equal(tree[1].content.includes(tree[0].path), true);
  assert.equal(app.calls.filter(call => call.method === 'PATCH').length, 1);
  app.$('#logout').onclick();
});
test('concurrent repository changes prevent publication and retain drafts', async () => {
  const app = environment('admin.js'); await login(app);
  app.$('#album-title').value = 'Draft'; app.$('#project').value = 'project-0'; app.$('#create').onsubmit(submit);
  app.changeHead(); await app.$('#publish').onclick();
  assert.match(app.$('#admin-status').textContent, /repository has changed/);
  assert.equal(app.calls.some(call => call.method !== 'GET'), false);
  assert.equal(app.$('#album-select').children.find(option => option.value === app.$('#album-select').value).textContent, 'Draft');
});
test('public gallery shows published covers and no editing controls', async () => {
  const data = {albums:[{id:'a',title:'Residence',project:'project-0'}, {id:'empty',title:'Empty',project:'project-0'}], photos:[{id:'p',album:'a',name:'Living room',src:'assets/albums/room.jpg'}]};
  const app = environment('albums.js', {data});
  await new Promise(resolve => setImmediate(resolve));
  const grid = app.$('#album-content').children[0];
  assert.equal(grid.children.length, 1); assert.equal(grid.children[0].children[0].src, 'assets/albums/room.jpg');
  const script = fs.readFileSync(path.join(root, 'albums.js'), 'utf8');
  assert.doesNotMatch(script, /indexedDB|createElement\('form'\)|type\s*=\s*'file'|Authorization/);
});
