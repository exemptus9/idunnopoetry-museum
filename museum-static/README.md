# IDunnoPoetry Messageboard Museum

A self-contained static museum generated from the sanitized IDP recovery archive.

## Historical interface reconstruction
The surviving forum configuration identifies **phpBB 2.0.6**. The board's default style was **subSilver**, with **skyLineGrey** and **Helius** also installed and selectable by members. This museum now starts in a subSilver-inspired reconstruction and provides all three historically documented board styles from the style selector. A modern museum skin remains available.

The reconstruction uses the exact palette values preserved in the IDP theme table where practical. The subSilver skin now restores surviving phpBB2 gradient cells, forum/topic folder graphics, and the mini-post marker from a public phpBB2 source mirror, while unrecovered graphics remain CSS-rendered equivalents. It recreates the square-edged phpBB2 layout, compact navigation, forum/topic tables, and the classic author-column/thread layout without pretending that unrecovered graphics survived. See `ASSET_PROVENANCE.md` for byte-level provenance and caveats.

The forum index also restores the classic phpBB-style statistics/footer treatment and a historical subSilver icon key using authentic no-new/new/locked forum graphics. The key is explicitly reference-only: the museum is read-only and does not invent viewer-specific unread state.


## phpBB2 layout fidelity

The v3.2 pass also restores recoverable structure from the phpBB2 subSilver templates: forum-index `Last Post`, forum topic-list `Author` and `Last Post`, the thread `Author / Message` header, previous/next-topic navigation, and phpBB-style breadcrumb separators. These fields are reconstructed from surviving public topic/post relationships; when the underlying post is missing, the museum says so rather than inventing it.

## Historical pagination
Both surviving SQL snapshots preserve the same phpBB configuration values: `topics_per_page = 20` and `posts_per_page = 20`. The museum reproduces those original page lengths for forum topic lists and topic posts instead of rendering entire forums/topics as one long page.

## Theme archaeology status
The official phpBB 2.0.6 package remains available in SourceForge's OldFiles archive, and period 2004 ThaiNuke archives preserve matching Helius and skyLineGrey theme packs. Those sources remain provenance targets for future Helius/skyLineGrey restoration. The core subSilver assets in this build have now been restored from a public phpBB2 source mirror and are documented separately; unrecovered Helius/skyLineGrey graphics remain CSS reconstructions rather than fabricated "original" files.


## Reversible text repair
Historical database text sometimes contains character-encoding artifacts such as `â€™`. The museum defaults to the original recovered strings, but the header includes an optional readability mode that repairs a small set of common mojibake sequences at display time only. The underlying archive data files are never rewritten by this feature.

## Open locally
Double-click `index.html`. The archive data is loaded through ordinary JavaScript files instead of `fetch()`, so the museum works from a local `file://` URL in modern browsers.

## Publish
Upload this entire folder as-is to any static host (GitHub Pages, Netlify, Cloudflare Pages, Vercel static hosting, ordinary Apache/Nginx hosting, etc.). No PHP, MySQL, build step, or server-side database is required.

## Included exhibits
- 60 recoverable forum structures
- 1,528 surviving topic IDs
- 23,957 distinct surviving public posts
- 1,403 recoverable public user IDs
- 673 selected recovered creative source records, plus preserved historical versions
- 1,327 surviving public replies to poetry threads
- public full-text search
- user/poet directory
- month-by-month timeline
- original reactions attached to forum poetry
- reclamation workflow for former members
- subSilver, skyLineGrey, Helius, and modern museum skins

## Privacy
This site does **not** contain historical email addresses, IP addresses, passwords, password hashes, or private-message bodies. Do not replace its data files with exports from the raw SQL dumps.

## Configuration
Edit `museum-config.js` to change the archive owner/contact destination.


### v3.3 subSilver navigation fidelity

The subSilver skin now uses recovered phpBB2 mini navigation icons for Forum Index, Search, Memberlist, and FAQ/About, plus the recovered `icon_latest_reply.gif` in Last Post cells. Last-post arrows route to the final surviving 20-post page for the topic. These assets are hidden in Helius, skyLineGrey, and Museum Modern until equivalent theme-specific binaries are independently recovered.
