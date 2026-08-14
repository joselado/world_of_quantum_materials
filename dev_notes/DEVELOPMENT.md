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

`game/scripts/content-lint.mjs` (`npm run content-lint` from `game/`, ~2s --
pure Node, no browser, no dev server) reads the source with the TypeScript
compiler API and checks two families of thing none of the other checks on
this page can see.

**The hand-authored data tables' internal consistency** (checks 1-15): every
`MaterialType` has a `MOVE_COMPATIBILITY` row and can host `phonon` (the
universal fallback move), every crystal/rival's `moves` list resolves to a
real `MOVES` id, no two moves share a display name (this project has shipped
exactly that bug before), `WORLD_NAMES`/`WORLD_RIVALS`/`WORLD_GUARDIANS` all
cover the built worlds consistently (`WORLD_RIVALS` deliberately excluding
World 9, whose rival is rolled at random rather than fixed), every
`HYBRID_RECIPES` result actually lives in `WORLD_CRYSTALS[10]` and vice versa
(DESIGN.md §5's "hosts exactly the hybrid-recipe results, and nothing else"),
every world 1-9 has a non-empty quiz pool, and every `TUTORIAL_TIPS` topic is
reachable and declared in the order the game reveals it (a `{ kind: 'tip' }`
topic has a trigger site, a `{ kind: 'guardian' }` topic names a real guardian
and follows the ones unlocked in earlier worlds). Reads `materials.ts`/
`types.ts`/`passives.ts`/`quiz.ts`/`tutorial.ts`/`OverworldScene.ts` (for the
class-private `WORLD_GUARDIANS` table) the same AST-parsing way `gen-docs.mjs` does, for
the same reason (`materials.ts` pulls in Phaser at module scope).

**Orphan definite-assignment fields** (check 16), the one source-level rather
than data-level check: it walks every `src/` class property declared
`private x!: T` with no initializer and flags any whose name is never an
assignment target anywhere in `src/`. The `!` is a promise to the compiler
that something will assign the field, and the compiler stops checking once
it's there -- so a field nothing ever assigns reads as `undefined` at
runtime, `tsc --noEmit` says nothing, and the first method call on it throws.
A behavior check only sees it if its own route happens to reach that one
read, which for a field read on a single World 10 branch it may never do.
What counts as an assignment is deliberately generous and matched by name
across all of `src/` rather than within the declaring class: any assignment
operator writing to a property access or a string-literal bracket access,
`++`/`--`, a property target inside a destructuring assignment pattern, and a
`for (obj.x of ...)` binding. The scenes' public `!` fields really are
assigned from other files (panels under `scenes/panels/` write
`scene.playerMaterial`), so a same-named write anywhere suppressing a genuine
orphan elsewhere is the failure direction worth having -- a hit here always
means something, which is the only way a check like this stays enabled.

Run this after any content addition -- pairs naturally with the
`add-content` skill's own checklist, and is cheap enough to run reflexively
before reaching for `component-check`/`playthrough-check`, which check
behavior rather than data.

## Art-builder input sweep

**`npm run art-sweep`** (`scripts/art-sweep.mjs`, ~20-35s) calls every
procedural art builder over every input it can legitimately receive and
asserts nothing throws. Almost every call site hands a builder a fixed,
hand-checked entry, so a builder that chokes on one particular input stays
invisible until that input is used; World 10's Adapted is the exception and
the reason this exists, since `BattleScene.transmuteAdapted` picks a compound
at random out of the whole roster (`allCrystals()`) and feeds it straight to
`makeBossCrystal`. Four sweeps, ~1480 inputs:

- `art/boss.ts`'s `makeBossCrystal` and `art/crystals.ts`'s `makeCrystal`
  over every material x every `CrystalVariant` -- the wild roster, every
  world's fixed rival, the player's starting form, and every Majorana fusion
  the roster admits (built by the game's own `combineMaterials`, so the
  two-parent hybrid render path is swept too), with and without the
  per-compound `seed`/`hybrid` options.
- The ten per-guardian avatar builders in `art/`.
- `art/attackEffects.ts`'s `playAttackEffect` (a real cast) and
  `playTargetEffect` (a guardian panel's looping detail-pane preview, which
  is what a positive `depthOffset` means) over every `MoveClass` x every
  per-move-id shape override x move levels 0 and 3. The class list is the
  full union rather than each move's own authored class because a tunable
  move carries whichever class the player retuned it to, so any class can
  reach any move's override.

Every domain is derived from the data (`allCrystals()`/`WORLD_RIVALS`/
`MOVES`/`ANALYTIC_SHAPES`/`ULTIMATE_SHAPES` at runtime; the
`CrystalVariant`/`MoveClass` unions and the `art/` `make*Avatar` exports
parsed out of the source, since a type union is erased before runtime), so
new content is swept the day it lands rather than the day someone remembers
to extend a list here.

**Two failure channels, and the second is the point.** A per-input
`try`/`catch` attributes a synchronous throw to the exact input that caused
it. But a throw inside a tween or timer callback fires from within Phaser's
game step, long after the builder call returned -- it never reaches the frame
that called the builder, it just kills the `requestAnimationFrame` loop and
freezes the canvas. Those are caught by the page's own `pageerror`, attributed
to the phase they landed in. The run also counts every effect's own impact
callback and fails if one never fires: an effect that never lands is a battle
turn that never resolves.

It hosts the real modules in a real Phaser scene in a real browser -- a blank
scene added to the running dev build, with the builders pulled in through the
dev server's own module transform (`import('/src/art/boss.ts')`). Phaser
cannot be imported into plain Node here at all (it reads `navigator` at module
scope), and a stubbed scene object would be measuring the stub rather than
Phaser. `QM_ART_TIMESCALE` (default 20) speeds up the scene's clock and tween
manager so a 5.2-second Ultimate sequence still plays end to end, callbacks
and all, without costing 5.2 seconds; the impact-callback count is what proves
the compression played the sequences rather than dropping them. `QM_ART_PORT`
(default 5190) keeps it off `:5173`, so it never disturbs a dev server another
session is running.

`QM_ART_BREAK=sync` casts one effect with a move class that doesn't exist and
`QM_ART_BREAK=async` throws from inside an impact callback -- the sensitivity
controls for the two channels. Use them to confirm the sweep can still fail
before trusting a clean run; a check that has never been seen to fail is not
evidence. `QM_ART_BREAK=async` also demonstrates why the second channel is
needed at all: the single injected tween-callback throw stops the game loop,
and the 237 impact callbacks queued behind it never fire.

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
      overworld/            the corridor's ground plane and air: sky.ts, terrain/ (one module per
                              off-path material under terrain/materials/)
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
panel render correctly," but "can a player actually complete the game."
(A third, `music-arc-check`, uses the same headless-Chrome machinery for the
soundtrack -- see "Measuring the music arc" below.) Both
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
panels' open/close, rival-gate win and loss paths, World 10's Adapted actually
transmuting (once per move class, with both sides topped up so the swap is
reached repeatedly -- the rival-gate loss path never gets there, since a
fresh-save player dies before landing a hit on a living Adapted), and
fresh/corrupt/old-shape save boot resilience. Every test also fails on any
uncaught page error inside its own window, which is what catches a throw in a
tween callback -- those run inside Phaser's game step, so they kill the
`requestAnimationFrame` loop and freeze the canvas instead of surfacing as a
stuck panel. **Run this first** whenever chasing a suspected
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

