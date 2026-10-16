# Word Archive backend activation

Status: prepared and executed against a disposable PostgreSQL engine. **Not applied to the existing Supabase project.** The public Museum can run safely with its empty, approved-only snapshot while activation is blocked. Do not label a queued Lovable task a deployment.

## Existing authority and exact files

Reuse Word Archive, Lovable project `26a03cd5-5449-48a8-b166-04df08a8ff59`, existing Supabase ref `qocuyqvjjcgazloahhvc`. The audited code checkpoint was `b7189f2e5773beae409d5c51d7056cd61b3c14fe`. Do not provision another lexical database.

- Recovery migration: `supabase/migrations/20261016_lexical_observatory.sql`
- Recovered schema-only test fixture: `scripts/fixtures/word_archive_schema.sql`
- Disposable PostgreSQL test: `scripts/test_lexical_backend.sql`
- Museum publication validator: `scripts/build_lexical_publication.py`

The fixture contains the two original September 30 schema migrations. It contains no historical lexical records. **Never run the test harness against production:** it creates roles, schema, and synthetic fixtures.

```sh
psql "$LEXICAL_DISPOSABLE_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/test_lexical_backend.sql
```

The recovery migration was developed while the existing Lovable SQL endpoint returned `UNAVAILABLE`, its REST reads returned HTTP 502, and its unpublished preview returned HTTP 403. Live row counts, current admin identities, migration application, Supabase Auth, PostgREST permissions, and production route behavior remain unverified. A historical assistant reported 35 seed terms, unsupported year-only dates, and a Canon classification; that report is not a current database count or approval record.

## Activation order

1. Restore access to the existing project and inspect current migration history, tables, grants, roles, counts, and records. A separate queued Lovable implementation may introduce schema changes: reconcile those before using this migration. Keep a schema/data export outside the public repository; verify that it can be restored. No production backup is claimed here.
2. Run the standalone SQL harness against disposable PostgreSQL 16. Review schema drift against the recovered fixture. The migration is transactional, preserves legacy terms/UUIDs/definitions/source dates/raw notes and old definition/event tables, and records a new recovery baseline. It does not seed, delete, merge, promote, or publish personal terms.
3. Apply the reviewed recovery migration through the existing project's authorized SQL editor or migration process. Its filename is a prepared recovery file, not a claimed entry in the remote migration history. Confirm the migration transaction committed and capture actual post-change counts.
4. Keep `lexical_private` excluded from PostgREST's exposed schemas. It has RLS and no client table grants. Its narrowly granted functions are called through `public.lexical_*` wrappers; the public read intentionally returns only explicit publication snapshots. Do not expose private tables, generic `SELECT *` endpoints, or service-role credentials.
5. Verify the author's actual Supabase Auth UUID, then provision exactly that identity in `public.user_roles`. No sign-up, first visitor, email string supplied by the browser, `user_metadata`, or AI task may appoint an admin. Existing role rows are preserved. Example, only after the UUID is verified:

```sql
INSERT INTO public.user_roles(user_id, role)
VALUES ('<verified-author-auth-uuid>'::uuid, 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

6. Wire the existing Word Archive server/UI to the RPCs below, check Auth with verified access tokens, and test with signed-out, non-admin, and approved-admin sessions. The old direct `.from('terms')` reads will intentionally fail after hardening; replace them before releasing the app. Raw table reads must never be re-granted to make a page work.
7. Inspect recovery imports in a dry run, then commit exactly the reviewed payload/token. New imports always enter private Forge, regardless of supplied stage or visibility. Reconcile existing user-approved wording rather than overwriting it. Review legacy Canon/date labels separately. All personal candidate recovery content remains outside the public repository and has not been imported into the live backend.
8. Approve individual publication snapshots deliberately. Before any approval, the public snapshot will be empty even if old rows say `visibility='public'`. This prevents unverified legacy visibility and inherited raw/private source access from being treated as current consent. Existing data remains stored for the author.
9. Execute actual Supabase role/API tests and direct route smoke tests before publication. Only then publish the existing Word Archive project and connect the Museum public-feed URL.

## RPC contract

| Function | Access | Behavior |
| --- | --- | --- |
| `lexical_public_snapshot()` | Anonymous/read-only | `{terms,relations,versions,generatedAt,schemaVersion}`; approved snapshots only |
| `lexical_editor_snapshot()` | Explicit admin | Private terms, revision snapshots, events, relationships, witnesses, import summaries |
| `lexical_capture(p_term,p_note)` | Explicit admin | Minimal capture; private Forge; no inferred date or creator; duplicate check |
| `lexical_save(p_id,p_expected_revision,p_changes,p_reason,p_canon_confirmation,p_publish_confirmation)` | Explicit admin | Atomic save, optimistic concurrency, new immutable revision; explicit lifecycle decision |
| `lexical_restore(p_id,p_revision,p_expected_revision,p_reason)` | Explicit admin | Restores wording as a new private Forge revision; retains originals |
| `lexical_review_relation(p_id,p_approve,p_public,p_public_note,p_evidence)` | Explicit admin | Reviews an existing relation; separately approved public explanation |
| `lexical_import_preview(p_payload)` | Explicit admin | Validates and classifies duplicates; token binds exact payload and current plan |
| `lexical_import(p_payload,p_preview_token)` | Explicit admin | Private, source-ID-aware, repeatable import; preserves existing wording and full original job payload |
| `lexical_rollback_import(p_job,p_reason)` | Explicit admin | Archives unchanged imported terms; preserves edited entries and all originals |

The import envelope is `{ "sourceSystem": "Museum-Observatory-recovery-f6637fab-MAX-LEX-01", "terms": [...] }`. Each term may supply `sourceId`/`id`, `headword`/`term`, and draft `definition`. The private original job preserves richer fields even where this first adapter does not normalize them. Limits: 500 terms, 2 MB; dry run must succeed before commit. Rich senses, sources, and relationships require review/adapters; their existence in a private original payload is not an implemented normalized import.

Every Canon save requires `APPROVE CANON <exact headword>`. Publishing additionally requires `PUBLISH <exact headword>`. Neither popularity nor an AI operation can supply editorial approval. Canon and publication are independent. Public versions are publication-approved snapshots, not private revision history. Edits to working text do not silently change the last approved public snapshot; explicit unpublishing revokes it. Restoring old wording never restores Canon/public approval implicitly.

Public terms carry `publication.approvedRevision/approvedAt` and, for Canon, `canonApproval.revision/approvedAt`. Public metadata omits actor UUIDs. Relationships require separately approved public status plus both published endpoints. `earliestVerifiedDate` comes only from separately approved verified witnesses, never a seed/import timestamp. Private source rows remain private by default; source approval and relationship creation UI are still required.

For Museum integration, implement `GET /api/public/terms` using the publishable-key RPC above. On backend failure return HTTP 503, not an empty-success claim. Allow CORS only for the approved Museum origin (`https://exemptus9.github.io`), `GET/OPTIONS`, and never credentials. SSR details and sitemaps must read the same approved projection. Private/unknown slugs return 404; workbench routes are `noindex`. The static publication script adds a second fixed-whitelist validation layer.

## Limits and recovery

The revision ledger is append-only to normal client/editor roles and contains a SHA-256 chain. A database owner can still alter the database; these hashes and timestamps alone are not independent legal proof of priority. Import recovery archives rather than deletes. A verified production backup/restore process, source-approval editor, relationship-creation/editor audit history, advanced ingestion adapters, deployed Auth/UI, and live permission tests remain release work. No recurring service, external AI provider, embedding workload, or paid plan was added.
