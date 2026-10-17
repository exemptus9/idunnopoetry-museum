/** Offline candidate construction. Scores rank spelling heuristics, never truth or originality. */
const MAX_WORD = 32;
const MAX_GLOSS = 320;
const MAX_INTENT = 480;
const MAX_RESULTS = 12;
const BEAM = 180;
const cleanText = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const normal = value => cleanText(value, 120).normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}]/gu, '');
const vowels = /[aeiouyà-æè-ïò-öù-ü]/i;
const letterOffsets = word => {
  const offsets=[0];let total=0;
  for(const letter of word){total+=letter.length;offsets.push(total);}
  return offsets;
};

const seedRows = [
  ['mind','the activity and experience of thinking','cognition'],
  ['memory','the retention and recall of experience','cognition,archive'],
  ['cognition','the processes of knowing, thinking, and understanding','cognition'],
  ['consciousness','subjective awareness and experience','cognition'],
  ['thought','an idea or act of thinking','cognition'],
  ['attention','the selective direction of mental focus','cognition,technology'],
  ['insight','a new understanding of a pattern or problem','cognition,transformation'],
  ['clarity','the quality of being understandable or mentally clear','cognition'],
  ['chaos','disorder with difficult-to-predict interactions','transformation,technology'],
  ['wonder','curiosity mixed with surprise or awe','cognition,poetry'],
  ['curiosity','the desire to discover or understand','cognition'],
  ['doubt','uncertainty about what to accept as true','cognition'],
  ['belief','something held to be true','cognition'],
  ['reason','deliberate inference supported by grounds','cognition'],
  ['intuition','an immediate impression without a fully articulated inference','cognition'],
  ['perception','the interpretation of sensory information','cognition'],
  ['perspective','a position or framework from which something is understood','cognition,relationships'],
  ['awareness','conscious notice of something','cognition'],
  ['knowing','having understanding or familiarity','cognition'],
  ['reflection','careful consideration of an experience or idea','cognition,poetry'],
  ['meaning','the significance or sense carried by something','cognition,poetry'],
  ['identity','a sense or account of who someone is','cognition,relationships'],
  ['self','the person understood as the subject of experience','cognition,relationships'],
  ['metacognition','awareness and consideration of one’s thinking','cognition'],
  ['uncertainty','a state of incomplete knowledge or unresolved possibilities','cognition'],
  ['imagination','the formation of possibilities beyond immediate perception','cognition,poetry'],
  ['dream','an imagined experience or hoped-for possibility','cognition,poetry'],
  ['language','a system for expressing and communicating meaning','poetry,relationships'],
  ['word','a recognizable linguistic form associated with meaning or function','poetry'],
  ['lexicon','a collection or system of vocabulary','poetry,archive'],
  ['genesis','the emergence or beginning of something','transformation,poetry'],
  ['verse','language composed with poetic form or pattern','poetry'],
  ['poetry','literary expression attentive to language, sound, and meaning','poetry'],
  ['rhyme','correspondence between word sounds','poetry'],
  ['rhythm','a patterned movement of stresses, sounds, or events','poetry'],
  ['echo','a sound or pattern that returns in altered context','poetry,archive'],
  ['sound','audible vibration or its perceived quality','poetry'],
  ['silence','the absence or withholding of audible expression','poetry,relationships'],
  ['metaphor','understanding or describing one thing through another','poetry,cognition'],
  ['story','an account connecting events or experiences','poetry,archive'],
  ['narrative','the organizing account through which events acquire relation','poetry,archive'],
  ['syntax','the organization of linguistic elements','poetry,technology'],
  ['lyric','a compact expressive or song-like use of language','poetry'],
  ['mosaic','a whole assembled from distinct pieces','poetry,archive'],
  ['paradox','an apparent contradiction that invites closer understanding','poetry,cognition'],
  ['voice','a distinctive manner of expression or audible speech','poetry,relationships'],
  ['alchemy','a transformation metaphor for making something valuable from another condition','transformation'],
  ['suffering','the experience of pain or distress','transformation'],
  ['grief','sorrow associated with loss','transformation,relationships'],
  ['adaptation','change in response to altered circumstances','transformation'],
  ['tragedy','a deeply harmful or disastrous occurrence','transformation'],
  ['change','a difference emerging between states','transformation'],
  ['growth','the development of capacity or form','transformation'],
  ['emergence','the appearance of a new form or pattern','transformation,technology'],
  ['rebirth','a metaphorical new beginning after an ending','transformation'],
  ['repair','the restoration of something damaged or disrupted','transformation,technology'],
  ['renewal','a return of energy, function, or possibility','transformation'],
  ['resilience','capacity to respond and recover after disruption','transformation'],
  ['fracture','a break in a previously connected form','transformation'],
  ['wholeness','a condition of integration among parts','transformation'],
  ['root','an underlying origin, support, or cause','transformation,cognition'],
  ['catalyst','something that enables or accelerates a change','transformation'],
  ['becoming','the ongoing process of taking form','transformation'],
  ['emotion','a felt response with experiential and expressive aspects','relationships,cognition'],
  ['empathy','an effort to understand or share another person’s experience','relationships'],
  ['connection','a meaningful link between people or things','relationships,technology'],
  ['friend','a person connected through mutual affection or trust','relationships'],
  ['fan','someone who admires or follows a person or their work','relationships'],
  ['trust','willingness to rely on someone or something','relationships'],
  ['proximity','nearness in location or repeated contact','relationships'],
  ['intimacy','mutual closeness involving personal understanding','relationships'],
  ['belonging','a felt or recognized place within a relationship or group','relationships'],
  ['community','people connected through shared relationships or purposes','relationships'],
  ['solitude','being alone, potentially with chosen quiet','relationships'],
  ['conversation','an exchange in which participants develop or share meaning','relationships,poetry'],
  ['listening','active attention to another person’s expression','relationships'],
  ['care','attention directed toward another’s needs or well-being','relationships'],
  ['boundary','a limit distinguishing responsibilities or acceptable access','relationships'],
  ['circuit','a connected path through which a signal or current can move','technology'],
  ['signal','a pattern that carries information','technology'],
  ['algorithm','a specified procedure for transforming inputs into outputs','technology'],
  ['network','a system of linked participants or nodes','technology,relationships'],
  ['machine','a system organized to perform a function','technology'],
  ['code','a formal set of instructions or representational conventions','technology'],
  ['data','recorded observations or representations','technology,archive'],
  ['archive','a preserved collection with context and provenance','archive,technology'],
  ['index','an organized set of routes into information','archive,technology'],
  ['pattern','a recognizable arrangement or repeated relation','technology,cognition'],
  ['system','interacting parts organized into a whole','technology'],
  ['information','content that can reduce uncertainty or communicate distinctions','technology'],
  ['feedback','an output returning to influence a subsequent operation','technology,cognition'],
  ['recursion','an operation that applies a structure or rule within its own results','technology,poetry'],
  ['interface','a point of interaction between systems or people','technology'],
  ['witness','a preserved source that supports an account of something','archive'],
  ['lineage','a documented chain of development or descent','archive,transformation'],
  ['revision','a recorded change to an earlier form','archive,poetry'],
  ['provenance','the documented sources and history of something','archive'],
  ['fragment','a surviving or unfinished part of a larger form','archive,poetry'],
  ['trace','a remaining sign or record of an earlier state','archive'],
  ['smoke','particles and gases released by combustion','examples'],
  ['fog','a cloud of tiny water droplets near the ground','examples'],
  ['breakfast','a meal conventionally eaten near the start of the day','examples'],
  ['lunch','a meal conventionally eaten around midday','examples'],
];

