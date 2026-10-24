"""Public-only continuity portal regression gates. No network or extra dependencies."""
import hashlib
import json
import re
import unittest
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1] / 'museum-static'
ATLAS = ROOT / 'atlas'


class AtlasIntegrationTests(unittest.TestCase):
    def test_complete_historical_index(self):
        index = (ATLAS / 'poems.js').read_text(encoding='utf-8')
        prefix = 'window.IDP_ATLAS_POEMS='
        self.assertIn(prefix, index)
        records = json.loads(index.split(prefix, 1)[1].strip().rstrip(';'))
        manifest = json.loads((ROOT / 'classic/data/poems.json').read_text())
        self.assertEqual(len(records), 106)
        self.assertEqual(len(records), len(manifest))
        self.assertEqual(len({r['slug'] for r in records}), 106)
        for derived, src in zip(records, manifest):
            self.assertEqual((derived['order'], derived['slug'], derived['title']), (src['order'], src['slug'], src['title']))
            self.assertGreater(len(derived['text']), 15)
            source = ROOT / 'classic/witnesses/poems' / src['source_file']
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), src['sha256'])
            self.assertTrue((ROOT / 'classic/poems' / (src['slug'] + '.html')).is_file())

    def test_every_portal_link_is_valid(self):
        content = (ATLAS / 'index.html').read_text(encoding='utf-8')
        links = re.findall(r'\b(?:href|src)="([^"]+)"', content)
        for url in links:
            ref = urlsplit(url)
            if ref.scheme or ref.netloc or ref.path in ('', '#') or not ref.path:
                continue
            path = (ATLAS / unquote(ref.path)).resolve()
            with self.subTest(path=url):
                self.assertTrue(path.is_file() or (path.is_dir() and (path / 'index.html').is_file()))

    def test_historical_vs_living_boundary_is_visible(self):
        page = (ATLAS / 'index.html').read_text(encoding='utf-8')
        for marker in ('Original sources remain original', '2004', 'not documented composition sequences',
                       'Living work', 'Search the Lexicon', 'Search public forum', 'id="clear-trail"'):
            self.assertIn(marker, page)
        js = (ROOT / 'classic/assets/js/site.js').read_text(encoding='utf-8')
        self.assertIn('idp_atlas_read_v1', js)
        self.assertIn('data-continuity-atlas', js)
        self.assertNotIn('fetch(', (ATLAS / 'atlas.js').read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
