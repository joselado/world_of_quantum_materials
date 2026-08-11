# Development Notes

This file is for whoever is working *on* the game (Claude Code included) --
build/run instructions and where things live. If you're looking for what the
game actually is from a player's perspective, see `README.md` instead; for
mechanics/content decisions see `DESIGN.md`, for visual conventions see
`STYLE.md`, for exact function names and file locations see `CODEMAP.md`.

## Folder contents

- `DESIGN.md` -- the living design document (world map, type system, battle
  rules, guardians/story, tech stack, roadmap, open questions). Edit it
  directly as the game evolves rather than starting a new doc.
- `STYLE.md` -- current visual/style decisions (sizes, colors, shapes, panel
  conventions). Edit in place as choices change.
- `CODEMAP.md` -- where things live in the code: function names, file
  locations, established patterns to reuse. Read this before touching
  `game/src/` so you're not re-exploring the tree from scratch.
- `game/` -- **active development happens here.** A Vite + TypeScript +
  Phaser 3 project (see "Running the game" below).
- `docs/` -- player-facing reference docs `README.md` links out to
  (quasiparticles/moves, crystals, hybrid materials, guardians). Their
  tables are generated from `game/src/data/materials.ts`/`passives.ts` --
  see "Regenerating docs/ tables" below.
- `screenshots/` -- the images embedded in `README.md`. Regenerate rather
  than hand-edit if the UI they show changes materially.

## Running the game

`game/` needs Node.js (npm) installed.

```
cd game
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

## Regenerating `docs/` tables

`docs/quasiparticles.md`, `docs/crystals.md`, `docs/hybrids.md`, and
`docs/guardians.md` each hold hand-written prose plus one or more tables
inside `<!-- GENERATED:NAME START -->`/`END` marker comments. Those tables
are parsed straight out of `src/data/materials.ts` (`MOVES`, `WORLD_CRYSTALS`,
`WORLD_RIVALS`, `HYBRID_RECIPES`, `COMPOSITE_MATERIAL_NAMES`,
`MOVE_COMPATIBILITY`) and `src/data/passives.ts` (`PASSIVES`) by
`game/scripts/gen-docs.mjs`, using the TypeScript compiler API to read the
literal values rather than importing the modules (`materials.ts` pulls in
Phaser via `art/colors.ts`, which needs browser globals Node doesn't have).
After changing any of those data structures:

```
cd game
npm run docs
```

Never hand-edit the text between a `<!-- GENERATED -->` marker pair -- the
next run overwrites it. Anything outside those markers is ordinary prose,
maintained the same way as any other doc.

### `game/` project layout

```
game/
  src/
    main.ts            entry point, creates the Phaser.Game, scene list
    data/               Material/Move/type-chart/save-schema/tutorial-copy data
    art/                 procedural sprite/tile drawing (crystals, biomes, guardians)
    audio/                procedural sfx + per-scene music tracks
    scenes/
      TitleScene.ts       loads the save, Story Mode / Superposition Mode picker, "Continue"/"New Game"
      HubScene.ts          World 0, static room, hotspots (door jumps to World 2 in Superposition Mode)
      OverworldScene.ts    per-world walkable map, encounters, shop, tutorial, pause menu
      BattleScene.ts        turn-based battle loop
    world/
      mapgen.ts             per-world corridor layout generator
```

See `CODEMAP.md` for the full tree with every file annotated.

No external image/audio assets -- all visuals (crystals, tiles, guardian
avatars) are drawn procedurally with Phaser's Graphics API and all sound is
generated with the Web Audio API, so there's nothing to load/bundle besides
code. See `DESIGN.md` §8 for the art pipeline if real sprites are ever
wanted.

## Current status

Per `DESIGN.md`'s roadmap, the "full build-out" pass is done: all 10 worlds
have a walkable map, biome, wild-encounter pool, rival gate, and a guardian
standing mid-corridor, every one of them (Noether through Anderson) with a
real mechanic, with that world's boss standing
at the goal tile as a gigantic
visual landmark. Contextual tutorial tips guide new players, a Story Mode /
Superposition Mode title-screen picker lets you choose between them
(Superposition Mode auto-levels the player and pre-marks every world visited
so Bloch's teleport hub gives instant access to any world/guardian, for testing
without grinding), and the Enter-menu's Settings panel offers wild-encounter
density and a Text Size preset applied via `ui/text.ts`'s
`fontPx`/`fontScale` helpers. `game/` is the only build.

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

**Gotcha:** `window.__game.scene.start(key)` called on the top-level
`SceneManager` does *not* stop whatever scene was already running, unlike
`this.scene.start()` called from inside a live scene (`ScenePlugin`, which
does stop-then-start). Since `main.ts`'s scene array is
`[Title, Hub, Overworld, Battle]` and later-indexed scenes always render on
top, jumping straight from e.g. Battle to Overworld this way leaves Battle
running invisibly underneath and the canvas silently freezes on its last
frame. When driving multiple scene switches from outside any scene, stop
every other gameplay scene explicitly before starting the next one
(`window.__game.scene.stop('Battle')` etc.), or route every switch through
a small in-page helper that does that for you.

**Gotcha:** the default `fontScale` preset (`data/settings.ts`'s
`DEFAULT_FONT_SCALE`) is `1.5`, not `1` -- a bounds check run only at
`fontScale: 1` (or only at the largest preset, `2`) can miss an overflow
that's actually present at the *default* a fresh player sees. Bloch's
teleport hub overflowed exactly this way once Superposition Mode made a
9-destination list routine: it fit fine at `1` and the bug wasn't caught
until checked at `1.5`. Always include the default preset, not just the
extremes, when bounds-checking a panel across `FONT_SCALE_PRESETS`.

**Gotcha:** when driving a battle scene from outside a UI click (e.g. via
`page.evaluate` calling `emit('pointerdown')` on a button object), scope the
search to the specific overlay container (`scene['dialogueContainer']` for
an overworld panel, or the specific `Container` at the panel's own `depth`
for an in-battle popup like `showAnalyticQuestion`) rather than walking the
whole scene's `children.list`. Decorative wandering-crystal name labels and
orbiting avatar glyphs (Majorana's/Anderson's `×`/Greek-letter orbit marks)
are plain, non-interactive `Text` objects that can share a candidate's exact
label text -- filtering to `obj.input` (only set once `setInteractive()` is
called) is necessary but not sufficient once a scene has multiple panels/
containers layered at once.
