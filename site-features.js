/* Shared visitor controls, also loaded by generated tour pages. */
(function () {
  'use strict';
  document.addEventListener('contextmenu', function (event) { event.preventDefault(); });
  document.addEventListener('dragstart', function (event) {
    if (event.target.closest('img, canvas')) event.preventDefault();
  });
  function mount() {
    if (window.parent !== window || document.getElementById('whatsapp-chat')) return;
    const link = document.createElement('a');
    link.id = 'whatsapp-chat';
    link.href = 'https://wa.me/26774074086';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Chat with Rayon Studio on WhatsApp');
    link.textContent = 'WhatsApp';
    link.style.cssText = 'position:fixed;right:16px;bottom:max(16px,env(safe-area-inset-bottom));z-index:1000;padding:12px 18px;border-radius:28px;background:#126b3d;color:#fff;font:600 14px/1.4 system-ui,sans-serif;text-decoration:none;box-shadow:0 4px 16px #0003;';
    if (document.getElementById('c')) link.style.bottom = '230px';
    document.body.appendChild(link);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
