# IDunnoPoetry Messageboard Museum

A self-contained static museum generated from the sanitized IDP recovery archive.

## Historical interface reconstruction
The surviving forum configuration identifies **phpBB 2.0.6**. The board's default style was **subSilver**, with **skyLineGrey** and **Helius** also installed and selectable by members. This museum now starts in a subSilver-inspired reconstruction and provides all three historically documented board styles from the style selector. A modern museum skin remains available.

The reconstruction uses the exact palette values preserved in the IDP theme table where practical, while replacing missing original image assets with CSS-rendered equivalents. It recreates the square-edged phpBB2 layout, compact navigation, forum/topic tables, and the classic author-column/thread layout without pretending that unrecovered graphics survived.

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