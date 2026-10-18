/* Optional authenticated Preservation Desk. No automatic imports, exports or publishing.
 * All file processing is local. Network reads and one-work staging use the editor's scoped bridge.
 */
(()=>{
'use strict';
const core=window.IDP_PRESERVATION,bridge=window.IDP_EDITOR_WORKSPACE;
if(!core||!bridge)return;
const launch=document.createElement('button');launch.type='button';launch.className='secondary';
launch.id='preservation-open';launch.textContent='Preservation desk';launch.disabled=true;
document.querySelector('#app .quick')?.prepend(launch);
const modal=document.createElement('dialog');modal.id='preservation-desk';modal.setAttribute('aria-labelledby','preservation-title');
// Constant, audited UI markup only. Imported text is never assigned to innerHTML.
modal.innerHTML=`
<div class="pd-shell">
 <header class="pd-header"><div><div class="pd-eyebrow">B’s Myth · source before certainty</div><h2 id="preservation-title">Keep the work. Keep the way back.</h2><p>A private workshop for revisions, canonical witnesses and verified recovery.</p></div><button id="pd-close" type="button" aria-label="Close preservation desk">Close ×</button></header>
 <nav class="pd-tabs" role="tablist" aria-label="Preservation workspace">
  <button id="pd-tab-revisions" role="tab" aria-selected="true" aria-controls="pd-revisions" data-pane="revisions">01 · Revision lens</button>
  <button id="pd-tab-canon" role="tab" aria-selected="false" aria-controls="pd-canon" data-pane="canon" tabindex="-1">02 · Canon bridge</button>
  <button id="pd-tab-recovery" role="tab" aria-selected="false" aria-controls="pd-recovery" data-pane="recovery" tabindex="-1">03 · Recovery rehearsal</button>
 </nav>
 <p id="pd-status" class="pd-status" role="status" aria-live="polite">Choose a saved work to inspect its revision history.</p>
 <section id="pd-revisions" class="pd-pane" role="tabpanel" aria-labelledby="pd-tab-revisions">
  <div class="pd-intro"><h3>History is a source, not a suggestion.</h3><p>Compare exact saved revisions. Restoring creates a new private revision, never erases an old one and never republishes a work.</p></div>
  <label for="pd-record">Saved editorial work</label><select id="pd-record"><option value="">Select a saved work</option></select>
  <div class="pd-row"><button id="pd-history" type="button">Read saved history</button><button id="pd-back-editor" type="button" class="secondary">Open in editor</button></div>
  <p id="pd-empty" class="pd-empty">No revision history loaded. Unsaved text is not a saved version.</p>
  <div id="pd-timeline" hidden>
   <div class="pd-two"><label>Earlier witness<select id="pd-before"></select></label><label>Later witness<select id="pd-after"></select></label></div>
   <p id="pd-diff-summary" class="pd-summary"></p>
   <div class="pd-two pd-text-columns"><section><h4 id="pd-before-title"></h4><pre id="pd-before-text"></pre></section><section><h4 id="pd-after-title"></h4><pre id="pd-after-text"></pre></section></div>
   <details class="pd-diff-detail"><summary>Inspect line-by-line changes</summary><p>+ added, − removed, = unchanged. CRLF, CR and LF are distinguished. Long comparisons use a bounded, coarse middle section.</p><div id="pd-diff" class="pd-diff"></div></details>
   <div class="pd-row"><button id="pd-restore" type="button" class="secondary">Restore earlier witness as a new private revision</button><button id="pd-export" type="button">Export verified work-history bundle</button></div>
   <p class="pd-note">The bundle includes this record and its complete revision history. It is unencrypted and excludes database roles, authentication, audit events, historical archive files and other works.</p>
  </div>
 </section>
 <section id="pd-canon" class="pd-pane" role="tabpanel" aria-labelledby="pd-tab-canon" hidden>
  <div class="pd-intro"><h3>Connect the registry you already have.</h3><p>Open a canonical JSON registry or a MAX02 report locally. Exact work IDs, source pointers and text hashes remain intact. Imported labels do not grant authorship, canonical authority or publication permission.</p></div>
  <label for="pd-registry-file">Private canonical registry / MAX02 report · up to 8 MiB<input id="pd-registry-file" type="file" accept=".json,.html,application/json,text/html"></label>
  <p class="pd-note">The file stays in memory on this device. Report scripts are not executed. It is not uploaded to GitHub, Supabase, Continuity or a search service.</p>
  <label for="pd-registry-search">Find a work by title or stable work ID<input id="pd-registry-search" type="search" autocomplete="off" placeholder="No title-based merging"></label>
  <div id="pd-registry-list" class="pd-work-list"></div>
  <section id="pd-candidate" class="pd-candidate" hidden>
   <h4 id="pd-candidate-title"></h4><p id="pd-candidate-meta" class="pd-mono"></p><ul id="pd-candidate-flags"></ul>
   <pre id="pd-candidate-text"></pre>
   <label class="pd-check"><input id="pd-source-reviewed" type="checkbox">I inspected the source-quality warnings and have verified that this is an intact witness. This is not publication consent.</label>
   <button id="pd-stage" type="button">Stage this one exact witness privately</button>
   <p class="pd-note">Nothing is saved until you use Save PRIVATE draft in the editor. Existing stable IDs are opened unchanged, not overwritten. Public approvals from files are never replayed.</p>
  </section>
 </section>
 <section id="pd-recovery" class="pd-pane" role="tabpanel" aria-labelledby="pd-tab-recovery" hidden>
  <div class="pd-intro"><h3>A backup is a promise. Test the promise.</h3><p>Reopen a work-history bundle, recompute its SHA-256 digest, validate every revision and compare it with the loaded workspace. This rehearsal performs no database writes.</p></div>
  <label for="pd-recovery-file">Verified work-history bundle · up to 8 MiB<input id="pd-recovery-file" type="file" accept=".json,application/json"></label>
  <div id="pd-recovery-report" class="pd-recovery-report"></div>
  <p class="pd-note">Checksums detect inconsistency; they are not a digital signature or proof of authorship. A rehearsal is not a complete database restore. Keep independent copies of original archives and test full database recovery separately.</p>
 </section>
 <footer class="pd-footer"><span>Private canon ≠ permission to publish.</span><a href="https://exemptus9.github.io/artificial-continuity/" target="_blank" rel="noopener noreferrer">Continuity ↗</a><a href="../observatory/" target="_blank" rel="noopener noreferrer">Lexical Observatory ↗</a><a href="../projects/" target="_blank" rel="noopener noreferrer">Constellation ↗</a></footer>
</div>`;
document.body.append(modal);
const $=id=>modal.querySelector('#'+id);
let history=null,registry=null,candidate=null,generation=0,pending=false;
function note(text,error=false){$('pd-status').textContent=text;$('pd-status').classList.toggle('pd-error',error);}
function selectedVersion(id){return history?.versions.find(v=>String(v.version)===$(id).value);}
function authorized(){return ['owner','editor'].includes(bridge.state().role);}
function clear(){
 generation++;history=registry=candidate=null;pending=false;
 for(const id of ['pd-before-text','pd-after-text','pd-before-title','pd-after-title','pd-diff-summary','pd-diff','pd-registry-list','pd-candidate-title','pd-candidate-meta','pd-candidate-flags','pd-candidate-text','pd-recovery-report'])$(id).replaceChildren();
 for(const id of ['pd-record','pd-before','pd-after'])$(id).replaceChildren();
 for(const id of ['pd-registry-file','pd-recovery-file','pd-registry-search'])$(id).value='';
 $('pd-timeline').hidden=true;$('pd-candidate').hidden=true;
 if(modal.open)modal.close();launch.disabled=true;note('Signed out. Private preservation data cleared.');
}
function tabs(name){
 for(const t of modal.querySelectorAll('[data-pane]')){
  const on=t.dataset.pane===name;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;
  $('pd-'+t.dataset.pane).hidden=!on;
 }
}
function refreshRecords(){
 launch.disabled=!authorized();if(modal.open&&history)return;
 const state=bridge.state(),selected=$('pd-record').value||state.active?.id;
 $('pd-record').replaceChildren(new Option('Select a saved work',''));
 for(const r of state.records){const o=new Option(r.title+' · '+r.kind+' · r'+r.revision,r.id);$('pd-record').add(o);}
 if(selected)$('pd-record').value=selected;
}
function controls(){
 for(const id of ['pd-history','pd-registry-file','pd-recovery-file'])$(id).disabled=pending;
 for(const id of ['pd-restore','pd-export'])$(id).disabled=pending||!history;
 $('pd-stage').disabled=pending||!candidate?.verified;
}
async function run(operation){
 if(pending)return;
 if(!authorized())return clear();
 const token=++generation;pending=true;controls();modal.setAttribute('aria-busy','true');
 try{await operation(()=>token===generation&&authorized());}
 catch(e){if(token===generation)note(e.message||'Operation failed. Nothing was imported.',true);}
 finally{if(token===generation){pending=false;controls();modal.removeAttribute('aria-busy');}}
}
function compare(){
 const a=selectedVersion('pd-before'),b=selectedVersion('pd-after');if(!a||!b)return;
 const left=typeof a.draft.text==='string'?a.draft.text:'',right=typeof b.draft.text==='string'?b.draft.text:'';
 const result=core.diff(left,right);
 $('pd-before-title').textContent='Revision '+a.version+' · '+a.title;
 $('pd-after-title').textContent='Revision '+b.version+' · '+b.title;
 $('pd-before-text').textContent=left;$('pd-after-text').textContent=right;
 const titles=a.title===b.title?'':' Title also differs.';
 $('pd-diff-summary').textContent=(result.equal?'Exact text match.':result.added+' added line(s) · '+result.removed+' removed line(s).')+titles+
  ' Earlier: '+result.before.bytes+' UTF-8 bytes. Later: '+result.after.bytes+' bytes.'+(result.coarse?' Bounded comparison: the changed middle is coarse.':'');
 const out=$('pd-diff');out.replaceChildren();
 for(const row of result.rows.slice(0,1600)){
  const node=document.createElement('div');node.className='pd-line pd-'+row.op;
  const eol=/\r\n$/.test(row.text)?' ⟦CRLF⟧':/\r$/.test(row.text)?' ⟦CR⟧':/\n$/.test(row.text)?' ⟦LF⟧':' ⟦no final newline⟧';
  node.textContent=({add:'+ ',remove:'− ',equal:'= '}[row.op])+row.text.replace(/[\r\n]+$/,'')+eol;out.append(node);
 }
 if(result.rows.length>1600){const p=document.createElement('p');p.textContent='Display limited to 1,600 lines; the exported bundle remains complete.';out.append(p);}
}
async function loadHistory(valid){
 const id=$('pd-record').value;if(!id)throw Error('Choose a saved editorial work first.');
 history=null;$('pd-timeline').hidden=true;$('pd-empty').hidden=false;controls();
 note('Reading the record and its complete saved history…');
 const snapshot=await bridge.history(id);if(!valid())return;
 await core.pack(snapshot.record,snapshot.versions,location.origin);if(!valid())return;
 history=snapshot;for(const name of ['pd-before','pd-after']){
  $(name).replaceChildren();for(const v of history.versions)$(name).add(new Option('Revision '+v.version,v.version));
 }
 $('pd-after').value=String(snapshot.record.revision);
 $('pd-before').value=String(Math.max(1,snapshot.record.revision-1));
 $('pd-timeline').hidden=false;$('pd-empty').hidden=true;compare();
 note('Complete history loaded: '+snapshot.versions.length+' revision(s). No data was changed.');
}
function download(data,name){
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),15000);
}
async function fileText(file){
 if(!file||file.size>core.MAX_BYTES)throw Error('Choose a file no larger than 8 MiB.');
 return new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
}
function paintRegistry(){
 const out=$('pd-registry-list');out.replaceChildren();if(!registry)return;
 const q=$('pd-registry-search').value.trim().toLocaleLowerCase();
 const matches=registry.works.filter(w=>(w.title+' '+w.work_id).toLocaleLowerCase().includes(q));
 const count=document.createElement('p');count.textContent=matches.length+' matching work(s), showing first 60.';out.append(count);
 for(const w of matches.slice(0,60)){
  const b=document.createElement('button');b.type='button';b.className='pd-work';
  b.textContent=w.title+' · '+(w.verified?'hash matches':w.text===null?'no selected text':'hash unverified')+' · '+w.work_id;
  b.addEventListener('click',()=>selectCandidate(w));out.append(b);
 }
}
function selectCandidate(work){
 candidate=work;$('pd-candidate').hidden=false;$('pd-source-reviewed').checked=false;
 $('pd-candidate-title').textContent=work.title;
 $('pd-candidate-meta').textContent=work.work_id+'\nSHA-256: '+(work.sha256||'no text')+'\nSource-reported canon: '+work.reportedCanonStatus+' (not an imported approval)';
 $('pd-candidate-text').textContent=work.text??'No canonical text selected in this source.';
 const out=$('pd-candidate-flags');out.replaceChildren();
 const flags=[...work.flags];if(!work.verified)flags.unshift('Text hash is missing or mismatched. Staging is blocked.');
 if(work.reportedPublicApproval)flags.push('The source reports publication approval. It will NOT be copied into the editor.');
 for(const flag of flags){const li=document.createElement('li');li.textContent=flag;out.append(li);}
 $('pd-stage').disabled=!work.verified;
}
launch.addEventListener('click',()=>{
 if(!authorized())return;
 refreshRecords();modal.showModal();$('pd-close').focus();
 note('Review safely. Nothing is saved, restored or exported just by opening this desk.');
});
$('pd-close').addEventListener('click',()=>modal.close());
modal.addEventListener('close',()=>{generation++;pending=false;controls();modal.removeAttribute('aria-busy');});
for(const t of modal.querySelectorAll('[data-pane]'))t.addEventListener('click',()=>tabs(t.dataset.pane));
modal.querySelector('.pd-tabs').addEventListener('keydown',e=>{
 if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;
 const list=Array.from(modal.querySelectorAll('[data-pane]')),index=list.indexOf(document.activeElement);if(index<0)return;
 const n=e.key==='Home'?0:e.key==='End'?list.length-1:(index+(e.key==='ArrowRight'?1:-1)+list.length)%list.length;
 e.preventDefault();tabs(list[n].dataset.pane);list[n].focus();
});
$('pd-record').addEventListener('change',()=>{generation++;pending=false;history=null;controls();modal.removeAttribute('aria-busy');$('pd-timeline').hidden=true;$('pd-empty').hidden=false;});
$('pd-history').addEventListener('click',()=>run(loadHistory));
for(const id of ['pd-before','pd-after'])$(id).addEventListener('change',compare);
$('pd-back-editor').addEventListener('click',()=>{if(bridge.open($('pd-record').value))modal.close();});
$('pd-restore').addEventListener('click',()=>run(async valid=>{
 if(!history)throw Error('Read the saved history first.');
 const ok=await bridge.restore(history.record.id,Number($('pd-before').value),history.record.revision);
 if(!valid())return;
 if(ok){history=null;await loadHistory(valid);note('Restored as a new private revision. Earlier versions and public content remain unchanged.');}
}));
$('pd-export').addEventListener('click',()=>run(async valid=>{
 if(!history)throw Error('Read history before exporting.');
 if(!confirm('Download this work and ALL its saved revisions as an UNENCRYPTED PRIVATE file? Keep it outside public folders. This is not a full database backup.'))return;
 const fresh=await bridge.history(history.record.id);if(!valid())return;
 const bundle=await core.pack(fresh.record,fresh.versions,location.origin);if(!valid())return;
 download(bundle,'idp-private-work-'+fresh.record.entity_key+'-r'+fresh.record.revision+'.json');
 note('Work-history bundle verified before download. SHA-256: '+bundle.sha256+'. Reopen it in Recovery rehearsal to test the downloaded file.');
}));
$('pd-registry-file').addEventListener('change',()=>run(async valid=>{
 registry=candidate=null;$('pd-registry-list').replaceChildren();$('pd-candidate').hidden=true;
 note('Reading the canonical registry locally and checking exact-text hashes…');
 const text=await fileText($('pd-registry-file').files[0]);const parsed=await core.registry(text);if(!valid())return;
 registry=parsed;paintRegistry();note(parsed.works.length+' source work identities · '+parsed.verified+' matching text hashes · '+parsed.missing+' without selected text. No permissions imported; no file uploaded.');
}));
$('pd-registry-search').addEventListener('input',paintRegistry);
$('pd-stage').addEventListener('click',()=>{
 try{
  if(!candidate||!registry)throw Error('Choose a registry witness.');
  const record=core.stageWork(candidate,registry.sourceSHA256,$('pd-source-reviewed').checked);
  if(!confirm('Place this one witness in the PRIVATE editor without saving or publishing? Its exact work ID and source hash will be retained.'))return;
  if(bridge.stagePrivate(record))modal.close();
 }catch(e){note(e.message,true);}
});
$('pd-recovery-file').addEventListener('change',()=>run(async valid=>{
 $('pd-recovery-report').replaceChildren();note('Rehearsing recovery locally. No database writes will be made.');
 const text=await fileText($('pd-recovery-file').files[0]);const checked=await core.verify(text);
 const plan=await core.recoveryPlan(checked.envelope,bridge.state().records);if(!valid())return;
 const r=checked.envelope.data.record,out=$('pd-recovery-report');
 for(const [name,value] of [['Work',r.title],['Stable key',r.entity_key],['History',checked.versions+' complete revisions'],['Integrity','SHA-256 matches the bundle'],['Text SHA-256',checked.textSHA256||'No text field'],['Workspace comparison',plan.label],['Database writes','0 — review only']]){
  const row=document.createElement('p'),strong=document.createElement('strong');strong.textContent=name+': ';row.append(strong,document.createTextNode(String(value)));out.append(row);
 }
 note('Recovery rehearsal passed. Approval and publication state have not been applied to any database.');
}));
window.addEventListener('idp:editor-ready',refreshRecords);
window.addEventListener('idp:editor-signed-out',clear);
refreshRecords();
})();
