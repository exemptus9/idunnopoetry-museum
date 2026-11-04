# Public compendium maintenance

## Source and publication boundaries

The Constellation and Continuity Atlas are two views of one reviewed project inventory. Their original 40 source cards remain the baseline. `museum-static/projects/updates.json` is the reviewed public-metadata overlay; it must never contain private app URLs, raw conversations, unpublished literary text, credentials, or personal administration records.

`scripts/render_project_brand_assets.py` renders the approved brand images and invokes `scripts/reconcile_public_compendium.py`. Reconciliation runs before publication tests. It generates both visitor pages and `projects/catalog.json`, updates the dated Now panel, and preserves stable project identifiers and baseline link/audience distinctions. Raw source HTML is a template, not necessarily the exact published page.

## November 4 verified website correction

The inventory remains **45 distinct entries**. Sacred Interval keeps its existing `project-sacred-interval` identifier but is now a reviewed **public website**, rather than an unlinked concept-only entry. The public reading site was independently retrieved. Its availability does not establish legal institutional status, treatment credentials, or verified real-world gatherings.

There are now 40 baseline entries, one explicitly allowlisted public website extension, and four retained concept extensions. Stage totals are derived from generated records: 11 public destinations, 2 previews, 27 development entries (including four concepts), and 5 historical entries. A future change must reconcile the original baseline deliberately rather than editing counts to hide a discrepancy.

`publishedProjects` is a separate metadata list from `concepts`. A public extension requires a reviewed HTTPS URL on `publicSiteAllowlist`, a dated check label, and a bounded description. Protected endpoints remain rejected. Public metadata changes must not change the audience settings of the underlying applications.

## RhymeMosaic copy controls

The older statement that the split-copy package was only prepared is superseded. The November 4 execution receipt records hosted RhymeMosaic **v44** published with visible **Copy + link | TXT** controls and earlier clipboard-content checks. A fresh independent public browser test on NightLight found both controls outside More and clicked TXT successfully, observing `Poem text copied.` The current browser test did not read clipboard bytes and did not perform a phone-size layout test. Do not turn that limited current check into a claim of fresh byte-for-byte or mobile verification.

The compendium links directly to the tested public NightLight page from its Now panel. TechEnlight's direct Sanford Resource Hub link was independently observed. These route checks do not imply that all websites, private deployments, or device workflows were retested. The native access-controlled Threads Observatory record now reports source version 16; that is a deployment-record fact, not complete owner-device acceptance.

## Lexical reconciliation

The private November 4 working index retains 203 public term records, 313 definition versions and 33 relations. Its updated private candidate list contains **43 forms** and retains 10 additional source-witness records. The follow-up added one previously omitted exact author form to the prior 42, without changing earlier candidates, the public snapshot, definition history or private source collections. Candidate counts overlap earlier catalogs and must not be added into a unique-word total. Definitions remain proposed or unresolved where appropriate. This portfolio update publishes only a bounded progress summary, not new dictionary terms or private text.

## Verification

Run the existing artwork/reconciliation pipeline, the complete Python regression suite and existing DOM journeys. New tests cover public-site allowlisting, protected URL rejection, required evidence, and stable Sacred Interval identity. The DOM tests check both public views, public versus concept filters, complete keyword-match sets, hash-link reveal, pagination, ordering and compact/gallery controls. Keyword tests derive matching project IDs from the actual reviewed inventory: cross-link descriptions can legitimately mention more than one project. Preserve all original creative publication safeguards.
