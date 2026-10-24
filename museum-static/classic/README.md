# IDunnoPoetry.com — main-site reconstruction (public static release)

**Prepared:** 2026-10-24  
**Scope:** Recover historical site's main navigation, graphics, author poetry and select supplemental features. This is NOT the separately deployed IDP Messageboard Museum.

## Open the reconstruction

Double-click `index.html` in any modern browser. All internal pages and poem texts work offline, including poem search, sorting, print, readable/classic toggle, gallery, and the original word-list generator. No installation, database, tracking or external dependencies are required. The forum museum link is external.

## Source evidence

- `idp original1.zip` (SHA-256 `45eab061f883d85d5717e3e06b772da5dd57f19d07c0e9ebf650148617b9def4`) — original header, 106 indexed poem texts, `index.php`, `faq.shtml`, `art.shtml` and custom PHP.
- `idp original2.zip` (SHA-256 `7e8b720cd96047b3858be545a46fcc95e33a257ab1602230567137a7b0a6cf30`) — restored original logo/backgrounds/sidebar graphics and 18 gallery images.
- Root `style.css` missing; the sibling `/idp/style.css` was recovered. Current `assets/css/site.css` is a new reconstruction, documented in comments.
- `witnesses/poems/*.txt` stores unmodified source bytes, with hashes listed in `data/poems.json`. Do not confuse these historical witnesses with the approved literary canon.

## Important limitations

1. The original production poetry/member/rating MySQL rows are not in these archives; **no ranks, ratings, member accounts or posting dates have been invented**. The original top-ten home feature is disclosed as unavailable.
2. Original `links.shtml` is missing. That page is an honest stub.
3. Old PHP and forum applications are **not executed** or deployed; archived versions used obsolete APIs and contain credentials. Original database credentials, authentication material, logs, private correspondence, and member photographs are **not in this package**.
4. The artwork gallery includes third-party imagery and references to Nine Inch Nails lyrics. This public historical exhibition preserves the author's archived site art; third-party imagery and lyric references retain unresolved rights questions. Request takedowns or corrections through the project repository. Public pages use `index,follow` and canonical URL metadata. No private community images or passwords were added.
5. This is a reconstruction of surviving archival eras, not a pixel-perfect recreation of one objectively dated snapshot. Some source files were updated through 2011; poem-source archive timestamps date the files, not their composition.
6. No current canonical RhymeMosaic text, site or database was changed.

## Verification

Generated files: `poems/*.html` (106), original witnesses `witnesses/poems/*.txt` (106), `art-1.html`–`art-4.html`, static navigation and assets.
Run `python3 tests/verify.py` to check poem count, SHA-256 checksums of original bytes, internal links and original gallery files.

## Next-stage release

For a custom domain, verify ownership and configure domain DNS separately. The site remains a historical, read-only exhibit, with one-way links to the independently hosted forum museum. Original database content can be layered in separately if authentic dumps emerge.
