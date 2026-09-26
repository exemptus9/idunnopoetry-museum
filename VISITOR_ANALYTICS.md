# Visitor analytics

The public museum is prepared for **Cloudflare Web Analytics**, but collection remains disabled until a Cloudflare Web Analytics site token is supplied.

## Why this provider

The museum is a static GitHub Pages application. Cloudflare Web Analytics can be added with a browser beacon without moving DNS or hosting, and the museum does not need to maintain its own visitor database.

## Activation

1. Create a Web Analytics site in Cloudflare for `exemptus9.github.io/idunnopoetry-museum`.
2. Copy the site token from the Cloudflare beacon snippet.
3. Set `cloudflareAnalyticsToken` in `museum-static/museum-config.js`.
4. Push the change. GitHub Pages will redeploy automatically.

Until a token is present, `museum-static/analytics.js` exits immediately and sends no analytics traffic.

## Intended reporting

Once activated, use the provider dashboard for:
- visits and pageviews
- entry and exit paths
- referrers
- country/region aggregate traffic
- device, browser, and operating-system mix
- performance/Core Web Vitals
- trends over time

The museum uses hash routes such as `#poem/123`, `#forum/...`, and `#media`. The loader declares SPA mode so internal museum navigation can be treated as navigational activity where supported by the provider.

## Privacy boundary

Do not add archive usernames, poem text, search strings, private recovery identifiers, credentials, email addresses, IP addresses, or other recovered private material as custom analytics properties. The analytics layer is for aggregate museum usage only.
