/* Public-only curator projection. Reads ONLY museum_publications with anon key;
 * no private drafts, admin credentials, or original private sources are fetched.
 * Without an activated backend the preserved v3.24 static museum is unchanged.
 */
(() => {
'use strict';
const cfg=window.IDP_CMS_CONFIG||{};
const live=Array.isArray(window.IDP_CMS_PUBLIC_PAGES)?window.IDP_CMS_PUBLIC_PAGES:[];
window.IDP_CMS_PUBLIC_PAGES=live;
window.IDP_CMS_PUBLIC_STATUS='disabled';
function findById(arr,id){return (arr||[]).find(x=>String(x.id)===String(id))}
function safeUrl(value){
 if(typeof value!=='string')return '';
 if(/^#[a-zA-Z0-9/_%-]+$/.test(value))return value;
 try{const u=new URL(value);if(u.protocol==='https:' && !u.username && !u.password)return u.href}catch{}
 return '';
}
function safeHex(s){return typeof s==='string'&&/^#[0-9A-Fa-f]{6}$/.test(s)?s:''}
function setFields(row,p,fields){
 if(!row||!p||typeof p!=='object')return;
 const original={};
 for(const [field,key] of Object.entries(fields)){
  if(typeof p[key]==='string'){
   original[field]=row[field];
   row[field]=p[key];
  }
 }
 if(Object.keys(original).length){row.museumEditorialOverlay=true;row.museumOriginal=original;}
}
function hideRow(row){
 if(!row)return;
 row.museumWithdrawn=true; row.museumEditorialOverlay=true;
 for(const key of ['title','n','x','text','summary','description']){
  if(typeof row[key]==='string')row[key]='[Withdrawn from public display]';
 }
}
function apply(change){
 const {kind,entity_key:key,payload:p={},state}=change;
 if(!/^[A-Za-z0-9_-]{1,120}$/.test(String(key))||!p||typeof p!=='object')return;
 const meta=window.IDP_CREATIVE_META||{},core=window.IDP_CORE||{},
  poetry=window.IDP_POETRY||{},media=window.IDP_MEDIA_CATALOG||{};
 const tombstone=state==='withdrawn'||p.hidden===true;
 let item=null;
 if(kind==='seed'){
  meta.seeds=meta.seeds||[];
  item=findById(meta.seeds,key);
  const approved=window.IDP_SEEDBANK_APPROVED||{records:[]};
  if(!item)item=findById(approved.records,key);
  if(tombstone){hideRow(item);return}
  if(!item){item={id:key,source:'Museum curator approved public projection',status:'candidate',provenance:'uncertain'};meta.seeds.push(item)}
  setFields(item,p,{title:'title',text:'text',status:'status',provenance:'provenance',notes:'public_note'});
  item.source='Museum curator approved public projection';return;
 }
 if(kind==='poem'){
  item=findById(poetry.works,key);
  if(tombstone){hideRow(item);return}
  setFields(item,p,{title:'title',x:'text',summary:'description'});return;
 }
 if(kind==='creative'){
  meta.supplementalWorks=meta.supplementalWorks||[];
  item=findById(meta.supplementalWorks,key);
  if(tombstone){hideRow(item);return}
  if(!item){item={id:key,source:'Curator approved',status:'candidate',provenance:'uncertain'};meta.supplementalWorks.push(item)}
  setFields(item,p,{title:'title',text:'text',status:'status',provenance:'provenance',notes:'public_note'});return;
 }
 if(kind==='post'){item=findById(window.IDP_POSTS,key);if(tombstone)hideRow(item);else setFields(item,p,{x:'text'});return}
 if(kind==='topic'){item=findById(core.topics,key);if(tombstone)hideRow(item);else setFields(item,p,{title:'title'});return}
 if(kind==='forum'){item=findById(core.forums,key);if(tombstone)hideRow(item);else setFields(item,p,{n:'title',description:'description'});return}
 if(kind==='member'){item=findById(core.users,key);if(tombstone)hideRow(item);else setFields(item,p,{n:'title'});return}
 if(kind==='media'){
  item=findById(media.assets,key);
  if(tombstone){hideRow(item);return}
  if(!item)return;
  setFields(item,p,{title:'title',description:'description'});
  const url=safeUrl(p.url);
  if(url && url.startsWith('https:')) item.publicUrl=url;
  return;
 }
 if(kind==='document'){
  meta.archiveDocuments=meta.archiveDocuments||[];
  item=findById(meta.archiveDocuments,key);
  if(tombstone){hideRow(item);return}
  if(!item){item={id:key,source:'Curator approved',type:'Document'};meta.archiveDocuments.push(item)}
  setFields(item,p,{title:'title',text:'text',description:'description',notes:'public_note'});return;
 }
 if(['page','exhibit','reader_impact'].includes(kind)){
  const previous=live.findIndex(x=>x.kind===kind&&x.key===key);
  if(previous>=0)live.splice(previous,1);
  if(!tombstone)live.push({kind,key,title:p.title||key,
   text:p.text||'',description:p.description||'',note:p.public_note||''});
  return;
 }
 if(kind==='site'){
  const config=window.IDP_CONFIG||{};
  if(tombstone)return;
  if(typeof p.title==='string')config.siteLabel=p.title;
  if(typeof p.label==='string')config.contactLabel=p.label;
  const u=safeUrl(p.url);if(u)config.contactUrl=u;return;
 }
 if(kind==='navigation'){
  const nav=document.querySelector('.board-nav');
  if(!nav)return;
  const id='cms-nav-'+key;
  let a=document.getElementById(id);
  if(tombstone){a?.remove();return}
  const href=safeUrl(p.url);
  if(!href)return;
  if(!a){a=document.createElement('a');a.id=id;nav.append(a)}
  a.href=href;a.textContent=String(p.label||p.title||key).slice(0,100);return;
 }
 if(kind==='theme'){
  if(tombstone)return;
  const color=safeHex(p.color);
  if(color)document.documentElement.style.setProperty('--hover',color);
 }
}
function validConfig(){
 return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.url||'')
   && /^(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9._-]+)$/.test(cfg.publishableKey||'');
}
window.IDP_CMS_PUBLIC_READY=(async()=>{
 if(!validConfig())return;
 window.IDP_CMS_PUBLIC_STATUS='loading';
 const ac=new AbortController(), timeout=setTimeout(()=>ac.abort(),6500);
 try{
  const endpoint=cfg.url.replace(/\/$/,'')+'/rest/v1/museum_publications?select=kind,entity_key,payload,state,revision,published_at&limit=2000';
  const response=await fetch(endpoint,{headers:{apikey:cfg.publishableKey},signal:ac.signal,cache:'no-store'});
  if(!response.ok)throw new Error('Public projection temporarily unavailable');
  const changes=await response.json();
  if(!Array.isArray(changes))throw new Error('Unexpected public projection response');
  for(const change of changes)apply(change);
  window.IDP_CMS_PUBLIC_STATUS='loaded';
 }catch(err){
  // Fail closed when an active control plane cannot establish withdrawal state.
  window.IDP_CMS_PUBLIC_STATUS='unavailable';
 }finally{clearTimeout(timeout)}
})();
})();