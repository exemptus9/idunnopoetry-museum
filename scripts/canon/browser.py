"""Synthetic browser tests. No real credentials or private writing is loaded."""
import json, hashlib, pathlib, os, mimetypes
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
REPO=pathlib.Path(__file__).resolve().parents[2]
ROOT=REPO/'museum-static'/'admin'/'canon'
OUT=REPO/'test-artifacts'/'canon';OUT.mkdir(parents=True,exist_ok=True)
URL='https://exemptus9.github.io/idunnopoetry-museum/admin/canon/'
sha=lambda s:hashlib.sha256(s.encode()).hexdigest()
def envelope(data):return {'format':'UniversalWritingCanonEnvelope/1','sha256':sha(json.dumps(data,sort_keys=True,ensure_ascii=False,separators=(',',':'))),'data':data}
text='Exact “specimen”\r\n\r\nPrivate ending';works={};calls=[];public=[]
def response(action,a):
 if action=='status':return {'works':len(works),'selected':len(works),'confirmed':sum(w['work'].get('confirmed_revision') is not None for w in works.values()),'publications':len(public)}
 if action=='library':return [{**w['work'],'sha256':next((v['sha256'] for v in w['versions'] if v['revision']==w['work']['selected_revision']),None),'latest_revision':len(w['versions']),'outputs':[]} for w in works.values()]
 if action=='import':
  added=0
  for x in a['works']:
   if x['work_id'] in works:continue
   vs=[{'work_id':x['work_id'],'revision':i+1,'witness_id':v['witness_id'],'title':x['title'],'body':v['text'],'sha256':v['sha256'],'source':v.get('source',{})} for i,v in enumerate(x['versions'])]
   works[x['work_id']]={'work':{'work_id':x['work_id'],'title':x['title'],'kind':'poem','classification':'selected','seq':1,'selected_revision':1,'confirmed_revision':None,'source':{'fixture':'synthetic'},'holds':[]},'versions':vs,'events':[]};added+=1
  return {'works_added':added,'published':0}
 if action=='work':return works[a['work_id']]
 if action=='save':
  w=works[a['work_id']];v={'work_id':a['work_id'],'revision':len(w['versions'])+1,'witness_id':'edit-fixture','title':a['title'],'body':a['text'],'sha256':a['sha256'],'source':{}};w['versions'].append(v);w['work']['seq']+=1;return {'revision':v['revision']}
 if action=='confirm':
  w=works[a['work_id']];w['work'].update(selected_revision=a['revision'],confirmed_revision=a['revision'],author_label=a['author_label'],seq=w['work']['seq']+1);return {'selected_revision':a['revision']}
 if action=='release':
  w=works[a['work_id']];public.extend(a['destinations']);w['work']['seq']+=1;return {'external_sites_written':False}
 if action=='backup':return {'format':'UniversalWritingCanonSnapshot/1','works':[w['work'] for w in works.values()],'versions':[v for w in works.values() for v in w['versions']],'placements':[],'redirects':[],'events':[],'publications':[]}
 raise Exception('Unexpected operation '+str(action))
