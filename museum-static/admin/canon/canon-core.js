/* Universal canon, using the existing protected editorial store. No new auth grants.
 * Source-selected text is not publication permission. Hashes are integrity checks, not signatures.
 */
(function(root){
'use strict';
const P=root.IDP_PRESERVATION,SCHEMA='UniversalWritingCanon/1',INTAKE='UniversalWritingCanonIntake/1';
const PREFIX='canon:v1:',STORE_PREFIX='canon__',KEY=/^[A-Za-z0-9_-]{1,120}$/,DESTINATIONS=['museum','rhymemosaic'];
const fail=(ok,message)=>{if(!ok)throw Error(message);};
const copy=value=>P.clone(value);
function storageKey(workId){fail(KEY.test(workId||'')&&workId.length<=113,'Work ID is not representable in the protected canon namespace.');return STORE_PREFIX+workId;}
async function parseIntake(raw){
 fail(typeof raw==='string'&&new TextEncoder().encode(raw).length<=8000000,'Choose a canon intake file under 8 MB.');
 const envelope=JSON.parse(raw);P.stable(envelope);
 fail(envelope.format===INTAKE&&typeof envelope.payload==='string','Not a supported canon intake file.');
 fail(await P.digest(envelope.payload)===envelope.sha256,'Package checksum mismatch. Nothing was imported.');
 const data=JSON.parse(envelope.payload);P.stable(data);
 fail(Array.isArray(data.works)&&data.works.length>0&&data.works.length<=5000,'An intake needs 1–5,000 work records.');
 const seen=new Set();let versions=0,selected=0;
 for(const work of data.works){
  fail(KEY.test(work.work_id||'')&&!seen.has(work.work_id),'Missing or duplicate work ID. Titles never identify a work.');seen.add(work.work_id);storageKey(work.work_id);
  fail(typeof work.title==='string'&&work.title.length>0&&work.title.length<=240,'Invalid title.');
  fail(Array.isArray(work.versions)&&work.versions.length<=500,'Invalid witness collection.');
  const ids=new Set();
  for(const v of work.versions){
   fail(KEY.test(v.witness_id||'')&&!ids.has(v.witness_id),'Missing or duplicate witness identity.');ids.add(v.witness_id);
   fail(typeof v.text==='string'&&new TextEncoder().encode(v.text).length<=100000,'Invalid or oversized witness text.');
   fail(await P.textDigest(v.text)===v.sha256,'Witness checksum mismatch: '+work.work_id);versions++;
  }
  fail(!work.selected_version||ids.has(work.selected_version),'Selected source witness is missing.');
  if(work.selected_version)selected++;
  fail(new TextEncoder().encode(JSON.stringify(work)).length<160000,'This work needs a separately reviewed large-history import.');
 }
 return {data,sha256:envelope.sha256,workCount:seen.size,witnessCount:versions,selectedCount:selected};
}
function isCanon(record){return record?.kind==='creative'&&record?.draft?._canon?.schema===SCHEMA&&record.entity_key===STORE_PREFIX+record.draft._canon.work_id;}
function fromIntake(work,sourceSHA){
 const v=work.versions.find(x=>x.witness_id===work.selected_version);
 return {kind:'creative',entity_key:storageKey(work.work_id),title:work.title,draft:{
  text:v?.text||'',provenance:'uncertain',status:work.classification==='CANON-A'?'finished':'candidate',label:PREFIX,
  _canon:{schema:SCHEMA,work_id:work.work_id,classification:work.classification||'DRAFT',
   redirect_to:work.redirect_to||null,selected_version:work.selected_version||null,
   source_package_sha256:sourceSHA,source_metadata:copy(work.metadata||{}),
   witnesses:copy(work.versions),selection_authority:work.selected_version?'source_selected':'none',
   confirmation:null,publication_intent:null}
 }};
}
async function importDisposition(existing,incoming){
 if(!existing)return 'new';
 fail(isCanon(existing),'An existing editorial record already uses this work ID. Resolve the collision; do not overwrite.');
 const old=existing.draft._canon;
 for(const v of incoming.versions){
  const kept=old.witnesses.find(x=>x.witness_id===v.witness_id);
  fail(kept&&kept.sha256===v.sha256&&kept.text===v.text,'Witness collections differ. Keep both packages; no automatic overwrite.');
 }
 // A repeat import must never reset a newer author decision or private revision.
 return 'existing';
}
function selected(record){return record?.draft?._canon?.witnesses?.find(v=>v.witness_id===record.draft._canon.selected_version)||null;}
function questions(record,version=selected(record)){
 const out=[];const c=record?.draft?._canon;
 if(!c)return ['Not a universal canon record.'];
 if(c.redirect_to)out.push('Redirect identity: '+c.redirect_to+'. Do not create another poem.');
 if(c.classification==='EXCLUDED')out.push('Deliberately excluded work. Do not silently reclassify.');
 for(const hold of c.source_metadata?.holds||[])out.push(typeof hold==='string'?hold:hold.description||hold.code||'Source decision required.');
 if(!version)out.push('No selected text. This identity is preserved without inventing its missing body.');
 else out.push(...P.reviewFlags(version.text));
 return [...new Set(out)];
}
async function verified(record){
 fail(isCanon(record),'Not a canon record.');const v=selected(record);
 fail(v&&typeof record.draft.text==='string','Choose a complete source witness first.');
 fail(v.text===record.draft.text&&await P.textDigest(v.text)===v.sha256,'Stored canon text and selected witness disagree.');
 return v;
}
async function confirmVersion(record,witnessId,{authorship,reviewed,complete}){
 fail(isCanon(record),'Not a canon record.');const out=copy(record),c=out.draft._canon;
 fail(!c.redirect_to&&c.classification!=='EXCLUDED','Excluded and redirected records require separate identity review.');
 const v=c.witnesses.find(x=>x.witness_id===witnessId);fail(v&&await P.textDigest(v.text)===v.sha256,'Unverified witness.');
 fail(['brandon','assisted','mixed','ai','external'].includes(authorship),'Choose the supported authorship classification.');
 fail(complete===true,'Confirm this is the complete text you want to use.');
 fail(!questions(record,v).length||reviewed===true,'Review the source questions first.');
 out.draft.text=v.text;out.draft.provenance=authorship;out.draft.status='finished';out.draft.label=PREFIX;
 c.selected_version=v.witness_id;c.selection_authority='author_confirmed';c.classification='CANON-A';
 c.confirmation={witness_id:v.witness_id,text_sha256:v.sha256,title:out.title,authorship,reviewed_questions:questions(record,v),at:new Date().toISOString()};
 c.publication_intent=null;return out;
}
async function addVersion(record,title,text){
 fail(typeof title==='string'&&title.length>0&&title.length<=240,'A title is required.');
 fail(typeof text==='string'&&text.length>0&&new TextEncoder().encode(text).length<=100000,'Add the complete text, up to 100 KB.');
 const out=copy(record),c=out.draft._canon;
 const id='version-'+root.crypto.randomUUID(),sha256=await P.textDigest(text);
 c.witnesses.push({witness_id:id,title,text,sha256,source_metadata:{origin:'owner_revision',parent:c.selected_version,at:new Date().toISOString()}});
 c.selected_version=id;c.selection_authority='source_selected';c.confirmation=null;c.publication_intent=null;
 out.title=title;out.draft.text=text;out.draft.label=PREFIX;
 fail(new TextEncoder().encode(JSON.stringify(out.draft)).length<175000,'Version history is too large for one editorial record. Export and use a reviewed migration.');
 return out;
}
function targets(label){
 if(typeof label!=='string'||!label.startsWith(PREFIX))return [];
 return label.slice(PREFIX.length).split(',').filter(x=>DESTINATIONS.includes(x));
}
async function releaseDraft(record,destinations){
 const v=await verified(record),c=record.draft._canon,approval=c.confirmation;
 fail(approval&&c.selection_authority==='author_confirmed'&&approval.witness_id===v.witness_id&&approval.text_sha256===v.sha256&&approval.title===record.title&&approval.authorship===record.draft.provenance,'Confirm the exact current text and authorship before releasing.');
 fail(Array.isArray(destinations)&&destinations.length>0&&destinations.every(x=>DESTINATIONS.includes(x)),'Choose a supported public destination.');
 const out=copy(record);const chosen=[...new Set(destinations)].sort();
 out.draft.label=PREFIX+chosen.join(',');out.draft._canon.publication_intent={destinations:chosen,witness_id:v.witness_id,text_sha256:v.sha256,at:new Date().toISOString()};
 return out;
}
function bulkEligible(record){
 const c=record?.draft?._canon;
 return isCanon(record)&&c.classification==='CANON-A'&&!c.redirect_to&&!c.confirmation&&!!selected(record)&&questions(record).length===0;
}
async function bookManifest(records,bookId){
 fail(['brandonmeant','wreckage'].includes(bookId),'Unknown book.');
 const entries=[];
 for(const r of records){
  if(!isCanon(r))continue;
  for(const membership of r.draft._canon.source_metadata?.book_memberships||[]){
   if(membership.book_id!==bookId)continue;
   fail(Number.isSafeInteger(membership.position)&&membership.position>0,'Invalid book placement.');
   const v=selected(r);if(v)await verified(r);
   entries.push({position:membership.position,work_id:r.draft._canon.work_id,title:r.title,
    witness_id:v?.witness_id||null,text:v?.text??null,sha256:v?.sha256||null,
    selection_authority:r.draft._canon.selection_authority,questions:questions(r),publication_permission:'NOT_GRANTED'});
  }
 }
 entries.sort((a,b)=>a.position-b.position);
 fail(new Set(entries.map(x=>x.position)).size===entries.length,'Duplicate book position: preserve the conflicting manifest for review.');
 const expected=bookId==='brandonmeant'?49:77;
 return {schema:'UniversalWritingCanonBookCandidate/1',book_id:bookId,
  title:bookId==='brandonmeant'?'BRANDONMEANT':'THE WRECKAGE ARRANGED ME',
  status:'PRIVATE_REVIEW_CANDIDATE_NOT_PUBLICATION_APPROVED',expected_placements:expected,
  complete_sequence:entries.length===expected&&entries.every((x,i)=>x.position===i+1),
  entries};
}
async function publicManifest(rows,destination){
 fail(DESTINATIONS.includes(destination),'Unknown publication destination.');
 const works=[];
 for(const row of rows){
  if(row.kind!=='creative'||row.state!=='published'||!row.entity_key?.startsWith(STORE_PREFIX)||!targets(row.payload?.label).includes(destination))continue;
  const p=row.payload;
  fail(KEY.test(row.entity_key||'')&&typeof p.title==='string'&&typeof p.text==='string','Malformed published record.');
  works.push({work_id:row.entity_key.slice(STORE_PREFIX.length),title:p.title,text:p.text,sha256:await P.textDigest(p.text),authorship:p.provenance||'uncertain',editorial_revision:row.revision,published_at:row.published_at});
 }
 const payload={schema:'UniversalWritingCanonPublic/1',destination,empty_policy:'DO_NOT_REPLACE_EXISTING_ARCHIVES',works};
 return {...payload,manifest_sha256:await P.digest(P.stable(payload))};
}
async function packBackup(records,histories){
 for(const r of records){fail(isCanon(r),'Only canon records belong in this backup.');await P.pack(r,histories.filter(x=>x.document_id===r.id),'Universal canon');}
 const payload=P.stable({schema:'UniversalWritingCanonBackup/1',scope:'All loaded canon records and their complete editorial histories. Excludes authentication, external source archives and hosting configuration.',created_at:new Date().toISOString(),records,histories});
 return {format:'UniversalWritingCanonBackupEnvelope/1',payload,sha256:await P.digest(payload)};
}
async function inspectBackup(raw,current){
 const e=typeof raw==='string'?JSON.parse(raw):raw;P.stable(e);
 fail(e.format==='UniversalWritingCanonBackupEnvelope/1'&&await P.digest(e.payload)===e.sha256,'Backup checksum mismatch.');
 const data=JSON.parse(e.payload);fail(data.schema==='UniversalWritingCanonBackup/1'&&Array.isArray(data.records)&&Array.isArray(data.histories),'Unsupported backup data.');
 const seen=new Set();let matching=0,missing=0,conflicting=0;
 for(const r of data.records){
  fail(isCanon(r)&&!seen.has(r.entity_key),'Duplicate or invalid backup identity.');seen.add(r.entity_key);
  await P.pack(r,data.histories.filter(x=>x.document_id===r.id),'Recovery inspection');
  const live=current.find(x=>x.entity_key===r.entity_key);
  if(!live)missing++;else if(await P.contentDigest(live)===await P.contentDigest(r))matching++;else conflicting++;
 }
 return {matching,missing,conflicting,records:data.records.length,checksum:e.sha256,writes:0};
}
root.IDP_CANON=Object.freeze({SCHEMA,INTAKE,PREFIX,STORE_PREFIX,storageKey,DESTINATIONS,parseIntake,isCanon,fromIntake,importDisposition,selected,questions,verified,confirmVersion,addVersion,targets,releaseDraft,bulkEligible,bookManifest,publicManifest,packBackup,inspectBackup});
})(typeof window==='undefined'?globalThis:window);
