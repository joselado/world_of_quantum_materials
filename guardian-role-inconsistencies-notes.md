# Guardian roles: consistency notes

Internal research note, not a player-facing doc — exploration only, nothing here
has been implemented and nothing should be inferred as a to-do list without
further discussion. Findings are tiered by how much they'd confuse a player
(a stated narrative role that doesn't match the granted mechanic) first, then
by how much they'd mislead a contributor reading the docs cold, then by small
wording/terminology drift. A final section lists patterns that look
inconsistent across guardians but are actually load-bearing/intentional, per
`DESIGN.md`'s own stated rationale.

Sources read: `DESIGN.md` §2 (World map) and §5 (Guardians, full section, lines
416-640) in full; `CODEMAP.md`'s "Guardians" section (lines 456-560) and
"Guardian panels"/avatar conventions; `docs/guardians.md`, `docs/hybrids.md`,
`docs/quasiparticles.md`; `game/src/scenes/OverworldScene.ts`'s
`WORLD_GUARDIANS` table; every file in `game/src/scenes/panels/` (`noether.ts`,
`bloch.ts`, `dresselhaus.ts`, `laughlin.ts`, `majorana.ts`, `curie.ts`,
`bohr.ts`, `kondo.ts`, `anderson.ts`, `passiveList.ts`); `game/src/data/
materials.ts` (`MOVES`, `ANALYTIC_MOVE_IDS`, `KONDO_MOVE_IDS`,
`CURIE_TUNABLE_CLASSES`); `game/src/data/passives.ts`; `game/src/data/
quiz.ts`'s `ANALYTIC_QUESTIONS`; `game/src/scenes/BattleScene.ts`'s passive
hook-in constants (`FRACTIONAL_GUARD_DAMAGE_MULT` etc.); `DESIGN.md`'s own git
history for §2/§5 (`git log -p -- DESIGN.md`) to distinguish genuine drift
from documented-and-current design.

---

## Tier 1 — narrative/mechanic mismatch a player could notice

### 1. Curie is the only guardian whose granted mechanic has no stated (or apparent) connection to her own physics — and her two moves are the one place the game's own naming rule quietly has an exception

**Current mechanic.** `DESIGN.md:501-547` describes Curie's shop (Skyfall
Beam, Ground Eruption — `data/materials.ts`'s `ANALYTIC_MOVE_IDS`,
`materials.ts:96`) purely mechanically: sells two moves, each gated by a
physics-equation quiz question (`BattleScene.showAnalyticQuestion`, right
answer 2x damage, wrong 0.5x), with an unusually flashy per-move visual
(`art/attackEffects.ts:46`'s `ANALYTIC_SHAPES`, consumed by
`playBeam`/`playEruption`, `attackEffects.ts:222,280`), plus a
quasiparticle-tuning sub-panel. The quiz pool itself (`data/quiz.ts`'s
`ANALYTIC_QUESTIONS`, `quiz.ts:1378-1479`, 20 entries) is deliberately drawn
from the whole course — Bloch's theorem, the Stoner criterion, Landau
levels, BCS, the Kondo temperature, graphene's Fermi velocity — only
incidentally touching Curie's own topic (world 6, classical
magnetism/magnons: the Stoner criterion, a ferromagnet's magnon dispersion,
and the Dzyaloshinskii-Moriya interaction are the only three of the twenty
that are session-06 physics) rather than Curie-temperature physics
specifically. This breadth is itself explained and intentional
(`quiz.ts:1370-1376`: "usable from any crystal form, not tied to a single
world's topic").

There's a second, sharper piece of evidence for the same gap. `docs/
quasiparticles.md:3-4` states the game's naming rule with no stated
exception: "Every move in the game is named after a real quasiparticle or
excitation -- never an abstract 'attack type.'" `materials.ts:15-17`'s own
comment claims Curie's two moves comply: "Curie's moves (skyfallBeam/
groundEruption below) name a quasiparticle like any other move." But that's
only true *after* tuning — `curieMoveDisplayName` (`materials.ts:337-342`)
only folds a quasiparticle word into the name once the player has picked
one via Curie's picker; its own comment says so ("Untuned falls back to the
move's own static name," `materials.ts:336`). Untuned — which is how every
move starts, and how it stays if the player never opens the tuning
sub-panel — the names on screen are just "Skyfall Beam" and "Ground
Eruption," generic elemental-attack vocabulary (the kind the GBA-Pokemon
genre this game is styled after uses for un-typed "special" moves) that
doesn't name any real excitation at all. Every other move in `MOVES`
(`materials.ts:30-86`) names its quasiparticle unconditionally, from the
id's own display name, with no player action required. So `materials.ts`'s
own comment overstates its own code's behavior, and the game's single
stated naming rule (`docs/quasiparticles.md:3-4`) has a real, undocumented
exception living in exactly the two moves that also lack a stated physics
rationale — the same root cause explains both: these two moves read as
imported RPG-genre vocabulary rather than something derived from Curie's
own physics the way every other guardian's signature mechanic is.

**Why it's incoherent.** Every one of the other eight guardians' paragraphs
in `DESIGN.md` §5 states an explicit "fitting, because..." (or equivalent)
link between the guardian's own physics/historical role and the mechanic
they grant:
- Noether: "fitting, since Noether's theorem is literally 'symmetry implies
  a conservation law'" (`DESIGN.md:430-431`)
- Bloch: "fitting, since a Bloch state is a superposition spread across
  every unit cell" (`DESIGN.md:433-434`)
- Dresselhaus: "fitting, since the Dresselhaus effect... is the real
  ingredient that locks spin to momentum" (`DESIGN.md:440-443`)
- Laughlin: "fitting -- Laughlin's own physics (the fractional quantum Hall
  wavefunction) is world 4's topic" (`DESIGN.md:458-460`)
- Majorana: the entire paragraph is the fitting rationale (fusing two states
  into one mirrors pairing two Majorana half-fermions) (`DESIGN.md:469-500`)
- Bohr: "fitting Bohr's own historical role defending quantum mechanics'
  completeness against the EPR paradox" (`DESIGN.md:550-553`)
- Kondo: "since Kondo screening physically resolves one scattering channel
  at a time, not every channel at once" (`DESIGN.md:578-581`)
- Anderson: "an impurity's channel only manifests once the player's own
  current form can physically host it" (`DESIGN.md:596-598`)

Curie's paragraph (`DESIGN.md:501-547`) is the one exception — it never says
why a quiz-gated, unusually-flashy attack multiplier is the thing *Curie*
specifically teaches, as opposed to any other guardian. Her overworld quote
("Every magnet has a temperature where its order gives up..." —
`OverworldScene.ts:288`) is a proper Curie-temperature line and fits world
6's topic, but nothing in the actual mechanic (course-wide equation trivia +
damage multiplier) reflects order-disorder transitions, paramagnetism, or
anything else Marie Curie's own physics is about. A player who knows who
Curie was has no way to connect "she quizzes me on Landau levels for double
damage" back to her.

**Why it's worth flagging.** Every other guardian's mechanic reads as a
small, legible lesson ("Noether: symmetry buys you a new law," "Anderson:
disorder lets you borrow one channel"). Curie's reads as "the guardian who
happens to own the flashy/quiz-gated moves," a mechanical role that could be
reassigned to literally any other guardian without changing anything about
its own internal logic — and, unlike every other guardian's moves, her two
moves' default on-screen names aren't drawn from the game's own physics
vocabulary at all. Not a code bug in the sense of breaking anything — the
mechanic itself works and is well-specified — but it's the one guardian
where the physicist, the naming convention, and the gameplay payload all
read as arbitrarily paired rather than designed together the way the other
eight are.

**Scope:** documentation/narrative only, plus one comment correction —
(a) either add the missing "fitting, because..." framing to
`DESIGN.md:501-547` (if there is a real intended connection — e.g.
"answer-gated certainty" as a nod to precision measurement, which was Marie
Curie's actual experimental strength, or Curie's Law/Curie-Weiss
susceptibility as the "equation-recall" hook), or treat this as a genuine
open design gap worth resolving with a mechanic or rename tweak (no code
change recommended here either way); (b) separately, `materials.ts:15-17`'s
comment ("name a quasiparticle like any other move") should be corrected to
say this is only true once tuned, regardless of what's decided about (a).

---

## Tier 2 — contributor-facing: doc says something the code doesn't do

### 2. World 2's "Gate to next world" text is a fossil from a scrapped Bloch mechanic, not what Bloch actually teaches

**Current mechanic.** `DESIGN.md`'s world-map table (`DESIGN.md:27-39`) lists
a distinct "Gate to next world" puzzle per world, e.g. World 2: `Learn
"symmetry sense" from guardian` (`DESIGN.md:31`), World 4: `Solve a
Landau-level maze` (`DESIGN.md:33`), World 8: `Screen a "local moment" boss
mechanic` (`DESIGN.md:37`), etc. None of these strings (`symmetry sense`,
`Landau-level maze`, `local moment` boss, etc.) appear anywhere else in
`DESIGN.md` or `game/src` — confirmed by a repo-wide grep. `DESIGN.md`'s own
later text says so explicitly: "Every world uses this same reach-goal →
beat-rival → continue gate, not a bespoke per-world puzzle... building those
as one-off minigames for every world was scoped out... §6 stays as a record
of that future direction, **not a description of current behavior**"
(`DESIGN.md:69-74`). `CODEMAP.md` confirms the actual, uniform mechanic: the
goal guardian is always reachable once the goal tile is reached, independent
of the guardian at all (`DESIGN.md:58-62`, `OverworldScene
.tryAdvanceToNextWorld`).

`git log -p -- DESIGN.md` shows the World 2 cell is specifically a leftover
from an early design pass where Bloch's actual planned mechanic *was*
"unlocks 'symmetry sense'" (`git log -p DESIGN.md`, an early revision:
`- **Bloch** → world 2 → unlocks "symmetry sense"`) before the guardian
system was redesigned around Bloch's current teleport-hub mechanic
(`OverworldScene.showBlochHub`, `DESIGN.md:432-438`). The "Gate to next
world" table cell was never updated to match — it still describes the
scrapped mechanic, not the shipped one.

**Why it's incoherent.** A reader who only skims the §2 table (not all the
way to lines 69-74, and not `CODEMAP.md`) would reasonably conclude World 2
is gated on learning something called "symmetry sense" from the guardian —
a mechanic that doesn't exist. Combined with finding 1's Curie gap, this is
the second guardian-adjacent spot where `DESIGN.md` names a taught skill
that has no code behind it. This directly violates `CLAUDE.md`'s "write
every edit... as current state, not a change log" instruction — the cell
reads as current-state fact, not clearly marked as either historical or
aspirational.

**Scope:** small doc fix — either replace the "Gate to next world" column
with the one real, uniform mechanic ("Beat the world's rival crystal"), or
add an inline note pointing at §6 the way §6 itself already points back
(the current one-directional cross-reference, from §6 back to the table,
is easy to miss when reading top-down).

### 3. Bloch is the only "real mechanic" guardian whose reward doesn't touch battle at all

**Current mechanic.** `DESIGN.md:424-427` states "every guardian 1-9 has a
real mechanic (Noether, Bloch, Dresselhaus, Laughlin, Majorana, Curie, Bohr,
Kondo, Anderson)," grouping all nine as the same kind of thing. Read
individually, though, eight of the nine grant something that changes a
battle: new moves (Noether, Curie, Kondo), a passive modifier
(Laughlin, Bohr), a full-form transmutation (Dresselhaus), a fused hybrid
form (Majorana), or a borrowed move (Anderson). Bloch's mechanic
(`scenes/panels/bloch.ts`'s `showBlochHub`) is pure overworld fast travel —
teleport to any previously-visited built world — with zero effect on stats,
moves, or battle outcomes.

**Why it's incoherent.** Bloch is the one guardian in the "every guardian
has a real mechanic" list whose "mechanic" is a UI/QoL feature — and
DESIGN.md is explicit elsewhere that it's also *load-bearing* UI ("Bloch's
hub [is] the sole way to move between worlds, since there is no separate
Warp panel," `DESIGN.md:436-438`) rather than a piece of taught physics
gameplay the way the other eight are. Her stated narrative fit ("fitting,
since a Bloch state is a superposition spread across every unit cell, not
pinned to one," `DESIGN.md:433-434`) is a defensible metaphor for *why a
delocalized state might imply travel*, but it's still explaining a
navigation feature, not a battle mechanic — the metaphor doesn't change
that she's the outlier in what kind of thing she teaches.

**Why it's worth flagging.** This isn't necessarily wrong — a fast-travel
guardian genuinely is useful, and world 2's early placement means the
player benefits from it for most of the game — but it means "every guardian
teaches a way to fight differently" isn't actually true of all nine, and
nothing in `DESIGN.md` says so directly; a contributor skimming just the
guardian-by-guardian list would expect Bloch to have some in-battle payoff
like her eight siblings and be surprised she doesn't.

**Scope:** documentation only — a one-line caveat in `DESIGN.md:424-427`
("...though Bloch's is a navigation mechanic rather than a battle one")
would resolve the mismatch without touching code.

### 4. DESIGN.md documents "first purchase auto-activates" only for Kondo, even though Laughlin/Bohr do the identical thing

**Current mechanic.** Kondo's paragraph explicitly documents: "Buying the
*first* Kondo move activates it automatically... buying a second or third
on top of an already-active one doesn't" (`DESIGN.md:584-587`). Laughlin's
and Bohr's paragraphs (`DESIGN.md:452-468`, `548-561`) describe the same
"learn several, equip one" shape but never mention this auto-activation
detail. The code shows all three guardians behave identically: `scenes/
panels/passiveList.ts:71-74` (`if (!scene.game.registry.get(activeKey)) {
scene.game.registry.set(activeKey, id); }`, shared by both Laughlin's and
Bohr's panels) auto-activates the first bought passive exactly the way
`scenes/panels/kondo.ts:96-98` does for moves. `CODEMAP.md:492-494`
correctly documents the parity ("right down to 'buying the very first one
for this guardian auto-activates it, buying a second or third doesn't'"),
and `passiveList.ts:24-26`'s own comment states "same reasoning as Kondo's
first move" — so the behavior is intentional and consistent, just
under-documented in `DESIGN.md` itself relative to how thoroughly it
documents Kondo's version.

**Why it's incoherent.** Not a code bug — `CODEMAP.md` and the code agree.
But `DESIGN.md` is supposed to be "the source of truth for game
content/mechanics" per `CLAUDE.md`; a reader relying on it alone (rather
than also cross-checking `CODEMAP.md`) would have no way to know Laughlin's
and Bohr's first purchases also auto-activate, and might reasonably assume
Kondo is special-cased for some Kondo-specific physics reason (his
paragraph's phrasing — "since Kondo screening physically resolves one
scattering channel at a time" — reads as if it's explaining the
auto-activation specifically, when actually that sentence is about the
single-active-at-a-time constraint, which *is* shared, while the
auto-activate-on-first-buy detail is a separate UX convenience that's also
shared but never called out as such for the other two).

**Scope:** small doc fix — add one clause to `DESIGN.md:452-468` and
`548-561` noting the shared auto-activation behavior, or move the
explanation up to the shared "learn several, equip one" framing so it's
stated once rather than fully spelled out for Kondo and silently assumed
for the other two.

---

## Tier 3 — small terminology drift (cosmetic, cheap to fix)

### 5. `docs/quasiparticles.md` says Curie's two moves appear in the generated moves table — they don't

**Current mechanic.** `docs/quasiparticles.md:52-53` reads: "Skyfall Beam
and Ground Eruption (Curie, World 6, in the table above at `phonon`) work
like any ordinary move..." The "table above" is the `<!--
GENERATED:MOVES_TABLE -->` block (`docs/quasiparticles.md:16-27`), which has
exactly 8 rows (Phonon Beam through Majorana Split) — neither Skyfall Beam
nor Ground Eruption is in it. This isn't a stale-generation bug: `scripts/
gen-docs.mjs:138` explicitly filters the table to `!ANALYTIC_MOVE_IDS
.includes(m.id) && m.class !== 'screening'`, i.e. Curie's and Kondo's moves
are deliberately excluded from `MOVES_TABLE` (Kondo's get their own
"Screening" section instead, `docs/quasiparticles.md:60-66`). The
hand-written prose sentence claiming Curie's moves are "in the table above"
was never updated to match the generator's own exclusion.

**Why it's incoherent.** A reader checking the table for Skyfall Beam's row
(as the prose tells them to) won't find it, and may reasonably conclude the
docs page is broken rather than realize the sentence is simply inaccurate.

**Scope:** trivial — reword to something like "...(Curie, World 6, not
listed above since her moves are quiz-gated separately) default to
`phonon`..." — hand-editable, since it's prose around a `<!-- GENERATED -->`
block, not inside one.

### 6. `docs/guardians.md` borrows Curie's "tuned" vocabulary for Kondo's unrelated mechanic

**Current mechanic.** `docs/guardians.md:103` describes Kondo's active-move
switch as "only one can be tuned in at a time." "Tuned"/"tune"/"retune" is
Curie-specific vocabulary everywhere else in the docs and code — it's the
verb for assigning a quasiparticle class to one of her two moves
(`showCurieClassPicker`, `curieMoveDisplayName`, `docs/guardians.md`'s own
Curie section at lines 74-81: "lets you pick which quasiparticle the move
should carry... until you retune it"). Kondo's mechanic (`renderKondoMoves`,
`scenes/panels/kondo.ts`) has nothing to do with quasiparticle tuning — it's
"buy up to three moves, make one active," the same "learn several, equip
one" shape Laughlin/Bohr use, whose own doc entries correctly say "equipped"
(`docs/guardians.md:49`) rather than "tuned."

**Why it's incoherent.** Minor, but it borrows a term the reader was just
taught means something specific and different two sections earlier, in a
doc whose whole point is precise, real physics vocabulary used
consistently.

**Scope:** trivial — reword `docs/guardians.md:103` to "only one can be
active at a time" (matching Laughlin's/Bohr's phrasing) instead of "tuned
in."

### 7. `docs/guardians.md` still says "hybrid or doped compound," a taxonomy the game no longer has

**Current mechanic.** `docs/guardians.md:44` and `:112` (Dresselhaus's and
Anderson's entries) both read "...never a [hybrid or doped compound]
(hybrids.md)." A repo-wide grep for `doped compound` finds these two lines
and nowhere else — not in `DESIGN.md`, not in `CODEMAP.md`, not in
`docs/hybrids.md` itself, not in any code. `docs/hybrids.md` (the page the
link points to) already treats "doped" compounds like Cr-doped (Bi,Sb)₂Te₃
as ordinary entries in the single "Fusion recipes" table
(`docs/hybrids.md:23-35`), not a separate category — consistent with the
"Collapse doped-compound taxonomy to just original and hybrid" commit
(`git log`, `e17b1c5`). `DESIGN.md:446-451`'s own Dresselhaus paragraph
already uses just "hybrid-recipe result" for the same exclusion, with no
"doped" qualifier.

**Why it's incoherent.** Leftover phrasing from before the taxonomy
collapse — `docs/guardians.md` wasn't updated in the same commit that
updated `docs/hybrids.md`, `DESIGN.md`, and the code.

**Scope:** trivial — replace "hybrid or doped compound" with "hybrid" in
both lines to match `docs/hybrids.md` and `DESIGN.md`'s current wording.

### 8. DESIGN.md says Anderson's host pool is "encountered," while the code (and Dresselhaus/Majorana's own wording) says "defeated"

**Current mechanic.** `DESIGN.md:592` and `:604` describe Anderson's host
pool as "a crystal the player has encountered" / "every crystal in the
game" (Superposition Mode). The actual pool
(`scenes/panels/anderson.ts:64`) is `scene.getDefeatedMaterials()` — the
same defeated-materials source Dresselhaus (`DESIGN.md:439-440`, "any
single crystal they've already defeated") and Majorana (`DESIGN.md:469-470`,
"two crystals they've already defeated") use, worded as "defeated" in both
of those paragraphs. `anderson.ts:70-72`'s own empty-state copy confirms
the real bar: "You haven't defeated any original crystals yet — there is
nothing to dope in."

**Why it's incoherent.** "Encountered" reads as a weaker bar than
"defeated" (you can encounter — i.e., fight and lose to, or flee from — a
crystal without beating it), so a reader comparing Anderson's paragraph to
Dresselhaus's/Majorana's would reasonably conclude Anderson's gate is
looser than the other two, when it's actually identical.

**Scope:** trivial — change "encountered" to "defeated" in `DESIGN.md:592`
and `:604` to match the actual gate and the sibling guardians' own wording.

---

## Load-bearing / intentional — not flagged as inconsistencies

- **Laughlin/Bohr/Kondo's shared "learn several, equip one" shape, with only
  one active at a time.** `DESIGN.md` states this explicitly as a shared
  pattern (`DESIGN.md:456-461`, `550`) and `CODEMAP.md`/`passiveList.ts`
  confirm one real implementation pattern is reused across all three (see
  finding 4 above for the one under-documented corner of it, which is a
  doc-completeness gap, not a behavioral inconsistency). Kondo's
  single-active constraint has an explicit physical rationale ("Kondo
  screening physically resolves one scattering channel at a time");
  Laughlin's/Bohr's constraint is justified by UI/economy consistency with
  Kondo rather than an independently-stated physical reason specific to
  fractional-Hall or entanglement physics. Worth naming as a minor tension
  (three genuinely different physical stories share one game-balance
  reason: "don't let passives stack"), but not something to change — the
  balance reasoning is sound on its own, and DESIGN.md doesn't claim every
  guardian's UI shape must independently derive from that guardian's own
  physics.
- **Curie's/Kondo's low move power relative to Noether's shop tier.**
  Explicitly documented as deliberate — "their real payoff is the
  answer-gated 2x/0.5x multiplier... not raw power" (Curie,
  `materials.ts:43-45`) and "their real payoff is the 3-turn status effect...
  not raw power" (Kondo, `materials.ts:60-64`). Consistent shape, stated
  rationale — keep.
- **Majorana's closed, named-recipe catalog instead of a generic
  type-pairing rule.** `DESIGN.md:474-479` gives a specific physics
  argument for why a generic rule would be wrong (same-type fusion can be
  real, e.g. Twisted Bilayer Graphene), so the catalog approach is a
  deliberate choice, not a shortcut. Keep.
- **Dresselhaus (become), Majorana (fuse), Anderson (borrow one channel) as
  three different shapes for "reuse a defeated crystal's physics."**
  `DESIGN.md:599-600` and `anderson.ts:9-15`'s own comment explicitly
  differentiate all three from each other. Genuinely different mechanics
  with a stated reason for each being different — not accidental overlap.
- **World order exactly matches course session order (world N ↔
  `sessionNN.tex`), confirmed via `data/quiz.ts:12-14`.** No guardian
  teaches a mechanic "too advanced" for its world's place in the course
  arc relative to this ordering — the progression-logic angle this note
  set out to check turned up no violation.
