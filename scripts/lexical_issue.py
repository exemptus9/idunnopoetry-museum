#!/usr/bin/env python3
"""Validate an owner's explicit PUBLIC GitHub issue approval and apply its data.

The original issues/opened event is checked before the existing shared owner
controller is called. No event-name environment variables are rewritten and no
browser token is collected. An issue is public; never submit confidential text.
"""
import argparse
import json
import os
from pathlib import Path

import lexical_editor as editor

TITLE = "Lexical Observatory: approved public change"
MARKER = "<!-- lexical-observatory-public-change:v1 -->"
CONSENT = "I approve publication of the following public lexical change. All included content is intended to be public and retained in history."
PREFIX = MARKER + "\n" + CONSENT + "\n\n```json\n"
SUFFIX = "\n```\n"


def request_body(request):
    """Canonical prefilled issue body, also used by handoff contract tests."""
    return PREFIX + json.dumps(request, ensure_ascii=False, indent=2) + SUFFIX


def validated_request(payload, *, actor, repository, event_name, ref):
    if event_name != 'issues' or actor != editor.OWNER or repository != editor.REPOSITORY or ref != 'refs/heads/main':
        raise ValueError('Only an owner-opened issue in the authoritative main-branch repository can approve publication')
    if not isinstance(payload, dict) or payload.get('action') != 'opened':
        raise ValueError('Only the original issue opening is an approval event')
    repo, sender, issue = payload.get('repository'), payload.get('sender'), payload.get('issue')
    if not isinstance(repo, dict) or repo.get('full_name') != editor.REPOSITORY or repo.get('private') is not False:
        raise ValueError('The original event must identify the authoritative public repository')
    if not isinstance(sender, dict) or sender.get('login') != editor.OWNER or not isinstance(issue, dict):
        raise ValueError('The original event sender must be the repository owner')
    if not isinstance(issue.get('user'), dict) or issue['user'].get('login') != editor.OWNER:
        raise ValueError('The issue author must be the repository owner; a maintainer action on another author’s issue is insufficient')
    if issue.get('pull_request') is not None or issue.get('state') != 'open' or issue.get('title') != TITLE:
        raise ValueError('Expected an open, explicitly titled lexical publication issue, not a pull request')
    number = issue.get('number')
    if type(number) is not int or number < 1:
        raise ValueError('Issue number is invalid')
    body = issue.get('body')
    if not isinstance(body, str) or len(body) > 65535:
        raise ValueError('The public issue body is missing or exceeds the handoff limit')
    # GitHub may normalize form newlines; the marker, consent sentence, and sole
    # JSON fence otherwise must match exactly. Ignore no trailing instructions.
    body = body.replace('\r\n', '\n').rstrip('\n') + '\n'
    if not body.startswith(PREFIX) or not body.endswith(SUFFIX):
        raise ValueError('The issue requires the exact public approval marker, consent sentence, and JSON envelope')
    raw = body[len(PREFIX):-len(SUFFIX)]
    if len(raw.encode()) > 150000:
        raise ValueError('The public lexical request exceeds 150 KB')
    request = json.loads(raw)
    if not isinstance(request, dict):
        raise ValueError('The public lexical request must be a JSON object')
    return request, number


def apply_issue(catalog, history, payload, *, actor, repository, event_name, ref, now=None):
    request, number = validated_request(payload, actor=actor, repository=repository, event_name=event_name, ref=ref)
    # This explicit trust adapter validates the real issue event above. The
    # existing controller's exact owner/repo/main checks remain untouched.
    result, ledger = editor.apply_change(catalog, history, request, actor=actor, repository=repository,
                                         event='workflow_dispatch', ref=ref, now=now)
    return result, ledger, {'issueNumber': number, 'action': request['action'], 'publicTerms': len(result['terms']),
                            'publicRelations': len(result['relations']), 'publicHistoryEvents': len(ledger['events'])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', default='museum-static/observatory')
    parser.add_argument('--write', action='store_true', help='Apply the owner-approved public request; otherwise preview only')
    args = parser.parse_args()
    event_path = os.environ.get('GITHUB_EVENT_PATH')
    if not event_path:
        raise ValueError('The original GitHub event file is required')
    payload = json.loads(Path(event_path).read_text())
    directory = Path(args.out)
    history_path = directory / 'history.json'
    history = json.loads(history_path.read_text()) if history_path.exists() else {'schemaVersion': 1, 'notice': editor.NOTICE, 'events': []}
    catalog, history, summary = apply_issue(json.loads((directory / 'public.json').read_text()), history, payload,
        actor=os.environ.get('GITHUB_ACTOR'), repository=os.environ.get('GITHUB_REPOSITORY'),
        event_name=os.environ.get('GITHUB_EVENT_NAME'), ref=os.environ.get('GITHUB_REF'))
    summary['written'] = args.write
    if args.write:
        editor.publication.build(catalog, directory, editor.BASE, write=True)
        history_path.write_text(json.dumps(history, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(summary))
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as output:
            output.write('### Owner-approved public issue request\n\n' + '\n'.join(f'- {k}: {v}' for k, v in summary.items()) +
                         '\n\nThe owner’s issue submission approved this public request. A successful commit, deployment, and live verification are still required. No private source data is accepted.\n')


if __name__ == '__main__':
    main()
