# Build task — world continuity, horizons and gates

Work list for making the overworld continuous to the horizon and turning the
world-to-world connections into geography. The spec is `WORLDS.md` §4, which is
the authority; this file is the checklist. Delete it once the work has landed.

**Ordering against the retheme.** Stages A, B and C are built, on top of the
retheme — a world's distant self *is* its impassable surround restated at
horizon scale, so the two were authored in one pass. Stages D–F remain.

---

## The staging

Build in this order. Each stage is shippable on its own.

| Stage | What | Depends on | Status |
|---|---|---|---|
| **A** | Depth continuity — land reaches the horizon | nothing | **built** |
| **B** | Haze inheritance — the air ahead becomes the next world's air | A | **built** |
| **C** | Distant selves — per-world horizon profiles, composed into neighbours | retheme, A | **built** |
| **D** | Gate apertures — state-signalled pass, ground seam | C | to do |
| **E** | Depth-projected flanks — the approach into the pass | D | **deferred** |
| **F** | The Lab door, then the Qumatuomi sky | D (Lab quotes its grammar) | to do |

E is the only speculative item; if it reads badly in the first world tried,
stop — D alone is a complete gate.

---

## A — Depth continuity — built

`OverworldScene.drawMarginRows` repeats the far edge row outward past the grid,
terrain kind included, as `drawMarginColumns`'s counterpart in depth;
`drawHorizonBand` owns the last strip up to the horizon line. See `CODEMAP.md`'s
"Reaching the horizon" for the drawing paths and `STYLE.md`'s "Overworld path"
for the visual rule. What `WORLDS.md` §4 requires of it, and what any later
stage drawing at depth must keep true:

- The repetition is capped at the depth-fog saturation row, and the painted
  gradient band owns the final strip up to the horizon line.
- No row thinner than a pixel is drawn — such rows alias and crawl as the camera
  moves.
- **The repeated road is intentional** — repeating the far row repeats the
  walkable path, so a road continues past the world's end. It drowns in haze
  quickly; stage D is what hides it behind a shut gate, which it does not yet do,
  so on a goal tile with the rival still alive the road currently continues into
  open haze.
- All depths route through `projectTile`, which applies `CAMERA_BACK_TILES`
  internally. Drawing must call it and must not add the camera pullback itself,
  or it double-counts.

**A known limit, so it is not refiled as a bug.** Faint contour striping is
visible in the mid-distance ground, strongest in the shut states of the bright
worlds. It is **row-fill quantization**: each projected grid row paints as one
flat colour, so the depth fog can only step between rows rather than vary
across them. The worst per-row step is about 15 luminance around depth ratio
0.7, of which roughly a quarter survives the horizon band's wash over it, in a
band about 6px tall. Those numbers are properties of the depth schedule and the
row count, not of the horizon line: raising or lowering `HORIZON_Y` stretches
the same steps over more or fewer pixels and changes neither the step nor how
much of it the wash covers. It is game-wide, not a property of any one world,
and at 1× it has to be hunted for on a clean display. The
arrangement that keeps it that small is described in `CODEMAP.md`'s "Reaching
the horizon" — a gentle near/mid falloff with the steepness spent late, under a
band whose reach is derived to cover it. Anyone wanting to push further has two
levers: the shut-state zone above, or giving the ground a per-pixel gradient
instead of one fill per row, which is the only thing that removes the cause
rather than masking it.

## B — Haze inheritance — built

`hazeTarget`/`forwardHazeBlend` carry every haze in the scene toward the next
world's fog colour as the player nears the goal row (`CODEMAP.md`'s "Forward
haze inheritance").

**Gated on gate state: a shut gate means no forward palette bleed.** The gate
input is `isRivalDefeated()` until stage D builds the aperture itself; when it
does, that is the single call to re-point.

## C — Distant selves — built

