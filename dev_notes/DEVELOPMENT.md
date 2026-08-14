# Development Notes

This file is for whoever is working *on* the game (Claude Code included) --
build/run instructions and where things live. If you're looking for what the
game actually is from a player's perspective, see `README.md` instead; for
mechanics/content decisions see `DESIGN.md`, for visual conventions see
`STYLE.md`, for exact function names and file locations see `CODEMAP.md`
(all three live alongside this file in `dev_notes/`).

## Repo layout

- `dev_notes/` -- this folder: `DESIGN.md` (the living design document --
  world map, type system, battle rules, guardians/story, tech stack, roadmap,
  open questions), `STYLE.md` (visual/style decisions), `CODEMAP.md` (where
  things live in the code), and `DEVELOPMENT.md` (this file). Edit these
  directly as the game evolves rather than starting new docs.
- `game/` -- **active development happens here.** A Vite + TypeScript +
  Phaser 3 project (see "Running the game" below).
- `docs/` -- player-facing reference docs `README.md` links out to
  (quasiparticles/moves, crystals, hybrid materials, guardians). Their
  tables are generated from `game/src/data/materials.ts`/`passives.ts` --
  see "Regenerating docs/ tables" below.
- `bin/play.mjs` -- the cross-platform launcher behind `npm run play` (see
  "Running the game" below); the root `package.json` exists only to give it
  that command name, it has no dependencies of its own.
- `screenshots/` -- the images embedded in `README.md`. Regenerate rather
  than hand-edit if the UI they show changes materially.

## Running the game

Needs Node.js 18+ (npm) installed. From the repo root:

```
npm run play
```

`bin/play.mjs` installs `game/`'s dependencies if `game/node_modules` is
missing or older than `game/package-lock.json`, then starts the dev server
with Vite's `--open` flag so it opens your default browser automatically --
the same command on Windows/macOS/Linux. `--open` is passed by the wrapper
rather than baked into `game/`'s `dev` script, so headless/automated runs of
`npm run dev` (the `run-game`/`verify-ui` skills, CI) don't trigger a
browser-launch attempt. To run `npm` commands directly instead of through the
wrapper (no auto-open):

```
cd game
npm install
npm run dev
```

Either way this starts a local dev server (Vite prints the URL, typically
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
`WORLD_RIVALS`, `HYBRID_RECIPES`, `MOVE_COMPATIBILITY`) and
`src/data/passives.ts` (`PASSIVES`) by
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

## Balance simulator

