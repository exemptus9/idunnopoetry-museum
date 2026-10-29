/* Static, public-only project map. No network calls, no analytics, no private URLs. */
(()=>{"use strict";
const search=document.getElementById("worlds-search");
const stage=document.getElementById("worlds-stage");
const reset=document.getElementById("worlds-reset");
const status=document.getElementById("worlds-results");
const cards=[...document.querySelectorAll("#worlds-grid .atlas-orbit")];
if(!search||!stage||!reset||!status||!cards.length)return;
function apply(){
 const q=search.value.toLocaleLowerCase().trim();
 const s=stage.value;
 let shown=0;
 for(const card of cards){
  const matchStage=s==="all"||card.dataset.stage===s;
  const matchText=!q||(card.dataset.search||"").includes(q);
  card.hidden=!(matchStage&&matchText);
  if(!card.hidden) shown++;
 }
 status.textContent="Showing "+shown+" of "+cards.length+" projects";
}
search.addEventListener("input",apply);
stage.addEventListener("change",apply);
reset.addEventListener("click",()=>{search.value="";stage.value="all";apply();search.focus()});
apply();
})();
