(() => {
  'use strict';
  const $ = id => document.querySelector(id), encoder = new TextEncoder();
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
    const file=await api('/contents/'+path+'?ref='+head);
    return decode(file.content || (await api('/git/blobs/'+file.sha)).content);
  }
  function validCatalog(value) {
    if(!value || !Array.isArray(value.tours)) throw new Error('Invalid tour catalog.');
    const ids=new Set(); value.tours.forEach(tour=>{TourData.path(tour.id); if(ids.has(tour.id)||typeof tour.title!=='string') throw new Error('Invalid tour catalog.'); ids.add(tour.id);}); return value;
  }
  function renderList() {
    const select=$('#tour-select');select.replaceChildren();
    catalog.tours.forEach(tour=>{const option=document.createElement('option');option.value=tour.id;option.textContent=(tour.id==='sample'?'Public sample — ':tour.published===false?'Offline — ':'Client — ')+tour.title;select.append(option);});
    if(active&&!catalog.tours.some(t=>t.id===active.id)){const draft=document.createElement('option');draft.value=active.id;draft.textContent='New draft — '+($('#tour-title').value||active.title);select.append(draft);}
    if(active) select.value=active.id;
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
      if(!active) await newTour();
      await refreshDrafts();
    } catch(error) {token='';$('#tour-workspace').hidden=true;$('#tour-login').hidden=false;$('#tour-editor').removeAttribute('src');status(error.message);}
    finally{lock(false);}
  };
  $('#tour-select').onchange=async()=>{
    const id=$('#tour-select').value;if(dirty&&!confirm('Discard unpublished changes to switch tours?')){renderList();return;}
    lock(true);try{await load(id);}catch(error){renderList();status(error.message);}finally{lock(false);}
  };
  async function newTour(){
    if(dirty&&!confirm('Discard unpublished changes and start a new client tour?'))return;
    active={id:crypto.randomUUID(),title:'Untitled client tour'};
    await editor().load({scenes:[],floorplan:null,branding:null});$('#tour-title').value=active.title;renderList();share();changed();
  }
  $('#tour-new').onclick=newTour;
  $('#tour-update-token').onclick=async()=>{
    const replacement=$('#tour-replacement-token').value.trim();if(!replacement){status('Enter the replacement token first.');return;}
    const previous=token;lock(true);token=replacement;$('#tour-replacement-token').value='';
    try{const repository=await api('');if(!repository.permissions?.push)throw new Error('Your GitHub account needs write access.');status('Token replaced. Your draft is unchanged. Try Publish tour again to verify write access.');}
    catch(error){token=previous;status(error.message);}finally{lock(false);}
  };
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
      const saved={...active,title:$('#tour-title').value.trim()||'Untitled tour'};
      await TourDrafts.save(scope(),saved,editor().getData());await refreshDrafts();
      $('#draft-status').textContent='Draft saved in this browser. You can restore it after signing in again. It is not published.';
    }catch(error){status(error.message);}finally{lock(false);}
  };
  $('#tour-restore-draft').onclick=async()=>{
    if(!$('#tour-drafts').value)return;
    if(dirty&&!confirm('Replace the current unsaved edits with this browser draft?'))return;
    lock(true);try{
      const saved=await TourDrafts.get($('#tour-drafts').value);if(!saved||saved.scope!==scope())throw new Error('Draft not found.');
      await editor().load(saved.payload);active=catalog.tours.find(t=>t.id===saved.tour.id)||saved.tour;$('#tour-title').value=saved.tour.title;renderList();share();changed();
    }catch(error){status(error.message);}finally{lock(false);}
  };
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
    if(!token||busy||editorBusy)return;
    lock(true);status('Publishing tour…');
    try{
      const title=$('#tour-title').value.trim();if(!title)throw new Error('Enter a tour title.');
      const payload=editor().getData();if(!payload.scenes.length)throw new Error('Add at least one panorama before publishing.');
      payload.title=title;payload.revision=crypto.randomUUID();
      const html=TourFormat.build(payload);if(encoder.encode(html).length>40*1024*1024)throw new Error('This tour exceeds 40 MB. Reduce the number or size of the panoramas.');
      if((await api('/git/ref/heads/'+encodeURIComponent(branch))).object.sha!==head)throw new Error('The repository changed since sign-in. Download your draft backup, sign in again, and import the backup before publishing.');
      const next={id:active.id,title,revision:payload.revision,hasSource:true,published:true,updatedAt:new Date().toISOString(),rooms:payload.scenes.length};const nextCatalog={tours:catalog.tours.filter(tour=>tour.id!==next.id).concat(next)};
      const blob=await api('/git/blobs','POST',{content:html,encoding:'utf-8'});
      const source=await api('/git/blobs','POST',{content:JSON.stringify(payload),encoding:'utf-8'});
      const nextTree=await api('/git/trees','POST',{base_tree:tree,tree:[{path:TourData.path(next.id),mode:'100644',type:'blob',sha:blob.sha},{path:TourData.sourcePath(next.id),mode:'100644',type:'blob',sha:source.sha},{path:'tours/catalog.json',mode:'100644',type:'blob',content:JSON.stringify(nextCatalog)}]});
      const commit=await api('/git/commits','POST',{message:'Publish '+(next.id==='sample'?'sample':'client')+' virtual tour',tree:nextTree.sha,parents:[head]});
      await api('/git/refs/heads/'+encodeURIComponent(branch),'PATCH',{sha:commit.sha,force:false});
      head=commit.sha;tree=nextTree.sha;catalog=nextCatalog;active=next;dirty=false;renderList();share();status('Tour published to GitHub. Use Check live link before sending the link or QR code.');
    }catch(error){status(error.message);}finally{lock(false);}
  };
  function share(){
    liveGeneration++;
    $('#tour-offline').hidden=!active||active.id==='sample'||!active.hasSource||active.published===false;
    $('#tour-share').hidden=!active||active.published===false||!catalog.tours.some(tour=>tour.id===active.id);if($('#tour-share').hidden)return;
    $('#tour-live-status').textContent='Not checked yet. Check the live link before sending it to your client.';
    $('#tour-qr').replaceChildren();$('#tour-link').value='';$('#tour-open').removeAttribute('href');$('#tour-qr-download').removeAttribute('href');if(qrURL){URL.revokeObjectURL(qrURL);qrURL='';}
    try{
      const base=new URL($('#tour-site').value);if(base.protocol!=='https:')throw new Error();base.hash='';base.search='';if(!base.pathname.endsWith('/'))base.pathname+='/';
      const url=new URL(TourData.path(active.id),base).href;
      const qr=qrcode(0,'M');qr.addData(url);qr.make();const svg=qr.createSvgTag({cellSize:6,margin:24,scalable:true});
      $('#tour-link').value=url;$('#tour-open').href=url;$('#tour-qr').innerHTML=svg;qrURL=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));$('#tour-qr-download').href=qrURL;
    }catch{status('Enter the full HTTPS address of your live website to create its link and QR code.');}
  }
  $('#tour-site').oninput=share;
  $('#tour-check-live').onclick=async()=>{
    const generation=liveGeneration, url=$('#tour-link').value;if(!url)return;
    $('#tour-check-live').disabled=true;$('#tour-live-status').textContent='Checking the deployed viewer…';
    try{
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
    if(!confirm('Take this client tour offline? Its link will show an unavailable page after deployment. Editable project data is retained. Unpublished edits are not included.'))return;
    lock(true);try{
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
  $('#tour-logout').onclick=()=>{if(dirty&&!confirm('Discard unpublished changes and sign out?'))return;token='';dirty=false;active=null;catalog={tours:[]};$('#tour-editor').removeAttribute('src');$('#tour-workspace').hidden=true;$('#tour-login').hidden=false;if(qrURL)URL.revokeObjectURL(qrURL);status('Signed out.');};
  window.addEventListener('beforeunload',event=>{if(dirty||busy||editorBusy){event.preventDefault();event.returnValue='';}});
})();
