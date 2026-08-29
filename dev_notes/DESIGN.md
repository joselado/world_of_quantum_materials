# Quantum Materials RPG — Design Document

Living document, the single current source of truth for the game. Edit this directly
as the game evolves instead of writing a new plan elsewhere. Companion to `STYLE.md`
(how things look) and `CODEMAP.md` (where things live in the code -- function names,
patterns, exact file locations to check before making changes).

## 1. Core loop

Overworld exploration (walk around, talk to NPCs, find wild encounters) → turn-based
battle → earn qumatessence + attribute growth → return to overworld to progress, pay
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
Each world's name, terrain, palette, light and story are `WORLDS.md`'s; this table
owns the topic mapping, the wild pools and the progression gates.

**The maps are under active revision.** The map shapes below are being fine-tuned
and are open for change rather than fixed; `WORLDS.md`'s header carries the same
note for the terrain and palette side, and `MAPSHAPE_BUILD_TASK.md` is the
current pass over how much ground each world gives the player to stand on. The topic mapping, the wild pools and the
progression gates are not part of that revision and still hold.

| World | Course topic | In-game name (`WORLD_NAMES`) | Wild material archetypes | Gate to next world |
|---|---|---|---|---|
| 0 (Hub) | — | "The Lab" — guardian's house, Qumatex | — | Start world 1 |
| 1 | Second quantization, mean-field, SSB | **The Mean Fields** | Free fermion, itinerant/local-moment magnets, ferroelectrics, a charge density wave, a superconductor | Beat first rival crystal |
| 2 | Symmetries, tight-binding, effective models | **The Stone Lattice** | Bloch-wave critters, lattice defect variants | Beat that world's rival crystal |
| 3 | Topological band theory | **The Winding Borders** | Quantum spin Hall insulators, bulk and monolayer alike | Cross a gap only an edge-mode move can bridge |
| 4 | Integer and fractional quantum Hall effect | **The Storm Flats** | Landau-level materials, an intrinsic zero-field Chern insulator | Solve a Landau-level maze |
| 5 | Superconductivity, Nambu, Majorana | **The Vortex Glacier** | s-wave SC, triplet SC | Pair two Majorana halves |
| 6 | Classical magnetism, magnons | **The Iron Steppe** | Ferro/antiferromagnets, magnon wave-riders, a multiferroic | Ride a magnon wave across a canyon |
| 7 | Entanglement, tensor networks | **The Entangled Web** | Entangled pairs (fought as a bonded duo) | Compress a tangled area into a walkable MPS path |
| 8 | Quantum magnetism, spinons, Kondo | **The Screened Swamp** | Spin liquids, Kondo-screened critters, a genuine Kondo-lattice heavy-fermion compound | Screen a "local moment" boss mechanic |
| 9 | Excitations and defects | **The Defect Scars** | Defect-bound states, impurity resonances, a couple of ferroelectrics with no course topic of their own, plus every non-hybrid material from worlds 1-8 | Repair/exploit N defects to stabilize a bridge |
| 10 | ML for quantum materials | **The Devouring Mirror** | Every hybrid-recipe crystal, and only hybrid-recipe crystals, plus the final boss, which transmutes live in battle to mirror the player | Final battle |

