# Quantum Materials RPG — Design Document

Living document, the single current source of truth for the game. Edit this directly
as the game evolves instead of writing a new plan elsewhere. Companion to `STYLE.md`
(how things look) and `CODEMAP.md` (where things live in the code -- function names,
patterns, exact file locations to check before making changes).

## 1. Core loop

Overworld exploration (walk around, talk to NPCs, find wild encounters) → turn-based
battle → earn qumatokens + attribute growth → return to overworld to progress, pay
guardians for new abilities, or advance to the next world.

**The game is about the crystals, not a trainer who catches them.** There is no
separate human protagonist commanding a roster of creatures Pokemon-style — the
player-controlled overworld avatar *is* a crystal, one entry out of the same
material roster the wild encounters are drawn from (currently Silicon, the
semiconductor/tutorial-baseline type). Guardians (§5) remain NPC characters the player
talks to, but the thing you walk around the world and fight battles as is a
material, matching the crystal already used for the player's side of every
battle.

## 2. World map — 10 worlds + hub

One world per course topic (see the topic table in the repo's top-level `CLAUDE.md`).

| World | Course topic | In-game name (`WORLD_NAMES`) / biome theme | Wild material archetypes | Gate to next world |
|---|---|---|---|---|
| 0 (Hub) | — | "The Lab" — guardian's house, save point, Materialdex | — | Start world 1 |
| 1 | Second quantization, mean-field, SSB | **Mean-Field Meadow** — tutorial meadow | Free fermion, broken-symmetry magnet | Beat first rival crystal |
| 2 | Symmetries, tight-binding, effective models | **Bloch Caverns** — crystalline caves, repeating tile patterns | Bloch-wave critters, lattice defect variants | Beat that world's rival crystal |
| 3 | Topological band theory | **Topological Islands** — floating islands, one-way edge paths | Quantum spin Hall insulators, bulk and monolayer alike | Cross a gap only an edge-mode move can bridge |
| 4 | Magnetic field, QHE, Landau levels | **Landau Level Terrain** — visible field lines, quantized-orbit terrain | Landau-level materials, an intrinsic zero-field Chern insulator | Solve a Landau-level maze |
| 5 | Superconductivity, Nambu, Majorana | **Frozen Zero-Resistance Caverns** | s-wave SC, triplet SC | Pair two Majorana halves |
| 6 | Classical magnetism, magnons | **Magnon Plains** — windswept plains, spin-wave ripples | Ferro/antiferromagnets, magnon wave-riders, a multiferroic | Ride a magnon wave across a canyon |
| 7 | Entanglement, tensor networks | **Tensor-Network World** — bonds as paths | Entangled pairs (fought as a bonded duo) | Compress a tangled area into a walkable MPS path |
| 8 | Quantum magnetism, spinons, Kondo | **Spinon Forest** — foggy forest, fractionalizes on contact | Spin liquids, Kondo-screened critters, a genuine Kondo-lattice heavy-fermion compound | Screen a "local moment" boss mechanic |
| 9 | Excitations and defects | **Defect Wastes** — cracked/glitching world | Defect-bound states, impurity resonances, a couple of ferroelectrics with no course topic of their own, plus every non-hybrid material from worlds 1-8 | Repair/exploit N defects to stabilize a bridge |
| 10 | ML for quantum materials | **The Adaptive Meta-World** — reflects the player's own team | Every hybrid-recipe crystal, and only hybrid-recipe crystals, plus the adaptive final boss | Final battle |

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

Each world's "Gate to next world" fight is a distinct **rival crystal** -- worlds 1-8 and
10 have a fixed entry in `game/src/data/materials.ts`'s `WORLD_RIVALS`, world 9's is built
per-playthrough instead (see below); all ten worlds have a rival either way. Separate from
that world's ordinary wild encounters (`WORLD_CRYSTALS`) -- beating a rival is what the
world's "Continue to World N+1" action actually triggers. The rival fight is deliberately
*not* a precondition for reaching that world's guardian: the goal guardian is always reachable
once the goal is reached, so the player can shop/prep before ever facing the rival, rather
than being stuck needing bought moves to beat a rival they can't reach the guardian to
prepare for (`OverworldScene.tryAdvanceToNextWorld`). Every rival has a fixed main type
except World 9's ("Rival Impurity Resonance," an impurity/defect-bound resonance that can
form in any host crystal) -- its type is rolled at random every time the player reaches
World 9 (`data/materials.ts`'s `RIVAL_9_TYPES`/`rollRival9Type`, cleared and re-rolled by
`OverworldScene.create()` on every visit) and cached in the save (`rival9Type`,
`OverworldScene.resolveRival9Type`) for the rest of that visit, so the goal-tile boss
preview and the actual battle still agree on which type it turned out to be.

**Every world uses this same reach-goal → beat-rival → continue gate, not a bespoke
per-world puzzle.** §6 below sketches a more ambitious per-world boss mechanic (a
Landau-level maze, pairing a Majorana boss, riding a magnon wave, etc.); building those
as one-off minigames for every world was scoped out of the initial full build-out pass
as too large for one person (§10) in favor of the reusable gate every world already had.
§6 stays as a record of that future direction, not a description of current behavior.

## 3. Type system

**`game/src/data/TAXONOMY.txt` is the hand-edited design source for the type system**
— every main type and every quasiparticle class below, and which classes host which
quasiparticles, is meant to match that file exactly; `types.ts`'s `MaterialType`/
`MoveClass` unions and `materials.ts`'s `MOVE_COMPATIBILITY` are its implementation.
Edit that file first when changing the taxonomy itself, then reconcile the `.ts`
files (and this section) to match, rather than editing the three places
independently.

**Main types (13).** Ordinary, non-exotic band physics splits three ways by how far a
carrier gets: `metal` (a partially filled band — the only tier that carries a
plasmon), `semiconductor` (gapped, but narrow enough to dope/thermally excite across
— an ordinary band electron still gets through), and `insulator` (gapped too wide for
even that — only the lattice itself, a phonon, gets through, though a self-trapped
polaron is actually a *stronger* excitation there than in a bare metal or
semiconductor). Magnetically/electrically ordered baselines: `classicalMagnet`
(magnetically ordered, magnon-carrying — covers both the mean-field/Hubbard-U route
into symmetry-broken order and the classical itinerant-ferromagnet route, since both
are the same ordered-moment phase reached via a different derivation),
`quantumSpinLiquid` (frustrated, never orders — hosts spinon, its Z2 topological-order
companion vison, and triplon, a dimer/valence-bond quantum paramagnet's own confined
mode, grouped in here as a deliberate simplification even though a triplon is
conceptually the *opposite* of spinon's fractionalization), `ferroelectric` (electric
polarization order with no magnetic order at all, hosting ferron — the polarization
order's own quantum, the non-magnetic analog of a magnon), and `multiferroic`
(magnetically ordered *and* magnetoelectrically coupled, hosting an ordinary magnon,
ferron, *and* electromagnon — all three distinct, not redundant). Strongly correlated
baselines: `kondoHeavyFermion` (a hybridized f-electron/conduction-electron compound,
the Kondo-lattice physics topic 8's own guardian is named for) and `superconductor`
(ordinary, non-topological Cooper pairing — hosts `higgs`, the condensate's own
amplitude mode, not Majorana). Topological baselines: `quantumSpinHall` (a protected,
spin-momentum-locked *helical* boundary state — covers a bulk 3D compound's own
surface Dirac cone (Bi₂Te₃), a bulk-derived monolayer's own quantum spin Hall state
(Monolayer WTe₂), *and* the engineered-heterostructure route into that same physics
(HgTe/CdTe Quantum Well, a quantum well whose *inverted* band ordering, not any bulk
crystal symmetry, opens the gap) under one type — the boundary physics the move roster
actually cares about is the same helical channel regardless of bulk dimensionality, so
there's no separate "3D bulk topological insulator" type; hosts no Majorana mode on
its own either way, no superconducting proximity in the picture), `chernInsulator`
(quantized Hall conductance from a nonzero *integer* Chern number and one *chiral*
edge channel, whether via real Landau levels in a field or a zero-field
anomalous-Hall state — both the same topological invariant, so field-driven and
zero-field integer Chern states share one type rather than two), `fractionalChern`
(unlike `chernInsulator`, a fractional Chern insulator's edge is itself a
fractionalized chiral mode whose quanta are `chargedAnyon`s with genuine braiding
statistics, not free chiral fermions), and `chernSuperconductor` (a
chiral/topological superconductor — genuine topological *pairing*, vortices/edges of
a chiral SC or a superconductor-proximitized topological surface, which is what
actually hosts a Majorana zero mode; kept distinct from plain `superconductor` since
an ordinary s-wave condensate's pairing alone does not host one, and from
`quantumSpinHall` since a helical boundary state alone, with no superconductivity in
the picture, doesn't either). Finally `adaptive` (endgame only,
not obtainable until postgame, hosts nearly every quasiparticle above — see
`MOVE_COMPATIBILITY.adaptive`). Topic 7's entangled/tensor-network states and topic
8's spin liquids are physically the same quasiparticle family (Spinon Swap), so World
7 and World 8 share the `quantumSpinLiquid` type while staying visually and
narratively distinct worlds (different biome, guardian, music, name) — the crystal
database below still tags each compound with the topic it illustrates even though the
type column reads the same for both. Topic 9's defect-bound states (Yu-Shiba-Rusinov
states, impurity resonances, vortex-bound Majorana states) are real disorder physics
hosted inside a superconductor, so most of World 9's crystals are `superconductor` or
`chernSuperconductor` type rather than a dedicated one — its one magnetic-impurity
precursor compound (Manganese) is `classicalMagnet`.

**Subtypes**, unlocked via guardians, cross with main types (e.g. superconductor +
classicalMagnet subtype → spin-triplet superconductor, matching the example in the
source notes). Not all main+subtype pairs are physical/interesting — needs a full
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
its own, so it mixes metal/semiconductor/insulator compounds with "lattice" flavor
instead of world 1's tutorial picks; world 10's pool draws exclusively from §5's
hybrid-recipe results instead of one topic section, see the note just below
the table). All ten worlds
have a built overworld map (roadmap §9). `PLAYER_MATERIAL` (the player's own crystal,
currently Silicon) is a fixed pick from this same table, not part of any world's wild
pool.