## Measuring the music arc

**`npm run music-arc-check`** (`scripts/music-arc-check.mjs`, ~17 minutes)
makes the soundtrack's per-world arc checkable without listening to it. The
ten worlds darken as the player advances (`dev_notes/WORLDS.md`'s light
rule) and the score carries that; "it sounds darker" is not something a
reviewer can verify, so this script turns it into numbers. It drives the real
game in headless Chrome, hangs an `AnalyserNode` off the live music bus
(`MusicEngine.getSfxBus()`'s master node -- fanning off it is
non-destructive, so the game plays exactly as it normally would), plays all
20 scores, and prints a per-score row: RMS, spectral centroid, the share of
energy above 4 kHz and below 120 Hz, spectral flatness, a Plomp-Levelt
roughness proxy for sensory dissonance, and a detected-onset rate standing in
for note density x tempo. It measures the audio that actually comes out and
never imports the score tables, so it can't restate the intent it exists to
check. `QM_MUSIC_STYLE=modern` measures the Modern arrangement instead,
`QM_MUSIC_CAPTURE_MS` sets the per-score window, and `QM_MUSIC_JSON=path`
dumps the raw table for diffing two runs. It picks its own port (5188 by
default, `QM_MUSIC_PORT`) rather than `:5173`, so it never disturbs a dev
server already running.

It is also where `music.ts`'s own module-load `assertLoopBeats` assertion
gets caught: a track whose note lengths don't sum to its score's `loopBeats`
typechecks clean and can't be spotted by reading, but it logs a `music:`
console error that fails this run.

**The gotcha that makes the numbers trustworthy, and would silently corrupt
them otherwise:** it reloads the page between scores, giving each one a fresh
`AudioContext`. `play()` schedules a whole loop of oscillators up front and
`stop()` only ramps their shared gain to zero, so every node stays alive and
costing CPU until its own stop time -- up to a loop later. Measuring several
scores in one page therefore piles up hundreds of inaudible-but-still-running
oscillators until the audio thread starts glitching, and that added noise
reads as a steady climb in brightness and spectral flatness with position in
the run. That artifact looks exactly like the darkening arc the script exists
to measure, which is what makes it dangerous rather than merely noisy.

Two limits worth knowing before over-reading a small delta. The capture
window is a fixed wall-clock duration rather than an integer number of loops,
so once-per-loop events (the battle crash and fanfare sting) are weighted
slightly differently between scores of different loop lengths -- this shifts
absolute numbers a little and leaves the across-worlds shape intact. And the
analyser taps the master bus ahead of the output compressor, so the figures
are pre-compression; they are meaningful compared against each other, not as
absolute loudness.

## Checking arena legibility

