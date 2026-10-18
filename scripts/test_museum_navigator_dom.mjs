// Museum navigator integration tests, run offline with public fixtures and synthetic private records.
// This test must never use a real Supabase token or request private museum data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from './dom-tests/node_modules/jsdom/lib/api.js';

const root=new URL('../museum-static/admin/',import.meta.url);
const html=fs.readFileSync(new URL('index.html',root),'utf8');
const core=fs.readFileSync(new URL('navigator-core.js',root),'utf8');
const admin=fs.readFileSync(new URL('admin.js',root),'utf8');
const dom=new JSDOM(html,{url:'https://exemptus9.github.io/idunnopoetry-museum/admin/',
 pretendToBeVisual:true,runScripts:'outside-only'});
const w=dom.window,doc=w.document,$=id=>doc.getElementById(id);
w.HTMLElement.prototype.scrollIntoView=()=>{};
w.matchMedia=()=>({matches:false});
w.confirm=()=>true;
w.IDP_CMS_CONFIG={url:'https://test-museum.supabase.co',publishableKey:'sb_publishable_test'};
w.IDP_POETRY={works:[{id:101,title:'The Tilt',x:'The earth is tilted\nAnd I am not aligned'}]};
w.IDP_CORE={
 topics:[{id:202,title:'An early thread',x:'History of the forum'}],
 forums:[{id:203,n:'The Poetry Rooms',description:'An original forum'}],
 users:[{id:204,n:'Community Poet'}]
};
w.IDP_POSTS=[{id:205,title:'An ordinary reply',x:'a passing word with echoes of refuge'}];
w.IDP_CREATIVE_META={seeds:[{id:'seed-01',title:'A possibility',text:'Possibility lag'}],
 supplementalWorks:[],archiveDocuments:[]};
w.IDP_MEDIA_CATALOG={assets:[]};
w.IDP_READER_IMPACT={entries:[]};
w.sessionStorage.setItem('idp_museum_editor_session_v1',
 JSON.stringify({access_token:'testing-only',refresh_token:'synthetic-refresh',expires_at:9999999999}));

let records=[],saves=0,approvals=0,publishes=0,copied='';
w.fetch=async (url,opts={})=>{
 const u=String(url);
 const json=data=>({ok:true,async text(){return JSON.stringify(data)}});
 if(u.includes('/auth/v1/user'))return json({email:'test-curator@example.test'});
 if(u.includes('rpc/museum_my_role'))return json('owner');
 if(u.includes('museum_documents?'))return json(records);
 if(u.includes('museum_revisions?'))return json([]);
 if(u.includes('rpc/museum_save')){
  saves++;const input=JSON.parse(opts.body);
  const item={id:'123e4567-e89b-42d3-a456-426614174001',kind:input.p_kind,
   entity_key:input.p_entity_key,title:input.p_title,draft:input.p_draft,
   revision:1,status:'draft',approved_revision:null,updated_at:'2026-10-18T10:00:00Z'};
  records=[item];return json(item);
 }
 if(u.includes('rpc/museum_approve')){approvals++;return json({})}
 if(u.includes('rpc/museum_publish')){publishes++;return json({})}
 throw Error('Unexpected network access: '+u);
};
Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async str=>{copied=str}},configurable:true});
w.eval(core);
const nav=w.IDP_EDITOR_NAV;
const index=await nav.buildPublicIndex(w,{yieldEvery:2});
assert.equal(index.length,6,'all available public source categories indexed');
let found=nav.search(index,[],'tilted');
assert.equal(found.results[0].title,'The Tilt','remembers a line, not just its title');
assert.equal(nav.search(index,[],'community').results.length>0,true);
assert.equal(nav.search(index,[],'none999').total,0);
assert.equal(nav.search(index,[],'tilted',{scope:'post'}).total,0,'scope filter respected');
assert.equal(nav.search(index,[],'tilted',{scope:'poem'}).results[0].kind,'poem');
assert.ok(index.every(x=>x.type==='public' && x.searchable),'public index has only public rows');

w.eval(admin);
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function settle(){for(let i=0;i<12;i++)await tick()}
function input(id,value){
 $(id).value=value;$(id).dispatchEvent(new w.Event('input',{bubbles:true}));
}
await settle();
assert.equal($('app').hidden,false);
doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}));
assert.equal(doc.activeElement,$('global-search'),'Ctrl+K jumps directly to one-box search');
input('global-search','tilted');
await settle();
assert.match($('global-results').textContent,/The Tilt/);
assert.ok($('global-results').querySelector('.command-result'),'shows actionable results');
$('global-results').querySelector('.command-result').click();
assert.equal($('kind').value,'poem');
assert.equal($('title').value,'The Tilt');
assert.equal($('copy-handoff').disabled,true,'source not yet saved cannot transfer private metadata');
$('compare-source').click();
assert.equal($('source-compare').hidden,false);
assert.equal($('original-text').textContent,w.IDP_POETRY.works[0].x);
assert.match($('comparison-summary').textContent,/matches/);
input('text','This revision is different\nNew lines');
assert.match($('comparison-summary').textContent,/differ/);
assert.equal(w.IDP_POETRY.works[0].x,'The earth is tilted\nAnd I am not aligned','comparison never rewrites original');

$('quick-seed').click();
input('title','New Thought');
input('text','PrivateOnlyPhrase847315 should never enter a search index');
$('provenance').value='uncertain';
$('provenance').dispatchEvent(new w.Event('change',{bubbles:true}));
$('edit-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
await settle();
assert.equal(saves,1,'saved one private draft');
assert.equal(approvals,0);
assert.equal(publishes,0);
assert.equal($('copy-handoff').disabled,false,'saved clean draft can be intentionally referenced');
$('copy-handoff').click();await settle();
assert.match(copied,/Museum \/ Continuity handoff/);
assert.match(copied,/New Thought/);
assert.equal(copied.includes('PrivateOnlyPhrase847315'),false,'private text never in handoff');
assert.equal(copied.includes('testing-only'),false,'auth token never in handoff');

input('global-search','PrivateOnlyPhrase847315');
await settle();
assert.equal($('global-results').querySelectorAll('.command-result').length,0,
 'private draft body must not be indexed by omnibox');
input('global-search','New Thought');
await settle();
assert.match($('global-results').textContent,/Saved private/);
assert.ok($('global-results').querySelector('.command-result'));
$('global-results').querySelector('.command-result').click();
assert.equal($('title').value,'New Thought');
$('quick-provenance').click();
assert.equal($('provenance-filter').value,'unresolved');
assert.equal($('provenance').value,'uncertain');
assert.equal(doc.activeElement,$('provenance'),'needs-review queue focuses classification');
assert.equal(approvals,0);

const projects=Array.from(doc.querySelectorAll('.connected-projects a'));
assert.ok(projects.some(x=>x.href.includes('/artificial-continuity/')));
assert.ok(projects.some(x=>x.href.includes('/observatory/')));
assert.ok(projects.some(x=>x.href.includes('rhymemosaic')));
assert.ok(projects.every(x=>x.rel.includes('noopener')&&x.rel.includes('noreferrer')),
 'project links do not transmit private editor referer');
assert.equal(doc.querySelectorAll('#global-results script').length,0,'results never interpolate HTML');
dom.window.close();
console.log('PASS: cross-archive search, keyboard jumps, source fidelity, metadata handoff and private-body exclusion.');
