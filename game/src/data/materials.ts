import { shade } from '../art/colors';
import type { Material, Move, MoveClass, MaterialType, CrystalVariant } from './types';

// Every move is named after the quasiparticle/excitation that actually
// carries it, not an abstract "class" label -- Phonon Beam is a beam of
// phonons, Magnon Pulse a pulse of magnons, and so on. `id` and `class`
// still mirror ../../../data/materials.json's moves/typeChart (both are
// small enough now to keep 1:1 rather than a "small subset"); only the
// display `name` is quasiparticle-themed.
export const MOVES: Record<string, Move> = {
  disorderPulse: { id: 'disorderPulse', name: 'Impurity Scatter', class: 'disorder', power: 9 },
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

// Moves the player can buy from Noether (the world 1 mentor) with
// qumatokens, priced by raw power (see `OverworldScene.shopCost`). Kept
// here (not just inline in the scene) since it's roster/balance data, same
// as everything else in this file.
export const SHOP_MOVE_IDS = ['disorderPulse', 'tunnelStrike', 'magneticField'];

const TYPE_CHART: Partial<Record<MoveClass, Partial<Record<MaterialType, number>>>> = {
  disorder: { trivial: 1.5, magnet: 1.5, topological: 0.5 },
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
// rather than being indistinguishable.
const TYPE_LOOK: Record<MaterialType, { color: number; variant: CrystalVariant }> = {
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
export const WORLD_CRYSTALS: Partial<Record<number, Material[]>> = {
  1: [
    crystal('Graphene', 'trivial', 22, ['tunnelStrike', 'disorderPulse']),
    crystal('Manganese Oxide', 'magnet', 26, ['thermalFluctuation', 'magneticField']),
    crystal('Nickel Oxide', 'magnet', 25, ['thermalFluctuation', 'disorderPulse'], 1),
  ],
  // Topic 2 (symmetries, tight-binding) has no dedicated main type of its
  // own in the type system -- it stays at the trivial baseline, just with
  // "lattice" flavor compounds instead of world 1's tutorial picks.
  2: [
    crystal('Graphene', 'trivial', 22, ['tunnelStrike', 'disorderPulse']),
    crystal('Gallium Nitride', 'trivial', 23, ['tunnelStrike', 'disorderPulse'], 1),
    crystal('Magnesium Oxide', 'trivial', 21, ['disorderPulse', 'tunnelStrike'], 2),
  ],
  3: [
    crystal('Cr-doped (Bi,Sb)₂Te₃', 'topological', 24, ['fluxTwist', 'decoherenceWave']),
    crystal('Tantalum Arsenide', 'topological', 26, ['fluxTwist', 'disorderPulse'], 1),
    crystal('Monolayer WTe₂', 'topological', 23, ['fluxTwist', 'localizationPin'], 2),
  ],
  4: [
    crystal('Gallium Arsenide', 'qhe', 25, ['fluxTwist', 'magneticField']),
    crystal('Graphene (strong field)', 'qhe', 24, ['fluxTwist', 'disorderPulse'], 1),
    crystal('Twisted Bilayer MoTe₂', 'qhe', 26, ['fluxTwist', 'entanglementSwap'], 2),
  ],
  5: [
    crystal('Aluminum', 'supercon', 28, ['localizationPin', 'magneticField']),
    crystal('Lead', 'supercon', 30, ['localizationPin', 'magneticField'], 1),
    crystal('YBCO', 'supercon', 27, ['localizationPin', 'thermalFluctuation'], 2),
    crystal('Fe/Pb Majorana Chain', 'supercon', 29, ['localizationPin', 'decoherenceWave'], 3),
  ],
  6: [
    crystal('Iron', 'classicalmag', 27, ['thermalFluctuation', 'magneticField']),
    crystal('Cobalt', 'classicalmag', 27, ['thermalFluctuation', 'magneticField'], 1),
    crystal('Chromium Triiodide', 'classicalmag', 25, ['thermalFluctuation', 'fluxTwist'], 2),
  ],
  7: [
    crystal('Herbertsmithite', 'tensornet', 23, ['entanglementSwap', 'thermalFluctuation']),
    crystal('Strontium Copper Borate', 'tensornet', 24, ['entanglementSwap', 'localizationPin'], 1),
    crystal('Thallium Copper Chloride', 'tensornet', 22, ['entanglementSwap', 'thermalFluctuation'], 2),
  ],
  8: [
    crystal('α-Ruthenium Trichloride', 'spinliquid', 24, ['entanglementSwap', 'disorderPulse']),
    crystal('Herbertsmithite', 'spinliquid', 23, ['entanglementSwap', 'localizationPin'], 1),
    crystal('YbMgGaO₄', 'spinliquid', 22, ['entanglementSwap', 'thermalFluctuation'], 2),
  ],
  9: [
    crystal('NV-Diamond', 'defect', 20, ['localizationPin', 'disorderPulse']),
    crystal('Fe(Te,Se)', 'defect', 22, ['localizationPin', 'decoherenceWave'], 1),
    crystal('Niobium Diselenide', 'defect', 21, ['localizationPin', 'disorderPulse'], 2),
  ],
};

// The single "beat this to unlock the mentor and the way onward" gate per
// world (DESIGN.md's world table, "Gate to next world" column) -- distinct
// from WORLD_CRYSTALS' ordinary wild encounters, which never block
// progress. Only world 1 is built so far (OverworldScene.showRivalEncounter
// falls back gracefully for a world with no entry here).
export const WORLD_RIVALS: Partial<Record<number, Material>> = {
  1: crystal(
    'Rival Silicon',
    'trivial',
    34,
    ['thermalFluctuation', 'tunnelStrike', 'disorderPulse', 'magneticField'],
    3
  ),
};

export function getRival(world: number): Material | undefined {
  return WORLD_RIVALS[world];
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
