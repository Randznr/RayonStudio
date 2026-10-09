/* Local project drafts only. Authentication tokens are never stored here. */
window.TourDrafts = (() => {
  let opening;
  function db() {
    return opening ||= new Promise((resolve,reject) => {
      const request=indexedDB.open('rayon-tour-drafts',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('drafts',{keyPath:'key'});
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>{opening=null;reject(new Error('Draft storage is unavailable. Download an editable backup instead.'));};
    });
  }
  async function transaction(mode,action) {
    const database=await db();
    return new Promise((resolve,reject)=>{
      const tx=database.transaction('drafts',mode),request=action(tx.objectStore('drafts'));
      tx.oncomplete=()=>resolve(request.result);
      tx.onerror=tx.onabort=()=>reject(new Error('Draft could not be saved. Download a backup and check browser storage space.'));
    });
  }
  return {
    save: (scope,tour,payload)=>transaction('readwrite',store=>store.put({key:scope+':'+tour.id,scope,tour,payload,savedAt:new Date().toISOString()})),
    list: async scope=>(await transaction('readonly',store=>store.getAll())).filter(item=>item.scope===scope).sort((a,b)=>b.savedAt.localeCompare(a.savedAt)),
    get: key=>transaction('readonly',store=>store.get(key)),
    remove: key=>transaction('readwrite',store=>store.delete(key))
  };
})();
