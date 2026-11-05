/* Aggregate public usage only. Search, review and private fields are excluded. */
(()=>{'use strict';
 const KEY='idp-audience-optout-v1',ENDPOINT='https://rhyme-mosaic-writers.idunnopoetry.chatgpt.site/api/observatory/collect';
 const sections=new Set(['home','start','what-was-idp','best-threads','then-now','archive','story','forums','forum','topic','people','poetry','seeds','seed-guide','documents','media','poem','timeline','exhibits','voices','versions','about']);
 let last='',memory={};
 const optedOut=()=>{try{return localStorage.getItem(KEY)==='1'}catch{return false}};
 const enabled=()=>navigator.doNotTrack!=='1'&&navigator.globalPrivacyControl!==true&&!optedOut();
 function route(){
  const p=location.pathname;
  if(/^\/idunnopoetry-museum\/observatory\/(?:index\.html)?$/.test(p)){if(/^(?:review|author|laboratory)(?:\/|\?|$)/.test(location.hash.slice(1)))return null;return {project:'lexical',path:p};}
  if(/^\/idunnopoetry-museum\/projects\/(?:index\.html)?$/.test(p))return {project:'projectatlas',path:p};
  if(!/^\/idunnopoetry-museum\/(?:index\.html)?$/.test(p))return null;
  const parts=(location.hash.slice(1).split('?')[0]||'home').split('/'),name=parts[0];if(!sections.has(name))return null;
  const id=['forum','topic','poem'].includes(name)&&/^\d{1,12}$/.test(parts[1]||'')?'/'+parts[1]:'';
  return {project:'idunno',path:'/idunnopoetry-museum/section/'+name+id};
 }
 function session(project){const now=Date.now(),key='idp-audience-session-'+project;try{const old=JSON.parse(sessionStorage.getItem(key)||'null');if(old&&typeof old.id==='string'&&Number.isFinite(old.touched)&&old.touched<=now&&now-old.touched<1800000)memory[project]=old}catch{}let item=memory[project];if(!item||item.touched>now||now-item.touched>=1800000)item={id:crypto.randomUUID(),touched:now};item.touched=now;memory[project]=item;try{sessionStorage.setItem(key,JSON.stringify(item))}catch{}return item.id;}
 function send(event,info){if(!enabled()||!info)return;try{let referrer='';if(event==='pageview')try{const r=new URL(document.referrer);if(/^https?:$/.test(r.protocol))referrer=r.origin}catch{}fetch(ENDPOINT,{method:'POST',credentials:'omit',keepalive:true,headers:{'Content-Type':'text/plain'},body:JSON.stringify({id:crypto.randomUUID(),session:session(info.project),event,path:info.path,referrer})}).catch(()=>{})}catch{}}
 function page(){const info=route();if(!enabled()||!info){last='';return}const current=info.project+':'+info.path;if(current!==last){last=current;send('pageview',info)}}
 document.querySelectorAll('[data-idp-traffic-optout]').forEach(button=>{function render(){button.textContent=optedOut()?'Enable anonymous site statistics':'Disable anonymous site statistics';button.setAttribute('aria-pressed',String(optedOut()))}render();button.addEventListener('click',()=>{try{if(optedOut())localStorage.removeItem(KEY);else localStorage.setItem(KEY,'1');memory={};last='';render();if(!optedOut())page()}catch{button.textContent='Browser storage is unavailable'}})});
 window.addEventListener('hashchange',page);
 document.addEventListener('click',event=>{if(!enabled())return;const info=route(),target=event.target;if(!info||!(target instanceof Element))return;const a=target.closest('a[href]');if(!a)return;try{const u=new URL(a.href,location.href);if(['http:','https:'].includes(u.protocol)&&u.origin!==location.origin)send('outbound',info)}catch{}},{passive:true});
 page();
})();
