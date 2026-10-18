// Executes real lookup controls in a DOM engine. This verifies behavior and
// markup contracts; it does not certify visual layout or screen-reader output.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from './dom-tests/node_modules/jsdom/lib/api.js';
import {normalizeCatalog} from '../museum-static/observatory/model.js';

const site = new URL('../museum-static/observatory/', import.meta.url);
const base = 'https://exemptus9.github.io/idunnopoetry-museum/observatory/';
const raw = JSON.parse(fs.readFileSync(new URL('public.json', site), 'utf8'));
const catalog = normalizeCatalog(raw);
assert.ok(catalog.terms.length, 'The integration fixture must be the populated public release.');
const target = catalog.terms.find(t => t.slug === 'suffralchemy') || catalog.terms.find(t => t.definition) || catalog.terms[0];
const checks = [];
const errors = [];
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function install(dom) {
  const {window} = dom;
  for (const key of ['window', 'document', 'location', 'history', 'FormData', 'Event', 'MouseEvent', 'PopStateEvent', 'KeyboardEvent', 'InputEvent', 'CompositionEvent', 'HTMLElement', 'Element', 'Node']) {
    Object.defineProperty(globalThis, key, {value: key === 'window' ? window : window[key], configurable: true});
  }
  Object.defineProperty(globalThis, 'navigator', {value: window.navigator, configurable: true});
  globalThis.scrollY = 0;
  globalThis.matchMedia = () => ({matches: true, addEventListener() {}, removeEventListener() {}});
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.addEventListener('error', event => errors.push(event.error?.message || event.message));
  return window;
}
function click(node) {
  assert.ok(node, 'Required click target exists.');
  const event = new window.MouseEvent('click', {bubbles: true, cancelable: true, button: 0});
  node.dispatchEvent(event);
  return event;
}
function type(input, value, extra = {}) {
  input.value = value;
  input.dispatchEvent(new window.InputEvent('input', {bubbles: true, inputType: 'insertText', ...extra}));
}
function key(node, value, extra = {}) {
  const event = new window.KeyboardEvent('keydown', {key: value, bubbles: true, cancelable: true, ...extra});
  node.dispatchEvent(event);
  return event;
}
function route(hash, search = '') {
  history.pushState({}, '', `${base}${search}${hash}`);
  window.dispatchEvent(new window.PopStateEvent('popstate'));
}
const options = root => [...root.querySelectorAll('[data-search-option]')];
const popup = root => root.querySelector('[data-search-popup]');
const opened = root => root.querySelector('[data-search-input]').getAttribute('aria-expanded') === 'true';

// Delay the actual application fetch so the public loading state is exercised.
let window = install(new JSDOM(fs.readFileSync(new URL('index.html', site), 'utf8'), {url: base, pretendToBeVisual: true}));
const lookupStyle = document.createElement('style');
lookupStyle.textContent = fs.readFileSync(new URL('search.css', site), 'utf8');
document.head.append(lookupStyle);
const fallbackInput=document.querySelector('#site-lookup input[type="search"]');
assert.ok(fallbackInput,'A search field is available in initial HTML before JavaScript starts.');
fallbackInput.value=target.headword;
fallbackInput.focus();
let publicFetches = 0, releaseCatalog;
globalThis.fetch = async url => {
  assert.ok(String(url).includes('public.json'), 'A lookup must not fetch raw/private sources.');
  publicFetches++;
  return new Promise(resolve => {releaseCatalog = () => resolve(new Response(JSON.stringify(raw), {status: 200, headers: {'content-type': 'application/json'}}));});
};
await import('../museum-static/observatory/app.js');
await tick();
let form = document.querySelector('[data-instant-search]');
assert.ok(form, 'Global lookup is present before loading finishes.');
let input = form.querySelector('[data-search-input]');
assert.ok(input && !input.hidden && input.type === 'search', 'The lookup is a visible, direct text entry field.');
assert.equal(input.value,target.headword,'Initial interactive mounting preserves text entered in the HTML fallback.');
assert.equal(document.activeElement,input,'Initial interactive mounting preserves focus from the HTML fallback.');
checks.push('initial HTML search accepts text before JavaScript and preserves its text and focus on mount');
click(form.querySelector('[data-search-clear]'));
assert.equal(window.getComputedStyle(form.querySelector('[data-search-clear]')).display, 'none', 'The blank-query clear button obeys its hidden state despite custom display styles.');
input.focus();
type(input, target.headword);
assert.match(form.textContent, /loading|connecting|opening/i, 'Loading is explained rather than falsely reporting no match.');
assert.equal(publicFetches, 1);
releaseCatalog(); await tick(); await tick();
assert.equal(document.querySelector('[data-search-input]'), input, 'Catalog refresh must preserve the input node.');
assert.equal(document.activeElement, input, 'Catalog refresh must preserve typing focus.');
assert.equal(input.value, target.headword, 'Catalog refresh must preserve typed text.');
assert.equal(options(form)[0]?.textContent.includes(target.headword), true, 'Loaded results appear for text entered while loading.');
checks.push('lookup visible during loading and typed query/focus survive catalog arrival');

