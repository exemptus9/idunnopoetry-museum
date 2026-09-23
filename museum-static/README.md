# IDunnoPoetry Messageboard Museum

A self-contained static museum generated from the sanitized IDP recovery archive.

## Current recovery state

The public museum now represents the union of the surviving forum backups plus the recovered WordPress.com archive.

- **682 recovered creative source records**
- **23,957 distinct surviving public forum posts**
- **1,528 surviving topic IDs**
- **1,403 recoverable public user IDs**
- **333 creative works linked to surviving original forum discussions**
- **1,328 surviving public replies attached to recovered poetry**
- **8 WordPress-only Brandon poems recovered:** Root-Bound; Never ! (Version); So Much More To Gain; "Soon," I Sighed (Suicide); Seasonal Change; TruthSeeker; Nice Future; Love Burden
- **1 probable community-original orphan recovered:** If I Could (unfinished), credited to angelplaya

The WordPress.com WXR export captured on September 23, 2026 remains the permanent preservation source. The live museum may also read the site's public WordPress REST API to hydrate published WordPress text/version records; that live API is an augmentation layer, not the only copy of the material.

## Historical interface reconstruction

The surviving forum configuration identifies **phpBB 2.0.6**. The board's default style was **subSilver**, with **skyLineGrey** and **Helius** also installed and selectable by members. This museum starts in a subSilver-inspired reconstruction and provides all three historically documented board styles from the style selector. A modern museum skin remains available.

The reconstruction uses the exact palette values preserved in the IDP theme table where practical. The subSilver skin restores surviving phpBB2 gradient cells, forum/topic folder graphics, mini navigation graphics, latest-reply icons, and the mini-post marker from public phpBB2 source material. Unrecovered graphics remain clearly reconstruction rather than being presented as recovered originals. See `ASSET_PROVENANCE.md`.

## phpBB2 layout fidelity

The museum restores recoverable structure from the phpBB2 subSilver templates: forum-index Last Post, forum topic-list Author and Last Post, thread Author / Message columns, previous/next-topic navigation, phpBB-style breadcrumbs, statistics/footer treatment, and a historical subSilver icon key.

## Historical pagination

Both surviving SQL snapshots preserve `topics_per_page = 20` and `posts_per_page = 20`. The museum reproduces those original page lengths.

## Revision archaeology

Recovered writing is intentionally not flattened into one canonical text. When multiple snapshots differ, their historical versions remain available. The WordPress recovery adds another dated layer to that version history, and poem pages can display an **Archive trail** summarizing preserved texts and surviving original discussion context.

## Reversible text repair

Historical database text sometimes contains character-encoding artifacts such as `â€™`. The museum defaults to the original recovered strings, with an optional display-only repair mode. Source data is never rewritten by this feature.

## Open locally

Double-click `index.html`. The base archive data uses ordinary JavaScript files rather than a server-side database.

The live WordPress augmentation requires network access. The frozen/offline recovery package remains the archival copy for those WordPress records.

## Publish

Upload this entire folder as-is to a static host. The GitHub repository includes a Pages workflow that publishes `museum-static`.

## Included exhibits

- 60 recoverable forum structures
- 1,528 surviving topic IDs
- 23,957 distinct surviving public posts
- 1,403 recoverable public user IDs
- 682 recovered creative source records, with historical versions preserved
- 1,328 surviving public replies to poetry threads
- public full-text search
- user/poet directory
- month-by-month timeline
- original reactions attached to forum poetry
- per-poem archive trails
- reclamation workflow for former members
- subSilver, skyLineGrey, Helius, and modern museum skins

## Creative media lineage

The public museum now includes a sanitized media catalog generated from the **Master Creative Archive — Brandon WordSmith** Assets tab:

- **136 cataloged creative media assets**
- **50 reconciled canonical works with linked media**
- **93 videos**
- **42 audio files**
- **1 image**
- approximately **3.58 GB** of source media
- **6 duplicate candidates** flagged for review
- source collections: Poemz2Musick, SunoV4 Poemusic, AI Poem Vidz, and Spoken Poetry

Private Google Drive IDs and direct private-storage links are excluded from the public museum. Media records are attached to matching poem pages by normalized canonical title. Files become directly viewable/playable only when deliberately published.

The first deliberately published asset is the **I Love You More** lyric image; the remaining large audio/video collection still lives in the private master archive pending a suitable public media host.

## Reader Impact evidence

The museum includes a privacy-safe **Reader Impact** exhibit built from 16 surviving historical correspondence and public-interaction records spanning 2005–2015. The records document individual experiences including long-term readership, emotional support, classroom use, teaching, adaptations, and rediscovery. Private correspondence is represented only through anonymized paraphrase; raw messages, names, email addresses, IP addresses, and Gmail identifiers are not shipped in the public site.

These records are qualitative historical evidence and are **not** used as a numerical estimate of total audience size.

## Privacy

This site does **not** contain historical email addresses, IP addresses, passwords, password hashes, or private-message bodies. Do not replace its sanitized data files with exports from the raw SQL dumps.

## Configuration

Edit `museum-config.js` to change the archive owner/contact destination.

## Build

Current museum line: **v3.9**, September 23, 2026.

### Version visibility

The current version is displayed in the public museum header, footer, About view, page metadata, and `VERSION.txt`. Version metadata is centralized in `museum-config.js`.

### Link preview

The canonical public URL includes Open Graph and Twitter large-card metadata with a dedicated 1200×630 PNG preview styled after the recovered phpBB/subSilver museum interface.
