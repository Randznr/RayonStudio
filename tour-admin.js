(() => {
  'use strict';
  const $ = id => document.querySelector(id), encoder = new TextEncoder();
  let token = '', repo = '', branch = '', head = '', tree = '', catalog = {tours:[]}, active = null, dirty = false, busy = false, qrURL = '';
  const status = text => { $('#tour-status').textContent = text; };
  const editor = () => $('#tour-editor').contentWindow.TourEditor;
  function lock(value) { busy = value; document.querySelectorAll('button,input,select').forEach(node => {node.disabled=value;}); $('#tour-editor').style.pointerEvents=value?'none':''; $('#tour-editor').inert=value; }
  function changed() { dirty=true; status('Unpublished tour changes. Publish or download a backup before leaving.'); }
  async function api(path, method='GET', body) {
    const response = await fetch('https://api.github.com/repos/' + repo + path, {method, headers:{Authorization:'Bearer '+token, Accept:'application/vnd.github+json','Content-Type':'application/json'}, ...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok) throw new Error(response.status===401?'Your GitHub token is invalid or expired.':response.status===404?'Repository, branch, or tour file not found. Upload the complete website first.':response.status===403?'GitHub denied access. Check Contents write permission and branch rules.':'GitHub request failed ('+response.status+'). Your drafts are still in this tab.');
    return response.json();
  }
  function decode(content) { return new TextDecoder().decode(Uint8Array.from(atob(content.replace(/\s/g,'')),char=>char.charCodeAt(0))); }
  async function read(path) {
    const file=await api('/contents/'+path+'?ref='+head);
    return decode(file.content || (await api('/git/blobs/'+file.sha)).content);
  }
  function validCatalog(value) {
    if(!value || !Array.isArray(value.tours)) throw new Error('Invalid tour catalog.');
    const ids=new Set(); value.tours.forEach(tour=>{TourData.path(tour.id); if(ids.has(tour.id)||typeof tour.title!=='string') throw new Error('Invalid tour catalog.'); ids.add(tour.id);}); return value;
  }
  function renderList() {
    const select=$('#tour-select');select.replaceChildren();
    catalog.tours.forEach(tour=>{const option=document.createElement('option');option.value=tour.id;option.textContent=(tour.id==='sample'?'Public sample — ':'Client — ')+tour.title;select.append(option);});
    if(active) select.value=active.id;
  }
  function connectEditor() {
    return new Promise((resolve,reject)=>{
      const frame=$('#tour-editor');
      frame.onload=()=>{if(frame.contentWindow.TourEditor) resolve();else reject(new Error('The editor could not load. Check that all website files were uploaded.'));};
      frame.src='tour-editor.html';frame.hidden=false;
    });
  }
  async function load(id) {
    const next=catalog.tours.find(tour=>tour.id===id); if(!next) return;
    const payload=TourData.parse(await read(TourData.path(next.id)));
    await editor().load(payload);active=next;$('#tour-title').value=next.title;dirty=false;renderList();share();
    status(next.id==='sample'?'Editing the public sample. Changes appear for everyone after publishing.':'Editing a client tour. Its viewing link remains unchanged when you publish.');
  }
  $('#tour-login').onsubmit=async event=>{
    event.preventDefault();lock(true);status('Connecting…');token=$('#tour-token').value.trim();$('#tour-token').value='';repo=$('#tour-repo').value.trim();branch=$('#tour-branch').value.trim();
    try {
      const repository=await api('');if(!repository.permissions?.push) throw new Error('Your GitHub account needs write access.');
      head=(await api('/git/ref/heads/'+encodeURIComponent(branch))).object.sha;tree=(await api('/git/commits/'+head)).tree.sha;
      catalog=validCatalog(JSON.parse(await read('tours/catalog.json')));
      await connectEditor();$('#tour-workspace').hidden=false;$('#tour-login').hidden=true;
      const local=['localhost','127.0.0.1',''].includes(location.hostname);
      if(!local) $('#tour-site').value=new URL('./',location.href).href;
      else $('#tour-site').value='https://'+repo.split('/')[0]+'.github.io/'+(repo.split('/')[1].toLowerCase()===repo.split('/')[0].toLowerCase()+'.github.io'?'':repo.split('/')[1]+'/');
      await load(catalog.tours[0]?.id);
    } catch(error) {token='';$('#tour-workspace').hidden=true;$('#tour-login').hidden=false;$('#tour-editor').removeAttribute('src');status(error.message);}
    finally{lock(false);}
  };
  $('#tour-select').onchange=async()=>{
    const id=$('#tour-select').value;if(dirty&&!confirm('Discard unpublished changes to switch tours?')){renderList();return;}
    lock(true);try{await load(id);}catch(error){renderList();status(error.message);}finally{lock(false);}
  };
  $('#tour-new').onclick=async()=>{
    if(dirty&&!confirm('Discard unpublished changes and start a new client tour?'))return;
    active={id:crypto.randomUUID(),title:'Untitled client tour'};
    await editor().load({scenes:[],floorplan:null,branding:null});$('#tour-title').value=active.title;$('#tour-select').value='';$('#tour-share').hidden=true;changed();
  };
  $('#tour-title').oninput=changed;
  window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===$('#tour-editor').contentWindow&&event.data?.type==='rayon-tour-changed'&&token&&!busy)changed();});
  $('#tour-import').onchange=async()=>{
    const file=$('#tour-import').files[0];if(!file)return;
    if(dirty&&!confirm('Replace this draft with the imported tour?')){$('#tour-import').value='';return;}
    lock(true);try{if(file.size>40*1024*1024)throw new Error('Tour files must be under 40 MB.');const payload=TourData.parse(await file.text());await editor().load(payload);changed();}
    catch(error){status(error.message);}finally{$('#tour-import').value='';lock(false);}
  };
  function download(content,name,type) {const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('#tour-backup').onclick=()=>{try{download(JSON.stringify(editor().getData()),'rayon-tour-backup.json','application/json');}catch(error){status(error.message);}};
  $('#tour-preview').onclick=()=>{
    try{const payload=editor().getData();if(!payload.scenes.length)throw new Error('Add a panorama first.');const html=TourFormat.build(payload);$('#tour-preview-frame').srcdoc=html.replace('<head>','<head><base href="'+new URL('tours/',location.href).href+'">');$('#tour-preview-dialog').showModal();}catch(error){status(error.message);}
  };
  $('#tour-preview-close').onclick=()=>$('#tour-preview-dialog').close();
  $('#tour-preview-dialog').addEventListener('close',()=>{$('#tour-preview-frame').srcdoc='';});
  $('#tour-publish').onclick=async()=>{
    if(!token||busy)return;
    lock(true);status('Publishing tour…');
    try{
      const title=$('#tour-title').value.trim();if(!title)throw new Error('Enter a tour title.');
      const payload=editor().getData();if(!payload.scenes.length)throw new Error('Add at least one panorama before publishing.');
      const html=TourFormat.build(payload);if(encoder.encode(html).length>40*1024*1024)throw new Error('This tour exceeds 40 MB. Reduce the number or size of the panoramas.');
      if((await api('/git/ref/heads/'+encodeURIComponent(branch))).object.sha!==head)throw new Error('The repository changed since sign-in. Download your draft backup, sign in again, and import the backup before publishing.');
      const next={id:active.id,title};const nextCatalog={tours:catalog.tours.filter(tour=>tour.id!==next.id).concat(next)};
      const blob=await api('/git/blobs','POST',{content:html,encoding:'utf-8'});
      const nextTree=await api('/git/trees','POST',{base_tree:tree,tree:[{path:TourData.path(next.id),mode:'100644',type:'blob',sha:blob.sha},{path:'tours/catalog.json',mode:'100644',type:'blob',content:JSON.stringify(nextCatalog)}]});
      const commit=await api('/git/commits','POST',{message:'Publish '+(next.id==='sample'?'sample':'client')+' virtual tour',tree:nextTree.sha,parents:[head]});
      await api('/git/refs/heads/'+encodeURIComponent(branch),'PATCH',{sha:commit.sha,force:false});
      head=commit.sha;tree=nextTree.sha;catalog=nextCatalog;active=next;dirty=false;renderList();share();status('Tour published to GitHub. Share its link or QR code after GitHub Pages finishes deploying.');
    }catch(error){status(error.message);}finally{lock(false);}
  };
  function share(){
    $('#tour-share').hidden=!active||!catalog.tours.some(tour=>tour.id===active.id);if($('#tour-share').hidden)return;
    $('#tour-qr').replaceChildren();$('#tour-link').value='';$('#tour-open').removeAttribute('href');$('#tour-qr-download').removeAttribute('href');if(qrURL){URL.revokeObjectURL(qrURL);qrURL='';}
    try{
      const base=new URL($('#tour-site').value);if(base.protocol!=='https:')throw new Error();base.hash='';base.search='';if(!base.pathname.endsWith('/'))base.pathname+='/';
      const url=new URL(TourData.path(active.id),base).href;
      const qr=qrcode(0,'M');qr.addData(url);qr.make();const svg=qr.createSvgTag({cellSize:6,margin:24,scalable:true});
      $('#tour-link').value=url;$('#tour-open').href=url;$('#tour-qr').innerHTML=svg;qrURL=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));$('#tour-qr-download').href=qrURL;
    }catch{status('Enter the full HTTPS address of your live website to create its link and QR code.');}
  }
  $('#tour-site').oninput=share;
  $('#tour-copy').onclick=async()=>{try{if(!$('#tour-link').value)return;await navigator.clipboard.writeText($('#tour-link').value);status('Tour link copied.');}catch{status('Select the viewing link and copy it manually.');}};
  $('#tour-logout').onclick=()=>{if(dirty&&!confirm('Discard unpublished changes and sign out?'))return;token='';dirty=false;active=null;catalog={tours:[]};$('#tour-editor').removeAttribute('src');$('#tour-workspace').hidden=true;$('#tour-login').hidden=false;if(qrURL)URL.revokeObjectURL(qrURL);status('Signed out.');};
  window.addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});
})();
