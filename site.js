const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('nav');
toggle?.addEventListener('click', () => {
  const expanded = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!expanded));
  nav.classList.toggle('open', !expanded);
});
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  toggle?.setAttribute('aria-expanded', 'false'); nav.classList.remove('open');
}));
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-filter]').forEach(item => {
    item.classList.toggle('active', item === button);
    item.setAttribute('aria-pressed', String(item === button));
  });
  document.querySelectorAll('[data-category]').forEach(project => {
    project.hidden = button.dataset.filter !== 'all' && project.dataset.category !== button.dataset.filter;
  });
}));
document.querySelectorAll('[data-year]').forEach(item => item.textContent = new Date().getFullYear());

// Keep project images linked even when cards use the original placeholder markup.
const albumTypes = {
  'tone-one': 'residential',
  'tone-two': 'architectural',
  'tone-three': 'commercial',
  'tone-four': 'details'
};
document.querySelectorAll('.project').forEach(project => {
  const image = project.querySelector('.project-image');
  const heading = project.querySelector('h3');
  if (!image) return;
  const type = Object.keys(albumTypes).find(tone => image.classList.contains(tone));
  if (!type) return;
  const href = 'albums.html?project=' + albumTypes[type];
  let imageLink = image;
  if (image.tagName !== 'A') {
    imageLink = document.createElement('a');
    imageLink.className = image.className;
    imageLink.append(...image.childNodes);
    image.replaceWith(imageLink);
  }
  imageLink.href = href;
  imageLink.setAttribute('aria-label', 'View ' + (heading?.textContent.trim() || 'project') + ' albums');
  if (heading) {
    let titleLink = heading.querySelector('a');
    if (!titleLink) {
      titleLink = document.createElement('a');
      titleLink.textContent = heading.textContent.trim();
      heading.replaceChildren(titleLink);
    }
    titleLink.href = href;
  }
});