export const SEED_BANK = Object.freeze(seedRows.map(([word,gloss,themes]) => Object.freeze({word,gloss,themes:Object.freeze(themes.split(','))})));
export const BLEND_THEMES = Object.freeze(['all','cognition','poetry','transformation','relationships','technology','archive']);
const seedMap = new Map(SEED_BANK.map(x=>[normal(x.word),x]));

// Each shuffle comes with an explicit relationship to explore, rather than random word salad.
const sourceSets = [
 ['cognition','memory,alchemy','Transform remembered experience into new meaning.'],
 ['cognition','thought,echo','Explore an idea that keeps returning in a changed form.'],
 ['cognition','clarity,chaos','Name a moment of clear understanding within disorder.'],
 ['cognition','curiosity,reason','Explore inquiry that combines wonder with careful inference.'],
 ['cognition','belief,doubt','Name the productive tension between conviction and uncertainty.'],
 ['cognition','perception,imagination','Explore how perceived experience meets imagined possibility.'],
 ['cognition','mind,mosaic','Name a whole understanding assembled from different mental pieces.'],
 ['cognition','identity,reflection','Explore identity developed through examining experience.'],
 ['poetry','word,wonder','Name language that makes familiar experience surprising.'],
 ['poetry','poetry,paradox','Explore poetic expression that holds an apparent contradiction.'],
 ['poetry','rhyme,meaning','Name sound correspondences that change how a line is understood.'],
 ['poetry','silence,voice','Explore expression whose omissions matter as much as its sound.'],
 ['poetry','metaphor,mosaic','Name a picture of meaning assembled from several comparisons.'],
 ['poetry','verse,recursion','Explore verse that turns its own patterns into new material.'],
 ['transformation','suffering,alchemy','Explore making value after suffering without calling suffering good.'],
 ['transformation','grief,growth','Name development after loss without making the loss necessary.'],
 ['transformation','fracture,repair','Explore restoration that retains an honest record of a break.'],
 ['transformation','tragedy,adaptation','Name enduring changes shaped by a tragic event.'],
 ['transformation','root,renewal','Explore a new beginning that remains connected to its origins.'],
 ['transformation','change,identity','Name continuity of self through a substantial change.'],
 ['relationships','proximity,intimacy','Distinguish nearness from genuinely knowing another person.'],
 ['relationships','fan,friend','Name a connection that develops from admiration into friendship.'],
 ['relationships','empathy,boundary','Explore understanding another person while preserving limits.'],
 ['relationships','solitude,belonging','Name belonging that leaves room for being alone.'],
 ['relationships','trust,conversation','Explore trust grown through meaningful exchange.'],
 ['relationships','voice,listening','Name expression shaped by genuine attention to another voice.'],
 ['technology','algorithm,empathy','Explore a procedure designed around people’s experience.'],
 ['technology','signal,meaning','Name the difference between transmitting a pattern and understanding it.'],
 ['technology','network,memory','Explore remembering that is distributed across connections.'],
 ['technology','feedback,reflection','Name an output that becomes material for self-examination.'],
 ['technology','machine,imagination','Explore a system that helps people form possibilities.'],
 ['technology','interface,care','Name an interaction designed around another person’s needs.'],
 ['archive','archive,voice','Explore preservation that retains the distinctiveness of an expression.'],
 ['archive','fragment,lineage','Name a small surviving piece that reveals a history of development.'],
 ['archive','memory,witness','Distinguish recollection from a preserved supporting source.'],
 ['archive','revision,identity','Explore how changing a work affects its recognizable continuity.'],
 ['archive','trace,meaning','Name an old sign that takes on significance when rediscovered.'],
 ['cognition','thought,reflection,insight','Explore thought examined through reflection until understanding changes.'],
 ['cognition','memory,meaning,identity','Name the relation between remembered experience, significance, and a sense of self.'],
 ['cognition','doubt,curiosity,reason','Explore uncertainty transformed into disciplined inquiry.'],
 ['cognition','mind,pattern,awareness','Name becoming aware of the patterns through which one thinks.'],
 ['poetry','word,dream,memory','Explore words that bring an imagined scene into remembered experience.'],
 ['poetry','sound,meaning,echo','Name a sound whose returning form changes its meaning.'],
 ['poetry','verse,voice,silence','Explore a poetic voice shaped by both expression and withholding.'],
 ['poetry','metaphor,story,identity','Name the way a comparison becomes part of a self-narrative.'],
 ['transformation','suffering,reflection,meaning','Explore value made by reflecting on suffering without justifying it.'],
 ['transformation','fracture,repair,wholeness','Name integration that includes rather than erases a history of breakage.'],
 ['transformation','grief,memory,renewal','Explore continuing forward while retaining a relationship with loss.'],
 ['transformation','root,change,becoming','Name an ongoing transformation grounded in earlier origins.'],
 ['relationships','empathy,trust,connection','Explore connection formed by understanding and reliable care.'],
 ['relationships','proximity,conversation,intimacy','Name the process through which nearness becomes genuine closeness.'],
 ['relationships','self,boundary,community','Explore belonging that does not erase individual limits.'],
 ['relationships','fan,friend,community','Name an audience that grows into a network of actual friendships.'],
 ['technology','signal,network,meaning','Explore how transmitted patterns become understood across a network.'],
 ['technology','data,pattern,insight','Name an understanding formed by interpreting recorded patterns.'],
 ['technology','code,feedback,adaptation','Explore a system that changes in response to its own results.'],
 ['technology','machine,interface,care','Name technology that meets people through thoughtful interaction.'],
 ['archive','fragment,witness,lineage','Explore a surviving source that supports a developmental history.'],
 ['archive','archive,memory,meaning','Name preservation that connects remembered experience with significance.'],
 ['archive','revision,voice,identity','Explore a work changing while preserving a recognizable voice.'],
 ['archive','trace,reflection,renewal','Name a new beginning informed by rediscovered evidence.'],
];

