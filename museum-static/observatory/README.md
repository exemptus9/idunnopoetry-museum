# Lexical Observatory public interface

This is the Museum's dependency-free public view and public edit-preparation
interface. An owner-authenticated GitHub Actions workflow owns public changes,
publication approvals, and recorded Canon decisions. No credentials, private
lexical seeds, private records, or browser "admin" switches belong here.

## Public data contract

`config.js` defaults to `./public.json`. A same-origin static snapshot or a
read-only HTTPS endpoint returns `{terms: [], relations: [], versions: []}` with
optional `generatedAt`. All three arrays are required; an invalid response is an
error rather than an apparently successful empty archive. Fetches omit cookies
and time out after 12 seconds. No private API is contacted.

Each term requires `id`, safe unique `slug`, `headword`, `stage`, and
`visibility: "approved_public"`. A Canon term also requires a matching
`canonApproval: {revision, approvedAt}` and term `revision`; mismatches are omitted
and produce a visible catalog warning. The publication server must validate the
author's approval; client checks are defensive and never provide authorization.

The static publication projection supports `definition`, `formation`, `roots`,
`domains`, `variants`, `authorship`, `evidenceStrength`, `earliestVerifiedDate`,
`provenanceSummary`, `publication`, and a relative `permalink: "word/<slug>/"`.
Unknown dates remain null. Extra approved fields can include components, senses,
verified pronunciation, examples, witnesses, and corpus references. Nested source
records and senses also require explicit `approved_public` visibility. Raw source
bodies, UUIDs, notes, and other arbitrary fields are never copied into the client
projection or its exports.

Relations require explicit `approved_public` visibility and public endpoints.
Accepted source keys are `source`/`target` or `from`/`to`; a relation may carry
`type`, `explanation` and `status: "confirmed" | "inferred"`. Inferred relationships
are dotted and explicitly labeled as hypotheses. Definition versions require
`approved_public`, `termId`, `definition`, and a documented `date` or `effectiveAt`.
Only versions with day-level dates can participate in a day-specific time-machine
query. Unknown/partial dates remain visible in the version history without a
fabricated exact effective day.

`definitionStatus` explicitly distinguishes `author_supplied`,
`working_definition`, `conversation_recovered`, `inferred_definition`, and
`awaiting_definition`. The separate `review.definitionBasis` is
`author_supplied`, `conversation_recovered`, `archive_recovered`, `inferred`, or
`unknown`. Recovery and inference are evidence categories, not author approval.
`classification` supports `coinage_candidate`, `existing_form_reinterpreted`,
`expression`, `term_seed`, `unclassified`, `proper_name`, `literary_wordplay`,
`concept_label`, `ai_suggestion`, and `existing_term`. `collections` contains
actual curated public collection labels.
Only `editorialReview.shortReason` is projected; private review rationale is not
accepted. Optional `analysis.kind: "ai_hypothesis"` displays a collapsible
formation/interpretation/distinction proposal separate from the definition,
with explicit limitations and a need for author review.

The reconciled snapshot has 132 working records: 120 Forge, 12 Lexicon, zero
Canon. Definition bases comprise 81 conversation recoveries, 26 archive
recoveries, 12 supplied definitions, and 13 explicitly inferred readings. It is
not a collection of 132 accepted or original coinages. Fifty-two reviews remain
open and 80 are operationally resolved; 11 carry definition-conflict flags.
There are 33 inferred relations, 237 public definition versions, and 137 public
source summaries, not 137 independent primary documents. Coverage includes a
1,329-post archive snapshot and focused conversation summaries, not every chat
or archive. Six newly inferred name readings are explicitly labelled:
Inner-linking, Sweetrepeats, Hurri-canary, Raincarnation, ReBased in Graces, and
Max Para-noy-mee-ya! Prior wording and conflicts remain available.

The 60 additions to the original 72-record baseline comprise 50 lexical
candidates and ten crafted project names: RhymeMosaic, techEnlight, MindVault,
EchoLens, Total Recall, Artificial Continuity, Forge Lexicon, Lexical Observatory,
Word Archive, and IDunnoPoetry. These ten are `proper_name` records with recovered
naming-role descriptions, not new dictionary-word or originality claims.
Unrecovered source timestamps remain unknown.

## Routes and behavior

- `#home`, `#archive`, `#constellation`, `#evolution`, `#laboratory`, `#methodology`,
  `#author`, and `#review`
- `?term=<slug>` opens the approved public entry; private or absent identifiers
  produce the same unavailable state. Generated `word/<slug>/` pages provide
  static canonical entry URLs.
- Archive filters cover lifecycle stage, domain, formation, and first letter.
  Search uses exact/partial matches, variant spellings, roots, tags, definitions,
  and bounded Levenshtein distance; no AI service is called.
- Definition-state and real collection filters distinguish named candidates from
  developed definitions. The home page features actual defined records rather
  than whichever names happen to sort first.
- The graph displays at most 80 terms; its keyboard-friendly relationship
  directory includes all matching public terms. Panning, zoom, highlighting, and
  evidence filtering are available without animation.
- The formation laboratory uses generic established English examples. Its local
  overlap experiment saves and transmits nothing.
