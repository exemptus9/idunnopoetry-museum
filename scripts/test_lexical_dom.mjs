// Executes the actual application against its populated catalog in a DOM engine.
// This is behavior testing, not a claim of browser layout or screen-reader QA.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {JSDOM} from './dom-tests/node_modules/jsdom/lib/api.js';
import {hasWorkingDefinition, normalizeCatalog, searchTerms} from '../museum-static/observatory/model.js';

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
assertions.push('constellation render, full list, and zoom');
}

route('', '#laboratory');
assert.match(document.querySelector('#specimen').textContent, /smog/);
document.querySelector('#formation-specimen').value = 'derivation';
document.querySelector('#formation-specimen').dispatchEvent(new window.Event('change'));
assert.match(document.querySelector('#specimen').textContent, /kindness/);
assertions.push('formation laboratory interaction');

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

assert.deepEqual(failures, [], `Application errors: ${failures.join('; ')}`);
console.log(JSON.stringify({result: 'PASS', catalogTerms: raw.terms.length, flows: assertions}));
window.close();