const originalInput = input;
for (const hash of ['#home', `#archive?q=${encodeURIComponent(target.headword)}`, '#constellation', '#evolution', '#laboratory', '#methodology', '#author', '#review']) {
  input.focus();
  route(hash);
  assert.equal(document.querySelector('[data-search-input]'), originalInput, `${hash} retains the persistent lookup node.`);
  assert.equal(document.activeElement, originalInput, `${hash} retains an already-focused lookup.`);
  assert.equal(originalInput.value, target.headword, `${hash} retains the query.`);
}
route('#archive');
assert.equal(document.querySelector('[data-search-input]'),originalInput,'Browse-all keeps the existing primary lookup node.');
assert.equal(originalInput.value,'','An explicit browse-all route clears the old query.');
assert.match(document.querySelector('#archive-result-count').textContent,new RegExp(`^${catalog.terms.length} public entr`),'Browse-all restores the complete approved collection.');
checks.push('explicit browse-all clears stale query text and restores the complete collection');
route('', `?term=${encodeURIComponent(target.slug)}`);
assert.equal(document.querySelector('[data-search-input]'), originalInput, 'The full word view retains global lookup.');
assert.equal(publicFetches, 1, 'Changing views does not download the catalog again.');
checks.push('one persistent lookup across eight SPA sections and word details; one catalog download');

input.focus();
const beforeTyping = location.href;
type(input, target.headword.toLowerCase());
assert.equal(location.href, beforeTyping, 'Typing must not navigate or add a history entry.');
assert.equal(options(form)[0]?.textContent.includes(target.headword), true, 'Exact term ranks first without form submission.');
const first = options(form)[0];
assert.equal(first.getAttribute('role'), 'option');
assert.match(first.getAttribute('href'), new RegExp(`word/${target.slug}/$`), 'Results contain real permanent links.');
assert.ok(first.textContent.includes(target.definition.slice(0, Math.min(30, target.definition.length))), 'Results expose meaning, not just the headword.');
assert.equal(input.getAttribute('role'), 'combobox');
assert.equal(input.getAttribute('aria-autocomplete'), 'list');
assert.ok(form.querySelector('[role="listbox"]'));
key(input, 'ArrowDown');
assert.equal(document.activeElement, input, 'Keyboard result selection keeps text focus.');
const activeId = input.getAttribute('aria-activedescendant');
assert.ok(activeId && document.getElementById(activeId), 'Combobox announces a real active option.');
key(input, 'Enter'); await tick();
assert.equal(new URLSearchParams(location.search).get('term'), target.slug, 'Arrow + Enter opens the full word in one selection.');
checks.push('instant exact results, meaning previews, permanent links and accessible keyboard selection');

route('#home');
input.focus();type(input,target.headword);
let lookupHistory=history.length;
const directEnter=key(input,'Enter');await tick();
assert.equal(directEnter.defaultPrevented,true,'An exact-word Enter is handled as one direct selection.');
assert.equal(new URLSearchParams(location.search).get('term'),target.slug,'Exact-word Enter opens the record without requiring an arrow key.');
assert.equal(history.length,lookupHistory+1,'Exact-word Enter creates exactly one navigation.');
checks.push('exact-word Enter opens the record directly with one history entry');

