#!/usr/bin/env python3
"""Preview or apply an explicitly approved, privacy-minimized Seed Vault export.

Use the OFFLINE private Seed Vault to create IDP_Approved_Public_Seeds.json.
Never commit the raw private Vault, private review JSON, or a packet before review.
Preview by default; --apply writes only allowlisted fields to the PUBLIC site.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "museum-static" / "data" / "seedbank-approved.js"
PREFIX = "window.IDP_SEEDBANK_APPROVED = "
STAGES = {"seed", "growing", "candidate", "graduated"}
PROVENANCE = {"brandon", "assisted"}
PUBLIC_FIELDS = {"id", "title", "text", "status", "provenance", "confidence",
                 "versionId", "contentSha256", "approvedAt", "explicitPublicApproval"}
EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
PRIVATE_HINT = re.compile(r"(?:seeds[ _-]+and[ _-]+scraps\.txt|"
                          r"seeds[ _-]+of[ _-]+poems\.txt|"
                          r"(?:api[_ -]?key|bearer|password|secret)[=:][^\s]+)", re.I)
ID_PATTERN = re.compile(r"^curated-[A-Za-z0-9_-]{8,128}$")


def read_public(path=OUTPUT):
    if not path.exists():
        return {"schemaVersion": 1, "records": []}
    raw = path.read_text(encoding="utf-8").strip()
    if not raw.startswith(PREFIX):
        raise ValueError("Unexpected public Seed Bank format")
    data = json.loads(raw[len(PREFIX):].rstrip(";"))
    if data.get("schemaVersion") != 1 or not isinstance(data.get("records"), list):
        raise ValueError("Invalid public Seed Bank schema")
    return data


def normalize_packet(packet):
    """Validate and strip everything except specifically approved public fields."""
    if not isinstance(packet, dict) or packet.get("format") != "IDPSeedPublicApproval/1":
        raise ValueError("Not an approved-only Seed Vault publication packet")
    items = packet.get("items")
    if not isinstance(items, list) or not 0 < len(items) <= 356:
        raise ValueError("Publication packet must contain 1–356 approved items")
    if packet.get("permission") != "explicit_public_approval":
        raise ValueError("Public permission absent")
    out, seen = [], set()
    for item in items:
        if not isinstance(item, dict) or set(item) != PUBLIC_FIELDS:
            raise ValueError("Unexpected or missing field in proposed public item")
        if item["explicitPublicApproval"] is not True:
            raise ValueError("Explicit public approval required for every record")
        if (item["status"] not in STAGES or item["provenance"] not in PROVENANCE
                or item["confidence"] != "confirmed"):
            raise ValueError("Unreviewed completion or authorship; not publishable")
        ident = item["id"]
        title, body = item["title"], item["text"]
        if not isinstance(ident, str) or not ID_PATTERN.fullmatch(ident) or ident in seen:
            raise ValueError("Invalid or duplicate public record id")
        seen.add(ident)
        if (not isinstance(title, str) or not 0 < len(title.strip()) <= 180
                or not isinstance(body, str) or not 0 < len(body.strip()) <= 40000):
            raise ValueError("Invalid public title or text length")
        if EMAIL.search(title + "\n" + body) or PRIVATE_HINT.search(title + "\n" + body):
            raise ValueError("Potential private contact/credential/source reference; manual review")
        digest = item["contentSha256"]
        if (not isinstance(digest, str) or digest != hashlib.sha256(body.encode("utf-8")).hexdigest()):
            raise ValueError("Exact selected-witness text hash mismatch")
        if not isinstance(item["versionId"], str) or not item["versionId"].strip():
            raise ValueError("Missing approved witness identity")
        try:
            approval = datetime.fromisoformat(item["approvedAt"].replace("Z", "+00:00"))
            if approval.tzinfo is None or approval.utcoffset() is None:
                raise ValueError()
        except (ValueError, AttributeError) as exc:
            raise ValueError("Approval requires a timezone-aware timestamp") from exc
        out.append({
            "id": ident, "title": title, "text": body,
            "status": item["status"], "provenance": item["provenance"],
            "confidence": "confirmed", "source": "Curator-approved private Seed Vault",
            "notes": "Exact version approved for public display; other drafts remain private.",
        })
    return out


def apply_records(records, existing, replace=False):
    current = existing.get("records", [])
    by_id = {item["id"]: item for item in current}
    if len(by_id) != len(current):
        raise ValueError("Duplicate IDs in existing public Seed Bank")
    for item in records:
        previous = by_id.get(item["id"])
        if previous is not None and previous != item and not replace:
            raise ValueError("Already published record differs: " + item["id"] +
                             " (use --replace-existing only after review)")
        by_id[item["id"]] = item
    return {"schemaVersion": 1, "records": sorted(by_id.values(), key=lambda x: x["id"])}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("packet", type=Path, help="approved-only packet from the PRIVATE vault")
    p.add_argument("--apply", action="store_true", help="write PUBLIC approved records to repository")
    p.add_argument("--replace-existing", action="store_true", help="allow explicitly reviewed text revisions")
    args = p.parse_args(argv)
    proposal = normalize_packet(json.loads(args.packet.read_text(encoding="utf-8")))
    current = read_public()
    result = apply_records(proposal, current, replace=args.replace_existing)
    print(f"Validated {len(proposal)} explicitly approved records.")
    for row in proposal:
        print("  " + row["id"] + " — " + row["title"] + " [" + row["status"] + "]")
    print(f"Total public additions after import: {len(result['records'])}")
    if not args.apply:
        print("PREVIEW ONLY: no repository files changed. Review exact titles and text in packet before --apply.")
        return
    OUTPUT.write_text(PREFIX + json.dumps(result, ensure_ascii=True, indent=2) + ";\n",
                      encoding="utf-8")
    print("WROTE " + str(OUTPUT) + ". Commit only this sanitized file after reviewing its diff.")


if __name__ == "__main__":
    main()
