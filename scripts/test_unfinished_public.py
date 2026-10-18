"""Static privacy and structure tests for the fictional-only public writing demo."""
import json,re,subprocess,shutil,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'museum-static'/'unfinished'
if not SITE.is_dir(): SITE=ROOT/'site'

class UnfinishedPublicTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html=(SITE/'index.html').read_text(encoding='utf-8')
        cls.samples=(SITE/'samples.js').read_text(encoding='utf-8')
        cls.app=(SITE/'app.js').read_text(encoding='utf-8')
        cls.exp=(SITE/'experience.js').read_text(encoding='utf-8')
    def test_shell_files_and_references(self):
        for name in ('index.html','styles.css','samples.js','app.js','experience.js','service-worker.js','icon.svg','manifest.webmanifest'):
            self.assertGreater((SITE/name).stat().st_size,10,name)
        for src in ('./samples.js','./app.js','./experience.js','./styles.css','./manifest.webmanifest'):
            self.assertIn(src,self.html)
    def test_demo_is_explicitly_fictional(self):
        self.assertIn('PUBLIC DEMO',self.html)
        self.assertIn('FICTIONAL TEXT',self.html)
        self.assertIn('fictional:true',self.samples)
        self.assertEqual(len(re.findall(r"\{title:",self.samples)),32)
        self.assertNotIn('PRIVATE_LITERARY_MASTER',self.samples)
    def test_private_text_does_not_ship(self):
        blob='\n'.join((SITE/x).read_text(encoding='utf-8') for x in ('samples.js','app.js','experience.js','index.html'))
        for phrase in ('PRIVATE_LITERARY_MASTER_2026-10-17.json','IDP_Private_Seed_Vault_v5_PUBLISH.html','unprocessed-facebook-archive.zip','private_records.json'):
            self.assertNotIn(phrase,blob,phrase)
        self.assertNotIn('PRIVATE_LITERARY_MASTER_2026-10-17.json',blob)
    def test_privacy_csp_and_offline_shell(self):
        self.assertIn("connect-src 'self'",self.html)
        self.assertIn("object-src 'none'",self.html)
        sw=(SITE/'service-worker.js').read_text(encoding='utf-8')
        self.assertIn('unfinished-public-shell-v05',sw)
        self.assertIn("'./experience.js'",sw)
        self.assertNotIn('PRIVATE_LITERARY_MASTER',sw)
        manifest=json.loads((SITE/'manifest.webmanifest').read_text(encoding='utf-8'))
        self.assertEqual(manifest['start_url'],'./#/discover')
    def test_ways_to_start_and_progressive_disclosure(self):
        self.assertIn('id="intent-continue"',self.html)
        self.assertIn('id="start-here"',self.html)
        self.assertIn('id="instruments"',self.html)
        self.assertIn('id="editor-toolbox"',self.html)
        self.assertIn('id="more-work"',self.html)
        self.assertIn('id="command-dialog"',self.html)
    def test_migrations_and_intended_backup(self):
        self.assertIn("DB_NAME='unfinished-public-workroom-v04'",self.app)
        self.assertIn("DATA_KEY='unfinished-demo-v04-prefs'",self.app)
        self.assertIn('lastBackupAt',self.app)
        self.assertIn('unfinished-unsaved-v05',self.exp)
        self.assertIn('future same-origin',self.exp)
    def test_js_parses(self):
        if shutil.which('node'):
            for script in ('app.js','experience.js','samples.js','service-worker.js'):
                p=subprocess.run(['node','--check',str(SITE/script)],capture_output=True,text=True)
                self.assertEqual(p.returncode,0,p.stderr)

if __name__=='__main__':unittest.main()