# Build task — the battle arena

Bring the battle environment up to the overworld's level. Delete this file once
the work has landed.

**Ordering:** after the retheme (`WORLDS_BUILD_TASK.md`), because the arena
quotes the world's terrain vocabulary and that vocabulary does not exist until
the retheme builds it. Safe to run **in parallel with `HORIZON_BUILD_TASK.md`
stage D** — that lives in the overworld's pass and door, this lives in
`BattleScene` and `scenes/battle/`. The shared file to watch is `art/biomes.ts`.

---

## The diagnosis

The arena is not short of ideas. It draws a sky gradient from the biome, a
horizon glow tinted off the biome's fog colour, optional clouds, and four
stacked parallax ridgeline layers. **The problem is that each is a private
implementation of something the overworld now does properly**, and the two have
drifted — the ridgelines are generic curves identical in all ten worlds, wearing
`hillColor` with a code comment admitting the alpha "means nothing here."

So this is a conversion job, not an art job. But conversion has one precision
cut in it, below, without which it becomes "zoom the tiles" and the original
complaint survives the fix.

## What travels, and what does not

The overworld's stack has two layers and **only one of them belongs in here**.

- **The projection layer** — the asymptotic horizon, per-row depth fog,
  `projectTile` — is corridor-only. The arena has no depth axis and no camera.
  Piping a static stage through road math is over-unification; don't.
- **The composition layer** — the biome table, the sky gradient, the fog-blend
  colour pipeline, silhouettes hazed at render, the swallow parameter, the light
  rule — is depth-free, and is exactly what the arena should consume.

The arena imports the atmosphere's **palette pipeline** and the **distant-self
assets**, never the projection. That is the honest form of "the same world seen
at ground level": same data, same rules, different lens.

## What to reuse

| Arena element | Reuse | Instead of |
|---|---|---|
| ridgelines | that world's **distant self** | four generic curves, identical in all ten worlds |
| sky and fog | the composition layer's colour pipeline | the arena's private horizon glow |
| ground | the terrain materials' **definitions** — see below | a plain field |
| crystal lighting | the additive-halo idea from `art/boss.ts` / `art/door.ts`, reworked per §"Crystal lighting" | nothing |

A distant self is **shape plus base colour**; scale is the renderer's business,
so the arena draws it at whatever size it wants. One authored silhouette then
genuinely serves three jobs — a world's own horizon, its neighbour's forward
horizon, and its battle ridgeline.

**The ground is the one place the near view earns its own treatment.** The
terrain materials are authored at tile scale; blown up to arena close-up they
read as enlarged pixels rather than as ground. Reuse the material *definitions* —
palette, motif, the iron-sand ripple, the mosaic pattern — and give the arena its
own close-up drawing pass over them.

## Delete rather than replace

Remove all four generic ridgeline layers and the private horizon glow outright,
so the fork cannot quietly reopen. If losing four parallax layers leaves the
idle backdrop too still, **layer the distant self at two depths** (far and faint,
nearer and less faint) rather than resurrecting generic curves: the same asset
twice beats the wrong asset four times.

## Two rules the arena has been ignoring

**The light rule applies in here.** After World 7 the sun never returns and all
later light is emitted by the world itself — but the arena draws a sky in every
world. Worlds 8–10 should not have one. World 9 fighting under light that comes
from *below* is the light rule doing its best work.

**The stopgap dies here.** The near ridgeline's alpha was decoupled from
`hillAlpha` during the horizon work, so that zeroing the Entangled Web, the
Splitting Hollow and the Devouring Mirror would not silently delete their battle
ridgelines. That fear mistakes absence for emptiness: the Web's battle backdrop
is void and filaments, the Hollow's is fog, the Mirror's is shimmer. Those are
fully specified by the distant-self data model plus the light rule, and they are
better stages than a borrowed ridge.

## Crystal lighting — the legibility guarantee

Build this first and judge everything else against it.

**It is a contrast device, not a glow.** What guarantees a crystal reads is local
contrast against what is behind it: a light halo in dark worlds, a subtle
*darkening* in bright ones. A fixed additive glow dies against World 1's morning
sky, which is not a taste question.

