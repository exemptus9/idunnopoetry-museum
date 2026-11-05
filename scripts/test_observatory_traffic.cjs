const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const source=fs.readFileSync('museum-static/project-observatory.js','utf8');
async function setup({path='/idunnopoetry-museum/',hash='',dnt=false,gpc=false,optout=false}={}){const dom=new JSDOM('<!doctype html><body><button data-idp-traffic-optout>Toggle</button></body>',{url:'https://exemptus9.github.io'+path+hash,runScripts:'outside-only'}),w=dom.window,calls=[];if(optout)w.localStorage.setItem('idp-audience-optout-v1','1');Object.defineProperty(w.navigator,'doNotTrack',{value:dnt?'1':'0'});Object.defineProperty(w.navigator,'globalPrivacyControl',{value:gpc});w.fetch=(url,o)=>{calls.push(JSON.parse(o.body));return Promise.resolve({ok:true})};w.eval(source);return {dom,w,calls};}
(async()=>{
 let t=await setup({hash:'#poem/123?secret=abc'});assert.equal(t.calls.length,1);assert.equal(t.calls[0].path,'/idunnopoetry-museum/section/poem/123');assert(!JSON.stringify(t.calls).includes('secret'));
 for(const h of ['#search/private-words','#reclaim/person','#user/42','#verify']){t.w.location.hash=h;await new Promise(r=>setImmediate(r));assert.equal(t.calls.length,1,h)}
 t.w.location.hash='#poetry';await new Promise(r=>setImmediate(r));assert.equal(t.calls[1].path,'/idunnopoetry-museum/section/poetry');
 t.w.document.querySelector('[data-idp-traffic-optout]').click();t.w.location.hash='#forums';await new Promise(r=>setImmediate(r));assert.equal(t.calls.length,2,'Opt-out must stop collection');t.dom.window.close();
 for(const o of [{dnt:true},{gpc:true},{optout:true},{path:'/idunnopoetry-museum/observatory/',hash:'#review'},{path:'/idunnopoetry-museum/observatory/',hash:'#author'},{path:'/idunnopoetry-museum/observatory/',hash:'#laboratory'},{path:'/idunnopoetry-museum/admin/'}]){const v=await setup(o);assert.equal(v.calls.length,0,JSON.stringify(o));v.dom.window.close()}
 for(const [path,expected] of [['/idunnopoetry-museum/observatory/','/idunnopoetry-museum/observatory/'],['/idunnopoetry-museum/projects/','/idunnopoetry-museum/projects/']]){const v=await setup({path});assert.equal(v.calls[0].path,expected);v.dom.window.close()}
 console.log('PASS museum traffic: public-only routes, no search/identity content, privacy signals, opt-out and separate project paths.');
})().catch(e=>{console.error(e);process.exitCode=1});
