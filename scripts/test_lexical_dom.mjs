// Executes the actual application against its populated catalog in a DOM engine.
// This is behavior testing, not a claim of browser layout or screen-reader QA.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {JSDOM} from './dom-tests/node_modules/jsdom/lib/api.js';
import {hasWorkingDefinition, normalizeCatalog, searchTerms} from '../museum-static/observatory/model.js';
import {createPublicationRequest} from '../museum-static/observatory/public-request.js';

const site = new URL('../museum-static/observatory/', import.meta.url);
const raw = JSON.parse(fs.readFileSync(new URL('public.json', site), 'utf8'));
// Future editorial changes may add, withdraw, or redefine entries. Derive all
// expectations from the current release instead of freezing the initial count.
const catalog = normalizeCatalog(raw);
const target = catalog.terms.find(t => t.slug === 'suffralchemy') || catalog.terms.find(hasWorkingDefinition) || catalog.terms[0];
const working = catalog.terms.filter(hasWorkingDefinition).length;
const pending = catalog.terms.length - working;
const dom = new JSDOM(fs.readFileSync(new URL('index.html', site), 'utf8'), {
  url: 'https://exemptus9.github.io/idunnopoetry-museum/observatory/', pretendToBeVisual: true,
});
const {window} = dom;
for (const name of ['window', 'document', 'location', 'history', 'FormData', 'Event', 'MouseEvent', 'PopStateEvent']) {
  Object.defineProperty(globalThis, name, {value: name === 'window' ? window : window[name], configurable: true});
}
Object.defineProperty(globalThis, 'navigator', {value: window.navigator, configurable: true});
let copied = '';
Object.defineProperty(window.navigator, 'clipboard', {value: {writeText: async value => {copied = value;}}});
globalThis.scrollY = 0;
globalThis.matchMedia = () => ({matches: true, addEventListener() {}, removeEventListener() {}});
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
globalThis.fetch = async url => {
  const name = String(url).includes('history.json') ? 'history.json' : 'public.json';
  let text;
  try {text = fs.readFileSync(new URL(name, site), 'utf8');}
  catch {text = JSON.stringify({schemaVersion: 1, events: []});}
  return new Response(text, {status: 200, headers: {'content-type': 'application/json'}});
};
const failures = [];
window.addEventListener('error', event => failures.push(event.error?.message || event.message));
await import('../museum-static/observatory/app.js');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
await tick();
const document = window.document;
function route(search, hash) {
  history.pushState({}, '', `https://exemptus9.github.io/idunnopoetry-museum/observatory/${search}${hash}`);
  window.dispatchEvent(new window.PopStateEvent('popstate'));
}
function click(selector) {
  const node = document.querySelector(selector);
  assert.ok(node, `Missing ${selector}`);
  node.dispatchEvent(new window.MouseEvent('click', {bubbles: true, button: 0}));
}
const assertions = [];
if (working) assert.ok(document.querySelector('.word-card'), 'Home must feature a real defined entry');
assert.ok(document.querySelector('.collection-overview').textContent.includes(`${working} working definitions`));
assert.ok(document.querySelector('.collection-overview').textContent.includes(`${pending} candidates awaiting definition`));
assertions.push('populated home and truthful definition counts');

route('', '#archive');
assert.ok(document.querySelector('.results-heading').textContent.includes(`${catalog.terms.length} public entr`));
if (target) {
const search = document.querySelector('#search-form');
search.elements.q.value = target.headword;
search.dispatchEvent(new window.Event('submit', {bubbles: true, cancelable: true}));
assert.ok(document.querySelector('#app').textContent.includes(target.headword));
assert.ok(document.querySelector('.results-heading').textContent.includes(`${searchTerms(catalog,{q:target.headword}).length} public entr`));
assertions.push('actual search form and current catalog matches');
}

route('', '#archive?definitionState=pending');
assert.ok(document.querySelector('.results-heading').textContent.includes(`${pending} public entr`));
route('', '#archive?stage=lexicon');
assert.ok(document.querySelector('.results-heading').textContent.includes(`${catalog.terms.filter(t=>t.stage==='lexicon').length} public entr`));
assertions.push('pending and Lexicon filters');