`src/data/balance.ts` holds every pure battle/economy formula (stat growth,
shop/leveling costs, battle stakes, the core damage formula) with no Phaser
import, so it can be loaded straight into a plain Node script instead of only
running inside the browser build. `game/scripts/balance-sim.mjs` (`npm run
balance-sim` from `game/`) walks three reference player builds through worlds
1-10 and reports, per world, their qumatessence economy and expected
rounds-to-kill/rounds-to-die against that world's ordinary wilds and rival --
a difficulty-curve sanity check for whether move/guardian progression keeps
pace with `enemyStatsForWorld`'s per-world stat growth. It reads
`materials.ts`/`passives.ts` the same AST-parsing way `gen-docs.mjs` does (for
the same Phaser-import reason), but transpiles and actually imports
`balance.ts` (via `ts.transpileModule` and a temp file) rather than
re-deriving its formulas, so the simulator can never drift from the real
damage math. The M.Sc. and Ph.D. builds both use Dresselhaus's transmutation
together with Noether's form-gated shop -- transmuting into a crystal form
that hosts a class a world's opponents don't, then buying that class's move,
is treated as ordinary expected-tier play, not something only Ph.D.-level
optimization would bother with; B.Sc. stays in its starting Silicon form the
whole run. Each build maps to its own real in-game Settings difficulty tier
(`data/settings.ts`'s `DifficultyTier` -- B.Sc./M.Sc./Ph.D., `data/balance.ts`'s
`DIFFICULTY_MULTIPLIERS` applied to `enemyStatsForWorld`), so the simulator
verifies each tier against the effort level it's actually named after, not
just the raw unscaled curve. Each build's own "wins needed" per world is solved for by grinding ordinary
wilds until that build's purchase logic makes its rival fight beatable,
rather than a fixed input -- capped at that build's own per-world
grind-patience budget (sized in whole-corridor re-walks from the map
generator's own encounter density: lowest for B.Sc., highest for Ph.D.),
so how much grinding each archetype tolerates is itself part of the effort
model, not one shared constant. If a build is stuck
on a purchase it can't afford while genuinely losing the world it's on
(wild or rival), it farms qumatessence from the highest earlier world it can
still safely clear instead of just giving up, the same thing a real player
can do by walking back through an earlier world's own door -- drawn from
that same per-world patience budget. Every modeling
assumption (each build's purchase ruleset, the transmutation search, the
Monte-Carlo sample count/seed, the ±15%-variance robustness check behind a
row's WIN/LOSE/INCONCLUSIVE verdict) is documented in that script's own
header comment -- read it before trusting a number out of its output.

## Content lint

`game/scripts/content-lint.mjs` (`npm run content-lint` from `game/`, well
under a second -- pure Node, no browser, no dev server) statically
cross-checks the hand-authored data tables for internal consistency, the one
class of bug none of the other checks on this page can see: every
`MaterialType` has a `MOVE_COMPATIBILITY` row and can host `phonon` (the
universal fallback move), every crystal/rival's `moves` list resolves to a
real `MOVES` id, no two moves share a display name (this project has shipped
exactly that bug before), `WORLD_NAMES`/`WORLD_RIVALS`/`WORLD_GUARDIANS` all
cover the built worlds consistently (`WORLD_RIVALS` deliberately excluding
World 9, whose rival is rolled at random rather than fixed), every
`HYBRID_RECIPES` result actually lives in `WORLD_CRYSTALS[10]` and vice versa
(DESIGN.md §5's "hosts exactly the hybrid-recipe results, and nothing else"),
and every world 1-9 has a non-empty quiz pool. Reads `materials.ts`/
`types.ts`/`passives.ts`/`quiz.ts`/`OverworldScene.ts` (for the class-private
`WORLD_GUARDIANS` table) the same AST-parsing way `gen-docs.mjs` does, for
the same reason (`materials.ts` pulls in Phaser at module scope). Run this
after any content addition -- pairs naturally with the `add-content` skill's
own checklist, and is cheap enough to run reflexively before reaching for
`component-check`/`playthrough-check`, which check behavior rather than data.

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
      HubScene.ts          World 0, static room, 9 stations (door jumps to World 2 in Superposition Mode)
      OverworldScene.ts    per-world walkable map, encounters, shop, rival gate; H/Enter warp to the Hub
      panels/               guardian panel UIs plus hubStations.ts's Lab stations
      BattleScene.ts        turn-based battle loop
    world/
      mapgen.ts             dispatches to generators/world<N>.ts by world number
      generators/            one map-shape generator per world, plus shared helpers
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
standing mid-corridor, every one of them (Noether through Skłodowska-Curie) with a
real mechanic, with that world's boss standing
at the goal tile as a gigantic
visual landmark. Contextual tutorial tips guide new players, a Story Mode /
Superposition Mode title-screen picker lets you choose between them
(Superposition Mode auto-levels the player and pre-marks every world visited
so Bloch's teleport hub gives instant access to any world/guardian, for testing
without grinding), and the Lab's Settings station offers wild-encounter
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
(`localStorage.setItem('qm-rpg-save-story-v1', JSON.stringify({ fontScale: 2 }))`
before reload -- `qm-rpg-save-superposition-v1` for the other mode's own
save slot, see DESIGN.md §7) without a display or manual playtesting.

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

## Full-playthrough and component checks

Two checked-in scripts build on the `window.__game`/Puppeteer approach above
to answer a question ad hoc UI verification can't: not just "does this one
panel render correctly," but "can a player actually complete the game." Both
live in `game/scripts/`, use `puppeteer-core` (a real `devDependency`, unlike
the one-off ad hoc pattern above) against the Chrome-for-Testing binary
Puppeteer itself caches at `~/.cache/puppeteer/chrome` (auto-detected;
override with `CHROME_BIN` if that ever stops finding the right binary), and
both auto-start `npm run dev` if it isn't already running on `:5173` and tear
it down afterward (an already-running server is left alone). Output
(screenshots, logs, JSON summaries) goes to `game/.check-artifacts/`
(gitignored, not meant to be committed).

**`npm run component-check`** (`scripts/component-check.mjs`, ~2-3 minutes) --
jumps directly into scenes/states via `scene.start(...)` and scene-private
fields rather than playing through them, so each of its ~50 tests takes
seconds: world-entry dialogue termination for every world (the lore →
goal/middle-tip → controls-tip chain), battle round-trips, all ten guardian
panels' open/close, rival-gate win and loss paths, and fresh/corrupt/old-shape
save boot resilience. **Run this first** whenever chasing a suspected
gameplay-blocking bug -- it catches most individual-mechanism regressions far
faster than a full playthrough, and its failure output (which world, which
button sequence, a screenshot) usually points straight at the broken
mechanism.

**`npm run playthrough-check`** (`scripts/playthrough-check.mjs`, ~20 minutes
to over an hour) -- an actual, real, single continuous playthrough: boots a
fresh save and drives it from World 1 through beating World 10's rival (the
real finale panel, `OverworldScene.showFinalePanel()`), BFS-pathfinding each
freshly generated map, fighting every encounter and rival with whatever moves
are currently unlocked, bouncing to the Lab between rival attempts to shop
(weighted toward guardian-shop purchase buttons, not just window-shopping, so
it actually invests qumatessence rather than wandering forever), and
occasionally taking a Bloch side-trip to revisit an earlier world. **Losing
individual battles is expected and fine** -- HP resets after every fight
regardless of outcome (`BattleScene.endBattle`, DESIGN.md §3's "Max HP"
section), so a loss only costs that fight's qumatessence stake, and a lost
rival is simply retried (capped at 15 attempts per world, each preceded by a
fresh Lab detour, before the run reports that world as a genuine blocker
rather than spinning forever). Reach for this only after `component-check`
passes clean -- it answers "does the whole chain complete," which
`component-check`'s isolated jumps structurally can't.

Both scripts print a running log and end with a JSON summary
(`success`/`failure` with a `reason` and the world it happened in, plus
stats). A `playthrough-check` failure's `reason` is written to be actionable
on its own (`no-bfs-path`, `rival-unwinnable-after-15-attempts-with-shopping`,
`hub-dialogue-stuck-repeating`, `movement-hang`, ...) -- but treat a single
failure as a lead to investigate with `component-check` or manual replay, not
as proof of a real bug on its own; see the next paragraph.

**Gotcha, and the most important lesson from building these:** headless
Chrome in this environment falls back to software WebGL (SwiftShader --
Chrome warns as much on boot), which is far more prone to renderer crashes
under repeated Phaser scene create/destroy churn (many battles in a row) than
real GPU rendering would be. `playthrough-check.mjs` treats a crashed
tab/frame as recoverable, not a failure: it relaunches the browser and
resumes from the persisted save (the same `data/save.ts` path a real player
closing and reopening the game would exercise), capped at 8 relaunches before
giving up. This is an artifact of the sandboxed environment, not the game --
don't read a relaunch log line as a finding.

**Second lesson, kept here so it isn't relearned the hard way:** a script
that blindly prefers a fixed button-label priority list can get stuck
clicking a real, harmless no-op forever and misreport it as a stuck panel --
this happened for real with the Lab's Qumatex/Materialdex list, whose
"Next ->" pagination button stays present (just visually dimmed) on the last
page, and a naive script that always prefers "Next ->" over the "\[ Close \]"
button sitting right next to it will loop. Both scripts detect a click that
produces no state change and switch to an exit-shaped button (`Close`,
`Farewell`, ...) instead of re-clicking the same no-op -- a genuinely stuck
dialogue (`stuck-repeating` in the failure reason) means that *also* failed
to make progress, not just that one specific button was a dead end. Before
trusting any future "stuck dialogue" finding from either script, check the
diagnostic dump it logs (`dialogueContainer`'s actual button list at the
point it gave up) for exactly this shape -- a real close/exit button sitting
in the list that the click logic simply didn't prefer is a script bug, not a
game one.
