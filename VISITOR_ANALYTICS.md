# Visitor analytics

The public museum, project directory and Lexical Observatory send anonymous public-page counts to the owner's Creative Traffic Observatory. The museum uses an optional Cloudflare loader separately; its token remains independently configured at deployment and is not required by the Observatory.

The Observatory records only approved public section paths, aggregate device and approximate-country categories, referring website names and outbound-link counts. Search/reclaim inputs, archive usernames, review or authoring routes, private materials, form contents, full referring URLs and raw network addresses are not stored in its analytics records. Session identifiers are random and hashed by project and day. Records are retained for up to 180 days.

Visitors can turn off the Observatory statistics in `traffic-privacy.html`; Do Not Track and Global Privacy Control are respected. Counts do not identify people or establish anonymity. Historical archive counts are not current audience traffic.
