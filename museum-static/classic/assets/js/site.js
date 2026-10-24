(()=>{
const b=document.body, buttons=[...document.querySelectorAll('[data-mode]')];
function setMode(mode){ b.classList.toggle('mode-reader',mode==='reader');buttons.forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.mode===mode)));try{localStorage.setItem('idp-mode',mode)}catch(e){} }
let mode='classic';try{mode=localStorage.getItem('idp-mode')||'classic'}catch(e){}
setMode(mode);
buttons.forEach(x=>x.addEventListener('click',()=>setMode(x.dataset.mode)));
const root=b.dataset.root||'';const corners=[...Array(12)].map((_,i)=>`${root}assets/images/topleft${i+1}.jpg`);
const corner=document.getElementById('corner');
if(corner){const key='idp-corner';let c;try{c=(+sessionStorage.getItem(key)+1)%12;if(!Number.isFinite(c))c=0;sessionStorage.setItem(key,String(c));}catch(e){c=Math.floor(Math.random()*12)}corner.src=corners[c];}
const search=document.getElementById('poem-search'), sort=document.getElementById('poem-sort'), tbody=document.getElementById('poem-tbody'), count=document.getElementById('result-count');
if(search&&tbody){const rows=[...tbody.querySelectorAll('tr')];
function redraw(){let filtered=rows.filter(r=>r.dataset.search.includes(search.value.toLowerCase().trim()));
if(sort?.value==='title')filtered.sort((a,b)=>a.dataset.title.localeCompare(b.dataset.title));
if(sort?.value==='reverse')filtered.reverse();
tbody.replaceChildren(...filtered);count.textContent=`${filtered.length} of ${rows.length} recovered poems`; }
search.addEventListener('input',redraw);sort?.addEventListener('change',redraw);redraw();
document.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement?.tagName!=='INPUT'){e.preventDefault();search.focus()}});}
for(const x of document.querySelectorAll('[data-print]'))x.addEventListener('click',()=>window.print());
const trip=document.getElementById('trip-demo');if(trip){const status=trip.querySelector('.trip-status');const road=trip.querySelector('img');let running=false;const update=()=>{status.textContent=running?'Driving through a restored, illustrative scene. Original timer data unavailable.':'Pulled over — historical graphics preserved.';road.src=running?'assets/images/snow.gif':'assets/images/image2.gif'};
trip.querySelector('[data-trip=start]').addEventListener('click',()=>{running=true;update()});trip.querySelector('[data-trip=stop]').addEventListener('click',()=>{running=false;update()});trip.querySelector('[data-trip=reset]').addEventListener('click',()=>{running=false;update()});update();}
})();