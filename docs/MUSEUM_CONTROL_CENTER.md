# Museum Control Center — private backend and editorial overlays

**Status: source implemented and testable; hosted backend NOT yet activated.**

Public Museum: https://exemptus9.github.io/idunnopoetry-museum/  
Private editor shell: https://exemptus9.github.io/idunnopoetry-museum/admin/

The original static IDunnoPoetry source records remain unchanged. The control center stores curator **overlays**, not rewrites of the recovered SQL/forum/poetry backups.

## Architecture

- museum-static/admin/index.html — browser editor, authorization and revision UI; no third-party CDN.
- supabase/migrations/20261008_museum_editorial_backend.sql — private draft records, revisions, audit events, owner/editor allowlist, public projection, RLS, and approval/publish/withdraw RPCs.
- museum-static/admin/public-overlay.js — visitor pages read ONLY the approved public projection, never private drafts.
- museum-static/admin/cms-config.js — empty by default; public project URL and publishable API key ONLY.
- scripts/test_museum_backend.sql — disposable PostgreSQL role and publication tests.
- scripts/test_museum_control.py — public-vs-private regressions.

## Activation: explicit owner action needed

1. Choose the Supabase organization and approve the checked project cost. No new paid project may be provisioned without confirming pricing and permission.
2. Create the approved Supabase project and apply the SQL migration only after confirming backups/target scope. The migration seeds NO private writing.
3. Supabase Authentication: disable open self-signups; invite one owner email via the dashboard. Configure the Auth redirect URL for the deployed admin URL, including /admin/. Prefer a separate administration origin to isolate authentication from public historical pages.
4. Sign in using the invitation or magic link, and find the authorized Auth user UUID in the project dashboard.
5. In the privileged Supabase SQL Editor, after substituting the actual verified UUID, run:

    insert into public.museum_editors(user_id,role)
    values ('YOUR_VERIFIED_AUTH_UUID', 'owner');

No website user is able to self-register as an administrator; the allowlist is populated only through privileged administrator action.

6. After testing RLS, configure only the project URL and its PUBLISHABLE key in museum-static/admin/cms-config.js. NEVER put a service-role or secret key, database password, token, private Vault file, or original notebook into the public repository.
7. Release the configured assets on the approved host. Before activation, the editor intentionally shows a setup screen instead of pretending to be an active backend.
8. Test a harmless sample: create draft → save → preview → approve exact revision → publish → verify in public Museum → change draft (must invalidate approval) → withdraw → confirm tombstone → restore a prior revision. Separately verify a signed-out user cannot read drafts or edit.
9. To bring in a private Seed, select a local v5 Seedbank JSON file in the editor, search locally, and choose ONE record. Saving the selected work to the hosted PRIVATE database requires a separate explicit confirmation. The file itself is not automatically uploaded.
10. Set up verified database backup/restore and recovery before making the cloud database the authoritative copy of any private corpus.

## Supported edit categories and current scope

The admin browser can create revisioned overlays for Seeds, poems, reconciled creative works, existing forum posts/topics/rooms, user display names, media records, prose/documents, curated Museum pages, exhibits, Reader Impact summaries, site labels, custom navigation links, and a site accent color.

Edits to original historical material are overlays and annotations; original sources remain preserved.

Limitations: this is an extensible first implementation, not yet an exhaustive editor of every field in the reconstructed forum, the site layout, all CSS, original databases, advanced media uploads, or every archive import. A drag-and-drop page builder, bulk corrections, richer media editing, and sensitive historical takedowns need further phases. Do not claim they already exist.

## Publication and editorial authority

An owner/editor can SAVE a private draft, producing a numbered revision with optimistic concurrency checks. The owner must separately APPROVE the exact saved revision and then PUBLISH. Any subsequent edit invalidates that approval. Restoring a previous version creates a new revision instead of deleting history. Unauthorized actors have no direct database write privileges.

Only whitelisted public fields are projected into the visitor-readable table: title, text, description, status, provenance, public_note, URL, alt text, label, color. Private review rationales, notebook source paths, credentials and entire Vault data stay private. Authorship, completion and permission to publish remain separate decisions.

RLS is enabled on every table. Roles come from a privileged allowlist, never self-granting user profile data. The public site uses only the approved public projection with a publishable key; do not confuse the publishable key with authorization for private data.

## Withdrawal limitations

A CMS withdrawal creates a public tombstone and hides the content in the live rendered interface. It DOES NOT erase already-public original bytes in Git history, static data files, browser caches, backups, search indexes, or third-party mirrors. For a sensitive historical takedown, perform an additional controlled source audit, repository/static rebuild and deployment/cache strategy. Do not promise retroactive erasure of public materials.

If the backend is configured but its public projection cannot be fetched, the Museum UI shows a temporary unavailability notice rather than silently disregarding a withdrawal. Direct historical source files may still be independently reachable. Version history is protected against ordinary client edits but is not a cryptographically tamper-proof ledger.

## Validation

Run Python unit/privacy tests, JavaScript syntax checks, static museum release checks, and disposable PostgreSQL RLS/publish integration tests. The GitHub workflow at .github/workflows/museum-cms-ci.yml performs these tests automatically.

Before production, verify dedicated admin-origin isolation, rate limiting, MFA, security headers, backup restoration, actual browser auth flows, publish/withdraw propagation, field validation, and Supabase security advisors.

**Do not describe this backend as live until a Supabase project is provisioned, RLS confirmed, owner access established, and real end-to-end API/browser testing passes.**
