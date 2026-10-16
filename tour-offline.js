/* Build a single HTML file with no network dependencies. */
(() => {
  const base=new URL('.',document.currentScript.src);
  let resources;
  async function load(){
    const paths=['assets/vendor/three.min.js','assets/vendor/three-LICENSE.txt','tour-controls.js','Images/hotspot-ring.svg','Images/RAYONSLOGO copy.png','Images/VR.ic.png'];
    const values=await Promise.all(paths.map(async(path,index)=>{
      const response=await fetch(new URL(path,base));if(!response.ok)throw Error('Offline export could not load '+path+'. Try again.');
      if(index<3)return response.text();
      const blob=await response.blob();return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
    }));return values;
  }
  const inline=source=>source.replace(/<\/script/gi,'<\\/script');
  window.TourOffline={async build(payload){
    if(!payload.scenes.length)throw Error('Add a panorama before exporting.');
    if(!resources)resources=load().catch(error=>{resources=null;throw error;});
    const [three,license,controls,ring,logo,vr]=await resources;
    let html=TourFormat.build(payload);
    html=html.replace('<script src="../site-features.js" defer></script>','');
    html=html.replace('<script src="../tour-controls.js"></script>','<script>window.RayonOfflineAssets='+JSON.stringify({vr})+';'+inline(controls)+'</script>');
    html=html.replace('<script src="../assets/vendor/three.min.js"></script>','<script>'+inline(three)+'</script>');
    html=html.replaceAll('../Images/hotspot-ring.svg',ring).replaceAll('../Images/RAYONSLOGO copy.png',logo);
    html=html.replaceAll('../index.html#contact','mailto:randall@rayonstudio.net');
    html=html.replace('</body>','<script type="text/plain" id="three-license">'+inline(license)+'</script></body>');
    return html;
  }};
})();
