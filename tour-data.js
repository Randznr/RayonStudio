(function(root) {
  'use strict';
  const image = value => value == null || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(value);
  function validate(data) {
    if (!data || !Array.isArray(data.scenes) || data.scenes.length > 100) throw new Error('Choose a RAYON tour file with up to 100 rooms.');
    const ids = new Set();
    for (const scene of data.scenes) {
      if (!scene || !/^[\w-]{1,100}$/.test(scene.id) || ids.has(scene.id) || typeof scene.name !== 'string' || !scene.image || !image(scene.image)) throw new Error('A room has invalid data or an unsupported image. Import a self-contained RAYON tour.');
      ids.add(scene.id);
      if (scene.alt && !image(scene.alt.image)) throw new Error('Invalid alternate panorama.');
      for (const key of ['initialLon','initialLat','mapX','mapY','mapHeading']) if (scene[key] != null && !Number.isFinite(scene[key])) throw new Error('Invalid room position.');
      if (scene.hotspots != null && !Array.isArray(scene.hotspots)) throw new Error('Invalid hotspots.');
      const hotspots = new Set();
      for (const hotspot of scene.hotspots || []) {
        if (!/^[\w-]{1,100}$/.test(hotspot.id) || hotspots.has(hotspot.id) || !['note','link'].includes(hotspot.type) || !['x','y','z'].every(key => Number.isFinite(hotspot[key]))) throw new Error('Invalid hotspot.');
        hotspots.add(hotspot.id);
      }
    }
    if (!image(data.floorplan) || (data.branding && !image(data.branding.image))) throw new Error('Invalid floor plan or branding image.');
    return JSON.parse(JSON.stringify(data));
  }
  function parse(text) {
    if (text.trim().startsWith('{')) return validate(JSON.parse(text));
    const match = text.match(/<script\b[^>]*\bid=["']data["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!match) throw new Error('Choose a RAYON exported HTML tour or tour JSON file. Other HTML files are not supported.');
    return validate(JSON.parse(match[1]));
  }
  function path(id) {
    if (id !== 'sample' && !/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid tour ID.');
    return 'tours/' + (id === 'sample' ? 'sample' : 'client-' + id) + '.html';
  }
  root.TourData = {validate, parse, path};
})(typeof window === 'undefined' ? globalThis : window);
