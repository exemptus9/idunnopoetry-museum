"""Native browser/CSP checks. Every backend request is intercepted with synthetic data.
No real account or private writing is read, published, or stored by these tests.
"""
from __future__ import annotations
import copy, functools, hashlib, http.server, json, os, pathlib, threading, uuid
from urllib.parse import parse_qs, urlsplit
from playwright.sync_api import sync_playwright, expect
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = pathlib.Path(os.environ.get('SCREENSHOT_DIR', 'test-artifacts/universal-canon'))
OUT.mkdir(parents=True, exist_ok=True)
CHECKS = []
def check(condition: bool, label: str):
    assert condition, label
    CHECKS.append(label)
def sha(s: str): return hashlib.sha256(s.encode('utf-8')).hexdigest()
def fixture():
    def witness(ident, title, text):
        return dict(witness_id=ident, title=title, text=text, sha256=sha(text), source_metadata={'origin':'synthetic-only'})
    works = [
        dict(work_id='poem-alpha',title='A Test of Light',classification='CANON-A',selected_version='alpha-2',metadata={'holds':[],'book_memberships':[{'book_id':'brandonmeant','position':1}]},versions=[witness('alpha-1','A Test of Light','Older line.\r\n'),witness('alpha-2','A Test of Light','A new line.\r\n\r\nStill exact Ω🙂\r\n')]),
        dict(work_id='poem-beta',title='A Question of Text',classification='CANON-A',selected_version='beta-1',metadata={'holds':['Source punctuation needs a decision.'],'book_memberships':[]},versions=[witness('beta-1','A Question of Text','The phrase?\n')]),
        dict(work_id='poem-empty',title='A Preserved Identity',classification='DRAFT',selected_version=None,metadata={'holds':[]},versions=[]),
        dict(work_id='redirect-old',title='Old Name',classification='HISTORICAL',redirect_to='poem-alpha',selected_version=None,metadata={'holds':[]},versions=[]),
        dict(work_id='excluded-work',title='Deliberately Excluded',classification='EXCLUDED',selected_version='excluded-1',metadata={'holds':[]},versions=[witness('excluded-1','Deliberately Excluded','Do not silently promote.\n')]),
    ]
    payload=json.dumps({'source_version':'synthetic-v1','works':works},ensure_ascii=False,separators=(',',':'))
    return {'format':'UniversalWritingCanonIntake/1','payload':payload,'sha256':sha(payload)}, works