route('#home');
input.focus();type(input,target.headword);
lookupHistory=history.length;
click(options(form)[0]);await tick();
assert.equal(new URLSearchParams(location.search).get('term'),target.slug,'A pointer selection opens the selected record.');
assert.equal(history.length,lookupHistory+1,'A result click is not also handled by the page-wide link router.');
checks.push('pointer result selection creates one navigation without duplicate router handling');

input.focus();type(input,'suffering');
lookupHistory=history.length;
const meaningEnter=key(input,'Enter');
// jsdom does not synthesize the browser's native form submission for a keydown.
// Apply that default action only when the combobox has not consumed the Enter.
if(!meaningEnter.defaultPrevented)form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
await tick();
assert.equal(meaningEnter.defaultPrevented,false,'A conceptual query keeps the normal full-search submit behavior.');
assert.equal(location.hash,'#archive');
assert.equal(new URLSearchParams(location.search).get('q'),'suffering','Concept-query Enter opens all relevant records, rather than selecting an arbitrary definition.');
assert.equal(history.length,lookupHistory+1,'Concept-query Enter creates one results navigation.');
checks.push('meaning-query Enter opens the full result list with one history entry');

input.focus(); type(input, target.headword);
key(input, 'Escape');
assert.equal(opened(form), false, 'Escape dismisses results.');
assert.equal(input.value, target.headword, 'Escape preserves the query.');
input.dispatchEvent(new window.Event('focus'));
assert.equal(opened(form), true, 'Refocusing restores the current results.');
const tab = key(input, 'Tab');
assert.equal(tab.defaultPrevented, false, 'Tab remains standard page navigation.');
assert.equal(opened(form), false, 'Tab dismisses the results without trapping focus.');
input.dispatchEvent(new window.Event('focus'));
document.querySelector('footer').dispatchEvent(new window.Event('pointerdown', {bubbles:true}));
assert.equal(opened(form), false, 'Clicking outside dismisses lookup.');
click(form.querySelector('[data-search-clear]'));
assert.equal(input.value, '');
assert.equal(document.activeElement, input, 'Clear returns to a ready-to-type field.');
assert.equal(opened(form), false, 'Clear closes the old result panel.');
assert.equal(window.getComputedStyle(popup(form)).display, 'none', 'A closed result panel is actually hidden by the delivered CSS.');
checks.push('Escape, refocus, Tab, outside click and clear keep navigation predictable');

// A source phrase retrieves a definition, not merely headword characters.
input.focus(); type(input, 'suffering');
assert.ok(options(form).some(option => option.textContent.includes('Suffralchemy')), 'Concept lookup reaches the relevant definition.');
input.focus(); type(input, 'Portmantres');
assert.ok(options(form)[0]?.textContent.includes('Portmantrés'), 'Diacritic-free entry reaches the accented headword.');
input.focus(); type(input, 'zzzz-no-lexical-record-8675309');
assert.equal(options(form).length, 0);
assert.match(form.textContent, /no .*match|no .*found|nothing .*match/i);
checks.push('definition search, diacritic normalization and truthful no-match state');

input.focus();type(input,'suffering');
click(form.querySelector('[data-search-all]'));
assert.equal(location.hash,'#archive');
assert.equal(new URLSearchParams(location.search).get('q'),'suffering');
const archiveInput=document.querySelector('#query');
assert.ok(archiveInput,'The full result list has a directly editable query.');
document.querySelector('.archive-filters').open=true;
archiveInput.focus();
const historyCount=history.length;
type(archiveInput,target.headword);
assert.equal(document.querySelector('#query'),archiveInput,'Archive typing preserves the exact input node.');
assert.equal(document.activeElement,archiveInput,'Archive typing preserves focus.');
assert.equal(history.length,historyCount,'Archive keystrokes do not fill browser history.');
assert.ok(document.querySelector('.word-card')?.textContent.includes(target.headword),'Full archive results update as the query is typed.');
checks.push('one-click full results and in-place archive typing without focus loss or history churn');