| Type (topic) | Crystal (compound) | Why it has that type |
|---|---|---|
| semiconductor (1) | Silicon (Si) | Conventional band semiconductor, narrow enough a gap to dope, no protected structure |
| semiconductor (1) | Gallium Nitride (GaN) | Doped semiconductor, plain single-particle band picture |
| insulator (1) | Magnesium Oxide (MgO) | Simple ionic band insulator, gap too wide to dope/excite across — textbook baseline contrast to topological insulators; the ionic lattice also self-traps a stronger polaron than a bare semiconductor would |
| metal (1→2 bridge) | Graphene (pristine, half-filled) | Gapless Dirac semimetal — the throughline example of session 2 (Bloch's theorem, tight-binding); precursor before symmetry-breaking (→ classicalMagnet) or band-topology (→ topological) sets in; real graphene plasmonics is its own well-known field |
| metal (2) | Silver (Ag) | Half-filled 5s conduction band gives it the sharpest free-electron plasmon of any elemental metal — real plasmonics/nanophotonics runs on silver (and gold), not graphene; not from the course, added to give `metal`'s Plasmon Pulse a second, more flagship host |
| semiconductor (2) | Indium Arsenide (InAs) | Ordinary band semiconductor whose real role is strong spin-orbit coupling — the actual second ingredient (alongside Aluminum) in a real Majorana-nanowire platform, §5's InAs/Al Majorana Wire hybrid recipe |
| semiconductor (2) | Monolayer Molybdenum Ditelluride, 2H phase (MoTe$_2$) | The untwisted, semiconducting monolayer phase — distinct from the already-topological 1T′ phase below — that becomes Twisted Bilayer MoTe₂ once fused with itself (§5) |
| semiconductor (2) | Mercury Telluride (HgTe) | Individually just an ordinary (inverted-gap) semiconductor — §5's hybrid-recipe parent for HgTe/CdTe Quantum Well below |
| semiconductor (2) | Cadmium Telluride (CdTe) | Individually an ordinary wide-gap semiconductor — the barrier layer in the same HgTe/CdTe quantum-well recipe |
| insulator (2) | Diamond (C) | ~5.5 eV gap, textbook wide-gap covalent insulator — pristine, no defect (e.g. nitrogen-vacancy) dressing; not from the course, added as `insulator`'s second member alongside Magnesium Oxide |
| insulator (2, hybrid parent) | Monolayer Boron Nitride (hBN) | ~5.9 eV gap insulator whose honeycomb lattice is nearly commensurate with graphene's — real graphene devices are built on or encapsulated in it; §5 hybrid recipe parent (with Graphene) for Rhombohedral Pentalayer Graphene/hBN Moiré below |
| quantumSpinHall (3, hybrid) | HgTe/CdTe Quantum Well | The original 2D topological insulator (Bernevig-Hughes-Zhang model, König et al., Science 2007) — only the *engineered heterostructure* is topological, not either bulk parent above; §5 hybrid recipe result, lives as a World 10 wild rather than a World 3 one |
| classicalMagnet (1) | Manganese Oxide (MnO) | Mott-insulating antiferromagnet — canonical mean-field/Hubbard-$U$ SSB example |
| classicalMagnet (1) | Nickel Oxide (NiO) | Same family, another textbook mean-field SSB magnet |
| classicalMagnet (1, rare/special) | Graphene at strong coupling | Session 1 notes a finite $U_c$ opens a Mott/antiferromagnetic gap at the Dirac point — same base crystal as the metal entry above, but pushed past its symmetry-breaking threshold |
| classicalMagnet (1) | Chromium (Cr) | Itinerant (metallic) antiferromagnet — the SDW mean-field/Stoner-criterion counterpart to MnO/NiO's Mott-insulating picture; also §5's magnetic-dopant parent for Cr-doped (Bi,Sb)₂Te₃ below |
| chernInsulator (3, magnetically doped) | Bismuth Selenide (Bi$_2$Se$_3$), magnetically doped | The added magnetism breaks time-reversal symmetry, turning the helical surface state chiral — quantum anomalous Hall, same doping-breaks-TRS mechanism as Cr-doped (Bi,Sb)₂Te₃ below |
| quantumSpinHall (3) | Bismuth Telluride (Bi₂Te₃) | Undoped topological-insulator host, its bulk gap hiding a spin-momentum-locked helical surface state — §5's Chromium + Bi₂Te₃ hybrid recipe dopes magnetism in to make Cr-doped (Bi,Sb)₂Te₃ below |
| quantumSpinHall (3, rare) | Samarium Hexaboride (SmB$_6$) | Topological Kondo insulator — many-body topology, a protected helical surface state hosted inside a Kondo-insulating bulk; also bridges to the kondoHeavyFermion/quantumSpinLiquid family below |
| quantumSpinHall (3) | Monolayer Tungsten Ditelluride (1T′-WTe$_2$) | A genuine quantum spin Hall insulator in its own right, survives up to ~100 K — a single bulk-derived monolayer's own band topology rather than an engineered quantum well, but the same helical boundary physics as Bi₂Te₃/HgTe-CdTe above, so it shares this type rather than needing a separate 3D-only one |
| chernInsulator (3→10, hybrid) | Cr-doped (Bi,Sb)$_2$Te$_3$ | Quantum anomalous Hall effect — the Cr doping breaks time-reversal symmetry and turns Bi₂Te₃'s helical surface state into a single chiral edge channel, a zero-field integer Chern insulator; §5 hybrid recipe result, lives as a World 10 wild rather than a World 3 one |
| chernInsulator (4) | Gallium Arsenide (GaAs) | The original 2DEG platform for the integer quantum Hall effect — field-driven Landau levels, the same (integer) Chern-number invariant as the zero-field entries above |
| chernInsulator (4) | Graphene, in strong field | Dirac-electron Landau levels, plateaus observable up to ~room temperature |
| fractionalChern (4, hybrid) | Twisted bilayer Molybdenum Ditelluride (MoTe$_2$) | Zero-field *fractional* quantum Hall from topological flat bands — genuinely fractionalizes into charged anyons, unlike GaAs/Graphene's ordinary integer Landau levels above, so it gets its own type rather than sharing `chernInsulator`; §5 hybrid recipe result (the 2H monolayer above fused with itself), lives as a World 10 wild rather than a World 4 one |
| fractionalChern (4, hybrid) | Rhombohedral Pentalayer Graphene/hBN Moiré | Zero-field fractional quantum anomalous Hall (2023–2024 experiments) — five rhombohedrally-stacked graphene layers aligned to a hBN substrate, the same charged-anyon edge physics as Twisted Bilayer MoTe₂ above by an aligned-heterostructure route instead of a twist angle; not from the course, §5 hybrid recipe result (Graphene + Monolayer Boron Nitride), lives as a World 10 wild rather than a World 4 one |
| chernInsulator (4, new type) | Manganese Bismuth Telluride (MnBi$_2$Te$_4$) | Real intrinsic magnetic topological insulator — the actual zero-field QAHE/Chern-insulator material, standalone (not a hybrid recipe result) |
| superconductor (5) | Aluminum (Al) | Conventional phonon-mediated BCS s-wave superconductor |
| superconductor (5) | Lead (Pb) | Same family, higher $T_c$ |
| superconductor (5) | YBCO / cuprates | Unconventional nodal d-wave high-$T_c$ superconductor, still ordinary (non-topological) pairing |
| superconductor (5) | Lanthanum Decahydride (LaH$_{10}$) | Record near-room-temperature $T_c$ (~250–260 K at ~170 GPa) — still ordinary phonon-mediated BCS pairing, just driven to extremes by hydrogen's own light, strongly-coupled phonons in the hydride's clathrate cage; not from the course, added as a modern high-pressure-superconductivity flagship |
| chernSuperconductor (5) | Uranium Ditelluride (UTe$_2$) | Leading spin-triplet/chiral superconductor candidate — critical fields far beyond the Pauli limit and contested reports of time-reversal-symmetry breaking and chiral in-gap surface states; standalone (not a hybrid recipe result), the same "real intrinsic compound anchors its own topic's world" treatment MnBi₂Te₄ gets above; genuinely still a *candidate*, not settled, unlike this world's other (engineered/hybrid) chernSuperconductor members |
| chernSuperconductor (5, engineered) | NbSe$_2$/CrBr$_3$ heterostructure | s-wave SC + spin-orbit + exchange field engineered into a topological superconductor — genuine topological pairing, so it (and its Majorana Split move) live here rather than plain `superconductor` |
| chernSuperconductor (5, engineered, hybrid) | Iron chains on lead (Fe/Pb) | Majorana-chain platform — topological superconductivity from a magnetic chain on an s-wave SC; §5 hybrid recipe result (world 6's Iron + this world's Lead), lives as a World 10 wild rather than a World 5 one |
| superconductor (5) | Niobium (Nb) | Highest-$T_c$ elemental BCS superconductor at ambient pressure, same conventional family as Aluminum/Lead |
| superconductor (5) | Tantalum Disulfide, 1H phase (TaS$_2$) | Metallic/superconducting TMD monolayer in its own right — distinct from the 1T phase below, and the other half of §5's 1T/1H-TaS₂ heterostructure hybrid recipe |
| chernSuperconductor (9) | Iron Telluride/Selenide (Fe(Te,Se)) | Hosts Yu-Shiba-Rusinov *and* vortex-bound Majorana defect states (Zhang et al., Science 2018) — the vortex Majorana observation is genuine topological superconductivity, so this is `chernSuperconductor` rather than plain `superconductor` |
| superconductor (9, textbook fill-in) | Niobium Diselenide (NbSe$_2$), STM-imaged impurities | Friedel oscillations / impurity-resonance textbook platform, ordinary (non-topological) disorder physics; also pairs with CrI₃/CrBr₃ in §5's topological-SC heterostructure recipes |
| classicalMagnet (6) | Iron (Fe) | Classic itinerant ferromagnet, magnon carrier |
| classicalMagnet (6) | Cobalt (Co) | Same family |
| classicalMagnet (6) | Chromium Triiodide (CrI$_3$) | Van der Waals ferromagnet with an observed topological magnon gap |
| classicalMagnet (6) | Chromium Tribromide (CrBr$_3$) | Same van der Waals ferromagnet family as CrI₃ — pairs with Niobium Diselenide in Kezilebieke et al., Nature 588, 424 (2020)'s topological-superconductor heterostructure, §5 |
| classicalMagnet (6) | Yttrium Iron Garnet (YIG, Y$_3$Fe$_5$O$_{12}$) | Ferrimagnetic (two antiparallel sublattices, unequal moment), with the lowest known magnon damping of any material — the real substrate nearly every magnon-transport/magnon-BEC experiment actually runs on; not from the course, added as `classicalMagnet`'s magnonics flagship |
| classicalMagnet (9) | Manganese (Mn) | Elemental Mn's own complex itinerant antiferromagnetism is beside the point — it's the textbook itinerant local-moment magnet for this topic |
| quantumSpinLiquid (7, textbook fill-in) | Strontium Copper Borate (SrCu$_2$(BO$_3$)$_2$) | Shastry–Sutherland lattice — exactly-solvable dimerized/entangled ground state, a standard tensor-network benchmark material and a textbook triplon host |
| quantumSpinLiquid (7, textbook fill-in) | Thallium Copper Chloride (TlCuCl$_3$) | Quantum spin-dimer compound — another textbook triplon example |
| quantumSpinLiquid (7) | Herbertsmithite | The one real compound session 7 itself names, motivating MPS/tensor-network methods (kagome local moments); a Z2-spin-liquid candidate, a genuine vison host |
| quantumSpinLiquid (7, textbook fill-in) | Yttrium Barium Nickel Oxide (Y$_2$BaNiO$_5$) | S=1 Haldane spin chain — its ground state is closely related to the AKLT state, the exactly-solvable valence-bond-solid wavefunction matrix product states were introduced to describe in the first place |
| quantumSpinLiquid (8) | α-Ruthenium Trichloride (RuCl$_3$) | Candidate Kitaev spin liquid — Z2 topological order, a genuine vison host |
| quantumSpinLiquid (8) | Ytterbium Magnesium Gallium Oxide (YbMgGaO$_4$) | Triangular-lattice spin-liquid candidate |
| quantumSpinLiquid (8, engineered) | 1T-TaS$_2$ on 1H-TaS$_2$ | Engineered 2D Kondo-insulator heterostructure — wired in as §5's 1T/1H-TaS₂ heterostructure hybrid recipe, fusing the two standalone phase entries below |
| quantumSpinLiquid (8) | Tantalum Disulfide, 1T phase (TaS$_2$) | Star-of-David CDW Mott insulator / quantum-spin-liquid candidate (Law & Lee 2017) — the other half of the 1T/1H heterostructure above |
| quantumSpinLiquid (8) | Cerium Zirconate Pyrochlore (Ce$_2$Zr$_2$O$_7$) | Quantum-spin-ice candidate — no magnetic order or freezing down to ~20 mK, a continuum read as evidence for a U(1) quantum spin liquid (emergent photon, gapped spinons); its gauge structure is U(1), not the type's nominal Z2 vison, grouped in here anyway the same way triplon already is, a deliberate simplification; not from the course |
| kondoHeavyFermion (8, new type) | Ytterbium Rhodium Silicide (YbRh$_2$Si$_2$) | The flagship heavy-fermion/Kondo-lattice quantum-critical-point material — gives Kondo's own world a genuine Kondo-lattice compound, distinct from the frustrated-magnet spin-liquid candidates above |
| kondoHeavyFermion (8) | Cerium Cobalt Indide (CeCoIn$_5$) | A second Kondo-lattice flagship — Ce 4f moments hybridize into ~100-electron-mass quasiparticles right next to an antiferromagnetic quantum critical point; its own T→0 ground state is actually a d-wave superconductor built from those heavy quasiparticles, but the Kondo-lattice physics is what defines the compound, so it stays `kondoHeavyFermion` rather than `superconductor`; not from the course |
| multiferroic (6, new type) | Nickel Diiodide (NiI$_2$), monolayer | Type-II multiferroic from noncollinear/helimagnetic order down to the monolayer limit (Song et al., Nature 2022) — hosts genuine electromagnons, the type's flagship. Same session (classical magnetism/magnons) as classicalMagnet above, so it's a World 6 wild too rather than its own world |
| multiferroic (6, new type, hybrid) | Twisted CrI₃ | §5 hybrid recipe (CrI₃ + CrI₃) — noncollinear moiré spin textures theoretically predicted (not yet confirmed) to induce magnetoelectric coupling; untwisted CrI₃ itself is only classicalMagnet |
| multiferroic (6, new type) | Bismuth Ferrite (BiFeO$_3$) | The flagship room-temperature single-phase multiferroic — large switchable polarization (from the Bi³⁺ lone pair) coexisting with G-type antiferromagnetic order carrying a spin cycloid, with electromagnons actually observed (not just predicted, unlike Twisted CrI₃ above); not from the course |
| ferroelectric (new type) | Barium Titanate (BaTiO$_3$) | The textbook ferroelectric — its Ti⁴⁺ ion sits off-center below ~120°C, giving the lattice a spontaneous switchable polarization; no course topic covers ferroelectricity specifically, so like every other type without a session of its own it lives in World 9, which can host any type |
| ferroelectric (new type) | Germanium Telluride (GeTe) | Robust room-temperature ferroelectric Rashba semiconductor — a stronger, more switchable ferroelectric than BaTiO₃'s own ~120°C transition, same type, also a World 9 wild |
| ferroelectric (new type) | Hafnium Oxide (HfO$_2$), ferroelectric phase | CMOS-compatible ferroelectric behind real FeRAM/FeFET devices — pristine, undoped epitaxial thin films switch too (Cheema et al., Nature 2020; strain rather than a dopant stabilizes the polar orthorhombic phase); bulk, unstrained HfO₂ is the ordinary centrosymmetric phase and not ferroelectric at all, so this specifically means the thin-film phase; not from the course, also a World 9 wild |
| chernSuperconductor (10, hybrid) | InAs/Al Majorana Wire | Engineered from an ordinary s-wave superconductor (Aluminum) proximitizing a strong-spin-orbit semiconductor (InAs) — genuine topological pairing, so `chernSuperconductor` rather than plain `superconductor`; §5 hybrid recipe result |
| adaptive (10) | — (no compound, by design) | Only `WORLD_RIVALS[10]`'s finale boss ("a model of you") — World 10's ordinary wilds are not 'adaptive', see the note above the crystal-database table |

Bismuth Selenide (magnetically doped) and Samarium Hexaboride are documented candidates
not yet wired into `WORLD_CRYSTALS` — every other row above is live in the code. Weyl
semimetals (Tantalum Arsenide) were considered and dropped from the roster entirely
(`TAXONOMY.txt`'s own open-questions note): a Weyl semimetal's chiral Fermi arcs and
chiral anomaly are genuinely distinct 3D gapless physics, not a `chernInsulator`
variant, so folding TaAs into that type would have been a physics error rather than a
simplification — it's absent rather than miscategorized.

World 9's actual wild-encounter pool (`getWildPool`) is wider than its own table rows
above: on top of its own dedicated defect compounds, it also spawns every non-hybrid
material from worlds 1-8 (deduped by name), the same "a defect/impurity resonance can
form in any host crystal" reasoning `RIVAL_9_TYPES`/`rollRival9Type` already use for its
rival, literalized for ordinary encounters too. Hybrid-recipe results are excluded from
that borrowed set — a fused state isn't "a defect in an earlier crystal."

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
silhouette/color, so e.g. Manganese Oxide and Nickel Oxide (both `classicalMagnet`-type clusters)
read as individuals rather than one recolored shape reused twice. See STYLE.md's "Crystal
sprites" section for the mechanism.

**A player-created hybrid material (§5's Majorana mechanic) renders as an actual mixture
of both parents**, not one flat blended color — both parents' own shapes overlap
off-center, normal-alpha-blended (not additive; additive washes out against the
overworld's own non-black sky) so the overlap region genuinely mixes both colors, split by
a glowing seam. See `data/materials.ts`'s `combineMaterials`/`hybridParents` and
STYLE.md's "Crystal sprites" section.

World 10's wild pool (`WORLD_CRYSTALS[10]` in `data/materials.ts`) hosts exactly the
game's actual named hybrid-recipe results (§5's `HYBRID_RECIPES`) and nothing else —
worlds 1-9 never spawn a hybrid-recipe result as an ordinary wild, so the meta-world's
corridor plays back the player's own fusions/discoveries literally rather than as echo
flavor text. Standalone compounds whose own type has no dedicated world of its own
(MnBi₂Te₄ and Monolayer NiI₂, whose types tie to existing topics' sessions; Barium
Titanate and GeTe, whose ferroelectric type ties to none) instead live in the earlier
world their topic anchors to, or in World 9 (which can host any type) if it anchors to
none — see the crystal-database table above. `WORLD_RIVALS[10]` ("The Adapted"), a
separate table from the wild pool, is the one 'adaptive'-type entry in the game — a "no
real compound, a model of you" finale boss.

**Subtype combination flavor (real-compound tie-ins):** the same mechanic from §3
(main type + subtype → new material) has ready real-world flavor text once crystals are
named after compounds:
- superconductor + classicalMagnet subtype → spin-triplet superconductor: Strontium Ruthenate
  (Sr$_2$RuO$_4$, historic triplet-SC candidate) or twisted graphene trilayers (observed
  spin-triplet SC under applied field, per session 5).
- superconductor + topological subtype → chernSuperconductor: same engineered platforms
  the chernSuperconductor row above already implements (a quantumSpinHall base +
  NbSe$_2$/CrBr$_3$ heterostructure, or the Fe-chains-on-Pb Majorana platform).

**Attacks are quasiparticles, not abstract labels.** Every move is named after the
excitation that actually carries it (`game/src/data/materials.ts`'s `MOVES`), and each
renders as its own particle-effect animation in battle (`game/src/art/attackEffects.ts`):
a fast bolt for Phonon Beam/Electron Pulse/Spinon Swap/Triplon Surge/Chiral Current, an
expanding ring pulse for Magnon Pulse/Polaron Drag/Electromagnon Pulse/Plasmon Pulse/Ferron
Pulse/Higgs Oscillation/Helical Current, a converging/scattering particle burst for Anyon
Braid/Majorana Split/Heavy Fermion Pulse/Vison Loop. There is deliberately no "impurity
scattering" move — disorder isn't a particle a crystal emits, so it has no place in the
move roster as an abstract attack.

**A crystal can only use moves its own physics supports** — `game/src/data/materials.ts`'s
`MOVE_COMPATIBILITY` table fixes, per main type, which quasiparticle classes it can host
(`game/src/data/TAXONOMY.txt` is this table's hand-edited design source, see above). The
three ordinary band types split three ways by how far a carrier gets: `metal` (e.g.
Graphene) gets Electron Pulse, Phonon Beam, *and* Plasmon Pulse (only a partially filled
band carries a plasmon); `semiconductor` (Silicon) gets Electron Pulse and Phonon Beam,
its gap narrow enough for an ordinary band electron but not a free electron gas;
`insulator` (Magnesium Oxide) gets Phonon Beam *and* Polaron Drag but not Electron Pulse,
its gap too wide for an ordinary band electron to get through even though the ionic
lattice self-traps a polaron more readily than a metal or semiconductor would. None of the
three gets Magnon Pulse, since none has magnetic order to carry one. Every other class is
gated the same way to whichever types the actual physics motivates it for (Magnon Pulse →
magnetically ordered types; Chiral Current → integer-Chern types; Helical Current →
time-reversal-protected edge/surface types; Anyon Braid → fractional-Chern only; Majorana
Split → `chernSuperconductor` only, genuine topological pairing required; Higgs
Oscillation → any superconducting type; Spinon Swap/Vison Loop/Triplon Surge →
quantum-spin-liquid; Heavy Fermion Pulse → Kondo-lattice only; Ferron Pulse →
ferroelectric/multiferroic; Electromagnon Pulse → multiferroic only). This is enforced
everywhere the player's moveset shows up: the battle move menu (`getBattleMoves` = learned
moves ∩ compatible moves) and Noether's shop (same intersection, so she only ever offers
what the player's *current* crystal form can actually carry — see the transmutation
mechanic in §5).

**One deliberate exception: Kondo's screening moves aren't gated by a crystal's
physics at all.** `screening` (Screening Pulse, Scattering Drag, Breakdown
Cascade, §5) is on every main type's `MOVE_COMPATIBILITY` list, purchasable and
usable from any form — they deal in a generic scattering/decoherence process any
crystal's own disorder or environment can carry, not a quasiparticle tied to one
type's specific band structure. Laughlin's two Analytic moves (`skyfallBeam`/
`groundEruption`, §5) and Skłodowska-Curie's two Ultimate moves (`ultimateMeteor`/
`ultimateNova`, §5) reach the same "usable from any form, never mismatches" result a
different way: their static `class` simply defaults to `phonon`, the same universal,
physics-motivated class Phonon Beam itself carries, rather than needing a class
of their own. An Analytic move's real risk/reward comes from the question
`BattleScene.showAnalyticQuestion` asks before the hit resolves: right answer
doubles the damage, wrong answer halves it. An Ultimate move instead asks three
questions in a row (`BattleScene.showUltimateQuestions`) and is all-or-nothing:
every answer correct lands the hit at full (already very high, see below) power,
any wrong answer whiffs it for zero. Separately, both Laughlin and Skłodowska-Curie
let the player tell them which quasiparticle each of their moves should carry
instead (§5's `getTunedMoveClass`, shared by both guardians' shops via the same
registry/save `moveClassTuning` map) — that choice feeds back into the
quasiparticle-mismatch rule below on top of the question's own multiplier, so a
tuned move mismatches a defender exactly like an ordinary attack of that class
would; an untuned one simply keeps the default `phonon` class's never-mismatches
behavior (still purchasable and usable from any form either way).

**Battle dynamics are deliberately simple: one type-interaction rule, not a chart.**
A per-attack, per-defender-main-type strong/weak effectiveness chart would stack a
second, untested multiplier on top of the quasiparticle-mismatch rule below for no real
gain in clarity, so there is no such chart. The single rule that governs type
interactions is §4's "quasiparticle mismatch": double damage when the defender's own
physics can't host the attacking move's quasiparticle class at all. See
`data/materials.ts`'s `canHost()`/`MOVE_COMPATIBILITY` and `BattleScene.resolveHit`.

**Move power scales with how unconventional the quasiparticle is.** An ordinary lattice
vibration or band electron is weak; a topological or non-Abelian excitation is strong — so
every move the player can buy from Noether outpowers the free starting Phonon Beam. Six
tiers, low to high (`data/materials.ts`'s `MOVES`): Phonon Beam (`phonon`, every crystal
has a lattice) < Electron Pulse (`electron`, an ordinary band electron) < Magnon Pulse /
Plasmon Pulse / Ferron Pulse (`magnon`/`plasmon`/`ferron`, tied — an ordinary collective
mode of a magnet, a metal, or a ferroelectric, none more exotic than the others; session
9's own RPA treatment names "the plasmon" as a quasiparticle in exactly those words) <
Polaron Drag / Electromagnon Pulse / Triplon Surge (`polaron`/`electromagnon`/`triplon`,
tied — a lattice-dressed carrier, a magnon-phonon hybrid, and a dimer magnet's own confined
triplet mode) < Spinon Swap / Vison Loop / Chiral Current / Helical Current / Higgs
Oscillation / Heavy Fermion Pulse (`spinon`/`vison`/`chiral`/`helical`/`higgs`/
`heavyFermion`, tied — fractionalized or topologically protected, but none of them
non-Abelian) < Anyon Braid / Majorana Split (`chargedAnyon`/`majorana`, tied for the most
exotic tier the ordinary Attacks roster covers: fractional braiding statistics and
non-Abelian zero modes).
Because Phonon Beam (`phonon`) is on every type's
`MOVE_COMPATIBILITY` list, it can never trigger the quasiparticle-mismatch double-damage
rule above — the one universal move is also the one that never gets the mismatch bonus, by
design. Laughlin's two Analytic moves (`skyfallBeam`/`groundEruption`) sit at a middling
base power below the ordinary tiers on purpose — their real payoff is the answer-gated
2x/0.5x multiplier above, not raw power. Kondo's three moves (Screening Pulse, Scattering
Drag, Breakdown Cascade, §5) sit at the very bottom of the ordering instead, on par with
Electron Pulse — their real payoff is the 3-turn status effect each one deterministically
inflicts (§4), not raw power either. Skłodowska-Curie's two Ultimate moves (power 100, ten
times an Analytic move's power — above even Anyon Braid/Majorana Split, the ordinary
roster's own most exotic tier) are the exception to "power isn't the point": the
3-questions-all-correct gate is steep enough that raw power *is* the payoff once it's
cleared.

## 4. Battle system

Turn-based, speed-ordered by Velocity.

**Status effects (Kondo's three moves, §5).** Kondo teaches three moves that each
deterministically inflict one 3-turn status effect on the defender — never randomly rolled,
the player picks the effect by picking the move:
- **Screened** (Screening Pulse) — the defender's own outgoing damage is multiplied down
  (×0.7) for 3 turns.
- **Slowed** (Scattering Drag) — the defender's effective Velocity is reduced (×0.7)
  for 3 turns, changing whether that side still swings first each round.
- **Weakened** (Breakdown Cascade) — the defender's effective Correlation is reduced
  (×0.7) for 3 turns, raising the damage it takes (Correlation scales incoming damage via
  `10 / correlation`, above).

None of the three status names double as a `MoveClass` — `majorana` and
`polaron` are separately Majorana Split's and Polaron Drag's classes, unrelated
quasiparticle physics, so a status name matching one of those would read as if this
generic scattering process were tied to that specific move instead.

Only one status can be active per side at a time — a fresh application replaces whatever was
already there rather than stacking, matching the deliberately simple "one type-interaction
rule, not a chart" philosophy above. Implemented generically per-side in
`BattleScene.resolveHit` (the same multiplier-term shape every other `resolveHit` factor
already uses) rather than hardcoded to "opponent only," even though only the player can
currently learn the moves that inflict them — no `WORLD_CRYSTALS` entry knows them yet. Ticks
down once per round (each side is the defender of exactly one hit per round) and expires with
its own battle-log line appended the same way a mismatch/crit clause stacks onto a hit's log
line. Status effects are battle-only and reset at the start of every fight — never persisted
to the save. A small pill under each side's HP bar in battle shows which status (if any) is
active and how many turns remain.

**Quasiparticle mismatch.** The sole type-interaction rule in battle (§3): a defender
whose own type can't physically host the attacking move's quasiparticle class at all
(`data/materials.ts`'s `MOVE_COMPATIBILITY`, checked via `canHost()`) takes that
hit at double force (`BattleScene.resolveHit`) — a plain band insulator has no magnetic
order to damp a magnon pulse with, so it lands unmitigated. Applies symmetrically
to both sides, same as every other `resolveHit` term. Surfaced in the battle log as "No
natural defense against this!".

**Move menu is grouped by kind and paged one kind at a time, not one flat list.**
`BattleScene.drawMoveMenu` splits the currently usable moves (`getBattleMoves`) into up to
four sections -- **Attacks** (every ordinary physics-gated move -- any move that isn't in
`ANALYTIC_MOVE_IDS` or `ULTIMATE_MOVE_IDS` and whose `class` isn't `'screening'`),
**Analytic** (Laughlin's two answer-gated moves, identified by move id rather than by any
shared class, tagged `★` with their own "right=2x wrong=½x" legend line under the header),
**Ultimate** (Skłodowska-Curie's two answer-gated moves, tagged `★★★` with their own
"3/3 correct or it whiffs" legend line), and **Screening** (Kondo's currently-active move, at
most one, since `getBattleMoves` only ever surfaces whichever one is `kondoActiveMove`, §5)
-- but renders only the section the player is currently paged to (`moveSectionIndex`), not
all of them stacked. A section only counts as a page at all if it has at least one usable
move, so a player with no Laughlin/Skłodowska-Curie moves bought or no Kondo move active
never sees an empty page, and the pager (◀/▶ buttons plus the Left/Right keys,
`switchMoveSection`) is hidden entirely once there's only one page to switch between. These
groups work differently enough from an ordinary attack (and from each other) that a flat
stacked list blurred the distinction -- and paging instead of stacking means a page's own row
height (`drawMoveMenu`'s `rowH`) is budgeted only against that one section's move count, not
the worst case across every section at once, so an 'adaptive'-type
crystal (world 10, see §3) hosting the broadest set of `MoveClass`es of any type -- every
class except the multiferroic/ferroelectric-only `'electromagnon'`/`'ferron'`,
deliberately left off its `MOVE_COMPATIBILITY` list the same way `'phonon'`/`'screening'`
are on every list -- no longer has to squeeze Analytic/Ultimate/Screening rows into the same
panel it isn't even showing right now. Each button also shows its power and, computed against
the current opponent's type, a `!!2x` tag when the quasiparticle-mismatch double-damage rule above
applies, plus a one-line top-of-panel legend spelling out that symbol.

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
Beam. Reaching world 1's middle tile for the first time introduces the guardian Noether (§5),
who sells every other move (`SHOP_MOVE_IDS`) for qumatokens, priced by move power
(`OverworldScene.shopCost`, currently power × 5) -- filtered down to whatever the player's
*current* crystal form can physically carry (§3's `MOVE_COMPATIBILITY`), so a
semiconductor-type player (Silicon, by default) is only ever offered Electron Pulse until
they transmute into a form that supports more. Unlocked moves persist in the Phaser registry's `unlockedMoves` entry (a global
"moves learned," never erased by transmuting) and become available as battle buttons in
`BattleScene` once filtered through that same compatibility check
(`getBattleMoves` = learned ∩ compatible). The move list renders as a docked panel on
the right of the field (`BattleScene.drawMoveMenu`).
Noether's shop panel also carries a second tab for spending qumatokens on the player's own
Quantumness/Velocity/Correlation stats (§3). The actual "leave this world" action -- a
footer button that fights the world's rival crystal the first time it's clicked (see §2),
then becomes "Continue to World N+1" once that rival is beaten
(`OverworldScene.tryAdvanceToNextWorld`) -- lives only in the goal panel, not Noether's
(or any guardian's) own panel, since the goal is where that world's boss actually stands (§2).

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
(`OverworldScene.recordDiscovery`); the Hub's Materialdex hotspot (§2) indexes every real
compound in the game (`data/materials.ts`'s `allCrystals()`), not just discovered ones --
an entry not yet found shows as "???" with a masked crystal render rather than being
absent from the list entirely, so the index reads as a checklist of the whole game.
Searchable by name and filterable by type, one entry (name, blurb, and the compound's own
rendered crystal) shown per page (`HubScene.renderMaterialdexPage`). A compound that also
carries a short chemical-formula/acronym form (`data/types.ts`'s `Material.shortName`, e.g.
"Manganese Oxide (MnO)", "Yttrium Iron Garnet (YIG)") shows it in parentheses right after the
full name (`data/materials.ts`'s `materialDisplayName`) -- optional, only set where a
genuinely shorter, recognizable form exists; a compound whose own `name` already is that
short form (e.g. "YBCO", "Bi₂Te₃") doesn't carry one.

## 5. Guardians, economy, and story arc

Every one of the ten worlds has its own guardian, waiting mid-corridor
(`OverworldScene`'s `WORLD_GUARDIANS` table, every entry's `tile: 'middle'`) rather than
at the goal -- the goal tile is occupied by that world's boss (see below), so a guardian
is someone the player meets partway through the journey, not a gate to it. Every
guardian stays reachable from anywhere afterward via the Enter-menu's Guardians panel
once met (`showGuardiansPanel`, `data/save.ts`'s `metGuardians`). Every guardian has a
real mechanic (Noether, Bloch, Dresselhaus, Laughlin, Majorana, Anderson, Bohr, Kondo,
Franklin, Skłodowska-Curie) -- a guardian without one yet would fall through to the
shared `OverworldScene.showGuardianLore` panel (avatar + quote only), but nothing
currently does. World 10's guardian (Skłodowska-Curie) is gated behind actually walking
to World 10 rather than any earlier "met" save state -- her id, `sklodowskaCurie`, is
deliberately distinct from any id used earlier in the game, so no pre-existing save
state can mark her met before the player has actually reached her.

- **Noether** → world 1 middle → sells every extra attack move and stat upgrade in the
  game (fitting, since Noether's theorem is literally "symmetry implies a conservation
  law" -- here, conserving enough qumatokens gets you a new move or a sharper stat)
- **Bloch** → world 2 middle → folds space between worlds: teleports the player to any
  world they've already visited (`OverworldScene.showBlochHub`) -- fitting, since a
  Bloch state is a superposition spread across every unit cell, not pinned to one.
  The destination list paginates (`renderPagedButtons`, see below) once it grows past
  a page -- routine in Superposition Mode (see §7), which pre-seeds every built world
  as visited, making Bloch's hub able to jump to any of them immediately; walking
  through a world door (below) is the other way to move between worlds, one step at
  a time rather than a jump to an arbitrary destination
- **Dresselhaus** → world 3 middle → lets the player transmute into any *single* crystal
  they've already defeated (`OverworldScene.showDresselhausPanel`/`transmuteInto`) -- fitting,
  since the Dresselhaus effect (bulk-inversion-asymmetry spin-orbit coupling) is the real
  ingredient that locks spin to momentum in models like BHZ, the route an ordinary band
  structure actually takes into a topological one, and beating a crystal means understanding
  its own band structure well enough to wear it for a while. Transmuting changes the player's
  look, HP cap, and which moves are currently usable (§3), without erasing any move already
  learned. **Excludes every hybrid-recipe result** (`data/materials.ts`'s `isHybridMaterial`,
  every one of which lives only as a World 10 wild, never an earlier one) -- becoming a
  fused state is specifically Majorana's mechanic below, not this one. In Superposition Mode the candidate
  list is every non-hybrid crystal in the game (`data/materials.ts`'s `allCrystals()`, filtered) rather
  than only ones actually defeated
- **Laughlin** → world 4 middle → sells two quiz-gated moves (`skyfallBeam`,
  `groundEruption` -- `OverworldScene.showLaughlinPanel`, `data/materials.ts`'s
  `ANALYTIC_MOVE_IDS`, a hardcoded pair of move ids rather than a shared class --
  neither move has a class of its own to be identified by, see below) -- fitting,
  since Laughlin's own physics (the fractional quantum Hall wavefunction) is world 4's
  topic. Using one asks a physics-equation question first (`data/quiz.ts`'s
  `ANALYTIC_QUESTIONS`, `BattleScene.showAnalyticQuestion`): answer right and the hit
  lands at 2x, answer wrong and it lands at 0.5x. Each question is tagged with the
  world number(s) whose course topic it belongs to, and `getAnalyticQuestion(visitedWorlds)`
  draws only from questions tagged with a world the player has already visited (falling
  back to the full unfiltered pool if that intersection is ever empty) -- an early
  player is quizzed on early-world physics, not topics they haven't reached. Each move
  also gets its own dramatically flashier, per-move (not per-class) visual, deliberately
  reading as stronger than every other move class (`art/attackEffects.ts`'s
  `ANALYTIC_SHAPES`/`playBeam`/`playEruption`):
  `skyfallBeam` drops a multi-layer column of light from off the top of the screen --
  a white-hot core, two swirling side-rays, a trail of falling sparks, and a radiant
  sun expanding at the point of origin; `groundEruption` bursts a wide double
  shockwave ring and a bright geyser core up through nearly twice the shard count of
  an ordinary burst. Each move's static `class` simply defaults to `'phonon'` --
  the same universal, always-hostable class Phonon Beam itself carries -- so an
  untuned move is purchasable/usable from any form and never mismatches, without
  needing a class of its own. Their displayed name is always "`<quasiparticle>` Beam"/
  "`<quasiparticle>` Eruption" (`tunedMoveDisplayName`), defaulting to "Phonon Beam"/
  "Phonon Eruption" while untuned. Buying a move (or later revisiting Laughlin) also opens a
  quasiparticle-picker sub-panel (`showMoveClassPicker`, offering
  `TUNABLE_MOVE_CLASSES` -- every ordinary Attacks-section class (i.e. every class
  except Kondo's `'screening'`) -- filtered down to only the ones the player's
  *current* form can actually host, `canHost(playerMaterial.type, cls)`: a class as
  narrow as `'electromagnon'` (only the `multiferroic` type hosts it) only ever
  shows up while the player is wearing a multiferroic form, rather than being a free
  "always mismatch nearly every opponent" pick regardless of form. `'phonon'` is on
  every `MOVE_COMPATIBILITY` list, so the filtered list is never empty) that assigns
  the move's registry/save `moveClassTuning[moveId]` entry (a map shared with
  Skłodowska-Curie's Ultimate moves below, since both guardians' shops read and write
  the same generic tuning helpers), labeled with whichever
  ordinary move already carries that class (`quasiparticleLabel`, e.g. "Magnon
  Pulse" for `'magnon'`) rather than the class id itself. This choice only feeds
  `getTunedMoveClass`, which `BattleScene`'s quasiparticle-mismatch check reads in
  place of `move.class` for these two ids (see §3/§4) -- still purchasable/usable
  from any form and still asks its question regardless of tuning. The displayed name
  always folds in the current quasiparticle (`tunedMoveDisplayName`, e.g. `skyfallBeam`
  tuned to `'magnon'` reads as "Magnon Beam" everywhere -- the move menu, the
  question panel, the battle log), built from the quasiparticle's own label plus each
  move's fixed shape word ("Beam"/"Eruption") rather than a second hand-authored word
  list. An unbought move has no
  assignment yet; an already-bought one shows "tuned to `<name>`" with a free
  "Retune" click back into the same picker (re-opening the same current-form
  filter, so retuning after a transmute only offers what the *new* form can host),
  or "untuned" if never assigned -- untuned simply means the mismatch check keeps
  reading the move's own default `'phonon'` class. The picker only filters at *pick*
  time, though, so a tuned assignment can still outlive a later transmute into a
  form that can't host it; `getTunedMoveClass` guards that case by falling back to
  `'phonon'` (Phonon Beam, the one class every form hosts) whenever the player's
  *current* form can't host the saved assignment, and `tunedMoveDisplayName`/the
  shop label follow the same fallback so the name and the mismatch math never
  disagree -- the shop label reads "tuned to `<name>`, reverted to Phonon Beam (this
  form can't host it -- retune)" in that state.
- **Majorana** → world 5 middle → lets the player fuse two crystals they've already
  defeated into a new hybrid material and become it immediately
  (`OverworldScene.showMajoranaPanel`/`combineMaterials`) -- but only a curated
  catalog of named parent pairs (`data/materials.ts`'s `HYBRID_RECIPES`/
  `hybridRecipeResult`), keyed by parent *name* rather than main type, not any two
  defeated crystals. The catalog is closed by name rather than governed by a generic
  "these two main types always produce that main type" rule, because such a rule would
  have to forbid same-type pairs on the reasoning that "fusing two superconductors isn't
  a new phase" -- but real platforms include exactly that (Twisted Bilayer Graphene from
  two graphene sheets) -- so a pair with no named recipe simply can't be fused, same-type
  or not. Every recipe mirrors a real (or credibly engineered) platform -- an InAs/Al
  Majorana nanowire; two Graphenes → Twisted Bilayer Graphene (magic-angle
  superconductivity); CrI₃ + NbSe₂ or NbSe₂ + CrBr₃ → topological-superconductor
  heterostructures (the latter is Kezilebieke et al., Nature 2020); Iron + Lead → the
  Fe/Pb Majorana chain, literalizing the mechanic's own worked example; CrI₃ + CrI₃ →
  Twisted CrI₃, a *theoretically proposed* (not yet confirmed) multiferroic from
  noncollinear moiré spin textures; two 2H-phase MoTe₂ monolayers → the existing
  Twisted Bilayer MoTe₂ entry (its own "zero-field fractional quantum Hall from
  topological flat bands" already
  *is* the fractional Chern-insulator result, so the recipe resolves to that entry rather
  than a duplicate); 1T-phase + 1H-phase Tantalum Disulfide → a Kondo-screened
  heterostructure; HgTe + CdTe → HgTe/CdTe Quantum Well, the original
  Bernevig-Hughes-Zhang quantum spin Hall platform (König et al., Science 2007) --
  neither parent is topological on its own, only the engineered quantum well is;
  Graphene + Monolayer Boron Nitride → Rhombohedral Pentalayer Graphene/hBN Moiré, the
  2023-2024 zero-field fractional quantum anomalous Hall result -- real graphene/hBN
  devices are aligned for exactly this reason, though the recipe (like every other one
  here) is narrative rather than literal 1:1 stoichiometry, since the real result is five
  graphene layers, not one.
  Recipe results are ordinary `WORLD_CRYSTALS` entries (all of them World
  10's pool, see §2/§7 below) rather than synthesized on the fly, so a hybrid
  encountered wild and one fused by hand are the exact same crystal; `combineMaterials`
  additionally attaches `hybridParents` so the fused form still renders as an actual
  visual mixture of both parents. Deliberately no memory of earlier fusions to instantly
  re-become -- every visit picks a fresh pair the same as any other combine; the player's
  *current* form (which may already be a hybrid) still persists on its own via `playerForm`
  regardless. In Superposition Mode the ingredient pool is every crystal in
  the game, unfiltered (unlike Dresselhaus above) -- a hybrid's own defeated-material entry,
  if any, simply won't match any `HYBRID_RECIPES` pairing as a further parent, so no extra
  filtering is needed here
- **Anderson** → world 6 middle → "dopes in" a crystal the player has defeated as an
  impurity, then teaches one specific move from that crystal's own moveset
  (`OverworldScene.showAndersonPanel`/`learnImpurityMove`) -- a two-step pick (host,
  then which of its moves to learn). Picking a host sets it as the persisted
  `andersonDopant` (save.ts), replacing whatever was doped in before -- only one
  impurity species at a time. The learned move is an ordinary append to
  `unlockedMoves`; whether it actually shows up in the battle menu is gated by
  `MOVE_COMPATIBILITY` (§3) checked against the *union* of the player's own current
  form and the currently doped-in impurity's type (`getBattleMoves`) -- an impurity's
  channel is real for as long as the impurity stays doped in, and disappears the
  moment a different crystal is doped in instead, the same way a real dopant atom's
  bound states vanish if you swap in a different dopant species. Distinct from
  Dresselhaus (become the whole state) and Majorana (fuse two states together):
  Anderson borrows a single excitation channel without becoming anything. Host
  pool excludes any `isHybridMaterial` (a Majorana fusion, or one of world 10's own
  named recipe-result wilds) -- doping in an impurity is meant to be one real compound's
  own excitation, not a channel a fusion already borrowed from two others. In
  Superposition Mode the host pool is every non-hybrid crystal in the game, same as
  Majorana's own ingredient pool
- **Bohr** → world 7 middle → teaches three passive abilities
  (`data/passives.ts`'s `BOHR_PASSIVE_IDS`, `OverworldScene.showBohrPanel`) --
  an always-on, whole-battle modifier rather than a move picked from the battle menu
  each turn. All three can be bought independently, but only one is ever active in
  battle at a time (registry/save `activePassiveByOwner`, keyed by owner and switched
  only by revisiting Bohr's panel), the same "learn several, equip one" shape Kondo's
  three screening moves already use (below) and Franklin's own passive kit shares
  (below) -- fitting Bohr's
  own historical role defending quantum mechanics' completeness against the EPR paradox:
  measure one half of an entangled pair and the other answers instantly, not through any
  signal crossing the distance:
  - **Correlated Response** -- whenever the opponent lands a critical hit against the
    player, the player's own very next move is guaranteed to crit.
  - **Nonlocal Correlation** -- the player's effective Correlation stat is boosted by half
    the opponent's own Quantumness stat, recomputed fresh at the start of each battle
    (`BattleScene.create`, since opponent stats are themselves computed fresh per battle
    via `enemyStatsForWorld`).
  - **Shared State** -- ~22% of damage the player deals is returned as healing, capped at
    the player's own max HP -- the entangled pair shares its fate.
- **Kondo** → world 8 middle → sells three moves (`OverworldScene.showKondoPanel`,
  `data/materials.ts`'s `KONDO_MOVE_IDS`) -- Screening Pulse, Scattering Drag, Breakdown
  Cascade -- each of which deterministically inflicts one of §4's three status effects
  (Screened, Slowed, Weakened respectively) on a successful hit rather than dealing much
  raw damage itself. `'screening'` sits on every type's `MOVE_COMPATIBILITY` list, the same
  "usable from any form" treatment Laughlin's and Skłodowska-Curie's moves get -- these deal in a generic
  scattering/decoherence process any crystal's own disorder or environment can carry, not a
  quasiparticle tied to one type's specific band structure, so they're named generically
  rather than after the heavy-fermion/Kondo-lattice physics that inspired them: Screening
  Pulse damps whatever local moment or correlated state the target has, weakening its own
  outgoing damage; Scattering Drag disorder-scatters the target's carriers, dragging its
  effective Velocity down; Breakdown Cascade collapses whatever protection the target's
  state has, raising the damage it takes. The player can buy all three independently, but
  only one is ever usable in battle at a time -- registry/save `kondoActiveMove`, switched
  only by returning to Kondo's own panel (a bought-but-inactive move stays in `unlockedMoves`,
  it just fails `getBattleMoves`' own extra check on top of the ordinary
  learned-∩-compatible one), since Kondo screening physically resolves one scattering channel
  at a time, not every channel at once -- the same reasoning DESIGN.md gives for excluding a
  generic "impurity scattering" damage move in §3 applies here too: this isn't free-form
  disorder, it's one specific screening process the player has to choose and commit to. The
  shop panel itself doubles as the switch -- a bought-and-inactive move gets a "Make `<name>`
  active" button, the active one shows a dimmed "`<name>` (active)" tag instead, the same
  dimmed-current convention Dresselhaus's transmute panel already uses. Buying the *first*
  Kondo move activates it automatically (still "picked by talking to Kondo," just in the same
  click as the purchase) so a fresh purchase is never invisible in battle with no explanation;
  buying a second or third on top of an already-active one doesn't, and switching between
  already-bought moves is always its own explicit click either way. Superposition Mode
  (`applySuperpositionLeveling`) seeds `kondoActiveMove` to Screening Pulse if it's still
  unset, for the same reason -- granting every move id doesn't help if none of Kondo's three
  actually pass `getBattleMoves`' extra check.
- **Franklin** → world 9 middle → teaches three passive abilities
  (`data/passives.ts`'s `FRANKLIN_PASSIVE_IDS`, `OverworldScene.showFranklinPanel`) --
  an always-on, whole-battle modifier rather than a move picked from the battle menu
  each turn. All three can be bought independently, but only one is ever active in
  battle at a time (registry/save `activePassiveByOwner`, switched only by revisiting
  Franklin's panel), the same "learn several, equip one" shape Bohr's own passive kit
  and Kondo's three screening moves already use -- fitting, since Franklin's own
  physics (X-ray diffraction of a defect-riddled or porous crystal -- a real,
  if lesser-known, tie between Rosalind Franklin's characterization work and
  world 9's "excitations and defects" topic) is world 9's topic, and a passive with no
  per-turn choice and no duration/tick-down is itself a clean fit for "always on for
  this battle," unlike Kondo's 3-turn status effects:
  - **Diffraction Shadow** -- incoming damage is multiplied down (×0.85) for the whole
    battle, the way porous carbon attenuates and scatters an X-ray beam.
  - **Satellite Reflection** -- landing a critical hit throws off a secondary
    diffraction peak: a bonus follow-up damage tick (~30% of that hit's damage)
    immediately after.
  - **Amorphous Halo** -- softens the quasiparticle-mismatch double-damage rule
    (2x → 1.5x, `canHost`/`BattleScene.resolveHit`) -- a diffuse, defect-broadened halo
    partially shrugging off a hit that would otherwise land unmitigated.
- **Skłodowska-Curie** → world 10 middle → the guardian of the finale world, regarded
  as the leader of the guardians' circle, teaching the game's one capstone mechanic:
  two "Ultimate Move" moves, `ultimateMeteor`/`ultimateNova` (`data/materials.ts`'s
  `ULTIMATE_MOVE_IDS`, displayed as "`<quasiparticle>` Meteor"/"`<quasiparticle>` Nova"
  via the same `tunedMoveDisplayName` Laughlin's Analytic moves use), each at power 100 --
  ten times an Analytic move's power, and the highest of any move in the game (§3).
  Landing one requires answering three quiz questions in a row, all correct
  (`data/quiz.ts`'s `ULTIMATE_QUESTIONS`/`getUltimateQuestions`, drawn from a broad,
  any-topic pool rather than restricted to visited worlds the way Laughlin's Analytic
  pool is -- fitting a finale that asks the player to show mastery of everything, not
  one world's own topic); `BattleScene.showUltimateQuestions` stops at the first wrong
  answer, since the outcome (a whiff for zero damage) is already decided at that point,
  and the turn is still spent either way. Her pricing model is deliberately not the flat
  per-move purchase every other tunable-move shop uses: instead of buying the move
  outright, each quasiparticle class costs `ULTIMATE_CLASS_UNLOCK_COST` (1000)
  qumatokens to unlock *per move*, the first time it's picked for that move -- after
  which retuning back to an already-unlocked class is free forever, mirroring how
  ordinary retuning is already free once a move is owned, except the unlock is
  per-class here rather than per-move. The first unlock of either move also adds it to
  `unlockedMoves` so it appears in the battle menu. Once tuned, an Ultimate move's
  battle-side quasiparticle-mismatch math reads exactly like Laughlin's Analytic moves
  (`getTunedMoveClass`, the same shared `moveClassTuning` map both guardians' shops
  write to) -- no battle-side special-casing beyond the 3-question gate above. A
  successful 3-for-3 hit plays a multi-phase "Final-Fantasy-style summon" animation
  (windup/summon-circle → charge → impact → aftermath, 4-6 seconds total,
  `art/attackEffects.ts`'s `playMeteor`/`playNova`) -- dramatically longer and flashier
  than any other move's effect in the game (`playBeam`/`playEruption`, by comparison,
  run under a second), fitting a move that's meant to read as the game's actual finale
  attack.

**Boss avatars.** Every built world's rival/boss (`WORLD_RIVALS`/`getRival`), while
still undefeated, stands visibly at the goal tile as a gigantic landmark
(`OverworldScene.spawnBossSprite`, `art/boss.ts`'s `makeBossCrystal`) -- a fused mass
of several shards around an oversized core, a pulsing danger aura, and orbiting
embers, so it reads as unmistakably more dangerous than an ordinary wild crystal
from a distance, before the player ever opens the goal panel. It's a pure visual
landmark: the fight itself is only reached through "Face the Rival" in the goal gate
panel. The same `makeBossCrystal` look carries into the fight itself -- `BattleScene`
renders a rival's opponent crystal at `BOSS_CRYSTAL_SIZE` (bigger than an ordinary
wild encounter's), shifted a bit left of the usual opponent spot so the wider
silhouette clears the move menu, instead of the plain `makeCrystal` every wild
battle uses.

**World doors.** Every built world has a doorway landmark standing at its
`startTile` (`OverworldScene.spawnDoorSprites`, `art/door.ts`'s `makeDoorSprite`) --
walking onto it opens a confirm panel offering to step back into World N-1, or into
the Hub for World 1 (`OverworldScene.showStartDoorPanel`/`returnToPreviousWorld`).
Landing in the earlier world this way puts the player on *its* goal tile with that
world's goal already marked reached, so arriving reads as walking in from the far
end rather than restarting that world's whole corridor. Once a world's rival is
beaten, a second door appears at its goal tile in place of the boss avatar, and
walking onto it reopens the same goal gate panel the boss's "Face the Rival" button
lived in, now offering "Continue to World N+1" -- so both directions between worlds
are ordinary walking, not just a menu action, alongside Bloch's teleport hub (§5)
for jumping to an arbitrary already-visited world. Both doors regenerate the
destination world's map fresh, the same "walking between worlds always lays out a
new corridor" rule §7 describes for every other transition.

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
the ending — beating each world's rival shows a short Decoherence-arc line
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
  breaks without it. `game/` is the only build; there is no separate no-install
  single-file `demo/` prototype.
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
  first load and whenever the player switches worlds -- the Hub door, Bloch's
  teleport, a world door (§5), or a debug warp alike; a round trip through
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
- **Data-driven content:** materials and moves live in `game/src/data/materials.ts`
  (including the per-world `WORLD_CRYSTALS` database), the sole source of truth —
  there is no separate `data/materials.json` draft to keep in sync — so balance/content
  can be tuned without touching engine/rendering code.
- **Onboarding is contextual, not one paged popup up front.** Seven short tips
  (`game/src/data/tutorial.ts`'s `TUTORIAL_TIPS`, keyed by `TutorialTipId`) each
  fire once per save, right as their own feature actually becomes relevant
  rather than all at once before the player has done anything: `lab` on first
  entering the Lab (`HubScene.maybeShowLabTip`); `controls` on first entering
  an Overworld world; `encounter` on the first wild-crystal bump; `battle` on
  first committing to a fight; `qumatoken` on first collecting a pickup;
  `guardian` on first meeting any guardian; `goal` on first reaching a world's
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
  next one, meet each guardian in turn. **Superposition Mode** is a testing/
  exploration mode, not the intended first playthrough: every world entry
  re-levels the player's stats/moves/HP to stay competitive with that world's
  opponents (`OverworldScene.applySuperpositionLeveling`, a flat +2 over
  `enemyStatsForWorld`, full move unlock, full heal) instead of requiring the
  normal qumatoken grind, every built world is pre-marked visited so Bloch's
  teleport hub (§5) can jump to any of them immediately on top of the world
  doors (§5) every world already has -- there is no separate "Warp" UI -- and
  Dresselhaus/Majorana/Anderson's panels (§5) offer every
  crystal in the game as a candidate rather than only ones actually defeated
  (Dresselhaus's list still excludes hybrid-recipe results, same as normal play).
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
pool, rival, and guardian slot; the Hub, title screen, localStorage save, Materialdex, the
contextual tutorial tips, and the Story Mode/Superposition Mode picker are all in place
(§2, §4, §5, §7). `game/` is the only build; there is no separate no-install
single-file `demo/` prototype. All audio is procedural Web Audio with no external assets
(`game/src/audio/music.ts`), with both an overworld track and a battle track per world in
two selectable arrangements — "Classic" (chiptune-leaning arpeggios) and "Modern" (a
symphonic string-pad/legato-melody arrangement of the same per-world keys/tempos) — toggled
live from the Enter-menu Settings panel.

Not yet built:
- Bespoke per-world boss puzzles (§6) — every world currently uses the same reach-goal →
  beat-rival → continue gate instead.
- A mobile wrapper (Capacitor) and playtesting with students.

## 10. Open design questions

- **Subtype combination rules** — which main+subtype pairs are physically/
  narratively sensible needs a full compatibility table, not just one example.
- **A fuller status-effect roster** — an earlier design sketch also described
  a "Gapped down" (defense drops, mirroring gap closing) and a
  "Symmetry-broken" (forced type shift for N turns) status alongside Kondo's
  three (§4); neither is implemented, and no guardian is currently slated to
  teach them.
- **Scope vs. solo-dev reality** — 10 worlds + full art + guardian roster is large for
  one person; consider cutting to 3–4 flagship worlds for a v1 before building all 10.
- **Course integration** — supplementary/optional tool, or tied into assessment?
  Affects how rigorous the Materialdex needs to be.
- **Quiz-text subscript notation** — physics questions/answers (`game/src/data/quiz.ts`)
  write subscripts as plain ASCII underscores (`U_c`, `k_B`, `E_F`, ~70 instances) since
  Phaser's `Text` has no native rich-text/subscript rendering, and Unicode's subscript
  Latin-letter block doesn't cover every needed letter (no subscript `b`, `c`, or `f`, so
  `k_B`/`U_c`/`E_F` themselves couldn't round-trip through it). Readable as-is to this
  course's audience, but true subscript rendering would need a custom multi-`Text`-object
  layout (split each string on `_`, offset the trailing run smaller/lower) built once and
  reused everywhere quiz/move text renders, not a quick fix.
- **Multiplayer/trading** — in scope or not? Changes hosting/save-system
  requirements significantly if yes.
