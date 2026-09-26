(()=>{
  const cfg=window.IDP_CONFIG||{};
  const token=String(cfg.cloudflareAnalyticsToken||'').trim();
  window.IDP_ANALYTICS_STATUS={
    provider: token ? 'cloudflare-web-analytics' : 'disabled',
    enabled: Boolean(token),
    privacy:'No museum-side cookies or personal visitor profiles are created by this loader.'
  };
  if(!token) return;
  const s=document.createElement('script');
  s.defer=true;
  s.src='https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon',JSON.stringify({token,spa:true}));
  s.onerror=()=>{window.IDP_ANALYTICS_STATUS.error='beacon_load_failed'};
  document.head.appendChild(s);
})();
