---
name: measure-smoothness
description: Find out why world_of_quantum_materials does not feel smooth, and prove that a performance change helped without changing the picture. Use when the owner reports lag, stutter or a low frame rate, before and after any change made for speed (terrain paint, vector drawing, audio scheduling, the display scale), and whenever a new per-frame effect is added. Carries two instruments (frame gaps while walking on the real GPU with the CPU slowed, and a frozen-frame pixel comparison of the vector layers against Phaser's own drawing) and the traps that gave wrong answers before. Not for panel layout (verify-ui) and not for whether a look is right (visual-proof).
---

# Measuring smoothness

The owner's rule, given on 2026-11-12: a game that feels smooth matters more
than fine graphics, so a small loss of detail is acceptable when it buys frame
rate, and a redesign of how the terrain is drawn can be considered. So far no
detail had to be given up: every gain came from drawing the same triangles
with less work.

Pair this with `run-game` (the dev server, the Node 18 workaround).
`dev_notes/DEVELOPMENT.md` describes the standing checks (`perf-check`,
`frame-cost`, "Checking the vector layers"); `dev_notes/STYLE.md`'s cost rule
says what a draw call costs. This skill is the procedure around them.

## Before measuring

- Measure on the real GPU. Headless Chrome uses a software WebGL by default,
  and on that the game picks its Canvas renderer and stays at display scale 1,
  which is a different game from the one a player runs. The scripts here pass
  the Vulkan flags that reach this machine's GPU and print the renderer on
  their first line. Read that line. "swiftshader" or "canvas" means the
  numbers are not about the player's game.
- Do not edit anything under `game/src` while a headless run is going. Vite
  reloads the page, `window.__game` disappears for a moment, and the run
  reports failures that are not real. This cost two false failures in
  `component-check` once.
- Do not measure while something else is heavy on the machine (a trailer
  capture, `component-check`, a build).
- Numbers taken with the CPU slowed drift from run to run with the machine's
  temperature. Compare a change as pairs taken minutes apart, alternating
  on, off, on, off. Do not compare against a number from an hour ago.

## The instruments

Both are in this skill's `scripts/` folder and need the dev server on 5173.

```
cd .claude/skills/measure-smoothness/scripts
node walk-gaps.mjs ow1 ow2 ow10 ow10goal bt6r          # this machine's speed
THROTTLE=6 node walk-gaps.mjs ow1 ow10 ow10             # a CPU six times slower
THROTTLE=6 QUERY=scale=1 node walk-gaps.mjs ow1         # is the display scale the cost?
THROTTLE=6 QUERY=vectors=phaser node walk-gaps.mjs ow1  # Phaser's own drawing, as a reference
OBJECTS=1 node walk-gaps.mjs ow10goal                   # which object costs the frame
node frozen-ab.mjs title hub ow1 ow2mid ow10goal ow1panel bt1 bt6r
```

`walk-gaps.mjs` holds the up arrow in an overworld (`ow<N>`) and stands still
elsewhere, and prints the gaps between shown frames: median, p95, p99, max and
how many were over 20, 34 and 50 ms. `ow<N>goal` stands a few tiles before the
end of the world, where the rival and the horizon are in view. Naming a world
twice walks a second, different map of it, which often reaches further.
`OBJECTS=1` times every object's own render call and lists the costliest.

`frozen-ab.mjs` draws one frozen frame per scene with the vector layers on,
then with the cache off and every `FastGraphics` swapped for a plain Graphics,
and compares the two frames pixel by pixel. It exits 1 when a scene differs by
more than `ALLOW` pixels (2 by default) or when its control fails. The control
moves one object by one pixel and requires the comparison to see it.

Three other tools exist. `npm run perf-check` counts draw calls per world
against a budget and looks for leaked tweens; it measures work, not time, so
it is stable, and it must pass after any terrain change. `npm run frame-cost`
times every scene standing still (`QM_FRAME_THROTTLE=4` slows the CPU,
`QM_FRAME_MODES=canvas` measures the Canvas renderer; its `gpu` mode needs
`QM_FRAME_GPU_ARGS="--use-angle=vulkan --enable-features=Vulkan --enable-gpu --ignore-gpu-blocklist"`
on this machine, where the default GL backend gives no WebGL context). For where the time goes
inside a frame, take a CDP `Profiler` sample over the slow window and sum the
inclusive time by function.

## Which kind of slow it is

- The display scale, a GPU limit. `QUERY=scale=1` makes it go away. The
  governor in `art/displayScale.ts` is meant to catch this by itself.
- Frame work on the CPU. It shows with `THROTTLE=4` or `6`, and `scale=1`
  changes nothing. Two places carry it: the overworld while walking, whose
  terrain is rebuilt on every frame the camera moves, and wherever animated
  guardian avatars stand, which is the Lab (about 43 fps at x6 with all ten
  met, on 2026-11-12) and the middle of a world. Battles hold 60 fps at x6.
  World 10 is the heaviest world to walk, at 45 to 53 fps at x6.
- No GPU at all. A browser with no usable GPU (a blocklisted driver, a
  remote desktop, hardware acceleration switched off) gives the game a
  software WebGL, and the game then takes its Canvas renderer. None of the
  WebGL work applies there: the vector cache and the fast layer stand down,
  and every path is walked and filled on the CPU each frame. Measured with
  `QM_FRAME_MODES=canvas npm run frame-cost` on 2026-11-12: the overworld
  standing still is 53 fps at this CPU's speed and 14 fps at x4, where the
  Lab holds 60. Ask which renderer the owner's machine uses
  (`chrome://gpu`, or the first line `walk-gaps.mjs` prints on it) before
  concluding that a WebGL gain reaches them.
- A single stall. Building a guardian's panel (about half a second at x6,
  mostly text), a change of display scale (it re-rasterizes every `Text`), a
  scene start. These are one long gap, not a low frame rate.
