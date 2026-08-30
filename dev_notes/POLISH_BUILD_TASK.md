# Build task — final-version polish

Work list for the remaining polish between the current build and a final
version. The game is playable end to end (`DESIGN.md` §9); everything here is
either a defect, a decision only the owner can make, or a promise a doc makes
that the code does not yet keep.

Items are grouped by what unblocks them, not by size. The decisions gate a final
version more than any amount of code does: a doc that promises a feature the
build does not have is a defect in the doc or in the build, never in neither, and
where the code contradicts a binding spec it cannot ship unresolved in either
direction.

A status of "fixed, verified" means someone drove the running game and looked;
"fixed, unseen" means the code changed, typechecks and passes `content-lint`,
and nothing has rendered it. The distinction is load-bearing here: item 0
reached a player from behind a comment claiming the overflow was already
handled, so a fix that has only been read is not a fix that has been checked.

---

## Status at a glance

| # | Item | Kind | Status |
|---|---|---|---|
| 0 | Rival taunt panel overflows; run cannot continue | blocker | **fixed, verified** |
| 1 | The Adapted renders pure white | defect | **fixed, unseen** |
| 2 | World 9's rival renders pure white | defect | **fixed, unseen** |
| 3 | Boss shown as an ordinary crystal in the TURNS row | defect | **fixed, verified** |
| 6 | `DESIGN.md` §10's ten open design questions | decision | **open** |
| 7 | B.Sc. difficulty multiplier and its stale comment | decision | **open** |
| 8 | Feynman panel level-up preview | feature | **spec'd, not started** |
| 10 | Pass flanks (Horizon stage E) | deferred | **reconfirm or close** |
| 11 | Progress-keyed Lab/Title theme | deferred | **reconfirm or close** |
| 12 | Doc screenshots | defect | **fixed** |
| 13 | `assertLoopBeats` does not throw | verification | **open** |
| 14 | Playtesting with students | process | **open** |
| 15 | Quiz subscript notation | deferred | **open** |
| 16 | Quiz-fetch functions not reconciled | cleanup | **open** |
| 17 | Crystal habits still to reconcile with lattice | physics | **open** |
| 18 | Subtype combination table | design | **open** |
| 19 | Opponent debuffs unimplemented | design | **open** |
| 20 | Boss status pill sits inside its screening aura | defect | **fixed, verified** |
| 21 | Nothing on screen can be chosen from the keyboard | feature | **open** |

---

## Defects

### 0. Rival taunt panel overflows the canvas — fixed and verified

The pass dialogue is the only way into a rival fight, so an advance button pushed
past `CANVAS_H` does not merely look wrong: it strands the player at the pass and
the world becomes unfinishable. That is what a player hit.

`renderRivalTauntPage` (`game/src/scenes/OverworldScene.ts`) now measures the whole
stack before placing any of it, and places it in the reverse of reading order:
button first, then the taunt fitted to the budget left once the golem is at
`MIN_BOSS_SIZE`, then the golem with whatever height the other two did not need.
The golem is the only one of the three that can give ground for free, so it is the
one that gives it. `fitProseToBudget` (`ui/text.ts`) drives the taunt's own shrink
loop off measured height rather than a font cap, which is what a font cap alone
could not bound.

Verified against the running game at all three font-scale presets × all ten worlds
× both taunt pages (60 states): the advance button's bottom edge lands at 450 in
the worst case against a canvas of 480, and the panel never leaves the canvas on
any side. World 9's second page is the longest taunt in the game and is the one
state that spends its shrink budget, dropping to 16px.

The trap worth remembering for any panel of this shape: capping the font size
bounds the font, not the wrapped height it produces, and the wrapped height is
what overflows.

### 1–3. Boss rendering (1 and 2 open, 3 fixed and verified)

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
- **TURNS row** — **fixed and verified.** `drawTurnPreview` (`battle/hud.ts`)
  builds a rival's icons with `art/boss.ts`'s `makeBossIcon`, reduced to what
  reads at `TURN_PREVIEW_ICON_SIZE`: the silhouette in the opponent's own
  colour with a round ember dot for the eye, since the full-size art's 4x1px
  cut slit would vanish. Checked in world 6 and world 10 rival fights, the
  golem's head and shoulders read clearly at 32px against the player's own
  crystal, so it needed no `k` increase. `transmuteAdapted` redraws the row
  alongside the plate and the move menu, so The Adapted's mid-battle changes
  of form reach all three at once rather than the row lagging a turn behind.

**The two colour fixes are in the tree but were never seen.** They typecheck and
pass `content-lint`; no screenshot was taken of either. Still to confirm by eye:
The Adapted's dark prism at `0x4a4a4a`, and the seven World 9 rival colours
(`TYPE_LOOK[type]` blended halfway to `RIVAL_9_TARNISH`).

**Constraint for any `WORLD_RIVALS` edit** (documented at `materials.ts`'s own
rivals-table comment): that object literal is walked as literal AST nodes by
`scripts/content-lint.mjs` and `scripts/gen-docs.mjs`, which parse rather than
execute the file. Their literal-reducer handles string/number/boolean literals,
arrays, object literals, and calls built from those — not a unary minus (hence
the `darken(c, n)` helper) and not a property access (hence raw hex literals
instead of `TYPE_LOOK[type].color`).

