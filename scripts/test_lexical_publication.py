"""Behavioral checks for publication boundaries, permalinks and withdrawals."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
import build_lexical_publication as publication


def example():
    # Synthetic fixture, deliberately unrelated to the author's private corpus.
    return {"id": "test-1", "slug": "sample-word", "headword": "Sample <word>",
            "definition": "Synthetic test definition", "revision": 2, "stage": "lexicon",
            "visibility": "approved_public", "earliestVerifiedDate": None,
            "publication": {"approvedRevision": 2, "approvedAt": "2026-10-16T20:00:00Z"}}


class LexicalPublicationTests(unittest.TestCase):
    def test_private_and_stale_approval_records_never_enter_output(self):
        private = {**example(), "id": "private", "slug": "private", "visibility": "private", "definition": "PRIVATE_SENTINEL"}
        stale = {**example(), "id": "stale", "slug": "stale", "revision": 3, "definition": "STALE_SENTINEL"}
        result = publication.project({"terms": [private, stale, example()]})
        self.assertEqual(len(result["terms"]), 1)
        self.assertNotIn("SENTINEL", json.dumps(result))

    def test_only_whitelisted_public_fields_are_exported(self):
        term = {**example(), "raw_notes": "SECRET_RAW", "legacyRecord": {"text": "SECRET_LEGACY"},
                "sources": [{"body": "SECRET_SOURCE"}], "sourceDate": "invented-date"}
        result = publication.project({"terms": [term], "versions": [], "relations": []})
        serialized = json.dumps(result)
        self.assertNotIn("SECRET_", serialized)
        self.assertIsNone(result["terms"][0]["earliestVerifiedDate"])

    def test_witnesses_need_separate_approval_and_never_export_private_bodies(self):
        row = {**example(), 'witnesses': [
            {'visibility': 'private', 'approvedExcerpt': 'PRIVATE_WITNESS'},
            {'visibility': 'approved_public', 'label': 'Public source summary', 'approvedExcerpt': 'Approved words',
             'body': 'SECRET_BODY', 'url': 'https://name:password@example.com/'}]}
        result = publication.project({'terms': [row]})
        witness = result['terms'][0]['witnesses'][0]
        self.assertEqual(witness['approvedExcerpt'], 'Approved words')
        self.assertEqual(witness['url'], '')
        self.assertNotIn('PRIVATE_WITNESS', json.dumps(result))
        self.assertNotIn('SECRET_BODY', json.dumps(result))

    def test_canon_requires_separate_exact_revision_decision(self):
        row = {**example(), "stage": "canon"}
        with self.assertRaises(ValueError):
            publication.project({"terms": [row]})
        row["canonApproval"] = {"revision": 2, "approvedAt": "2026-10-16T20:00:00Z"}
        self.assertEqual(publication.project({"terms": [row]})["terms"][0]["stage"], "canon")

    def test_private_relationship_targets_and_versions_are_excluded(self):
        result = publication.project({"terms": [example()], "relations": [
            {"source": "test-1", "target": "private-id", "visibility": "approved_public", "status": "confirmed", "publicExplanation": "SECRET"}],
            "versions": [{"termId": "test-1", "visibility": "private", "definition": "SECRET"}]})
        self.assertEqual(result["relations"], [])
        self.assertEqual(result["versions"], [])

    def test_duplicate_and_unsafe_slugs_fail(self):
        with self.assertRaises(ValueError):
            publication.project({"terms": [example(), copy.deepcopy(example())]})
        with self.assertRaises(ValueError):
            publication.project({"terms": [{**example(), "slug": "../../escape"}]})

    def test_no_implicit_public_approval_or_fabricated_date(self):
        row = example()
        del row["publication"]
        self.assertEqual(publication.project({"terms": [row]})["terms"], [])
        self.assertIn("Not established", publication.page(example() | {
            "formation": "", "roots": [], "evidenceStrength": "unknown", "authorship": "", "provenanceSummary": ""}, "https://example.com/"))

    def test_dry_run_writes_nothing_and_withdrawal_removes_page(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / "observatory"
            publication.build({"terms": [example()]}, out, "https://example.com/observatory/")
            self.assertFalse(out.exists())
            publication.build({"terms": [example()]}, out, "https://example.com/observatory/", True)
            page = out / "word/sample-word/index.html"
            self.assertTrue(page.is_file())
            rendered = page.read_text()
            self.assertIn("Sample &lt;word&gt;", rendered)
            self.assertIn('rel="canonical"', rendered)
            self.assertIn("https://schema.org", rendered)
            publication.build({"terms": []}, out, "https://example.com/observatory/", True)
            self.assertFalse(page.exists())
            self.assertNotIn("sample-word", (out / "sitemap.xml").read_text())


if __name__ == "__main__":
    unittest.main()
