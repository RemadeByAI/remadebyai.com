# "What people say" status

Updated 2026-11-23 3:31 AM Central. The feature is the `whatPeopleSay` field in projects.json (see docs/HANDOFF.md). All 118 apps in scope have now been researched; only the two under "Partly checked" are left, and both need a source cloud and PC sessions cannot read (Reddit, X, a 403 forum).

**Limit:** cloud sessions on the old plan could read about 100 web pages per hour (WebFetch, shared by every agent). On 2026-11-23, after the owner moved to Claude Team, a PC session read about 120 pages in 15 minutes with no limit errors. It's not known whether the plan or the PC made the difference, so start big passes with a few agents and watch for fetch errors. reddit.com is blocked.
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

## Added in hunt 8 with a section, live (2)
- Sill
- Compositor

## Added in hunt 9 with a section, live (6)
All quotes re-checked against their pages on 2026-11-23.
- layerling
- OnAir
- Tiny Little Office
- Parrot
- Cra
- Tellyscope

## Added in hunt 10 with a section, live (3)
All quotes re-checked against their pages on 2026-11-23.
- HolyArrs
- Pyramid Wars (itch.io player comments on the game page and the AI Browser Game Jam 3 page)
- AI WORMS (itch.io player comments on the game page and the AI Browser Game Jam 5 page)

## Added in hunt 11 with a section, waiting for Go live (9)
All quotes re-checked 2026-11-24 (by script against the pages; Product Hunt and AlternativeTo block scripts, so those three were read with WebFetch).
- Zigzag
- Tolaria
- BrightBean Studio
- TikZ Editor
- Dorso
- Torched!
- Kara and the Primal Torch
- Coalheart
- Lightkeeper

## Live since 2026-11-23 (4bbb713) (13)
- LightCraft
- DeckCraft
- DesignCraft
- EffectCraft
- SaneBar
- MindZJ
- RustGIS
- GiroCrab
- openGym
- Cinephage
- Haven
- A Game About Capybaras Delivering Food
- Rackula

## Checked: no real outside coverage (106)
These have `"whatPeopleSay": { "checked": "2026-11-23", "none": true }`, so the page shows "No outside reviews of X yet. We last checked ...". Re-check now and then; when coverage turns up, replace the entry with a full one.

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
- TextureCraft
- ArtCraft Launcher
- Glance
- Arrmada
- Haven for Android
- Neon Zenith
- The Lost Storm
- Emberwick
- Idle Tactics: Ascension
- OpenAero DFW
- Game Glance
- Hearth for webOS
- mctl
- Ink Away
- FluidWin
- MoePeek
- Minilytics
- Pic2Sheet
- Dimble (hunt 8)
- WallpaperMachine (hunt 8)
- Prism Download Manager (hunt 8)
- Screendrop (hunt 8)
- Capso (hunt 8)
- Reelbird (hunt 8)
- Rembrandt (hunt 8)
- Flowplan (hunt 8)
- Inkline Town (hunt 9)
- Terminactory (hunt 9; only the Show HN thread plus an auto-generated PromptZone post)
- Harness Hollow (hunt 9)
- Second Tail (hunt 9)
- PlayTranslate (hunt 9; Brazilian articles with no quotable opinions, Android Authority unreadable)
- Nightwatch (hunt 9)
- Seal (hunt 9)
- Faro (hunt 9)
- StykAnimate (hunt 9)
- ZenLink (hunt 9)
- BackupZit (hunt 10; one Proxmox forum thread only)
- Arctis Sound Manager (hunt 10)
- PrintStash (hunt 10)
- Strata Files (hunt 10; one AlternativeTo comment only)
- GymCoach (hunt 10; one HN comment only)
- IMAGO (hunt 10)
- Postfalcon (hunt 10)
- Codetta (hunt 10)
- Ferry (hunt 10)
- Merran (hunt 10)
- Arena Game (hunt 10)
- Hack://TheSystem (hunt 10)
- Mila (hunt 11)
- Bambu Bar (r/BambuLab post only; Reddit blocked) (hunt 11)
- MacMix (hunt 11)
- Mirli (hunt 11)
- Minute (small HN thread only) (hunt 11)
- Xs of Y (one HN thread only, 213 points) (hunt 11)
- The Human Box (hunt 11)
- Bokken (comments on its own itch page only) (hunt 11)
- OpenWorld RPG (hunt 11)
- Calino (hunt 11)
- Readfine (hunt 11)
- Pesto Clipboard (hunt 11)
- Roxel (hunt 11)
- Podium (hunt 11)

## Partly checked: worth another look (2)
- Claude of Tanks: the main player discussion is a Reddit thread and X posts (both blocked); the HN post had no comments
- Mailflare: one independent article (cloudnews.tech); a NodeSeek thread that looks like a second source returned 403

## Not researched yet (0)
- none

Skipped on purpose: InCloseMail and DesktopWiki (not released yet).
