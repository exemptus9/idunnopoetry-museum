/* Curated task routes from public project cards. No network or storage. */
(()=>{'use strict';
 const root=document.getElementById('project-launchpad');if(!root)return;
 const select=root.querySelector('select'),results=root.querySelector('[data-route-results]');
 const copy=root.querySelector('[data-route-copy]'),status=root.querySelector('[data-route-status]');
 const manual=root.querySelector('[data-route-manual]'),field=manual.querySelector('textarea');
 const goals={
  read:{title:'Read poetry and its history',steps:[['rhymemosaic','Start with the current poetry reading room.'],['idunnopoetry-museum','Follow the earlier writing and community in the preserved museum.']]},
  language:{title:'Explore coined words',steps:[['lexical-observatory','Look up a word, its working meaning and documented origins.']]},
  research:{title:'Explore scientific references',steps:[['hydra-index','Search the index and follow the cited evidence and its limits.']]},
  organize:{title:'Organize a thread of work',steps:[['artificial-continuity','Start with a source or intention in the browser-local workspace. Review selected context before sharing it.']]},
  support:{title:'Find practical Sanford resources',steps:[['sanford-resource-hub','Choose the service you need, then confirm provider details before travel.']]},
  help:{title:'Get help with a device or website',steps:[['techenlight','Describe the problem or goal. Review your inquiry before choosing how to contact Brandon.']]},
 };
 let revision=0,routeText='';
 function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
 function safeDestination(card){
  if(!card||card.dataset.stage!=='live')return null;
  const a=card.querySelector('.project-links a.go');if(!a)return null;
  try{const u=new URL(a.getAttribute('href'),location.href);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}
 }
 function clearManual(){manual.hidden=true;field.value='';}
 function render(updateUrl=true){
  revision++;routeText='';results.replaceChildren();status.textContent='';clearManual();copy.disabled=true;
  const key=select.value;
  if(!Object.hasOwn(goals,key)){
   results.hidden=true;
  }else{
   const goal=goals[key],list=node('ol'),text=[goal.title,'Public project route - curated suggestions, not a live availability check.',''];
   let ready=0;results.hidden=false;results.append(node('h3',goal.title));
   for(const [id,advice]of goal.steps){
    const card=document.getElementById('project-'+id),url=safeDestination(card);
    if(!url)continue;
    ready++;const li=node('li'),a=node('a',card.querySelector('h3')?.textContent?.trim()||'Open project');
    a.href=url;a.rel='noopener noreferrer';li.append(a,node('p',advice));
    const stamp=card.querySelector('.project-datestamp');
    const stampText=stamp?[...stamp.children].map(x=>x.textContent.replace(/\s+/g,' ').trim()).filter(Boolean).join(' · '):'';
    if(stampText)li.append(node('small',stampText));
    list.append(li);text.push(ready+'. '+a.textContent,advice,url,stampText||'No activity date recorded','');
   }
   if(ready){results.append(list);routeText=text.join('\n');copy.disabled=false;}
   else results.append(node('p','No currently public destination is listed for this route. Explore the directory for recorded project status.'));
  }
  if(updateUrl){const u=new URL(location.href);if(Object.hasOwn(goals,key))u.searchParams.set('pg',key);else u.searchParams.delete('pg');try{history.replaceState(history.state,'',u.pathname+u.search+u.hash);}catch{}}
 }
 select.addEventListener('change',()=>render());
 root.querySelector('[data-route-clear]').addEventListener('click',()=>{select.value='';render();select.focus();});
 copy.addEventListener('click',async()=>{
  if(!routeText)return;const text=routeText,epoch=revision;
  try{await navigator.clipboard.writeText(text);if(epoch!==revision)return;status.textContent='Public route copied. No private workspace data is included.';}
  catch{if(epoch!==revision)return;field.value=text;manual.hidden=false;field.focus();field.select();status.textContent='Automatic copy is unavailable. Select and copy the route below.';}
 });
 const requested=new URL(location.href).searchParams.get('pg');
 if(Object.hasOwn(goals,requested))select.value=requested;
 render(false);
})();
