import React, {useEffect,useRef} from 'react';
export default function SpamProtection({siteKey,onToken,resetKey}) {
 const ref=useRef(null);
 useEffect(()=>{
  let active=true; let widget;
  const render=()=>{if(active && window.turnstile) widget=window.turnstile.render(ref.current,{sitekey:siteKey,action:'request-access',callback:onToken,'expired-callback':()=>onToken(''),'error-callback':()=>{onToken('');return true;}});};
  let script=document.getElementById('turnstile-script');
  if(window.turnstile) render();
  else {
   if(!script){script=document.createElement('script');script.id='turnstile-script';script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;document.head.appendChild(script);}
   script.addEventListener('load',render);
  }
  return ()=>{active=false;script?.removeEventListener('load',render);if(widget!==undefined)window.turnstile?.remove(widget);};
 },[siteKey,onToken,resetKey]);
 return <div className="spam-widget" ref={ref} aria-label="Spam protection"/>;
}
