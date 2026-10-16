# Public lexical review and atomic batches

The public authoritative snapshot is `museum-static/observatory/public.json`.
`history.json` contains only previously approved public records and their public
definition versions. Private recovery files never belong in either file or in
workflow inputs. A public review note is visible to everyone.

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
fails, no catalog, pages, or ledger are written. Preview is the workflow default;
the owner checks `commit` to authorize the successful batch's commit and deploy.

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
