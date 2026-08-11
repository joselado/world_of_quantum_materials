import { shade } from '../art/colors';
import type { Material, Move, MoveClass, MaterialType, CrystalVariant, Stats } from './types';

// Every ordinary attack is named after the quasiparticle/excitation that
// actually carries it, not an abstract "class" label -- Phonon Beam is a
// beam of phonons, Magnon Pulse a pulse of magnons, and so on; only the
// display `name` is quasiparticle-themed, `id`/`class` stay plain. There's
// deliberately no single move just called "Impurity Scattering," since
// disorder/impurities aren't one particle a crystal emits (see
// MOVE_COMPATIBILITY below for which of these each material can actually
// host). Kondo's 'screening' moves are the one exception to the
// quasiparticle-naming rule -- a technique/process the player applies (a
// scattering channel deliberately tuned) rather than a particle a crystal
// itself emits, so their names describe the process instead (see that
// class's own comment below). Curie's moves (skyfallBeam/groundEruption
// below) name a quasiparticle like any other move too, but a dynamic one --
// `curieMoveDisplayName` renders each as "<quasiparticle> Beam"/"<quasiparticle>
// Eruption", the quasiparticle word being whichever class the player has
// tuned it to via her picker (default 'phonon', so "Phonon Beam"/"Phonon
// Eruption" until tuned). Their static `name` below is just that default.
//
// Power climbs with how unconventional the underlying physics is -- an
// ordinary lattice vibration or band electron is weak, a topological/
// non-Abelian excitation is strong -- so every move a player buys from
// Noether outpowers the free starting Phonon Beam:
//   phonon (Phonon Beam, every crystal has a lattice) < trivial (Electron
//   Pulse, ordinary band electron) < magnetic (Magnon Pulse, a broken-
//   symmetry collective mode) < localization (Polaron Drag, a correlated
//   lattice-bound distortion) < entanglement (Spinon Swap, a fractionalized
//   spin-liquid excitation) < gauge/decoherence (Anyon Braid, Majorana
//   Split -- topological and non-Abelian, tied for the most exotic tier the
//   course covers).
export const MOVES: Record<string, Move> = {
  tunnelStrike: { id: 'tunnelStrike', name: 'Electron Pulse', class: 'trivial', power: 7 },
  magneticField: { id: 'magneticField', name: 'Magnon Pulse', class: 'magnetic', power: 8 },
  thermalFluctuation: {
    id: 'thermalFluctuation',
    name: 'Phonon Beam',
    class: 'phonon',
    power: 6,
  },
  localizationPin: { id: 'localizationPin', name: 'Polaron Drag', class: 'localization', power: 9 },
  fluxTwist: { id: 'fluxTwist', name: 'Anyon Braid', class: 'gauge', power: 11 },
  entanglementSwap: { id: 'entanglementSwap', name: 'Spinon Swap', class: 'entanglement', power: 10 },
  decoherenceWave: { id: 'decoherenceWave', name: 'Majorana Split', class: 'decoherence', power: 11 },
  // Curie's quiz-gated moves (§5, World 6, ANALYTIC_MOVE_IDS below) -- power
  // sits below the other exotic-tier moves since their real payoff is the
  // answer-gated 2x/0.5x multiplier BattleScene applies, not raw power.
  // Never listed in any material's `moves` array (wild/rival movesets) --
  // only the player can ever be asked one of these questions. Each starts
  // at the universal 'phonon' class (so it's usable/never-mismatched before
  // the player ever tunes it) -- Curie's picker (CURIE_TUNABLE_CLASSES,
  // getCurieMoveClass) lets the player assign it any quasiparticle their
  // current form hosts instead.
  skyfallBeam: { id: 'skyfallBeam', name: 'Phonon Beam', class: 'phonon', power: 10 },
  groundEruption: { id: 'groundEruption', name: 'Phonon Eruption', class: 'phonon', power: 10 },
  // The multiferroic type's signature quasiparticle -- a spin wave that
  // picks up electric-dipole activity through magnon-phonon hybridization
  // (the magnetoelectric coupling itself), sitting alongside ordinary
  // magnons rather than replacing them (MOVE_COMPATIBILITY still grants
  // multiferroics 'magnetic' too).
  electromagnonPulse: { id: 'electromagnonPulse', name: 'Electromagnon Pulse', class: 'magnetoelectric', power: 9 },
  // Kondo's three moves (§5, World 8) -- power sits at the bottom of the
  // ordering, on par with Electron Pulse, since their real payoff is the
  // 3-turn status effect each deterministically inflicts on the defender
  // (BattleScene.resolveHit), not raw power, the same "low power, real
  // payoff elsewhere" shape Curie's two moves already use for a different
  // payoff. Never listed in any wild/rival material's `moves`
  // array -- only the player can currently learn them, and only one of the
  // three is ever active in battle at a time (registry/save
  // `kondoActiveMove`, switched only by talking to Kondo again --
  // OverworldScene.showKondoPanel/getBattleMoves). Named generically rather
  // than after the specific heavy-fermion/Kondo-lattice physics that
  // inspired them, since MOVE_COMPATIBILITY grants every material type
  // 'screening' -- these are usable from any form, not just a spin liquid or
  // defect state. Screening Pulse screens the defender's own moment,
  // weakening its outgoing damage (Screened); Scattering Drag disorder-
  // scatters the defender's own carriers, dragging its effective Velocity
  // down (Slowed); Breakdown Cascade collapses whatever protection the
  // defender's state has, raising the damage it takes (Weakened). None of
  // the three status names double as a MoveClass -- 'decoherence' and
  // 'localization' are separately Majorana Split's and Polaron Drag's
  // classes, unrelated quasiparticle physics, so a status name matching one
  // of those would read as if this generic scattering process were tied to
  // that specific move instead.
  screeningCloud: { id: 'screeningCloud', name: 'Screening Pulse', class: 'screening', power: 7 },
  heavyFermionDrag: { id: 'heavyFermionDrag', name: 'Scattering Drag', class: 'screening', power: 7 },
  kondoBreakdown: { id: 'kondoBreakdown', name: 'Breakdown Cascade', class: 'screening', power: 7 },
};

