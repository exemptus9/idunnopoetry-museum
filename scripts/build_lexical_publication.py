#!/usr/bin/env python3
"""Build an allowlisted, approved public snapshot. No private archive is deployed.

The input is an editorial export, not proof of authorship or lexical priority.
Dry-run is the default. --write is an explicit publication build operation.
"""
import argparse
import hashlib
import html
import json
import re
from datetime import date as calendar_date
from pathlib import Path
from urllib.parse import urlsplit

STAGES = {"forge", "lexicon", "canon"}
STRENGTHS = {"verified", "supported", "reported", "hypothetical", "unknown"}
DEFINITION_STATES = {"author_supplied", "working_definition", "awaiting_definition", "conversation_recovered", "inferred_definition"}
CLASSIFICATIONS = {"coinage_candidate", "existing_form_reinterpreted", "expression", "term_seed", "unclassified",
                   "proper_name", "literary_wordplay", "concept_label", "ai_suggestion", "existing_term"}
REVIEW_STATES = {"open", "resolved", "deferred"}
DEFINITION_BASES = {"author_supplied", "conversation_recovered", "archive_recovered", "inferred", "unknown"}
REVIEW_FLAGS = {"definition_conflict", "definition_needed", "meaning_inferred", "classification_review", "variant_review", "attribution_review", "source_needed", "author_decision", "duplicate_candidate"}


def text(value, limit=20000):
    return value[:limit] if isinstance(value, str) else ""


def strings(value):
    if not isinstance(value, list):
        return []
    return [text(item, 500) for item in value if isinstance(item, str)][:100]


def public_witnesses(value):
    if not isinstance(value, list):
        return []
    result = []
    for row in value:
        if not isinstance(row, dict) or row.get('visibility') != 'approved_public':
            continue
        url = text(row.get('url'), 2000)
        parts = urlsplit(url)
        if url and (parts.scheme not in {'http', 'https'} or not parts.netloc or parts.username or parts.password):
            url = ''
        result.append({'id': text(row.get('id'), 150), 'visibility': 'approved_public',
                       'label': text(row.get('label') or row.get('title'), 300),
                       'publicSummary': text(row.get('publicSummary'), 3000),
                       'approvedExcerpt': text(row.get('approvedExcerpt'), 3000),
                       'sourceDate': text(row.get('sourceDate'), 100),
                       'evidence': row.get('evidence', row.get('evidenceStrength')) if row.get('evidence', row.get('evidenceStrength')) in STRENGTHS else 'unknown',
                       'url': url})
    return result


def linguistic_proposal(value):
    if not isinstance(value, dict) or value.get('kind') != 'ai_hypothesis':
        return None
    limits = value.get('limitations')
    if isinstance(limits, list):
        limits = '\n'.join(text(item, 3000) for item in limits[:100] if isinstance(item, str))
    return {'kind': 'ai_hypothesis', 'limitations': text(limits, 3000), **{key: text(value.get(key), 3000) for key in
            ('formationProposal', 'interpretationProposal', 'distinctionQuestion')}}


def public_review(value):
    """Project public editorial state, never private review metadata."""
    value = value if isinstance(value, dict) else {}
    return {'state': value.get('state') if isinstance(value.get('state'), str) and value.get('state') in REVIEW_STATES else 'open',
            'flags': list(dict.fromkeys(flag for flag in strings(value.get('flags')) if flag in REVIEW_FLAGS)),
            'definitionBasis': value.get('definitionBasis') if isinstance(value.get('definitionBasis'), str) and value.get('definitionBasis') in DEFINITION_BASES else 'unknown',
            'note': text(value.get('note'), 2000)}


def approved(record):
    decision = record.get("publication", {})
    if not isinstance(decision, dict):
        return False
    revision = record.get("revision")
    return (
        record.get("visibility") == "approved_public"
        and record.get("stage") in STAGES
        and isinstance(revision, int) and not isinstance(revision, bool) and revision > 0
        and type(decision.get("approvedRevision")) is int and decision.get("approvedRevision") == revision
        and bool(text(decision.get("approvedAt")))
    )


