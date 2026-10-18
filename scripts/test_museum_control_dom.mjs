// Run the actual Museum curator frontend in a DOM with synthetic authentication.
// This never talks to Supabase or loads any real private poems.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from './dom-tests/node_modules/jsdom/lib/api.js';

const home = new URL('../museum-static/admin/',import.meta.url);
const html=fs.readFileSync(new URL('index.html',home),'utf8');
const script=fs.readFileSync(new URL('admin.js',home),'utf8');
const dom=new JSDOM(html,{url:'https://exemptus9.github.io/idunnopoetry-museum/admin/',
  pretendToBeVisual:true,runScripts:'outside-only'});
const {window:w}=dom, doc=w.document, $=id=>doc.getElementById(id);
w.IDP_CMS_CONFIG={url:'https://museum-tests.supabase.co',publishableKey:'sb_publishable_test'};
w.HTMLElement.prototype.scrollIntoView=()=>{};
w.matchMedia=()=>({matches:false});
w.sessionStorage.setItem('idp_museum_editor_session_v1',
 JSON.stringify({access_token:'synthetic-only',refresh_token:'synthetic-refresh',expires_at:9999999999}));
let documents=[], saves=0, approvals=0, publications=0, withdrawals=0;
let allowDiscard=false, savePayload;
w.confirm=()=>allowDiscard;
function response(value){return{ok:true,async text(){return JSON.stringify(value)}}}
w.fetch=async (input,options={})=>{
 const path=String(input);
 if(path.includes('/auth/v1/user'))return response({email:'curator@example.test'});
 if(path.includes('/rpc/museum_my_role'))return response('owner');
 if(path.includes('/rest/v1/museum_documents?'))return response(documents.map(d=>({...d})));
 if(path.includes('/rest/v1/museum_revisions?'))return response([]);
 if(path.includes('/rpc/museum_save')){
  saves++;
  savePayload=JSON.parse(options.body);
  const doc={id:'11111111-1111-4111-8111-111111111111',kind:savePayload.p_kind,
    entity_key:savePayload.p_entity_key,title:savePayload.p_title,
    draft:savePayload.p_draft,revision:1,approved_revision:null,
    status:'draft',updated_at:'2026-10-18T00:00:00Z'};
  documents=[doc];return response(doc);
 }
 if(path.includes('/rpc/museum_approve')){approvals++;return response({})}
 if(path.includes('/rpc/museum_publish')){publications++;return response({})}
 if(path.includes('/rpc/museum_withdraw')){withdrawals++;return response({})}
 throw Error('Unexpected network request: '+path);
};
w.eval(script);
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function settle(){for(let i=0;i<5;i++)await tick()}
function change(id,value,eventType='input'){
 $(id).value=value;$(id).dispatchEvent(new w.Event(eventType,{bubbles:true}));
}
await settle();
assert.equal($('app').hidden,false,'authenticated owner reaches dashboard');
assert.equal($('login').hidden,true);
assert.match($('welcome-status').textContent,/no saved drafts/i);
assert.equal($('export-drafts').disabled,true,'empty private export unavailable');

$('quick-seed').click();
assert.equal($('edit-form').hidden,false);
assert.equal($('kind').value,'seed');
change('entity-key','test-seed');
change('title','A Test Seed');
change('text','Source-preserving private draft');
assert.equal($('unsaved-note').hidden,false,'edits identified as unsaved');
assert.equal($('approve').disabled,true);
assert.equal($('publish').disabled,true);

change('kind','poem','change');
assert.equal($('kind').value,'seed','declining discard restores category');
assert.equal($('title').value,'A Test Seed','declined switch keeps typed work');
const before=new w.Event('beforeunload',{cancelable:true});
w.dispatchEvent(before);
assert.equal(before.defaultPrevented,true,'browser navigation warns about unsaved work');

allowDiscard=true;change('kind','poem','change');
assert.equal($('edit-form').hidden,true,'approved discard clears editor');
assert.equal($('kind').value,'poem');
$('quick-seed').click();
change('entity-key','test-seed');
change('title','A Test Seed');
change('text','Private version one');
change('provenance','uncertain','change');
$('edit-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
await settle();
assert.equal(saves,1,'one private save');
assert.equal(savePayload.p_kind,'seed');
assert.equal(savePayload.p_draft.text,'Private version one');
assert.equal(approvals,0,'saving does not approve');
assert.equal(publications,0,'saving does not publish');
assert.equal($('unsaved-note').hidden,true,'saved revision clean');
assert.equal($('approve').disabled,false,'owner can approve saved revision');

change('title','Changed but NOT saved');
assert.equal($('unsaved-note').hidden,false);
assert.equal($('approve').disabled,true,'dirty editor cannot approve');
assert.equal($('publish').disabled,true);
$('approve').click();
assert.equal(approvals,0,'disabled button cannot send approval');

change('title','A Test Seed');
assert.equal($('unsaved-note').hidden,true);
$('record-filter').value='approved';
$('record-filter').dispatchEvent(new w.Event('change',{bubbles:true}));
assert.match($('draft-list').textContent,/No saved drafts/i);
$('record-filter').value='draft';
$('record-filter').dispatchEvent(new w.Event('change',{bubbles:true}));
assert.match($('draft-list').textContent,/A Test Seed/,'review filter finds saved drafts');

let privateExport='';
w.Blob=class {constructor(parts){privateExport=parts.join('')}};
w.URL.createObjectURL=()=> 'blob:test-export';
w.URL.revokeObjectURL=()=>{};
let downloaded='';
w.HTMLAnchorElement.prototype.click=function(){downloaded=this.download};
$('export-drafts').click();
assert.match(downloaded,/idp-private-editorial-/);
assert.equal(JSON.parse(privateExport).documents[0].draft.text,'Private version one');
assert.equal(privateExport.includes('synthetic-only'),false,'session token excluded from private export');

assert.equal(withdrawals,0);
dom.window.close();
console.log('PASS: Museum mobile start flow, authenticated dashboard, dirty guard, private save, stage filter and explicit export.');
