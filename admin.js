(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const categories = ['project-0', 'project-1', 'project-2', 'project-3'];
  const mimeExtensions = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'image/gif':'gif', 'image/avif':'avif' };
  let token = '', repo = '', branch = '', head = '', tree = '', data = {albums:[], photos:[]};
  let dirty = false, busy = false;
  const pending = new Map(), previews = new Map();
  function status(message) { $('#admin-status').textContent = message; }
  function setBusy(value) {
    busy = value;
    document.querySelectorAll('input,select,button').forEach(node => { node.disabled = value; });
  }
  function changed() { dirty = true; status('Unpublished changes. Select Publish changes when ready.'); }
  async function api(path, method = 'GET', body) {
    const response = await fetch('https://api.github.com/repos/' + repo + path, {
      method, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      ...(body ? {body:JSON.stringify(body)} : {})
    });
    if (!response.ok) {
      const messages = {401:'Sign-in failed or your token has expired.',403:'GitHub denied access. Check token permissions, branch rules, and API limits.',404:'Repository, branch or album data not found. Check your repository and token access.',409:'The repository changed. Sign out and sign in again before editing.',422:'GitHub could not publish. The branch may have changed or have protection rules.'};
      throw new Error(messages[response.status] || 'GitHub request failed (' + response.status + '). Please try again.');
    }
    return response.status === 204 ? null : response.json();
  }
  function decode(content) { return new TextDecoder().decode(Uint8Array.from(atob(content.replace(/\s/g, '')), char => char.charCodeAt(0))); }
  function parseManifest(source) {
    const match = source.match(/window\.RAYONS_ALBUMS\s*=\s*([\s\S]*?)\s*;?\s*$/);
    if (!match) throw new Error('The published album data has an unsupported format.');
    const result = JSON.parse(match[1]);
    if (!Array.isArray(result.albums) || !Array.isArray(result.photos) || result.albums.some(a => typeof a.id !== 'string' || typeof a.title !== 'string' || !categories.includes(a.project)) || result.photos.some(p => typeof p.id !== 'string' || typeof p.album !== 'string' || typeof p.name !== 'string' || !/^assets\/albums\/[a-zA-Z0-9._-]+$/.test(p.src))) throw new Error('The published album data is invalid.');
    return result;
  }
  $('#login').onsubmit = async event => {
    event.preventDefault(); setBusy(true); status('Connecting to GitHub…');
    token = $('#token').value.trim(); $('#token').value = '';
    repo = $('#repository').value.trim(); branch = $('#branch').value.trim();
    try {
      const repository = await api('');
      if (!repository.permissions?.push) throw new Error('This account needs write access to the repository.');
      const ref = await api('/git/ref/heads/' + encodeURIComponent(branch)); head = ref.object.sha;
      const commit = await api('/git/commits/' + head); tree = commit.tree.sha;
      const manifest = await api('/contents/albums-data.js?ref=' + head);
      data = parseManifest(decode(manifest.content));
      $('#login').hidden = true; $('#workspace').hidden = false; dirty = false;
      render(); status('Signed in. Choose an album or create a new one.');
    } catch (error) { token = ''; status(error.message); }
    finally { setBusy(false); }
  };
  function selectedAlbum() { return data.albums.find(album => album.id === $('#album-select').value); }
  function render(selected = $('#album-select').value) {
    const list = $('#album-select'); list.replaceChildren();
    data.albums.forEach(album => { const option = document.createElement('option'); option.value = album.id; option.textContent = album.title; list.append(option); });
    if (data.albums.some(album => album.id === selected)) list.value = selected;
    const album = selectedAlbum(); $('#album-editor').hidden = !album;
    const gallery = $('#admin-gallery'); gallery.replaceChildren();
    if (!album) return;
    $('#rename-title').value = album.title;
    data.photos.filter(photo => photo.album === album.id).forEach(photo => {
      const figure = document.createElement('figure'); figure.className = 'admin-photo';
      const image = document.createElement('img'); image.alt = photo.name; image.loading = 'lazy';
      image.src = previews.get(photo.id) || 'https://raw.githubusercontent.com/' + repo + '/' + head + '/' + photo.src;
      const caption = document.createElement('figcaption'); caption.textContent = photo.name;
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'album-action'; remove.textContent = 'Remove image';
      remove.onclick = () => { discardPhoto(photo); data.photos = data.photos.filter(item => item.id !== photo.id); changed(); render(); };
      figure.append(image, caption, remove); gallery.append(figure);
    });
  }
  function discardPhoto(photo) {
    pending.delete(photo.src);
    if (previews.has(photo.id)) { URL.revokeObjectURL(previews.get(photo.id)); previews.delete(photo.id); }
  }
  $('#album-select').onchange = () => render();
  $('#create').onsubmit = event => {
    event.preventDefault(); const title = $('#album-title').value.trim(); if (!title) return;
    const album = {id:crypto.randomUUID(), title, project:$('#project').value};
    data.albums.push(album); $('#album-title').value = ''; changed(); render(album.id);
  };
  $('#rename').onsubmit = event => { event.preventDefault(); const title = $('#rename-title').value.trim(); if (!title) return; selectedAlbum().title = title; changed(); render(); };
  $('#delete-album').onclick = () => {
    const album = selectedAlbum(); if (!album || !confirm('Remove “' + album.title + '” and its images from the gallery? This takes effect when you publish.')) return;
    data.photos.filter(photo => photo.album === album.id).forEach(discardPhoto);
    data.photos = data.photos.filter(photo => photo.album !== album.id); data.albums = data.albums.filter(item => item.id !== album.id); changed(); render();
  };
  async function addPhoto(file, album, name = file.name, id = crypto.randomUUID()) {
    if (!mimeExtensions[file.type] || file.size > 10 * 1024 * 1024) throw new Error('Use JPEG, PNG, WebP, GIF or AVIF images up to 10 MB each.');
    const bitmap = await createImageBitmap(file); bitmap.close();
    const photo = {id, album, name, src:'assets/albums/' + crypto.randomUUID() + '.' + mimeExtensions[file.type]};
    pending.set(photo.src, file); previews.set(id, URL.createObjectURL(file)); data.photos.push(photo); dirty = true;
  }
  $('#upload').onchange = async () => {
    const album = selectedAlbum(); if (!album) return;
    const files = Array.from($('#upload').files); setBusy(true);
    try { for (const file of files) await addPhoto(file, album.id); changed(); }
    catch (error) { status(error.message + ' Any successfully added images remain as drafts.'); }
    finally { $('#upload').value = ''; render(); setBusy(false); }
  };
  function base64(file) {
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = () => reject(new Error('An image could not be read.')); reader.readAsDataURL(file); });
  }
  $('#publish').onclick = async () => {
    if (!dirty) { status('No unpublished changes.'); return; }
    setBusy(true); status('Publishing images and albums…');
    try {
      const ref = await api('/git/ref/heads/' + encodeURIComponent(branch));
      if (ref.object.sha !== head) throw new Error('The repository has changed since sign-in. Your drafts are still here. Save your images before signing in again to load the latest albums.');
      const entries = [];
      for (const [path, file] of pending) {
        const blob = await api('/git/blobs', 'POST', {content:await base64(file), encoding:'base64'});
        entries.push({path, mode:'100644', type:'blob', sha:blob.sha});
      }
      entries.push({path:'albums-data.js', mode:'100644', type:'blob', content:'window.RAYONS_ALBUMS = ' + JSON.stringify(data, null, 2) + ';\n'});
      const nextTree = await api('/git/trees', 'POST', {base_tree:tree, tree:entries});
      const commit = await api('/git/commits', 'POST', {message:'Publish project albums', tree:nextTree.sha, parents:[head]});
      await api('/git/refs/heads/' + encodeURIComponent(branch), 'PATCH', {sha:commit.sha, force:false});
      head = commit.sha; tree = nextTree.sha; dirty = false; pending.clear();
      status('Published to GitHub. The visitor gallery will update when GitHub Pages finishes deploying, usually within a few minutes.');
    } catch (error) { status(error.message + ' Your drafts remain in this tab.'); }
    finally { setBusy(false); }
  };
  $('#import-local').onclick = async () => {
    setBusy(true); status('Reading previous browser albums…'); let db;
    try {
      db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('rayons-albums', 1);
        request.onupgradeneeded = () => { request.result.createObjectStore('albums', {keyPath:'id'}); request.result.createObjectStore('photos', {keyPath:'id'}); };
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('Browser album storage is unavailable.'));
        request.onblocked = () => reject(new Error('Close other album tabs and try again.'));
      });
      const read = name => new Promise((resolve, reject) => { const request = db.transaction(name).objectStore(name).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('Previous albums could not be read.')); });
      const oldAlbums = await read('albums'), oldPhotos = await read('photos'); let count = 0;
      for (const album of oldAlbums) {
        if (!categories.includes(album.project)) continue;
        if (!data.albums.some(item => item.id === album.id)) { data.albums.push({id:album.id, title:album.title, project:album.project}); dirty = true; }
        for (const photo of oldPhotos.filter(item => item.album === album.id)) {
          if (!data.photos.some(item => item.id === photo.id)) { await addPhoto(photo.file, album.id, photo.name, photo.id); count++; }
        }
      }
      status(count ? 'Imported ' + count + ' images as drafts. Select Publish changes to make them visible to visitors.' : 'No new images found. Import works only in the same browser and site address used for the original uploads.');
    } catch (error) { status(error.message); }
    finally { db?.close(); render(); setBusy(false); }
  };
  $('#logout').onclick = () => {
    if (dirty && !confirm('Discard unpublished changes and sign out?')) return;
    token = ''; pending.clear(); previews.forEach(url => URL.revokeObjectURL(url)); previews.clear(); data = {albums:[],photos:[]}; dirty = false;
    $('#workspace').hidden = true; $('#login').hidden = false; $('#admin-gallery').replaceChildren(); status('Signed out.');
  };
  window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
})();
