import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCatalog} from '../museum-static/observatory/model.js';
import {buildReviewBatch,filterReviewTerms} from '../museum-static/observatory/review.js';

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
