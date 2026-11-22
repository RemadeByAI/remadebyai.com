# RemadeByAI clicks Worker

Counts clicks on the buttons that send visitors off remadebyai.com: **Download**,
**Visit site / GitHub**, **Source code** and the featured block's main button.
Cloudflare Web Analytics (the page-view stats) can't see those, because the
visitor leaves the site. No dependencies, one file: `src/index.js`.

How it works: `site.js` on every page sends a tiny `navigator.sendBeacon` POST to
`<worker>/click` with `{ app, kind, page }`. The link opens normally; the ping
never delays it. Nothing about the visitor is stored (no IP, no cookie), only
counts per app, button and day in Workers KV.

See the numbers at `<worker>/stats?key=<STATS_KEY>` (add `&format=json` for JSON):
one row per app, last 30 days and all time.

## Setup (Cloudflare dashboard, RemadeByAI account)

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
