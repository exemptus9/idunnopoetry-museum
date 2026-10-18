/* Museum Control Center: authenticated, least-privilege PostgREST client.
 * No service-role key, no automatic upload, no direct publication table writes.
 * Published historical changes are overlays; recovered originals remain untouched.
 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const cfg = window.IDP_CMS_CONFIG || {};
const kinds = new Set(['seed','poem','creative','post','topic','forum','member','media',
  'document','page','site','navigation','theme','exhibit','reader_impact']);
const FIELDS = ['text','description','status','provenance','public-note','url','alt','nav-label','color'];
const storageKey = 'idp_museum_editor_session_v1';
let session = null, role = null, records = [], active = null, localVault = [];
let busy = false,selectedVault = null;
let formBaseline = null;
const navigatorCore = window.IDP_EDITOR_NAV;
let publicNavigatorIndex=null,publicNavigatorBuild=null,navigatorSearchGeneration=0;
const EDIT_FIELDS = ['entity-key','title',...FIELDS,'reason'];
function editSnapshot() {
 const values = {};
 for (const id of EDIT_FIELDS) values[id] = $(id).value;
 return JSON.stringify(values);
}
function hasUnsavedChanges() {
 return !!active && formBaseline !== null && !$('edit-form').hidden && editSnapshot() !== formBaseline;
}
function updateEditState() {
 if (!active || $('edit-form').hidden) return;
 const dirty = hasUnsavedChanges();
 $('unsaved-note').hidden = !dirty;
 $('copy-handoff').disabled=busy || dirty || !active?.id;
 $('save-state').textContent = (dirty ? '● Unsaved changes' : 'Saved or unchanged') +
   ' · revision ' + active.revision + ' · ' + active.status;
 const approved = active.approved_revision === active.revision;
 $('release-state').textContent = dirty
   ? 'Current changes are not saved. Publication controls are locked.'
   : (approved ? 'Exact revision ' + active.revision + ' is approved.'
     : 'Not approved for public release.');
 $('approve').disabled = busy || dirty || role !== 'owner' || !active.id || approved;
 $('publish').disabled = busy || dirty || role !== 'owner' || !active.id || !approved ||
   active.status === 'published';
 $('withdraw').disabled = busy || dirty || role !== 'owner' || !active.id ||
   active.status === 'withdrawn';
}
function confirmDiscard() {
 if (busy) { tell('Wait for the current operation to finish.',true); return false; }
 return !hasUnsavedChanges() || confirm('Discard unsaved edits on this device? Saved revisions remain intact.');
}
function clearEditor() {
 active=null;formBaseline=null;hide('edit-form','source-compare');show('empty');
 $('unsaved-note').hidden=true;
}
function scrollToEditor() {
 if (typeof window.matchMedia === 'function' &&
     window.matchMedia('(max-width:850px)').matches)
   $('editor').scrollIntoView?.({behavior:'smooth',block:'start'});
}

function tell(message,error=false) {
 const el=$('message');el.textContent=String(message);el.className='message'+(error?' error':'');el.hidden=false;
}
function hide(...ids){for(const id of ids)$(id).hidden=true;}
function show(id){$(id).hidden=false;}
function configured() {
 return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.url||'')
   && /^(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9._-]+)$/.test(cfg.publishableKey||'');
}
function base(){return String(cfg.url).replace(/\/$/,'');}
function access(){return session?.access_token||'';}
function authHeaders() {return {'apikey':cfg.publishableKey,'Authorization':'Bearer '+access()};}
function saveSession(x){session=x;try{sessionStorage.setItem(storageKey,JSON.stringify(x))}catch{}}
function clearSession(){session=null;role=null;try{sessionStorage.removeItem(storageKey)}catch{}}
async function readJson(res) {
 const text=await res.text();let body;try{body=JSON.parse(text)}catch{body={message:text.slice(0,400)}}
 if(!res.ok)throw Error(body.message||body.msg||body.error_description||body.error||('HTTP '+res.status));
 return body;
}
async function refreshIfNeeded(){
 if(!session?.refresh_token)return;
 const expires=(session.expires_at||0);
 if(!expires||expires-Date.now()/1000>90)return;
 const data=await readJson(await fetch(base()+'/auth/v1/token?grant_type=refresh_token',{
  method:'POST',headers:{'apikey':cfg.publishableKey,'Content-Type':'application/json'},
  body:JSON.stringify({refresh_token:session.refresh_token})
 }));
 saveSession({...data,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600)});
}
async function api(path,options={}) {
 await refreshIfNeeded();
 if(!access())throw Error('Sign in first.');
 const response=await fetch(base()+'/rest/v1/'+path,{
  method:options.method||'GET',
  headers:{...authHeaders(), 'Content-Type':'application/json',...(options.headers||{})},
  body:options.body===undefined?undefined:JSON.stringify(options.body),
  cache:'no-store'
 });
 return await readJson(response);
}
async function rpc(name,payload){
 return api('rpc/'+encodeURIComponent(name),{method:'POST',body:payload});
}
async function signedIn() {
 const user=await readJson(await fetch(base()+'/auth/v1/user',{headers:authHeaders(),cache:'no-store'}));
 role=await rpc('museum_my_role',{});
 if(!['owner','editor'].includes(role)){hide('login','app');show('denied');return}
 hide('login','denied','setup');show('app');
 $('identity').textContent=(user.email||'Authenticated curator')+' · '+role;
 await load();
}
async function signOut(){
 if(!confirmDiscard())return;
 if(access())try{await fetch(base()+'/auth/v1/logout',{method:'POST',headers:authHeaders()})}catch{}
 clearSession();clearEditor();records=[];hide('app','denied','setup');show('login');$('identity').textContent='Signed out';$('export-drafts').disabled=true;
}
async function beginSession() {
 if(!configured()){hide('login','app','denied');show('setup');return}
 hide('setup');
 const hashes=new URLSearchParams(location.hash.replace(/^#/,'')),params=new URLSearchParams(location.search);
 if(hashes.has('access_token')){
  saveSession({access_token:hashes.get('access_token'),refresh_token:hashes.get('refresh_token'),
   expires_at:Math.floor(Date.now()/1000)+Number(hashes.get('expires_in')||3600)});
  history.replaceState(null,'',location.pathname);
 } else if(params.has('token_hash')) {
  const token_hash=params.get('token_hash');
  history.replaceState(null,'',location.pathname);
  const data=await readJson(await fetch(base()+'/auth/v1/verify',{
    method:'POST',headers:{'apikey':cfg.publishableKey,'Content-Type':'application/json'},
    body:JSON.stringify({type:'magiclink',token_hash})
  }));
  saveSession({...data,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600)});
 } else {
  try{const s=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(s&&s.access_token)session=s}catch{}
 }
 if(!session){show('login');return}
 try { await refreshIfNeeded();await signedIn() }
 catch(err) {clearSession();hide('app','denied');show('login');tell('Authentication expired: '+err.message,true)}
}
async function load(){
 records=await api('museum_documents?select=id,kind,entity_key,title,draft,revision,approved_revision,status,updated_at&order=updated_at.desc&limit=1000');
 if(!Array.isArray(records))throw Error('Unexpected private record list');
 const counts={draft:0,approved:0,published:0,withdrawn:0};
 for(const doc of records){if(counts[doc.status]!==undefined)counts[doc.status]++}
 $('stats').replaceChildren();
 for(const [text,count] of [['Saved records',records.length],...Object.entries(counts)]) {
  const el=document.createElement('span');el.textContent=text+': '+count;$('stats').append(el);
 }
 $('welcome-status').textContent = records.length === 0
  ? 'Your editorial workspace is ready. Nothing is published, and there are no saved drafts yet.'
  : records.length+' private editorial records loaded · '+counts.draft+' draft(s) to review. Publication always requires separate owner approval.';
 $('export-drafts').disabled = !records.length;
 const unresolved=records.filter(needsProvenanceReview).length;
 if(unresolved)$('welcome-status').textContent+=' '+unresolved+' saved creative record(s) need authorship review.';
 listDrafts();listPublicSources();
 if($('global-search').value.trim().length>=2)renderNavigator().catch(e=>tell('Search unavailable: '+e.message,true));
 if(active?.id){const found=records.find(x=>x.id===active.id);if(found)openDraft(found)}
}
function sourceData(){
 const kind=$('kind').value;
 const core=window.IDP_CORE||{users:[],topics:[],forums:[]};
 const poetry=window.IDP_POETRY||{works:[]};
 const meta=window.IDP_CREATIVE_META||{seeds:[],supplementalWorks:[]};
 const media=window.IDP_MEDIA_CATALOG||{assets:[]};
 const source={
  seed:meta.seeds||[],poem:poetry.works||[],creative:meta.supplementalWorks||[],
  post:window.IDP_POSTS||[],topic:core.topics||[],forum:core.forums||[],
  member:core.users||[],media:media.assets||[],document:meta.archiveDocuments||[],reader_impact:(window.IDP_READER_IMPACT||{}).entries||[]
 }[kind]||[];
 return source.map((row,i)=>{
  const key=String(row.id??row.workId??'');
  if(!key||!/^[A-Za-z0-9_-]{1,120}$/.test(key))return null;
  const title=String(row.title||row.n||row.name||('Record '+key));
  return {key,title,row,searchText:(title+' '+key+' '+String(row.x||row.text||row.summary||'').slice(0,5000)).toLowerCase()};
 }).filter(Boolean);
}
function projectSource(item,kind){
 const r=item.row;
 return {
  kind, entity_key:item.key,title:item.title,
  draft:{
   text:String(r.x||r.text||r.summary||''),
   description:String(r.description||r.summary||''),
   status:typeof r.status==='string'?r.status:'',
   provenance:typeof r.provenance==='string'?r.provenance:(kind==='poem'?'uncertain':''),
   public_note:'',url:'',alt:'',label:'',color:''
  }
 };
}
function addOption(target,text,action,small=''){
 const button=document.createElement('button');
 button.type='button';button.textContent=text;
 if(small){const span=document.createElement('span');span.className='small';span.textContent=small;button.append(span)}
 button.addEventListener('click',action);target.append(button);
}
function listPublicSources(){
 const q=$('source-search').value.trim().toLowerCase();
 const out=$('source-list');out.replaceChildren();
 if(!q) {const note=document.createElement('p');note.className='muted';note.textContent='Type a title, username, or original ID to find an entry.';out.append(note);return}
 const kind=$('kind').value;
 const source=sourceData().filter(x=>x.searchText.includes(q)).slice(0,45);
 for(const x of source) addOption(out,x.title,()=>{if(!confirmDiscard())return;openSource(x,kind);scrollToEditor();},'Original ID '+x.key+' · '+String(x.row.x||x.row.text||x.row.summary||'').slice(0,85));
 if(!source.length)out.textContent='No matching public source records.';
}
function listDrafts(){
 const kind=$('kind').value,q=$('draft-search').value.trim().toLowerCase();
 const filter=$('record-filter').value,provenance=$('provenance-filter').value;
 const out=$('draft-list');out.replaceChildren();
 const items=records.filter(r=>r.kind===kind && (filter==='all' || r.status===filter) &&
  (provenance==='all' || (provenance==='unresolved'?needsProvenanceReview(r):
   String(r.draft?.provenance||'')===provenance)) &&
  (!q||(r.title+' '+r.entity_key).toLowerCase().includes(q))).slice(0,100);
 for(const d of items)addOption(out,d.title,()=>{if(!confirmDiscard())return;openDraft(d);scrollToEditor();},d.entity_key+' · '+d.status+' · r'+d.revision);
 if(!items.length)out.textContent='No saved drafts yet.';
}
function openSource(item,kind){
 const saved=records.find(r=>r.kind===kind&&r.entity_key===item.key);
 if(saved){openDraft(saved);return}
 active={...projectSource(item,kind),revision:0,id:null,status:'unsaved'};
 renderEditor();
}
function openDraft(d){active={...d,draft:{...d.draft}};renderEditor()}
function clearFields(){
 for(const k of FIELDS)$(k).value='';
 $('title').value='';$('entity-key').value='';$('reason').value='';
}
function renderEditor(){
 if(!active)return;
 hide('empty');show('edit-form');
 clearFields();
 $('entity-key').value=active.entity_key;
 $('entity-key').readOnly=!!active.id;
 $('entity-key').dataset.userEdited=active.status==='new'?'false':'true';
 $('entity-kind').value=active.kind;
 $('title').value=active.title||'';
 const d=active.draft||{};
 for(const k of FIELDS){
  const prop=k==='public-note'?'public_note':k==='nav-label'?'label':k;
  const val=d[prop]||'';
  const el=$(k);
  if(el.tagName==='SELECT' && ![...el.options].some(o=>o.value===val)){el.value='';continue}
  el.value=val;
 }
 $('edit-identity').textContent=active.kind+' · '+active.entity_key;
 $('edit-heading').textContent=(active.id?'Edit':'New')+' '+active.kind;
 formBaseline=editSnapshot();
 updateEditState();
 $('preview-panel').hidden=true;
 $('source-compare').hidden=true;
 loadHistory().catch(e=>tell(e.message,true));
}
function draftForm(){
 const d={};
 if(active?.draft?.private_witness_id)d.private_witness_id=active.draft.private_witness_id;
 if(active?.draft?.private_witness_sha256)d.private_witness_sha256=active.draft.private_witness_sha256;
 for(const k of FIELDS){
  const prop=k==='public-note'?'public_note':k==='nav-label'?'label':k;
  const v=$(k).value;
  if(v)d[prop]=v;
 }
 return d;
}
async function saveDraft(evt){
 if(evt)evt.preventDefault();if(!active||busy)return;
 const kind=active.kind;
 const key=$('entity-key').value.trim(),title=$('title').value.trim(),draft=draftForm();
 if(!/^[A-Za-z0-9_-]{1,120}$/.test(key)||!title){tell('Valid key and title are required.',true);return}
 if(active.localPrivate && !confirm('Save this selected Seed text to YOUR PRIVATE hosted database? This uploads only the selected item, not the entire Vault. It does not publish.'))return;
 busy=true;$('save').disabled=true;
 try {
  const saved=await rpc('museum_save',{
   p_id:active.id||null,p_kind:kind,p_entity_key:key,p_title:title,p_draft:draft,
   p_expected_revision:active.revision||0,p_reason:$('reason').value.trim()
  });
  active={...saved,draft:{...saved.draft}};
  tell('Private draft saved at revision '+active.revision+'. Nothing published.');
  await load();
 } catch(e){tell('Could not save: '+e.message,true)}
 finally{busy=false;$('save').disabled=false;updateEditState()}
}
function draftProjection(){
 const d=draftForm(),result={title:$('title').value};
 for(const key of ['text','description','status','provenance','public_note','url','alt','label','color'])
  if(d[key])result[key]=d[key];
 return result;
}
async function action(name,confirmation){
 if(!active?.id||busy)return;
 if(role!=='owner'){tell('Owner permission required.',true);return}
 if(hasUnsavedChanges()){tell('Save private edits before approving, publishing, or withdrawing the saved revision.',true);return}
 if(confirmation && !confirm(confirmation.prompt))return;
 busy=true;
 try{
  const body={p_id:active.id,p_expected_revision:active.revision};
  if(confirmation)body.p_confirmation=confirmation.phrase;
  const result=await rpc(name,body);
  if(name==='museum_publish'||name==='museum_withdraw'){
   tell((name==='museum_publish'?'Published':'Withdrawn')+' successfully. The public overlay is updated.');
  } else tell('Exact revision approved. A separate Publish action is still required.');
  await load();
 }catch(e){tell('Action rejected: '+e.message,true)}
 finally{busy=false;updateEditState()}
}
async function loadHistory(){
 const out=$('history-list');out.replaceChildren();
 if(!active?.id){out.textContent='Save your first draft to begin immutable revision history.';return}
 const id=active.id;
 const data=await api('museum_revisions?select=version,reason,created_at,editor_id&document_id=eq.'+encodeURIComponent(id)+'&order=version.desc&limit=30');
 if(active?.id!==id)return;
 for(const row of data){
  const el=document.createElement('div');el.className='row';
  const text=document.createElement('span');text.textContent='v'+row.version+' · '+new Date(row.created_at).toLocaleString()+' · '+(row.reason||'saved');
  el.append(text);
  if(row.version!==active.revision){
   const button=document.createElement('button');button.className='secondary';button.type='button';button.textContent='Restore as new draft';
   button.addEventListener('click',async()=>{if(!confirmDiscard() || !confirm('Create a NEW private draft copied from revision '+row.version+'? Published content remains unchanged until separately approved.'))return;try{
    await rpc('museum_restore',{p_id:active.id,p_expected_revision:active.revision,p_from_revision:row.version});
    await load();tell('Restored safely as a new private revision.');}catch(e){tell(e.message,true)}});
   el.append(button);
  }
  out.append(el);
 }
}
function displayVaultWitness(){
 const record=selectedVault;if(!record)return;
 const witness=record.versions[Number($('vault-version').value)];
 $('vault-preview').textContent=(witness?.text||'No text for this version').slice(0,12000);
}
function selectVault(record){
 selectedVault=record;
 $('vault-title').textContent=record.title;
 const chooser=$('vault-version');chooser.replaceChildren();
 (record.versions||[]).forEach((w,i)=>{
  const option=document.createElement('option');option.value=String(i);
  option.textContent='Version '+(i+1)+' · '+(w.id||'source witness')+' · '+(w.nonemptyLines||'?')+' lines';
  chooser.append(option);
 });
 show('vault-detail');displayVaultWitness();
}
function useVaultWitness(){
 const record=selectedVault;if(!record)return;
 const witness=record.versions?.[Number($('vault-version').value)];
 if(!confirmDiscard())return;
 if(!witness?.text)return tell('Choose a preserved version with text.',true);
 $('kind').value='seed';
 active={id:null,kind:'seed',entity_key:String(record.id).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,120),
  title:record.title,draft:{text:witness.text,status:record.completion||'candidate',
  provenance:record.provenance||'uncertain',private_witness_id:String(witness.id||''),
  private_witness_sha256:String(witness.sha256||'')},
  revision:0,status:'local preview',localPrivate:true};
 renderEditor();listPublicSources();listDrafts();scrollToEditor();tell('Selected the exact private witness. NOT uploaded or published.');
}
function renderVault(){
 const out=$('vault-list');out.replaceChildren();
 const q=$('vault-filter').value.trim().toLowerCase();
 for(const record of localVault.filter(r=>(r.title+' '+r.id).toLowerCase().includes(q)).slice(0,70)){
  addOption(out,record.title,()=>selectVault(record),(record.versions?.length||0)+' preserved versions · LOCAL ONLY');
 }
 if(!localVault.length)out.textContent='Choose a private Seedbank JSON file to review locally.';
}
async function importVault(evt){
 const file=evt.target.files?.[0];if(!file)return;
 try{
  if(file.size>15_000_000)throw Error('File too large to read safely');
  const data=JSON.parse(await file.text());
  if(!String(data.format||'').toLowerCase().includes('seed')
   || !Array.isArray(data.records) || data.records.length>20000) throw Error('Invalid Seedbank format');
  localVault=data.records.filter(r=>r&&typeof r.id==='string'&&Array.isArray(r.versions));
  selectedVault=null;hide('vault-detail');
  $('kind').value='seed';renderVault();tell('Loaded '+localVault.length+' local Seed records. No data has been transmitted.');
 }catch(e){tell('Local Vault import failed: '+e.message,true)}
}
function suggestNewRecordKey() {
 if(!active || active.status!=='new' || active.id || $('entity-key').dataset.userEdited==='true')return;
 const raw=$('title').value.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
 const slug=raw.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90);
 if(!slug){$('entity-key').value='';updateEditState();return}
 const base=(active.kind+'-'+slug).slice(0,120);
 const used=new Set(records.filter(r=>r.kind===active.kind).map(r=>r.entity_key));
 let key=base,number=2;
 while(used.has(key) && number<1000){
  const suffix='-'+number++;
  key=base.slice(0,120-suffix.length)+suffix;
 }
 $('entity-key').value=key;
 updateEditState();
}
function newRecord(kind) {
 if(!confirmDiscard())return;
 $('kind').value=kind;
 listPublicSources();listDrafts();
 active={id:null,kind,entity_key:'',title:'',draft:{},revision:0,status:'new'};
 renderEditor();scrollToEditor();$('title').focus();
}
function exportLoadedRecords() {
 if(!records.length)return;
 if(!confirm('Download '+records.length+' PRIVATE editorial record(s) as an UNENCRYPTED JSON file? Anyone who gets the file can read private drafts. This is a snapshot, NOT a verified database backup or original-source archive.'))return;
 const payload={
  format:'IDP-Museum-Private-Editorial-Snapshot-v1',
  exported_at:new Date().toISOString(),
  scope:'Loaded editorial records only; excludes revision history, audit events, and original historical archive',
  limited_to_first_1000:records.length>=1000,
  documents:records.map(({id,kind,entity_key,title,draft,revision,approved_revision,status,updated_at})=>
   ({id,kind,entity_key,title,draft,revision,approved_revision,status,updated_at}))
 };
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 try {
  const a=document.createElement('a');
  a.href=url;a.download='idp-private-editorial-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.append(a);a.click();a.remove();
  tell('Private snapshot prepared. Protect the downloaded file; it is not encrypted.');
 }finally {setTimeout(()=>URL.revokeObjectURL(url),30000)}
}
/* Editorial command desk: the public archive is indexed lazily and only in this browser.
 * Saved editor records are searched by title/key alone, never by private body.
 */
