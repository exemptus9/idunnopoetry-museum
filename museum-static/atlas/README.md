# Continuity Atlas · public visitor navigation layer

This is a **new editorial user interface** connecting four distinct published experiences. It is not original historical IDP software, a new canonical database, or a shared account system.

## Destinations and source integrity
- `/classic/`: read-only reconstruction of historic IDunnoPoetry main website, 106 historical static poem witnesses; original bytes in `/classic/witnesses/` are untouched.
- `/`: publicly sanitized historical forum museum; its own search route is `/#search/<query>`.
- `https://rhymemosaic.com/`: separately maintained living literary collection. We deliberately do not invent work-to-work equivalences or a deep-link query parameter.
- `/observatory/`: independently published public coined-word/lexical catalogue; the documented search route is `/observatory/?q=<query>#archive`.

## Functionality
- All 106 poems are indexed *client-side* by genuine text from their historical reconstruction pages; search includes entire text and title, with historical static `poetry.shtml` order as tiebreaker.
- The index is derived from verified `data/poems.json` manifest rows and verified SHA-256 of original `witnesses/poems` files. No private forum data is included.
- Local history for original poem pages uses only `localStorage` key `idp_atlas_read_v1` for the most recent eight accessed entries. Visitors can clear it on the Atlas page. No query is sent to the museum or Observatory except when the visitor clicks the explicit link.
- Reading paths are editorial/interpretive and explicitly distinguished from composition chronology, original ordering, and approved canonical revisions.
- Non-JS fallbacks retain all destination links, timeline, editorial source qualifications, and initial reading-path links.
- Light dependency footprint: plain static HTML, CSS, JavaScript, and a self-contained original-poem search index. No third-party JavaScript, fonts, trackers, ads, cookies, accounts, credentials, runtime services, or backend.

## Test guidance
- Check `scripts/test_atlas_integration.py` in the repository to verify link paths, index cardinality and originals. `museum-static/classic/tests/verify.py` independently validates original poem source hashes and internal links.
- Check homepage, classic poems, museum search, Observatory search, RhymeMosaic exit, and mobile/keyboard use in an actual browser.

## Evidence caution
Dates describe surviving source file metadata or identifiable public notices, not dates of poem composition. Historical visual layout is reconstructed where the root `style.css` was missing. Original lyrics and art may have third-party rights considerations; Atlas provides links rather than reproducing those works anew.
