#!/usr/bin/env python3
"""Owner-authenticated editor for PUBLIC lexical material only.

GitHub Actions is the authentication boundary. This program also checks the
trusted owner/repository/event/ref context; it never accepts browser tokens.
Withdrawals remove current public pages, not material already in public Git
history. The append-only hash chain is tamper-evident, not proof of priority.
"""
import argparse
import copy
from datetime import date, datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import unicodedata
from urllib.parse import urlsplit
from uuid import uuid4

import build_lexical_publication as publication

REPOSITORY = "exemptus9/idunnopoetry-museum"
OWNER = "exemptus9"
BASE = "https://exemptus9.github.io/idunnopoetry-museum/observatory/"
NOTICE = "Public editorial history only. Withdrawal removes current publication; prior public Git history remains public. Hashes do not establish coinage priority."
FIELDS = {"headword", "definition", "formation", "roots", "domains", "variants", "authorship", "evidenceStrength", "earliestVerifiedDate", "provenanceSummary", "witnesses", "corpus", "stage", "classification", "definitionStatus", "collections", "tags", "editorialReview", "analysis", "review"}
REQUEST_FIELDS = {"action", "id", "slug", "expectedRevision", "changes", "publicNote", "confirmPublication", "canonConfirmation", "restoreRevision", "relation"}
BATCH_FIELDS = {"action", "changes", "confirmBatch", "publicNote"}
WITNESS_FIELDS = {"id", "label", "publicSummary", "approvedExcerpt", "sourceDate", "evidence", "url", "visibility"}
RELATION_FIELDS = {"source", "target", "type", "status", "publicExplanation"}


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def authenticate(actor, repository, event="workflow_dispatch", ref="refs/heads/main"):
    if actor != OWNER or repository != REPOSITORY or event != "workflow_dispatch" or ref != "refs/heads/main":
        raise ValueError("Only the repository owner may dispatch this workflow on main in the authoritative repository")


def key(value):
    folded = unicodedata.normalize("NFKD", value).casefold()
    return "".join(ch for ch in folded if ch.isalnum() and not unicodedata.combining(ch))


def string(value, name, limit=20000, required=False):
    if not isinstance(value, str) or len(value) > limit or (required and not value.strip()):
        raise ValueError(f"Invalid {name}; expected {'nonempty ' if required else ''}text of at most {limit} characters")
    if "\x00" in value:
        raise ValueError(f"NUL is forbidden in {name}")
    return value.strip()


def positive(value, name):
    if type(value) is not int or value < 1:
        raise ValueError(f"{name} must be a positive integer")
    return value


def checked_date(value, name):
    if value is None:
        return None
    value = string(value, name, 10, True)
    if not re.fullmatch(r"\d{4}(?:-\d{2}(?:-\d{2})?)?", value):
        raise ValueError(f"Invalid {name}")
    date.fromisoformat(value + ("-01-01" if len(value) == 4 else "-01" if len(value) == 7 else ""))
    return value


