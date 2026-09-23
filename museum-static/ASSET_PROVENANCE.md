# Visual Asset Provenance

## Evidence standard

- IDunnoPoetry itself preserves `phpBB 2.0.6`, `default_style = 1`, and installed styles `subSilver`, `skyLineGrey`, and `Helius` in its surviving database configuration.
- SourceForge still lists the official `phpBB-2.0.6.zip` release in phpBB OldFiles. That establishes the correct upstream release family for the default board engine.
- The binary subSilver assets bundled in this museum build were recovered from the public GitHub mirror `phpbb2premods/arkamod`, from the canonical `templates/subSilver/images/` paths. They were **not** directly extracted from the SourceForge 2.0.6 ZIP in this build environment.
- Therefore these files are treated as high-confidence phpBB2/subSilver assets, not as proof that the exact byte-for-byte file was present on IDunnoPoetry.
- Helius and skyLineGrey continue to use configuration-backed CSS reconstruction until their period binary theme packs can be independently ingested and compared.

## Restored subSilver assets

| Museum file | phpBB2 mirror path | Mirror blob SHA | Local SHA-256 | Use |
|---|---|---|---|---|
| `assets/subsilver/cellpic1.gif` | `templates/subSilver/images/cellpic1.gif` | `715b8d4aa8b8752fc3e2ff6deb214cd424ad413f` | `4bec563cfc212eaf0029147afa2ec8305313e03f9e51ad17d0037379d76854d0` | category header gradient |
| `assets/subsilver/cellpic2.jpg` | `templates/subSilver/images/cellpic2.jpg` | `a0ca7e89d30ba7fe010e889200d6dfe5776b1e04` | `da41bb843e4459412d598adb53938332a2f03c822b03129d3b9e51f1b1c71518` | archival row/header reference (bundled; not currently applied) |
| `assets/subsilver/cellpic3.gif` | `templates/subSilver/images/cellpic3.gif` | `ecf70e1fd1a676f021c3198caa0725c9f76dbe2e` | `10904a866d32326c50f537c60fd71b8dab04ea65d1ff578cdc0a198a238be8a9` | forum/topic column header gradient |
| `assets/subsilver/folder_big.gif` | `templates/subSilver/images/folder_big.gif` | `9b2bc47c67aa83051fcf1a312a739046b9976b8e` | `2f92c37e4afb2538bdb4b74280ae993fcbfd7f7dc041452d6d783b271af95c0c` | forum-index folder icon |
| `assets/subsilver/folder_locked_big.gif` | `templates/subSilver/images/folder_locked_big.gif` | `436f3d21c8188b5b68f0db779da1734dbeea2fdd` | `a0ce524b92133843687e59c80b8b99ec71826600fac5991f2a6fd71f68e6e94c` | historical icon-key locked-forum icon |
| `assets/subsilver/folder_new_big.gif` | `templates/subSilver/images/folder_new_big.gif` | `5eec565b382bb9e0b9280fc0387a09f5f3a4a8e6` | `32607dd51cc67edf875401ea3f9f12e7ac2accc9a2cedaa0f2d55a303ac7a25d` | historical icon-key “new posts” forum icon |
| `assets/subsilver/folder.gif` | `templates/subSilver/images/folder.gif` | `c16bfa75d5daf0c2eb6a6fd0b7f2d1a4e4a0cfcd` | `6e9cd72c5eb9526358e9607329dc1b35f4b80b8ce688ca6dc5ed97dd38728898` | topic folder icon / mobile forum icon |
| `assets/subsilver/icon_minipost.gif` | `templates/subSilver/images/icon_minipost.gif` | `d172abb0605bc5fbfa7bf18b48d24d45d327535a` | `0f43aeed00cc2a842505cd256138a488e4ab1b3f234d0931184a702b32bb4480` | post-date mini marker |
| `assets/subsilver/icon_latest_reply.gif` | `templates/subSilver/images/icon_latest_reply.gif` | `b45e57aedbb344d0a0486b3e56234b0c7fa2b416` | `3fcd30570281fe0abffe19e5738f95ce3b773c7d419fd67ca738d0367ec79669` | Last Post / go-to-last-surviving-post link |
| `assets/subsilver/icon_mini_house.gif` | `templates/subSilver/images/icon_mini_house.gif` | `f2d09716263b3a3ee46f555589bd058fbb6d7c74` | `27c00937c4a82f885b84455a39099666c9db18598446bf13f7650756365cde32` | subSilver Forum Index mini navigation icon |
| `assets/subsilver/icon_mini_search.gif` | `templates/subSilver/images/icon_mini_search.gif` | `1295e9f1db2d0d3513e8d4e6810f589bd40d3834` | `0694a2e79e13fd57b946774cc64767eede5bb89550b638b4a3a20f796fe1cabe` | subSilver Search mini navigation icon |
| `assets/subsilver/icon_mini_members.gif` | `templates/subSilver/images/icon_mini_members.gif` | `a79a5a74b27ae629430d8533b979b15b7f2777fe` | `7a91237108cf6d22c18f898de85697fe00b61d680ce25869b5056c81d043dc5f` | subSilver Memberlist mini navigation icon |
| `assets/subsilver/icon_mini_faq.gif` | `templates/subSilver/images/icon_mini_faq.gif` | `b8b873d159a993443b83f36ce779fd7c9439a760` | `b19e0c706558f8b5a3cedbf3152beb9a62d344bd5c4e205512f4c75463cc4bbf` | subSilver FAQ / About mini navigation icon |

