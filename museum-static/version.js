(()=>{
  const cfg=window.IDP_CONFIG||{};
  const version=String(cfg.version||'3.9');
  const label='v'+version;
  function applyVersion(){
    document.querySelectorAll('[data-idp-version]').forEach(el=>{el.textContent=label;});
    document.documentElement.dataset.museumVersion=version;
    let meta=document.querySelector('meta[name="idp-museum-version"]');
    if(meta) meta.setAttribute('content',version);
    if((location.hash||'#home').startsWith('#about')){
      const app=document.getElementById('app');
      if(app && !app.querySelector('.version-panel')){
        const box=document.createElement('div');
        box.className='version-panel';
        box.innerHTML='<span class="version-number">'+label+'</span> Current public museum release'+(cfg.releaseName?' · '+cfg.releaseName:'')+(cfg.releaseDate?' · '+cfg.releaseDate:'');
        const heading=app.querySelector('h1');
        if(heading) heading.insertAdjacentElement('afterend',box); else app.prepend(box);
      }
    }
  }
  window.addEventListener('hashchange',()=>setTimeout(applyVersion,0));
  applyVersion();
})();