- JSON export retains approved projection identifiers and revision metadata.
  CSV is a deliberately flattened public summary; formula-leading cells are
  neutralized. Public exports are not a backup of private editorial records.

## Public Author tools

`#author` is a public preparation form, not a private or authenticated inbox. It
collects only material the operator explicitly intends for publication, previews
changes before applying anything, and emits the exact `change_json` request
accepted by `scripts/lexical_editor.py`. It never stores browser drafts or tokens.

Supported requests are `create`, `update`, `stage`, `withdraw`, and `restore`.
Existing entries carry stable `id` and `expectedRevision`; new entries use
`expectedRevision: 0` and an immutable safe `slug`. Roots/domains/variants/
collections are validated JSON arrays. Forge, Lexicon, and Canon are available
stage choices; Lexicon and Canon require a substantive definition. No automatic
Canon promotion is possible. Publishing requires exact
`PUBLISH <headword>` intention; withdrawal requires a local exact
`WITHDRAW <headword>` check. Every new Canon revision, including a restoration,
requires its separate exact `APPROVE CANON <headword>` confirmation. The owner
workflow enforces the matching publication and Canon revision approvals.

The **Remove the current AI proposal from public display** checkbox prepares
`changes.analysis: null` on an update. This rejects the currently displayed
hypothesis without erasing its prior public history or silently accepting its
suggested interpretation as a definition.

The **Public relationship review** form selects an existing public connection
and prepares `relation_review`. Choose `confirmed`, `inferred`, or `rejected`,
provide a public explanation/note, and load the current relationship revision
from public history before previewing. A successful ledger fetch is mandatory;
the form derives the revision from recorded relation-review events rather than
guessing zero. Preview the decision, then copy it into the same owner workflow:
first run with **commit unchecked**, then publish the same JSON with **commit
checked**. Confirmation records an author-defined conceptual association and
does not automatically verify etymology or historical influence. Rejection
removes the current edge while retaining the public decision history. Manual
JSON is an advanced fallback, including for edges outside the selector.

`#review` provides public review filtering and an atomic bulk editor;
`#review?term=<slug>` selects an entry from its **Flag / categorize** link.
Filter by state/flag/evidence basis/classification/stage/tag, select entries,
add metadata or review operations, inspect every before/after record, and type
the exact `APPLY N PUBLIC CHANGES` confirmation. Adding a flag reopens review;
an explicit later state operation can resolve or defer it. Tags, collections,
domains, classification, formation, definition status/basis, review state/flags,
and Forge/Lexicon stage changes are supported. Edit definition text individually.

Selections persist across filter changes. **Select all matching** replaces the
selection and selects the first 100 alphabetically when more than 100 match.
Limits are 100 entries, 60,000 prepared JSON characters, and 150 KB per backend
request, subject to GitHub's input-wrapper size. Unchanged rows are omitted.
The batch is all-or-nothing: a stale revision or invalid request rejects it
without partial publication. Copy the exact preview into the owner workflow,
run with **commit unchecked** to preview, then the same JSON with **commit
checked** to publish. Current Canon records and Canon promotions require the
individual editor and separate exact author confirmation; bulk editing cannot
bypass that boundary. All review labels and notes are public history.

The optional, explicitly requested public `history.json` ledger supplies
previously public snapshots and the latest revision for withdrawn entries.
Restoration never reads a private archive. Withdrawal removes current pages but
cannot erase earlier public Git history.

After preview, **Copy change & open GitHub** copies JSON and opens
`https://github.com/exemptus9/idunnopoetry-museum/actions/workflows/lexical-editor.yml`.
The operator signs in as the repository owner, selects **Run workflow** on
**main**, and pastes into **change_json**. Leave **commit unchecked** for the
first run to validate and preview the request. Inspect the result, then run the
same JSON again with **commit checked** to apply, commit, and deploy it. The
server validates owner, repository, branch, revision, fields, and publication
intention. A successful authenticated publication run and deployment are
required; a successful preview, or preparing/copying a request, does not publish
it. Visitors cannot gain writes by using the form or changing its browser code.
If the current revision changes between preview and publication, reload the
entry and prepare a fresh request.

For public-only input rules, relationship-review JSON, withdrawal/restoration,
the hash-chained public ledger, and prototype recovery, see the
[publication guide](../../docs/lexical-publication.md). No live owner-dispatched
editor operation is implied by the existence of the form, workflow, or guide.

`editorialUrl` is optional for a future connected application. `canonicalBase`
is the verified Museum deployment path. Never populate the public archive merely
to make an exhibit look occupied.

## Verification

From the repository root:

```sh
node --test scripts/test_lexical_model.mjs
node --check museum-static/observatory/model.js
node --check museum-static/observatory/app.js
python3 -m unittest discover -s scripts -p 'test_*.py'
```

Model tests use synthetic fixtures outside this deployment directory. Browser
interaction, screen-reader behavior, contrast, and responsive appearance still
require actual browser/device QA; semantic HTML and CSS are not proof of full
WCAG conformance. No live AI, background collision research, or private archival
synchronization is claimed by this interface.
