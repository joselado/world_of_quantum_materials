# Build task — final-version polish

Work list for the remaining polish between the current build and a final
version. The game is playable end to end (`DESIGN.md` §9); everything here is
either a defect, a decision only the owner can make, or a promise a doc makes
that the code does not yet keep.

Items are grouped by what unblocks them, not by size. The three at the top of
"Decisions" gate a final version more than any amount of code does: a binding
spec conflict cannot ship unresolved in either direction, and a doc that
promises a feature the build does not have is a defect in the doc or in the
build, never in neither.

---

## Status at a glance

| # | Item | Kind | Status |
|---|---|---|---|
| **0** | **Rival taunt panel overflows; run cannot continue** | **blocker** | **open** |
| 1 | The Adapted renders pure white | defect | **fixed, unseen** |
| 2 | World 9's rival renders pure white | defect | **fixed, unseen** |
| 3 | Boss shown as an ordinary crystal in the TURNS row | defect | **fixed, unseen** |
| 4 | Music light rule violated in Worlds 8 and 9 | decision | **open** |
| 5 | Bespoke per-world boss puzzles | decision | **open** |
| 6 | `DESIGN.md` §10's ten open design questions | decision | **open** |
| 7 | B.Sc. difficulty multiplier and its stale comment | decision | **open** |
| 8 | Feynman panel level-up preview | feature | **spec'd, not started** |
| 9 | Lab Moves panel rework | feature | **spec'd, not started** |
| 10 | Pass flanks (Horizon stage E) | deferred | **reconfirm or close** |
| 11 | Progress-keyed Lab/Title theme | deferred | **reconfirm or close** |
| 12 | Doc screenshots show a stale Bloch panel | defect | **open** |
| 13 | `assertLoopBeats` does not throw | verification | **open** |
| 14 | Playtesting with students | process | **open** |
| 15 | Quiz subscript notation | deferred | **open** |
| 16 | Quiz-fetch functions not reconciled | cleanup | **open** |
| 17 | Crystal habits still to reconcile with lattice | physics | **open** |
| 18 | Subtype combination table | design | **open** |
| 19 | Opponent debuffs unimplemented | design | **open** |

---

## Defects

### 0. Rival taunt panel overflows the canvas — the run cannot continue

**Fix this first.** Reported from play: the boss dialogue does not fit on screen
and there is no way to move forward. That makes it the only item here that ends
a playthrough rather than blemishing one — a player who cannot dismiss the taunt
cannot reach the battle, so the world is unfinishable.

`renderRivalTauntPage` (`game/src/scenes/OverworldScene.ts`, ~line 2455) stacks a
fixed-height boss silhouette above wrapped taunt text above the advance button,
growing downward from a fixed top. Its own comments claim the overflow is already
handled: the text and button font scales are capped at `Math.min(fontScale, 1.5)`
specifically because "the longer taunts (worlds 9/10) are long enough that the
Settings panel's 2x Large preset would push this text past the fixed `CANVAS_H`
once added to the crystal's own fixed headroom above." The report says that cap is
not enough, so the comment describes an intent the code does not achieve.

The button is the part that must never leave the canvas — the text merely reading
badly is survivable, being unable to press Next/Battle! is not.

Likely contributors, in the order worth checking:
- The crystal's headroom is fixed (`BOSS_CRYSTAL_SIZE × BOSS_SILHOUETTE_TOP/BOTTOM`)
  and does not shrink when the text grows, so it spends the same vertical budget
  at every preset.
- The longest taunts (worlds 9 and 10) at the largest text preset are the stated
  worst case and the first thing to reproduce.
- The 1.5 cap bounds the font but not the resulting wrapped *height*, which is
  what actually overflows.

Worth fixing structurally rather than by shaving constants: measure the stack and
shrink or scroll it to fit, the way Bloch's panel drives its own shrink loop off
measured text height. A reproduction at every preset × every world belongs in the
verification, since this class of bug is exactly what `verify-ui` exists for and
it reached a player anyway.

### 1–3. Boss rendering

