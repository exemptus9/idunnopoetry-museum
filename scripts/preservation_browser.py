"""Real Chromium tests of deployed source with synthetic auth and intercepted API.
No user's tokens, private corpus or production database are used.
Default CI mode uses a virtual HTTPS origin, native WebCrypto and the actual CSP.
TEST_IN_MEMORY=1 is a separately labeled fallback for environments blocking navigation.
"""
import copy, hashlib, json, os, tempfile, mimetypes, re
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
url='https://museum.example.test/admin/'
ID='11111111-1111-4111-8111-111111111111'
ORIGINAL='A preserved witness.\r\n\r\nNot a rewritten past…\r\n'
record=dict(id=ID,kind='creative',entity_key='synthetic-work',title='The preserved witness',
 draft={'text':ORIGINAL,'provenance':'uncertain','_canonical_source':{'work_id':'source-1','note':'Private metadata is retained'}},
 revision=2,approved_revision=None,status='draft',updated_at='2026-10-18T00:00:00Z')
versions=[dict(document_id=ID,version=1,title='A first witness',draft={'text':'The beginning.\n','provenance':'uncertain'},reason='Synthetic first witness',created_at='2026-10-17T00:00:00Z'),
 dict(document_id=ID,version=2,title=record['title'],draft=copy.deepcopy(record['draft']),reason='Exact CRLF fixture',created_at='2026-10-18T00:00:00Z')]
state={'records':[copy.deepcopy(record)],'versions':copy.deepcopy(versions),'writes':[],'role':'owner','history_changes':False,'reads':0}
checks=[]
def check(condition,label):
    assert condition,label
    checks.append(label)

def mock_api(address,options=None):
    options=options or {}
    p=urlparse(address);q=parse_qs(p.query);path=p.path
    payload=json.loads(options.get('body') or '{}') if options.get('method')=='POST' else {}
    data=None
    if path=='/auth/v1/user': data={'email':'synthetic-curator@example.test'}
    elif path.endswith('/rpc/museum_my_role'): data=state['role']
    elif path.endswith('/museum_documents'):
        data=copy.deepcopy(state['records'])
        if 'id' in q:
            ident=q['id'][0].removeprefix('eq.');data=[x for x in data if x['id']==ident]
            if state['history_changes']:
                state['reads']+=1
                if state['reads']%2==0 and data:data[0]['updated_at']='changed-during-capture'
    elif path.endswith('/museum_revisions'):
        data=copy.deepcopy(state['versions'])
        ident=q.get('document_id',[''])[0].removeprefix('eq.')
        if ident:data=[x for x in data if x['document_id']==ident]
        after=int(q.get('version',['gt.0'])[0].removeprefix('gt.')) if q.get('version',[''])[0].startswith('gt.') else 0
        data=[x for x in data if x['version']>after]
    elif path.endswith('/rpc/museum_save'):
        state['writes'].append(('save',copy.deepcopy(payload)))
        found=next((r for r in state['records'] if r['id']==payload['p_id']),None)
        if found:
            assert found['revision']==payload['p_expected_revision']
            found.update(title=payload['p_title'],draft=payload['p_draft'],revision=found['revision']+1,status='draft',approved_revision=None)
        else:
            found=dict(id='22222222-2222-4222-8222-222222222222',kind=payload['p_kind'],entity_key=payload['p_entity_key'],title=payload['p_title'],draft=payload['p_draft'],revision=1,status='draft',approved_revision=None,updated_at='2026-10-18T10:00:00Z')
            state['records'].append(found)
        state['versions'].append(dict(document_id=found['id'],version=found['revision'],title=found['title'],draft=copy.deepcopy(found['draft']),reason=payload['p_reason'],created_at='2026-10-18T10:00:00Z'))
        data=copy.deepcopy(found)
    elif path.endswith('/rpc/museum_restore'):
        state['writes'].append(('restore',copy.deepcopy(payload)))
        found=next(r for r in state['records'] if r['id']==payload['p_id'])
        assert found['revision']==payload['p_expected_revision']
        old=next(v for v in state['versions'] if v['document_id']==found['id'] and v['version']==payload['p_from_revision'])
        found.update(title=old['title'],draft=copy.deepcopy(old['draft']),revision=found['revision']+1,status='draft',approved_revision=None)
        state['versions'].append(dict(document_id=found['id'],version=found['revision'],title=found['title'],draft=copy.deepcopy(found['draft']),reason='Restored synthetic witness',created_at='2026-10-18T11:00:00Z'))
        data=copy.deepcopy(found)
    elif path=='/auth/v1/logout':data={}
    else: raise AssertionError('Unexpected production-like API request: '+path)
    return data

def intercept(route):
    req=route.request
    data=mock_api(req.url,{'method':req.method,'body':req.post_data})
    route.fulfill(status=200,content_type='application/json',body=json.dumps(data))