### 20. The boss's status pill and its screening aura -- fixed and verified

An opponent's status pill hangs below its nameplate rather than inside the
stack (`drawOpponentPlate` passes `reserveStatus: false`), so it sits over the
head. The golem is the only body tall enough for its aura to reach that far,
and its aura now stops short of the head by the pill's own measured height
(`BattleScene.syncScreeningAura`) -- measured rather than a literal, since the
text-size preset sets it. Confirmed by a before/after on one scene: the ring
used to cross the pill text and now sits clear below it.

Reachable only through a forced status, not in play: `opponentMoveId` draws
from the opponent's own moveset, and no crystal or golem moveset contains a
screening move (`KONDO_MOVE_IDS` are sold by Kondo and excluded from every
type's compatibility list), so nothing but the player ever raises a cloud. The
opponent branch is kept correct against the day something does.

### 11b. Story station loose ends

- The premise chapter reuses the Lab welcome tip verbatim, so it ends on
  "Qumatex catalogs every crystal… progress autosaves" — mechanics copy inside a
  story reading. Splitting the narrative half from the orientation half is the
  fix, and touches a shared string.
- A pass chapter unlocks on the rival win, although the player meets its goal
  line and taunt slightly earlier; nothing persists that moment.
- The Story station's own doc edits were hand-written without a
  `docs-sync-check` pass; worth re-reading.

### 12. Documentation screenshots

Regenerated by `npm run shots` (`game/scripts/shots.mjs`, see `DEVELOPMENT.md`),
which drives the game through the scene's own methods and rewrites the PNGs
`README.md` and `docs/` embed. Run it after any change that alters what the game
looks like.

The shots that depend on a battle reaching a particular moment — a type-mismatch
hit landing, a victory banner — are still hand-captured and are the remaining
work here; the script's header lists what it drives.

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
the pass.

### 13b. `greyscale-check` does not finish a run

The script reaches battles and reads them. It stands at the pass mouth
(`goal.y + 1`), asserts on the challenge prompt, and invokes `confirmGate()`
directly, which is the flow `DEVELOPMENT.md` describes; the `Battle!` entry in
its click list is only the taunt-paging loop after that. A world it reaches
reports full numbers, so a battle legibility claim for that world is backed by
the check.

What it does not do is get through all ten in one run. Two consecutive runs
each died partway with
`TypeError: Cannot read properties of undefined (reading 'scene')` out of
`setCrystalsVisible` — `window.__game` gone from the page — and they died at
*different* worlds (3, then 7), with one world also flaking to "stuck before
the battle started" in between. So the numbers a run does print are usable and
the ones it never reaches are simply missing, which makes the suite unusable as
a gate even though every reading it produces is good.

The shape of the failure is a page that has gone away underneath the script,
which is the headless-Chrome crash-recovery case `component-check` already
solves; porting that recovery here is the concrete next step. Until then
`DEVELOPMENT.md`'s claim that consecutive runs agree to the last decimal holds
only for the worlds a given run happens to reach.

### 21. Nothing on screen can be chosen from the keyboard

The keyboard walks and accepts what is offered where the player stands, and
nothing more. The complete surface is Arrows (walk), Space (confirm where you
stand, start from the title, leave the battle summary), Enter (Lab in and out),
F (fullscreen) and Left/Right (page between kinds of move in battle). Every
*choice* is pointer-only: `addMoveButton` binds `pointerdown` alone, and so do
quiz answers, Lab stations and guardian-panel buttons. So the keyboard can page
between kinds of move but cannot pick one.

`README.md`'s Controls section states this plainly, so it is not doc drift; it
is a gap against keyboard-only play, which is what a console port would need.
The natural shape reuses keys that already exist: Up/Down move a selection
cursor within the current move page, Space commits, Left/Right keep paging. The
same cursor generalizes to quiz answers, Lab stations and panel buttons, which
is the larger half of the work since it touches every panel's layout code.

Nothing about pointer behaviour would change. `component-check` drives scenes
through private methods and `emit('pointerdown')`, so it would pass unchanged
either way and cannot gate this; `verify-ui` is what would show the cursor
actually lands where it should. Whether this is in scope for a final version is
a decision, not a defect.

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

The `spire` variant is a **growth** habit — a body grown tall and terminated —
rather than a symmetry claim, so it sits over any lattice, and its two types
(`quantumSpinLiquid`, `kondoHeavyFermion`) keep it. The magnets already state
their symmetry: both `metallicMagnet` and `insulatingMagnet` default to `cubic`
(Fe/Cr/Mn/NiO/MnO/EuO/YIG), with Co → prism and MnF₂ → tetragonal per member.
Per-member overrides are still available for the two spire types if a compound
should state its own symmetry instead: YbRh₂Si₂/CeCoIn₅ → tetragonal, Ce₂Zr₂O₇ →
cubic or octahedral, α-RuCl₃ → honeycomb, YbMgGaO₄ → triangular.

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
