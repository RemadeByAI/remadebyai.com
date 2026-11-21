# Handoff notes

Last updated: 2026-11-21. Read this first when picking up work on the site.

## Where things are

- **Local source:** `C:\dev\remadebyaI\remadebyai-website` on the PC "Dennis".
- **Repo:** https://github.com/RemadeByAI/remadebyai.com (public, branch `main`).
- **Hosting:** GitHub Pages from `main` at the repo root, custom domain `remadebyai.com` (see `CNAME`). DNS A records point to GitHub Pages (185.199.108-111.153).
- **HTTPS:** Enforce HTTPS is on for remadebyai.com and desktopwiki.com. On 2026-11-21, http:// and www. both redirected to the https:// apex address.
- **Brand icon:** `C:\dev\remadebyaI\remadebyai-icon.png` (1254x1254). The original has transparent patches inside the dark panel; the site's icons were made from a cleaned copy (`assets/icon-512.png`).

## Site layout

- `index.html`: the single page (hero, featured project, project directory, About, List your app, footer).
- **List your app** (`#list`): a mailto button to `listings@remadebyai.com` with a prefilled subject and form-style body (app name, website, what it replaces, open source, maker, description). The About section's "Suggest a project" points to it. The address must exist in Microsoft 365 (shared mailbox or alias) before this goes live.
- The featured block is rendered by `directory.js` from the `projects.json` entry with `"featured": true`. Its extra fields are `tagline`, `featureText`, `featureLinkText` and `featureArt` (the id suffix of a `<template id="art-...">` in `index.html`; `inbox` is the InCloseMail mock). The featured project also stays in the directory grid.
- `projects.json`: the directory's project list. `directory.js` renders the cards from it and runs search and filters.
- `styles.css`: all styles. Dark theme, green accent `#c2ff94`.
- `favicon.ico`, `assets/favicon-32.png`, `assets/apple-touch-icon.png`: browser and home-screen icons.
- `assets/og-image.png` (1200x630): link preview image used by the Open Graph and Twitter tags.
- `assets/mark.svg`: small star mark in the header. `assets/circuit.svg`: background art.

## Cache busting

- `index.html` loads `styles.css?v=YYYYMMDD` and `directory.js?v=YYYYMMDD`. Bump a file's tag whenever that file changes, so returning visitors don't get a stale script or stylesheet. For a second change on the same day, add a letter (`20261121b`).
- `directory.js` fetches `projects.json` with `cache: 'no-cache'`, so list edits show up right away.

## Working rules

- Nothing is pushed or published without the owner's explicit OK ("Commit and push" / "Go live" buttons). Going live is never implied.
- On the PC, `gh` defaults to the DennisBaker account, which is not in the RemadeByAI org. The org account is dpb1999. Switching accounts (`gh auth switch --user dpb1999`) needs the owner's own typed OK.

## Open items

- Email: all four domains (emukey.com, desktopwiki.com, inclosemail.com, remadebyai.com) are healthy in one Microsoft 365 tenant. emukey.com is the only user; the others are shared mailboxes. Do not suggest removing domains or null MX (the earlier lockdown advice was withdrawn). Pending on the owner's side: at NameSilo, set the `_dmarc` TXT for desktopwiki.com and inclosemail.com to `v=DMARC1; p=none` (dropping `rua`) to stop DMARC report mail. Recheck once they say it's saved.
- Not pushed yet: f8cbe00 (featured project from projects.json) and 703e584 (contact todo). `main` on the PC is 2 ahead of origin; push only on the owner's "Commit and push".
- After the next push, check the link preview with a sharing debugger (for example LinkedIn Post Inspector or opengraph.xyz).

## Ideas

- **Contact / "list your app" (built locally 2026-11-21, not committed yet; see Site layout):** the site needs a way for people to contact us, mainly so app makers can ask to have their app listed. Options: a mailto to an emukey.com address or a remadebyai.com shared mailbox (M365 receives mail for that domain), a hosted form service (e.g. Formspree), or a GitHub issue template on the repo.
- More projects in the directory.
