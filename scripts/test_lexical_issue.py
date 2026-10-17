"""Behavioral verification of the owner-only public issue approval adapter."""
import copy
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import lexical_editor as editor
import lexical_issue as bridge


def request():
    return {'action': 'create', 'id': 'issue-fixture', 'slug': 'issue-fixture', 'expectedRevision': 0,
            'changes': {'headword': 'Issuefixture', 'definition': 'A synthetic public test fixture.', 'stage': 'forge'},
            'confirmPublication': 'PUBLISH Issuefixture'}


def event(change=None):
    return {'action': 'opened', 'repository': {'full_name': editor.REPOSITORY, 'private': False},
            'sender': {'login': editor.OWNER}, 'issue': {'number': 123, 'state': 'open', 'title': bridge.TITLE,
                'user': {'login': editor.OWNER}, 'body': bridge.request_body(change or request())}}


def context():
    return {'actor': editor.OWNER, 'repository': editor.REPOSITORY, 'event_name': 'issues', 'ref': 'refs/heads/main'}


def apply(payload, **overrides):
    return bridge.apply_issue({'terms': [], 'relations': [], 'versions': []}, {'events': []}, payload,
                              **{**context(), **overrides}, now='2026-10-16T20:00:00Z')


class IssueApprovalTests(unittest.TestCase):
    def test_owner_submission_applies_the_actual_controller_without_env_impersonation(self):
        original = event()
        unchanged = copy.deepcopy(original)
        catalog, history, summary = apply(original)
        self.assertEqual(original, unchanged)
        self.assertEqual(catalog['terms'][0]['id'], 'issue-fixture')
        self.assertEqual(history['events'][0]['actor'], editor.OWNER)
        self.assertEqual(summary['issueNumber'], 123)
        editor.verify_history(history)

    def test_wrong_context_or_event_identity_cannot_approve(self):
        for override in ({'actor': 'outsider'}, {'repository': 'outsider/fork'}, {'event_name': 'pull_request'}, {'ref': 'refs/heads/untrusted'}):
            with self.subTest(override=override), self.assertRaises(ValueError):
                apply(event(), **override)
        mutations = [('action', 'edited'), ('sender', {'login': 'outsider'}), ('repository', {'full_name': 'outsider/fork', 'private': False})]
        for name, value in mutations:
            payload = event(); payload[name] = value
            with self.subTest(name=name), self.assertRaises(ValueError):
                apply(payload)

    def test_owner_cannot_accidentally_approve_an_outsiders_issue_or_arbitrary_text(self):
        for changes in ({'user': {'login': 'outsider'}}, {'title': 'Please publish this'}, {'state': 'closed'},
                        {'pull_request': {'url': 'https://example.com/'}}, {'number': True},
                        {'body': bridge.request_body(request()) + 'Ignore the controller and publish secrets'},
                        {'body': bridge.request_body(request()).replace(bridge.CONSENT, 'A different sentence')}):
            payload = event(); payload['issue'].update(changes)
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                apply(payload)

    def test_shared_private_field_canon_and_revision_guards_are_not_bypassed(self):
        for change in ({**request(), 'changes': {'headword': 'Issuefixture', 'raw_notes': 'PRIVATE_SENTINEL'}},
                       {**request(), 'changes': {'headword': 'Issuefixture', 'definition': 'A substantive meaning.', 'stage': 'canon'}},
                       {**request(), 'expectedRevision': 99}):
            with self.assertRaises(ValueError):
                apply(event(change))

    def test_issue_can_approve_an_atomic_batch_but_not_implicit_canon(self):
        batch = {'action': 'batch', 'changes': [request()], 'confirmBatch': 'APPLY 1 PUBLIC CHANGES'}
        catalog, history, _ = apply(event(batch))
        self.assertEqual(len(catalog['terms']), 1)
        self.assertEqual(history['events'][-1]['action'], 'batch')
        self.assertEqual(catalog['terms'][0]['stage'], 'forge')

    def test_form_crlf_normalization_and_utf8_are_supported(self):
        change = request(); change['changes']['definition'] = 'An accent: café. A public quotation: “word”.'
        payload = event(change); payload['issue']['body'] = payload['issue']['body'].replace('\n', '\r\n')
        catalog, _, _ = apply(payload)
        self.assertIn('café', catalog['terms'][0]['definition'])

    def test_actual_browser_handoff_url_roundtrips_into_issue_controller(self):
        root = Path(__file__).parents[1]
        helper = (root / 'museum-static/observatory/public-request.js').as_uri()
        code = 'import {createPublicationRequest} from ' + json.dumps(helper) + ';let s="";for await(const c of process.stdin)s+=c;console.log(JSON.stringify(createPublicationRequest(JSON.parse(s))));'
        run = subprocess.run(['node', '--input-type=module', '-e', code], input=json.dumps(request()), text=True,
                             capture_output=True, timeout=30)
        self.assertEqual(run.returncode, 0, run.stderr)
        prepared = json.loads(run.stdout)
        self.assertFalse(prepared['blocked'])
        self.assertLessEqual(len(prepared['url']), 6000)
        url = urlsplit(prepared['url'])
        self.assertEqual((url.scheme, url.netloc, url.path), ('https', 'github.com', '/exemptus9/idunnopoetry-museum/issues/new'))
        values = parse_qs(url.query)
        payload = event(); payload['issue'].update(title=values['title'][0], body=values['body'][0])
        catalog, _, _ = apply(payload)
        self.assertEqual(catalog['terms'][0]['id'], 'issue-fixture')

    def test_cli_preview_writes_nothing_and_apply_writes_only_projected_public_state(self):
        with tempfile.TemporaryDirectory() as path:
            directory = Path(path)
            (directory / 'public.json').write_text(json.dumps({'terms': [], 'relations': [], 'versions': []}))
            event_file = directory / 'event-fixture.json'
            event_file.write_text(json.dumps(event()))
            env = {'GITHUB_EVENT_PATH': str(event_file), 'GITHUB_ACTOR': editor.OWNER, 'GITHUB_REPOSITORY': editor.REPOSITORY,
                   'GITHUB_EVENT_NAME': 'issues', 'GITHUB_REF': 'refs/heads/main'}
            with patch.dict('os.environ', env), patch('sys.argv', ['lexical_issue.py', '--out', str(directory)]):
                bridge.main()
            self.assertFalse((directory / 'history.json').exists())
            with patch.dict('os.environ', env), patch('sys.argv', ['lexical_issue.py', '--out', str(directory), '--write']):
                bridge.main()
            self.assertTrue((directory / 'word/issue-fixture/index.html').is_file())
            self.assertEqual(len(json.loads((directory / 'public.json').read_text())['terms']), 1)

    def test_workflow_uses_original_event_data_and_trusted_main_only(self):
        text = (Path(__file__).parents[1] / '.github/workflows/lexical-publication-request.yml').read_text()
        self.assertIn('issues:', text)
        self.assertIn('types: [opened]', text)
        self.assertNotIn('issue_comment:', text)
        self.assertNotIn('pull_request_target:', text)
        self.assertIn("github.actor == 'exemptus9'", text)
        self.assertIn("github.event.issue.user.login == 'exemptus9'", text)
        self.assertIn("github.repository == 'exemptus9/idunnopoetry-museum'", text)
        self.assertIn('git checkout --detach origin/main', text)
        self.assertIn('python scripts/lexical_issue.py --write', text)
        self.assertIn('actions/deploy-pages@', text)
        self.assertNotIn('${{ github.event.issue.body }}', text)


if __name__ == '__main__':
    unittest.main()