function rngIndex(rng, length) {
  const sample = Number(rng());
  const unit = Number.isFinite(sample) ? Math.max(0,Math.min(0.9999999999999999,sample)) : 0;
  return Math.floor(unit*length);
}

/** Nonrepeating shuffle decks, separately maintained for each theme and source count. */
export function createSourceShuffler({rng=Math.random}={}) {
  if(typeof rng!=='function') throw new TypeError('rng must be a function');
  const decks = new Map();
  return {
    next({theme='all',count=2}={}) {
      const sourceCount=Number(count)===3?3:2;
      const selected=BLEND_THEMES.includes(theme)?theme:'all';
      const pool=sourceSets.filter(x=>(selected==='all'||x[0]===selected)&&x[1].split(',').length===sourceCount);
      const key=`${selected}:${sourceCount}`;
      let deck=decks.get(key);
      if(!deck||!deck.remaining.length) {
        const previous=deck?.last;
        const remaining=pool.map((_,i)=>i);
        for(let i=remaining.length-1;i>0;i--) {
          const j=rngIndex(rng,i+1); [remaining[i],remaining[j]]=[remaining[j],remaining[i]];
        }
        if(remaining.length>1&&remaining[remaining.length-1]===previous) remaining.unshift(remaining.pop());
        deck={remaining,last:previous,cycle:(deck?.cycle||0)+1}; decks.set(key,deck);
      }
      const chosen=deck.remaining.pop(); deck.last=chosen;
      const [actualTheme,words,intent]=pool[chosen];
      return {sources:words.split(',').map(word=>({...seedMap.get(word),themes:[...seedMap.get(word).themes]})),theme:actualTheme,intent,cycle:deck.cycle,poolSize:pool.length};
    },
    reset(){decks.clear();},
  };
}