One asset per world, authored once: a profile in `art/horizons.ts` plus a base
colour and a swallow on that world's `Biome` entry. World N's forward horizon
is composed at render time from world N+1's, and each profile is that world's
own impassable surround restated at horizon scale — column teeth, stepped
plateaus, random vertical pressure ridges, a uniformly leaning sawtooth with a
flip at the domain wall, a notched glow-veined ridge. `STYLE.md`'s "The
horizon" is the rule; `CODEMAP.md`'s "The mist band and the distant self" and
"Per-world horizon shapes" are the code.

Two things beyond the silhouette landed with it, because WORLDS.md §4 requires
distant selves a filled outline cannot state. A per-world **sky extra** on the
same entry carries the Storm Flats' arc-flashes (the resolved Edge Cliffs →
Storm Flats adjacency, both worlds being flat by identity) and the Entangled
Web's filament glints, which at swallow zero are its entire distant self. A
separate `OVERHEAD_SKIES` table carries motifs read from the world the player
is **standing in** rather than from its neighbour — the Iron Steppe's aurora.
The two answer different questions and are deliberately not one table. The
Storm Flats' own storm is in neither: it is an event that lands, drawn with the
terrain it strikes (`terrain/materials/charged.ts`).

Worlds 7, 8 and 10 are at swallow zero and show no silhouette; 7 still draws
its glints, which is why "no profile" and "no distant self" are not the same
thing.

## D — The pass, its guard and its board

The full grammar is `WORLDS.md` §4's "Gates as passes"; this is the work list.
The pass itself is **terrain and belongs to the retheme**, along with the
matching narrow mouth at each world's start and the wild-suppression zone. This
stage puts things in it and retires the panels.

Replace `art/door.ts`'s floating archway with:

- **Rival alive** — the rival stands in the pass and bars it. That is the state
  signal; the fogged notch is not needed, because the guard is the message. Haze
  inheritance stays off, and stage A's repeated road must not promise passage
  past it. Size it to the aperture, not the screen (§4) — no walkable gap
  showing from the approach tile, fully visible from the tile in front, no more.
- **Rival beaten** — the pass clears, the next world's palette shows through it,
  and a **board** in the pass names the destination. Plus a ground seam: the
  next world's walkable colour across the last two or three tiles.

**Both states share one interaction: approach, read, press.** A prompt appears a
tile out and the keypress commits — challenging the rival in the first state,
crossing in the second. **Arrival alone must never transition or start a fight**;
a pass is the most interesting thing in a world and players will walk in to look.
This is where the retired panels' confirmation goes, not a removal of it.

The board is world-space and depth-scaled (scenery); the prompt is HUD and obeys
every text preset (interface).

Four things this stage must handle rather than inherit:

- **`STORY_BEATS` fires on the confirm keypress** — the semantic descendant of
  the "Continue" click, displayed over the transition fade so it cannot stack
  against the board or the horizon reveal.
- **The goal-reached event.** The progression gate is reach-goal → beat-rival →
  continue, and the goal tile now sits behind the guard. Either move the trigger
  to the pass mouth or collapse the two events deliberately — not by accident.
- **`component-check` drives this gate by clicking the panels being retired**,
  and it carries a known gotcha about mistaking its own no-op click for a stuck
  panel, which a do-nothing pass tile will trip. Update it in the same change.
  Sweep the tutorial and docs for "click Continue" wording too.
- **Draw order.** The rival is currently drawn as a special case; confirm it
  joins the common depth sort before stage E's flanks share the pass with it.

The backward exit becomes a pass with a board too, in worlds 2–10. **World 1's
stays a door** (it leads to the Lab, which is not a place), and **World 10 gets
no board** (nothing lies beyond).

## E — Depth-projected flanks — deferred

**Recorded, not scheduled.** Stage D is a complete, shippable gate without this;
E is what would make the arrival cinematic rather than merely correct. It is
deferred by decision rather than blocked, so pick it up whenever the rest is
settled — nothing else depends on it.

