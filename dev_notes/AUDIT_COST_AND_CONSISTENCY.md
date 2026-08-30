# Audit: resource cost and internal consistency

A read-only audit of `world_of_quantum_materials`, run 2026-08-30 as six parallel agents over
six lenses: three on resource cost (per-frame rendering, runtime memory, bundle and startup)
and three on internal consistency (game data tables, documentation versus code, player-facing
text against `dev_notes/WORLDS.md`).

All 36 findings were acted on the same day. The status section below records what happened to
each and what proves it; the findings themselves follow in full after it, as the reasoning
behind each change.

## How to read this

Findings are grouped by lens (A-F) and ranked severity-first within each lens. Every finding
carries `file:line` evidence quoted from the file as the audit found it, so each one can be
checked without re-running the audit. Line numbers are from that moment and several have moved
since; the quoted text is what to search for.

For the three optimization lenses, each finding states what it saves *and* why the game's
quality survives the saving. `dev_notes/STYLE.md`'s cost rule (speed beats spectacle, lag during
gameplay is unacceptable) is the licence for that framing; a saving that would visibly degrade
the look, the physics or the teaching is marked as a trade rather than presented as a free win.

For the three consistency lenses, each finding names both sides of the contradiction and says
which side is correct, or says explicitly that the call is the owner's.

## Baseline: what the existing gates already say

All three fast checks were run before the audit and were used to define what does *not* count
as a finding:

| Check | Result |
| --- | --- |
| `npm run content-lint` | Clean. 29 moves, 14 types, 11 hybrid recipes, 10 worlds, 24 definite-assignment fields. |
| `npm run perf-check` | Clean. All 10 worlds inside budget (highest: world 3 at 13,353 ops of 17,000), no tween growth, no relative-cost outlier. |
| `npm run quiz-topic-check` | 109 of 322 questions do not rank their own session first. The World 9 entries in that list are expected by construction and are already-settled rulings. |

So every finding below is something the current suite does not catch. Two findings (B3, A4) are
about the suite itself: a gate that passes because it never exercises the thing it claims to
gate is worth more attention than a gate that fails.

## Verified before writing

Every high-severity finding, plus two lower ones that bear on the test suite, was re-checked by
hand against the code rather than taken on the agents' word. All fourteen held:

- **A1** — `sky.ts:558-562`: `fillSilhouette` runs inside `DISTANT_SWALLOW_STEPS x
  DISTANT_FEATHER_PX` nested loops on every call, and the call sits on the per-frame
  `drawTerrain` -> `drawDepthHaze` path. Only the `fillStyle` colour varies.
- **A2** — `colors.ts:34-40` and `perspective.ts:47-52` both open with two
  `Phaser.Display.Color.IntegerToColor` calls, and `colors.ts` rounds each channel where
  `perspective.ts` passes unrounded `Phaser.Math.Linear` floats into `GetColor`. That rounding
  difference is real and any integer rewrite has to preserve both behaviours.
- **A3** — `paint.ts:86-88` calls `groundColor` (and up to two `blend`s) inside the per-tile
  loop, and `offPathColor` at `paint.ts:442-445` does the same for off-path tiles.
- **B1** — same code path as A2/A3, counted from the memory side.
- **B2** — six `destroy()` calls with no `killTweensDeep` first: `OverworldScene.ts:2172`,
  `:2493`, `:3354`, `:3431`, and `HubScene.ts:862`, `:1335`. `killTweensDeep` does exist and is
  used correctly in 23 other places, so this is an inconsistently-applied convention rather than
  a missing one.
- **B3** — `scripts/perf-check.mjs:236-251`: the loop under the comment "Every station that opens
  a panel, opened and closed in turn" calls `s.dialogueContainer?.destroy(true)` three times and
  never opens a panel. `before` and `after` are read from the same untouched state, which is why
  it reports `5 -> 5`. This is the gate that should have caught B2.
- **C1** — the built bundle contains `Matter`, `TilemapLayer` and `ParticleEmitter` symbols, and
  `main.ts` loads no assets and enables no physics.
- **C2** — `paintSplitMerge` is exported at `world/generators/shared.ts:248` and referenced
  nowhere in `src/` except its own definition; `CODEMAP.md:197` still documents it as world 1's
  and world 8's mechanism.
- **D1** — `quiz.ts:1717` rewards "Plasmon Resonance, hosted only by the Metal type", while
  `materials.ts:512` grants `plasmon` to `metallicMagnet` as well, `types.ts:64-70` says in
  prose that "the two conducting types host it", and `docs/quasiparticles.md:20` prints
  "Metal, Metallic Magnet" in a generated table.
- **D2** — `materialdex.ts` holds exactly eight `Polycrystalline ... Golem` blurbs (worlds 1-8)
  under a comment claiming ten, one per boss.
- **E1** — `DESIGN.md:33` asserts the progression gates "still hold"; `OverworldScene.ts:2645+`
  shows `confirmGate` is one world-agnostic path (backward door, else fight the rival, else
  finale, else cross), with none of the seven bespoke puzzle gates §2's table promises.
- **F1** — `OverworldScene.ts:1133-1138` binds cursor keys, `keydown-ENTER` and `keydown-SPACE`.
  There is no `keydown-H` anywhere in `src/`. `tutorial.ts:96` tells the player "Press H or
  Enter". Enter works; H does nothing.