function needsProvenanceReview(record){
 return ['seed','poem','creative'].includes(record?.kind) &&
   (!record?.draft?.provenance || record.draft.provenance==='uncertain');
}
function navigatorNote(message){
 const out=$('global-results');out.replaceChildren();
 const note=document.createElement('p');note.className='muted';note.textContent=message;out.append(note);
}
function chooseNavigatorItem(item){
 if(!confirmDiscard())return;
 $('kind').value=item.kind;
 $('record-filter').value='all';
 $('provenance-filter').value='all';
 $('draft-search').value='';
 if(item.type==='saved'){
  const saved=records.find(r=>r.id===item.id && r.entity_key===item.key);
  if(!saved)return tell('That saved record is no longer in the loaded review index. Refresh to find it.',true);
  openDraft(saved);
 }else{
  openSource(item,item.kind);
  $('source-search').value=item.title;
 }
 listPublicSources();listDrafts();
 $('global-search').value='';
 navigatorNote('Record opened below. Browse the preserved source before saving a private revision.');
 scrollToEditor();
 $('title').focus();
}
function paintNavigatorResults(data,searchText){
 const out=$('global-results');out.replaceChildren();
 const bar=document.createElement('p');bar.className='result-summary';
 bar.textContent=data.total+' matching record(s) for “'+searchText+'”'+
   (data.total>data.results.length?' · showing best '+data.results.length:'')+
   '. Private records are matched by title or key only.';
 out.append(bar);
 if(!data.results.length){
  const empty=document.createElement('p');empty.className='muted';
  empty.textContent='No matching records. Try fewer words or the Everything scope.';
  out.append(empty);return;
 }
 const list=document.createElement('div');list.className='command-result-grid';list.setAttribute('role','group');
 list.setAttribute('aria-label','Search results');
 for(const item of data.results){
  const button=document.createElement('button');button.className='command-result';button.type='button';
  const top=document.createElement('span');top.className='command-result-title';top.textContent=item.title;
  const meta=document.createElement('span');meta.className='command-result-meta';
  meta.textContent=(item.type==='saved'?'Saved private ': 'Preserved public ')+
   (navigatorCore.LABELS[item.kind]||item.kind)+
   ' · '+(item.type==='saved'?(item.status+' · '):'')+item.key;
  button.append(top,meta);
  if(item.type==='public'&&item.excerpt){
   const excerpt=document.createElement('span');excerpt.className='command-result-excerpt';
   excerpt.textContent=item.excerpt;
   button.append(excerpt);
  }
  button.addEventListener('click',()=>chooseNavigatorItem(item));list.append(button);
 }
 out.append(list);
}
async function renderNavigator(){
 const generation=++navigatorSearchGeneration;
 if(!navigatorCore)return navigatorNote('Search helpers are unavailable. Reload the latest editor to retry.');
 if(!['owner','editor'].includes(role))return navigatorNote('Sign in as an authorized curator to use this search.');
 const term=$('global-search').value.trim(),scope=$('global-scope').value;
 if(term.length<2)return navigatorNote('Type at least two characters. Search never sends private text to other projects.');
 if(!publicNavigatorIndex&&scope!=='saved'){
  if(!publicNavigatorBuild){
   publicNavigatorBuild=navigatorCore.buildPublicIndex(window,{
    yieldEvery:400,
    onProgress:(done,total)=>{
     if(generation===navigatorSearchGeneration)
      navigatorNote('Indexing preserved public records in this browser: '+done.toLocaleString()+
       ' / '+total.toLocaleString()+'. No private text is being transmitted.');
    }
   }).then(index=>{publicNavigatorIndex=index;return index}).catch(error=>{
    publicNavigatorBuild=null;throw error;
   });
  }
  navigatorNote('Preparing the archive-wide search index…');
  await publicNavigatorBuild;
 }
 if(generation!==navigatorSearchGeneration)return;
 const matches=navigatorCore.search(publicNavigatorIndex||[],records,term,{scope,limit:35});
 paintNavigatorResults(matches,term);
}
function openProvenanceReview(){
 const candidate=records.find(needsProvenanceReview);
 if(!candidate)return tell('No saved creative records currently need authorship verification. Start by reviewing an original source or creating a private Seed.');
 if(!confirmDiscard())return;
 $('kind').value=candidate.kind;
 $('record-filter').value='all';$('provenance-filter').value='unresolved';
 $('draft-search').value='';listPublicSources();listDrafts();
 openDraft(candidate);scrollToEditor();
 $('provenance').focus();
 tell('Authorship review: compare your sources and choose a supported classification, then save privately. This does NOT approve or publish.');
}
function archivedSourceForActive(){
 if(!active||!navigatorCore)return null;
 return navigatorCore.sourceRows(active.kind,window).find(row=>
  String(row.id??row.workId??'')===String(active.entity_key))||null;
}
function renderComparison(){
 if(!active)return;
 const row=archivedSourceForActive();
 const original=row?String(row.x??row.text??row.summary??row.description??''):null;
 const current=$('text').value;
 const preserved=original===null?'No preserved public source record is linked to this key.':original;
 const maxView=100000;
 $('original-text').textContent=preserved.slice(0,maxView)+
  (preserved.length>maxView?'\n[View shortened; original archive is unchanged]':'');
 $('comparison-text').textContent=current.slice(0,maxView)+
  (current.length>maxView?'\n[View shortened; editor text is unchanged]':'');
 let summary;
 if(original===null){
  summary='No matching recovered public witness. The editor text has not been checked against an original.';
 }else{
  const a=original.split(/\r?\n/),b=current.split(/\r?\n/);
  let changed=0;
  for(let i=0;i<Math.max(a.length,b.length);i++)if(a[i]!==b[i])changed++;
  summary=original===current?'Current text matches the displayed recovered source.':
   changed+' line position(s) differ from the recovered source. Review deliberately; this is not a canonicality verdict.';
  if(/(?:\.\.\.|…){2,}/.test(original))summary+=' Possible truncation markers need source verification.';
 }
 $('comparison-summary').textContent=summary;
}
function toggleComparison(){
 if(!active)return;
 const box=$('source-compare');
 box.hidden=!box.hidden;
 if(!box.hidden){
  renderComparison();
  box.scrollIntoView?.({behavior:'smooth',block:'nearest'});
 }
}
async function copyContinuityHandoff(){
 if(!active?.id||hasUnsavedChanges()||!navigatorCore)
  return tell('Save this exact private revision before copying its metadata handoff.',true);
 const metadata=navigatorCore.handoff(active);
 try{
  if(!navigator.clipboard?.writeText)throw Error('Clipboard API unavailable');
  await navigator.clipboard.writeText(metadata);
  tell('Copied metadata-only handoff. Paste it into Continuity deliberately; no poem text or credentials were transferred.');
 }catch(error){
  // Do not automatically navigate to a different app or transmit private data.
  window.prompt('Copy this metadata-only handoff manually (private text excluded):',metadata);
  tell('Clipboard permission was unavailable. You can copy the handoff from the prompt.');
 }
}
function jumpToCommandSearch(){
 if($('app').hidden)return;
 $('global-search').focus();$('global-search').scrollIntoView?.({behavior:'smooth',block:'center'});
}
function keyboardCommands(event){
 if($('app').hidden)return;
 const key=String(event.key||''),tag=event.target?.tagName||'';
 const editable=/^(INPUT|TEXTAREA|SELECT)$/.test(tag)||event.target?.isContentEditable;
 if((event.ctrlKey||event.metaKey)&&key.toLowerCase()==='k'){
  event.preventDefault();jumpToCommandSearch();return;
 }
 if(key==='/'&&!editable&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
  event.preventDefault();jumpToCommandSearch();return;
 }
 if(key==='Escape'&&event.target?.closest?.('#global-results')){
  event.preventDefault();$('global-search').focus();
 }
}