// On the archive, the always-visible lookup is also the live collection filter.
// Advanced filters keep their selected scope while the main query is edited.
const forgeTarget=catalog.terms.find(term=>term.stage==='forge') || target;
const filteredStage=forgeTarget.stage;
route(`#archive?stage=${encodeURIComponent(filteredStage)}`);
const advancedDrawer=document.querySelector('.archive-filters');
const advancedQuery=document.querySelector('#query');
assert.ok(advancedDrawer.contains(advancedQuery),'The secondary query field belongs inside advanced filters, leaving one primary lookup.');
input.focus();
lookupHistory=history.length;
type(input,forgeTarget.headword);
assert.equal(document.querySelector('[data-search-input]'),originalInput);
assert.equal(document.activeElement,input,'Live archive filtering keeps focus in the primary lookup.');
assert.equal(history.length,lookupHistory,'Primary lookup keystrokes do not grow browser history.');
assert.equal(document.querySelector('#query').value,forgeTarget.headword,'Advanced query and primary lookup stay synchronized.');
assert.equal(document.querySelector('#search-form').elements.stage.value,filteredStage,'Typing preserves the selected editorial stage.');
assert.equal(new URLSearchParams(location.search).get('stage'),filteredStage);
assert.ok(document.querySelector('.word-card')?.textContent.includes(forgeTarget.headword),'The archive grid responds directly to primary lookup typing.');
for(const anchor of document.querySelectorAll('#archive-results .word-card h3 a')) {
  const slug=anchor.getAttribute('href').split('/').filter(Boolean).at(-1);
  assert.ok(catalog.terms.some(term=>term.slug===slug&&term.stage===filteredStage),'Every displayed card remains an approved record in the selected stage.');
}
checks.push('the single primary lookup filters the archive instantly while preserving focus, history and stage');

click(form.querySelector('[data-search-clear]'));
const stageTotal=catalog.terms.filter(term=>term.stage===filteredStage).length;
assert.equal(input.value,'');
assert.equal(document.querySelector('#query').value,'','Clearing the main lookup also clears the advanced query.');
assert.equal(document.activeElement,input);
assert.equal(history.length,lookupHistory,'Clearing a query does not grow browser history.');
assert.equal(document.querySelector('#search-form').elements.stage.value,filteredStage,'Clearing text preserves the selected stage.');
assert.equal(new URLSearchParams(location.search).get('stage'),filteredStage);
assert.match(document.querySelector('#archive-result-count').textContent,new RegExp(`^${stageTotal} public entr`),'Clearing restores the full filtered collection.');
checks.push('primary lookup clear restores the selected collection without removing its filters');

// IME Enter commits a composed word rather than opening another page.
const beforeComposition = location.href;
input.dispatchEvent(new window.CompositionEvent('compositionstart', {bubbles: true}));
type(input, target.headword, {isComposing: true});
key(input, 'Enter', {isComposing: true, keyCode: 229});
assert.equal(location.href, beforeComposition);
input.dispatchEvent(new window.CompositionEvent('compositionend', {bubbles: true, data: target.headword}));
assert.ok(options(form)[0]?.textContent.includes(target.headword));
checks.push('IME composition does not trigger premature navigation');

// Shortcut ownership belongs to the user while another editor has focus.
route('#author');
const definition = document.querySelector('#author-form textarea');
assert.ok(definition);
definition.focus();
key(definition, '/');
assert.equal(document.activeElement, definition, 'Typing / in authoring must not steal focus.');
key(definition, 'k', {ctrlKey: true});
assert.equal(document.activeElement, definition, 'The lookup shortcut must not steal an editor chord.');
document.querySelector('#main').focus();
key(document, '/');
assert.equal(document.activeElement, input, 'Slash opens search when outside editing controls.');
assert.equal(publicFetches, 1);
checks.push('global keyboard shortcuts respect active editorial input');

