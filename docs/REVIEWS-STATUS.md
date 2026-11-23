# "What people say" status

Updated 2026-11-23 03:09 Central. The feature is the `whatPeopleSay` field in projects.json (see docs/HANDOFF.md). It's the top priority for the next session: finish the apps listed under "Partly checked" and "Not researched yet".

**Limit:** a Claude session can read about 100 web pages per hour (WebFetch, shared by every agent). Run 2 research agents per hour, each capped at 40 fetches. reddit.com is blocked.
**How:** each agent follows `docs/reviews/PROMPT.md` for one list of apps (`docs/reviews/in-N.txt`) and writes JSON (slug -> entry, or null when there's no real coverage). Merge into projects.json with `"checked": "YYYY-MM-DD"`, run `node build.js`, and keep quotes short and verbatim. Apps with no real coverage get NO section.
**Going live:** the owner taps Go live / Not yet. Never push to main without it.

## Live on the site with a section (41)
- macshot
- FreeFlow
- Open Source Barware
- PhotoCraft
- PdfCraft
- WordCraft
- GridCraft
- micasa
- FilmCraft
- FigCraft
- Davit
- SuperCmd
- Clean Your TV
- Free My TV
- Readest
- Bitchat
- Ferrite
- Inbox Zero
- OpenSEO
- Voicebox
- SolidCraft
- GeoLibre
- World of ClaudeCraft
- Legends of Future Past
- Voidstruck
- Quasar Saz
- Tower of Time
- Battle Drones
- Tennis Tycoon
- 38-0-0
- Meerkat CRM
- CODEX MORTIS
- Meet Claude
- dumbtv
- Tesserae
- FluentTaskScheduler
- Fresh
- Concat
- AppGrid for Plasma
- Starfall
- SetShot

## Done on the branch, waiting for Go live (0)
- none

## Checked: no real outside coverage, so leave these out (44)
- Locode
- VectorCraft
- OpenTodo
- CADCraft
- MaterialCraft
- Mister Download Manager
- SoloMD
- TelltaleDNS
- Long Wind
- Backroad Rally
- Bash Fighter
- Spinlings
- Game Master Claude
- Sakura Fantasy
- Tidewater
- Fable Flight
- Void Balls
- Sprout Quest
- Escape from the Depths
- Nota
- Opensidian
- neomd
- Minecraft Server Manager
- BrainRotGuard
- Prism
- SkySend
- DBackup
- HelixScreen
- Haben
- Muximux
- VibeNVR
- Prismarr
- Absorb
- Bramble
- KoShelf
- Oh My Android
- BigText
- OpenTV
- Tab Out
- ROM Librarian
- Quarter Sun Cove
- Parenthèse
- OldPhoneDeck
- Halcyon

## Partly checked: worth another look (24)
- Glance: searched only
- LightCraft: searched only
- DeckCraft: the main guide (pasqualepillitteri.it) is bot-blocked
- SaneBar: Product Hunt reviews and an ifun.de article exist, but judged too thin; worth one more look
- MindZJ: one critical linuxfr.org post (security audit concerns); needs a second source
- DesignCraft: only mentioned in articles about the whole ArtCraft suite
- TextureCraft: searched only
- openGym: batch 7 ran after the hourly limit was used up, so it was searched only
- RustGIS: one real review (It's FOSS); needs a second source
- Neon Zenith: batch 7: searched only
- A Game About Capybaras Delivering Food: press covered the AI build (Wccftech, MacObserver) but gave no opinion of the game
- The Lost Storm: searched only
- Haven: only one Cloudron forum post
- Arrmada: searched only, no Hacker News check
- Hearth for webOS: batch 7: searched only
- Cinephage: searched only
- mctl: searched only, no Hacker News check
- GiroCrab: only one source (mobiflip.de)
- Haven for Android: only an AlternativeTo listing
- Ink Away: the leads were about other KOReader plugins
- Emberwick: batch 7: searched only
- FluidWin: searched only
- Game Glance: searched only
- OpenAero DFW: searched only, no Hacker News check

## Not researched yet (9)
- EffectCraft (in-12.txt)
- ArtCraft Launcher (in-12.txt)
- Rackula (in-12.txt)
- Claude of Tanks (in-12.txt)
- Idle Tactics: Ascension (in-12.txt)
- MoePeek (in-12.txt)
- Minilytics (in-12.txt)
- Pic2Sheet (in-12.txt)
- Mailflare (in-12.txt)

Skipped on purpose: InCloseMail and DesktopWiki (not released yet).
