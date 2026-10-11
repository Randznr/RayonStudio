/* Shared visitor controls, also loaded by generated tour pages. */
(function () {
  'use strict';
  const whatsappIcon = new URL('Images/wa.me.png', document.currentScript.src).href;
  document.addEventListener('contextmenu', function (event) { event.preventDefault(); });
  document.addEventListener('dragstart', function (event) {
    if (event.target.closest('img, canvas')) event.preventDefault();
  });
  function mount() {
    if (window.parent !== window || document.getElementById('whatsapp-chat') || document.querySelector('canvas#c, [data-tour-viewer]')) return;
    const link = document.createElement('a');
    link.id = 'whatsapp-chat';
    link.href = 'https://wa.me/26774074086';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Chat with Rayon Studio on WhatsApp');
    const icon = document.createElement('img');
    icon.src = whatsappIcon; icon.alt = '';
    icon.style.cssText = 'display:block;width:52px;height:52px;object-fit:contain';
    link.appendChild(icon);
    link.style.cssText = 'position:fixed;right:16px;bottom:max(16px,env(safe-area-inset-bottom));z-index:1000;width:52px;height:52px;border-radius:50%;background:transparent;text-decoration:none;filter:drop-shadow(0 3px 7px #0003);';
    document.body.appendChild(link);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
