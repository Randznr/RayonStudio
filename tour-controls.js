/* Motion controls and immersive WebXR for the public panorama viewer. */
(function () {
  'use strict';
  window.RayonTourControls = function ({ renderer, camera, scene, canvas, onManual, onNextRoom }) {
    const panel = document.createElement('div');
    panel.className = 'tour-motion-controls';
    panel.style.cssText = 'position:fixed;top:160px;right:14px;z-index:40;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;max-width:230px;color:white;font:12px/1.4 system-ui,sans-serif';
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    status.style.cssText = 'flex-basis:100%;background:#191919dd;padding:8px;border-radius:6px';
    function button(label, action) {
      const node = document.createElement('button');
      node.type = 'button'; node.textContent = label;
      node.style.cssText = 'background:#191919e6;color:white;border:1px solid #ffffff70;border-radius:6px;padding:10px;min-height:44px;font:inherit;cursor:pointer';
      node.addEventListener('click', action); panel.appendChild(node); return node;
    }
    let enabled = false, calibrated = false, timer, session = null;
    const orientation = new THREE.Quaternion(), offset = new THREE.Quaternion();
    const euler = new THREE.Euler(), zAxis = new THREE.Vector3(0, 0, 1);
    const correction = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    const screenRotation = new THREE.Quaternion();
    function stopMotion() {
      if (enabled && calibrated) onManual(camera.getWorldDirection(new THREE.Vector3()));
      enabled = false; calibrated = false; clearTimeout(timer);
      window.removeEventListener('deviceorientation', orient);
      motion.textContent = 'Enable motion'; motion.setAttribute('aria-pressed', 'false');
    }
    function orient(event) {
      if (![event.alpha, event.beta, event.gamma].every(Number.isFinite)) return;
      const rad = THREE.MathUtils.degToRad;
      euler.set(rad(event.beta), rad(event.alpha), -rad(event.gamma), 'YXZ');
      orientation.setFromEuler(euler).multiply(correction);
      orientation.multiply(screenRotation.setFromAxisAngle(zAxis, -rad(window.screen.orientation?.angle || window.orientation || 0)));
      if (!calibrated) {
        offset.copy(camera.quaternion).multiply(orientation.clone().invert());
        calibrated = true; clearTimeout(timer);
        status.textContent = 'Move your phone to look around. Drag to return to manual control.';
      }
    }
    const motion = button('Enable motion', async function () {
      if (enabled) { stopMotion(); status.textContent = 'Drag or swipe to look around.'; return; }
      if (!window.isSecureContext) { status.textContent = 'Open this tour over HTTPS to use motion controls.'; return; }
      if (!window.DeviceOrientationEvent) { status.textContent = 'Motion sensors are unavailable. Drag or swipe to look around.'; return; }
      motion.disabled = true;
      try {
        if (typeof DeviceOrientationEvent.requestPermission === 'function' && await DeviceOrientationEvent.requestPermission() !== 'granted') {
          status.textContent = 'Motion permission was declined. You can still drag or swipe.'; return;
        }
        enabled = true; calibrated = false;
        motion.textContent = 'Disable motion'; motion.setAttribute('aria-pressed', 'true');
        status.textContent = 'Waiting for motion sensors…';
        window.addEventListener('deviceorientation', orient);
        timer = setTimeout(function () { stopMotion(); status.textContent = 'No motion data received. Check sensor permissions or drag to look around.'; }, 5000);
      } catch (_) { stopMotion(); status.textContent = 'Motion access failed. Drag or swipe to look around.'; }
      finally { motion.disabled = false; }
    });
    motion.setAttribute('aria-pressed', 'false');
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    const vr = button('Checking VR…', async function () {
      vr.disabled = true;
      try {
        if (session) { await session.end(); return; }
        const next = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
        session = next;
        next.addEventListener('end', function () {
          session = null; vr.textContent = 'Enter VR'; vr.disabled = false; motion.disabled = false;
          camera.position.set(0, 0, 0);
          status.textContent = 'VR ended. Drag or swipe to look around.';
        }, { once: true });
        stopMotion();
        await renderer.xr.setSession(next);
        vr.textContent = 'Exit VR'; motion.disabled = true;
        status.textContent = 'Use a controller trigger to visit the next room. Exit using your headset menu.';
      } catch (_) {
        if (session) { try { await session.end(); } catch (_) {} session = null; }
        motion.disabled = false; vr.textContent = 'Enter VR';
        status.textContent = 'VR could not start. Connect your headset and allow VR access, then retry.';
      } finally { vr.disabled = false; }
    });
    vr.disabled = true;
    status.textContent = 'Drag or swipe to look around. Enable motion on a phone.';
    panel.appendChild(status); document.body.appendChild(panel);
    if (window.isSecureContext && navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then(function (supported) {
        vr.disabled = !supported; vr.textContent = supported ? 'Enter VR' : 'VR unavailable';
        if (!supported) vr.title = 'Open this tour in a WebXR-compatible headset browser.';
      }).catch(function () { vr.textContent = 'VR unavailable'; });
    } else { vr.textContent = 'VR unavailable'; vr.title = 'VR needs HTTPS and a WebXR-compatible browser and headset.'; }
    for (let index = 0; index < 2; index++) {
      const controller = renderer.xr.getController(index);
      controller.addEventListener('select', onNextRoom); scene.add(controller);
    }
    canvas.addEventListener('pointerdown', stopMotion, true);
    document.addEventListener('keydown', function (event) { if (event.key.startsWith('Arrow')) stopMotion(); }, true);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stopMotion(); });
    window.addEventListener('pagehide', stopMotion);
    return {
      update() { if (enabled && calibrated && !renderer.xr.isPresenting) camera.quaternion.copy(offset).multiply(orientation); },
      reset: stopMotion,
      async exit() { stopMotion(); if (session) await session.end(); }
    };
  };
})();
