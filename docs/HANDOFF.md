# Handoff notes

Last updated: 2026-11-22 (featured slot rotates between InCloseMail and DesktopWiki; live at fa6995d: 23 apps in 11 categories; ArtCraft sweep live at 4061f1c: 28 apps in 12 categories). Read this first when picking up work on the site.

## Where things are

- **How to work (since 2026-11-21):** do site work in a cloud session on the attached repo. Cloud sessions can commit and push to GitHub directly, so a "Commit and push" button tap is enough. PC-based Remote Control sessions can't push on a button tap.
- **PC copy is stale:** `C:\dev\remadebyaI\remadebyai-website` has uncommitted edits identical to 2c52a37. Before any local work there, run `git checkout -- . && git pull`.
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
- `partials/art-<name>.html`: artwork for the featured block, chosen by the featured entry's `featureArt` (`inbox` is the InCloseMail mock, `wiki` the DesktopWiki mock).
- `styles.css`: all styles. Layout scales to wide screens (added 2026-11-21): `.wrap` grows to 150rem, the root font size steps up at 1800/2300/3000px wide, and `.cards` is an auto-fill grid (17rem minimum), so 1080p shows 6 columns, 1440p 7 and 4K 8. Dark theme, green accent `#c2ff94`. Tile colours: `wiki`, `capture`, `code`, `glance`, `voice`, `bar`, or empty for green.
- **List your app** (`#list` on the home page): mailto to `listings@remadebyai.com` with a prefilled form-style body.
- Icons: `favicon.ico`, `assets/favicon-32.png`, `assets/apple-touch-icon.png`; link preview `assets/og-image.png` (1200x630). `assets/mark.svg` header mark, `assets/circuit.svg` hero art.
- Pages use root links (`/styles.css`, `/apps/...`), so preview with a local server at the folder root (`python -m http.server 8000`), not by opening the file.

### projects.json fields

Required: `name`, `group` (`emukey` or `open`), `owner`, `alternative` ("Alternative to X"), `description` (one or two sentences), `category`, `url`, `added` (YYYY-MM-DD, drives New arrivals).

Optional: `slug` (default from name), `icon`, `tile`, `linkText`, `download` (direct download or releases page; adds a Download button), `source` (repo link), `platforms` (any of Windows, macOS, Linux, Web, iOS, Android), `license` (e.g. MIT, GPL-3.0, Proprietary), `price` (Free, Freemium, Paid), `maker` (who makes it), `longDescription` (paragraphs separated by a blank line), `screenshots` (list of `{ "src": "/assets/apps/<slug>/1.png", "alt": "...", "caption": "..." }`), `builtWithAI` (how AI was used, with the source of that claim), `review` (`{ "date", "body", "verdict", "version", "author" }`).

Featured: `featured: true`, plus `tagline`, `featureText`, `featureLinkText`, `featureArt`. More than one entry can be featured (since 2026-11-22: InCloseMail and DesktopWiki). The build renders all of them in the featured block, and a small inline script shows one at random on each page load. Without JavaScript the first featured entry in `projects.json` shows.

Only state facts that have been checked. Leave unknown fields out; the page hides them.

## Cache busting

- `build.js` adds a content hash to the `styles.css` and `directory.js` links on every page (`?v=<hash>`), so there is nothing to bump by hand. Just rebuild after changing either file.

## Working rules

- Nothing is pushed or published without the owner's explicit OK ("Commit and push" / "Go live" buttons). Going live is never implied.
- In cloud sessions, work on the session's `claude/...` branch and merge to `main` only after the owner taps "Go live".
- On the PC, `gh` defaults to the DennisBaker account, which is not in the RemadeByAI org. The org account is dpb1999. Switching accounts (`gh auth switch --user dpb1999`) needs the owner's own typed OK.

## Open items

- Email: all four domains (emukey.com, desktopwiki.com, inclosemail.com, remadebyai.com) are healthy in one Microsoft 365 tenant. emukey.com is the only user; the others are shared mailboxes. Do not suggest removing domains or null MX. DMARC (checked 2026-11-21): desktopwiki, inclosemail and remadebyai are `v=DMARC1; p=none`; emukey.com keeps `rua=mailto:dmarc@emukey.com`. Only safe tightening later: p=none -> quarantine.
- listings@remadebyai.com exists and is a verified Cloudflare Email Routing destination (2026-11-22).
- After the next push, check the link preview with a sharing debugger (for example LinkedIn Post Inspector or opengraph.xyz).

## Ideas

- **Contact form (live 2026-11-22 as 4328a65):** the List your app section has a form (`contact.js` + `#list-form` in `index.html`) that posts to the Cloudflare Worker `remadebyai-forms` at https://forms.enclosemail.com/submit, which checks Turnstile and emails listings@remadebyai.com from forms@enclosemail.com. Code and setup notes: `forms-worker/`. The mailto button stays as a fallback.
- **Contact form (original plan):** add a form on the site so visitors don't have to use email. The owner has two domains on Cloudflare for this: enclosemail.com and desktopwiki.net. Plan: send form submissions from enclosemail.com to contact points such as listings@remadebyai.com. Likely build: a Cloudflare Worker that receives the form and sends the mail (Cloudflare Email Routing / send_email), with Turnstile for spam protection. Keep the mailto as a fallback.

