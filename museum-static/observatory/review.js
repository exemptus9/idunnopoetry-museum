import {fold, hasWorkingDefinition} from './model.js';
import {createPublicationRequest} from './public-request.js';

export const REVIEW_FLAGS = ['definition_conflict','definition_needed','meaning_inferred','classification_review','variant_review','attribution_review','source_needed','author_decision','duplicate_candidate'];
const states = ['open','resolved','deferred'];
const bases = ['author_supplied','conversation_recovered','archive_recovered','inferred','unknown'];
const definitionStates = ['author_supplied','conversation_recovered','working_definition','inferred_definition','awaiting_definition'];
const evidenceStates = ['verified','supported','reported','hypothetical','unknown'];
export const DESK_ACTIONS = {
  definition_checked: {label:'Definition checked',help:'Marks your review of the current wording. It does not assert original invention, change the definition’s source, or approve Canon.'},
  needs_source: {label:'Needs a source',help:'Adds a source question and reopens review.'},
  resolve: {label:'Resolve review',help:'Marks the review resolved. Existing evidence and source-history labels are preserved.'},
  recovered: {label:'Use recovered definition',help:'Keeps the current wording and records its recovered source basis. Inspect the source before choosing this.'},
};
const classifications = ['coinage_candidate','existing_form_reinterpreted','expression','term_seed','unclassified','proper_name','literary_wordplay','concept_label','ai_suggestion','existing_term'];
const workflow = 'https://github.com/exemptus9/idunnopoetry-museum/actions/workflows/lexical-editor.yml';
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const label = value => String(value ?? '').replaceAll('_',' ').replace(/\b\w/g,ch=>ch.toUpperCase());
const display = value => Array.isArray(value) ? value.join(' · ') || 'None' : typeof value === 'object' ? JSON.stringify(value,null,2) : String(value || 'Not recorded');
const link = term => `?term=${encodeURIComponent(term.slug)}`;
function reviewOf(term) {
  const source = term.review || {};
  return {state:states.includes(source.state)?source.state:'open',flags:Array.isArray(source.flags)?source.flags.filter(flag=>REVIEW_FLAGS.includes(flag)):[],definitionBasis:bases.includes(source.definitionBasis)?source.definitionBasis:'unknown',note:typeof source.note==='string'?source.note:''};
}
export function filterReviewTerms(catalog, filters = {}) {
  const query=fold(filters.q||'');
  return catalog.terms.filter(term=>{
    const review=reviewOf(term);
    if(filters.queue==='definitions'&&hasWorkingDefinition(term))return false;
    if(filters.queue==='sources'&&!review.flags.includes('source_needed'))return false;
    if(filters.queue==='authorship'&&!review.flags.includes('attribution_review')&&!/undetermined|unknown|uncertain/i.test(term.authorship||''))return false;
    if(filters.queue==='inferred'&&review.definitionBasis!=='inferred'&&term.definitionStatus!=='inferred_definition'&&!review.flags.includes('meaning_inferred'))return false;
    if(filters.queue==='open'&&review.state!=='open')return false;
    if(filters.queue==='resolved'&&review.state!=='resolved')return false;
    const haystack=fold([term.headword,term.definition,term.editorialReview?.shortReason,review.note,...(term.tags||[]),...(term.domains||[])].join(' '));
    return (!query||query.split(/\s+/).every(token=>haystack.includes(token)))&&
      (!filters.stage||term.stage===filters.stage)&&(!filters.classification||term.classification===filters.classification)&&
      (!filters.reviewState||review.state===filters.reviewState)&&(!filters.reviewFlag||review.flags.includes(filters.reviewFlag))&&
      (!filters.definitionBasis||review.definitionBasis===filters.definitionBasis)&&(!filters.tag||(term.tags||[]).includes(filters.tag));
  }).sort((a,b)=>a.headword.localeCompare(b.headword));
}
export function deskActionOperations(key,term) {
  if(key==='definition_checked'){
    if(!hasWorkingDefinition(term))throw new Error(`${term.headword} needs a developed definition before it can be checked.`);
    return [{field:'tags',mode:'add',value:'definition_checked'}];
  }
  if(key==='needs_source')return [{field:'review.flags',mode:'add',value:'source_needed'}];
  if(key==='resolve')return [{field:'review.state',mode:'set',value:'resolved'}];
  if(key==='recovered'){
    if(!hasWorkingDefinition(term))throw new Error(`${term.headword} has no developed wording to label as recovered.`);
    const basis=reviewOf(term).definitionBasis;
    if(basis!=='conversation_recovered'&&basis!=='archive_recovered')throw new Error(`${term.headword} has no recovered source basis. Inspect its evidence and set the basis explicitly first.`);
    return [{field:'definitionStatus',mode:'set',value:basis==='archive_recovered'?'working_definition':'conversation_recovered'},{field:'tags',mode:'add',value:'definition_checked'}];
  }
  if(key==='adopt_analysis'){
    const proposal=typeof term.analysis?.interpretationProposal==='string'?term.analysis.interpretationProposal.trim():'';
    if(term.analysis?.kind!=='ai_hypothesis'||!proposal||proposal===(term.definition||'').trim())throw new Error('There is no distinct, explicitly hypothetical proposed reading to adopt. Use the individual editor instead.');
    if(term.stage==='canon')throw new Error('Canon requires the individual editor and exact authorial approval.');
    return [{field:'definition',mode:'set',value:proposal},{field:'definitionStatus',mode:'set',value:'inferred_definition'},{field:'review.definitionBasis',mode:'set',value:'inferred'},{field:'review.flags',mode:'remove',value:'definition_needed'},{field:'review.flags',mode:'add',value:'meaning_inferred'},{field:'review.flags',mode:'add',value:'author_decision'}];
  }
  throw new Error('Choose a supported review action.');
}
export function buildReviewBatch(catalog, selectedIds, operations, publicNote = '', perRecordOperations = {}) {
  const ids=[...new Set(selectedIds)];
  if(!ids.length)throw new Error('Select at least one public entry.');
  if(ids.length>100)throw new Error('A batch may contain at most 100 entries. Narrow the selection.');
  if(!operations.length&&!ids.some(id=>perRecordOperations[id]?.length))throw new Error('Add a checklist decision or bulk operation.');
  if(typeof publicNote!=='string'||publicNote.length>2000)throw new Error('The public batch note must contain at most 2000 characters.');
  const proofs=[],unchanged=[];
  for(const id of ids){
    const term=catalog.terms.find(row=>row.id===id);
    if(!term)throw new Error('A selected entry is no longer in the public catalog. Reload before continuing.');
    if(term.stage==='canon')throw new Error(`${term.headword} is Canon. Use its individual editor and exact authorial approval instead of a bulk request.`);
    if(!Number.isInteger(term.revision)||term.revision<1)throw new Error(`${term.headword} has no valid public revision. Reload before continuing.`);
    const before={tags:[...(term.tags||[])],collections:[...(term.collections||[])],domains:[...(term.domains||[])],classification:term.classification,formation:term.formation,stage:term.stage,definition:term.definition,definitionStatus:term.definitionStatus,authorship:term.authorship,evidenceStrength:term.evidence||'unknown',review:reviewOf(term)};
    const after=JSON.parse(JSON.stringify(before));
    for(const operation of [...operations,...(perRecordOperations[id]||[])]){
      const {field,mode}=operation,value=String(operation.value||'').trim();
      if(!value||value.length>(field==='definition'?20000:500))throw new Error(field==='definition'?'A working definition must contain between 1 and 20,000 characters.':'Each operation needs a nonempty value of at most 500 characters.');
      if(['tags','collections','domains','review.flags'].includes(field)){
        if(!['add','remove'].includes(mode))throw new Error('List operations must add or remove a value.');
        if(field==='review.flags'&&!REVIEW_FLAGS.includes(value))throw new Error('Choose a supported review flag.');
        const current=field==='review.flags'?after.review.flags:after[field];
        const next=mode==='add'?[...new Set([...current,value])]:current.filter(item=>item!==value);
        if(next.length>100)throw new Error('A public list may contain at most 100 values.');
        if(field==='review.flags'){after.review.flags=next;if(mode==='add')after.review.state='open';}else after[field]=next;
      }else{
        if(mode!=='set')throw new Error('A single-value field needs a set operation.');
        if(field==='stage'){
          if(!['forge','lexicon'].includes(value))throw new Error('Bulk stage changes support Forge and Lexicon only.');
          if(value==='lexicon'&&!hasWorkingDefinition(term))throw new Error(`${term.headword} needs a developed definition before promotion to Lexicon.`);
          after.stage=value;
        }else if(field==='classification'){
          if(!classifications.includes(value))throw new Error('Choose a supported public classification.');after.classification=value;
        }else if(field==='definition'){
          after.definition=value;
        }else if(field==='definitionStatus'){
          if(!definitionStates.includes(value))throw new Error('Choose a supported definition status.');after.definitionStatus=value;
        }else if(field==='formation'){
          if(value.length>200)throw new Error('A formation label may contain at most 200 characters.');after.formation=value;
        }else if(field==='authorship'){
          if(value.length>200)throw new Error('An authorship description may contain at most 200 characters.');after.authorship=value;
        }else if(field==='evidenceStrength'){
          if(!evidenceStates.includes(value))throw new Error('Choose a supported qualitative evidence strength.');after.evidenceStrength=value;
        }else if(field==='review.state'){
          if(!states.includes(value))throw new Error('Choose open, resolved, or deferred.');after.review.state=value;
        }else if(field==='review.definitionBasis'){
          if(!bases.includes(value))throw new Error('Choose a supported definition evidence basis.');after.review.definitionBasis=value;
        }else throw new Error('This public bulk field is not supported.');
      }
    }
    if(after.stage==='lexicon'&&!hasWorkingDefinition({...term,...after}))throw new Error(`${term.headword} cannot remain in Lexicon with an awaiting or undeveloped definition. Move it to Forge in the same batch or keep a developed definition status.`);
    const changes=Object.fromEntries(Object.entries(after).filter(([field,value])=>JSON.stringify(value)!==JSON.stringify(before[field])));
    if(Object.keys(changes).length)proofs.push({term,before:Object.fromEntries(Object.keys(changes).map(field=>[field,before[field]])),changes});else unchanged.push(term.headword);
  }
  if(!proofs.length)throw new Error('These operations make no changes to the selected entries. Nothing needs publishing.');
  const request={action:'batch',changes:proofs.map(({term,changes})=>({action:'update',id:term.id,expectedRevision:term.revision,changes,confirmPublication:`PUBLISH ${term.headword}`})),confirmBatch:`APPLY ${proofs.length} PUBLIC CHANGES`,publicNote:publicNote.trim()};
  if(new TextEncoder().encode(JSON.stringify(request)).length>150000)throw new Error('This batch exceeds 150 KB. Use fewer entries or smaller changes.');
  const pretty=JSON.stringify(request,null,2);
  if(pretty.length>60000||JSON.stringify({change_json:pretty,commit:false}).length>65535)throw new Error('This batch exceeds the workflow transport limit (60,000 prepared characters, including allowance for the input wrapper). Select fewer entries or use smaller changes.');
  return {request,proofs,unchanged};
}
export function mountReviewWorkbench(container,catalog) {
  let selected=new Set(),operations=[],prepared=null,activeQueue='';
  const staged=new Map();
  const requested=new URLSearchParams(location.hash.split('?')[1]||'').get('term');
  const initialTerm=requested?catalog.terms.find(term=>term.id===requested||term.slug===requested):null;
  if(initialTerm?.stage!=='canon'&&initialTerm)selected.add(initialTerm.id);
  const options=values=>values.map(value=>`<option value="${esc(value)}">${esc(label(value))}</option>`).join('');
  const tags=[...new Set(catalog.terms.flatMap(term=>term.tags||[]))].sort();
  container.innerHTML=`<aside class="notice warning"><div><strong>Public review, with an authenticated publishing boundary.</strong><p>This queue prepares public changes only. Review notes, classifications, tags, and decisions may remain in public Git history. Nothing is saved locally. GitHub owner authentication and a successful publishing workflow are required to apply a batch.</p></div></aside><div class="review-layout"><section class="review-queue"><form id="review-filters" class="search-panel" role="search"><label>Find entries<input name="q" type="search" placeholder="Word, definition, review reason, tag…" maxlength="160"></label><div class="filter-grid"><label>Review state<select name="reviewState"><option value="">All states</option>${options(states)}</select></label><label>Review flag<select name="reviewFlag"><option value="">All flags</option>${options(REVIEW_FLAGS)}</select></label><label>Definition basis<select name="definitionBasis"><option value="">All evidence bases</option>${options(bases)}</select></label><label>Classification<select name="classification"><option value="">All classifications</option>${options([...new Set(catalog.terms.map(t=>t.classification))].sort())}</select></label><label>Lifecycle stage<select name="stage"><option value="">All stages</option>${options(['forge','lexicon','canon'])}</select></label><label>Tag<select name="tag"><option value="">All tags</option>${options(tags)}</select></label></div></form><div class="review-selection-tools"><p id="review-count" role="status" aria-live="polite"></p><div><button class="text-button" type="button" id="review-select-matching">Select all matching</button><button class="text-button" type="button" id="review-clear-selection">Clear selection</button></div></div><p class="small-meta">Selections stay selected when filters change. Canon entries use their individual editor.</p><div id="review-cards" class="review-cards"></div></section><aside class="bulk-controls"><p class="eyebrow">A reviewable operation, across entries</p><h2>Make a careful<br>bulk change.</h2><form id="bulk-operation-form" class="author-form"><label>Field<select name="field"><option value="review.flags">Review flag</option><option value="review.state">Review state</option><option value="review.definitionBasis">Definition evidence basis</option><option value="definitionStatus">Definition status</option><option value="tags">Tag</option><option value="collections">Collection</option><option value="domains">Semantic domain</option><option value="classification">Classification</option><option value="formation">Formation method</option><option value="stage">Lifecycle stage</option></select></label><label id="bulk-mode-label">Operation<select name="mode"><option value="add">Add</option><option value="remove">Remove</option><option value="set">Set</option></select></label><div id="bulk-value-control"></div><button type="submit" class="button secondary">Add operation to preview</button></form><div id="bulk-operation-list"></div><label>Public batch note<textarea id="bulk-public-note" maxlength="2000" rows="3" placeholder="A concise public explanation for this set of changes"></textarea></label><button class="button" type="button" id="review-preview-batch">Preview selected changes →</button><p id="review-error" class="form-error" role="alert"></p><p class="small-meta">At most 100 entries, 60,000 prepared JSON characters, and 150 KB per atomic batch. Larger selections must be split. One stale revision or invalid change rejects the entire batch; no partial publication.</p><a href="#author">Open the individual author tools ↗</a></aside></div><section id="bulk-preview" class="author-preview" hidden aria-live="polite"></section>`;
  const filterForm=container.querySelector('#review-filters'),operationForm=container.querySelector('#bulk-operation-form');
  const filters=()=>({...Object.fromEntries(new FormData(filterForm)),queue:activeQueue});
  const matches=()=>filterReviewTerms(catalog,filters());
  const clearPrepared=()=>{prepared=null;container.querySelector('#bulk-preview').hidden=true;container.querySelector('#review-error').textContent='';};
  container.classList.add('owner-review-desk');
  const queues=document.createElement('section');queues.className='desk-queues';queues.setAttribute('aria-label','Actionable review queues');
  const queueLabels=[['','All entries'],['open','Open questions'],['definitions','Needs definition'],['sources','Needs source'],['authorship','Authorship questions'],['inferred','Inferred meanings'],['resolved','Resolved']];
  queues.innerHTML=`<div class="desk-heading"><div><p class="eyebrow">The owner’s review desk</p><h2>Read. Check. Stage. Publish.</h2></div><p>Checkboxes stage public decisions. They do not save until you authorize the GitHub handoff.</p></div><div class="desk-queue-buttons">${queueLabels.map(([key,title])=>`<button type="button" data-desk-queue="${key}" aria-pressed="${key===''}">${esc(title)} <span>${filterReviewTerms(catalog,{queue:key}).length}</span></button>`).join('')}</div>`;
  container.querySelector('.notice').after(queues);
  const quick=document.createElement('section');quick.className='desk-quick-actions';quick.innerHTML=`<p class="eyebrow">Apply to the selected checkboxes</p><div>${Object.entries(DESK_ACTIONS).map(([key,action])=>`<button class="button secondary" type="button" data-desk-action="${key}" title="${esc(action.help)}">${esc(action.label)}</button>`).join('')}</div><p id="desk-action-help" class="small-meta">Definition checked marks a wording review, not Canon or verified originality. Needs a source reopens review. Recovered wording keeps its documented source basis.</p><label>Authorship decision<select id="desk-authorship"><option value="">Choose an explicit authorship decision…</option><option>Created by the author (author confirmed)</option><option>Collaboratively revised</option><option>AI suggested; not an original-authorship claim</option><option>Existing form reinterpreted by the author</option><option>Origin undetermined</option></select></label><button class="text-button" type="button" id="desk-stage-authorship">Stage authorship decision</button><label>Evidence strength<select id="desk-evidence"><option value="">Choose after inspecting the evidence…</option>${options(evidenceStates)}</select></label><button class="text-button" type="button" id="desk-stage-evidence">Stage evidence assessment</button><p class="small-meta">Evidence strength concerns the inspected sources. It never proves absolute originality. Authorship choices are public claims requiring owner review.</p>`;
  const controls=container.querySelector('.bulk-controls');controls.querySelector('h2').innerHTML='Check the wording.<br>Keep the evidence.';controls.querySelector('h2').after(quick);
  const advanced=document.createElement('details');advanced.className='desk-advanced';advanced.innerHTML='<summary>More metadata actions</summary>';operationForm.before(advanced);advanced.append(operationForm,container.querySelector('#bulk-operation-list'));
  operationForm.elements.field.insertAdjacentHTML('beforeend','<option value="authorship">Authorship description</option><option value="evidenceStrength">Evidence strength</option>');
  const tray=document.createElement('div');tray.className='desk-tray';tray.setAttribute('role','region');tray.setAttribute('aria-label','Staged public decisions');tray.innerHTML=`<p id="desk-staged-count" role="status">No decisions staged</p><div class="desk-tray-action"><select id="desk-tray-action" aria-label="Checklist action for selected records">${Object.entries(DESK_ACTIONS).map(([key,action])=>`<option value="${key}">${esc(action.label)}</option>`).join('')}</select><button type="button" class="button secondary" id="desk-tray-stage">Stage</button></div><div><button type="button" class="text-button" id="desk-clear-staged">Clear staged</button><button type="button" class="button" id="desk-preview">Review &amp; publish →</button></div>`;container.append(tray);
  function stagedChecks(term,tag){let checked=(term.tags||[]).includes(tag);for(const operation of staged.get(term.id)||[])if(operation.field==='tags'&&operation.value===tag)checked=operation.mode==='add';return checked;}
  function updateTray(){container.querySelector('#desk-staged-count').textContent=`${selected.size} selected · ${staged.size} records with staged decisions`;}
  function stageFor(ids,makeOperations){
    clearPrepared();try{const terms=[...ids].map(id=>catalog.terms.find(term=>term.id===id));if(!terms.length)throw new Error('Select one or more record checkboxes first.');if(new Set([...staged.keys(),...terms.map(term=>term?.id)]).size>100)throw new Error('A staged batch can contain at most 100 records. Publish or clear the current decisions before starting another group.');if(terms.some(term=>!term||term.stage==='canon'))throw new Error('Canon decisions belong in the individual editor.');const additions=terms.map(term=>[term.id,makeOperations(term)]);for(const[id,changes]of additions)staged.set(id,[...(staged.get(id)||[]),...changes]);renderCards();updateTray();container.querySelector('#desk-action-help').textContent=`Staged decisions for ${additions.length} records. Review the exact before/after changes before continuing to GitHub.`;}catch(error){container.querySelector('#review-error').textContent=error.message;container.querySelector('#desk-staged-count').textContent=error.message;}
  }
  queues.addEventListener('click',event=>{const button=event.target.closest('[data-desk-queue]');if(!button)return;activeQueue=button.dataset.deskQueue;filterForm.reset();queues.querySelectorAll('[data-desk-queue]').forEach(node=>node.setAttribute('aria-pressed',String(node===button)));renderCards();});
  quick.addEventListener('click',event=>{const button=event.target.closest('[data-desk-action]');if(button)stageFor(selected,term=>deskActionOperations(button.dataset.deskAction,term));});
  container.querySelector('#desk-stage-authorship').onclick=()=>{const value=container.querySelector('#desk-authorship').value;if(value)stageFor(selected,()=>[{field:'authorship',mode:'set',value},{field:'tags',mode:'add',value:'authorship_checked'}]);else container.querySelector('#review-error').textContent='Choose an authorship decision first.';};
  container.querySelector('#desk-stage-evidence').onclick=()=>{const value=container.querySelector('#desk-evidence').value;if(value)stageFor(selected,()=>[{field:'evidenceStrength',mode:'set',value},{field:'tags',mode:'add',value:'source_checked'}]);else container.querySelector('#review-error').textContent='Choose an evidence strength after inspecting the source.';};
  container.querySelector('#desk-clear-staged').onclick=()=>{clearPrepared();staged.clear();operations=[];renderCards();renderOperations();updateTray();};
  container.querySelector('#desk-preview').onclick=()=>container.querySelector('#review-preview-batch').click();
  container.querySelector('#desk-tray-stage').onclick=()=>stageFor(selected,term=>deskActionOperations(container.querySelector('#desk-tray-action').value,term));
  function renderCards(){
    const openRecords=new Set([...container.querySelectorAll('.review-card[data-review-id]')].filter(card=>card.querySelector('details[open]')).map(card=>card.dataset.reviewId));
    const matching=matches();
    container.querySelector('#review-count').textContent=`${matching.length} matching entries · ${selected.size} selected across the archive`;
    updateTray();
    const eligible=matching.filter(term=>term.stage!=='canon').length;
    container.querySelector('#review-select-matching').textContent=eligible>100?'Select first 100 matching':'Select all matching';
    container.querySelector('#review-cards').innerHTML=matching.length?matching.map(term=>{
      const review=reviewOf(term),canon=term.stage==='canon';
      return `<article data-review-id="${esc(term.id)}" class="review-card${selected.has(term.id)?' selected':''}"><div class="review-card-heading"><input type="checkbox" data-review-select="${esc(term.id)}" aria-label="Select ${esc(term.headword)} for a bulk change" ${selected.has(term.id)?'checked ':''}${canon?'disabled':''}><div><h3><a href="${link(term)}">${esc(term.headword)}</a></h3><p class="small-meta">${esc(label(term.stage))} · revision ${term.revision || '?'} · ${esc(label(term.classification))}</p></div><span class="review-state-badge">${staged.has(term.id)?'Staged · ':''}${esc(label(review.state))}</span></div><p>${esc(term.definition?term.definition.slice(0,220)+(term.definition.length>220?'…':''):'No established definition is recorded. This is a lexical seed, not a finished meaning.')}</p><div class="review-labels"><span>${esc(label(term.definitionStatus))}</span><span>Basis: ${esc(label(review.definitionBasis))}</span>${review.flags.map(flag=>`<span class="review-flag">${esc(label(flag))}</span>`).join('')}</div>${review.note||term.editorialReview?.shortReason?`<p class="review-reason">${esc(review.note||term.editorialReview.shortReason)}</p>`:''}<details><summary>Review checklist, definition &amp; sources</summary><fieldset class="desk-record-checklist"><legend>Stage a review marker</legend>${[['definition_checked','Definition checked'],['authorship_checked','Authorship examined'],['source_checked','Source evidence examined']].map(([tag,title])=>`<label><input type="checkbox" data-desk-check="${tag}" data-desk-record="${esc(term.id)}" ${stagedChecks(term,tag)?'checked':''} ${canon||(tag==='definition_checked'&&!hasWorkingDefinition(term))?'disabled':''}><span>${title}</span></label>`).join('')}<p>These markers record your examination. They do not change authorship, evidence strength, source history, or Canon.</p></fieldset><p>${esc(term.definition||'Definition awaiting development.')}</p>${term.analysis?`<div class="review-ai"><strong>AI proposal · provisional, needs author review</strong><p>${esc(term.analysis.formationProposal)}</p><p>${esc(term.analysis.interpretationProposal)}</p>${term.analysis.kind==='ai_hypothesis'&&term.analysis.interpretationProposal?.trim()&&term.analysis.interpretationProposal.trim()!==(term.definition||'').trim()?`<fieldset class="desk-record-checklist"><legend>Optional working interpretation</legend><label><input type="checkbox" data-desk-adopt="${esc(term.id)}" ${(staged.get(term.id)||[]).some(operation=>operation.field==='definition'&&operation.value===term.analysis.interpretationProposal.trim())?'checked':''} ${canon?'disabled':''}><span>Use this proposed reading as the working definition</span></label><p>Stages the exact text above as an inferred working definition. Your current wording remains in revision history after publication. This does not change authorship or approve Canon. Review the before/after comparison before owner approval.</p></fieldset>`:''}<p>${esc(term.analysis.distinctionQuestion)}</p><p class="small-meta">${esc(term.analysis.limitations)}</p></div>`:'<p class="small-meta">No public AI proposal is attached.</p>'}<p class="small-meta">Collections: ${esc((term.collections||[]).join(' · ')||'None')}<br>Tags: ${esc((term.tags||[]).join(' · ')||'None')}</p></details>${term.witnesses?.length?`<details class="desk-source-detail"><summary>${term.witnesses.length} approved public source summaries</summary>${term.witnesses.map(source=>`<p><strong>${esc(source.label)}</strong> · ${esc(label(source.evidence))}<br>${esc(source.summary||'No approved summary.')}</p>`).join('')}</details>`:''}<div class="review-card-actions">${staged.has(term.id)?`<button class="text-button" type="button" data-desk-cancel="${esc(term.id)}">Undo staged decisions</button>`:''}<a href="#author?term=${encodeURIComponent(term.slug)}">Edit this entry ↗</a>${canon?'<span class="small-meta">Canon requires individual exact approval.</span>':`<button class="text-button" type="button" data-quick-flag="${esc(term.id)}">Flag for author review</button>`}</div></article>`;
    }).join(''):'<div class="empty-state"><h2>No entries match these filters.</h2><p>Try another review state, evidence basis, or keyword.</p></div>';
    container.querySelectorAll('.review-card[data-review-id]').forEach(card=>{if(openRecords.has(card.dataset.reviewId))card.querySelector('details').open=true;});
  }
  function renderOperations(){
    container.querySelector('#bulk-operation-list').innerHTML=operations.length?`<ol class="bulk-operations">${operations.map((operation,index)=>`<li><span>${esc(label(operation.mode))} ${esc(label(operation.field.replace('review.','')))}: <strong>${esc(label(operation.value))}</strong></span><button type="button" class="text-button" data-remove-operation="${index}" aria-label="Remove operation ${index+1}">Remove</button></li>`).join('')}</ol>`:'<p class="small-meta">No operations added. Choose a field and a value above. Definition status describes the evidence, never Canon approval. Adding a review flag reopens the review; a later explicit state operation can resolve or defer it.</p>';
  }
  function valueControl(){
    const field=operationForm.elements.field.value,list=['tags','collections','domains','review.flags'].includes(field);
    operationForm.elements.mode.value=list?'add':'set';
    [...operationForm.elements.mode.options].forEach(option=>{option.disabled=list?option.value==='set':option.value!=='set';});
    const values=field==='review.flags'?REVIEW_FLAGS:field==='review.state'?states:field==='review.definitionBasis'?bases:field==='definitionStatus'?definitionStates:field==='classification'?classifications:field==='evidenceStrength'?evidenceStates:field==='stage'?['forge','lexicon']:null;
    const existing=field==='tags'?tags:field==='collections'?[...new Set(catalog.terms.flatMap(t=>t.collections||[]))]:field==='domains'?[...new Set(catalog.terms.flatMap(t=>t.domains||[]))]:[];
    container.querySelector('#bulk-value-control').innerHTML=values?`<label>Value<select name="value">${options(values)}</select></label>`:`<label>Public value<input name="value" maxlength="${field==='formation'?200:500}" required list="bulk-existing-values" placeholder="One value per operation"><datalist id="bulk-existing-values">${existing.map(value=>`<option value="${esc(value)}">`).join('')}</datalist></label>`;
  }
  filterForm.addEventListener('submit',event=>event.preventDefault());filterForm.addEventListener('input',renderCards);filterForm.addEventListener('change',renderCards);
  const selectionMessage=document.createElement('p');selectionMessage.className='small-meta';selectionMessage.id='review-selection-message';selectionMessage.setAttribute('role','status');container.querySelector('.review-selection-tools').after(selectionMessage);
  const goControls=document.createElement('button');goControls.type='button';goControls.className='text-button';goControls.textContent='Open bulk actions →';container.querySelector('.review-selection-tools>div').append(goControls);goControls.onclick=()=>{operationForm.elements.field.focus();container.querySelector('.bulk-controls').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
  container.querySelector('#review-select-matching').onclick=()=>{clearPrepared();const matching=matches().filter(term=>term.stage!=='canon');selected=new Set(matching.slice(0,100).map(term=>term.id));selectionMessage.textContent=matching.length>100?`Selected the first 100 of ${matching.length} matching editable entries, in alphabetical order. This replaces the previous selection. Narrow the filters to choose a different group.`:`Selected all ${matching.length} matching editable entries, replacing the previous selection.`;renderCards();};
  container.querySelector('#review-clear-selection').onclick=()=>{clearPrepared();selected.clear();selectionMessage.textContent='Selection cleared.';renderCards();};
  container.querySelector('#review-cards').addEventListener('change',event=>{const id=event.target.dataset.reviewSelect;if(!id)return;clearPrepared();if(event.target.checked&&selected.size>=100){selectionMessage.textContent='The 100-entry batch limit is reached. Deselect an entry before adding another.';}else{selectionMessage.textContent='';if(event.target.checked)selected.add(id);else selected.delete(id);}renderCards();[...container.querySelectorAll('[data-review-select]')].find(input=>input.dataset.reviewSelect===id)?.focus({preventScroll:true});});
  container.querySelector('#review-cards').addEventListener('change',event=>{const tag=event.target.dataset.deskCheck,id=event.target.dataset.deskRecord;if(!tag||!id)return;stageFor([id],()=>[{field:'tags',mode:event.target.checked?'add':'remove',value:tag}]);});
  container.querySelector('#review-cards').addEventListener('change',event=>{const id=event.target.dataset.deskAdopt;if(!id)return;if(event.target.checked)stageFor([id],term=>deskActionOperations('adopt_analysis',term).map(operation=>({...operation,origin:'adopt_analysis'})));else{clearPrepared();const pending=staged.get(id)||[];const remaining=pending.filter(operation=>operation.origin!=='adopt_analysis');if(remaining.length)staged.set(id,remaining);else staged.delete(id);renderCards();updateTray();}});
  container.querySelector('#review-cards').addEventListener('click',event=>{const button=event.target.closest('[data-desk-cancel]');if(!button)return;clearPrepared();staged.delete(button.dataset.deskCancel);renderCards();updateTray();});
  container.querySelector('#review-cards').addEventListener('click',event=>{const button=event.target.closest('[data-quick-flag]');if(!button)return;clearPrepared();selected=new Set([button.dataset.quickFlag]);operations=[{field:'review.flags',mode:'add',value:'author_decision'},{field:'review.state',mode:'set',value:'open'}];renderCards();renderOperations();container.querySelector('#review-preview-batch').focus();});
  operationForm.elements.field.addEventListener('change',valueControl);
  operationForm.addEventListener('submit',event=>{event.preventDefault();clearPrepared();const data=Object.fromEntries(new FormData(operationForm));operations.push({field:data.field,mode:data.mode,value:data.value});renderOperations();});
  container.querySelector('#bulk-operation-list').addEventListener('click',event=>{const button=event.target.closest('[data-remove-operation]');if(!button)return;clearPrepared();operations.splice(Number(button.dataset.removeOperation),1);renderOperations();});
  container.querySelector('#bulk-public-note').addEventListener('input',clearPrepared);
  container.querySelector('#review-preview-batch').onclick=()=>{
    clearPrepared();
    try{
      const planned=Object.fromEntries(staged);
      if(operations.length)for(const id of selected)planned[id]=[...(planned[id]||[]),...operations];
      if(!Object.keys(planned).length)throw new Error('Check a review item or stage an action for the selected records before publishing.');
      prepared=buildReviewBatch(catalog,Object.keys(planned),[],container.querySelector('#bulk-public-note').value,planned);
      const {request,proofs,unchanged}=prepared,preview=container.querySelector('#bulk-preview');preview.hidden=false;
      preview.innerHTML=`<p class="eyebrow">Atomic batch / ${proofs.length} public ${proofs.length===1?'entry':'entries'}</p><h2>Inspect every changed record.</h2><p class="muted">${JSON.stringify(request,null,2).length.toLocaleString()} / 60,000 prepared JSON characters. ${unchanged.length} selected ${unchanged.length===1?'entry was':'entries were'} unchanged and omitted. Each request checks its own current revision. Nothing has been applied.</p><div class="bulk-proofs">${proofs.map(({term,before,changes})=>`<details open><summary>${esc(term.headword)} · expected revision ${term.revision}</summary><div class="change-comparison"><div><h3>Before</h3><dl>${Object.entries(before).map(([field,value])=>`<dt>${esc(label(field))}</dt><dd>${esc(display(value))}</dd>`).join('')}</dl></div><div><h3>Proposed</h3><dl>${Object.entries(changes).map(([field,value])=>`<dt>${esc(label(field))}</dt><dd>${esc(display(value))}</dd>`).join('')}</dl></div></div></details>`).join('')}</div><details><summary>Inspect exact batch change_json</summary><textarea id="bulk-change-json" readonly rows="12" aria-label="Exact atomic batch JSON">${esc(JSON.stringify(request,null,2))}</textarea></details><label class="public-consent"><input type="checkbox" id="bulk-public-consent"><span>I reviewed these individual changes and intend this batch, including its public note and retained history, for publication.</span></label><label>Workflow fallback confirmation<input id="bulk-confirmation" autocomplete="off" placeholder="${esc(request.confirmBatch)}" aria-describedby="bulk-confirm-help"></label><p id="bulk-confirm-help" class="small-meta">For raw workflow fallback, type ${esc(request.confirmBatch)} exactly. The GitHub request route uses your final Submit new issue approval instead.</p><div class="author-publish-actions"><button class="button" type="button" id="bulk-copy-open">Copy batch &amp; open GitHub ↗</button><button class="button secondary" type="button" id="bulk-copy">Copy batch JSON</button><button class="text-button" type="button" id="bulk-download">Download batch JSON</button></div><p id="bulk-copy-status" class="small-meta" role="status">On GitHub, choose main → Run workflow → paste change_json. Leave commit unchecked for a preview; inspect it. Then run the same request with commit checked to publish.</p><p class="form-error" id="bulk-confirm-error" role="alert"></p>`;
      const handoff=createPublicationRequest(request);
      const handoffPanel=document.createElement('section');handoffPanel.className='desk-publication-handoff';handoffPanel.innerHTML=`<h3>${handoff.blocked?'Continue with the workflow':'Ready for the owner’s approval'}</h3><p>${handoff.blocked?esc(handoff.reason):'Continue to GitHub and inspect the prefilled request. Submit new issue is your final explicit public approval; the owner-only automation then validates, commits, and deploys it.'}</p><p class="small-meta">Staged here → owner approval on GitHub → successful validation and deployment. A staged or submitted request is not yet a saved publication.</p><button type="button" class="button" id="desk-continue-publish">${handoff.blocked?'Copy batch & open workflow ↗':'Continue to publish on GitHub ↗'}</button>`;preview.querySelector('.author-publish-actions').before(handoffPanel);
      const ready=(requirePhrase=true)=>{if(!container.querySelector('#bulk-public-consent').checked||(requirePhrase&&container.querySelector('#bulk-confirmation').value!==request.confirmBatch)){container.querySelector('#bulk-confirm-error').textContent=requirePhrase?`Confirm public consent and type “${request.confirmBatch}” exactly first.`:'Confirm that you reviewed these changes and intend them for publication before continuing to GitHub.';return false;}container.querySelector('#bulk-confirm-error').textContent='';return true;};
      const copy=async()=>{if(!ready())return false;try{await navigator.clipboard.writeText(JSON.stringify(request,null,2));container.querySelector('#bulk-copy-status').textContent='Batch copied. Preview on GitHub with commit unchecked, then check commit only when ready to publish.';return true;}catch{container.querySelector('#bulk-copy-status').textContent='Clipboard unavailable. Open the JSON details, select and copy the request, then use the GitHub workflow.';const textarea=container.querySelector('#bulk-change-json');textarea.parentElement.open=true;textarea.focus();textarea.select();return false;}};
      container.querySelector('#bulk-copy').onclick=copy;container.querySelector('#bulk-copy-open').onclick=async()=>{if(await copy())location.assign(workflow);};
      container.querySelector('#desk-continue-publish').onclick=async()=>{if(!ready(handoff.blocked))return;if(!handoff.blocked)location.assign(handoff.url);else if(await copy())location.assign(workflow);};
      container.querySelector('#bulk-download').onclick=()=>{if(!ready())return;const url=URL.createObjectURL(new Blob([JSON.stringify(request,null,2)],{type:'application/json'})),anchor=document.createElement('a');anchor.href=url;anchor.download='lexical-public-batch.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
      preview.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
    }catch(error){container.querySelector('#review-error').textContent=error.message;}
  };
  if(initialTerm)filterForm.elements.q.value=initialTerm.headword;
  valueControl();renderOperations();renderCards();
}
