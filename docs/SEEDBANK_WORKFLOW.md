# Public Seed Bank ↔ Private Seed Vault

**Public:** https://exemptus9.github.io/idunnopoetry-museum/#seeds  
**Four-step help:** https://exemptus9.github.io/idunnopoetry-museum/#seed-guide

The public site holds only already-published Seeds and explicitly approved additions. The full offline private Vault is **not** served by GitHub Pages.

## Simple curator workflow

1. Open the **local** `IDP_Private_Seed_Vault_v5_PUBLISH.html` file in Chrome/Firefox. Keep this HTML private: it contains unencrypted creative source material.
2. Search for a work and open it. Decide its **completion status** and **authorship** separately. Choose exactly which preserved witness/version should be public; other witnesses remain private.
3. Under **Optional: approve this exact version**, choose a public Seed stage and check the explicit rights/publication consent box. Save review. Nothing is uploaded.
4. Select **1 · Back up private review** (private JSON) and **2 · Export PUBLIC-approved only** (public-only JSON). Do **not** share the private review JSON or private HTML as a proposed public-site update.
5. Preview the public-only packet and verify the exact title/text before publishing. To make publication easy from ChatGPT, upload only `IDP_Approved_Public_Seeds.json` and explicitly request publication.
6. Once published, refresh the public Seed Bank. Publication occurs through a reviewed repository change and GitHub Pages deployment, **not** when a private status checkbox changes.

## Local Git publication (alternative)

Run at the repository root:

```bash
python3 scripts/import_approved_seeds.py ~/Downloads/IDP_Approved_Public_Seeds.json
python3 scripts/import_approved_seeds.py ~/Downloads/IDP_Approved_Public_Seeds.json --apply
python3 -m unittest discover -s scripts -p 'test_*.py' -v
python3 scripts/check_release.py --source-only
git diff -- museum-static/data/seedbank-approved.js
```

Review the exact public text before committing **only** `museum-static/data/seedbank-approved.js`. If updating an already published record, use `--replace-existing` only after inspecting the change. A removal/unpublication requires an explicit separate edit/review.

## Privacy and authority

- Completion, authorship, source chronology, and public permission are **separate** fields.
- Public approval applies to the exact selected witness and SHA-256 hash, not automatically to other versions or future revisions.
- Only user-approved records with clear author attribution are allowed by the import script. An approved-only export is **not** cryptographically authenticated: always verify it came from the archive curator.
- The import script rejects unapproved rows, unexpected fields, unknown/third-party authorship, mismatched text hashes and obvious contact/credential indicators. Automated checks do not replace manual privacy/copyright review.
- Public JavaScript/HTML must never contain the private original Vault, its source registry, local reviews, source Drive links, or the private full seedbank snapshot.
- An ordinary status change in the private Vault **does not** authorize publication.
- The public Museum is static. It cannot access local files, use a GitHub token, or silently synchronize the private Vault. This is intentional to keep private creative drafts from leaking.

## State

Museum v3.24 adds the public navigation and reviewed publication bridge. It **does not** publish any unreviewed private Seed material. Future public releases may add new text only after approval.
