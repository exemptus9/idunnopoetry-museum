# Public compendium maintenance

As of November 4, 2026, `museum-static/projects/updates.json` is the reviewed public metadata overlay. The existing 40 source cards remain the preserved baseline. Five explicitly marked concepts bring the generated public inventory to 45. Source aliases are not automatically counted as distinct projects.

`python scripts/render_project_brand_assets.py` renders the existing 25 approved brand sets and then invokes `scripts/reconcile_public_compendium.py`. This produces both directory HTML pages, `projects/catalog.json`, the dated Now panel, conceptual filtering and navigation corrections before publication tests. Run the same command before local testing. Do not treat an unrendered source template as the current visitor-facing page.

The renderer preserves all original card IDs, titles, stages, domains and links. Only reviewed description/date changes and explicitly listed conceptual records are applied. It never reads private datasets or adjusts publication permission. Private app URLs must not be added to public metadata. A concept is not a deployment, a review date is not a creation date, and a host version record is not full browser/device acceptance.

New lexical intake remains in the owner's private creative inbox and Library. No new dictionary entries, poetry text or unpublished manuscripts were released in this update. The separate RhymeMosaic split-copy component is prepared and tested in a private integration package, NOT installed on the independent ChatGPT Sites host by this repository deployment.

Validation includes inventory parity, concept boundaries, private-URL exclusions, asset existence and real controller tests. The public Now snapshot is editorial, not an automatic export of private activity.
