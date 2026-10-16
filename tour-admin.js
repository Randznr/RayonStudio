(() => {
  'use strict';
  const $ = id => document.querySelector(id), encoder = new TextEncoder(), cloud=window.TourCloud;
  let token = '', repo = '', branch = '', head = '', tree = '', catalog = {tours:[]}, active = null, dirty = false, busy = false, qrURL = '';
  let editorBusy = false, liveGeneration = 0;
  const scope = () => repo + ':' + branch;
  const status = text => { $('#tour-status').textContent = text; };
  const editor = () => $('#tour-editor').contentWindow.TourEditor;
  function lock(value) { busy = value; document.querySelectorAll('button,input,select').forEach(node => {node.disabled=value;}); $('#tour-editor').style.pointerEvents=value?'none':''; $('#tour-editor').inert=value; }
  function changed() { dirty=true; status('Unpublished tour changes. Publish or download a backup before leaving.'); }
  async function api(path, method='GET', body) {
    const response = await fetch('https://api.github.com/repos/' + repo + path, {method, headers:{Authorization:'Bearer '+token, Accept:'application/vnd.github+json','Content-Type':'application/json'}, ...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok) {
      const detail=await response.json().catch(()=>({}));
      const message=String(detail.message||'').slice(0,600);
      let help='Your draft is still open. Save a browser draft or download a backup before signing out.';
      if(response.status===401)help='Your token is invalid or expired. Replace it below without closing your draft.';
      else if(response.status===429||/rate limit|abuse/i.test(message))help='GitHub temporarily limited requests. Wait before trying again; your draft is still open.';
      else if(/protected|rule|hook declined/i.test(message))help='GitHub blocked this branch update. Review the publishing branch rules with the repository owner; your draft is still open.';
      else if(response.status===403)help='Check that your fine-grained token selects '+repo+' and has Repository permissions > Contents: Read and write (not read-only). Save the token permissions, then replace the token below if needed. Your draft is still open.';
      else if(response.status===404)help='Check repository access, branch name and that the complete website has been uploaded.';
      throw new Error('GitHub '+response.status+' during '+method+' '+path.split('?')[0]+': '+(message||response.statusText)+'. '+help);
    }
    return response.json();
  }
  function decode(content) { return new TextDecoder().decode(Uint8Array.from(atob(content.replace(/\s/g,'')),char=>char.charCodeAt(0))); }
  async function read(path) {
    if(cloud){const id=path.includes('/data/')?path.split('/').pop().replace('.json',''):path.split('/').pop().replace(/^client-/,'').replace('.html','');return JSON.stringify(await cloud.read(id));}
    const file=await api('/contents/'+path+'?ref='+head);
    return decode(file.content || (await api('/git/blobs/'+file.sha)).content);
  }
  function validCatalog(value) {
    if(!value || !Array.isArray(value.tours)) throw new Error('Invalid tour catalog.');
    const ids=new Set(); value.tours.forEach(tour=>{TourData.path(tour.id); if(ids.has(tour.id)||typeof tour.title!=='string') throw new Error('Invalid tour catalog.'); ids.add(tour.id);}); return value;
  }
  const previews = new Map();
  let galleryGeneration = 0;
  const previewKey = tour => scope()+':'+tour.id+':'+(tour.revision||'legacy');
  function expirySettings() { return {mode:$('#tour-expiry').value,date:$('#tour-expires-at').value}; }
  let originalExpiry = null, originalExpiryInput = '';
  function setExpiry(expiresAt, setting) {
    $('#tour-expiry').value=setting?.mode || (expiresAt?'custom':'none');
    if(setting) $('#tour-expires-at').value=setting.date||'';
    else if(expiresAt) {const date=new Date(expiresAt);$('#tour-expires-at').value=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
    else $('#tour-expires-at').value='';
    originalExpiry=expiresAt||null;originalExpiryInput=$('#tour-expires-at').value;
    updateExpirySummary();
  }
  function getExpiry(requireFuture=false) {
    const mode=$('#tour-expiry').value;
    if(mode==='none')return null;
    const value=mode==='custom'?new Date(originalExpiry&&originalExpiryInput&&$('#tour-expires-at').value===originalExpiryInput?originalExpiry:$('#tour-expires-at').value):new Date(Date.now()+Number(mode)*86400000);
    if(!Number.isFinite(value.getTime()))throw new Error('Choose a valid expiry date and time.');
    if(requireFuture && value.getTime()<=Date.now())throw new Error('Choose a future expiry date, or select No expiry to reopen this tour.');
    return value.toISOString();
  }
  function updateExpirySummary() {
    $('#tour-expiry-custom').hidden=$('#tour-expiry').value!=='custom';
    try {const expiry=getExpiry();$('#tour-expiry-summary').textContent=expiry?'Viewing ends '+new Date(expiry).toLocaleString()+'.':'The viewing link will remain available until you take it offline or delete it.';}
    catch {$('#tour-expiry-summary').textContent='Choose the date and time when viewing should end.';}
  }
  $('#tour-expiry').onchange=()=>{updateExpirySummary();changed();};
  $('#tour-expires-at').oninput=()=>{updateExpirySummary();changed();};
  function currentPayload() {return {...editor().getData(),title:$('#tour-title').value.trim(),expiresAt:getExpiry()};}
  async function thumbnail(image) {
    if(!image)return null;
    const img=new Image();img.src=image;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=400;canvas.height=225;
    const scale=Math.max(canvas.width/img.width,canvas.height/img.height);
    canvas.getContext('2d').drawImage(img,(canvas.width-img.width*scale)/2,(canvas.height-img.height*scale)/2,img.width*scale,img.height*scale);
    return canvas.toDataURL('image/jpeg',0.72);
  }
  function safeThumbnail(value) {return typeof value==='string'&&value.length<150000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);}
  function renderList() {
    const generation=++galleryGeneration, gallery=$('#tour-gallery');gallery.replaceChildren();
    const tours=[...catalog.tours];
    if(active&&!tours.some(t=>t.id===active.id))tours.push({...active,title:$('#tour-title').value||active.title,draft:true});
    if(!tours.length){const empty=document.createElement('p');empty.className='tour-gallery-empty';empty.textContent='No tours yet. Create your first client tour.';gallery.append(empty);}
    const missing=[];
    for(const tour of tours) {
      const card=document.createElement('article');card.className='tour-card'+(active?.id===tour.id?' is-active':'');card.dataset.tourId=tour.id;
      const preview=document.createElement('button');preview.type='button';preview.dataset.action='open';preview.className='tour-card-preview';preview.setAttribute('aria-label','Open '+tour.title);preview.disabled=busy||editorBusy;preview.textContent='Preview loading...';
      const showPreview=src=>{preview.replaceChildren();if(src){const img=document.createElement('img');img.src=src;img.alt='Preview of '+tour.title;preview.append(img);}else preview.textContent='Add a panorama to create a preview';};
      const cached=previews.get(previewKey(tour)),src=safeThumbnail(tour.thumbnail)?tour.thumbnail:cached;
      if(src)showPreview(src);else if(tour.draft)showPreview(null);else missing.push({tour,showPreview});
      const body=document.createElement('div');body.className='tour-card-body';
      const state=document.createElement('div');state.className='tour-card-state';
      const expired=tour.expiresAt&&Date.parse(tour.expiresAt)<=Date.now();
      state.textContent=tour.draft?'Unpublished draft':tour.published===false?'Offline':expired?'Expired':tour.id==='sample'?'Public sample':'Available';
      const title=document.createElement('h3');title.textContent=tour.title;
      const meta=document.createElement('p');meta.className='tour-card-meta';meta.textContent=(tour.rooms!=null?tour.rooms+' rooms | ':'')+(tour.expiresAt?'Expires '+new Date(tour.expiresAt).toLocaleString():'No expiry');
      const actions=document.createElement('div');actions.className='tour-card-actions';
      const edit=document.createElement('button');edit.type='button';edit.className='album-action';edit.dataset.action='edit';edit.textContent=active?.id===tour.id?'Editing':'Edit tour';edit.setAttribute('aria-label','Edit '+tour.title);edit.setAttribute('aria-pressed',String(active?.id===tour.id));actions.append(edit);
      if(!tour.draft){const remove=document.createElement('button');remove.type='button';remove.className='album-action tour-delete';remove.dataset.action='delete';remove.textContent='Delete';remove.setAttribute('aria-label','Delete '+tour.title);actions.append(remove);}
      actions.querySelectorAll('button').forEach(button=>button.disabled=busy||editorBusy);
      body.append(state,title,meta,actions);card.append(preview,body);gallery.append(card);
    }
    // Older projects have no catalog thumbnail. Upgrade their preview lazily in memory.
    (async()=>{for(const item of missing){if(generation!==galleryGeneration||!token)return;try{
      const payload=TourData.parse(await read(item.tour.hasSource?TourData.sourcePath(item.tour.id):TourData.path(item.tour.id)));
      const src=await thumbnail(payload.scenes[0]?.image);if(src)previews.set(previewKey(item.tour),src);
      if(generation===galleryGeneration)item.showPreview(src);
    }catch{if(generation===galleryGeneration)item.showPreview(null);}}})();
  }
  function showTourEditor() {
    const heading=$('#tour-edit-heading');heading.textContent='Edit: '+($('#tour-title').value||'Untitled tour');
    heading.focus({preventScroll:true});heading.scrollIntoView({block:'start',behavior:'smooth'});
  }
  $('#tour-back-gallery').onclick=()=>{const heading=$('#tour-library-heading');heading.focus({preventScroll:true});heading.scrollIntoView({block:'start',behavior:'smooth'});};
  $('#tour-gallery').onclick=async event=>{
    const card=event.target.closest('[data-tour-id]');if(!card||busy||editorBusy)return;
    const button=event.target.closest('button[data-action]'),id=card.dataset.tourId;
    if(button?.dataset.action==='delete'){await deleteTour(id);return;}
    if(active?.id===id){showTourEditor();return;}
    if(dirty&&!confirm('Discard unpublished changes to switch tours?'))return;
    lock(true);try{await load(id);showTourEditor();}catch(error){status(error.message);}finally{lock(false);}
  };
  async function deleteTour(id) {
    const target=catalog.tours.find(t=>t.id===id);if(!target)return;
    const warning=cloud?'Delete "'+target.title+'"? Its viewing link will stop working. Download a backup first if needed. Browser drafts and previous downloads are retained.':'Delete "'+target.title+'"? This removes its published viewer and editable project from the current repository. Its link stops working after deployment. Download a backup first if you need it. Git history and existing downloads are retained.'+(id==='sample'?' The public sample link on your website will also stop working.':'')+(active?.id===id&&dirty?' Unpublished edits to this tour will also be discarded.':'');
    if(!confirm(warning))return;
    lock(true);try{
      if(cloud){const cleaned=await cloud.remove(target);catalog.tours=catalog.tours.filter(t=>t.id!==id);if(active?.id===id){dirty=false;active=null;await newTour();dirty=false;}renderList();share();status(cleaned?'Tour deleted. Its link is now unavailable.':'Tour link disabled and project deleted. An unused private storage file could not be cleaned up.');return;}
      if((await api('/git/ref/heads/'+encodeURIComponent(branch))).object.sha!==head)throw new Error('The repository changed. Save a draft or backup and sign in again.');
      const nextCatalog={...catalog,tours:catalog.tours.filter(t=>t.id!==id)};
      const entries=[{path:TourData.path(id),mode:'100644',type:'blob',sha:null}];
      if(target.hasSource)entries.push({path:TourData.sourcePath(id),mode:'100644',type:'blob',sha:null});
      entries.push({path:'tours/catalog.json',mode:'100644',type:'blob',content:JSON.stringify(nextCatalog)});
      const nextTree=await api('/git/trees','POST',{base_tree:tree,tree:entries});
      const commit=await api('/git/commits','POST',{message:'Delete client virtual tour',tree:nextTree.sha,parents:[head]});
      await api('/git/refs/heads/'+encodeURIComponent(branch),'PATCH',{sha:commit.sha,force:false});
      head=commit.sha;tree=nextTree.sha;catalog=nextCatalog;
      if(active?.id===id){active=null;dirty=false;await newTour();dirty=false;}
      renderList();share();status('Tour deleted from GitHub. Its link stops working after deployment. Saved browser drafts and downloaded backups are retained.');
    }catch(error){status(error.message);}finally{lock(false);}
  }
  function connectEditor() {
    return new Promise((resolve,reject)=>{
      const frame=$('#tour-editor');
      const timeout=setTimeout(()=>reject(new Error('The editor took too long to load. Refresh and try again.')),20000);
      frame.onload=()=>{
        clearTimeout(timeout);
        if(!frame.contentWindow.TourEditor){reject(new Error('The editor could not load. Check that all website files were uploaded.'));return;}
        const doc=frame.contentDocument;
        const style=doc.createElement('style');
        style.textContent='html,body{min-height:0!important;background:transparent!important}body{display:flow-root}.wrap{max-width:none;padding-left:0;padding-right:0}';
        doc.head.append(style);
        const resize=()=>{const height=Math.ceil(doc.body.getBoundingClientRect().height);if(height>0)frame.style.height=height+'px';};
        new frame.contentWindow.ResizeObserver(resize).observe(doc.body);
        resize();resolve();
      };
      frame.src='tour-editor.html';frame.hidden=false;
    });
  }
  async function load(id) {
    const next=catalog.tours.find(tour=>tour.id===id); if(!next) return;
    const payload=TourData.parse(await read(next.hasSource ? TourData.sourcePath(next.id) : TourData.path(next.id)));
    await editor().load(payload);active=next;$('#tour-title').value=next.title;setExpiry(next.expiresAt||payload.expiresAt);previews.set(previewKey(next),await thumbnail(payload.scenes[0]?.image));dirty=false;renderList();share();
    status(next.id==='sample'?'Editing the public sample. Changes appear for everyone after publishing.':'Editing a client tour. Its viewing link remains unchanged when you publish.');
  }
  $('#tour-login').onsubmit=async event=>{
    event.preventDefault();lock(true);status('Signing in…');
    try {
      catalog=validCatalog(await cloud.signIn($('#tour-email').value.trim(),$('#tour-password').value));
      $('#tour-password').value='';token='supabase-session';repo='supabase';branch=RayonCloudConfig.url;
      await connectEditor();$('#tour-workspace').hidden=false;$('#tour-login').hidden=true;
      if(!['localhost','127.0.0.1',''].includes(location.hostname))$('#tour-site').value=new URL('./',location.href).href;
      await load(catalog.tours[0]?.id);if(!active)await newTour();await refreshDrafts();
    }catch(error){token='';$('#tour-workspace').hidden=true;$('#tour-login').hidden=false;$('#tour-editor').removeAttribute('src');status(error.message);}
    finally{$('#tour-password').value='';lock(false);}
  };
  $('#tour-create-account').onclick=async()=>{
    if(!$('#tour-login').reportValidity())return;
    lock(true);try{await cloud.signUp($('#tour-email').value.trim(),$('#tour-password').value);status('Check your email to confirm your account, then return here and sign in with your password. If the confirmation opens an unavailable page, return here after confirming.');}
    catch(error){status(error.message);}finally{$('#tour-password').value='';lock(false);}
  };
  async function newTour(){
    if(dirty&&!confirm('Discard unpublished changes and start a new client tour?'))return;
    active={id:crypto.randomUUID(),title:'Untitled client tour'};
    await editor().load({scenes:[],floorplan:null,branding:null});$('#tour-title').value=active.title;setExpiry(null);renderList();share();changed();
  }
  $('#tour-new').onclick=newTour;
  $('#tour-title').oninput=changed;
  window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===$('#tour-editor').contentWindow&&event.data?.type==='rayon-tour-changed'&&token&&!busy)changed();});
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==$('#tour-editor').contentWindow||!token)return;
    if(event.data?.type==='rayon-editor-busy'){
      editorBusy=Boolean(event.data.busy);
      document.querySelectorAll('#tour-workspace button,#tour-workspace input,#tour-workspace select').forEach(node=>node.disabled=editorBusy||busy);
    }
  });
  async function refreshDrafts(){
    const select=$('#tour-drafts');select.replaceChildren();
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose a saved browser draft';select.append(placeholder);
    try{for(const item of await TourDrafts.list(scope())){const option=document.createElement('option');option.value=item.key;option.textContent=item.tour.title+' — '+new Date(item.savedAt).toLocaleString();select.append(option);}}
    catch(error){$('#draft-status').textContent=error.message;}
  }
  $('#tour-save-draft').onclick=async()=>{
    lock(true);try{
      if(!active)throw new Error('Choose or create a tour first.');
      const saved={...active,title:$('#tour-title').value.trim()||'Untitled tour',expirySetting:expirySettings()};
      await TourDrafts.save(scope(),saved,currentPayload());await refreshDrafts();
      $('#draft-status').textContent='Draft saved in this browser. You can restore it after signing in again. It is not published.';
    }catch(error){status(error.message);}finally{lock(false);}
  };
  $('#tour-restore-draft').onclick=async()=>{
    if(!$('#tour-drafts').value)return;
    if(dirty&&!confirm('Replace the current unsaved edits with this browser draft?'))return;
    lock(true);try{
      const saved=await TourDrafts.get($('#tour-drafts').value);if(!saved||saved.scope!==scope())throw new Error('Draft not found.');
      await editor().load(saved.payload);active=catalog.tours.find(t=>t.id===saved.tour.id)||saved.tour;$('#tour-title').value=saved.tour.title;setExpiry(saved.payload.expiresAt,saved.tour.expirySetting);renderList();share();changed();
    }catch(error){status(error.message);}finally{lock(false);}
  };
  $('#tour-import').onchange=async()=>{
    const file=$('#tour-import').files[0];if(!file)return;
    if(dirty&&!confirm('Replace this draft with the imported tour?')){$('#tour-import').value='';return;}
    lock(true);try{if(file.size>40*1024*1024)throw new Error('Tour files must be under 40 MB.');const payload=TourData.parse(await file.text());await editor().load(payload);setExpiry(payload.expiresAt);changed();}
    catch(error){status(error.message);}finally{$('#tour-import').value='';lock(false);}
  };
  function download(content,name,type) {const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('#tour-backup').onclick=()=>{try{download(JSON.stringify(currentPayload()),'rayon-tour-backup.json','application/json');}catch(error){status(error.message);}};
  $('#tour-preview').onclick=()=>{
    try{const payload=currentPayload();if(!payload.scenes.length)throw new Error('Add a panorama first.');const html=TourFormat.build(payload);$('#tour-preview-frame').srcdoc=html.replace('<head>','<head><base href="'+new URL('tours/',location.href).href+'">');$('#tour-preview-dialog').showModal();}catch(error){status(error.message);}
  };
  $('#tour-preview-close').onclick=()=>$('#tour-preview-dialog').close();
  $('#tour-preview-dialog').addEventListener('close',()=>{$('#tour-preview-frame').srcdoc='';});
  $('#tour-publish').onclick=async()=>{
    if(!token||busy||editorBusy)return;
    lock(true);status('Publishing tour…');
    try{
      const title=$('#tour-title').value.trim();if(!title)throw new Error('Enter a tour title.');
      const payload=editor().getData();if(!payload.scenes.length)throw new Error('Add at least one panorama before publishing.');
      payload.title=title;payload.revision=crypto.randomUUID();payload.expiresAt=getExpiry(true);
      const cover=await thumbnail(payload.scenes[0].image);
      if(cloud){const next=await cloud.publish(active,payload,cover);catalog.tours=catalog.tours.filter(t=>t.id!==next.id).concat(next);active=next;dirty=false;setExpiry(next.expiresAt);renderList();share();status('Tour published. Its viewing link is live now.');return;}
      const html=TourFormat.build(payload);if(encoder.encode(html).length>40*1024*1024)throw new Error('This tour exceeds 40 MB. Reduce the number or size of the panoramas.');
      if((await api('/git/ref/heads/'+encodeURIComponent(branch))).object.sha!==head)throw new Error('The repository changed since sign-in. Download your draft backup, sign in again, and import the backup before publishing.');
      const next={id:active.id,title,revision:payload.revision,hasSource:true,published:true,updatedAt:new Date().toISOString(),rooms:payload.scenes.length,expiresAt:payload.expiresAt,thumbnail:cover};const nextCatalog={tours:catalog.tours.filter(tour=>tour.id!==next.id).concat(next)};
      const blob=await api('/git/blobs','POST',{content:html,encoding:'utf-8'});
      const source=await api('/git/blobs','POST',{content:JSON.stringify(payload),encoding:'utf-8'});
      const nextTree=await api('/git/trees','POST',{base_tree:tree,tree:[{path:TourData.path(next.id),mode:'100644',type:'blob',sha:blob.sha},{path:TourData.sourcePath(next.id),mode:'100644',type:'blob',sha:source.sha},{path:'tours/catalog.json',mode:'100644',type:'blob',content:JSON.stringify(nextCatalog)}]});
      const commit=await api('/git/commits','POST',{message:'Publish '+(next.id==='sample'?'sample':'client')+' virtual tour',tree:nextTree.sha,parents:[head]});
      await api('/git/refs/heads/'+encodeURIComponent(branch),'PATCH',{sha:commit.sha,force:false});
      head=commit.sha;tree=nextTree.sha;catalog=nextCatalog;active=next;dirty=false;setExpiry(next.expiresAt);renderList();share();status('Tour published to GitHub. Use Check live link before sending the link or QR code.');
    }catch(error){status(error.message);}finally{lock(false);}
  };
  function share(){
    liveGeneration++;
    $('#tour-offline').hidden=!active||active.id==='sample'||!active.hasSource||active.published===false;
    $('#tour-share').hidden=!active||active.published===false||!catalog.tours.some(tour=>tour.id===active.id);if($('#tour-share').hidden)return;
    $('#tour-live-status').textContent=active.expiresAt&&Date.parse(active.expiresAt)<=Date.now()?'This tour has expired. Choose a new availability period and publish to reopen it.':'Not checked yet. Check the live link before sending it to your client.';
    $('#tour-qr').replaceChildren();$('#tour-link').value='';$('#tour-open').removeAttribute('href');$('#tour-qr-download').removeAttribute('href');if(qrURL){URL.revokeObjectURL(qrURL);qrURL='';}
    try{
      const base=new URL($('#tour-site').value);if(base.protocol!=='https:')throw new Error();base.hash='';base.search='';if(!base.pathname.endsWith('/'))base.pathname+='/';
      const url=new URL(cloud?cloud.link(active.id):TourData.path(active.id),base).href;
      const qr=qrcode(0,'M');qr.addData(url);qr.make();const svg=qr.createSvgTag({cellSize:6,margin:24,scalable:true});
      $('#tour-link').value=url;$('#tour-open').href=url;$('#tour-qr').innerHTML=svg;qrURL=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));$('#tour-qr-download').href=qrURL;
    }catch{status('Enter the full HTTPS address of your live website to create its link and QR code.');}
  }
  $('#tour-site').oninput=share;
  $('#tour-check-live').onclick=async()=>{
    const generation=liveGeneration, url=$('#tour-link').value;if(!url)return;
    if(active.expiresAt&&Date.parse(active.expiresAt)<=Date.now()){$('#tour-live-status').textContent='This tour has expired. Extend its availability and publish before sharing.';return;}
    $('#tour-check-live').disabled=true;$('#tour-live-status').textContent='Checking the deployed viewer…';
    try{
      if(cloud){await cloud.check(active.id,active.revision);if(generation===liveGeneration)$('#tour-live-status').textContent='Ready to share — the latest published tour is live.';return;}
      const response=await fetch(url+'?verify='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error('Not live yet (HTTP '+response.status+'). Wait for GitHub Pages and check again.');
      const html=await response.text();
      if(!html.includes('id="data"')||(active.revision&&!html.includes('name="rayon-revision" content="'+active.revision+'"')))throw new Error('An older version is still live. Wait for the latest deployment, then check again.');
      if(generation===liveGeneration)$('#tour-live-status').textContent='Ready to share — the latest published tour is live.';
    }catch(error){if(generation===liveGeneration)$('#tour-live-status').textContent=error.message||'Could not verify the link. Open it to check manually.';}
    finally{$('#tour-check-live').disabled=false;}
  };
  $('#tour-offline').onclick=async()=>{
    if(!active||active.id==='sample'||!active.hasSource||busy||editorBusy)return;
    if(!confirm('Take this client tour offline? New views will be blocked immediately. Open viewers close at their next availability check. Editable project data is retained.'))return;
    lock(true);try{
      if(cloud){active=await cloud.offline(active);catalog.tours=catalog.tours.map(t=>t.id===active.id?active:t);renderList();share();status('Tour taken offline. Publish to reopen the same link.');return;}
      if((await api('/git/ref/heads/'+encodeURIComponent(branch))).object.sha!==head)throw new Error('The repository changed. Save a draft or backup and sign in again.');
      const next={...active,published:false,updatedAt:new Date().toISOString()};
      const nextCatalog={tours:catalog.tours.map(t=>t.id===next.id?next:t)};
      const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Tour unavailable | Rayon Studio</title><link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="../theme.css"><script src="../site-features.js" defer></script></head><body><main class="section"><h1>This tour is unavailable.</h1><p>Please contact Rayon Studio for an updated viewing link.</p><a href="../index.html#contact">Contact the studio</a></main></body></html>';
      const nextTree=await api('/git/trees','POST',{base_tree:tree,tree:[{path:TourData.path(next.id),mode:'100644',type:'blob',content:html},{path:'tours/catalog.json',mode:'100644',type:'blob',content:JSON.stringify(nextCatalog)}]});
      const commit=await api('/git/commits','POST',{message:'Take client tour offline',tree:nextTree.sha,parents:[head]});
      await api('/git/refs/heads/'+encodeURIComponent(branch),'PATCH',{sha:commit.sha,force:false});
      head=commit.sha;tree=nextTree.sha;catalog=nextCatalog;active=next;renderList();share();status('Tour taken offline in GitHub. The viewing link will show an unavailable page after deployment. Republish to reopen the same link.');
    }catch(error){status(error.message);}finally{lock(false);}
  };
  $('#tour-copy').onclick=async()=>{try{if(!$('#tour-link').value)return;await navigator.clipboard.writeText($('#tour-link').value);status('Tour link copied.');}catch{status('Select the viewing link and copy it manually.');}};
  $('#tour-logout').onclick=async()=>{if(dirty&&!confirm('Discard unpublished changes and sign out?'))return;try{await cloud.signOut();}catch{}token='';galleryGeneration++;previews.clear();$('#tour-gallery').replaceChildren();dirty=false;active=null;catalog={tours:[]};$('#tour-editor').removeAttribute('src');$('#tour-workspace').hidden=true;$('#tour-login').hidden=false;if(qrURL)URL.revokeObjectURL(qrURL);status('Signed out.');};
  window.addEventListener('beforeunload',event=>{if(dirty||busy||editorBusy){event.preventDefault();event.returnValue='';}});
})();