def fields(changes):
    if not isinstance(changes, dict) or set(changes) - FIELDS:
        raise ValueError("Only documented public fields may be edited; private notes and source bodies are forbidden")
    clean = {}
    for name, value in changes.items():
        if name in {"roots", "domains", "variants", "collections", "tags"}:
            if not isinstance(value, list) or len(value) > 100:
                raise ValueError(f"Invalid {name} list")
            clean[name] = [string(v, name, 500, True) for v in value]
        elif name == "earliestVerifiedDate":
            clean[name] = checked_date(value, name)
        elif name == "editorialReview":
            if not isinstance(value, dict) or set(value) != {"shortReason"}:
                raise ValueError("Editorial review permits only an explicitly public shortReason")
            clean[name] = {"shortReason": string(value["shortReason"], "public shortReason", 1200)}
        elif name == "review":
            if not isinstance(value, dict) or set(value) != {"state", "flags", "definitionBasis", "note"}:
                raise ValueError("Review requires only state, flags, definitionBasis, and a public note")
            if not isinstance(value['state'], str) or not isinstance(value['definitionBasis'], str) or value['state'] not in publication.REVIEW_STATES or value['definitionBasis'] not in publication.DEFINITION_BASES:
                raise ValueError("Unknown review state or definition basis")
            flags = value['flags']
            if not isinstance(flags, list) or len(flags) > len(publication.REVIEW_FLAGS) or any(not isinstance(flag, str) or flag not in publication.REVIEW_FLAGS for flag in flags):
                raise ValueError("Unknown public review flag")
            clean[name] = {"state": value['state'], "flags": list(dict.fromkeys(flags)), "definitionBasis": value['definitionBasis'],
                           "note": string(value['note'], 'public review note', 2000)}
        elif name == "analysis":
            if value is None:
                clean[name] = None  # Reject/remove the public AI proposal without erasing its public history.
                continue
            allowed = {"kind", "formationProposal", "interpretationProposal", "distinctionQuestion", "limitations"}
            if not isinstance(value, dict) or set(value) - allowed or value.get("kind") != "ai_hypothesis":
                raise ValueError("Analysis must be a labeled AI hypothesis with only documented public fields")
            clean[name] = {"kind": "ai_hypothesis"}
            for k, v in value.items():
                if k == 'kind':
                    continue
                if k == 'limitations' and isinstance(v, list):
                    if len(v) > 100:
                        raise ValueError('Too many public analysis limitations')
                    v = '\n'.join(string(item, 'public limitation', 3000) for item in v)
                clean[name][k] = string(v, k, 3000)
        elif name in {"witnesses", "corpus"}:
            if not isinstance(value, list) or len(value) > 100:
                raise ValueError(f"Invalid {name} list")
            rows = []
            for row in value:
                if not isinstance(row, dict) or set(row) - WITNESS_FIELDS:
                    raise ValueError("A witness may contain only explicitly public summaries/excerpts")
                if row.get("visibility") != "approved_public":
                    raise ValueError("A witness requires explicit approved_public visibility")
                item = {k: string(v, k, 3000) for k, v in row.items() if k != "sourceDate"}
                item["sourceDate"] = checked_date(row.get("sourceDate"), "sourceDate")
                url = item.get("url", "")
                parts = urlsplit(url)
                if url and (parts.scheme not in {"http", "https"} or not parts.netloc or parts.username or parts.password):
                    raise ValueError("Witness URL must be an HTTP(S) URL without credentials")
                if item.get("evidence", "unknown") not in publication.STRENGTHS:
                    raise ValueError("Unknown witness evidence strength")
                rows.append(item)
            clean[name] = rows
        else:
            clean[name] = string(value, name, 20000 if name == "definition" else 3000 if name == "provenanceSummary" else 200,
                                 required=name in {"headword", "stage", "evidenceStrength"})
    if "stage" in clean and clean["stage"] not in publication.STAGES:
        raise ValueError("Unknown lifecycle stage")
    if "evidenceStrength" in clean and clean["evidenceStrength"] not in publication.STRENGTHS:
        raise ValueError("Unknown evidence strength")
    if "classification" in clean and clean["classification"] not in publication.CLASSIFICATIONS:
        raise ValueError("Unknown public classification")
    if "definitionStatus" in clean and clean["definitionStatus"] not in publication.DEFINITION_STATES:
        raise ValueError("Unknown definition status")
    if "headword" in clean and not key(clean["headword"]):
        raise ValueError("Headword needs a recognizable lexical form")
    return clean


def verify_history(history):
    if not isinstance(history, dict) or not isinstance(history.get("events"), list):
        raise ValueError("Invalid public history ledger")
    prior = ""
    for event in history["events"]:
        if event.get("previousHash") != prior:
            raise ValueError("Public history chain is inconsistent")
        unsigned = {k: v for k, v in event.items() if k != "hash"}
        digest = hashlib.sha256(canonical(unsigned).encode()).hexdigest()
        if event.get("hash") != digest:
            raise ValueError("Public history hash does not match")
        prior = digest


def version_projection(rows, identity):
    """Canonical projection of already-public history; never invent source dates."""
    result = []
    for row in rows:
        if row.get("termId") != identity or row.get("visibility") != "approved_public":
            continue
        definition, when, note = row.get('definition', ''), row.get('date', ''), row.get('note', row.get('publicNote', ''))
        string(definition, 'public definition')
        string(when, 'public version date', 100)
        string(note, 'public version note', 2000)
        result.append({"termId": identity, "version": positive(row.get("version"), "definition version"),
                       "visibility": "approved_public", "definition": definition, "date": when, "note": note})
    return result