`shade()` (`game/src/art/colors.ts:3`) calls Phaser's `Color.brighten()`, which
adds `255 × amount / 100` to every channel. Any amount much above 100 therefore
clamps to 255 and the crystal renders pure white. **Fixed**, but the trap
remains for any future `shade()` call site: the amount is not a multiplier.

- **The Adapted** — `WORLD_RIVALS[10]` (`game/src/data/materials.ts`) asks for
  `shade(0x333333, 216)`. The entry's own comment describes a "featureless dark
  prism," which is not what the player sees.
- **World 9's rival** — `rivalImpurityResonance()` passes shadeStep 11, and
  `crystal()` computes `shade(look.color, 11 * 18)` = 198%. Harder than World 10
  because its type is rolled per visit and cached as `rival9Type`, so the colour
  has to keep reading as the rolled phase rather than take one literal.
  Worlds 1–8 set their colours explicitly via `colorOverride`; extend that.
- **TURNS row** — `game/src/scenes/battle/hud.ts:302` builds every turn-order
  icon with `makeCrystal` for both sides, while the arena
  (`BattleScene.ts:428-432`) correctly picks `makeBossCrystal` for a rival
  fight. The boss therefore appears as an ordinary crystal in the turn row of
  the same battle it stands as a golem in. Open sub-question: whether the boss
  art stays legible at `TURN_PREVIEW_ICON_SIZE` or needs a simplified
  silhouette.

**All three fixes are in the tree but were never seen.** They typecheck and pass
`content-lint`; no screenshot was taken of any of them. Still to confirm by eye:
The Adapted's dark prism at `0x4a4a4a`; the seven World 9 rival colours
(`TYPE_LOOK[type]` blended halfway to `RIVAL_9_TARNISH`); `makeBossIcon`'s
legibility at 32px, which is the riskiest — if it reads as mush, raising its `k`
toward `size * 0.56` is the first thing to try; and whether the turn row follows
The Adapted's mid-battle transmutes.

**Constraint for any `WORLD_RIVALS` edit** (documented at `materials.ts`'s own
rivals-table comment): that object literal is walked as literal AST nodes by
`scripts/content-lint.mjs` and `scripts/gen-docs.mjs`, which parse rather than
execute the file. Their literal-reducer handles string/number/boolean literals,
arrays, object literals, and calls built from those — not a unary minus (hence
the `darken(c, n)` helper) and not a property access (hence raw hex literals
instead of `TYPE_LOOK[type].color`).

### 11b. Story station loose ends

- The premise chapter reuses the Lab welcome tip verbatim, so it ends on
  "Qumatex catalogs every crystal… progress autosaves" — mechanics copy inside a
  story reading. Splitting the narrative half from the orientation half is the
  fix, and touches a shared string.
- A pass chapter unlocks on the rival win, although the player meets its goal
  line and taunt slightly earlier; nothing persists that moment.
- `STYLE.md`'s Settings section says "Three rows"; the panel has four.
  Pre-existing drift, unrelated to the station.
- The Story station's own doc edits were hand-written without a
  `docs-sync-check` pass; worth re-reading.

### 12. Documentation screenshots are stale

`screenshots/docs-guardians-bloch-panel.png` (used by `docs/guardians.md`) and
`screenshots/mentor-bloch.png` / `screenshots/superposition-bloch.png` (used by
`README.md`) show Bloch's travel panel with the smaller map. There is no
screenshot-regeneration script in `game/scripts/` and `DEVELOPMENT.md`
documents no flow for it. Either establish one or refresh these by hand before
a final version.

---

## Decisions only the owner can make

### 4. The musical light rule in Worlds 8 and 9

