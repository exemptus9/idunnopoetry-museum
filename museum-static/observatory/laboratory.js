import {generateBlends, createSourceShuffler, BLEND_THEMES} from './blend-engine.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const SHELF_KEY = 'lexical-observatory:visitor-specimens:v1';
const cap = value => String(value).replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());

export function laboratoryMarkup() {
  return `<section class="section page-intro lab-intro"><p class="eyebrow">B’sMyth’s department of unlikely combinations</p><h1>What happens<br>if these <em>mean?</em></h1><p>A little wordplay. A little thought experiment. Give two ideas a shared edge—or let chance introduce them.</p></section>
  <section class="section blend-workshop" aria-labelledby="workshop-title"><div class="workshop-heading"><div><p class="eyebrow">The wordsmith’s bench / 01</p><h2 id="workshop-title">Make a meaningful collision.</h2></div><span class="instrument-stamp">No blank<br>page required.</span></div>
  <form id="blend-form"><div class="blend-toolbar"><label>Sources<select id="blend-mode" name="count"><option value="2">Two words</option><option value="3">Three words · Portmantrés experiment</option></select></label><label>Shuffle territory<select id="blend-theme"><option value="all">A little of everything</option>${BLEND_THEMES.filter(theme=>theme!=='all').map(theme=>`<option value="${esc(typeof theme==='string'?theme:theme.id)}">${esc(cap(typeof theme==='string'?theme:theme.label||theme.id))}</option>`).join('')}</select></label><button type="button" class="button shuffle-button" id="blend-shuffle"><span aria-hidden="true">⤨</span> Surprise me</button></div>
  <div class="blend-sources">${[0,1,2].map(i=>`<fieldset class="blend-source source-${i}" ${i===2?'hidden':''}><legend><span class="source-index">0${i+1}</span> ${['A beginning','An interruption','A third possibility'][i]}</legend><label class="visually-hidden" for="source${i}">Source word ${i+1}</label><input id="source${i}" name="source${i}" maxlength="40" autocomplete="off" spellcheck="false" ${i<2?'required':''} placeholder="A word or concept"><div class="source-under"><label class="pin-source"><input type="checkbox" name="pin${i}"> Keep when shuffling</label></div><details class="source-meaning"><summary>What does it mean here?</summary><label for="gloss${i}" class="visually-hidden">Meaning of source ${i+1}</label><textarea id="gloss${i}" name="gloss${i}" maxlength="240" rows="2" placeholder="Your intended meaning, especially for an unfamiliar word"></textarea></details></fieldset>`).join('')}</div>
  <details class="blend-intent"><summary>Steer the meaning <span>Optional, but a good place for the point.</span></summary><label for="blend-intent" class="visually-hidden">What should the new word express?</label><input id="blend-intent" name="intent" maxlength="180" placeholder="e.g. finding a little humour while everything is going wrong"></details>
  <div class="blend-submit"><button class="button" type="submit">Find the words between →</button><button type="button" id="blend-reverse" class="text-button">Reverse the ingredients</button><p>Made here, on your device. No account or AI credits.</p></div></form>
  <p id="blend-status" class="small-meta" role="status" aria-live="polite"></p><div id="blend-results" class="blend-results"></div>
  <details class="bench-method"><summary>What is this actually doing?</summary><p>The bench ranks shared-letter joins and clipped fragments, checks that each source contributes, and builds possible readings from supplied meanings or a small curated concept bank. It is a rule-based creative aid, not a live language model, dictionary search, pronunciation guide, or originality test.</p><p>A three-source result is marked “Portmantrés candidate” only when it has two literal overlaps and a distinct contribution from every source. Other three-source experiments are labeled clipped blends. You decide whether a construction earns its meaning.</p></details></section>
  <section class="section visitor-shelf"><div class="section-heading"><div><p class="eyebrow">The pockets of the lab coat</p><h2>Keep the almosts.</h2></div><button type="button" class="text-button" id="blend-clear-shelf">Empty this shelf</button></div><p class="small-meta">Saved only in this browser when you choose Keep. These experiments never enter the public archive automatically.</p><div id="blend-shelf" class="blend-shelf"></div></section>
  <section class="section curiosity-cabinet"><div class="cabinet-copy"><p class="eyebrow">An unnecessary, necessary diversion</p><h2>The road to a word<br>is occasionally <em>a road.</em></h2><p>A small nod to the old IDunnoPoetry experiments. Sixty miles per hour. Absolutely nowhere to be.</p><details><summary>Open the dial-up drawer</summary><p class="alias-output" id="alias-output">xX_unfinishedThought_Xx</p><button type="button" class="text-button" id="alias-shuffle">Generate an implausibly plausible screen name</button><p class="small-meta">A nostalgic pattern joke. No accounts created. No teenagers consulted.</p></details></div><div class="road-instrument"><div class="road-scene road-desert" id="word-road" role="img" aria-label="A stylized desert road, paused"><span class="road-sun"></span><span class="road-hills"></span><span class="road-surface"><i></i></span><span class="road-sign">WORD<br>AHEAD</span></div><div class="road-readout"><output id="road-distance">0.00 mi</output><span>60 mph · simulated</span></div><div class="road-controls"><button class="button secondary" id="road-toggle" type="button" aria-pressed="false">Start wandering</button><label class="visually-hidden" for="road-theme">Road scenery</label><select id="road-theme"><option value="desert">Desert of ideas</option><option value="snow">A blank page of snow</option><option value="night">Midnight train of thought</option></select><button type="button" class="text-button" id="road-reset">Back to nowhere</button></div><p class="small-meta">Motion follows your device preference. The distance still counts.</p></div></section>`;
}

