/* Shared automatic motion, headset WebXR and phone glasses controls. */
(function () {
  'use strict';
  const assetBase = new URL('Images/', document.currentScript.src);
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
    let enabled = false, calibrated = false, timer, session = null, glasses = false, immersiveSupported = false, generation = 0;
    const orientation = new THREE.Quaternion();
    const sensorDirection = new THREE.Vector3(), viewDirection = new THREE.Vector3();
    let yawOffset = 0, pitchOffset = 0, targetYaw = 0, targetPitch = 0, smoothYaw = 0, smoothPitch = 0, lastFrame = 0;
    let revealUntil = 0, pointerStart = null, pointerDragged = false;
    function showControls() { document.body.classList.remove('tour-looking'); revealUntil = performance.now() + 2500; }
    function hideControls() {
      document.body.classList.add('tour-looking');
      if (document.activeElement?.closest('.tour-motion-controls,.strip-wrap,.variant-switcher,.hs')) document.activeElement.blur();
    }
    function angleDelta(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
    const euler = new THREE.Euler(), zAxis = new THREE.Vector3(0, 0, 1);
    const correction = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    const screenRotation = new THREE.Quaternion(), stereo = new THREE.StereoCamera();
    stereo.eyeSep = 0; // A panorama has no depth; avoid artificial stereo parallax.
    function stopMotion() {
      generation++;
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
      // Use heading and elevation only. Full quaternion offsets mix roll into
      // yaw/pitch when the phone is calibrated at a tilt, leaving a slanted horizon.
      sensorDirection.set(0, 0, -1).applyQuaternion(orientation);
      const sensorYaw = Math.atan2(sensorDirection.x, -sensorDirection.z);
      const sensorPitch = Math.asin(THREE.MathUtils.clamp(sensorDirection.y, -1, 1));
      if (!calibrated) {
        camera.getWorldDirection(viewDirection);
        smoothYaw = Math.atan2(viewDirection.x, -viewDirection.z);
        smoothPitch = Math.asin(THREE.MathUtils.clamp(viewDirection.y, -1, 1));
        yawOffset = smoothYaw - sensorYaw; pitchOffset = 0; // Gravity defines level; never bake the starting tilt into elevation.
        targetYaw = smoothYaw; targetPitch = smoothPitch; lastFrame = performance.now();
        calibrated = true; clearTimeout(timer);
        status.textContent = 'Move your phone to look around. Tap the view to show controls.';
      }
      const nextYaw = sensorYaw + yawOffset;
      const nextPitch = THREE.MathUtils.clamp(sensorPitch + pitchOffset, -Math.PI * 0.47, Math.PI * 0.47);
      if (performance.now() > revealUntil && (Math.abs(angleDelta(nextYaw, targetYaw)) > 0.004 || Math.abs(nextPitch - targetPitch) > 0.004)) hideControls();
      targetYaw = nextYaw; targetPitch = nextPitch;
    }
    async function startMotion(automatic) {
      if (session || enabled) return;
      if (!window.isSecureContext || !window.DeviceOrientationEvent) {
        status.textContent = 'Drag or swipe to look around. Motion needs HTTPS and phone sensors.'; return;
      }
      const request = ++generation;
      motion.disabled = true;
      try {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
          if (automatic) { status.textContent = 'Tap Enable motion to allow this phone’s motion sensors.'; return; }
          if (await DeviceOrientationEvent.requestPermission() !== 'granted') {
            status.textContent = 'Motion permission was declined. You can still drag or swipe.'; return;
          }
        }
        if (request !== generation) return;
        enabled = true; calibrated = false;
        motion.textContent = 'Disable motion'; motion.setAttribute('aria-pressed', 'true');
        status.textContent = 'Waiting for motion sensors…';
        window.addEventListener('deviceorientation', orient);
        timer = setTimeout(function () { stopMotion(); status.textContent = 'No motion data received. Check sensor permissions or drag to look around.'; }, 5000);
      } catch (_) { stopMotion(); status.textContent = 'Motion access failed. Drag or swipe to look around.'; }
      finally { motion.disabled = !!session; }
    }
    const motion = button('Enable motion', function () {
      if (enabled) { stopMotion(); status.textContent = 'Drag or swipe to look around.'; }
      else startMotion(false);
    });
    motion.setAttribute('aria-pressed', 'false');
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    function vrLabel(label) { vr.setAttribute('aria-label', label); vr.title = label; vr.setAttribute('aria-pressed', String(!!session || glasses)); }
    function endGlasses() {
      glasses = false; document.body.classList.remove('glasses-mode');
      renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
      vrLabel('Enter VR'); window.dispatchEvent(new Event('resize'));
      status.textContent = 'Glasses mode ended. Drag or swipe to look around.';
    }
    const vr = button('', async function () {
      vr.disabled = true;
      try {
        if (session) { await session.end(); return; }
        if (glasses) { endGlasses(); if (document.fullscreenElement) await document.exitFullscreen(); return; }
        if (!immersiveSupported) {
          startMotion(false);
          glasses = true; document.body.classList.add('glasses-mode'); vrLabel('Exit VR');
          status.textContent = 'Turn your phone sideways and place it in your glasses.';
          if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen().catch(function () {});
          return;
        }
        const next = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
        session = next;
        next.addEventListener('end', function () {
          session = null; vrLabel('Enter VR'); vr.disabled = false; motion.disabled = false;
          camera.position.set(0, 0, 0);
          status.textContent = 'VR ended. Drag or swipe to look around.';
        }, { once: true });
        stopMotion();
        await renderer.xr.setSession(next);
        vrLabel('Exit VR'); motion.disabled = true;
        status.textContent = 'Use a controller trigger to visit the next room. Exit using your headset menu.';
      } catch (_) {
        if (session) { try { await session.end(); } catch (_) {} session = null; }
        motion.disabled = false; vrLabel('Enter VR');
        status.textContent = 'VR could not start. Connect your headset and allow VR access, then retry.';
      } finally { vr.disabled = false; }
    });
    vr.className = 'tour-vr-button';
    const icon = document.createElement('img');
    icon.src = new URL('VR.ic.png', assetBase).href; icon.alt = ''; icon.style.cssText = 'display:block;width:36px;height:36px;object-fit:contain';
    vr.appendChild(icon); vrLabel('Enter VR'); vr.disabled = true;
    panel.appendChild(status); document.body.appendChild(panel);
    if (window.isSecureContext && navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then(function (supported) { immersiveSupported = supported; }).catch(function () {}).finally(function () { vr.disabled = false; });
    } else vr.disabled = false;
    for (let index = 0; index < 2; index++) {
      const controller = renderer.xr.getController(index);
      controller.addEventListener('select', onNextRoom); scene.add(controller);
    }
    document.addEventListener('pointerdown', function (event) {
      if (!panel.contains(event.target)) { stopMotion(); status.textContent = 'Drag or swipe to look around.'; }
    }, true);
    canvas.addEventListener('pointerdown', function (event) {
      pointerStart = { x: event.clientX, y: event.clientY }; pointerDragged = false;
    });
    window.addEventListener('pointermove', function (event) {
      if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 4) {
        pointerDragged = true; hideControls();
      }
    });
    window.addEventListener('pointerup', function () {
      if (pointerStart && !pointerDragged) showControls();
      pointerStart = null;
    });
    window.addEventListener('pointercancel', function () { pointerStart = null; });
    canvas.addEventListener('wheel', function () { stopMotion(); hideControls(); }, { capture: true, passive: true });
    document.addEventListener('keydown', function (event) {
      if (event.key.startsWith('Arrow')) { stopMotion(); hideControls(); }
      if (event.key === 'Tab' || event.key === 'Escape') showControls();
      if (event.key === 'Escape' && glasses) endGlasses();
    }, true);
    document.addEventListener('fullscreenchange', function () { if (!document.fullscreenElement && glasses) endGlasses(); });
    window.addEventListener('pagehide', stopMotion);
    startMotion(true);
    return {
      update() {
        if (enabled && calibrated && !renderer.xr.isPresenting) {
          const now = performance.now(), blend = 1 - Math.exp(-Math.min((now - lastFrame) / 1000, 0.1) * 18);
          lastFrame = now;
          smoothYaw += angleDelta(targetYaw, smoothYaw) * blend;
          smoothPitch += (targetPitch - smoothPitch) * blend;
          viewDirection.set(Math.sin(smoothYaw) * Math.cos(smoothPitch), Math.sin(smoothPitch), -Math.cos(smoothYaw) * Math.cos(smoothPitch));
          camera.up.set(0, 1, 0);
          camera.lookAt(viewDirection.add(camera.position));
        }
      },
      render() {
        if (!glasses) return false;
        camera.updateMatrixWorld(); stereo.update(camera);
        const width = innerWidth, height = innerHeight, half = Math.floor(width / 2);
        renderer.setScissorTest(true);
        renderer.setScissor(0, 0, half, height); renderer.setViewport(0, 0, half, height); renderer.render(scene, stereo.cameraL);
        renderer.setScissor(half, 0, width - half, height); renderer.setViewport(half, 0, width - half, height); renderer.render(scene, stereo.cameraR);
        renderer.setScissorTest(false); return true;
      },
      reset() { calibrated = false; },
      async exit() { stopMotion(); if (glasses) endGlasses(); if (session) await session.end(); }
    };
  };
})();
