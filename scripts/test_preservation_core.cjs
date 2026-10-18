'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
if(!globalThis.crypto)globalThis.crypto=crypto.webcrypto;
// Execute the actual classic browser script; repository package.json may specify type=module.
const corePath=require('node:path').join(__dirname,'../museum-static/admin/preservation-core.js');
require('node:vm').runInThisContext(fs.readFileSync(corePath,'utf8'),{filename:corePath});
const C=globalThis.IDP_PRESERVATION;
(async()=>{
 let checks=0;const ok=(v,m)=>{assert(v,m);checks++};
 const rejects=async(fn,re)=>{await assert.rejects(fn,re);checks++};
 const original='I keep the line.\r\n\r\nAnd the silence…\r\n';
 ok(await C.textDigest(original)===crypto.createHash('sha256').update(original).digest('hex'),'exact UTF-8 digest');
 ok(await C.textDigest(original)!==await C.textDigest(original.replace(/\r\n/g,'\n')),'line-ending differences remain significant');
 ok(await C.textDigest('e\u0301')!==await C.textDigest('é'),'Unicode is not silently normalized');
 const stats=C.textStats(original);ok(stats.crlf===3&&stats.lf===0&&stats.finalNewline,'stats preserve CRLF');
 ok(C.reviewFlags('First\n...\nLast').length===1,'detect potential transfer gaps');
 ok(C.reviewFlags('An intentional trailing thought...').length===0,'ordinary ellipsis is not corruption');
 const d=C.diff('a\nb\na\n','a\nc\na\n');ok(d.added===1&&d.removed===1,'line diff');
 ok(d.rows.filter(x=>x.op!=='add').map(x=>x.text).join('')==='a\nb\na\n','before can be reconstructed');
 ok(d.rows.filter(x=>x.op!=='remove').map(x=>x.text).join('')==='a\nc\na\n','after can be reconstructed');
 ok(!C.diff('x\r\n','x\n').equal,'CRLF/LF distinction');
 ok(C.diff('x\n'.repeat(800),'y\n'.repeat(800)).coarse,'bounded large diff');
 ok(C.diff('','').equal&&C.diff('','new').added===1,'empty text handled');
 const record={id:'work-id-1',kind:'creative',entity_key:'stable-work',title:'An exact work',revision:2,
  approved_revision:null,status:'draft',draft:{text:original,_canonical_source:{work_id:'work-1',text_sha256:await C.textDigest(original)}}};
 const versions=[{document_id:record.id,version:1,title:'Earlier title',draft:{text:'original'}},
 {document_id:record.id,version:2,title:record.title,draft:record.draft}];
 const p=await C.pack(record,versions,'local-test');const verified=await C.verify(JSON.stringify(p));
 ok(verified.versions===2&&verified.envelope.data.record.draft.text===original,'export/read round-trip exact');
 ok((await C.recoveryPlan(p,[record])).state==='same','identical recovery dry-run');
 ok((await C.recoveryPlan(p,[{...record,draft:{text:'newer'}}])).state==='conflict','never overwrite a newer witness');
 ok((await C.recoveryPlan(p,[])).writes===0,'dry run writes nothing');
 const bad=C.clone(p);bad.data.record.title='changed';await rejects(()=>C.verify(bad),/checksum/);
 // Reject an over-limit raw file before JSON parsing, and do not let an object
 // caller bypass the picker limit. Multibyte UTF-8 must count as bytes.
 await rejects(()=>C.verify(' '.repeat(C.MAX_BYTES+1)),/exceeds 8 MiB/);
 await rejects(()=>C.verify('é'.repeat(C.MAX_BYTES/2+1)),/exceeds 8 MiB/);
 const oversized=C.clone(p);oversized.data.record.draft.text='x'.repeat(C.MAX_BYTES);
 await rejects(()=>C.verify(oversized),/exceeds 8 MiB/);
 await rejects(()=>C.pack(record,versions.slice(0,1),'test'),/incomplete/);
 await rejects(()=>C.pack(record,[versions[1],versions[1]],'test'),/Duplicate/);
 await rejects(()=>C.pack(record,[versions[0],{...versions[1],draft:{text:'mismatched'}}],'test'),/differs/);
 const row={work_id:'stable-01',title:'A title',canonical_text:original,sha256:await C.textDigest(original),
  canonical_witness_id:'w-01',canon_status:'CANON-A',public_export_approved:true};
 const reg=await C.registry(JSON.stringify([row]));ok(reg.verified===1,'adapter verifies existing flat canonical schema');
 const stage=C.stageWork(reg.works[0],reg.sourceSHA256);ok(stage.draft.text===original,'staging keeps exact text');
 ok(stage.draft.provenance==='uncertain'&&stage.draft._canonical_source.publication_permission==='NOT_IMPORTED','never replay approval or infer authorship');
 const html='<html><script>throw Error("must not run")</script><script id="work-data" type="application/json">'+JSON.stringify([row])+'</script></html>';
 ok((await C.registry(html)).verified===1,'read inert report data without executing HTML');
 await rejects(()=>C.registry(JSON.stringify([row,row])),/Duplicate work_id/);
 const mismatch=await C.registry(JSON.stringify([{...row,sha256:'0'.repeat(64)}]));
 ok(mismatch.works[0].verified===false,'mismatch blocks exact-text bridge');
 assert.throws(()=>C.stageWork(mismatch.works[0],'x'),/Unverified/);checks++;
 const missing=await C.registry(JSON.stringify([{...row,canonical_text:null,sha256:null}]));ok(missing.missing===1,'missing text stays missing');
 const gap='start\n...\nend',g=await C.registry(JSON.stringify([{...row,canonical_text:gap,sha256:await C.textDigest(gap)}]));
 assert.throws(()=>C.stageWork(g.works[0],'x'),/Inspect/);checks++;
 ok(C.stageWork(g.works[0],'x',true).draft.text===gap,'explicit source-quality review does not rewrite text');
 await rejects(()=>C.registry('[{"work_id":"x","title":"t","__proto__":{}}]'),/Unsafe/);
 ok(C.stable({b:2,a:1})===C.stable({a:1,b:2}),'deterministic JSON order');
 console.log('PASS: '+checks+' preservation invariants. No private data, network calls or production writes.');
})().catch(e=>{console.error(e);process.exitCode=1});
