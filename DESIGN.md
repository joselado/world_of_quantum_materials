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

| World | Course topic | Biome theme | Wild material archetypes | Gate to next world |
|---|---|---|---|---|
| 0 (Hub) | — | "The Lab" — mentor's house, save point, Materialdex | — | Start world 1 |
| 1 | Second quantization, mean-field, SSB | Tutorial meadow | Free fermion, broken-symmetry magnet | Beat first rival crystal |
| 2 | Symmetries, tight-binding, effective models | Crystalline caves, repeating tile patterns | Bloch-wave critters, lattice defect variants | Learn "symmetry sense" from mentor |
| 3 | Topological band theory | Floating islands, one-way edge paths | Chern insulators, trivial insulators | Cross a gap only an edge-mode move can bridge |
| 4 | Magnetic field, QHE, Landau levels | Visible field lines, quantized-orbit terrain | Landau-level materials, composite fermions | Solve a Landau-level maze |
| 5 | Superconductivity, Nambu, Majorana | Frozen zero-resistance caverns | s-wave SC, triplet SC, Majorana pairs (split in two) | Pair two Majorana halves |
| 6 | Classical magnetism, magnons | Windswept plains, spin-wave ripples | Ferro/antiferromagnets, magnon wave-riders | Ride a magnon wave across a canyon |
| 7 | Entanglement, tensor networks | Network-graph world, bonds as paths | Entangled pairs (fought as a bonded duo) | Compress a tangled area into a walkable MPS path |
| 8 | Quantum magnetism, spinons, Kondo | Foggy forest, fractionalizes on contact | Spin liquids, Kondo-screened critters | Screen a "local moment" boss mechanic |
| 9 | Excitations and defects | Cracked/glitching world | Defect-bound states, impurity resonances | Repair/exploit N defects to stabilize a bridge |
| 10 | ML for quantum materials | Meta-world reflecting the player's own team | Adaptive final boss only, no ordinary wilds | Final battle |

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
1's tutorial picks; world 10 has no pool at all, since its only encounter is the
adaptive final boss). Worlds 1 and 2 have a built overworld map so far (see roadmap
§9); the remaining worlds' rows are ready for when their maps are built, without
needing changes to the encounter/battle logic itself, since the map generator and
biome skin are already shared/data-driven per world (§7). `PLAYER_MATERIAL` (the player's own
crystal, currently Silicon) is a fixed pick from this same table, not part of any
world's wild pool.

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
| adaptive (10) | — (no compound, by design) | Endgame-only boss, "a model of you" — deliberately not a real material, per the plot hook in §5 |

Session files for topics 9 and 10 name no concrete real compounds at all (they stay at
the level of "a metal," "a superconductor," generic ML methods), so those two rows lean
entirely on textbook fill-ins rather than course-sourced examples — worth flagging if
a stricter "must appear in the course material" rule is later adopted.

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

**Type-effectiveness chart** (draft — see `data/materials.json`, needs playtesting):

| Attack (quasiparticle) | Strong against | Weak against |
|---|---|---|
| Magnon Pulse | Free fermion, s-wave SC (pair-breaking) | Chern insulator, triplet SC |
| Phonon Beam | Any symmetry-broken/ordered type | Quantum spin liquid (no order to melt) |
| Polaron Drag | Spinon/holon states | Superconductor (phase rigidity), topological edge states |
| Anyon Braid | Quantum Hall states | — (universally relevant, low power) |
| Spinon Swap | Tensor-network states (mirrors damage) | Trivial/product states (no effect) |
| Majorana Split | Majorana/entangled pairs (splits their bonus) | Classical magnet (already decohered) |

Electron Pulse (the trivial-class move) has no dedicated row — trivial-type moves deal
neutral damage everywhere, matching ordinary (non-topological, non-correlated) electrons
having no special matchup of their own.

## 4. Battle system

Turn-based, speed-ordered by Velocity. Status effects mirror real phenomena:
- **Localized** — can't act (mirrors Anderson localization)
- **Decohered** — random move miss chance
- **Gapped down** — defense drops (mirrors gap closing)
- **Symmetry-broken** — forced type shift for N turns

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
Beam. Reaching the goal of world 1 for the first time introduces the mentor Noether (§5),
who sells every other move (`SHOP_MOVE_IDS`) for qumatokens, priced by move power
(`OverworldScene.shopCost`, currently power × 5) -- filtered down to whatever the player's
*current* crystal form can physically carry (§3's `MOVE_COMPATIBILITY`), so a trivial-type
player is only ever offered Electron Pulse until they transmute into a form that supports
more. Unlocked moves persist in the Phaser registry's `unlockedMoves` entry (a global
"moves learned," never erased by transmuting) and become available as battle buttons in
`BattleScene` once filtered through that same compatibility check
(`getBattleMoves` = learned ∩ compatible). The move list now renders as a docked panel on
the right of the field rather than individually positioned buttons (`BattleScene.drawMoveMenu`).
Noether's shop panel also carries a second tab for spending qumatokens on the player's own
Quantumness/Velocity/Correlation stats (§3), and the actual "leave this world" action -- a
footer button that fights the world's rival crystal the first time it's clicked (see §2),
then becomes "Continue to World N+1" once that rival is beaten
(`OverworldScene.tryAdvanceToNextWorld`).

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
discovered material together with its blurb.