Each world's overworld *map shape* (not just its biome skin) is its own physics motif too,
generated fresh every visit by `game/src/world/generators/world<N>.ts` (dispatched from
`game/src/world/mapgen.ts`'s `generateWorldMap`, see CODEMAP.md):

| World | Map shape |
|---|---|
| 1 | An open field with a hedgerow running down the middle of it for a stretch: the hedgerow opens out of nothing, widens, and closes again, and while it stands the field is two distinctly colored fields with no way between them -- the two degenerate symmetry-broken ground states. The player picks a state by picking a side, and cannot unpick it until the hedgerow ends |
| 2 | An open, straight-walled cloister floor with the lattice standing in it: impassable columns on a strictly periodic array inside the hall, carrying a two-atom basis across its width (a narrow aisle within each cell, a wide one through to the next), so the player walks through the periodic array of scatterers rather than along a path beside it. What varies per visit is the lattice phase alone -- where in the crystal the player entered |
| 3 | The grid is partitioned into a good many colored Voronoi domains (distinct bulk topological phases); the only walkable ground is the boundary strip between two differently-colored ones. Deliberately the narrow world of the ten -- the edge state is the only place you can stand, so what opens it up is the number of seams and the junctions between them, where the player chooses which boundary to follow north, rather than any extra width of walkable bulk |
| 4 | A wide trunk sprouts a mirrored pair of branches at intervals, each sprouting a smaller mirrored pair perpendicular to it, self-similar across a few scales (Hofstadter-butterfly-inspired) |
| 5 | An open ice sheet with one or two vortex pits punched clean through it, each sitting mid-sheet so the route parts and rejoins around it: the player winds around a vortex because the geometry leaves no way through, not because a spiral was drawn to follow. The pit centres come back as feature cores, where the surround draws the rim and the cold glow of trapped flux |
| 6 | An open plain with the magnetic order standing up out of it: shard clumps in transverse wavefronts, one wavelength apart down the plain's length, each front offset sideways from the last so the train reads as travelling rather than as a fence repeated |
| 7 | 3-4 parallel lanes (a tensor network's own sites/legs) linked by periodic cross-link rungs (bonds) -- a real ladder, not one path with spurs |
| 8 | A peat shelf with pools of open water punched into it. The shelf enters wide and closes steadily to a narrow bank by the goal, which is the world's escalation written into its floor; the shelf parts around the wider pools and rejoins past them (fractionalization), and every pool's centre is returned as a feature core, where the surround burns a local moment |
| 9 | A wide plain of scorched clay carrying two kinds of defect: substitutional patches, each rendered with one of worlds 1-8's own biome look (a borrowed defect "type") and changing nothing about the shape, and vacancies, holes punched clean out of the plain with molten crust in the gap where the lattice is missing |
| 10 | Reuses whichever of worlds 1-8's own generator matches the player's *current* material's main type (e.g. a superconductor-type player gets world 5's spiral); a player whose type doesn't resolve to one of the eight falls back to a fresh random pick among all eight every visit |

**A world is ground with things standing in it, not a route drawn on a background.**
Nine of the ten paint a wide field first and then punch that world's own impassable
features into it (`generators/shared.ts`'s `punchIslands`) -- columns, a hedgerow, vortex
pits, shard clumps, pools, vacancies. What that buys is a player who is somewhere rather
than on a path: the walkable ground runs about 40-53% of the grid's width in every world,
against a corridor's 20-25%, and the features are what the physics is carried by. World 3
is the deliberate exception and stays narrow, because a walkable bulk would contradict the
one thing bulk-boundary correspondence says; it gets its freedom from the number of seams
and the junctions between them instead. `MAPSHAPE_BUILD_TASK.md` holds the per-world
design and the band each is measured against (`npm run mapshape:measure`).

Punching features into ground has one rule that is not negotiable, and `punchIslands`
owns it: a **clearance** of at least invariant A's two tiles survives on every side of
every feature, checked against the grid as it stands, so one pass keeps a feature off the
field's edge, off its neighbours and off the grid boundary at once. Two consequences worth
knowing before adding a feature to a world: a feature the world is *named* for is placed
with `punchFirst` (offer the shape you want, then humbler ones, so a Vortex Glacier can
never roll a map with no vortex in it), and two features cannot stand closer than their
own radii plus that clearance -- asking for a denser scatter than that does not produce
more features, it produces features that reject each other.

Every shape is then tapered at both ends by a shared pass (`generators/shared.ts`'s
`narrowGoalPass`/`openStartMouth`): the corridor narrows to a three-tile throat at the goal
and opens out of the same throat at the start, so world N's entry is the same piece of
geography as world N-1's exit. The narrowing is permanent terrain, present whatever the
gate's state, and nothing spawns inside either pass -- neither wild encounters nor
qumatessence. The taper stops short of the guardian's row, since it runs after the
chokepoint pass and would otherwise overwrite the gap that forces every route through the
guardian. World 1's backward exit stays a door rather than a pass: it leads to the Lab,
which is not a place, and that is the game's one non-geographic boundary.

Every shape still obeys the same two rules regardless of its own motif: no walkable segment
is ever narrower than 2 tiles (so a wild encounter spawned on the path can never fully block
it), and that world's guardian tile is a forced, verified chokepoint -- every route from the
entry point to the goal is provably routed through it (`generators/shared.ts`'s
`forceChokepoint`/`verifyChokepoint`), not just placed near the geometric middle of one of
several possible routes. World 10's shape is re-rolled immediately, without leaving the
world, whenever the player transmutes (Dresselhaus) or fuses (Majorana) into a new form while
standing there, since its whole shape is keyed off that form's type.

**Respawning.** A world refills itself while the player walks it, so a map that has been
picked clean doesn't stay a dead corridor: on every step the player takes, wild crystals
drift back in and qumatessence condenses again on ground that has left view
(`OverworldScene`'s `refillHidden`, run from the step itself since which ground is hidden can
only change when the player moves). Everything comes back **outside the drawn world**
in either direction -- ahead of the player past the far edge of their field of vision, or
behind them past the camera, both margins derived from the projection rather than fixed row
counts. Nothing may ever appear within view: something that pops into existence in front of
the player is a spawner rather than a world. Refilling behind as well as ahead is what lets a
player walk a corridor back and forth and always find more; a rule that only reached ahead
would leave the stretch already walked permanently bare and stop refilling at all near the
north end of a map. A respawn obeys every rule the original scatter does: never in a pass,
never on the start/goal/guardian tile, never on ground cut off from the route, one wild per
row at most and never in a walkable run narrower than 2 tiles, and drawn from the same
`getWildPool(world)` the generator drew from --
so World 10 keeps respawning hybrid-recipe results only, and World 9 the whole non-hybrid
roster.

**A map gives back without limit; at any one instant it holds only what it stood
up.** Both kinds carry exactly one ceiling, and it is a *concurrent* one: wilds refill toward
the population that map was generated with, which is what the Settings station's
encounter-density preset sets, and qumatessence toward its own initial scatter count.
Respawns replace what was taken rather than outpacing the setting, and a player walking the
same corridor long enough can always find more of both. Both ceilings live in the map
snapshot (§7's `saveMapState`/`restoreMap`), so a round trip through battle or the Lab
resumes the same half-refilled world rather than a fresh one.

**Farming is intended, and the reason is thematic rather than economic.** The wild crystals
are tests, the golem holding a world's pass is the exam, and grinding encounters is studying
for it. On a harder run a player may genuinely need to farm to be ready for a rival, and the
game must let them: an unbounded corridor is the difference between "prepare and come back"
and "you should have prepared earlier." That is also why capping pickups would protect no
number even if it were wanted -- a battle's own stake (§5) pays 50 in World 1 against roughly
9 qumatessence scattered over that entire map, and 200 in World 10 against roughly 260, so a
whole map of World 1 pickups is worth a fifth of one fight. Income comes from fighting, and
fighting is the game.

World names are meant to read as the lecture topic, not generic RPG terrain names (check
`WORLD_NAMES` and `WORLD_RIVALS` together when naming a world -- a mismatched rival name is
easy to miss if only one table is updated). Every rival 1-8's own name (and, per-type, World
9's `RIVAL_9_NAMES`) instead follows "Polycrystalline `<real compound>` Golem" -- the world's
own topic anchors which compound, and "Golem" earns its place by literalizing that compound's
*polycrystalline* form as a humanoid mass of fused shards (`art/boss.ts`'s `makeBossCrystal`),
not as a generic monster suffix.

World 10 has no course notebook, which fits it being the finale rather than a taught
topic: the boss is "a model of you," which is an honest metaphor for an ML surrogate.

World 0 ("The Lab") is built as a static single-room hub (`game/src/scenes/HubScene.ts`),
not a walkable map -- up to nine stations, since none of its jobs need overworld movement
of their own. Two always exist (Qumatex, the door to the
next unbeaten world); seven are reference/settings stations (Moves, Stats, Abilities,
Tutorial, Story, Settings, Title Screen, built in `game/src/scenes/panels/hubStations.ts`'s
`LAB_STATIONS`) -- everything a player might want to check or adjust between worlds,
reachable only by physically returning to the Lab rather than from an in-world menu,
since none of that
content (player stats/moves/passives, game settings) is
tied to being mid-world. Abilities only actually appears in the room once
there's something to check there -- a first passive learned
(save/registry `passivesUnlocked`) -- rather than on a fresh save with nothing yet to show;
Superposition Mode (below) treats it as unlocked from the start, matching how its own
guardian/passive grants already work. Alongside the stations, every guardian the player has
met stands in the room as their own clickable avatar (§5) rather than being listed in a
menu, so reopening one is a single click. `TitleScene` boots the game and loads the currently selected mode's own
localStorage save slot (see §7) before handing off to the Hub; pressing `H` or `Enter` from any Overworld
scene returns to it, resuming that world's own map and player position exactly rather than
generating a fresh one. Pressing `Enter` again in the Lab is the exact reverse of that same
trip: it sends the player back to precisely the world and position they left, regardless of
how far their progress has otherwise advanced, so opening and closing the Lab from any world
never moves the player. The door station leads to the same place, named rather than numbered:
"Back to `<world name>`", resuming that world's map and position in place. Only when there is
nothing to resume -- a save that has never left the Lab, or a page reload, the map snapshot
being in-memory only -- does it fall back to a first trip out, reading "Enter `<world name>`"
for the player's furthest-reached world and generating a fresh map. Bloch's destination rows
are the way to *jump* somewhere other than where the player stands; the door is a way back.

Each world's "Gate to next world" fight is a distinct **rival crystal** -- worlds 1-8 and
10 have a fixed entry in `game/src/data/materials.ts`'s `WORLD_RIVALS`, world 9's is built
per-playthrough instead (see below); all ten worlds have a rival either way. Separate from
that world's ordinary wild encounters (`WORLD_CRYSTALS`) -- beating a rival is what the
world's forward pass actually opens onto. The rival fight is deliberately
*not* a precondition for reaching that world's guardian: the goal guardian is always reachable
once the goal is reached, so the player can shop/prep before ever facing the rival, rather
than being stuck needing bought moves to beat a rival they can't reach the guardian to
prepare for (`OverworldScene.confirmGate`). Every rival has a fixed main type
except World 9's -- an impurity/defect-bound resonance that can form in any host
crystal, so its type is rolled at random every time the player reaches World 9
(`data/materials.ts`'s `RIVAL_9_TYPES`/`rollRival9Type`, cleared and re-rolled by
`OverworldScene.create()` on every visit) and cached in the save (`rival9Type`,
`OverworldScene.resolveRival9Type`) for the rest of that visit, so the goal-tile boss
preview and the actual battle still agree on which type it turned out to be. Its name
still follows the same "real compound, polycrystalline form" convention every other
rival's does, looked up per rolled type (`data/materials.ts`'s `RIVAL_9_NAMES`) rather
than fixed, since which real compound the resonance is haunting depends on which type
got rolled. Its moveset is looked up the same way (`RIVAL_9_MOVES`): the rolled host's
own signature quasiparticle, one that type's wild counterpart already carries, plus
Phonon Beam in the second slot since `phonon` is the one class every type hosts. A
resonance with no lattice of its own throws the physics of whatever it landed in (its
taunt says so outright, "I borrow one, and it decides everything about me"), and a
single shared moveset could not do that — three of the seven rollable types host no
band electron at all, only `metal` hosts a plasmon, and `phonon` is the only class all
seven share. These are the pristine excitations rather than the `GOLEM_MOVE_IDS` decohered
ones every other golem carries, per WORLDS.md §6's exemption: World 9's rival is the
one rival the Decoherence took nothing from.

**Every world uses this same reach-goal → beat-rival → continue gate** (§6 for what a
boss encounter is made of). What varies from world to world is the *map shape* above:
each world has its own generator (`generators/world<N>.ts`), so the journey to the
guardian and the goal reads as that world's own physics -- a Voronoi domain network, a
tensor-network ladder, a vortex spiral -- and the world's own rival, carrying that
world's own excitation, is what waits at the pass.

## 3. Type system

**`game/src/data/TAXONOMY.txt` is the hand-edited design source for the type system**
— every main type and every quasiparticle class below, and which classes host which
quasiparticles, is meant to match that file exactly; `types.ts`'s `MaterialType`/
`MoveClass` unions and `materials.ts`'s `MOVE_COMPATIBILITY` are its implementation.
Edit that file first when changing the taxonomy itself, then reconcile the `.ts`
files (and this section) to match, rather than editing the three places
independently.

**Main types (14).** Ordinary, non-exotic band physics splits three ways by how far a
carrier gets: `metal` (a partially filled band — the only tier that carries a
plasmon), `semiconductor` (gapped, but narrow enough to dope/thermally excite across
— an ordinary band electron still gets through), and `insulator` (gapped too wide for
even that — only the lattice itself, a phonon, gets through, though a self-trapped
polaron is actually a *stronger* excitation there than in a bare metal or
semiconductor). Magnetically/electrically ordered baselines: `metallicMagnet` and
`insulatingMagnet` (both magnetically ordered and magnon-carrying, split by
conductivity exactly the way `metal` splits from `insulator` — a metallic magnet's
moments ride the same partially filled band that carries its current, so it hosts an
ordinary electron and a plasmon alongside its magnon, while an insulating magnet's
gapped local moments leave the magnon and the lattice as all it has; the split cuts
across how the order is derived rather than along it, so itinerant Stoner magnets land
on one side and Mott-Hubbard or superexchange magnets on the other),
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
the picture, doesn't either). World 10's finale boss ("The Adapted") has no main type of
its own at all — its type is decided live in battle instead (§5, `BattleScene`'s
`adaptedForm`/`transmuteAdapted`), not a 14th entry in this list. Topic 7's entangled/tensor-network states and topic
8's spin liquids are physically the same quasiparticle family (Spinon Swap), so World
7 and World 8 share the `quantumSpinLiquid` type while staying visually and
narratively distinct worlds (different biome, guardian, music, name) — the crystal
database below still tags each compound with the topic it illustrates even though the
type column reads the same for both. Topic 9's defect-bound states (Yu-Shiba-Rusinov
states, impurity resonances, vortex-bound Majorana states) are real disorder physics
hosted inside a superconductor, so most of World 9's crystals are `superconductor` or
`chernSuperconductor` type rather than a dedicated one — its one magnetic-impurity
precursor compound (Manganese) is `metallicMagnet`.

**Subtypes**, unlocked via guardians, cross with main types (e.g. superconductor +
magnetic subtype → spin-triplet superconductor, matching the example in the
source notes). Not all main+subtype pairs are physical/interesting — needs a full
compatibility table before implementation (see open questions).

**Attributes map to stats** (implemented: `game/src/data/types.ts`'s `Stats`, `game/src/data/materials.ts`/`data/balance.ts`).
Each attribute has a player-facing name and an internal `Stats` field name, and the two are
independent — see CODEMAP.md's "Stats and battle resolution" for the pairing and what an internal
rename would touch. This doc uses the player-facing names, with the field in backticks:
- **Energy** (`quantumness`) → how hard the attacker's hits land (`energyFactor`): a concave
  (square-root) climb in the stat, from a 1x multiplier at `BASE_STAT` to `MAX_STAT_LEVER` (10x)
  right at `MAX_STAT`. The physics is that Energy is where a quasiparticle sits above the ground
  state, so a higher-Energy excitation carries a bigger quantum into the target and every blow
  deposits more
- **Momentum** (`velocity`) → turn order and hit count each round: whichever side has the higher
  effective
  Momentum swings first, and swings `clamp(floor(ratio), 1, MAX_MULTI_HIT)` times that round, where
  `ratio` is its Momentum divided by the slower side's (`BattleScene.currentHitOrder`); the slower
  side always still gets exactly one swing. Ties keep the player going first, one swing each.
  `MAX_MULTI_HIT` is 5
- **Lifetime** (`correlation`) → how much of an incoming hit the defender soaks
  (`lifetimeFactor`): the exact mirror of Energy, the same curve off the same `statLever` helper
  and the same `MAX_STAT_LEVER` (10x) ceiling, except damage is *divided* by it rather than
  multiplied. Energy and Lifetime are therefore worth the same per point, one on each side of the
  exchange. A maxed-out Lifetime crystal is very hard to hurt, not literally unhittable -- the
  divisor is finite, so real damage always gets through regardless of how defensive either side
  gets

Both curves are concave rather than straight so the full range stays meaningful while the benefit
is front-loaded: the first few points already buy something a player can feel, which is what keeps
an early, cheap stat purchase worth making at all. A crit ("a coherent critical hit") is not one of
the three levers -- it is a flat `BASE_CRIT_CHANCE` (20%) for every attacker, worth
`CRIT_DAMAGE_MULTIPLIER` (1.5x) when it lands, and the one thing that moves it is Franklin's
Satellite Reflection (§5), which doubles its holder's own rate (`ANYON_ECHO_CRIT_MULTIPLIER`).

The three levers are deliberately comparable per qumatessence over the range a real playthrough
can afford (a few points each, not tens), and they are comparable in different shapes. Momentum's
is a ratio against the opponent's own, so it pays in integer steps, pays double (it both grants
your extra swings and denies theirs), and stops paying entirely once it reaches `MAX_MULTI_HIT` --
Energy's and Lifetime's climb smoothly and never stop, and they stack multiplicatively with each
other, so a build that spreads across all three beats pouring everything into whichever one looks
strongest.

Every crystal starts at `1/1/1` (`BASE_STAT`/`DEFAULT_STATS`) and can be raised up to `100`
(`MAX_STAT`) per stat at Noether's shop -- a stat already at `MAX_STAT` shows as maxed and stops
selling. The player's own stats live in the save (`playerStats`) and only grow by spending
qumatessence with Noether (`scenes/panels/noether.ts`'s `renderShopStats`/`data/balance.ts`'s `statUpgradeCost`,
`(current - BASE_STAT + 1) * 50` per point, the same rate for all three stats, since all three
plateau the same way and none buys disproportionately more per point than the others); an opponent's
stats are computed fresh from the world number (and the active
difficulty tier, see below) at battle start (`enemyStatsForWorld(world, difficultyMultiplier)`,
`data/balance.ts`) rather than hand-tuned per species, so difficulty climbs with the world.
Growth follows a two-phase curve rather than one flat per-world rate: worlds 1-3 (the tutorial
stretch, before the player has had a real chance to shop/transmute/level up) grow slowly, `+0.1`
per world past world 1 on all three stats; worlds 4-10 assume a player
who has met the early guardians and can draw on their systems (Dresselhaus's transmutation,
Landau's Analytic moves, Feynman's leveling, ...), so growth steepens to `+0.5`
per world from there. All three stats grow at one shared rate, since none of the three is worth
less per point on the opponent's side than the others. An opponent's own stats stay
fractional through this curve (never rounded here, since they're never shown to the player as a
number, only felt through hit chance/damage/turn order) so its own sub-1 per-step rate actually
registers rather than vanishing under premature rounding. `BattleScene.create` rounds the result
only for an ordinary wild, whose `rollEncounterFactor()` +/-15% roll scales the baseline first; a
rival's stats are used exactly as this curve returns them. The player's own `playerStats` are
whole numbers, since Noether's shop displays/sells them one point at a time, and none of this
enemy-stat math ever feeds them (Superposition Mode's grant pins all three straight to
`MAX_STAT`, see below).
The rates are set so the two sides stay on comparable footing across the whole run: a
played-through crystal reaches single-digit stats rather than tens, so an opponent tracking that
same range is what keeps a late world genuinely hard for a near-optimal build
(`npm run balance-sim`-verified). Because the player's own
Momentum only grows by spending qumatessence with Noether while the opponent's grows automatically
every world, a player who never buys Momentum falls further behind the opponent's effective
Momentum every world — raising both how often the opponent goes first and, per the multi-attack
rule above, how many times it swings each round.

**Difficulty tier** (the Lab's Settings station, `data/settings.ts`'s `DifficultyTier`/
`DIFFICULTY_TIER_PRESETS`, `data/balance.ts`'s `DIFFICULTY_MULTIPLIERS`): a player-facing
multiplier on `enemyStatsForWorld`'s whole curve above (Story Mode) or on `superpositionEnemyStats`'
flat baseline (Superposition Mode, see below), named B.Sc./M.Sc./Ph.D. after
`game/scripts/balance-sim.mjs`'s own three simulated playtest archetypes rather than a plain
Easy/Normal/Hard, since each tier's multiplier is tuned and `npm run balance-sim`-verified against
that archetype's own effort level. M.Sc. ("the intended default") is what every constant above is
written against, so it's the tier that leaves Story Mode's curve unscaled (`1`); B.Sc. eases it
(`0.6`) for a lower-effort playstyle and Ph.D. tightens it (`1.4`) for a playstyle that would
otherwise clear every world too comfortably. Unlike the density/text-size/music-style rows beside
it, meant to be revisited mid-playthrough rather than picked once -- `BattleScene`/`OverworldScene`
both read it live off the registry on every fight/re-level, so a change lands on the player's very
next battle, no restart needed.

**Superposition Mode's own stat/opponent handling** (`OverworldScene.applySuperpositionUnlocks`,
`data/balance.ts`'s `superpositionEnemyStats`): every player stat is pinned straight to `MAX_STAT`
(100/100/100) rather than re-leveled per world, since the mode's whole point is "every guardian,
transmutation, and hybrid material is available right away." With the player permanently maxed,
there's no "this world is harder than the last" progression left for the opponent's own side to
track either, so every fight in this mode draws its opponent stats from one flat, world-independent
baseline (`SUPERPOSITION_BASE_ENEMY_STAT`, 55) instead of `enemyStatsForWorld`'s per-world climb --
the same difficulty tier multiplier still applies on top, giving B.Sc./M.Sc./Ph.D. real separation
(a comfortable win, a genuine-but-winnable fight, and a tight one, respectively) rather than every
tier converging on the same "always trivially wins" result a maxed player would otherwise get
against a small, Story-Mode-curve-derived opponent.

**Max HP is never intrinsic to a crystal** -- no `Material` (wild, rival, or the player's
own current form) carries an HP number at all; it's purely a function of which world the
fight is happening in, resolved fresh by `BattleScene.create` (`data/balance.ts`). An
ordinary wild's base HP is `wildHpForWorld(world)` (a linear climb, `23` at World 1
to `43` at World 10 -- HP doesn't need the Energy/Momentum/Lifetime curve's two-phase shape,
but it does have to climb faster than that curve's own early rate, since the late worlds are
where the two sides' Energy/Lifetime levers diverge most and HP is what keeps a fight from
collapsing into a single round), scaled once per encounter by a shared `rollEncounterFactor` (+/-15%, the same range
`resolveHitDamage`'s own per-hit damage variance uses) applied to that wild's HP *and* its
whole stat block together -- one coherent "this specimen is somewhat tougher/weaker than
its world's average" trait, not four independent rolls. A rival's HP instead follows
`rivalHpForWorld(world)` (steeper, `30` at World 1 to `91` at World 10), with no roll at all and plain
`enemyStatsForWorld(world)` stats -- a rival is a fixed, known, repeatable challenge, the
same boss every time it's fought, unlike an ordinary wild's sample-to-sample variance. The
player's own max HP uses `wildHpForWorld` too, for whichever world they're currently in, no
roll (their own body isn't a specimen with variance) -- so transmuting/fusing into a
different crystal form (§5) never changes it by itself, only the world does. Arriving in a
world sets the player's HP to that world's own number
(`OverworldScene.levelHpToWorld`, run on every entry), so the first fight of a world opens at
its full bar rather than the previous world's smaller one.

**Crystal database.** Each wild "crystal" is named after a real compound rather than
an invented species name, and inherits its main type (and therefore its look and its
type-chart matchups) from that compound's actual physics. Below is the candidate list,
grouped by main type/topic, cross-checked against what
`lecture_notes/tex/sessions/sessionNN.tex` actually names for each topic;
entries marked *(textbook fill-in)* are standard examples supplied because the
corresponding session file names no concrete real compound for that topic.

Wired into `game/src/data/materials.ts` as `WORLD_CRYSTALS`, a **per-world database**
keyed by world number rather than one global list — each world's `OverworldScene`
pulls its own wild-encounter pool via `getWildPool(world)`, drawing every row from the
matching type/topic section of the table below (worlds 1-2 each run ~10-12; every other
world stays in the 2-11 range -- topic 2 has no dedicated main type of
its own, so it mixes metal/semiconductor/insulator compounds with "lattice" flavor
instead of world 1's tutorial picks; world 10's pool draws exclusively from §5's
hybrid-recipe results instead of one topic section, see the note just below
the table). A compound isn't pinned to a single world's pool when more than one topic
legitimately motivates it — Iron and Cobalt spawn in both World 1 (mean-field
itinerant-ferromagnet SSB examples, alongside NiO/Chromium) and World 6 (magnons),
the same "one compound, more than one home" shape World 9's any-type borrowing already
uses at a whole-world scale, just applied to two specific compounds instead. All ten worlds
have a built overworld map (roadmap §9). `PLAYER_MATERIAL` (the player's own crystal,
currently Silicon) is a fixed pick from this same table, not part of any world's wild
pool.

| Type (topic) | Crystal (compound) | Why it has that type |
|---|---|---|
| semiconductor (1) | Silicon (Si) | Conventional band semiconductor, narrow enough a gap to dope, no protected structure |
| semiconductor (1) | Gallium Nitride (GaN) | Doped semiconductor, plain single-particle band picture |
| insulator (1) | Magnesium Oxide (MgO) | Simple ionic band insulator, gap too wide to dope/excite across — textbook baseline contrast to topological insulators; the ionic lattice also self-traps a stronger polaron than a bare semiconductor would |
| metal (1→2 bridge) | Graphene (pristine, half-filled) | Gapless Dirac semimetal — the throughline example of session 2 (Bloch's theorem, tight-binding); precursor before symmetry-breaking (→ insulatingMagnet) or band-topology (→ topological) sets in; real graphene plasmonics is its own well-known field |
| metal (2) | Silver (Ag) | Half-filled 5s conduction band gives it the sharpest free-electron plasmon of any elemental metal — real plasmonics/nanophotonics runs on silver (and gold), not graphene; not from the course, added to give `metal`'s Plasmon Resonance a second, more flagship host |
| metal (2) | Mercury Telluride (HgTe) | Inverted-gap bulk band structure — Γ8/Γ6 touch at zero gap, the same gapless character Graphene's own `metal` entry above already carries, not an ordinary gapped semiconductor; §5's hybrid-recipe parent for HgTe/CdTe Quantum Well below, whose topology comes from this inversion |
| semiconductor (2) | Indium Arsenide (InAs) | Ordinary band semiconductor whose real role is strong spin-orbit coupling — the actual second ingredient (alongside Aluminum) in a real Majorana-nanowire platform, §5's InAs/Al Majorana Wire hybrid recipe |
| semiconductor (2) | Monolayer Molybdenum Ditelluride, 2H phase (MoTe$_2$) | The untwisted, semiconducting monolayer phase — distinct from the already-topological 1T′ phase below — that becomes Twisted Bilayer MoTe₂ once fused with itself (§5) |
| semiconductor (2) | Phosphorene (black phosphorus monolayer) | The world's one monolayer whose low-energy model is neither a Dirac cone nor an isotropic parabola — a puckered four-atom cell giving a direct gap at Γ (~0.3 eV in bulk, ~2 eV in one layer) with strongly anisotropic masses, light along armchair and heavy along zigzag, so building its tight-binding model needs hoppings within and between the two puckered sublayers; the effective-mass-from-band-curvature and dispersion-archetype content session 2 teaches, on a compound that is not another honeycomb; not from the course |
| semiconductor (2) | Cadmium Telluride (CdTe) | Individually an ordinary wide-gap semiconductor — the barrier layer in the HgTe/CdTe quantum-well recipe above |
| semiconductor (4) | Gallium Arsenide (GaAs) | Ordinary direct-gap III-V semiconductor in its own right — the integer quantum Hall effect this world's `chernInsulator` members carry needs a clean 2D electron gas confined at a GaAs/AlGaAs heterostructure interface under strong field, not the bulk compound itself, so plain Gallium Arsenide doesn't carry that type here |
| insulator (2) | Diamond (C) | ~5.5 eV gap, textbook wide-gap covalent insulator — pristine, no defect (e.g. nitrogen-vacancy) dressing; not from the course, added as `insulator`'s second member alongside Magnesium Oxide |
| insulator (2, hybrid parent) | Monolayer Boron Nitride (hBN) | ~5.9 eV gap insulator whose honeycomb lattice is nearly commensurate with graphene's — real graphene devices are built on or encapsulated in it; §5 hybrid recipe parent (with Graphene) for Rhombohedral Pentalayer Graphene/hBN Moiré below |
| metal (2) | Tungsten (W) | Partially filled 5d bands, ordinary band conductor — highest melting point of any elemental metal; not from the course, the d-band Electron Pulse counterpart to Silver's/Graphene's free-electron Plasmon Resonance |
| insulatingMagnet (1) | Europium Oxide (EuO) | Half-filled Eu²⁺ 4f⁷ shell, well-isolated localized moments — the real material Weiss/mean-field theory's Brillouin-function prediction is classically tested against; a genuinely different mean-field derivation (localized-moment Weiss theory) from Iron/Cobalt's itinerant Stoner picture, and gapped where they are metallic: stoichiometric EuO is a ferromagnetic semiconductor, so its ordered moments carry a magnon and nothing else (heavily doped EuO does go metallic, the compound's own famous metal-insulator transition); not from the course |
| insulatingMagnet (1) | Manganese Fluoride (MnF$_2$) | Simple ionic (superexchange-mediated) local-moment antiferromagnet with strong single-ion anisotropy — the real-material realization of the mean-field Ising antiferromagnet, a third distinct route to magnetic order alongside NiO's Mott-insulating Hubbard-$U$ picture and Chromium's itinerant spin-density-wave picture; not from the course |
| ferroelectric (1) | Potassium Dihydrogen Phosphate (KH$_2$PO$_4$) | Order-disorder-type ferroelectric (proton tunneling between two off-center sites in an O-H...O bond, a pseudospin mean-field/Ising model) rather than Barium Titanate's displacive-type transition — same inversion-symmetry-breaking SSB, a genuinely different microscopic mechanism, and an even more literal mean-field-theory teaching example than BaTiO₃'s own soft-phonon-mode picture; not from the course |
| metal (1) | Titanium Diselenide (TiSe$_2$) | 1T-TiSe₂'s own charge density wave (~200 K) is session1's own broken-continuous-translational-symmetry worked example, made real — a frozen (softened) lattice/charge modulation opens a small gap; stays `metal` rather than a dedicated type since session1 itself notes only the phonon is guaranteed gapless in every material, and a CDW's own low-energy fluctuation is exactly that lattice phonon branch, not a distinct quasiparticle; not from the course |
| quantumSpinHall (3, hybrid) | HgTe/CdTe Quantum Well | The original 2D topological insulator (Bernevig-Hughes-Zhang model, König et al., Science 2007) — only the *engineered heterostructure* is topological, not either bulk parent above; §5 hybrid recipe result, lives as a World 10 wild rather than a World 3 one |
| insulatingMagnet (1) | Nickel Oxide (NiO) | Mott-insulating antiferromagnet — canonical mean-field/Hubbard-$U$ SSB example |
| insulatingMagnet (1, rare/special) | Graphene at strong coupling | Session 1 notes a finite $U_c$ opens a Mott/antiferromagnetic gap at the Dirac point — same base crystal as the metal entry above, but pushed past its symmetry-breaking threshold |
| metallicMagnet (1) | Chromium (Cr) | Itinerant (metallic) antiferromagnet — the SDW mean-field/Stoner-criterion counterpart to NiO's Mott-insulating picture (Manganese Oxide, the same Mott-insulating family, is a World 6 wild); also §5's magnetic-dopant parent for Cr-doped (Bi,Sb)₂Te₃ below |
| chernInsulator (3, magnetically doped) | Bismuth Selenide (Bi$_2$Se$_3$), magnetically doped | The added magnetism breaks time-reversal symmetry, turning the helical surface state chiral — quantum anomalous Hall, same doping-breaks-TRS mechanism as Cr-doped (Bi,Sb)₂Te₃ below |
| quantumSpinHall (3) | Bismuth Telluride (Bi₂Te₃) | Undoped topological-insulator host, its bulk gap hiding a spin-momentum-locked helical surface state — §5's Chromium + Bi₂Te₃ hybrid recipe dopes magnetism in to make Cr-doped (Bi,Sb)₂Te₃ below |
| quantumSpinHall (3, rare) | Samarium Hexaboride (SmB$_6$) | Topological Kondo insulator — many-body topology, a protected helical surface state hosted inside a Kondo-insulating bulk; also bridges to the kondoHeavyFermion/quantumSpinLiquid family below |
| quantumSpinHall (3) | Monolayer Tungsten Ditelluride (1T′-WTe$_2$) | A genuine quantum spin Hall insulator in its own right, survives up to ~100 K — a single bulk-derived monolayer's own band topology rather than an engineered quantum well, but the same helical boundary physics as Bi₂Te₃/HgTe-CdTe above, so it shares this type rather than needing a separate 3D-only one |
| quantumSpinHall (3) | Bismuthene (Bi honeycomb on SiC) | The largest quantum spin Hall gap known, ~0.8 eV (Reis et al., Science 2017) — what session 3's opposite-mass-per-spin construction gives once the spin-orbit coupling comes from atoms as heavy as bismuth instead of carbon, which is the same session's own reason graphene's Kane-Mele gap is unobservable; the SiC substrate is a template, not a partner phase, so this is an ordinary wild rather than a §5 hybrid recipe result; not from the course |
| quantumSpinHall (3) | Jacutingaite (Pt$_2$HgSe$_3$), monolayer | The Kane-Mele model as a naturally occurring mineral — a honeycomb gapped by intrinsic spin-orbit coupling from heavy Pt and Hg (Marrazzo et al., PRL 2018); predicted with supporting measurements rather than measured as directly as 1T′-WTe₂'s own effect, which its Materialdex blurb states outright the way Twisted CrI₃'s does; not from the course |
| chernInsulator (3→10, hybrid) | Cr-doped (Bi,Sb)$_2$Te$_3$ | Quantum anomalous Hall effect — the Cr doping breaks time-reversal symmetry and turns Bi₂Te₃'s helical surface state into a single chiral edge channel, a zero-field integer Chern insulator; §5 hybrid recipe result, lives as a World 10 wild rather than a World 3 one |
| metal (1, 2, 4) | Graphene, in strong field | Dirac-electron Landau levels spacing as $\sqrt{B}$ rather than linearly in $B$, so its plateaus survive to ~100 K and, in the best samples, near room temperature, where a GaAs quantum well needs ~1 K — session 4 names it alongside GaAs as the quantum Hall state's other platform, so it spawns in World 4 as well as Worlds 1 and 2 (the same one-compound-more-than-one-home rule Iron uses); it stays `metal` there, since it is the field rather than the compound that produces the Chern-number-one Landau levels |
| fractionalChern (4, hybrid) | Twisted bilayer Molybdenum Ditelluride (MoTe$_2$) | Zero-field *fractional* quantum Hall from topological flat bands — genuinely fractionalizes into charged anyons, unlike GaAs/Graphene's ordinary integer Landau levels above, so it gets its own type rather than sharing `chernInsulator`; §5 hybrid recipe result (the 2H monolayer above fused with itself), lives as a World 10 wild rather than a World 4 one |
| fractionalChern (4, hybrid) | Rhombohedral Pentalayer Graphene/hBN Moiré | Zero-field fractional quantum anomalous Hall (2023–2024 experiments) — five rhombohedrally-stacked graphene layers aligned to a hBN substrate, the same charged-anyon edge physics as Twisted Bilayer MoTe₂ above by an aligned-heterostructure route instead of a twist angle; not from the course, §5 hybrid recipe result (Graphene + Monolayer Boron Nitride), lives as a World 10 wild rather than a World 4 one |
| chernInsulator (4, new type) | Manganese Bismuth Telluride (MnBi$_2$Te$_4$) | Real intrinsic magnetic topological insulator — the actual zero-field QAHE/Chern-insulator material, standalone (not a hybrid recipe result) |
| superconductor (5) | Aluminum (Al) | Conventional phonon-mediated BCS s-wave superconductor — also spawns in World 1, session1's own third worked mean-field example (alongside the charge density wave and magnetism above) being superconductivity's own broken gauge symmetry, the same deliberate cross-list Iron/Cobalt/Barium Titanate already use |
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
| metallicMagnet (6) | Iron (Fe) | Classic itinerant ferromagnet, magnon carrier |
| metallicMagnet (6) | Cobalt (Co) | Same family |
| insulatingMagnet (6) | Manganese Oxide (MnO) | Mott-insulating antiferromagnet — its magnetism comes from localized moments and Hubbard $U$ rather than Iron/Cobalt's itinerant band picture above, but still ordinary (non-topological) magnon-carrying order, and its Mott gap is what puts it on the insulating side of the magnet split |
| insulatingMagnet (6) | Chromium Triiodide (CrI$_3$) | Van der Waals ferromagnet with an observed topological magnon gap |
| insulatingMagnet (6) | Chromium Tribromide (CrBr$_3$) | Same van der Waals ferromagnet family as CrI₃ — pairs with Niobium Diselenide in Kezilebieke et al., Nature 588, 424 (2020)'s topological-superconductor heterostructure, §5 |
| insulatingMagnet (6) | Yttrium Iron Garnet (YIG, Y$_3$Fe$_5$O$_{12}$) | Ferrimagnetic (two antiparallel sublattices, unequal moment), with the lowest known magnon damping of any material — the real substrate nearly every magnon-transport/magnon-BEC experiment actually runs on; not from the course, added as `insulatingMagnet`'s magnonics flagship (its ~2.85 eV gap is a large part of why its magnons live so long, there being no conduction electrons for them to scatter off) |
| metallicMagnet (6) | Iron Germanium Telluride (Fe$_3$GeTe$_2$) | The itinerant member of World 6's two-dimensional magnets — the same delocalized band electrons carry its current and its moment, unlike the insulating chromium trihalides above, and its strong uniaxial anisotropy is what lets a single sheet order; ionic gating pushes $T_c$ to roughly room temperature (Deng et al., Nature 2018); also spawns in World 9 rather than taking Iron and Cobalt's World 1 cross-list, since World 1 is the tutorial world and a magnon carrier there lands at double force on a starting Silicon; not from the course |
| insulatingMagnet (6) | Iron Phosphorus Trisulfide (FePS$_3$) | The Ising member of the MPS₃ family (MnPS₃ Heisenberg-like, NiPS₃ XY-like) — session 6's anisotropic-exchange content made real, ordering antiferromagnetically near 118 K and staying ordered down to the monolayer, tracked there by a Raman mode that appears with the order (Lee et al., Nano Lett. 2016); not from the course |
| metallicMagnet (9) | Manganese (Mn) | Elemental Mn's own complex itinerant antiferromagnetism is beside the point — it's the textbook itinerant local-moment magnet for this topic |
| quantumSpinLiquid (7, textbook fill-in) | Strontium Copper Borate (SrCu$_2$(BO$_3$)$_2$) | Shastry–Sutherland lattice — exactly-solvable dimerized/entangled ground state, a standard tensor-network benchmark material and a textbook triplon host |
| quantumSpinLiquid (7, textbook fill-in) | Thallium Copper Chloride (TlCuCl$_3$) | Quantum spin-dimer compound — another textbook triplon example |
| quantumSpinLiquid (7) | Herbertsmithite | The one real compound session 7 itself names, motivating MPS/tensor-network methods (kagome local moments); a Z2-spin-liquid candidate, a genuine vison host |
| quantumSpinLiquid (7, textbook fill-in) | Yttrium Barium Nickel Oxide (Y$_2$BaNiO$_5$) | S=1 Haldane spin chain — its ground state is closely related to the AKLT state, the exactly-solvable valence-bond-solid wavefunction matrix product states were introduced to describe in the first place |
| quantumSpinLiquid (8) | α-Ruthenium Trichloride (RuCl$_3$) | Candidate Kitaev spin liquid — Z2 topological order, a genuine vison host |
| quantumSpinLiquid (8) | Ytterbium Magnesium Gallium Oxide (YbMgGaO$_4$) | Triangular-lattice spin-liquid candidate |
| quantumSpinLiquid (8) | Tantalum Disulfide, 1T phase (TaS$_2$) | Star-of-David CDW Mott insulator / quantum-spin-liquid candidate (Law & Lee 2017) — the other half of the 1T/1H heterostructure below |
| quantumSpinLiquid (8) | Cerium Zirconate Pyrochlore (Ce$_2$Zr$_2$O$_7$) | Quantum-spin-ice candidate — no magnetic order or freezing down to ~20 mK, a continuum read as evidence for a U(1) quantum spin liquid (emergent photon, gapped spinons); its gauge structure is U(1), not the type's nominal Z2 vison, grouped in here anyway the same way triplon already is, a deliberate simplification; not from the course |
| kondoHeavyFermion (8, new type) | Ytterbium Rhodium Silicide (YbRh$_2$Si$_2$) | The flagship heavy-fermion/Kondo-lattice quantum-critical-point material — gives Kondo's own world a genuine Kondo-lattice compound, distinct from the frustrated-magnet spin-liquid candidates above |
| kondoHeavyFermion (8) | Cerium Cobalt Indide (CeCoIn$_5$) | A second Kondo-lattice flagship — Ce 4f moments hybridize into ~100-electron-mass quasiparticles right next to an antiferromagnetic quantum critical point; its own T→0 ground state is actually a d-wave superconductor built from those heavy quasiparticles, but the Kondo-lattice physics is what defines the compound, so it stays `kondoHeavyFermion` rather than `superconductor`; not from the course |
| kondoHeavyFermion (8, engineered, hybrid) | 1T-TaS$_2$ on 1H-TaS$_2$ | Engineered 2D Kondo-lattice heterostructure — the 1T phase's localized Mott moments (quantumSpinLiquid, above) proximity-couple to the 1H phase's itinerant electrons (superconductor, world 5), the same local-moment/itinerant-electron pairing that defines Kondo-lattice physics in YbRh₂Si₂/CeCoIn₅ above; §5 hybrid recipe result, fusing the two standalone phase entries, lives as a World 10 wild rather than a World 8 one |
| multiferroic (6, new type) | Nickel Diiodide (NiI$_2$), monolayer | Type-II multiferroic from noncollinear/helimagnetic order down to the monolayer limit (Song et al., Nature 2022) — hosts genuine electromagnons, the type's flagship. Same session (classical magnetism/magnons) as the ordered magnets above, so it's a World 6 wild too rather than its own world |
| multiferroic (6, new type, hybrid) | Twisted CrI₃ | §5 hybrid recipe (CrI₃ + CrI₃) — noncollinear moiré spin textures theoretically predicted (not yet confirmed) to induce magnetoelectric coupling; untwisted CrI₃ itself is only insulatingMagnet |
| multiferroic (6, new type) | Bismuth Ferrite (BiFeO$_3$) | The flagship room-temperature single-phase multiferroic — large switchable polarization (from the Bi³⁺ lone pair) coexisting with G-type antiferromagnetic order carrying a spin cycloid, with electromagnons actually observed (not just predicted, unlike Twisted CrI₃ above); not from the course |
| ferroelectric (new type) | Barium Titanate (BaTiO$_3$) | The textbook ferroelectric — its Ti⁴⁺ ion sits off-center below ~120°C, giving the lattice a spontaneous switchable polarization; no course topic covers ferroelectricity specifically, so like every other type without a session of its own it lives in World 9, which can host any type — also spawns in World 1, since spontaneous symmetry breaking covers a polarization order parameter just as much as a magnetic one (CLAUDE.md's ordinary-wild-encounters note) |
| ferroelectric (new type) | Germanium Telluride (GeTe) | Robust room-temperature ferroelectric Rashba semiconductor — a stronger, more switchable ferroelectric than BaTiO₃'s own ~120°C transition, same type, also a World 9 wild |
| ferroelectric (new type) | Hafnium Oxide (HfO$_2$), ferroelectric phase | CMOS-compatible ferroelectric behind real FeRAM/FeFET devices — pristine, undoped epitaxial thin films switch too (Cheema et al., Nature 2020; strain rather than a dopant stabilizes the polar orthorhombic phase); bulk, unstrained HfO₂ is the ordinary centrosymmetric phase and not ferroelectric at all, so this specifically means the thin-film phase; not from the course, also a World 9 wild |
| ferroelectric (new type) | Tin Telluride (SnTe), monolayer | Ferroelectric order at the two-dimensional limit — a one-unit-cell film polarizes *in* the plane of the sheet rather than across it and stays polarized to ~270 K, above bulk SnTe's own transition, with domains imaged and switched by an STM tip's field (Chang et al., Science 2016); same "no session of its own" reason for living in World 9 as BaTiO₃/GeTe/HfO₂, and World 9 only rather than taking BaTiO₃'s World 1 cross-list as well, since a Ferron Switch carrier in the tutorial world lands at double force on a starting Silicon; not from the course |
| chernSuperconductor (10, hybrid) | InAs/Al Majorana Wire | Engineered from an ordinary s-wave superconductor (Aluminum) proximitizing a strong-spin-orbit semiconductor (InAs) — genuine topological pairing, so `chernSuperconductor` rather than plain `superconductor`; §5 hybrid recipe result |

`WORLD_RIVALS[10]`'s finale boss ("The Adapted," "a model of you") has no row above —
unlike every other entry in this table, it has no main type or real compound of its own at
all, since its type is decided live in battle instead (see the note just below the table).

Bismuth Selenide (magnetically doped), Samarium Hexaboride and Graphene at strong coupling
are documented candidates not yet wired into `WORLD_CRYSTALS` — every other row above is
live in the code. Weyl
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

**A crystal's shape is its real crystal habit.** Every compound renders in the habit its
own lattice grows in — cubic for the rock-salt/bcc/fcc/zinc-blende compounds, octahedral
for the tetrahedrally bonded diamond family, rhombohedral for the R-3m/R3c trigonal ones,
tetragonal for the four-fold ThCr₂Si₂/PbO/perovskite/cuprate families, a hexagonal prism
for the hexagonal/wurtzite/hcp ones, a thin floating sheet cut to its in-plane cell
(hexagonal, triangular or four-sided) for the monolayers, and a plain faceted shard where a
structure is low-symmetry enough to have no characteristic habit. Every one of those is a
single body: a crystal drawn from two separate pieces is a fused hybrid (§5) and nothing
else, so the player reads "this is a fused state" off the shape alone, and a twisted or
moiré-stacked compound is therefore always a hybrid rather than an ordinary crystal with a
stacked look. A main type's `TYPE_LOOK` entry states the structure its members
typically share and `data/materials.ts`'s `crystal()` `variantOverride` param states an
individual compound's own where it differs (wurtzite GaN among the zinc-blende
semiconductors, rhombohedral Bi₂Te₃ and BiFeO₃, monolayer CrI₃ among the bulk magnets) —
a main type groups compounds by their physics, so it doesn't track their symmetry. The one
habit that is not a lattice claim is `'spire'` (quantumSpinLiquid, kondoHeavyFermion): a body grown tall and terminated in a point is a *growth* habit, and so
sits over any lattice. See `art/crystals.ts`'s `drawSolidShape` and STYLE.md's "Crystal
sprites" for what each one is drawn as.

**Every compound has its own look, not just its type's.** Beyond the `variantOverride`
above, every crystal built with `data/materials.ts`'s `crystal()` gets a small,
deterministic per-compound hue/rotation/stretch/sparkle variation (`art/crystals.ts`'s
`jitterFor`, keyed off the compound's own name) layered on top of its `TYPE_LOOK`
silhouette/color, so e.g. Manganese Oxide and Nickel Oxide (both `insulatingMagnet`-type cubes)
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
worlds 1-9 never spawn a hybrid-recipe result as an ordinary wild, so the Mirror's
corridor plays back the player's own fusions/discoveries literally rather than as echo
flavor text. Standalone compounds whose own type has no dedicated world of its own
(MnBi₂Te₄ and Monolayer NiI₂, whose types tie to existing topics' sessions; GeTe, whose
ferroelectric type ties to none) instead live in the earlier world their topic anchors
to, or in World 9 (which can host any type) if it anchors to none — see the
crystal-database table above. Barium Titanate, also ferroelectric, spawns in both World 1
(its polarization order is spontaneous symmetry breaking, that world's own topic) and
World 9 rather than World 9 alone, per that same table's note. `WORLD_RIVALS[10]` ("The Adapted"), a
separate table from the wild pool, is the one entity in the game with no fixed main type at
all — a "no real compound, a model of you" finale boss whose type is decided live every
fight instead. It starts each battle mirroring the player's own current type
(`getPlayerMaterial`), then transmutes — type, look, and display name together — every time
the player's attack resolves against it, reactively taking on a real, already-defined
compound's disguise (a "Polycrystalline `<compound>` Golem," the same naming every other
world's rival already follows) that hosts whichever quasiparticle class was just used against
it (`data/materials.ts`'s `typesHosting`, a reverse `MOVE_COMPATIBILITY` lookup, feeds
`allCrystals()` to pick a real compound of a genuinely matching type). The net effect
rewards varying attack classes rather than repeating one: having just adapted to host a
class, the *next* hit of that same class no longer gets the quasiparticle-mismatch bonus
against it. Implemented entirely in `BattleScene` (`adaptedForm`, `transmuteAdapted`,
`opponentView()`) as this one fight's own live state, not a change to the static
`WORLD_RIVALS[10]` entry itself (whose `type` field is only a placeholder for the pre-battle
overworld/dialogue preview) — its `moves` (attack moveset) stay fixed throughout, only its
defensive identity is dynamic; max HP was never tied to its identity in the first place (a
rival's own `rivalHpForWorld(world)`, unaffected by any transmutation — see §3's own note).

**Subtype combination flavor (real-compound tie-ins):** the same mechanic from §3
(main type + subtype → new material) has ready real-world flavor text once crystals are
named after compounds:
- superconductor + magnetic subtype → spin-triplet superconductor: Strontium Ruthenate
  (Sr$_2$RuO$_4$, historic triplet-SC candidate) or twisted graphene trilayers (observed
  spin-triplet SC under applied field, per session 5).
- superconductor + topological subtype → chernSuperconductor: same engineered platforms
  the chernSuperconductor row above already implements (a quantumSpinHall base +
  NbSe$_2$/CrBr$_3$ heterostructure, or the Fe-chains-on-Pb Majorana platform).

**Attacks are quasiparticles, not abstract labels.** Every move is named after the
excitation that actually carries it (`game/src/data/materials.ts`'s `MOVES`), and each
renders as its own distinct particle-effect silhouette in battle, one per move class and
therefore one animation per ordinary move (`game/src/art/attackStyles.ts`'s `EFFECT_STYLE`,
drawn by `game/src/art/attackShapes.ts`), picturing the excitation's own physics: Phonon
Beam is a compression pulse running down a straight lattice line, Magnon Wave a transverse
sine ribbon, Spinon Swap a singlet bond snapping into two spinons, Majorana Split two
mirrored half-glows recombining at the target, and so on -- `dev_notes/STYLE.md`'s "Attack
effects" section carries the full fifteen-shape roster and the shape grammar that keeps
them mutually distinguishable. There is deliberately no "impurity
scattering" move — disorder isn't a particle a crystal emits, so it has no place in the
move roster as an abstract attack.

**A crystal can only use moves its own physics supports** — `game/src/data/materials.ts`'s
`MOVE_COMPATIBILITY` table fixes, per main type, which quasiparticle classes it can host
(`game/src/data/TAXONOMY.txt` is this table's hand-edited design source, see above). The
three ordinary band types split three ways by how far a carrier gets: `metal` (e.g.
Graphene) gets Electron Pulse, Phonon Beam, *and* Plasmon Resonance (only a partially filled
band carries a plasmon); `semiconductor` (Silicon) gets Electron Pulse and Phonon Beam,
its gap narrow enough for an ordinary band electron but not a free electron gas;
`insulator` (Magnesium Oxide) gets Phonon Beam alone, its gap too wide for an ordinary
band electron to get through and its bands too empty for a plasmon. None of the
three gets Magnon Wave, since none has magnetic order to carry one. Every other class is
gated the same way to whichever types the actual physics motivates it for (Magnon Wave →
magnetically ordered types; Chiral Current → integer-Chern types; Helical Lock →
time-reversal-protected edge/surface types; Anyon Braid → fractional-Chern only; Majorana
Split → `chernSuperconductor` only, genuine topological pairing required; Higgs
Oscillation → any superconducting type; Vison Loop/Triplon Surge → quantum-spin-liquid
only; Spinon Swap → quantum-spin-liquid *and* Kondo-lattice, since a Kondo lattice
fractionalizes into spinons at its own Kondo-breakdown quantum critical point; Heavy
Fermion Drag → Kondo-lattice only; Ferron Switch →
ferroelectric/multiferroic; Electromagnon Drive → multiferroic only). This is enforced
everywhere the player's moveset shows up: the battle move menu (`getBattleMoves` = learned
moves ∩ compatible moves) and Noether's shop (same intersection, so she only ever offers
what the player's *current* crystal form can actually carry — see the transmutation
mechanic in §5).

**One deliberate exception: Kondo's three moves aren't attacks at all, so
`MOVE_COMPATIBILITY` doesn't apply to them.** Spin Screening, Charge Screening,
and Symmetry Cloud (`screening`, §5) are self-buffs — casting one raises a
3-turn cloud on the caster's own side instead of hitting the opponent, so there's
no defender to mismatch against and no compatibility list to check. Left off
every main type's `MOVE_COMPATIBILITY` list entirely rather than added to all of
them, they're purchasable and usable from any form regardless. Landau's two Analytic moves (`skyfallBeam`/
`groundEruption`, §5) and Skłodowska-Curie's two Ultimate moves (`ultimateMeteor`/
`ultimateNova`, §5) reach the same "usable from any form, never mismatches" result a
different way: their static `class` simply defaults to `phonon`, the same universal,
physics-motivated class Phonon Beam itself carries, rather than needing a class
of their own. An Analytic move's real risk/reward comes from the question
`BattleScene.showAnalyticQuestion` asks before the hit resolves: right answer
doubles the damage, wrong answer halves it. An Ultimate move instead asks three
questions in a row (`BattleScene.showUltimateQuestions`) and is all-or-nothing:
every answer correct lands the hit at full (already very high, see below) power,
any wrong answer whiffs it for zero. Separately, both Landau and Skłodowska-Curie
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
has a lattice) < Electron Pulse (`electron`, an ordinary band electron) < Magnon Wave /
Plasmon Resonance / Ferron Switch (`magnon`/`plasmon`/`ferron`, tied — an ordinary collective
mode of a magnet, a metal, or a ferroelectric, none more exotic than the others; session
9's own RPA treatment names "the plasmon" as a quasiparticle in exactly those words) <
Electromagnon Drive / Triplon Surge (`electromagnon`/`triplon`,
tied — a magnon-phonon hybrid and a dimer magnet's own confined
triplet mode) < Spinon Swap / Vison Loop / Chiral Current / Helical Lock / Higgs
Oscillation / Heavy Fermion Drag (`spinon`/`vison`/`chiral`/`helical`/`higgs`/
`heavyFermion`, tied — fractionalized or topologically protected, but none of them
non-Abelian) < Anyon Braid / Majorana Split (`chargedAnyon`/`majorana`, tied for the most
exotic tier the ordinary Attacks roster covers: fractional braiding statistics and
non-Abelian zero modes).
Because Phonon Beam (`phonon`) is on every type's
`MOVE_COMPATIBILITY` list, it can never trigger the quasiparticle-mismatch double-damage
rule above — the one universal move is also the one that never gets the mismatch bonus, by
design. Landau's two Analytic moves (`skyfallBeam`/`groundEruption`) sit at power 10 on
purpose — level with the `spinon`/`vison`/`chiral`/`helical`/`higgs`/`heavyFermion` tier and
below only Anyon Braid/Majorana Split among the ordinary attack moves — since their real payoff is the answer-gated
2x/0.5x multiplier above, not raw power. Kondo's three moves (Spin Screening, Charge
Screening, Symmetry Cloud, §5) carry the same low `power` value, on par with Electron Pulse,
but it's never read as damage at all — they're self-buffs, not attacks, so `power` only
feeds their qumatessence price (§5's shop-cost formula), the same role it plays for every
other move. Skłodowska-Curie's two Ultimate moves (power 100, ten
times an Analytic move's power — above even Anyon Braid/Majorana Split, the ordinary
roster's own most exotic tier) are the exception to "power isn't the point": the
3-questions-all-correct gate is steep enough that raw power *is* the payoff once it's
cleared.

## 4. Battle system

Turn-based, speed-ordered by Momentum. The faster side doesn't just swing first each round —
it swings more often, scaling with how much faster it is: its hit count is its effective
Momentum divided by the slower side's, floored and capped at 5 (`clamp(floor(ratio), 1, MAX_MULTI_HIT)`).
The cap keeps an extreme Momentum gap from producing an unbounded hit sequence; the slower side
always still gets exactly one hit. All of the faster side's hits resolve first, consecutively,
before the slower side's single hit — and the round stops immediately if either side's HP hits
0 partway through, rather than firing the rest of the queued hits.

**Every swing is its own pick.** A round is a list of slots — one per hit, the faster side's
first — and on each of the player's own slots the move menu goes live and waits. Swinging three
times in a round means picking three times, and the three picks are independent: three different
quasiparticles against three different weaknesses if that is what the fight calls for. The
opponent rolls its own move fresh on each of its slots for the same reason. This holds for every
move without exception, quiz-gated ones included, and the gate travels with the move rather than
with the round: each slot a Landau Analytic move is picked for asks its own question, and each
slot a Skłodowska-Curie Ultimate is picked for asks its own three. A player fast enough to swing
five times can spend all five on Ultimates and answer fifteen questions for it, or spend one and
take the ordinary attacks for the rest.

The "Turns" widget is what makes a multi-slot round readable: its leading icons are the current
round's own remaining slots, so how many picks are left before the opponent swings is on screen
throughout, with the tail tiling the next round's predicted shape.

**Self-buffs (Kondo's three moves, §5).** Kondo teaches three moves that are self-buffs, not
attacks — casting one raises a 3-turn screening cloud on the *caster's own* side instead of
hitting the opponent, dealing no damage and never triggering the quasiparticle-mismatch rule
below. Never randomly rolled: the player picks which cloud by picking the move. A cast spends
one slot like any other pick, so raising a cloud on the first of several swings still leaves the
rest of them to attack with, and a side with a single slot spends its whole round on it. The
cloud takes hold on whichever slot it is cast on; a side's cloud ticks down once per round, on
that side's last slot, and never on the round it was raised in, so it always screens for exactly
its full duration.

**A cloud screens one quantum number, and only damps a quasiparticle that carries it.** An
incoming hit is halved when the attacking move's *effective* class (`getTunedMoveClass`, so a
tuned Analytic/Ultimate move screens as whatever the player assigned it) carries the screened
quantum number, and lands in full otherwise — `data/materials.ts`'s `SCREENING_CHANNELS` is
the per-class table, and `BattleScene.screeningMultiplier` the single term it feeds:
- **Spin Screening** — halves `electron`, `magnon`, `spinon`, `triplon`, `electromagnon`,
  `chiral`, `helical`, `heavyFermion`. A charged anyon is deliberately absent: in a
  spin-polarized fractional state it carries fractional charge and fractional statistics, no
  spin.
- **Charge Screening** — halves `electron`, `chargedAnyon`, `chiral`, `helical`,
  `heavyFermion`, plus `plasmon`, `ferron` and `electromagnon`. The reading is "anything a
  Coulomb screening cloud couples to," not "nonzero net charge," which is what brings in the
  charge sector's own collective mode and the two dipole-active modes (free carriers screen
  polar order, which is why a ferroelectric metal is a rarity).
- **Symmetry Cloud** — halves the modes of a spontaneously broken symmetry's own order
  parameter, amplitude branch included: `phonon`, `magnon`, `ferron`, `electromagnon`,
  `higgs`. The Higgs is in because it is the order parameter's amplitude mode, the Goldstone's
  partner rather than a Goldstone itself. A plasmon is out because a normal metal breaks no
  symmetry.

`majorana` and `vison` are screened by nothing at all: neutral, spinless, and no order
parameter of their own. `phonon` being a Symmetry Cloud target means the universal move, and
every untuned Analytic/Ultimate move, is screened by that one cloud.

The screened fraction starts at half and deepens with Feynman's own move-leveling (§5, World
7) applied to that specific Kondo move, the caster's own level only
(`BattleScene.screenReduction`, the same isPlayer-gated shape `effectiveMovePower` uses for an
ordinary attack's power): `SCREEN_REDUCTION_BY_LEVEL` in `data/balance.ts` is a flat per-level
table, 50% / 62% / 68% / 75%, rather than a base scaled by `MOVE_LEVEL_MULTIPLIERS` — a half
scaled by the 3x top tier passes 1 outright, so a single cap would swallow the middle two
tiers. The top tier stays short of full immunity by design.

None of the three buff names doubles as a `MoveClass`, so a buff name never reads as if this
generic technique were tied to one specific move's quasiparticle.

Only one cloud can be active per side at a time — a fresh cast replaces whatever was already
there rather than stacking, so screening one quantum number always means giving up the other
two, matching the deliberately simple "one type-interaction rule, not a
chart" philosophy above. Implemented generically per-side in `BattleScene.resolveSelfBuff`/
`resolveHit` (the same multiplier-term shape every other `resolveHit` factor already uses)
rather than hardcoded to "player only," even though only the player can currently learn the
moves that apply them — no `WORLD_CRYSTALS` entry knows them yet. Ticks down once per round
per side regardless of how many actions that side took this round (a Momentum advantage no
longer repeats a self-buff cast — see §4's velocity-ratio paragraph above — so this only
matters for a side continuing to hold an already-active buff while using ordinary moves) and
expires with its own battle-log line appended the same way a mismatch/crit clause stacks onto
a hit's log line. Clouds are battle-only and reset at the start of every fight — never
persisted to the save. A small pill under each side's HP bar in battle shows which cloud (if
any) is active and how many turns remain, and the cloud itself is visible for its whole
duration as an aura wrapped around the carrying crystal, one silhouette per channel drawing
the physics of what it screens (`art/screeningAuras.ts`, STYLE.md's "Battle status
effects").

**Quasiparticle mismatch.** The sole type-interaction rule in battle (§3): a defender
whose own type can't physically host the attacking move's quasiparticle class at all
(`data/materials.ts`'s `MOVE_COMPATIBILITY`, checked via `canHost()`) takes that
hit at double force (`BattleScene.resolveHit`) — a plain band insulator has no magnetic
order to damp a magnon pulse with, so it lands unmitigated. Applies symmetrically
to both sides, same as every other `resolveHit` term. Surfaced in the battle log as "No
natural defense against this!". Kondo's screening term (above) sits alongside it as one more
symmetric `resolveHit` multiplier, so a mismatched hit against a screened defender resolves
both: doubled for the mismatch, then halved for the cloud.

**World 1 opponents attack with phonon moves only, while the player is still unbuilt.**
Every opponent-side hit is rolled fresh from the opponent's own moveset
(`BattleScene.playerAttack`'s `opponentMoveId`). In World 1 that roll is filtered down to
the moves whose class is `phonon` — for the world's wild encounters and for its rival golem
alike — as long as *every* one of the player's three stats is still strictly below
`PHONON_ONLY_STAT_CEILING` (`data/balance.ts`, 5). `phonon` is the one class every type
hosts, so a phonon hit can never take the mismatch bonus above: a player who has not yet met
the mismatch rule cannot be double-damaged by a moveset they had no way to read. The
training-wheel comes off as soon as any stat reaches the ceiling — a few points bought from
Noether is enough — and worlds 2-10 always roll the whole authored moveset. The condition reads
`BattleScene.playerStats`, the snapshot `create()` takes from the registry, so it is settled
for the length of a fight; stats only ever change between battles anyway.

This is a battle-time filter, not a change to `WORLD_CRYSTALS[1]`: the same compounds
cross-spawn in later worlds (Iron and Cobalt in World 6, Barium Titanate in World 9) and keep
their full movesets there, and the Materialdex keeps listing every move a compound carries.
Every World 1 wild and the World 1 rival carry Phonon Beam, so the filtered pool is never
empty; the code falls back to the unfiltered moveset if one were ever authored without it.

**Move menu is grouped by kind and paged one kind at a time, not one flat list.**
`BattleScene.drawMoveMenu` splits the currently usable moves (`getBattleMoves`) into up to
four sections -- **Attacks** (every ordinary physics-gated move -- any move that isn't in
`ANALYTIC_MOVE_IDS` or `ULTIMATE_MOVE_IDS` and whose `class` isn't `'screening'`),
**Analytic** (Landau's two answer-gated moves, identified by move id rather than by any
shared class, tagged `★` with their own "right=2x wrong=½x" legend line under the header),
**Ultimate** (Skłodowska-Curie's two answer-gated moves, tagged `★★★` with their own
"3/3 correct or it whiffs" legend line), and **Buffs** (Kondo's currently-active self-buff
move, at most one, since `getBattleMoves` only ever surfaces whichever one is
`kondoActiveMove`, §5, tagged with its own "self-buff, no damage, 3 turns" legend line)
-- but renders only the page the player is currently on (`movePageIndex`), not all of them
stacked. A section only counts as a page at all if it has at least one usable move, so a
player with no Landau/Skłodowska-Curie moves bought or no Kondo move active never sees an
empty page, and the pager (◀/▶ buttons plus the Left/Right keys, `switchMovePage`) is hidden
entirely once there's only one page to switch between. A section with more moves than one
page can hold (`moveMenuPages`, capped at `MOVE_MENU_MAX_ROWS` -- 3 moves per page, always)
splits into several same-label pages instead -- `chernSuperconductor` (`electron`/`phonon`/
`higgs`/`chiral`/`majorana`, the broadest single main type's own `MOVE_COMPATIBILITY` list)
is the one form whose **Attacks** section needs this today, once every matching move is
unlocked, splitting its 5 moves into two pages (3 + 2). These groups work
differently enough from an ordinary attack (and from each other) that a flat stacked list
blurred the distinction -- and paging instead of stacking means a page's own row height
(`drawMoveMenu`'s `rowH`) is budgeted only against that one page's move count, not the worst
case across every section at once; capping every page at the same 3-move limit also keeps
that budget (and so each button's font size) close to identical from one page to the next.
Each button also shows its power and, computed against the current opponent's type, a
`!!2x` tag when the quasiparticle-mismatch double-damage rule above applies, plus a one-line
bottom-of-panel legend spelling out that symbol; a button's label (move name plus any
`★`/`★★★`/`!!2x` tag) wraps onto a second line if it doesn't fit the panel's width on one,
with the whole page's font size shrunk uniformly, if needed, to keep every label on the
page within that same 2-line limit rather than a 3rd.

**Battle background per place.** `BattleScene.drawBackground` colors the arena from
where on the map the fight started, not just from which world it is: the encounter
tile is sampled off the same terrain plan the corridor is drawn from
(`scenes/overworld/terrain/plan.ts`'s `sampleBattleLocale`, passed through the
battle's own init data) and supplies the palette (that tile's own `art/biomes.ts`
entry — which on a World 9 defect patch is the borrowed world's, not the Defect
Scars'), the color grade (whatever off-path material dominates the ground around
it), the ground tint (the domain hue of the region it stands in, worlds 1/3/8) and
the skyline (the ridge seeds fold in the tile's coordinates, so each place in a
world keeps its own stable silhouette). Sky, ridgelines, ground, and the decorative
crystal outcrops/ground tufts are all shaded off those colors, so a fight in the
frozen caverns or the cracked world actually looks like it, not like every other
world's battle. The arena stays a backdrop rather than a re-render of the corridor:
it is built as a soft layered atmosphere (curved parallax ridgelines, fog blending,
a terrain-keyed color grade, drifting haze, corner vignette) — STYLE.md's "Battle
backdrop" section has the visual rules.

**Wild encounter dialogue.** Bumping into a wild crystal opens an in-map dialogue
screen (`OverworldScene.showEncounter`, not a separate scene): a greeting line tied to
that material's main type (`game/src/data/greetings.ts` -- a magnet's greeting reads
differently from a superconductor's, since it's keyed by `MaterialType`, not generic) and
one physics question from `game/src/data/quiz.ts`'s `getWorldQuestion(world, materialName)`
together on that same screen -- one correct answer, one incorrect answer (order shuffled),
plus "let me pass." Formulas in a question or an answer are marked `$...$` in `quiz.ts` and
typeset when drawn, so a square root reads as a radical and `v_F` as a real subscript
(CODEMAP.md's "Formulas in question text"); at the largest text-size presets, a question and
its answers that together outgrow the canvas split across two arrow-joined pages rather than
shrinking or spilling (STYLE.md's "Wild encounter dialogue"). Worlds are the primary organizing unit for quiz content, not materials:
`WORLD_QUESTIONS[world]` is each world's own pool, scoped to that world's own topic and
difficulty (session NN.tex), and `getWorldQuestion` draws from it by default. A handful of
materials additionally carry their own supplementary pool in `MATERIAL_QUESTIONS`, and
whenever the material actually fought has one, `getWorldQuestion` coin-flips between the
world's pool and that material's pool instead of always using the world's. This exists for
two distinct reasons: a couple of materials that spawn in two worlds (Barium Titanate,
Herbertsmithite) have authored content too topic-uniform to split cleanly between their two
worlds' own pools, so it lives as a shared bonus layer instead; and every named hybrid-recipe
result (`WORLD_CRYSTALS[10]`'s own wilds, spawning only in World 10) keeps its own pool so it
has a "material" side to draw against in World 10's own picker, described next. Quiz content
is sourced from the matching session's lecture notes, or, for materials whose topic has no
session of its own, written directly from the compound's real physics.

World 10 draws differently from worlds 1-9, since its wilds are hybrid-recipe results rather
than a course topic of their own: `getWorldQuestion(10, materialName)` coin-flips between the
fought hybrid's own `MATERIAL_QUESTIONS` pool and `ML_LECTURE_QUESTIONS`, a dedicated pool
sourced from session10.tex (the course's machine-learning finale -- neural network quantum
states, ML inside DFT, the Ising/Ising-gauge-theory "easy vs. hard" phase-classification
example, Hamiltonian learning), fitting since World 10's rival ("The Adapted") is itself an
adaptive AI.

Answering correctly multiplies the player's attack power for that battle (1.5×, shown in
battle as a glowing golden aura -- pulsing rings, radiant rotating spikes, rising embers --
around the player's crystal); answering wrong weakens it (0.6×, shown as a small grey
raincloud); passing skips the battle entirely with no bonus or penalty and no scene change. A
world whose pool were empty would fall back to a plain "Fight!" / "Let me pass" choice on the
same greeting screen, though every world currently has a populated pool.

**Starting loadout and unlocking moves.** The player's crystal starts knowing only Phonon
Beam. Reaching world 1's middle tile for the first time introduces the guardian Noether (§5),
who sells every other move (`SHOP_MOVE_IDS`) for qumatessence, priced by move power
(`data/balance.ts`'s `shopCost`, re-exported by `data/materials.ts`, currently power × 5)
-- filtered down to whatever the player's *current* crystal form can physically carry (§3's `MOVE_COMPATIBILITY`), so a
semiconductor-type player (Silicon, by default) is only ever offered Electron Pulse until
they transmute into a form that supports more. Unlocked moves persist in the Phaser registry's `unlockedMoves` entry (a global
"moves learned," never erased by transmuting) and become available as battle buttons in
`BattleScene` once filtered through that same compatibility check
(`getBattleMoves` = learned ∩ compatible). The move list renders as a docked panel on
the right of the field (`BattleScene.drawMoveMenu`).
Noether's shop panel also carries a second tab for spending qumatessence on the player's own
Energy/Momentum/Lifetime stats (§3). The actual "leave this world" action -- a
footer button that fights the world's rival crystal the first time it's clicked (see §2),
then crosses into World N+1 once that rival is beaten (`OverworldScene.confirmGate`) -- lives
only at the pass itself, not in Noether's (or any guardian's) own panel, since the pass is where
that world's boss actually stands (§2).

**Stakes.** An ordinary battle's qumatessence stake scales with the current world's
difficulty: winning earns it, losing costs it, floored at 0. It rises linearly from 50 in
World 1 to 200 in World 10, rounded to the nearest 10 (`BattleScene`'s
`battleStakeForWorld`), so the late game pays out meaningfully more than the early game
without inflating World 1. A rival fight always pays out double that same world's ordinary
stake, win or lose, since beating the world's gating rival is the harder, rarer fight.
Either way the player's crystal is fully healed afterward (`scenes/BattleScene.ts`) -- the
qumatessence stake, not HP attrition, is what's on the line from one battle to the next. The
battle's opening line and its win/lose closing line are both flavor text from
`game/src/data/greetings.ts`, likewise keyed by the wild material's type.

**Post-battle screen and Qumatex.** Every battle's end screen also shows one
sentence tying the fight to the real physics of the material just fought
(`game/src/data/materialdex.ts`'s `materialBlurb`, falling back to a generic blurb per
`MaterialType` for a compound without its own entry yet). The first time a wild material is
encountered (not per-battle, and not for rival crystals, which are gate encounters rather
than collectible materials), it's
recorded into the Phaser registry's `discoveredMaterials` list
(`OverworldScene.recordDiscovery`); the Hub's Qumatex station (§2) indexes every real
compound in the game (`data/materials.ts`'s `allCrystals()`), not just discovered ones --
an entry not yet found shows as "???" with a masked crystal render rather than being
absent from the list entirely, so the index reads as a checklist of the whole game.
Filterable by type, laid out as a scannable left-column list of every (matching) compound's
name alongside a right-hand detail pane (name, blurb, and the compound's own rendered
crystal) for whichever one is selected (`HubScene.renderMaterialdexPanel`). A compound that also
carries a short chemical-formula/acronym form (`data/types.ts`'s `Material.shortName`, e.g.
"Manganese Oxide (MnO)", "Yttrium Iron Garnet (YIG)") shows it in parentheses right after the
full name (`data/materials.ts`'s `materialDisplayName`) -- optional, only set where a
genuinely shorter, recognizable form exists; a compound whose own `name` already is that
short form (e.g. "YBCO", "Bi₂Te₃") doesn't carry one.

## 5. Guardians, economy, and story arc

Every one of the ten worlds has its own guardian, waiting mid-corridor
(`OverworldScene`'s `WORLD_GUARDIANS` table, every entry's `tile: 'middle'`) rather than
at the goal -- the goal tile is occupied by that world's boss (see below), so a guardian
is someone the player meets partway through the journey, not a gate to it. The first
walk onto their row is the introduction, and it opens their panel by itself; afterwards
their panel is opened deliberately, by standing with them (their tile or any of the eight
around it) and pressing Space, the same approach-read-press the passes use
(`OverworldScene.guardianAtPlayer`/`talkToGuardian`, STYLE.md's "Guardians in the
overworld"). Every
guardian stays reachable once met by standing in the Lab as their own clickable avatar
(`HubScene.spawnGuardianAvatars`, `data/save.ts`'s `metGuardians`)
-- clicking one opens that guardian's own panel (shop, teleport
hub, transmutation) directly in the Lab, the same panel `open` callback `WORLD_GUARDIANS`
uses when the player walks up to them mid-world, with no change to the player's own
world/scene/position (`HubScene` implements `GuardianPanelHost`, the interface every
guardian-panel file is written against -- see CODEMAP.md's "Guardian panels"). Opening a
guardian is never itself a way to travel; Bloch's panel is the one guardian panel with an
explicit travel action of its own (its destination rows), which still moves the player
like any other deliberate warp. Every guardian has a
real mechanic (Noether, Bloch, Dresselhaus, Landau, Majorana, Anderson, Feynman, Kondo,
Franklin, Skłodowska-Curie) -- a guardian without one yet would fall through to the
shared `OverworldScene.showGuardianLore` panel (avatar + quote only), but nothing
currently does. World 10's guardian (Skłodowska-Curie) is gated behind actually walking
to World 10 rather than any earlier "met" save state -- her id, `sklodowskaCurie`, is
deliberately distinct from any id used earlier in the game, so no pre-existing save
state can mark her met before the player has actually reached her.

- **Noether** → world 1 middle → sells every extra attack move and stat upgrade in the
  game (fitting, since Noether's theorem is literally "symmetry implies a conservation
  law" -- here, conserving enough qumatessence gets you a new move or a sharper stat)
- **Bloch** → world 2 middle → folds space between worlds: teleports the player to any
  world they've already visited (`scenes/panels/bloch.ts`'s `showBlochHub`) -- fitting, since a
  Bloch state is a superposition spread across every unit cell, not pinned to one.
  The destination list is the shared list+detail left column (`renderListColumn`,
  `scenes/panels/listDetail.ts`, STYLE.md's "List+detail panels"): it always lists all ten
  built worlds, masking rows the save hasn't discovered to `???`, and pages itself
  (`scene.blochPage`) whenever those ten rows don't fit one page at the current text-size
  preset. Superposition Mode (see §7) reads every built world as discovered
  (`isSuperpositionMode()`, the same short-circuit Dresselhaus/
  Majorana/Anderson use for their own candidate pools, not the persisted
  `visitedWorlds` list), so every row is a named, travelable destination immediately -- even
  from the Lab on a save that has never yet crossed a pass; walking through a world's own pass
  (below) is the other way to move between worlds, one step at a time
  rather than a jump to an arbitrary destination. Each individual destination is
  its own one-time `BLOCH_DESTINATION_COST` (15) qumatessence unlock (registry/save
  `blochUnlockedWorlds`, a list of world numbers already paid for) -- traveling to a
  world for the first time costs qumatessence and unlocks that destination in the same
  click, every later trip there is free, the same one-time-unlock-then-free-forever
  shape Franklin's passives and Skłodowska-Curie's Ultimate-class unlocks already
  use, just keyed per destination rather than per passive/class since teleporting isn't
  a purchasable move or passive of its own. Priced lowest of the four repeatable-action
  guardians (Bloch/Dresselhaus/Anderson/Majorana) since a single destination is pure
  convenience -- it grants no new battle power, only skips walking to one
  already-reachable world. Superposition Mode bypasses this per-destination cost
  entirely (`isSuperpositionMode()`, not the persisted list), since that mode relies on
  Bloch's hub being the *sole* way to move between worlds with no separate warp panel
- **Dresselhaus** → world 3 middle → lets the player transmute into any *single* crystal
  they've already defeated (`scenes/panels/dresselhaus.ts`'s `showDresselhausPanel`/`transmuteInto`) -- fitting,
  since her real physics is that a material's properties come from how its atoms are
  *structured* (its nanostructure and phonon spectrum), not just which atoms they are, so
  understanding a defeated crystal's structure well enough is what lets the player rebuild
  themselves into it for a while. She still belongs at world 3 despite the topic there being
  topological band structure: her own early work characterizing bismuth's band structure is
  a real historical precursor to the Bi-Sb/Bi₂Se₃ family that became the first 3D topological
  insulators. Transmuting changes the player's look, type, and which moves are currently
  usable (§3), without erasing any move already learned or touching their stats or max HP
  (max HP is never tied to crystal form at all -- see §3's own note on it). Superposition
  Mode's blanket unlock grant (§7) also seeds the player's own starting `playerForm` --
  see Majorana below, since the two guardians share that one slot. **Excludes every hybrid-recipe
  result** (`data/materials.ts`'s `isHybridMaterial`, every one of which lives only as a
  World 10 wild, never an earlier one) -- becoming a fused state is specifically Majorana's
  mechanic below, not this one. In Superposition Mode the candidate list is every non-hybrid
  crystal in the game (`data/materials.ts`'s `allCrystals()`, filtered) rather than only ones
  actually defeated. Each individual crystal is its own one-time
  `DRESSELHAUS_TRANSMUTE_COST` (25) qumatessence unlock (registry/save
  `dresselhausUnlockedCrystals`, a list of crystal names already paid for) -- becoming a
  given crystal for the first time costs qumatessence and unlocks it in the same click,
  every later transmutation back into it is free, the same shape Bloch's per-destination
  gate above uses -- priced above Bloch's since committing to become one specific
  crystal (its own look, type, and moveset all at once) is a bigger capability swing per
  option than pure travel convenience. Superposition Mode bypasses this per-crystal cost
  entirely the same way Bloch's does
- **Landau** → world 4 middle → sells two quiz-gated moves (`skyfallBeam`,
  `groundEruption` -- `scenes/panels/landau.ts`'s `showLandauPanel`, `data/materials.ts`'s
  `ANALYTIC_MOVE_IDS`, a hardcoded pair of move ids rather than a shared class --
  neither move has a class of its own to be identified by, see below) -- fitting,
  since Landau's own physics (Landau quantization -- a perpendicular field collapsing a
  continuous band into flat, equally spaced levels) is world 4's topic itself. Using one asks a physics-equation question first (`data/quiz.ts`'s
  `ANALYTIC_QUESTIONS`, `BattleScene.showAnalyticQuestion`): answer right and the hit
  lands at 2x, answer wrong and it lands at 0.5x. Each question is tagged with the
  world number(s) whose course topic it belongs to, and `getAnalyticQuestion(visitedWorlds)`
  draws only from questions tagged with a world the player has already visited (falling
  back to the full unfiltered pool if that intersection is ever empty) -- an early
  player is quizzed on early-world physics, not topics they haven't reached. Each move
  also gets its own dramatically flashier, per-move (not per-class) visual, deliberately
  reading as stronger than every other move class (`art/attackStyles.ts`'s
  `ANALYTIC_SHAPES`, drawn by `art/attackShapes.ts`'s `playBeam`/`playEruption`):
  `skyfallBeam` drops a multi-layer column of light from off the top of the screen --
  a white-hot core, two swirling side-rays, a trail of falling sparks, and a radiant
  sun expanding at the point of origin; `groundEruption` bursts a wide double
  shockwave ring and a bright geyser core up through nearly twice the shard count of
  the burst silhouette's particle cluster. Each move's static `class` simply defaults to `'phonon'` --
  the same universal, always-hostable class Phonon Beam itself carries -- so an
  untuned move is purchasable/usable from any form and never mismatches, without
  needing a class of its own. Their displayed name is always "`<quasiparticle>` Lance"/
  "`<quasiparticle>` Eruption" (`tunedMoveDisplayName`), defaulting to "Phonon Lance"/
  "Phonon Eruption" while untuned -- `skyfallBeam`'s own display name reads "Lance," not
  "Beam," so it never collides with the free starting Phonon Beam move once both default
  to `'phonon'`. Buying a move (or later revisiting Landau) is also where the quasiparticle
  is chosen: the panel's left column lists each move as a heading and the open one's
  hostable quasiparticles as its entries (offering
  `TUNABLE_MOVE_CLASSES` -- every ordinary Attacks-section class (i.e. every class
  except Kondo's `'screening'`) -- filtered down to only the ones the player's
  *current* form can actually host, `canHost(playerMaterial.type, cls)`: a class as
  narrow as `'electromagnon'` (only the `multiferroic` type hosts it) only ever
  shows up while the player is wearing a multiferroic form, rather than being a free
  "always mismatch nearly every opponent" pick regardless of form. `'phonon'` is on
  every `MOVE_COMPATIBILITY` list, so the filtered list is never empty) that assigns
  the move's registry/save `moveClassTuning[moveId]` entry (a map shared with
  Skłodowska-Curie's Ultimate moves below, since both guardians' shops read and write
  the same generic tuning helpers), labeled with the quasiparticle's own bare
  name (`quasiparticleLabel`, e.g. "Magnon" for `'magnon'`) rather than the
  class id itself or the matching ordinary move's own full name. This choice only feeds
  `getTunedMoveClass`, which `BattleScene`'s quasiparticle-mismatch check reads in
  place of `move.class` for these two ids (see §3/§4) -- still purchasable/usable
  from any form and still asks its question regardless of tuning. The displayed name
  always folds in the current quasiparticle (`tunedMoveDisplayName`, e.g. `skyfallBeam`
  tuned to `'magnon'` reads as "Magnon Lance" everywhere -- the move menu, the
  question panel, the battle log), built from the quasiparticle's own label plus each
  move's fixed shape word ("Lance"/"Eruption") rather than a second hand-authored word
  list. An unbought move has no
  assignment yet; an already-bought one shows "tuned to `<name>`" with a free
  "Retune" click back into the same picker (re-opening the same current-form
  filter, so retuning after a transmute only offers what the *new* form can host),
  or "untuned" if never assigned -- untuned simply means the mismatch check keeps
  reading the move's own default `'phonon'` class. The picker only filters at *pick*
  time, though, so a tuned assignment can still outlive a later transmute into a
  form that can't host it; `getTunedMoveClass` guards that case by falling back to
  `'phonon'` (the one class every form hosts) whenever the player's
  *current* form can't host the saved assignment, and `tunedMoveDisplayName`/the
  shop label follow the same fallback so the name and the mismatch math never
  disagree -- the shop label reads "tuned to `<name>`, reverted to Phonon (this
  form can't host it -- retune)" in that state (the bare quasiparticle noun,
  `quasiparticleLabel`, not the move's own shape word).
- **Majorana** → world 5 middle → lets the player fuse two crystals they've already
  defeated into a new hybrid material and become it immediately
  (`scenes/panels/majorana.ts`'s `showMajoranaPanel`/`data/materials.ts`'s `combineMaterials`) -- but only a curated
  catalog of named parent pairs (`data/materials.ts`'s `HYBRID_RECIPES`/
  `hybridRecipeResult`), keyed by parent *name* rather than main type, not any two
  defeated crystals. The catalog is closed by name rather than governed by a generic
  "these two main types always produce that main type" rule, because such a rule would
  have to forbid same-type pairs on the reasoning that "fusing two superconductors isn't
  a new phase" -- but real platforms include exactly that (Twisted Bilayer Graphene from
  two graphene sheets) -- so a pair with no named recipe simply can't be fused, same-type
  or not. Every recipe mirrors a real (or credibly engineered) platform -- an InAs/Al
  Majorana nanowire; two Graphenes → Twisted Bilayer Graphene (magic-angle
  superconductivity); Chromium + Bi₂Te₃ → Cr-doped (Bi,Sb)₂Te₃, magnetic doping of an
  undoped topological-insulator host, where the Cr breaks time-reversal symmetry and turns
  Bi₂Te₃'s helical surface state into a single chiral edge channel -- a zero-field quantum
  anomalous Hall state; CrI₃ + NbSe₂ or NbSe₂ + CrBr₃ → topological-superconductor
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
  filtering is needed here. Each individual hybrid *result* is its own one-time
  `MAJORANA_FUSE_COST` (60) qumatessence unlock (registry/save
  `majoranaUnlockedResults`, a list of result names already paid for) -- keyed by the
  fused result's own name rather than by parent pair, since no two different pairs in
  `HYBRID_RECIPES` currently produce the same result, so "have I paid to become this
  hybrid" is the same question regardless of which pair first reaches it. The cost only
  shows up (and is only charged) once a specific hybrid result is actually confirmed;
  browsing every reachable hybrid in the panel's table costs nothing, the same
  "browsing is free, only committing costs" shape Anderson's host pick uses below.
  Priced highest of the four
  repeatable-action guardians (Bloch/Dresselhaus/Anderson/Majorana) -- above even
  Noether's/Landau's/Kondo's ordinary `shopCost` top end (~55) -- since unlocking one
  specific hybrid result is comparable in value to learning a whole new move, and
  reaches only `HYBRID_RECIPES`' curated results, an additional content category rather
  than a reshaping of an existing one, even though Majorana sits earlier in the world
  progression than Anderson below. Superposition Mode bypasses this per-result cost
  entirely the same way Bloch's/Dresselhaus's do. Majorana and Dresselhaus above also
  share one further Superposition-only behavior: the mode's blanket unlock grant (§7)
  seeds the player's own starting `playerForm` if the player hasn't transmuted/fused
  for real yet, coin-flipped between Dresselhaus's plain-crystal pool and Majorana's own
  hybrid-result pool, then a random pick within whichever pool wins -- so a fresh
  Superposition save starts as a random ordinary crystal or an already-fused hybrid
  rather than always the default starting form
- **Anderson** → world 6 middle → "dopes in" a crystal the player has defeated as an
  impurity, then teaches one specific move from that crystal's own moveset
  (`scenes/panels/anderson.ts`'s `showAndersonPanel`/`learnImpurityMove`) -- a two-step pick (host,
  then which of its moves to learn). Picking a host only records which one the player
  is browsing; the persisted `andersonDopant` (save.ts) is written only once a move is
  actually learned, replacing whatever was doped in before -- only one impurity species
  at a time, and previewing a candidate's moveset and backing out without learning
  anything leaves the previous impurity's channel untouched. The learned move is an
  ordinary append to `unlockedMoves`; whether it actually shows up in the battle menu is
  gated by `MOVE_COMPATIBILITY` (§3) checked against the *union* of the player's own
  current form and the currently doped-in impurity's type (`getBattleMoves`) -- an
  impurity's channel is real for as long as the impurity stays doped in, and disappears
  the moment a different crystal is doped in instead, the same way a real dopant atom's
  bound states vanish if you swap in a different dopant species. A doped-in impurity is
  visible on the player's own crystal for as long as it is carried: one small guest crystal
  in the doped compound's own color and habit, seated in the base of the player's otherwise
  unchanged body (`art/crystals.ts`'s `opts.dopant`, STYLE.md's **Doped crystals**), drawn
  everywhere the player appears rather than only in Anderson's panel -- the overworld, a
  battle and its turn-preview row, the Lab. Anderson's own pane previews it before the
  commitment: it draws the player's crystal carrying whichever impurity is being browsed,
  under that impurity's name. Distinct from
  Dresselhaus (become the whole state) and Majorana (fuse two states together):
  Anderson borrows a single excitation channel without becoming anything, and the look says
  so -- a small guest in an unchanged host, never the two co-equal bodies of a fusion. Host
  pool excludes any `isHybridMaterial` (a Majorana fusion, or one of world 10's own
  named recipe-result wilds) -- doping in an impurity is meant to be one real compound's
  own excitation, not a channel a fusion already borrowed from two others. In
  Superposition Mode the host pool is every non-hybrid crystal in the game, same as
  Majorana's own ingredient pool -- and since Superposition Mode also auto-grants every
  move id to `unlockedMoves` on every world entry, the "which move to learn" step offers
  a host's moves by comparing against what's currently *usable* (`getBattleMoves`), not
  against raw `unlockedMoves`, so a host whose classes the player's current form/impurity
  can't already reach still offers something to pick even though its move ids were
  already technically known. Each individual host is its own one-time
  `ANDERSON_DOPE_COST` (35) qumatessence unlock (registry/save `andersonUnlockedHosts`,
  a list of host crystal names already paid for) -- keyed by host rather than by which
  move was learned, so once a host is unlocked, doping into it and learning *any* of its
  moves (now or later) is free. The cost shows up (and is only charged) at the second
  step, picking which move to learn -- that's the point doping into this host actually
  commits (`learnImpurityMove`); the first step (browsing which host to look at) stays a
  free preview, so picking a host to browse its moveset and backing out without learning
  anything still costs nothing, mirroring how it already left the previously doped-in
  impurity untouched. Priced between Dresselhaus's and Majorana's: a persistent extra
  move-class channel is a smaller swing than fusing into a whole new content category,
  but Anderson also sits later in the world 1-10 progression than either. Superposition
  Mode bypasses this per-host cost entirely the same way the other three do, and its
  blanket unlock grant (§7) also seeds `andersonDopant` to a random non-hybrid crystal if
  nothing's doped in yet -- unlocking every host doesn't itself put anything in the single
  active-impurity slot, the same reasoning behind Kondo's/Franklin's own seeded picks below
- **Feynman** → world 7 middle → a different mechanic shape entirely from every other
  guardian's: leveling up a move the player already owns (`data/materials.ts`'s
  `MOVE_LEVEL_NAMES`/`MOVE_LEVEL_MULTIPLIERS`/`MOVE_LEVEL_STREAKS`,
  `getMoveLevel`/`effectiveMovePower`/`feynmanLevelCost`/`moveDisplayName`,
  `scenes/panels/feynman.ts`'s `showFeynmanPanel`) -- fitting, since
  Feynman's own diagrammatic technique (expand a many-body calculation as a picture
  built from vertices and propagator lines instead of writing it out term by term) is a
  direct notational sibling to world 7's own course topic: session07.tex's "Tensor
  diagrams" section draws a tensor as a point with legs, joining two legs meaning
  summing over a shared index -- the same "represent a contraction as a picture" idea a
  Feynman diagram's own vertices-and-propagators notation uses. Any move the player has
  ever unlocked (`unlockedMoves`, regardless of which guardian originally sold it --
  Noether's ordinary attacks, Landau's Analytic pair, Kondo's self-buffs, an
  Anderson-doped move, even the starting Phonon Beam) can be leveled through three fixed
  tiers, one at a time in sequence (a move must already hold tier N-1 before N can be
  attempted): **Double** (1.5x, a 2-question streak), **Triple** (2x, a
  4-question streak), **Infinite** (3x, an 8-question streak) -- "Infinite" is
  hyperbole, not a literal unbounded-power claim; the real cap is the flat 3x.
  For an ordinary attack move that multiplier scales its `power` (`effectiveMovePower`,
  below); for Kondo's three self-buffs, whose own `power` is never read as damage in the
  first place (§5 Kondo bullet, §3/§4), it instead deepens that cloud's own screened
  fraction (`BattleScene.screenReduction`, capped well under 100% -- see §4's
  Self-buffs paragraph for the exact per-level figures), so leveling a Kondo move is a
  real mechanical upgrade too, not a name-only one.
  Registry/save `moveLevels` (moveId → 0-3, `data/save.ts`) is permanent once a tier is
  reached, the same "first time costs, permanent afterward" shape every other
  guardian's one-time unlock already uses. **That is a ceiling, not a setting: a move is
  carried at whichever unlocked tier the player picks**, a second registry/save map
  (`carriedMoveLevels`, written from the tier row in Feynman's own pane and free to change
  as often as they like, since the tier was paid for when it was landed). `getMoveLevel`
  reads the carried tier and is what every other part of the game means by a move's level
  -- its power, its name prefix, its cascade, a Kondo cloud's screening strength --
  while `getUnlockedMoveLevel` reads the ceiling and is used only to decide what the next
  attempt targets. A move with no carried entry is carried at its ceiling, so a player who
  never touches the row sees the always-deepest behaviour, and a freshly landed tier is
  carried automatically. Cost to attempt a given tier is
  `move.power * 5 * level` (`feynmanLevelCost`) -- the same "priced off the move's own
  raw power" shape Noether's `shopCost` uses, scaled again by how deep a tier is being
  attempted. Unlike every other guardian's gate, the payment and the gate are
  decoupled: the qumatessence is spent the moment the attempt starts, before a single
  question is asked, and is never refunded regardless of outcome -- landing the whole
  streak (`data/quiz.ts`'s `getAnalyticQuestions`, the same visited-world-filtered
  Analytic pool Landau's own single question draws from, since world 7 has a course
  topic of its own unlike World 10's topic-less finale) writes the new level; missing
  even one question anywhere in the streak (the same "stop at the first wrong answer,
  no partial credit" shape Skłodowska-Curie's Ultimate-move gate uses, generalized to a
  variable streak length instead of a fixed 3) leaves the move at its previous level
  with the payment still gone. The streak plays out in the overworld panel itself, as
  its own purchase-shaped flow (`scenes/panels/feynman.ts`'s own question UI, built the
  same way `OverworldScene.showEncounter`'s pre-battle quiz is), not mid-battle the way
  Landau's/Skłodowska-Curie's own quiz gates fire -- Feynman's leveling attempt is a
  standalone decision made at his panel, not something triggered by using a move in a
  fight. A leveled move's effective power (`effectiveMovePower`) -- or, for one of
  Kondo's three, its screened fraction (`screenReduction`) -- only
  applies to the *player's own* copy of that move id -- an opponent's own use of the
  same move id (an ordinary wild's Electron Pulse, say) is never affected, since move
  levels are the player's own save state, not a property of the move itself; the level prefix folds
  into every rendering of a move's name (`moveDisplayName`, threaded through the battle
  move menu/log, every guardian's own move-list panel, and Feynman's own) the same way
  Landau's/Skłodowska-Curie's tuned-quasiparticle name already does
  (`tunedMoveDisplayName`) -- `moveDisplayName` falls back to a move's own static name
  for Kondo's three `'screening'`-class self-buffs specifically, since they have no
  quasiparticle for `tunedMoveDisplayName` to read. Feynman has no single "active" slot
  the way Kondo/Franklin/Anderson/Dresselhaus-Majorana do (§7) -- every move he levels
  stands independently -- so Superposition Mode's blanket unlock grant treats
  "everything already unlocked" for him as every move's `moveLevels` *ceiling* set
  straight to 3 (max), unconditionally, every time the grant reapplies. It never writes
  `carriedMoveLevels`, so the player's own choice of which tier to carry survives the
  grant reapplying, and no seed-once check is needed to protect it the way one protects
  Kondo's/Franklin's/Anderson's/Dresselhaus-or-Majorana's own picks. A Superposition Mode playthrough never
  has to actually answer Feynman's own questions to reach max level -- his panel still
  works exactly as in Story Mode if visited, each row already reading "max level."
- **Kondo** → world 8 middle → sells three self-buff moves (`scenes/panels/kondo.ts`'s `showKondoPanel`,
  `data/materials.ts`'s `KONDO_MOVE_IDS`) -- Spin Screening, Charge Screening, Symmetry
  Cloud -- each of which deterministically raises one 3-turn cloud on the *caster's own*
  side instead of attacking the opponent, dealing no damage and never checking
  `MOVE_COMPATIBILITY` at all. Each cloud screens exactly one quantum number and halves only
  the incoming attacks whose quasiparticle carries it (§4's Self-buffs paragraph for the
  three class lists, `SCREENING_CHANNELS` for the table itself), which is what makes the
  choice between them a read of what the next opponent throws rather than a ranking. The
  generalization is the guardian's own physics: the Kondo effect is a conduction-electron
  cloud screening a local moment until the moment is gone, Charge Screening is that same
  cloud doing Thomas-Fermi screening of a charge disturbance instead, and Symmetry Cloud
  restores the continuous symmetry an ordered state gave up, so it damps that order
  parameter's own modes. Each of the three, like every other move in the game, can be
  leveled up at Feynman's panel (§5/§4 above) -- since Kondo's `power` is never read as
  damage, leveling one instead deepens its screened fraction
  (`BattleScene.screenReduction`), not a power number: 50% unleveled up to 75% at Infinite
  tier, capped so even a maxed-out cloud leaves real damage coming through.
  The player can buy all three
  independently, but only one is ever usable in battle at a time -- registry/save
  `kondoActiveMove`, switched only by returning to Kondo's own panel (a bought-but-inactive
  move stays in `unlockedMoves`, it just fails `getBattleMoves`' own extra check), since
  Kondo's own technique resolves one channel at a time, not every channel at once -- the same
  reasoning DESIGN.md gives for excluding a generic "impurity scattering" damage move in §3
  applies here too: this isn't free-form disorder, it's one specific technique the player has
  to choose and commit to. The shop panel itself doubles as the switch -- a bought-and-inactive
  move gets a "Make `<name>`
  active" button, the active one shows a dimmed "`<name>` (active)" tag instead, and every row
  (bought or not) prints the move's own one-line description underneath, the same convention
  Franklin's own passive rows use. Buying the *first*
  Kondo move activates it automatically (still "picked by talking to Kondo," just in the same
  click as the purchase) so a fresh purchase is never invisible in battle with no explanation;
  buying a second or third on top of an already-active one doesn't, and switching between
  already-bought moves is always its own explicit click either way. Superposition Mode's
  blanket unlock grant (`OverworldScene.applySuperpositionUnlocks`, §7 -- shared by every
  world entry and by the Lab itself) seeds `kondoActiveMove` to a random one of the three
  moves if it's still unset, for the same reason -- granting every move id doesn't help if
  none of Kondo's three actually pass `getBattleMoves`' extra check -- picked randomly
  rather than always the same one so a fresh Superposition save doesn't always start on the
  same move.
- **Franklin** → world 9 middle → teaches three passive abilities
  (`data/passives.ts`'s `FRANKLIN_PASSIVE_IDS`, `scenes/panels/franklin.ts`'s `showFranklinPanel`) --
  an always-on, whole-battle modifier rather than a move picked from the battle menu
  each turn. All three can be bought independently, but only one is ever active in
  battle at a time (registry/save `activePassiveByOwner`, switched only by revisiting
  Franklin's panel), the same "learn several, equip one" shape Kondo's three self-buff
  moves already use (above) -- fitting, since Franklin's own
  physics (X-ray diffraction of a defect-riddled or porous crystal -- a real,
  if lesser-known, tie between Rosalind Franklin's characterization work and
  world 9's "excitations and defects" topic) is world 9's topic, and a passive with no
  per-turn choice and no duration/tick-down is itself a clean fit for "always on for
  this battle," unlike Kondo's 3-turn buffs:
  - **Diffraction Shadow** -- incoming damage is multiplied down (×0.85) for the whole
    battle, the way porous carbon attenuates and scatters an X-ray beam.
  - **Satellite Reflection** -- doubles its holder's own crit rate (20% → 40%,
    `ANYON_ECHO_CRIT_MULTIPLIER`, the one thing in the game that moves that rate), and
    each critical hit throws off a secondary diffraction peak: a bonus follow-up damage
    tick (~30% of that hit's damage) immediately after.
  - **Amorphous Halo** -- softens the quasiparticle-mismatch double-damage rule
    (2x → 1.5x, `canHost`/`BattleScene.resolveHit`) -- a diffuse, defect-broadened halo
    partially shrugging off a hit that would otherwise land unmitigated.

  Superposition Mode's blanket unlock grant (§7) seeds `activePassiveByOwner.franklin` to
  a random one of the three if nothing's equipped yet, the same seed-only-if-unset shape
  as Kondo's own `kondoActiveMove` pick above.
- **Skłodowska-Curie** → world 10 middle → the guardian of the finale world, regarded
  as the leader of the guardians' circle, teaching the game's one capstone mechanic:
  two "Ultimate Move" moves, `ultimateMeteor`/`ultimateNova` (`data/materials.ts`'s
  `ULTIMATE_MOVE_IDS`, displayed as "`<quasiparticle>` Meteor"/"`<quasiparticle>` Nova"
  via the same `tunedMoveDisplayName` Landau's Analytic moves use), each at power 100 --
  ten times an Analytic move's power, and the highest of any move in the game (§3).
  Landing one requires answering three quiz questions in a row, all correct
  (`data/quiz.ts`'s `ULTIMATE_QUESTIONS`/`getUltimateQuestions`, drawn from a broad,
  any-topic pool rather than restricted to visited worlds the way Landau's Analytic
  pool is -- fitting a finale that asks the player to show mastery of everything, not
  one world's own topic); `BattleScene.showUltimateQuestions` stops at the first wrong
  answer, since the outcome (a whiff for zero damage) is already decided at that point,
  and the turn is still spent either way. Her pricing model is deliberately not the flat
  per-move purchase every other tunable-move shop uses: instead of buying the move
  outright, each quasiparticle class costs `ULTIMATE_CLASS_UNLOCK_COST` (1000)
  qumatessence to unlock *per move*, the first time it's picked for that move -- after
  which retuning back to an already-unlocked class is free forever, mirroring how
  ordinary retuning is already free once a move is owned, except the unlock is
  per-class here rather than per-move. The first unlock of either move also adds it to
  `unlockedMoves` so it appears in the battle menu. Once tuned, an Ultimate move's
  battle-side quasiparticle-mismatch math reads exactly like Landau's Analytic moves
  (`getTunedMoveClass`, the same shared `moveClassTuning` map both guardians' shops
  write to) -- no battle-side special-casing beyond the 3-question gate above. A
  successful 3-for-3 hit plays a multi-phase "Final-Fantasy-style summon" animation
  (windup/summon-circle → charge → impact → aftermath, 4-6 seconds total,
  `art/attackUltimates.ts`'s `playMeteor`/`playNova`) -- dramatically longer and flashier
  than any other move's effect in the game (`playBeam`/`playEruption`, by comparison,
  run under a second), fitting a move that's meant to read as the game's actual finale
  attack.

**Boss avatars.** Every built world's rival/boss (`WORLD_RIVALS`/`getRival`) is named
for a real compound's *polycrystalline* form (e.g. World 1's Polycrystalline Silicon
Golem) rather than a generic RPG monster name, and, while still undefeated, stands
visibly at the goal tile as a gigantic landmark (`OverworldScene.spawnBossSprite`,
`art/boss.ts`'s `makeBossCrystal`) that literalizes that name -- a towering,
top-heavy humanoid silhouette (small sunken head, shoulders peaking above it, arms
hanging to oversized fists, planted legs) built from many grain shards fused around
an oversized torso core, its grain boundaries lit from inside, a heavy contact shadow
and a low danger glow pooled at its feet, so "many grains fused into one
mass" reads at a glance, unmistakably more dangerous than an ordinary wild crystal
from a distance, long before the player reaches it. It's a pure visual
landmark: the fight itself is only reached by pressing at the pass
panel. The same `makeBossCrystal` look carries through every later view of that same
rival -- its own pre-fight taunt dialogue (`OverworldScene.showRivalEncounter`) renders
it too, rather than reverting to the plain `makeCrystal` an ordinary wild encounter's
greeting uses, and the fight itself carries it on: `BattleScene` renders a rival's
opponent crystal at `BOSS_CRYSTAL_SIZE` (bigger than an ordinary wild encounter's),
at its own spot left of and below the usual opponent one so the taller, wider
silhouette clears both the opponent HP bar above it and the move menu below, instead
of the plain `makeCrystal` every wild battle uses. A rival's spot is a *ground*
reference rather than a body centre: the golem is placed by its feet, so they meet
the arena floor exactly and its contact shadow, the arena's own floor shadow and any
ground-anchored attack effect all pool on one line under it. It is also the one
combatant that never hovers -- a gem floats, a golem stands (STYLE.md's "The contact
rule").

**Passes between worlds.** Every world's corridor narrows into a pass at each end
(`world/generators/shared.ts`'s `narrowGoalPass`/`openStartMouth`), and those passes
are how the player moves between worlds. The rival stands in the forward one and bars
it while it lives; once it falls the pass clears, a board names the destination, and
the next world's palette shows through the notch beyond. Both passes share one
interaction — walk to the mouth, read the prompt, press to commit
(`OverworldScene.confirmGate`) — so arriving at a pass never transitions or starts a
fight on its own. The backward pass carries no state, since the way back is open from
the moment the player walks in through it; landing in the earlier world that way puts
the player at *its* far end with that world's goal already marked reached, so arriving
reads as walking in from the far end rather than restarting the whole corridor. World
1's backward exit is not a pass and carries no board, because it leads to the Lab, which
is not a place. Both directions are ordinary walking, not a menu action, alongside
Bloch's teleport hub (§5) for jumping to an arbitrary already-visited world. Every
crossing regenerates the destination world's map fresh, the same "walking between
worlds always lays out a new corridor" rule §7 describes for every other transition.

**The Settings station** (`scenes/panels/hubStations.ts`'s `showSettingsPanel`) holds nine
settings in three categories the player switches between at the top of the panel: Gameplay
(difficulty tier -- §3, wild-encounter density, world size), Story (story screens, tutorial
tips) and Presentation (text size, full screen, music style, touch controls). Every one of them
but full screen is its own preset list in `data/settings.ts` and its own save field; full
screen has neither, being read live from the browser (below).

**Wild-encounter density.** That station lets the player choose how often ordinary wild
crystals spawn per corridor row -- Low/Normal/High/Very High
(`data/settings.ts`'s `DENSITY_PRESETS`), persisted like every other save field.
Takes effect the next time a world map is generated (a fresh world entry or an
explicit regenerate), not retroactively on the map the player is currently
standing on.

**Story screens and tutorial tips.** The same station's Story category turns off the screens
that stop play: the world-entry lore, a rival's taunt and the between-worlds beat on one row,
the contextual tutorial popups on the other (`data/settings.ts`'s `ON_OFF_PRESETS`,
`tutorialTipsEnabled`/`storyScreensEnabled`). Off suppresses the screen, never the content --
each trigger still fires where it always did, marks its own `tutorialTipsSeen`/`worldLoreSeen`
entry and hands straight back to whatever it was gating, so the Lab's Tutorial and Story
stations fill in on exactly the schedule they otherwise would and hold the skipped text for
whoever wants it. That is what the setting is for: a player replaying, or one who would rather
not be stopped, rather than a way to cut the story out of a save. Turning a row back on plays
the screens still ahead of the player rather than replaying the ones already passed. Story
screens are the one setting whose default depends on the mode (`defaultSave(superposition)`):
on in Story Mode, off in Superposition Mode, which has no road to walk through. The finale
screen is exempt from the switch, being the run's only acknowledgment that it is finished.

**Text size.** The same Settings station offers Compact/Normal/Large
(`data/settings.ts`'s `FONT_SCALE_PRESETS`, 1x / 1.5x / 2x on every base px size
authored in the game, applied through `ui/text.ts`'s `fontPx()`/`fontScale()`).
Read live, so a change lands the next time any panel or label redraws. Its
default is the one that depends on the device rather than on a constant
(`defaultFontScale()`): a handheld -- a coarse pointer with no hover, i.e. a
phone or a tablet, `isHandheldDevice()` -- starts at Large, everything else at
Normal, on the grounds that the same canvas is read on a screen a fraction the
size. A touchscreen laptop is a desktop by that test, which is deliberate: it
hovers and it is read at arm's length. Only a save with no stored value takes
the device default; a stored preset is the player's own choice and is left
alone on either kind of device.

**World size.** The same Settings station offers Nano/Meso/Macro
(`data/settings.ts`'s `WORLD_SIZE_PRESETS`) -- one multiplicative factor (0.7 / 1 / 3)
applied to every length a world is built out of: the grid itself
(27x50 at Meso), every corridor width, every branch, spur, spiral and lane
offset, and every stretch measured in rows. A tile is the same size on screen at
every setting and the draw distance is unchanged, so a bigger world is a longer walk
down a wider corridor rather than the same walk seen from further away. Like the
density above it, this is read at map-generation time, so it applies to the next
world entered.

**Touch controls.** The same Settings station offers Auto/On/Off
(`data/settings.ts`'s `TOUCH_CONTROLS_PRESETS`) for the four on-screen walking
arrows the overworld draws in its bottom-left corner
(`scenes/overworld/touchControls.ts`). Walking was the one action with no click
target of its own, so those arrows are what make the game playable in a phone or
tablet browser; Auto, the default, resolves per device (`isTouchDevice()`), and
On/Off are the player's override in either direction. Read on world entry, so a
change applies to the next world entered. The keyboard path is untouched by any
of the three values: the arrows are an addition, never a replacement, and the
standing goal of keyboard-only play (`CODEMAP.md`'s "Input") still holds.

**Full screen.** The same Settings station offers On/Off for whether the game fills the whole
screen rather than sitting inside a browser tab, and `F` does the same thing from anywhere in
the game (`ui/fullscreen.ts`, installed per scene by `installFullscreenKey`). Alone among the
rows it is deliberately not persisted: a browser grants fullscreen only from inside a user
gesture, so a saved value could not be honoured at boot and the row would claim a state the
game is not in. Phaser's scale manager holds the state instead, the row reads it live, and the
panel redraws on the browser's own `ENTER_FULLSCREEN`/`LEAVE_FULLSCREEN` events, so leaving
with `Esc` or pressing `F` while the panel is open moves the highlight too. Browsers with no
Fullscreen API at all (an iPhone) get no row rather than one whose values do nothing. This is
what makes the game fill a laptop screen without the player knowing the browser's own
fullscreen key, and it is the same switch a PWA install or a desktop wrapper would otherwise
be needed for.

Three kinds of number deliberately don't scale, and the reasons are worth keeping:

- **Counts, not lengths** -- how many Voronoi domains World 3 is partitioned into,
  how many vortices World 5 winds around, how many defect patches World 9 carries,
  how many legs World 7's network has. Holding the count and scaling the feature is
  what makes a bigger world the same picture rather than a busier one; for World 9
  it is also what keeps the defect *concentration* (patch area over corridor area)
  the same at every size.
- **Periodic motifs** -- World 2's unit cell and World 6's magnon wavelength are
  lengths of the material, not of the map, so a bigger crystal is more unit cells at
  the same lattice constant rather than stretched ones. World 2's hall
  consequently gets wider with the world while the column array keeps its own
  period, so a Macro cloister is more columns across the same aisles.
- **The two throats** -- the guardian's chokepoint gap and the pass throat
  (`PASS_HALF_WIDTH`) are three tiles wide in every world at every size. A
  chokepoint is narrow *relative to the world it interrupts*, and a pass is a
  doorway between two worlds rather than a feature of either. The chokepoint gap is
  additionally load-bearing for verification: `verifyChokepoint` proves invariant B
  by removing `mid` and its four neighbours, which is exactly a one-tile-half-width
  gap.

**Plot hook:** a "Decoherence" is spreading through the quantum material worlds, causing wild
materials to lose their protected properties. The player masters each phase of
matter to stabilize it. World 10's boss is revealed as the source — an entity
that reshapes itself live in battle to counter whatever quasiparticle class the
player just attacked with.

**Story beats between worlds.** The plot isn't only the tutorial's first page and
the ending — beating each world's rival shows a short Decoherence-arc line
(`data/story.ts`'s `STORY_BEATS`, keyed by the world just beaten; the narrator
observing the beaten golem's release as that world's material made whole again,
then a look forward — WORLDS.md §6 holds the rules for that voice) before
`OverworldScene.showStoryBeat`/`advanceToWorld` moves the player into the next
world, previewing that world's biome and nudging the plot forward one step at a
time. Falls straight through to `advanceToWorld` if a world has no entry, so a
missing beat is never a dead end.

**World-entry lore and the rival's taunt.** `data/worldLore.ts` holds two more
pieces of per-world Decoherence-arc content, both explaining how the Decoherence
specifically manifests in that world's own physics rather than gesturing at it
generically. `WORLD_LORE`'s two-page history of the world plays once per save the
first time the player steps into it (`OverworldScene.showWorldLore`, gated by
`hasSeenWorldLore`/`markWorldLoreSeen` against its own `worldLoreSeen` save field —
kept separate from `visitedWorlds` because Superposition Mode's blanket unlock grant
(`applySuperpositionUnlocks`, §7) pre-seeds `visitedWorlds` with every built world --
from the Lab itself, before the player has ever crossed a pass -- which
would otherwise suppress every world's lore screen at once). It plays
before the goal/middle auto-dialogues and the `'controls'` tutorial tip if more
than one of those is due on the same entry, since it's the more establishing
content. `RIVAL_TAUNTS` gives each world's rival gate a two-part taunt
(`OverworldScene.showRivalEncounter`) — a narration-plus-dialogue opener, then a
second part that raises the stakes, chained as two pages before the "Battle!"
button. World 9's taunt is written to hold for whichever of its seven
randomly-rolled rival types actually shows up rather than naming one; world 10's is
the story's climax reveal. A world with no matching entry shows no lore screen, and
its rival gate shows a single generic line, so it's never a dead end.

**Goal-tile banner.** Reaching a world's far edge shows a one-line banner
(`data/story.ts`'s `WORLD_GOAL_TEXT`, keyed by world) naming that world's own
physics; a world with no matching entry shows the generic "You reached the far
edge of this world!" instead, so it's never a dead end.

## 6. Boss design

A world's boss is the rival golem holding its forward pass. The encounter is one shape
in all ten worlds: reach the goal, and the pass mouth answers a keypress
(`OverworldScene.confirmGate`) with the rival's two-page taunt
(`showRivalEncounter`, `data/worldLore.ts`'s `RIVAL_TAUNTS`), then the battle, then the
crossing into world N+1. The guardian sits on the near side of that fight, so a player
can shop and prepare before ever facing the rival (§2).

What makes one boss different from another is the physics it carries rather than a
mechanic of its own. A rival fights with the same battle system a wild crystal does
(§4), at rival stats, throwing its world's own excitation -- decohered, since a golem's
coherence was ground out of it (`GOLEM_MOVE_IDS`), so what it throws is named for what
it used to be. Its type decides what the player's own quasiparticle lands double
against, which is the preparation the fight actually asks for.

Two of the ten answer to something other than a fixed row in `WORLD_RIVALS`:

- **World 9's rival** is an impurity-bound resonance with no lattice of its own, so its
  type is rolled on every visit and it borrows the rolled host's own signature
  quasiparticle, pristine rather than decohered (§2, `RIVAL_9_TYPES`/`RIVAL_9_MOVES`).
- **World 10's "The Adapted"** has no type at all until the player attacks. Once per
  landed player attack it transmutes into a real compound of some type that genuinely
  hosts the quasiparticle just used (`BattleScene.transmuteAdapted`, `typesHosting`), so
  the finale is a boss that closes off the mismatch bonus the rest of the game taught the
  player to hunt for. Its own moveset and HP never change underneath the disguise.

**Planned: an after-story boss.** A hidden encounter past World 10, stronger than anything
on the main path, is what the top of the stat ladder exists for. Reaching `MAX_STAT` costs
roughly a hundred playthroughs' worth of qumatessence in one stat (`statUpgradeCost` is
linear per point, so total cost grows quadratically while the Energy/Lifetime lever grows
as a square root, §3) -- deliberate, not an accident of the two formulas, and **not** to be
"fixed" by flattening the price ladder or lowering `MAX_STAT` toward the stats 5-8 a normal
run reaches. That headroom is this fight's to claim.

Three things it has to answer when it is built. It must be tuned against a *farmed* build
rather than `enemyStatsForWorld`'s world-10 values, which assume a player at stats 5-8 and
evaporate against a 20-50 one. It has to be worth reaching in Story Mode on its own terms,
since Superposition Mode already grants `MAX_STAT` for free (§5) and a fight that merely
*requires* max stats is a mode switch away rather than a reward for the grind. And its
Velocity sets a hard cliff in the build space: Momentum is a ratio against the opponent
capped at `MAX_MULTI_HIT`, so past 5x the boss's own Velocity every further Momentum point
buys exactly nothing while Energy and Lifetime keep paying -- pick that number deliberately
rather than inheriting it.

## 7. Technical architecture

- **Engine:** Phaser 3 via **Vite + TypeScript** (`game/`) — `npm install && npm
  run dev` gets hot-reload, ES modules split by concern (`data/`, `art/`,
  `scenes/`, `world/`), and type-checking on the material/move data model,
  which is exactly the kind of many-interacting-fields data that silently
  breaks without it. `game/` is the only build; there is no separate no-install
  single-file `demo/` prototype.
- **Canvas size:** `854x480`, a 16:9 "laptop window" aspect ratio -- also the
  aspect ratio a phone held sideways renders at, so this layout carries into
  a future phone-landscape touch pass without a separate aspect ratio to
  maintain. The single source of truth is `src/config/screen.ts`'s
  `CANVAS_W`/`CANVAS_H`,
  read directly by `main.ts`'s Phaser `GameConfig` and re-exported from
  `src/art/perspective.ts` for every scene/panel that already imports its
  canvas size from there. `main.ts`'s `scale` config (`Phaser.Scale.FIT` +
  `CENTER_BOTH`) letterboxes/centers that fixed-aspect canvas to fill
  whatever browser window it's actually running in, rather than rendering at
  a literal 854x480 pixel size.
- **Overworld camera:** over-the-shoulder pseudo-3D (`src/art/perspective.ts`)
  — the player's crystal floats in place at the bottom of the screen while the
  world is redrawn every frame from a smoothly-tweened camera position, giving
  a continuous "walking down a path" feel similar to World of Final Fantasy's
  field view. The camera sits a fixed distance *behind* the player's own tile
  (`CAMERA_BACK_TILES`), which is what lets the fixed on-screen avatar stand on
  the tile the movement grid actually places it on rather than somewhere ahead
  of it. Movement/encounter logic runs on a plain 2D grid; only the tile
  rendering is projected (lane offset, depth) → screen point, with distance
  fog blending tiles toward a biome-specific haze color near the horizon. The
  ground plane always reaches that horizon and both frame edges, so a world
  recedes into haze rather than visibly terminating, and sky, mist and ground
  are one continuous atmosphere with the horizon line a location inside it
  (`dev_notes/WORLDS.md` §4 for the spec, `STYLE.md`'s "Overworld path" and
  "The horizon" for the visual rules).
- **Overworld map generation** (`src/world/mapgen.ts`, `src/world/generators/`): each of the
  10 worlds has its own generator (`generators/world1.ts` .. `world10.ts`, see §2's map-shape
  table and CODEMAP.md for the file layout), producing that world's own physics motif rather
  than one shape shared by all ten -- a wandering corridor whose center drifts left/right as
  it climbs toward a goal row is only world 2/6/9's own base shape now, not the default every
  world falls back to. `mapgen.ts`'s `generateWorldMap` dispatches to the right generator by
  world number (world 10 additionally by the player's current material type) and then runs
  two passes common to all ten: forcing the guardian's tile into a real chokepoint (walling
  off its whole row except a small gap, so every route from the entry point to the goal is
  provably routed through it -- verified by flood fill with that tile removed, not just
  placed near the geometric middle of one of several possible routes) and deriving
  encounter-row sampling/qumatessence placement from the part of the final walkable shape
  that is actually connected to the entry point, so a branch the chokepoint's row wall
  severed from the route is terrain the player walks past rather than ground holding a
  pickup they can see across the gap and never reach.
  Every generator's own walkable segments stay at least 2 tiles wide throughout, so a wild
  encounter spawned on the path can never fully block it. A generator whose output fails
  either check is retried with fresh randomness (up to 10 times) before falling back to a
  plain wide corridor, logged rather than thrown -- generation is randomized and runs on
  every world entry, so a bad roll shouldn't crash the scene. Five to eight qumatessence
  pickups are scattered across each map (preferring an actual dead-end tile when that
  generator's shape has one), each drawn from a ten-tier value ladder
  (`src/data/tokens.ts`), 1 at the bottom up to 50 at the top, each tier with
  its own distinct color so a pickup's rough size reads before the player
  even reaches it. Which tiers a map can roll is a window of tiers
  centered on the current world -- World 1 only ever rolls the ladder's two
  lowest tiers, World 10 only its two highest, and worlds in between roll a
  three-tier window that slides up the ladder as the player advances (World
  5 rolls tiers 4-6) -- weighted toward the window's lower tier so a high
  roll stays a treat rather than the norm. Both pickups and wild crystals then
  refill themselves as the world is walked (§2's "Respawning"), out of sight
  in both directions, without limit over time and capped only on how many a
  map carries at once.
  The whole ground plane is drawn flat, with the walkable/impassable
  boundary traced off the tile grid and redrawn as a smooth curve, so a path edge that turns
  reads as an organic shoreline rather than a stair-step; a contact shadow and rim light along
  that curve, plus each biome's own floor/off-path color break, are what mark where the player
  may walk. Off-path tiles carry terrain you can plausibly see is impassable (per-biome
  `wallTheme`, see `STYLE.md`): bare rock by default, or a molten lava crust, a frozen lake, or
  the starlit drop between islands. A tile can additionally carry its own `regionColor` tint
  (world 3's Voronoi domains): the tint colors that tile's ground and the biome's `wallTheme`
  material still draws its accent over it -- the tint supplies the color, the material the
  texture. World 1's two symmetry-broken branches are tinted the same way, on the walkable
  lanes themselves rather than on off-path ground. A tile can also
  carry a `biomeOverride` (world 9's patches, each independently borrowing one of worlds
  1-8's whole biome look) that swaps which world's `art/biomes.ts` entry it renders with. The
  layout is regenerated (fresh `Math.random` calls) on
  first load and whenever the player switches worlds -- the Hub door, Bloch's
  teleport, a pass (§5), a debug warp, or (World 10 only) transmuting/fusing into a new
  form while already standing there, since World 10's shape is keyed off the player's own
  current type; a round trip through
  battle instead restores the exact layout and player position it started
  from (`OverworldScene.saveMapState`/`restoreMap`, via the Phaser registry).
  The pre-battle encounter dialogue itself never leaves the overworld scene.
  Per-world visuals (sky/ceiling, off-path vs. path color,
  decoration style) live in `src/art/biomes.ts`, keyed by world number,
  independent of the per-world shape generators.
- **Hosting:** static site (GitHub Pages / Netlify) — client-side only, no backend
  needed unless cross-device save sync or trading is added later. `npm run build`
  in `game/` produces the deployable static output.
- **Save system:** `localStorage` for v1, implemented (`game/src/data/save.ts`), as two
  entirely independent save slots -- `qm-rpg-save-story-v1` and
  `qm-rpg-save-superposition-v1` -- one per starting mode (§7's Story Mode/Superposition
  Mode picker), so progress made under one mode's looser rules can never be resumed under
  the other's. `loadSave(superposition)`/`hasSave(superposition)`/`clearSave(superposition)`
  all take which slot to act on; `persistFromRegistry(registry)` itself stays a single
  no-argument-beyond-registry call (its ~40 call sites across the codebase are unaware of
  the split) since it reads the registry's own current `superpositionMode` flag to decide
  which slot to write. `TitleScene` loads the selected mode's slot into the Phaser registry
  -- the runtime source of truth every scene reads/writes -- before the Hub or any world can
  run, and reloads the *other* slot wholesale (every field, not just the flag) whenever the
  player switches the mode picker, so no field from one mode's save is ever left sitting in
  the registry under the other mode's flag. `persistFromRegistry()` is then called after
  every registry mutation that should survive a reload (token pickup, move purchase, rival
  defeat, battle outcome), so the registry and localStorage stay in sync rather than only
  saving at fixed checkpoints and there is no manual save UI anywhere in the game. A save written
  under the single-slot format that predates this split is migrated once, automatically, the
  first time either `loadSave`/`hasSave` runs: its contents move into whichever new slot
  matches its own stored `superpositionMode` field, and the old key is removed.
- **Starting a new game.** Once a save exists for the currently selected mode, the title
  screen's main button reads "Continue" for that mode -- `TitleScene`'s "New Game (erase
  save)" link erases only the currently selected mode's own slot, never both, gated behind
  an inline yes/no confirm (`TitleScene.confirmNewGame`) since it's destructive and
  irreversible. Confirming calls `data/save.ts`'s `clearSave(superposition)` for the selected
  mode, then reloads that same mode's now-empty slot back into the registry and rebuilds the
  screen in place (rather than a full `this.scene.restart()`, which would rerun the picker's
  own initial-mode tiebreak and could flip the screen to the *other* mode right after the
  player asked to erase this one). Switching modes without erasing anything reaches the same
  registry-reload path, keeping the displayed "Continue"/"New Game" label, the "erase save"
  line, and the picker's own highlight always in sync with whichever mode is currently
  selected. Which mode is preselected the moment the title screen first loads: whichever mode
  has an existing save if only one of the two does, Story Mode as the tiebreak when both or
  neither do, since it's the primary progression and Superposition Mode is an explicit
  testing/exploration extra layered on top of it.
- **Data-driven content:** materials and moves live in `game/src/data/materials.ts`
  (including the per-world `WORLD_CRYSTALS` database), the sole source of truth —
  there is no separate `data/materials.json` draft to keep in sync — so balance/content
  can be tuned without touching engine/rendering code.
- **Onboarding is contextual, not one paged popup up front.** `game/src/data/tutorial.ts`'s
  `TUTORIAL_TIPS` (keyed by `TutorialTipId`) holds every tutorial topic in the game, and each
  entry's own `unlock` says what reveals it. Seven are `{ kind: 'tip' }`: short popups that
  each fire once per save, right as their own feature actually becomes relevant
  rather than all at once before the player has done anything: `lab` on first
  entering the Lab (`HubScene.maybeShowLabTip`); `controls` on first entering
  an Overworld world; `encounter` on the first wild-crystal bump; `battle` on
  first committing to a fight; `qumatessence` on first collecting a pickup;
  `guardian` on first meeting any guardian; `goal` on first reaching a world's
  goal row (all six of the latter via `OverworldScene.showTutorialTip`, gated
  by save/registry `tutorialTipsSeen`). Each trigger site passes whatever it
  was about to do next as the tip's close callback (open the encounter panel,
  launch the battle, ...), so the tip is a one-time detour in front of that
  action rather than a separate step callers have to branch on. With the
  Settings station's Tutorial Tips row off (§3) a trigger still marks its tip
  seen and runs that callback, skipping only the popup, so the Tutorial
  station's own list fills in exactly as it otherwise would. Nine are
  `{ kind: 'guardian' }` -- a guardian's own repeatable ability (Bloch's teleportation,
  Dresselhaus's transmutation, Landau's quiz-gated Analytic moves, Majorana's hybrid fusion,
  Anderson's host doping, Feynman's move leveling, Kondo's status effects, Franklin's passives,
  Skłodowska-Curie's quiz-gated Ultimate moves) has no single "first time this becomes relevant" moment worth
  interrupting play for, so it carries no popup and is revealed by meeting that guardian
  (registry `metGuardians`), read in their panel instead. The last two are
  `{ kind: 'always' }` -- the Lab's Settings station and the Story Mode/Superposition Mode
  choice already made at the Title screen are both true of a save from the moment it exists.
  Every topic is readable any time from the Lab's Tutorial station
  (`scenes/panels/hubStations.ts`'s `showTutorialTopics`) as a list+detail panel
  (`scenes/panels/listDetail.ts`, DESIGN.md's own "List+detail panels" convention in
  `dev_notes/STYLE.md`) -- a left-hand list of topic titles (paginated once the set
  outgrows one page), a right-hand pane showing whichever topic is selected, updated in place as
  the player browses rather than opening a separate full panel per topic. That list is
  `visibleTutorialPages(registry)`: in Story Mode, whichever topics the save has unlocked by
  the rule above, so the list fills in as the playthrough does; in Superposition Mode, all of
  them, the same way that mode treats every guardian and passive as unlocked from the start.
  An undiscovered topic is absent from the list rather than shown locked, and reading a topic
  here never marks it discovered (nothing on that path writes `tutorialTipsSeen`).
  `TUTORIAL_TIPS`' own declaration order is the canonical order the game reveals topics in --
  `lab`, `modes`, `settings`, then the six remaining contextual tips in World 1's own order,
  then the nine guardian topics by world (Bloch's World 2 through Skłodowska-Curie's World 10) -- and
  is what the station lists them in, so a new topic gets declared at the point of the
  playthrough that reveals it. `npm run content-lint` checks that ordering, that every
  guardian a topic names exists, and that every `{ kind: 'tip' }` topic has a trigger site.
- **Story Mode vs. Superposition Mode.** The Title screen has the player pick
  one of two starting modes (`TitleScene.addModeSelector`) before Continue/New
  Game -- both back the same save/registry `superpositionMode` boolean (Story
  Mode is just its `false` state, not a separate field). **Story Mode** is the
  normal playthrough: start at World 1, defeat each world's rival to open the
  next one, meet each guardian in turn. **Superposition Mode** is a testing/
  exploration mode, not the intended first playthrough: every guardian is
  already met and fully unlocked from the moment the save exists, including
  from the Lab itself before the player has ever crossed a pass.
  The blanket "everything unlocked" grant (`OverworldScene.applySuperpositionUnlocks`,
  registry-only, no scene/world dependency of its own) is shared by two call sites:
  `HubScene.create()` (so Kondo/Franklin/Noether/Landau/Feynman/Skłodowska-Curie/
  Bloch's own Lab panels -- every guardian standing in the Lab regardless of
  `metGuardians` in this mode -- are already unlocked on a completely fresh save) and
  `OverworldScene.applySuperpositionLeveling()` (re-applied on every world entry --
  Continue, Bloch teleport, and the Hub door's World-1 jump alike -- alongside that
  method's own world-specific `playerHp` re-leveling, which stays local to
  `OverworldScene` since only that scene knows which world to heal against). The grant
  pins every player stat straight to `MAX_STAT` (world-independent, so it lives in the
  shared grant rather than the per-world method) and unlocks every passive plus every move a
  player can hold (`data/materials.ts`'s `PLAYER_MOVE_IDS`, the whole roster minus the
  opponent-only `GOLEM_MOVE_IDS` decohered ones, so "everything unlocked" cannot hand the
  player a golem's own corrupted excitation),
  merges every built world into `visitedWorlds` (so Bloch's teleport hub,
  §5, offers every world immediately, with no separate "Warp" UI, on top of the world
  doors §5 every world already has), and pre-fills the Hub's Qumatex (§4) with every
  real compound in the game so it reads as fully discovered. Dresselhaus/Majorana/
  Anderson's panels (§5) offer every crystal in the game as a candidate rather than only
  ones actually defeated (Dresselhaus's list still excludes hybrid-recipe results, same
  as normal play), and Bloch's/Dresselhaus's/Anderson's/Majorana's per-option unlock
  costs (§5) are bypassed outright rather than paid -- each panel checks
  `isSuperpositionMode()` directly instead of the persisted unlocked-option list, so
  toggling the mode back off doesn't leave any option permanently free on the save.
  For the four guardians whose kit is "several unlocked, only one truly active," the
  same grant also seeds that one active slot to a random pick among the unlocked
  options, but only if it's still unset -- a deliberate pick made at that guardian's own
  panel always survives every later re-application of the grant: `kondoActiveMove` to a
  random one of Kondo's three self-buff moves, `activePassiveByOwner.franklin` to a
  random one of Franklin's three passives, `andersonDopant` to a random non-hybrid
  crystal, and `playerForm` to a random pick from a pool coin-flipped between
  Dresselhaus's plain-crystal pool and Majorana's hybrid-result pool -- so a fresh
  Superposition save starts as a random ordinary crystal or an already-fused hybrid
  rather than always the same default starting form. Feynman has no such single-active
  slot (every move he levels stands independently), so his own version of the grant is
  unconditional rather than seed-once: every move id's `moveLevels` ceiling is set
  straight to 3 (max) on every application, leaving `carriedMoveLevels` -- the player's
  own pick of which unlocked tier to actually swing at -- untouched. With the player's own stats permanently maxed, opponents in this
  mode also stop scaling with the world -- `BattleScene`'s own `isSuperpositionMode`
  branch draws from `superpositionEnemyStats` (§3) instead of `enemyStatsForWorld`, one
  flat baseline shared by every world, still scaled by whichever difficulty tier is
  active.
  Toggled once at the title screen rather than mid-run, so it's a deliberate
  choice made before starting, not something stumbled into during play (the difficulty
  tier itself, unlike this toggle, can still be changed mid-playthrough from the Lab's
  Settings station -- §3).

### Soundtrack

All audio is procedural Web Audio with no external assets
(`game/src/audio/music.ts`) — one looping overworld score and one battle score
per world, in two arrangements the player picks from the Lab's Settings
station: "Classic" (chiptune-leaning arpeggios and a driving battle kit) and
"Modern", which is not authored separately but is the classic scores passed
through a per-track smoothing transform (`modernizeScore`): string-pad
attack/release swells, square/sawtooth mapped to clean triangle with the
drive stripped, repeated pitches tied legato, a raised ambience send, and
the overworld's drum kit dropped (battle keeps its full kit so a fight still
reads as a fight). Because Modern is derived rather than re-composed, the
hand-written gestures in the world-by-world table below survive in both
styles, and an edit to a classic score reaches its Modern rendition
automatically.

**The ten overworld scores are one arc rather than ten moods**, and its shape
is `dev_notes/WORLDS.md`'s light rule: the sequence darkens as coherence is
lost, so the music darkens with it.

Worlds 1–6 all sit on a **C tonic** while the mode drains out of it, which is
what makes the first half read as one light going out rather than six
unrelated keys. Worlds 7–10 move a **tritone to F#** and stay there, because
after World 7 the sun never returns and a tritone is the one interval with no
pull back home. F# is planted twice before it takes over — as World 2's raised
fourth and World 6's aurora drone — so the move sounds inevitable in
retrospect rather than arbitrary; C then returns as World 10's own raised
fourth, the dead sun seen in the mirror.

| # | Key / mode | bpm | What carries it |
|---|---|---|---|
| 1 | C Ionian | 96 | Pad alternates between the fifth above and the fifth below — two equally correct voicings of one chord, the two degenerate ground states |
| 2 | C Lydian | 100 | Two fixed motifs alternating bar by bar (the two-atom basis); the raised fourth is the game's first F# |
| 3 | C Mixolydian | 104 | Eight unbroken eighth-notes over a bass holding one note per bar — wind racing across ground that cannot move |
| 4 | C Aeolian | 132 | First minor world; a crash every fourth bar as the storm overhead — the first percussion in any overworld |
| 5 | C Phrygian | 84 | Flat second as the world's whole colour; held bare fifths, whole bars of silence, nothing arriving on the tonic |
| 6 | C Ionian | 116 | The false calm: World 1's own key and progression return, with a stuttering F#5 drone that grinds against the F chord |
| 7 | F# whole-tone | 76 | **The hard turn.** Bass and pad deleted, reverb send on for the first time, no chord progression at all — a two-voice canon in a collection with no tonic |
| 8 | F# Phrygian | 58 | The loss beat: World 1's melody at the tritone, bent into the mode, each phrase losing another note until the last bar is silence |
| 9 | F# Phrygian dominant | 140 | Major third over a flat second; F# and G chords grinding a semitone apart, driven square lead over a bare kick |
| 10 | F# Lydian | 158 | The lead answered a bar later by an exact copy of itself — the world modelling the player — over a held F#–C tritone |

Three deliberate exceptions to a smooth ramp, all of them the story's:
**World 6 brightens** (the mood relaxes, the danger does not), **World 7
breaks rather than darkens** (the light rule's discontinuity is a
discontinuity in the arrangement, not another step down), and **World 8 is
the only world that quotes another** — a quote earns its place there because
World 8 is where the arc's loss beat lands (`WORLDS.md` §5), and a melody
coming back wrong is the cheapest way to make a loss audible.

**The battle scores stay outside the arc**: bright, fast and driving in every
world, because a fight is the player's own coherence pushing back against a
world losing its own. What they carry instead is articulation — a crash on
the downbeat of each eight-bar section boundary, a snare fill dragging the
music into the reprise, hats lifting at phrase ends, and the loop's last two
beats walking up into the tonic waiting at the loop point.

The rhythm section plays through every seam. Contrast comes from new material
over an engine that keeps running, never from taking voices away: a battle
theme repeats dozens of times in a session, so a gesture that calls attention
to itself wears badly, and synthesized voices have no performance nuance to
sell a dropout — subtraction reads as the music faltering rather than as a
band leaning in. The sparse cold worlds (5 and 8) are the deliberate
exception: their held-note vamp and stab-then-silence lead are that decline
made audible, and their silence is the world's own character rather than an
articulation applied on top of it.

`npm run music-arc-check` measures the arc from the audio rather than the
configuration; see `dev_notes/DEVELOPMENT.md`.

## 8. Art & content pipeline

- Style target: GBA-era Pokemon/Golden Sun — small tile sprites, simple battle
  sprites (player bottom-left, opponent top-right), portrait busts for dialogue.
- Tools: none — the game ships and loads no image assets at all. Every crystal, tile,
  effect and guardian portrait is drawn procedurally with Phaser `Graphics` from the
  builders in `game/src/art/` (crystals, biomes, trees, attack effects, one avatar
  builder file per guardian) plus `game/src/scenes/overworld/terrain/materials/` for
  off-path terrain accents, and each world's map is generated at runtime by
  `game/src/world/mapgen.ts` rather than authored in a map editor.
- Materialdex entries and post-battle explanations can be adapted from
  `lecture_notes/tex/sessions/sessionNN.tex` — the course's short session notes,
  symlinked into this repo's root, see CLAUDE.md — rather than written fresh.
- Wild-encounter quiz pools are bound by that mapping: a world-N pool (N = 1..9) may
  only ask about the topics session N teaches, and a topic belongs to exactly one
  world. So mean-field theory and its three worked examples are World 1's, a
  criterion for magnetism (Stoner) and superexchange are World 6's, and
  Fermi-surface nesting and the plasmon are World 9's, whichever compound is being
  fought. `npm run quiz-topic-check` from `game/` scores every question against all
  ten sessions and flags the ones whose own session does not rank first; the rule
  itself is CLAUDE.md's "Quiz questions in short."
- Every question is a two-option choice, so it also has to be unambiguous: no unstated
  axis, sign, regime or symbol convention under which the wrong option becomes right,
  and no prompt leaning on a neighboring entry ("that same classification"), since
  questions are drawn one at a time at random. Where a convention is load-bearing, the
  prompt writes it out — e.g. the tight-binding questions state
  `H = −t Σ_n (c_n†c_{n+1} + h.c.)` rather than saying "with hopping t" and leaving the
  sign of the dispersion to the reader. The checklist is CLAUDE.md's "Quiz questions in
  short."

## 9. Current build status

Built and playable end to end: all 10 worlds have an overworld map, biome, wild-encounter
pool, rival, and guardian slot; the Hub, title screen, localStorage save, Qumatex, the
contextual tutorial tips, and the Story Mode/Superposition Mode picker are all in place
(§2, §4, §5, §7). `game/` is the only build; there is no separate no-install
single-file `demo/` prototype. All audio is procedural Web Audio with no external assets
(`game/src/audio/music.ts`), with both an overworld track and a battle track per world in
two selectable arrangements — "Classic" and "Modern", the latter derived from the classic
scores by a smoothing transform — toggled live from the Lab's Settings station; the ten
overworld scores form one darkening arc across the sequence (§7's "Soundtrack").

Not yet built:
- A mobile wrapper (Capacitor) and playtesting with students.

## 10. Open design questions

- **Subtype combination rules** — which main+subtype pairs are physically/
  narratively sensible needs a full compatibility table, not just one example.
- **Debuffs-on-the-opponent aren't implemented at all today** — no guardian teaches a move
  that inflicts anything on the *defender*; Kondo's three (§4) are self-buffs instead. An
  earlier design sketch described a "Gapped down" (defense drops, mirroring gap closing) and
  a "Symmetry-broken" (forced type shift for N turns) debuff; neither is implemented, and no
  guardian is currently slated to teach them -- if one ever is, it would need its own
  MOVE_COMPATIBILITY treatment (a real debuff move is an attack, unlike Kondo's three), not
  the "left off every list" self-buff shape.
- **Scope vs. solo-dev reality** — 10 worlds + full art + guardian roster is large for
  one person; consider cutting to 3–4 flagship worlds for a v1 before building all 10.
- **Course integration** — supplementary/optional tool, or tied into assessment?
  Affects how rigorous the Materialdex needs to be.
- **Quiz-text subscript notation** — physics questions/answers (`game/src/data/quiz.ts`)
  write subscripts as plain ASCII underscores (`U_c`, `k_B`, `E_F`, ~120 instances) since
  Phaser's `Text` has no native rich-text/subscript rendering, and Unicode's subscript
  Latin-letter block doesn't cover every needed letter (no subscript `b`, `c`, or `f`, so
  `k_B`/`U_c`/`E_F` themselves couldn't round-trip through it). Readable as-is to this
  course's audience, but true subscript rendering would need a custom multi-`Text`-object
  layout (split each string on `_`, offset the trailing run smaller/lower) built once and
  reused everywhere quiz/move text renders, not a quick fix.
- **Multiplayer/trading** — in scope or not? Changes hosting/save-system
  requirements significantly if yes.
- **Quiz-question-fetch functions aren't parallel** — `data/quiz.ts`'s
  `getAnalyticQuestion(visitedWorlds)` (Landau, singular), `getAnalyticQuestions(visitedWorlds,
  count)` (Feynman's streak, plural, same pool), and `getUltimateQuestions(count)`
  (Skłodowska-Curie, plural, a broader pool, no `visitedWorlds` param at all) are three
  differently-shaped call sites for what's conceptually one repeated "quiz-gate" need. Worth
  reconciling onto one `getQuestions(pool, count, visitedWorlds?)`-style function, deferred for
  now.
