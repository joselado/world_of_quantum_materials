# Build task — World 10's reflections

Make the Devouring Mirror's impassable terrain render increasingly defined copies
of the player's own crystal. The design is settled and lives in `WORLDS.md` §2
(World 10) and §5; this file is the implementation plan. Delete it once the work
has landed.

---

## Blocked, and on what

**The host file does not exist on `master`.** World 10's `consuming` off-path
material is created by the retheme, which is unmerged — and that branch is being
actively committed to by the follow-up agent doing the horizon height, World 4's
lightning and World 5's vortices. Branching off a moving base is worse than
sharing a file, so **wait for that work to land and merge, then start.**

The overlap is direct rather than incidental: that work owns
`terrain/materials/*`, may change `terrain/plan.ts`'s per-tile classification to
fix the vortex cores, and touches the whole paint and projection path via the
horizon change — which alters how much ground is on screen, and the ground is the
surface these are drawn into. There is no useful independent slice; even the lag
mechanism needs player-position history in `OverworldScene`, which the horizon
work routes through.

## What to build

### Where it lives

World 10's off-path material module (`terrain/materials/consuming.ts`), behind
the existing dispatcher. One file — which is what the terrain extraction was for,
so this should not become surgery on the scene.

### What gets drawn

A **simplified reflection shape** derived from the player's current crystal —
faceted, flat, no internal detail — **not a full crystal instance per tile.** The
horizon work measured a real frame-time cost on this path, so the reflections
need a stated budget: how many are visible at once, and how cheap each one is.
Say what you chose and what it costs.

### What drives the gradient

**Definition is a function of distance to the goal.** The paint pass already has
the tile's grid position and the goal row, so this is one derived value feeding
shape fidelity, edge softness and colour accuracy together.

**It never reaches 1.** The terrain asymptotes and only the boss converges — see
the reasoning in `WORLDS.md` §2, which is not decoration: the Adapted must remain
the only perfect copy in the world, a still-training model genuinely does sample
at varying fidelity, and almost-you is more frightening than exactly-you.

### What makes it read as a reflection rather than a character

The rule is **surface phenomena versus ground phenomena** — a copy standing *on*
the terrain is a second character; a copy visible *in* it is a reflection.

- Clipped inside the surround's facets, under the world's sheen, tinted toward
  silver-violet.
- **No ground contact and no cast shadow.**
- **Lag mimicry**: a short ring buffer of the player's recent positions, with
  reflections sampling from behind it. Mimicry-with-delay is the one behaviour
  every player instantly reads as a reflection, and it cannot be mistaken for an
  NPC because it has no volition. **The lag shortens as definition rises and
  never reaches zero** — zero lag, full definition and unison all belong to the
  fight alone.
- **Never interactable**: no prompt, and clicks fall through. Per the pointer
  parity rule, they are world rather than object.

### What it must never do

Resolve completely, outshine the player's own crystal, or acquire volition.

## Sequencing against the other queued work

Best done **before or alongside `HORIZON_BUILD_TASK.md` stage D**, since the pass
is where definition peaks and the boss must stay the only perfect copy. If stage
D lands first, the two need to agree about what the approach to the gate looks
like.

Also check `WORLDS.md` §5's **recognition seed** while here: the crystalline
fragments of the player's material in World 8 or 9 must stay **crude** — raw,
unshaped, mineral. *Ore, then portrait.* If they get polished, they become early
reflections and World 10 reads as more of the same rather than as a reveal.

## Verification

- **The gradient is the deliverable, so a single frame proves nothing.** Capture
  World 10 at several distances from the goal and show definition rising.
- Confirm the player's actual crystal still owns the highest contrast and
  saturation on screen, with reflections inside the backdrop's compressed band.
- Confirm reflections take no clicks and raise no prompt.
- Read the **`visual-proof`** skill first — pin randomness before any comparison,
  and give an independent reviewer the numbers rather than asking it to
  re-eyeball.
- `npm run content-lint`, `npm run component-check` (baseline **53/53**),
  `npm run art-sweep`, `tsc --noEmit` and `npm run build` clean. **Never**
  `npm run playthrough-check`.
- Give the worktree its own `npm install`; do not symlink `game/node_modules`.

## Docs

Per `CLAUDE.md`, in the same change and as current state: `CODEMAP.md` for the
new drawing path and the position-history buffer, and `STYLE.md` if the
surface-versus-ground rule belongs there as a general convention rather than a
World 10 detail. `WORLDS.md` already carries the design and should need no edit —
if it does, that is a contradiction to raise rather than to quietly fix.
