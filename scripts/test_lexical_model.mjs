import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeCatalog, findPublicTerm, searchTerms, searchScore, createSearchIndex, relatedTo, publicVersions, versionAt, csvExport, publicJsonExport, featuredTerms, preparePublicChange, safeUrl, definitionDiff, editDistance, validatePublicTransport} from '../museum-static/observatory/model.js';

const publicTerm = (id, headword, extra = {}) => ({id, headword, slug: headword.toLowerCase(), stage:'forge', visibility:'approved_public', definition:'An example definition about weather.', revision:1, publication:{approvedAt:'2026-01-01',approvedRevision:1}, ...extra});
const project = (terms, relations=[], versions=[]) => normalizeCatalog({terms,relations,versions});

test('deployed projection contains only explicit public records and a valid contract', () => {
  const raw=JSON.parse(readFileSync(new URL('../museum-static/observatory/public.json',import.meta.url),'utf8'));
  const catalog=normalizeCatalog(raw);
  for(const field of ['terms','relations','versions'])assert.ok(raw[field].every(row=>row.visibility==='approved_public'));
  assert.equal(catalog.terms.length,raw.terms.length);assert.deepEqual(project([]).terms,[]);
});
test('public review metadata is whitelisted and retains source-qualified definition states', () => {
  const c=project([publicTerm('a','Example',{definitionStatus:'conversation_recovered',review:{state:'deferred',flags:['source_needed','private_flag'],definitionBasis:'conversation_recovered',note:'A public source question.',privateBody:'PRIVATE_SENTINEL'}})]);
  assert.equal(c.terms[0].definitionStatus,'conversation_recovered');
  assert.deepEqual(c.terms[0].review,{state:'deferred',flags:['source_needed'],definitionBasis:'conversation_recovered',note:'A public source question.'});
  const exported=publicJsonExport(c);
  assert.deepEqual(exported.terms[0].review,c.terms[0].review);
  assert.ok(!JSON.stringify(exported).includes('PRIVATE_SENTINEL'));
  assert.deepEqual(normalizeCatalog(exported).terms[0].review,c.terms[0].review);
});
test('expanded classifications are retained, filterable and exportable', () => {
  for(const classification of ['proper_name','literary_wordplay','concept_label','ai_suggestion','existing_term']) {
    const c=project([publicTerm('a','Example',{classification})]);
    assert.equal(c.terms[0].classification,classification);
    assert.equal(searchTerms(c,{classification})[0].id,'a');
    assert.equal(normalizeCatalog(publicJsonExport(c)).terms[0].classification,classification);
  }
});
test('public request transport guard accounts for nested GitHub input JSON escaping', () => {
  assert.deepEqual(validatePublicTransport({action:'update'}),{action:'update'});
  assert.throws(()=>validatePublicTransport({text:'x'.repeat(60000)}),/GitHub input limit/);
  assert.throws(()=>validatePublicTransport({text:'"'.repeat(25000)}),/GitHub input limit/);
});
test('review state, flag, definition basis, classification and tag filters combine', () => {
  const c=project([publicTerm('a','Example',{classification:'coinage_candidate',tags:['provisional'],definitionStatus:'inferred_definition',review:{state:'open',flags:['meaning_inferred','source_needed'],definitionBasis:'inferred',note:''}}),publicTerm('b','Other',{review:{state:'resolved',flags:[],definitionBasis:'author_supplied',note:''}})]);
  assert.deepEqual(searchTerms(c,{reviewState:'open',reviewFlag:'meaning_inferred',definitionBasis:'inferred',classification:'coinage_candidate',tag:'provisional',definitionState:'defined'}).map(t=>t.id),['a']);
  assert.equal(searchTerms(c,{reviewState:'resolved',reviewFlag:'source_needed'}).length,0);
  assert.deepEqual(searchTerms(c,{definitionBasis:'author_supplied'}).map(t=>t.id),['b']);
});
test('public edit preparation preserves review objects and accepts tags while rejecting extra review metadata', () => {
  const t=project([publicTerm('a','Example',{definitionStatus:'inferred_definition',classification:'coinage_candidate'})]).terms[0];
  const review={state:'resolved',flags:[],definitionBasis:'conversation_recovered',note:'Public evidence reviewed.'};
  const input={action:'update',expectedRevision:1,headword:t.headword,stage:'forge',definition:t.definition,classification:t.classification,definitionStatus:t.definitionStatus,formation:'',provenanceSummary:'',roots:'[]',domains:'[]',variants:'[]',collections:'[]',tags:'["reviewed"]',review:JSON.stringify(review),confirmPublication:'PUBLISH Example'};
  const change=preparePublicChange(input,t);
  assert.deepEqual(change.changes.review,review);assert.deepEqual(change.changes.tags,['reviewed']);
  assert.throws(()=>preparePublicChange({...input,review:{...review,privateBody:'PRIVATE_SENTINEL'}},t));
});
test('only explicitly approved-public terms are projected', () => {
  const catalog=project([publicTerm('a','Example'),publicTerm('b','Hidden',{visibility:'private'}),publicTerm('c','Draft',{visibility:'draft'}),publicTerm('d','Ambiguous',{visibility:'public'})]);
  assert.deepEqual(catalog.terms.map(t=>t.id),['a']);assert.equal(findPublicTerm(catalog,'b'),null);assert.equal(findPublicTerm(catalog,'hidden'),null);
});
test('only public IDs and slugs resolve', () => {
  const catalog=project([publicTerm('stable-id','Example')]);
  assert.equal(findPublicTerm(catalog,'stable-id').headword,'Example');assert.equal(findPublicTerm(catalog,'example').id,'stable-id');assert.equal(findPublicTerm(catalog,'missing'),null);
});
test('duplicates and unsafe slugs are omitted, not coalesced', () => {
  const catalog=project([publicTerm('a','Example'),publicTerm('a','Other'),publicTerm('b','Example'),publicTerm('c','Traversal',{slug:'../../private'})]);
  assert.equal(catalog.terms.length,1);
});
test('public projection excludes arbitrary fields and private nested witnesses/senses', () => {
  const catalog=project([publicTerm('a','Example',{rawPrivateSource:'sensitive',ownerId:'private-uuid',witnesses:[{visibility:'private',title:'Private source',body:'secret'},{visibility:'approved_public',title:'Public summary',summary:'Approved context',privateBody:'hidden'}],senses:[{visibility:'private',definition:'secret'},{visibility:'approved_public',definition:'Approved sense'}]})]);
  const json=JSON.stringify(catalog);assert.ok(!json.includes('sensitive'));assert.ok(!json.includes('private-uuid'));assert.ok(!json.includes('secret'));assert.ok(!json.includes('hidden'));assert.equal(catalog.terms[0].witnesses[0].summary,'Approved context');
});
test('unsigned or stale Canon record is omitted and warning is explicit', () => {
  const catalog=project([publicTerm('a','Unsigned',{stage:'canon'}),publicTerm('b','Stale',{stage:'canon',canonApproval:{approvedAt:'2026-01-01',revision:0}})]);
  assert.equal(catalog.terms.length,0);assert.equal(catalog.warnings.length,1);
});
test('Canon requires matching revision approval and preserves public approval without actor UUID', () => {
  const catalog=project([publicTerm('a','Approved',{stage:'canon',canonApproval:{approvedAt:'2026-01-01',revision:1,actor:'private-uuid'}})]);
  assert.equal(catalog.terms[0].stage,'canon');assert.equal(catalog.terms[0].canonApprovedAt,'2026-01-01');assert.ok(!JSON.stringify(catalog).includes('private-uuid'));
});
test('actual static projection aliases populate roots, evidence, dates and provenance', () => {
  const t=project([publicTerm('a','Example',{roots:['rain','bow'],evidenceStrength:'supported',earliestVerifiedDate:'2024',provenanceSummary:'Approved source description',permalink:'word/example/'})]).terms[0];
  assert.deepEqual(t.components,['rain','bow']);assert.equal(t.evidence,'supported');assert.equal(t.earliestAppearance,'2024');assert.equal(t.provenanceSummary,'Approved source description');assert.equal(t.permalink,'word/example/');
});
test('unverified pronunciation and made-up dates are not presented as verified', () => {
  const t=project([publicTerm('a','Example',{pronunciation:'invented',ipa:'x',earliestVerifiedDate:'unknown'})]).terms[0];
  assert.equal(t.pronunciation,'');assert.equal(t.ipa,'');assert.equal(t.earliestAppearance,null);
});
test('search orders exact matches ahead of partial and definition matches', () => {
  const c=project([publicTerm('a','Weather'),publicTerm('b','Weatherman'),publicTerm('c','Cloud')]);
  assert.deepEqual(searchTerms(c,{q:'weather'}).map(t=>t.id),['a','b','c']);
});
test('search supports variants, roots, domains, definition tokens and accents', () => {
  const c=project([publicTerm('a','Example',{variants:['Exemplar'],roots:['thermal'],domains:['Climate'],tags:['atmosphere'],definition:'Patterns of warm winter winds.'}),publicTerm('b','Café',{slug:'cafe'})]);
  for(const q of ['exemplar','thermal','climate','atmosphere','winter warm'])assert.equal(searchTerms(c,{q})[0].id,'a');
  assert.equal(searchTerms(c,{q:'cafe'})[0].id,'b');
});
test('search supports prefix, suffix and bounded typo tolerance', () => {
  const c=project([publicTerm('a','Weather')]);
  for(const q of ['wea','ther','wether','weathex'])assert.equal(searchTerms(c,{q})[0].id,'a');
  assert.equal(searchTerms(c,{q:'zzzzzz'}).length,0);assert.equal(searchScore(c.terms[0],'wzz'),0);
});
test('filters combine and alphabetical browsing is accent-aware', () => {
  const c=project([publicTerm('a','Example',{formation:'blend',domains:['Language']}),publicTerm('b','Extra',{stage:'lexicon',formation:'compound',domains:['Language']})]);
  assert.equal(searchTerms(c,{stage:'lexicon',domain:'Language',formation:'compound',letter:'E'})[0].id,'b');
  assert.equal(searchTerms(c,{stage:'canon'}).length,0);
});
test('instant index ranks word, alternate form, compact spelling, prefix, meaning and typo distinctly', () => {
  const c=project([
    publicTerm('word','Weather'),
    publicTerm('variant','Skyword',{variants:['Weather']}),
    publicTerm('compact','Wea-ther',{slug:'wea-ther'}),
    publicTerm('prefix','Weatherman'),
    publicTerm('meaning','Cloud'),
  ]);
  const index=createSearchIndex(c),hits=index.search('weather',{limit:Infinity});
  assert.deepEqual(hits.map(hit=>hit.term.id),['word','variant','compact','prefix','meaning']);
  assert.equal(hits[0].match.field,'headword');assert.equal(hits[1].match.field,'variant');assert.equal(hits.at(-1).match.field,'definition');
  assert.equal(index.search('wether')[0].term.id,'word');
  assert.equal(index.search('w')[0].term.id,'compact');
  assert.deepEqual(index.search('weather',{limit:2}).map(hit=>hit.term.id),['word','variant']);
  assert.deepEqual(index.search('weather',{limit:0}),[]);
});
test('instant search treats accents, apostrophes, dash types and word spacing as spelling alternatives', () => {
  const c=project([
    publicTerm('port','Portmantrés',{slug:'portmantres'}),
    publicTerm('us','Us-conscious',{slug:'us-conscious'}),
    publicTerm('b','B’s Myth',{slug:'bs-myth'}),
    publicTerm('unicode','Élan',{slug:'elan'}),
  ]), index=createSearchIndex(c);
  for(const q of ['Portmantres','portmantrés'])assert.equal(index.search(q)[0].term.id,'port');
  for(const q of ['us conscious','usconscious','Us—conscious'])assert.equal(index.search(q)[0].term.id,'us');
  for(const q of ["B's Myth",'BsMyth','b’smyth'])assert.equal(index.search(q)[0].term.id,'b');
  assert.equal(index.search('e\u0301lan')[0].term.id,'unicode');
  assert.deepEqual(index.search('',{filters:{letter:'E'}}).map(hit=>hit.term.id),['unicode']);
});
test('symbol-only search remains literal and the symbolic alphabet shelf includes numbers and punctuation', () => {
  const c=project([
    publicTerm('plus','Love+logic',{slug:'love-logic'}),
    publicTerm('dash','Us-conscious',{slug:'us-conscious'}),
    publicTerm('quote','“Soon,” I Sighed',{slug:'soon-i-sighed'}),
    publicTerm('number','404 feelings',{slug:'404-feelings'}),
    publicTerm('plain','Plain',{definition:'This source has + and - punctuation.'}),
  ]), index=createSearchIndex(c);
  assert.deepEqual(index.search('+').map(hit=>hit.term.id),['plus']);
  assert.deepEqual(index.search('-').map(hit=>hit.term.id),['dash']);
  assert.deepEqual(index.search('—').map(hit=>hit.term.id),['dash']);
  assert.deepEqual(index.search('?!'),[]);
  assert.deepEqual(index.search('',{limit:Infinity,filters:{letter:'#'}}).map(hit=>hit.term.id).sort(),['number','quote']);
  assert.deepEqual(searchTerms(c,{letter:'#'}).map(term=>term.id).sort(),['number','quote']);
});
test('instant index covers approved source, corpus, senses, examples and contextual fields with honest match labels', () => {
  const fields=[
    ['source',{sources:[{visibility:'approved_public',label:'Notebook',publicSummary:'The gilded threshold.',approvedExcerpt:'First copper wording.'}]},'gilded','source'],
    ['corpus',{corpus:[{visibility:'approved_public',title:'Poem of starlings',summary:'A murmuration takes shape.'}]},'murmuration','corpus'],
    ['sense',{senses:[{visibility:'approved_public',label:'Secondary',definition:'A pocket of reverberation.'}]},'reverberation','sense'],
    ['example',{examples:['The lanterns considered their options.']},'lanterns','example'],
    ['component',{roots:['resonant']},'resonant','component'],
    ['formation',{formation:'semantic_extension'},'semantic extension','formation'],
    ['domain',{domains:['Astronomy']},'astronomy','domain'],
    ['tag',{tags:['Threshold']},'threshold','tag'],
    ['collection',{collections:['Boundaries']},'boundaries','collection'],
    ['concept',{conceptualGap:'Naming the liminal interval.'},'liminal','conceptualGap'],
  ];
  for(const [id,extra,q,field]of fields){
    const hits=createSearchIndex(project([publicTerm(id,id,extra)])).search(q);
    assert.equal(hits[0]?.term.id,id,`missing ${field}`);assert.equal(hits[0].match.field,field);
  }
});
test('connected-concept lookup keeps inferred associations visibly qualified and exact targets first', () => {
  const c=project([publicTerm('a','Alpha'),publicTerm('b','Beta'),publicTerm('g','Gamma')],[
    {visibility:'approved_public',from:'a',to:'b',inferred:true},
    {visibility:'approved_public',from:'b',to:'g',type:'derivation',inferred:false},
  ]), index=createSearchIndex(c);
  assert.deepEqual(index.search('Beta').map(hit=>hit.term.id),['b','a','g']);
  assert.equal(index.search('Beta')[1].match.label,'Proposed relation');
  assert.equal(index.search('Beta')[2].match.label,'Related concept');
  assert.equal(index.search('Gamma').find(hit=>hit.term.id==='b').match.field,'relationship');
});
test('raw payload search excludes private records, nested bodies, AI proposals and private historical definitions', () => {
  const raw={terms:[publicTerm('a','Visible',{
    rawPrivateSource:'rawsecretmarker',
    sources:[{visibility:'private',title:'hiddenwitnessmarker'},{visibility:'approved_public',label:'Notebook',body:'bodysecretmarker',approvedExcerpt:'publicexcerptmarker'}],
    senses:[{visibility:'private',definition:'privatesensemarker'}],
    corpus:[{visibility:'private',title:'privatecorpusmarker'}],
    analysis:{kind:'ai_hypothesis',interpretationProposal:'unacceptedproposalmarker'},
  }),publicTerm('private','Hidden',{visibility:'private',definition:'hiddendefinitionmarker'})],relations:[],versions:[{visibility:'private',termId:'a',definition:'privateversionmarker'},{visibility:'approved_public',termId:'private',definition:'hiddenversionmarker'},{termId:'a',definition:'unapprovedversionmarker'}]};
  const index=createSearchIndex(raw);
  for(const q of ['rawsecretmarker','hiddenwitnessmarker','bodysecretmarker','privatesensemarker','privatecorpusmarker','unacceptedproposalmarker','Hidden','hiddendefinitionmarker','privateversionmarker','hiddenversionmarker','unapprovedversionmarker'])assert.deepEqual(index.search(q),[],q);
  assert.equal(index.search('publicexcerptmarker')[0].term.id,'a');
  assert.ok(!JSON.stringify(index.search('Visible')).includes('rawsecretmarker'));
});
test('historical lookup labels only approved earlier wording and preserves the current definition preview', () => {
  const c=project([
    publicTerm('a','Alpha',{definition:'A current amber interpretation.'}),
    publicTerm('b','Beta',{definition:'The obsolete cinnabar conception.'}),
  ],[],[
    {visibility:'approved_public',termId:'a',version:1,effectiveAt:'2024-02-01',definition:'The obsolete cinnabar conception.'},
    {visibility:'approved_public',termId:'a',version:2,effectiveAt:'2025-03-01',definition:'The obsolete cinnabar conception.'},
    {visibility:'approved_public',termId:'a',version:3,effectiveAt:'2026-01-01',definition:'A current amber interpretation.'},
    {visibility:'private',termId:'a',version:4,definition:'privateversionmarker'},
    {termId:'a',version:5,definition:'unapprovedversionmarker'},
  ]),index=createSearchIndex(c);
  const hits=index.search('cinnabar');
  assert.deepEqual(hits.map(hit=>hit.term.id),['b','a']);
  assert.equal(hits[0].match.field,'definition');
  assert.equal(hits[1].match.field,'history');
  assert.equal(hits[1].match.label,'Earlier public wording · version 2 · 2025-03-01');
  assert.equal(hits[1].match.text,'The obsolete cinnabar conception.');
  assert.equal(hits[1].term.definition,'A current amber interpretation.');
  assert.equal(index.search('amber')[0].match.field,'definition');
  assert.deepEqual(searchTerms(c,{q:'cinnabar'}).map(term=>term.id),['b','a']);
  assert.equal(index.search('Alpha cinnabar')[0].match.field,'history');
  assert.deepEqual(index.search('privateversionmarker'),[]);
  assert.deepEqual(index.search('unapprovedversionmarker'),[]);
});
test('verified pronunciation, grammar, public identifiers and recorded source dates are searchable as metadata', () => {
  const c=project([publicTerm('public-record-123','Alpha',{slug:'stable-route',partOfSpeech:'adjective',pronunciation:'al-fa',ipa:'æl.fə',pronunciationVerified:true,
    sources:[{visibility:'approved_public',label:'Notebook',sourceDate:'2024-08-12'}],
  }),publicTerm('other','Beta',{pronunciation:'unverifiedsounds',ipa:'unverifiedipa',pronunciationVerified:false})]),index=createSearchIndex(c);
  for(const [q,field,label]of [
    ['al-fa','pronunciation','Verified pronunciation'],['æl.fə','ipa','Verified IPA'],['adjective','partOfSpeech','Part of speech'],
    ['public-record-123','id','Public record ID'],['stable-route','slug','Permanent word URL'],['2024-08-12','sourceDate','Recorded source date'],
  ]){
    const hit=index.search(q)[0];assert.equal(hit?.term.id,'public-record-123',q);assert.equal(hit.match.field,field);assert.equal(hit.match.label,label);
  }
  assert.deepEqual(index.search('unverifiedsounds'),[]);assert.deepEqual(index.search('unverifiedipa'),[]);
});
test('indexed lookup combines archive filters, multi-field queries, bounded snippets and bounded input', () => {
  const c=project([
    publicTerm('a','Alpha',{stage:'lexicon',domains:['Climate'],definition:'prefix '.repeat(70)+'the amber sky.',roots:['thermal']}),
    publicTerm('b','Beta',{stage:'forge',roots:['thermal']}),
  ]),index=createSearchIndex(c);
  assert.deepEqual(index.search('thermal',{filters:{stage:'lexicon',domain:'Climate'}}).map(hit=>hit.term.id),['a']);
  assert.equal(index.search('thermal amber')[0].term.id,'a');
  const hit=index.search('amber')[0];assert.ok(hit.match.text.includes('amber'));assert.ok(hit.match.text.length<=280);
  assert.deepEqual(index.search('z'.repeat(50000)),[]);
  assert.equal(index.search('',{limit:Infinity}).length,2);
});
test('relations with private endpoint or no publication approval are excluded', () => {
  const c=project([publicTerm('a','Alpha'),publicTerm('b','Beta'),publicTerm('p','Private',{visibility:'private'})],[{visibility:'approved_public',source:'a',target:'b',type:'association',status:'inferred'},{visibility:'approved_public',source:'a',target:'p',type:'private relation'},{source:'a',target:'b',type:'unapproved'}]);
  assert.equal(c.relations.length,1);assert.equal(relatedTo(c,'a')[0].term.id,'b');assert.equal(c.relations[0].inferred,true);
});
test('time machine uses only approved public versions and never substitutes import time', () => {
  const c=project([publicTerm('a','Example')],[],[{visibility:'approved_public',termId:'a',date:'2025-01-01',definition:'Earlier meaning.'},{visibility:'private',termId:'a',date:'2025-02-01',definition:'Private meaning.'},{visibility:'approved_public',termId:'a',date:'2025-03-01',definition:'Later meaning.'},{visibility:'approved_public',termId:'missing',date:'2024-01-01',definition:'Unknown term.'}]);
  assert.equal(publicVersions(c,'a').length,2);assert.equal(versionAt(c,'a','2025-02-15').definition,'Earlier meaning.');assert.equal(versionAt(c,'a','2024-01-01'),null);assert.equal(versionAt(c,'a','invalid'),null);
});
test('CSV quotes newlines/quotes and neutralizes spreadsheet formulas', () => {
  const c=project([publicTerm('a','Example',{definition:'=HYPERLINK("bad")\nnext line'})]);
  const csv=csvExport(c);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=HYPERLINK(""bad"")\nnext line"'));assert.ok(!csv.includes('rawPrivateSource'));
});
test('CSV includes stable revisions and the public categorization/review state', () => {
  const c=project([publicTerm('a','Example',{tags:['wordplay'],review:{state:'deferred',flags:['definition_conflict'],definitionBasis:'conversation_recovered',note:'=not a formula'}})]);
  const csv=csvExport(c);assert.ok(csv.includes('"revision"'));assert.ok(csv.includes('"definitionBasis"'));assert.ok(csv.includes('conversation_recovered'));assert.ok(csv.includes('definition_conflict'));assert.ok(csv.includes('wordplay'));assert.ok(csv.includes("'=not a formula"));
});
test('URLs reject script protocols, credentialed URLs and empty configuration', () => {
  for(const url of ['javascript:alert(1)','data:text/html,bad','https://name:secret@example.com/','','file:///private'])assert.equal(safeUrl(url),'');
  assert.equal(safeUrl('https://example.com/path'),'https://example.com/path');assert.equal(safeUrl('./public.json','https://example.com/observatory/'),'https://example.com/observatory/public.json');
});
test('untrusted permalink cannot alter the canonical origin or navigate upward', () => {
  for(const permalink of ['javascript:bad','https://unapproved.invalid/','../../private'])assert.equal(project([publicTerm('a','Example',{permalink})]).terms[0].permalink,'');
});
test('word-level archaeology distinguishes unchanged context from changed text', () => {
  assert.deepEqual(definitionDiff('A brief moment of light.','A lasting moment of light.'),{unchangedStart:'A',removed:'brief',added:'lasting',unchangedEnd:'moment of light.'});
});
test('bounded edit distance handles large length gaps', () => {
  assert.equal(editDistance('weather','wether',2),1);assert.equal(editDistance('a','manycharacters',2),3);
});
test('malformed endpoint contract fails instead of inventing an empty success', () => {
  assert.throws(()=>normalizeCatalog({terms:[]}),/contract/);assert.throws(()=>normalizeCatalog(null),/contract/);
});
test('JSON export preserves publication and Canon approval metadata for a controlled publication roundtrip', () => {
  const c=project([publicTerm('a','Example',{stage:'canon',roots:['sample'],evidenceStrength:'supported',earliestVerifiedDate:'2024',canonApproval:{approvedAt:'2026-01-01',revision:1}})]);
  const output=publicJsonExport(c),row=output.terms[0];
  assert.equal(row.revision,1);assert.equal(row.publication.approvedRevision,1);assert.equal(row.canonApproval.revision,1);assert.deepEqual(row.roots,['sample']);assert.equal(row.evidenceStrength,'supported');assert.equal(row.earliestVerifiedDate,'2024');assert.equal(normalizeCatalog(output).terms[0].stage,'canon');
});
test('partial and impossible dates do not become precise time-machine evidence', () => {
  const c=project([publicTerm('a','Example',{earliestVerifiedDate:'2025-02-31'})],[],[{visibility:'approved_public',termId:'a',date:'2025',definition:'Only the year is known.'}]);
  assert.equal(c.terms[0].earliestAppearance,null);assert.equal(publicVersions(c,'a')[0].effectiveAt,'2025');assert.equal(versionAt(c,'a','2025-06-01'),null);
});
test('populated catalog retains public editorial state and excludes private review rationale', () => {
  const c=project([publicTerm('a','Example',{definitionStatus:'author_supplied',classification:'expression',collections:['Expressions'],editorialReview:{shortReason:'Public evidence basis',privateRationale:'sensitive rationale'},analysis:{kind:'ai_hypothesis',formationProposal:'A provisional blend',interpretationProposal:'A hypothesis',distinctionQuestion:'What does this distinguish?',limitations:['Unverified'],privatePrompt:'secret'}})]);
  assert.equal(c.terms[0].definitionStatus,'author_supplied');assert.deepEqual(c.terms[0].collections,['Expressions']);assert.equal(c.terms[0].editorialReview.shortReason,'Public evidence basis');assert.ok(!JSON.stringify(c).includes('sensitive rationale'));assert.ok(!JSON.stringify(c).includes('privatePrompt'));assert.equal(c.terms[0].analysis.kind,'ai_hypothesis');
});
test('feature selection prioritizes actual developed definitions and filters work against real collections', () => {
  const c=project([publicTerm('a','Alpha',{definition:'',collections:['Seeds']}),publicTerm('b','Beta',{stage:'lexicon',collections:['Developed']})]);
  assert.deepEqual(featuredTerms(c).map(t=>t.id),['b']);assert.deepEqual(searchTerms(c,{definitionState:'pending'}).map(t=>t.id),['a']);assert.deepEqual(searchTerms(c,{definitionState:'defined',collection:'Developed'}).map(t=>t.id),['b']);
});
test('a nonempty pending placeholder is never counted or featured as a developed definition', () => {
  const c=project([publicTerm('a','Alpha',{definition:'Definition pending author review.',definitionStatus:'awaiting_definition'}),publicTerm('b','Beta')]);
  assert.deepEqual(featuredTerms(c).map(t=>t.id),['b']);
  assert.deepEqual(searchTerms(c,{definitionState:'pending'}).map(t=>t.id),['a']);
});
test('author can explicitly approve Canon but no unchecked or unfinished request can do so', () => {
  const input={action:'create',headword:'Sample',stage:'canon',definition:'A developed definition.',confirmPublication:'PUBLISH Sample'};
  assert.throws(()=>preparePublicChange(input),/separate exact/);
  const request=preparePublicChange({...input,canonConfirmation:'APPROVE CANON Sample'});
  assert.equal(request.changes.stage,'canon');assert.equal(request.canonConfirmation,'APPROVE CANON Sample');
  assert.throws(()=>preparePublicChange({...input,definition:'Definition pending author review.',definitionStatus:'awaiting_definition',canonConfirmation:'APPROVE CANON Sample'}),/working definition/);
});
test('rejecting an AI proposal is an explicit versioned public change', () => {
  const term=project([publicTerm('a','Example',{analysis:{kind:'ai_hypothesis',formationProposal:'A possibility'}})]).terms[0];
  const input={...term,action:'update',expectedRevision:1,roots:[],confirmPublication:'PUBLISH Example',rejectAnalysis:true};
  const request=preparePublicChange(input,term);
  assert.equal(request.changes.analysis,null);assert.equal(term.analysis.kind,'ai_hypothesis');
});
test('public editor creates exact workflow JSON without private inputs or automatic Canon', () => {
  const request=preparePublicChange({action:'create',headword:'Sample',stage:'forge',definition:'A working definition.',roots:'["root"]',domains:'[]',variants:'[]',collections:'[]',confirmPublication:'PUBLISH Sample',rawPrivateNote:'not accepted'});
  assert.equal(request.action,'create');assert.equal(request.expectedRevision,0);assert.equal(request.slug,'sample');assert.equal(request.confirmPublication,'PUBLISH Sample');assert.deepEqual(request.changes.roots,['root']);assert.equal(request.changes.definitionStatus,'working_definition');assert.ok(!JSON.stringify(request).includes('rawPrivateNote'));
  assert.throws(()=>preparePublicChange({action:'create',headword:'Sample',stage:'canon',confirmPublication:'PUBLISH Sample'}),/Canon/);
});
test('public editor requires exact intention, validates JSON arrays, and requires a definition for Lexicon', () => {
  const base={action:'create',headword:'Sample',stage:'forge',confirmPublication:'PUBLISH Sample'};
  assert.throws(()=>preparePublicChange({...base,confirmPublication:'publish sample'}),/exactly/);
  assert.throws(()=>preparePublicChange({...base,roots:'not json'}),/JSON array/);
  assert.throws(()=>preparePublicChange({...base,stage:'lexicon'}),/working definition/);
});
test('public editor stages and withdraws using current IDs/revisions without changing source inputs', () => {
  const term=project([publicTerm('a','Example')]).terms[0];
  const stage=preparePublicChange({action:'stage',headword:'Example',stage:'lexicon',expectedRevision:1,confirmPublication:'PUBLISH Example'},term);
  assert.deepEqual(stage.changes,{stage:'lexicon'});assert.equal(stage.id,'a');assert.equal(stage.expectedRevision,1);assert.equal(term.stage,'forge');
  const withdrawal=preparePublicChange({action:'withdraw',headword:'Example',expectedRevision:1,confirmPublication:'WITHDRAW Example'},term);
  assert.equal(withdrawal.action,'withdraw');assert.ok(!Object.hasOwn(withdrawal,'changes'));assert.ok(!Object.hasOwn(withdrawal,'confirmPublication'));
});
test('public editor restoration needs explicit snapshot revision and separately approved Canon confirmation', () => {
  const term=project([publicTerm('a','Example',{stage:'canon',canonApproval:{approvedAt:'2026-01-01',revision:1}})]).terms[0];
  const input={action:'restore',headword:'Example',expectedRevision:4,restoreRevision:1,confirmPublication:'PUBLISH Example'};
  assert.throws(()=>preparePublicChange(input,term),/separate exact/);
  const request=preparePublicChange({...input,canonConfirmation:'APPROVE CANON Example'},term);assert.equal(request.restoreRevision,1);assert.equal(request.expectedRevision,4);assert.equal(request.canonConfirmation,'APPROVE CANON Example');
});
test('approved source summaries survive JSON roundtrip without private bodies', () => {
  const c=project([publicTerm('a','Example',{sources:[{visibility:'approved_public',label:'Synthetic witness',
    approvedExcerpt:'Approved excerpt',sourceDate:'2024-02-01',evidenceStrength:'supported',body:'SECRET_SOURCE'}]})]);
  assert.equal(c.terms[0].witnesses[0].evidence,'supported');
  const output=publicJsonExport(c),again=normalizeCatalog(output);
  assert.equal(again.terms[0].witnesses[0].originalWording,'Approved excerpt');
  assert.ok(!JSON.stringify(output).includes('SECRET_SOURCE'));
});