- **F2** — `worldLore.ts:141` opens World 9's rival with "There is no golem waiting in the
  wastes", while `materials.ts:1528-1535` names that same rival `Polycrystalline <compound>
  Golem` for all eight type rolls.
- **F3** — `worldFlavor.ts:23` says World 10's "own guardian adapts live rather than defending
  one fixed form", but `OverworldScene.ts:866-870` and `docs/guardians.md:28` both make World
  10's guardian Skłodowska-Curie, who teaches Ultimate moves. The thing that adapts is the
  rival, The Adapted.

The medium and low findings carry their agents' evidence quotes and were not independently
re-checked.

## The shortest path through this

If only a few things get done, these are the ones that pay most.

**Player-visible correctness, cheap to fix:**

1. **F1** — a tutorial instruction that does not work. Either bind H or drop it from the text.
2. **D1** — the game teaches a rule about itself that is false, and a player can disprove it in
   Noether's shop by transmuting into any metallic magnet. It is also wrong as physics.
3. **D2** — the finale's closing physics text is a generic fallback, and three World 9 rolls
   print another world's boss text about a boss the code explicitly exempts from that story.
4. **F2** and **F3** — two boss-facing contradictions a player reads at the two most-weighted
   moments in the game.

**Resource cost, best ratio of saving to risk:**

5. **A1** — the distant-self silhouette is 1,000-1,600 draw ops per frame of geometry that never
   changes, in 6 of 10 worlds. Caching it to its own Graphics is a pure win with a pixel-diff to
   prove it.
6. **A2 + A3 + B1** — these three are one problem seen from two lenses. Terrain colour is
   recomputed per tile through allocation-heavy `Phaser.Color` helpers, when it is constant
   across a row and the codebase already contains the integer-math version of the same function
   at `sky.ts:496`. Hoisting the row-invariant computation and rewriting `blend`/`fogColor` as
   integer arithmetic removes roughly 10^4 allocations per frame while changing no pixel, as
   long as each function's current rounding behaviour is reproduced exactly.
7. **B2** — six sites destroy tween-animated Containers without `killTweensDeep`, leaking
   `repeat: -1` tweens for the rest of a scene visit. This is the failure mode `perf-check`'s
   tween gate exists to catch, which brings it back to **B3**: fix the gate first, then the
   leaks it should have found.

**Documentation:**

8. **E1** — `DESIGN.md` §2 is the source of truth for progression gates per CLAUDE.md, and it
   currently describes gates the game does not have while explicitly vouching that they hold.

## Overlaps and caveats

- **A2/A3 and B1** describe the same underlying terrain-colour cost from the rendering and the
  memory lens; treat them as one work item. **A6 and B2** likewise overlap: the sprite-pickup
  sites A6 names (`OverworldScene.ts:2172`, `:3431`, feeding `art/tokens.ts` and
  `art/crystals.ts`) are among B2's six `destroy()`-without-`killTweensDeep` sites, so one fix
  closes both, though A6's separate point about culled sprites still ticking is its own. **D2
  and F8** are the same eight-versus-ten `MATERIAL_BLURBS` gap, seen from the data side and the
  player-text side.
- Findings from the data lens were sampled, not exhaustive: the quiz pool is 322 questions and
  the agent covering it says in its scope note how much it actually read. An absence of findings
  in some corner of that pool is not evidence that corner is clean.
- Physics judgements here are flagged, not settled. **D3**, **D4**, **D8** and **D9** touch
  physical claims in player-facing text, and CLAUDE.md puts physics first, so those are worth
  the owner's own reading rather than a patch applied on an agent's say-so.
- Settled rulings were seeded into every agent and are not re-litigated here: World 7's spinons,
  real-material trivia in worlds 2/3/6/8/9, the post-game stat ceiling, flat floor tiles, the
  dash and citation rules applying to player text only, and the retired no-re-render rule. Items
  already tracked in `dev_notes/POLISH_BUILD_TASK.md` were likewise excluded, except **E3**,
  which reports that one of those tracked items is now stale and can be closed.

---

# Status: every finding acted on

All 36 were worked through on 2026-08-30. What follows is what happened to each,
then the findings themselves, kept in full as the record of why.

Eight involved a real choice and were put to the owner. The rulings:

| # | Decision |
| --- | --- |
| C1 | **Not done.** The custom Phaser entry is left for another day; the bundle stays at 2.02 MB. |
| D2 | Comment corrected only. No World 9 golem blurbs authored. |
| D4 | The two rivals' second moves swapped. |
| D5 | Repeated compounds aligned to one look, **and** a content-lint rule added so it cannot drift again. |
| D6 | Bonus quiz pools **gated by world** in code, rather than blessing the World 9 case. |
| E6 | Tracked as `POLISH_BUILD_TASK.md` #21, not built. |
| F1 | `"H or"` dropped from the tutorial; no new key bound. |
| F5 | `WORLDS.md` amended to describe the swept ice the renderer draws. |

## What each fix cost, and what proves it

The optimization work changes how the game computes what it draws, never what it
draws, so each one carries its own equality proof rather than an impression:

- **A2/B1** (`blend`, `fogColor` as integer arithmetic) -- checked against
  Phaser's own `IntegerToColor`/`GetColor`/`Linear`/`Clamp` source over
  **600,240 comparisons** including the rounding-vs-truncation edge cases:
  bit-identical.
- **A3/B1** (per-row ground-color memo in `paint.ts`) -- a temporary assertion
  recomputed every cache hit and compared: **92,760 verified hits across all ten
  worlds** with the camera walked between paints, zero mismatches.
- **A5** (adjacent columns share their common edge's projected points) --
  **47,560 carried corner pairs** checked against a fresh projection, zero
  mismatches.
- **A1** (silhouette tessellation cached per world) -- **72 replays** compared
  against the original per-frame tessellation, byte-identical. Worlds 6, 7, 9 and
  10 draw no silhouette at all, as the finding predicted.
- **A4** (overlook scatter and palette cached) -- **4,978 replayed texture marks**
  each consumed exactly the random draws recorded for it, zero mismatches, over
  19 cached overlook frames.
- **C3** (Modern soundtrack derived lazily) -- `npm run music-arc-check` passes in
  `modern` style: all 20 scores audible, the live style toggle works, and no
  console errors, which means `assertLoopBeats` still guards each derived score.

Two of the consistency fixes lengthened a string a player reads, and neither
`tsc` nor any of the suites can see a panel outgrowing its canvas, so both were
measured in a headless browser at all three text-size presets:

- **F2**, World 9's rival taunt, is the panel `POLISH_BUILD_TASK.md` #0 was
  opened for, so it matters most. Page 1 is now 329 characters against page 2's
  untouched 634. At the Large preset its text box measures
  `[168, 277] -> [687, 405]` inside a panel running to y=470, clear of the golem
  art above and the `Next ->` button at y=421.
- **F4**, the Settings tutorial page, is the tallest of the Tutorial station's
  topics. At Large its container bottom sits at 438 of 480, with the Close
  button reachable.

Screenshots of both at every preset are in this session's scratchpad.

`tsc --noEmit`, `npm run content-lint` (with its new rule), `npm run perf-check`
and `npm run component-check` (**56/56**) are all clean.

## Two things found while fixing, that were not in the audit

**`perf-check`'s new pickup gate needed a different instrument than the finding
proposed.** B3's fix was to make the tween check actually open panels. It does --
six stations, clicked by their own buttons, three cycles. But the obvious
assertion for pickups, "the tween count must not grow", passes even with the leak
present: a sprite's sparkles are created when it *spawns*, so a leaking pickup
does not grow the count, it fails to shrink it. The gate now looks for the actual
defect -- a live tween whose target has been destroyed, which Phaser makes
observable by clearing a destroyed object's `scene`. Proven by reverting the fix:
**18 orphaned tweens with the leak, 0 without.**

**`greyscale-check` does not finish a run.** E3 said POLISH #13b was stale and
could be closed. Running the script twice settled it: #13b's diagnosis is indeed
dead -- it reaches battles and reports full readings. But neither run got through
all ten worlds. Both died with `window.__game` gone from the page, at *different*
worlds (3, then 7). #13b has been rewritten to that, and `DEVELOPMENT.md`'s claim
that consecutive runs agree has been narrowed to the worlds a run actually
reaches. Porting `component-check`'s crash recovery is the next step and is not
done.

## Smaller notes

- `npm run quiz-topic-check` moved from 109 to 110 flagged questions. The one
  addition is the cuprate question from **D9**, whose own session now ranks 4th
  instead of 3rd on a keyword heuristic, because correcting "hundreds of kelvin"
  to "roughly 90 to 135 K" removed the words the heuristic was scoring. The
  physics is session 5's. This is the "triage, not a verdict" case the script's
  own header describes.
- `perf-check`'s relative-cost check intermittently warns that world 1 paints at
  2.5-3.3x the median. It warned on some runs and not others both before and
  after this work, on a machine also running dev servers and headless Chrome. It
  is a wall-clock measurement and world 1 legitimately has the highest op count,
  so it reads as machine noise rather than a regression, but it is worth a look on
  a quiet machine.
- `npm run docs` regenerates with no diff: the swapped rival moves and realigned
  hue steps do not appear in any generated table.

---

# Findings

## A. Optimization: per-frame and per-paint rendering cost

**Scope covered.** Covered: the whole overworld per-frame path (OverworldScene.update -> drawWorld -> terrain/paint.ts -> materials/ -> sky.ts -> horizons.ts/stars.ts/qumatuomiMap.ts), the sprite update/cull path, and the tween lifecycle around crystals/tokens. I re-derived the visible tile count (~573 fills/frame: ~413 grid + ~160 margin, at Meso, unchanged at Macro because the lane clip and draw distance bound it) by reimplementing paint.ts's loop bounds and clip tests in a scratch script, since that number underpins the arithmetic in three findings.

Looked at and found clean: BattleScene has no `update()` at all and paints its arena backdrop once at scene create, so battles cost only their active tweens; battle FX (attackShapes/attackUltimates/attackFx) use one Graphics per effect with `clear()`+redraw inside a tween `onUpdate` and `destroy()` on complete, which is the right shape for genuinely animated content; `updateGatePrompt`/`updateGuardianPrompt` call `setText` and `setInteractive` every frame but Phaser guards both (Text.js:633 compares against `_text`, InputPlugin.js:934 short-circuits when `gameObject.input` exists), so they are not re-rendering textures; `art/stars.ts` costs about 150 ops a frame for 22 nodes and up to 32 links, and its cloud occlusion is 6 ellipses in world 9 only; `art/trees.ts` and `art/shapes.ts` are already carefully optimised (size-bucketed ellipse tessellation, the three crown lobes fused into one cached outline, the earcut bypass for convex quads) - my tree finding is only about the loop-invariant blends, not the geometry; `regionRuns()` in qumatuomiMap.ts is already cached for exactly the reason my finding says `drawRegionTextures` was not; `terrain/plan.ts`'s output is cached behind `terrainPlanCache` and correctly invalidated on map change; `hazeCache` correctly memoises the haze target per frame.

Deliberately not written up: `decoration.ts` is entirely dead at runtime (`GROUND_MOTIFS_ENABLED = false`, decoration.ts:16, and paint.ts:90 guards on it) but I cannot prove read-only whether Rollup already folds the cross-module const away, so I have no bundle number to offer. Skipping `drawWorld()` while a dialogue is open is a real saving but a visible trade, not a free win - the panel is 600px of an 854px canvas, so the animated terrain around its edges would freeze; I am flagging it in one line rather than as a finding. Splitting the terrain into static and animated Graphics so a stationary camera repaints nothing is the largest structural saving available but is high-effort and high-risk, and I am proposing nothing there.

Two gaps in existing coverage worth the owner knowing: `perf-check` measures only the Meso default size from a fresh save, so Macro object counts (the `objects: 500` budget looks tight already at Meso) and the entire world-10 overlook path are outside its net; and it counts Graphics calls, not allocations or tweens outside panel open/close, so findings 2, 3, 5 and 6 have no gate at all today.

### A1. [HIGH] The distant-self silhouette redraws ~1,300-1,600 static fillTriangle ops every frame for geometry that never changes

**Evidence**

- `game/src/scenes/overworld/sky.ts:560`

  > const passes = DISTANT_SWALLOW_STEPS * DISTANT_FEATHER_PX;
  >     g.fillStyle(blend(depicted.hillColor, target, DISTANT_DROWN), 1 - Math.pow(1 - depicted.hillAlpha, 1 / passes));
  >     for (let step = 0; step < DISTANT_SWALLOW_STEPS; step++) {
  >       for (let drop = 0; drop < DISTANT_FEATHER_PX; drop++) {
  >         fillSilhouette(g, self.points, step / DISTANT_SWALLOW_STEPS, drop);

- `game/src/scenes/overworld/sky.ts:604`

  > g.fillTriangle(prevX, prevCrest, p.x, crest, p.x, floor);
  >       g.fillTriangle(prevX, prevCrest, p.x, floor, prevX, prevFloor);

- `game/src/scenes/overworld/sky.ts:82`

  > const DISTANT_SWALLOW_STEPS = 4;
  > const DISTANT_FEATHER_PX = 2;

- `game/src/art/horizons.ts:223`

  > for (let x = 0; x <= W + SHARD_PERIOD; x += SHARD_PERIOD) {

- `game/src/scenes/overworld/terrain/paint.ts:105`

  > drawDepthHaze(g, view);

**What is wrong.** `fillSilhouette` reads only `profile` (a module-level constant built once into `DISTANT_SELVES`), `HORIZON_Y`, `MAX_CREST`, and the loop's own `foot`/`drop`. Every one of those is frame-invariant, so the triangle geometry emitted is byte-identical on every frame. Only the single `fillStyle` colour depends on anything live (`target`, which moves only when `view.hazeBlend > 0`, i.e. within HAZE_INHERIT_TILES of an open goal). Yet the whole thing is re-emitted from `drawTerrain` -> `drawDepthHaze` -> `drawDistantSelf` at 60 Hz. Counts: standing in world 5 the depicted profile is `shardRows` (854/26 + 1 = 34 iterations x 3 points = 102 points, 101 segments), so 101 x 2 x 8 passes = 1,616 `fillTriangle` calls per frame, about 10% of world 5's 16,000-op perf-check budget. Standing in world 1 the profile is `columnTeeth` (854/44 + 1 = 21 iterations x 4 points = 84 points), 83 x 2 x 8 = 1,328 ops, about 6% of world 1's 21,000. World 4 (`glacierRidges`, ~65 points) is ~1,024. Worlds 6, 7, 9 and 10 pay nothing because the depicted world's `hillAlpha` is 0 (art/biomes.ts:306/353/420), so this is 6 of 10 worlds. The module's own comment at sky.ts:586 already notes "the whole silhouette is redrawn `passes` times a frame, which made this one shape the most expensive thing the game drew" - the pass count was optimised, the per-frame-ness was not.

**Saving, and why quality survives.** 1,000-1,600 Graphics draw ops per frame in worlds 1-5 and 8, i.e. 6-10% of the entire measured paint pass in those worlds, plus the same number of triangle tessellations in Phaser's batch. Quality survives exactly: a Graphics (or RenderTexture) holding the identical command list, drawn at the same z-position between drawPassAperture and OVERHEAD_SKIES, composites to the same pixels. Nothing about the silhouette is animated - the animated sky extras (`self.sky?.()`, art/horizons.ts's stormSky/webSky/scarSky) are a separate call and stay per-frame.

**Recommendation.** Move the `fillSilhouette` loop into its own Graphics object owned by OverworldScene, drawn once on scene create and re-drawn only when `target` (the live haze colour) or the depicted world changes; keep its depth between the atmosphere Graphics and whatever OVERHEAD_SKIES paints so z-order is unchanged. `npm run perf-check` gates it directly - the per-world op counts should drop by the amounts above and the BUDGETS entries can then be lowered rather than raised. Pixel-identity should be proven with the `visual-proof` skill's seeded pixel-diff plus `npm run greyscale-check`; `component-check` would catch nothing here.

### A2. [HIGH] `blend()` and `fogColor()` allocate three JS objects (one a template string) per call, in the per-tile terrain loop that runs ~570 times a frame

**Evidence**

- `game/src/art/colors.ts:34`

  > export function blend(a: number, b: number, t: number): number {
  >   const ca = Phaser.Display.Color.IntegerToColor(a);
  >   const cb = Phaser.Display.Color.IntegerToColor(b);

- `game/src/art/perspective.ts:47`

  > export function fogColor(base: number, depthRatio: number, target = 0xbfe3ff): number {
  >   const c1 = Phaser.Display.Color.IntegerToColor(base);
  >   const c2 = Phaser.Display.Color.IntegerToColor(target);

- `game/src/scenes/overworld/terrain/color.ts:38`

  > return blend(fogColor(base, depthRatio, target), target, near + (1 - near) * close);

- `game/node_modules/phaser/src/display/color/IntegerToColor.js:22`

  > var rgb = IntegerToRGB(input);
  > 
  >     return new Color(rgb.r, rgb.g, rgb.b, rgb.a);

- `game/node_modules/phaser/src/display/color/Color.js:329`

  > this._rgba = 'rgba(' + r + ',' + g + ',' + b + ',' + (a / 255) + ')';

- `game/src/scenes/overworld/sky.ts:496`

  > function lerpColor(a: number, b: number, t: number): number {
  >   const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t);

**What is wrong.** Every ground fill in the paint pass goes through `groundColor`, which calls `fogColor` (2 x IntegerToColor) then `blend` (2 x IntegerToColor). Each `IntegerToColor` allocates an `IntegerToRGB` result object plus a `Color` instance, and the `Color` constructor's `update()` builds an `rgba(...)` template string that nothing here ever reads. That is 4 Color objects + 4 rgba strings + 4 rgb objects = 12 allocations for the minimum single fill of one tile. Tile count per frame, from the loop bounds in paint.ts:56-77 with DRAW_DISTANCE_TILES = 15 and BASE_GRID_W = 27: about 17 rows x ~24 in-lane columns = ~413 grid tiles plus ~160 margin-column tiles = ~573 tile fills (I reimplemented the exact loop bounds and clip tests in a scratch script to get this; it is the same at the far edge, where margin rows replace grid rows). So the floor is 573 x 12 = ~6,900 allocations and ~2,300 throwaway strings per frame, ~410k allocations/sec at 60 Hz - and that is the floor: `walkableHazeTarget` (paint.ts:311) adds a blend per path tile, `bandBase` another where a biome has bands, the region tint another, and every material accent several more (art/trees.ts:149-155 is three per tree, terrain/materials/bog.ts blends up to six times per water tile). The codebase already contains the fix in another file: sky.ts's `lerpColor` is a pure integer bit-math lerp written for its own per-row hot path, but the terrain loop still calls the Color-allocating `blend`.

**Saving, and why quality survives.** Eliminates on the order of 10^4 object allocations and 10^3-10^4 string allocations per frame (roughly 10^6/sec at 60 Hz), removing the GC pressure that shows up as frame-time spikes rather than as a raised average. Pure CPU/GC: not a single draw call changes, so nothing on screen moves. The one care point is byte-identity - `blend` rounds each channel with `Math.round`, while `fogColor` passes unrounded `Phaser.Math.Linear` floats into `GetColor`, whose `red << 16 | green << 8 | blue` truncates. An integer rewrite must reproduce both behaviours (round in one, truncate in the other) or the terrain palette shifts by a value and it stops being a free win.

**Recommendation.** Rewrite `blend` in art/colors.ts and `fogColor` in art/perspective.ts as pure integer shift/mask arithmetic, matching sky.ts:496's existing `lerpColor` shape, preserving each function's current rounding behaviour exactly. No existing gate covers the allocation regression itself - `perf-check` counts Graphics calls, not allocations. What does gate the risk is colour identity: run the `visual-proof` skill's seeded pixel-diff (expect a zero diff) and `npm run greyscale-check`. `perf-check` should be run alongside to confirm draw-op counts are unchanged.

### A3. [HIGH] Terrain colours that are constant across a whole row are recomputed once per tile, including for margin tiles that all share one source tile

**Evidence**

- `game/src/scenes/overworld/terrain/paint.ts:86`

  > let color = groundColor(bandBase(tile.biome, tile.biome.path, y), depthRatio, walkableHazeTarget(view, tile.biome, depthRatio));

- `game/src/scenes/overworld/terrain/paint.ts:443`

  > const base = groundColor(bandBase(biome, biome.ground, gy), depthRatio, hazeTarget(view, biome));

- `game/src/scenes/overworld/terrain/paint.ts:231`

  > const laneClip = laneClipAt(camY - y + 0.5);

- `game/src/scenes/overworld/terrain/paint.ts:247`

  > g.fillStyle(offPathColor(view, edge.biome, edge.regionTint, y, depthRatio), 1);

- `game/src/scenes/overworld/terrain/paint.ts:150`

  > for (let gx = Math.floor(view.camX - laneClip); gx < 0; gx++) {
  >     drawMarginTile(view, row[0], gx, y, gx === -1);

- `game/src/art/trees.ts:137`

  > const air = depth * 0.8;

- `game/src/art/trees.ts:149`

  > g.fillStyle(blend(style.trunk, haze, air), alpha);

**What is wrong.** Inside `drawTerrain`'s inner x loop, `depthRatio` and `y` are row constants and `hazeTarget` is already per-frame memoised, so `bandBase(...)`, `walkableHazeTarget(...)`, `groundColor(...)` and `offPathColor(...)` return the *same number* for every tile of the same biome and kind in that row - about 24 identical recomputations per row, ~17 rows per frame. The margin path is worse: `drawMarginColumns` passes the *same object* (`row[0]` or `row[cols - 1]`) to every margin tile on that side, so `offPathColor(view, edge.biome, edge.regionTint, y, depthRatio)` at paint.ts:247 is provably identical for all ~10-25 of them, and `drawMarginTile` also re-derives `depthFar`/`depthNear`/`depthRatio` and calls `laneClipAt` again per tile even though its caller computed the row's `laneClip` two frames up the stack (paint.ts:148). The same pattern runs through the accents: art/trees.ts's `air = depth * 0.8` is a row constant and `style`/`haze` are per-biome, so `blend(style.trunk, haze, air)`, `blend(style.canopyShade, haze, air)` and `blend(style.canopy, haze, air)` are three fixed values per row, recomputed once per tree - and world 1 draws hundreds of trees a frame (hasTree fires on 86% of forest tiles). terrain/materials/bog.ts and charged.ts have the identical `blend(CONST, haze, air)` shape. This compounds with the allocation finding above: each recomputation is also 6 wasted object allocations.

**Saving, and why quality survives.** Cuts the colour work in the paint pass by roughly the row width - order 20x on the base fills, and on world 1 turns ~900 per-tree blends per frame into ~3 per row (about 50 per frame). Combined with an integer `blend`, the two together take the terrain pass's colour cost from ~10^4 allocations/frame to a few hundred arithmetic ops. Zero visual change: the memo returns the number the current code computes, and where a tile genuinely differs (a per-tile `regionTint` in worlds 1 and 3, a `biomeOverride` patch in world 9) the memo key includes it and falls through.

**Recommendation.** Hoist a small per-row memo in `drawTerrain` keyed by (biome, terrain kind), computed on first use in each row and dropped at the row boundary; apply the same to `drawMarginRows`, and hoist `depthFar`/`depthNear`/`depthRatio`/`laneClip` out of `drawMarginTile` into `drawMarginColumns` (which already has the row's `laneClip`). In the material modules, thread the row-constant blended colours in through `AccentTile` (or memoise per row on the tile's own `depth`) rather than recomputing per tile. No existing gate catches the CPU regression; `perf-check` confirms draw-op counts did not move, and the `visual-proof` seeded pixel-diff plus `npm run greyscale-check` confirm the palette is untouched.

### A4. [MEDIUM] World 10's cliff overlook re-derives the whole Qumatuomi map every frame, on a path perf-check structurally never opens

**Evidence**

- `game/src/art/qumatuomiMap.ts:475`

  > for (let i = 0; i < 560; i++) {
  >     const x = rand() * NATIVE_W;
  >     const y = rand() * NATIVE_H;
  >     if (!insideLand(x, y)) continue;
  >     const { w1, d1, d2 } = nearestTwoWorlds(x, y);

- `game/src/art/qumatuomiMap.ts:309`

  > // would be paid for out of the frame budget of the walk up to the cliff.

- `game/src/art/qumatuomiMap.ts:356`

  > const colorOf = (w: number) => tint(o.discovered.has(w) ? regionColor(w) : UNDISCOVERED_FILL);

- `game/src/art/qumatuomiMap.ts:362`

  > const col = run.mix > 0 ? blend(colorOf(run.w1), colorOf(run.w2), run.mix) : colorOf(run.w1);

- `game/src/art/qumatuomiMap.ts:980`

  > const regionTint: Tint = (c) => blend(blend(c, OVERLOOK_LAND, OVERLOOK_REGION_LIFT), o.target, OVERLOOK_REGION_DROWN);

- `game/src/scenes/OverworldScene.ts:1685`

  > return this.world === FINAL_WORLD && this.isRivalDefeated();

**What is wrong.** `drawQumatuomiOverlook` is called from `drawOverlook` inside `drawDepthHaze`, i.e. once per frame, whenever the player stands at world 10's post-boss cliff. The module cached `regionRuns()` precisely because "re-partitioning the country sixty times a second would be paid for out of the frame budget of the walk up to the cliff" (qumatuomiMap.ts:309) - but `drawRegionTextures` was left out of that reasoning and does exactly what the comment forbids: 560 samples per frame, each running `insideLand` and `nearestTwoWorlds` (a 10-iteration `Math.hypot` scan, qumatuomiMap.ts:211-229), i.e. ~5,600 hypots per frame, to re-derive a scatter that is fully deterministic (`seededRandom(hashSeed('qumatuomi-texture'))`). `paintRegions` then recomputes the 10-value palette per run rather than once: `colorOf` is called 1-2 times per run, each call running `regionTint`, which is two nested `blend`s, so a border run costs ~5 blends = 10 Phaser Color allocations, over the several hundred runs the merged partition produces. Supporting detail inside the same pass: this path uses `g.fillCircle` at qumatuomiMap.ts:973, 373, 398, 429, 505, 597 and 625, which art/shapes.ts:60-68 documents as expanding to ~100 segments whatever the radius, and for which `fillDot` exists as the size-matched replacement. None of this is measured: `perf-check` starts each world with `g.scene.start('Overworld', {world: w})` from a fresh page, so `isRivalDefeated()` is false, `endsAtCliff()` returns false, `view.overlook` is null and `drawOverlook` returns immediately at its first line.

**Saving, and why quality survives.** Removes ~5,600 hypot calls and 560 point-in-polygon tests per frame, plus several thousand Color allocations per frame from the palette recomputation, from the one view the game ends on. Quality is untouched - the scatter is seeded and deterministic, so a cached mark list reproduces the identical marks; only the screen transform and `target` change frame to frame, and both are applied downstream of the cached list. Swapping the `fillCircle`s for `fillDot` is the same trade art/shapes.ts already documents and already made everywhere else.

**Recommendation.** Cache the surviving (world, native x, y, mark-random-draws) list from `drawRegionTextures` in a module-level array alongside `regionRunCache`, and hoist `colorOf` in `paintRegions` into a 10-entry array computed once per call. Replace the `fillCircle` calls on this path with `fillDot`. There is no existing gate: `perf-check` cannot reach this state as written. The cheapest fix to the gate itself is to have perf-check set the world-10 rival-defeated registry flag before its world 10 pass, so the overlook gets a budget entry of its own; without that, any regression here is invisible to CI.

### A5. [MEDIUM] Four corner projections are computed per tile where each corner is shared by up to four tiles

**Evidence**

- `game/src/scenes/overworld/terrain/paint.ts:75`

  > const pFL = projectTile(laneL, depthFar);
  >       const pFR = projectTile(laneR, depthFar);
  >       const pNR = projectTile(laneR, depthNear);
  >       const pNL = projectTile(laneL, depthNear);

- `game/src/scenes/overworld/projection.ts:66`

  > export function projectTile(lane: number, depth: number): ProjectedPoint {
  >   return project(lane * TILE_SCALE, (depth + CAMERA_BACK_TILES) * TILE_SCALE);

- `game/src/art/perspective.ts:32`

  > export function project(lane: number, depth: number): ProjectedPoint {
  >   const d = Math.max(0, depth);
  >   const scale = FOCAL / (FOCAL + d);
  >   return {

- `game/src/scenes/overworld/terrain/paint.ts:80`

  > const fill = contour ? projectContour(contour.outline, camX, camY) : [pFL, pFR, pNR, pNL];

- `game/src/art/shapes.ts:19`

  > if (pts.length !== 4) {
  >     g.fillPoints(pts, true);
  >     return;
  >   }
  >   const [a, b, c, d] = pts;
  >   g.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);

**What is wrong.** Tile x's right lane (`x - camX + 0.5`) is identical to tile x+1's left lane (`(x+1) - camX - 0.5`), and row y's near depth (`camY - y - 0.5`) is identical to row y+1's far depth (`camY - (y+1) + 0.5`). So the grid of ~17 rows x ~24 columns needs (rows+1) x (cols+1) = ~450 distinct projected points, but the loop calls `projectTile` 4 times per tile: ~413 grid tiles x 4 = ~1,650 calls, plus another ~640 for the margin tiles, each returning a fresh `{x, y, scale}` object literal, plus one array literal per tile for `fill`. That is ~2,300 projection objects and ~570 arrays per frame that a per-row scanline cache of lane->point would cut to ~450 and ~570. Sharing the point objects is safe on the common path specifically because `fillPolygon` unpacks a 4-point quad into scalar `fillTriangle` arguments and retains nothing; `projectContour` must keep allocating per its own comment at paint.ts:115-117, since `fillPoints` reads the array again at flush time.

**Saving, and why quality survives.** About 1,850 fewer object allocations and ~1,850 fewer divisions per frame (~110k/sec at 60 Hz), on top of the colour-allocation saving. No visual change at all: the same coordinates are produced, just once instead of up to four times. Risk is higher than the colour findings only because it touches the sharing rules of retained-mode point arrays - the fix must stay on the 4-point `fillTriangle` path and leave `projectContour` alone.

**Recommendation.** Precompute, per row, two arrays of projected points (one at the row's far depth, one at its near depth) indexed by lane, and reuse the far array of row y as the near array of row y+1 as the sweep walks toward the camera; index into them instead of calling `projectTile` per corner. Keep `projectContour` allocating. `perf-check` gates the draw-op count staying flat; the `visual-proof` seeded pixel-diff is the real gate for geometric identity and should show a zero diff.

### A6. [MEDIUM] Crystal and token sprites leak their infinite sparkle tweens on pickup, and keep ticking while culled off-screen

**Evidence**

- `game/src/scenes/OverworldScene.ts:2170`

  > const [sprite] = this.crystalSprites.splice(spriteIndex, 1);
  >       sprite.container.destroy();
  >       sprite.label?.destroy();

- `game/src/scenes/OverworldScene.ts:3429`

  > const [sprite] = this.tokenSprites.splice(spriteIndex, 1);
  >       sprite.container.destroy();
  >       sprite.label?.destroy();

- `game/src/art/crystals.ts:441`

  > GameObject.destroy() does not touch tweens, and makeCrystal below hands
  > // out `repeat: -1` sparkle/glow tweens -- one per shard, plus the hybrid
  > // halo's -- that would otherwise keep animating a dead object forever, one
  > // more leaked set per rebuild.

- `game/src/art/tokens.ts:44`

  > scene.tweens.add({
  >       targets: star,
  >       alpha: { from: 0.15, to: 1 },
  >       duration: 600 + i * 180,
  >       yoyo: true,
  >       repeat: -1,

- `game/src/scenes/OverworldScene.ts:2133`

  > c.container.setVisible(visible);
  >       c.label?.setVisible(visible);
  >       if (!visible) continue;

**What is wrong.** Two things here. (a) The leak: `maybeTriggerEncounter` and `maybeCollectToken` destroy the sprite container without going through `killTweensDeep`, which crystals.ts:438-448 exists for and which every guardian panel and BattleScene's crystal swap does call. Each destroyed container leaves 3-5 `repeat: -1` alpha tweens (art/crystals.ts:579 for crystals, art/tokens.ts:44 for tokens) ticking in the scene's TweenManager against a dead Text object for the rest of the visit. The bound is honest and worth stating: an encounter that ends in a fight reaches `scene.start('Battle')` (OverworldScene.ts:2478), and stopping the scene tears its TweenManager down - but a token pickup never changes scene at all, and the "Let me pass" branch is explicitly documented at OverworldScene.ts:2178 as triggering no scene change, so both of those leak for the remainder of the world visit and accumulate with `respawnWild` adding new sprites. (b) The waste: `updateWorldSprites` culls sprites by depth and lane, but `setVisible(false)` does not stop a tween - every off-screen crystal's and token's sparkles are still evaluated every frame. On a Macro map at High density (150 corridor rows x 0.35) that is on the order of 50 crystals plus the token scatter, i.e. a couple of hundred infinite tweens ticking for a handful of visible sprites. `perf-check`'s tween check only opens and closes panels, so neither half of this is in its net.

**Saving, and why quality survives.** Removes a monotonically growing set of dead tweens (3-5 per pickup, unbounded across a long visit) and a couple of hundred live-but-invisible tween evaluations per frame on large/dense maps. Both are invisible by construction: the leaked tweens animate destroyed objects, and the paused ones animate sprites the culler has already hidden. The one thing to preserve when pausing is phase - Phaser's `pause()`/`resume()` keeps elapsed time, so a sparkle does not jump when a crystal comes back into view.

**Recommendation.** Call `killTweensDeep(this, sprite.container)` before `sprite.container.destroy()` at OverworldScene.ts:2172 and :3430 (the import is already available via art/crystals.ts). Separately, in `updateWorldSprites`, pause/resume the container's tweens alongside `setVisible` when visibility actually flips, rather than on every frame. No existing gate: `perf-check`'s tween-leak check (its section 2) only exercises panel open/close, so it would not catch a regression here; extending that check with an encounter-and-collect round trip would be the cheap way to gate it. `component-check` exercises the walk but asserts nothing about tween counts.


## B. Optimization: runtime memory, object lifecycle and leaks

**Scope covered.** Covered the whole lens territory. Hot paths first: OverworldScene.update -> drawTerrain is the only per-frame repaint in the game (BattleScene, HubScene have no update() at all; only TitleScene:168 and OverworldScene:1539 define one), which is why finding 1 dominates - I simulated the actual paint loops with the real projection constants rather than guessing tile counts.

Looked at and found genuinely clean: zero runtime texture generation anywhere (grep for generateTexture / renderTexture / textures.add returns nothing, so there is no TextureManager leak to hunt). Scene-level input listeners are safe - Phaser's KeyboardPlugin.shutdown (node_modules/phaser/src/input/keyboard/KeyboardPlugin.js:880) calls removeAllKeys+removeAllListeners, and installFullscreenKey/touchControls/BattleScene's arrow bindings are all registered once in create(). The only three window listeners live at module scope in music.ts (two `{once:true}` resume hooks and a pagehide) and are correct. The one game-global subscription, hubStations.ts:1067's scale ENTER/LEAVE_FULLSCREEN pair, is explicitly removed on the container's `destroy` event. Module-level caches are all bounded by construction: mathtext's widthCache/metricsCache key on authored question text x font, moveEffectPreview's `chains` and attackFx's `previewClips` are keyed by a fixed depth-offset band and cleared by stopMoveEffectPreview/cancelPreviewFx, trees.ts's CROWN_OUTLINES keys on point count, sky.ts's hazeCache keys on fogTarget and is cleared each frame. Persisted state does not grow per battle - both discoveredMaterials and defeatedMaterials dedupe by name before appending (OverworldScene:2191, BattleScene:3178), and saveMapState only writes the registry, not localStorage. mathtext is not re-laid-out per draw; makeQuestionText runs once per question render.

Minor, not written up: ui/text.ts's fitProseToBudget shrink loop calls setText/setFontSize repeatedly, each of which re-renders the Text's canvas and re-uploads a texture - up to ~10 uploads per panel open, bounded and one-shot, so not worth a change. persistFromRegistry does a synchronous JSON.stringify + localStorage.setItem on every token pickup and every first discovery; correct for durability, and not per-frame.

Nothing here touches physics or teaching content, and findings 1-3 are all bit-for-bit visually neutral.

### B1. [HIGH] Terrain paint allocates ~10-17k throwaway Phaser.Color objects per frame recomputing colours that are constant across a whole row

**Evidence**

- `game/src/scenes/overworld/terrain/paint.ts:86`

  > let color = groundColor(bandBase(tile.biome, tile.biome.path, y), depthRatio, walkableHazeTarget(view, tile.biome, depthRatio));

- `game/src/scenes/overworld/terrain/color.ts:38`

  > return blend(fogColor(base, depthRatio, target), target, near + (1 - near) * close);

- `game/src/art/colors.ts:34`

  > export function blend(a: number, b: number, t: number): number {
  >   const ca = Phaser.Display.Color.IntegerToColor(a);
  >   const cb = Phaser.Display.Color.IntegerToColor(b);

- `game/src/art/perspective.ts:48`

  > const c1 = Phaser.Display.Color.IntegerToColor(base);
  >   const c2 = Phaser.Display.Color.IntegerToColor(target);

- `game/node_modules/phaser/src/display/color/IntegerToColor.js:26`

  > var rgb = IntegerToRGB(input);
  > 
  >     return new Color(rgb.r, rgb.g, rgb.b, rgb.a);

- `game/node_modules/phaser/src/display/color/Color.js:139`

  > this.gl = [ 0, 0, 0, 1 ];

- `game/src/scenes/overworld/terrain/paint.ts:455`

  > function bandBase(biome: Biome, base: number, gy: number): number {

- `game/src/scenes/overworld/terrain/paint.ts:310`

  > function walkableHazeTarget(view: TerrainView, biome: Biome, depthRatio: number): number {
  >   return blend(hazeTarget(view, biome), biome.path, 0.35 * (1 - Math.pow(depthRatio, 3)));

- `game/src/art/trees.ts:149`

  > g.fillStyle(blend(style.trunk, haze, air), alpha);

- `game/src/scenes/OverworldScene.ts:1539`

  > update() {
  >     this.drawWorld();

**What is wrong.** Churn problem, not a leak, but by far the largest allocation source in the game. `drawTerrain` runs from `OverworldScene.update()` every frame and paints every visible tile. I simulated the exact loops with the real constants (CANVAS_W 854, FOCAL 2.2, LANE_PX 150, TILE_SCALE 0.6, DRAW_DISTANCE_TILES 15, 27x50 Meso grid, camera mid-map): 413 real tiles + 170 margin-column tiles = 583 tiles per frame, of which 291 are inside DETAIL_MAX_DEPTH and also run the accent pass.

Every one of those tiles recomputes its colour from scratch through `Phaser.Display.Color.IntegerToColor`, which allocates three heap objects per call (the `IntegerToRGB` literal, the `Color` instance, and the `gl` array Color.js:139 builds in its constructor). So `blend` = 6 objects, `fogColor` = 6, `groundColor` = fogColor + blend = 12. A banded walkable tile pays groundColor (12) + walkableHazeTarget's blend (6) + bandBase's blend (6) = 24, plus 6 more if it carries a regionTint; an off-path tile pays roughly the same through `offPathColor`, and the accent layer adds more (art/trees.ts does 5 blends per tree tile = 30 objects; bog.ts up to 7).

Conservatively 20 objects/tile x 583 tiles = ~11,700 objects per frame, plus ~5,000 from the accent pass on the 291 detail tiles: ~17,000 short-lived objects per frame. At 60fps that is ~1.0M allocations/second; at roughly 200 bytes per IntegerToColor triple (~5,700 calls/frame) that is ~1.1 MB of garbage per frame, ~68 MB/s.

The waste is almost entirely redundant. `depthRatio` is derived from `depthFar = camY - y + 0.5`, so it is constant for a whole row; `bandBase(biome, base, gy)` reads only biome/base/row; `walkableHazeTarget` and `seamed` are functions of (biome, row) only; and the accent modules' `blend(constantColor, haze, air)` calls use `air = depth * 0.8`, also row-constant. An entire row of 16-29 tiles therefore computes byte-for-byte the same fill colour 16-29 times over.

**Saving, and why quality survives.** Two independent wins. (a) Memoising the row-constant colours (walkable fill, off-path base, accent haze mixes) once per row instead of once per tile cuts the ground-plane colour work by ~20x with numerically identical output - no new arithmetic at all, just hoisting. (b) Rewriting `blend`/`fogColor`/`shade` as integer bit math ((c>>16)&255 etc., same Math.round / same truncating shifts Phaser's GetColor uses) removes the Color/gl/IntegerToRGB allocations entirely and is bit-identical if the same float ops are kept before the shift. Together these should take terrain colour allocation from ~17k objects/frame to a few hundred. Quality survives completely: the same integers reach `g.fillStyle`, so not one pixel changes. This is a free win, not a trade.

**Recommendation.** Hoist the row-constant colour computation out of the per-tile loops in paint.ts (drawTerrain, drawMarginRows, drawMarginTile) into a per-row memo, then rewrite art/colors.ts's `blend` and art/perspective.ts's `fogColor` with integer channel math. Key the memo on (row, tile.biome) rather than row alone - tiles carry their own `tile.biome` and a row can contain a biome override, so a row-only key would be wrong. No existing gate covers allocation counts; `npm run perf-check` would catch a draw-op regression and `npm run greyscale-check` plus a seeded pixel-diff (the visual-proof workflow) is what should gate the colour output being unchanged. Do not pool the per-tile ProjectedPoint/`fill` arrays as part of this - paint.ts:118's own comment documents that Phaser's retained-mode `fillPoints` reads the array again at flush time, and `fill` also flows into accentTile/drawOffPathTile, which I did not audit for retention.

### B2. [HIGH] Six sites destroy tween-animated Containers without killTweensDeep, leaking repeat:-1 tweens for the rest of the scene visit

**Evidence**

- `game/src/scenes/OverworldScene.ts:2493`

  > this.dialogueContainer?.destroy(true);

- `game/src/scenes/HubScene.ts:1335`

  > this.dialogueContainer?.destroy(true);

- `game/src/scenes/panels/listDetail.ts:56`

  > so a plain `dialogueContainer?.destroy(true)` leaks one more set of them
  > // on every rebuild, forever. Every panel rebuild goes through here instead.

- `game/src/scenes/panels/listDetail.ts:59`

  > export function destroyPanel(scene: GuardianPanelHost) {
  >   if (!scene.dialogueContainer) return;
  >   killTweensDeep(scene, scene.dialogueContainer);

- `game/src/scenes/OverworldScene.ts:2172`

  > const [sprite] = this.crystalSprites.splice(spriteIndex, 1);
  >       sprite.container.destroy();

- `game/src/scenes/OverworldScene.ts:3431`

  > const [sprite] = this.tokenSprites.splice(spriteIndex, 1);
  >       sprite.container.destroy();

- `game/src/scenes/OverworldScene.ts:3354`

  > refreshPlayerCrystal() {
  >     this.playerCrystalGfx.destroy();

- `game/src/scenes/HubScene.ts:862`

  > refreshPlayerCrystal() {
  >     this.playerCrystalGfx.destroy();

- `game/src/art/tokens.ts:44`

  > scene.tweens.add({
  >       targets: star,
  >       alpha: { from: 0.15, to: 1 },
  >       duration: 600 + i * 180,
  >       yoyo: true,
  >       repeat: -1,

- `game/src/art/crystals.ts:544`

  > if (!opts?.plain) {
  >     const stars = Array.from({ length: jitter?.sparkleCount ?? 3 }, () => ({ glyph: jitter?.sparkleGlyph ?? '✦' }));
  >     addHighlightAndSparkles(scene, container, size, stars);

- `game/src/art/crystals.ts:583`

  > yoyo: true,
  >       repeat: -1,
  >       delay: i * 220,

- `game/src/art/noether.ts:65`

  > scene.tweens.add({ targets: sway, angle: { from: -2.5, to: 2.5 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

- `game/src/scenes/OverworldScene.ts:1855`

  > a map never carries more pickups at once
  >   // than it stood up, and over time it gives back without limit

**What is wrong.** A true leak, bounded by scene lifetime but unbounded within a visit. The codebase already knows this hazard and solved it: `destroyPanel` (listDetail.ts:59) kills tweens before destroying, and its comment says in as many words that a bare `destroy(true)` "leaks one more set of them on every rebuild, forever". Every panel *rebuild* goes through it. Six paths do not:

1-2. `closeDialogue()` in both OverworldScene (2491) and HubScene (1333) - the final close, i.e. Farewell, Close, and the encounter dialogue's "Let me pass" - calls `dialogueContainer?.destroy(true)` with no killTweensDeep. Every guardian panel is full of repeat:-1 tweens (noether.ts alone has an avatar sway, a body pulse, and one per orbiting ring; bloch.ts the same plus its selection-ring pulse; plus makeCrystal's per-shard sparkles on the detail-pane crystal at listDetail.ts:465/671). Order 10-30 orphan infinite tweens per panel close.
3. `maybeTriggerEncounter` (2172) destroys the wild crystal's Container. `makeCrystal` runs `addHighlightAndSparkles` for every non-`plain` crystal (crystals.ts:544) and `addCrystalSprite` passes no `plain`, so each wild carries >=3 repeat:-1 sparkle tweens (a hybrid also carries the halo glow at crystals.ts:676). Choosing "Let me pass" never changes scene, so those tweens keep ticking against destroyed objects in the live overworld.
4. `maybeCollectToken` (3431) destroys the pickup Container; art/tokens.ts:44 gives every token 3 unconditional repeat:-1 tweens. Token pickup never changes scene either, and OverworldScene's own comment (1855) says pickups respawn "without limit", so a player who walks a loop farming qumatessence accumulates 3 orphan infinite tweens and 3 retained dead Text objects per pickup with no ceiling short of leaving the world.
5-6. `refreshPlayerCrystal()` in both scenes destroys and rebuilds the avatar crystal the same way (a few times per session, minor by comparison).

Each orphan is a live Phaser Tween the TweenManager iterates and evaluates every frame, writing `alpha`/`angle` into a destroyed GameObject, and the tween's `targets` array pins those dead objects so they cannot be collected.

**Saving, and why quality survives.** A realistic overworld stretch - 40 tokens collected, 20 encounters passed, 5 panels opened and closed - leaves roughly 120 + 60 + 150 = ~330 permanently-running tweens and ~330 retained dead display objects, all ticking every frame for the rest of the visit. The fix is one `killTweensDeep(scene, obj)` line at each of the six sites (route the two `closeDialogue()` bodies through the existing `destroyPanel`), which costs one recursive walk of an already-doomed container. Quality survives absolutely: the objects were being destroyed anyway and the tweens were animating nothing visible. Free win.

**Recommendation.** Add `killTweensDeep` before each of the six `destroy()` calls, and make both `closeDialogue()` implementations call `destroyPanel(this)` so the final close and the rebuild take the same path. Gate: `npm run perf-check`'s check #2 is the right gate but is currently inert - see the next finding; fix that check first, then it gates this.

### B3. [MEDIUM] perf-check's tween-leak check never opens a panel, so it can never fail

**Evidence**

- `game/scripts/perf-check.mjs:242`

  > // Every station that opens a panel, opened and closed in turn.
  >       const before = baseline;
  >       for (let i = 0; i < 3; i++) {
  >         s.dialogueContainer?.destroy(true);
  >         await new Promise((r) => setTimeout(r, 120));
  >       }
  >       const after = count();

- `game/scripts/perf-check.mjs:19`

  > //   2. Tween leaks      -- opening and closing every panel returns the tween
  > //                          count to baseline (Phaser's destroy() does not kill
  > //                          tweens; art/crystals.ts's killTweensDeep is why).

- `game/scripts/perf-check.mjs:237`

  > g.scene.start('Hub');
  >       await new Promise((r) => setTimeout(r, 900));

**What is wrong.** Gate defect, not a runtime cost. The header advertises check 2 as "opening and closing every panel returns the tween count to baseline", and the inline comment says "Every station that opens a panel, opened and closed in turn". The loop body does neither: it only calls `s.dialogueContainer?.destroy(true)` three times, and the scene was freshly started 900ms earlier with no dialogue open, so `dialogueContainer` is undefined and the three iterations are no-ops. `before` is assigned from `baseline` on the line above, `after` re-reads the same unchanged count, and the assertion `after > before` is structurally unreachable. The suite reports "PASS tween leak -- N -> N, no growth" on every run regardless of what the code does. This is exactly why the six unkilled-tween sites above have been invisible.

**Saving, and why quality survives.** No bytes or frames saved directly - this is the gate that makes the previous finding's saving durable. Fixing it costs a few seconds of the perf-check run (it already drives the Hub). Quality survives trivially; it is test-only code.

**Recommendation.** Make the loop actually drive the Lab: for each station, invoke its open handler, wait for `s.dialogueContainer` to exist, then call `s.closeDialogue()`, and compare tween counts across the whole cycle. Verify the fixed check fails against today's `closeDialogue()` before landing the killTweensDeep fix, so the gate is proven to bite. Gated by: `npm run perf-check` itself (this is that script).

### B4. [LOW] Web Audio: no disconnect() anywhere in music.ts or sfx.ts; each track switch orphans a session gain plus a 5-node delay-feedback bus still wired to master

**Evidence**

- `game/src/audio/music.ts:1757`

  > prevGain.gain.cancelScheduledValues(now);
  >       prevGain.gain.setValueAtTime(prevGain.gain.value, now);
  >       prevGain.gain.linearRampToValueAtTime(0, now + 0.15);

- `game/src/audio/music.ts:1760`

  > const sessionGain = ctx.createGain();
  >     sessionGain.gain.value = 0;
  >     sessionGain.connect(this.master!);

- `game/src/audio/music.ts:1698`

  > input.connect(delay);
  >     delay.connect(darken);
  >     darken.connect(feedback);
  >     feedback.connect(delay);
  >     darken.connect(wetOut);
  >     wetOut.connect(dest);

- `game/src/audio/music.ts:1798`

  > nextLoopAt += loopBeatsSeconds;
  >       this.timer = window.setTimeout(scheduleLoop, loopMs);

- `game/src/audio/sfx.ts:57`

  > const osc = ctx.createOscillator();

**What is wrong.** Untidy, with an unresolved GC question - I am deliberately not calling this a confirmed leak because it cannot be settled statically. `grep -c disconnect` returns 0 for both music.ts and sfx.ts. Every switch of score (`play()` with a new key, or `setStyle()` restarting the current one) ramps the outgoing `sessionGain` to zero over 0.15s and then drops the reference, but never disconnects it from `this.master`, and never disconnects that track's `createAmbienceBus` graph - an input gain, a DelayNode, a feedback gain, a lowpass and a wet-out gain, six nodes total per switch, containing a genuine feedback cycle (music.ts:1698-1703). The game switches score on every overworld->battle->overworld transition, so a session with 200 battles performs ~400 switches and orphans ~2,400 nodes. Whether Chrome reclaims them depends on its tail-time/propagates-silence handling of a delay feedback loop with no JS reference, which I cannot verify from source. The per-note oscillators/gains in both files (music.ts:1917-2035, sfx.ts:57-263) have the same shape: `osc.stop(...)` is always called, nothing is ever disconnected from the still-live master bus.

Sub-item, untidy only: `play()` does `const token = ++this.stopToken` but never clears the outgoing track's pending `window.setTimeout` before overwriting `this.timer` (music.ts:1798). The stale timer fires once, sees the token mismatch and returns, so it is self-terminating - one dead callback per track switch, not accumulation.

**Saving, and why quality survives.** Small and speculative: at most a few thousand Web Audio nodes reclaimed over a long session, worth maybe a few hundred KB of native audio-graph memory plus whatever per-render-quantum work Chrome still spends on a not-yet-silenced feedback delay. The insurance is nearly free: after the 0.15s crossfade in `play()` and in `stop()`, schedule `prevGain.disconnect()` (and disconnect the ambience input) ~300ms later. Quality survives: the disconnect happens strictly after the fade has already reached zero, so nothing audible is cut - if it were scheduled earlier it would clip the outgoing echo tail, which is the one thing to get wrong here.

**Recommendation.** In `MusicEngine.play()` and `stop()`, keep a handle to the outgoing sessionGain and its ambience input and disconnect both from a `setTimeout` comfortably after the 0.15s ramp (300ms is safe). Optionally clear the outgoing `this.timer` in `play()` for tidiness. Do not add per-note `onended` disconnects in sfx.ts/music.ts's percussion - that would add a callback per note to save nodes the browser almost certainly already reclaims. No existing gate: `npm run music-arc-check` checks score structure, not the node graph; verification here means a manual heap/AudioContext inspection in a browser.


## C. Optimization: bundle size, dead code and startup cost

**Scope covered.** Covered: how Phaser is imported and what the build actually pulls in (verified against the installed `phaser@3.90.0` package, not assumed); a whole-repo unused-export scan; the shape of the three large data modules; module-top-level startup work; and duplication across the ten world generators, eleven terrain materials and per-guardian panels.

Method note so the numbers are checkable: I ran the repo's own esbuild into the scratchpad only — an esbuild metafile pass over `src/main.ts` with `phaser` external (per-module byte attribution), two bundles of `phaser/src` (full vs. a custom entry), and a transpile of `music.ts` evaluated under a DOM shim to count notes and time the derivation. No project build, no dev server, no banned script, no file in the repo touched.

Where the bytes actually are: shipped bundle 2,020,866 B raw / 512,230 B gz. Game code minifies to 558,617 B, so Phaser is ~1.46 MB — 72% of the bundle. That is why finding 1 is the only large lever here and everything else is small.

Looked at and found clean, or found not worth doing:
- `data/quiz.ts` is the biggest single game module at 127,860 B minified (23% of game code), but it is not shape-waste: 322 questions at ~397 B each, three keys per object (`prompt`/`correct`/`incorrect`), no repeated boilerplate. Collapsing to positional tuples would save ~12 KB raw / ~3 KB gz and cost real readability on hand-written physics content. Not recommended.
- Deferring `quiz.ts` behind a dynamic `import()` would cut ~128 KB from the startup parse, but `vite.config.ts:11` documents the single-chunk build as the invariant that makes `base: './'` safe on GitHub Pages, a local folder and a plain host. That is an owner decision with a stated rationale, not a defect; flagging it once and leaving it.
- The ten `world/generators/world*.ts` total 15,370 B minified (largest is world3 at 1,649 B) against 5,290 B of genuinely shared `shared.ts` helpers. There is no copy-paste worth collapsing — the shared layer is already doing its job. Same for the eleven `terrain/materials/*.ts` (43 B to 1,782 B each) and the per-guardian panels, which CLAUDE.md mandates as separate files anyway.
- Dropping the Canvas renderer fallback (`Phaser.AUTO` → `Phaser.WEBGL`) is not worth it: `phaser/src/renderer/canvas` is only 52 KB of source against WebGL's 1.1 MB, so the compatibility trade buys almost nothing.
- `data/integrity.ts` is correctly tree-shaken from production — its `import.meta.env.DEV` guard in `main.ts:12` works, and neither `checkDataIntegrity` nor its distinctive strings ("is in BUILT_WORLDS but has no", "Analytic moves are player-only") appear anywhere in the shipped bundle.
- Other module-top-level work is trivial: three `window.addEventListener` registrations in `music.ts:2044-2051`, a small `HYBRID_RECIPES` loop in `materials.ts:1894`, and a handful of `Object.keys(MOVES).filter(...)` derivations in `materials.ts`. Nothing eager is built per-world.
- One limitation to disclose: my dead-export scan matched `export const/function/class/interface/type/enum` declarations. It did not parse the five `export { ... } from` re-export lists (`art/attackEffects.ts:46-48`, `data/materials.ts:21`, `art/perspective.ts:12`); I read those five by hand and all re-export symbols that are used.

### C1. [HIGH] Phaser ships whole: Matter physics, Tilemaps, Sound, Loader filetypes and Particles are all in the bundle and none are reachable from the game

**Evidence**

- `game/src/main.ts:1`

  > import Phaser from 'phaser';

- `game/node_modules/phaser/package.json:14`

  > "module": "./dist/phaser.esm.js",

- `game/dist/assets/index-DR3TlJxi.js:1`

  > MatterBodies(H),H.forEach(function(W){W.collisionFilter.category=N}),this},setCollisionGroup:functio

- `game/dist/assets/index-DR3TlJxi.js:1`

  > (V.isTilemap)return this.collideSpriteVsTilemapLayer(B,V,G,X,k,$)}else if(B.isParent){if(V

- `game/src/audio/music.ts:1`

  > // Small procedural music player -- no external audio assets, just
  > // oscillators/noise scheduled through the Web Audio API.

- `game/vite.config.ts:11`

  > // Safe here specifically because the bundle has no dynamic import() in it --
  > // it builds to a single chunk

**What is wrong.** `import Phaser from 'phaser'` resolves to the `module` field, `dist/phaser.esm.js` — a webpack-prebundled ESM file, not a tree-shakeable module graph. Rollup cannot drop anything from it, so every subsystem ships. Grepping the shipped bundle confirms Matter's `collisionFilter`/`setCollisionGroup` and Arcade's `collideSpriteVsTilemapLayer` are physically present.

None of it is reachable. An exhaustive grep of `src/` for `Phaser.*` returns only Container (129), Scene (122), Graphics (81), BlendModes.ADD (45), Text (23), Math helpers, Data.DataManager, Rectangle/Arc/Shape, Curves.Spline, Geom.Rectangle/Circle, Display.Color, Display.Masks.GeometryMask, Utils.Array, Scale, Input events, Tweens, Time. `grep -rn 'this.load\.' src` returns nothing at all and `grep -rn 'preload()' src` returns nothing — the game loads zero assets, so the entire Loader plugin and its thirteen filetypes are dead. There is no `add.sprite`, no `add.image`, no `generateTexture`, no `anims.` — every visual is drawn with Graphics/Container/Shape. Audio is raw Web Audio (`music.ts` header, `sfx.ts` header), so Phaser's Sound subsystem is dead too. The only `.add.*` factories used are graphics (113), container (109), text (16), ellipse (16), circle (15), rectangle (4), triangle (1).

Measured, not assumed. I bundled Phaser's own `src/` two ways with the repo's own esbuild (into scratchpad, no project build run):
  full `src/phaser.js`              = 1,614,570 B raw / 364,023 B gz
  custom entry (phaser-core.js + Geom + Curves + Utils + Math + Display + shape Arc/Ellipse/Rectangle/Triangle + Container, with their factories) = 1,053,031 B raw / 232,534 B gz
That is −561,539 B raw (−34.8%) and −131,489 B gz (−36.1%).

The shipped bundle is 2,020,866 B raw / 512,230 B gz. An esbuild metafile pass over `src/main.ts` with `phaser` external puts the game's own code at 558,617 B minified, so Phaser is ~1,462,249 B — 72% of the bundle. Applying the measured 34.8% ratio estimates ~509 KB raw and ~125–130 KB gz removed: roughly 2.02 MB → 1.51 MB raw, 512 KB → ~385 KB gz.

That estimate is conservative in two ways. It is a different minifier pipeline than Vite's (so treat the scaled number as an estimate, not a measurement), and my custom build still contains Phaser's whole Sound subsystem — `phaser-core.js:106` guards it with `if (typeof FEATURE_SOUND)`, which esbuild's `--define` cannot falsify because it only substitutes bare identifiers. A real implementation replacing the `typeof FEATURE_SOUND` expression drops `src/sound/` (328 KB of source) on top of the numbers above.

**Saving, and why quality survives.** ~509 KB raw / ~125–130 KB gzipped off a 2.02 MB / 512 KB bundle (−25%), with more available once Sound is excluded too. Quality survives completely: the surviving modules are byte-for-byte the same Phaser code, running the same renderer. Nothing about the look, the physics content or the teaching changes — the failure mode is a hard boot error if a module was missed, not a subtle visual regression. I checked factory coverage against the greps above: `circle` is registered by `gameobjects/shape/arc/ArcFactory.js:64` (same file as `arc`), and Container needs an explicit add since `phaser-core.js` omits it from `GameObjects` — my 1,053,031 B figure includes both.

**Recommendation.** Add a custom Phaser entry file (a copy of `phaser-core.js` plus the ten extra requires listed above), alias `phaser` to it in `vite.config.ts`, add the renderer `typeof` defines, stub `phaser3spectorjs` (the WebGL debug require, which must be marked external or aliased to an empty module), and add a types shim so `import Phaser from 'phaser'` still typechecks. This is real engineering, not a config flip — budget it as a task, not a tweak. `npm run component-check` is the gate that would catch a missing module, since a boot failure or a dead factory shows up immediately as a stuck scene; `npm run perf-check` backs it up on draw-op counts.

### C2. [LOW] `paintSplitMerge` is dead code, and CODEMAP.md still documents it as world1's and world8's mechanism

**Evidence**

- `game/src/world/generators/shared.ts:248`

  > export function paintSplitMerge(

- `game/src/world/generators/shared.ts:238`

  > // Paints a stretch that splits from one wide-ish center into two thinner
  > // parallel lanes, holds the split for the run, then ramps back together --
  > // shared by world1.ts (mean-field symmetry breaking, tinted) and world8.ts

- `dev_notes/CODEMAP.md:197`

  > paintSplitMerge (world1.ts's/world8.ts's split-then-remerge stretch,
  >                                   optionally regionColor-tinted)

**What is wrong.** A repo-wide grep for `paintSplitMerge` across `game/src`, `game/scripts`, `dev_notes` and `docs` returns exactly two hits: its own declaration at `shared.ts:248` and the CODEMAP line that describes it. `world1.ts` and `world8.ts` do not import it and never call it — my unused-export scan (88 candidates across all 112 files, cross-checked by name against every other file plus `game/scripts/*.mjs`) turned up this as the single genuinely dead runtime function; everything else on the list was either a type, or used inside its own file, or referenced from a script.

The byte saving is small: 46 lines, roughly 0.9 KB minified. The doc half is the more serious part. CLAUDE.md's editing workflow makes `dev_notes/` a source of truth to be read cold, and CODEMAP.md currently tells a future reader that two named worlds build their corridors through a function that no longer runs. Whoever reads it next will look for a split-then-remerge stretch in world 1 and world 8 and not find one.

**Saving, and why quality survives.** ~0.9 KB minified — negligible on its own. The value is the doc correction: a reader of CODEMAP.md §world-generators is currently misinformed about how world 1 and world 8 are actually built. No quality risk either way; nothing calls it, so removal cannot change a single rendered pixel.

**Recommendation.** Delete `paintSplitMerge` and its comment block from `shared.ts`, and remove the `paintSplitMerge` clause from CODEMAP.md:197 — or, if the split-then-remerge stretch is meant to come back, say so at the declaration and leave CODEMAP describing it as available-but-unused rather than as what world1/world8 do. No existing gate: `content-lint` checks data tables, not generator wiring, and `tsc --noEmit` is happy with an unused export.

### C3. [LOW] The Modern soundtrack is derived for all 20 scores at module load even when the default style is Classic

**Evidence**

- `game/src/audio/music.ts:1583`

  > const SCORES_MODERN: Record<string, Score> = Object.fromEntries(
  >   Object.entries(SCORES).map(([key, score]) => [
  >     key,
  >     modernizeScore(score, key.startsWith('battle:') ? MODERN_BATTLE_OPTS : MODERN_OVERWORLD_OPTS),
  >   ])
  > );

- `game/src/audio/music.ts:1605`

  > for (const [key, score] of Object.entries(SCORES)) assertLoopBeats(key, score);
  > for (const [key, score] of Object.entries(SCORES_MODERN)) assertLoopBeats(`${key} (modern)`, score);

- `game/src/data/settings.ts:78`

  > export const DEFAULT_MUSIC_STYLE = MUSIC_STYLE_PRESETS[0].value; // Classic -- the original soundtrack stays the default

- `game/src/audio/music.ts:1738`

  > const table = this.style === 'modern' ? SCORES_MODERN : SCORES;

**What is wrong.** I transpiled `music.ts` with esbuild and evaluated it under a DOM shim to get real counts: `SCORES` holds 20 scores / 126 tracks / 7,942 note objects; `SCORES_MODERN` holds 20 / 125 / 7,902. Every one of those 7,902 notes is freshly allocated at module load by `modernizeScore`'s `notes.map((note) => ({ ...note }))` and `legatoNotes`, and `assertLoopBeats` then walks all 15,844 notes across both tables.

Be honest about the time: I timed both operations over 20 iterations — the full Modern derivation is 0.76 ms and both assertLoopBeats passes are 0.42 ms on this machine. Even at 10x on a phone that is ~12 ms of a startup budget. The time saving is not the reason to do this.

The cost that is real is retained memory. `SCORES_MODERN` is a permanently-live second copy of the whole soundtrack — ~7,900 small `{midi, beats}` objects, on the order of 0.3–0.5 MB of V8 heap — held for the entire session even though `DEFAULT_MUSIC_STYLE` is Classic and line 1738 is the only reader. A player who never opens Settings never touches it.

**Saving, and why quality survives.** ~7,900 live objects (~0.3–0.5 MB heap) and ~1.2 ms of module-eval time, both avoided entirely for the default Classic style. Quality survives exactly: the same `modernizeScore` runs with the same options, just on first `setStyle('modern')` instead of at import. The one visible risk is a stutter at the moment the player switches to Modern, and at 0.76 ms for all 20 scores that is inaudible — or build only the requested score on demand and it is smaller still.

**Recommendation.** Replace the eager `SCORES_MODERN` const with a lazily-populated cache (a `let modernCache: Record<string, Score> | null = null` filled on first Modern lookup, or memoised per score key), and move the second `assertLoopBeats` loop to run over whatever the cache builds. `npm run music-arc-check` is the gate — it reads the score tables and would catch a lazily-built table that no longer matches. One line of cross-reference: `assertLoopBeats` logging instead of throwing is already tracked as POLISH_BUILD_TASK #13; what I am reporting here is the eager-run and retained-memory aspect, which #13 does not cover.


## D. Consistency: game data tables

**Scope covered.** Coverage. I extracted 501 of the file's 511 `prompt:` entries into a flat prompt/correct/incorrect dump and read all of them, plus the ~10 multi-line prompts read directly in quiz.ts (the ULTIMATE and Kohn-Sham/NNQS blocks). I checked the whole pool against the CLAUDE.md ambiguity checklist and against MOVE_COMPATIBILITY wherever a question asserted a game rule; I did not re-derive every physics claim from the lecture notes, so the physics findings above are the ones where two places in the repo disagree or a stated number is plainly off, not an exhaustive physics audit.

Clean areas, checked and found consistent. (1) Spawn-pool rules: World 10 contains exactly the eleven HYBRID_RECIPES results and nothing else; worlds 1-9 contain no hybrid result; getWildPool(9) inherits every non-hybrid from 1-8 with hybrids excluded; every material in every table is reachable by some pool. (2) Cross-spawns: the seven multi-world compounds are Graphene (1/2/4), Iron, Cobalt, Aluminum, Barium Titanate, Fe₃GeTe₂ and Herbertsmithite, and every one carries an in-file physics justification (Iron/Cobalt as itinerant mean-field SSB, BaTiO₃ as a non-magnetic order parameter, Aluminum as session 1's third worked mean-field example, Graphene's Landau levels for World 4); I found none I could not justify. (3) Hybrid recipes: no duplicate results, no two recipes yielding the same crystal, all eleven parents obtainable before World 10 (the latest-gated pair is CrI₃/NbSe₂, whose NbSe₂ parent is a World 9 wild), and each result has both a HYBRID_FUSION_LORE entry and a MATERIAL_QUESTIONS pool with no orphan keys either way. (4) Declared-but-unused: all 7 GOLEM_MOVE_IDS are assigned to a rival, all 15 TUNABLE_MOVE_CLASSES have QUASIPARTICLE_NAMES entries, SCREENING_CHANNELS covers the full MoveClass union, all 14 MaterialTypes appear in some pool, and every MATERIAL_BLURBS key resolves to a real material or rival (the only gap is the reverse direction, finding 2). (5) The four generated docs are byte-identical to a fresh gen-docs run (verified by copying the repo into scratch and diffing; nothing in the real tree was touched). (6) Franklin's three passive descriptions match FRACTIONAL_GUARD_DAMAGE_MULT / ANYON_ECHO_CRIT_MULTIPLIER / EDGE_CURRENT_MISMATCH_MULT and their BattleScene hooks; tutorial.ts:108's "double damage" matches MISMATCH_MULTIPLIER = 2; quiz.ts's header 1.5x/0.6x matches QUIZ_CORRECT_MULTIPLIER/QUIZ_WRONG_MULTIPLIER in OverworldScene; Kondo's "halves ... for 3 turns" matches STATUS_DURATION = 3 and SCREEN_REDUCTION_BY_LEVEL[0] = 0.5 (worth knowing, not written up: once Feynman levels the buff the reduction reaches 0.75 while the shop description still says "halves").

Not covered: art/rendering data beyond the color arithmetic above, save/settings tables, and the balance curves themselves (deliberately, per the settled MAX_STAT ruling). I made no edits and ran nothing that starts a server.

### D1. [HIGH] A quiz's "correct" answer states a move-hosting rule the engine, types.ts and the generated player doc all contradict

**Evidence**

- `game/src/data/quiz.ts:1717`

  > correct: 'Plasmon Resonance, hosted only by the Metal type',

- `game/src/data/materials.ts:512`

  > metallicMagnet: ['electron', 'phonon', 'magnon', 'plasmon'],

- `game/src/data/types.ts:67`

  > Pulse's class. Only the two conducting types host it, 'metal' and

- `docs/quasiparticles.md:20`

  > | Plasmon Resonance | Plasmon | 8 | Metal, Metallic Magnet |

- `game/src/data/materials.ts:83`

  > names this "a new quasiparticle" in exactly those words. Only 'metal'

**What is wrong.** MOVE_COMPATIBILITY grants 'plasmon' to both `metal` and `metallicMagnet`, types.ts's own MoveClass comment says so explicitly, and gen-docs writes that pair into the player-facing move table. The World 9 quiz question tells the player the opposite as its rewarded answer. It is also wrong as physics for exactly the reason types.ts gives: an itinerant magnet has the same partially filled band that lets a free-electron gas ring. A player can reach the contradiction directly: transmute into any metallicMagnet (Iron, Cobalt, Chromium, Fe₃GeTe₂, Manganese) and Noether's shop, which filters through compatibleMoves, offers Plasmon Resonance. The dev-facing half of the same drift is materials.ts:82-84, whose comment still says "Only 'metal' hosts it today" while types.ts:67 four hundred lines away says the opposite.

**Which side is correct.** The table and docs are the correct side. types.ts:67 carries the physical justification, MOVE_COMPATIBILITY implements it, and gen-docs derives the doc from it; only the quiz string and one stale comment disagree.

**Recommendation.** Rewrite the correct option to drop the false hosting clause (e.g. 'Plasmon Resonance, hosted by the conducting types' or just 'Plasmon Resonance'), and fix materials.ts:83-84 to match MOVE_COMPATIBILITY/types.ts. No existing gate: content-lint checks move ids, not answer text; quiz-topic-check scores topic fit, not correctness. A natural content-lint extension is asserting that no quiz option names a MaterialType/move-hosting pair that MOVE_COMPATIBILITY disagrees with.

### D2. [HIGH] Worlds 9 and 10's bosses fall through MATERIAL_BLURBS, so the finale and six of eight World 9 rolls print a generic blurb and three print another world's boss text

**Evidence**

- `game/src/data/materialdex.ts:22`

  > // The ten rivals, and the one place the game states plainly what a golem is.

- `game/src/data/materialdex.ts:24`

  > // the text a player reads ten times across the game, once per boss, each

- `game/src/data/materials.ts:1528`

  > metal: 'Polycrystalline Silver Golem',

- `game/src/data/materials.ts:1563`

  > // with no coherence to lose, so the Decoherence took nothing from it and its

- `game/src/scenes/BattleScene.ts:3191`

  > const blurb = materialBlurb(this.opponentView());

- `game/src/scenes/BattleScene.ts:2354`

  > const newForm: Material = { ...picked, name: `Polycrystalline ${picked.name} Golem` };

**What is wrong.** MATERIAL_BLURBS holds exactly eight golem entries (WORLD_RIVALS[1-8]), but the comment above them claims ten and claims the player reads one per boss. World 9's rival name is built at runtime from RIVAL_9_NAMES: six of its eight rolls (Silver, Niobium, Manganese, YIG, Ce₂Zr₂O₇, BiFeO₃) have no entry and fall back to the generic MaterialType blurb, and two (Bismuth Telluride, Manganese Bismuth Telluride) collide exactly with Worlds 3 and 4's rival keys, so the player is served World 3's text about disorder killing the Kramers-protected channel for a boss the code explicitly exempts from that story at materials.ts:1562-1565. World 10 is worse: killed before its first transmutation, opponentView() is `{...wild, type: player's type}` named 'The Adapted', so the finale's closing physics text is the generic fallback for whatever type the *player* is wearing; after a transmutation the name is `Polycrystalline <compound> Golem`, which for Iron, YBCO and Herbertsmithite matches Worlds 6, 5 and 7's boss blurbs verbatim.

**Which side is correct.** Deciding the fix needs the owner (a per-world blurb resolution vs. new entries is a design call), but the contradiction itself is settled: materials.ts:1562-1565 states the World 9 rival lost nothing to the Decoherence, and the blurb it can print says the opposite.

**Recommendation.** Either add blurbs keyed on the six missing RIVAL_9_NAMES plus 'The Adapted', or have BattleScene resolve a rival's blurb through the world number rather than the runtime name. Correct the materialdex.ts:22-24 comment to say what the table actually covers. No existing gate; content-lint could reasonably assert that every RIVAL_9_NAMES value and every WORLD_RIVALS name has a MATERIAL_BLURBS key.

### D3. [MEDIUM] Two quiz questions give incompatible answers for what symmetry the Dzyaloshinskii-Moriya interaction requires

**Evidence**

- `game/src/data/quiz.ts:1073`

  > prompt: 'What symmetry must be broken for Dzyaloshinskii-Moriya exchange to appear at all?',

- `game/src/data/quiz.ts:1075`

  > correct: 'Mirror symmetry',

- `game/src/data/quiz.ts:2829`

  > prompt: "By Moriya's rules, the Dzyaloshinskii-Moriya vector D between two spins vanishes whenever...",

- `game/src/data/quiz.ts:2831`

  > correct: 'An inversion center sits at the bond midpoint',

**What is wrong.** The World 6 wild question teaches that mirror symmetry is what must be broken for DM to exist; Skłodowska-Curie's Ultimate pool teaches Moriya's actual rule, that D vanishes when an inversion center sits at the bond midpoint. These are not the same statement: a mirror plane can survive with D nonzero (Moriya's rules only constrain D's direction in that case), while a bond-centered inversion center kills D outright. A player who meets both reads two different requirements for the same interaction, and the World 6 one is the wrong side.

**Which side is correct.** quiz.ts:2829 is correct; quiz.ts:1073 is the one to change. Both stay inside session 6/the Ultimate pool's scope, so nothing about world placement moves.

**Recommendation.** Rewrite quiz.ts:1073-1076 to name inversion symmetry at the bond midpoint, matching quiz.ts:2829-2832. No existing gate: both questions are topic-correct for their session, so quiz-topic-check cannot see this, and content-lint does not read answer text.

### D4. [MEDIUM] α-RuCl₃ carries Vison Loop as a World 8 wild and Triplon Surge as World 8's rival, and DESIGN.md calls it a vison host

**Evidence**

- `game/src/data/materials.ts:1329`

  > crystal('α-Ruthenium Trichloride', 'quantumSpinLiquid', ['entanglementSwap', 'visonLoop'], 0, undefined, 'RuCl₃'),

- `game/src/data/materials.ts:1741`

  > ['decoheredSpinon', 'decoheredTriplon'],

- `dev_notes/DESIGN.md:494`

  > | quantumSpinLiquid (8) | α-Ruthenium Trichloride (RuCl$_3$) | Candidate Kitaev spin liquid — Z2 topological order, a genuine vison host |

- `game/src/data/materials.ts:1610`

  > // boss reads as an escalation of the physics the world already taught

**What is wrong.** WORLD_RIVALS[8] is the Polycrystalline Ruthenium Trichloride Golem, named for World 8's own α-RuCl₃ wild, but it throws Decohered Triplon Surge while that same compound throws Vison Loop as a wild in the same world. A triplon is a dimerized/valence-bond magnet's confined S=1 mode; the game's own dimer compounds (SrCu₂(BO₃)₂, TlCuCl₃) are World 7's wilds, and no World 8 wild carries triplonSurge at all. The mirror of this holds too: World 7's rival throws Decohered Vison Loop while no World 7 wild carries visonLoop. Against the WORLD_RIVALS comment's own stated intent (the boss escalates what the world taught), both bosses throw the neighbouring world's signature excitation.

**Which side is correct.** The wild entry and DESIGN.md:494 agree that α-RuCl₃ is a vison host, so the rival's triplon is the side that disagrees; whether to fix it or accept it as roster coverage for decoheredTriplon needs the owner.

**Recommendation.** Owner decision. The physically clean fix is giving the RuCl₃ golem decoheredVison, but that orphans decoheredTriplon (currently its only assignment across all rivals), so the choice is between swapping the two bosses' second moves and leaving one golem move unused. Do not treat this as reopening the settled 'World 7 dimer compounds keep Spinon Swap' ruling: this is about the rivals, not the wilds. No existing gate.

### D5. [MEDIUM] hueStep is assigned per world pool, so Barium Titanate renders in two different colors and five pairs of distinct compounds share one base color inside World 9

**Evidence**

- `game/src/data/materials.ts:1085`

  > crystal('Barium Titanate', 'ferroelectric', ['ferronPulse', 'thermalFluctuation'], 5, undefined, 'BaTiO₃'),

- `game/src/data/materials.ts:1385`

  > crystal('Barium Titanate', 'ferroelectric', ['ferronPulse', 'thermalFluctuation'], 0, undefined, 'BaTiO₃'),

- `game/src/data/materials.ts:1315`

  > crystal('Herbertsmithite', 'quantumSpinLiquid', ['entanglementSwap', 'thermalFluctuation']),

- `game/src/data/materials.ts:1332`

  > crystal('Herbertsmithite', 'quantumSpinLiquid', ['entanglementSwap', 'visonLoop'], 1),

- `game/src/scenes/HubScene.ts:1078`

  > return allCrystals()

- `game/src/data/materials.ts:2016`

  > export function getWildPool(world: number): Material[] {

**What is wrong.** crystal()'s hueStep is picked to separate siblings inside one world's pool, but four compounds appear in more than one pool with different steps. Barium Titanate is hueStep 5 in World 1 (#d98d6a, an orange-tan) and hueStep 0 in World 9 (#d96a8a, rose) — 36 degrees apart on a compound whose per-name jitter is deterministic, so it genuinely renders as two colors. The Materialdex draws from allCrystals(), which keeps the first pool's entry, so the dex shows the World 1 orange while a World 9 field encounter shows the rose. Herbertsmithite has the same shape at 12 degrees (World 7 #5ad9c9 vs World 8 #5ad0d9). Because getWildPool(9) inherits every non-hybrid material from Worlds 1-8 into one 58-crystal pool, the per-pool numbering also collides: within World 9, Barium Titanate matches Potassium Dihydrogen Phosphate, Niobium Diselenide matches YBCO, Herbertsmithite matches α-RuCl₃, TlCuCl₃ matches YbMgGaO₄, and Y₂BaNiO₅ matches Tantalum Disulfide (1T), all at identical base colors. (The name-seeded jitter in art/crystals.ts still pulls them apart in the final render, so the collisions are muted; the duplicated-compound case is not, because the jitter is the same for both.)

**Which side is correct.** The World 1 Barium Titanate step and the World 7 Herbertsmithite step are the ones the Materialdex and Dresselhaus already treat as canonical (allCrystals keeps the first pool), so aligning the later pools to them is the smaller change; which value is right is still an owner call for color reasons.

**Recommendation.** Give a compound one hueStep wherever it appears (or derive the step from a per-type global ordering rather than per-pool position). No existing gate; content-lint could assert that every same-named crystal() call across pools carries identical type, hueStep and variant. Note separately that Herbertsmithite's differing movesets (thermalFluctuation in World 7, visonLoop in World 8) read as deliberate — World 8 is the Z2/vison world — so only the color half of that pair looks accidental.

### D6. [MEDIUM] Herbertsmithite's bonus quiz pool asks session-7/8 physics in World 9, and its own comment does not know it spawns there

**Evidence**

- `game/src/data/quiz.ts:1874`

  > // Spawns in World 7 (entanglement/tensor networks) and World 8 (frustrated

- `game/src/data/quiz.ts:1889`

  > prompt: 'Which numerical method gives the leading quantitative evidence for spin-liquid physics on kagome and triangular lattices?',

- `game/src/data/materials.ts:2016`

  > export function getWildPool(world: number): Material[] {

- `game/src/data/quiz.ts:2382`

  > const materialPool = materialName ? MATERIAL_QUESTIONS[materialName] : undefined;

**What is wrong.** getWildPool(9) inherits every non-hybrid material from Worlds 1-8, Herbertsmithite included, and getWorldQuestion coin-flips into a material's MATERIAL_QUESTIONS pool whenever one exists — regardless of world. So a Herbertsmithite met in The Defect Scars can be asked 'Which numerical method gives the leading quantitative evidence for spin-liquid physics on kagome and triangular lattices?' (tensor networks, session 7) inside a world whose session teaches excitations and defects. Barium Titanate's own pool comment at quiz.ts:1841-1854 explicitly sanctions its use in World 9; Herbertsmithite's comment at quiz.ts:1874-1876 names only Worlds 7 and 8, so the World 9 inheritance path appears never to have been considered for it.

**Which side is correct.** Not an optimization; the owner must decide, since the same mechanism was explicitly approved for Barium Titanate and the only difference here is that the comment never accounted for World 9.

**Recommendation.** Owner decision: either bless Herbertsmithite's pool in World 9 the way Barium Titanate's already is (and amend the comment to name all three worlds), or have getWorldQuestion skip a material's bonus pool for a world the material only reaches by World 9 inheritance. Do not extend quiz-topic-check to cover MATERIAL_QUESTIONS — the settled ruling keeps it WORLD_QUESTIONS-only. No existing gate.

### D7. [MEDIUM] Fe₃GeTe₂'s placement comment justifies keeping it out of World 1 with a rule World 1's own pool already breaks six times

**Evidence**

- `game/src/data/materials.ts:1400`

  > // the tutorial world and a magnon carrier there lands at double force on a

- `game/src/data/materials.ts:1043`

  > crystal('Nickel Oxide', 'insulatingMagnet', ['thermalFluctuation', 'magneticField'], 1, undefined, 'NiO'),

- `game/src/data/materials.ts:1056`

  > crystal('Iron', 'metallicMagnet', ['thermalFluctuation', 'magneticField'], 0, undefined, 'Fe'),

- `game/src/data/materials.ts:1112`

  > crystal('Aluminum', 'superconductor', ['higgsOscillation', 'thermalFluctuation'], 0, 'cubic', 'Al'),

**What is wrong.** The World 9 entry for Fe₃GeTe₂ says it lives there rather than in World 1 because 'World 1 is the tutorial world and a magnon carrier there lands at double force on a starting Silicon.' World 1's pool already contains six magnon carriers (Nickel Oxide, Chromium, Iron, Cobalt, Europium Oxide, Manganese Fluoride), plus Graphene throwing Plasmon Resonance, both ferroelectrics throwing Ferron Switch and Aluminum throwing Higgs Oscillation — every one of which is a 2x mismatch against a starting Silicon (semiconductor: electron, phonon only). The stated reason is not the reason, and a developer following it would wrongly conclude World 1 is protected from mismatch hits.

**Which side is correct.** The pool is correct and the comment is wrong; nothing about the data needs to move.

**Recommendation.** Rewrite the comment to the real reason for the placement (or drop the justification). No existing gate; this is comment-vs-data drift of exactly the kind CLAUDE.md's 'current state, not a change log' rule targets.

### D8. [LOW] A quiz calls HgTe 'a non-ferroelectric semiconductor' while the game types it Metal and shows that in the Materialdex and docs

**Evidence**

- `game/src/data/quiz.ts:1757`

  > prompt: 'What move can GeTe carry that a non-ferroelectric semiconductor like HgTe cannot?',

- `game/src/data/materials.ts:1169`

  > crystal('HgTe', 'metal', ['tunnelStrike', 'thermalFluctuation'], 4),

- `docs/crystals.md:40`

  > | HgTe | Metal |

**What is wrong.** HgTe is typed `metal` in WORLD_CRYSTALS[2] (types.ts's `metal` explicitly covers semimetals), and both the Materialdex and the generated Crystals doc show it as Metal. The World 9 quiz names it a semiconductor. The physics is defensible (bulk HgTe is a zero-gap semiconductor/semimetal) and the intended contrast still holds — GeTe is ferroelectric and hosts ferron, HgTe does not — but the label a player reads in the question contradicts the label the same player reads on the crystal's own card, in a pair where CdTe is the entry the game does type as Semiconductor.

**Which side is correct.** The type assignment is the side to keep (it is what the engine, the dex and the docs all use); only the question's wording needs to move.

**Recommendation.** Reword to 'a non-ferroelectric compound like HgTe' or swap the example to CdTe, which is typed Semiconductor. No existing gate.

### D9. [LOW] A World 5 quiz overstates cuprate critical temperatures as 'hundreds of kelvin'

**Evidence**

- `game/src/data/quiz.ts:824`

  > prompt: 'Cuprate high-$T_c$ superconductors like YBCO can reach critical temperatures in the...'

- `game/src/data/quiz.ts:825`

  > correct: 'Hundreds of kelvin range',

- `game/src/data/materialdex.ts:81`

  > "LaH₁₀ superconducts up to roughly 250-260 K, but only under ~170 GPa of pressure"

**What is wrong.** The highest ambient-pressure cuprate Tc is around 135 K (HgBaCaCuO); YBCO itself is 93 K. 'Hundreds of kelvin' overstates the family by roughly a factor of two, and it sits next to a Materialdex entry that is careful to give LaH₁₀'s 250-260 K with its 170 GPa caveat. The question remains answerable (the distractor is 'single-digit kelvin'), so this is a correctness nit in player-facing physics rather than an ambiguity.

**Which side is correct.** Straightforward factual correction; the answer stays uniquely right under the new wording.

**Recommendation.** Change to 'above 100 K' or 'roughly 90 to 135 K'. No existing gate.


## E. Consistency: documentation versus code

**Scope covered.** Covered: every doc in the lens read against the code it describes. Verified clean and worth not re-auditing: (1) all 127 backticked file paths and all 88 `fn()` names in CODEMAP.md still resolve in the tree -- the only apparent miss, `effectiveness()`, is CODEMAP saying that function deliberately does not exist. (2) The four `<!-- GENERATED -->` doc blocks are exactly current: I copied gen-docs.mjs to the scratchpad, redirected its writes to a temp dir, ran it, and diffed -- quasiparticles/crystals/hybrids/guardians all byte-identical, and no hand-edit has crept inside a marker pair. (3) STYLE.md's ten-world palette/terrain table (lines 803-812) matches art/biomes.ts row for row on skyTop, skyBottom, ground, path, clouds, decoration and wallTheme; WORLD_NAMES matches WORLDS.md's binding table and DESIGN.md alike. (4) DESIGN.md §4's battle constants all check out against code: MAX_MULTI_HIT=5, PHONON_ONLY_STAT_CEILING=5, SCREEN_REDUCTION_BY_LEVEL=[0.5,0.62,0.68,0.75], shopCost=power*5, battleStakeForWorld 50->200 rounded to 10, MOVE_MENU_MAX_ROWS=3, quiz 1.5x/0.6x, analytic power 10, ultimate power 100, ULTIMATE_CLASS_UNLOCK_COST=1000, chernSuperconductor's five-class compat list, and all three SCREENING_CHANNELS lists. (5) docs/guardians.md's Kondo cloud lists match SCREENING_CHANNELS quasiparticle for quasiparticle; docs/quasiparticles.md's World 1 phonon-only prose and the Analytic/Ultimate sections match the code. (6) README's Controls table matches every keyboard handler in the tree, and its nine-row three-group Settings section is fully current -- README is in better shape than DEVELOPMENT.md here. (7) Spot-checked STYLE.md constants (CANVAS 854x480, LIST_DETAIL_PANEL_W=720, STATION_MOTIF_SIZE=26, STATION_ROW_TOP=330, title 30px bold white, the 50px mode-picker gap, TOKEN_SIZE=26/CRYSTAL_SIZE=22, the ten qumatessence denomination hexes) -- all matched. (8) Save keys, root `npm run play`, and README's guide.pdf/docs links all resolve. I ran no dev server and no banned script; the one execution was the read-only gen-docs dry run into the scratchpad.

### E1. [HIGH] DESIGN.md §2's "Gate to next world" column promises seven per-world puzzle gates the game does not have, and the section vouches that the gates "still hold"

**Evidence**

- `dev_notes/DESIGN.md:33`

  > progression gates are not part of that revision and still hold.

- `dev_notes/DESIGN.md:41`

  > | 4 | Integer and fractional quantum Hall effect | **The Storm Flats** | Landau-level materials, an intrinsic zero-field Chern insulator | Solve a Landau-level maze |

- `dev_notes/DESIGN.md:43`

  > | 6 | Classical magnetism, magnons | **The Iron Steppe** | ... | Ride a magnon wave across a canyon |

- `dev_notes/DESIGN.md:44`

  > | 7 | Entanglement, tensor networks | **The Entangled Web** | Entangled pairs (fought as a bonded duo) | Compress a tangled area into a walkable MPS path |

- `game/src/scenes/OverworldScene.ts:2649`

  > if (!this.isRivalDefeated()) {
  >       this.showRivalEncounter();
  >       return;
  >     }
  >     if (this.world >= FINAL_WORLD) {
  >       this.showFinalePanel();
  >       return;
  >     }
  >     this.crossPass();

- `dev_notes/DESIGN.md:928`

  > footer button that fights the world's rival crystal the first time it's clicked (see §2),

- `game/src/data/materials.ts:1314`

  > 7: [
  >     crystal('Herbertsmithite', 'quantumSpinLiquid', ['entanglementSwap', 'thermalFluctuation']),

**What is wrong.** DESIGN.md §2's world table has a "Gate to next world" column that gives worlds 3-9 bespoke puzzle gates: "Cross a gap only an edge-mode move can bridge" (3), "Solve a Landau-level maze" (4), "Pair two Majorana halves" (5), "Ride a magnon wave across a canyon" (6), "Compress a tangled area into a walkable MPS path" (7), "Screen a 'local moment' boss mechanic" (8), "Repair/exploit N defects to stabilize a bridge" (9). None of these exists. `OverworldScene.confirmGate` is the single, world-agnostic gate for all ten worlds: it is either the backward door, or fight the rival, or (world 10) the finale panel, or cross. DESIGN.md §4 line 928 describes that same uniform rival-then-cross flow, so §2 and §4 of the same document disagree. The damage is compounded by line 33, which explicitly exempts the gate column from the "maps are under active revision" caveat and asserts the gates "still hold" -- so a reader is told to trust exactly the column that is wrong. The same table's wild-archetype column has one matching defect: world 7 is listed as "Entangled pairs (fought as a bonded duo)", while `WORLD_CRYSTALS[7]` is four ordinary single quantumSpinLiquid compounds and no "duo" battle mode exists anywhere in `game/src` (grep for `duo`/`bonded` finds only chemistry prose). This is not covered by POLISH_BUILD_TASK.md, whose own preamble says "a doc that promises a feature the build does not have is a defect in the doc or in the build".

**Which side is correct.** The code is correct as shipped -- the uniform reach-goal/beat-rival/cross gate is what §4, WORLDS.md's pass grammar and `confirmGate` all describe, and content-lint's WORLD_RIVALS coverage check assumes it. Which way DESIGN.md moves needs the owner: either the column is a stale spec to rewrite as "beat that world's rival crystal" for all ten rows, or these are still-wanted features, in which case they belong in POLISH_BUILD_TASK.md as unbuilt promises rather than in a table §2 says currently holds.

**Recommendation.** Ask the owner which reading is intended, then either rewrite DESIGN.md §2's gate column (and world 7's archetype cell) to describe the shipped gate, or open a POLISH_BUILD_TASK item for the unbuilt gates and mark the column as aspirational. No existing gate catches this: content-lint checks data-table internal consistency, not prose-vs-code agreement; the `docs-sync-check` skill is the closest process control.

### E2. [MEDIUM] DEVELOPMENT.md says the Settings station offers four rows; it offers nine across three categories, and settings.ts's own row ordinals describe the vanished flat list

**Evidence**

- `dev_notes/DEVELOPMENT.md:388`

  > and the Lab's Settings station offers four rows --
  > wild-encounter density, a Text Size preset applied via `ui/text.ts`'s
  > `fontPx`/`fontScale` helpers

- `game/src/data/settings.ts:230`

  > export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  >   { id: 'gameplay', label: 'Gameplay' },
  >   { id: 'story', label: 'Story' },
  >   { id: 'presentation', label: 'Presentation' },
  > ];

- `game/src/scenes/panels/hubStations.ts:883`

  > category: 'gameplay',
  >       label: 'Difficulty',

- `game/src/data/settings.ts:80`

  > // Same Settings panel, fourth row: how hard the world curve hits, a

- `game/src/data/settings.ts:153`

  > // Same Settings panel, sixth row: whether the overworld draws the on-screen

- `README.md:319`

  > The settings come in three groups,
  > Gameplay, Story and Presentation, and you switch between them at the top of the
  > panel.

**What is wrong.** Two sides of the same drift. (a) DEVELOPMENT.md's "Current status" still describes a four-row Settings panel (density, Text Size, Music Style, difficulty). `showSettingsPanel` in hubStations.ts declares nine rows -- Difficulty, Enemy Density, World Size (Gameplay); Story Screens, Tutorial Tips (Story); Text Size, Full Screen (conditional on `fullscreenAvailable`), Music Style, Touch Controls (Presentation) -- grouped by `SETTINGS_CATEGORIES`. World Size, Touch Controls, Full Screen, Story Screens and Tutorial Tips are all missing from the doc's list, as is the whole category mechanism. (b) settings.ts's own comments still number the rows as one flat list: music is "third row" (settings.ts:54), difficulty "fourth row" (:80), world size "fifth row" (:107), touch controls "sixth row" (:153). In the shipped panel Difficulty is the *first* row of the *first* category and World Size the third; only music happens to coincide with Presentation's third row. A developer reading those comments builds the wrong mental model of the panel they are about to edit -- which matters, because the same file at :220 warns "Presentation's four rows already reach 448 of the canvas's 480 pixels at Large, so measure before adding a fifth anywhere", advice whose row accounting the stale ordinals contradict.

**Which side is correct.** The code is correct, and README.md:317-373 is fully current (it documents all nine rows, the three groups, and the Full Screen row's conditional absence on iPhone) -- so the player-facing side is clean and only the developer-facing side has drifted. No owner decision needed.

**Recommendation.** Rewrite DEVELOPMENT.md:386-392's Settings sentence as the three-category, nine-row panel README already describes, and replace settings.ts's "third/fourth/fifth/sixth row" ordinals with the category each row belongs to. No existing gate: content-lint reads data-table structure, not comment prose. `docs-sync-check` is the process control that should have caught it.

### E3. [MEDIUM] POLISH_BUILD_TASK.md #13b says greyscale-check cannot reach a battle; the script now drives the gate through confirmGate, exactly as DEVELOPMENT.md describes

**Evidence**

- `dev_notes/POLISH_BUILD_TASK.md:210`

  > `npm run greyscale-check` fails in all ten worlds with "stuck before the battle
  > started." The script clicks a `Battle!` button after `maybeReachGoal`, but the
  > rival gate is accepted by `confirmGate()` at the pass mouth

- `game/scripts/greyscale-check.mjs:833`

  > await page.evaluate(() => window.__game.scene.getScene('Overworld')['confirmGate']());

- `game/scripts/greyscale-check.mjs:802`

  > // Stand at the pass mouth, the tile below the goal. Arriving there is a
  >     // no-op at the panel level ... What
  >     // carries the challenge is the prompt at the mouth and the confirm behind
  >     // it, never a button in a dialogue.

- `dev_notes/DEVELOPMENT.md:808`

  > through `confirmGate` and the rival's own taunt exactly as a player pressing
  > Space does

**What is wrong.** POLISH_BUILD_TASK #13b states as current fact that greyscale-check fails in all ten worlds, diagnoses the cause as the script clicking a nonexistent `Battle!` button, and concludes "Until this is repaired, no battle legibility claim can be backed by the check, only by reading frames." The script has since been repaired along exactly the lines #13b prescribes: it stands at `goal.y + 1`, asserts on the challenge prompt rather than a dialogue, and invokes `confirmGate()` directly. DEVELOPMENT.md's greyscale-check section describes the repaired flow and further reports "consecutive runs currently agree to the last decimal on every number below", which a run that fails in all ten worlds could not produce. The two dev_notes files therefore state incompatible things about whether the project's arena-legibility gate works at all -- and the audit brief itself treats greyscale-check as the live gate that replaced STYLE.md's retired no-re-render rule. This is #13b, not the exempt #13 (`assertLoopBeats`).

**Which side is correct.** DEVELOPMENT.md and the script are the correct side: the code plainly contains the fix #13b asked for, and the `['Got it', 'Next ->', 'Battle!']` list at greyscale-check.mjs:838 is now only the post-confirmGate taunt-paging loop, not the gate itself. I could not run the script (banned by this audit's rules), so the residual uncertainty is whether it passes end to end today, not whether the diagnosed cause still exists -- it does not.

**Recommendation.** Close POLISH_BUILD_TASK #13b, or downgrade it to "reconfirm by running `npm run greyscale-check` once" if the owner wants a fresh green run on record before striking it. No existing gate: nothing checks a build-task file's status claims against the tree.

### E4. [LOW] Change-log narration left in code comments and two dev_notes files, which CLAUDE.md bans outside genuine rationale

**Evidence**

- `game/src/data/materials.ts:280`

  > unlocking every option of an ability ... costs meaningfully more in total than the old flat per-ability price did

- `game/src/data/materials.ts:619`

  > Every scene that used to read PLAYER_MATERIAL directly for the player's own look/stats/moves should read this instead

- `game/src/data/materials.ts:1820`

  > This used to be a generic "these two main types always produce that main type" table (the old HYBRID_RULES)

- `game/src/data/materials.ts:1957`

  > Unlike the old type-derived hybrid, the result's own name/type/moves are all authored on its WORLD_CRYSTALS entry

- `game/src/data/materials.ts:577`

  > the earlier strong/weak TYPE_CHART was dropped as an unnecessary second system on top of it

- `game/src/scenes/OverworldScene.ts:521`

  > One entry per world with a guardian -- replaces the old per-guardian `spawnXSprite`/`this.world === N` branches with a single data-driven dispatch

- `game/src/scenes/OverworldScene.ts:2662`

  > It is the semantic descendant of the click that used to carry it

- `game/src/scenes/TitleScene.ts:493`

  > (unlike the old 12px gap, which read as one combined control)

- `game/src/data/settings.ts:21`

  > // Normal -- matches the old fixed ENCOUNTER_CHANCE

- `game/src/scenes/overworld/terrain/decoration.ts:116`

  > With the world's name no longer saying "orbit", these rings are the only thing left teaching

- `dev_notes/DESIGN.md:788`

  > a Momentum advantage no longer repeats a self-buff cast

- `dev_notes/WORLDS.md:795`

  > The confirmation is not removed with the old menus, it is relocated into the prompt

**What is wrong.** CLAUDE.md's "current state, not a change log" rule covers dev_notes/, docs/, README.md and comments inside game/src/, and names the banned framings ("used to", "no longer", "replaced the old", "instead of the earlier"). These twelve hits narrate a change rather than state the current rule, and each names an artifact a reader with no history cannot find: `PLAYER_MATERIAL` read directly, `HYBRID_RULES`, `TYPE_CHART`, `spawnXSprite`, `ENCOUNTER_CHANCE`, a 12px gap, a world named for orbits, "the old menus". materials.ts:1820 is the specific passage CLAUDE.md itself models the compliant rewrite of ("same-type pairs are still forbidden in general because fusing two of the same phase isn't a new state") -- the rationale that follows it is correct and keep-worthy; only the "This used to be ... (the old HYBRID_RULES)" framing is the finding. Likewise materials.ts:577 and decoration.ts:116 carry real load-bearing rationale (why no type chart; why the rings are pedagogy) wrapped in a change narration that can be cut without losing it. I deliberately excluded the many "no longer" hits in lore, story, Materialdex and quiz text (worldLore.ts, story.ts, storyline.md, quiz.ts), which are physics or fiction in the present tense, and docs/guardians.md:130's "only the old one gave you", which is about swapping dopants, not about a past build.

**Which side is correct.** Cosmetic, and cheap: each hit is one or two clauses, and the surrounding rationale survives verbatim in every case. Quality is not at risk because nothing here is load-bearing except the rationale being kept.

**Recommendation.** Strike the change-narrating clause from each of the twelve sites and keep the rationale, per CLAUDE.md's own split. No existing gate: content-lint does not read comment prose, and there is no lint for the banned framings -- a grep for `used to|no longer|replaced the old|previously|formerly|the old ` over `game/src` plus the five doc files is what found these and is the cheapest recurring check.

### E5. [LOW] CLAUDE.md and DEVELOPMENT.md price the same pre-push check differently (about four minutes vs ~5-10 minutes)

**Evidence**

- `CLAUDE.md:92`

  > content-lint` (seconds) and `npm run component-check` (about four minutes,
  >   longer on a loaded machine)

- `dev_notes/DEVELOPMENT.md:478`

  > **`npm run component-check`** (`scripts/component-check.mjs`, ~5-10 minutes
  > depending on machine load)

**What is wrong.** Commit 968370d ("The pre-push check is priced at what it actually costs", 2026-08-29) re-priced component-check in CLAUDE.md from "a couple of minutes" to "about four minutes" from a fresh measurement, and touched CLAUDE.md only. DEVELOPMENT.md, which is where a developer actually reads about the script, still carries the older, higher figure. The two are read for the same decision -- whether running it before a push is affordable -- so a reader who consults DEVELOPMENT.md is told the check costs more than twice what the owner measured. (DEVELOPMENT.md's "56 tests" claim on the same line is correct: 20 world-entry + 6 world-entry-from-goal + 3 re-entry + 3 battle round-trips + 1 WebGL + 10 guardian panels + 2 rival-gate loss + 2 win-path + 1 actual win + 3 adapted-transmute + 5 boot = 56.)

**Which side is correct.** CLAUDE.md is the correct side, both by recency of measurement and by CLAUDE.md's own stated hierarchy over every other file. One-number edit.

**Recommendation.** Change DEVELOPMENT.md:478 to match CLAUDE.md's "about four minutes, longer on a loaded machine". No existing gate; this is the kind of same-change doc sync CLAUDE.md's editing workflow and the `docs-sync-check` skill exist to enforce.

### E6. [LOW] Choosing anything in battle or a panel is pointer-only, which README states plainly and the code confirms, against the project's keyboard-only goal

**Evidence**

- `README.md:300`

  > The keyboard walks and accepts what is offered where you stand. Choosing
  > between things on screen is the pointer's job: a move in battle, an answer to
  > a wild crystal's question, a station in the Lab, a button in a guardian's
  > panel.

- `game/src/scenes/BattleScene.ts:1071`

  > .setInteractive({ useHandCursor: true })
  >       .on('pointerdown', () => {

- `game/src/scenes/BattleScene.ts:678`

  > this.input.keyboard!.on('keydown-LEFT', () => this.switchMovePage(-1));
  >     this.input.keyboard!.on('keydown-RIGHT', () => this.switchMovePage(1));

- `game/src/data/settings.ts:154`

  > // arrows (scenes/overworld/touchControls.ts) that let a player walk without a
  > // keyboard. Walking is the one thing a pointer alone could not do -- every
  > // other action in the game already has a click target

**What is wrong.** This is not drift -- doc and code agree exactly, which is why it is low and reported as a goal gap rather than a contradiction. The complete keyboard surface is Arrows (walk), Space (confirm where you stand / title start / leave the battle summary), Enter (Lab in and out), F (fullscreen) and Left/Right (page the battle move menu). `addMoveButton` binds only `pointerdown`, so a move is selected by pointer alone; the same holds for quiz answers, Lab stations and guardian-panel buttons. The keyboard can page *between* kinds of move but cannot pick one. Keyboard-only play is a stated project goal (a console port), and the settings.ts comment shows the inverse assumption is currently baked in: walking is treated as the one thing a pointer cannot do, when in fact selecting is the one thing a keyboard cannot do.

**Which side is correct.** Nothing is wrong today and nothing needs correcting; the cost is that the console-port goal has no tracked item. The natural shape (Up/Down to move a selection cursor within the current move page, Space to commit, Left/Right already paging) reuses keys that already exist and would not change any pointer behaviour.

**Recommendation.** If keyboard-only play is still wanted, add it to dev_notes/POLISH_BUILD_TASK.md as its own item so it is tracked rather than living only in the README's implicit concession; the owner should decide whether it is in scope for a final version. No existing gate -- component-check drives scenes through private methods and `emit('pointerdown')`, so it would pass unchanged whether or not a keyboard route exists.


## F. Consistency: player-facing text and the WORLDS.md premise

**Scope covered.** Covered every player-text data file end to end (story.ts, storyLog.ts, worldLore.ts, worldFlavor.ts, greetings.ts, statLore.ts, moveLore.ts, tutorial.ts, materialdex.ts), the guardian panel copy in scenes/panels/, README.md, docs/guardians.md and docs/storyline.md, read against dev_notes/WORLDS.md in full. Checked and found clean: the banned-style rules (zero em dashes or en dashes in any string anywhere in game/src, zero " -- " in any player string across data/, scenes/ and scenes/panels/, and no bibliographic citations or author-year references in any player-facing string); no game-structure leaks (every "World N" and world-name occurrence in materialdex.ts and quiz.ts is inside a code comment, never in a blurb, prompt or answer); WORLD_NAMES (materials.ts:1983-1994) matches WORLDS.md §2's table for all ten worlds, and every name obeys the naming law's no-physicists / no-quasiparticles corollaries; the guardian roster (OverworldScene WORLD_GUARDIANS) matches docs/guardians.md's table and Sklodowska-Curie's own roll-call line, all ten in the same order; the STORY_BEATS chain reads forward correctly across all nine transitions, each forward look describing the next world's actual terrain, and none of them relights anything (WORLDS.md's "the light never returns"); the surveyor / notebook / copyist thread through WORLD_LORE pages 1 of worlds 4-9 is continuous and never references a world ahead of itself; the tone gradient holds (legend voice in 1-3, reporting by 7-9, "no traveler returns with a rumor" at 10); "Hero" appears in no player string. Numeric claims verified against code: crit 20% for 1.5x (balance.ts:365-367) matches README's "a fifth of all hits ... half again"; MAX_MULTI_HIT 5 (balance.ts:374) matches "up to 5 times a round" and "five times faster"; MAX_STAT 100; ANALYTIC_CORRECT/WRONG 2x/0.5x matches docs/guardians.md's "double / halved"; and Bloch 15, Dresselhaus 25, Anderson 35, Majorana 60 all match docs/guardians.md's price lists. Kondo's "only one cloud active, switched by revisiting" is consistent across tutorial.ts, docs/guardians.md and panels/kondo.ts. Spot-checked quiz-vs-Materialdex physics for the compounds carrying both (Graphene, NiO/MnO, BaTiO3, Herbertsmithite, RuCl3) and found no contradiction. Did not attempt an exhaustive 322-question quiz reconciliation, and deliberately left terrain/palette/horizon rendering beyond the World 5 case above to whichever lens owns it.

### F1. [HIGH] The controls tutorial tells the player to press H to return to the Lab; H is bound nowhere in the game

**Evidence**

- `game/src/data/tutorial.ts:96`

  > Press H or Enter any time, or click the Lab line in the bottom right corner, to return to the Lab

- `game/src/scenes/OverworldScene.ts:1137`

  > this.input.keyboard!.on('keydown-ENTER', () => this.returnToHub());

- `README.md:295`

  > | Enter | Return to the Lab (World 0) |

**What is wrong.** The `controls` tip is one of the first popups a fresh save meets, and it names a key the game does not listen for. A full sweep of every keyboard registration in `game/src` finds only `keydown-ENTER` and `keydown-SPACE` (OverworldScene 1137-1138), `keydown-ENTER` (HubScene:364), `keydown-LEFT`/`keydown-RIGHT`/`keydown-SPACE` (BattleScene 678-679, 3219), `keydown-SPACE` (TitleScene:164) and `keydown-F` (game/src/ui/fullscreen.ts:41). There is no raw `addEventListener('keydown', ...)` handler either: the only window-level keydown listener is game/src/audio/music.ts:2044, which just resumes the audio context. A player who follows the tip presses H, nothing happens, and the first thing the game taught them is wrong. README's Controls table and the code agree with each other, so the tutorial string is the single outlier.

**Which side is correct.** Owner does not need to decide the concept, only the direction: the code and README already agree, so the tip is the drift.

**Recommendation.** Drop "H or" from tutorial.ts:96 so the tip reads "Press Enter any time", matching README:295 and the bound key. (Binding H as a second alias is the other resolution, but the memory note on controls upkeep says README's Controls table is the surface kept in step with input, and it does not list H.) No existing gate: neither content-lint nor component-check reads tutorial copy against key bindings.

### F2. [HIGH] World 9's rival taunt says "There is no golem" while the game labels that same rival "Polycrystalline <compound> Golem" on screen

**Evidence**

- `game/src/data/worldLore.ts:141`

  > There is no golem waiting in the wastes. There is a flaw, a knot of something that is not the ground, and the ground obligingly builds a body out of itself to hold it.

- `game/src/data/materials.ts:1528`

  > metal: 'Polycrystalline Silver Golem',

- `game/src/scenes/OverworldScene.ts:2012`

  > .text(0, 0, boss.name, {

- `README.md:174`

  > Through World 9 its name is
  > always a real compound in *polycrystalline* form

- `dev_notes/WORLDS.md:1021`

  > **The name does not change.** Every rival 1 to 9 is a real material in
  > *polycrystalline* form

**What is wrong.** `spawnBossSprite` renders the rival's `name` as a world-space label over the golem standing in the pass, and `getRival(9, ...)` returns `rivalImpurityResonance(type)`, whose name comes from RIVAL_9_NAMES (materials.ts:1527-1536) - always "Polycrystalline <compound> Golem". The battle log then calls it by that same name (BattleScene.opponentLabel, line 494-497). So the player reads "There is no golem waiting in the wastes" in the taunt panel while the word Golem is printed over the thing they are about to fight, and again in every combat line. WORLDS.md binds World 9's rival to the polycrystalline naming drumbeat (only World 10 "states the loss by carrying no material name at all", WORLDS.md:1026-1027), and README:174-176 tells the player the same rule, so the code and both docs agree and only the taunt's opening clause diverges. docs/storyline.md:435 states the same idea but hedges it - "there is no golem waiting in the ordinary sense, because the thing holding the pass has no lattice of its own" - which is exactly the phrasing that survives the on-screen label.

**Which side is correct.** Deciding needs the owner only for the phrasing. Which side is correct is not in doubt: WORLDS.md:1021 and README:174 both bind the polycrystalline name for rivals 1-9, and the code implements it.

**Recommendation.** Owner decides the wording, but the divergence is real and one-sided: the concept (a flaw wearing a borrowed body) is correct and WORLDS.md-sanctioned; the flat "There is no golem" is what the label contradicts. The cheapest fix is to adopt docs/storyline.md:435's own hedge in worldLore.ts:141. No existing gate; component-check drives the taunt panel but does not read its words.

### F3. [HIGH] Bloch's World 10 preview calls the adaptive final boss "its own guardian"; World 10's guardian is Sklodowska-Curie

**Evidence**

- `game/src/data/worldFlavor.ts:23`

  > The terrain rewrites itself around whatever quantum material you currently are, and its own guardian adapts live rather than defending one fixed form.

- `game/src/scenes/OverworldScene.ts:868`

  > id: 'sklodowskaCurie',
  >       name: "Skłodowska-Curie's Experiments",

- `game/src/data/tutorial.ts:120`

  > Each world's guardian waits partway along the corridor: Noether sells moves and stat upgrades

- `docs/guardians.md:28`

  > | [Skłodowska-Curie's Experiments](#skłodowska-curies-experiments) | 10 | Teaches two quiz-gated Ultimate moves |

**What is wrong.** The game uses "guardian" as a reserved term for the ten teachers (tutorial.ts:120, docs/guardians.md's whole table, WORLDS.md:64-67 "The guardians are the people, and they are the only human presence in the game"), and "rival" for the thing in the pass. The thing that "adapts live rather than defending one fixed form" is WORLD_RIVALS[10], The Adapted (materials.ts:1770, and BattleScene's `adaptedForm`/`transmuteAdapted`); Sklodowska-Curie sells two Ultimate moves and adapts nothing. A player previewing World 10 in Bloch's destination table is therefore told the mentor morphs, which is both wrong and a partial spoiler of the wrong shape. WORLD_FLAVOR is the one player surface where this slip appears; every other world's entry avoids naming a guardian at all.

**Which side is correct.** The correct side is unambiguous - three surfaces (tutorial, docs/guardians.md, WORLDS.md) reserve "guardian" for the teachers, so worldFlavor.ts:23 is the outlier.

**Recommendation.** Replace "its own guardian" with "the rival standing in its pass" (or wording that names no role at all) in worldFlavor.ts:23. No existing gate: content-lint checks data-table keys, not vocabulary, and quiz-topic-check does not read WORLD_FLAVOR.

### F4. [MEDIUM] The Settings tutorial page says "eight knobs" and omits Full Screen; the panel has nine rows and README documents nine

**Evidence**

- `game/src/data/tutorial.ts:90`

  > The Lab's Settings station holds eight knobs, in three groups you switch between at the top of the panel.

- `game/src/scenes/panels/hubStations.ts:762`

  > // The nine settings and what reads them -- Gameplay: difficulty tier

- `game/src/scenes/panels/hubStations.ts:919`

  > label: 'Full Screen',

- `README.md:358`

  > - **Full Screen**: On or Off, whether the game fills the whole screen instead
  >   of sitting inside a browser tab.

**What is wrong.** The tip's own enumeration lists Difficulty, Enemy Density, World Size (Gameplay), Story Screens, Tutorial Tips (Story), Text Size, Music Style, Touch Controls (Presentation) - eight, with Full Screen missing from the Presentation group. The panel builds a ninth row, Full Screen, whenever the browser supports it (hubStations.ts:915-931, gated on `fullscreenAvailable(scene)`), and README's Settings section documents all nine. A player who opens the Settings station after reading the tip counts nine rows on any desktop browser. The one place "eight" is true is a browser with no Fullscreen API at all (an iPhone), which is the exception the panel comment itself calls out - so the tip states the exception as the rule.

**Which side is correct.** The panel and README are correct; the tutorial string predates the Full Screen row. Nothing about the game changes, only the count in one sentence.

**Recommendation.** Update tutorial.ts:90 to nine and add Full Screen to the Presentation sentence, ideally with the same "where the browser offers it" caveat README:361-363 already carries. No existing gate: component-check exercises the Settings panel but does not compare it with the tutorial copy that describes it.

### F5. [MEDIUM] WORLDS.md forbids flow streaks on the Vortex Glacier's ice; the renderer draws them on every ice tile

**Evidence**

- `dev_notes/WORLDS.md:367`

  > the ice is blank and pale — the field has been pushed out of it — and the only
  > places anything shows are the cores, where the trapped flux glows.

- `dev_notes/WORLDS.md:370`

  > glow survives rather than by streaks on the road.

- `game/src/art/biomes.ts:213`

  > "Swept" is literal -- the ice is streaked
  > // with flow-lines that bend away from the bulk and converge only into the
  > // pits, which is field expulsion drawn as terrain.

- `game/src/scenes/overworld/terrain/decoration.ts:90`

  > if (biome.decoration === 'flowLines') {

**What is wrong.** WORLDS.md §2's World 5 entry states an explicit design rule with its physics rationale attached: field expulsion is shown by where the glow survives at the vortex cores, and specifically not "by streaks on the road". The code does the opposite, and says so in its own comment: VORTEX_GLACIER carries `decoration: 'flowLines'` with `decorationChance: 1` (biomes.ts:239, 240), and decoration.ts:83-100 draws two bowed pale lines on every tile, commented as "field expulsion drawn on the ground the player walks". Both sides are internally coherent and each is a defensible reading of Meissner expulsion; they cannot both be the rule. The player-facing texts side with the code: WORLD_LORE[5] page1 says "The ice is swept clean, every line of it bending away" (worldLore.ts) and docs/storyline.md:249 says "The ice is streaked with flow lines all bending away", so WORLDS.md is the lone dissenter.

**Which side is correct.** Needs the owner. Both sides are physically defensible; what is not acceptable is the binding doc forbidding in words the thing the renderer does on every tile of that world.

**Recommendation.** Owner decides: either amend WORLDS.md §2's World 5 paragraph to describe the swept ice the game actually renders (and the lore/docs already describe), or drop the flowLines decoration and let the pits carry the expulsion. Note WORLDS.md:9-16 declares terrain entries open for revision, which may already cover this - but the "streaks on the road" clause reads as a stated rule with a rationale, not a map-shape note, so it should be settled rather than left standing against the code. No existing gate: greyscale-check and perf-check measure legibility and draw cost, not agreement with WORLDS.md.

### F6. [MEDIUM] WORLDS.md §6 uses two stale names for World 1 and World 2 that no code surface has used in a long time

**Evidence**

- `dev_notes/WORLDS.md:997`

  > Meadow's order, it makes the broken symmetry doubt itself; it doesn't break the

- `dev_notes/WORLDS.md:998`

  > lattice's atoms, it puts one alcove fractionally out of step so the delocalized

- `game/src/data/materials.ts:1984`

  > 1: 'The Mean Fields',

- `game/src/data/worldLore.ts:33`

  > One column drifts a fraction out of step with the next, and the wide, borderless state that once spread through the whole colonnade has nowhere left to go.

**What is wrong.** WORLDS.md §6's "The Decoherence is never generic" paragraph is the rule every new lore page is judged against, and it illustrates the rule with two names the rest of the project has dropped. World 1 is "The Mean Fields" everywhere in code (materials.ts:1984, and WORLDS.md's own §2 table at line 203); "the Meadow" appears nowhere else in the repository. World 2's repeating unit is a "bay" or a "column" in every player surface - worldLore.ts:31-33 ("Not every bay matches its neighbor plainly", "One column drifts a fraction out of step"), story.ts:18 ("bay matching bay through the whole of the quartz"), the rival taunt ("Bay after bay, the same shape at the same spacing") - while WORLDS.md says "alcove". A developer reading §6 cold to write a new world's Decoherence page will pick up vocabulary the game has abandoned.

**Which side is correct.** The code is correct on both counts; only the binding doc's illustrative wording is stale, so this is a two-word doc edit with no gameplay or physics consequence.

**Recommendation.** Replace "the Meadow's" with "the Mean Fields'" and "one alcove" with "one column" (or "one bay") at WORLDS.md:997-998, matching the surfaces the paragraph is describing. No existing gate: no script reads dev_notes prose against WORLD_NAMES.

### F7. [LOW] WORLD_FLAVOR[2] calls World 2's repeating unit an "alcove" where every other surface a player reads calls it a bay

**Evidence**

- `game/src/data/worldFlavor.ts:15`

  > Every alcove here repeats its neighbor exactly, and Bloch's theorem takes that symmetry seriously: an electron built to respect it can't live in just one alcove.

- `game/src/data/worldLore.ts:27`

  > Walk one bay of it and you have walked them all. Same shape. Same spacing.

- `game/src/data/story.ts:18`

  > The glass between the grains crystallizes, bay matching bay through the whole of the quartz

**What is wrong.** A player who reads Bloch's World 2 preview and then the world's own entry lore, its rival taunt ("Bay after bay, the same shape at the same spacing") and its post-victory beat meets two different words for the same thing. "Alcove" also does not describe what the world renders: WORLDS.md §2's World 2 is a colonnade whose repeating unit is a column and the aisle between columns, not a recess. This is the same stale vocabulary preserved at WORLDS.md:998, so the two findings share a cause.

**Which side is correct.** Cosmetic; the physics of the sentence is untouched and "bay" is what the other three World 2 surfaces already say.

**Recommendation.** Change "alcove" to "bay" in both places in worldFlavor.ts:15, matching worldLore.ts and story.ts. No existing gate.

### F8. [LOW] materialdex.ts's rival-blurb comment claims ten entries read once per boss; the table holds eight, and two rivals fall through to a generic type blurb

**Evidence**

- `game/src/data/materialdex.ts:22`

  > // The ten rivals, and the one place the game states plainly what a golem is.

- `game/src/data/materialdex.ts:25`

  > // as accusation: the material says what happened to it, and the player

- `game/src/data/materialdex.ts:139`

  > return MATERIAL_BLURBS[material.name] ?? TYPE_FALLBACK_BLURBS[material.type];

**What is wrong.** The comment block at materialdex.ts:22-27 says the golem blurbs are "the text a player reads ten times across the game, once per boss, each time naming the specific order that boss lost". The table below it holds eight such entries (lines 28-42, Silicon through Ruthenium Trichloride). World 9's rival is one of the eight rolled RIVAL_9_NAMES (materials.ts:1527-1536), none of which has an entry, and World 10's is The Adapted; both therefore reach `TYPE_FALLBACK_BLURBS[material.type]` at line 140. In practice World 10 is covered, because BattleScene:3191 calls `materialBlurb(this.opponentView())` and `opponentView()` (BattleScene:485-487) returns whichever real compound The Adapted was last disguised as - but that is a mechanism the comment does not mention, and it does not cover World 9's golem at all, which always shows the generic blurb for its rolled type. A developer taking the comment at face value will look for ten entries and find eight.

**Which side is correct.** Comment-only for World 10 (the mechanism already works). For World 9 it is a real gap in coverage, but a mild one - the fallback blurb is accurate physics for the rolled type, just not specific to the golem.

**Recommendation.** Restate the comment as current fact: eight authored rival blurbs for worlds 1-8, World 9's rolled golem falling to its type's fallback, and World 10 reading whichever disguise `opponentView()` last set. If a World 9 blurb is actually wanted, that is a separate content decision for the owner. No existing gate: content-lint checks move ids and world/table parity, not blurb coverage for rival names.