async function ready(){
 $('login-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const email=$('email').value.trim();
  try {
   await readJson(await fetch(base()+'/auth/v1/otp?redirect_to='+encodeURIComponent(location.origin+location.pathname),{
     method:'POST',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json'},
     body:JSON.stringify({email,create_user:false})
   }));
   tell('If this email belongs to an invited account, a sign-in link has been sent. Follow the link on this device.');
  } catch(err){tell('Sign-in failed: '+err.message,true)}
 });
 $('logout').addEventListener('click',signOut);
 $('logout-denied').addEventListener('click',signOut);
 $('reload').addEventListener('click',()=>{
  if(!confirmDiscard())return;
  if(active && !active.id)clearEditor();
  load().catch(e=>tell(e.message,true));
 });
 $('export-drafts').addEventListener('click',exportLoadedRecords);
 $('quick-find').addEventListener('click',()=>{
  if(!confirmDiscard())return;
  clearEditor();$('kind').value='poem';listPublicSources();listDrafts();
  $('source-search').focus();$('workspace-sidebar').scrollIntoView?.({behavior:'smooth',block:'start'});
 });
 $('quick-seed').addEventListener('click',()=>newRecord('seed'));
 $('quick-review').addEventListener('click',()=>{
  const first=records.find(r=>r.status==='draft');
  if(first && first.kind!==$('kind').value){
   if(!confirmDiscard())return;
   clearEditor();$('kind').value=first.kind;listPublicSources();
  }
  $('record-filter').value='draft';listDrafts();
  if(!first)tell('There are no private drafts in the loaded records yet. Start a new one whenever you are ready.');
  $('draft-search').focus();$('workspace-sidebar').scrollIntoView?.({behavior:'smooth',block:'start'});
 });
 $('kind').addEventListener('change',()=>{
  if(!confirmDiscard()){$('kind').value=active?.kind||'seed';return}
  clearEditor();listPublicSources();listDrafts();
 });
 $('source-search').addEventListener('input',listPublicSources);
 $('draft-search').addEventListener('input',listDrafts);
 $('record-filter').addEventListener('change',listDrafts);
 $('new').addEventListener('click',()=>newRecord($('kind').value));
 $('title').addEventListener('input',suggestNewRecordKey);
 $('entity-key').addEventListener('input',()=>{$('entity-key').dataset.userEdited='true'});
 $('edit-form').addEventListener('input',()=>{$('preview-panel').hidden=true;updateEditState()});
 $('edit-form').addEventListener('change',()=>{$('preview-panel').hidden=true;updateEditState()});
 window.addEventListener('beforeunload',event=>{
  if(!hasUnsavedChanges())return;
  event.preventDefault();event.returnValue='';
 });
 $('edit-form').addEventListener('submit',saveDraft);
 $('preview').addEventListener('click',()=>{show('preview-panel');$('preview-content').textContent=JSON.stringify(draftProjection(),null,2)});
 $('approve').addEventListener('click',()=>action('museum_approve',{prompt:'Approve the EXACT current revision for public display? This does not publish it yet.',phrase:'APPROVE EXACT PUBLIC VERSION'}));
 $('publish').addEventListener('click',()=>action('museum_publish',{prompt:'PUBLISH this approved revision on the public Museum? Public visitors will be able to read it.',phrase:'PUBLISH APPROVED VERSION'}));
 $('withdraw').addEventListener('click',()=>action('museum_withdraw',{prompt:'WITHDRAW this record from public view? A public tombstone will override the static copy, but archival originals remain preserved.',phrase:'WITHDRAW PUBLIC VERSION'}));
 $('vault-file').addEventListener('change',importVault);
 $('vault-version').addEventListener('change',displayVaultWitness);
 $('vault-use').addEventListener('click',useVaultWitness);
 $('vault-filter').addEventListener('input',renderVault);
 renderVault();await beginSession();
}
ready().catch(e=>tell('Control center could not start: '+e.message,true));
})();