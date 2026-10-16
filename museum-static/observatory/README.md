# Lexical Observatory public interface

This is the Museum's dependency-free, read-only public view. The authoritative
editorial workspace owns captures, changes, publication approvals, and Canon
decisions. No credentials, private lexical seeds, private records, or browser
"admin" switches belong in this directory.

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

## Routes and behavior

- `#home`, `#archive`, `#constellation`, `#evolution`, `#laboratory`, `#methodology`
- `?term=<slug>` opens the approved public entry; private or absent identifiers
  produce the same unavailable state. Generated `word/<slug>/` pages provide
  static canonical entry URLs.
- Archive filters cover lifecycle stage, domain, formation, and first letter.
  Search uses exact/partial matches, variant spellings, roots, tags, definitions,
  and bounded Levenshtein distance; no AI service is called.
- The graph displays at most 80 terms; its keyboard-friendly relationship
  directory includes all matching public terms. Panning, zoom, highlighting, and
  evidence filtering are available without animation.
- The formation laboratory uses generic established English examples. Its local
  overlap experiment saves and transmits nothing.
- JSON export retains approved projection identifiers and revision metadata.
  CSV is a deliberately flattened public summary; formula-leading cells are
  neutralized. Public exports are not a backup of private editorial records.

`editorialUrl` remains empty until a verified secure authoring application is
available. `canonicalBase` is the verified Museum deployment path. Never populate
the public archive merely to make an exhibit look occupied.

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
