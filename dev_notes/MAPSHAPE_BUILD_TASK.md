# Build task — walkable area: making every world read as wide

Work list for the second pass over the overworld *map shapes* — how much ground
a world gives the player to stand on, and what that ground's outline says about
the physics. `DESIGN.md` §2 owns the map-shape table and stays the source of
truth for the result; `WORLDS.md` owns each world's terrain and palette and is
where the surround wording is reconciled. Both are explicitly open on maps
(`WORLDS.md`'s header), so the changes below are design proposals decided on
their merits, not divergences to be raised.

The goal in one line: **a world should feel like a place the player is standing
in, not a path they are being led down.** The Storm Flats and the Entangled Web
were the two that already did, and they are what the other eight were brought up
to.

---

## The measured baseline

Every image below is `screenshots/storyline-world-N.png`, which `npm run shots
-- worlds` regenerates from the running game — so they are the current ground
rather than a snapshot that will quietly age out of date.

`npm run mapshape:measure` (`game/scripts/mapshape-measure.mjs`) takes this
reading: 60 maps per world, from the start tile the game actually uses
(`OverworldScene`: `x = gridW/2`, `y = gridH - tiles(5)`), at any of the three
world sizes. "runs/row" is how many disjoint walkable stretches an occupied row
holds, which is what genuine route choice looks like in a number.

Meso (27x50), with each world's reading from before this pass in the last
column:

| World | fill % | mean row width | of grid | runs/row | was |
|---|---|---|---|---|---|
| 1 Mean Fields | 38.0 | 11.4 | 42% | 1.29 | 23%, 1.16 |
| 2 Stone Lattice | 38.2 | 11.5 | 42% | 1.66 | 19%, 1.00 |
| 3 Winding Borders | 35.2 | 9.6 | 36% | 1.67 | 30%, 1.43 |
| **4 Storm Flats** | **48.0** | **14.4** | **53%** | **1.08** | **unchanged — the reference** |
| 5 Vortex Glacier | 37.7 | 11.3 | 42% | 1.29 | 40%, 1.14 |
| 6 Iron Steppe | 39.4 | 11.8 | 44% | 1.15 | 27%, 1.00 |
| **7 Entangled Web** | **36.1** | **10.8** | **40%** | **2.42** | **unchanged — the reference** |
| 8 Screened Swamp | 35.3 | 10.6 | 39% | 1.44 | 21%, 1.14 |
| 9 Defect Scars | 36.9 | 11.1 | 41% | 1.32 | 25%, 1.00 |
| 10 Devouring Mirror | 39.1 | 11.6 | 43% | 1.50 | 34%, 1.37 |

All ten are in band at Nano, Meso and Macro alike, and every fill sits under the
ceiling. World 3 is deliberately the lowest on width and among the highest on
multiplicity, which is the shape of the exception it is.

**Target band for a redone world:** mean row width **>= 40% of the grid's own
width**, *or* runs/row **>= 1.4**. Hitting either the width or the
multiplicity column is enough; worlds 4 and 7 hit one each and both read as
wide. The width half is a fraction rather than a tile count because a world is
only as wide as the grid it stands on: the same shape measures 8 tiles at Nano
and 33 at Macro and is the same world at both, so a redone world is checked at
all three sizes.

## Why 4 and 7 work, and they work differently

The two liked worlds are the two that stopped painting a route onto an
impassable background:

- **Mode (a) — open field, impassable punched into it** (World 4). Everything
  is ground; the hazard is a set of features *on* the ground. Wideness comes
  from floor area.
- **Mode (b) — route multiplicity** (World 7). The floor is not especially
  wide, but there are always several ways north and the player picks one.
  Wideness comes from freedom, not area.

The redesign is that inversion, applied per world, with the mode chosen by that
world's own physics rather than uniformly. A world where the physics genuinely
*is* a one-dimensional object keeps mode (b) rather than being widened into
saying something false.

## The one thing wideness costs, and the limit it sets

`WORLDS.md` is explicit that with ground motifs gated off, **the impassable
surround is the only place a world's identity lives** (§2, World 1). Every tile
converted from surround to floor is a tile of forest/columns/shards/reeds that
no longer draws. Worlds 4 and 7 can be as wide as they are precisely because
their surround is cheap to state — banded ground the storm strikes, and literal
void.

So the rule for the six being redone is: **widen until the surround is a
frame, never past the point where it stops being visible.** Concretely, keep
`fill` at or under World 4's 48%, and keep impassable mass in the near field
(the frame holds about 13 tiles across at the player's own depth) rather than
pushing it all out to the grid edges where the projection shrinks it to
nothing. Mode (a)'s punched islands do this by construction — they put surround
*inside* the field, where it is closest to the camera and reads largest.

---

## Per-world plan

### Kept as they are

**World 4 (Storm Flats)** and **World 7 (Entangled Web)** are the reference.
Their generators are untouched; their numbers above are the acceptance band for
everything else.

<img src="../screenshots/storyline-world-4.png" width="420" alt="The Storm Flats: banded indigo ground running wide in every direction">

<img src="../screenshots/storyline-world-7.png" width="420" alt="The Entangled Web: parallel white-gold lanes linked by rungs, hanging in void">

### World 1 — The Mean Fields — mode (a) — **built**

<img src="../screenshots/storyline-world-1.png" width="420" alt="The Mean Fields: open wheat, the two tinted half-fields ahead and the hedgerow dividing them">

A field is wide by definition, and a 6.3-tile corridor was the worst mismatch in
the set between a world's name and its ground. The two symmetry-broken branches
are now two broad tinted **half-fields** divided by a hedgerow that opens out of
nothing, widens, and closes again — the same split/merge physics at field scale
instead of as two 3-tile lanes. The forest stays as the outer hem, which is what
preserves the 1↔8 rhyme `WORLDS.md` guards.

The hedgerow is punched as **one island, all of it or none**: a gap in it would
be a way across, and a way across is the player unpicking a choice the world has
already made them make. That is also why it is placed against `bandWindow` — the
ground the field holds in common for a few rows either side — rather than against
the row it sits on. Centred row by row on a drifting field it reaches past what
the neighbouring rows cover, and the whole hedgerow gets refused. It lands in
200/200 maps at every world size.

### World 2 — The Stone Lattice — mode (a) — **built**

<img src="../screenshots/storyline-world-2.png" width="420" alt="The Stone Lattice: an open cloister floor with columns standing in it, the dense column field beyond">

Was the narrowest world in the game (5.0 tiles, and the only one with no
randomness at all). The inversion was unusually clean here: **the walkable
ground is the cloister floor, and the impassable is the periodic array of
columns standing in it.** The player walks *through* the lattice rather than
down a weave beside it, which is also better physics — tight-binding is motion
past a periodic array of scatterers, not a wiggling path. `WORLDS.md`'s "rows of
identical sandstone columns marching off in both directions" is now literally
true of the ground the player crosses.

As built: a straight-walled hall of `scale.tiles(14)`, with columns on an
8-wide cell carrying a two-atom basis (offsets 0 and 3, so aisles alternate 2
and 4 tiles) and a 3-row period along the hall. The cell and the row period are
unscaled by world size (`shared.ts`'s rule: a lattice constant is a length of
the material, not of the map), so a Macro cloister is more columns across the
same aisles. Randomness per visit is the lattice phase alone — where in the
crystal the player entered — which is the honest randomness for a perfect
crystal and makes translation, the symmetry the world is named for, the thing
that varies.

Two couplings worth knowing before touching it again:

- The hall's columns arrive at the renderer as `featureCores`, and
  `materials/columns.ts` draws a column on every core plus its own
  every-second-tile lattice everywhere else. That is what lets the generator
  place columns freely while the surround stays the dense field the hall is cut
  out of. Placing columns without tagging them would draw bare impassable tiles.
- `SURROUND_MIN` keeps the hall off the grid edge on both sides. The surround is
  where this world's identity lives, and a hall run out to the edge would leave
  the columns only in the distance, where the projection has shrunk them to
  nothing.

Reached 43% of grid width and 1.65 runs/row at Meso (44%/1.39 Nano,
41%/3.60 Macro), at 37-39% fill — in band at all three sizes, under the fill
ceiling at all three.

This also removed a live fragility. The old generator was fully deterministic
and its validity turned on the parity of the row count: at the game's start row
it passed 100%, and three rows further south it failed 100% and fell back to the
plain corridor with only a `console.error`. A field with columns punched into it
has no such knife-edge, since connectivity no longer depends on consecutive
bands overlapping.

### World 5 — The Vortex Glacier — mode (a) — **built**

<img src="../screenshots/storyline-world-5.png" width="420" alt="The Vortex Glacier: an open ice sheet running to the horizon">

An **open ice sheet** with the vortex cores as impassable islands the player
winds around because the geometry leaves no way through, not because a spiral was
painted. The winding is emergent, which is also the better physics: a
supercurrent circulates around a trapped flux line for exactly that reason.
`featureCores` still carries the pit centres, since `materials/ice.ts` draws the
rim-lit pit from that list and `WORLDS.md` hangs the whole field-expulsion image
on the glow surviving only there.

**The failure this world nearly shipped with is worth remembering.** Placed the
obvious way, the pit was refused in 55-90% of maps — a Vortex Glacier with no
vortex in it — and every width measurement still looked healthy, because a
missing feature makes a world *wider*, not narrower. Neither the invariant check
nor the shape band can see it. Two things fix it, and both are now the pattern
for any named feature: place against `bandWindow` rather than the pit's own row,
and place with `punchFirst` over a ladder of candidates (the pit wanted, then
smaller ones, then a few rows along) so the world cannot roll a map without one.
Now 1.49 pits per map against a one-or-two roll, none missing in 600 maps across
the three sizes.

### World 6 — The Iron Steppe — mode (a) — **built**

<img src="../screenshots/storyline-world-6.png" width="420" alt="The Iron Steppe: an open plain of iron-sand with shard clumps standing in it">

A steppe is a plain, and 7.2 tiles was not a plain. Wide black iron-sand with
the **shard clumps standing in it** — the image `WORLDS.md` already asked for,
with the shards inside the world instead of lining a corridor.

The magnon is now **transverse wavefronts**: clumps in ranks one wavelength apart
down the plain, each rank offset sideways from the one behind it so the train
reads as travelling rather than as a fence repeated. That states the physics
better than the width pulse it replaces — a spin wave is a periodic disturbance
of an ordered medium moving through it, and the player walks between its fronts.
The wavelength stays unscaled by world size, as before.

### World 8 — The Screened Swamp — mode (a) — **built**

<img src="../screenshots/storyline-world-8.png" width="420" alt="The Screened Swamp: a peat shelf with black water and reeds either side">

A **peat shelf with pools punched into it**. The shelf parts around the wider
pools and rejoins past them, and `featureCores` still hands each pool centre to
`materials/bog.ts` to burn a local moment in, so the
split-and-screening-are-one-picture rule is intact.

**The escalation is the shelf, not the pool density, and that correction is worth
keeping.** The intent was open peat at the entrance thickening to nearly all
water by the end, done by crowding pools. It cannot be done that way: a pool
needs clear ground on every side, so past a certain density pools start refusing
each other, and the measured gradient came out *backwards* — the deep end, which
wanted the most water, was the part that could fit the least. The shelf itself
now carries it, tapering from `tiles(17)` at the entrance to `tiles(12)` at the
goal, which is legible, monotonic, and cannot fail to place. The general lesson
is in `DESIGN.md` §2: a denser scatter than the clearance allows does not produce
more features, it produces features that reject each other.

### World 9 — The Defect Scars — mode (a) — **built**

<img src="../screenshots/storyline-world-9.png" width="420" alt="The Defect Scars: an open plain of scorched clay with molten crust beyond it">

A wide plain carrying **two kinds of defect**, which reads the world's topic
better than widening its corridor and stopping. The borrowed-biome patches stay
exactly as they were — substitutional defects, the wrong atom on the right site,
changing the look of the ground and nothing about its shape. Beside them are
**vacancies**: holes punched clean out of the plain with molten crust in the gap,
a site not occupied at all, which the player walks around rather than over.

Both need the plain to be mostly good crystal to read as defects at all, which is
the argument for the width rather than merely an excuse for it.

`fallback.ts`'s own 7-tile corridor is deliberately left narrow. It is what
`generateWorldMap` falls back to when a generator cannot produce a valid map, and
a fallback that looks like an ordinary world of this game is a fallback nobody
notices has fired.

### World 3 — The Winding Borders — mode (b), narrow on purpose — **built**

<img src="../screenshots/storyline-world-3.png" width="420" alt="The Winding Borders: a lit ledge at a junction where several bulk domains meet">

The honest conflict in the set. Bulk-boundary correspondence *is* "the edge is
the only place you can stand" — widening the seam into a field would say the bulk
is walkable, which is the opposite of the world's one idea. So World 3 is
unbounded without being wide: **more Voronoi seeds (8-11), a denser seam network,
more junctions and more genuine choices of which wall to follow north**, with the
seam left at its own width. Runs/row 1.43 → 1.67, and not one extra tile of
walkable bulk.

The seed count is a count and does not scale, so a Nano world is a finer phase
diagram on a smaller grid, and its fill runs the highest of the ten (47%). That
is the ceiling, and it is why the count is 8-11 rather than the 9-14 first tried,
which put Nano over it.

Kept deliberately as the set's one narrow-but-unbounded world, for contrast.

### World 10 — The Devouring Mirror — inherits

No work of its own: it dispatches to worlds 1-8's generators, so it widened when
they did. `TYPE_TO_GENERATOR` still reads correctly against the new shapes, and
World 10 measures in band at all three sizes.

---

## The shared primitive — **built**

`generators/shared.ts` carries the toolkit every redesign here is built from: a
world paints a wide field, hands over a list of candidate islands, and takes back
the ones its ground had room for. Six worlds are that plus a per-world island
shape (hedgerow, columns, vortex pits, shard clumps, pools, vacancies) and a
per-world field. `punchIslands` places what fits; `punchFirst` guarantees a
feature the world is named for; `discIsland` is the shape most of them want;
`bandWindow` is where an island may be centred on drifting ground.

**The trap it exists to close:** islands create narrow walkable gaps, both
between two islands and between an island and the field's own edge, and a
1-tile gap is what invariant A forbids. `clearance` is therefore the walkable
gap that must remain on *every* side, checked against the grid as it stands —
so one rule holds an island off the field edge, off anything already punched,
and off the grid boundary, and the aisles the islands leave between them stay
above the floor. It defaults to `MIN_SEGMENT_WIDTH`. Without it the generators
would churn through `generateWorldMap`'s 10-attempt retry loop and land on the
fallback corridor.

A candidate that doesn't fit is **dropped rather than moved**: a world asks for
more islands than it needs and keeps placement declarative, instead of shoving a
feature somewhere the world didn't mean it to be. World 2 relies on exactly this
at both ends of the hall — the rows within the clearance of the goal row and of
the unpainted ground south of the start simply take no columns, so both passes
open into clear floor without the generator special-casing them.

`widestRunCenter` is the companion: it picks `goal`/`mid` out of the finished
floor rather than predicting where a gap will be, which is what keeps a landmark
in open ground whatever the islands did to that row.

**Two islands cannot stand closer than their own radii plus the clearance**, and
this is the constraint most likely to be missed. Asking for a tighter scatter
does not produce more features; it produces a first feature that rejects the
second. A density gradient has to be built from something else (World 8's shelf)
or from spacing that respects the arithmetic.

An island on the guardian's row fights `forceChokepoint`, which wipes that row to
a 3-tile gap, so every world keeps its features off `mid.y` and its neighbours —
World 2 by putting `mid` on a row the lattice skips, the rest by an explicit
exclusion around it.

## Decisions taken (not open questions)

- **The grid stays 27 wide.** The near frame holds about 13 tiles across at the
  player's own depth, and the full 27 is on screen by roughly 5 tiles of depth.
  27 already exceeds what near-field wideness can display, so widening the grid
  would buy no perceived width while costing save size, draw cost and sideways
  walking tedium.
- **One encounter roll per corridor row stays** (`DESIGN.md` §2). Wide floors
  make wilds dodgeable rather than unavoidable, which is a real change in feel —
  the player chooses fights instead of bumping into them. That is arguably what
  "not bounded to a narrow path" should mean, so the rule is left alone and the
  effect left to be judged in play before any mechanic is touched.
- **Rendering cost is not a concern.** `paint.ts` already clips per frame by
  `laneClipAt` and fills past the grid edges, so a tile costs the same whether
  it is floor or surround. Converting surround to floor slightly *reduces* work,
  since off-path material modules stop drawing on those tiles.

## Consequences to handle in the same pass

- **`scatterTokens` prefers degree-1 dead-end tiles**, which an open field has
  almost none of. Either give each field a few deliberate spurs, or accept the
  existing any-walkable-tile fallback and check the pickups still read as
  "found on the way" rather than strewn across a plain.
- **The chokepoint wall and the two 6-row pass tapers get much more
  conspicuous** cutting across a 20-tile-wide field than across a 6-tile
  corridor. Screenshot both ends of a redone world; if the taper reads as a
  wall, deepen `BASE_PASS_ROWS` for wide worlds rather than widening the throat
  (the throat is load-bearing for the gate, the boss preview and the sign board).
- **Respawn cost is the one place area genuinely bites.**
  `POLISH_BUILD_TASK.md` 14b measures `surveyRespawnGround` at roughly
  `A + C·W + n·C` for map area *A*, eligible tiles *C* and width *W* — 1.7 ms
  median and 6 ms worst on today's maps — and defers optimising it "unless maps
  grow substantially." Roughly doubling walkable area is exactly that trigger.
  Re-measure with `npm run perf-check` after the exemplar world; if the
  per-step case has moved badly, 14b's first fix (maintain the eligible set
  incrementally instead of rebuilding the survey) is the one to take, and it is
  scoped there already.
- **`DESIGN.md` §2's map-shape table** needs one rewritten row per changed
  world, and **`WORLDS.md`**'s per-world terrain paragraphs need their
  walkable/impassable wording reconciled (World 2's aisle, World 5's spiral,
  World 6's shard fields, World 8's banks, World 1's branches). Written as
  current state, not as a record of the change.

## Verification

- `npm run mapgen:check` — both invariants, every world, all three sizes. The
  gate on every redesigned generator.
- The measurement harness above, re-run as before/after evidence that a world
  actually landed in the target band. Worth keeping as a script.
- The `visual-proof` skill — this is a terrain change, so seeded before/after
  and a greyscale legibility read.
- `npm run perf-check` — the respawn survey against the enlarged maps, per the
  consequence above.
- `npm run content-lint` and `npm run component-check` before any push, as
  always. Not `playthrough-check` unless asked for explicitly.

## Sequencing

| Stage | What | Status |
|---|---|---|
| 1 | Exemplar: World 2, and the shared island toolkit built against it | **built** |
| 2 | The rest of mode (a): 1, 5, 6, 8, 9 | **built** |
| 3 | World 3's networked variant | **built** |
| 4 | Re-measure all ten, reconcile the docs, full verification | **built** |

What is left is the judgement the numbers cannot make: whether each world
*plays* the way it now measures. `DESIGN.md` §2's and `WORLDS.md`'s notes that
the maps are under revision stay until that has been sat with.

## Decisions

1. **World 3 stays narrow.** Bulk-boundary correspondence is the world's one
   idea and a walkable bulk contradicts it, so freedom comes from a denser seam
   network rather than a wider seam. It is the set's deliberate
   narrow-but-unbounded world.
2. **World 8 gets pools punched into a wide shelf**, with pool density rising
   toward the guardian so the escalation spine still lands on the axis the
   screening already uses. `WORLDS.md`'s wording for that world is reconciled
   when it is built.