if (target) {
route(`?term=${target.slug}`, '');
assert.equal(document.querySelector('#app h1').textContent, target.headword);
assert.ok(document.querySelector('#app').textContent.includes(target.definition));
if(target.analysis) assert.ok(document.querySelector('.ai-proposal details'));
if(catalog.relations.some(r=>r.from===target.id||r.to===target.id)) assert.ok(document.querySelectorAll('.relationship-list a').length > 0);
assert.ok(document.querySelectorAll('.timeline li').length >= catalog.versions.filter(v=>v.termId===target.id).length);
click('[data-action="copy-definition"]');
await tick();
assert.ok(copied.startsWith(`${target.headword}:`));
assertions.push('direct term genome, relationships, archaeology, and copy');
}

route('', '#constellation');
if (target) {
assert.equal(document.querySelectorAll('#graph svg a').length, Math.min(catalog.terms.length,80));
assert.ok(document.querySelector('#graph-list').textContent.includes(target.headword));
click('[data-graph="in"]');
const remoteTerm=catalog.terms.at(-1);
if(catalog.terms.length>80){
  const graphSearch=document.querySelector('#graph-search');graphSearch.value=remoteTerm.headword;
  graphSearch.dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.ok([...document.querySelectorAll('#graph .graph-node text')].some(node=>node.textContent===remoteTerm.headword),'Search must bring a term beyond the initial 80 into the visual.');
}
assertions.push('constellation render, full directory, zoom and search beyond the initial visual limit');
}

route('', '#laboratory');
assert.match(document.querySelector('#specimen').textContent, /smog/);
document.querySelector('#formation-specimen').value = 'derivation';
document.querySelector('#formation-specimen').dispatchEvent(new window.Event('change'));
assert.match(document.querySelector('#specimen').textContent, /kindness/);
assertions.push('formation laboratory interaction');
assert.ok(document.querySelector('#blend-form'),'The real interactive blend bench must mount on the laboratory route.');
assert.ok(document.querySelectorAll('.blend-candidate').length>0);
click('#road-toggle');
route('', '#home'); // Replacing the laboratory must release its running clock.

if (target) {
route('', `#author?term=${target.slug}`);
const form = document.querySelector('#author-form');
assert.equal(form.elements.headword.value, target.headword);
form.elements.definition.value += ' Temporary DOM integration test.';
form.elements.confirmPublication.value = `PUBLISH ${target.headword}`;
if(target.stage==='canon') form.elements.canonConfirmation.value=`APPROVE CANON ${target.headword}`;
form.elements.publicConsent.checked = true;
form.dispatchEvent(new window.Event('submit', {bubbles: true, cancelable: true}));
const prepared = document.querySelector('#prepared-change');
assert.ok(prepared, document.querySelector('#author-error').textContent);
const change = JSON.parse(prepared.value);
assert.equal(change.action, 'update');
assert.equal(change.id, target.id);
assert.equal(change.expectedRevision, target.revision);
assert.ok(change.changes.definition.includes('Temporary DOM integration test.'));
assert.equal(change.canonConfirmation, target.stage==='canon'?`APPROVE CANON ${target.headword}`:undefined);
click('#copy-public-change');
await tick();
assert.equal(JSON.parse(copied).id, target.id);
assert.match(document.querySelector('.author-instructions').textContent, /commit checked/);
// Cross the actual JavaScript/Python contract without writing any publication.
// This simulates the trusted workflow context; it does not impersonate a live
// authenticated GitHub run or claim that the workflow was dispatched.
const controller = spawnSync('python3', ['-c', `
import json,sys
from pathlib import Path
sys.path.insert(0,'scripts')
from lexical_editor import apply_change
p=Path('museum-static/observatory')
catalog=json.loads((p/'public.json').read_text())
history=json.loads((p/'history.json').read_text())
after,ledger=apply_change(catalog,history,json.load(sys.stdin),actor='exemptus9',repository='exemptus9/idunnopoetry-museum')
print(json.dumps({'terms':len(after['terms']),'revision':ledger['events'][-1]['revision']}))
`], {cwd: new URL('../', import.meta.url), input: JSON.stringify(change), encoding:'utf8'});
assert.equal(controller.status,0,controller.stderr);
assert.deepEqual(JSON.parse(controller.stdout),{terms:catalog.terms.length,revision:target.revision+1});
assertions.push('public edit preparation, clipboard, and actual Python publication contract (dry run)');
}