def project(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("terms"), list):
        raise ValueError("Expected an object containing terms[]")
    output, ids, slugs = [], set(), set()
    for row in payload["terms"]:
        if not isinstance(row, dict) or not approved(row):
            continue
        if row["stage"] == "canon":
            decision = row.get("canonApproval", {})
            if not isinstance(decision, dict) or type(decision.get("revision")) is not int or decision.get("revision") != row["revision"] or not decision.get("approvedAt"):
                raise ValueError("Canon requires an explicit approval of this revision")
        slug = text(row.get("slug"), 150)
        identity = text(row.get("id"), 150)
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug) or not identity:
            raise ValueError("Approved entries need a stable ID and safe slug")
        if slug in slugs or identity in ids:
            raise ValueError("Duplicate public ID or slug; reconcile before publication")
        headword = text(row.get("headword") or row.get("term"), 200)
        if not headword.strip():
            raise ValueError("Approved entries need a headword")
        date = row.get("earliestVerifiedDate")
        if date is not None and (not isinstance(date, str) or not re.fullmatch(r"\d{4}(?:-\d{2}(?:-\d{2})?)?", date)):
            raise ValueError("Unsupported verified-date representation")
        if date is not None:
            check = str(date) + ('-01-01' if len(str(date)) == 4 else '-01' if len(str(date)) == 7 else '')
            calendar_date.fromisoformat(check)
        # Every field is explicitly projected. Source bodies, raw notes, source
        # identifiers, user UUIDs, legacy records, and review rationale are absent.
        item = {
            "id": identity, "slug": slug, "headword": headword, "term": headword,
            "definition": text(row.get("definition")), "stage": row["stage"],
            "visibility": "approved_public", "revision": row["revision"],
            "formation": text(row.get("formation"), 200),
            "roots": strings(row.get("roots", row.get("components"))), "domains": strings(row.get("domains")),
            "variants": strings(row.get("variants")), "authorship": text(row.get("authorship"), 200),
            "evidenceStrength": row.get("evidenceStrength") if row.get("evidenceStrength") in STRENGTHS else "unknown",
            "earliestVerifiedDate": date,
            "provenanceSummary": text(row.get("provenanceSummary"), 3000),
            "definitionStatus": row.get('definitionStatus') if row.get('definitionStatus') in DEFINITION_STATES else 'working_definition',
            "classification": row.get('classification') if row.get('classification') in CLASSIFICATIONS else 'unclassified',
            "editorialReview": {'shortReason': text((row.get('editorialReview') or {}).get('shortReason'), 1200)},
            "collections": strings(row.get('collections')),
            "tags": strings(row.get('tags')),
            "analysis": linguistic_proposal(row.get('analysis')),
            "witnesses": public_witnesses(row.get('witnesses', row.get('sources'))),
            "corpus": public_witnesses(row.get('corpus')),
            "publication": {"approvedAt": text(row["publication"]["approvedAt"], 100),
                            "approvedRevision": row["revision"],
                            "approvalMethod": row['publication'].get('approvalMethod') if row['publication'].get('approvalMethod') in
                                {'owner_action', 'author_delegated_editorial_review'} else 'owner_action'},
            "permalink": "word/" + slug + "/",
        }
        if row["stage"] == "canon":
            item["canonApproval"] = {"revision": row["revision"], "approvedAt": text(row["canonApproval"]["approvedAt"], 100)}
        if 'review' in row:
            item['review'] = public_review(row.get('review'))
        output.append(item)
        ids.add(identity)
        slugs.add(slug)
    relations = []
    for row in payload.get("relations", []):
        if not isinstance(row, dict) or row.get("visibility") != "approved_public":
            continue
        if row.get("source") not in ids or row.get("target") not in ids:
            continue
        status = row.get("status")
        if status not in {"confirmed", "inferred"}:
            continue
        relations.append({"source": row["source"], "target": row["target"], "visibility": "approved_public",
                          "type": text(row.get("type"), 100), "status": status,
                          "explanation": text(row.get("publicExplanation") or row.get('explanation'), 2000)})
    versions = []
    for row in payload.get("versions", []):
        if not isinstance(row, dict) or row.get("visibility") != "approved_public" or row.get("termId") not in ids:
            continue
        version = row.get("version")
        if not isinstance(version, int) or isinstance(version, bool) or version < 1:
            raise ValueError("Public definition versions need a positive integer version")
        versions.append({"termId": row["termId"], "version": version, "visibility": "approved_public",
                         "definition": text(row.get("definition")),
            "date": text(row.get("date") or row.get("effectiveAt"), 100), "note": text(row.get("publicNote") or row.get('note'), 2000)})
    return {"schemaVersion": 1, "terms": sorted(output, key=lambda row: row["headword"].casefold()),
            "relations": relations, "versions": versions}


