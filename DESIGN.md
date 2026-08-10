# Quantum Materials RPG — Design Document

Living document, the single current source of truth for the game. Edit this directly
as the game evolves instead of writing a new plan elsewhere. Companion to `STYLE.md`
(how things look) and `CODEMAP.md` (where things live in the code -- function names,
patterns, exact file locations to check before making changes).

## 1. Core loop

Overworld exploration (walk around, talk to NPCs, find wild encounters) → turn-based
battle → earn qumatokens + attribute growth → return to overworld to progress, pay
mentors for new abilities, or advance to the next world.

**The game is about the crystals, not a trainer who catches them.** There is no
separate human protagonist commanding a roster of creatures Pokemon-style — the
player-controlled overworld avatar *is* a crystal, one entry out of the same
material roster the wild encounters are drawn from (currently Silicon, the
trivial/tutorial-baseline type). Mentors (§5) remain NPC characters the player
talks to, but the thing you walk around the world and fight battles as is a
material, matching the crystal already used for the player's side of every
battle.

## 2. World map — 10 worlds + hub

One world per course topic (see the topic table in the repo's top-level `CLAUDE.md`).

| World | Course topic | In-game name (`WORLD_NAMES`) / biome theme | Wild material archetypes | Gate to next world |
|---|---|---|---|---|
| 0 (Hub) | — | "The Lab" — mentor's house, save point, Materialdex | — | Start world 1 |
| 1 | Second quantization, mean-field, SSB | **Mean-Field Meadow** — tutorial meadow | Free fermion, broken-symmetry magnet | Beat first rival crystal |
| 2 | Symmetries, tight-binding, effective models | **Bloch Caverns** — crystalline caves, repeating tile patterns | Bloch-wave critters, lattice defect variants | Learn "symmetry sense" from mentor |
| 3 | Topological band theory | **Topological Islands** — floating islands, one-way edge paths | Chern insulators, trivial insulators | Cross a gap only an edge-mode move can bridge |
| 4 | Magnetic field, QHE, Landau levels | **Landau Level Terrain** — visible field lines, quantized-orbit terrain | Landau-level materials, composite fermions | Solve a Landau-level maze |
| 5 | Superconductivity, Nambu, Majorana | **Frozen Zero-Resistance Caverns** | s-wave SC, triplet SC, Majorana pairs (split in two) | Pair two Majorana halves |
| 6 | Classical magnetism, magnons | **Magnon Plains** — windswept plains, spin-wave ripples | Ferro/antiferromagnets, magnon wave-riders | Ride a magnon wave across a canyon |
| 7 | Entanglement, tensor networks | **Tensor-Network World** — bonds as paths | Entangled pairs (fought as a bonded duo) | Compress a tangled area into a walkable MPS path |
| 8 | Quantum magnetism, spinons, Kondo | **Spinon Forest** — foggy forest, fractionalizes on contact | Spin liquids, Kondo-screened critters | Screen a "local moment" boss mechanic |
| 9 | Excitations and defects | **Defect Wastes** — cracked/glitching world | Defect-bound states, impurity resonances | Repair/exploit N defects to stabilize a bridge |
| 10 | ML for quantum materials | **The Adaptive Meta-World** — reflects the player's own team | Echoes of earlier phases of matter, plus the adaptive final boss | Final battle |

World and rival names are meant to read as the lecture topic, not generic RPG terrain/monster
names (check `WORLD_NAMES` and `WORLD_RIVALS` together when naming a world -- a mismatched
rival name is easy to miss if only one table is updated).

World 10 has no course notebook, which fits it being the finale rather than a taught
topic: the boss is "a model of you," which is an honest metaphor for an ML surrogate.

World 0 ("The Lab") is built as a static single-room hub (`game/src/scenes/HubScene.ts`),
not a walkable map -- three fixed hotspots (Materialdex, a save point, the door to the
next unbeaten world), since none of its jobs need overworld movement of their own.
`TitleScene` boots the game and loads the one localStorage save slot (see §7) before
handing off to the Hub; pressing `H` from any Overworld scene returns to it.

Each world's "Gate to next world" fight is a distinct **rival crystal**
(`game/src/data/materials.ts`'s `WORLD_RIVALS`, all 10 worlds built) separate from
that world's ordinary wild encounters (`WORLD_CRYSTALS`) -- beating a rival is what the
world's "Continue to World N+1" action actually triggers. The rival fight is deliberately
*not* a precondition for reaching that world's mentor: the goal mentor is always reachable
once the goal is reached, so the player can shop/prep before ever facing the rival, rather
than being stuck needing bought moves to beat a rival they can't reach the mentor to
prepare for (`OverworldScene.tryAdvanceToNextWorld`).

**Every world uses this same reach-goal → beat-rival → continue gate, not a bespoke
per-world puzzle.** §6 below sketches a more ambitious per-world boss mechanic (a
Landau-level maze, pairing a Majorana boss, riding a magnon wave, etc.); building those
as one-off minigames for every world was scoped out of the initial full build-out pass
as too large for one person (§10) in favor of the reusable gate every world already had.
§6 stays as a record of that future direction, not a description of current behavior.

## 3. Type system

**Main types** (one per topic's central phase of matter): trivial/free-fermion
(tutorial baseline), symmetry-broken magnet, topological insulator (Chern), quantum
Hall state, superconductor, classical magnet, tensor-network/entangled state, quantum
spin liquid, defect-bound state, adaptive/ML state (endgame only, not obtainable
until postgame).

**Subtypes**, unlocked via mentors, cross with main types (e.g. superconductor +
magnet subtype → spin-triplet superconductor, matching the example in the source
notes). Not all main+subtype pairs are physical/interesting — needs a full
compatibility table before implementation (see open questions).

**Attributes map to stats** (implemented: `game/src/data/types.ts`'s `Stats`, `game/src/data/materials.ts`):
- **Quantumness** → crit chance ("a coherent critical hit"): `clamp((quantumness - 10) * 0.02, 0, 0.5)`
- **Velocity** → turn order: whichever side has the higher Velocity swings first each round
  (`BattleScene.playerAttack`), ties keep the player going first
- **Correlation** → defense: incoming damage is scaled by `10 / correlation`

Every crystal starts at `10/10/10` (`BASE_STAT`/`DEFAULT_STATS`), which is deliberately a
no-op multiplier so the pre-stats damage numbers are unchanged at parity. The player's own
stats live in the save (`playerStats`) and only grow by spending qumatokens with Noether
(`OverworldScene.renderShopStats`, cost `(current - 10 + 1) * 50` per point); an opponent's
stats are computed fresh from the world number at battle start
(`enemyStatsForWorld(world)`, `+2` per stat per world past world 1) rather than hand-tuned
per species, so difficulty climbs with the world.

**Crystal database.** Each wild "crystal" is named after a real compound rather than
an invented species name, and inherits its main type (and therefore its look and its
type-chart matchups) from that compound's actual physics. Below is the candidate list,
grouped by main type/topic, cross-checked against what
`lecture_notes/tex_extended/sessions/sessionNN.tex` actually names for each topic;
entries marked *(textbook fill-in)* are standard examples supplied because the
corresponding session file names no concrete real compound for that topic.

Wired into `game/src/data/materials.ts` as `WORLD_CRYSTALS`, a **per-world database**
keyed by world number rather than one global list — each world's `OverworldScene`
pulls its own wild-encounter pool via `getWildPool(world)`, drawing 2-4 rows from the
matching type/topic section of the table below (topic 2 has no dedicated main type of
its own, so it reuses trivial-type compounds with "lattice" flavor instead of world
1's tutorial picks; world 10's pool is the one exception to "named after a real
compound" — see the 'Echo of ...' rows and note just below the table). All ten worlds
have a built overworld map (roadmap §9). `PLAYER_MATERIAL` (the player's own crystal,
currently Silicon) is a fixed pick from this same table, not part of any world's wild
pool.

| Type (topic) | Crystal (compound) | Why it has that type |
|---|---|---|
| trivial (1) | Silicon (Si) | Conventional band insulator/semiconductor, no protected structure |
| trivial (1) | Gallium Nitride (GaN) | Doped semiconductor, plain single-particle band picture |
| trivial (1) | Magnesium Oxide (MgO) | Simple ionic band insulator, textbook baseline contrast to topological insulators |
| trivial (1→2 bridge) | Graphene (pristine, half-filled) | Gapless Dirac semimetal — the throughline example of session 2 (Bloch's theorem, tight-binding); precursor before symmetry-breaking (→ magnet) or band-topology (→ topological) sets in |
| magnet (1) | Manganese Oxide (MnO) | Mott-insulating antiferromagnet — canonical mean-field/Hubbard-$U$ SSB example |
| magnet (1) | Nickel Oxide (NiO) | Same family, another textbook mean-field SSB magnet |
| magnet (1, rare/special) | Graphene at strong coupling | Session 1 notes a finite $U_c$ opens a Mott/antiferromagnetic gap at the Dirac point — same base crystal as the trivial entry above, but pushed past its symmetry-breaking threshold |
| topological (3) | Bismuth Selenide (Bi$_2$Se$_3$), magnetically doped | Quantum spin Hall / quantum anomalous Hall via added magnetism + spin-orbit coupling |
| topological (3) | Cr-doped (Bi,Sb)$_2$Te$_3$ | Quantum anomalous Hall effect — zero-field Chern insulator |
| topological (3) | Tantalum Arsenide (TaAs) | Weyl semimetal — topological semimetal, not an insulator |
| topological (3) | Monolayer Tungsten Ditelluride (1T′-WTe$_2$) | Quantum spin Hall insulator, survives up to ~100 K |
| topological (3, rare) | Samarium Hexaboride (SmB$_6$) | Topological Kondo insulator — many-body topology; also bridges to the spinliquid family below |
| qhe (4) | Gallium Arsenide (GaAs) | The original 2DEG platform for the integer/fractional quantum Hall effect |
| qhe (4) | Graphene, in strong field | Dirac-electron Landau levels, plateaus observable up to ~room temperature |
| qhe (4) | Twisted bilayer Molybdenum Ditelluride (MoTe$_2$) | Zero-field fractional quantum Hall from topological flat bands |
| qhe (4) | Cr-doped (Bi,Sb)$_2$Te$_3$ | Zero-field quantized Hall conductance (QAHE) — same compound as a topological-type entry above, showing up again in its field-quantized regime |
| supercon (5) | Aluminum (Al) | Conventional phonon-mediated BCS s-wave superconductor |
| supercon (5) | Lead (Pb) | Same family, higher $T_c$ |
| supercon (5) | YBCO / cuprates | Unconventional nodal d-wave high-$T_c$ superconductor |
| supercon (5, engineered) | NbSe$_2$/CrBr$_3$ heterostructure | s-wave SC + spin-orbit + exchange field engineered into a topological superconductor |
| supercon (5, engineered) | Iron chains on lead (Fe/Pb) | Majorana-chain platform — topological superconductivity from a magnetic chain on an s-wave SC |
| classicalmag (6) | Iron (Fe) | Classic itinerant ferromagnet, magnon carrier |
| classicalmag (6) | Cobalt (Co) | Same family |
| classicalmag (6) | Chromium Triiodide (CrI$_3$) | Van der Waals ferromagnet with an observed topological magnon gap |
| classicalmag (6) | Nickel Diiodide (NiI$_2$) | Non-collinear, multiferroic magnetism from competing exchange interactions |
| tensornet (7, textbook fill-in) | Strontium Copper Borate (SrCu$_2$(BO$_3$)$_2$) | Shastry–Sutherland lattice — exactly-solvable dimerized/entangled ground state, a standard tensor-network benchmark material |
| tensornet (7, textbook fill-in) | Thallium Copper Chloride (TlCuCl$_3$) | Quantum spin-dimer compound — textbook entangled-singlet-pair example |
| tensornet (7) | Herbertsmithite | The one real compound session 7 itself names, motivating MPS/tensor-network methods (kagome local moments) |
| spinliquid (8) | Herbertsmithite (ZnCu$_3$(OH)$_6$Cl$_2$) | Flagship kagome quantum-spin-liquid candidate |
| spinliquid (8) | α-Ruthenium Trichloride (RuCl$_3$) | Candidate Kitaev spin liquid |
| spinliquid (8) | Ytterbium Magnesium Gallium Oxide (YbMgGaO$_4$) | Triangular-lattice spin-liquid candidate |
| spinliquid (8, engineered) | 1T-TaS$_2$ on 1H-TaS$_2$ | Engineered 2D Kondo-insulator heterostructure |
| defect (9, textbook fill-in) | Nitrogen-vacancy center in diamond (NV-diamond) | Canonical atomic-scale defect-bound state / solid-state qubit |
| defect (9, textbook fill-in) | Iron Telluride/Selenide (Fe(Te,Se)) | Hosts Yu-Shiba-Rusinov and vortex-bound (Majorana) defect states in a superconductor |
| defect (9, textbook fill-in) | Niobium Diselenide (NbSe$_2$), STM-imaged impurities | Friedel oscillations / impurity-resonance textbook platform |
| defect (9, textbook fill-in) | Silicon vacancy in silicon carbide (SiC) | Another well-known solid-state defect qubit |
| adaptive (10) | — (no compound, by design) | Boss ("a model of you") and ordinary wilds alike — deliberately not real materials, per the plot hook in §5 |

Session files for topics 9 and 10 name no concrete real compounds at all (they stay at
the level of "a metal," "a superconductor," generic ML methods), so those two rows lean
entirely on textbook fill-ins rather than course-sourced examples — worth flagging if
a stricter "must appear in the course material" rule is later adopted.

**2D and twisted crystal graphics.** Most compounds render as the shard/cluster/prism
gem look their main type's `TYPE_LOOK` fixes, but a handful the table above itself calls
out as monolayer/van der Waals/twisted get a per-compound look override instead
(`data/materials.ts`'s `crystal()` `variantOverride` param, `art/crystals.ts`'s
`drawLayerShape`/`drawTwistedShape`, see STYLE.md): Graphene, Monolayer WTe₂, and
Chromium Triiodide render as a single floating 2D sheet (`'layer'`); Twisted Bilayer
MoTe₂ renders as two twisted, moiré-offset sheets (`'twisted'`) — the crystal's shape
reflects the actual dimensionality/stacking of the compound, not just its main type.

**Every compound has its own look, not just its type's.** Beyond the `variantOverride`
above, every crystal built with `data/materials.ts`'s `crystal()` gets a small,
deterministic per-compound hue/rotation/stretch/sparkle variation (`art/crystals.ts`'s
`jitterFor`, keyed off the compound's own name) layered on top of its `TYPE_LOOK`
silhouette/color, so e.g. Manganese Oxide and Nickel Oxide (both `magnet`-type clusters)
read as individuals rather than one recolored shape reused twice. See STYLE.md's "Crystal
sprites" section for the mechanism.

**A player-created hybrid material (§5's Majorana mechanic) renders as an actual mixture
of both parents**, not one flat blended color — both parents' own shapes overlap
off-center, normal-alpha-blended (not additive; additive washes out against the
overworld's own non-black sky) so the overlap region genuinely mixes both colors, split by
a glowing seam. See `data/materials.ts`'s `combineMaterials`/`hybridParents` and
STYLE.md's "Crystal sprites" section.

World 10's wild pool (`WORLD_CRYSTALS[10]` in `data/materials.ts`) is "Echo of ..."
crystals — 'adaptive' type, no real compound behind them, each one's moveset recalling
an earlier world (e.g. Echo of the Islands carries the same Anyon Braid/Majorana Split
pair world 3's topological wilds do) — so the meta-world's corridor itself plays back
the player's own journey before the boss at the goal does the same thing at full scale.

**Subtype combination flavor (real-compound tie-ins):** the same mechanic from §3
(main type + subtype → new material) has ready real-world flavor text once crystals are
named after compounds:
- superconductor + magnet subtype → spin-triplet superconductor: Strontium Ruthenate
  (Sr$_2$RuO$_4$, historic triplet-SC candidate) or twisted graphene trilayers (observed
  spin-triplet SC under applied field, per session 5).
- superconductor + topological subtype → topological superconductor: same engineered
  platforms as the supercon row above (WTe$_2$ base + NbSe$_2$/CrBr$_3$ heterostructure,
  or the Fe-chains-on-Pb Majorana platform).

**Attacks are quasiparticles, not abstract labels.** Every move is named after the
excitation that actually carries it (`game/src/data/materials.ts`'s `MOVES`), and each
renders as its own particle-effect animation in battle (`game/src/art/attackEffects.ts`):
a fast bolt for Phonon Beam/Electron Pulse/Spinon Swap, an expanding ring pulse for
Magnon Pulse/Polaron Drag, a converging/scattering particle burst for Anyon Braid/Majorana
Split. There is deliberately no "impurity scattering" move — disorder isn't a particle a
crystal emits, so it was dropped from the roster entirely rather than kept as an abstract
attack.

**A crystal can only use moves its own physics supports** — `game/src/data/materials.ts`'s
`MOVE_COMPATIBILITY` table fixes, per main type, which quasiparticle classes it can host
(e.g. a plain band insulator/semiconductor like Silicon only ever gets Electron Pulse and
Phonon Beam, never Magnon Pulse, since it has no magnetic order to carry one). Phonon Beam
(thermal) is on every type's list, since every crystal has a lattice; every other class is
gated to the types whose actual physics motivates it (Magnon Pulse → magnetically ordered
types; Anyon Braid → quantum Hall/topological; Majorana Split → superconducting/topological;
Spinon Swap → spin-liquid/tensor-network; Polaron Drag → superconducting/defect/strongly
correlated). This is enforced everywhere the player's moveset shows up: the battle move
menu (`getBattleMoves` = learned moves ∩ compatible moves) and Noether's shop (same
intersection, so she only ever offers what the player's *current* crystal form can
actually carry — see the transmutation mechanic in §5).

**One deliberate exception: analytic moves aren't gated by a crystal's physics
at all.** Curie's moves (§5) are on every main type's `MOVE_COMPATIBILITY`
list, purchasable and usable from any form — they're a technique the player
themselves learned, not a quasiparticle a crystal has to host, so unlike
every other class they can never trigger the quasiparticle-mismatch rule
below. Their real risk/reward instead comes from the question
`BattleScene.showAnalyticQuestion` asks before the hit resolves: right
answer doubles the damage, wrong answer halves it.

**Battle dynamics are deliberately simple: one type-interaction rule, not a chart.**
An earlier draft strong/weak type-effectiveness chart (per attack, per defender main type)
was removed — it stacked a second, untested multiplier on top of the quasiparticle-mismatch
rule below for no real gain in clarity, and DESIGN.md §10 had already flagged it as an
unplaytested hypothesis. The single rule that remains is §4's "quasiparticle mismatch":
double damage when the defender's own physics can't host the attacking move's quasiparticle
class at all. See `data/materials.ts`'s `canHost()`/`MOVE_COMPATIBILITY` and
`BattleScene.resolveHit`.

**Move power scales with how unconventional the quasiparticle is.** An ordinary lattice
vibration or band electron is weak; a topological or non-Abelian excitation is strong — so
every move the player can buy from Noether outpowers the free starting Phonon Beam. Ordered,
low to high (`data/materials.ts`'s `MOVES`): Phonon Beam (thermal, every crystal has a
lattice) < Electron Pulse (trivial, an ordinary band electron) < Magnon Pulse (magnetic, a
broken-symmetry collective mode) < Polaron Drag (localization, a correlated lattice-bound
distortion) < Spinon Swap (entanglement, a fractionalized spin-liquid excitation) <
Anyon Braid / Majorana Split (gauge / decoherence, topological and non-Abelian — tied for
the most exotic tier the course covers). Because Phonon Beam (thermal) is on every type's
`MOVE_COMPATIBILITY` list, it can never trigger the quasiparticle-mismatch double-damage
rule above — the one universal move is also the one that never gets the mismatch bonus, by
design. Curie's analytic moves (Skyfall Beam, Ground Eruption) sit at a middling base power
below this ordering on purpose — their real payoff is the answer-gated 2x/0.5x multiplier
above, not raw power.

## 4. Battle system

Turn-based, speed-ordered by Velocity. Status effects mirror real phenomena:
- **Localized** — can't act (mirrors Anderson localization)
- **Decohered** — random move miss chance
- **Gapped down** — defense drops (mirrors gap closing)
- **Symmetry-broken** — forced type shift for N turns

**Quasiparticle mismatch.** The sole type-interaction rule in battle (§3): a defender
whose own type can't physically host the attacking move's quasiparticle class at all
(`data/materials.ts`'s `MOVE_COMPATIBILITY`, checked via `canHost()`) takes that
hit at double force (`BattleScene.resolveHit`) — a plain band insulator has no magnetic
order to damp a magnon pulse with, so it lands unmitigated. Applies symmetrically
to both sides, same as every other `resolveHit` term. Surfaced in the battle log as "No
natural defense against this!".

**Move menu matchup info.** `BattleScene.drawMoveMenu` labels each move
button with its power and, computed against the current opponent's type, a `!!2x` tag
when the quasiparticle-mismatch double-damage rule above applies, plus a one-line legend
at the top of the panel spelling out what that symbol means. The panel's row height is computed from how many moves are
currently listed (`drawMoveMenu`'s `rowH`) rather than fixed, since an 'adaptive'-type
crystal (world 10, see §3) can host every move class at once and a fixed row height
sized for the usual 2-4 moves would push the panel off the bottom of the canvas once
all 7 are unlocked.

**Battle background per world.** `BattleScene.drawBackground` reads the same
`art/biomes.ts` table the overworld corridor uses (`getBiome(this.world)`) —
sky, ridgelines, ground, and the decorative crystal outcrops/ground tufts are all
shaded off that world's biome colors, so a fight in the frozen caverns or the cracked
world actually looks like it, not like every other world's battle.

**Wild encounter dialogue.** Bumping into a wild crystal opens a single in-map dialogue
screen (`OverworldScene.showEncounter`, not a separate scene): a greeting line tied to
that material's main type (`game/src/data/greetings.ts` -- a magnet's greeting reads
differently from a superconductor's, since it's keyed by `MaterialType`, not generic) and,
for a material with an entry in `game/src/data/quiz.ts`, one physics question drawn at
random from that material's question pool (at least 6 per material) together on that same
screen -- one correct answer, one incorrect answer (order shuffled), plus "let me pass," so
re-fighting the same material doesn't always ask the same thing. Quiz content is sourced
from the matching session's lecture notes. Answering
correctly multiplies the player's attack power for that battle (1.5×, shown in battle as a
glowing golden aura -- pulsing rings, radiant rotating spikes, rising embers -- around the
player's crystal); answering wrong weakens it (0.6×, shown as a small grey raincloud);
passing skips the battle entirely with no bonus or penalty and no scene change. A material
without a quiz entry yet skips straight to a "Fight!" / "Let me pass" choice on the same
greeting screen -- the same "not every world is filled in yet" pattern the per-world
crystal/biome tables already use.

**Starting loadout and unlocking moves.** The player's crystal starts knowing only Phonon
Beam. Reaching world 1's middle tile for the first time introduces the mentor Noether (§5),
who sells every other move (`SHOP_MOVE_IDS`) for qumatokens, priced by move power
(`OverworldScene.shopCost`, currently power × 5) -- filtered down to whatever the player's
*current* crystal form can physically carry (§3's `MOVE_COMPATIBILITY`), so a trivial-type
player is only ever offered Electron Pulse until they transmute into a form that supports
more. Unlocked moves persist in the Phaser registry's `unlockedMoves` entry (a global
"moves learned," never erased by transmuting) and become available as battle buttons in
`BattleScene` once filtered through that same compatibility check
(`getBattleMoves` = learned ∩ compatible). The move list renders as a docked panel on
the right of the field (`BattleScene.drawMoveMenu`).
Noether's shop panel also carries a second tab for spending qumatokens on the player's own
Quantumness/Velocity/Correlation stats (§3). The actual "leave this world" action -- a
footer button that fights the world's rival crystal the first time it's clicked (see §2),
then becomes "Continue to World N+1" once that rival is beaten
(`OverworldScene.tryAdvanceToNextWorld`) -- lives only in the goal panel now, not Noether's
(or any mentor's) own panel, since the goal is where that world's boss actually stands (§2).

**Stakes.** Winning a battle earns 50 qumatokens; losing costs 50, floored at 0 (a rival
fight doubles both to 100, `BattleScene`'s `RIVAL_TOKEN_STAKE`). Either way the player's
crystal is fully healed afterward (`scenes/BattleScene.ts`) -- the qumatoken stake, not HP
attrition, is what's on the line from one battle to the next. The battle's opening line and
its win/lose closing line are both flavor text from `game/src/data/greetings.ts`, likewise
keyed by the wild material's type.

**Post-battle screen and the Materialdex.** Every battle's end screen also shows one
sentence tying the fight to the real physics of the material just fought
(`game/src/data/materialdex.ts`'s `materialBlurb`, falling back to a generic blurb per
`MaterialType` for a compound without its own entry yet). The first time a wild material is
encountered (not per-battle, and not for rival crystals, which aren't real compounds), it's
recorded into the Phaser registry's `discoveredMaterials` list
(`OverworldScene.recordDiscovery`); the Hub's Materialdex hotspot (§2) lists every
discovered material together with its blurb, paginated two entries per page
(`HubScene.renderMaterialdexPage`).

## 5. Mentors, economy, and story arc

Every world 1-9 has its own mentor, waiting mid-corridor (`OverworldScene`'s
`WORLD_MENTORS` table, every entry's `tile: 'middle'`) rather than at the goal --
the goal tile itself is now occupied by that world's boss (see below), so a mentor
is someone the player meets partway through the journey, not a gate to it. Every
mentor stays reachable from anywhere afterward via the Enter-menu's Advisors panel
once met (`showAdvisorsPanel`, `data/save.ts`'s `metMentors`). **Current state
(deliberately not the final design -- see §10):** six mentors have a real
mechanic (Noether, Bloch, Bohr, Majorana, Curie, Anderson); Laughlin, Bell, and
Kondo are still topic-tied lore stops with an avatar and a quote but no
mechanic of its own yet (`OverworldScene.showMentorLore`) -- what each of them
should actually unlock is still an open design question, not implemented.
World 10 has no mentor; its only encounter is the finale.

- **Noether** → world 1 middle → sells every extra attack move and stat upgrade in the
  game (fitting, since Noether's theorem is literally "symmetry implies a conservation
  law" -- here, conserving enough qumatokens gets you a new move or a sharper stat)
- **Bloch** → world 2 middle → folds space between worlds: teleports the player to any
  world they've already visited (`OverworldScene.showBlochHub`) -- fitting, since a
  Bloch state is a superposition spread across every unit cell, not pinned to one.
  The destination list paginates (`renderPagedButtons`, see below) once it grows past
  a page -- routine in Superposition Mode (see §7), which pre-seeds every built world
  as visited, making Bloch's hub the *sole* way to move between worlds now that the
  separate Warp panels are gone
- **Bohr** → world 3 middle → lets the player transmute into any crystal they've already
  defeated (`OverworldScene.showBohrPanel`/`transmuteInto`) -- beating a crystal means
  understanding its physics well enough to become it for a while; transmuting changes the
  player's look, HP cap, and which moves are currently usable (§3), without erasing any
  move already learned. In Superposition Mode the candidate list is every crystal in the
  game (`data/materials.ts`'s `allCrystals()`) rather than only ones actually defeated
- **Laughlin** → world 4 middle → lore only for now; flavor ties in via the fractional
  quantum Hall wavefunction (world 4's own topic)
- **Majorana** → world 5 middle → lets the player fuse two crystals they've already
  defeated into a new hybrid material and become it immediately
  (`OverworldScene.showMajoranaPanel`/`combineMaterials`) -- but only specific,
  physically sensible type pairings (`data/materials.ts`'s `HYBRID_RULES`/
  `hybridResultType`), not any two defeated crystals. Two materials of the *same*
  main type never combine (fusing two superconductors isn't a new phase, it's just a
  bigger superconductor) -- every recognized pairing mirrors a real engineered
  platform already in the crystal database (magnet/classical-magnet + superconductor
  → topological superconductor, the mechanic's own worked example and the
  Fe/Pb-chain/NbSe₂-CrBr₃-heterostructure mechanism; magnet/classical-magnet or
  topological + quantum-Hall state → topological, the quantum-anomalous-Hall route).
  A valid hybrid's HP scales to 1.5x its stronger parent's, never a downgrade. Every
  hybrid ever created is remembered (`hybridMaterials` save field) so the panel also
  offers "become again" for an earlier one without recombining. In Superposition Mode
  the ingredient pool is every crystal in the game, same as Bohr above
- **Curie** → world 6 middle → sells "analytic" moves (currently Skyfall Beam, Ground
  Eruption -- `OverworldScene.showCuriePanel`) -- using one asks a physics-equation
  question first (`data/quiz.ts`'s `ANALYTIC_QUESTIONS`, `BattleScene
  .showAnalyticQuestion`): answer right and the hit lands at 2x, answer wrong and it
  lands at 0.5x. Each analytic move also gets its own dramatically flashier, per-move
  (not per-class) visual, deliberately reading as stronger than every other move class
  (`art/attackEffects.ts`'s `ANALYTIC_SHAPES`/`playBeam`/`playEruption`): Skyfall Beam
  drops a multi-layer column of light from off the top of the screen -- a white-hot
  core, two swirling side-rays, a trail of falling sparks, and a radiant sun expanding
  at the point of origin; Ground Eruption bursts a wide double shockwave ring and a
  bright geyser core up through nearly twice the shard count of an ordinary burst.
- **Bell** → world 7 middle → lore only for now; flavor ties in via Bell's inequality
  (measured entanglement correlations exceeding any local, pre-agreed strategy)
- **Kondo** → world 8 middle → lore only for now; flavor ties in via the Kondo effect
- **Anderson** → world 9 middle → "dopes in" a crystal the player has encountered as an
  impurity, then teaches one specific move from that crystal's own moveset
  (`OverworldScene.showAndersonPanel`/`learnImpurityMove`) -- a two-step pick (host,
  then which of its moves to learn) that just appends to the ordinary `unlockedMoves`
  list, no special-casing needed: `MOVE_COMPATIBILITY` (§3) already gates whether the
  learned move actually shows up in the battle menu, which is the whole point -- an
  impurity's channel only manifests once the player's *own* current form can physically
  host it. Distinct from Bohr (become the whole state) and Majorana (fuse two states
  together): Anderson borrows a single excitation channel without becoming anything. In
  Superposition Mode the host pool is every crystal in the game, same as Bohr/Majorana

**Boss avatars.** Every built world's rival/boss (`WORLD_RIVALS`/`getRival`)
stands visibly at the goal tile as a gigantic landmark (`OverworldScene
.spawnBossSprite`, `art/boss.ts`'s `makeBossCrystal`) -- a fused mass of several
shards around an oversized core, a pulsing danger aura, and orbiting embers, so it
reads as unmistakably more dangerous than an ordinary wild crystal from a distance,
before the player ever opens the goal panel. It's a pure visual landmark: the fight
itself is only reached through "Face the Rival" in the goal gate panel. The same
`makeBossCrystal` look carries into the fight
itself -- `BattleScene` renders a rival's opponent crystal at `BOSS_CRYSTAL_SIZE`
(bigger than an ordinary wild encounter's), shifted a bit left of the usual
opponent spot so the wider silhouette clears the move menu, instead of the plain
`makeCrystal` every wild battle uses.

**Wild-encounter density.** The Enter-menu's Settings panel
(`OverworldScene.showSettingsPanel`) lets the player choose how often ordinary wild
crystals spawn per corridor row -- Low/Normal/High/Very High
(`data/settings.ts`'s `DENSITY_PRESETS`), persisted like every other save field.
Takes effect the next time a world map is generated (a fresh world entry or an
explicit regenerate), not retroactively on the map the player is currently
standing on.

**Plot hook:** a "Decoherence" is spreading through the material worlds, causing wild
materials to lose their protected properties. The player masters each phase of
matter to stabilize it. World 10's adaptive boss is revealed as the source — an
entity that models and exploits whatever strategy the player has been using.

**Story beats between worlds.** The plot isn't only the tutorial's first page and
the ending — beating each world's rival now shows a short Decoherence-arc line
(`data/story.ts`'s `STORY_BEATS`, keyed by the world just beaten) before
`OverworldScene.showStoryBeat`/`advanceToWorld` moves the player into the next
world, previewing that world's biome and nudging the plot forward one step at a
time. Falls straight through to `advanceToWorld` if a world has no entry, so a
missing beat is never a dead end.

## 6. Boss design

Each world boss requires the ability that world specifically teaches, not just
higher stats — e.g. world 3's boss is only vulnerable while an edge-state move is
active; world 5's boss must be split into a Majorana pair before it can be damaged;
world 7's boss fights as an entangled pair where damaging one damages both.

## 7. Technical architecture

- **Engine:** Phaser 3 via **Vite + TypeScript** (`game/`) — `npm install && npm
  run dev` gets hot-reload, ES modules split by concern (`data/`, `art/`,
  `scenes/`, `world/`), and type-checking on the material/move data model,
  which is exactly the kind of many-interacting-fields data that silently
  breaks without it. `game/` is the only build; the earlier no-install
  single-file `demo/` prototype has been removed.
- **Overworld camera:** over-the-shoulder pseudo-3D (`src/art/perspective.ts`)
  — the player's crystal floats in place at the bottom of the screen while the
  world is redrawn every frame from a smoothly-tweened camera position, giving
  a continuous "walking down a path" feel similar to World of Final Fantasy's
  field view. Movement/encounter logic runs on a plain 2D grid; only the tile
  rendering is projected (lane offset, depth) → screen point, with distance
  fog blending tiles toward a biome-specific haze color near the horizon.
- **Overworld map generation** (`src/world/mapgen.ts`): each world's walkable
  area is a corridor, narrow relative to the grid, whose center drifts left/
  right as it climbs toward a goal row -- narrow and frequent enough that
  walking straight eventually runs off the corridor's edge, so reaching the
  goal takes actually tracking the bend sideways rather than holding one
  direction. Short dead-end branches fork off the corridor's edges at random
  rows; exactly one route (the corridor) reaches the goal, and each branch
  ends in a single qumatoken pickup worth 1, 5, or 10 (`src/data/tokens.ts`),
  rarer at higher value. Off-path tiles render as terrain you can plausibly see is
  impassable, not just differently-colored ground -- a raised wall block by default, or
  (per-biome `wallTheme`, see `STYLE.md`) a molten lava crust, a frozen lake, or open
  sky/chasm you'd fall through -- so blocked terrain reads unambiguously either way. The
  layout is regenerated (fresh `Math.random` calls) on
  first load and whenever the player switches worlds; a round trip through
  battle instead restores the exact layout and player position it started
  from (`OverworldScene.saveMapState`/`restoreMap`, via the Phaser registry).
  The pre-battle encounter dialogue itself never leaves the overworld scene.
  Per-world visuals (sky/ceiling, wall vs. path color,
  decoration style) live in `src/art/biomes.ts`, keyed by world number,
  independent of the shared layout generator.
- **Hosting:** static site (GitHub Pages / Netlify) — client-side only, no backend
  needed unless cross-device save sync or trading is added later. `npm run build`
  in `game/` produces the deployable static output.
- **Save system:** `localStorage` for v1, implemented (`game/src/data/save.ts`, one save
  slot). `TitleScene` loads it into the Phaser registry -- the runtime source of truth
  every scene reads/writes -- before the Hub or any world can run; `persistFromRegistry()`
  is then called after every registry mutation that should survive a reload (token pickup,
  move purchase, rival defeat, battle outcome), so the registry and localStorage stay in
  sync rather than only saving at fixed checkpoints. The Hub's save-point hotspot (§2) also
  triggers it explicitly, mostly for the player's own reassurance since autosave already
  covers it.
- **Starting a new game.** Once a save exists, the title screen's main button always reads
  "Continue" -- `TitleScene`'s "New Game (erase save)" link is the only way to discard that
  progress, gated behind an inline yes/no confirm (`TitleScene.confirmNewGame`) since it's
  destructive and irreversible. Confirming calls `data/save.ts`'s `clearSave()` then
  `this.scene.restart()`, so the Title's existing `loadSave()`-into-registry block re-seeds
  every registry key from `defaultSave()` rather than needing a second seeding path.
- **Data-driven content:** materials, moves, and the type chart live in
  `game/src/data/materials.ts` (the subset the running game uses, including the
  per-world `WORLD_CRYSTALS` database) with `data/materials.json` at the repo
  root as the fuller design-time reference — so balance/content can be tuned
  without touching engine/rendering code.
- **Onboarding is contextual, not one paged popup up front.** Seven short tips
  (`game/src/data/tutorial.ts`'s `TUTORIAL_TIPS`, keyed by `TutorialTipId`) each
  fire once per save, right as their own feature actually becomes relevant
  rather than all at once before the player has done anything: `lab` on first
  entering the Lab (`HubScene.maybeShowLabTip`); `controls` on first entering
  an Overworld world; `encounter` on the first wild-crystal bump; `battle` on
  first committing to a fight; `qumatoken` on first collecting a pickup;
  `mentor` on first meeting any mentor; `goal` on first reaching a world's
  goal row (all six of the latter via `OverworldScene.showTutorialTip`, gated
  by save/registry `tutorialTipsSeen`). Each trigger site passes whatever it
  was about to do next as the tip's close callback (open the encounter panel,
  launch the battle, ...), so the tip is a one-time detour in front of that
  action rather than a separate step callers have to branch on. The full set,
  in the same order, can still be replayed as one paged recap any time from
  the Enter-menu's "Tutorial" button (`OverworldScene.showTutorial`, reading
  `TUTORIAL_PAGES`, the same tips in a fixed array).
- **Story Mode vs. Superposition Mode.** The Title screen has the player pick
  one of two starting modes (`TitleScene.addModeSelector`) before Continue/New
  Game -- both back the same save/registry `superpositionMode` boolean (Story
  Mode is just its `false` state, not a separate field). **Story Mode** is the
  normal playthrough: start at World 1, defeat each world's rival to open the
  next one, meet each mentor in turn. **Superposition Mode** is a testing/
  exploration mode, not the intended first playthrough: every world entry
  re-levels the player's stats/moves/HP to stay competitive with that world's
  opponents (`OverworldScene.applySuperpositionLeveling`, a flat +2 over
  `enemyStatsForWorld`, full move unlock, full heal) instead of requiring the
  normal qumatoken grind, every built world is pre-marked visited so Bloch's
  teleport hub (§5) alone provides full world-to-world movement -- there is no
  separate "Warp" UI, that was removed in favor of just leaning on Bloch's
  existing mechanic -- and Bohr/Majorana/Anderson's panels (§5) offer every
  crystal in the game as a candidate rather than only ones actually defeated.
  Toggled once at the title screen rather than mid-run, so it's a deliberate
  choice made before starting, not something stumbled into during play.

## 8. Art & content pipeline

- Style target: GBA-era Pokemon/Golden Sun — small tile sprites, simple battle
  sprites (player bottom-left, opponent top-right), portrait busts for dialogue.
- Tools: Aseprite (sprites/tiles), Tiled (maps, exports to Phaser-compatible
  formats).
- Materialdex entries and post-battle explanations can be adapted from
  `lecture_notes/tex_extended/sessions/sessionNN.tex` (symlinked into this repo's
  root, see CLAUDE.md) rather than written fresh.

## 9. Current build status

Built and playable end to end: all 10 worlds have an overworld map, biome, wild-encounter
pool, rival, and mentor slot; the Hub, title screen, localStorage save, Materialdex, the
contextual tutorial tips, and the Story Mode/Superposition Mode picker are all in place
(§2, §4, §5, §7). `game/` is the only build; the earlier no-install single-file `demo/`
prototype (world 1 only, placeholder rectangle graphics) has been removed.

Not yet built:
- Bespoke per-world boss puzzles (§6) — every world currently uses the same reach-goal →
  beat-rival → continue gate instead.
- Real mentor mechanics for Laughlin, Bell, and Kondo, beyond
  Noether/Bloch/Bohr/Majorana/Curie/Anderson (§5, §10).
- Battle music variants per world (only overworld tracks are per-world so far).
- A mobile wrapper (Capacitor) and playtesting with students.

## 10. Open design questions

- **Subtype combination rules** — which main+subtype pairs are physically/
  narratively sensible needs a full compatibility table, not just one example.
- **What Laughlin/Bell/Kondo actually unlock** — they're currently
  lore-only stops (§5; Majorana, Curie, and Anderson now have real mechanics:
  hybrid materials, analytic moves, and impurity doping); their real
  mechanics (fractional-charge moves, entanglement moves, screening) may or
  may not depend on the subtype system above existing first.
- **Scope vs. solo-dev reality** — 10 worlds + full art + mentor roster is large for
  one person; consider cutting to 3–4 flagship worlds for a v1 before building all 10.
- **Course integration** — supplementary/optional tool, or tied into assessment?
  Affects how rigorous the Materialdex needs to be.
- **Multiplayer/trading** — in scope or not? Changes hosting/save-system
  requirements significantly if yes.
