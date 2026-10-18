# Museum Control Center — private backend and editorial overlays

**Status (October 18, 2026):** Hosted Supabase project active, original editorial migration installed, one allowlisted owner, GitHub Pages connected. Database save/approve/publish/withdraw was verified transactionally and rolled back. Synthetic client DOM tests are part of CI. Authenticated end-to-end production browser publication and database restore are separate acceptance gates.

Public Museum: https://exemptus9.github.io/idunnopoetry-museum/  
Private editor shell: https://exemptus9.github.io/idunnopoetry-museum/admin/

The original static IDunnoPoetry source records remain unchanged. The control center stores curator **overlays**, not rewrites of the recovered SQL/forum/poetry backups.

## Architecture

- museum-static/admin/index.html — browser editor, authorization and revision UI; no third-party CDN.
- supabase/migrations/20261008_museum_editorial_backend.sql — private draft records, revisions, audit events, owner/editor allowlist, public projection, RLS, and approval/publish/withdraw RPCs.
- museum-static/admin/public-overlay.js — visitor pages read ONLY the approved public projection, never private drafts.
- museum-static/admin/cms-config.js — configured with the public Supabase project URL and publishable API key ONLY. No service-role or secret key belongs in the repository.
- scripts/test_museum_backend.sql — disposable PostgreSQL role and publication tests.
- scripts/test_museum_control.py — public-vs-private regressions.
- scripts/test_museum_control_dom.mjs — synthetic browser DOM coverage of quick capture, owner role, dirty-state protection, stage filtering, private export, and the rule that saving never publishes.

## Using the editor now

1. Visit https://exemptus9.github.io/idunnopoetry-museum/admin/ in the same browser used for the sign-in link. The existing Supabase owner account is already allowlisted.
2. Choose **Find a preserved poem** and search the public recovery archive by title or text; or choose **Start a private Seed**. Neither action publishes.
3. Edit and inspect the selected record. **Unsaved changes** are visibly flagged; changing records, leaving the tab, and switching categories requires acknowledging any unsaved work.
4. Choose **Save PRIVATE draft** to create an audit-tracked revision. The **Review stage** filter lets the owner find drafts, approvals, publications, and withdrawals.
5. If and only if the exact stored revision is intended for public release, use **Approve** and then **Publish**, separately. A new edit blocks public actions until saved, and any new stored revision must be reapproved.
6. **Export loaded private drafts** is an explicit, unencrypted local JSON download of *up to 1,000 records loaded in the editor*. It is **not** a verified database backup: it excludes revision history, audit events, the original recovered corpus and anything outside the loaded page. Store the file privately.

### Known activation and security limits

- The project is in Supabase organization `exemptus9's Org`, project `idp-museum-editorial`, region `us-east-1`, with owner authorization already established. No private source text was seeded.
- All five editorial tables use RLS. The privileged, authenticated RPCs remain flagged by Supabase's security advisor; they check the privileged curator allowlist and require explicit publication phrases. Continue testing these controls; a static audit is not an independent security certificate.
- Supabase Auth's URL Configuration must retain the live `/admin/` URL. The former `localhost:3000` setting caused broken email redirects.
- Before treating the private cloud database as an irreplaceable master, implement a **verified** full database backup/restore and a real authenticated browser publication-withdrawal test.
- Site operators should consider a dedicated administration origin and appropriate MFA, rate limiting and access-control hardening.
- The existing Museum website remains public; authentication gates only the editor's private data API, not the static archive's historical source files.

## Original activation recipe (for disaster recovery; currently completed)

1. Choose the Supabase organization and approve the checked project cost. No new paid project may be provisioned without confirming pricing and permission.
2. Create the approved Supabase project and apply the SQL migration only after confirming backups/target scope. The migration seeds NO private writing.
3. Supabase Authentication: disable open self-signups; invite one owner email via the dashboard. Configure the Auth redirect URL for the deployed admin URL, including /admin/. Prefer a separate administration origin to isolate authentication from public historical pages.
4. Sign in using the invitation or magic link, and find the authorized Auth user UUID in the project dashboard.
5. In the privileged Supabase SQL Editor, after substituting the actual verified UUID, run:

    insert into public.museum_editors(user_id,role)
    values ('YOUR_VERIFIED_AUTH_UUID', 'owner');

No website user is able to self-register as an administrator; the allowlist is populated only through privileged administrator action.

6. After testing RLS, configure only the project URL and its PUBLISHABLE key in museum-static/admin/cms-config.js. NEVER put a service-role or secret key, database password, token, private Vault file, or original notebook into the public repository.
7. Release configured assets on the approved host. If the project is deliberately unconfigured on a future environment, the editor must show a setup screen.
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
