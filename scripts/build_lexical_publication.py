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
from pathlib import Path
from urllib.parse import urlsplit

STAGES = {"forge", "lexicon", "canon"}
STRENGTHS = {"verified", "supported", "reported", "hypothetical", "unknown"}


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
        if date is not None and not re.fullmatch(r"\d{4}(?:-\d{2}(?:-\d{2})?)?", str(date)):
            raise ValueError("Unsupported verified-date representation")
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
            "witnesses": public_witnesses(row.get('witnesses', row.get('sources'))),
            "corpus": public_witnesses(row.get('corpus')),
            "publication": {"approvedAt": text(row["publication"]["approvedAt"], 100),
                            "approvedRevision": row["revision"]},
            "permalink": "word/" + slug + "/",
        }
        if row["stage"] == "canon":
            item["canonApproval"] = {"revision": row["revision"], "approvedAt": text(row["canonApproval"]["approvedAt"], 100)}
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
                          "explanation": text(row.get("publicExplanation"), 2000)})
    versions = []
    for row in payload.get("versions", []):
        if not isinstance(row, dict) or row.get("visibility") != "approved_public" or row.get("termId") not in ids:
            continue
        version = row.get("version")
        if not isinstance(version, int) or isinstance(version, bool) or version < 1:
            raise ValueError("Public definition versions need a positive integer version")
        versions.append({"termId": row["termId"], "version": version, "visibility": "approved_public",
                         "definition": text(row.get("definition")),
            "date": text(row.get("date") or row.get("effectiveAt"), 100), "note": text(row.get("publicNote"), 2000)})
    return {"schemaVersion": 1, "terms": sorted(output, key=lambda row: row["headword"].casefold()),
            "relations": relations, "versions": versions}


def page(term, base):
    esc = html.escape
    canonical = base + "word/" + term["slug"] + "/"
    structured = {"@context": "https://schema.org", "@type": "DefinedTerm",
                  "name": term["headword"], "description": term["definition"], "url": canonical,
                  "inDefinedTermSet": base}
    metadata = json.dumps(structured, ensure_ascii=False).replace("<", "\\u003c")
    date = term["earliestVerifiedDate"] or "Not established"
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(term['headword'])} · Lexical Observatory</title>
<meta name="description" content="{esc(term['definition'][:160], quote=True)}">
<link rel="canonical" href="{canonical}"><meta property="og:type" content="article">
<meta property="og:title" content="{esc(term['headword'], quote=True)} · Lexical Observatory">
<meta property="og:description" content="{esc(term['definition'][:200], quote=True)}">
<meta property="og:url" content="{canonical}"><link rel="stylesheet" href="../../observatory.css">
<script type="application/ld+json">{metadata}</script>
<style>body{{max-width:52rem;margin:auto;padding:2rem;font-family:system-ui;line-height:1.7}}h1{{font:clamp(2rem,8vw,4rem) Georgia,serif}}dt{{font-weight:bold;margin-top:1rem}}dd{{margin-left:0}}a{{text-underline-offset:.2em}}</style>
</head><body><header><a href="../../">Lexical Observatory</a> / Word Archive</header>
<main><p>{esc(term['stage'].title())} · {esc(term['evidenceStrength'])} evidence</p>
<h1>{esc(term['headword'])}</h1><p>{esc(term['definition'])}</p>
<dl><dt>Formation</dt><dd>{esc(term['formation'] or 'Under review')}</dd>
<dt>Components</dt><dd>{esc(' · '.join(term['roots']) or 'Not documented')}</dd>
<dt>Authorship status</dt><dd>{esc(term['authorship'] or 'Undetermined')}</dd>
<dt>Earliest verified appearance</dt><dd>{esc(date)}</dd>
<dt>Public provenance summary</dt><dd>{esc(term['provenanceSummary'] or 'No public source summary approved.')}</dd></dl>
<p><a href="../../?term={term['slug']}">Explore this word’s genome, relationships, and public revisions</a></p>
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
            (folder / "index.html").write_text(page(term, base))
        (out / "public.json").write_text(serialized)
        urls = [base] + [base + "word/" + row["slug"] + "/" for row in result["terms"]]
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
