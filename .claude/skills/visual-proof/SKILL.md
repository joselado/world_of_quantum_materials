---
name: visual-proof
description: Establish that a visual change to world_of_quantum_materials is real, using measurement rather than impression - seeded before/after comparison, pixel-diff with a sensitivity control, numeric readings, an independent read, and the greyscale legibility check. Use for any change to terrain, atmosphere, horizons, biomes, battle backdrops, or effects, and for any refactor claiming to preserve rendering. Not for panel layout or overflow (use verify-ui) and not for deciding what a world should look like (dev_notes/WORLDS.md and STYLE.md are the authority).
---

# Proving a visual change

This skill is about **evidence**, not taste. What each world should look like
lives in `dev_notes/WORLDS.md` (binding) and `dev_notes/STYLE.md`. This is how
you show that what you built matches it, and how to avoid the specific ways this
project has produced confident wrong answers before.

Pair it with `run-game` (launching, and this machine's Node-18 workaround) and
`verify-ui` (panels, overflow, text presets).

## Before anything: do not share `node_modules`

Give your worktree its own `npm install`. **Never symlink `game/node_modules` to
the main checkout.** Worktrees then share a Vite dependency-optimization cache,
and when any other session re-optimizes, your headless page is force-reloaded
mid-test. That produces failures that shift between runs and cannot be
reproduced by hand — "Execution context was destroyed", a Battle scene appearing
inside an Overworld test, scores like 43/50 then 47/50.

**If failures move between runs, suspect your harness before the game.** This
exact trap once caused a working feature to be reverted as broken.

## Pin the randomness before comparing anything

Map generation, rival rolls and idle animation phase are all random. A
before/after pair rendered without pinning them is **two different worlds**, and
any difference you measure is noise.

- Seed or stub `Math.random` immediately before each `scene.start`, and re-seed
  per capture so both sides see identical input.
- Freeze the animation clock, or capture at a fixed frame.
- Replay a recorded map state into both builds rather than generating twice.

A phantom "colour regression" was once escalated as the most serious finding in a
review because the harness regenerated the map on every render. Pin first.

## Match the claim to the evidence

**A refactor that claims to change nothing** → pixel-diff, and include a
**sensitivity control**: deliberately perturb one small value and confirm the
harness reports a difference. A zero-diff from a harness that cannot detect
change proves nothing. State per-world numbers.

**A change that should alter appearance** → numbers, not adjectives. Sample
along a column and report row-to-row deltas, luminance, contrast against the
neighbouring region. "Smoother" is unfalsifiable; "max step 33 → 8" is not.

**A claim about a *sequence*** (the worlds darken, the horizon inherits the next
world's air) → measure every world and show the trend, and say plainly where the
instrument is blind. Some real properties do not show up in the obvious metric.

## Get an independent read, and give it numbers

The builder is structurally the worst judge of its own visual work — this has
been demonstrated repeatedly here, in both directions. Spawn a reviewer subagent
(`model: "fable"` has been effective) and give it the screenshots.

- Hand it the **previous round's measurements** so it compares rather than
  re-eyeballs.
- Ask a question it can fail: *does the land read as continuous, or merely as
  extended?* beats *does this look good?*
- When you and the reviewer disagree about a **number**, settle that before
  either of you concludes anything from it — mismatched units and sampling
  windows have caused an apparent disagreement that was not real.

## The greyscale legibility check

For anything drawn behind gameplay — battle backdrops especially. Screenshot the
scene, shrink it, drain the colour: **the crystals and the HP bars must be the
first things a squint finds, in every world.**

`npm run greyscale-check` from `game/` (~2.5 min) is that check, run over all
ten arenas with a number per element per world and its own positive and
negative controls on every run — see `dev_notes/DEVELOPMENT.md`'s "Checking
arena legibility" for the metric, the thresholds and what it deliberately does
not cover. Read its per-element margins rather than only its verdict: a world
sitting at x1.2 over the gate is the one your next backdrop change will break.

This catches the failure a colour check waves through — an element surviving on
hue alone and vanishing in value, which is exactly what fog-coloured late worlds
produce. Backdrops hold a compressed mid-value range; gameplay owns the darkest
darks and brightest brights (`STYLE.md`).

## Sweep the whole set, not the convincing one

- **All ten worlds.** Per-world palettes mean a fix that lands in World 1 can
  miss World 5 entirely; that has happened.
- **Near camera and near horizon.** The projection compresses everything toward
  the horizon, so a half-tile error looks much larger up there. A fix that works
  near and fails far is a fail.
- **Both gate states** for anything touching gates or forward haze.
- **A walking sequence**, not just static frames, for anything that changes with
  distance — pop and crawl only appear in motion.

## Then the standard gates

`npm run content-lint` and `npm run component-check` from `game/`, both, before
reporting done. **Never** `npm run playthrough-check` unless explicitly asked in
that session. `tsc --noEmit` and `npm run build` clean.

Report the exact output rather than "checks pass", and say which commit you
measured — a number taken on your branch is not a claim about merged `master`.
