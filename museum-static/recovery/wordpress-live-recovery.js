(()=>{
const Q=window.IDP_POETRY,C=window.IDP_CORE,P=window.IDP_POSTS;if(!Q||!C)return;
const seeds=[
[673,669,'Root-Bound','2020-06-11'],
[674,699,'Never ! (Version)','2014-09-12'],
[675,704,'So Much More To Gain','2016-11-14'],
[676,710,'"Soon," I Sighed (Suicide)','2020-06-01'],
[677,749,'Seasonal Change','2023-03-15'],
[678,751,'TruthSeeker','2023-03-15'],
[679,753,'Nice Future','2023-10-21'],
[680,763,'Love Burden','2023-12-23']
];
const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
const dec=s=>{const t=document.createElement('textarea');t.innerHTML=String(s||'');return t.value};
const clean=html=>{const d=document.createElement('div');d.innerHTML=String(html||'').replace(/<!--.*?-->/gs,'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/p\s*>/gi,'\n\n');return (d.textContent||'').replace(/\r\n?/g,'\n').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim()};
const byId=new Map(Q.works.map(w=>[Number(w.id),w])),byTitle=new Map(Q.works.map(w=>[norm(w.title),w]));
for(const [id,pid,title,date] of seeds){if(!byId.has(id)&&!byTitle.has(norm(title))){const w={id,type:'main_site_brandon',src:'wp:'+pid,topic:'',post:String(pid),u:'idunnopoetry',credit:'Brandon Smith',title,d:date,forum:'IDunnoPoetry WordPress.com',conf:'confirmed',x:'',views:'',replies:'',vc:1};Q.works.push(w);byId.set(id,w);byTitle.set(norm(title),w)}}
if(!byId.has(681)&&!byTitle.has(norm('If I Could (unfinished)'))&&P){const p=P.find(x=>Number(x.id)===96798);if(p){const w={id:681,type:'forum_poetry_thread',src:'topic:10937',topic:'10937',post:'96798',u:p.n||'angelplaya',credit:p.n||'angelplaya',title:'If I Could (unfinished)',d:String(p.d||'2004-08-13').slice(0,10),forum:"Other's Poetry/Songs",conf:'probable_original_community',x:p.x||'',views:12,replies:1,vc:1};Q.works.push(w);Q.versions['681']=Q.versions['681']||[{snapshot:p.p||'2004_snapshot',title:w.title,d:w.d,x:w.x,key:'forum-topic:10937:post:96798'}];byId.set(681,w);byTitle.set(norm(w.title),w)}}
if(C.meta&&C.meta.stats)C.meta.stats.works=Q.works.length;
const variants=new Map([[norm('ReplacedMint'),norm('ReplaceMint')],[norm('Chem-eLeeon'),norm('Chameleon')],[norm('Abcessed Insanity'),norm('Abscessed Insanity')]]);
const skip=new Set(['Quick Post of the Entirety of my Work','When Flaming Towers Finally Fall','IDunnoPoetry Book Available For Purchase',"You're Not Winning"].map(norm));
async function getAll(){const out=[];for(let page=1;page<=5;page++){const u='https://public-api.wordpress.com/wp/v2/sites/idunnopoetry.wordpress.com/posts?per_page=100&page='+page+'&orderby=date&order=asc';const r=await fetch(u,{mode:'cors'});if(!r.ok){if(r.status===400)break;throw new Error('WordPress '+r.status)}const a=await r.json();if(!Array.isArray(a)||!a.length)break;out.push(...a);if(a.length<100)break}return out}
function apply(posts){let matched=0,addedVersions=0;for(const p of posts){const title=dec(p.title&&p.title.rendered||'').trim(),k=norm(title);if(!k||skip.has(k))continue;const targetKey=variants.get(k)||k;let w=byTitle.get(targetKey)||byTitle.get(k);if(!w)continue;const text=clean(p.content&&p.content.rendered||'');if(!text)continue;if(!w.x)w.x=text;Q.versions[String(w.id)]=Q.versions[String(w.id)]||[];const key='wordpress:'+p.id;if(!Q.versions[String(w.id)].some(v=>v.key===key)){Q.versions[String(w.id)].push({snapshot:'wordpress_export_2026',title,d:String(p.date||'').slice(0,10),x:text,key,modified:String(p.modified||'').slice(0,10),status:p.status||'publish'});addedVersions++}w.vc=Math.max(Number(w.vc||1),Q.versions[String(w.id)].length);matched++}
window.IDP_WORDPRESS_RECOVERY={status:'ready',posts:posts.length,matched,addedVersions,works:Q.works.length,at:new Date().toISOString()};if(C.meta&&C.meta.stats)C.meta.stats.works=Q.works.length;const fire=()=>window.dispatchEvent(new HashChangeEvent('hashchange'));if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',fire,{once:true});else fire()}
getAll().then(apply).catch(err=>{window.IDP_WORDPRESS_RECOVERY={status:'error',message:String(err),works:Q.works.length};if(C.meta&&C.meta.stats)C.meta.stats.works=Q.works.length});
})();