function parseSources(input,warnings) {
  if(!Array.isArray(input)||input.length<2||input.length>3) {
    warnings.push('Choose exactly two or three source words.'); return [];
  }
  const result=input.map((entry,index)=>{
    const object=entry&&typeof entry==='object'?entry:{word:entry};
    const word=cleanText(object.word,120);
    const normalized=normal(word);
    const seed=seedMap.get(normalized);
    const supplied=cleanText(object.gloss,MAX_GLOSS);
    return {index,word,normalized,gloss:supplied||seed?.gloss||'',glossSource:supplied?'user':seed?'seed':'unknown',themes:seed?[...seed.themes]:[]};
  });
  if(result.some(x=>[...x.normalized].length<2||[...x.normalized].length>MAX_WORD)) {
    warnings.push(`Each source needs 2–${MAX_WORD} letters after spaces and punctuation are removed.`);return [];
  }
  if(new Set(result.map(x=>x.normalized)).size!==result.length) {
    warnings.push('Choose distinct source words so every source contributes a separate idea.');return [];
  }
  if(result.some(x=>x.word.toLocaleLowerCase('en')!==x.normalized)) warnings.push('Splices use lowercase letters with spaces and punctuation removed; original labels are retained.');
  return result;
}

function soundScore(word) {
  let score=0;
  if(vowels.test(word))score+=7; else score-=22;
  const runs=word.match(/[bcdfghjklmnpqrstvwxz]+/gi)||[];
  const longest=Math.max(0,...runs.map(x=>x.length));
  if(longest>3)score-=(longest-3)*7;
  if(/(.)\1\1/u.test(word))score-=9;
  if(/[aeiou]{4}/i.test(word))score-=9;
  if(word.length>=4&&word.length<=13)score+=6;
  if(word.length>18)score-=(word.length-18)*2;
  return score;
}