// Curie is the sole seller of these two quiz-gated moves
// (OverworldScene.showCuriePanel, mirroring Noether's showNoetherShop) --
// kept out of SHOP_MOVE_IDS so Noether's own shop never offers them too.
// Named explicitly by id rather than filtered by class -- unlike Kondo's
// screening moves, these don't share a distinguishing class of their own
// (each carries whatever ordinary quasiparticle class the player has tuned
// it to, see getCurieMoveClass below), so "is this one of Curie's moves" is
// a fact about the move's identity, not something derivable from `class`.
export const ANALYTIC_MOVE_IDS = ['skyfallBeam', 'groundEruption'];

// The full roster of ordinary quasiparticle classes Curie's shop can ever
// offer to assign to a quiz-gated move (OverworldScene.showCurieClassPicker)
// -- every ordinary Attacks-section class, i.e. everything except
// 'screening' itself (Kondo's, not an assignable quasiparticle). The picker
// itself filters this down further, to only the classes the player's
// *current* form can actually host (`canHost(playerMaterial.type, cls)`) --
// so a class as narrow as 'magnetoelectric' (only the 'multiferroic' type
// hosts it) only ever shows up while the player is wearing a multiferroic
// form, rather than being freely pickable as an easy "always mismatch
// nearly every opponent" choice.
export const CURIE_TUNABLE_CLASSES: MoveClass[] = [
  'trivial',
  'magnetic',
  'phonon',
  'localization',
  'gauge',
  'entanglement',
  'decoherence',
  'magnetoelectric',
];

// Reuses the display name the matching ordinary move already carries
// (Electron Pulse for 'trivial', Magnon Pulse for 'magnetic', ...) as the
// label Curie's picker shows for that class, rather than inventing a
// second naming scheme -- each of CURIE_TUNABLE_CLASSES maps to exactly one
// MOVES entry today.
export function quasiparticleLabel(moveClass: MoveClass): string {
  return Object.values(MOVES).find((m) => m.class === moveClass)?.name ?? moveClass;
}

// Kondo is the sole seller of the three screening-class moves
// (OverworldScene.showKondoPanel, mirroring Curie's showCuriePanel with a
// 3-entry list instead of 2) -- kept out of SHOP_MOVE_IDS so Noether never
// also offers them. Unlike ANALYTIC_MOVE_IDS, buying one of these doesn't
// make it usable on its own -- see getBattleMoves below for the
// only-one-active-at-a-time special case (registry/save `kondoActiveMove`).
export const KONDO_MOVE_IDS = Object.values(MOVES)
  .filter((m) => m.class === 'screening')
  .map((m) => m.id);

// Every move Noether can eventually teach, priced by raw power
// (`OverworldScene.shopCost`) -- everything except the player's starting
// Phonon Beam, Curie's quiz-gated moves (ANALYTIC_MOVE_IDS, sold only by
// her), and Kondo's screening moves (KONDO_MOVE_IDS, sold only by him). What
// actually shows up in her shop (and what actually appears as a battle
// button) is this list filtered down to `compatibleMoves(currentPlayerForm)`,
// so a trivial-type player is only ever offered Electron Pulse until they
// transmute into a form whose physics supports the rest (see
// MOVE_COMPATIBILITY/compatibleMoves).
export const SHOP_MOVE_IDS = Object.keys(MOVES).filter(
  (id) => id !== 'thermalFluctuation' && !ANALYTIC_MOVE_IDS.includes(id) && !KONDO_MOVE_IDS.includes(id)
);

// Which quasiparticle classes a given main type can physically host --
// Phonon Beam ('phonon') is on every list since every crystal has a
// lattice, but e.g. Magnon Pulse only appears for types with actual
// magnetic order (magnet, classicalmag), never for a plain band
// insulator/semiconductor like Silicon. This is what makes "Si doesn't have
// magnons" a rule the game enforces, not just flavor text -- both the
// battle move list (getBattleMoves) and Noether's shop filter through this.
// 'screening' is the one exception, on every list, since Kondo's three
// moves deal in a generic scattering/decoherence process any crystal's own
// disorder/environment can carry, not a mode tied to one specific type's
// band structure (their real payoff is the 3-turn status effect they
// inflict, not raw power, so it doesn't need the mismatch bonus to matter)
// -- never mismatched or gated by current form. Adding a new MoveClass here
// always means deciding this on purpose, not by omission: a class left off
// every list would make its moves *always* mismatch (canHost) against every
// defender -- a silent 2x on top of whatever bonus BattleScene itself
// applies for that class, not a neutral default.
const MOVE_COMPATIBILITY: Record<MaterialType, MoveClass[]> = {
  trivial: ['trivial', 'phonon', 'screening'],
  magnet: ['magnetic', 'phonon', 'screening'],
  topological: ['gauge', 'trivial', 'phonon', 'decoherence', 'screening'],
  qhe: ['gauge', 'trivial', 'phonon', 'screening'],
  supercon: ['localization', 'decoherence', 'phonon', 'trivial', 'screening'],
  classicalmag: ['magnetic', 'phonon', 'screening'],
  spinliquid: ['entanglement', 'phonon', 'localization', 'screening'],
  adaptive: ['trivial', 'magnetic', 'phonon', 'localization', 'gauge', 'entanglement', 'decoherence', 'screening'],
  multiferroic: ['magnetoelectric', 'magnetic', 'phonon', 'screening'],
  // Shares 'gauge' with topological/qhe rather than getting its own class --
  // a Chern insulator's edge modes (and, for a fractional state, its anyons)
  // are the same quasiparticle family those two types already host.
  chernInsulator: ['gauge', 'trivial', 'phonon', 'screening'],
};

