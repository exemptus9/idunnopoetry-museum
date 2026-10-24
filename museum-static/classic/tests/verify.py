from pathlib import Path
import json,hashlib,re
from bs4 import BeautifulSoup
R=Path(__file__).resolve().parent.parent
poems=json.loads((R/'data/poems.json').read_text())
assert len(poems)==106
assert [x['order'] for x in poems]==list(range(1,107))
for x in poems:
 p=R/'witnesses/poems'/x['source_file'];assert hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256'],x['slug']
 assert (R/'poems'/f"{x['slug']}.html").exists()
for path in R.rglob('*.html'):
 tree=BeautifulSoup(path.read_text(encoding='utf-8'),'html.parser')
 assert tree.title, path
 for tag in tree.find_all(['a','img','link','script']):
  val=tag.get('href') or tag.get('src')
  if not val or val.startswith(('http:','https:','mailto:','#','data:','javascript:')):continue
  val=val.split('#')[0].split('?')[0]
  if val and not (path.parent/val).exists():raise AssertionError((str(path.relative_to(R)),tag.name,val))
assert len(list((R/'assets/art').glob('IDP*.jpg')))==18
for forbidden in ['login.inc','.htpasswd','wp-config.php','090704.htm']:
 assert not list(R.rglob(forbidden)),forbidden
print('PASS: 106 original witnesses, checksums, 106 rendered poem pages, local HTML links, 18 gallery assets, no flagged private source files.')