fixture=envelope({'format':'UniversalWritingCanonImport/1','works':[{'work_id':'existing-specimen-id','title':'Synthetic specimen','versions':[{'witness_id':'witness-original','text':text,'sha256':sha(text)}],'selected_witness_id':'witness-original','placements':[]}],'redirects':[]})
checks=[]
def check(name,condition):
 assert condition,name;checks.append(name)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,**({'executable_path':os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}));ctx=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
 ctx.add_init_script("sessionStorage.setItem('idp_museum_editor_session_v1',JSON.stringify({access_token:'CANON_TEST_TOKEN_NEVER_EXPORT',refresh_token:'fake',expires_at:9999999999}));")
 page=ctx.new_page();page.on('dialog',lambda d:d.accept());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def route(r):
  if r.request.url.endswith('/auth/v1/logout'):r.fulfill(status=200,body='{}');return
  body=json.loads(r.request.post_data or '{}');action=body.get('p_action');a=body.get('p_args',{});calls.append((action,a));r.fulfill(status=200,content_type='application/json',body=json.dumps(response(action,a),ensure_ascii=False))
 def static_route(r):
  path=urlparse(r.request.url).path.split('/idunnopoetry-museum/',1)[1]
  if path=='admin/cms-config.js':r.fulfill(status=200,content_type='application/javascript',body="window.IDP_CMS_CONFIG={url:'https://csqhnfoxyioazxyvhufu.supabase.co',publishableKey:'sb_publishable_synthetic'};");return
  f=REPO/'museum-static'/path
  if f.is_dir():f=f/'index.html'
  if not f.is_file():r.fulfill(status=404,body='missing fixture');return
  r.fulfill(status=200,content_type=mimetypes.guess_type(str(f))[0] or 'text/plain',body=f.read_bytes())
 page.route('https://csqhnfoxyioazxyvhufu.supabase.co/**',route)
 page.route('https://exemptus9.github.io/idunnopoetry-museum/**',static_route)
 page.goto(URL);page.locator('#workspace').wait_for(state='visible');check('Existing owner session opens Canon',True)
 page.click('#go-import');page.set_input_files('#file',{'name':'bad.json','mimeType':'application/json','buffer':json.dumps({**fixture,'sha256':'0'*64}).encode()});page.wait_for_timeout(120);check('Tampered import disabled',page.locator('#import').is_disabled());check('Tamper made no writes',not any(a=='import' for a,_ in calls))
 page.set_input_files('#file',{'name':'canon.json','mimeType':'application/json','buffer':json.dumps(fixture,ensure_ascii=False).encode()});page.locator('#import:not([disabled])').wait_for();page.click('#import');page.locator('#work-list button').wait_for();check('Single private import',sum(a=='import' for a,_ in calls)==1);check('Import never approves or publishes',not any(a in ['confirm','release'] for a,_ in calls))
 page.click('#work-list button');page.locator('#work-heading').wait_for(state='visible');page.wait_for_timeout(100);check('Text hash verified','verified' in page.locator('#hash').inner_text());check('Exact source displayed',page.input_value('#body')==text.replace('\r\n','\n'))
 page.fill('#title','Synthetic specimen revised title');check('Unsaved edits block confirmation',page.locator('#confirm').is_disabled());page.click('#save');page.wait_for_timeout(200);save=[a for action,a in calls if action=='save'][-1];check('Unedited body keeps CRLF',save['text']==text);check('Save is not canon change',works['existing-specimen-id']['work']['selected_revision']==1)
 page.locator('#authority summary').click();page.click('#confirm');page.wait_for_timeout(150);check('Exact chosen revision confirmed',works['existing-specimen-id']['work']['selected_revision']==2);check('Confirm does not publish',not public)
 page.locator('#release summary').click();page.locator('input[value="museum"]').check();page.click('#publish');page.wait_for_timeout(150);check('Only selected destination released',public==['museum']);page.fill('#body','Unsaved private changes');check('Dirty text blocks release',page.locator('#publish').is_disabled());check('Dirty text blocks canonical promotion',page.locator('#confirm').is_disabled())
 page.fill('#body',text.replace('\r\n','\n'));page.click('[data-tab="recovery"]');
 with page.expect_download() as download:page.click('#backup')
 f=download.value;f.save_as(OUT/'synthetic-snapshot.json');snap=json.loads((OUT/'synthetic-snapshot.json').read_text());check('Snapshot contains complete history',len(snap['data']['versions'])==2);check('Snapshot excludes tokens','CANON_TEST_TOKEN_NEVER_EXPORT' not in json.dumps(snap) and 'access_token' not in json.dumps(snap))
 page.set_input_files('#file',str(OUT/'synthetic-snapshot.json'));page.wait_for_timeout(120);check('Recovery rehearses without writes','Zero writes' in page.locator('#file-result').inner_text());check('Nonempty canon cannot restore',page.locator('#restore').is_hidden())
 page.click('[data-tab="library"]');page.keyboard.press('Control+k');check('Keyboard shortcut focuses search',page.locator('#search').evaluate('(e)=>e===document.activeElement'))
 page.screenshot(path=str(OUT/'canon-desktop.png'),full_page=True);page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(OUT/'canon-mobile.png'),full_page=True);check('Mobile has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
 page.click('#signout');check('Sign-out hides private interface',page.locator('#workspace').is_hidden());check('Sign-out clears text',page.input_value('#body')=='');check('Sign-out clears canonical records',page.locator('#work-list').inner_text()=='');check('No browser exceptions',not errors)
 browser.close()
(OUT/'receipt.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'browser_errors':errors,'authentication':'synthetic','production_writes':0},indent=2));print('PASS',len(checks),'real Chromium tests')
