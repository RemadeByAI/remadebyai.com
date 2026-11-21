# Handoff notes

Last updated: 2026-11-21. Read this first when picking up work on the site.

## Where things are

- **Local source:** `C:\dev\remadebyaI\remadebyai-website` on the PC "Dennis".
- **Repo:** https://github.com/RemadeByAI/remadebyai.com (public, branch `main`).
- **Hosting:** GitHub Pages from `main` at the repo root, custom domain `remadebyai.com` (see `CNAME`). DNS A records point to GitHub Pages (185.199.108-111.153).
- **HTTPS:** Enforce HTTPS is on for remadebyai.com and desktopwiki.com. On 2026-11-21, http:// and www. both redirected to the https:// apex address.
- **Brand icon:** `C:\dev\remadebyaI\remadebyai-icon.png` (1254x1254). The original has transparent patches inside the dark panel; the site's icons were made from a cleaned copy (`assets/icon-512.png`).

## Site layout

- `index.html`: the single page (hero, featured InCloseMail, project directory, About, footer).
- `projects.json`: the directory's project list. `directory.js` renders the cards from it and runs search and filters.
- `styles.css`: all styles. Dark theme, green accent `#c2ff94`.
- `favicon.ico`, `assets/favicon-32.png`, `assets/apple-touch-icon.png`: browser and home-screen icons.
- `assets/og-image.png` (1200x630): link preview image used by the Open Graph and Twitter tags.
- `assets/mark.svg`: small star mark in the header. `assets/circuit.svg`: background art.

## Working rules

- Nothing is pushed or published without the owner's explicit OK ("Commit and push" / "Go live" buttons). Going live is never implied.
- On the PC, `gh` defaults to the DennisBaker account, which is not in the RemadeByAI org. The org account is dpb1999. Switching accounts (`gh auth switch --user dpb1999`) needs the owner's own typed OK.

## Open items

- Email lockdown: only emukey.com should receive mail. desktopwiki.com, inclosemail.com and remadebyai.com still had Microsoft 365 MX records; the owner is removing them from M365 and adding null MX, `v=spf1 -all`, DMARC `p=reject` and empty DKIM. Recheck DNS once they say it's done.
- After the next push, check the link preview with a sharing debugger (for example LinkedIn Post Inspector or opengraph.xyz).

## Ideas

- Featured project is still hardcoded in `index.html`; it could move into `projects.json` with a `featured` flag.
- More projects in the directory.