export function compatibleMoves(material: Material): string[] {
  const allowed = new Set(MOVE_COMPATIBILITY[material.type]);
  return Object.values(MOVES)
    .filter((m) => allowed.has(m.class))
    .map((m) => m.id);
}

// Whether a defender's own type can physically host a given quasiparticle
// class at all -- the same MOVE_COMPATIBILITY table compatibleMoves() reads
// for the attacker's side, checked here for the defender's. Backs
// BattleScene.resolveHit's "quasiparticle mismatch" damage rule, now the
// sole type-interaction term in battle (the earlier strong/weak TYPE_CHART
// was dropped as an unnecessary second system on top of it -- see DESIGN.md
// §4): a defender with no natural channel for a quasiparticle (e.g. a plain
// band insulator hit by a magnon pulse, having no magnetic order to carry/
// damp it at all) takes that hit at double force. Phonon Beam ('phonon') is
// on every type's MOVE_COMPATIBILITY list, so it can never trigger this --
// the one universal move is also the one that never gets the mismatch bonus,
// by design, not an oversight.
export function canHost(type: MaterialType, moveClass: MoveClass): boolean {
  return MOVE_COMPATIBILITY[type].includes(moveClass);
}

// Battle stats (DESIGN.md §3): every crystal starts at the same baseline:
// the player's own stats live in the save/registry (`playerStats`, grown by
// spending qumatokens with Noether -- OverworldScene.renderShopStats), while
// an opponent's stats are computed fresh from the world number at battle
// start (enemyStatsForWorld) rather than baked per-species, so difficulty
// climbs with the world rather than needing 30 hand-tuned stat blocks.
export const BASE_STAT = 10;

export const DEFAULT_STATS: Stats = { quantumness: BASE_STAT, velocity: BASE_STAT, correlation: BASE_STAT };

// Total enemy-stat growth per world is now a budget of 8 (3/3/2), up from
// the previous flat 2/2/2 (a total of 6) -- a deliberate ~33% difficulty
// increase, not a neutral redistribution of the old total, sized so staying
// competitive into the next world costs roughly 8 qumatoken-funded stat
// purchases (statUpgradeCost), matching the pace guardians sell stat upgrades
// at. Correlation gets the smaller share since its effect (defense =
// BASE_STAT / correlation) is already nonlinear, so each point there goes
// further than a flat point of quantumness/velocity.
const STAT_GROWTH_PER_WORLD: Stats = { quantumness: 3, velocity: 3, correlation: 2 };

export function enemyStatsForWorld(world: number): Stats {
  const steps = Math.max(0, world - 1);
  return {
    quantumness: BASE_STAT + steps * STAT_GROWTH_PER_WORLD.quantumness,
    velocity: BASE_STAT + steps * STAT_GROWTH_PER_WORLD.velocity,
    correlation: BASE_STAT + steps * STAT_GROWTH_PER_WORLD.correlation,
  };
}

// Cost to raise a stat by 1 point from its current value, steepening as the
// player buys more (the same "priced to keep buying meaningful" shape as
// shopCost for moves).
export function statUpgradeCost(currentValue: number): number {
  return (currentValue - BASE_STAT + 1) * 50;
}

// Qumatoken price for a shop move, scaled off its own power -- the stronger
// the quasiparticle, the more it costs, the same "priced to keep buying
// meaningful" shape as statUpgradeCost. Shared by every guardian who sells
// moves for qumatokens (Noether, Curie, Kondo).
export function shopCost(move: Move): number {
  return move.power * 5;
}

// Minimal structural type (mirrors data/save.ts's RegistryLike) so this
// stays a plain data module -- any object with `.get` works, in practice
// the real Phaser registry.
interface RegistryLike {
  get: (key: string) => unknown;
}

export function getPlayerStats(registry: RegistryLike): Stats {
  return (registry.get('playerStats') as Stats) ?? DEFAULT_STATS;
}

// The player's current crystal form -- Silicon by default, or whatever
// Dresselhaus transmuted them into (§5, `OverworldScene.transmuteInto`). Every scene
// that used to read PLAYER_MATERIAL directly for the player's own look/
// stats/moves should read this instead, since transmutation changes all of
// them together.
export function getPlayerMaterial(registry: RegistryLike): Material {
  return (registry.get('playerForm') as Material | undefined) ?? PLAYER_MATERIAL;
}

