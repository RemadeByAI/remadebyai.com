# RemadeByAI clicks Worker

Counts clicks on the buttons that send visitors off remadebyai.com: **Download**,
**Visit site / GitHub**, **Source code** and the featured block's main button.
Cloudflare Web Analytics (the page-view stats) can't see those, because the
visitor leaves the site. No dependencies, one file: `src/index.js`.

How it works: `site.js` on every page sends a tiny `navigator.sendBeacon` POST to
`<worker>/click` with `{ app, kind, page }`. The link opens normally; the ping
never delays it. Nothing that identifies the visitor is stored (no IP, no cookie): counts per
app, button and day, plus (since 2026-11-28) one 90-day log entry per click with
where the visit came from: the outside page that referred it (no query string),
the first page of the visit and any utm_source/medium/campaign tags. The stats
page shows Top referrers, Campaigns, Landing pages and Recent clicks (Central time)
for the last 30 days. Each click is now 3 KV writes (about 330 clicks a day on
the free plan).

See the numbers at `<worker>/stats?key=<STATS_KEY>` (add `&format=json` for JSON):
one row per app, last 30 days and all time.

## Current setup (2026-11-22)

All in the RemadeByAI Cloudflare account (Cloudflare@remadebyai.com, account id a926b4a07e2aceb76afa8aa6f04d5781), signed in on Chrome on the owner's PC "Dennis":
- Worker `remadebyai-clicks` at https://remadebyai-clicks.remadebyai.workers.dev (workers.dev subdomain `remadebyai`).
- KV namespace `remadebyai-clicks` (id d879c0c85f7d440887a8bc0f24ce156a), bound as `CLICKS`.
- `ALLOWED_ORIGINS` plain-text var and `STATS_KEY` secret. The key was given to the owner in the project thread; it is not stored in the repo. To change it: Worker > Settings > Variables and secrets.
- Web Analytics site remadebyai.com (manual JS snippet, token in build.js) in the same account.

## Setup from scratch (Cloudflare dashboard, RemadeByAI account)

1. **KV:** Storage & databases > Workers KV > Create namespace `remadebyai-clicks`.
2. **Worker:** Workers & Pages > Create > Worker > name `remadebyai-clicks` >
   Deploy, then Edit code, paste `src/index.js`, Deploy.
3. **Bindings:** Worker > Settings > Bindings > Add > KV namespace, variable
   name `CLICKS`, namespace `remadebyai-clicks`.
4. **Variables:** Settings > Variables and secrets: plain text
   `ALLOWED_ORIGINS` = `https://remadebyai.com,https://www.remadebyai.com`, and a
   secret `STATS_KEY` = any long random string (keep it; it opens the stats page).
5. **Site:** put the Worker's URL plus `/click` (for example
   `https://remadebyai-clicks.<subdomain>.workers.dev/click`) in
   `ANALYTICS.clicksEndpoint` in `build.js`, run `node build.js`, commit and push.

Or from this folder: put the KV id in `wrangler.toml`, then
`npx wrangler deploy` and `npx wrangler secret put STATS_KEY`.

Free plan limits: Workers KV allows 1,000 writes a day, and each click uses 2,
so about 500 counted clicks a day. Past that, clicks stop being counted for the
rest of the day (the links still work). Move to Workers Analytics Engine if the
site outgrows it.
