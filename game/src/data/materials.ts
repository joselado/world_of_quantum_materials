import { shade } from '../art/colors';
import type { Material, Move, MoveClass, MaterialType, CrystalVariant, Stats } from './types';

// Every move is named after the quasiparticle/excitation that actually
// carries it, not an abstract "class" label -- Phonon Beam is a beam of
// phonons, Magnon Pulse a pulse of magnons, and so on. `id` and `class`
// still mirror ../../../data/materials.json's moves/typeChart (both are
// small enough now to keep 1:1 rather than a "small subset"); only the
// display `name` is quasiparticle-themed. Every entry here is a real
// quasiparticle -- there's deliberately no "impurity scattering" move, since
// disorder/impurities aren't a particle a crystal emits (see
// MOVE_COMPATIBILITY below for which of these each material can actually
// host).
export const MOVES: Record<string, Move> = {
  tunnelStrike: { id: 'tunnelStrike', name: 'Electron Pulse', class: 'trivial', power: 8 },
  magneticField: { id: 'magneticField', name: 'Magnon Pulse', class: 'magnetic', power: 8 },
  thermalFluctuation: {
    id: 'thermalFluctuation',
    name: 'Phonon Beam',
    class: 'thermal',
    power: 9,
  },
  localizationPin: { id: 'localizationPin', name: 'Polaron Drag', class: 'localization', power: 7 },
  fluxTwist: { id: 'fluxTwist', name: 'Anyon Braid', class: 'gauge', power: 7 },
  entanglementSwap: { id: 'entanglementSwap', name: 'Spinon Swap', class: 'entanglement', power: 8 },
  decoherenceWave: { id: 'decoherenceWave', name: 'Majorana Split', class: 'decoherence', power: 8 },
};

// Every move Noether can eventually teach, priced by raw power
// (`OverworldScene.shopCost`) -- everything except the player's starting
// Phonon Beam. What actually shows up in her shop (and what actually
// appears as a battle button) is this list filtered down to
// `compatibleMoves(currentPlayerForm)`, so a trivial-type player is only
// ever offered Electron Pulse until they transmute into a form whose
// physics supports the rest (see MOVE_COMPATIBILITY/compatibleMoves).
export const SHOP_MOVE_IDS = Object.keys(MOVES).filter((id) => id !== 'thermalFluctuation');

