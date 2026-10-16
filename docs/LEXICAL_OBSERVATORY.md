# Lexical Observatory — recovered foundation

The Museum public frontend lives at `/observatory/`. It is dependency-free,
uses no private browser administrator toggle, and reads only an approved public
projection. The prior `feature/lexical-observatory` branch remains untouched as
historical evidence; its public flags, Canon labels and dates are not approvals.

## Source of truth

The existing **Word Archive** project is the intended authoritative editorial
store. Its existing Supabase schema is reused by the additive hardening migration;
no third lexical database is provisioned. Database activation and an authenticated
end-to-end workflow must pass before calling that store operational. Museum is a
read-only public presentation of approved records. RhymeMosaic and Continuity are
linked destinations, not automatically synchronized databases.

## Public snapshot contract

`museum-static/observatory/public.json` contains `terms`, `relations`, and
`versions`. The checked-in starting snapshot is empty. It is not a recovered
private archive. No candidate is public because it appears in a mission prompt.

Generate a publication from an editorial export with:

```sh
python3 scripts/build_lexical_publication.py --input /absolute/path/approved-export.json
python3 scripts/build_lexical_publication.py --input /absolute/path/approved-export.json --write
```

The first command is a dry run. The second produces the fixed-field public JSON,
readable `/observatory/word/<slug>/index.html` pages with DefinedTerm metadata,
canonical URLs, and a sitemap. Terms require `visibility: approved_public`, a
positive `revision`, and `publication.approvedRevision` equal to that revision,
plus `publication.approvedAt`. Canon additionally requires a separate
`canonApproval` for that exact revision. These export declarations reflect an
editorial decision; the build tool does not prove priority or manufacture consent.

Private fields are never copied. Private endpoints and unapproved relationship
targets are excluded. Published historical definitions require their own public
visibility. Rebuilding after withdrawal removes the generated term page and
sitemap entry. Previously public bytes may remain in Git history and caches;
withdrawal is not retroactive erasure.

The optional remote endpoint must serve the same safe contract and allow the
Museum origin through CORS. It must enforce all authorization on its server.
Client filtering is only defense in depth. An unavailable feed produces an
explicit error, never a fallback to private drafts.

## Editorial and evidence rules

Forge, Lexicon, and Canon describe editorial maturity. Operational review states
are separate. Canon needs an authenticated human decision. Public visibility also
needs its own decision. Usage, scores, popularity, and AI analysis confer neither.
Coinage dates stay null unless evidence supports them. Source dates, import dates,
and revision dates are distinct. Relationship inference is labeled separately
from confirmed association; shared meaning alone is not historical derivation.

Private recovery artifacts stay outside this public repository. The import
package preserves old records in full, but treats old dates and classifications
as reported claims, not verified facts. Definition disagreements remain visible
rather than destructively overwriting one another.

## Verification and release

```sh
python3 -m unittest discover -s scripts -p 'test_*.py'
python3 scripts/check_release.py --source-only
```

The separate Lexical Observatory GitHub Actions workflow uses a disposable
PostgreSQL 16 database to execute the legacy-schema fixture, migration and role
tests. Passing those checks validates the supplied migration in a disposable
environment, not activation of the actual Word Archive project. Production still
requires backup, owner provisioning, actual migration application, authenticated
API tests, and a restore exercise.

The existing Pages workflow deploys `museum-static/` from `main`. A commit on a
feature branch is not a deployment. Check the workflow result and actual public
URLs before reporting a release as live.

## Deliberately incomplete

No paid AI research service, vector index, automatic corpus ingestion, community
submission system, recurring crawler, domain purchase, or scheduled synchronization
has been activated. Collision research is source-limited and belongs in the
editorial review process. Browser visual and assistive-technology verification
must be reported separately from source and model tests. Public entry indexing
becomes meaningful after the author approves the first exact public revisions.