- The audio thread. Scheduled notes that are not yet sounding still cost it.
  Measure it per thread (`/proc/<pid>/task/*/stat`), not from the frame rate.

Ask the owner where the lag was felt (walking, a battle, opening a panel)
before optimizing: the three have different causes.

## Reading the numbers

- A gap is what a player sees. A "busy stretch" in a CPU profile is not: at a
  slowdown every frame runs into the next, and the profile shows 300 ms of
  work where the screen shows steady 33 ms frames. This was read as a stall
  once.
- Gaps come in steps of the display's refresh: 17, 33, 50 ms at 60 Hz.
- An unmet guardian opens its panel when the player reaches the middle of a
  world. The scripts mark every guardian as met; a script of your own must do
  the same or it measures a panel being built.
- A slow stretch that is equally slow with `vectors=phaser` is not caused by
  the vector layers.

## Where the cost has been found

- Art cleared and drawn again every frame in a plain Graphics is tessellated
  twice a frame. Use `addFastGraphics(scene)` (`art/fastGraphics.ts`). The
  terrain and World 10's reflection are drawn this way. `OBJECTS=1` shows such
  an object as a Graphics with thousands of commands and milliseconds a frame.
- `fillCircle` is a hundred segments whatever the radius. In anything drawn
  per frame use `fillDot` or `fillOval` from `art/shapes.ts`.
- A stroked `arc` is a hundred points however short it is. Noether's avatar,
  rings broken into 120 dashes a cell, was about 250 000 vertices and 9 ms a
  frame at full CPU speed, in the Lab and beside her in world 1. Use
  `strokeArc` from `art/shapes.ts`. Art that large also fits no batch, so
  measure the Lab and each world's middle with every guardian met: a Lab
  with no guardians in it hides this.
- Art drawn once needs nothing: `art/graphicsCache.ts` keeps its triangles,
  up to 262 144 vertices an object. What still costs is its vertex count and,
  for large translucent stacks, the fill (bake those, see `STYLE.md`).
- Music scheduled a whole loop ahead (about 565 oscillators waiting) took half
  a core of the audio thread. `audio/music.ts` schedules a 2.5 s window.
- A display-scale trial on every scene change. The governor keeps its verdict
  per scene for the session.

## A change that claims to keep the picture

Run `frozen-ab.mjs` over a title, the Lab, three overworld spots, an open
panel and both kinds of battle, at `SCALE=2` and `SCALE=3`. Zero differing
pixels is the expected result. One pixel on the edge of a moving object in an
occasional battle frame is the cache's rounding and is allowed; more is a
defect. A change that is meant to alter the art (fewer segments on a circle)
is judged by eye at 3x on top of that, and the difference is reported as a
fraction of pixels.

## Gates before reporting

`npx tsc --noEmit -p .`, `npm run content-lint`, `npm run component-check`,
`npm run perf-check`, `npm run build` and `npm run bundle`, all from `game/`.
Then open `game/dist/world_of_quantum_materials.html` once and walk a world:
the production build has no `window.__game`, so it is driven with real keys
and clicks, and it is the build players get. Never `playthrough-check` unless
asked in that session.

## What to say in the report

Frame rates and gap counts as before and after pairs, with the slowdown
factor. What was not measured: another GPU, a phone, a headed browser. A CPU
slowed by Chrome is not a slow GPU, so say that the display scale's cost was
measured at this GPU's speed only.