function readShelf(storage) {
  try {const entries=JSON.parse(storage?.getItem(SHELF_KEY)||'[]');return Array.isArray(entries)?entries.filter(e=>typeof e.word==='string'&&typeof e.meaning==='string').slice(0,12):[];} catch {return [];}
}

export function mountLaboratory(root, terms = [], options = {}) {
  if(!root?.querySelector('#blend-form')) return ()=>{};
  const $=selector=>root.querySelector(selector), form=$('#blend-form');
  const shuffler=createSourceShuffler({rng:options.rng||Math.random});
  let current=[], shelf=[], storage;
  try {storage=window.localStorage;shelf=readShelf(storage);} catch {storage=null;}
  const status=message=>{$('#blend-status').textContent=message;};
  const count=()=>Number($('#blend-mode').value);
  const sources=()=>Array.from({length:count()},(_,i)=>({word:form.elements[`source${i}`].value.trim(),gloss:form.elements[`gloss${i}`].value.trim()}));
  const persist=()=>{try {if(!storage)throw new Error();storage.setItem(SHELF_KEY,JSON.stringify(shelf));return true;}catch {status('Browser storage is unavailable. You can still copy your experiment.');return false;}};
  const renderShelf=()=>{$('#blend-shelf').innerHTML=shelf.length?shelf.map((entry,i)=>`<article><span class="eyebrow">Visitor specimen / ${String(i+1).padStart(2,'0')}</span><h3>${esc(entry.word)}</h3><p>${esc(entry.meaning)}</p><p class="small-meta">${esc(entry.sources)}</p><button class="text-button" type="button" data-shelf-copy="${i}">Copy</button> <button class="text-button" type="button" data-shelf-remove="${i}" aria-label="Remove ${esc(entry.word)} from this device">Release it</button></article>`).join(''):'<p class="shelf-empty">Nothing in your pockets. Yet.</p>';};
  const copy=async(text)=>{try{await navigator.clipboard.writeText(text);status('Copied. The next thought is yours.');}catch{status('Clipboard unavailable. Select the specimen text to copy it.');}};
  const generate=()=>{
    const input=sources().map(source=>{const known=terms.find(term=>term.headword.toLocaleLowerCase()===source.word.toLocaleLowerCase());return {...source,gloss:source.gloss||known?.definition||''};});
    if(input.some(s=>!s.word)){status('Each source needs a word. Shuffle can supply the beginnings.');return;}
    const result=generateBlends({sources:input,intent:form.elements.intent.value,limit:4});
    current=result.candidates||[];
    $('#blend-results').innerHTML=current.map((candidate,i)=>{
      const meaning=candidate.meaning||{}, unknown=meaning.unknownSources||[];
      return `<article class="blend-candidate${i===0?' leading-candidate':''}"><div class="candidate-meta"><span class="eyebrow">${i===0?'First possibility':`Another route / 0${i+1}`}</span><span>${candidate.isPortmantres?'Portmantrés candidate':esc(cap(candidate.method))}</span></div><h3>${esc(candidate.word)}</h3><p class="candidate-reading">${esc(meaning.interpretation||'Add the source meanings to explore a reading.')}</p><p class="small-meta">${esc(meaning.label||'Suggested reading · rule-based')}</p><div class="candidate-fragments" aria-label="Contributions from source words">${(candidate.segments||[]).map((segment,j)=>`<span class="fragment-${segment.sourceIndex}"><b>${esc(segment.fragment)}</b><small>from ${esc(segment.source||input[segment.sourceIndex]?.word)}</small></span>${j<(candidate.segments.length-1)?'<i aria-hidden="true">+</i>':''}`).join('')}</div><details><summary>Inspect the joins &amp; meaning</summary><p>${esc(candidate.construction)}</p>${unknown.length?`<p>Meaning needed for: ${unknown.map(esc).join(', ')}. Open “What does it mean here?” above to guide the reading.</p>`:''}${meaning.readings?.length>1?`<p><strong>Other ways to turn the thought:</strong></p><ul>${meaning.readings.slice(1).map(reading=>`<li>${esc(reading)}</li>`).join('')}</ul>`:''}${meaning.questions?.length?`<ul>${meaning.questions.map(q=>`<li>${esc(q)}</li>`).join('')}</ul>`:''}<p class="small-meta">A proposed construction, not a claim of prior usage, originality, or author approval.</p></details><div class="candidate-actions"><button class="text-button" type="button" data-blend-copy="${i}">Copy word &amp; reading</button><button class="text-button" type="button" data-blend-keep="${i}">Keep on this device +</button></div></article>`;
    }).join('')||'<div class="empty-state"><h3>These pieces resist the join.</h3><p>Try shorter source forms, reverse their order, or shuffle another pair. A forced concatenation would not improve the experiment.</p></div>';
    status(`${current.length} ${current.length===1?'possibility':'possibilities'}. ${(result.warnings||[]).join(' ')}`);
  };
  const shuffle=()=>{
    if(sources().every((_,i)=>form.elements[`pin${i}`].checked)){status('All sources are pinned. Uncheck one “Keep when shuffling” to invite chance back in.');return;}
    let next;
    for(let attempt=0;attempt<12;attempt++){
      next=shuffler.next({theme:$('#blend-theme').value,count:count()});
      const combined=next.sources.map((s,i)=>form.elements[`pin${i}`].checked?form.elements[`source${i}`].value:s.word);
      if(new Set(combined.map(w=>w.toLowerCase())).size===count())break;
    }
    next.sources.slice(0,count()).forEach((s,i)=>{if(!form.elements[`pin${i}`].checked){form.elements[`source${i}`].value=s.word;form.elements[`gloss${i}`].value=s.gloss;}});
    generate();
  };
  form.addEventListener('submit',event=>{event.preventDefault();generate();});
  $('#blend-shuffle').addEventListener('click',shuffle);
  $('#blend-mode').addEventListener('change',()=>{const three=count()===3;$('.source-2').hidden=!three;form.elements.source2.required=three;shuffle();});
  $('#blend-theme').addEventListener('change',shuffle);
  $('#blend-reverse').addEventListener('click',()=>{const source=sources().reverse();source.forEach((s,i)=>{form.elements[`source${i}`].value=s.word;form.elements[`gloss${i}`].value=s.gloss;});generate();});
  $('#blend-clear-shelf').addEventListener('click',()=>{shelf=[];persist();renderShelf();status('Shelf emptied on this device.');});
  const handleSpecimenClick=event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-blend-copy')){const c=current[Number(button.dataset.blendCopy)];if(c)copy(`${c.word} — ${c.meaning?.interpretation||''}\nSources: ${sources().map(s=>s.word).join(' + ')}\nExperimental blend · Lexical Observatory`);}
    if(button.hasAttribute('data-blend-keep')){const c=current[Number(button.dataset.blendKeep)];if(c){const entry={word:c.word,meaning:c.meaning?.interpretation||'',sources:sources().map(s=>s.word).join(' + ')};shelf=[entry,...shelf.filter(e=>e.word!==entry.word)].slice(0,12);if(persist())status(`${c.word} kept on this device. It has not been published.`);renderShelf();}}
    if(button.hasAttribute('data-shelf-copy')){const e=shelf[Number(button.dataset.shelfCopy)];if(e)copy(`${e.word} — ${e.meaning}\nSources: ${e.sources}`);}
    if(button.hasAttribute('data-shelf-remove')){shelf.splice(Number(button.dataset.shelfRemove),1);persist();renderShelf();}
  };
  root.addEventListener('click',handleSpecimenClick);
  renderShelf();shuffle();
  let running=false, elapsed=0, started=0, interval=null;
  const now=options.now||(()=>performance.now());
  const readout=()=>{$('#road-distance').textContent=`${((elapsed+(running?Math.max(0,now()-started):0))/60000).toFixed(2)} mi`;};
  const stop=()=>{if(running){elapsed+=Math.max(0,now()-started);running=false;}clearInterval(interval);interval=null;$('#word-road').classList.remove('travelling');$('#word-road').setAttribute('aria-label',`A stylized ${$('#road-theme').value} road, paused`);$('#road-toggle').textContent='Start wandering';$('#road-toggle').setAttribute('aria-pressed','false');readout();};
  $('#road-toggle').addEventListener('click',()=>{if(running){stop();return;}running=true;started=now();$('#word-road').classList.add('travelling');$('#road-toggle').textContent='Pause here';$('#road-toggle').setAttribute('aria-pressed','true');$('#word-road').setAttribute('aria-label','A stylized road, journey running');interval=setInterval(readout,250);});
  $('#road-reset').addEventListener('click',()=>{stop();elapsed=0;readout();$('#word-road').setAttribute('aria-label','A stylized road, paused');});
  $('#road-theme').addEventListener('change',()=>{const road=$('#word-road');road.className=`road-scene road-${$('#road-theme').value}${running?' travelling':''}`;road.setAttribute('aria-label',`A stylized ${$('#road-theme').value} road, ${running?'journey running':'paused'}`);});
  const first=['unfinished','cosmic','poetic','accidental','almost','contrary','dialup','subtle'], second=['Thought','Static','Alchemy','Paradox','Syntax','Mischief','Muse','Semicolon'];let lastAlias='';
  $('#alias-shuffle').addEventListener('click',()=>{let name;do{name=`xX_${first[Math.floor(Math.random()*first.length)]}${second[Math.floor(Math.random()*second.length)]}${Math.floor(Math.random()*90+10)}_Xx`;}while(name===lastAlias);lastAlias=name;$('#alias-output').textContent=name;});
  return ()=>{stop();root.removeEventListener('click',handleSpecimenClick);};
}