The far part of a pass (the notch, the neighbour's silhouette) lives in the
fixed horizon band and is never reached — honest, because it is the next world's
interior, reached by loading it. The **near** part must not live there: the
horizon band sits at a fixed offset above a fixed horizon line and the
projection is asymptotic, so anything drawn in it is the same size forty tiles
out as on the goal tile, which is a painted backdrop.

So draw the flanking walls as depth-projected elements anchored at the goal row
and scaled through the same projection as everything else, so they grow, part
around the corridor and slide off screen as the player arrives. No elevation
geometry, no ground tilt — only scale.

This is the speculative one, and the risk is specific: on a flat plane a scaling
flank can read as a flat shape *expanding in front of* the player rather than a
wall passing beside them. Parallax is what sells it — the flanks must move
**outward** as they grow, or it looks like a zoom, which would be worse than
leaving it out. Try one world first and look at it before doing ten.

It also has a prerequisite inside stage D: the flanks, the rival and the board
all occupy the pass at different depths, and the rival is currently drawn as a
special case rather than through the common depth sort. Until that is fixed the
boss floats in front of walls it should be standing between.

## F — The Lab door, and the Qumatuomi sky

**The Lab** (`HubScene`, a static single-room scene with stations — room
dressing, not terrain):

- Its door is the aperture grammar **unbound** — it previews the *current*
  destination, by default the world and position the player left, updating live
  when the travel panel selects a different world.
- Its accent lighting is keyed to the player's current crystal.
- Everything else by absence: no window, no sky, nothing implying an outside.
  *Interior-without-outside*, not void — void belongs to the Entangled Web.
- Two signals total. It is a functional hub, not a diorama.

**The Qumatuomi sky** — World 10's horizon, reusing the existing
`art/qumatuomiMap.ts` asset:

- A reflection in a mirrored sky: foreshortened and tilted away, **not**
  screen-parallel; rippling faintly with the world's shimmer; silver-violet;
  dimmed and hazed by the same atmosphere that fogs everything else.
- The haze is load-bearing. Fog is what makes something read as scenery, and an
  interface element is never fogged. Rendered flat and unhazed this will read as
  a misrendered minimap and players will try to click it.
- Strip every interactive affordance inherited from the clickable panel version
  — no markers, no labels.
- Optional, faint, in this priority: a dim luminous trace of the player's actual
  route across the map; then a single slow pulse at the Espoo point, which is
  skippable if it reads even slightly like a readout.

---

## Verification

`tsc --noEmit` cannot see any of this.

- `npm run content-lint` and `npm run component-check` from `game/`, both, before
  any push. **Never** `npm run playthrough-check` unless explicitly asked in that
  session.
- Drive the game headlessly and look at it — the `run-game` skill carries this
  machine's Node-18 workaround, `verify-ui` covers driving it.
- **Screenshot the far edge of every world specifically**, since that is where
  stage A's bug lives and where C and D are judged. Also screenshot each world's
  forward horizon from mid-corridor, which is where the adjacency rule is
  checked — a transition that reads as hue-only is a failure even if both worlds
  look good alone.
- Gates need both states captured: rival alive and rival beaten.
- Get an independent visual opinion (a `model: "fable"` subagent) rather than
  self-assessing. The specific questions worth putting to it: does the land now
  read as continuous or merely as extended, does the Qumatuomi sky read as vista
  or as HUD, and do stage E's flanks read as an approach or as a mistake.

## Docs to keep in sync

Per `CLAUDE.md`, in the same change, written as current state and not as a change
log: `STYLE.md` (the horizon system and the adjacency rule are visual
conventions), `CODEMAP.md` (the new drawing paths and the distant-self asset
convention), and `WORLDS.md` §4 if anything is learned that contradicts it —
that file is binding, so a contradiction is raised and settled rather than
quietly diverged from. Delete this file when the work lands.
