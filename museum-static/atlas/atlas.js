/* Continuity Atlas: public client-side discovery only. No external data calls or analytics. */
(() => {
  'use strict';
  const corpus = Array.isArray(window.IDP_ATLAS_POEMS) ? window.IDP_ATLAS_POEMS : [];
  const bySlug = new Map(corpus.map(p => [p.slug, p]));
  const $ = selector => document.querySelector(selector);
  const trailKey = 'idp_atlas_read_v1';
  const clean = value => String(value || '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  const safeQuery = value => String(value || '').trim().slice(0, 220);
  const queryInput = $('#query'), results = $('#results'), status = $('#search-status'), more = $('#more-results');
  const museum = $('#search-forum'), words = $('#search-words');
  let found = [], visible = 7;
  function el(tag, name, text) {
    const node = document.createElement(tag);
    if (name) node.className = name;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }
  function classicUrl(slug) { return '../classic/poems/' + encodeURIComponent(slug) + '.html'; }
  function scorePoem(p, q, tokens) {
    const title = clean(p.title), body = clean(p.text), haystack = title + ' ' + body;
    if (!tokens.every(token => haystack.includes(token))) return 0;
    let score = title === q ? 100 : title.includes(q) ? 50 : 0;
    if (body.includes(q)) score += 22;
    for (const token of tokens) {
      if (title.includes(token)) score += 9;
      const count = body.split(token).length - 1;
      score += Math.min(count, 8);
    }
    return score;
  }
  function snippet(p, q) {
    const text = p.text || '', lower = clean(text);
    const bits = q.split(' ').filter(Boolean);
    let at = lower.indexOf(q);
    if (at === -1) at = Math.max(0, lower.indexOf(bits[0] || q));
    const start = at > 48 ? at - 48 : 0;
    const end = Math.min(text.length, start + 180);
    return (start ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
  }
  function updateCrossLinks(q) {
    museum.href = q ? '../#search/' + encodeURIComponent(q) : '../#search';
    words.href = q ? '../observatory/?q=' + encodeURIComponent(q) + '#archive' : '../observatory/#archive';
    museum.setAttribute('aria-label', q ? 'Search the historic public forum for ' + q : 'Search the historic public forum');
    words.setAttribute('aria-label', q ? 'Search the public Lexical Observatory for ' + q : 'Search the public Lexical Observatory');
  }
  function renderResults() {
    results.replaceChildren();
    if (!corpus.length) {
      results.append(el('p', 'empty-note', 'The local search index is unavailable. The original poetry index remains accessible.'));
      status.textContent = 'Search index unavailable';
      more.hidden = true;
      return;
    }
    const query = safeQuery(queryInput.value), q = clean(query);
    updateCrossLinks(query);
    if (!q) {
      status.textContent = 'All 106 surviving original poems are ready to search.';
      results.append(el('p', 'empty-note', 'A title, a feeling, half a line: start anywhere.'));
      more.hidden = true;
      return;
    }
    const tokens = q.split(/\s+/).filter(Boolean);
    found = corpus.map(p => ({p,score:scorePoem(p,q,tokens)})).filter(row => row.score > 0)
      .sort((a,b) => b.score - a.score || a.p.order - b.p.order).map(row=>row.p);
    status.textContent = found.length + (found.length === 1 ? ' historic poem matches' : ' historic poems match') + ' “' + query + '”.';
    if (!found.length) {
      results.append(el('p', 'empty-note', 'No matches in the surviving 106 poems. Try another spelling, fewer words, or continue in the forum or word archive below.'));
      more.hidden = true;
      return;
    }
    for (const p of found.slice(0, visible)) {
      const link = el('a', 'result');
      link.href = classicUrl(p.slug);
      const meta = el('div','meta'); meta.append(el('span','', 'ORIGINAL POEM · INDEX ' + String(p.order).padStart(3,'0')),el('span','','↗'));
      link.append(meta,el('h3','',p.title),el('p','',snippet(p,q)));
      results.append(link);
    }
    more.hidden = found.length <= visible;
    if (!more.hidden) more.textContent = 'Show more (' + (found.length - visible) + ' remaining) ↓';
  }
  if (corpus.length !== 106 || new Set(corpus.map(p => p.slug)).size !== 106) {
    console.warn('IDP Atlas search corpus missing or incomplete; provenance gate disabled live results.');
    corpus.length = 0;
  }
  $('#search-form')?.addEventListener('submit', event => {
    event.preventDefault(); visible=7; renderResults();
    const url = new URL(window.location.href), q=safeQuery(queryInput.value);
    if(q)url.searchParams.set('q',q);else url.searchParams.delete('q');
    try{history.replaceState(history.state,'',url.pathname+url.search+url.hash)}catch(e){}
  });
  queryInput?.addEventListener('input',()=>{visible=7;renderResults();});
  document.querySelectorAll('[data-query]').forEach(button=>button.addEventListener('click',()=>{
    queryInput.value=button.dataset.query || '';visible=7;renderResults();queryInput.focus();
  }));
  more?.addEventListener('click',()=>{
    visible += 8;renderResults();
    const targets=results.querySelectorAll('.result');targets[Math.max(0,visible-8)]?.focus?.();
  });
  document.addEventListener('keydown',event=>{
    if ((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k') {event.preventDefault();queryInput?.focus();$('#finder')?.scrollIntoView({block:'start'});}
    if (event.key==='/' && !event.ctrlKey&&!event.metaKey&&!event.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')){
      event.preventDefault();queryInput?.focus();$('#finder')?.scrollIntoView({block:'start'});
    }
  });
  const initial = new URLSearchParams(location.search).get('q');
  if(initial && queryInput){queryInput.value=safeQuery(initial);$('#finder')?.scrollIntoView({block:'start'});}
  renderResults();

  const paths = {
    resilience:{title:'Breaking / becoming',description:'An interpretive sequence from fracture through aftermath toward survival. Not an author-confirmed developmental order.',slugs:['broken','scars','survive']},
    connection:{title:'Longing / connection',description:'A small exploration of love, absence, and the possibility of human contact.',slugs:['missing','lovedream','touch']},
    wonder:{title:'Question / possibility',description:'Three historical titles that invite questions about uncertainty and returning to life.',slugs:['uncertain','wonder','redivivus']},
    language:{title:'Words / beyond words',description:'An editorial walk through the language-oriented titles of the early archive.',slugs:['words','interstice','glass']}
  };
  function setPath(key) {
    const path=paths[key];if(!path)return;
    const index=Object.keys(paths).indexOf(key)+1;
    $('#path-eyebrow').textContent='READING PATH '+String(index).padStart(2,'0')+' / 04';
    $('#path-title').textContent=path.title;
    $('#path-description').textContent=path.description;
    const items=$('#path-steps');items.replaceChildren();
    for(const slug of path.slugs){const p=bySlug.get(slug);if(!p)continue;
      const li=el('li');const a=el('a','',p.title);a.href=classicUrl(slug);a.append(el('span','', '↗'));li.append(a);items.append(li);
    }
    document.querySelectorAll('[data-path]').forEach(button=>{
      const selected=button.dataset.path===key;
      button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
    });
  }
  document.querySelectorAll('[data-path]').forEach(button=>button.addEventListener('click',()=>setPath(button.dataset.path)));
  setPath('resilience');

  const surprise=$('#surprise'), surpriseBox=$('#surprise-result');
  surprise?.addEventListener('click',()=>{
    if(!corpus.length)return;
    let number;
    if(window.crypto && window.crypto.getRandomValues){const u=new Uint32Array(1);window.crypto.getRandomValues(u);number=u[0]%corpus.length;}
    else number=Math.floor(Math.random()*corpus.length);
    const p=corpus[number];surpriseBox.replaceChildren();
    surpriseBox.append(el('span','big-asterisk','✳'),el('span','mini-label','SURPRISE / INDEX '+String(p.order).padStart(3,'0')),el('strong','',p.title));
    const link=el('a','','Read this original poem ↗');link.href=classicUrl(p.slug);surpriseBox.append(link);
  });

  function readTrail(){try{
    const a=JSON.parse(localStorage.getItem(trailKey)||'[]');
    return Array.isArray(a) ? a.filter(x=>x&&typeof x.slug==='string'&&bySlug.has(x.slug)).slice(0,8):[];
  }catch(e){return[]}}
  function showTrail(){const old=readTrail(),slot=$('#recent-list');slot.replaceChildren();$('#clear-trail').hidden=!old.length;
    if(!old.length){slot.append(el('p','empty-note','Your trail begins when you open an original poem.'));return;}
    const list=el('div','recent-list');
    for(const record of old){const p=bySlug.get(record.slug);const link=el('a','',p.title);link.href=classicUrl(p.slug);link.append(el('span','','↗'));list.append(link)}
    slot.append(list);
  }
  $('#clear-trail')?.addEventListener('click',()=>{try{localStorage.removeItem(trailKey)}catch(e){}showTrail();});
  showTrail();
})();