def page(term, base, catalog=None):
    esc = html.escape
    canonical = base + "word/" + term["slug"] + "/"
    structured = {"@context": "https://schema.org", "@type": "DefinedTerm",
                  "name": term["headword"], "description": term["definition"], "url": canonical,
                  "inDefinedTermSet": base}
    metadata = json.dumps(structured, ensure_ascii=False).replace("<", "\\u003c")
    date = term["earliestVerifiedDate"] or "Not established"
    catalog = catalog or {'terms': [], 'relations': [], 'versions': []}
    title = lambda value: str(value).replace('_', ' ').title()
    statuses = {'author_supplied': 'Author-supplied working definition',
                'working_definition': 'Provisional working definition',
                'conversation_recovered': 'Definition recovered from a conversation',
                'inferred_definition': 'Inferred definition · provisional interpretation',
                'awaiting_definition': 'Lexical seed · definition pending'}
    status = statuses.get(term.get('definitionStatus'), 'Working definition')
    robots = 'noindex,follow' if term['stage'] == 'forge' else 'index,follow'
    by_id = {row['id']: row for row in catalog['terms']}
    related = []
    for relation in catalog['relations']:
        if term['id'] not in {relation['source'], relation['target']}:
            continue
        other = by_id.get(relation['target'] if relation['source'] == term['id'] else relation['source'])
        if other:
            related.append(f'<li><a href="../{other["slug"]}/">{esc(other["headword"])}</a> · {esc(title(relation["type"]))} · {esc(relation["status"])}<p>{esc(relation["explanation"])}</p></li>')
    witnesses = []
    for witness in term.get('witnesses', []):
        label = esc(witness['label'] or 'Public source summary')
        if witness['url']:
            label = f'<a href="{esc(witness["url"], quote=True)}" rel="noopener noreferrer">{label}</a>'
        witnesses.append(f'<li>{label}<p>{esc(witness["publicSummary"])}</p>' +
                         f'<p class="muted">Source date: {esc(witness["sourceDate"][:10] or "Not established")} · Evidence: {esc(title(witness["evidence"]))}</p>' +
                         (f'<blockquote>{esc(witness["approvedExcerpt"])}</blockquote>' if witness['approvedExcerpt'] else '') + '</li>')
    history = []
    for version in sorted((v for v in catalog['versions'] if v['termId'] == term['id']), key=lambda v: v['version']):
        when = version['date'][:10] if version['date'] else 'Historical date not established'
        history.append(f'<li><strong>Definition version {version["version"]}</strong> · {esc(when)}<p>{esc(version["definition"])}</p><small>{esc(version["note"])}</small></li>')
    proposal = term.get('analysis')
    analysis = ''
    if proposal:
        analysis = '<section><h2>AI linguistic proposal</h2><p class="muted">A reviewable hypothesis. This is separate from the author’s definition and is not evidence of historical derivation.</p><dl>' + ''.join(
            f'<dt>{label}</dt><dd>{esc(proposal[key])}</dd>' for key, label in
            [('formationProposal', 'Possible formation'), ('interpretationProposal', 'Possible reading'),
             ('distinctionQuestion', 'Question for the author'), ('limitations', 'Limits of this analysis')] if proposal.get(key)) + '</dl></section>'
    review = term.get('review') or {}
    review_html = '<section><h2>Working endpoint and review</h2><p>Definition basis: ' + esc(title(review.get('definitionBasis', 'unknown'))) + '</p><p>' + esc(review.get('note', '')) + '</p>' + ('<p>Review flags: ' + esc(' · '.join(title(f) for f in review.get('flags', []))) + '</p>' if review.get('flags') else '') + '</section>' if review else ''
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(term['headword'])} · Lexical Observatory</title>
<meta name="description" content="{esc(term['definition'][:160], quote=True)}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{canonical}"><meta property="og:type" content="article">
<meta property="og:title" content="{esc(term['headword'], quote=True)} · Lexical Observatory">
<meta property="og:description" content="{esc(term['definition'][:200], quote=True)}">
<meta property="og:url" content="{canonical}"><link rel="stylesheet" href="../../observatory.css">
<script type="application/ld+json">{metadata}</script>
<link rel="stylesheet" href="../../atelier.css">
</head><body class="static-word"><header><img src="../../observatory-mark.svg" width="36" height="36" alt=""><a href="../../">Lexical Observatory</a><span>/ Word Archive</span></header>
<main><p class="status">{esc(term['stage'].title())} · {esc(status)}</p>
<h1>{esc(term['headword'])}</h1><p class="definition">{esc(term['definition'])}</p>
<p class="muted">{esc(term.get('editorialReview', {}).get('shortReason', ''))}</p>
<div class="actions"><a href="../../?term={term['slug']}">Open interactive genome</a><a href="../../#author?term={term['slug']}">Prepare a public edit</a><a href="../../#review?term={term['slug']}">Flag / categorize</a></div>
{review_html}
<section><h2>Word Genome</h2>
<dl><dt>Formation</dt><dd>{esc(term['formation'] or 'Under review')}</dd>
<dt>Components</dt><dd>{esc(' · '.join(term['roots']) or 'Not documented')}</dd>
<dt>Conceptual domains</dt><dd>{esc(' · '.join(term.get('domains', [])) or 'Not classified')}</dd>
<dt>Spelling variants</dt><dd>{esc(' · '.join(term.get('variants', [])) or 'Not documented')}</dd>
<dt>Authorship status</dt><dd>{esc(term['authorship'] or 'Undetermined')}</dd>
<dt>Evidence strength</dt><dd>{esc(term['evidenceStrength'])}</dd>
<dt>Earliest verified appearance</dt><dd>{esc(date)}</dd>
<dt>Public provenance summary</dt><dd>{esc(term['provenanceSummary'] or 'No public source summary approved.')}</dd>
<dt>This revision published</dt><dd>{esc(term['publication']['approvedAt'][:10])} · revision {term['revision']}</dd></dl></section>
{analysis}
<section><h2>Conceptual neighbours</h2>{'<ul>' + ''.join(related) + '</ul>' if related else '<p>No public relationship has been recorded.</p>'}</section>
<section><h2>Definition archaeology</h2>{'<ol>' + ''.join(history) + '</ol>' if history else '<p>No public definition history is recorded.</p>'}<p class="muted">Undated recovered wording is not assigned a fabricated historical date. Publication dates do not establish dates of invention.</p></section>
<section><h2>Public source summaries</h2>{'<ul>' + ''.join(witnesses) + '</ul>' if witnesses else '<p>No public external witness is attached.</p>'}</section>
<p>Recorded dates do not establish absolute originality. Canon is an authorial decision.</p>
</main><footer><a href="../../../">IDunnoPoetry Museum</a></footer></body></html>'''


def build(payload, out, base, write=False):
    parts = urlsplit(base)
    if parts.scheme != "https" or not parts.netloc or parts.username or parts.password or parts.query or parts.fragment:
        raise ValueError("base URL must be an HTTPS public origin/path")
    if not re.fullmatch(r"https://[A-Za-z0-9.-]+(?::\d+)?(?:/[A-Za-z0-9._~/-]*)?", base):
        raise ValueError("base URL contains unsafe characters")
    base = base.rstrip("/") + "/"
    result = project(payload)
    serialized = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    digest = hashlib.sha256(serialized.encode()).hexdigest()
    summary = {"publicTerms": len(result["terms"]), "publicRelations": len(result["relations"]),
               "publicVersions": len(result["versions"]), "sha256": digest, "written": write}
    if write:
        out = Path(out)
        out.mkdir(parents=True, exist_ok=True)
        # Remove previous generated pages when an approval is withdrawn. Never
        # copy any input file or arbitrary file tree into the deployment folder.
        word_dir = out / "word"
        if word_dir.exists():
            for path in word_dir.glob("*/index.html"):
                if 'Lexical Observatory' not in path.read_text():
                    raise ValueError("Unrecognized page in managed word directory")
                path.unlink()
        for term in result["terms"]:
            folder = word_dir / term["slug"]
            folder.mkdir(parents=True, exist_ok=True)
            (folder / "index.html").write_text(page(term, base, result))
        (out / "public.json").write_text(serialized)
        urls = [base] + [base + "word/" + row["slug"] + "/" for row in result["terms"] if row['stage'] != 'forge']
        xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        xml += ''.join('<url><loc>' + html.escape(url) + '</loc></url>' for url in urls) + '</urlset>\n'
        (out / "sitemap.xml").write_text(xml)
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", default="museum-static/observatory")
    parser.add_argument("--base-url", default="https://exemptus9.github.io/idunnopoetry-museum/observatory/")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    print(json.dumps(build(json.loads(Path(args.input).read_text()), args.out, args.base_url, args.write)))