## 5. Mentors, economy, and story arc

Every world 1-9 has its own mentor, waiting at that world's goal tile (or, for Bohr,
its start tile) and reachable from anywhere afterward via the Enter-menu's Advisors
panel once met (`OverworldScene`'s `WORLD_MENTORS` table, `showAdvisorsPanel`,
`data/save.ts`'s `metMentors`). **Current state (deliberately not the final design --
see §10):** Noether is the sole seller of moves/stat upgrades; every mentor from
Dirac onward is a topic-tied lore stop with an avatar and a quote but no mechanic of
its own yet (`OverworldScene.showMentorLore`) -- what each of them should actually
unlock (subtype system, pairing/screening mechanics, etc.) is still an open design
question, not implemented. World 10 has no mentor; its only encounter is the finale.

- **Noether** → world 1 goal → sells every extra attack move and stat upgrade in the
  game (fitting, since Noether's theorem is literally "symmetry implies a conservation
  law" -- here, conserving enough qumatokens gets you a new move or a sharper stat)
- **Bloch** → world 2 goal → folds space between worlds: teleports the player to any
  world they've already visited (`OverworldScene.showBlochHub`) -- fitting, since a
  Bloch state is a superposition spread across every unit cell, not pinned to one
- **Bohr** → world 3 start → lets the player transmute into any crystal they've already
  defeated (`OverworldScene.showBohrPanel`/`transmuteInto`) -- beating a crystal means
  understanding its physics well enough to become it for a while; transmuting changes the
  player's look, HP cap, and which moves are currently usable (§3), without erasing any
  move already learned
- **Dirac** → world 4 goal → lore only for now; flavor ties in via relativistic
  Landau-level quantization of Dirac fermions (world 4's own topic)
- **Majorana** → world 5 goal → lore only for now; flavor ties in via Majorana pairing
- **Curie** → world 6 goal → lore only for now; flavor ties in via Curie-temperature
  magnetic ordering
- **Einstein** → world 7 goal → lore only for now; flavor ties in via the EPR paradox
  (his own objection to entanglement)
- **Kondo** → world 8 goal → lore only for now; flavor ties in via the Kondo effect
- **Feynman** → world 9 goal → lore only for now; flavor ties in via Feynman diagrams
  for excitations

**Plot hook:** a "Decoherence" is spreading through the material worlds, causing wild
materials to lose their protected properties. The player masters each phase of
matter to stabilize it. World 10's adaptive boss is revealed as the source — an
entity that models and exploits whatever strategy the player has been using.

## 6. Boss design

Each world boss requires the ability that world specifically teaches, not just
higher stats — e.g. world 3's boss is only vulnerable while an edge-state move is
active; world 5's boss must be split into a Majorana pair before it can be damaged;
world 7's boss fights as an entangled pair where damaging one damages both.

## 7. Technical architecture

- **Engine:** Phaser 3 via **Vite + TypeScript** (`game/`) — `npm install && npm
  run dev` gets hot-reload, ES modules split by concern (`data/`, `art/`,
  `scenes/`, `world/`), and type-checking on the material/move/type-chart data
  model, which is exactly the kind of many-interacting-fields data that
  silently breaks without it. `demo/` holds a frozen, no-install single-file
  fallback build; active development happens in `game/`.
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
  rarer at higher value. Off-path tiles render as raised wall blocks (see
  `STYLE.md`), not just differently-colored ground, so blocked terrain reads
  unambiguously. The layout is regenerated (fresh `Math.random` calls) on
  first load and whenever the player switches worlds; a round trip through
  battle instead restores the exact layout and player position it started
  from (`OverworldScene.saveMapState`/`restoreMap`, via the Phaser registry).
  The pre-battle encounter dialogue itself never leaves the overworld scene.
  Per-world visuals (sky/ceiling, wall vs. path color,
  decoration style) live in `src/art/biomes.ts`, keyed by world number,
  independent of the shared layout generator. For testing, Space cycles
  between the worlds that have a built overworld map.
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
- **Data-driven content:** materials, moves, and the type chart live in
  `game/src/data/materials.ts` (the subset the running game uses, including the
  per-world `WORLD_CRYSTALS` database) with `data/materials.json` at the repo
  root as the fuller design-time reference — so balance/content can be tuned
  without touching engine/rendering code.
- **Onboarding.** A first-run tutorial (`game/src/data/tutorial.ts`'s
  `TUTORIAL_PAGES`, a paged popup covering movement/encounters/battles/
  qumatokens/mentors/the Lab/the menu) plays automatically the first time an
  Overworld scene is ever created for a save (`OverworldScene
  .maybeShowFirstTimeTutorial`, gated by save/registry `tutorialSeen`), and
  can be replayed any time after from the Enter-menu's "Tutorial" button
  (`OverworldScene.showTutorial`).
- **Debug Mode.** A Title-screen toggle (save/registry `debugMode`,
  `TitleScene.addDebugToggle`) meant for testing/exploring the game rather
  than the intended first playthrough: while on, the Hub's door and the
  Enter-menu both gain a "Warp" option that jumps straight to any of the 10
  worlds regardless of `rivalDefeated` progress (`HubScene
  .showWorldSelectPanel`, `OverworldScene.showDebugWarpPanel`), and every
  world entry re-levels the player's stats/moves/HP to stay competitive with
  that world's opponents (`OverworldScene.applyDebugLeveling`, a flat +2 over
  `enemyStatsForWorld`) instead of requiring the normal qumatoken grind.

## 8. Art & content pipeline

- Style target: GBA-era Pokemon/Golden Sun — small tile sprites, simple battle
  sprites (player bottom-left, opponent top-right), portrait busts for dialogue.
- Tools: Aseprite (sprites/tiles), Tiled (maps, exports to Phaser-compatible
  formats).
- Materialdex entries and post-battle explanations can be adapted from
  `../lecture_notes/tex_extended/sessions/sessionNN.tex` rather than written fresh.

## 9. Roadmap

1. **Prototype** (done, frozen at `demo/`): core battle loop + minimal type chart for
   world 1 only, placeholder rectangle graphics — validated the core loop is fun.
2. **Vertical slice** (done, in `game/`): worlds 1–3, full overworld/battle/
   Materialdex loop. World 0 (the Hub), the title screen, localStorage saving, a rival
   gate for both worlds 1 and 2, and a first-pass Materialdex are all built (§2, §4, §7).
   Worlds 1–3 have built overworld maps; Noether (world 1's mentor) sells attack unlocks
   and stat upgrades, Bloch (world 2's mentor) teleports between visited worlds, and Bohr
   (waiting at the start of world 3) lets the player transmute into a defeated crystal.
3. **Full build-out** (done): worlds 4–9 built (biomes, wild pools, rivals, quiz
   content), a mentor at every world 1-9 goal/start tile (`WORLD_MENTORS`), the
   Advisors pause-menu panel so any met mentor is reachable from anywhere
   (`metMentors`), and a distinct overworld music track per world. No bespoke
   per-world boss puzzles (see §2's note under the world table) -- every world uses
   the same reach-goal → beat-rival → continue gate. Mentors past Bohr are lore-only
   (§5) pending a real subtype/unlock system (§10).
4. **Finale + polish:** world 10 adaptive boss is built as a rival-style fight (no
   mentor there by design); still open: real mentor mechanics beyond Noether, battle
   music variants per world, mobile wrapper (Capacitor), playtesting with students.
5. **Onboarding + testing aids** (done): the first-run tutorial popup sequence and
   the Title-screen Debug Mode toggle (§7's "Onboarding"/"Debug Mode" bullets).

## 10. Open design questions

- **Type-chart balance** — the draft chart is an untested hypothesis; needs a
  playtest pass or simple simulator before locking move numbers.
- **Subtype combination rules** — which main+subtype pairs are physically/
  narratively sensible needs a full compatibility table, not just one example.
- **What Dirac/Majorana/Curie/Einstein/Kondo/Feynman actually unlock** — they're
  currently lore-only stops (§5); their real mechanics (topological promotion,
  Majorana pairing, subtype unlocks, entanglement moves, screening, defect
  exploitation) all depend on the subtype system above not existing yet.
- **Scope vs. solo-dev reality** — 10 worlds + full art + mentor roster is large for
  one person; consider cutting to 3–4 flagship worlds for a v1 before building all 10.
- **Course integration** — supplementary/optional tool, or tied into assessment?
  Affects how rigorous the Materialdex needs to be.
- **Multiplayer/trading** — in scope or not? Changes hosting/save-system
  requirements significantly if yes.
