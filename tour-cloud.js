(() => {
  'use strict';
  const config = window.RayonCloudConfig;
  let session = null, refreshing = null;
  async function request(path, options = {}, authenticated = true, retry = true) {
    const response = await fetch(config.url + path, {...options, cache:'no-store', headers:{apikey:config.key,
      ...(authenticated && session ? {Authorization:'Bearer '+session.access_token}:{}),
      'Content-Type':'application/json', ...options.headers}});
    if (response.status===401 && authenticated && session?.refresh_token && retry) {
      if (!refreshing) refreshing=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})},false).then(value=>session=value).finally(()=>refreshing=null);
      await refreshing;return request(path,options,authenticated,false);
    }
    const value=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(value?.msg||value?.message||value?.error_description||value?.error||'Request failed ('+response.status+'). Your draft is still open.');
    return value;
  }
  const metadata = row => ({id:row.id,title:row.title,revision:row.revision,objectPath:row.object_path,
    hasSource:true,published:row.published,expiresAt:row.expires_at,rooms:row.rooms,thumbnail:row.thumbnail,updatedAt:row.updated_at});
  const table='/rest/v1/rayon_tours';
  async function list() {return {tours:(await request(table+'?select=*&order=updated_at.desc')).map(metadata)};}
  async function removeFile(path) {
    try{await request('/storage/v1/object/rayon-tours',{method:'DELETE',body:JSON.stringify({prefixes:[path]})});return true;}catch{return false;}
  }
  window.TourCloud={
    async signIn(email,password) {
      session=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})},false);
      if(session.user?.email?.toLowerCase()!==config.adminEmail || !session.user?.email_confirmed_at){await this.signOut();throw new Error('Use the confirmed studio admin account.');}
      return list();
    },
    async signUp(email,password) {
      if(email.toLowerCase()!==config.adminEmail)throw new Error('Use '+config.adminEmail+' for the studio account.');
      await request('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password})},false);
    },
    async signOut(){try{if(session)await request('/auth/v1/logout',{method:'POST'});}finally{session=null;}},
    list,
    async read(id) {const [row]=await request(table+'?id=eq.'+encodeURIComponent(id)+'&select=*');if(!row)throw new Error('This tour was deleted. Refresh the gallery.');return request('/storage/v1/object/authenticated/rayon-tours/'+row.object_path);},
    async publish(active,payload,cover) {
      const path=active.id+'/'+payload.revision+'.json', body=JSON.stringify(payload);
      if(new Blob([body]).size>40*1024*1024)throw new Error('This tour exceeds 40 MB. Reduce the image sizes.');
      await request('/storage/v1/object/rayon-tours/'+path,{method:'POST',headers:{'Cache-Control':'no-store'},body});
      const row={id:active.id,revision:payload.revision,object_path:path,title:payload.title,published:true,
        expires_at:payload.expiresAt,rooms:payload.scenes.length,thumbnail:cover,updated_at:new Date().toISOString()};
      let saved;
      try {
        const filter=active.hasSource?'?id=eq.'+active.id+'&revision=eq.'+active.revision:'';
        [saved]=await request(table+filter,{method:active.hasSource?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)});
        if(!saved)throw new Error('This tour changed in another session. Save a backup and sign in again before publishing.');
      } catch(error) {
        // A lost response may hide a committed write. Never delete a referenced file.
        const current=await request(table+'?id=eq.'+active.id+'&select=revision').catch(()=>null);
        if(current?.[0]?.revision===payload.revision)saved=row;
        else {if(current)await removeFile(path);throw error;}
      }
      if(active.objectPath && active.objectPath!==path)await removeFile(active.objectPath);
      return metadata(saved);
    },
    async remove(tour) {
      const rows=await request(table+'?id=eq.'+tour.id+'&revision=eq.'+tour.revision,{method:'DELETE',headers:{Prefer:'return=representation'}});
      if(!rows.length)throw new Error('This tour changed or was deleted. Sign in again to refresh the gallery.');
      const cleaned=await removeFile(tour.objectPath);return cleaned;
    },
    async offline(tour) {
      const rows=await request(table+'?id=eq.'+tour.id+'&revision=eq.'+tour.revision,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({published:false,revision:tour.revision,updated_at:new Date().toISOString()})});
      if(!rows.length)throw new Error('This tour changed. Sign in again to refresh the gallery.');return metadata(rows[0]);
    },
    link(id){return 'tours/view.html?id='+encodeURIComponent(id);},
    async check(id,revision){const response=await fetch(config.url+'/functions/v1/tour-view?id='+encodeURIComponent(id)+'&status=1',{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.message||'Tour unavailable.');if(data.revision!==revision)throw new Error('A different revision is live. Refresh the gallery.');}
  };
})();
