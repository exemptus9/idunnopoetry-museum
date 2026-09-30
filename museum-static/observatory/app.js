(function(){
  var KEY="lexical-observatory.local.v1";
  var root=document.getElementById("app");
  var seed=window.LEXICAL_SEED;
  var state=load();
  function clone(x){return JSON.parse(JSON.stringify(x));}
  function load(){try{var v=localStorage.getItem(KEY);return v?JSON.parse(v):clone(seed);}catch(e){return clone(seed);}}
  function save(){localStorage.setItem(KEY,JSON.stringify(state));}
  function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function slug(v){return String(v||"").toLowerCase().normalize("NFKD").replace(/[’']/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
  function cap(v){return String(v||"").replace(/_/g," ").replace(/\b\w/g,function(c){return c.toUpperCase();});}
  function terms(){return state.terms.filter(function(t){return t.visibility!=="private";});}
  function find(id){return state.terms.find(function(t){return t.id===id;});}
  function count(stage){return terms().filter(function(t){return t.stage===stage;}).length;}
  function dateLabel(t){if(!t.coined)return "Date unrecorded";if(t.precision==="year")return t.coined.slice(0,4);if(t.precision==="month")return t.coined.slice(0,7);return t.coined;}
  function stamp(){return new Date().toISOString().slice(0,10);}
  function stageBadge(t){return '<span class="badge '+esc(t.stage)+'">'+esc(t.stage)+'</span>';}
  function card(t){
    return '<article class="card" data-term="'+esc(t.id)+'">'+
      '<div class="meta">'+stageBadge(t)+'<span class="badge">'+esc(t.formation||"unclassified")+'</span></div>'+
      '<h3>'+esc(t.term)+'</h3><p class="subtle">'+esc(t.definition)+'</p>'+
      '<div class="meta">'+(t.domains||[]).slice(0,3).map(function(x){return '<span class="badge">'+esc(x)+'</span>';}).join("")+'</div>'+
      '<small class="subtle">'+esc(dateLabel(t))+' · '+esc(t.provenanceStatus||"uncertain")+'</small></article>';
  }
  function wireCards(){document.querySelectorAll("[data-term]").forEach(function(el){el.onclick=function(){location.hash="term/"+el.getAttribute("data-term");};});}
  function route(){
    var raw=decodeURIComponent(location.hash.slice(1)||"home"),parts=raw.split("?"),path=parts[0],qs=new URLSearchParams(parts[1]||"");
    window.scrollTo(0,0);
    if(path==="home")home();
    else if(path==="forge"||path==="lexicon"||path==="canon")browse(path,qs.get("q")||"");
    else if(path.indexOf("term/")===0)detail(path.slice(5));
    else if(path==="observatory")observatory();
    else if(path==="constellation")constellation();
    else if(path==="continuity")continuity();
    else if(path==="admin")admin();
    else home();
  }
  function home(){
    var sorted=terms().slice().sort(function(a,b){return String(b.coined).localeCompare(String(a.coined));});
    var recent=sorted.slice(0,6),canon=terms().filter(function(t){return t.stage==="canon";});
    var known=terms().filter(function(t){return t.definition.indexOf("Definition pending")!==0;}).length;
    root.innerHTML='<section class="hero"><div class="eyebrow">Lexical phenomenology · longitudinal archive</div>'+
      '<h1>A living record of words becoming ideas.</h1>'+
      '<p class="lead">Some concepts receive names after they are understood. Others begin as word-shaped hypotheses. The Observatory records both—and preserves what happens next.</p>'+
      '<div class="search-row"><input id="homeSearch" placeholder="Search term, definition, root, domain…"><button id="homeGo">Search</button></div></section>'+
      '<section class="grid tiers">'+
        '<a class="tier forge" href="#forge"><small>'+count("forge")+' terms</small><h2>The Forge</h2><p>Every worthwhile coinage: provisional, playful, unresolved, or awaiting source recovery.</p></a>'+
        '<a class="tier lexicon" href="#lexicon"><small>'+count("lexicon")+' terms</small><h2>The Lexicon</h2><p>Terms stable enough to function as conceptual tools and withstand definition.</p></a>'+
        '<a class="tier canon" href="#canon"><small>'+count("canon")+' terms</small><h2>The Canon</h2><p>Terms that earn durable status through repeated use, generativity, or independent transmission.</p></a>'+
      '</section>'+
      '<section class="grid stats section"><div class="stat"><strong>'+terms().length+'</strong><span>public terms</span></div>'+
        '<div class="stat"><strong>'+known+'</strong><span>working definitions</span></div>'+
        '<div class="stat"><strong>'+state.relations.length+'</strong><span>recorded relations</span></div>'+
        '<div class="stat"><strong>'+terms().filter(function(t){return t.transmission!=="self";}).length+'</strong><span>beyond-self transmissions</span></div>'+
        '<div class="stat"><strong>'+terms().filter(function(t){return t.wordIdeaOrder==="word_first";}).length+'</strong><span>word-first records</span></div></section>'+
      '<section class="page"><div class="eyebrow">Recently recorded</div><h2>Current working corpus</h2><div class="grid cards">'+recent.map(card).join("")+'</div></section>'+
      '<section class="page"><div class="eyebrow">Canon</div><h2>What has earned permanence?</h2>'+
        (canon.length?'<div class="grid cards">'+canon.map(card).join("")+'</div>':'<div class="empty">Nothing has been promoted to Canon yet. That is deliberate. Canon is a survival status, not a compliment.</div>')+'</section>'+
      '<section class="panel section"><div class="eyebrow">Method</div><h2>Provenance over bravado.</h2>'+
      '<p class="lead">The Observatory distinguishes a documented first appearance from absolute originality, preserves old definitions rather than overwriting them, and keeps uncertain meanings visibly uncertain.</p>'+
      '<p class="subtle">Continuity supplies the lineage layer: the originating intent, epistemic status, source artifacts, open questions, decisions, confidence, and next development step. Forge/Lexicon/Canon remains a separate measure of lexical maturity.</p></section>';
    wireCards();
    document.getElementById("homeGo").onclick=function(){var q=document.getElementById("homeSearch").value.trim();location.hash="forge?q="+encodeURIComponent(q);};
    document.getElementById("homeSearch").onkeydown=function(e){if(e.key==="Enter")document.getElementById("homeGo").click();};
  }
  function browse(stage,q0){
    var stageName={forge:"The Forge",lexicon:"The Lexicon",canon:"The Canon"}[stage];
    var desc={forge:"The workshop: every promising lexical organism, including those that may never leave the laboratory.",lexicon:"The working vocabulary: terms stable enough to clarify recurring distinctions.",canon:"The long survivors: terms that have earned durable status through use, generativity, or transmission."}[stage];
    root.innerHTML='<section class="page"><div class="eyebrow">Forge → Lexicon → Canon</div><h1 class="word-title">'+stageName+'</h1><p class="lead">'+desc+'</p>'+
      '<div class="controls"><input id="filter" value="'+esc(q0)+'" placeholder="Search this tier…"><select id="formation"><option value="">All formations</option></select><select id="sort"><option value="new">Most recent</option><option value="az">A–Z</option><option value="defined">Defined first</option></select></div></section><section id="results"></section>';
    var list=terms().filter(function(t){return t.stage===stage;});
    var fs=Array.from(new Set(list.map(function(t){return t.formation||"unclassified";}))).sort();
    document.getElementById("formation").innerHTML+=[].concat(fs).map(function(x){return '<option>'+esc(x)+'</option>';}).join("");
    function update(){
      var q=document.getElementById("filter").value.toLowerCase(),f=document.getElementById("formation").value,s=document.getElementById("sort").value;
      var r=list.filter(function(t){
        var hay=[t.term,t.definition,t.fullDefinition,t.formation,(t.roots||[]).join(" "),(t.domains||[]).join(" "),(t.tags||[]).join(" "),t.conceptualRole].join(" ").toLowerCase();
        return (!q||hay.indexOf(q)>=0)&&(!f||t.formation===f);
      });
      if(s==="az")r.sort(function(a,b){return a.term.localeCompare(b.term);});
      else if(s==="defined")r.sort(function(a,b){return Number(b.definition.indexOf("Definition pending")!==0)-Number(a.definition.indexOf("Definition pending")!==0);});
      else r.sort(function(a,b){return String(b.coined).localeCompare(String(a.coined));});
      document.getElementById("results").innerHTML=r.length?'<div class="grid cards">'+r.map(card).join("")+'</div>':'<div class="empty">No matching terms.</div>';
      wireCards();
    }
    ["filter","formation","sort"].forEach(function(id){document.getElementById(id).oninput=update;});update();
  }
  function relationRows(id){
    return state.relations.filter(function(r){return r[0]===id||r[1]===id;}).map(function(r){
      var other=find(r[0]===id?r[1]:r[0]);
      return other?'<div class="kv"><dt>'+esc(cap(r[2]))+'</dt><dd><a href="#term/'+esc(other.id)+'">'+esc(other.term)+'</a></dd></div>':"";
    }).join("");
  }
  function detail(id){
    var t=find(id);if(!t){root.innerHTML='<div class="empty page">Term not found.</div>';return;}
    var c=t.continuity||{},versions=t.versions||[],events=(t.events||[]).slice();
    events.unshift({date:state.importedAt,type:"observatory_import",text:"Imported into the Lexical Observatory working corpus."});
    if(t.coined&&t.precision!=="year")events.unshift({date:t.coined,type:"documented_coinage",text:"Coinage date recorded in the working archive."});
    root.innerHTML='<section class="page"><div class="meta">'+stageBadge(t)+'<span class="badge">'+esc(t.formation)+'</span><span class="badge">'+esc(t.provenanceStatus)+'</span></div>'+
      '<h1 class="word-title">'+esc(t.term)+'</h1><p class="lead">'+esc(t.definition)+'</p></section>'+
      '<section class="grid two"><div>'+
        '<div class="panel"><div class="eyebrow">Conceptual role</div><h2>What distinction does it preserve?</h2><p>'+(t.conceptualRole?esc(t.conceptualRole):'<span class="subtle">Not yet established.</span>')+'</p>'+
        '<div class="eyebrow" style="margin-top:24px">Birth condition</div><p>'+(t.birthCondition?esc(t.birthCondition):'<span class="subtle">Originating context still needs source recovery.</span>')+'</p></div>'+
        '<div class="panel section epistemic"><div class="eyebrow">Continuity lineage</div><h2>Intent before chronology.</h2>'+
          '<dl><div class="kv"><dt>Objective</dt><dd>'+esc(c.objective||"Unrecorded")+'</dd></div>'+
          '<div class="kv"><dt>Workflow state</dt><dd>'+esc(c.state||"Unclassified")+' <span class="subtle">(separate from lexical stage)</span></dd></div>'+
          '<div class="kv"><dt>Epistemic type</dt><dd>'+esc(c.epistemicType||"Unclassified")+'</dd></div>'+
          '<div class="kv"><dt>Confidence</dt><dd>'+(typeof c.confidence==="number"?Math.round(c.confidence*100)+"%":"Unrecorded")+'</dd></div>'+
          '<div class="kv"><dt>Observed problem</dt><dd>'+esc(c.observedProblem||"Unrecorded")+'</dd></div>'+
          '<div class="kv"><dt>Next step</dt><dd>'+esc(c.nextStep||"Unrecorded")+'</dd></div></dl>'+
          '<h3 style="margin-top:20px">Open questions</h3><ul>'+((c.openQuestions||[]).map(function(x){return '<li>'+esc(x)+'</li>';}).join("")||'<li class="subtle">None recorded.</li>')+'</ul></div>'+
        '<div class="panel section"><div class="eyebrow">Definition history</div><h2>Versions, not replacement.</h2>'+
          (versions.length?'<div class="timeline">'+versions.map(function(v){return '<div class="event"><small>v'+esc(v.v)+' · '+esc(v.date||"date unrecorded")+'</small><div>'+esc(v.definition)+'</div>'+(v.note?'<p class="subtle">'+esc(v.note)+'</p>':'')+'</div>';}).join("")+'</div>':'<div class="empty">No formal definition revisions recorded yet.</div>')+'</div>'+
        '<div class="panel section"><div class="eyebrow">Evolution</div><h2>Event trail</h2><div class="timeline">'+events.map(function(e){return '<div class="event"><small>'+esc(e.date||"date unrecorded")+' · '+esc(cap(e.type))+'</small><div>'+esc(e.text||"")+'</div></div>';}).join("")+'</div></div>'+
        '<div class="panel section"><div class="eyebrow">Relations</div><h2>Conceptual neighborhood</h2>'+(relationRows(t.id)||'<div class="empty">No explicit relations recorded yet.</div>')+'</div>'+
      '</div><aside>'+
        '<div class="panel"><div class="eyebrow">Word genome</div><dl>'+
          '<div class="kv"><dt>Stage</dt><dd>'+esc(t.stage)+'</dd></div><div class="kv"><dt>Coined</dt><dd>'+esc(dateLabel(t))+'</dd></div>'+
          '<div class="kv"><dt>Formation</dt><dd>'+esc(t.formation)+'</dd></div><div class="kv"><dt>Idea / word order</dt><dd>'+esc(cap(t.wordIdeaOrder))+'</dd></div>'+
          '<div class="kv"><dt>Transmission</dt><dd>'+esc(cap(t.transmission))+'</dd></div><div class="kv"><dt>Provenance</dt><dd>'+esc(t.provenance)+'</dd></div></dl>'+
          '<h3 style="margin-top:20px">Roots / parents</h3><div class="root-list">'+((t.roots||[]).map(function(r){return '<span class="root">'+esc(r)+'</span>';}).join("")||'<span class="subtle">Not yet recorded.</span>')+'</div></div>'+
        '<div class="panel section"><div class="eyebrow">Sources</div><h3>Witnesses</h3>'+((t.witnesses||[]).length?(t.witnesses.map(function(w){return '<p><strong>'+esc(w.title||w.source||"Source")+'</strong><br><span class="subtle">'+esc(w.date||"date unrecorded")+'</span></p>';}).join("")):'<p class="subtle">No public/source witness attached yet.</p>')+
          '<h3 style="margin-top:20px">External attestations</h3>'+((t.attestations||[]).length?t.attestations.map(function(a){return '<p>'+esc(a.source||"External use")+'</p>';}).join(""):'<p class="subtle">None recorded. Zero is deliberate; adoption is evidence, not decoration.</p>')+'</div>'+
      '</aside></section>';
  }
  function tally(list,getter){
    var x={};list.forEach(function(v){var k=getter(v)||"Unrecorded";x[k]=(x[k]||0)+1;});return x;
  }
  function bars(obj){
    var vals=Object.values(obj),max=Math.max.apply(Math,vals.concat([1]));
    return Object.keys(obj).sort(function(a,b){return obj[b]-obj[a];}).map(function(k){return '<div class="bar-row"><span>'+esc(k)+'</span><div class="progress"><span style="width:'+Math.round(obj[k]/max*100)+'%"></span></div><b>'+obj[k]+'</b></div>';}).join("");
  }
  function observatory(){
    var p=terms(),forms=tally(p,function(t){return t.formation;}),orders=tally(p,function(t){return cap(t.wordIdeaOrder);}),epi=tally(p,function(t){return t.continuity&&t.continuity.epistemicType;}),trans=tally(p,function(t){return cap(t.transmission);});
    root.innerHTML='<section class="page"><div class="eyebrow">Longitudinal view</div><h1 class="word-title">Observatory</h1><p class="lead">Treat the lexicon as a population. Measure what survives, stabilizes, branches, transmits, and changes meaning.</p></section>'+
      '<section class="grid stats"><div class="stat"><strong>'+count("forge")+'</strong><span>Forge</span></div><div class="stat"><strong>'+count("lexicon")+'</strong><span>Lexicon</span></div><div class="stat"><strong>'+count("canon")+'</strong><span>Canon</span></div><div class="stat"><strong>'+state.relations.length+'</strong><span>relations</span></div><div class="stat"><strong>'+p.filter(function(t){return t.transmission!=="self";}).length+'</strong><span>beyond-self</span></div></section>'+
      '<section class="grid two section"><div class="panel"><h2>Formation mechanisms</h2>'+bars(forms)+'</div><div class="panel"><h2>Idea ↔ word order</h2>'+bars(orders)+'</div></section>'+
      '<section class="grid two section"><div class="panel"><h2>Epistemic classifications</h2>'+bars(epi)+'</div><div class="panel"><h2>Transmission distance</h2>'+bars(trans)+'</div></section>'+
      '<section class="panel section"><h2>Semantic half-life</h2><p class="subtle">Insufficient longitudinal definition history. The Observatory will calculate time between substantive definition revisions once enough version events exist. Unknown stays unknown rather than becoming decorative analytics.</p></section>'+
      '<section class="panel section"><h2>Cohort survival</h2><p class="subtle">The current recovered corpus is overwhelmingly 2026 material. Cohort survival becomes meaningful only after multiple years of observation.</p></section>';
  }
  function constellation(){
    var ts=terms(),w=1000,h=Math.max(600,Math.ceil(ts.length/12)*180),cx=w/2,cy=h/2,r=Math.min(w,h)*.39;
    var pos={};ts.forEach(function(t,i){var a=Math.PI*2*i/ts.length;pos[t.id]={x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r};});
    var edges=state.relations.map(function(rel){var a=pos[rel[0]],b=pos[rel[1]];return a&&b?'<line class="edge" x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'"></line>':"";}).join("");
    var colors={forge:"#d28a54",lexicon:"#92b9e4",canon:"#e0bd63"};
    var nodes=ts.map(function(t){var p=pos[t.id];return '<g class="node" data-term="'+esc(t.id)+'" transform="translate('+p.x+' '+p.y+')"><circle r="8" fill="'+colors[t.stage]+'"></circle><text x="12" y="4">'+esc(t.term)+'</text></g>';}).join("");
    root.innerHTML='<section class="page"><div class="eyebrow">Conceptual topology</div><h1 class="word-title">Constellation</h1><p class="lead">A deliberately sparse first map. Every line represents an explicit recorded relation; absence of a line means “not yet recorded,” not “unrelated.”</p></section>'+
      '<div class="svg-wrap"><svg viewBox="0 0 '+w+' '+h+'" width="100%" style="min-width:900px">'+edges+nodes+'</svg></div>'+
      '<p class="subtle">Relations currently include derivative-of, semantic-relative, and same-domain links. Click any node to open its record.</p>';
    wireCards();
  }
  function continuity(){
    root.innerHTML='<section class="page"><div class="eyebrow">Continuity integration</div><h1 class="word-title">The word is not the thread.</h1><p class="lead">Forge → Lexicon → Canon tells us how mature a lexical object has become. Continuity tells us why it exists, what evidence supports it, what remains unresolved, and where thought should resume.</p></section>'+
      '<section class="grid two"><div class="panel"><h2>What Continuity contributes</h2><dl>'+
        '<div class="kv"><dt>Intent</dt><dd>The originating problem, question, or distinction is primary; chronology hangs from it.</dd></div>'+
        '<div class="kv"><dt>Epistemic type</dt><dd>Observation, inference, hypothesis, fact, preference, decision, assumption, question, prediction, or external claim.</dd></div>'+
        '<div class="kv"><dt>Confidence</dt><dd>A visible confidence value rather than silent certainty.</dd></div>'+
        '<div class="kv"><dt>Artifacts</dt><dd>Source witnesses, notes, conversations, documents, links, and evidence remain attached to the idea they informed.</dd></div>'+
        '<div class="kv"><dt>Events</dt><dd>Changes append to history. Important transitions are reversible or at least inspectable.</dd></div>'+
        '<div class="kv"><dt>Resume point</dt><dd>Open questions and a next development step prevent rediscovery from scratch.</dd></div></dl></div>'+
        '<div class="panel"><h2>What remains separate</h2><p><strong>Lexical stage ≠ workflow state.</strong></p><p class="subtle">A Canon term can still have open research questions. A Forge term can be a high-confidence observation. Maturity and epistemic/workflow status answer different questions and should never be collapsed into one badge.</p>'+
        '<h3 style="margin-top:28px">Capture now. Understand later.</h3><p class="subtle">The Forge is allowed to contain incomplete words, incomplete definitions, and incomplete provenance. The obligation is not instant understanding; it is preservation without pretending uncertainty is certainty.</p></div></section>'+
      '<section class="panel section"><h2>The resulting lineage</h2><p class="lead">capture → intent thread → lexical seed → definition versions → conceptual relations → evidence → promotion or retirement → long-term semantic drift</p><p class="subtle">That is the bridge between Continuity and the Observatory: not another folder of words, but a recoverable history of why a mind needed each word in the first place.</p></section>';
  }
  function download(name,text,type){var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:type||"text/plain"}));a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);}
  function csv(){
    var q=function(v){return '"'+String(v==null?"":v).replace(/"/g,'""')+'"';};
    return [["term","stage","coined","formation","definition","word_idea_order","provenance_status","transmission","epistemic_type","confidence"].map(q).join(",")].concat(state.terms.map(function(t){return [t.term,t.stage,t.coined,t.formation,t.definition,t.wordIdeaOrder,t.provenanceStatus,t.transmission,t.continuity&&t.continuity.epistemicType,t.continuity&&t.continuity.confidence].map(q).join(",");})).join("\n");
  }
  function admin(){
    root.innerHTML='<section class="page"><div class="eyebrow">Local authoring console</div><h1 class="word-title">Admin</h1><div class="notice"><strong>Important:</strong> this static Museum-integrated MVP stores edits only in this browser. Export JSON after meaningful work. The persistent Supabase-backed Observatory scaffold exists separately but its app-builder workspace is currently credit-blocked.</div></section>'+
      '<section class="grid admin-grid"><form id="newTerm" class="panel"><h2>Capture to Forge</h2><p class="subtle">Capture now. Understand later.</p><div class="form-grid">'+
        '<label>Term<input name="term" required></label><label>Formation<input name="formation" placeholder="blend, compound, derivation…"></label>'+
        '<label class="full">Working definition<textarea name="definition" placeholder="Definition pending / source recovery needed."></textarea></label>'+
        '<label class="full">Conceptual role<textarea name="role" placeholder="What distinction might this preserve?"></textarea></label>'+
        '<label class="full">Originating intent<textarea name="objective" placeholder="What question/problem produced this term?"></textarea></label>'+
        '<label>Epistemic type<select name="epistemic"><option value="">Unclassified</option><option>OBSERVATION</option><option>INFERENCE</option><option>HYPOTHESIS</option><option>FACT</option><option>PREFERENCE</option><option>DECISION</option><option>ASSUMPTION</option><option>QUESTION</option><option>PREDICTION</option><option>EXTERNAL_CLAIM</option></select></label>'+
        '<label>Confidence<input name="confidence" type="number" min="0" max="1" step=".05" placeholder="0..1"></label>'+
        '<div class="full"><button>Add term</button></div></div></form>'+
        '<div class="panel"><h2>Archive controls</h2><div class="actions"><button id="exportJson">Export JSON</button><button id="exportCsv" class="secondary">Export CSV</button><label class="button secondary">Import JSON<input id="importJson" type="file" accept="application/json" hidden></label><button id="resetSeed" class="danger">Reset local copy</button></div><p class="subtle">JSON preserves the full local model: definitions, Continuity lineage, sources, events, relations, and stage history.</p></div></section>'+
      '<section class="panel section"><h2>Stage & version management</h2><div id="manage"></div></section>';
    function manager(){
      document.getElementById("manage").innerHTML=state.terms.map(function(t){return '<div class="kv"><dt><a href="#term/'+esc(t.id)+'">'+esc(t.term)+'</a></dt><dd><div class="actions"><select data-stage="'+esc(t.id)+'"><option '+(t.stage==="forge"?"selected":"")+'>forge</option><option '+(t.stage==="lexicon"?"selected":"")+'>lexicon</option><option '+(t.stage==="canon"?"selected":"")+'>canon</option></select><button class="secondary" data-revise="'+esc(t.id)+'">Revise definition</button><button class="secondary" data-witness="'+esc(t.id)+'">Add source</button></div></dd></div>';}).join("");
      document.querySelectorAll("[data-stage]").forEach(function(s){s.onchange=function(){var t=find(s.getAttribute("data-stage")),old=t.stage;t.stage=s.value;(t.events||(t.events=[])).push({date:stamp(),type:"stage_change",text:"Stage changed from "+old+" to "+t.stage+"."});save();manager();};});
      document.querySelectorAll("[data-revise]").forEach(function(b){b.onclick=function(){var t=find(b.getAttribute("data-revise")),d=prompt("New definition",t.definition);if(d&&d!==t.definition){var note=prompt("Change note (optional)","");t.definition=d;(t.versions||(t.versions=[])).push({v:t.versions.length+1,date:stamp(),definition:d,note:note||""});(t.events||(t.events=[])).push({date:stamp(),type:"definition_revised",text:note||"Definition revised."});save();manager();}};});
      document.querySelectorAll("[data-witness]").forEach(function(b){b.onclick=function(){var t=find(b.getAttribute("data-witness")),title=prompt("Source title / description");if(title){var date=prompt("Date (YYYY, YYYY-MM, or YYYY-MM-DD)","");(t.witnesses||(t.witnesses=[])).push({title:title,date:date||"",source:"local entry"});(t.events||(t.events=[])).push({date:stamp(),type:"source_added",text:"Source witness added: "+title});save();manager();}};});
    }
    manager();
    document.getElementById("newTerm").onsubmit=function(e){e.preventDefault();var f=new FormData(e.target),name=String(f.get("term")||"").trim();if(!name)return;var conf=String(f.get("confidence")||"").trim();state.terms.push({id:slug(name)+"-"+Date.now().toString(36),term:name,stage:"forge",coined:stamp(),precision:"day",formation:String(f.get("formation")||"unclassified")||"unclassified",definition:String(f.get("definition")||"").trim()||"Definition pending / source recovery needed.",fullDefinition:String(f.get("definition")||"").trim()||"Definition pending / source recovery needed.",roots:[],domains:[],tags:[],conceptualRole:String(f.get("role")||""),birthCondition:"",wordIdeaOrder:"uncertain",provenance:"Local draft; external priority not audited.",provenanceStatus:"uncertain",transmission:"self",visibility:"public",versions:[],events:[{date:stamp(),type:"captured",text:"Captured through Observatory local authoring console."}],witnesses:[],attestations:[],continuity:{objective:String(f.get("objective")||"")||"Determine what conceptual distinction this lexical seed preserves.",observedProblem:"",epistemicType:String(f.get("epistemic")||"")||null,confidence:conf===""?null:Number(conf),state:"UNSEEN",openQuestions:["What exactly does this term need to distinguish?"],nextStep:"Recover context, test utility, and write a falsifiable working definition."}});save();e.target.reset();manager();};
    document.getElementById("exportJson").onclick=function(){download("lexical-observatory.json",JSON.stringify(state,null,2),"application/json");};
    document.getElementById("exportCsv").onclick=function(){download("lexical-observatory.csv",csv(),"text/csv");};
    document.getElementById("importJson").onchange=function(){var file=this.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(){try{var x=JSON.parse(reader.result);if(!x.terms||!Array.isArray(x.terms))throw new Error();state=x;save();admin();}catch(e){alert("Invalid Observatory JSON.");}};reader.readAsText(file);};
    document.getElementById("resetSeed").onclick=function(){if(confirm("Reset this browser to the repository seed corpus?")){state=clone(seed);save();admin();}};
  }
  document.getElementById("menuButton").onclick=function(){document.querySelector(".site-header").classList.toggle("open");};
  window.addEventListener("hashchange",function(){document.querySelector(".site-header").classList.remove("open");route();});
  route();
})();