/* Exercise the actual public project filters in both site HTML documents.
 * No network, tracking, private data or third-party accounts.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from './dom-tests/node_modules/jsdom/lib/api.js';
const root = new URL('../museum-static/', import.meta.url);
const code = fs.readFileSync(new URL('atlas/worlds.js',root),'utf8');
function exercise(page, mobile) {
  const origin='https://exemptus9.github.io/idunnopoetry-museum/';
  const url=origin+page;
  const html=fs.readFileSync(new URL(page+'index.html',root),'utf8');
  const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  w.matchMedia=query=>({matches:mobile&&query.includes('max-width'),addEventListener() {},removeEventListener() {}});
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(code);
  const d=w.document, atlas=page==='atlas/';
  const all=[...d.querySelectorAll(atlas?'.atlas-orbit':'.project')];
  const get=id=>d.getElementById((atlas?'worlds-':'project-')+id);
  const search=get('search'), stage=get(atlas?'stage':'filter'), domain=get('domain'), order=get('order');
  const reset=d.getElementById(atlas?'worlds-reset':'clear-filters');
  const more=d.getElementById(atlas?'worlds-more':'project-more');
  const visible=()=>all.filter(c=>!c.hidden);
  const change=(node,type)=>node.dispatchEvent(new w.Event(type,{bubbles:true}));
  assert.equal(all.length,40,'Both sites must include all 40 curated projects');
  assert.equal(d.body.dataset.compendiumView,mobile?'compact':'gallery');
  assert.equal(visible().length,16,'Initial viewport should avoid 40 full cards');
  assert.ok(!more.hidden);
  stage.value='live';change(stage,'change');
  assert.equal(visible().length,10,'Public stage shows exactly 10 actual public projects');
  domain.value='community';change(domain,'change');
  assert.ok(visible().length>=1);
  assert.ok(visible().some(c=>c.textContent.includes('Sanford Resource Hub')));
  domain.value='all';stage.value='all';change(stage,'change');
  search.value='Sanford';change(search,'input');
  assert.equal(visible().length,1,'Keyword search finds Sanford without opening hidden projects');
  assert.equal(visible()[0].querySelector('h3')?.textContent,'Sanford Resource Hub');
  assert.equal(new URL(w.location.href).searchParams.get('p'),'Sanford');
  d.querySelector('[data-compendium-shortcut="stage:archive"]').click();
  assert.equal(visible().length,5,'Historical shortcut reveals five historical entries');
  assert.equal(stage.value,'archive');
  const gallery=d.querySelector('.view-switch [data-compendium-view="gallery"]');
  gallery.click();
  assert.equal(d.body.dataset.compendiumView,'gallery');
  assert.equal(gallery.getAttribute('aria-pressed'),'true');
  reset.click();
  assert.equal(visible().length,16);
  more.click();
  assert.equal(visible().length,28);
  more.click();
  assert.equal(visible().length,40,'Progressive disclosure can reveal every entry');
  assert.ok(more.hidden);
  order.value='name';change(order,'change');
  assert.equal(visible().length,16,'Sorting resets the initial page count');
  const names=[...d.querySelectorAll(atlas?'#worlds-grid .atlas-orbit':'section.group .project')].map(c=>c.querySelector('h3')?.textContent);
  assert.equal(names.length,40,'Sorting must not delete or duplicate project elements');
  for(const item of all){assert.ok(item.dataset.domain);assert.ok(item.id.startsWith('project-'));}
  dom.window.close();
}
for(const mobile of [true,false]){
  exercise('projects/',mobile);
  exercise('atlas/',mobile);
}
console.log('PASS: 40 curated cards per page; mobile/desktop views, filters, shortcuts, sorting, URL state and progressive loading.');
