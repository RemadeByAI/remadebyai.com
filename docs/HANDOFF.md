# Handoff notes

Last updated: 2026-11-21 (directory rework; 5 hunt picks added). Read this first when picking up work on the site.

## Where things are

- **Local source:** `C:\dev\remadebyaI\remadebyai-website` on the PC "Dennis".
- **Repo:** https://github.com/RemadeByAI/remadebyai.com (public, branch `main`).
- **Hosting:** GitHub Pages from `main` at the repo root, custom domain `remadebyai.com` (see `CNAME`). DNS A records point to GitHub Pages (185.199.108-111.153).
- **HTTPS:** Enforce HTTPS is on for remadebyai.com and desktopwiki.com. On 2026-11-21, http:// and www. both redirected to the https:// apex address.
- **Brand icon:** `C:\dev\remadebyaI\remadebyai-icon.png` (1254x1254). The original has transparent patches inside the dark panel; the site's icons were made from a cleaned copy (`assets/icon-512.png`).

## Site layout (directory structure, built 2026-11-21)

The site is a static app directory generated from one data file. **Add or change apps in `projects.json`, then run `node build.js`** (Node 18+, no packages) and commit everything it changed. The build checks the data first and refuses to build if an entry is wrong (missing field, bad date, duplicate slug, missing screenshot file).

What `build.js` writes (never edit these by hand; they are rebuilt from scratch each run):
- `apps/<slug>/index.html`: one page per app (facts table, download/site buttons, screenshots, "How it was built with AI", "Our review", more in the same category, schema.org SoftwareApplication data).
- `categories/index.html` and `categories/<slug>/index.html`: category list and one page per category (A to Z).
- `new/index.html`: every app, newest first.
- `sitemap.xml` and `robots.txt`.
- `index.html`: only the regions between `<!-- build:NAME -->` and `<!-- /build:NAME -->` markers (asset links, featured block, new arrivals, categories, filter dropdowns, the full A to Z card list, count). Everything else in `index.html` (hero, About, List your app) is hand-edited.

Other files:
- `directory.js`: only search and filters on the home page "All apps" list (group buttons, category and platform dropdowns). The cards are plain HTML, so the list works without JavaScript and no longer fetches `projects.json`. Links like `/?q=email` or `/?category=productivity` open pre-filtered.
- `partials/art-<name>.html`: artwork for the featured block, chosen by the featured entry's `featureArt` (`inbox` is the InCloseMail mock).
- `styles.css`: all styles. Layout scales to wide screens (added 2026-11-21): `.wrap` grows to 150rem, the root font size steps up at 1800/2300/3000px wide, and `.cards` is an auto-fill grid (17rem minimum), so 1080p shows 6 columns, 1440p 7 and 4K 8. Dark theme, green accent `#c2ff94`. Tile colours: `wiki`, `capture`, `code`, `glance`, `voice`, `bar`, or empty for green.
- **List your app** (`#list` on the home page): mailto to `listings@remadebyai.com` with a prefilled form-style body.
- Icons: `favicon.ico`, `assets/favicon-32.png`, `assets/apple-touch-icon.png`; link preview `assets/og-image.png` (1200x630). `assets/mark.svg` header mark, `assets/circuit.svg` hero art.
- Pages use root links (`/styles.css`, `/apps/...`), so preview with a local server at the folder root (`python -m http.server 8000`), not by opening the file.

### projects.json fields

Required: `name`, `group` (`emukey` or `open`), `owner`, `alternative` ("Alternative to X"), `description` (one or two sentences), `category`, `url`, `added` (YYYY-MM-DD, drives New arrivals).

Optional: `slug` (default from name), `icon`, `tile`, `linkText`, `download` (direct download or releases page; adds a Download button), `source` (repo link), `platforms` (any of Windows, macOS, Linux, Web, iOS, Android), `license` (e.g. MIT, GPL-3.0, Proprietary), `price` (Free, Freemium, Paid), `maker` (who makes it), `longDescription` (paragraphs separated by a blank line), `screenshots` (list of `{ "src": "/assets/apps/<slug>/1.png", "alt": "...", "caption": "..." }`), `builtWithAI` (how AI was used, with the source of that claim), `review` (`{ "date", "body", "verdict", "version", "author" }`).

Featured (one entry only): `featured: true`, plus `tagline`, `featureText`, `featureLinkText`, `featureArt`.

Only state facts that have been checked. Leave unknown fields out; the page hides them.

## Cache busting

- `build.js` adds a content hash to the `styles.css` and `directory.js` links on every page (`?v=<hash>`), so there is nothing to bump by hand. Just rebuild after changing either file.

## Working rules

- Nothing is pushed or published without the owner's explicit OK ("Commit and push" / "Go live" buttons). Going live is never implied.
- On the PC, `gh` defaults to the DennisBaker account, which is not in the RemadeByAI org. The org account is dpb1999. Switching accounts (`gh auth switch --user dpb1999`) needs the owner's own typed OK.

## Open items

- Email: all four domains (emukey.com, desktopwiki.com, inclosemail.com, remadebyai.com) are healthy in one Microsoft 365 tenant. emukey.com is the only user; the others are shared mailboxes. Do not suggest removing domains or null MX. DMARC (checked 2026-11-21): desktopwiki, inclosemail and remadebyai are `v=DMARC1; p=none`; emukey.com keeps `rua=mailto:dmarc@emukey.com`. Only safe tightening later: p=none -> quarantine.
- listings@remadebyai.com (used by the List your app button) must exist in Microsoft 365 as a shared mailbox or alias; owner to set up.
- After the next push, check the link preview with a sharing debugger (for example LinkedIn Post Inspector or opengraph.xyz).

## Ideas

- **Contact form (owner todo, 2026-11-21, later):** add a form on the site so visitors don't have to use email. The owner has two domains on Cloudflare for this: enclosemail.com and desktopwiki.net. Plan: send form submissions from enclosemail.com to contact points such as listings@remadebyai.com. Likely build: a Cloudflare Worker that receives the form and sends the mail (Cloudflare Email Routing / send_email), with Turnstile for spam protection. Keep the mailto as a fallback.

- **Contact / "list your app" (live 2026-11-21 as d725de8; see Site layout):** the site needs a way for people to contact us, mainly so app makers can ask to have their app listed. Options: a mailto to an emukey.com address or a remadebyai.com shared mailbox (M365 receives mail for that domain), a hosted form service (e.g. Formspree), or a GitHub issue template on the repo.
- Fill in platforms, licence, maker and "built with AI" details for the existing listings (only verified facts), and add screenshots under `assets/apps/<slug>/`.
- Later, as the list grows: pagination or "load more" on the home A to Z list, platform pages (`/platforms/windows/`), and a reviews index page.
- More projects in the directory. Added 2026-11-21: FreeFlow (Wispr Flow alternative) and Open Source Barware. open-cleanmymac (github.com/p-raj/open-cleanmymac) was left out because it has no stated license; revisit if it adds one. Added 2026-11-21 from the app hunt: PhotoCraft (Graphics), PdfCraft, WordCraft and GridCraft (new Office category) and micasa (new Home category), giving 12 apps in 9 categories.
