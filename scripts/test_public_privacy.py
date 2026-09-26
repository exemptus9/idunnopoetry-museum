"""Fail publication when private review data or unapproved creative text is added."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class PublicPrivacyTests(unittest.TestCase):
    def test_both_public_copies_exclude_private_source_material(self):
        allowed = json.loads((ROOT / 'scripts/public-creative-allowlist.json').read_text())
        copies = []
        for directory in ('museum-static', 'public'):
            text = (ROOT / directory / 'data/creative-meta.js').read_text()
            data = json.loads(text.split('=', 1)[1].strip().removesuffix(';'))
            copies.append(data)
            for key in ('archiveDocuments', 'verificationCandidates', 'reviewQueue', 'sourceRules'):
                self.assertFalse(data[key], f'Private {key} in {directory}')
            for key in ('seeds', 'supplementalWorks'):
                actual = {row['id']: hashlib.sha256(row.get('text', '').encode()).hexdigest()
                          for row in data[key]}
                self.assertEqual(actual, allowed[key], f'Unreviewed {key} text in {directory}')
        self.assertEqual(copies[0], copies[1], 'Alternate host has stale personal data')


if __name__ == '__main__':
    unittest.main()