// The moves the player can actually use in battle right now: the ones
// they've learned (registry `unlockedMoves`, grown via Noether's shop)
// intersected with what their current form's physics supports
// (compatibleMoves). Transmuting into a new form doesn't erase anything
// learned -- it just changes which of those learned moves are currently
// usable, so switching back later restores the rest for free.
//
// One narrow special case: Kondo's three screening-class moves
// (KONDO_MOVE_IDS) can all be *learned* independently, but only one is ever
// *usable* at a time -- the registry/save `kondoActiveMove` id, switched
// only by talking to Kondo again (OverworldScene.showKondoPanel), not
// per-turn like every other learned move (Kondo screening resolves one
// scattering channel at a time, not all three at once). A bought-but-
// inactive Kondo move stays in `unlockedMoves` (still "learned") -- it just
// never passes this filter until it's made active.
export function getBattleMoves(registry: RegistryLike): string[] {
  const unlocked = (registry.get('unlockedMoves') as string[]) ?? [...PLAYER_MATERIAL.moves];
  const allowed = new Set(compatibleMoves(getPlayerMaterial(registry)));
  const activeKondoMove = (registry.get('kondoActiveMove') as string | null) ?? null;
  return unlocked.filter((id) => {
    if (!allowed.has(id)) return false;
    if (KONDO_MOVE_IDS.includes(id) && id !== activeKondoMove) return false;
    return true;
  });
}

// The quasiparticle class BattleScene's mismatch check should use for a
// given move -- ordinarily just that move's own fixed `class`, except for
// one of Curie's two moves once the player has tuned it via her picker
// (OverworldScene.showCurieClassPicker, registry/save `curieMoveClass`):
// the mismatch check reads the player-assigned quasiparticle instead of the
// move's default 'phonon', so a tuned move can mismatch a defender like any
// ordinary attack would. An untuned move (never visited Curie's picker, or
// an older save from before this existed) falls back to its own default
// 'phonon' class, the same "never mismatches" behavior it starts with.
function assignedCurieClass(registry: RegistryLike, moveId: string): MoveClass | undefined {
  return (registry.get('curieMoveClass') as Partial<Record<string, MoveClass>> | undefined)?.[moveId];
}

// A tuned assignment is picked against whatever form the player was
// wearing at Curie's shop, but the player can transmute afterward -- if the
// form they're wearing *now* can no longer host that class (e.g. tuned to
// 'magnetoelectric' as a multiferroic, then transmuted into Silicon), this
// falls back to 'phonon' (Phonon Beam) rather than keeping an assignment
// the current form can't actually carry: 'phonon' is on every
// MOVE_COMPATIBILITY list, so it's always a safe, always-hostable landing
// spot. An untuned move (never visited Curie's picker) falls back to its
// own default 'phonon' class instead, the same "never mismatches" behavior.
export function getCurieMoveClass(registry: RegistryLike, moveId: string): MoveClass {
  const assigned = assignedCurieClass(registry, moveId);
  if (!assigned) return MOVES[moveId].class;
  const currentType = getPlayerMaterial(registry).type;
  return canHost(currentType, assigned) ? assigned : 'phonon';
}

// Curie's moves always display whichever quasiparticle they're currently
// carrying, tuned or not (e.g. tuned to 'magnetic' reads as "Magnon Beam";
// untuned reads as "Phonon Beam", the same default `getCurieMoveClass`
// falls back to) -- so unlike a static move name, this one never goes stale
// relative to what the move actually mismatches with. The move's own fixed
// shape (Beam vs. Eruption) is read off its static `name`'s own second word
// rather than a second hand-authored word list, so a future MOVES rename
// stays in sync automatically; only the quasiparticle word in front of it
// changes. Reads getCurieMoveClass rather than the raw assignment, so if the
// current form can't host the tuned class anymore the name reverts to its
// Phonon form too, matching what the mismatch check actually uses.
export function curieMoveDisplayName(registry: RegistryLike, moveId: string): string {
  const active = getCurieMoveClass(registry, moveId);
  const shape = MOVES[moveId].name.split(' ').slice(1).join(' ');
  return `${quasiparticleLabel(active).split(' ')[0]} ${shape}`;
}

// The player is a crystal too -- just one entry out of this same roster, not a
// separate species. Silicon: the trivial/tutorial-baseline type from
// DESIGN.md's crystal database (topic 1). `moves` here is just the starting
// loadout (Phonon Beam only) -- which moves are actually available in
// battle is tracked separately in the Phaser registry's `unlockedMoves`
// entry, since that grows as the player buys more from Noether.
export const PLAYER_MATERIAL: Material = {
  name: 'Silicon',
  type: 'trivial',
  color: 0x4a90d9,
  variant: 'shard',
  maxHp: 30,
  moves: ['thermalFluctuation'],
};

// One base look per main type, shaded a little differently per compound
// within that type so siblings (e.g. Iron vs. Cobalt) read as a family
// rather than being indistinguishable. Exported so a purely decorative
// showcase (TitleScene's crystal cluster) can pull real per-type looks
// instead of duplicating color literals that would drift out of sync.
export const TYPE_LOOK: Record<MaterialType, { color: number; variant: CrystalVariant }> = {
  trivial: { color: 0x7a8a99, variant: 'shard' },
  magnet: { color: 0xd94a4a, variant: 'cluster' },
  topological: { color: 0x4ad9a0, variant: 'prism' },
  qhe: { color: 0xd9a24a, variant: 'prism' },
  supercon: { color: 0x7fd1e8, variant: 'shard' },
  classicalmag: { color: 0xc97a3a, variant: 'cluster' },
  spinliquid: { color: 0x5ad9c9, variant: 'cluster' },
  adaptive: { color: 0x333333, variant: 'prism' },
  multiferroic: { color: 0xc94ac0, variant: 'layer' },
  chernInsulator: { color: 0xc9d94a, variant: 'twisted' },
};

