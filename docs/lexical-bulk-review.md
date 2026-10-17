# Public lexical review and atomic batches

Open the [Author's desk](https://exemptus9.github.io/idunnopoetry-museum/observatory/#review).
Use a specific entry's link such as
[`#review?term=suffralchemy`](https://exemptus9.github.io/idunnopoetry-museum/observatory/#review?term=suffralchemy).
Individual definition editing, capture, Canon decisions, and relationship review
are at [Capture & edit](https://exemptus9.github.io/idunnopoetry-museum/observatory/#author).

The public authoritative snapshot is `museum-static/observatory/public.json`.
`history.json` contains only previously approved public records and their public
definition versions. Private recovery files never belong in either file or in
workflow inputs. A public review note is visible to everyone.

## Read, check, and stage

1. Choose **All entries**, **Open questions**, **Needs definition**, **Needs
   source**, **Authorship questions**, **Inferred meanings**, or **Resolved**.
   Search and filters narrow the queue. Queue buttons reset the other filters.
2. Expand the record's checklist and approved public source summaries. Checking
   **Definition checked**, **Authorship examined**, or **Source evidence examined**
   stages the corresponding review tag. The definition check is unavailable for
   undeveloped definitions. A marker records examination; it does not change
   attribution, evidence strength, definition basis, review state, or Canon.
3. Select entry checkboxes for shared actions. **Needs a source** reopens review;
   **Resolve review** changes its operational state. **Use recovered definition**
   retains current developed wording and requires an existing conversation or
   archive recovery basis. It does not retrieve missing wording.
4. Use **Stage authorship decision** or **Stage evidence assessment** to change
   those explicit public claims after source examination. These also stage the
   corresponding checked marker. Qualitative evidence is not proof of absolute
   originality. **More metadata actions** exposes the other supported fields.
5. Inspect the staged count and choose **Review & publish**, or **Preview selected
   changes**. Inspect every before/after record. Unchanged entries are omitted.
   Confirm that the entire request and public batch note belong in public history.

Selections persist across filter changes. **Select all matching** replaces the
selection and takes only the first 100 alphabetically when more than 100 editable
entries match. Current Canon records are excluded. Per-record staged decisions
remain staged even if filters hide them; inspect the full preview. **Undo staged
decisions** removes one record's staged operations; **Clear staged** removes
staged decisions and shared operations. The page does not persist unfinished desk
work locally. Checking, staging, or previewing does not save or publish anything.

## Approve through GitHub

For a small request, select **Continue to publish on GitHub**. Sign in as owner
**exemptus9**, inspect the prefilled public issue, then select **Submit new issue**.
That final submission authorizes the request and starts the owner-only
[publication workflow](https://github.com/exemptus9/idunnopoetry-museum/actions/workflows/lexical-publication-request.yml).
It does not guarantee successful deployment: inspect the Actions result and
resulting public catalog/page before treating the change as live. Opening the
prefilled issue does not submit it. No live owner submission is asserted here.

When the **full encoded URL exceeds 6,000 characters**, the issue handoff is
blocked and the interface offers **Copy batch & open workflow**. Confirm public
consent and type the displayed `APPLY N PUBLIC CHANGES` phrase for this fallback.
In the [owner workflow](https://github.com/exemptus9/idunnopoetry-museum/actions/workflows/lexical-editor.yml),
choose **main**, paste the exact JSON into **change_json**, and first run with
**commit unchecked**. Inspect the preview, then run the identical JSON with
**commit checked** to publish. Copy/download controls remain available. The small
issue route instead uses the owner's final submission as approval and does not
require typing the fallback phrase locally.

Both paths enforce the original owner, authoritative repository, trusted branch,
publication intent, and expected revisions. The browser collects no GitHub token.
See [publication instructions](lexical-publication.md) for individual edits,
relationship decisions, restoration, and privacy boundaries.

## Review metadata

Each term may carry exactly this public shape:

```json
{
  "review": {
    "state": "open",
    "flags": ["source_needed", "attribution_review"],
    "definitionBasis": "conversation_recovered",
    "note": "An explicitly public editorial question."
  }
}
```

States: `open`, `resolved`, `deferred`.

Flags: `definition_conflict`, `definition_needed`, `meaning_inferred`,
`classification_review`, `variant_review`, `attribution_review`, `source_needed`,
`author_decision`, `duplicate_candidate`.

Definition bases: `author_supplied`, `conversation_recovered`, `archive_recovered`,
`inferred`, `unknown`. These describe the definition's evidence, not proof of
coinage or originality. Notes are limited to 2,000 characters.

Definition statuses also support `conversation_recovered` and
`inferred_definition`; both can describe developed provisional definitions.
They remain distinct from Canon. A blank or placeholder definition cannot enter
Lexicon or Canon, regardless of its status label.

Classifications distinguish `coinage_candidate`, `existing_form_reinterpreted`,
`expression`, `term_seed`, `unclassified`, `proper_name`, `literary_wordplay`,
`concept_label`, `ai_suggestion`, and `existing_term`. Classification never grants
Canon status or changes authorship.

## Atomic owner-dispatched batch

```json
{
  "action": "batch",
  "changes": [
    {
      "action": "update",
      "id": "existing-stable-id",
      "expectedRevision": 1,
      "changes": {"tags": ["reviewed"]},
      "confirmPublication": "PUBLISH Exact Headword"
    }
  ],
  "confirmBatch": "APPLY 1 PUBLIC CHANGES",
  "publicNote": "An explicitly public batch explanation."
}
```

The controller accepts 1–100 individual requests, rejects nested batches and
duplicate stable IDs/slugs, and checks every expected revision. Every resulting
Canon revision still needs its own exact `APPROVE CANON Headword` confirmation.
All requests are applied to copied state using one timestamp. If any request
fails, no catalog, pages, or ledger are written. The manual workflow defaults to
preview; the owner checks `commit` to authorize writing and deployment. The
separate issue path uses the owner-opened approval envelope as its authorization.
Current Canon records and Canon promotion are unavailable in the bulk interface;
use the individual editor with exact author confirmation.

The local request ceiling remains 150 KB. GitHub's documented
[`workflow_dispatch` input ceiling](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onworkflow_dispatchinputs)
is 65,535 characters across inputs, so 100 records are not guaranteed to fit in
one dispatch. The public UI imposes a conservative 60,000-character prepared-JSON
ceiling and checks nested input serialization. Reduce the selection when the
transport limit is reached. Splitting into multiple batches makes each batch
atomic, not the entire series.

## Historical preservation and delegated imports

Term revision numbers and definition version numbers are independent. A new
definition version uses the existing maximum plus one. Ledger snapshots retain
every already-public definition version, including genuinely undated wording.
Withdrawal removes current public pages; it cannot erase public Git history.
Restoration creates a new revision and retains all intervening public history.

`append_event` reprojects approved term snapshots before adding them to the public
ledger; private records and undocumented metadata shapes are rejected. Recovery
imports must first produce an explicitly approved public projection. A delegated
initial release records actor `assistant_editor` and approval method
`author_delegated_editorial_review`; it must not imply the owner manually clicked
each entry. Future owner-authenticated dispatches record `owner_action`.

GitHub authentication, repository-owner checks, and the trusted main-branch
workflow protect writes. Browser code only prepares public change requests and
does not collect GitHub tokens. No recurring service or paid API is introduced.

### Adopting an AI reading

When a record has a distinct AI hypothesis, its review drawer shows the exact proposal and an optional **Use this proposed reading as the working definition** checkbox. This stages an inferred definition for the before/after preview; it preserves authorship and history and does not approve Canon. Unchecking reverses that staged adoption. Publication still requires your owner-authenticated GitHub approval.
