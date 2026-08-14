# Build task — move the code onto WORLDS.md

Work list for retheming the ten overworlds onto the identity settled in
`WORLDS.md`. That file is the spec; this one is the checklist. Delete this file
once the work has landed.

**Ordering:** the overworld footing/collision fix lands first, on branch
`worktree-agent-af0cb6c353e921148`. It does **not** touch terrain *painting* —
`buildTerrainPlan`, `drawOffPathTile`, `offPathColor`, `groundColor`,
`decorateTile`, the accent draws and all of `art/biomes.ts` are untouched — so
this task should merge cleanly on top of it. Its only edits inside the
terrain-drawing path are three lines (a `maxY` extension and two near-plane
culls).

Two invariants that branch establishes, which this work must respect:

- **All depths route through `projectTile`**, which applies `CAMERA_BACK_TILES`
  internally. New terrain drawing must call `projectTile` and must *not* add the
  camera pullback itself, or it double-counts.
- `art/contours.ts`'s exported API is unchanged — `buildContourGrid(walkable,
  gridW, gridH)` and the `TileContour` shape (`outline`/`shadow`/`rim`) are the
  same. Only `MAX_OFFSET`'s value moved, and the inward `INSET` bias that used to
  pull boundaries onto the walkable side is gone, so drawn edges now sit on the
  collision grid.

---

## 1. Non-negotiables

These are the items most likely to be quietly dropped mid-build, each of which
takes a world with it. Treat them as acceptance criteria, not polish.

- **World 4's orbit rings stay on the ground.** With the name no longer saying
  "orbit", the rings are the only thing left teaching that Landau levels are
  quantised orbits. Dropping them is a pedagogical loss, not a visual one.
- **World 4's overhead field-line arcs stay**, and the soft dark strip along
  each band's lower boundary stays. The ground is a diagram; the sky and the
  value work are what stop it reading as a chart. This is lighting, not
  landform — no elevation is being claimed.
- **World 3's drop is shallow and never true void.** Sunken dead floors, visible
  one storey down, in two dead colours. Nothingness belongs to World 7 alone;
  spending it at slot three pre-spoils the finale-adjacent world.
- **World 8's trees are World 1's tree sprites, dead and grey** — the same
  geometry, recognizably. That reuse *is* the story beat; a generically spooky
  tree throws it away.
- **World 8's threat lives in the fog, not the trees.** Trees are World 1's
  "you just wouldn't walk there" logic and would regress the escalation spine at
  world eight of ten.
- **After World 7 the sun never returns.** Worlds 8–10 emit their own light.
- **World 10 must visibly take something** — the path dissolving behind the
  player as the terrain re-forms ahead. Without it "Devouring" is a boast.

## 2. Data and naming

- `game/src/data/materials.ts` — replace `WORLD_NAMES` with the ten names in
  `WORLDS.md` §2. Check `WORLD_RIVALS` in the same pass, per `DESIGN.md`'s
  standing note; the rivals are anchored to compounds (`Polycrystalline <X>
  Golem`) so no rival name should need to change, but confirm rather than
  assume.
### Narrative text — the largest and most delicate part of this task

The Decoherence arc is already written across five surfaces (`WORLDS.md` §6) and
it is good. **The risk here is damaging it, not writing it.** Much of it names
the old terrain directly, so the retheme forces rewrites — every one of which
must preserve the patterns in §6: the Decoherence attacks a *named mechanism*
specific to that world, and the rival is that world's physics made
incorruptible. Change the scenery, never the argument.

Known conflicts, by file:

- `data/worldLore.ts` — **World 2 is the worst case**: its lore is written for a
  dark cave throughout ("by the time it reaches these caves", "the whole tunnel",
  "this repeating dark"), and its rival "unfolds from the tunnel wall". The
  alcove/repetition imagery survives the move to a sunlit stone cloister almost
  untouched — a cloister is made of alcoves — but the cave framing does not.
  **World 3** is written as floating islands with impassable interiors; the
  seam-as-road argument survives intact, the islands do not. **World 5** is
  written as caverns and tunnels, now an open glacier. **World 6** says "the
  grass" and its rival "rises out of the grass", now black iron-sand. Worlds 1,
  4, 7, 8, 9, 10 are broadly safe; check anyway.
- **"the Meadow" is a proper noun across worlds 1, 2 and 10**, including World
  10's reveal line ("Ask it for the Meadow. It will hand you the Meadow back").
  Renaming World 1 propagates into the finale's most important paragraph — treat
  that sentence with care rather than search-and-replacing it.
- `data/story.ts` — `STORY_BEATS` describe the *next* world's terrain in every
  line ("the floating islands", "the windswept plains", "a foggy forest"), and
  `WORLD_GOAL_TEXT` names each world's own. Both need a full pass.
- `data/worldFlavor.ts` — plain physics per world, but World 8's entry names
  "Magnon Plains" explicitly.
- Old names also appear in `audio/music.ts`, `art/biomes.ts`,
  `scenes/OverworldScene.ts` and `data/materials.ts`. Grep for every retired name
  rather than trusting this list.

**World 10 needs one new line**, not a rewrite: a bridge in guardian dialogue or
its dex entry with the shape of *to learn you, it must measure you; to measure
you is to unmake you*. Its existing lore already carries the training/watching
half of the idea extremely well; what is missing is the sentence that welds it to
decoherence. See `WORLDS.md` §2 (World 10) for why that weld is real physics
rather than a metaphor, and for the hierarchy it must preserve: decoherence is
the villain's mechanism, machine learning is still the lesson.

## 3. Biomes and terrain rendering

`game/src/art/biomes.ts` currently offers four off-path materials
(`rock`/`water`/`lava`/`void`) via `WallTheme`. The spec needs roughly five more,
and this is the bulk of the engineering:

| World | Off-path needed | Notes |
|---|---|---|
| 1 | forest canopy | new; tree sprites must be authored as a **shared asset** — World 8 reuses them |
| 2 | periodic stone columns | new; evenly spaced with dark shadow gaps |
| 3 | sunken dead floors | new; extended flat expanses one storey down, two dead hues, structured crystalline stipple (not random noise, which reads as a rendering artifact) |
| 4 | banded ground + boundary glow + overhead arcs | new; the arcs are a *sky* element, not an off-path one |
| 5 | ice with flow-lines | extend `water`; lines bend away from the bulk and converge into the vortex pits, which get a faint cold interior glow |
| 6 | aligned iron shards | new; leaning one way, flipping across a domain wall |
| 7 | void | existing, keep |
| 8 | fog volume + dead trees | fog must read as the hazard |
| 9 | lava | existing; add the toppled column drums from World 2, half-sunk |
| 10 | reconfiguring/consuming terrain | new; see non-negotiables |

Palette values per world are in `WORLDS.md` §3. Note World 4 is storm **indigo**
(not violet) and World 6's aurora is **pure green** — violet belongs to World 10.

Also in scope, because the theming depends on it: **the ground-decoration
pipeline is currently dead code.** `generateMap` only marks `flowerMap` for
non-walkable tiles, while `drawWorld`'s decoration draw is reached only from the
walkable branch, so no world renders decorations at all. Several worlds in this
spec (World 4's orbit rings, World 6's ripples, World 9's cracks) depend on that
path working, so it has to be fixed here rather than tracked separately.

## 4. Beats to build

- **World 6's tell** — the aurora stutters, or the shard field beyond the domain
  wall visibly flips while the player watches. Without a tell, the false calm is
  just a pretty world. This is the one item whose cost is out of line with the
  rest (animated off-path terrain); it is worth building, but it is the first
  thing to cut if something must go.
- **World 3's racing sky** — clouds moving overhead while the ground stays
  perfectly still.
- **The recognition seed** — a few crystalline fragments of the player's *own*
  material embedded in the impassable surround of World 8 or 9.
- **World 9's two-tense damage** — walkable clay reads as old closed scars, the
  crust as wounds still open.

## 5. Verification

`tsc --noEmit` cannot see any of this. Per `CLAUDE.md`:

- `npm run content-lint` and `npm run component-check` from `game/`, both, before
  any push.
- **Do not** run `npm run playthrough-check` unless explicitly asked in that
  session.
- Drive the game headlessly and look at it — the `run-game` and `verify-ui`
  skills cover the Node-18 workaround this machine needs. Screenshot **every**
  world, near-camera and near-horizon, and check the two spines hold: is the
  impassable terrain plausibly impassable at its danger tier, and does the
  walkable ground read as its tier of "made for walking"?
- Worth a second opinion on the screenshots rather than self-assessment; the
  question is whether each world reads as its name, which is not something the
  implementer can judge from having just built it.

## 6. Docs to keep in sync

Per `CLAUDE.md`, in the same change, written as current state rather than as a
change log:

- `dev_notes/DESIGN.md` §2 — the world table's name/biome column; leave map
  shapes and gates alone, and point at `WORLDS.md` for theming rather than
  duplicating it.
- `dev_notes/STYLE.md` — the naming law, the light rule and the two escalation
  spines from `WORLDS.md` §1 are visual conventions and belong here too.
- `dev_notes/CODEMAP.md` — any new `WallTheme`/`DecorationKind` renderers.
- `docs/*.md` and `README.md` — anywhere the old world names appear. Never
  hand-edit inside a `<!-- GENERATED -->` block; change the data and run
  `npm run docs` from `game/`.
- Delete this file when the work lands.
