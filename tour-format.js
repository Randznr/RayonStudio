(function(){
  function buildViewerHtml(json){
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>RAYON Studio | Virtual Tour</title><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">' +
    '<script src="../assets/vendor/three.min.js"><\/script>' +

    '<style>' +
    'html,body{margin:0;height:100%;background:#1a1815;font-family:Inter,sans-serif;overflow:hidden;}' +
    '#c{width:100%;height:100%;display:block;cursor:grab;}' +
    '.hs{position:absolute;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50%;border:2px solid #faf7f1;box-shadow:0 3px 10px rgba(0,0,0,.4);cursor:pointer;}' +
    '.hs.note{background:#b08a4e;} .hs.link{background:#5f6e4f;}' +
    '.lbl{position:absolute;bottom:125px;left:16px;font-family:Fraunces,serif;font-style:italic;color:#faf7f1;background:rgba(34,31,26,.5);padding:7px 14px;border-radius:2px;font-size:16px;}' +
    '.strip-wrap{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(0deg, rgba(0,0,0,.8), transparent);padding:20px 10px 10px;transition:transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);z-index:10;}' +
    '.strip-wrap.closed{transform:translateY(120%);}' +
    '.strip{display:flex;gap:8px;overflow-x:auto;padding-bottom:10px;}' +
    '.strip-head{display:flex;justify-content:space-between;align-items:center;padding:0 10px 10px;color:#fff;font-size:11px;font-family:"Space Mono",monospace;text-transform:uppercase;letter-spacing:1px;}' +
    '.btn-hide{background:rgba(255,255,255,0.15);border:none;color:#fff;padding:6px 10px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:11px;}' +
    '.btn-hide:hover{background:rgba(255,255,255,0.25);}' +
    '.btn-show{position:absolute;bottom:20px;right:20px;z-index:5;background:#fff;color:#000;border:none;padding:10px 14px;border-radius:4px;cursor:pointer;font-weight:bold;font-family:Inter,sans-serif;display:none;box-shadow:0 4px 12px rgba(0,0,0,0.3);}' +
    '.strip-wrap.closed ~ .btn-show{display:block;}' +
    '.sw{flex:0 0 80px;height:52px;border-radius:2px;overflow:hidden;position:relative;cursor:pointer;border:2px solid transparent;opacity:.75;}' +
    '.sw.on{border-color:#faf7f1;opacity:1;}' +
    '.sw img{width:100%;height:100%;object-fit:cover;display:block;}' +
    '.pop{position:absolute;max-width:220px;background:#faf7f1;color:#221f1a;border-radius:4px;box-shadow:0 10px 30px rgba(0,0,0,.4);padding:12px 14px;border-left:3px solid #b08a4e;font-size:12.5px;line-height:1.5;}' +
    '.pop h4{margin:0 0 4px;font-family:Fraunces,serif;font-size:14.5px;}' +
    '.pop .x{position:absolute;top:6px;right:8px;cursor:pointer;color:#4b453c;}' +
    '.credit{position:absolute;top:12px;right:14px;font-family:"Space Mono",monospace;font-size:10px;letter-spacing:.08em;color:rgba(250,247,241,.55);text-transform:uppercase;}' +
    '.mm{position:absolute;top:14px;right:14px;width:130px;height:130px;background:rgba(34,31,26,.55);border:1px solid rgba(250,247,241,.3);border-radius:4px;overflow:hidden;display:none;}' +
    '.mm.show{display:block;}' +
    '.mm img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.92;}' +
    '.mm .pin{position:absolute;width:10px;height:10px;border-radius:50%;background:#b08a4e;border:1.5px solid #faf7f1;transform:translate(-50%,-50%);cursor:pointer;}' +
    '.mm .pin.cur{background:#5f6e4f;width:12px;height:12px;box-shadow:0 0 0 4px rgba(95,110,79,.35);}' +
    '.mm .cone{position:absolute;width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-bottom:24px solid #ffffff;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));transform-origin:50% 100%;pointer-events:none;}' +
    '.brand{position:absolute;pointer-events:none;max-width:34%;max-height:22%;object-fit:contain;display:none;}' +
    '.brand.show{display:block;}' +
    '.brand.tl{top:14px;left:14px;} .brand.tr{top:14px;right:14px;} .brand.bl{bottom:64px;left:14px;} .brand.br{bottom:64px;right:14px;}' +
    '.variant-switcher{position:absolute;top:14px;left:14px;z-index:20;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,0.12);backdrop-filter:blur(12px);color:#fff;font-family:Inter,sans-serif;min-width:120px;width:128px;text-align:center;}' +
    '.variant-switcher label{display:block;font-size:10px;font-weight:700;margin-bottom:6px;letter-spacing:.02em;text-align:center;}' +
    '.variant-track{display:flex;align-items:center;justify-content:center;cursor:pointer;}' +
    '.variant-track input{width:42px;height:10px;cursor:pointer;appearance:none;-webkit-appearance:none;outline:none;margin:0;pointer-events:none;touch-action:none;border-radius:999px;}' +
    '.variant-track input::-webkit-slider-runnable-track{height:5px;border-radius:999px;background:rgba(255,255,255,0.35);}'+
    '.variant-track input::-webkit-slider-thumb{width:14px;height:14px;border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,0.12);margin-top:-2px;box-shadow:0 1px 4px rgba(0,0,0,0.24);}' +
    '.variant-track input::-moz-range-track{height:5px;border-radius:999px;background:rgba(255,255,255,0.35);}' +
    '.variant-track input::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,0.12);box-shadow:0 1px 4px rgba(0,0,0,0.24);}' +
    '.variant-current{margin-top:4px;font-size:9px;color:rgba(255,255,255,0.72);}' +
    '.fade-overlay{position:absolute;inset:0;pointer-events:none;background-size:cover;background-position:center center;opacity:0;transition:opacity .42s ease;}' +
    '.tour-logo{position:absolute;top:18px;left:18px;width:80px;height:auto;z-index:25;pointer-events:none;background:transparent}.tour-logo img{display:block;width:100%;height:auto}#tour-help{top:auto!important;bottom:165px;margin:0}.variant-switcher{top:130px}.brand.tl{top:130px}.credit{display:none}@media(max-width:650px){.tour-logo{width:64px;top:14px;left:14px}.variant-switcher{top:110px}.brand.tl{top:110px}}</style></head><body><div class="tour-logo"><img src="../Images/RAYONSLOGO copy.png" alt="Rayon Studio"></div>' +
    '<p id="tour-help" style="position:absolute;top:12px;left:14px;color:white;z-index:4;font:12px sans-serif;max-width:60%;pointer-events:none;background:rgba(20,25,21,.72);padding:8px 10px;border-radius:4px">Drag to look around. Scroll to zoom. Select a room below.</p><canvas id="c"></canvas><div id="fade" class="fade-overlay"></div><div class="variant-switcher" id="variantSwitcher" style="display:none;text-align:center;"><label id="variantHeader" style="display:block;font-size:10px;margin:0 0 4px;"></label><div class="variant-track"><input id="variantRange" type="range" min="0" max="1" step="1" value="0" style="width:42px; height:10px; appearance:none; -webkit-appearance:none; outline:none; margin:0; pointer-events:none; touch-action:none; border-radius:999px;"></div><div id="variantCurrent" class="variant-current" style="margin-top:4px;font-size:9px;">Original</div></div><div class="lbl" id="lbl"></div>' +
    '<div class="strip-wrap" id="stripWrap"><div class="strip-head"><span>Rooms in this tour</span><button class="btn-hide" id="btnHideRooms">✕ Hide</button></div><div class="strip" id="strip"></div></div><button class="btn-show" id="btnShowRooms">↑ Show rooms</button>' +
    '<div class="mm" id="mm"></div><img class="brand" id="brand">' +
    '<div class="credit">360&deg; walkthrough</div>' +
    '<script id="data" type="application/json">' + json + '<\/script>' +
    '<script>' + viewerRuntimeJs() + '<\/script>' +
    '</body></html>';
  }

  function viewerRuntimeJs(){
    return `
    (function(){
      var data = JSON.parse(document.getElementById('data').textContent);
      var scenes = data.scenes;
      if (!window.THREE) { document.getElementById('tour-help').textContent = 'The viewer could not load. Please refresh the page.'; return; }
      document.addEventListener('keydown', function(e) { if(e.key==='ArrowLeft') lon-=5; if(e.key==='ArrowRight') lon+=5; if(e.key==='ArrowUp') lat=Math.min(85,lat+5); if(e.key==='ArrowDown') lat=Math.max(-85,lat-5); });
      var cur = 0, lon=-90, lat=0, fov=78, down=false, dragged=false, dx0=0, dy0=0, lon0=0, lat0=0;
      var canvas = document.getElementById('c');
      var fadeEl = document.getElementById('fade');
      
      document.getElementById('btnHideRooms').addEventListener('click', function(){ document.getElementById('stripWrap').classList.add('closed'); });
      document.getElementById('btnShowRooms').addEventListener('click', function(){ document.getElementById('stripWrap').classList.remove('closed'); });

      // branding
      if(data.branding && data.branding.image){
        var brandEl = document.getElementById('brand');
        var posMap = {'top-left':'tl','top-right':'tr','bottom-left':'bl','bottom-right':'br'};
        brandEl.src = data.branding.image;
        brandEl.style.opacity = data.branding.opacity;
        brandEl.style.maxWidth = (data.branding.scale*100)+'%';
        brandEl.style.maxHeight = (data.branding.scale*130)+'%';
        brandEl.className = 'brand show ' + (posMap[data.branding.position]||'tr');
      }

      // minimap
      var mmEl = document.getElementById('mm');
      function renderMinimap(){
        if(!data.floorplan){ return; }
        mmEl.classList.add('show');
        mmEl.innerHTML = '<img src="'+data.floorplan+'">';
        scenes.forEach(function(s,i){
          if(s.mapX==null || s.mapY==null) return;
          var pin = document.createElement('div');
          pin.className = 'pin' + (i===cur ? ' cur' : '');
          pin.style.left = (s.mapX*100)+'%'; pin.style.top = (s.mapY*100)+'%';
          pin.title = s.name;
          pin.addEventListener('click', function(ev){ ev.stopPropagation(); loadScene(i); });
          mmEl.appendChild(pin);
        });
        var cone = document.createElement('div');
        cone.className = 'cone'; cone.id = 'mmCone2';
        mmEl.appendChild(cone);
        updateCone();
      }
      function updateCone(){
        var cone = document.getElementById('mmCone2');
        if(!cone) return;
        var s = scenes[cur];
        if(!s || s.mapX==null || s.mapY==null){ cone.style.display='none'; return; }
        cone.style.display = 'block';
        cone.style.left = (s.mapX*100)+'%'; cone.style.top = (s.mapY*100)+'%';
        
        var angle = (s.mapHeading||0) + lon;
        cone.style.transform = 'translate(-50%,-100%) rotate('+angle+'deg)';
      }
      var renderer; try { renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:true}); } catch(e) { document.getElementById("tour-help").textContent = "360 viewing requires WebGL. Try another browser or enable hardware acceleration."; return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
      var camera = new THREE.PerspectiveCamera(fov, window.innerWidth/window.innerHeight, 0.1, 1000);
      var scene3 = new THREE.Scene();
      var geo = new THREE.SphereGeometry(500,60,40); geo.scale(-1,1,1);
      var mat = new THREE.MeshBasicMaterial({color:0x2b2721});
      var sphere = new THREE.Mesh(geo, mat); scene3.add(sphere);
      function resize(){ renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); }
      window.addEventListener('resize', resize); resize();
      function loadScene(i){
        cur = i; 
        var s = scenes[i];
        lon = s.initialLon !== undefined ? s.initialLon : -90; 
        lat = s.initialLat !== undefined ? s.initialLat : 0; 
        fov = 78;
        var src = (s.alt && s.alt.active && s.alt.image) ? s.alt.image : s.image;
        if(fadeEl){
          var oldSrc = sphere.material.map && sphere.material.map.image ? sphere.material.map.image.currentSrc || sphere.material.map.image.src : '';
          if(oldSrc) fadeEl.style.backgroundImage = 'url(' + oldSrc + ')';
          else fadeEl.style.backgroundImage = '';
          fadeEl.style.opacity = '1';
        }
        var loader = new THREE.TextureLoader();
        loader.load(src, function(tex){
          if(sphere.material.map) sphere.material.map.dispose();
          sphere.material.map = tex;
          sphere.material.color.set(0xffffff);
          sphere.material.needsUpdate = true;
          if(fadeEl){ requestAnimationFrame(function(){ fadeEl.style.opacity = '0'; }); }
        });
        document.getElementById('lbl').textContent = s.name;
        renderStrip();
        renderMinimap();
        updateVariantButton();
      }
      function renderStrip(){
        var strip = document.getElementById('strip'); strip.innerHTML='';
        scenes.forEach(function(s,i){
          var d = document.createElement('div');
          d.className = 'sw'+(i===cur?' on':'');
          d.innerHTML = '<img src="'+s.image+'">';
          d.addEventListener('click', function(){ loadScene(i); });
          strip.appendChild(d);
        });
      }
      function updateVariantButton(){
        var switcher = document.getElementById('variantSwitcher');
        var header = document.getElementById('variantHeader');
        var current = document.getElementById('variantCurrent');
        var range = document.getElementById('variantRange');
        var s = scenes[cur];
        if(!s || !s.alt || !s.alt.image){ switcher.style.display='none'; return; }
        switcher.style.display='block';
        header.textContent = s.alt.header || 'Style switch';
        range.value = s.alt.active ? '1' : '0';
        current.textContent = s.alt.active ? (s.alt.labelB || 'Alternate') : (s.alt.labelA || 'Original');
      }
      canvas.addEventListener('pointerdown', function(e){ down=true; dragged=false; dx0=e.clientX; dy0=e.clientY; lon0=lon; lat0=lat; canvas.style.cursor='grabbing'; });
      window.addEventListener('pointermove', function(e){ if(!down) return; var dx=e.clientX-dx0, dy=e.clientY-dy0; if(Math.abs(dx)>3||Math.abs(dy)>3) dragged=true; lon = lon0 - dx*0.18; lat = Math.max(-85, Math.min(85, lat0 + dy*0.18)); });
      window.addEventListener('pointerup', function(e){ if(!down) return; down=false; canvas.style.cursor='grab'; if(!dragged) handleClick(e); });
      canvas.addEventListener('wheel', function(e){ e.preventDefault(); fov = Math.max(32, Math.min(96, fov + e.deltaY*0.04)); }, {passive:false});
      var variantRange = document.getElementById('variantRange');
      variantRange.addEventListener('input', function(){
        var s = scenes[cur];
        if(!s || !s.alt || !s.alt.image) return;
        s.alt.active = this.value === '1';
        document.getElementById('variantCurrent').textContent = s.alt.active ? (s.alt.labelB || 'Alternate') : (s.alt.labelA || 'Original');
        loadScene(cur);
      });
      variantRange.style.pointerEvents = 'none';
      variantRange.style.touchAction = 'none';
      document.querySelector('.variant-track').addEventListener('click', function(){
        var s = scenes[cur];
        if(!s || !s.alt || !s.alt.image) return;
        variantRange.value = variantRange.value === '1' ? '0' : '1';
        variantRange.dispatchEvent(new Event('input', { bubbles:true }));
      });
      function handleClick(e){
        var rect = canvas.getBoundingClientRect();
        var mouse = new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1, -((e.clientY-rect.top)/rect.height)*2+1);
        var ray = new THREE.Raycaster(); ray.setFromCamera(mouse, camera);
      }
      function animate(){
        requestAnimationFrame(animate);
        var phi = THREE.MathUtils.degToRad(90-lat), theta = THREE.MathUtils.degToRad(lon);
        var target = new THREE.Vector3(500*Math.sin(phi)*Math.cos(theta), 500*Math.cos(phi), 500*Math.sin(phi)*Math.sin(theta));
        camera.lookAt(target); camera.fov = fov; camera.updateProjectionMatrix();
        renderer.render(scene3, camera);
        updateHotspots();
        updateCone();
      }
      function updateHotspots(){
        var s = scenes[cur]; 
        if(!s || !s.hotspots) {
          document.querySelectorAll('.hs').forEach(function(n){ n.remove(); });
          return;
        }
        
        var w = window.innerWidth, h = window.innerHeight;
        var currentIds = s.hotspots.map(function(h){ return h.id; });
        
        document.querySelectorAll('.hs').forEach(function(n){
          if(currentIds.indexOf(n.dataset.id) === -1) n.remove();
        });

        s.hotspots.forEach(function(hs){
          var dir = new THREE.Vector3(hs.x,hs.y,hs.z).multiplyScalar(490);
          var proj = dir.clone().project(camera);
          var div = document.querySelector('.hs[data-id="'+hs.id+'"]');
          
          if(proj.z > 1) {
            if(div) div.style.display = 'none';
            return;
          }
          
          var sx = (proj.x*0.5+0.5)*w, sy = (1-(proj.y*0.5+0.5))*h;
          if(sx < -30 || sx > w+30 || sy < -30 || sy > h+30) {
            if(div) div.style.display = 'none';
            return;
          }

          if(!div){
            div = document.createElement('div');
            div.className = 'hs '+hs.type;
            div.dataset.id = hs.id;
            
            div.addEventListener('pointerdown', function(ev){
              ev.stopPropagation();
              if(hs.type === 'link'){
                var targetId = hs.targetSceneId || hs.targetScene || hs.sceneId || hs.title || hs.text;
                var idx = scenes.findIndex(function(x){return x.id===targetId;});
                if(idx < 0 && targetId && typeof targetId === 'string'){
                  var needle = targetId.toLowerCase();
                  idx = scenes.findIndex(function(x){
                    var name = (x.name||'').toLowerCase();
                    return name === needle || name.indexOf(needle) !== -1;
                  });
                }
                if(idx >= 0) loadScene(idx);
              } else {
                document.querySelectorAll('.pop').forEach(function(p){p.remove();});
                var pop = document.createElement('div');
                pop.className = 'pop'; 
                pop.style.left = '50%'; pop.style.top = '50%'; pop.style.transform = 'translate(-50%,-50%)';
                pop.innerHTML = '<span class="x">\\u2715</span><h4></h4><div></div>';
                pop.querySelector('h4').textContent = hs.title || 'Note';
                pop.querySelector('div:last-child').textContent = hs.text || '';
                pop.querySelector('.x').addEventListener('pointerdown', function(){pop.remove();});
                document.body.appendChild(pop);
              }
            });
            document.body.appendChild(div);
          }
          
          div.style.display = 'block';
          div.style.left = sx + 'px'; 
          div.style.top = sy + 'px';
        });
      }
      if(scenes.length){ loadScene(0); }
      animate();
    })();
    `;
  }


window.TourFormat = {build(payload){return buildViewerHtml(JSON.stringify(TourData.validate(payload)).replace(/</g, '\\u003c'));}};
})();


