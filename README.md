# RemadeByAI

RemadeByAI is EmuKey LLC's directory of AI-assisted apps and alternatives to familiar software: everyday tools, rebuilt around the way people actually work.

This is a static site with no build step. It is served by GitHub Pages from the `main` branch at https://remadebyai.com.

## Adding or editing a project

The project cards are generated from `projects.json` by `directory.js`. Add an entry there; no HTML changes are needed. `group` is `emukey` or `open` (used by the filters), and `tile` picks a tile color (`wiki`, `capture`, `code`, `glance`, or empty for the default green).

## Previewing locally

`projects.json` is loaded with `fetch`, so opening `index.html` straight from disk shows an error instead of the cards. Serve the folder instead, for example `python -m http.server 8000`, then open http://localhost:8000.

See `docs/HANDOFF.md` for the current state of the project.