// Isolated helper tests make visibility/security independent of release content.
const {instantSearchMarkup, mountInstantSearch} = await import('../museum-static/observatory/instant-search.js');
const sandbox = document.createElement('div');
sandbox.innerHTML = instantSearchMarkup({base: './', idPrefix: 'fixture'});
document.body.append(sandbox);
const fixture = {
  ...raw,
  terms: [
    {id:'symbol',slug:'symbol',headword:'A+B',definition:'A safely documented symbol expression.',visibility:'approved_public',stage:'forge',variants:[],components:[],domains:[],tags:[]},
    {id:'unsafe',slug:'unsafe',headword:'<img src=x onerror=alert(1)>',definition:'<script>private exploit</script>',visibility:'approved_public',stage:'forge',variants:[],components:[],domains:[],tags:[],analysis:{kind:'ai_hypothesis',interpretationProposal:'NEVER_INDEX_THIS_PROPOSAL'}},
    {id:'private',slug:'private',headword:'PRIVATE_SECRET_DO_NOT_DISPLAY',definition:'Private original.',visibility:'private',stage:'forge'},
  ], relations:[],versions:[
    {id:'public-history',termId:'symbol',definition:'Phosphorescent earlier aperture.',visibility:'approved_public',version:2,effectiveAt:'2025-03-01'},
    {id:'private-history',termId:'symbol',definition:'PRIVATE_HISTORY_DO_NOT_DISPLAY',visibility:'private',version:3},
    {id:'unapproved-history',termId:'symbol',definition:'UNAPPROVED_HISTORY_DO_NOT_DISPLAY',version:4},
  ],
};
let helperCatalog = fixture, helperStatus = 'ready';
const navigations = [], searches = [];
const helper = mountInstantSearch(sandbox, {getCatalog:()=>helperCatalog,status:()=>helperStatus,base:'./',onNavigate:(...args)=>navigations.push(args),onSearchAll:(...args)=>searches.push(args)});
const field = sandbox.querySelector('[data-search-input]');
field.focus(); type(field, '+');
assert.equal(options(sandbox).length, 1);
assert.ok(options(sandbox)[0].textContent.includes('A+B'), 'A literal symbol is searchable without returning every record.');
type(field, 'img');
assert.equal(options(sandbox).length, 1);
assert.ok(options(sandbox)[0].textContent.includes('<img src=x onerror=alert(1)>'));
assert.equal(sandbox.querySelector('img'), null, 'Headword markup must be escaped.');
assert.equal(sandbox.querySelector('script'), null, 'Definition markup must be escaped.');
type(field,'phosphorescent earlier aperture');
assert.equal(options(sandbox).length,1,'Approved historical wording can lead to its current public record.');
const historicalHit=options(sandbox)[0];
assert.match(historicalHit.querySelector('.lookup-match').textContent,/Earlier public wording/,'Historical matches are explicitly identified.');
assert.match(historicalHit.querySelector('.lookup-match').textContent,/version 2/);
assert.match(historicalHit.querySelector('.lookup-match').textContent,/2025-03-01/);
assert.equal(historicalHit.querySelector('.lookup-definition').textContent,'A safely documented symbol expression.','A historical match still previews the current definition.');
checks.push('approved historical wording is searchable with a dated label and the current definition intact');

for(const query of ['PRIVATE_SECRET_DO_NOT_DISPLAY','NEVER_INDEX_THIS_PROPOSAL','PRIVATE_HISTORY_DO_NOT_DISPLAY','UNAPPROVED_HISTORY_DO_NOT_DISPLAY']) {
  type(field,query);
  assert.equal(options(sandbox).length,0,'Private originals, private/unapproved history and unaccepted proposal text are not searchable.');
}
checks.push('literal symbols, escaped content, and exclusion of private records and unaccepted AI text');

helperCatalog = {terms:[],relations:[],versions:[]};
helper.refresh();field.focus();type(field,'word');
assert.equal(options(sandbox).length,0);
assert.match(sandbox.textContent,/no .*public|empty|no .*entries|no .*match|nothing .*match/i);
helper.destroy();
sandbox.remove();
checks.push('empty public catalog is explained without substitute records');

