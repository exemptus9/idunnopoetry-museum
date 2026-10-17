"""Run the dependency-free public model tests in the publication test suite."""
from pathlib import Path
import json
import subprocess
import unittest
import build_lexical_publication as publication

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'museum-static/observatory'


class LexicalFrontendTests(unittest.TestCase):
    def test_public_modules_parse(self):
        for source in ('config.js', 'model.js', 'app.js', 'review.js', 'public-request.js', 'blend-engine.js', 'laboratory.js'):
            result = subprocess.run(['node', '--check', str(SITE / source)], capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_model_behaviors(self):
        result = subprocess.run(['node', '--test', str(ROOT / 'scripts/test_lexical_model.mjs')], capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_bulk_review_behaviors(self):
        result = subprocess.run(['node', '--test', str(ROOT / 'scripts/test_lexical_review.mjs')], capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_blend_engine_behaviors(self):
        result = subprocess.run(['node', '--test', str(ROOT / 'scripts/test_lexical_blends.mjs')], capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_laboratory_dom_behaviors(self):
        result = subprocess.run(['node', str(ROOT / 'scripts/test_lexical_lab_dom.mjs')], capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_publication_output_is_consumed_without_losing_relations_or_canon(self):
        def term(identity, stage='forge'):
            return {'id': identity, 'slug': identity, 'headword': identity,
                    'definition': 'Synthetic fixture only', 'stage': stage,
                    'visibility': 'approved_public', 'revision': 2,
                    'publication': {'approvedRevision': 2, 'approvedAt': '2026-10-16T20:00:00Z'},
                    'canonApproval': {'revision': 2, 'approvedAt': '2026-10-16T20:00:00Z'}}
        projected = publication.project({'terms': [term('test-first', 'canon'), term('test-second')],
            'relations': [{'source': 'test-first', 'target': 'test-second', 'type': 'semantic_relative',
                           'status': 'confirmed', 'visibility': 'approved_public'}],
            'versions': [{'termId': 'test-first', 'version': 1, 'definition': 'Earlier synthetic wording',
                          'date': '2026-10-15', 'visibility': 'approved_public'}]})
        code = "import {normalizeCatalog} from " + json.dumps((SITE / 'model.js').as_uri()) + ";\n"
        code += "let data=''; for await (const c of process.stdin) data+=c; const r=normalizeCatalog(JSON.parse(data));\n"
        code += "if(r.terms.length!==2 || r.terms[0].stage!=='canon' || r.relations.length!==1 || r.versions.length!==1) throw Error(JSON.stringify(r));"
        result = subprocess.run(['node', '--input-type=module', '-e', code], input=json.dumps(projected), capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_release_projection_is_an_exact_allowlisted_approved_snapshot(self):
        payload = json.loads((SITE / 'public.json').read_text())
        self.assertEqual(publication.project(payload), {key: payload[key] for key in ('schemaVersion', 'terms', 'relations', 'versions')})
        source = (SITE / 'app.js').read_text()
        self.assertNotIn('LEXICAL_SEED', source)
        self.assertNotIn('localStorage', source)


if __name__ == '__main__':
    unittest.main()
