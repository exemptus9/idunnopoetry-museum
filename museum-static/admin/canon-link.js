/* Same-origin handoff into the universal canon. Never put private text or auth tokens in URLs. */
(() => {
'use strict';
function go(event,onlyCanon=false){
 const state=window.IDP_EDITOR_WORKSPACE?.state();
 if(onlyCanon&&!state?.active?.draft?._canon)return;
 event.preventDefault();event.stopImmediatePropagation();
 if(state?.busy){alert('Wait for the current private save to finish.');return;}
 if(state?.dirty&&!confirm('Leave unsaved editor changes? Your previously saved revisions remain intact.'))return;
 const key=state?.active?.draft?._canon?state.active.entity_key:null;
 try{if(key)sessionStorage.setItem('idp_canon_focus',key);}catch{}
 location.assign('./canon/');
}
const link=document.getElementById('universal-canon-link');if(link)link.addEventListener('click',e=>go(e));
for(const id of ['approve','publish'])document.getElementById(id)?.addEventListener('click',e=>go(e,true),true);
})();