if (catalog.relations.length) {
  const relationForm = document.querySelector('#relationship-review-form');
  relationForm.elements.relationIndex.value='0';
  relationForm.elements.relationIndex.dispatchEvent(new window.Event('change'));
  relationForm.elements.relationConsent.checked=true;
  relationForm.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  assert.match(document.querySelector('#relation-error').textContent,/Load the current/);
  assert.equal(document.querySelector('#prepared-relation'),null);
  click('#load-relation-history');await tick();await tick();
  const events=JSON.parse(fs.readFileSync(new URL('history.json',site),'utf8')).events;
  const expectedRevision=events.filter(e=>e.action==='relation_review').length;
  assert.equal(Number(relationForm.elements.relationRevision.value),expectedRevision);
  for(const status of ['confirmed','rejected']) {
    relationForm.elements.relationStatus.value=status;
    relationForm.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
    const change=JSON.parse(document.querySelector('#prepared-relation').value);
    assert.equal(change.action,'relation_review');assert.equal(change.expectedRevision,expectedRevision);
    assert.equal(change.relation.source,catalog.relations[0].from);assert.equal(change.relation.status,status);
    click('#copy-relation');await tick();assert.deepEqual(JSON.parse(copied),change);
    assert.match(document.querySelector('#relation-copy-status').textContent,/check commit/);
    const result=spawnSync('python3',['-c',`
import json,sys
from pathlib import Path
sys.path.insert(0,'scripts')
from lexical_editor import apply_change
p=Path('museum-static/observatory')
c=json.loads((p/'public.json').read_text());h=json.loads((p/'history.json').read_text())
request=json.load(sys.stdin)
after,ledger=apply_change(c,h,request,actor='exemptus9',repository='exemptus9/idunnopoetry-museum')
print(json.dumps({'relations':len(after['relations']),'status':ledger['events'][-1]['snapshot']['relation']['status']}))
`],{cwd:new URL('../',import.meta.url),input:JSON.stringify(change),encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    assert.deepEqual(JSON.parse(result.stdout),{relations:catalog.relations.length-(status==='rejected'?1:0),status});
  }
  assertions.push('relationship review requires real revision load, confirms/rejects, and validates through controller');
}

if (catalog.terms.filter(t=>t.stage!=='canon').length >= 2) {
  const reviewTarget=target.stage==='canon'?catalog.terms.find(t=>t.stage!=='canon'):target;
  route('',`#review?term=${reviewTarget.slug}`);
  assert.match(document.querySelector('meta[name="robots"]').content,/noindex/);
  assert.ok(document.querySelector('#review-count').textContent.includes('1 selected'));
  const filters=document.querySelector('#review-filters');
  filters.elements.q.value='';filters.dispatchEvent(new window.Event('input',{bubbles:true}));
  click('#review-select-matching');
  assert.equal(document.querySelectorAll('[data-review-select]:checked').length,Math.min(100,catalog.terms.filter(t=>t.stage!=='canon').length));
  click('#review-clear-selection');
  const ids=catalog.terms.filter(t=>t.stage!=='canon').slice(0,2).map(t=>t.id);
  for(const id of ids){const input=[...document.querySelectorAll('[data-review-select]')].find(n=>n.dataset.reviewSelect===id);input.checked=true;input.dispatchEvent(new window.Event('change',{bubbles:true}));}
  const operations=document.querySelector('#bulk-operation-form');
  operations.elements.field.value='tags';operations.elements.field.dispatchEvent(new window.Event('change'));
  operations.elements.value.value='dom-integration-test-only';
  operations.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  click('#review-preview-batch');
  const prepared=document.querySelector('#bulk-change-json');assert.ok(prepared,document.querySelector('#review-error').textContent);
  const request=JSON.parse(prepared.value);
  assert.equal(request.changes.length,2);assert.deepEqual(request.changes.map(r=>r.id),ids);
  for(const row of request.changes){const before=catalog.terms.find(t=>t.id===row.id);assert.equal(row.expectedRevision,before.revision);assert.deepEqual(row.changes.tags,[...before.tags,'dom-integration-test-only']);assert.ok(!Object.hasOwn(row.changes,'review'));}
  click('#bulk-copy');await tick();assert.match(document.querySelector('#bulk-confirm-error').textContent,/Confirm public consent/);
  document.querySelector('#bulk-public-consent').checked=true;document.querySelector('#bulk-confirmation').value=request.confirmBatch;
  click('#bulk-copy');await tick();assert.deepEqual(JSON.parse(copied),request);
  const checked=spawnSync('python3',['-c',`
import json,sys
from pathlib import Path
sys.path.insert(0,'scripts')
from lexical_editor import apply_change
p=Path('museum-static/observatory');before=(p/'public.json').read_bytes()
c=json.loads(before);h=json.loads((p/'history.json').read_text());r=json.load(sys.stdin)
after,ledger=apply_change(c,h,r,actor='exemptus9',repository='exemptus9/idunnopoetry-museum')
assert all('dom-integration-test-only' in next(t for t in after['terms'] if t['id']==row['id'])['tags'] for row in r['changes'])
assert (p/'public.json').read_bytes()==before
print(json.dumps({'action':ledger['events'][-1]['action'],'changes':ledger['events'][-1]['snapshot']['changes']}))
`],{cwd:new URL('../',import.meta.url),input:JSON.stringify(request),encoding:'utf8'});
  assert.equal(checked.status,0,checked.stderr);assert.deepEqual(JSON.parse(checked.stdout),{action:'batch',changes:2});
  assertions.push('bulk deep-link, bounded filtered selection, consent, safe array preservation and actual atomic controller contract');
}

const checklistTerms=catalog.terms.filter(term=>term.stage!=='canon'&&hasWorkingDefinition(term)).slice(0,2);
if(checklistTerms.length===2){
  route('', '#review');
  for(const term of checklistTerms){
    const input=[...document.querySelectorAll('[data-desk-check="definition_checked"]')].find(node=>node.dataset.deskRecord===term.id);
    assert.ok(input&&!input.disabled,'A developed non-Canon term must expose its review checklist.');
    input.checked=!input.checked;
    input.dispatchEvent(new window.Event('change',{bubbles:true}));
  }
  assert.match(document.querySelector('#desk-staged-count').textContent,/2 records/);
  click('#desk-preview');
  const prepared=document.querySelector('#bulk-change-json');assert.ok(prepared,document.querySelector('#review-error').textContent);
  const request=JSON.parse(prepared.value);
  assert.equal(request.changes.length,2);
  for(const row of request.changes){
    const term=checklistTerms.find(t=>t.id===row.id);assert.ok(term);
    assert.equal(row.expectedRevision,term.revision);
    assert.equal(row.changes.tags.includes('definition_checked'),!term.tags.includes('definition_checked'));
    for(const field of ['authorship','evidenceStrength','definitionStatus','stage','review'])assert.ok(!Object.hasOwn(row.changes,field));
  }
  assert.ok(document.querySelector('#desk-continue-publish'));
  click('#desk-continue-publish');
  assert.match(document.querySelector('#bulk-confirm-error').textContent,/Confirm.*reviewed.*publication/);
  const handoff=createPublicationRequest(request);assert.equal(handoff.blocked,false);
  const url=new URL(handoff.url);
  assert.equal(url.origin,'https://github.com');
  const issue={action:'opened',repository:{full_name:'exemptus9/idunnopoetry-museum',private:false},sender:{login:'exemptus9'},
    issue:{number:123,state:'open',user:{login:'exemptus9'},title:url.searchParams.get('title'),body:url.searchParams.get('body')}};
  const bridge=spawnSync('python3',['-c',`
import json,sys
from pathlib import Path
sys.path.insert(0,'scripts')
from lexical_issue import apply_issue
from lexical_editor import verify_history
p=Path('museum-static/observatory');original=(p/'public.json').read_bytes()
c=json.loads(original);h=json.loads((p/'history.json').read_text());event=json.load(sys.stdin)
after,ledger,summary=apply_issue(c,h,event,actor='exemptus9',repository='exemptus9/idunnopoetry-museum',event_name='issues',ref='refs/heads/main')
request=json.loads(event['issue']['body'].split('\x60\x60\x60json\\n',1)[1].rsplit('\\n\x60\x60\x60',1)[0])
for row in request['changes']:
 previous=next(t for t in c['terms'] if t['id']==row['id'])
 current=next(t for t in after['terms'] if t['id']==row['id'])
 assert ('definition_checked' in current['tags']) != ('definition_checked' in previous['tags'])
 assert current['revision']==previous['revision']+1
verify_history(ledger)
assert (p/'public.json').read_bytes()==original
print(json.dumps({'issueNumber':summary['issueNumber'],'changes':ledger['events'][-1]['snapshot']['changes']}))
`],{cwd:new URL('../',import.meta.url),input:JSON.stringify(issue),encoding:'utf8'});
  assert.equal(bridge.status,0,bridge.stderr);assert.deepEqual(JSON.parse(bridge.stdout),{issueNumber:123,changes:2});
  assertions.push('two-record checklist stages review-only changes and its decoded GitHub issue handoff applies through the real owner bridge/controller in memory');
}

assert.deepEqual(failures, [], `Application errors: ${failures.join('; ')}`);
console.log(JSON.stringify({result: 'PASS', catalogTerms: raw.terms.length, flows: assertions}));
window.close();
