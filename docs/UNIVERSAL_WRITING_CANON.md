# Universal Writing Canon

## What it is

A single owner-controlled writing registry, implemented on the Museum's EXISTING protected editorial store. No new Supabase project, schema, passwords or auth grants are required. It retains the original canonical work IDs, all imported witnesses, source selections, source questions and book memberships.

The owner interface is `/admin/canon/`; the public current-author reader is `/canon/?destination=museum` or `/canon/?destination=rhymemosaic`. The old Museum remains a separate historical witness, not a mutable copy of the current canon.

## Start once

1. In the browser tab where you signed in, open Museum Control Center → **Universal canon**.
2. Choose **Import my canon**, select the prepared `Universal_Writing_Canon_PRIVATE.json`, and wait for local checksum verification.
3. Choose **Import privately**. The importer stores one work at a time and can pause between works. Repeating the identical package skips preserved witnesses; an existing conflicting identity stops the operation. No imported approval flag grants publication permission.

The private intake file is delivered outside this PUBLIC GitHub repository. It must never be committed here. The complete original MAX02 recovery package remains a separate preserved archive. Source data is not automatically uploaded merely because this code is deployed.

## Daily workflow

- Search by title, remembered line or stable ID. Filter by missing text, outstanding source questions, confirmed text, public release, or book collection.
- Read any preserved witness and compare it with the current selection. Exact UTF-8 hashes preserve Unicode, line endings, blank lines and final newline distinctions.
- **Use this exact text** records the owner's authorship and completeness decision for that exact witness. It does not publish.
- **Review clean selections together** lists eligible, unconfirmed CANON-A selections from the current view. Each entry expands to its exact text. Missing/excluded/redirected/questionable works are excluded; the owner explicitly chooses authorship and confirms the listed versions. This only records private canon decisions.
- **Write a new version** appends a new witness, retains previous witnesses, and clears current confirmation. A title-only edit retains the original text's line endings.
- Select **Museum current-author edition** and/or **RhymeMosaic canonical feed and reader**, then **Review and release**. The app saves a revision, separately invokes the existing owner approval and publication RPCs, and checks the resulting public text hash and destination label.
- A new private version never automatically replaces an older public snapshot. Withdrawal removes the canon release from both connected readers but cannot recall downloaded copies or third-party caches.

## Architecture and authorization

Canon work identities remain unchanged in `draft._canon.work_id` and exported manifests. The physical editorial key is `canon__<work_id>` to prevent collisions with historical overlays and to isolate withdrawal tombstones. This is an adapter namespace, not a new canonical identity.

Canon records are `museum_documents` of kind `creative`. Private `_canon` metadata retains all witnesses, their exact SHA-256 hashes, source package identity, source-selection status, book positions and decision receipts. Ordinary changes use `museum_save` and its existing optimistic revision checks; every save appends to `museum_revisions`.

The owner interface reuses `idp_museum_editor_session_v1` in same-origin session storage. It verifies the authenticated user and the existing `museum_my_role()` owner allowlist. No service-role key or privileged database credentials are present in the site.

The backend's existing owner RPCs enforce explicit revision-specific approval/publication. The canon UI additionally enforces exact selected-witness and authorship consistency. This is not a claim that a database administrator cannot change stored metadata, nor that client rules are a new independent database access-control boundary. The existing generic editor routes canon approvals to the canon workflow rather than silently bypassing its destination decisions.

`museum_publications` exposes only its existing whitelisted public fields. `_canon`, witness histories and private evidence never enter that projection. A `label` of `canon:v1:museum`, `canon:v1:rhymemosaic` or both controls the connected readers' presentation. These are PUBLIC editions, not access-controlled audiences. Destination scoping is an editorial rule, not secrecy between public sites.

The historical Museum overlay ignores the entire `canon__` namespace, including tombstones. Current-author canon releases cannot overwrite or withdraw historical community records. Empty destination manifests carry `DO_NOT_REPLACE_EXISTING_ARCHIVES` and cannot be exported through the UI as a destructive replacement.

## Books and recovery

The book filter uses preserved work-ID memberships and positions, not titles. Private candidate exports preserve the expected 49 BRANDONMEANT and 77 THE WRECKAGE ARRANGED ME placement positions. Gaps, missing text and source questions are explicit; an exported book candidate is NOT print-publication approval.

**Back up my canon** captures all supported loaded canon records (up to 5,000), complete editorial revision histories (up to 20,000 total), and every witness carried in those revisions. It compares the canon before and after capture and rejects a moving snapshot. It verifies the envelope before allowing the download. The unencrypted export is limited to 32 MB and must be kept private.

**Check a backup** recomputes checksums, verifies complete revision sequences and compares records with the current workspace. It reports matching, conflicting and absent works and makes ZERO writes. This is a canon-content backup and recovery rehearsal, not an automatic full database restore. Auth users, separate audit tables, hosting, public caches and the original external source archives are not included. A reviewed database-level restore remains separate work; no previous witness is erased to make an import pass.

## Existing RhymeMosaic application boundary

The scoped RhymeMosaic reader and approved public manifest consume the shared canonical publication snapshot. The current main RhymeMosaic Sites application, the older Vercel snapshot, and the archived Emergent database are distinct deployment targets. This release does NOT claim to rewrite those applications. An adapter must validate work IDs and exact hashes, show conflicts, preserve existing content on empty/unavailable responses, and be installed in the actual target app through its authorized editing surface.

## Verification

`test_universal_canon_core.cjs` exercises exact text, identities, source questions, duplicate/collision handling, confirmation/publication boundaries, book order and backup integrity. `universal_canon_browser.py` exercises the actual native Chromium interface and CSP against synthetic mocked API responses only. The existing Museum privacy, authorization, revision and publication tests remain applicable. No real private writing or real owner authentication token enters CI.

Before calling a release live, verify the exact merged commit's workflows and GitHub Pages deployment. Before saying the private corpus is imported, inspect its actual hosted record counts. Software deployment and private-data ingestion are separate facts.
