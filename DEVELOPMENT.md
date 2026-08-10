# Development Notes

This file is for whoever is working *on* the game (Claude Code included) --
build/run instructions and where things live. If you're looking for what the
game actually is from a player's perspective, see `README.md` instead; for
mechanics/content decisions see `DESIGN.md`, for visual conventions see
`STYLE.md`, for exact function names and file locations see `CODEMAP.md`.

## Folder contents

- `DESIGN.md` -- the living design document (world map, type system, battle
  rules, mentors/story, tech stack, roadmap, open questions). Edit it
  directly as the game evolves rather than starting a new doc.
- `STYLE.md` -- current visual/style decisions (sizes, colors, shapes, panel
  conventions). Edit in place as choices change.
- `CODEMAP.md` -- where things live in the code: function names, file
  locations, established patterns to reuse. Read this before touching
  `game/src/` so you're not re-exploring the tree from scratch.
- `data/materials.json` -- data-driven reference for the full type system
  (all 10 material types, subtypes, moves, type chart). This is the
  design-time source of truth; `game/src/data/materials.ts` is the smaller,
  type-checked subset the running game actually imports.
- `game/` -- **active development happens here.** A Vite + TypeScript +
  Phaser 3 project (see "Running the game" below).
- `screenshots/` -- the images embedded in `README.md`. Regenerate rather
  than hand-edit if the UI they show changes materially.

## Running the game

`game/` needs Node.js (npm) installed.

```
cd video_game/game
npm install
npm run dev
```

This starts a local dev server (Vite prints the URL, typically
`http://localhost:5173`) with hot-reload -- edits to any file under
`game/src/` apply instantly in the browser.

To produce a static build (e.g. for hosting on GitHub Pages/Netlify):

```
npm run build    # outputs to game/dist/
npm run preview  # serve that build locally to sanity-check it
```

Type-check without building:

```
npx tsc --noEmit -p .
```

### `game/` project layout

```
game/
  src/
    main.ts            entry point, creates the Phaser.Game, scene list
    data/               Material/Move/type-chart/save-schema/tutorial-copy data
    art/                 procedural sprite/tile drawing (crystals, biomes, mentors)
    audio/                procedural sfx + per-scene music tracks
    scenes/
      TitleScene.ts       loads the save, Debug Mode toggle, "Continue"/"New Game"
      HubScene.ts          World 0, static room, hotspots (+ debug world-select)
      OverworldScene.ts    per-world walkable map, encounters, shop, tutorial, pause menu
      BattleScene.ts        turn-based battle loop
    world/
      mapgen.ts             per-world corridor layout generator
```

See `CODEMAP.md` for the full tree with every file annotated.

No external image/audio assets -- all visuals (crystals, tiles, mentor
avatars) are drawn procedurally with Phaser's Graphics API and all sound is
generated with the Web Audio API, so there's nothing to load/bundle besides
code. See `DESIGN.md` §8 for the art pipeline if real sprites are ever
wanted.

## Current status

Per `DESIGN.md`'s roadmap, the "full build-out" pass is done: all 10 worlds
have a walkable map, biome, wild-encounter pool, rival gate, and a mentor
standing mid-corridor (Noether, Bloch, and Bohr have real mechanics; Dirac
through Feynman are lore-only pending a subtype system, see `DESIGN.md`
§10), with that world's boss now standing at the goal tile as a gigantic
visual landmark. The first-run tutorial popup sequence, the Debug Mode
title-screen toggle (instant world warp + auto-leveling, for testing any
world without grinding), and the Enter-menu's Settings panel (wild-encounter
density, and a Text Size preset applied via `ui/text.ts`'s `fontPx`/`fontScale`
helpers) were added most recently. `demo/` remains frozen at the much
earlier prototype stage described in its own commit history --
don't treat it as reflecting current mechanics.

## Verifying UI changes

There's no headless test suite for the Phaser scenes -- changes to
`OverworldScene`/`BattleScene`/`HubScene`/`TitleScene` should be checked by
actually running `npm run dev` and clicking through the affected flow in a
browser (or driving a headless Chromium via Puppeteer/Playwright and
screenshotting, if no display is available) before calling the work done.
`npx tsc --noEmit -p .` catches type errors but not broken layouts or dead
click targets.

`main.ts` exposes the live `Phaser.Game` instance as `window.__game` in dev
builds (`import.meta.env.DEV`), which lets a headless script drive scenes
directly without clicking through the UI: `window.__game.scene.getScene('Overworld')`
returns the running scene instance, and its otherwise-private panel methods
(`showSettingsPanel`, `showEncounter(material)`, etc.) are still callable via
bracket notation (`ow['showSettingsPanel']()`) since TypeScript's `private`
is compile-time only. Combined with `page.evaluate` measuring
`GameObjects.getBounds()` on a panel's container, this is enough to check
every panel for text overflow/overlap at every font-scale preset
(`localStorage.setItem('qm-rpg-save-v1', JSON.stringify({ fontScale: 2 }))`
before reload) without a display or manual playtesting.
