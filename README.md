# RemadeByAI

RemadeByAI is EmuKey LLC's directory of AI-assisted apps and alternatives to familiar software: everyday tools, rebuilt around the way people actually work.

This is a static site served by GitHub Pages from the `main` branch at https://remadebyai.com. The pages are generated from `projects.json` by a small build script that needs only Node.js 18+ (no packages).

## Adding or editing an app

1. Edit `projects.json` (field list in `docs/HANDOFF.md`).
2. Run `node build.js`. It checks the data, then writes `apps/`, `categories/`, `new/`, `sitemap.xml`, `robots.txt` and the marked parts of `index.html`.
3. Commit the data change together with everything the build changed.

## Previewing locally

Pages use root links, so serve the folder rather than opening the files: `python -m http.server 8000`, then open http://localhost:8000.

See `docs/HANDOFF.md` for the current state of the project.
