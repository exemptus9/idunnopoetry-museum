"""Ensure the Atlas and Constellation publish the exact same reviewed, privacy-safe project inventory."""
import html
import re
import subprocess
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]/"museum-static"
CON=(ROOT/"projects/index.html").read_text(encoding="utf-8")
ATL=(ROOT/"atlas/index.html").read_text(encoding="utf-8")
CLASS=re.compile(r'<article class="card project"[^>]*>[\s\S]*?</article>')
ATLAS=re.compile(r'<article class="atlas-orbit"[^>]*>[\s\S]*?</article>')
def extract(source,regex):
    out=[]
    for block in regex.findall(source):
        name=html.unescape(re.search(r"<h3>(.*?)</h3>",block).group(1))
        stage=re.search(r'data-stage="([^"]+)"',block).group(1)
        domain=re.search(r'data-domain="([^"]+)"',block).group(1)
        uid=re.search(r'id="(project-[^"]+)"',block).group(1)
        out.append((name,stage,domain,uid,block))
    return out

class ProjectCompendiumTests(unittest.TestCase):
    def test_parity_and_uniqueness(self):
        con=extract(CON,CLASS)
        atl=extract(ATL,ATLAS)
        self.assertGreaterEqual(len(con),40)
        self.assertEqual([(x[0],x[1],x[2],x[3]) for x in con],
                         [(x[0],x[1],x[2],x[3]) for x in atl])
        self.assertEqual(len({x[3] for x in con}),len(con))
        self.assertEqual({x[1] for x in con},{"live","preview","building","archive"})
        self.assertTrue(all(x[2] in {"poetry","language","archive","technology","research","community"} for x in con))
    def test_new_sources_and_protected_status(self):
        for target in ("Sanford Resource Hub","Public Deception Atlas","Callside · Call Notes","Memory24/7","Mirror B · Brandon Mirror Private"):
            self.assertIn(target,CON)
            self.assertIn(target,ATL)
        for page in (CON,ATL):
            self.assertIn("sanford-resource-hub.idunnopoetry.chatgpt.site/",page)
            self.assertIn("de7ba904",page)
            for private_url in ("brandon-mirror-private.idunnopoetry.chatgpt.site","synchronicity-atlas-brandon.idunnopoetry.chatgpt.site","threads-observatory-wordsmith.idunnopoetry.chatgpt.site"):
                self.assertNotIn(private_url,page)
    def test_cards_and_live_assets_are_safe(self):
        for name,stage,domain,uid,card in extract(CON,CLASS):
            if stage=="building":
                self.assertNotIn('href="https://brandon-mirror',card)
            sources=re.findall(r'<img[^>]+src="([^"]+)"',card)
            for path in sources:
                if path.startswith("../assets/brand/"):
                    self.assertTrue((ROOT/"projects"/path).resolve().is_file(),path)
        self.assertIn('data-compendium-view="compact"',CON)
        self.assertIn('data-compendium-view="compact"',ATL)
    def test_live_controls_in_dom_engine(self):
        result=subprocess.run(["node",str(ROOT.parent/"scripts/test_compendium_dom.mjs")],
                              capture_output=True,text=True,timeout=60)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)

    def test_navigation_code_is_parseable(self):
        js=ROOT/"atlas/worlds.js"
        result=subprocess.run(["node","--check",str(js)],capture_output=True,text=True,timeout=30)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertIn('id="project-more"',CON)
        self.assertIn('id="worlds-more"',ATL)
        self.assertIn('id="worlds-domain"',ATL)
        self.assertIn('id="project-domain"',CON)

if __name__=="__main__":
    unittest.main()
