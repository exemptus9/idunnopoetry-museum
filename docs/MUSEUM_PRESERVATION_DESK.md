# Museum Preservation Desk

A source-preserving extension of the authenticated Museum Control Center.

**Design principle:** keep the work, keep its identity, and keep the way back. Recovery, canonical authority, authorship, and permission to publish are separate facts. A source file cannot grant itself administrative authority.

## Open the desk

Visit the existing Museum Control Center at `https://exemptus9.github.io/idunnopoetry-museum/admin/`, authenticate with the already-authorized curator account, and choose **Preservation desk** in the top action group. No new account, infrastructure or database schema is needed.

The dialog has three keyboard-operable tabs. Left/Right arrows, Home and End move between tabs. Escape closes the dialog and returns focus to its opening control. On narrow screens the desk fills the viewport; revision columns stack instead of creating horizontal scrolling. Imported text is always rendered as text, never executable HTML.

## 1. Revision lens

Select a saved editorial record and choose **Read saved history**. The editor reads that record and all its saved revision rows through the existing authenticated API. History is retrieved by ascending version with keyset pagination, up to 5,000 revisions. The current record is read both before and after history capture; a change during capture aborts the result instead of exporting a silently inconsistent snapshot.

Validation requires exactly one revision for every integer from 1 to the record's current revision, matching document IDs, and exact current title/draft equality with the last revision. An incomplete history is not presented as complete.

The two comparison selectors can compare any saved witnesses. The lens retains the original text strings, including whitespace, Unicode distinctions, CRLF, CR, LF and the presence or absence of a final newline. Its bounded line comparison marks additions, removals and unchanged lines. The dynamic-programming grid is capped at 350,000 cells; larger changes receive a clearly labeled coarse middle section. The detailed display is capped at 1,600 rows, but the recovery bundle retains the complete supported history.

**Restore earlier witness as a new private revision** uses the existing `museum_restore` function with the selected document ID, historical version and expected current revision. The user must confirm. It does not overwrite earlier history, approve the new revision, or republish the public record. Authorization and stale-revision rejection remain server-side.

## 2. Canon bridge

This connects existing canonical registries to the editor; it does not create a competing canon or guess identities from titles.

Accepted inputs, limited to 8 MiB and 5,000 records:

- A JSON array of work records.
- A JSON object containing a `works` or `records` array.
- A MAX02-style HTML report containing exactly one inert `<script id="work-data" type="application/json">` data block. Only this block is parsed. The report HTML and executable scripts are never inserted into the application DOM or executed.

Supported record fields:

```json
{
  "work_id": "stable-work-id",
  "title": "A source title",
  "canonical_text": "Exact source text\r\n",
  "sha256": "64 lowercase hexadecimal characters",
  "canonical_witness_id": "optional-preserved-witness-id",
  "source_id": "optional-source-id",
  "canon_status": "source-reported classification",
  "public_export_approved": false
}
```

The stable `work_id` is required and duplicate IDs reject the import. The browser recomputes SHA-256 over the exact UTF-8 text. Missing or mismatched hashes block staging through this bridge. Missing text remains missing; the software never reconstructs it from summaries.

Standalone ellipses, replacement characters and song-section labels produce source-quality warnings. A warning is not automatic proof of corruption, nor a license to repair the text. The curator must inspect the actual witness and explicitly acknowledge its quality before staging a flagged work. No text is silently normalized, shortened, polished or relabeled.

**Stage this one exact witness privately** places one verified witness in an unsaved `creative` editor record using the original `work_id` as its stable key. It does not upload the registry or save the record. A separate **Save PRIVATE draft** confirmation is required to upload that one work. If that stable ID is already present in the loaded editor, it opens the existing record unchanged rather than overwriting it.

The private draft retains `_canonical_source` metadata: work, witness and source IDs; text and registry hashes; the source-reported canonical label; and an explicit `publication_permission: "NOT_IMPORTED"`. Authorship starts unresolved for the editor's own authorization workflow. Source-reported publication flags are visible as historical claims but are never replayed as approvals. The server's public projection whitelist excludes `_canonical_source`.

The complete imported file remains only in the page's memory, not session storage, a remote search index or a public repository. Signing out clears file controls, imported text, record IDs, candidate titles and rendered recovery data. Closing the tab discards this unsaved local intake; preserve the original file independently.