// A crystal database row: real compound name + main type (which fixes its
// look and its move compatibility) + battle stats. `shadeStep` just
// separates same-type siblings visually (e.g. Iron vs. Cobalt) using
// TYPE_LOOK's base color. `variantOverride` lets a specific compound render
// as a floating 2D sheet or a twisted double-layer instead of its type's
// usual shard/cluster/prism look -- for the handful of compounds the design
// doc's crystal database itself calls out as monolayer/van der Waals/twisted
// (Graphene, Monolayer WTe2, CrI3, Twisted Bilayer MoTe2), not a blanket
// per-type rule.
function crystal(
  name: string,
  type: MaterialType,
  maxHp: number,
  moves: string[],
  shadeStep = 0,
  variantOverride?: CrystalVariant
): Material {
  const look = TYPE_LOOK[type];
  return {
    name,
    type,
    color: shade(look.color, shadeStep * 18),
    variant: variantOverride ?? look.variant,
    maxHp,
    moves,
  };
}

// Per-world (course-topic) wild-crystal pools, keyed by world number --
// matches the "Wild material archetypes" column of the world table in
// DESIGN.md, drawn from the fuller candidate list in that doc's "Crystal
// database" section. Each scene pulls its own world's pool via
// `getWildPool()` rather than sharing one global list, so later worlds can
// each have their own specials without touching the encounter logic.
// World 10's own pool (below) hosts the game's named hybrid-recipe results
// (HYBRID_RECIPES further down) plus a couple of standalone single compounds
// whose own type belongs to an existing topic's session (chernInsulator ->
// topic 4, quantum Hall; multiferroic -> topic 6, classical
// magnetism/magnons) but has no dedicated world of its own.
// WORLD_RIVALS[10] (the finale boss "The Adapted") is the one entity that's
// still deliberately not a real material -- see that table's own comment.
// Every moveset below is drawn only from MOVE_COMPATIBILITY[type] -- e.g.
// trivial crystals (Si, GaN, MgO, Graphene) only ever get Electron Pulse and
// Phonon Beam, never Magnon Pulse, since a plain band insulator has no
// magnetic order to carry one.
export const WORLD_CRYSTALS: Partial<Record<number, Material[]>> = {
  1: [
    crystal('Graphene', 'trivial', 22, ['tunnelStrike', 'thermalFluctuation'], 0, 'layer'),
    crystal('Manganese Oxide', 'magnet', 26, ['thermalFluctuation', 'magneticField']),
    crystal('Nickel Oxide', 'magnet', 25, ['thermalFluctuation', 'magneticField'], 1),
    // Elemental Cr is an itinerant (metallic) antiferromagnet -- the SDW
    // mean-field/Stoner-criterion counterpart to MnO/NiO's Mott-insulating
    // picture above. Also HYBRID_RECIPES' magnetic-dopant parent for Cr-doped
    // (Bi,Sb)₂Te₃ (world 3's Bi₂Te₃ + this).
    crystal('Chromium', 'magnet', 24, ['thermalFluctuation', 'magneticField'], 2),
  ],
  // Topic 2 (symmetries, tight-binding) has no dedicated main type of its
  // own in the type system -- it stays at the trivial baseline, just with
  // "lattice" flavor compounds instead of world 1's tutorial picks.
  2: [
    crystal('Graphene', 'trivial', 22, ['tunnelStrike', 'thermalFluctuation'], 0, 'layer'),
    crystal('Gallium Nitride', 'trivial', 23, ['tunnelStrike', 'thermalFluctuation'], 1),
    crystal('Magnesium Oxide', 'trivial', 21, ['thermalFluctuation', 'tunnelStrike'], 2),
    // Ordinary trivial-type semiconductors added as hybrid-recipe parents
    // (HYBRID_RECIPES below) -- InAs's own role is providing the strong
    // spin-orbit coupling a Majorana wire needs; the 2H (semiconducting)
    // MoTe₂ monolayer is the untwisted parent that becomes Twisted Bilayer
    // MoTe₂ once fused with itself -- distinct from the already-topological
    // 1T′ monolayer phase (world 3's Monolayer WTe₂ sibling).
    crystal('Indium Arsenide', 'trivial', 24, ['tunnelStrike', 'thermalFluctuation'], 3),
    crystal('Monolayer MoTe₂ (2H)', 'trivial', 22, ['tunnelStrike', 'thermalFluctuation'], 4, 'layer'),
  ],
  3: [
    // Undoped host -- world 1's Chromium fuses into this to make Cr-doped
    // (Bi,Sb)₂Te₃ (HYBRID_RECIPES below), the quantum-anomalous-Hall state
    // that only appears once magnetism is doped in.
    crystal('Bi₂Te₃', 'topological', 24, ['fluxTwist', 'decoherenceWave']),
    crystal('Tantalum Arsenide', 'topological', 26, ['fluxTwist', 'tunnelStrike'], 1),
    crystal('Monolayer WTe₂', 'topological', 23, ['fluxTwist', 'thermalFluctuation'], 2, 'layer'),
  ],
  4: [
    crystal('Gallium Arsenide', 'qhe', 25, ['fluxTwist', 'tunnelStrike']),
    crystal('Graphene (strong field)', 'qhe', 24, ['fluxTwist', 'thermalFluctuation'], 1, 'layer'),
    crystal('Twisted Bilayer MoTe₂', 'qhe', 26, ['fluxTwist', 'thermalFluctuation'], 2, 'twisted'),
  ],
  5: [
    crystal('Aluminum', 'supercon', 28, ['localizationPin', 'thermalFluctuation']),
    crystal('Lead', 'supercon', 30, ['localizationPin', 'thermalFluctuation'], 1),
    crystal('YBCO', 'supercon', 27, ['localizationPin', 'thermalFluctuation'], 2),
    crystal('Fe/Pb Majorana Chain', 'supercon', 29, ['localizationPin', 'decoherenceWave'], 3),
    // Niobium: the highest-Tc elemental BCS superconductor at ambient
    // pressure, same conventional family as Aluminum/Lead above. Tantalum
    // Disulfide's 1H phase is a standalone metallic/superconducting TMD
    // monolayer in its own right -- distinct from the 1T phase (world 8),
    // and the other half of the 1T/1H-TaS₂ heterostructure hybrid recipe.
    crystal('Niobium', 'supercon', 29, ['localizationPin', 'thermalFluctuation'], 4),
    crystal('Tantalum Disulfide (1H)', 'supercon', 26, ['localizationPin', 'thermalFluctuation'], 5, 'layer'),
  ],
  6: [
    crystal('Iron', 'classicalmag', 27, ['thermalFluctuation', 'magneticField']),
    crystal('Cobalt', 'classicalmag', 27, ['thermalFluctuation', 'magneticField'], 1),
    crystal('Chromium Triiodide', 'classicalmag', 25, ['thermalFluctuation', 'magneticField'], 2, 'layer'),
    // Same van der Waals ferromagnet family as Chromium Triiodide above, the
    // other half of the NbSe₂/CrBr₃ topological-superconductor recipe.
    crystal('Chromium Tribromide', 'classicalmag', 25, ['thermalFluctuation', 'magneticField'], 3, 'layer'),
  ],
  7: [
    crystal('Herbertsmithite', 'spinliquid', 23, ['entanglementSwap', 'thermalFluctuation']),
    crystal('Strontium Copper Borate', 'spinliquid', 24, ['entanglementSwap', 'localizationPin'], 1),
    crystal('Thallium Copper Chloride', 'spinliquid', 22, ['entanglementSwap', 'thermalFluctuation'], 2),
  ],
  8: [
    crystal('α-Ruthenium Trichloride', 'spinliquid', 24, ['entanglementSwap', 'localizationPin']),
    crystal('Herbertsmithite', 'spinliquid', 23, ['entanglementSwap', 'localizationPin'], 1),
    crystal('YbMgGaO₄', 'spinliquid', 22, ['entanglementSwap', 'thermalFluctuation'], 2),
    // The star-of-David CDW Mott insulator / spin-liquid candidate phase --
    // the other half of the 1T/1H-TaS₂ heterostructure hybrid recipe (world
    // 5's 1H phase above).
    crystal('Tantalum Disulfide (1T)', 'spinliquid', 24, ['entanglementSwap', 'localizationPin'], 3),
  ],
  // World 9 hosts Yu-Shiba-Rusinov/vortex-bound (Majorana) defect states and
  // Friedel-oscillation impurity resonances -- both textbook phenomena of a
  // superconductor's own disorder physics, so both compounds are 'supercon'
  // type rather than a dedicated defect type.
  9: [
    crystal('Fe(Te,Se)', 'supercon', 22, ['localizationPin', 'decoherenceWave'], 1),
    crystal('Niobium Diselenide', 'supercon', 21, ['localizationPin', 'thermalFluctuation'], 2),
  ],
  // The meta-world's wilds are the game's actual named hybrid materials (see
  // HYBRID_RECIPES below) plus two standalone compounds whose own type isn't
  // tied to any of course topics 1-9 -- so the corridor plays back the
  // player's own fusions/discoveries literally, not just as flavor text.
  // WORLD_RIVALS[10] ("The Adapted") is the one entity that's deliberately
  // not a real material -- see that table's own comment.
  10: [
    crystal('Twisted Bilayer Graphene', 'supercon', 32, ['localizationPin', 'decoherenceWave'], 0, 'twisted'),
    crystal('InAs/Al Majorana Wire', 'supercon', 31, ['localizationPin', 'decoherenceWave'], 1),
    crystal('CrI₃/NbSe₂ Topological-SC Heterostructure', 'topological', 33, ['fluxTwist', 'decoherenceWave'], 0, 'layer'),
    crystal('NbSe₂/CrBr₃ Topological-SC Heterostructure', 'topological', 33, ['fluxTwist', 'decoherenceWave'], 1, 'layer'),
    crystal('Twisted CrI₃', 'multiferroic', 32, ['electromagnonPulse', 'magneticField'], 0, 'twisted'),
    crystal('1T/1H-TaS₂ Heterostructure', 'spinliquid', 30, ['entanglementSwap', 'localizationPin'], 4, 'layer'),
    crystal('MnBi₂Te₄', 'chernInsulator', 30, ['fluxTwist', 'tunnelStrike'], 0, 'layer'),
    crystal('Monolayer NiI₂', 'multiferroic', 28, ['electromagnonPulse', 'magneticField'], 1, 'layer'),
    crystal('Cr-doped (Bi,Sb)₂Te₃', 'topological', 29, ['fluxTwist', 'decoherenceWave'], 2),
  ],
};