**The story beat is free, because it is the same mechanism.** Apply that
inversion across a sequence whose worlds darken and the arc emerges by itself —
early worlds darken locally because the world lights the crystal, late worlds
glow because the crystal lights the world. The player begins as something the
world lights and ends as one of the last things lighting it, at zero extra
machinery and with no risk to legibility, because it *is* the legibility
mechanism seen from the fiction's side.

Two implementation pins:

- **Bake it, don't sample it.** The arena backdrop is static per world, so
  strength and sign are two numbers per biome in the table — authored once,
  reviewable at a glance. Runtime sampling is over-thought for a scene that does
  not change.
- **Do not draw a circle around a creature.** A ring of light around a combatant
  is RPG vocabulary for a *status effect*: players will read it as a buff, and it
  will collide with battle VFX. Make it read as stage lighting instead — a soft
  pool on the ground beneath each crystal plus gentle rim contrast on the sprite,
  **absolutely constant for the whole fight**: never pulsing, never appearing or
  vanishing. Static light reads as lighting; animated light reads as magic.
  `boss.ts` and `door.ts` get away with halos because landmarks are never the
  targets of status effects. Combatants are.

## The discipline against over-decoration

Not "check the crystals still pop" — that is a vibe. The rule is **value
zoning**: the backdrop lives in a compressed mid-value range with low internal
contrast, and **the darkest darks and brightest brights on screen belong to
gameplay** — the crystals, the HP bars, the move menu — in every world, no
exceptions.

The colour pipeline being imported is the enforcement mechanism for free: run
the whole backdrop through one stage of the arena's atmosphere blend — the air of
the place — and it is unified with the overworld *and* pushed below gameplay
contrast in one move. Saturation splits the same way: the backdrop is desaturated
relative to the two crystals, which should be the most chromatic things present.

**Motion discipline**: backdrop idle motion stays slow, small and dimmer than any
battle animation, and **nothing back there animates during move resolution** —
the frame where a move lands belongs entirely to the move.

## The test

**A greyscale thumbnail pass.** Screenshot every world's arena, shrink it, drain
the colour: the two crystals and the HP bars must be the first four things a
squint finds, in all ten worlds. It catches the specific failure a colour check
waves through — a crystal that survives on hue alone and vanishes in value,
which is exactly what fog-coloured late worlds will produce.

`npm run greyscale-check` from `game/` is that pass, measured rather than
eyeballed: a salience number per element per world against a threshold, with a
sabotaged-frame control on every run (`dev_notes/DEVELOPMENT.md`, "Checking
arena legibility"). Today's plain arenas all clear it, so run it before
starting and keep that table: it is the before half of a real before/after.
Where an arena's margin sits matters more than its verdict — the tightest
before the rebuild is World 3's player HP bar at x1.17 over the gate, and
World 10's at x1.38.

Also put each arena beside the same world's overworld shot: the two should read
as one place.

## Verification

- `npm run content-lint` and `npm run component-check` from `game/`, both.
  Baseline is **53/53**. **Never** `npm run playthrough-check`. `tsc --noEmit`
  and `npm run build` clean.
- Give the worktree its own `npm install` — symlinking `node_modules` shares a
  Vite dep-optimization cache between sessions and produces phantom failures that
  look like real bugs.
- `run-game` carries this machine's Node-18 workaround (system Node is 18, so
  Playwright and the `puppeteer` CLI both fail — use `puppeteer-core` against the
  cached Chrome-for-Testing binary). Note the `verify-ui` skill's font-scale
  instruction is stale: saves are per-mode now, so writing the old localStorage
  key silently does nothing — set `fontScale` on the registry instead.
- An independent read is worth it, since the failure mode is over-decoration and
  the builder is the worst judge of that.

## Docs

Per `CLAUDE.md`, in the same change, as current state: `STYLE.md` (the arena's
relationship to the overworld, value zoning, the crystal-lighting rule),
`CODEMAP.md` (what `BattleScene` consumes from the shared modules).

And record the lesson, because the next fork will not announce itself either.
The arena drifted for an innocent reason: someone needed a battle backdrop and
the corridor code did not quite fit. The durable rule belongs in `CODEMAP.md`:
**no scene reimplements atmosphere or biome visuals; scenes consume the shared
modules or extend them in place.**
