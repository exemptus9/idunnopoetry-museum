# Publishing and maintaining the Lexical Observatory

The Museum repository is the authoritative catalog for the public Observatory.
Its current records are in
[`museum-static/observatory/public.json`](../museum-static/observatory/public.json),
with the public editorial ledger in
[`museum-static/observatory/history.json`](../museum-static/observatory/history.json).
The website reads the catalog; the owner-authenticated GitHub workflow validates
and writes changes. No new database is required for this publishing path.

The separate private recovery package is an archive and review input, not a
second public catalog. Private originals must stay outside this repository and
deployment directories. Neither the browser form nor GitHub Actions is a
private notebook.

## Begin at the Author's desk

Open the [Author's desk](https://exemptus9.github.io/idunnopoetry-museum/observatory/#review)
to inspect records, source summaries, and review questions. Open
[Capture & edit](https://exemptus9.github.io/idunnopoetry-museum/observatory/#author)
to create or change an individual public entry. Record counts change as recovery
and publication continue; the current catalog and queue supply the current totals.

Working definitions, recovered conversation wording, explicit interpretations,
and pending-definition captures remain distinct. Inclusion does not establish
originality or sole authorship. A resolved operational review is not a Canon
decision. AI proposals cannot establish authorship, etymology, a coinage date,
or Canon approval. Unknown dates stay unknown.

The [Language Laboratory](https://exemptus9.github.io/idunnopoetry-museum/observatory/#laboratory)
provides on-device blend experiments and an optional local specimen shelf.
Keeping an experiment there does not publish it or create an archival record.
See the [laboratory guide](lexical-laboratory.md) for shuffle behavior and offline limits.

## Use the public author form

Open [Capture & edit](https://exemptus9.github.io/idunnopoetry-museum/observatory/#author).
For a particular entry, use a link such as
[`#author?term=suffralchemy`](https://exemptus9.github.io/idunnopoetry-museum/observatory/#author?term=suffralchemy).
The value after `term=` is its permanent slug.

1. Choose an existing entry or **Create a public entry**. Enter only text you
   intend to publish. Use the separate stage and definition-status controls:
   experimental Forge material can be public without being Canon.
2. Inspect the definition, reported components, variants, collections, and public
   provenance summary. Array fields use JSON, for example `["language", "wordplay"]`.
   Preserve an unknown historical date as unknown; publication time is not
   invention time.
3. Check the generated **Public action to approve**: `PUBLISH Headword`, or
   `WITHDRAW Headword` when withdrawing. Canon additionally requires typing the separate
   `APPROVE CANON Headword` confirmation. Confirm that the submitted material is
   intended for public revision history.
4. Select **Preview public change** and read the comparison. Nothing has been
   written at this point. Choose **Continue to publish on GitHub** for a small
   request, sign in as **exemptus9**, and inspect the prefilled public issue.
   Keep its generated title, approval sentence, marker, and JSON envelope intact.
5. Choose GitHub's **Submit new issue** to give final approval and start the
   [owner publication workflow](https://github.com/exemptus9/idunnopoetry-museum/actions/workflows/lexical-publication-request.yml).
   Submission does not guarantee a successful commit, deployment, or live
   verification. Inspect the Actions result and resulting public entry.

The prefilled issue handoff is blocked when the **full encoded URL exceeds
6,000 characters**, not when the JSON alone reaches that size. Opening the
request does not submit it. Only an issue originally opened by `exemptus9` in
the authoritative repository on trusted `main`, with the exact title
`Lexical Observatory: approved public change` and approval envelope, is accepted.
Editing an issue or adding a comment does not create a new approval event.
No live owner issue submission is implied by this guide.

For a larger request, or if the issue handoff is unavailable, retain the existing
workflow fallback:

1. Select **Copy change & open GitHub**, or copy/download the exact preview JSON.
2. On the [Lexical public editor workflow](https://github.com/exemptus9/idunnopoetry-museum/actions/workflows/lexical-editor.yml),
   sign in as the repository owner, `exemptus9`. Choose **Run workflow**, select
   **main**, and paste the exact JSON into **change_json**. Leave **commit**
   unchecked and run it to validate and preview the request.
3. Read the run summary and checks. To publish, dispatch the same JSON again on
   **main**, this time with **commit checked**. A successful run applies the
   change, runs the archive checks, commits the public snapshot, deploys Pages,
   and verifies the resulting release.
4. Check that run's result and open the updated entry. A queued or failed run,
   a copied JSON request, or a successful preview is not a published change.

The browser collects no GitHub token and does not directly mutate the catalog.
The workflow accepts only the exact owner in the authoritative repository on
`refs/heads/main`; forks, anonymous visitors, and other actors cannot use this
workflow to write. GitHub account access and branch/environment permissions
still have to permit the owner run.

Every request includes an expected current revision. If another edit lands
between preview and publication, the workflow rejects the stale request.
Reload the entry, inspect the newer record, and prepare a fresh request. Do not
solve a revision conflict by guessing a larger number or forcing Git history.
Published slugs remain stable.

## Available editorial operations

| Operation | How to request it | Result |
|---|---|---|
| Create | Select **Create a public entry**; provide a unique headword and safe slug. | Creates revision 1. An experimental capture can remain Forge with a pending definition. This publishes it; it is not private capture. |
| Update | Select **Edit a public entry**, review fields and confirm publication. | Creates a new current revision and preserves the previous public history. |
| Change stage | Select **Change lifecycle stage** and choose Forge, Lexicon, or Canon. | Records a new revision. Lexicon and Canon require a substantive definition. Canon additionally requires exact approval of this revision. |
| Withdraw | Select **Withdraw current publication**. | Removes the current entry and generated page from the active snapshot. Earlier public Git history and ledger records remain public. |
| Restore | Load public revision history, choose the entry and an available snapshot revision, then select **Restore a public revision**. | Restores the selected public snapshot as a new revision, retaining later history. Restoring Canon requires fresh exact Canon approval. |
| Reject an AI proposal | On an update, check **Remove the current AI proposal from public display**. | Writes `analysis: null`; the proposal is removed from current display while its earlier public history remains. |
| Review a relation | In Author tools, select a current public connection, load its current relationship revision, choose a decision, and preview/copy the request. | Confirms, retains as inferred, or rejects a relationship through the same owner workflow. A rejection removes the current edge and preserves the public decision history. |

The Author tools page also contains **Public relationship review**. Select an
existing public connection, choose **Inferred hypothesis**,
**Author-confirmed conceptual relationship**, or **Reject / remove current
public connection**, and review the public explanation and note. Select
**Load current public relationship revision** before previewing; a successful
history fetch is required and the form derives the relationship revision from
the public ledger. It does not assume a revision number. Confirm the public
history consent, then select **Preview relationship decision** and
**Copy decision & open GitHub**. Use the same owner-authenticated workflow:
preview with **commit unchecked**, then publish the same reviewed JSON with
**commit checked**. The server rejects stale relationship revisions.

Confirmation records an author-confirmed conceptual association. It does not,
by itself, verify an etymology, historical influence, or actual derivation.
Manual `relation_review` JSON remains an advanced fallback, including for an
edge not offered by the current-connection selector.

For example, this is the relation request structure:

```json
{
  "action": "relation_review",
  "expectedRevision": 0,
  "relation": {
    "source": "lex-weaponized-subtlespeak",
    "target": "lex-subtlespeak",
    "type": "proposed_subtype",
    "status": "inferred",
    "publicExplanation": "The proposed definition describes an aggressive or manipulative subtype; historical development remains unverified."
  },
  "publicNote": "Reviewed the public conceptual association."
}
```

Replace `expectedRevision` with the number of existing `relation_review` events
in the current `history.json`; zero is correct only when there are none. This
is the relation-review sequence, not an entry revision. Use current public term
IDs. The source, target, and type identify the edge being reviewed. Change
`status` to `confirmed` only when the stated relationship is established by
appropriate evidence or an explicit author-defined conceptual decision; this
does not automatically establish historical derivation. Use `rejected` to
remove that edge. Keep every explanation and change note safe for publication.

The underlying entry controller also accepts `publish` as a publication action.
Normal form-based updates already confirm and publish the resulting revision;
there is no separate hidden draft store behind this public editor.

## Review queue and atomic bulk changes

Open the [Author's desk](https://exemptus9.github.io/idunnopoetry-museum/observatory/#review),
or use `#review?term=slug` from a word's **Flag / categorize** link. This public
workspace filters by review state, flag, definition basis, classification,
lifecycle stage, and tag. Review state is `open`, `resolved`, or `deferred`.
Definition basis is `author_supplied`, `conversation_recovered`,
`archive_recovered`, `inferred`, or `unknown`; it describes evidence, not approval.

1. Choose an actionable queue, inspect the definition and public source
   summaries, and expand the record checklist. **Definition checked**,
   **Authorship examined**, and **Source evidence examined** stage review tags.
   They do not change attribution, evidence strength, or Canon. Explicit
   **Stage authorship decision** and **Stage evidence assessment** controls
   change those public claims and require source examination.
2. Filter the queue and select entries. Selection persists when filters change;
   check the selected count. **Select all matching** replaces the selection and,
   when more than 100 match, explicitly selects only the first 100 alphabetically.
3. Use the quick actions or **More metadata actions** for tags, collections,
   domains, classification, formation, authorship, evidence strength,
   definition status, evidence basis, review state, or review flags. Adding a flag
   automatically reopens review; a later explicit state operation may resolve or
   defer it. **Flag for author review** prepares an `author_decision` flag and an
   open review. It does not publish immediately.
4. Choose **Review & publish** or **Preview selected changes** and inspect each
   before/after record. Entries
   unchanged by the operations are omitted. Definition text itself is edited in
   the individual author form; a bulk evidence/status change does not prove a
   definition's accuracy.
5. Confirm public consent, then choose **Continue to publish on GitHub** and
   approve the prefilled issue as described above. For the larger workflow
   fallback, type `APPLY N PUBLIC CHANGES` using the actual changed-record count,
   copy the batch, preview with **commit unchecked**, then publish the identical
   reviewed JSON with **commit checked**.

Checking, staging, and previewing do not save changes. Unfinished desk work is
not persisted locally. Per-record staged decisions remain staged even when
filters hide their records; inspect the staged count and full preview.
**Undo staged decisions** removes an entry's staged operations, while **Clear
staged** clears staged decisions and shared operations. **Use recovered definition**
keeps existing developed wording and its already recorded recovery basis; it
does not recover missing definitions. See [bulk review](lexical-bulk-review.md).

A prepared batch is limited to 100 entries, 60,000 JSON characters, and the
150-KB backend request limit, with additional allowance for GitHub's input
wrapper. Split larger selections into smaller reviewed batches. Each request
checks its own expected revision; one stale revision or invalid operation rejects
the entire batch without partial publication. Reload and rebuild after a conflict.
The editor rejects duplicate IDs/slugs within a batch and nested batches.

Bulk stage changes support Forge and Lexicon only, and a developed definition is
required for Lexicon. Current Canon records are excluded from bulk editing.
Every Canon decision and revision uses the individual editor with exact author
confirmation. Review flags include `definition_conflict`, `definition_needed`,
`meaning_inferred`, `classification_review`, `variant_review`,
`attribution_review`, `source_needed`, `author_decision`, and `duplicate_candidate`.
All review notes, tags, flags, and batch notes are public and retained in history.

## Canon, evidence, and revision history

Forge → Lexicon → Canon is an editorial progression, separate from public
visibility. A Forge seed can be deliberately public. A definition cannot become
Canon through an AI score, an import, a relationship, or popularity.
Every changed Canon revision requires its own exact
`canonConfirmation: "APPROVE CANON Headword"`, together with
`confirmPublication: "PUBLISH Headword"`. Changing a Canon entry or restoring a
Canon snapshot does not silently carry an earlier approval onto new content.

The controller checks current revisions, normalizes candidate names for duplicate
checks, reserves existing slugs, and rejects unsupported fields. It projects
approved public fields through
[`build_lexical_publication.py`](../scripts/build_lexical_publication.py), rather
than copying private source objects into the deployed catalog.

The public ledger is append-only in the editor and chains each event to the
previous event's SHA-256 hash. Events include the action, actor, revision, public
note, and public snapshot where applicable. The editor verifies this chain before
applying a change. This makes ordinary alterations detectable against the
recorded chain; it is not an external notarization, an independently immutable
archive, or legal proof of first invention. Git history supplies an additional
record of published changes.

Definition version numbers and catalog revision numbers serve different purposes.
A recovered alternative can be displayed as an undated definition version.
Release timestamps identify public editorial activity, not a reconstructed
coinage date. Preserve that distinction when adding witnesses or restoring text.

## Keep private material outside the publication channel

Only public text belongs in the form, `change_json`, public change notes, source
summaries, approved excerpts, and AI proposals. Workflow previews appear in
run summaries, changes enter Git history, and public snapshots/ledger records
can be downloaded. Do not submit raw conversations, private manuscript bodies,
personal correspondence, confidential contextual notes, credentials, or private
source identifiers. Withdrawing a record cannot recall copies or erase prior
public repository history.

This is a public editorial workflow. Private capture, controlled private-source
ingestion, and server-enforced private authoring are separate backend work; a
public static form does not provide those guarantees. See
[`lexical-backend-activation.md`](lexical-backend-activation.md) for that path.

## Separate Word Archive prototype

The Lovable Word Archive remains a disconnected recovery source. At the recorded
audit checkpoint its Cloud backend was paused and the project was out of credits.
It is not required to keep the Museum catalog online and must not start a second
unsupervised source of authoritative writes.

If recovering that prototype is still useful, open its Lovable project and use
**More → Cloud → Overview → Wake up** when that control is available. A depleted
credit balance or billing requirement may need to be resolved in the project
account first. Any paid recovery is optional and separate from this public
GitHub publishing path. Do not assume a wake-up happened, that data synchronized,
or that a subscription is required for the Observatory release. Export and
reconcile recovered records before considering an integration; do not create a
new lexical database merely to bypass the paused prototype.

## Verification boundary

The editor implementation is
[`scripts/lexical_editor.py`](../scripts/lexical_editor.py), its workflow is
[`.github/workflows/lexical-editor.yml`](../.github/workflows/lexical-editor.yml),
and the original-owner issue adapter is
[`scripts/lexical_issue.py`](../scripts/lexical_issue.py), with workflow
[`.github/workflows/lexical-publication-request.yml`](../.github/workflows/lexical-publication-request.yml).
Behavior checks are in
[`scripts/test_lexical_editor.py`](../scripts/test_lexical_editor.py).
The owner workflow validates first and, when **commit** is checked, runs the
publication/archive regressions before committing and deploying. A concurrent
push can cause a safe failure; it never force-pushes over another change.

This guide documents the implemented workflow and the prepared catalog. It does
not assert that an authenticated owner edit, withdrawal, restoration, or Canon
approval has already been executed live. Confirm an operation from its actual
successful Actions run and resulting public catalog/page, not from the existence
of this guide or its JSON preview.


## Icons and social previews

Use **Share this word** or **Copy link** on an entry when posting to Threads.
These controls share `observatory/word/<slug>/`, whose first HTML response includes
its title, definition, canonical URL, PNG Open Graph image, image description and
large-card metadata. The older `?term=` links remain interactive entry links;
GitHub Pages cannot serve different crawler metadata for individual query strings.

Each approved public word has a 1200 × 630 typographic specimen card. Recovered
and inferred meanings retain their labels; seeds display “Definition pending.”
Long definitions receive an excerpt on the image and stay complete on the page.
No preview contains unapproved private text. Content-based image filenames change
when the public meaning/status changes. Withdrawals remove the current word page
and its generated image, although outside services may retain cached previews.

`build_lexical_publication.py --write` regenerates pages, previews and icon assets
from the approved projection, so owner-authorized edits also refresh their cards.
Install the renderer with `python -m pip install 'Pillow>=12,<13'`; use DejaVu fonts
(as supplied by Ubuntu/GitHub Actions). `scripts/lexical_social.py` owns the artwork.
All CI and deployment jobs render these assets before validation. Generated PNG/ICO
files are deployment output and are ignored in Git to avoid accumulating binary
revisions; the approved catalog, renderer and metadata pages remain tracked.
The identity includes SVG/ICO browser icons and a 180-pixel Apple touch icon.
A social platform decides when to fetch, cache or display a preview; the site cannot
force Threads to refresh a previously posted URL.