// World 9's rival, "Rival Impurity Resonance," has no single fixed type the
// way every other rival does -- an impurity/defect-bound resonance can form
// in any host crystal, so its type is rolled at random rather than
// authored. OverworldScene rolls it once per playthrough and caches the
// result in the registry/save (`rival9Type`) so the goal-tile boss preview
// and the actual battle always agree on which crystal it turned out to be.
export const RIVAL_9_TYPES: MaterialType[] = [
  'trivial',
  'magnet',
  'topological',
  'qhe',
  'supercon',
  'classicalmag',
  'spinliquid',
  'multiferroic',
  'chernInsulator',
];

export function rollRival9Type(): MaterialType {
  return RIVAL_9_TYPES[Math.floor(Math.random() * RIVAL_9_TYPES.length)];
}

function rivalImpurityResonance(type: MaterialType): Material {
  return crystal('Rival Impurity Resonance', type, 66, ['localizationPin', 'decoherenceWave'], 11);
}

// The single "beat this to unlock the guardian and the way onward" gate per
// world (DESIGN.md's world table, "Gate to next world" column) -- distinct
// from WORLD_CRYSTALS' ordinary wild encounters, which never block
// progress. World 9 has no static entry here -- see rivalImpurityResonance/
// getRival above and below.
export const WORLD_RIVALS: Partial<Record<number, Material>> = {
  1: crystal('Rival Silicon', 'trivial', 34, ['thermalFluctuation', 'tunnelStrike'], 3),
  // A Bloch wave is the actual object world 2's lecture (symmetries,
  // Bloch's theorem, tight-binding) builds toward.
  2: crystal('Rival Bloch Wave', 'trivial', 38, ['thermalFluctuation', 'tunnelStrike'], 4),
  3: crystal('Rival Edge State', 'topological', 42, ['fluxTwist', 'decoherenceWave'], 5),
  4: crystal('Rival Landau Level', 'qhe', 46, ['fluxTwist', 'tunnelStrike'], 6),
  5: crystal('Rival Cooper Pair', 'supercon', 50, ['localizationPin', 'decoherenceWave'], 7),
  6: crystal('Rival Domain Wall', 'classicalmag', 54, ['magneticField', 'thermalFluctuation'], 8),
  7: crystal('Rival Entangled Pair', 'spinliquid', 58, ['entanglementSwap', 'localizationPin'], 9),
  8: crystal('Rival Spinon', 'spinliquid', 62, ['entanglementSwap', 'localizationPin'], 10),
  // The finale: no real compound (see DESIGN.md §5's plot hook), an
  // "adaptive" type that can host every quasiparticle class -- "a model of
  // you," drawing from the same move roster the player themselves has
  // access to by this point.
  10: crystal('The Adapted', 'adaptive', 80, ['tunnelStrike', 'magneticField', 'fluxTwist', 'decoherenceWave'], 12),
};