def append_event(history, actor, action, identity, slug, revision, stamp, note="", snapshot=None, definition_versions=None, approval_method="owner_action"):
    if approval_method not in {"owner_action", "author_delegated_editorial_review"}:
        raise ValueError("Unknown editorial approval method")
    # Public import callers must never be able to copy a rich private recovery
    # record into the public audit ledger by accident.
    if snapshot is not None:
        if not isinstance(snapshot, dict):
            raise ValueError('A public ledger snapshot must have a documented public shape')
        if 'headword' in snapshot:
            projected = publication.project({'terms': [snapshot]})['terms']
            if len(projected) != 1 or projected[0]['id'] != identity or projected[0]['slug'] != slug or projected[0]['revision'] != revision:
                raise ValueError('A ledger term snapshot requires an approved public record with matching identity/revision')
            snapshot = projected[0]
        elif action == 'relation_review' and set(snapshot) == {'relation'} and identity == '__relations__':
            relation = snapshot['relation']
            if not isinstance(relation, dict) or set(relation) - RELATION_FIELDS or relation.get('status') not in {'confirmed', 'inferred', 'rejected'}:
                raise ValueError('Unsupported public relation audit snapshot')
            snapshot = {'relation': {name: string(relation.get(name, ''), name, 2000 if name == 'publicExplanation' else 150)
                                     for name in RELATION_FIELDS}}
        elif action == 'batch' and identity == '__batch__' and set(snapshot) == {'changes', 'termIds'}:
            count = positive(snapshot['changes'], 'public batch change count')
            if count > 100 or not isinstance(snapshot['termIds'], list) or len(snapshot['termIds']) > 100:
                raise ValueError('Invalid public batch audit snapshot')
            snapshot = {'changes': count, 'termIds': [string(value, 'public term ID', 150, True) for value in snapshot['termIds']]}
        else:
            raise ValueError('Undocumented public ledger snapshot fields are forbidden')
    event = {"actor": actor, "action": action, "approvalMethod": approval_method, "termId": identity, "slug": slug, "revision": revision,
             "recordedAt": stamp, "publicNote": note, "snapshot": copy.deepcopy(snapshot),
             "definitionVersions": version_projection(definition_versions or [], identity),
             "previousHash": history["events"][-1]["hash"] if history["events"] else ""}
    event["hash"] = hashlib.sha256(canonical(event).encode()).hexdigest()
    history["events"].append(event)


def approval(term, request, actor, stamp):
    headword = term["headword"]
    if term["stage"] in {"lexicon", "canon"}:
        definition = term.get("definition", "").strip()
        placeholder = re.sub(r"[^\w]+", " ", definition.casefold()).strip()
        if term.get("definitionStatus") == "awaiting_definition" or not definition or placeholder in {
            "definition pending author review", "definition not yet established", "definition pending", "tbd",
            "to be defined", "awaiting definition", "no definition yet", "under review", "definition under review",
            "pending author review", "not documented", "not established", "pending", "unknown", "undefined"}:
            raise ValueError("Lexicon and Canon require a substantive definition and a developed definition status")
    if request.get("confirmPublication") != "PUBLISH " + headword:
        raise ValueError("Publication requires confirmPublication: PUBLISH <headword>")
    term["publication"] = {"approvedRevision": term["revision"], "approvedAt": stamp,
                           "approvalMethod": "owner_action"}
    if term["stage"] == "canon":
        if request.get("canonConfirmation") != "APPROVE CANON " + headword:
            raise ValueError("Every new Canon revision requires exact explicit author confirmation")
        term["canonApproval"] = {"revision": term["revision"], "approvedAt": stamp}
    else:
        term.pop("canonApproval", None)
    term["visibility"] = "approved_public"


