import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from './dom-tests/node_modules/jsdom/lib/api.js';
const root=new URL('../museum-static/',import.meta.url);
const code=fs.readFileSync(new URL('atlas/launchpad.js',root),'utf8');
let scenarios=0;
function setup(page,query=''){
 const dom=new JSDOM(fs.readFileSync(new URL(page+'index.html',root),'utf8'),{url:'https://exemptus9.github.io/idunnopoetry-museum/'+page+query,runScripts:'outside-only'});
 const w=dom.window,d=w.document;let requests=0,copied='';
 w.fetch=()=>{requests++;throw Error('No network permitted');};
 Object.defineProperty(w.navigator,'clipboard',{value:{async writeText(text){copied=text;}}});
 w.eval(code);
 return {dom,w,d,select:d.getElementById('project-goal'),requests:()=>requests,copied:()=>copied};
}
for(const page of['projects/','atlas/']){
 const {dom,w,d,select,requests,copied}=setup(page);
 const choose=goal=>{select.value=goal;select.dispatchEvent(new w.Event('change'));};
 const links=()=>[...d.querySelectorAll('[data-route-results] a')];
 assert.equal(d.querySelector('[data-route-copy]').disabled,true);
 for(const goal of['read','language','research','organize','support','help']){
  choose(goal);assert.ok(links().length>=1&&links().length<=2);
  assert.equal(new URL(w.location.href).searchParams.get('pg'),goal);
  assert.ok(links().every(a=>['http:','https:'].includes(new URL(a.href).protocol)));
  assert.ok(!d.querySelector('[data-route-results]').textContent.includes('No public app link'));
  scenarios++;
 }
 choose('read');assert.equal(links().length,2);
 d.querySelector('[data-route-copy]').click();await new Promise(resolve=>setImmediate(resolve));
 assert.match(copied(),/Read poetry/);assert.match(copied(),/https:\/\//);
 assert.ok(!copied().includes('brandon-mirror-private'));
 assert.match(copied(),/ · /,'Date labels and dates must not run together');
 scenarios++;
 // A recorded private stage can never be recommended, even if a link is present.
 d.getElementById('project-techenlight').dataset.stage='building';choose('help');
 assert.equal(links().length,0);assert.equal(d.querySelector('[data-route-copy]').disabled,true);
 assert.match(d.querySelector('[data-route-results]').textContent,/No currently public/);scenarios++;
 // Unsupported schemes and HTML-like source titles are safe.
 const card=d.getElementById('project-hydra-index');card.querySelector('a.go').href='javascript:alert(1)';choose('research');assert.equal(links().length,0);
 card.querySelector('a.go').href='https://example.test/';card.querySelector('h3').textContent='<img src=x onerror=alert(1)>';
 choose('research');assert.equal(d.querySelector('[data-route-results] img'),null);assert.match(links()[0].textContent,/<img/);scenarios++;
 // Clipboard denial yields exact selectable route, and changing the goal clears it.
 w.navigator.clipboard.writeText=async()=>{throw Error('Denied');};choose('support');
 d.querySelector('[data-route-copy]').click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(d.querySelector('[data-route-manual]').hidden,false);
 const field=d.querySelector('[data-route-manual] textarea');assert.match(field.value,/Sanford/);assert.equal(field.readOnly,true);assert.equal(field.selectionEnd,field.value.length);
 choose('language');assert.equal(field.value,'');assert.equal(d.querySelector('[data-route-manual]').hidden,true);scenarios++;
 // A late denied copy cannot reveal or change a newer goal's state.
 let reject;w.navigator.clipboard.writeText=()=>new Promise((_,no)=>{reject=no;});
 d.querySelector('[data-route-copy]').click();choose('read');reject(Error('Late denial'));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(d.querySelector('[data-route-manual]').hidden,true);assert.equal(d.querySelector('[data-route-status]').textContent,'');scenarios++;
 d.querySelector('[data-route-clear]').click();assert.equal(select.value,'');assert.equal(new URL(w.location.href).searchParams.get('pg'),null);
 assert.equal(requests(),0);assert.equal(w.localStorage.length,0);assert.equal(w.sessionStorage.length,0);scenarios++;
 dom.window.close();
 const deep=setup(page,'?pg=support&ps=archive');assert.equal(deep.select.value,'support');assert.match(deep.d.querySelector('[data-route-results]').textContent,/Sanford/);deep.dom.window.close();scenarios++;
 const invalid=setup(page,'?pg=__proto__');assert.equal(invalid.select.value,'');assert.equal(invalid.d.querySelector('[data-route-results]').hidden,true);invalid.dom.window.close();scenarios++;
}
console.log(`PASS ${scenarios} public goal-route scenarios across both pages; safe links, source dates, deep links, copy failure and no network/storage.`);