// `rival9Type` is only meaningful for world 9 -- every other world's rival
// is the fixed WORLD_RIVALS entry, so the caller doesn't need to resolve
// anything before calling this. For world 9, the caller should already have
// rolled and cached a type (OverworldScene, so the preview and the battle
// agree); an unresolved call still rolls a fresh one rather than crashing.
export function getRival(world: number, rival9Type?: MaterialType): Material | undefined {
  if (world === 9) return rivalImpurityResonance(rival9Type ?? rollRival9Type());
  return WORLD_RIVALS[world];
}

// Looked up by name for Dresselhaus's transmutation panel (§5) -- searches every
// world's wild pool, not WORLD_RIVALS, since rival crystals aren't real
// compounds (matches OverworldScene.recordDiscovery's own rule) and so are
// never offered as a form to become.
export function findMaterialByName(name: string): Material | undefined {
  for (const pool of Object.values(WORLD_CRYSTALS)) {
    const found = pool?.find((m) => m.name === name);
    if (found) return found;
  }
  return undefined;
}

// Every real compound across every world's wild pool, deduped by name (a
// few names repeat across worlds, e.g. Graphene and Herbertsmithite) --
// Superposition Mode's "every transmutation/hybrid available from the start"
// behavior (Dresselhaus/Majorana/Anderson's panels) draws candidates from this instead of
// the player's actual `defeatedMaterials` history.
export function allCrystals(): Material[] {
  const seen = new Set<string>();
  const out: Material[] = [];
  for (const pool of Object.values(WORLD_CRYSTALS)) {
    for (const m of pool ?? []) {
      if (seen.has(m.name)) continue;
      seen.add(m.name);
      out.push(m);
    }
  }
  return out;
}

// Majorana's hybridization mechanic (§5): fuse two materials the player has
// already defeated into a new state -- a curated, physically-grounded
// catalog of named parent pairs, not a generic type-pair rule. This used to
// be a generic "these two main types always produce that main type" table
// (the old HYBRID_RULES), which forbade same-type pairs on the reasoning
// that "fusing two superconductors isn't a new phase, it's just a bigger
// superconductor" -- but real engineered platforms include exactly that
// (Twisted Bilayer Graphene from two graphene sheets; an InAs/Al Majorana
// wire pairs a superconductor with a spin-orbit semiconductor, not two
// different main types), so this is now a closed catalog keyed by parent
// *name*: a pair with no entry below simply can't be fused, same-type or
// not, rather than falling back to a generic type-derived result. Not
// exhaustive over every possible pair on purpose, same reasoning as the
// table's predecessor -- inventing an arbitrary result for a pair with no
// real-world grounding isn't the goal. Every `result` is a real
// WORLD_CRYSTALS entry (most live in World 10, see that pool's own comment),
// reused as-is rather than duplicated, so a hybrid a player fuses and the
// same hybrid encountered wild are the exact same crystal.
function namedResult(name: string): Material {
  const found = findMaterialByName(name);
  if (!found) throw new Error(`HYBRID_RECIPES: no WORLD_CRYSTALS entry named "${name}"`);
  return found;
}

