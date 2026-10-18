/* Exact-text preservation tools. No network, storage, authorization or publication.
 * SHA-256 verifies consistency, NOT authorship or the authenticity of an approval.
 */
(function(root){
'use strict';
const FORMAT='IDP-Editorial-Recovery-v1',MAX_BYTES=8*1024*1024,MAX_RECORDS=5000;
const KEY=/^[A-Za-z0-9_-]{1,120}$/,HASH=/^[a-f0-9]{64}$/;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function object(x){return x!==null&&typeof x==='object'&&!Array.isArray(x);}
function assert(ok,msg){if(!ok)throw Error(msg);}
function stable(x,depth=0){
 assert(depth<40,'JSON is too deeply nested.');
 if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);
 if(typeof x==='number'){assert(Number.isFinite(x),'Non-finite number.');return JSON.stringify(x);}
 if(Array.isArray(x))return '['+x.map(v=>stable(v,depth+1)).join(',')+']';
 assert(object(x),'Unsupported value in preservation data.');
 const keys=Object.keys(x).sort();
 assert(!keys.some(k=>['__proto__','prototype','constructor'].includes(k)),'Unsafe property in data.');
 return '{'+keys.map(k=>JSON.stringify(k)+':'+stable(x[k],depth+1)).join(',')+'}';
}
const clone=x=>JSON.parse(stable(x));
async function digest(value){
 assert(root.crypto?.subtle,'Secure hashing is unavailable. Use this page over HTTPS.');
 const bytes=typeof value==='string'?new TextEncoder().encode(value):value;
 const sum=await root.crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(sum),v=>v.toString(16).padStart(2,'0')).join('');
}
const textDigest=text=>{assert(typeof text==='string','Text must be a string.');return digest(text);};
const contentDigest=record=>digest(stable({title:record.title,draft:record.draft}));
function textStats(text){
 assert(typeof text==='string','Text must be a string.');
 const eols=text.match(/\r\n|\r|\n/g)||[];
 return {characters:Array.from(text).length,bytes:new TextEncoder().encode(text).length,
  lines:text===''?0:eols.length+1,crlf:eols.filter(x=>x==='\r\n').length,
  lf:eols.filter(x=>x==='\n').length,cr:eols.filter(x=>x==='\r').length,
  finalNewline:/[\r\n]$/.test(text)};
}
function reviewFlags(text){
 const flags=[];
 if(/(^|\r?\n)[\t ]*(?:\.{3,}|…+)[\t ]*(?:\r?\n|$)/.test(text))
  flags.push('Standalone ellipsis: inspect the original for a transfer gap. Do not reconstruct missing text.');
 if(/\uFFFD/.test(text))flags.push('Replacement character: possible encoding loss.');
 if(/(^|\r?\n)\s*\[(?:verse|chorus|bridge)(?:[^\]]*)\]/i.test(text))
  flags.push('Song-section marker: confirm that this label is authorial.');
 return flags;
}
function lineTokens(s){return s.match(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/g)||[];}
function diff(before,after,{maxCells=350000}={}){
 assert(typeof before==='string'&&typeof after==='string','Compare text strings only.');
 const a=lineTokens(before),b=lineTokens(after);let first=0,last=0;
 while(first<a.length&&first<b.length&&a[first]===b[first])first++;
 while(last<a.length-first&&last<b.length-first&&a[a.length-1-last]===b[b.length-1-last])last++;
 const left=a.slice(first,a.length-last),right=b.slice(first,b.length-last);
 const out=a.slice(0,first).map(text=>({op:'equal',text}));let coarse=false;
 if((left.length+1)*(right.length+1)>maxCells){
  coarse=true;out.push(...left.map(text=>({op:'remove',text})),...right.map(text=>({op:'add',text})));
 }else{
  const width=right.length+1,grid=new Uint32Array((left.length+1)*width);
  for(let i=left.length-1;i>=0;i--)for(let j=right.length-1;j>=0;j--)
   grid[i*width+j]=left[i]===right[j]?1+grid[(i+1)*width+j+1]:Math.max(grid[(i+1)*width+j],grid[i*width+j+1]);
  let i=0,j=0;
  while(i<left.length||j<right.length){
   if(i<left.length&&j<right.length&&left[i]===right[j]){out.push({op:'equal',text:left[i++]});j++;}
   else if(j<right.length&&(i===left.length||grid[i*width+j+1]>=grid[(i+1)*width+j]))out.push({op:'add',text:right[j++]});
   else out.push({op:'remove',text:left[i++]});
  }
 }
 out.push(...a.slice(a.length-last).map(text=>({op:'equal',text})));
 return {equal:before===after,coarse,added:out.filter(x=>x.op==='add').length,
  removed:out.filter(x=>x.op==='remove').length,rows:out,before:textStats(before),after:textStats(after)};
}
function checkRecord(r){
 assert(object(r)&&typeof r.id==='string'&&r.id.length<=128,'Missing record identity.');
 assert(typeof r.kind==='string'&&KEY.test(r.entity_key),'Invalid record kind or key.');
 assert(typeof r.title==='string'&&r.title.length<=240&&object(r.draft),'Invalid title or draft.');
 assert(Number.isSafeInteger(r.revision)&&r.revision>0,'Invalid current revision.');
 stable(r);
}
async function pack(record,versions,source){
 checkRecord(record);assert(Array.isArray(versions)&&versions.length<=MAX_RECORDS,'Invalid history size.');
 const data={scope:'one-editorial-record',source:String(source||''),exportedAt:new Date().toISOString(),
  record:clone(record),versions:clone(versions)};
 const envelope={format:FORMAT,data,sha256:await digest(stable(data))};
 assert(new TextEncoder().encode(JSON.stringify(envelope)).length<=MAX_BYTES,'Recovery bundle exceeds 8 MiB.');
 await verify(envelope);return envelope;
}
async function verify(input){
 // The pure import API must enforce the same bound as the file picker, including
 // callers outside that UI. Count UTF-8 bytes before parsing a string.
 if(typeof input==='string')assert(new TextEncoder().encode(input).length<=MAX_BYTES,'Recovery bundle exceeds 8 MiB.');
 const p=typeof input==='string'?JSON.parse(input):input;
 assert(object(p)&&p.format===FORMAT&&object(p.data)&&HASH.test(p.sha256||''),'Unsupported recovery format.');
 assert(new TextEncoder().encode(stable(p)).length<=MAX_BYTES,'Recovery bundle exceeds 8 MiB.');
 assert(await digest(stable(p.data))===p.sha256,'Recovery checksum mismatch. Nothing was imported.');
 const {record:r,versions:v}=p.data;checkRecord(r);
 assert(p.data.scope==='one-editorial-record'&&Array.isArray(v)&&v.length<=MAX_RECORDS,'Invalid recovery scope.');
 const seen=new Set();
 for(const x of v){
  assert(object(x)&&Number.isSafeInteger(x.version)&&x.version>0&&x.version<=r.revision,'Invalid historical revision.');
  assert(x.document_id===r.id&&!seen.has(x.version),'Duplicate or unrelated historical revision.');
  assert(typeof x.title==='string'&&object(x.draft),'History must contain complete title and draft.');seen.add(x.version);
 }
 assert(v.length===r.revision,'History is incomplete; this cannot be labeled a full record-history bundle.');
 for(let i=1;i<=r.revision;i++)assert(seen.has(i),'A historical revision is missing.');
 const head=v.find(x=>x.version===r.revision);
 assert(await contentDigest(head)===await contentDigest(r),'Latest history differs from current draft.');
 return {envelope:clone(p),versions:v.length,contentSHA256:await contentDigest(r),
  textSHA256:typeof r.draft.text==='string'?await textDigest(r.draft.text):null};
}
async function recoveryPlan(bundle,records){
 const checked=await verify(bundle),old=checked.envelope.data.record;
 const current=records.find(x=>x.id===old.id)||records.find(x=>x.kind===old.kind&&x.entity_key===old.entity_key);
 if(!current)return {state:'missing',label:'Not present in the loaded workspace. No automatic creation.',writes:0};
 const same=await contentDigest(old)===await contentDigest(current);
 return {state:same?'same':'conflict',label:same?'Content matches the loaded record.':
  'Different content: keep both witnesses. Never overwrite the current revision from this file.',
  currentRevision:current.revision,fileRevision:old.revision,writes:0};
}
async function registry(input){
 assert(typeof input==='string'&&new TextEncoder().encode(input).length<=MAX_BYTES,'Registry is empty or exceeds 8 MiB.');
 let raw=input.trim(),sourceType='json';
 if(raw.startsWith('<')){
  // Parse ONLY the known inert report data block; never insert or execute report HTML.
  const re=/<script\b(?=[^>]*\bid\s*=\s*["']work-data["'])(?=[^>]*\btype\s*=\s*["']application\/json["'])[^>]*>([\s\S]*?)<\/script\s*>/gi;
  const matches=Array.from(raw.matchAll(re));assert(matches.length===1,'Expected one inert work-data JSON block.');
  raw=matches[0][1];sourceType='MAX02-report';
 }
 const parsed=JSON.parse(raw);stable(parsed);
 const rows=Array.isArray(parsed)?parsed:parsed.works||parsed.records;
 assert(Array.isArray(rows)&&rows.length<=MAX_RECORDS,'Expected an array of canonical work records.');
 const seen=new Set(),works=[];
 for(const row of rows){
  assert(object(row)&&KEY.test(row.work_id||''),'Registry work_id is required; title matching is not an identity rule.');
  assert(!seen.has(row.work_id),'Duplicate work_id: '+row.work_id);seen.add(row.work_id);
  assert(typeof row.title==='string'&&row.title.length<=240,'Invalid registry title.');
  const text=typeof row.canonical_text==='string'?row.canonical_text:null;
  const hash=text===null?null:await textDigest(text),claimed=String(row.sha256||'').toLowerCase();
  works.push({work_id:row.work_id,title:row.title,text,sha256:hash,claimedSHA256:claimed,
   verified:!!hash&&HASH.test(claimed)&&hash===claimed,
   witness_id:typeof row.canonical_witness_id==='string'?row.canonical_witness_id:null,
   source_id:typeof row.source_id==='string'?row.source_id:null,
   reportedCanonStatus:typeof row.canon_status==='string'?row.canon_status:'unreported',
   reportedPublicApproval:row.public_export_approved===true,
   flags:text===null?['No selected canonical text.']:reviewFlags(text)});
 }
 return {sourceType,works,sourceSHA256:await digest(input),
  verified:works.filter(x=>x.verified).length,missing:works.filter(x=>x.text===null).length};
}
function stageWork(work,sourceSHA256,reviewed=false){
 assert(work?.verified&&typeof work.text==='string','Unverified text cannot enter the editor through this bridge.');
 assert(!work.flags?.length||reviewed,'Inspect source-quality flags before staging this witness.');
 return {kind:'creative',entity_key:work.work_id,title:work.title,
  draft:{text:work.text,provenance:'uncertain',_canonical_source:{work_id:work.work_id,
   witness_id:work.witness_id,source_id:work.source_id,text_sha256:work.sha256,
   registry_sha256:sourceSHA256,relationship:'source-witness',
   reported_canon_status:work.reportedCanonStatus,publication_permission:'NOT_IMPORTED'}}};
}
const api=Object.freeze({FORMAT,MAX_BYTES,stable,clone,digest,textDigest,contentDigest,textStats,reviewFlags,diff,
 pack,verify,recoveryPlan,registry,stageWork});
root.IDP_PRESERVATION=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
