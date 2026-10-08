// This file is injected inside the editor closure by the preparation script.
  function editorPayload() {
    return {scenes:state.scenes, floorplan:state.tour.floorplan, branding:state.tour.branding};
  }
  window.TourEditor = {
    getData: () => TourData.validate(editorPayload()),
    load: async payload => {
      payload = TourData.validate(payload);
      state.scenes = payload.scenes; state.scenes.forEach(normalizeScene);
      state.currentId = state.scenes[0]?.id || null;
      state.tour = {floorplan:payload.floorplan || null, floorplanW:0, floorplanH:0, branding:payload.branding || {image:null,position:'top-right',opacity:.92,scale:.16}};
      state.editMode = false; state.clientPreview = false;
      document.body.classList.remove('client-preview');
      document.getElementById('btnExitPreview').style.display = 'none';
      document.querySelectorAll('.hotspot,.note-pop').forEach(node => node.remove());
      state.lon = state.scenes[0]?.initialLon ?? -90; state.lat = state.scenes[0]?.initialLat ?? 0;
      applyBrandingOverlay(); renderMinimapShell(); renderStrip(); refreshViewerState(); resizeRenderer();
    }
  };
  const replacement = document.createElement('input'); replacement.type = 'file'; replacement.accept = 'image/jpeg,image/png,image/webp'; replacement.hidden = true; document.body.append(replacement);
  const replaceButton = document.createElement('button'); replaceButton.className = 'btn ghost'; replaceButton.textContent = 'Replace room image';
  document.getElementById('btnNewScene').after(replaceButton);
  replaceButton.onclick = () => { if (currentScene()) replacement.click(); else alert('Add a room first.'); };
  replacement.onchange = async () => {
    const sc = currentScene(), file = replacement.files[0]; if (!sc || !file) return;
    try { sc.image = await fileToCompressedDataURL(file); await persistScene(sc); setTextureForCurrentScene(); renderStrip(); }
    catch(error) { alert(error.message || 'The panorama could not be read.'); }
    replacement.value = '';
  };
