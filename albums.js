(() => {
  const types = { residential: ['Residential projects', 'project-0'], commercial: ['Commercial interiors', 'project-2'], architectural: ['Architectural visualisation', 'project-1'], details: ['Detail studies', 'project-3'] };
  const type = new URLSearchParams(location.search).get('project');
  const selected = types[type];
  const content = document.querySelector('#album-content'), title = document.querySelector('#page-title'), status = document.querySelector('#status');
  if (!selected) { content.innerHTML = '<div class="album-grid"><a class="album-card" href="albums.html?project=residential">Residential projects</a><a class="album-card" href="albums.html?project=commercial">Commercial interiors</a><a class="album-card" href="albums.html?project=architectural">Architectural visualisation</a><a class="album-card" href="albums.html?project=details">Detail studies</a></div>'; return; }
  const categoryURL = 'albums.html?project=' + type;
  const category = document.querySelector('#category-link'); category.href = categoryURL; category.textContent = selected[0];
  document.title = selected[0] + ' | RAYON Studio';
  let photos = [], urls = [], current = 0, generation = 0;
  const viewer = document.querySelector('#viewer');
  async function store(name) { return (window.RAYONS_ALBUMS || {albums:[],photos:[]})[name]; }
  function report(error) { status.textContent = error.message || 'Unable to load the gallery. Please try again.'; }
  function reset() { if (viewer.open) viewer.close(); urls.forEach(url => URL.revokeObjectURL(url)); urls = []; content.replaceChildren(); status.textContent = ''; }
  function link(text, href, className) { const node = document.createElement('a'); node.textContent = text; node.href = href; node.className = className; return node; }
  async function render() {
    const token = ++generation; reset(); title.textContent = selected[0] + ' — Albums'; document.querySelector('#gallery-trail').textContent = '';
    const albumId = location.hash.slice(1);
    if (!albumId) {
      const grid = document.createElement('div'); grid.className = 'album-grid'; grid.textContent = 'Loading albums…'; content.append(grid);
      try {
        const allPhotos = await store('photos');
        const albums = (await store('albums')).filter(album => album.project === selected[1] && allPhotos.some(photo => photo.album === album.id));
        if (token !== generation) return;
        grid.replaceChildren();
        albums.forEach(album => {
          const images = allPhotos.filter(photo => photo.album === album.id);
          const card = link('', '#' + encodeURIComponent(album.id), 'album-card public-album-card');
          const cover = document.createElement('img'); cover.src = images[0].src; cover.alt = album.title; cover.loading = 'lazy';
          const caption = document.createElement('div'); caption.className = 'album-card-caption';
          const heading = document.createElement('h2'); heading.textContent = album.title;
          const count = document.createElement('span'); count.textContent = images.length + (images.length === 1 ? ' image' : ' images');
          caption.append(heading, count); card.append(cover, caption); grid.append(card);
        });
        if (!albums.length) grid.textContent = 'New projects are on the way. Please visit again soon.';
      } catch (error) { grid.textContent = 'Albums could not be loaded.'; report(error); }
      return;
    }
    content.textContent = 'Loading gallery…';
    try {
      const album = (await store('albums')).find(item => item.id === albumId && item.project === selected[1]);
      if (token !== generation) return;
      if (!album) { content.replaceChildren(link('Album unavailable. Return to albums.', categoryURL, 'album-action')); return; }
      photos = (await store('photos')).filter(photo => photo.album === album.id);
      if (token !== generation) return;
      title.textContent = album.title; document.querySelector('#gallery-trail').textContent = '/ ' + album.title + ' / Gallery'; content.replaceChildren();
      const controls = document.createElement('div'); controls.className = 'gallery-controls'; controls.append(link('← All albums', categoryURL, 'album-action'));
      content.append(controls);
      const grid = document.createElement('div'); grid.className = 'gallery-grid';
      photos.forEach((photo, index) => { const url = photo.src; urls.push(url); const button = document.createElement('button'); button.type = 'button'; button.className = 'gallery-tile'; button.setAttribute('aria-label', 'View ' + photo.name); const img = document.createElement('img'); img.src = url; img.alt = photo.name; img.loading = 'lazy'; button.append(img); button.onclick = () => { current = index; display(); viewer.showModal(); }; grid.append(button); });
      if (!photos.length) grid.textContent = 'Images for this project are coming soon.';
      content.append(grid);

    } catch (error) { content.textContent = 'Gallery could not be loaded.'; report(error); }
  }
  function display() { const image = document.querySelector('#full-image'); image.src = urls[current]; image.alt = photos[current].name; document.querySelector('#caption').textContent = photos[current].name + ' · ' + (current + 1) + ' / ' + photos.length; document.querySelector('#previous').hidden = document.querySelector('#next').hidden = photos.length < 2; }
  function step(amount) { current = (current + amount + photos.length) % photos.length; display(); }
  document.querySelector('#previous').onclick = () => step(-1); document.querySelector('#next').onclick = () => step(1); document.querySelector('#close-image').onclick = () => viewer.close();
  viewer.onkeydown = event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1); } };
  window.addEventListener('hashchange', render); render();
})();