with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
    launch={'headless':True,'args':['--no-sandbox']}
    if os.environ.get('CHROMIUM_EXECUTABLE'):launch['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
    browser=p.chromium.launch(**launch)
    context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
    def static_source(route):
        path=urlparse(route.request.url).path.lstrip('/')
        if path.endswith('/'):path+='index.html'
        root=(ROOT/'museum-static').resolve();target=(root/path).resolve()
        assert target.is_relative_to(root)
        if target.is_file():
            route.fulfill(content_type=mimetypes.guess_type(str(target))[0] or 'application/octet-stream',body=target.read_bytes())
        else:route.fulfill(status=404,body='Missing test asset')
    context.route('**/*',lambda route:route.abort())
    context.route('https://museum.example.test/**',static_source)
    context.route('**/*.supabase.co/**',intercept)
    context.add_init_script("sessionStorage.setItem('idp_museum_editor_session_v1',JSON.stringify({access_token:'synthetic-test-only',refresh_token:'synthetic-refresh',expires_at:9999999999}))")
    page=context.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('dialog',lambda d:d.accept())
    if os.environ.get('TEST_IN_MEMORY'):
        html=(ROOT/'museum-static/admin/index.html').read_text()
        html=re.sub(r'<script[^>]*src=[^>]+></script>','',html)
        html=re.sub(r'<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>','',html)
        html=re.sub(r'<link[^>]+rel="stylesheet"[^>]*>','',html)
        page.set_content(html)
        for name in ['admin.css','preservation.css']:
            page.add_style_tag(content=(ROOT/'museum-static/admin'/name).read_text())
        page.expose_function('__mock_api',mock_api)
        page.expose_function('__mock_sha',lambda data:list(hashlib.sha256(bytes(data)).digest()))
        page.evaluate("""() => {
          const store=new Map();Object.defineProperty(window,'sessionStorage',{value:{setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)||null,removeItem:k=>store.delete(k)}});
          sessionStorage.setItem('idp_museum_editor_session_v1',JSON.stringify({access_token:'synthetic-test-only',refresh_token:'synthetic-refresh',expires_at:9999999999}));
          Object.defineProperty(crypto,'subtle',{value:{digest:async(a,b)=>new Uint8Array(await window.__mock_sha(Array.from(new Uint8Array(b)))).buffer}});
          window.fetch=async(u,o={})=>new Response(JSON.stringify(await window.__mock_api(String(u),o)),{status:200});
          window.IDP_CORE={users:[],topics:[],forums:[]};window.IDP_POETRY={works:[]};window.IDP_POSTS=[];window.IDP_CREATIVE_META={};
        }""")
        for name in ['cms-config.js','navigator-core.js','preservation-core.js','admin.js','preservation-desk.js']:
            page.add_script_tag(content=(ROOT/'museum-static/admin'/name).read_text())
    else:page.goto(url)
    page.locator('#preservation-open').wait_for(state='visible')
    expect(page.locator('#preservation-open')).to_be_enabled()
    check(page.locator('#app').is_visible(),'authenticated original editor loads')
    page.locator('#preservation-open').click()
    check(page.locator('#preservation-desk').is_visible(),'native preservation dialog opens')
    check(page.locator('#pd-close').evaluate('(e)=>document.activeElement===e'),'dialog focus is explicit')
    page.locator('#pd-record').select_option(ID);page.locator('#pd-history').click()
    page.locator('#pd-timeline').wait_for(state='visible')
    check('Complete history loaded: 2' in page.locator('#pd-status').inner_text(),'full history captured and verified')
    check(page.locator('#pd-after-text').text_content()==ORIGINAL,'saved CRLF text remains exact in comparison')
    check('added line' in page.locator('#pd-diff-summary').inner_text(),'line-aware comparison rendered')
    page.locator('.pd-diff-detail summary').click()
    check('⟦CRLF⟧' in page.locator('#pd-diff').inner_text(),'newline semantics shown')
    with page.expect_download() as download_info:page.locator('#pd-export').click()
    download=download_info.value;dest=Path(tmp)/'work.json';download.save_as(dest)
    packet=json.loads(dest.read_text())
    check(packet['data']['record']['draft']['text']==ORIGINAL,'download preserves exact source string')
    check('synthetic-test-only' not in dest.read_text(),'recovery export omits session credentials')
    page.locator('#pd-tab-recovery').click();page.locator('#pd-recovery-file').set_input_files(str(dest))
    expect(page.locator('#pd-status')).to_contain_text('Recovery rehearsal passed')
    check('0 — review only' in page.locator('#pd-recovery-report').inner_text(),'recovery rehearsal performs zero writes')
    broken=copy.deepcopy(packet);broken['data']['record']['title']='Modified'
    bad=Path(tmp)/'broken.json';bad.write_text(json.dumps(broken))
    page.locator('#pd-recovery-file').set_input_files(str(bad))
    expect(page.locator('#pd-status')).to_contain_text('checksum mismatch')
    check(len(state['writes'])==0,'invalid bundle causes no mutation')
    page.locator('#pd-tab-revisions').click();page.locator('#pd-restore').click()
    expect(page.locator('#pd-status')).to_contain_text('Restored as a new private revision')
    check(state['records'][0]['revision']==3,'restore creates a new revision')
    check(len(state['versions'])==3,'restore retains every older revision')
    check(state['records'][0]['status']=='draft' and state['records'][0]['approved_revision'] is None,'restore never republishes or reapproves')
    state['history_changes']=True;state['reads']=0;page.locator('#pd-history').click()
    expect(page.locator('#pd-status')).to_contain_text('Record changed during capture')
    check(True,'concurrent capture changes are detected')
    state['history_changes']=False
    page.locator('#pd-tab-canon').click()
    canonical='A source kept exactly.\r\n\r\nThrough time…\r\n'
    candidate=dict(work_id='registry-stable-01',title='A stable original',canonical_text=canonical,
      sha256=hashlib.sha256(canonical.encode()).hexdigest(),canonical_witness_id='witness-1',canon_status='CANON-A',public_export_approved=True)
    source=Path(tmp)/'registry.html';source.write_text('<html><script>window.MUST_NOT_RUN=true</script><script id="work-data" type="application/json">'+json.dumps([candidate])+'</script></html>')
    page.locator('#pd-registry-file').set_input_files(str(source))
    expect(page.locator('#pd-status')).to_contain_text('1 matching text hashes')
    check(page.evaluate('window.MUST_NOT_RUN===undefined'),'imported report scripts never execute')
    check(len(state['writes'])==1,'local registry import makes no save request')
    page.locator('.pd-work').click()
    check(page.locator('#pd-candidate-text').text_content()==canonical,'registry text remains exact')
    page.locator('#pd-stage').click()
    page.locator('#preservation-desk').wait_for(state='hidden')
    check(page.locator('#entity-key').input_value()=='registry-stable-01','stable canonical work ID retained')
    check(page.locator('#provenance').input_value()=='uncertain','import never invents authorship')
    check(len(state['writes'])==1,'staging is not saving')
    page.locator('#save').click()
    expect(page.locator('#message')).to_contain_text('Private draft saved')
    saved=state['writes'][-1][1]
    check(saved['p_draft']['text']==canonical,'unmodified textarea preserves source CRLF when saved')
    check(saved['p_draft']['_canonical_source']['publication_permission']=='NOT_IMPORTED','source permission never grants a public release')
    page.locator('#title').fill('Retitled locally');page.locator('#save').click();page.wait_for_timeout(180)
    check(state['writes'][-1][1]['p_draft']['_canonical_source']['work_id']=='registry-stable-01','private provenance survives ordinary edits')
    check(all(x[0] in ['restore','save'] for x in state['writes']),'no approval or publishing endpoint contacted')
    page.locator('#preservation-open').click();page.locator('#pd-tab-canon').click()
    if os.environ.get('SCREENSHOT_DIR'):
        out=Path(os.environ['SCREENSHOT_DIR']);out.mkdir(parents=True,exist_ok=True)
        page.screenshot(path=str(out/'preservation-desktop.png'))
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100)
    check(page.locator('#preservation-desk').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'),'mobile dialog has no horizontal overflow')
    if os.environ.get('SCREENSHOT_DIR'):page.screenshot(path=str(Path(os.environ['SCREENSHOT_DIR'])/'preservation-mobile.png'))
    page.keyboard.press('Escape');check(not page.locator('#preservation-desk').is_visible(),'Escape closes the dialog')
    check(page.locator('#preservation-open').evaluate('(e)=>document.activeElement===e'),'focus returns to the opening control')
    page.locator('#logout').click();page.wait_for_timeout(100)
    check(page.locator('#pd-candidate-text').text_content()=='','sign-out clears imported private text')
    check(page.locator('#pd-recovery-report').text_content()=='','sign-out clears recovery data')
    check(page.locator('#pd-candidate-meta').text_content()=='' and page.locator('#pd-candidate-title').text_content()=='','sign-out also clears private IDs and titles')
    check(not errors,'no uncaught browser errors: '+str(errors))
    browser.close()
mode='in-memory boundaries (CSP/WebCrypto origin not tested)' if os.environ.get('TEST_IN_MEMORY') else 'virtual HTTPS, native WebCrypto/CSP'
print('PASS:',len(checks),'real Chromium preservation checks; mode:',mode)
for name in checks:print('  OK',name)