`WORLDS.md` §1 states that what World 7 removes — chord progression, moving
bass line, chordal pad — never returns in Worlds 8, 9 or 10, leaving only a
sustained single-pitch pedal. In `game/src/audio/music.ts`, World 8's overworld
score carries a seven-bar progression, a bass voice changing pitch once per bar
(F#2 G2 F#2 D2 B2 G2 F#2) and a sustained fifth pad; World 9 is built by
`makeOverworldScore` with verse/bridge progressions and the default
`bassMode: 'arp'` walking bass. `MUSIC_BUILD_TASK.md` does not cover this.

`WORLDS.md` is binding per `CLAUDE.md`, so this resolves one of two ways: the
scores lose their accompaniment, or the rule changes and `WORLDS.md` says so.
It cannot ship as it stands. See item 13 — verifying a fix here needs more than
a green suite.

### 5. Bespoke per-world boss puzzles

`DESIGN.md` §6 describes them; §9 lists them as not built, with all ten worlds
using the same reach-goal → beat-rival → continue gate. Either build them or
amend §6 so the design doc stops promising what the game does not do. Ten worlds
resolving identically is the build's largest sameness risk.

### 6. `DESIGN.md` §10's open design questions

A final version should not ship with a section of open questions. Several are
decisions to record rather than work to do: multiplayer/trading in or out;
course integration as a supplementary tool or tied to assessment (this one sets
how rigorous the Materialdex must be); and the scope question about cutting to
3–4 flagship worlds, now moot since all ten exist.

### 7. B.Sc. difficulty and a stale comment

`data/balance.ts`'s B.Sc. multiplier is 0.6. Under the realistic balance-sim
player model that archetype clears worlds 1–9 comfortably while World 10's rival
lands as an exact coin flip. Decide whether that is the intended finale tension.
Independently of the decision, `balance.ts`'s own comment claiming B.Sc. "can
clear all 10 worlds" overstates what the sim shows and should be corrected.

---

## Features specified but not started

### 8. Feynman panel level-up preview

Preview the escalating level-up animation at the player's current level inside
Feynman's own guardian panel, rather than only in a real battle.

### 9. Lab Moves panel rework

`hubStations.ts`'s `showMovesPanel` reworked into a Qumatex-style browse: move
animation on the right, one lore and one physics sentence per move, epicness
scaled to move power, ultimates listed last. Source is `getBattleMoves` — the
moves currently usable, not every unlocked move.

---

## Deferred by decision — reconfirm or close

A final pass is when consciously-deferred items get one last look. Both of these
are closed by choice, not by oversight; the task is to confirm that choice or
reverse it, then record which.

### 10. Pass flanks — Horizon stage E

`HORIZON_BUILD_TASK.md` stage E. Three independent visual reviews and the gate
screenshots agree the pass currently reads as "road tapers to a point" rather
than "road passes through a gap," because nothing flanks the lit slot. That file
also calls stage D "a complete, shippable gate," which sits awkwardly beside
those reviews — worth reconciling the two statements whichever way this goes.

### 11. Progress-keyed Lab and Title theme

Branch `worktree-agent-a6aa2b4c9f10c32f7` gives the Lab and Title screen one
theme keyed to progress, implementing the Lab half of what `MUSIC_BUILD_TASK.md`
describes. Left unmerged by decision.

---

## Verification and process

### 13. A green suite is not evidence for the music

`assertLoopBeats` calls `console.error` and does not throw, so a broken score
still boots and `component-check` still passes. Verifying any music change means
driving the game headless and watching for `music:` console messages — zero is
the pass. Relevant to item 4.

### 13b. `greyscale-check` cannot reach a battle

`npm run greyscale-check` fails in all ten worlds with "stuck before the battle
started." The script clicks a `Battle!` button after `maybeReachGoal`, but the
rival gate is accepted by `confirmGate()` at the pass mouth (`goalTile.y + 1`,
`OverworldScene.ts`) — a keypress, with no such button — so the flow stops at the
goal banner and `startBattle` is never called. Until this is repaired, no battle
legibility claim can be backed by the check, only by reading frames.

### 14. Playtesting with students

`DESIGN.md` §9 lists it as not built. For a course tool it is the highest-value
remaining item that is not code, and nothing in the automated checks substitutes
for it.

### Consolidated check before declaring a final candidate

Run `content-lint` and `component-check` together from `game/` once the tree is
quiet. Concurrent multi-agent sessions make single runs flaky, so one clean run
on a settled tree is worth more than several green runs taken mid-flight. The
full `playthrough-check` is a separate, explicit request every time (`CLAUDE.md`);
it is the right thing to run against a final candidate and the wrong thing to
presume.

---

## Lower priority

### 14b. Respawn cost if maps grow substantially — deferred by decision

A refill surveys the ground once and consumes from that survey
(`surveyRespawnGround` in `OverworldScene.ts`), which costs, roughly,
`A + C·W + n·C` for map area *A*, eligible tiles *C*, width *W* and *n* things
placed. Measured on today's maps, the per-step case a player actually hits runs
1.7 ms median and 6 ms worst.

That is fine at the current size and it is deliberately not optimised further.
If maps grow substantially, the next two walls, in the order worth attacking:

1. **The survey is still O(area) and still runs on every step that has anything
   to place.** The fix is to stop rebuilding it — maintain the eligible set
   incrementally as the player moves and as tiles are consumed and freed, so a
   step costs the delta rather than the whole map. This adds real state that has
   to stay correct, which is why it is not worth doing before the size demands
   it.
2. **Sprite construction is the floor underneath that** — a full-map refill is
   about 12 ms, most of it building containers, graphics and labels, which no
   survey work touches. Pooling sprites rather than constructing them is the
   answer if it ever bites.

Re-measure before touching either; neither is worth doing speculatively.

### 15. Quiz subscript notation

`data/quiz.ts` writes subscripts as ASCII underscores (`U_c`, `k_B`, `E_F`,
~120 instances). Phaser's `Text` has no rich-text rendering and Unicode's
subscript block lacks the needed Latin letters, so true subscripts need a
custom multi-`Text` layout built once and reused everywhere quiz and move text
renders. Readable as-is to this audience.

### 16. Quiz-fetch functions

`getAnalyticQuestion`, `getAnalyticQuestions` and `getUltimateQuestions` are
three differently-shaped call sites for one conceptual "quiz-gate" need. Worth
reconciling onto a single `getQuestions(pool, count, visitedWorlds?)`.

### 17. Crystal habits still to reconcile with lattice

The `cluster` variant is a **growth** habit — many grains intergrown — rather than
a symmetry claim, so it sits over any lattice, and its three types
(`classicalMagnet`, `quantumSpinLiquid`, `kondoHeavyFermion`) keep it. Per-member
lattice overrides are available if a compound should state its own symmetry
instead: Fe/Cr/NiO/MnO/EuO → cubic, Co → prism, MnF₂/YbRh₂Si₂/CeCoIn₅ →
tetragonal, Ce₂Zr₂O₇ → cubic or octahedral, α-RuCl₃ → honeycomb, YbMgGaO₄ →
triangular.

Four assignments are habit-level approximations worth a second look: `semiconductor`
→ octahedral is solid for diamond/Si/Ge and weaker for grown III-V boules, which
are not habit-grown; YBCO is orthorhombic (Pmmm) rendered pseudo-tetragonal, on
the grounds that its parent phase is tetragonal and its CuO₂ planes are square;
monolayer WTe₂'s 1T′ plate is rectangular rather than square; and UTe₂ sits on
`prism` despite being body-centered orthorhombic, because nothing in the set fits
it better.

### 18. Subtype combination rules

Which main+subtype pairs are physically and narratively sensible needs a full
compatibility table.

### 19. Opponent debuffs

No guardian teaches a move that inflicts anything on the defender; Kondo's three
are self-buffs. A real debuff move is an attack and would need its own
`MOVE_COMPATIBILITY` treatment, unlike a self-buff.

---

## Closed — do not reopen

**Ground decoration is not dead code.** The walkable floor's per-world motifs
are switched off deliberately via `GROUND_MOTIFS_ENABLED` in
`terrain/decoration.ts`, with the rationale in place: a patterned floor competes
with the walkable/impassable boundary for exactly the attention that boundary
needs. The motifs stay written and reachable behind that one constant.
