/* Shared preparation for hosted tours, backups and offline delivery. */
(() => {
  'use strict';
  const presets={economy:{width:2048,quality:.72},balanced:{width:3072,quality:.82},detail:{width:4096,quality:.9}};
  const bytes=payload=>new Blob([JSON.stringify(payload)]).size;
  const mb=value=>(value/1024/1024).toFixed(2)+' MB';
  async function resize(source,width,quality,force=false){
    if(!source)return source;
    const img=new Image();img.src=source;await img.decode();
    const scale=Math.min(1,width/Math.max(img.width,img.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    const result=canvas.toDataURL('image/webp',quality);canvas.width=canvas.height=1;
    return force||result.length<source.length?result:source;
  }
  async function optimize(payload,preset='balanced',progress=()=>{}){
    const data=TourData.validate(payload),settings=presets[preset];if(!settings)throw Error('Choose a valid image quality.');
    const before=bytes(data);
    for(let i=0;i<data.scenes.length;i++){
      const scene=data.scenes[i];progress(i+1,data.scenes.length);
      scene.image=await resize(scene.image,settings.width,settings.quality);
      if(scene.alt?.image)scene.alt.image=await resize(scene.alt.image,settings.width,settings.quality);
      scene.thumbnail=await resize(scene.image,240,.65,true);
    }
    // Keep floorplans and logos unchanged: small text and transparency matter.
    return {payload:data,before,after:bytes(data)};
  }
  window.TourEfficiency={optimize,bytes,mb};
})();