function rank(state,sources) {
  let score=46+soundScore(state.word);
  score+=state.joins.reduce((sum,j)=>sum+(j.overlap.length?9+Math.min(3,j.overlap.length)*2:0),0);
  const retained=state.segments.map((s,i)=>(s.sourceEnd-s.sourceStart)/sources[i].normalized.length);
  score+=retained.reduce((sum,n)=>sum+(n>=0.3&&n<=0.8?5:1),0);
  score-=Math.abs(retained[0]-retained[retained.length-1])*8;
  if(state.segments.some(s=>s.fragment.length<3))score-=2;
  const fixture=sources.map(x=>x.normalized).join('|');
  if((fixture==='smoke|fog'&&state.word==='smog')||(fixture==='breakfast|lunch'&&state.word==='brunch'))score=99;
  return Math.max(1,Math.min(99,Math.round(score)));
}

function hasUniqueContribution(state) {
  return state.segments.every((segment,index)=>{
    for(let p=segment.outputStart;p<segment.outputEnd;p++) {
      if(!state.segments.some((other,j)=>j!==index&&p>=other.outputStart&&p<other.outputEnd))return true;
    }
    return false;
  });
}

function joinState(left,source,sourceIndex,sourceStart,overlapLength) {
  const fragment=source.normalized.slice(sourceStart);
  const overlap=fragment.slice(0,overlapLength);
  const outputStart=left.word.length-overlapLength;
  return {
    word:left.word+fragment.slice(overlapLength),
    segments:[...left.segments,{sourceIndex,source:source.word,fragment,sourceStart,sourceEnd:source.normalized.length,outputStart,outputEnd:outputStart+fragment.length}],
    joins:[...left.joins,{leftSource:sourceIndex-1,rightSource:sourceIndex,overlap,overlapLength,outputStart,outputEnd:outputStart+overlapLength}],
  };
}

function buildPair(sources,mode) {
  const [first,second]=sources; const results=[];
  const firstOffsets=letterOffsets(first.normalized);
  const secondOffsets=letterOffsets(second.normalized);
  for(const end of firstOffsets.slice(2)) {
    const prefix=first.normalized.slice(0,end);
    const left={word:prefix,segments:[{sourceIndex:0,source:first.word,fragment:prefix,sourceStart:0,sourceEnd:end,outputStart:0,outputEnd:end}],joins:[]};
    for(const start of secondOffsets.slice(0,-2)) {
      const suffix=second.normalized.slice(start);
      const overlapOffsets=letterOffsets(suffix).slice(mode==='overlap'?1:0,-1);
      for(const n of overlapOffsets) {
        if(n>=prefix.length)continue;
        if(n>0&&!prefix.endsWith(suffix.slice(0,n)))continue;
        if(mode==='clipped'&&n>0)continue;
        if(n===0&&end===first.normalized.length&&start===0)continue;
        const candidate=joinState(left,second,1,start,n);
        if(candidate.word===first.normalized||candidate.word===second.normalized||!hasUniqueContribution(candidate))continue;
        candidate.score=rank(candidate,sources.slice(0,2));results.push(candidate);
      }
    }
  }
  return results;
}

function dedupeRank(states,limit=BEAM) {
  const result=new Map();
  for(const state of states) {
    const existing=result.get(state.word);
    const overlaps=state.joins.filter(x=>x.overlap.length).length;
    const oldOverlaps=existing?.joins.filter(x=>x.overlap.length).length??-1;
    if(!existing||state.score>existing.score||(state.score===existing.score&&overlaps>oldOverlaps))result.set(state.word,state);
  }
  return [...result.values()].sort((a,b)=>b.score-a.score||b.joins.filter(x=>x.overlap.length).length-a.joins.filter(x=>x.overlap.length).length||a.word.length-b.word.length||a.word.localeCompare(b.word,'en')).slice(0,limit);
}

