# Battle system: simplification notes

Internal design note, not a player-facing doc — exploration only, for a future
session to act on. Nothing here has been implemented. Findings are prioritized
by how much they'd change actual play/pedagogy first, then by how much they'd
help a contributor hold the system in their head, then by naming/architecture
cleanups that touch no behavior. A final section lists things that look like
complexity but are load-bearing for the physics the course teaches — don't cut
those, but the tension is flagged where it exists.

Sources read: `DESIGN.md` §3 (Type system) and §4 (Battle system), plus the
relevant parts of §5 (Guardians); `game/src/scenes/BattleScene.ts`;
`game/src/data/materials.ts` (`MOVES`, `MoveClass`, `MaterialType`,
`MOVE_COMPATIBILITY`, `canHost`, `getCurieMoveClass`, the stats system);
`game/src/data/types.ts`; `game/src/data/passives.ts`; `CODEMAP.md`'s "Stats
and battle resolution"; `docs/quasiparticles.md`.

---

## Tier 1 — findings that change how battles actually play out

### 1. The quasiparticle-mismatch 2x swamps the "power scales with exoticism" lesson

**Current mechanic.** DESIGN.md §3 spends a whole paragraph on "move power
scales with how unconventional the quasiparticle is" — Phonon Beam (6) <
Electron Pulse (7) < Magnon Pulse (8) < Polaron Drag (9) < Spinon Swap (10) <
Anyon Braid/Majorana Split (11) (`materials.ts` `MOVES`, lines 30-81).
Separately, §4's "quasiparticle mismatch" rule doubles damage whenever the
defender's type can't host the move's class at all (`canHost`,
`materials.ts:198-200`; applied in `BattleScene.resolveHit`,
`BattleScene.ts:1017-1023`).

**Why it's incoherent.** The entire power spread is 6-11, under 2x
end-to-end. The mismatch bonus is a flat 2x. So a mismatched Electron Pulse
(7 → 14 effective) already beats a non-mismatched Anyon Braid (11) — the most
exotic move in the game, physics-wise the whole point of the power curve —
before crit or variance are even rolled. The move-menu's own `!!2x` tag
(`BattleScene.addMoveButton`, `BattleScene.ts:603-616`) actively trains
players to pick whichever move currently mismatches, not whichever move is
"more advanced physics," directly undercutting the ordering DESIGN.md
documents as a deliberate teaching device.

This isn't incidental either: `MOVE_COMPATIBILITY` (`materials.ts:163-177`)
means a *narrower*-class move mismatches more often by construction, and
narrowness doesn't track the power-tier the move sits in. Counting how many
of the 10 `MaterialType`s host each class:

| Move | Power | Hosted by (of 10 types) | Mismatches |
|---|---|---|---|
| Phonon Beam | 6 | 10 | never |
| Electron Pulse | 7 | 6 | 4/10 |
| Magnon Pulse | 8 | 4 | 6/10 |
| Electromagnon Pulse | 9 | **1** | **9/10** |
| Polaron Drag | 9 | 3 | 7/10 |
| Spinon Swap | 10 | 2 | 8/10 |
| Anyon Braid | 11 | 4 | 6/10 |
| Majorana Split | 11 | 3 | 7/10 |

(Illustrative — counts host lists in `MOVE_COMPATIBILITY`, not actual
per-world wild-encounter frequency, and `adaptive` is endgame-only so real
mismatch rates against the wilds a player actually meets would run a bit
lower. Directionally solid regardless.) Electromagnon Pulse, a *mid*-tier
move by raw power (9, explicitly "sitting alongside ordinary magnons" per
`materials.ts:54-58`), mismatches 9 times out of 10 by virtue of
`multiferroic` being the only type that hosts `magnetoelectric` — its
*expected* effective power (9 × 1.9 ≈ 17) rivals the "most exotic tier"
moves' best case. The power column and the mismatch-frequency column are
telling two different, uncoordinated stories about which move is "strongest."

