# Build task — world continuity, horizons and gates

Work list for making the overworld continuous to the horizon and turning the
world-to-world connections into geography. The spec is `WORLDS.md` §4, which is
the authority; this file is the checklist. Delete it once the work has landed.

**Ordering against the retheme.** Stages A and B are independent of
`WORLDS_BUILD_TASK.md` and are built — they fix a live complaint and touch none
of the theming. Stages C–F depend on the retheme, because a world's distant
self *is* its impassable surround restated at horizon scale, and those surrounds
do not exist until the retheme builds them. Do not author distant selves against
the current biomes; they will be thrown away.

---

## The staging

Build in this order. Each stage is shippable on its own.

| Stage | What | Depends on | Status |
|---|---|---|---|
| **A** | Depth continuity — land reaches the horizon | nothing | **built** |
| **B** | Haze inheritance — the air ahead becomes the next world's air | A | **built** |
| **C** | Distant selves — per-world horizon profiles, composed into neighbours | retheme, A | composition + atmosphere **built**; profiles to do |
| **D** | Gate apertures — state-signalled pass, ground seam | C | to do |
| **E** | Depth-projected flanks — the approach into the pass | D | to do |
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

## B — Haze inheritance — built

`hazeTarget`/`forwardHazeBlend` carry every haze in the scene toward the next
world's fog colour as the player nears the goal row (`CODEMAP.md`'s "Forward
haze inheritance").

**Gated on gate state: a shut gate means no forward palette bleed.** The gate
input is `isRivalDefeated()` until stage D builds the aperture itself; when it
does, that is the single call to re-point.

## C — Distant selves

One asset per world: a silhouette profile plus a base colour and a swallow.
**Not two.** A world's forward horizon is composed at render time from its
neighbour's distant self; the same asset is what that world wears on its own
horizon. If B and C are implemented as separate assets they will drift.

The composition system, the atmosphere the silhouette is drowned in, and the
swallow knob are built (`scenes/overworld/sky.ts`'s `drawDistantSelf`,
`art/biomes.ts`'s `hillColor`/`hillAlpha`). What is left is the **shape**: the
profile is still the two-sine placeholder shared by every world, which gives
every world the same hills in a different colour — a standing violation of the
theming independent of this task. Author per-world profiles against the retheme
and hand them to `silhouetteHeight`.

Requirements from `WORLDS.md` §4:

- A distant self is **that world's impassable surround at horizon scale**, not a
  hill variation. Column teeth, leaning shard rows, a cracked glow-veined ridge.
- **No backward variants.** The camera never turns. The arrival beat is obtained
  instead by bleeding the previous world's ground palette into the first few
  margin rows on entry.
- **The Entangled Web** has no surround; its distant self is an absence with
  structure — the sky ending, thin white-gold filament glints in blackness.
- **The Devouring Mirror's horizon is the Qumatuomi sky** (stage F), not a
  silhouette. An earlier draft of the spec said its horizon should be itself;
  that is superseded and must not also be built.
- **The adjacency rule applies**: adjacent distant selves must differ in
  shape-language or sky-activity, never in hue alone. Two pairs are already
  resolved in the spec and their resolutions are requirements, not suggestions —
  the Storm Flats' arc-flashes (because Edge Cliffs → Storm Flats cannot differ
  on shape, both being flat by locked identity), and the Iron Steppe's uniform
  ~30° lean with a flip at one point (the domain wall) against the glacier's
  random vertical ridges.

A new profile inherits the whole atmosphere contract already in place and must
not fight it: shape and base colour only, no baked fog, and a swallow that keeps
the band inside its value budget or goes to zero. `STYLE.md`'s "The horizon" is
the rule; `CODEMAP.md`'s "The mist band and the distant self" is the code.

Worlds 7, 8 and 10 are already at swallow zero and stay there — their horizons
are meant to be empty, so they need no profile.

## D — Gate apertures

Replace `art/door.ts`'s floating archway with the corridor narrowing into a
pass, the destination visible through the gap.

The gate's job is **state, not wayfinding** — a corridor has nowhere else to
walk, but the goal gate exists only once that world's rival is beaten. So:

- **Rival unbeaten** — notch fogged shut, opaque, dark. Next world not visible,
  haze inheritance off, and the repeated road from stage A vanishes into the
  fog rather than promising passage.
- **Rival beaten** — notch clears, the next world's palette showing through the
  gap as the brightest thing on screen (or in late worlds, the most
  wrongly-coloured).

Plus a ground seam: the next world's walkable colour across the last two or
three tiles, a boundary the player visibly steps over.

**Keep the confirm panel.** Geography plus confirmation prevents accidental
transitions, and it is the safety net if any one world's pass reads weakly.
Note the door sprite currently also stands at the *start* tile (back to world
N−1, or the Hub from World 1) — that instance needs its own treatment, not just
the goal-tile one.

## E — Depth-projected flanks

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

This is the speculative one. Try one world first and look at it before doing ten.

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
