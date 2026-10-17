import test from 'node:test';
import assert from 'node:assert/strict';
import {SEED_BANK,BLEND_THEMES,generateBlends,createSourceShuffler} from '../museum-static/observatory/blend-engine.js';

function verifyConstruction(result) {
  for(const candidate of result.candidates) {
    assert.notEqual(candidate.word,result.sources.map(x=>x.normalized).join(''));
    assert.equal(candidate.segments.length,result.sources.length);
    assert.equal(candidate.joins.length,result.sources.length-1);
    for(const [i,segment] of candidate.segments.entries()) {
      assert.equal(segment.sourceIndex,i);
      assert.equal(segment.fragment,result.sources[i].normalized.slice(segment.sourceStart,segment.sourceEnd));
      assert.equal(candidate.word.slice(segment.outputStart,segment.outputEnd),segment.fragment);
      assert.ok(segment.fragment.length>=2);
      const exclusive=Array.from({length:segment.outputEnd-segment.outputStart},(_,n)=>n+segment.outputStart)
        .some(p=>!candidate.segments.some((s,j)=>j!==i&&p>=s.outputStart&&p<s.outputEnd));
      assert.ok(exclusive,'Every source has at least one uniquely contributed letter');
    }
    for(const join of candidate.joins) {
      assert.equal(join.overlap.length,join.overlapLength);
      assert.equal(candidate.word.slice(join.outputStart,join.outputEnd),join.overlap);
      if(join.overlapLength) {
        assert.ok(candidate.segments[join.leftSource].fragment.endsWith(join.overlap));
        assert.ok(candidate.segments[join.rightSource].fragment.startsWith(join.overlap));
      }
    }
    assert.ok(candidate.score>=1&&candidate.score<=99);
    assert.ok(candidate.meaning.interpretation.trim());
    assert.equal(candidate.isPortmantres,result.sources.length===3&&candidate.joins.every(x=>x.overlapLength>0));
  }
}

test('reference examples rank smog and brunch, with honest distinct construction methods',()=>{
  const smog=generateBlends({sources:['smoke','fog']});
  assert.equal(smog.candidates[0].word,'smog');
  assert.equal(smog.candidates[0].method,'overlap');
  const brunch=generateBlends({sources:['breakfast','lunch']});
  assert.equal(brunch.candidates[0].word,'brunch');
  assert.equal(brunch.candidates[0].method,'clipped');
  verifyConstruction(smog);verifyConstruction(brunch);
});

test('arbitrary sources without shared letters produce clipped blends, never whole concatenation',()=>{
  const result=generateBlends({sources:[{word:'abc',gloss:'one abstract idea'},{word:'xyz',gloss:'a contrasting idea'}]});
  assert.ok(result.candidates.length);
  assert.ok(result.candidates.every(x=>x.method==='clipped'&&!x.isPortmantres));
  assert.ok(result.candidates.every(x=>x.word!=='abcxyz'));
  verifyConstruction(result);
});

test('exact-overlap-only mode reports no result rather than inventing overlap',()=>{
  const result=generateBlends({sources:['abc','xyz'],mode:'overlap'});
  assert.equal(result.candidates.length,0);
  assert.match(result.warnings.join(' '),/No exact overlapping/);
});

test('three-way blends preserve every source and two actual overlaps qualify as Portmantrés',()=>{
  const result=generateBlends({sources:['word','dream','memory'],mode:'overlap',limit:12});
  assert.ok(result.candidates.length);
  assert.ok(result.candidates.every(x=>x.isPortmantres&&x.method==='overlap'));
  verifyConstruction(result);
});

test('three clipped sources contribute without being mislabeled Portmantrés',()=>{
  const result=generateBlends({sources:['cognition','alchemy','wonder'],mode:'clipped'});
  assert.ok(result.candidates.length);
  assert.ok(result.candidates.every(x=>!x.isPortmantres&&x.method==='clipped'));
  verifyConstruction(result);
});

test('source meanings are attributed, user gloss wins, and unknown meanings remain explicitly unknown',()=>{
  const known=generateBlends({sources:[{word:'memory',gloss:'a personal note stored for later'},'alchemy']});
  assert.equal(known.sources[0].gloss,'a personal note stored for later');
  assert.equal(known.sources[0].glossSource,'user');
  assert.equal(known.sources[1].glossSource,'seed');
  assert.match(known.candidates[0].meaning.label,/no AI service called/);
  assert.match(known.candidates[0].meaning.interpretation,/a personal note stored for later/);
  const unknown=generateBlends({sources:['blorful','zandrift']});
  assert.deepEqual(unknown.candidates[0].meaning.unknownSources,['blorful','zandrift']);
  assert.match(unknown.candidates[0].meaning.interpretation,/Add a short meaning/);
  assert.equal(unknown.sources[0].gloss,'');
});

test('provided intent becomes a labeled reading and text caps prevent oversized payloads',()=>{
  const result=generateBlends({sources:[{word:'memory',gloss:'x'.repeat(10000)},'alchemy'],intent:'y'.repeat(10000),limit:999});
  assert.equal(result.sources[0].gloss.length,320);
  assert.equal(result.candidates[0].meaning.intent.length,480);
  assert.ok(result.candidates.length<=12);
  assert.match(result.candidates[0].meaning.interpretation,/^Intent-guided reading/);
});