def apply_change(catalog, history, request, *, actor, repository, event="workflow_dispatch", ref="refs/heads/main", now=None):
    """Pure preview. Return new public catalog/ledger; never mutate the arguments."""
    authenticate(actor, repository, event, ref)
    if not isinstance(request, dict) or len(canonical(request).encode()) > 150000:
        raise ValueError("Invalid request or unknown fields; do not submit private material")
    allowed = BATCH_FIELDS if request.get('action') == 'batch' else REQUEST_FIELDS
    if set(request) - allowed:
        raise ValueError("Unknown request fields; do not submit private material")
    verify_history(history)
    catalog = publication.project(copy.deepcopy(catalog))
    history = copy.deepcopy(history)
    history["notice"] = NOTICE
    stamp = now or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    action = request.get("action")
    if action == 'batch':
        rows = request.get('changes')
        if not isinstance(rows, list) or not 1 <= len(rows) <= 100:
            raise ValueError('A batch requires 1–100 individual public requests')
        if request.get('confirmBatch') != f'APPLY {len(rows)} PUBLIC CHANGES':
            raise ValueError('Batch requires exact confirmation of its public change count')
        ids, slugs = set(), set()
        for row in rows:
            if not isinstance(row, dict) or row.get('action') == 'batch':
                raise ValueError('Nested batches and malformed individual requests are forbidden')
            identity = string(row['id'], 'id', 150) if 'id' in row else None
            slug = string(row['slug'], 'slug', 150) if 'slug' in row else None
            if identity is not None and identity in ids:
                raise ValueError('A batch may edit each stable ID only once')
            if slug is not None and slug in slugs:
                raise ValueError('A batch may use each stable slug only once')
            if identity:
                ids.add(identity)
            if slug:
                slugs.add(slug)
        starting_events = len(history['events'])
        for row in rows:
            catalog, history = apply_change(catalog, history, row, actor=actor, repository=repository, event=event, ref=ref, now=stamp)
        affected = list(dict.fromkeys(e['termId'] for e in history['events'][starting_events:] if not e['termId'].startswith('__')))
        revision = sum(e['action'] == 'batch' for e in history['events']) + 1
        append_event(history, actor, 'batch', '__batch__', '', revision, stamp,
                     string(request.get('publicNote', ''), 'public batch note', 2000), {'changes': len(rows), 'termIds': affected})
        return catalog, history
    if action not in {"create", "update", "publish", "withdraw", "restore", "stage", "relation_review"}:
        raise ValueError("Unsupported action")
    note = string(request.get("publicNote", ""), "publicNote", 2000)
    edits = fields(request.get("changes", {}))
    identity = string(request.get("id", ""), "id", 150)
    term = next((t for t in catalog["terms"] if t["id"] == identity), None)
    events = [e for e in history["events"] if e["termId"] == identity] if identity else []
    if action == "relation_review":
        relation = request.get("relation")
        if not isinstance(relation, dict) or set(relation) - RELATION_FIELDS:
            raise ValueError("Invalid public relation fields")
        source, target = relation.get("source"), relation.get("target")
        ids = {t["id"] for t in catalog["terms"]}
        if source not in ids or target not in ids or source == target:
            raise ValueError("Relationships require two different current public terms")
        if relation.get("status") not in {"confirmed", "inferred", "rejected"}:
            raise ValueError("Relation must be confirmed, inferred, or rejected")
        revision = len([e for e in history["events"] if e["action"] == "relation_review"]) + 1
        if type(request.get('expectedRevision')) is not int or request.get("expectedRevision") != revision - 1:
            raise ValueError("Relation revision conflict; reload current public history")
        kind = string(relation.get("type"), "relation type", 100, True)
        catalog["relations"] = [r for r in catalog["relations"] if (r["source"], r["target"], r["type"]) != (source, target, kind)]
        if relation["status"] != "rejected":
            catalog["relations"].append({"source": source, "target": target, "type": kind, "status": relation["status"],
                                          "visibility": "approved_public", "publicExplanation": string(relation.get("publicExplanation", ""), "publicExplanation", 2000)})
        append_event(history, actor, action, "__relations__", "", revision, stamp, note, {"relation": relation})
        return publication.project(catalog), history
    if action == "create":
        if term or events:
            raise ValueError("ID already exists or is reserved by public history")
        if type(request.get("expectedRevision")) is not int or request.get("expectedRevision") != 0:
            raise ValueError("Create requires expectedRevision: 0")
        headword = edits.get("headword")
        if not headword:
            raise ValueError("A public headword is required")
        identity = identity or str(uuid4())
        if identity.startswith('__'):
            raise ValueError('System ledger identifiers are reserved')
        slug = string(request.get("slug", ""), "slug", 150, True)
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
            raise ValueError("A safe stable slug is required")
        term = {"id": identity, "slug": slug, "revision": 1, "stage": "forge", **edits}
    else:
        if not identity or (term is None and not events):
            raise ValueError("Unknown public term")
        current_revision = term["revision"] if term else events[-1]["revision"]
        if request.get("expectedRevision") != current_revision or type(request.get("expectedRevision")) is not int:
            raise ValueError("Revision conflict; reload and review the current record")
        if request.get("slug") is not None and request["slug"] != (term or events[-1])["slug"]:
            raise ValueError("Published slugs are immutable")
        if term is not None and not events:
            append_event(history, actor, "baseline", identity, term["slug"], current_revision, stamp,
                         "First ledger snapshot of already-public content; not a historical invention event", term,
                         version_projection(catalog["versions"], identity))
        if action == "withdraw":
            if edits or term is None:
                raise ValueError("Withdrawal accepts no content edits and requires a current public term")
            catalog["terms"] = [t for t in catalog["terms"] if t["id"] != identity]
            append_event(history, actor, action, identity, term["slug"], current_revision + 1, stamp, note,
                         definition_versions=version_projection(catalog["versions"], identity))
            return publication.project(catalog), history
        if action == "restore":
            revision = positive(request.get("restoreRevision"), "restoreRevision")
            past = next((e for e in reversed(history["events"]) if e["termId"] == identity and e["revision"] == revision and e.get("snapshot") and "headword" in e["snapshot"]), None)
            if not past:
                raise ValueError("Requested public revision is not available")
            term = copy.deepcopy(past["snapshot"])
        elif term is None:
            raise ValueError("Withdrawn content must be restored explicitly")
        if action == "stage" and "stage" not in edits:
            raise ValueError("Stage action requires changes.stage")
        term.update(edits)
        term["revision"] = current_revision + 1
    if any(t["id"] != identity and (t["slug"] == term["slug"] or key(t["headword"]) == key(term["headword"])) for t in catalog["terms"]):
        raise ValueError("Duplicate headword/slug; reconcile explicitly instead of overwriting")
    if any(e["termId"] != identity and e.get("slug") == term["slug"] for e in history["events"]):
        raise ValueError("Slug is reserved by another public term’s history")
    approval(term, request, actor, stamp)
    # The generator is the final field projection, including nested witnesses.
    term = publication.project({"terms": [term]})["terms"][0]
    catalog["terms"] = [t for t in catalog["terms"] if t["id"] != identity] + [term]
    if action == "restore":
        recorded = {v["version"]: v for v in version_projection(catalog["versions"], identity)}
        for prior in history["events"]:
            if prior["termId"] != identity:
                continue
            for version in version_projection(prior.get("definitionVersions", []), identity):
                if version["version"] in recorded and canonical(recorded[version["version"]]) != canonical(version):
                    raise ValueError("Conflicting public definition histories require editorial reconciliation")
                recorded[version["version"]] = version
        catalog["versions"] = [v for v in catalog["versions"] if v["termId"] != identity] + list(recorded.values())
    next_version = max((v["version"] for v in catalog["versions"] if v["termId"] == identity), default=0) + 1
    catalog["versions"].append({"termId": identity, "version": next_version, "visibility": "approved_public",
                                "definition": term["definition"], "date": stamp, "publicNote": note})
    append_event(history, actor, action, identity, term["slug"], term["revision"], stamp, note, term,
                 version_projection(catalog["versions"], identity))
    return publication.project(catalog), history


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--change", required=True, help="Path to public-only JSON request")
    parser.add_argument("--out", default="museum-static/observatory")
    parser.add_argument("--write", action="store_true", help="Apply after owner-reviewed workflow confirmation")
    args = parser.parse_args()
    authenticate(os.environ.get("GITHUB_ACTOR"), os.environ.get("GITHUB_REPOSITORY"), os.environ.get("GITHUB_EVENT_NAME"), os.environ.get("GITHUB_REF"))
    directory = Path(args.out)
    history_path = directory / "history.json"
    history = json.loads(history_path.read_text()) if history_path.exists() else {"schemaVersion": 1, "notice": NOTICE, "events": []}
    request = json.loads(Path(args.change).read_text())
    before = publication.project(json.loads((directory / "public.json").read_text()))
    catalog, history = apply_change(before, history, request,
                                    actor=os.environ["GITHUB_ACTOR"], repository=os.environ["GITHUB_REPOSITORY"])
    summary = {"action": request["action"], "publicTerms": len(catalog["terms"]), "publicRelations": len(catalog["relations"]),
               "publicHistoryEvents": len(history["events"]), "written": args.write}
    if request['action'] == 'batch':
        summary['batchChanges'] = len(request['changes'])
    if args.write:
        publication.build(catalog, directory, BASE, write=True)
        history_path.write_text(json.dumps(history, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(summary))
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a") as output:
            output.write("### Lexical publication preview\n\n" + "\n".join(f"- {k}: {v}" for k, v in summary.items()) +
                         "\n\nOnly public content is accepted. Withdrawals do not erase prior public Git history. Canon always requires explicit author confirmation.\n")
            identity = history["events"][-1]["termId"]
            preview = {"before": next((t for t in before["terms"] if t["id"] == identity), None),
                       "after": next((t for t in catalog["terms"] if t["id"] == identity), None)}
            if request["action"] == "relation_review":
                preview = {"publicRelationDecision": history["events"][-1]["snapshot"]}
            elif request['action'] == 'batch':
                preview = {'changes': [{'id': identity,
                                       'before': next((t for t in before['terms'] if t['id'] == identity), None),
                                       'after': next((t for t in catalog['terms'] if t['id'] == identity), None)}
                                      for identity in history['events'][-1]['snapshot']['termIds']]}
            output.write("\n### Sanitized public change\n\n```json\n" + json.dumps(preview, ensure_ascii=False, indent=2) + "\n```\n")


if __name__ == "__main__":
    main()