**Simplification idea.** Pick one axis to be the real story: either (a)
widen the power spread well past 2x so mismatch is a bonus on top of an
already-meaningful ranking, not a ranking-overriding coin flip, or (b) shrink
the mismatch multiplier (Laughlin's Edge Current already establishes 1.5x as
a valid softened value, `passives.ts:53-59`) so raw power stays legible, or
(c) stop treating the `MOVES` power ordering as a decision axis in the UI/
design language and own it as flavor only. This is a genuine tension between
two documented, physics-motivated design goals (exoticism-implies-power vs.
hosting-implies-defense) — flag for a design decision, don't pick a side
here.

**Scope:** medium (either a numbers-only rebalance, or a documented framing
change — no data-model change either way).

### 2. Curie's tunable-class picker can weaponize the same narrow-class skew

**Current mechanic.** Curie's two moves (Skyfall Beam, Ground Eruption,
power 10 each) default to class `phonon` but can be retuned to any class the
player's *current* form hosts (`CURIE_TUNABLE_CLASSES`, `materials.ts:103-
112`; `getCurieMoveClass`, `materials.ts:314-319`). DESIGN.md §5 states this
current-form filter exists specifically so a class like `magnetoelectric`
"only ever shows up while the player is wearing a multiferroic form, rather
than being a free 'always mismatch nearly every opponent' pick regardless of
form" (`DESIGN.md:514-520`).

**Why it's incoherent.** The filter checks whether the *player's own* form
can *host* the class being assigned — it does not check whether that class is
common or rare across *opponent* types. A player wearing a multiferroic form
(reachable via Dresselhaus transmutation, or by starting a fight as one after
transmuting) passes `canHost('multiferroic', 'magnetoelectric')`, so the
picker legally offers it, and `getCurieMoveClass` keeps the assignment as
long as the current form stays multiferroic. From there, `canHost(defenderType,
'magnetoelectric')` is false for 9 of 10 types — the filter that was supposed
to prevent "always mismatch nearly every opponent" instead grants exactly
that pick to whichever player is positioned to exploit it. The structural
rule generalizes: the narrower a class's host list, the rarer the *type*
required to unlock tuning into it, but once unlocked, that same narrowness is
what makes it near-guaranteed to mismatch everyone else. The filter checks
"can you carry this," not "is this actually the always-mismatch pick,"
so it doesn't do the job the design note says it does.

Concretely, a Skyfall Beam tuned to `magnetoelectric`, against a non-
multiferroic defender, with the in-battle quiz answered correctly, already
stacks to `10 (power) × 2 (mismatch) × 2 (quiz correct) = 40` before crit or
variance — nearly double the best case of Anyon Braid/Majorana Split (`11 ×
2 = 22`), the moves DESIGN.md frames as the ceiling of the power curve.

**Simplification idea.** Either filter the picker by defender-facing rarity
too (e.g. disallow tuning into a class hosted by fewer than N types), or
accept this as an intentional "go niche, hit hard" reward and say so in
DESIGN.md instead of the current "prevents an always-mismatch pick" framing,
which this shows isn't quite true. Verify against actual play data before
deciding — this is arithmetic from the data model, not a playtest finding.

**Scope:** small (the filter's condition, and/or one paragraph of design
rationale) once a direction is picked; understanding whether it's worth
fixing at all is the medium-effort part.

---

## Tier 2 — aggregate complexity (each term motivated, the stack is not)

### 3. Nine independent multiplicative terms stack on a single hit, unbounded

**Current mechanic.** `BattleScene.resolveHit`'s damage line
(`BattleScene.ts:1055-1065`) multiplies together: `move.power`, the
quasiparticle-mismatch multiplier (1/1.5/2), the pre-battle encounter quiz's
whole-battle `attackMultiplier` (0.6/1/1.5, set once per fight in
`OverworldScene`), Curie's per-move `bonusMultiplier` (0.5/1/2, only on her
two moves), Kondo's `screenedMult` (0.7/1, attacker-side), Laughlin's
`fractionalGuardMult` (0.85/1, defender-side), a `defenseFactor` (`BASE_STAT /
correlation`, itself further scaled by Kondo's Decohered status and, on the
player's side, potentially pre-boosted by Bohr's Nonlocal Correlation), a crit
multiplier (1.5, chance itself raised to a guarantee by Bohr's Correlated
Response), and a flat `±15%` random roll. Each term individually is
documented and physics-motivated (crit = coherence, defense = correlation,
mismatch = hosting, quiz = demonstrated understanding, passives = a taught
ability). None of them cap the others, and they all apply to the same hit.

**Why it's incoherent.** Stacking every attacker-favorable term for one hit —
mismatch (2x) × pre-battle quiz correct (1.5x) × Curie quiz correct (2x, on
her moves only) × crit (1.5x) × best-case random (1.15x) — multiplies a
single move's base power by roughly **10x** before `defenseFactor` even
applies. On a power-10 move that's ~103 damage from one hit. Wild/rival
`maxHp` values in `materials.ts` sit in the 20-30 range across the whole
game (`PLAYER_MATERIAL.maxHp` is 30; see the `crystal(...)` calls,
`materials.ts:419-484` and on), and `defenseFactor` never drops much below
~0.4 even at world 9's scaled-up correlation. A single move, under a
plausible best-case stack, one-shots most of the game's HP pools outright —
turn-based combat with HP bars and defense stats stops mattering once four or
five independently-shipped bonus systems are allowed to compound on the same
swing. Nothing in `resolveHit` caps the product or treats any of these terms
as mutually exclusive; each guardian's mechanic was added as one more
multiplicative line in the same formula, which is individually the path of
least resistance but collectively removes the floor under the numbers.

**Simplification idea.** Not "remove a mechanic" (each is separately
justified) but bound the *stack*: e.g. cap the product of all
situational multipliers (everything except crit/variance/base power) at some
fixed ceiling, or make a subset of the bonuses mutually exclusive (e.g. the
pre-battle quiz bonus and Curie's per-move bonus don't both apply to the same
hit), or move some terms from multiplicative into additive/flat-bonus space
so they don't compound geometrically. Any of these needs a numbers pass and
ideally a played-out damage table across a few worlds, not just an
inspection.

**Scope:** medium — no new mechanics, just a cap/exclusivity rule added to an
already-central function, but it changes numbers across every existing
battle and deserves a balance pass, not a blind edit.

### 4. Battle-state modifiers are surfaced to the player three inconsistent ways

**Current mechanic.** Three different guardian mechanics modify a battle
in-progress, and each is shown to the player differently: Kondo's status
effects get a persistent, always-visible pill under the HP bar
(`playerStatusLabel`/`opponentStatusLabel`, `BattleScene.ts:183-184`, updated
via `renderStatusLabel`, `BattleScene.ts:1220-1224`). The pre-battle quiz's
whole-battle `attackMultiplier` gets a one-time visual (a golden halo or a
grey raincloud, `addBoostHalo`/`addFailCloud`, `BattleScene.ts:852-919`) that
plays once at battle start and isn't referenced again. Laughlin's and Bohr's
active passives (`playerActivePassives`, `BattleScene.ts:191`) get **no**
persistent UI at all — the only signal they're active is a battle-log clause
that appears the instant one of them triggers (e.g. `` `${PASSIVES.anyonEcho
.name} strikes again for ${echoDmg}!` ``, `BattleScene.ts:1096`).

**Why it's incoherent.** A player with a Kondo status active, mid-battle, can
see it named and counting down at all times. A player with Fractional Guard
active has no way to check that fact without recalling it from memory or
waiting for a crit to trigger Anyon Echo's log line — there's no equivalent
of the status pill for "which of my two passive slots (one Laughlin, one
Bohr — see Tier 3 finding 8) are currently on." Combined with Tier 2 finding
3's stacking, a player genuinely cannot look at the screen and know which of
the ~5 concurrently-possible modifiers are live on a given hit.

**Simplification idea.** Give Laughlin's/Bohr's active passives the same
always-visible pill treatment Kondo's status already has (a small "Fractional
Guard" / "Shared State" tag near the HP bar, same spot/style as the status
pill) — this is a pure UI addition, no mechanics change, and directly
addresses "hard to hold in your head."

**Scope:** small (reuse the existing status-pill pattern for a second,
static-instead-of-ticking case).

### 5. Every symmetric per-side hook exists for a side that never uses it

**Current mechanic.** `resolveHit` and its supporting state
(`opponentActivePassives`, `BattleScene.ts:192,228`;
`guaranteedCritNext.opponent`, `BattleScene.ts:196`;
`statusVelocityMultiplier`/`statusCorrelationMultiplier`/
`statusDamageMultiplier` all taking an `isPlayer` bool, `BattleScene.ts:1176-
1186`) are written generically over `isPlayer`, with comments noting "only
the player can currently have one... in case a future enemy ever has one."
No `WORLD_CRYSTALS`/`WORLD_RIVALS` entry has a passive, a Kondo move, or an
`attackMultiplier`, and the opponent's move choice is uniformly random
(`Phaser.Utils.Array.GetRandom(this.wild.moves)`, `BattleScene.ts:953`) with
no analogue of any guardian mechanic.

**Why it's worth flagging.** This is future-proofing, not accidental
complexity in the usual sense — it's a deliberate bet that a future enemy
mechanic is coming. Whether that bet is worth the standing cost (every one of
Tier 2's stacking terms has to be read/maintained symmetrically even though
only one side ever populates it) is a judgment call, not an obvious cut. Also
worth naming as a pedagogical gap: the mismatch/type-hosting lesson (the
actual physics content) is currently only ever exercised in one direction —
the player choosing a move against a fixed opponent type — never the reverse
(an opponent picking a move that exploits *the player's* type). A smarter or
type-aware opponent move-choice (even just "prefer a move this player's
current form can't host," no new mechanics needed) would double as a
teaching opportunity and would retroactively justify the symmetric plumbing
that already exists.

**Simplification idea.** No code deletion recommended — either (a) leave the
symmetric plumbing as-is and treat it as intentional headroom, or (b) put it
to use cheaply by making wild/rival move selection prefer a mismatching move
against the player's current form, which is a content-only change (a
smarter `opponentMoveId`) rather than new architecture.

**Scope:** small if (b) is pursued (one function); zero if left as-is — this
is a "note and decide," not a "must fix."

---

## Tier 3 — naming and architecture (behavior-preserving cleanups)

### 6. Move ids are stale/arbitrary relative to their current display names

**Current mechanic.** `materials.ts:30-81`'s `MOVES` keys: `tunnelStrike` →
"Electron Pulse", `thermalFluctuation` → "Phonon Beam", `localizationPin` →
"Polaron Drag", `fluxTwist` → "Anyon Braid", `decoherenceWave` → "Majorana
Split", `heavyFermionDrag` → "Scattering Drag", `kondoBreakdown` →
"Decoherence Cascade". None of the ids match the name a player or a
contributor grepping the game for a move they saw on-screen would search for.

**Why it's incoherent.** Every other naming convention in this codebase
(materials named after real compounds, classes named after the actual
quasiparticle) is deliberately literal (see `MOVES`' own header comment,
`materials.ts:4-17`, arguing against abstract labels). The move `id`s are the
one place still carrying an earlier naming scheme, undocumented as such —
there's no comment explaining `tunnelStrike`/`fluxTwist`/`decoherenceWave`
are historical. Related: `decoherenceWave`'s *display* name is "Majorana
Split," but Majorana zero modes are specifically about topological
*protection from* decoherence — the id, the class (`decoherence`), and the
real physics point in different directions for the same move (see also
finding 7, the same class name collides with an unrelated status effect).

**Simplification idea.** Rename the `id`s to match their current display
names (`electronPulse`, `phononBeam`, `polaronDrag`, `anyonBraid`,
`majoranaSplit`, `scatteringDrag`, `decoherenceCascade`). Purely mechanical —
`id` is read by string in a handful of places (`ANALYTIC_MOVE_IDS`,
`KONDO_MOVE_IDS`, `KONDO_MOVE_STATUS`, every `WORLD_CRYSTALS`/`WORLD_RIVALS`
moveset array, save data's `unlockedMoves`/`curieMoveClass`) — a rename needs
a matching save-migration note (old saves have these ids serialized in
`unlockedMoves`) or a one-time save-format bump, not a design change.

**Scope:** small-to-medium (mechanical rename plus a save-compat check —
existing saves' `unlockedMoves` arrays contain the old ids verbatim).

### 7. `MoveClass` vocabulary collides with unrelated status-effect names

**Current mechanic.** `types.ts`'s `MoveClass` includes `'decoherence'`
(Majorana Split's class — topological/superconducting physics) and
`'localization'` (Polaron Drag's class — correlated/superconducting
physics). Separately, Kondo's `'screening'`-class moves inflict status
effects named `'decohered'` (from Decoherence Cascade) and `'localized'`
(from Scattering Drag) — see `KONDO_MOVE_STATUS`, `BattleScene.ts:61-65`, and
`STATUS_INFO`, `BattleScene.ts:73-92`.

**Why it's incoherent.** These are two entirely unrelated mechanics (a
quasiparticle-class tag that drives the mismatch rule, vs. a generic
scattering/disorder status effect explicitly designed to be *un*-tied to any
specific type's band structure — DESIGN.md is explicit that Kondo's moves are
named generically "rather than after the heavy-fermion/Kondo-lattice physics
that inspired them," `DESIGN.md:249-266`) that happen to reuse the same
English words for unrelated in-game concepts. A physics-literate player
seeing "Decohered" inflicted by "Decoherence Cascade" has every reason to
expect it relates to the `decoherence` `MoveClass`/Majorana Split — it
doesn't; Decoherence Cascade is `screening`-class and mismatches nobody. This
actively works against the pedagogical goal (real terminology, used
precisely) rather than being neutral flavor.

**Simplification idea.** Rename the status kinds (and/or the two Kondo move
display names that reference them) to vocabulary that doesn't overlap
`MoveClass` at all — e.g. "Weakened"/"Slowed"/"Exposed" instead of
"Screened"/"Localized"/"Decohered" for the two that collide (`Screened`
itself is fine, it doesn't collide with any `MoveClass`). Purely a renaming
pass through `STATUS_INFO`, `STATUS_PILL_COLOR` usage sites, and the move
flavor-text comments; no mechanics change.

**Scope:** small.

### 8. Three independent implementations of the same "learn several, equip one" shape

**Current mechanic.** Kondo (buy up to 3 moves, one `kondoActiveMove` active,
`materials.ts:274-289`'s `getBattleMoves` filter plus
`OverworldScene.showKondoPanel`), Laughlin (learn up to 3 passives, one
`laughlinActivePassive` active, `OverworldScene.showLaughlinPanel`), and Bohr
(learn up to 3 passives, one `bohrActivePassive` active,
`OverworldScene.showBohrPanel`) each independently implement "several
unlockable options, exactly one equipped, switched only by revisiting that
guardian's panel." That's three separate registry/save keys, three separate
panel-rendering code paths, and two different *consumption* sites in battle
(`getBattleMoves`'s inline `KONDO_MOVE_IDS`/`kondoActiveMove` check vs.
`BattleScene.activePassives()` reading `laughlinActivePassive`/
`bohrActivePassive` into a `Set`).

**Why it's incoherent.** DESIGN.md itself notes Laughlin's passives use "the
same 'learn several, equip one' shape Kondo's three screening moves already
use" (`DESIGN.md:451-453`) — the pattern is already recognized as shared in
prose, just not in code. Three independent implementations of one shape means
three places that can drift (e.g. only Kondo's version auto-activates the
first purchase, per `DESIGN.md:579-581` — is that intentional divergence or
just something Laughlin/Bohr's panels never got around to copying?), and a
fourth guardian adding a similar mechanic would likely become a fourth
from-scratch implementation rather than reusing anything.

**Simplification idea.** Factor out a small shared "equip-slot" helper —
something like `{ unlockedIds: string[], activeId: string | null }` with a
generic switch/auto-activate-on-first-buy function — that all three
guardian panels and both battle-time consumption sites read through. This is
a pure refactor (no behavior change if done carefully); the main risk is
missing one of the two differing consumption sites (`getBattleMoves`'s
extra filter vs. `activePassives()`'s `Set` read) during the merge.

**Scope:** medium (touches 3 guardian panels in `OverworldScene.ts`, the
save schema's shape for these fields is unchanged, `getBattleMoves`, and
`BattleScene.activePassives`).

### 9. Curie's moves are identified by a hardcoded id list, not a move-level flag

**Current mechanic.** `ANALYTIC_MOVE_IDS = ['skyfallBeam', 'groundEruption']`
(`materials.ts:91`) is checked by identity (`.includes(moveId)`) in at least
three places: `BattleScene.moveSections` (`BattleScene.ts:394,398`),
`BattleScene.addMoveButton`'s tag logic (`BattleScene.ts:608`), and the
click handler that decides whether to open the quiz panel
(`BattleScene.ts:629`). The comment at `materials.ts:86-90` explains this is
because, unlike Kondo's `'screening'`-class moves, Curie's moves have no
distinguishing `class` of their own to filter on (their `class` is whatever
the player tuned it to, defaulting to `'phonon'`).

**Why it's incoherent.** This is a real constraint (the tunable class can't
double as the "is this an analytic move" flag), but the workaround is an
external allowlist array that every future call site has to remember to
check by id, rather than a fact recorded on the `Move` object itself. It's a
small inconsistency in an otherwise data-driven module — everything else
about a move (its power, its class, whether it's a shop item) lives on the
`Move` record or is derived from it.

**Simplification idea.** Add a `isAnalytic?: boolean` (or similarly-named)
field directly to the two `Move` entries in `MOVES`, and have
`ANALYTIC_MOVE_IDS` become a derived `Object.values(MOVES).filter(m =>
m.isAnalytic).map(m => m.id)` (kept as a named export so existing call sites
don't change) instead of a hand-maintained list. No behavior change, just
moves the fact onto the data it's a fact about.

**Scope:** small.

### 10. `quasiparticleLabel` is silently declaration-order-dependent

**Current mechanic.** `quasiparticleLabel` (`materials.ts:119-121`) resolves
a `MoveClass` to a display label via `Object.values(MOVES).find(m => m.class
=== moveClass)?.name` — "first `MOVES` entry with this class, in object-
literal declaration order." Three entries share class `'phonon'`
(`thermalFluctuation`, `skyfallBeam`, `groundEruption`) — the function
currently returns "Phonon Beam" only because `thermalFluctuation` happens to
be declared before Curie's two moves in the `MOVES` literal
(`materials.ts:30-53`).

**Why it's incoherent.** The comment above `CURIE_TUNABLE_CLASSES`
(`materials.ts:114-118`) states "each of `CURIE_TUNABLE_CLASSES` maps to
exactly one `MOVES` entry" — that's not actually true (three entries share
`phonon`), it's just that the other two happen to be declared later, so
`.find()`'s first-match behavior currently produces the right answer by
ordering, not by the invariant the comment claims. Reordering `MOVES` (e.g.
moving `skyfallBeam` earlier for any unrelated reason) would silently make
Curie's picker label the `phonon` option "Skyfall Beam," and a retuned move's
display name would read "Skyfall Skyfall" (`curieMoveDisplayName`,
`materials.ts:332-337`, folds the label's own first word into the name).

**Simplification idea.** Give `quasiparticleLabel` an explicit
`Record<MoveClass, string>` (or filter to only "ordinary, non-analytic"
moves before the `.find()`, which is really what's intended) instead of
relying on iteration order over a map that includes the analytic moves it's
trying to label things distinctly from.

**Scope:** small (one function, one-line fix, plus fixing the now-inaccurate
comment above `CURIE_TUNABLE_CLASSES`).

---

## Tier 4 — load-bearing; flagged for awareness, not recommended for change

- **`MOVE_COMPATIBILITY`/`canHost` reused for both "what can I attack with"
  and "what can't the defender host."** One table drives `compatibleMoves`
  (shop/learnable-move filtering) and `canHost` (the mismatch rule) — this is
  good reuse, not accidental complexity, and is exactly the kind of "single
  source of truth" DESIGN.md calls out approvingly (`DESIGN.md:236-247`).
  Don't split this.
- **`spinliquid` shared across World 7/8, `gauge` shared across
  topological/qhe/chernInsulator.** DESIGN.md is explicit these reflect real
  physics (same quasiparticle family, different point in the course's
  teaching arc) rather than a shortcut taken to avoid defining more classes.
  Keep.
- **Status effects (Kondo, tick-down) vs. passives (Laughlin/Bohr, whole-
  battle flag) as two different mechanical shapes**, even though Tier 3
  finding 8 recommends sharing the *equip-slot* machinery around them. The
  shapes themselves are arguably intentional and reasonably motivated (a
  "screening process wearing off after 3 turns" vs. "an always-on ability
  the crystal's own physics grants") — don't collapse status effects and
  passives into one system just because they're both "battle modifiers."
- **Curie's tunable-class picker as a concept** (as opposed to its filter
  bug, Tier 1 finding 2) is a genuine pedagogical device: it makes "which
  quasiparticle underlies this technique, and can the opponent's type carry
  it" an active choice the player makes with knowledge of the opponent,
  rather than a fact baked into a move's fixed class. That's worth keeping
  even if the exploit above gets patched.
- **No separate strong/weak type chart.** DESIGN.md explicitly rejected this
  as a second untested multiplier system (`DESIGN.md:268-274`); Tier 2's
  finding about term-stacking is really about the guardian-mechanic layer
  re-introducing that same "many interacting numbers" complexity by a
  different route (six-plus independent per-guardian systems instead of one
  chart), not an argument for bringing the chart back.

---

## Footnotes

- **Two independent "quiz for a damage multiplier" systems exist** — the
  pre-battle encounter quiz (`OverworldScene`, `QUIZ_CORRECT_MULTIPLIER`/
  `QUIZ_WRONG_MULTIPLIER` = 1.5/0.6, whole-battle, general per-material
  question pool in `data/quiz.ts`'s `MATERIAL_QUESTIONS`) and Curie's
  in-battle analytic-move quiz (`ANALYTIC_CORRECT_MULTIPLIER`/
  `ANALYTIC_WRONG_MULTIPLIER` = 2/0.5, per-use, `data/quiz.ts`'s
  `ANALYTIC_QUESTIONS`, both in `BattleScene.ts:35-36`). `BattleScene.ts`'s
  own top-of-file comment (`BattleScene.ts:30-34`) already argues these are
  deliberately different in scope and magnitude, and both draw on real,
  substantial course-content question banks (`data/quiz.ts` is ~1480 lines).
  Not recommending a cut — flagging that they stack multiplicatively
  (feeds Tier 2 finding 3) and are never shown together in one place in the
  UI (feeds Tier 2 finding 4).
- **Doc drift, not a design issue:** `DESIGN.md:105-108` and
  `CODEMAP.md:230-232` both describe enemy stat growth as "+2 per stat per
  world past world 1." The actual code (`materials.ts`'s
  `STAT_GROWTH_PER_WORLD`, `materials.ts:220`) is `{ quantumness: 3,
  velocity: 3, correlation: 2 }`, with a comment explaining this was a
  deliberate ~33% difficulty increase over an earlier flat 2/2/2. Worth a
  one-line doc fix next time either file is touched for an unrelated reason —
  not part of this note's scope to fix directly.