## Deliberately not restored yet

- Generic `logo_phpBB.gif`: IDunnoPoetry had its own site identity; substituting the upstream phpBB logo would be historically misleading.
- Viewer-specific unread/hot state is not reconstructed. Historical new/locked icons may appear only inside clearly labeled visual-reference keys; they never claim a present-day unread state.
- Helius/skyLineGrey binary graphics: period packs have been located externally, but they have not yet been ingested into this build environment for file-level comparison.
- PHP-Nuke wrapper graphics from period theme packs: these will not be used unless they can be shown to belong to the phpBB template layer IDP actually used.

## Upstream references

- Official release listing: `https://sourceforge.net/projects/phpbb/files/OldFiles/`
- Public phpBB2 mirror used for binary recovery: `https://github.com/phpbb2premods/arkamod/tree/master/templates/subSilver`
- Period Helius archive located: `Pack-Helius6.5+Thai.zip` (SourceForge ThaiNuke Themes Pack, 2004)
- Period skyLineGrey archive located: `Pack-skylinegrey6.5+Thai.zip` (SourceForge ThaiNuke Themes Pack, 2004)

## Reconstructed layout provenance

The v3.2 layout pass also consulted the public phpBB2 template structure in the same source mirror:

- `templates/subSilver/index_body.tpl` — forum index columns, statistics/footer organization, and forum-state legend.
- `templates/subSilver/viewforum_body.tpl` — topic list columns (`Topics`, `Replies`, `Author`, `Views`, `Last Post`), breadcrumb/pagination placement, and topic-state legend structure.
- `templates/subSilver/viewtopic_body.tpl` — `Author` / `Message` thread header, previous/next-topic navigation, author-column geometry, and pagination placement.
- `templates/subSilver/overall_header.tpl` / `overall_footer.tpl` — outer bodyline/header/footer conventions.

Only structural conventions that can be populated from the sanitized IDP archive are reproduced. Live-only phpBB controls (posting, reply, login, PM, unread state, moderator actions, jump boxes, and permissions) remain omitted or converted into museum-safe navigation. Modified features present in the mirror but not independently supported by IDP evidence (games, karma, RPG/ADR modules, etc.) are deliberately ignored.


### v3.3 navigation/link fidelity

The header now uses recovered phpBB2 mini icons for the four museum links that map directly to original phpBB navigation concepts: Forum Index/Home, Search, Memberlist, and FAQ/About. These images are shown only in the subSilver skin. Museum-specific sections such as Poetry, Timeline, Exhibits, and Reclaim intentionally retain neutral text navigation because no historically appropriate phpBB icon is evidenced for those concepts.

`icon_latest_reply.gif` is used in Last Post cells and links to the final surviving 20-post page for that topic. This reconstructs the original phpBB “go to last post” affordance without claiming a viewer-specific unread state.