## 3. Recovery rehearsal

From a loaded Revision lens, **Export verified work-history bundle** creates an explicitly confirmed, unencrypted private JSON download containing one current editorial record and its complete supported saved history. It is not the older loaded-drafts-only snapshot.

Envelope:

```json
{
  "format": "IDP-Editorial-Recovery-v1",
  "data": {
    "scope": "one-editorial-record",
    "source": "editor origin",
    "exportedAt": "ISO timestamp",
    "record": {},
    "versions": []
  },
  "sha256": "digest of deterministic serialization of data"
}
```

The envelope is verified before download. Deterministic serialization sorts object keys, preserves array order and values, rejects unsafe prototype-related keys and excessive nesting, and does not normalize text. A checksum detects accidental inconsistency; it is not a digital signature, proof of authorship, or approval.

Reopen the downloaded file in **Recovery rehearsal**. The software recomputes the checksum, verifies every revision and the current head, and compares its title/draft with the corresponding loaded editorial record. Results distinguish matching content, a missing loaded record, and conflicting content. This operation performs **zero database writes** and never restores imported approvals or automatically overwrites newer text.

### Explicit recovery boundary

This is a complete **one-record revision-history** bundle within its advertised limits, not a complete database backup. It excludes authentication, allowlists, database roles/functions, the separate audit-event table, public projection state in other systems, the recovered historical archive, and other works. It is unencrypted; treat it as private writing. Keep copies outside public folders and retain separate original archives. A real full-database restore remains a separate operational test.

## Integration contracts

`preservation-core.js` is dependency-free and has no network/storage or authorization logic. It supplies deterministic hashing, exact-text statistics, bounded diffs, registry adapters, bundle validation and a read-only recovery plan.

`preservation-desk.js` renders the dialog and invokes only the narrow `IDP_EDITOR_WORKSPACE` bridge. That bridge exposes cloned current state; authenticated history reads; confirmed one-work staging; confirmed revision restore; and opening an existing record. It exposes no tokens, arbitrary SQL, role changes, publication endpoint, generic remote fetch, or arbitrary table writer.

The existing editor retains its explicit private-save/approve/publish/withdraw process. Its save/restore operations now lock mutable form controls while pending. Refresh-token requests are single-flight within the tab. Unchanged textarea content keeps its original CRLF string rather than accepting browser newline normalization. Private draft extension fields survive ordinary edits; public projection still uses the server whitelist.

The Constellation and metadata-only Continuity handoff remain useful navigation/transfer routes. **This release does not automatically synchronize canonical text to RhymeMosaic, publish book files, or create a shared login across projects.** A later author-approved public projection needs a work-level permission manifest and independently verified destination adapter.

## Verification

`node scripts/test_preservation_core.cjs` checks 32 invariants including exact hashes, Unicode distinction, reversible diff rows, bounded comparison, corrupt/incomplete/duplicate history rejection, stable registry IDs, inert report parsing and refusal to replay publication approval.

`python scripts/preservation_browser.py` exercises 32 real Chromium UI checks with synthetic authentication and intercepted fixture APIs. Normal CI mode uses a virtual HTTPS origin, native browser WebCrypto and the actual page CSP. It checks history selection, download/read round-trip, tamper rejection, concurrent capture detection, private restore semantics, local report intake, exact CRLF saving, provenance retention, mobile overflow, Escape/focus return and sign-out clearing. Unrecognized network hosts are blocked in the test. No production credentials or real private writing are used.

For restricted local environments only, `TEST_IN_MEMORY=1` runs the same interface with mocked storage/digest/API boundaries and explicitly reports that real-origin CSP/WebCrypto was not established by that run. It is not the default CI mode.

The existing Museum static/privacy regressions, two curator DOM suites and disposable PostgreSQL authorization tests remain required. Automated checks are evidence of the tested behavior, not an independent security certification or proof of the owner's physical-device experience.

## Release acceptance checklist

- The actual branch source passes both existing and new tests.
- A new PR is merged only after its tested head is confirmed.
- Pages deployment and its public-release verifier complete successfully.
- Production asset presence is checked separately from authenticated UX.
- No private registry, test session, real source text, service-role key or private bundle is committed to the public repository.
- No paid infrastructure or database migration is introduced.
- Full database recovery and destination-specific public canonical projection remain accurately marked as separate work.