// A separate startup also covers arriving directly at the archive before the
// application module initializes. A preexisting typed query must win over an
// initially empty archive URL and remain visible while the catalog arrives.
window=install(new JSDOM(fs.readFileSync(new URL('index.html',site),'utf8'),{url:`${base}#archive`,pretendToBeVisual:true}));
const archiveFallback=document.querySelector('#site-lookup input[type="search"]');
archiveFallback.value=target.headword;
archiveFallback.focus();
let startupFetches=0, releaseStartup;
globalThis.fetch=async url=>{
  startupFetches++;
  assert.equal(new URL(url,location.href).href,`${base}public.json`);
  return new Promise(resolve=>{releaseStartup=()=>resolve(new Response(JSON.stringify(raw),{status:200,headers:{'content-type':'application/json'}}));});
};
await import(new URL('../museum-static/observatory/app.js?archive-startup-regression',import.meta.url));
await tick();
const startupInput=document.querySelector('[data-search-input]');
assert.equal(startupInput.value,target.headword,'Direct archive startup preserves the text already entered in initial HTML.');
assert.equal(document.activeElement,startupInput,'Direct archive startup preserves text-entry focus.');
assert.equal(new URLSearchParams(location.search).get('q'),target.headword,'The initial archive URL adopts the already-typed query.');
assert.equal(location.hash,'#archive');
releaseStartup();await tick();await tick();
assert.equal(startupFetches,1);
assert.equal(document.querySelector('[data-search-input]'),startupInput);
assert.equal(startupInput.value,target.headword);
assert.equal(document.activeElement,startupInput);
assert.ok(document.querySelector('#archive-results .word-card')?.textContent.includes(target.headword),'The loaded archive is filtered by the preserved startup query.');
assert.ok(document.querySelector('#archive-result-count').textContent.includes(`matching “${target.headword}”`));
checks.push('direct archive startup preserves a pre-JavaScript query and focus, adopts its URL and filters loaded results');

// Use the real permanent HTML page with the static bootstrap; it must fetch
// the same approved projection once and preserve typing during the download.
const {startStaticSearch} = await import('../museum-static/observatory/static-search.js');
window = install(new JSDOM(fs.readFileSync(new URL(`word/${target.slug}/index.html`,site),'utf8'), {url:`${base}word/${target.slug}/`,pretendToBeVisual:true}));
const staticRoot = document.querySelector('[data-static-lookup]');
assert.ok(staticRoot, 'Every permanent word page exposes the same direct lookup.');
let staticCalls = 0, releaseStatic;
const pendingStatic = startStaticSearch(staticRoot, {fetchImpl:async url=>{
  staticCalls++;
  assert.equal(new URL(url, location.href).href, `${base}public.json`);
  return new Promise(resolve=>{releaseStatic=()=>resolve(new Response(JSON.stringify(raw),{status:200,headers:{'content-type':'application/json'}}));});
}});
assert.equal(startStaticSearch(staticRoot, {fetchImpl:async()=>{throw Error('A second start must reuse the existing request.');}}),pendingStatic,'Repeated static initialization shares one in-flight download.');
const staticInput = staticRoot.querySelector('[data-search-input]');
assert.ok(staticInput,'Permanent-page search appears before its catalog download.');
staticInput.focus();type(staticInput,target.headword);
releaseStatic();await pendingStatic;await tick();
assert.equal(staticRoot.querySelector('[data-search-input]'),staticInput);
assert.equal(staticInput.value,target.headword);
assert.equal(document.activeElement,staticInput);
assert.equal(staticCalls,1);
assert.equal(new URL(options(staticRoot)[0].getAttribute('href'),location.href).href,`${base}word/${target.slug}/`);
type(staticInput,'suffering');type(staticInput,'Portmantres');
assert.equal(staticCalls,1,'Typing on a permanent word page does not refetch the public projection.');
checks.push('real permanent-page lookup, correct relative URLs, one download and preserved in-flight typing');

const failedRoot=document.createElement('section');failedRoot.dataset.staticLookup='';failedRoot.dataset.base='../../';document.body.append(failedRoot);
await startStaticSearch(failedRoot,{fetchImpl:async()=>{throw new Error('Temporary public catalog failure.');}});
const failedInput=failedRoot.querySelector('[data-search-input]');
failedInput.focus();type(failedInput,target.headword);
assert.equal(options(failedRoot).length,0);
assert.equal(failedRoot.dataset.lookupState,'unavailable');
assert.match(failedRoot.textContent,/unavailable|could.*load|connection|failed|try again/i,'A failed public download is distinguished from an empty collection.');
checks.push('static-page download failure is explicit and never replaced with private or fabricated records');

assert.deepEqual(errors, [], 'No application errors occurred during lookup flows.');
console.log(`PASS: ${checks.length} instant-search DOM flows.\n${checks.map(value=>`  • ${value}`).join('\n')}`);