class Backend:
    def __init__(self):
        self.records=[]; self.histories=[]; self.publications=[]; self.calls=[]
        self.fail_next_save=False; self.fail_public=False; self.anonymous_private_attempts=0
    def route(self,route):
        req=route.request; u=urlsplit(req.url); q=parse_qs(u.query); body=req.post_data_json if req.method=='POST' and req.post_data else None
        headers=req.headers; auth=headers.get('authorization')=='Bearer SYNTHETIC_OWNER_TOKEN'
        self.calls.append((req.method,u.path,body,auth))
        def send(data,status=200):
            route.fulfill(status=status,content_type='application/json',body=json.dumps(data,ensure_ascii=False),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'})
        if req.method=='OPTIONS': return send({})
        if u.path.endswith('/auth/v1/user'): return send({'email':'owner@example.test'}) if auth else send({'message':'not signed in'},401)
        if u.path.endswith('/auth/v1/logout'): return send({})
        if u.path.endswith('/museum_publications'):
            if self.fail_public:return send({'message':'temporarily unavailable'},503)
            rows=copy.deepcopy(self.publications)
            if q.get('state')==['eq.published']:rows=[x for x in rows if x['state']=='published']
            return send(rows)
        if not auth:
            self.anonymous_private_attempts+=1;return send({'message':'Private data denied'},403)
        if u.path.endswith('/rpc/museum_my_role'): return send('owner')
        if u.path.endswith('/museum_documents'):
            offset=int(q.get('offset',['0'])[0]);limit=int(q.get('limit',['250'])[0])
            return send(sorted(copy.deepcopy(self.records),key=lambda x:x['entity_key'])[offset:offset+limit])
        if u.path.endswith('/museum_revisions'):
            ident=q.get('document_id',[''])[0]
            if ident.startswith('eq.'):ids=[ident[3:]]
            elif ident.startswith('in.('):ids=ident[4:-1].split(',')
            else: ids=[]
            rows=[copy.deepcopy(x) for x in self.histories if x['document_id'] in ids]
            if q.get('order')==['version.desc']:rows.sort(key=lambda x:x['version'],reverse=True)
            else:rows.sort(key=lambda x:(x['document_id'],x['version']))
            offset=int(q.get('offset',['0'])[0]);limit=int(q.get('limit',['500'])[0]);return send(rows[offset:offset+limit])
        if u.path.endswith('/rpc/museum_save'):
            if self.fail_next_save:self.fail_next_save=False;return send({'message':'simulated interruption'},503)
            existing=next((x for x in self.records if x['id']==body['p_id']),None)
            if not existing and any(x['entity_key']==body['p_entity_key'] for x in self.records):return send({'message':'duplicate identity'},409)
            revision=existing['revision'] if existing else 0
            if body['p_expected_revision']!=revision:return send({'message':'Revision conflict'},409)
            r=dict(id=existing['id'] if existing else str(uuid.uuid4()),kind=body['p_kind'],entity_key=body['p_entity_key'],title=body['p_title'],draft=copy.deepcopy(body['p_draft']),revision=revision+1,approved_revision=None,status='draft',updated_at='2026-10-18T10:00:00Z')
            if existing:self.records.remove(existing)
            self.records.append(r);self.histories.append(dict(document_id=r['id'],version=r['revision'],title=r['title'],draft=copy.deepcopy(r['draft']),reason=body['p_reason'],created_at=r['updated_at']))
            return send(copy.deepcopy(r))
        r=next((x for x in self.records if x['id']==(body or {}).get('p_id')),None)
        if not r:return send({'message':'not found'},404)
        if r['revision']!=body.get('p_expected_revision'):return send({'message':'Revision conflict'},409)
        if u.path.endswith('/rpc/museum_approve'):
            if body.get('p_confirmation')!='APPROVE EXACT PUBLIC VERSION':return send({'message':'explicit approval required'},403)
            r['approved_revision']=r['revision'];r['status']='approved';return send(copy.deepcopy(r))
        if u.path.endswith('/rpc/museum_publish'):
            if body.get('p_confirmation')!='PUBLISH APPROVED VERSION' or r['approved_revision']!=r['revision']:return send({'message':'Approval is stale'},409)
            allowed=['text','description','status','provenance','public_note','url','alt','label','color']
            payload={k:v for k,v in r['draft'].items() if k in allowed};payload['title']=r['title']
            pub=dict(kind=r['kind'],entity_key=r['entity_key'],payload=payload,state='published',revision=r['revision'],published_at='2026-10-18T11:00:00Z')
            self.publications=[p for p in self.publications if p['entity_key']!=r['entity_key']]+[pub]
            r['status']='published';return send(copy.deepcopy(pub))
        if u.path.endswith('/rpc/museum_withdraw'):
            if body.get('p_confirmation')!='WITHDRAW PUBLIC VERSION':return send({'message':'explicit withdrawal required'},403)
            pub=dict(kind=r['kind'],entity_key=r['entity_key'],payload={'hidden':True},state='withdrawn',revision=r['revision'],published_at='2026-10-18T12:00:00Z')
            self.publications=[p for p in self.publications if p['entity_key']!=r['entity_key']]+[pub];r['status']='withdrawn';r['approved_revision']=None;return send(pub)
        return send({'message':'Unexpected request: '+u.path},400)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def main():
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'museum-static')))
    threading.Thread(target=server.serve_forever,daemon=True).start(); base=f'http://127.0.0.1:{server.server_port}'
    backend=Backend(); errors=[]; packet,works=fixture(); raw=json.dumps(packet,ensure_ascii=False).encode()
    with sync_playwright() as pw:
        opts={'headless':True}
        if os.environ.get('CHROMIUM_EXECUTABLE'):opts['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
        browser=pw.chromium.launch(**opts)
        context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
        context.route('https://*.supabase.co/**',backend.route)
        page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
        page.goto(base+'/admin/canon/');expect(page.locator('#login')).to_be_visible()
        check(backend.anonymous_private_attempts==0,'No private request before sign-in')
        page.evaluate("sessionStorage.setItem('idp_museum_editor_session_v1',JSON.stringify({access_token:'SYNTHETIC_OWNER_TOKEN',refresh_token:'SYNTHETIC_REFRESH',expires_at:9999999999}))")
        page.reload();expect(page.locator('#workspace')).to_be_visible();expect(page.locator('#message')).to_contain_text('one-time private import')
        page.locator('#import-open').click();page.locator('#intake-file').set_input_files({'name':'test-intake.json','mimeType':'application/json','buffer':raw})
        expect(page.locator('#intake-summary')).to_contain_text('5 identities')
        check(len(backend.records)==0,'File inspection alone does not upload')
        page.locator('#intake-start').click();expect(page.locator('#message')).to_contain_text('Import complete.')
        check(len(backend.records)==5,'All synthetic identities are stored privately')
        check(len(backend.publications)==0,'Import does not publish')
        check(all(x['draft']['_canon']['confirmation'] is None for x in backend.records),'Imported approvals remain inactive')
        check(sum(len(x['draft']['_canon']['witnesses']) for x in backend.records)==4,'All source witnesses are retained')
        count=len(backend.histories);page.locator('#intake-start').click();expect(page.locator('#message')).to_contain_text('5 existing records retained')
        check(len(backend.histories)==count,'Repeat import does not replace newer data or add duplicate versions')
        page.locator('#list button',has_text='A Test of Light').click();expect(page.locator('#work-title')).to_have_text('A Test of Light')
        check(page.locator('#text').text_content()==works[0]['versions'][1]['text'],'Rendered exact source retains CRLF and Unicode')
        check(page.locator('#release').is_disabled(),'Publication locked until exact canonical confirmation')
        page.locator('#versions').select_option('alpha-1');page.locator('#compare summary').click();expect(page.locator('#diff-summary')).to_contain_text('removed')
        check(page.locator('#current-text').text_content()!=page.locator('#candidate-text').text_content(),'Two source witnesses can be compared without rewriting')
        page.locator('#versions').select_option('alpha-2')
        page.locator('#bulk-open').click();expect(page.locator('#bulk')).to_be_visible();check(page.locator('#bulk-list .history-row').count()==1,'Batch confirmation excludes unresolved, excluded and missing works')
        page.locator('#bulk-authorship').select_option('brandon');page.locator('#bulk-reviewed').check();page.locator('#bulk-form button[type=submit]').click();expect(page.locator('#message')).to_contain_text('confirmed privately')
        check(not backend.publications,'Batch canonical confirmation does not grant publication')
        first=next(x for x in backend.records if x['draft']['_canon']['work_id']=='poem-alpha')
        check(first['draft']['_canon']['confirmation']['text_sha256']==works[0]['versions'][1]['sha256'],'Confirmation binds exact source hash')
        page.locator('#list button',has_text='A Question of Text').click();page.locator('#authorship').select_option('brandon');page.locator('#complete').check();page.locator('#choose').click();expect(page.locator('#message')).to_contain_text('Review the source questions')
        check(next(x for x in backend.records if x['draft']['_canon']['work_id']=='poem-beta')['draft']['_canon']['confirmation'] is None,'Unresolved questions block confirmation')
        page.locator('#reviewed').check();page.locator('#choose').click();expect(page.locator('#message')).to_contain_text('Canonical text confirmed')
        check(not backend.publications,'Individual confirmation also stays private')
        page.locator('#list button',has_text='A Test of Light').click();page.locator('#target-museum').check();page.locator('#release').click();expect(page.locator('#message')).to_contain_text('Exact canonical release verified')
        check(len(backend.publications)==1,'Explicit release creates one projection')
        check('_canon' not in json.dumps(backend.publications) and 'SYNTHETIC_' not in json.dumps(backend.publications),'Public projection excludes private witnesses and credentials')
        check(backend.publications[0]['payload']['label']=='canon:v1:museum','Destination scope is explicit')
        anon=browser.new_context(viewport={'width':1200,'height':900},accept_downloads=True);anon.route('https://*.supabase.co/**',backend.route)
        reader=anon.new_page();reader.goto(base+'/canon/?destination=rhymemosaic');expect(reader.locator('#empty')).to_be_visible();check(reader.locator('#reading').is_hidden(),'Wrong destination does not expose the work')
        reader.goto(base+'/canon/?destination=museum');expect(reader.locator('#title')).to_have_text('A Test of Light');check(reader.locator('#body').text_content()==works[0]['versions'][1]['text'],'Reader uses the identical released text')
        check(backend.anonymous_private_attempts==0,'Public reader never requests the private canon')
        with reader.expect_download() as info:reader.locator('#manifest').click()
        manifest=json.loads(pathlib.Path(info.value.path()).read_text());check(manifest['works'][0]['work_id']=='poem-alpha','Public feed retains original stable work identity')
        page.locator('#revise').click();page.locator('#draft-title').fill('A Test of Light — revised');page.locator('#compose-save').click();expect(page.locator('#message')).to_contain_text('New private version saved')
        first=next(x for x in backend.records if x['draft']['_canon']['work_id']=='poem-alpha')
        check(first['draft']['text']==works[0]['versions'][1]['text'],'Title-only edit preserves original line endings')
        check(len(first['draft']['_canon']['witnesses'])==3,'New private version appends rather than erases witnesses')
        check(first['draft']['_canon']['confirmation'] is None,'New private version invalidates canonical confirmation')
        reader.reload();expect(reader.locator('#title')).to_have_text('A Test of Light');check('revised' not in reader.locator('#title').text_content(),'Private changes do not silently replace public snapshots')
        page.locator('#authorship').select_option('brandon');page.locator('#complete').check();page.locator('#choose').click();expect(page.locator('#message')).to_contain_text('Canonical text confirmed')
        page.locator('#target-rhymemosaic').check();page.locator('#release').click();expect(page.locator('#message')).to_contain_text('Exact canonical release verified')
        reader.goto(base+'/canon/?destination=rhymemosaic');expect(reader.locator('#title')).to_have_text('A Test of Light — revised')
        check(backend.publications[0]['payload']['label']=='canon:v1:museum,rhymemosaic','One exact snapshot can serve both scoped destinations')
        reader.goto(base+'/canon/?destination=unknown');expect(reader.locator('#status')).to_contain_text('Unknown edition');check(reader.locator('#manifest').is_disabled(),'Unknown destination cannot produce a manifest')
        page.locator('#book-filter').select_option('brandonmeant');check(page.locator('#list button').count()==1,'Book view uses preserved membership rather than title guessing')
        with page.expect_download() as info:page.locator('#export-book').click()
        book=json.loads(pathlib.Path(info.value.path()).read_text());check(book['entries'][0]['position']==1 and book['status'].endswith('NOT_PUBLICATION_APPROVED'),'Book candidate preserves order and is not publication approval')
        page.locator('#book-filter').select_option('all')
        with page.expect_download() as info:page.locator('#backup').click()
        backup=pathlib.Path(info.value.path()).read_bytes();check(b'SYNTHETIC_OWNER_TOKEN' not in backup,'Whole-canon backup excludes authentication tokens')
        page.locator('#rehearse-open').click();history_count=len(backend.histories);page.locator('#backup-file').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':backup});expect(page.locator('#backup-result')).to_contain_text('Zero database changes')
        check(len(backend.histories)==history_count,'Recovery rehearsal does not write to the database')
        tampered=json.loads(backup);tampered['sha256']='0'*64;page.locator('#backup-file').set_input_files({'name':'tampered.json','mimeType':'application/json','buffer':json.dumps(tampered).encode()});expect(page.locator('#message')).to_contain_text('checksum mismatch')
        check(len(backend.histories)==history_count,'Damaged backup is rejected without writes')
        page.locator('#withdraw').click();expect(page.locator('#message')).to_contain_text('release withdrawn');reader.goto(base+'/canon/?destination=museum');expect(reader.locator('#empty')).to_be_visible()
        check(backend.publications[0]['payload']=={'hidden':True},'Withdrawal removes the public body')
        page.locator('#new-open').click();page.locator('#draft-title').fill('Another new private work');page.locator('#draft-text').fill('Line one\n\nLine two');backend.fail_next_save=True;page.locator('#compose-save').click();expect(page.locator('#message')).to_contain_text('simulated interruption');check(page.locator('#compose').is_visible(),'An interrupted save retains on-screen writing')
        page.locator('#compose-save').click();expect(page.locator('#message')).to_contain_text('New private version saved');check(len(backend.records)==6,'Explicit retry after an inspected failure saves new work once')
        page.locator('#list button',has_text='A Test of Light — revised').click();page.screenshot(path=str(OUT/'universal-canon-desktop.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(OUT/'universal-canon-mobile.png'),full_page=True)
        check(page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'),'Phone-sized page has no horizontal overflow')
        overlay_script=(ROOT/'museum-static/admin/public-overlay.js').read_text()
        isolated=anon.new_page();isolated.goto('about:blank');isolated.evaluate("""()=>{window.IDP_CMS_CONFIG={url:'https://overlay-fixture.supabase.co',publishableKey:'sb_publishable_test'};window.IDP_CREATIVE_META={supplementalWorks:[]};window.fetch=async()=>({ok:true,json:async()=>[{kind:'creative',entity_key:'canon__poem-alpha',payload:{title:'Not a historical replacement',text:'synthetic',label:'canon:v1:museum'},state:'published'},{kind:'creative',entity_key:'canon__poem-beta',payload:{hidden:true},state:'withdrawn'}]});}""");isolated.evaluate(overlay_script);isolated.evaluate('window.IDP_CMS_PUBLIC_READY');check(isolated.evaluate('IDP_CREATIVE_META.supplementalWorks.length')==0,'Canon publications and withdrawals never alter historical Museum arrays')
        page.locator('#signout').click();expect(page.locator('#login')).to_be_visible();check(page.locator('#text').text_content()=='','Sign-out clears displayed private text')
        check(not errors,'No uncaught JavaScript errors: '+repr(errors))
        browser.close()
    server.shutdown();(OUT/'universal-canon-browser-results.json').write_text(json.dumps({'passed':True,'checks':len(CHECKS),'assertions':CHECKS,'synthetic_only':True,'production_auth_session_used':False},indent=2))
    print(json.dumps({'suite':'universal-canon-native-browser','passed':True,'checks':len(CHECKS)}))
if __name__=='__main__':main()
