# Build task — the battle arena

Bring the battle environment up to the overworld's level. Delete this file once
the work has landed.

**Ordering:** after the retheme (`WORLDS_BUILD_TASK.md`), because the whole point
is that the arena quotes the world's terrain vocabulary and that vocabulary does
not exist until the retheme builds it. Safe to run **in parallel with
`HORIZON_BUILD_TASK.md` stage D** — that lives in the overworld's pass and door,
this lives in `BattleScene` and `scenes/battle/`. The one shared file to watch is
`art/biomes.ts`.

---

## The governing principle: reuse, don't re-author

The arena is not short of ideas — it already draws a sky gradient, a horizon
glow tinted off the biome's fog colour, clouds, and four stacked parallax
ridgeline layers. The problem is that **every one of those is a parallel
implementation of something the overworld now does properly**, and the two have
drifted.

So this is mostly a conversion job: replace the arena's private versions with
calls into the modules the overworld already uses. That is cheaper than what is
there now, and it means the two views cannot drift again. **Aim for a reasonably
good result through reuse rather than a bespoke arena** — anything that needs new
art should be questioned first.

**The arena is the same world seen at ground level.** That one sentence decides
most of the open questions below.

## What to reuse

| Arena element | Reuse | Instead of |
|---|---|---|
| ridgelines | that world's **distant self** (`sky.ts`'s silhouette + `art/biomes.ts`'s `hillColor`) | four generic curves, identical in all ten worlds |
| sky and fog | `sky.ts`'s `hazeTarget` / `fillVerticalFade` / the horizon band | the arena's own "horizon glow" blend |
| ground | the world's own walkable and off-path materials (`scenes/overworld/terrain/materials/`) | a plain field |
| crystal lighting | the additive halo `art/boss.ts` and `art/door.ts` already use | nothing |

The distant self is the highest-value reuse: one authored asset would then serve
three jobs — a world's own horizon, its neighbour's forward horizon, and its
battle ridgeline.

## Resolve a stopgap while you are here

`BattleScene`'s near ridgeline was deliberately **decoupled** from `hillAlpha`
during the horizon work, because zeroing the Entangled Web, the Splitting Hollow
and the Devouring Mirror for the horizon would otherwise have silently deleted
their *battle* ridgelines. That decoupling is a holding fix with a flat value.

Give it a real answer here. The likely one is that those three worlds genuinely
should not have a conventional ridgeline behind a fight either — a world whose
identity is "no horizon" should not grow one indoors.

## The light rule applies in here too

`WORLDS.md` §1: after World 7 the sun never returns, and all later light is
**emitted by the world itself**. The arena currently draws a sky in every world.
Worlds 8–10 should not have one.

## Crystal lighting — the legibility guarantee

This is what lets the backdrop get richer safely, so build it first and judge
everything else against it.

- **It is a contrast device, not a glow.** What guarantees a crystal reads is
  local contrast against whatever is behind it — a light halo in dark worlds, a
  subtle darkening in bright ones. Derive its strength and sign from the local
  backdrop value rather than fixing it per world, or it will wash out over World
  1's morning sky exactly where it is least needed and most obviously wrong.
- **Its overall strength follows the light rule**, which makes it a story beat
  rather than a UI patch: in the early worlds the sun does the work and a
  glowing crystal would look wrong; by the late worlds the crystal is one of the
  few things still emitting light, and by World 10 it may be the only one in
  frame. The player begins as something the world lights and ends as one of the
  last things lighting it. Derive the arc from the light rule so it cannot drift.
- **Soft falloff, slightly ground-hugging**, not a clean circle — a hard disc
  reads as a sticker behind the sprite.
- **It must agree with the contact shadow** about where the ground and the light
  are. A body-centred glow plus a foot shadow that disagree is worse than either
  alone.

## The test

Not "does it look better in a screenshot." The battle screen carries HP bars, a
move menu, turn-order icons and two crystals that must read instantly.

**Do the crystals still pop, at every text-size preset, in all ten worlds, in
both the player's and the opponent's positions?** A richer backdrop that costs a
frame of "where am I" is a regression, however handsome.

## Verification

- `npm run content-lint` and `npm run component-check` from `game/`, both.
  Baseline is **53/53**. **Never** `npm run playthrough-check`. `tsc --noEmit`
  and `npm run build` clean.
- Give the worktree its own `npm install` — symlinking `node_modules` shares a
  Vite dep-optimization cache between sessions and produces phantom test
  failures that look like real bugs.
- `run-game` carries this machine's Node-18 workaround (system Node is 18, so
  Playwright and the `puppeteer` CLI both fail — use `puppeteer-core` against the
  cached Chrome-for-Testing binary). Note the `verify-ui` skill's font-scale
  instruction is stale: saves are per-mode now, so writing the old localStorage
  key silently does nothing — set `fontScale` on the registry instead.
- Screenshot **all ten worlds' arenas**, and put them beside the same world's
  overworld shot: the two should read as one place, which is the whole point.
- An independent read is worth it here, since the failure mode is
  over-decoration and the builder is the worst judge of that.

## Docs

Per `CLAUDE.md`, in the same change, as current state: `STYLE.md` (the arena's
relationship to the overworld, the crystal-lighting rule), `CODEMAP.md` (what
`BattleScene` now consumes from `scenes/overworld/` and `sky.ts`).
