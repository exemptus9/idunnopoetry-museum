(() => {
'use strict';
const $=id=>document.getElementById(id),C=window.IDP_CANON,cfg=window.IDP_CMS_CONFIG;
const params=new URLSearchParams(location.search),destination=params.get('destination')||'museum';
let manifest=null,active=null;
const cleanUrl=id=>{const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('destination',destination);if(id)u.searchParams.set('work',id);return u.href;};
const items=()=>manifest?.works.filter(w=>!$('search').value.trim()||(w.title+' '+w.text).toLowerCase().includes($('search').value.toLowerCase().trim()))||[];
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function render(){const rows=items();$('list').replaceChildren();for(const w of rows){const b=document.createElement('button');b.type='button';b.textContent=w.title;b.classList.toggle('active',active?.work_id===w.work_id);b.onclick=()=>open(w.work_id);$('list').append(b);}if(manifest)status(rows.length+' of '+manifest.works.length+' author-released works. Search stays in this browser.');}
function open(id){const w=manifest?.works.find(x=>x.work_id===id);if(!w)return;active=w;$('reading').hidden=false;$('title').textContent=w.title;$('body').textContent=w.text;const by={brandon:'Brandon original',assisted:'Brandon · AI-assisted',mixed:'Mixed authorship',ai:'AI-generated',external:'External author / quotation'};$('authorship').textContent=by[w.authorship]||'Authorship classification unresolved';$('identity').textContent=w.work_id+' · published editorial revision '+w.editorial_revision;$('hash').textContent='Exact UTF-8 SHA-256: '+w.sha256;$('date').textContent='Publication receipt: '+w.published_at;history.replaceState(null,'',cleanUrl(id));render();if(matchMedia('(max-width:850px)').matches)$('reading').scrollIntoView({block:'start',behavior:'smooth'});}
function move(n){const rows=items();if(!rows.length)return;const i=rows.findIndex(x=>x.work_id===active?.work_id);open(rows[(i+n+rows.length)%rows.length].work_id);}
async function load(){
 if(!C.DESTINATIONS.includes(destination))throw Error('Unknown edition. Choose Museum or RhymeMosaic above.');
 $('edition').textContent=destination==='museum'?'Museum · current-author edition':'RhymeMosaic · canonical reader';
 let rows=[],offset=0;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{while(true){const res=await fetch(cfg.url+'/rest/v1/museum_publications?select=kind,entity_key,payload,state,revision,published_at&kind=eq.creative&state=eq.published&order=entity_key&limit=500&offset='+offset,{headers:{apikey:cfg.publishableKey},credentials:'omit',cache:'no-store',signal:controller.signal});if(!res.ok)throw Error('Publication service unavailable. Your older archives have not been replaced.');const page=await res.json();if(!Array.isArray(page))throw Error('Invalid publication response.');rows.push(...page);if(rows.length>10000)throw Error('Publication list exceeds this reader’s supported limit.');if(page.length<500)break;offset+=page.length;}}finally{clearTimeout(timer);}
 manifest=await C.publicManifest(rows,destination);$('manifest').disabled=!manifest.works.length;$('empty').hidden=manifest.works.length>0;render();const wanted=params.get('work');if(wanted&&!manifest.works.some(x=>x.work_id===wanted))status('This work is not currently released to this edition.');else if(wanted)open(wanted);else if(manifest.works.length)open(manifest.works[0].work_id);
}
$('search').oninput=render;$('previous').onclick=()=>move(-1);$('next').onclick=()=>move(1);
$('copy').onclick=async()=>{if(!active)return;const url=cleanUrl(active.work_id);try{await navigator.clipboard.writeText(url);status('Copied this published work’s link.');}catch{prompt('Copy this public link:',url);}};
$('manifest').onclick=()=>{if(!manifest?.works.length)return;const blob=new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='Canon_'+destination+'_APPROVED.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};
load().catch(e=>{status(e.message||'Publication service unavailable.',true);$('manifest').disabled=true;});
})();
