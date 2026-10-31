/* One browser-local controller for The Constellation and the Continuity Atlas.
   Public static metadata only; no network calls, analytics, or private endpoints. */
(()=>{"use strict";
 const isAtlas=Boolean(document.getElementById("worlds-grid"));
 const get=id=>document.getElementById(id);
 const search=get(isAtlas?"worlds-search":"project-search");
 const stage=get(isAtlas?"worlds-stage":"project-filter");
 const domain=get(isAtlas?"worlds-domain":"project-domain");
 const order=get(isAtlas?"worlds-order":"project-order");
 const reset=get(isAtlas?"worlds-reset":"clear-filters");
 const status=get(isAtlas?"worlds-results":"project-count");
 const more=get(isAtlas?"worlds-more":"project-more");
 const empty=get(isAtlas?"worlds-empty":"project-empty");
 const cards=[...document.querySelectorAll(isAtlas?"#worlds-grid .atlas-orbit":"section.group .project")];
 const containers=isAtlas?[get("worlds-grid")]:[...document.querySelectorAll("section.group .grid")];
 const groups=isAtlas?[]:[...document.querySelectorAll("section.group")];
 const toggles=[...document.querySelectorAll(".view-switch [data-compendium-view]")];
 const choices={stage:["all","live","preview","building","archive"],domain:["all","poetry","language","archive","technology","research","community"],order:["recent","name"],view:["compact","gallery"]};
 const stageRank={live:0,preview:1,building:2,archive:3};
 const viewDefault=window.matchMedia&&matchMedia("(max-width:700px)").matches?"compact":"gallery";
 let view=viewDefault, limit=16;
 if(!search||!stage||!domain||!order||!reset||!status||!more||cards.length===0)return;
 const params=new URLSearchParams(location.search);
 function valid(key,value){return choices[key].includes(value)}
 function restore(){
   const q=params.get("p");
   if(q) search.value=q.slice(0,160);
   for(const [control,key,list] of [[stage,"ps","stage"],[domain,"pd","domain"],[order,"po","order"]]){
     const v=params.get(key);if(valid(list,v))control.value=v;
   }
   const requested=params.get("pv");if(valid("view",requested))view=requested;
 }
 function syncView(){
   document.body.dataset.compendiumView=view;
   toggles.forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.compendiumView===view)));
 }
 const nameOf=x=>x.querySelector("h3")?.textContent?.trim()||"";
 function sorted(){
   const rank=(el)=>stageRank[el.dataset.stage]??9;
   for(const container of containers){
     if(!container)continue;
     const items=[...container.children].filter(x=>x.matches(".project,.atlas-orbit"));
     items.sort((a,b)=>{
       if(isAtlas&&stage.value==="all"&&rank(a)!==rank(b))return rank(a)-rank(b);
       if(order.value==="name")return nameOf(a).localeCompare(nameOf(b),undefined,{sensitivity:"base"});
       const da=Date.parse(a.dataset.updated||"")||0,db=Date.parse(b.dataset.updated||"")||0;
       return db-da||nameOf(a).localeCompare(nameOf(b),undefined,{sensitivity:"base"});
     });
     for(const el of items)container.appendChild(el);
   }
   return containers.flatMap(c=>c?[...c.children].filter(x=>x.matches(".project,.atlas-orbit")):[]);
 }
 function apply(){
   const q=search.value.trim().toLocaleLowerCase(),s=stage.value,d=domain.value;
   const all=sorted();
   const matched=all.filter(c=>(s==="all"||c.dataset.stage===s)&&(d==="all"||c.dataset.domain===d)&&(!q||(c.dataset.search||"").includes(q)));
   const visible=new Set(matched.slice(0,limit));
   for(const c of all)c.hidden=!visible.has(c);
   for(const g of groups)g.hidden=![...g.querySelectorAll(".project")].some(c=>!c.hidden);
   const shown=visible.size,remaining=matched.length-shown;
   status.textContent="Showing "+shown+" of "+matched.length+" matching projects · "+all.length+" catalogued";
   if(empty)empty.hidden=matched.length>0;
   more.hidden=remaining===0;
   if(remaining)more.textContent="Show "+Math.min(12,remaining)+" more · "+remaining+" remaining";
   syncView();
 }
 function saveUrl(){
   const url=new URL(location.href);
   for(const [k,v,fallback] of [
     ["p",search.value.trim()," "],["ps",stage.value,"all"],["pd",domain.value,"all"],
     ["po",order.value,"recent"],["pv",view,viewDefault]
   ]){if(v&&v!==fallback)url.searchParams.set(k,v);else url.searchParams.delete(k)}
   try{history.replaceState(history.state,"",url.pathname+url.search+url.hash)}catch(e){}
 }
 function change(){limit=16;apply();saveUrl()}
 restore();
 // A deep link to a project must never land on a hidden, paginated card.
 const target=location.hash.startsWith("#project-")?document.getElementById(location.hash.slice(1)):null;
 if(target&&cards.includes(target)){
   search.value="";stage.value="all";domain.value="all";limit=cards.length;
 }
 apply();
 search.addEventListener("input",change);
 for(const c of [stage,domain,order])c.addEventListener("change",change);
 for(const b of toggles)b.addEventListener("click",()=>{view=b.dataset.compendiumView;apply();saveUrl()});
 reset.addEventListener("click",()=>{
   search.value="";stage.value="all";domain.value="all";order.value="recent";view=viewDefault;
   limit=16;apply();saveUrl();search.focus();
 });
 more.addEventListener("click",()=>{limit+=12;apply()});
 document.querySelectorAll("[data-compendium-shortcut]").forEach(b=>{
   b.addEventListener("click",()=>{
     const [kind,value]=String(b.dataset.compendiumShortcut||"").split(":");
     if(kind==="stage"&&valid("stage",value)){stage.value=value;domain.value="all"}
     if(kind==="domain"&&valid("domain",value)){domain.value=value;stage.value="all"}
     search.value="";change();
     const controls=document.querySelector(".compendium-toolbar");
     if(controls)controls.scrollIntoView({block:"start",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
   });
 });
})();
