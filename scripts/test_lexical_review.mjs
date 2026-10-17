import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCatalog} from '../museum-static/observatory/model.js';
import {buildReviewBatch,filterReviewTerms,deskActionOperations} from '../museum-static/observatory/review.js';
import {createPublicationRequest,PUBLIC_REQUEST_PREFIX,PUBLIC_REQUEST_TITLE} from '../museum-static/observatory/public-request.js';

const row=(id,extra={})=>({id,slug:`entry-${id}`,headword:`Example ${id}`,visibility:'approved_public',revision:3,stage:'forge',definition:'A developed illustrative meaning.',definitionStatus:'working_definition',classification:'coinage_candidate',formation:'blend',tags:['existing'],collections:['Collection one'],domains:['Language'],review:{state:'open',flags:['source_needed'],definitionBasis:'conversation_recovered',note:'A public review reason.'},...extra});
const catalog=(rows=[row('a'),row('b')])=>normalizeCatalog({terms:rows,relations:[],versions:[]});
const op=(field,value,mode='set')=>({field,value,mode});

test('bulk union/removal preserves arrays, unchanged fields, and public review metadata',()=>{
  const c=catalog(),original=JSON.stringify(c);
  const result=buildReviewBatch(c,['a'],[op('tags','new','add'),op('collections','Collection one','remove'),op('domains','Cognition','add')]);
  const changes=result.request.changes[0].changes;
  assert.deepEqual(changes.tags,['existing','new']);assert.deepEqual(changes.collections,[]);assert.deepEqual(changes.domains,['Language','Cognition']);
  assert.ok(!Object.hasOwn(changes,'review'));assert.ok(!Object.hasOwn(changes,'definition'));assert.ok(!Object.hasOwn(changes,'formation'));assert.equal(JSON.stringify(c),original);
});
test('only selected changed entries are included with per-record revisions',()=>{
  const result=buildReviewBatch(catalog(),['b'],[op('classification','concept_label')],'A public note');
  assert.equal(result.request.action,'batch');assert.equal(result.request.confirmBatch,'APPLY 1 PUBLIC CHANGES');assert.equal(result.request.publicNote,'A public note');
  assert.equal(result.request.changes.length,1);assert.equal(result.request.changes[0].id,'b');assert.equal(result.request.changes[0].expectedRevision,3);assert.equal(result.request.changes[0].confirmPublication,'PUBLISH Example b');
});
test('idempotent operations omit unchanged entries and never duplicate list values',()=>{
  assert.throws(()=>buildReviewBatch(catalog(),['a'],[op('tags','existing','add')]),/no changes/);
  const c=catalog([row('a'),row('b',{tags:['existing','new']})]);
  const result=buildReviewBatch(c,['a','b'],[op('tags','new','add')]);assert.deepEqual(result.unchanged,['Example b']);assert.equal(result.request.changes.length,1);
});
test('adding a review flag reopens resolved reviews and preserves note/basis',()=>{
  const c=catalog([row('a',{review:{state:'resolved',flags:['source_needed'],definitionBasis:'archive_recovered',note:'Keep this public note.'}})]);
  const review=buildReviewBatch(c,['a'],[op('review.flags','author_decision','add')]).request.changes[0].changes.review;
  assert.equal(review.state,'open');assert.deepEqual(review.flags,['source_needed','author_decision']);assert.equal(review.definitionBasis,'archive_recovered');assert.equal(review.note,'Keep this public note.');
  const deferred=buildReviewBatch(c,['a'],[op('review.flags','author_decision','add'),op('review.state','deferred')]).request.changes[0].changes.review;assert.equal(deferred.state,'deferred');
});
test('Canon entries are blocked even when the requested field is only a tag',()=>{
  const c=catalog([row('a',{stage:'canon',canonApproval:{revision:3,approvedAt:'2026-10-16'}})]);
  assert.throws(()=>buildReviewBatch(c,['a'],[op('tags','new','add')]),/Canon/);
});
test('record-count and workflow transport limits reject oversized atomic batches',()=>{
  assert.throws(()=>buildReviewBatch(catalog(),Array.from({length:101},(_,i)=>String(i)),[op('tags','new','add')]),/100 entries/);
  const rows=Array.from({length:100},(_,i)=>row(String(i),{tags:Array.from({length:15},(_,n)=>`tag-${n}-${'x'.repeat(55)}`)}));
  assert.throws(()=>buildReviewBatch(catalog(rows),rows.map(r=>r.id),[op('tags','new','add')]),/transport|150 KB/);
});
test('review filters combine without changing metadata or selecting unrelated records',()=>{
  const c=catalog([row('a'),row('b',{classification:'expression',review:{state:'deferred',flags:['author_decision'],definitionBasis:'inferred',note:'Different public reason.'}})]),before=JSON.stringify(c);
  const rows=filterReviewTerms(c,{q:'example',stage:'forge',classification:'expression',reviewState:'deferred',reviewFlag:'author_decision',definitionBasis:'inferred',tag:'existing'});
  assert.deepEqual(rows.map(r=>r.id),['b']);assert.equal(JSON.stringify(c),before);
});
test('definition-status bulk changes remain separate from Canon and respect Lexicon maturity',()=>{
  const c=catalog([row('a',{stage:'lexicon'})]);
  assert.throws(()=>buildReviewBatch(c,['a'],[op('definitionStatus','awaiting_definition')]),/cannot remain in Lexicon/);
  const result=buildReviewBatch(c,['a'],[op('definitionStatus','awaiting_definition'),op('stage','forge')]);
  assert.deepEqual(result.request.changes[0].changes,{stage:'forge',definitionStatus:'awaiting_definition'});
  const recovered=buildReviewBatch(c,['a'],[op('definitionStatus','conversation_recovered')]);assert.equal(recovered.request.changes[0].changes.definitionStatus,'conversation_recovered');assert.ok(!Object.hasOwn(recovered.request.changes[0],'canonConfirmation'));
});
test('unsupported review operations and missing selections fail before generating a request',()=>{
  assert.throws(()=>buildReviewBatch(catalog(),[],[op('tags','new','add')]),/Select at least/);
  assert.throws(()=>buildReviewBatch(catalog(),['a'],[op('privateNotes','bad')]),/not supported/);
  assert.throws(()=>buildReviewBatch(catalog(),['a'],[op('review.flags','invented_flag','add')]),/supported review flag/);
});
test('checklist actions preserve uncertainty and never fabricate authorship or Canon approval',()=>{
  const c=catalog(),term=c.terms[0];
  const result=buildReviewBatch(c,['a'],deskActionOperations('definition_checked',term));
  assert.deepEqual(result.request.changes[0].changes,{tags:['existing','definition_checked']});
  assert.ok(!Object.hasOwn(result.request.changes[0].changes,'definitionStatus'));assert.ok(!Object.hasOwn(result.request.changes[0].changes,'authorship'));assert.ok(!Object.hasOwn(result.request.changes[0].changes,'evidenceStrength'));
  assert.throws(()=>deskActionOperations('recovered',{...term,review:{...term.review,definitionBasis:'inferred'}}),/no recovered source basis/);
  const recovered=buildReviewBatch(c,['a'],deskActionOperations('recovered',term));assert.equal(recovered.request.changes[0].changes.definitionStatus,'conversation_recovered');
});
test('different per-record checklist decisions merge into one atomic batch without crossing records',()=>{
  const c=catalog();
  const result=buildReviewBatch(c,['a','b'],[],'A public checklist batch',{a:deskActionOperations('definition_checked',c.terms[0]),b:deskActionOperations('resolve',c.terms[1])});
  assert.deepEqual(result.request.changes[0].changes,{tags:['existing','definition_checked']});
  assert.equal(result.request.changes[1].changes.review.state,'resolved');assert.ok(!Object.hasOwn(result.request.changes[1].changes,'tags'));
  assert.equal(result.request.confirmBatch,'APPLY 2 PUBLIC CHANGES');
});
test('explicit authorship and evidence assessments use existing supported public fields only',()=>{
  const result=buildReviewBatch(catalog(),['a'],[op('authorship','Created by the author (author confirmed)'),op('evidenceStrength','supported')]);
  assert.equal(result.request.changes[0].changes.authorship,'Created by the author (author confirmed)');assert.equal(result.request.changes[0].changes.evidenceStrength,'supported');assert.ok(!Object.hasOwn(result.request.changes[0].changes,'canonApproval'));
  assert.throws(()=>buildReviewBatch(catalog(),['a'],[op('evidenceStrength','99% original')]),/qualitative|supported/);
});
test('actionable desk queues use actual evidence/review metadata and preserve source records',()=>{
  const c=catalog([row('a'),row('b',{definition:'',definitionStatus:'awaiting_definition',authorship:'Origin undetermined',review:{state:'deferred',flags:['attribution_review'],definitionBasis:'inferred',note:''}})]);
  assert.deepEqual(filterReviewTerms(c,{queue:'definitions'}).map(term=>term.id),['b']);
  assert.deepEqual(filterReviewTerms(c,{queue:'sources'}).map(term=>term.id),['a']);
  assert.deepEqual(filterReviewTerms(c,{queue:'inferred'}).map(term=>term.id),['b']);
  assert.deepEqual(filterReviewTerms(c,{queue:'open'}).map(term=>term.id),['a']);
});
test('publication request uses exact owner-approval marker/title with one encoding pass and no credentials',()=>{
  const request={action:'update',id:'a',expectedRevision:3,changes:{definition:'A & B + C?'},confirmPublication:'PUBLISH Example a'};
  const handoff=createPublicationRequest(request);assert.equal(handoff.blocked,false);
  const url=new URL(handoff.url);assert.equal(url.origin,'https://github.com');assert.equal(url.pathname,'/exemptus9/idunnopoetry-museum/issues/new');assert.equal(url.searchParams.get('title'),PUBLIC_REQUEST_TITLE);
  const body=url.searchParams.get('body');assert.ok(body.startsWith(PUBLIC_REQUEST_PREFIX));assert.ok(body.endsWith('```\n'));assert.ok(body.includes('A & B + C?'));assert.equal(url.username,'');assert.equal(url.password,'');
});
test('large issue handoffs fall back to the authenticated workflow rather than a truncated request',()=>{
  const result=createPublicationRequest({action:'batch',publicNote:'x'.repeat(6000)});assert.equal(result.blocked,true);assert.equal(result.url,'');assert.ok(result.workflowUrl.endsWith('/lexical-editor.yml'));assert.ok(result.encodedLength>6000);
});
test('adopting a proposed reading is an explicit inferred definition change with preserved identity and source history',()=>{
  const proposal='A provisional reading that describes the space between an idea and its linguistic form.';
  const c=catalog([row('a',{analysis:{kind:'ai_hypothesis',interpretationProposal:proposal,limitations:'Creative hypothesis only.'},review:{state:'deferred',flags:['definition_needed','source_needed'],definitionBasis:'unknown',note:'Preserve this public source question.'}})]),before=JSON.stringify(c);
  const result=buildReviewBatch(c,['a'],deskActionOperations('adopt_analysis',c.terms[0]));
  const changes=result.request.changes[0].changes;
  assert.equal(changes.definition,proposal);assert.equal(changes.definitionStatus,'inferred_definition');assert.equal(changes.review.definitionBasis,'inferred');assert.equal(changes.review.state,'open');
  assert.ok(!changes.review.flags.includes('definition_needed'));assert.ok(changes.review.flags.includes('meaning_inferred'));assert.ok(changes.review.flags.includes('author_decision'));assert.ok(changes.review.flags.includes('source_needed'));assert.equal(changes.review.note,'Preserve this public source question.');
  for(const field of ['authorship','classification','stage','evidenceStrength'])assert.ok(!Object.hasOwn(changes,field));
  assert.equal(result.proofs[0].before.definition,c.terms[0].definition);assert.equal(JSON.stringify(c),before);assert.equal(result.request.changes[0].expectedRevision,3);
});
test('proposed-reading adoption requires a distinct explicitly hypothetical proposal and excludes Canon',()=>{
  const term=catalog().terms[0];
  assert.throws(()=>deskActionOperations('adopt_analysis',term),/no distinct/);
  assert.throws(()=>deskActionOperations('adopt_analysis',{...term,analysis:{kind:'ai_hypothesis',interpretationProposal:term.definition}}),/no distinct/);
  assert.throws(()=>deskActionOperations('adopt_analysis',{...term,analysis:{kind:'unverified_import',interpretationProposal:'Something else'}}),/no distinct/);
  assert.throws(()=>deskActionOperations('adopt_analysis',{...term,stage:'canon',analysis:{kind:'ai_hypothesis',interpretationProposal:'Something else'}}),/Canon/);
});
test('a Lexicon entry can retain its stage while a proposed reading remains explicitly inferred',()=>{
  const c=catalog([row('a',{stage:'lexicon',analysis:{kind:'ai_hypothesis',interpretationProposal:'An alternative provisional definition.'}})]);
  const result=buildReviewBatch(c,['a'],deskActionOperations('adopt_analysis',c.terms[0]));assert.equal(result.request.changes[0].changes.definitionStatus,'inferred_definition');assert.ok(!Object.hasOwn(result.request.changes[0].changes,'stage'));
});
