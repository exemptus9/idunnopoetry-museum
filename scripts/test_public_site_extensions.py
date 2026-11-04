"""Public site extensions require explicit evidence and preserve project identity."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('compendium_renderer',ROOT/'scripts/reconcile_public_compendium.py')
renderer=importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)
CONFIG=json.loads((ROOT/'museum-static/projects/updates.json').read_text())

class PublicSiteExtensionTests(unittest.TestCase):
    def test_existing_identity_promoted_without_duplication(self):
        sites=CONFIG['publishedProjects']
        self.assertEqual(len(sites),1)
        self.assertEqual(sites[0]['id'],'project-sacred-interval')
        self.assertNotIn(sites[0]['id'],{c['id'] for c in CONFIG['concepts']})
        card=renderer.public_site_card(sites[0],CONFIG['publicSiteAllowlist'])
        record=renderer.inspect(card)
        self.assertEqual(record['id'],'project-sacred-interval')
        self.assertEqual(record['stage'],'live')
        self.assertEqual(record['phase'],'website')
        self.assertEqual(record['links'][0]['href'],sites[0]['url'])
        self.assertIn('institutional status',record['description'])
    def test_unreviewed_or_private_endpoints_rejected(self):
        for url in ('javascript:alert(1)','https://example.com/','https://brandon-mirror-private.idunnopoetry.chatgpt.site/','https://sacred-interval.idunnopoetry.chatgpt.site/\n'):
            item=copy.deepcopy(CONFIG['publishedProjects'][0]);item['url']=url
            with self.subTest(url=url), self.assertRaises(ValueError):
                renderer.public_site_card(item,CONFIG['publicSiteAllowlist'])
    def test_missing_evidence_is_rejected(self):
        item=copy.deepcopy(CONFIG['publishedProjects'][0]);item.pop('date')
        with self.assertRaises(ValueError):
            renderer.public_site_card(item,CONFIG['publicSiteAllowlist'])
    def test_copy_receipt_does_not_claim_unperformed_mobile_qa(self):
        text=CONFIG['updates']['project-rhymemosaic']['description']
        for marker in ('Copy + link','TXT','v44','Mobile visual acceptance remains separate'):
            self.assertIn(marker,text)

if __name__=='__main__':unittest.main()
