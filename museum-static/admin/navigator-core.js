/* Museum editorial Navigator: public-archive indexing, local search and portable metadata.
 * Pure helpers only; no accounts, private records, credentials or remote network calls.
 * The curator browser passes its already-authorized data to these functions.
 */
(() => {
'use strict';
const KINDS=['poem','seed','creative','document','topic','forum','post','member','media','reader_impact'];
const LABELS={poem:'Poem',seed:'Seed',creative:'Reconciled work',document:'Document',
 topic:'Forum topic',forum:'Forum room',post:'Forum post',member:'Member',
 media:'Media',reader_impact:'Reader impact'};
const PRIORITY={poem:0,seed:1,creative:2,document:3,topic:4,forum:5,post:6,
 member:7,media:8,reader_impact:9};
function normalize(input){
 return String(input??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
function sourceRows(kind,globals){
 const core=globals.IDP_CORE||{},poetry=globals.IDP_POETRY||{},meta=globals.IDP_CREATIVE_META||{};
 const media=globals.IDP_MEDIA_CATALOG||{},impact=globals.IDP_READER_IMPACT||{};
 const table={poem:poetry.works,seed:meta.seeds,creative:meta.supplementalWorks,
  document:meta.archiveDocuments,topic:core.topics,forum:core.forums,
  post:globals.IDP_POSTS,member:core.users,media:media.assets,reader_impact:impact.entries};
 return Array.isArray(table[kind])?table[kind]:[];
}
function bodyOf(row){return String(row.x??row.text??row.summary??row.description??'');}
function publicItem(kind,row) {
 if(!row||typeof row!=='object')return null;
 const key=String(row.id??row.workId??'');
 if(!/^[A-Za-z0-9_-]{1,120}$/.test(key))return null;
 const title=String(row.title||row.n||row.name||('Record '+key)).slice(0,280);
 const snippet=bodyOf(row).slice(0,2600);
 return {type:'public',kind,key,title,row,
  excerpt:snippet.replace(/\s+/g,' ').slice(0,125),
  titleNorm:normalize(title),keyNorm:normalize(key),
  searchable:normalize(title+' '+key+' '+snippet)};
}
async function buildPublicIndex(globals,{yieldEvery=350,onProgress}={}){
 const index=[];let total=0,done=0;
 for(const kind of KINDS)total+=sourceRows(kind,globals).length;
 for(const kind of KINDS){
  const rows=sourceRows(kind,globals);
  for(let i=0;i<rows.length;i++){
   const item=publicItem(kind,rows[i]);
   if(item)index.push(item);
   done++;
   if(done%yieldEvery===0){
    if(typeof onProgress==='function')onProgress(done,total);
    // Avoid a long blocking loop on low-memory phones.
    await new Promise(resolve=>setTimeout(resolve,0));
   }
  }
 }
 if(typeof onProgress==='function')onProgress(done,total);
 return index;
}
function privateItem(doc){
 if(!doc||typeof doc!=='object'||!KINDS.includes(doc.kind) &&
  !['page','site','navigation','theme','exhibit'].includes(doc.kind))return null;
 const key=String(doc.entity_key||'');
 if(!/^[A-Za-z0-9_-]{1,120}$/.test(key))return null;
 const title=String(doc.title||key).slice(0,280);
 return {type:'saved',kind:doc.kind,key,title,status:String(doc.status||'draft'),
  id:doc.id,titleNorm:normalize(title),keyNorm:normalize(key),
  // Private draft body deliberately NOT included in search text.
  searchable:normalize(title+' '+key)};
}
function search(index,records,query,{scope='all',limit=35}={}){
 const needle=normalize(query).replace(/\s+/g,' ');
 if(needle.length<2)return {total:0,results:[]};
 const terms=needle.split(' ').filter(Boolean);
 const found=[];
 function tryItem(item){
  if(!item)return;
  if(scope==='saved'&&item.type!=='saved')return;
  if(scope!=='all'&&scope!=='saved'&&item.kind!==scope)return;
  if(!terms.every(t=>item.searchable.includes(t)))return;
  let rank=5;
  if(item.titleNorm===needle)rank=0;
  else if(item.titleNorm.startsWith(needle))rank=1;
  else if(item.titleNorm.includes(needle))rank=2;
  else if(item.keyNorm.includes(needle))rank=3;
  else if(item.searchable.includes(needle))rank=4;
  found.push({item,rank:rank*1000+(item.type==='saved'?0:(PRIORITY[item.kind]??12))});
 }
 for(const raw of records||[])tryItem(privateItem(raw));
 for(const item of index||[])tryItem(item);
 found.sort((a,b)=>a.rank-b.rank||a.item.title.localeCompare(b.item.title,'en',{sensitivity:'base'}));
 return {total:found.length,results:found.slice(0,Math.min(Math.max(limit,1),100)).map(x=>x.item)};
}
function handoff(doc,stage){
 if(!doc)return '';
 // A human-controlled, metadata-only transfer. Never append poem body, review rationale or credentials.
 const d=doc.draft||{};
 return ['Museum / Continuity handoff (metadata only)',
  'Title: '+String(doc.title||''),
  'Kind: '+String(doc.kind||''),
  'Record key: '+String(doc.entity_key||''),
  'Revision: '+String(doc.revision??0),
  'Editorial status: '+String(doc.status||stage||'not saved'),
  'Authorship classification: '+String(d.provenance||'unresolved'),
  'Source: IDunnoPoetry Museum editorial overlay; historical originals remain preserved',
  'Private text was NOT transferred. Open the authorized editor to inspect the record.',
  'Museum: https://exemptus9.github.io/idunnopoetry-museum/',
  'Continuity: https://exemptus9.github.io/artificial-continuity/'].join('\n');
}
window.IDP_EDITOR_NAV={KINDS,LABELS,sourceRows,publicItem,buildPublicIndex,search,handoff,normalize};
})();