- **Contact / "list your app" (live 2026-11-21 as d725de8; see Site layout):** the site needs a way for people to contact us, mainly so app makers can ask to have their app listed. Options: a mailto to an emukey.com address or a remadebyai.com shared mailbox (M365 receives mail for that domain), a hosted form service (e.g. Formspree), or a GitHub issue template on the repo.
- Listing details (2026-11-21): the 10 open-source listings now have verified platforms, licence, maker, download links and (where the evidence exists) built-with-AI notes, checked from each repo's README, LICENSE and commit history. PhotoCraft, PdfCraft, WordCraft, GridCraft, micasa and macshot have 2 screenshots each in `assets/apps/<slug>/` (WebP, 1600px wide, taken from the projects' own READMEs). Done 2026-11-22: InCloseMail, DesktopWiki and Open Source Barware filled in from their sites via the owner's Chrome (sites are blocked from cloud fetches); their screenshots are hotlinked from their own sites. Done 2026-11-22: InCloseMail and DesktopWiki built-with-AI note set to "Built largely with Claude Opus 5.5." (the owner's words). Still missing: screenshots for Locode, Glance and FreeFlow (their READMEs only have a logo or animated GIFs). Locode has no evidence of being built with AI, so its built-with-AI section stays empty.
- Later, as the list grows: pagination or "load more" on the home A to Z list, platform pages (`/platforms/windows/`), and a reviews index page.
- **App hunt 2026-11-22 (live 2026-11-22 as fa6995d, after the owner tapped Go live):** added 11 apps, giving 23 apps in 11 categories (new categories Video and Utilities): FilmCraft, EffectCraft, LightCraft, VectorCraft, FigCraft, DeckCraft (ArtCraft suite), Davit (Docker Desktop alt), OpenTodo (Todoist), SaneBar (Bartender), SuperCmd (Raycast; open-source v1 free, v2 paid) and MindZJ (Obsidian). Each has 1-2 screenshots from its own README and a built-with-AI note from a commit-history count (Claude co-authored commits, checked 2026-11-22) or the maker's own words. Skipped: Vorssaint (only ~3% Claude commits), OpenKnowledge and BetterWispr (no AI evidence), MenuBuddy (duplicate of SaneBar), SoundCraft (pre-alpha). Shortlist: /mnt/project-files/app-hunt/2026-11-22-shortlist.md.
- **ArtCraft (storytold) sweep 2026-11-22 (live as 4061f1c after the owner tapped Go live):** all 69 repos in github.com/storytold reviewed. Added CADCraft (AutoCAD), TextureCraft (Substance 3D Painter) and MaterialCraft (Substance 3D Designer) in a new "3D and CAD" category, DesignCraft (InDesign) in Graphics and ArtCraft Launcher (Creative Cloud app) in Utilities, with 2 README screenshots each. All 15 ArtCraft listings now carry a per-repo count of commits co-authored by Claude (counted 2026-11-22, one count per commit). Not listed: SoundCraft (labels itself pre-alpha), AniCraft (v0.2 early alpha, only 29 of 1,307 commits by Claude), Craft Anything (an AI coding tool, 17 of 1,628), ArtCraft itself (AI image/video generation IDE, 5 of 70 commits, not a remake), AutoCraft (maintainer bot), and libraries, test corpora, forks and old Unreal/voice repos. ArtCraft logos are not used; tiles use plain symbols. Revisit SoundCraft and AniCraft when they reach alpha/beta. Shortlist: /mnt/project-files/app-hunt/2026-11-22-artcraft-sweep.md.
- **Popular-apps hunt 2026-11-22 (branch claude/project-thread-mivtog, not live until the owner taps Go live):** the owner asked for well-known apps. Added 8, giving 36 apps in 16 categories (new categories TV, Reading, Messaging, Audio): Clean Your TV (~60k stars, Google TV home/debloat), Voicebox (~61k, ElevenLabs/Wispr Flow), Bitchat (~37k iOS + 8k Android, Jack Dorsey, WhatsApp), OpenSEO (~28.5k, Semrush/Ahrefs), Readest (~26.6k, Kindle/Apple Books), Inbox Zero (~13k, Superhuman/Fyxer), Free My TV (~6.6k, TV home screens) and Ferrite (~1.9k, Typora; README says 100% written by Claude). Each has README screenshots and a built-with-AI note (Claude co-authored commit counts checked 2026-11-22, plus maker statements or press: Business Insider on Bitchat/Goose, Voicebox "built and maintained with Capy"). Checked and skipped for weak AI evidence (under ~5% Claude commits and no maker statement): Mole, Pake, Kaku, OpenCut, Ice, LocalSend, AFFiNE, Excalidraw, Immich, Zen, Helium, Cap, Ghostty, Logseq, Hyprnote, Twenty, Actual, Karakeep (7%), Omarchy (16% but a Linux setup, not a remake), Handy (10%, FreeFlow covers it). PriceGhost skipped (no licence, stale). Notes: /mnt/project-files/app-hunt/2026-11-22-popular-apps.md.
- **GitHub search works from cloud sessions (2026-11-22):** `gh api -X GET search/repositories -f q='...' -f sort=stars` finds high-star repos (e.g. README text "built with Claude Code", topic:vibe-coding); `gh api repos/...` is blocked, but `repo:a/b repo:c/d` in a search returns stars and licences.
- **Checking AI evidence from the cloud:** `git clone --filter=blob:none --no-checkout https://github.com/<owner>/<repo>` works (github.com web pages and api.github.com are blocked), then count commits whose message has `Co-authored-by: Claude`. raw.githubusercontent.com also works for READMEs.
- More projects in the directory. Added 2026-11-21: FreeFlow (Wispr Flow alternative) and Open Source Barware. open-cleanmymac (github.com/p-raj/open-cleanmymac) was left out because it has no stated license; revisit if it adds one. Added 2026-11-21 from the app hunt: PhotoCraft (Graphics), PdfCraft, WordCraft and GridCraft (new Office category) and micasa (new Home category), giving 12 apps in 9 categories.