**`npm run greyscale-check`** (`scripts/greyscale-check.mjs`, ~2.5 minutes)
answers the question a backdrop change can quietly break: do the two crystals
and the two HP bars still read against whatever is drawn behind them, in all
ten worlds? It is the squint test made mechanical -- shrink the frame, drain
the colour, and see what a glance still finds -- and it exists because a
colour check waves through the one failure that matters here, an element
surviving on hue alone and vanishing in value, which is exactly what
fog-coloured late worlds produce. Run it after any change to the battle
backdrop, the crystal art, or the nameplates.

It drives the real game to a rival battle in each world through the real gate
route (reach the goal, face that world's own rival), so the opponent is the
boss-sized silhouette standing against the ridgeline -- the harder case -- in
the material the game itself chose. Both sides get a large HP buffer before
anything is captured, because a fresh save's max HP in the late worlds is low
enough for the rival to end the fight first, and the bars are left at 60% so
they are measured part-drained rather than in the one frame where they are
guaranteed full. `Math.random` is stubbed with a seeded stream and every tween
is rewound to phase zero and paused before capture, so two runs render the
same ten arenas: consecutive runs currently agree to the last decimal on every
number below.

Three frames are captured per arena: the full frame, the backdrop alone, and
the frame with only the crystals hidden. The second gives the value of the
backdrop behind and around every element with no other UI standing in for it;
the third recovers each crystal's exact painted footprint without the script
knowing anything about how that art is drawn. Each frame becomes a Rec.709
luminance map, box-downscaled 8x (854x480 -> 107x60 cells). For an element
covering cell set E, `salience(E)` is the mean over its cells of how much the
element changes the value there -- the full frame against the backdrop it
covers -- in greyscale units of 0-255. Measuring per cell against the exact
backdrop is what keeps a ridge edge or a vignette corner the element happens
to stand on from being credited to the element.

That number is given a reference by asking what the backdrop manages unaided:
the element's own cell shape is slid across every position of the
backdrop-only frame and scored for how far each patch stands off its own 7x7
neighbourhood. Ridgelines, haze bands and decorative background crystals score
what they are worth; a smooth sky-to-ground gradient scores near zero, which
is right, since a gradient is not a thing competing to be found. An element
passes when it clears both arms:

```
salience >= 20                        absolute value separation
salience >= 1.6 x p95(backdrop)       louder than the backdrop's busiest
```

Both thresholds are bracketed by measurement from both sides rather than
picked by taste, and the script prints salience and the margin over the gate
for every element in every world, so the distance to the line is always
visible. Value zoning (the darkest darks and brightest brights belonging to
gameplay) is printed alongside as a diagnostic and is not gated.

**Every run grades the instrument as well as the arenas**, because a check
that passes everything proves nothing. Three perturbations are applied to each
arena in the same live battle and measured the same way: the backdrop flooded
with a flat grey at the crystals' own measured mean luminance (a *negative*
control -- a high-contrast object on a flat field is easier to find, not
harder, so this must still pass, and a check that fails it is reacting to the
frame having changed rather than to legibility); the backdrop given gameplay's
own value range and gameplay's own scale of local contrast, which is
over-decoration itself and must fail; and the whole gameplay layer dropped to
alpha 0.05, which must also fail. A positive control that slips through is
reported as the instrument being blind there, and fails the run just as a
legibility failure does.

Options: `QM_GREY_WORLDS=1,5,9` measures a subset, `QM_GREY_JSON=path` dumps
the raw table for diffing two runs, `QM_GREY_SEED` re-pins the PRNG. It picks
its own port (5191 by default, `QM_GREY_PORT`) rather than `:5173`, so it
never disturbs a dev server already running. Artifacts land in
`game/.check-artifacts/greyscale/`: the full-colour arena PNG per world, and
the reduced greyscale frame the metric actually saw -- worth
opening when a number surprises you, since it is literally the squint.

**The one structural assumption, and how it is kept honest:** the script
separates backdrop from gameplay by display-list position, taking every object
from the opponent crystal onward as the gameplay layer. That holds because
`BattleScene.create()` draws the whole backdrop before any combatant exists,
and it is an assumption a future edit to `create()` could silently break, so
two assertions run every time: hiding the crystals must change the frame only
inside the two boxes the script expects them in, and the backdrop-only frame
must genuinely differ from the full frame everywhere an element is drawn. A
tripped assertion is reported as a broken harness, distinctly from a
legibility failure.

What it does not check: colour, motion, and anything outside the four
elements it measures. An arena that passes has crystals and HP bars that carry
enough value contrast to be found in a squint; it says nothing about whether
the arena is handsome, whether its idle motion is restrained, or whether the
move menu and combat log read.

**One known limitation, from checking the numbers against an independent
read:** the score is an average over an element's whole footprint, so a dark
silhouette rescued by a bright rim outline scores much like one whose body
genuinely separates. Both do read, so this is not a false pass -- but a
squinting player sees the outlined one as an outline rather than as a mass,
and the numbers cannot tell those apart. The metric is a trustworthy ordering
instrument at the low end, where it matters; at the top it keeps climbing well
past the point where the eye has stopped noticing a difference, so a gap
between two already-loud elements means less than the same gap near the gate.