// Which quasiparticle classes a given main type can physically host --
// Phonon Beam (thermal) is on every list since every crystal has a lattice,
// but e.g. Magnon Pulse only appears for types with actual magnetic order
// (magnet, classicalmag), never for a plain band insulator/semiconductor
// like Silicon. This is what makes "Si doesn't have magnons" a rule the
// game enforces, not just flavor text -- both the battle move list
// (getBattleMoves) and Noether's shop filter through this.
const MOVE_COMPATIBILITY: Record<MaterialType, MoveClass[]> = {
  trivial: ['trivial', 'thermal'],
  magnet: ['magnetic', 'thermal'],
  topological: ['gauge', 'trivial', 'thermal', 'decoherence'],
  qhe: ['gauge', 'trivial', 'thermal'],
  supercon: ['localization', 'decoherence', 'thermal', 'trivial'],
  classicalmag: ['magnetic', 'thermal'],
  tensornet: ['entanglement', 'thermal', 'localization'],
  spinliquid: ['entanglement', 'thermal', 'localization'],
  defect: ['localization', 'decoherence', 'thermal'],
  adaptive: ['trivial', 'magnetic', 'thermal', 'localization', 'gauge', 'entanglement', 'decoherence'],
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
// BattleScene.resolveHit's "quasiparticle mismatch" damage rule: a defender
// with no natural channel for a quasiparticle (e.g. a plain band insulator
// hit by a magnon pulse, having no magnetic order to carry/damp it at all)
// takes that hit at double force, on top of whatever TYPE_CHART's
// effectiveness() already says for that class/type pair.
export function canHost(type: MaterialType, moveClass: MoveClass): boolean {
  return MOVE_COMPATIBILITY[type].includes(moveClass);
}

const TYPE_CHART: Partial<Record<MoveClass, Partial<Record<MaterialType, number>>>> = {
  magnetic: { trivial: 1.5, supercon: 1.5, topological: 0.5 },
  thermal: { magnet: 1.5, classicalmag: 1.5, spinliquid: 0.5 },
  localization: { spinliquid: 1.5, supercon: 0.5, topological: 0.5 },
  gauge: { qhe: 1.5 },
  entanglement: { tensornet: 1.5, trivial: 0.5 },
  decoherence: { classicalmag: 0.5 },
};

export function effectiveness(moveClass: MoveClass, defenderType: MaterialType): number {
  return TYPE_CHART[moveClass]?.[defenderType] ?? 1.0;
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
// purchases (statUpgradeCost), matching the pace mentors sell stat upgrades
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

// Minimal structural type (mirrors data/save.ts's RegistryLike) so this
// stays a plain data module -- any object with `.get` works, in practice
// the real Phaser registry.
interface RegistryLike {
  get: (key: string) => unknown;
}

export function getPlayerStats(registry: RegistryLike): Stats {
  return (registry.get('playerStats') as Stats) ?? DEFAULT_STATS;
}

// The player's current crystal form -- Silicon by default, or whatever Bohr
// transmuted them into (§5, `OverworldScene.transmuteInto`). Every scene
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
export function getBattleMoves(registry: RegistryLike): string[] {
  const unlocked = (registry.get('unlockedMoves') as string[]) ?? [...PLAYER_MATERIAL.moves];
  const allowed = new Set(compatibleMoves(getPlayerMaterial(registry)));
  return unlocked.filter((id) => allowed.has(id));
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
  tensornet: { color: 0x9a6ad9, variant: 'prism' },
  spinliquid: { color: 0x5ad9c9, variant: 'cluster' },
  defect: { color: 0xe0527a, variant: 'shard' },
  adaptive: { color: 0x333333, variant: 'prism' },
};

// A crystal database row: real compound name + main type (which fixes its
// look and its type-chart matchups) + battle stats. `shadeStep` just
// separates same-type siblings visually (e.g. Iron vs. Cobalt) using
// TYPE_LOOK's base color.
function crystal(
  name: string,
  type: MaterialType,
  maxHp: number,
  moves: string[],
  shadeStep = 0
): Material {
  const look = TYPE_LOOK[type];
  return { name, type, color: shade(look.color, shadeStep * 18), variant: look.variant, maxHp, moves };
}

// Per-world (course-topic) wild-crystal pools, keyed by world number --
// matches the "Wild material archetypes" column of the world table in
// DESIGN.md, drawn from the fuller candidate list in that doc's "Crystal
// database" section. Each scene pulls its own world's pool via
// `getWildPool()` rather than sharing one global list, so later worlds can
// each have their own specials without touching the encounter logic.
// World 10 has no entry: its only encounter is the adaptive final boss.
// Every moveset below is drawn only from MOVE_COMPATIBILITY[type] -- e.g.
// trivial crystals (Si, GaN, MgO, Graphene) only ever get Electron Pulse and
// Phonon Beam, never Magnon Pulse, since a plain band insulator has no
// magnetic order to carry one.
export const WORLD_CRYSTALS: Partial<Record<number, Material[]>> = {
  1: [
    crystal('Graphene', 'trivial', 22, ['tunnelStrike', 'thermalFluctuation']),
    crystal('Manganese Oxide', 'magnet', 26, ['thermalFluctuation', 'magneticField']),
    crystal('Nickel Oxide', 'magnet', 25, ['thermalFluctuation', 'magneticField'], 1),
  ],
  // Topic 2 (symmetries, tight-binding) has no dedicated main type of its
  // own in the type system -- it stays at the trivial baseline, just with
  // "lattice" flavor compounds instead of world 1's tutorial picks.
  2: [
    crystal('Graphene', 'trivial', 22, ['tunnelStrike', 'thermalFluctuation']),
    crystal('Gallium Nitride', 'trivial', 23, ['tunnelStrike', 'thermalFluctuation'], 1),
    crystal('Magnesium Oxide', 'trivial', 21, ['thermalFluctuation', 'tunnelStrike'], 2),
  ],
  3: [
    crystal('Cr-doped (Bi,Sb)₂Te₃', 'topological', 24, ['fluxTwist', 'decoherenceWave']),
    crystal('Tantalum Arsenide', 'topological', 26, ['fluxTwist', 'tunnelStrike'], 1),
    crystal('Monolayer WTe₂', 'topological', 23, ['fluxTwist', 'thermalFluctuation'], 2),
  ],
  4: [
    crystal('Gallium Arsenide', 'qhe', 25, ['fluxTwist', 'tunnelStrike']),
    crystal('Graphene (strong field)', 'qhe', 24, ['fluxTwist', 'thermalFluctuation'], 1),
    crystal('Twisted Bilayer MoTe₂', 'qhe', 26, ['fluxTwist', 'thermalFluctuation'], 2),
  ],
  5: [
    crystal('Aluminum', 'supercon', 28, ['localizationPin', 'thermalFluctuation']),
    crystal('Lead', 'supercon', 30, ['localizationPin', 'thermalFluctuation'], 1),
    crystal('YBCO', 'supercon', 27, ['localizationPin', 'thermalFluctuation'], 2),
    crystal('Fe/Pb Majorana Chain', 'supercon', 29, ['localizationPin', 'decoherenceWave'], 3),
  ],
  6: [
    crystal('Iron', 'classicalmag', 27, ['thermalFluctuation', 'magneticField']),
    crystal('Cobalt', 'classicalmag', 27, ['thermalFluctuation', 'magneticField'], 1),
    crystal('Chromium Triiodide', 'classicalmag', 25, ['thermalFluctuation', 'magneticField'], 2),
  ],
  7: [
    crystal('Herbertsmithite', 'tensornet', 23, ['entanglementSwap', 'thermalFluctuation']),
    crystal('Strontium Copper Borate', 'tensornet', 24, ['entanglementSwap', 'localizationPin'], 1),
    crystal('Thallium Copper Chloride', 'tensornet', 22, ['entanglementSwap', 'thermalFluctuation'], 2),
  ],
  8: [
    crystal('α-Ruthenium Trichloride', 'spinliquid', 24, ['entanglementSwap', 'localizationPin']),
    crystal('Herbertsmithite', 'spinliquid', 23, ['entanglementSwap', 'localizationPin'], 1),
    crystal('YbMgGaO₄', 'spinliquid', 22, ['entanglementSwap', 'thermalFluctuation'], 2),
  ],
  9: [
    crystal('NV-Diamond', 'defect', 20, ['localizationPin', 'thermalFluctuation']),
    crystal('Fe(Te,Se)', 'defect', 22, ['localizationPin', 'decoherenceWave'], 1),
    crystal('Niobium Diselenide', 'defect', 21, ['localizationPin', 'thermalFluctuation'], 2),
  ],
};

// The single "beat this to unlock the mentor and the way onward" gate per
// world (DESIGN.md's world table, "Gate to next world" column) -- distinct
// from WORLD_CRYSTALS' ordinary wild encounters, which never block
// progress. Worlds 1-2 are built so far (OverworldScene.showRivalEncounter
// falls back gracefully for a world with no entry here).
export const WORLD_RIVALS: Partial<Record<number, Material>> = {
  1: crystal('Rival Silicon', 'trivial', 34, ['thermalFluctuation', 'tunnelStrike'], 3),
  2: crystal('Rival Lattice Defect', 'trivial', 38, ['thermalFluctuation', 'tunnelStrike'], 4),
  3: crystal('Rival Edge State', 'topological', 42, ['fluxTwist', 'decoherenceWave'], 5),
  4: crystal('Rival Landau Level', 'qhe', 46, ['fluxTwist', 'tunnelStrike'], 6),
  5: crystal('Rival Cooper Pair', 'supercon', 50, ['localizationPin', 'decoherenceWave'], 7),
  6: crystal('Rival Domain Wall', 'classicalmag', 54, ['magneticField', 'thermalFluctuation'], 8),
  7: crystal('Rival Entangled Pair', 'tensornet', 58, ['entanglementSwap', 'localizationPin'], 9),
  8: crystal('Rival Spinon', 'spinliquid', 62, ['entanglementSwap', 'localizationPin'], 10),
  9: crystal('Rival Impurity Resonance', 'defect', 66, ['localizationPin', 'decoherenceWave'], 11),
  // The finale: no real compound (see DESIGN.md §5's plot hook), an
  // "adaptive" type that can host every quasiparticle class -- "a model of
  // you," drawing from the same move roster the player themselves has
  // access to by this point.
  10: crystal('The Adapted', 'adaptive', 80, ['tunnelStrike', 'magneticField', 'fluxTwist', 'decoherenceWave'], 12),
};

export function getRival(world: number): Material | undefined {
  return WORLD_RIVALS[world];
}

// Looked up by name for Bohr's transmutation panel (§5) -- searches every
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

export const WORLD_NAMES: Partial<Record<number, string>> = {
  1: 'Tutorial Meadow',
  2: 'Crystalline Caves',
  3: 'Floating Islands',
  4: 'Landau Terrain',
  5: 'Frozen Zero-Resistance Caverns',
  6: 'Windswept Plains',
  7: 'Network-Graph World',
  8: 'Foggy Forest',
  9: 'Cracked World',
  10: 'The Meta-World',
};

export function getWildPool(world: number): Material[] {
  return WORLD_CRYSTALS[world] ?? [];
}
