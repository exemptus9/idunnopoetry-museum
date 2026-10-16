"""Owner console behavior, using public synthetic fixtures only."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import lexical_editor as editor


def empty():
    return {"terms": [], "relations": [], "versions": []}, {"schemaVersion": 1, "events": []}


def creation(**extra):
    return {"action": "create", "id": "fixture-id", "slug": "fixture-word", "expectedRevision": 0,
            "changes": {"headword": "Fixtureword", "definition": "An invented public test fixture.", "stage": "forge"},
            "confirmPublication": "PUBLISH Fixtureword", **extra}


def apply(catalog, history, change, **overrides):
    context = {"actor": editor.OWNER, "repository": editor.REPOSITORY, "now": "2026-10-16T20:00:00Z", **overrides}
    return editor.apply_change(catalog, history, change, **context)


class EditorTests(unittest.TestCase):
    def test_owner_repo_event_and_ref_are_all_enforced(self):
        for context in ({"actor": "someone"}, {"repository": "someone/fork"}, {"event": "pull_request"}, {"ref": "refs/heads/untrusted"}):
            with self.subTest(context=context), self.assertRaises(ValueError):
                apply(*empty(), creation(), **context)

    def test_create_projects_public_fields_and_preserves_inputs(self):
        catalog, history = empty()
        original = copy.deepcopy((catalog, history))
        result, ledger = apply(catalog, history, creation())
        self.assertEqual((catalog, history), original)
        self.assertEqual(result["terms"][0]["revision"], 1)
        self.assertEqual(result["terms"][0]["stage"], "forge")
        self.assertEqual(ledger["events"][0]["approvalMethod"], "owner_action")
        editor.verify_history(ledger)

    def test_private_fields_unknown_fields_and_nested_source_bodies_are_rejected(self):
        requests = [creation(secret="PRIVATE_SENTINEL"), creation(changes={"headword": "Fixtureword", "raw_notes": "PRIVATE_SENTINEL"}),
                    creation(changes={"headword": "Fixtureword", "witnesses": [{"visibility": "approved_public", "body": "PRIVATE_SENTINEL"}]}),
                    creation(changes={"headword": "Fixtureword", "witnesses": [{"visibility": "private", "publicSummary": "PRIVATE_SENTINEL"}]})]
        for change in requests:
            with self.subTest(change=change), self.assertRaises(ValueError):
                apply(*empty(), change)

    def test_publication_requires_exact_headword_confirmation(self):
        for confirmation in (None, "PUBLISH another"):
            with self.assertRaises(ValueError):
                apply(*empty(), creation(confirmPublication=confirmation))

    def test_no_automatic_canon_and_every_new_canon_revision_requires_author(self):
        request = creation(changes={"headword": "Fixtureword", "definition": "A fixture.", "stage": "canon"})
        for confirmation in (None, "approved", "APPROVE CANON fixtureword"):
            with self.assertRaises(ValueError):
                apply(*empty(), {**request, "canonConfirmation": confirmation})
        catalog, ledger = apply(*empty(), {**request, "canonConfirmation": "APPROVE CANON Fixtureword"})
        self.assertEqual(catalog["terms"][0]["canonApproval"]["revision"], 1)
        with self.assertRaises(ValueError):
            apply(catalog, ledger, {"action": "update", "id": "fixture-id", "expectedRevision": 1,
                                   "changes": {"formation": "blending"}, "confirmPublication": "PUBLISH Fixtureword"})

    def test_stale_revision_rejected_and_update_retains_identity_slug(self):
        catalog, ledger = apply(*empty(), creation())
        edit = {"action": "update", "id": "fixture-id", "expectedRevision": 1,
                "changes": {"definition": "A revised public fixture."}, "confirmPublication": "PUBLISH Fixtureword"}
        updated, history = apply(catalog, ledger, edit)
        self.assertEqual(updated["terms"][0]["revision"], 2)
        self.assertEqual(updated["terms"][0]["slug"], "fixture-word")
        self.assertEqual(len(updated["versions"]), 2)
        with self.assertRaises(ValueError):
            apply(updated, history, edit)
        with self.assertRaises(ValueError):
            apply(catalog, ledger, {**edit, "slug": "renamed"})

    def test_duplicates_do_not_overwrite_and_punctuation_headwords_fail(self):
        catalog, ledger = apply(*empty(), creation())
        for request in (creation(id="other", slug="other"), creation(id="other", slug="fixture-word", changes={"headword": "Another"}),
                        creation(id="other", slug="other", changes={"headword": "!!!"})):
            with self.subTest(request=request), self.assertRaises(ValueError):
                apply(catalog, ledger, request)

    def test_withdraw_removes_current_pages_restore_creates_revision(self):
        catalog, ledger = apply(*empty(), creation())
        withdrawn, ledger = apply(catalog, ledger, {"action": "withdraw", "id": "fixture-id", "expectedRevision": 1})
        self.assertEqual(withdrawn["terms"], [])
        self.assertEqual(withdrawn["versions"], [])
        self.assertEqual(ledger["events"][-1]["revision"], 2)
        self.assertIsNone(ledger["events"][-1]["snapshot"])
        restored, ledger = apply(withdrawn, ledger, {"action": "restore", "id": "fixture-id", "expectedRevision": 2,
                                                   "restoreRevision": 1, "confirmPublication": "PUBLISH Fixtureword"})
        self.assertEqual(restored["terms"][0]["revision"], 3)
        self.assertEqual(restored["terms"][0]["definition"], catalog["terms"][0]["definition"])
        self.assertEqual([v["version"] for v in restored["versions"]], [1, 2])
        editor.verify_history(ledger)

    def test_legacy_public_baseline_is_recorded_without_invented_history(self):
        catalog, _ = apply(*empty(), creation())
        changed, ledger = apply(catalog, empty()[1], {"action": "withdraw", "id": "fixture-id", "expectedRevision": 1})
        self.assertEqual([e["action"] for e in ledger["events"]], ["baseline", "withdraw"])
        self.assertEqual(ledger["events"][0]["snapshot"]["definition"], catalog["terms"][0]["definition"])

    def test_definition_versions_are_independent_and_survive_withdrawal_and_restore(self):
        catalog, _ = apply(*empty(), creation())
        catalog["versions"] = [
            {"termId": "fixture-id", "version": 1, "visibility": "approved_public", "definition": "Undated legacy wording.", "date": "", "note": "Original undated public witness"},
            {"termId": "fixture-id", "version": 2, "visibility": "approved_public", "definition": "An invented public test fixture.", "date": "2026-10-16", "note": "Current working wording"},
        ]
        edited, ledger = apply(catalog, empty()[1], {"action": "update", "id": "fixture-id", "expectedRevision": 1,
                                                    "changes": {"definition": "Edited public wording."}, "confirmPublication": "PUBLISH Fixtureword"})
        self.assertEqual(edited["terms"][0]["revision"], 2)
        self.assertEqual([v["version"] for v in edited["versions"]], [1, 2, 3])
        withdrawn, ledger = apply(edited, ledger, {"action": "withdraw", "id": "fixture-id", "expectedRevision": 2})
        self.assertEqual([v["version"] for v in ledger["events"][-1]["definitionVersions"]], [1, 2, 3])
        self.assertEqual(withdrawn["versions"], [])
        restored, ledger = apply(withdrawn, ledger, {"action": "restore", "id": "fixture-id", "expectedRevision": 3,
                                                   "restoreRevision": 1, "confirmPublication": "PUBLISH Fixtureword"})
        self.assertEqual(restored["terms"][0]["revision"], 4)
        self.assertEqual([v["version"] for v in restored["versions"]], [1, 2, 3, 4])
        self.assertEqual(restored["versions"][0]["date"], "")
        self.assertEqual(restored["versions"][0]["definition"], "Undated legacy wording.")
        self.assertEqual(restored["versions"][2]["definition"], "Edited public wording.")
        editor.verify_history(ledger)

    def test_delegated_seed_audit_has_distinct_actor_and_approval_method(self):
        catalog, _ = apply(*empty(), creation())
        history = empty()[1]
        term = catalog["terms"][0]
        editor.append_event(history, "assistant_editor", "initial_delegated_release", term["id"], term["slug"], term["revision"],
                            "2026-10-16T20:00:00Z", snapshot=term, definition_versions=catalog["versions"],
                            approval_method="author_delegated_editorial_review")
        self.assertEqual(history["events"][0]["actor"], "assistant_editor")
        self.assertEqual(history["events"][0]["approvalMethod"], "author_delegated_editorial_review")
        self.assertEqual(len(history["events"][0]["definitionVersions"]), 1)
        editor.verify_history(history)

    def test_lexicon_and_canon_refuse_unfinished_or_placeholder_definitions(self):
        for stage in ("lexicon", "canon"):
            for definition, status in (("", "working_definition"), ("Definition pending author review.", "working_definition"),
                                       ("A plausible definition.", "awaiting_definition"), ("TBD", "author_supplied")):
                with self.subTest(stage=stage, definition=definition), self.assertRaises(ValueError):
                    apply(*empty(), creation(changes={"headword": "Fixtureword", "stage": stage, "definition": definition, "definitionStatus": status},
                                             canonConfirmation="APPROVE CANON Fixtureword"))
        catalog, _ = apply(*empty(), creation(changes={"headword": "Fixtureword", "stage": "lexicon", "definition": "A completed public definition.",
                                                       "definitionStatus": "working_definition"}))
        self.assertEqual(catalog["terms"][0]["stage"], "lexicon")

    def test_reserved_slug_and_id_cannot_be_reused_after_withdrawal(self):
        catalog, ledger = apply(*empty(), creation())
        withdrawn, ledger = apply(catalog, ledger, {"action": "withdraw", "id": "fixture-id", "expectedRevision": 1})
        for change in (creation(), creation(id="different")):
            with self.assertRaises(ValueError):
                apply(withdrawn, ledger, change)

    def test_history_tampering_detected(self):
        _, ledger = apply(*empty(), creation())
        ledger["events"][0]["snapshot"]["definition"] = "Altered public text"
        with self.assertRaises(ValueError):
            editor.verify_history(ledger)

    def test_invalid_evidence_dates_and_url_credentials_rejected(self):
        for changes in ({"headword": "Fixtureword", "evidenceStrength": "certain"}, {"headword": "Fixtureword", "earliestVerifiedDate": "2026-99-99"},
                        {"headword": "Fixtureword", "witnesses": [{"visibility": "approved_public", "url": "https://user:password@example.com/"}]}):
            with self.assertRaises(ValueError):
                apply(*empty(), creation(changes=changes))

    def test_ai_proposals_stay_labeled_can_be_rejected_and_private_shape_is_denied(self):
        change = creation(changes={"headword": "Fixtureword", "classification": "coinage_candidate", "definitionStatus": "awaiting_definition",
                                   "tags": ["fixture"], "collections": ["Public tests"], "editorialReview": {"shortReason": "Public test review"},
                                   "analysis": {"kind": "ai_hypothesis", "interpretationProposal": "A possible public reading", "limitations": "Unverified"}})
        catalog, ledger = apply(*empty(), change)
        self.assertEqual(catalog["terms"][0]["analysis"]["kind"], "ai_hypothesis")
        rejected, ledger = apply(catalog, ledger, {"action": "update", "id": "fixture-id", "expectedRevision": 1,
                                                  "changes": {"analysis": None}, "confirmPublication": "PUBLISH Fixtureword"})
        self.assertIsNone(rejected["terms"][0]["analysis"])
        self.assertEqual(ledger["events"][0]["snapshot"]["analysis"]["kind"], "ai_hypothesis")
        for changes in ({"analysis": {"kind": "ai_hypothesis", "raw_notes": "PRIVATE_SENTINEL"}},
                        {"editorialReview": {"shortReason": "public", "privateReason": "PRIVATE_SENTINEL"}}):
            with self.assertRaises(ValueError):
                apply(*empty(), creation(changes={"headword": "Fixtureword", **changes}))

    def test_relationship_review_is_revisioned_inferred_or_confirmed_and_rejectable(self):
        catalog, ledger = apply(*empty(), creation())
        catalog, ledger = apply(catalog, ledger, creation(id="second-id", slug="second-word", changes={"headword": "Secondword"}, confirmPublication="PUBLISH Secondword"))
        request = {"action": "relation_review", "expectedRevision": 0,
                   "relation": {"source": "fixture-id", "target": "second-id", "type": "shared_context", "status": "inferred", "publicExplanation": "An explicitly tentative public connection"}}
        catalog, ledger = apply(catalog, ledger, request)
        self.assertEqual(catalog["relations"][0]["status"], "inferred")
        with self.assertRaises(ValueError):
            apply(catalog, ledger, request)
        rejected, ledger = apply(catalog, ledger, {**request, "expectedRevision": 1, "relation": {**request["relation"], "status": "rejected"}})
        self.assertEqual(rejected["relations"], [])
        self.assertEqual(ledger["events"][-1]["termId"], "__relations__")

    def test_workflow_is_dispatch_only_owner_guarded_and_never_shell_interpolates_input(self):
        text = (Path(__file__).parents[1] / ".github/workflows/lexical-editor.yml").read_text()
        self.assertIn("workflow_dispatch:", text)
        self.assertNotIn("pull_request:", text)
        self.assertNotIn("pull_request_target:", text)
        self.assertIn("github.actor == 'exemptus9'", text)
        self.assertIn("github.repository == 'exemptus9/idunnopoetry-museum'", text)
        self.assertIn("github.ref == 'refs/heads/main'", text)
        self.assertIn("actions/deploy-pages@", text)
        self.assertIn("os.environ[\"LEXICAL_CHANGE_JSON\"]", text)
        self.assertNotIn("${{ inputs.change_json }}\n          python", text)

    def test_cli_preview_writes_nothing_and_apply_generates_pages_and_ledger(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            catalog_path = directory / "public.json"
            catalog_path.write_text(json.dumps(empty()[0]))
            change = directory.parent / (directory.name + "-request.json")
            change.write_text(json.dumps(creation()))
            try:
                context = {"GITHUB_ACTOR": editor.OWNER, "GITHUB_REPOSITORY": editor.REPOSITORY,
                           "GITHUB_EVENT_NAME": "workflow_dispatch", "GITHUB_REF": "refs/heads/main"}
                with patch.dict("os.environ", context), patch("sys.argv", ["lexical_editor.py", "--change", str(change), "--out", str(directory)]):
                    editor.main()
                self.assertFalse((directory / "history.json").exists())
                self.assertEqual(json.loads(catalog_path.read_text())["terms"], [])
                with patch.dict("os.environ", context), patch("sys.argv", ["lexical_editor.py", "--change", str(change), "--out", str(directory), "--write"]):
                    editor.main()
                self.assertTrue((directory / "word/fixture-word/index.html").is_file())
                self.assertTrue((directory / "history.json").is_file())
                self.assertEqual(len(json.loads(catalog_path.read_text())["terms"]), 1)
            finally:
                change.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
