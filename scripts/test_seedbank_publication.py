"""Conservative privacy gates for the public Seed Bank publishing bridge."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from import_approved_seeds import normalize_packet, apply_records, read_public

def sample():
    text = "A small beginning\nBecoming something."
    return {
        "format": "IDPSeedPublicApproval/1",
        "permission": "explicit_public_approval",
        "snapshotId": "test-snapshot",
        "items": [{
            "id": "curated-family-test-12345",
            "title": "Small beginning",
            "text": text, "status": "seed", "provenance": "brandon",
            "confidence": "confirmed", "versionId": "text-test-001",
            "contentSha256": hashlib.sha256(text.encode()).hexdigest(),
            "approvedAt": datetime.now(timezone.utc).isoformat(),
            "explicitPublicApproval": True,
        }],
    }

class SeedBankPublicationTests(unittest.TestCase):
    def test_approved_packet_only(self):
        records = normalize_packet(sample())
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["text"], "A small beginning\nBecoming something.")
        self.assertEqual(set(records[0]), {"id","title","text","status",
                         "provenance","confidence","source","notes"})
        self.assertNotIn("versionId", records[0])

    def test_requires_explicit_individual_permission(self):
        payload = sample()
        payload["items"][0]["explicitPublicApproval"] = False
        with self.assertRaises(ValueError):
            normalize_packet(payload)

    def test_excludes_unverified_authorship(self):
        payload = sample()
        payload["items"][0]["provenance"] = "uncertain"
        with self.assertRaises(ValueError):
            normalize_packet(payload)

    def test_rejects_modified_witness(self):
        payload = sample()
        payload["items"][0]["text"] = "modified after approval"
        with self.assertRaises(ValueError):
            normalize_packet(payload)

    def test_rejects_private_notes_and_paths(self):
        payload = sample()
        payload["items"][0]["privateNotebook"] = "not for publication"
        with self.assertRaises(ValueError):
            normalize_packet(payload)

    def test_rejects_email_address(self):
        payload = sample()
        payload["items"][0]["text"] = "my contact: alice@example.com"
        payload["items"][0]["contentSha256"] = hashlib.sha256(payload["items"][0]["text"].encode()).hexdigest()
        with self.assertRaises(ValueError):
            normalize_packet(payload)

    def test_does_not_replace_published_text_without_opt_in(self):
        first = normalize_packet(sample())
        existing = apply_records(first, {"schemaVersion":1,"records":[]})
        alternate = [dict(first[0], text="new unapproved revision")]
        with self.assertRaises(ValueError):
            apply_records(alternate, existing)
        self.assertEqual(apply_records(first, existing)["records"], first)

    def test_public_site_has_no_private_vault_payload(self):
        public = read_public()
        self.assertEqual(public["schemaVersion"], 1)
        self.assertTrue(isinstance(public["records"], list))
        self.assertFalse((ROOT / "museum-static" / "IDP_Seedbank_PRIVATE_2026-09-26_v5.json").exists())
        data = (ROOT / "museum-static" / "data" / "seedbank-approved.js").read_text()
        self.assertNotIn("sourceDocuments", data)
        self.assertNotIn("originalUnfilteredNotebookIncluded", data)
        self.assertIn('src="data/seedbank-approved.js"', (ROOT / "museum-static" / "index.html").read_text())
        self.assertIn('href="#seeds">Seed Bank</a>', (ROOT / "museum-static" / "index.html").read_text())

if __name__ == "__main__":
    unittest.main()
