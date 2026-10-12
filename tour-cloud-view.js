(() => {
  'use strict';
  const config=window.RayonCloudConfig,frame=document.querySelector('#cloud-view'),message=document.querySelector('#cloud-message');
  const file=location.pathname.split('/').pop(),id=new URLSearchParams(location.search).get('id')||(file==='sample.html'?'sample':file.match(/^client-([a-f0-9-]{36})\.html$/)?.[1]);
  let timer,interval,closed=false,checking=false,deadline=Infinity;
  const endpoint=config.url+'/functions/v1/tour-view?id='+encodeURIComponent(id||'');
  function close(text){if(closed)return;closed=true;clearTimeout(timer);clearInterval(interval);frame.remove();message.hidden=false;message.replaceChildren();const title=document.createElement('h1');title.textContent=text;const link=document.createElement('a');link.href='../index.html#contact';link.textContent='Contact Rayon Studio';message.append(title,link);}
  async function check(full=false){
    if(closed||checking)return;checking=true;
    const started=performance.now();
    try{
      const response=await fetch(endpoint+(full?'':'&status=1'),{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.message||'This tour is unavailable.');}
      const raw=response.headers.get('X-Tour-Remaining-Ms'),remaining=Number(raw);
      if(raw===null||!Number.isFinite(remaining))throw new Error('Unable to verify tour availability. Reload to try again.');
      deadline=remaining<0?Infinity:started+remaining;
      clearTimeout(timer);
      if(Number.isFinite(deadline))timer=setTimeout(()=>{if(performance.now()>=deadline)close('This tour has expired.');else check();},Math.max(0,Math.min(2147483647,deadline-performance.now())));
      if(full){
        const payload=TourData.validate(await response.json());
        if(closed||performance.now()>=deadline){close('This tour has expired.');return;}
        // The server owns expiry. The embedded viewer must not use the device clock.
        payload.expiresAt=null;
        frame.srcdoc=TourFormat.build(payload).replace('<head>','<head><base href="'+new URL('./',location.href).href+'">');
        frame.hidden=false;message.hidden=true;
      }
    }catch(error){close(error.message||'Connection lost. Reload to check tour availability.');}
    finally{checking=false;}
  }
  interval=setInterval(()=>{if(performance.now()>=deadline)close('This tour has expired.');else check();},15000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
  window.addEventListener('pageshow',()=>check());
  check(true);
})();
