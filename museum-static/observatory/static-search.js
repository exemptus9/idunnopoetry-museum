import {config} from './config.js';
import {normalizeCatalog, safeUrl} from './model.js';
import {instantSearchMarkup, mountInstantSearch} from './instant-search.js';

const mounted = new WeakMap();

/** A permanent word page loads the approved catalog once, then searches locally. */
export function startStaticSearch(root, {fetchImpl = globalThis.fetch, timeoutMs = config.requestTimeoutMs} = {}) {
  if (!root) return Promise.resolve(null);
  if (mounted.has(root)) return mounted.get(root);
  const document=root.ownerDocument, base=root.dataset.base || '../../';
  const original=root.querySelector('input[type="search"]');
  const initialQuery=original?.value || '';
  const hadFocus=original && document.activeElement===original;
  let catalog={terms:[],relations:[],versions:[]}, connection='loading';
  root.innerHTML=`<div class="lookup-dock-inner">${instantSearchMarkup({base,idPrefix:'word-lookup'})}</div>`;
  const controller=mountInstantSearch(root,{getCatalog:()=>catalog,status:()=>connection,base,initialQuery});
  if(hadFocus)controller.focus();
  root.dataset.lookupState=connection;
  const pending=(async()=>{
    const abort=new AbortController();
    const timer=setTimeout(()=>abort.abort(),timeoutMs);
    try {
      const directory=safeUrl(base,document.baseURI);
      const endpoint=directory && safeUrl(config.catalogEndpoint,directory);
      if(!endpoint)throw new Error('Public catalog is not configured.');
      const response=await fetchImpl(endpoint,{credentials:'omit',signal:abort.signal,headers:{Accept:'application/json'},cache:'no-cache'});
      if(!response.ok)throw new Error('Public catalog unavailable.');
      if(Number(response.headers.get('content-length'))>config.maxCatalogBytes)throw new Error('Public catalog exceeds the size limit.');
      const body=await response.text();
      if(body.length>config.maxCatalogBytes)throw new Error('Public catalog exceeds the size limit.');
      catalog=normalizeCatalog(JSON.parse(body));
      connection='ready';
    } catch {
      catalog={terms:[],relations:[],versions:[]};
      connection='unavailable';
    } finally {
      clearTimeout(timer);
      root.dataset.lookupState=connection;
      controller.refresh();
    }
    return controller;
  })();
  mounted.set(root,pending);
  return pending;
}

if(typeof document!=='undefined') {
  document.querySelectorAll('[data-static-lookup]').forEach(root=>{startStaticSearch(root);});
}