const HYBRID_RECIPES: { parents: [string, string]; result: Material }[] = [
  // Real Majorana-wire platforms pair a superconductor with a strong
  // spin-orbit semiconductor, not two superconductors -- Aluminum/InAs is
  // the actual Copenhagen/Delft platform.
  { parents: ['Aluminum', 'Indium Arsenide'], result: namedResult('InAs/Al Majorana Wire') },
  // Magic-angle twisted bilayer graphene's flagship result is unconventional
  // superconductivity (Cao et al. 2018) -- a same-type (trivial + trivial)
  // fusion, deliberately allowed here since a named recipe covers it.
  { parents: ['Graphene', 'Graphene'], result: namedResult('Twisted Bilayer Graphene') },
  { parents: ['Chromium Triiodide', 'Niobium Diselenide'], result: namedResult('CrI₃/NbSe₂ Topological-SC Heterostructure') },
  // Cr doped into an undoped topological-insulator host breaks time-reversal
  // symmetry and induces the quantum anomalous Hall effect -- the actual
  // mechanism the compound's own name describes, unlike MnBi₂Te₄'s intrinsic
  // (undoped) magnetism above.
  { parents: ['Chromium', 'Bi₂Te₃'], result: namedResult('Cr-doped (Bi,Sb)₂Te₃') },
  // Literalizes the mechanic's own original worked example -- Fe chains on
  // Pb (Nadj-Perge et al. 2014) already exists as an ordinary world-5 wild;
  // this just makes it reachable by fusion too.
  { parents: ['Iron', 'Lead'], result: namedResult('Fe/Pb Majorana Chain') },
  // Twisted CrI₃'s multiferroicity (electromagnons from noncollinear moiré
  // spin textures) is a theoretical proposal, not yet an established
  // experimental result -- see materialdex.ts's blurb for the honest framing.
  { parents: ['Chromium Triiodide', 'Chromium Triiodide'], result: namedResult('Twisted CrI₃') },
  // Fuses the untwisted 2H (semiconducting) monolayer into the *existing*
  // Twisted Bilayer MoTe₂ qhe entry rather than a second, redundant result --
  // that entry's own "zero-field fractional quantum Hall from topological
  // flat bands" already *is* the fractional Chern insulator state.
  { parents: ['Monolayer MoTe₂ (2H)', 'Monolayer MoTe₂ (2H)'], result: namedResult('Twisted Bilayer MoTe₂') },
  // Kezilebieke et al., Nature 588, 424 (2020) -- CrBr₃/NbSe₂ topological
  // superconductivity with chiral Majorana edge modes.
  { parents: ['Niobium Diselenide', 'Chromium Tribromide'], result: namedResult('NbSe₂/CrBr₃ Topological-SC Heterostructure') },
  { parents: ['Tantalum Disulfide (1T)', 'Tantalum Disulfide (1H)'], result: namedResult('1T/1H-TaS₂ Heterostructure') },
];

// The recipe result for fusing two named materials, or `undefined` if that
// pair (in either order, same-name pairs included) has no authored recipe --
// Majorana's panel calls this to decide which defeated-material pairs to
// even offer, not just to resolve one the player already picked.
export function hybridRecipeResult(nameA: string, nameB: string): Material | undefined {
  const recipe = HYBRID_RECIPES.find(
    (r) => (r.parents[0] === nameA && r.parents[1] === nameB) || (r.parents[0] === nameB && r.parents[1] === nameA)
  );
  return recipe?.result;
}

// Every name any HYBRID_RECIPES entry produces -- Dresselhaus's
// transmutation panel excludes all of these (his gift is a single crystal's
// own spin-orbit texture, not a fused state), even for the ones that are
// also ordinary wild encounters.
const HYBRID_RESULT_NAMES = new Set(HYBRID_RECIPES.map((r) => r.result.name));

// True for a HYBRID_RECIPES fusion result -- Dresselhaus, Majorana, and
// Anderson all exclude these identically: none of the three mechanics is
// about becoming/reusing an already-fused state.
export function isHybridMaterial(name: string): boolean {
  return HYBRID_RESULT_NAMES.has(name);
}

// Fuses two materials with an authored recipe (checked via
// `hybridRecipeResult` -- callers must not call this for an unrecognized
// pair, this doesn't re-validate) into that recipe's named result. Unlike
// the old type-derived hybrid, the result's own name/type/maxHp/moves are
// all authored on its WORLD_CRYSTALS entry, not computed here -- this
// function's job is just attaching `hybridParents` (so the fused crystal
// still renders as an actual visual mixture of both parents, per DESIGN.md's
// "player-created hybrid" note), sorted the same order-independent way the
// lookup above is, so picking Aluminum-then-InAs and InAs-then-Aluminum
// render identically.
export function combineMaterials(a: Material, b: Material): Material {
  const result = hybridRecipeResult(a.name, b.name);
  if (!result) throw new Error(`combineMaterials: no recipe for "${a.name}" + "${b.name}"`);
  const [first, second] = [a, b].sort((x, y) => x.name.localeCompare(y.name));
  return {
    ...result,
    hybridParents: {
      colorA: first.color,
      variantA: first.variant,
      colorB: second.color,
      variantB: second.variant,
    },
  };
}

// Named after the lecture topic each world actually teaches (the numbered
// table in the repo's top-level CLAUDE.md), not generic fantasy-RPG
// terrain -- a player should be able to tell which course topic a world
// covers just from its name.
export const WORLD_NAMES: Partial<Record<number, string>> = {
  1: 'Mean-Field Meadow',
  2: 'Bloch Caverns',
  3: 'Topological Islands',
  4: 'Landau Level Terrain',
  5: 'Frozen Zero-Resistance Caverns',
  6: 'Magnon Plains',
  7: 'Tensor-Network World',
  8: 'Spinon Forest',
  9: 'Defect Wastes',
  10: 'The Adaptive Meta-World',
};

export function getWildPool(world: number): Material[] {
  return WORLD_CRYSTALS[world] ?? [];
}
