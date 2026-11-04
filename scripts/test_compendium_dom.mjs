/* Test actual public controls; no network, storage or account data. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from './dom-tests/node_modules/jsdom/lib/api.js';
const root=new URL('../museum-static/',import.meta.url);
const code=fs.readFileSync(new URL('atlas/worlds.js',root),'utf8');
const config=JSON.parse(fs.readFileSync(new URL('projects/updates.json',root),'utf8'));
const catalog=JSON.parse(fs.readFileSync(new URL('projects/catalog.json',root),'utf8'));
function exercise(page,mobile){
 const dom=new JSDOM(fs.readFileSync(new URL(page+'index.html',root),'utf8'),{url:'https://exemptus9.github.io/idunnopoetry-museum/'+page,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.matchMedia=query=>({matches:mobile&&query.includes('max-width'),addEventListener(){},removeEventListener(){}});w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.eval(code);
 const d=w.document,atlas=page==='atlas/';
 const all=[...d.querySelectorAll(atlas?'.atlas-orbit':'.project')];
 const get=id=>d.getElementById((atlas?'worlds-':'project-')+id);
 const search=get('search'),stage=get(atlas?'stage':'filter'),domain=get('domain'),order=get('order');
 const reset=d.getElementById(atlas?'worlds-reset':'clear-filters'),more=get('more');
 const visible=()=>all.filter(c=>!c.hidden),change=(node,type)=>node.dispatchEvent(new w.Event(type,{bubbles:true}));
 assert.equal(all.length,config.expectedCount);
 assert.equal(d.body.dataset.compendiumView,mobile?'compact':'gallery');assert.equal(visible().length,16);assert.ok(!more.hidden);
 stage.value='live';change(stage,'change');assert.equal(visible().length,catalog.stageCounts.live);
 const sacred=d.getElementById('project-sacred-interval');
 assert.ok(sacred&&!sacred.hidden,'The independently checked Sacred Interval website is a public destination');
 assert.equal(sacred.dataset.phase,'website');
 assert.equal(sacred.querySelector('a.go')?.href,'https://sacred-interval.idunnopoetry.chatgpt.site/');
 domain.value='community';change(domain,'change');assert.ok(visible().some(c=>c.textContent.includes('Sanford Resource Hub')));
 domain.value='all';stage.value='all';change(stage,'change');search.value='Sanford';change(search,'input');
 // A truthful cross-link description may mention Sanford in more than one card.
 // Test all matching IDs rather than assuming a permanently unique keyword.
 const expectedSanford=all.filter(c=>(c.dataset.search||'').toLowerCase().includes('sanford'));
 assert.ok(expectedSanford.length>0);
 assert.deepEqual(visible().map(c=>c.id).sort(),expectedSanford.map(c=>c.id).sort());
 assert.ok(visible().some(c=>c.id==='project-sanford-resource-hub'));
 assert.equal(new URL(w.location.href).searchParams.get('p'),'Sanford');
 d.querySelector('[data-compendium-shortcut="stage:archive"]').click();assert.equal(visible().length,catalog.stageCounts.archive);assert.equal(stage.value,'archive');
 reset.click();stage.value='concept';change(stage,'change');assert.equal(visible().length,config.concepts.length);assert.ok(visible().every(c=>c.dataset.phase==='concept'));
 assert.ok(visible().some(c=>c.id==='project-dab-1'));
 assert.ok(sacred.hidden,'A public website must no longer be falsely presented as concept-only');
 w.history.replaceState({},'','#project-rhymemosaic');w.dispatchEvent(new w.HashChangeEvent('hashchange'));
 assert.equal(d.getElementById('project-rhymemosaic').hidden,false);assert.equal(visible().length,config.expectedCount);
 const gallery=d.querySelector('.view-switch [data-compendium-view="gallery"]');gallery.click();assert.equal(d.body.dataset.compendiumView,'gallery');assert.equal(gallery.getAttribute('aria-pressed'),'true');
 reset.click();assert.equal(visible().length,16);more.click();assert.equal(visible().length,28);
 let turns=0;while(!more.hidden&&turns++<10)more.click();assert.equal(visible().length,config.expectedCount);assert.ok(more.hidden);
 order.value='name';change(order,'change');assert.equal(visible().length,16);assert.equal(all.length,config.expectedCount);
 for(const item of all){assert.ok(item.dataset.domain);assert.ok(item.id.startsWith('project-'));}
 dom.window.close();
}
for(const mobile of [true,false]){exercise('projects/',mobile);exercise('atlas/',mobile);}
console.log('PASS: reviewed project inventory, complete keyword matching, public website/concept distinction, mobile/desktop controls, hash reveal, sorting, pagination and URL state.');