function meaningFor(sources,intent) {
  const unknown=sources.filter(x=>!x.gloss).map(x=>x.word);
  const descriptions=sources.map(x=>`${x.word}: ${x.gloss||'meaning not supplied'}`);
  // The form exposes curated glosses for editing. Passing those unchanged
  // should retain the curated relationship; an actual edit takes precedence.
  const knownSet=sources.every(x=>x.gloss===seedMap.get(x.normalized)?.gloss)?sourceSets.find(x=>x[1]===sources.map(s=>s.normalized).join(',')):null;
  let interpretation;
  if(intent) interpretation=`Intent-guided reading: ${intent}`;
  else if(unknown.length) interpretation=`A spelling candidate combining ${sources.map(x=>x.word).join(' + ')}. Add a short meaning for ${unknown.join(' and ')} before choosing what this blend should mean.`;
  else if(knownSet) interpretation=`Possible reading: ${knownSet[2]}`;
  else if(sources.length===2) interpretation=`Possible reading: ${sources[0].gloss}, understood or reshaped through ${sources[1].gloss}. This combines the supplied concepts; their precise relationship is yours to choose.`;
  else interpretation=`Possible reading: ${sources[0].gloss}, shaped by ${sources[1].gloss} and interpreted in relation to ${sources[2].gloss}. This is one proposed ordering of the three supplied concepts.`;
  return {
    label:'Deterministic interpretation proposal · no AI service called',interpretation,intent,
    sourceGlosses:sources.map(x=>({word:x.word,gloss:x.gloss,source:x.glossSource})),
    unknownSources:unknown,
    readings:unknown.length?[]:[
      interpretation,
      `Alternative: the tension or contrast between ${sources.map(x=>`${x.word} (${x.gloss})`).join(' and ')}.`,
      `Alternative: a movement from ${sources[0].word} toward ${sources[sources.length-1].word}${sources.length===3?` through ${sources[1].word}`:''}, if that progression fits your intent.`,
    ],
    questions:unknown.length?unknown.map(word=>`What should “${word}” mean in this experiment?`):[
      'Which component is the main idea, and which changes its meaning?',
      sources.length===3?'Does the third source add a distinct idea rather than merely decorate the sound?':'What does the combined concept express more precisely than either source alone?',
    ],
  };
}

/** Construct ranked exact-overlap or explicitly clipped candidates; no concatenation fallback. */
export function generateBlends(options={}) {
  const settings=options&&typeof options==='object'?options:{};
  const warnings=[];const sources=parseSources(settings.sources,warnings);
  const intent=cleanText(settings.intent,MAX_INTENT);
  const rawLimit=Number(settings.limit??8);
  const limit=Number.isFinite(rawLimit)?Math.max(1,Math.min(MAX_RESULTS,Math.floor(rawLimit))):8;
  const mode=['any','overlap','clipped'].includes(settings.mode)?settings.mode:'any';
  if(!sources.length)return {sources,candidates:[],warnings,limits:{maxWordLength:MAX_WORD,maxResults:MAX_RESULTS}};
  let states=buildPair(sources,mode);
  if(sources.length===3) {
    const pairs=dedupeRank(states,BEAM);states=[];
    const third=sources[2];
    for(const left of pairs)for(const start of letterOffsets(third.normalized).slice(0,-2)) {
      const suffix=third.normalized.slice(start);
      const middle=left.segments[1];
      for(const n of letterOffsets(suffix).slice(mode==='overlap'?1:0,-1)) {
        if(n>=middle.fragment.length)continue;
        if(n>0&&!left.word.endsWith(suffix.slice(0,n)))continue;
        if(mode==='clipped'&&n>0)continue;
        const candidate=joinState(left,third,2,start,n);
        if(!hasUniqueContribution(candidate))continue;
        // A zero-overlap join still needs an actual clipping, not an intact compound step.
        if(n===0&&start===0&&middle.sourceStart===0)continue;
        candidate.score=rank(candidate,sources);states.push(candidate);
      }
    }
  }
  const meaning=meaningFor(sources,intent);
  const candidates=dedupeRank(states,limit).map(state=>{
    const overlapCount=state.joins.filter(x=>x.overlap.length>0).length;
    const method=overlapCount===state.joins.length?'overlap':overlapCount===0?'clipped':'mixed';
    const isPortmantres=sources.length===3&&overlapCount===2&&hasUniqueContribution(state);
    return {...state,method,isPortmantres,meaning,
      construction:state.segments.map(s=>`${s.source}[${s.sourceStart}:${s.sourceEnd}] → ${s.fragment}`).join(' + '),
      scoreLabel:'Spelling heuristic, not meaning quality or confidence',
      novelty:'not_checked',
    };
  });
  if(!candidates.length)warnings.push(mode==='overlap'?'No exact overlapping construction found. Try clipped mode, change source order, or choose other words.':'No blend satisfying contribution rules was found; plain concatenation is not offered as a blend.');
  if(meaning.unknownSources.length)warnings.push('Unknown source meanings are left open; add a gloss for a meaningful interpretation.');
  return {sources,candidates,warnings,limits:{maxWordLength:MAX_WORD,maxResults:MAX_RESULTS}};
}