test('invalid counts, duplicate words, empty inputs, oversized words and nonfinite limits are bounded',()=>{
  for(const sources of [[],['one'],['a','bc'],['word','WORD'],['abc','x'.repeat(33)],['a','b','c','d'],null]) {
    const result=generateBlends({sources});assert.equal(result.candidates.length,0);assert.ok(result.warnings.length);
  }
  assert.ok(generateBlends({sources:['memory','alchemy'],limit:NaN}).candidates.length<=8);
  assert.ok(generateBlends({sources:['memory','alchemy'],limit:-100}).candidates.length<=1);
  assert.doesNotThrow(()=>generateBlends(null));
});

test('capitalization, punctuation and accent normalization remain traceable',()=>{
  const result=generateBlends({sources:[{word:'Café',gloss:'a coffeehouse'}, {word:'Re-born',gloss:'renewed'}]});
  assert.equal(result.sources[0].normalized,'café');
  assert.equal(result.sources[1].normalized,'reborn');
  assert.ok(result.warnings.some(x=>x.includes('Splices use lowercase')));
  verifyConstruction(result);
  const astral=generateBlends({sources:[{word:'𠮷田山',gloss:'a hypothetical place name'},{word:'山川水',gloss:'another hypothetical name'}]});
  assert.ok(astral.candidates.length);
  assert.ok(astral.candidates.every(x=>!/[\ud800-\udfff]/u.test(x.word.replace(/\p{L}/gu,''))));
  verifyConstruction(astral);
});

test('shuffle glosses carried through an editable form retain the specific conceptual reading',()=>{
  const sources=['memory','alchemy'].map(word=>({...SEED_BANK.find(s=>s.word===word)}));
  const result=generateBlends({sources});
  assert.match(result.candidates[0].meaning.interpretation,/Transform remembered experience into new meaning/);
  sources[0].gloss='a computer address range';
  const revised=generateBlends({sources});
  assert.match(revised.candidates[0].meaning.interpretation,/computer address range/);
  assert.doesNotMatch(revised.candidates[0].meaning.interpretation,/Transform remembered experience/);
});

test('curated seed bank is substantial, defined, unique and themed',()=>{
  assert.ok(SEED_BANK.length>=100);
  assert.equal(new Set(SEED_BANK.map(x=>x.word)).size,SEED_BANK.length);
  assert.ok(SEED_BANK.every(x=>x.gloss.trim()&&x.themes.length));
  assert.ok(BLEND_THEMES.includes('cognition'));
});

test('shuffle decks are reproducible, themed, coherent and nonrepeating before exhaustion',()=>{
  const one=createSourceShuffler({rng:()=>0.25});
  const two=createSourceShuffler({rng:()=>0.25});
  for(const theme of BLEND_THEMES)for(const count of [2,3]) {
    const first=one.next({theme,count});const match=two.next({theme,count});
    assert.deepEqual(first,match);
    assert.equal(first.sources.length,count);
    assert.ok(first.intent.trim());
    assert.ok(first.sources.every(x=>x.gloss.trim()));
    if(theme!=='all')assert.equal(first.theme,theme);
    const seen=new Set([first.sources.map(x=>x.word).join('|')]);let previous=first;
    for(let i=1;i<first.poolSize;i++) {
      const next=one.next({theme,count});two.next({theme,count});
      const key=next.sources.map(x=>x.word).join('|');assert.ok(!seen.has(key));seen.add(key);previous=next;
    }
    const nextCycle=one.next({theme,count});two.next({theme,count});
    assert.equal(nextCycle.cycle,2);
    assert.notDeepEqual(nextCycle.sources,previous.sources);
  }
});

test('injected RNG extremes remain safe and shuffled sources always generate usable candidates',()=>{
  for(const value of [NaN,Infinity,-1,1,100]) {
    const shuffle=createSourceShuffler({rng:()=>value});
    for(const count of [2,3])for(const theme of BLEND_THEMES) {
      const result=shuffle.next({theme,count});
      const generated=generateBlends({...result,limit:3});
      assert.ok(generated.candidates.length,`${theme}/${count} generates candidates`);
      verifyConstruction(generated);
    }
  }
  assert.throws(()=>createSourceShuffler({rng:null}),TypeError);
});

test('large valid sources remain bounded and deterministic',()=>{
  const options={sources:['counterrevolutionarythinking','interdisciplinaryreflection','conceptualtransformation'],limit:12};
  const result=generateBlends(options);
  assert.ok(result.candidates.length<=12);
  assert.deepEqual(result,generateBlends(options));
  verifyConstruction(result);
});

test('every curated shuffled set produces traceable candidates, across full decks',()=>{
  const shuffler=createSourceShuffler({rng:()=>0.5});
  for(const count of [2,3]) {
    const first=shuffler.next({theme:'all',count});
    const examples=[first];
    for(let i=1;i<first.poolSize;i++)examples.push(shuffler.next({theme:'all',count}));
    for(const example of examples) {
      const result=generateBlends({...example,limit:4});
      assert.ok(result.candidates.length,example.sources.map(x=>x.word).join('+'));
      assert.ok(result.candidates.every(x=>x.meaning.interpretation.includes(example.intent)));
      verifyConstruction(result);
    }
  }
});
