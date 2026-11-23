import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {JSDOM} from './dom-tests/node_modules/jsdom/lib/api.js';
const root=path.resolve(import.meta.dirname,'../museum-static');
const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{url:'https://exemptus9.github.io/idunnopoetry-museum/#poem/0',runScripts:'outside-only'});
const w=dom.window;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});w.fetch=async()=>({ok:false,json:async()=>({})});
for(const name of ['museum-config.js','data/core.js','data/posts.js','data/poetry.js','data/creative-meta.js','data/seedbank-approved.js','data/reader-impact.js','data/media-catalog.js','data/youtube-media.js','data/version-history.js','museum.js'])w.eval(fs.readFileSync(root+'/'+name,'utf8'));
const entries=Object.entries(w.IDP_POEM_CHRONOLOGY.records);assert.equal(entries.length,234);
for(const [id,data] of [entries.find(([,d])=>d.interpolated),entries.find(([,d])=>!d.interpolated)]){
 w.location.hash='#poem/'+id;w.dispatchEvent(new w.HashChangeEvent('hashchange'));
 const display=w.document.querySelector('.poem-chronology');assert.ok(display);assert.ok(display.textContent.includes(data.label));assert.ok(display.textContent.includes('Original database date'));
 const original=w.IDP_POETRY.works[Number(id)];assert.equal(w.document.querySelector('.poem-text').textContent,original.x.replace(/\r\n/g,'\n'));
}
const community=w.IDP_POETRY.works.find(p=>p.type==='main_site_community');w.location.hash='#poem/'+community.id;w.dispatchEvent(new w.HashChangeEvent('hashchange'));assert.equal(w.document.querySelector('.poem-chronology'),null);
w.close();console.log('Poem chronology: 234 mapped records; interpolated and evidenced dates rendered; text and other authors preserved.');
