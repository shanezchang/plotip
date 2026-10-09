# Traffic and search visibility

## Vercel Web Analytics

Dashboard: https://vercel.com/shanes-projects-025e82ba/plotip/analytics

The official pinned `@vercel/analytics` package runs only on the HTTPS production hostname `plotip.vercel.app`. Local development, forks and preview hostnames are excluded. DNT or GPC disables collection. Only homepage pageviews are allowed; query strings and fragments are removed. Lookup inputs, IP results, range selections and clipboard actions are not custom analytics events. No account or analytics cookies are added. Analytics failure does not block lookup.

Use the existing Hobby allocation; no paid upgrade or custom events are enabled. Current limits: https://vercel.com/docs/analytics/limits-and-pricing

Read-only reporting from the repository root:

```sh
vercel project inspect --non-interactive
vercel metrics vercel.analytics.page_view.count --since 7d --format=json
vercel metrics vercel.analytics.page_view.count -a unique/visitorId --since 7d --format=json
```

Pageviews and estimated visitors are different from API requests, successful queries or registered users. Reporting starts after activation; previous visits cannot be reconstructed. Automated verification must not spoof real visitors or manufacture events. Empty reports can reflect reporting delay, privacy settings or blockers.

## Google Search Console

URL-prefix property: https://plotip.vercel.app/

Sitemap: https://plotip.vercel.app/sitemap.xml

Keep the public `google-site-verification` HTML tag in `web/index.html` after verification. `robots.txt` permits the homepage and excludes `/api/`; canonical and sitemap URLs use the production hostname. Search Console tracks Google search impressions, clicks and indexing status separately from website analytics. Verification and sitemap submission do not guarantee indexing.
