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
        expected = {
            'project-sacred-interval': 'https://sacred-interval.idunnopoetry.chatgpt.site/',
            'project-porchbraid': 'https://goodfolk-social.idunnopoetry.chatgpt.site/',
            'project-traffic-with-intent': 'https://night-freight-underworld.idunnopoetry.chatgpt.site/',
        }
        self.assertEqual(len(sites), len(expected))
        self.assertEqual({item['id']: item['url'] for item in sites}, expected)
        self.assertEqual(set(CONFIG['publicSiteAllowlist']), set(expected.values()))
        concept_ids = {item['id'] for item in CONFIG['concepts']}
        self.assertTrue(concept_ids.isdisjoint(expected))
        for item in sites:
            with self.subTest(project=item['id']):
                card = renderer.public_site_card(item, CONFIG['publicSiteAllowlist'])
                record = renderer.inspect(card)
                self.assertEqual(record['id'], item['id'])
                self.assertEqual(record['stage'], 'live')
                self.assertEqual(record['phase'], 'website')
                self.assertEqual(record['links'][0]['href'], expected[item['id']])
                if item['id'] == 'project-sacred-interval':
                    self.assertIn('institutional status', record['description'])
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
