import { shade } from '../art/colors';
import type { Material, Move, MoveClass, MaterialType, CrystalVariant, Stats } from './types';

// Every move is named after the quasiparticle/excitation that actually
// carries it, not an abstract "class" label -- Phonon Beam is a beam of
// phonons, Magnon Pulse a pulse of magnons, and so on. `id` and `class`
// still mirror ../../../data/materials.json's moves; only the display `name`
// is quasiparticle-themed. Every entry here is a real quasiparticle --
// there's deliberately no "impurity scattering" move, since disorder/
// impurities aren't a particle a crystal emits (see MOVE_COMPATIBILITY below
// for which of these each material can actually host).
//
// Power climbs with how unconventional the underlying physics is -- an
// ordinary lattice vibration or band electron is weak, a topological/
// non-Abelian excitation is strong -- so every move a player buys from
// Noether outpowers the free starting Phonon Beam:
//   thermal (Phonon Beam, every crystal has a lattice) < trivial (Electron
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
    class: 'thermal',
    power: 6,
  },
  localizationPin: { id: 'localizationPin', name: 'Polaron Drag', class: 'localization', power: 9 },
  fluxTwist: { id: 'fluxTwist', name: 'Anyon Braid', class: 'gauge', power: 11 },
  entanglementSwap: { id: 'entanglementSwap', name: 'Spinon Swap', class: 'entanglement', power: 10 },
  decoherenceWave: { id: 'decoherenceWave', name: 'Majorana Split', class: 'decoherence', power: 11 },
  // Curie's analytic moves (§5, World 6) -- power sits below the other
  // exotic-tier moves since their real payoff is the answer-gated 2x/0.5x
  // multiplier BattleScene applies, not raw power. Never listed in any
  // material's `moves` array (wild/rival movesets) -- only the player can
  // ever be asked one of these questions.
  skyfallBeam: { id: 'skyfallBeam', name: 'Skyfall Beam', class: 'analytic', power: 10 },
  groundEruption: { id: 'groundEruption', name: 'Ground Eruption', class: 'analytic', power: 10 },
};

// Curie is the sole seller of analytic moves (OverworldScene.showCuriePanel,
// mirroring Noether's showNoetherShop) -- kept out of SHOP_MOVE_IDS so
// Noether's own shop never offers them too.
export const ANALYTIC_MOVE_IDS = Object.values(MOVES)
  .filter((m) => m.class === 'analytic')
  .map((m) => m.id);

// Every move Noether can eventually teach, priced by raw power
// (`OverworldScene.shopCost`) -- everything except the player's starting
// Phonon Beam and Curie's analytic moves (ANALYTIC_MOVE_IDS, sold only by
// her). What actually shows up in her shop (and what actually appears as a
// battle button) is this list filtered down to
// `compatibleMoves(currentPlayerForm)`, so a trivial-type player is only
// ever offered Electron Pulse until they transmute into a form whose
// physics supports the rest (see MOVE_COMPATIBILITY/compatibleMoves).
export const SHOP_MOVE_IDS = Object.keys(MOVES).filter(
  (id) => id !== 'thermalFluctuation' && !ANALYTIC_MOVE_IDS.includes(id)
);

// Which quasiparticle classes a given main type can physically host --
// Phonon Beam (thermal) is on every list since every crystal has a lattice,
// but e.g. Magnon Pulse only appears for types with actual magnetic order
// (magnet, classicalmag), never for a plain band insulator/semiconductor
// like Silicon. This is what makes "Si doesn't have magnons" a rule the
// game enforces, not just flavor text -- both the battle move list
// (getBattleMoves) and Noether's shop filter through this. 'analytic' is the
// one exception, on every list -- it's not a quasiparticle a crystal's own
// physics has to host, it's a technique the player themselves learned from
// Curie, so it's never mismatched and never gated by current form. Adding a
// new MoveClass here always means deciding this on purpose, not by
// omission: an analytic-style class left off every list would make its
// moves *always* mismatch (canHost) against every defender -- a silent 2x
// on top of whatever bonus BattleScene itself applies for that class, not a
// neutral default.
const MOVE_COMPATIBILITY: Record<MaterialType, MoveClass[]> = {
  trivial: ['trivial', 'thermal', 'analytic'],
  magnet: ['magnetic', 'thermal', 'analytic'],
  topological: ['gauge', 'trivial', 'thermal', 'decoherence', 'analytic'],
  qhe: ['gauge', 'trivial', 'thermal', 'analytic'],
  supercon: ['localization', 'decoherence', 'thermal', 'trivial', 'analytic'],
  classicalmag: ['magnetic', 'thermal', 'analytic'],
  tensornet: ['entanglement', 'thermal', 'localization', 'analytic'],
  spinliquid: ['entanglement', 'thermal', 'localization', 'analytic'],
  defect: ['localization', 'decoherence', 'thermal', 'analytic'],
  adaptive: ['trivial', 'magnetic', 'thermal', 'localization', 'gauge', 'entanglement', 'decoherence', 'analytic'],
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
// damp it at all) takes that hit at double force. Thermal (Phonon Beam) is
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
// World 10 is the one exception to "named after a real compound" (see the
// 'Echo of ...' pool below it): its wilds are deliberately not real
// materials, matching the meta-world's own "reflects the player's journey
// back at them" theme, same reasoning as the world-10 boss itself.
// Every moveset below is drawn only from MOVE_COMPATIBILITY[type] -- e.g.
// trivial crystals (Si, GaN, MgO, Graphene) only ever get Electron Pulse and
// Phonon Beam, never Magnon Pulse, since a plain band insulator has no
// magnetic order to carry one.
export const WORLD_CRYSTALS: Partial<Record<number, Material[]>> = {
  1: [
    crystal('Graphene', 'trivial', 22, ['tunnelStrike', 'thermalFluctuation'], 0, 'layer'),
    crystal('Manganese Oxide', 'magnet', 26, ['thermalFluctuation', 'magneticField']),
    crystal('Nickel Oxide', 'magnet', 25, ['thermalFluctuation', 'magneticField'], 1),
  ],
  // Topic 2 (symmetries, tight-binding) has no dedicated main type of its
  // own in the type system -- it stays at the trivial baseline, just with
  // "lattice" flavor compounds instead of world 1's tutorial picks.
  2: [
    crystal('Graphene', 'trivial', 22, ['tunnelStrike', 'thermalFluctuation'], 0, 'layer'),
    crystal('Gallium Nitride', 'trivial', 23, ['tunnelStrike', 'thermalFluctuation'], 1),
    crystal('Magnesium Oxide', 'trivial', 21, ['thermalFluctuation', 'tunnelStrike'], 2),
  ],
  3: [
    crystal('Cr-doped (Bi,Sb)₂Te₃', 'topological', 24, ['fluxTwist', 'decoherenceWave']),
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
  ],
  6: [
    crystal('Iron', 'classicalmag', 27, ['thermalFluctuation', 'magneticField']),
    crystal('Cobalt', 'classicalmag', 27, ['thermalFluctuation', 'magneticField'], 1),
    crystal('Chromium Triiodide', 'classicalmag', 25, ['thermalFluctuation', 'magneticField'], 2, 'layer'),
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
  // The meta-world's wilds are echoes of earlier phases of matter rather
  // than new real compounds -- 'adaptive' type, same as the world-10 boss,
  // each one recalling a different earlier world's moveset so the corridor
  // itself reads as "your own journey played back at you" before the boss
  // at the goal does the same thing at full scale.
  10: [
    crystal('Echo of the Meadow', 'adaptive', 30, ['tunnelStrike', 'thermalFluctuation']),
    crystal('Echo of the Islands', 'adaptive', 32, ['fluxTwist', 'decoherenceWave'], 1),
    crystal('Echo of the Caverns', 'adaptive', 31, ['localizationPin', 'decoherenceWave'], 2),
    crystal('Echo of the Network', 'adaptive', 30, ['entanglementSwap', 'magneticField'], 3),
  ],
};

// The single "beat this to unlock the mentor and the way onward" gate per
// world (DESIGN.md's world table, "Gate to next world" column) -- distinct
// from WORLD_CRYSTALS' ordinary wild encounters, which never block
// progress. Worlds 1-2 are built so far (OverworldScene.showRivalEncounter
// falls back gracefully for a world with no entry here).
export const WORLD_RIVALS: Partial<Record<number, Material>> = {
  1: crystal('Rival Silicon', 'trivial', 34, ['thermalFluctuation', 'tunnelStrike'], 3),
  // Renamed from 'Rival Lattice Defect' -- defects are world 9's topic, not
  // world 2's (symmetries, Bloch's theorem, tight-binding). A Bloch wave is
  // the actual object world 2's lecture builds toward.
  2: crystal('Rival Bloch Wave', 'trivial', 38, ['thermalFluctuation', 'tunnelStrike'], 4),
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

// Averages each color channel of two crystal colors -- used to give a
// player-created hybrid a look that visually blends its two parents rather
// than just inheriting one type's flat TYPE_LOOK color.
function blendColor(a: number, b: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (Math.round((ar + br) / 2) << 16) | (Math.round((ag + bg) / 2) << 8) | Math.round((ab + bb) / 2);
}

// Majorana's hybridization mechanic (§5): fuse two materials the player has
// already defeated into a new state -- but only specific, physically
// sensible type pairings, not any two defeated crystals. Two materials of
// the *same* main type never combine (fusing two superconductors isn't a
// new phase, it's just a bigger superconductor) -- every entry below is an
// unordered pair of *different* types. Each pairing here mirrors a real
// engineered platform DESIGN.md §3's crystal database already names
// (magnet/classicalmag + supercon -> topological superconductor, the
// Fe/Pb-chain/NbSe2-CrBr3-heterostructure mechanism and the mechanic's own
// worked example; magnet/classicalmag + qhe -> the same "add magnetism to a
// quantum-Hall-family state" route the quantum anomalous Hall effect takes;
// topological + supercon or topological + qhe -> still topological, since
// both inputs are already in that family). Not exhaustive over all 10
// types on purpose -- combining e.g. a spin liquid with a defect state has
// no equally concrete real-world hybrid to point to yet, so it's left out
// rather than inventing an arbitrary result.
const HYBRID_RULES: { types: [MaterialType, MaterialType]; result: MaterialType }[] = [
  { types: ['magnet', 'supercon'], result: 'topological' },
  { types: ['classicalmag', 'supercon'], result: 'topological' },
  { types: ['topological', 'supercon'], result: 'topological' },
  { types: ['magnet', 'qhe'], result: 'topological' },
  { types: ['classicalmag', 'qhe'], result: 'topological' },
  { types: ['topological', 'qhe'], result: 'topological' },
];

// The result type for combining two main types, or `undefined` if that pair
// (in either order) isn't a recognized hybrid -- includes same-type pairs,
// which are never valid (see HYBRID_RULES' comment). Majorana's panel calls
// this to decide which defeated-material pairs to even offer, not just to
// resolve one the player already picked.
export function hybridResultType(typeA: MaterialType, typeB: MaterialType): MaterialType | undefined {
  if (typeA === typeB) return undefined;
  const rule = HYBRID_RULES.find(
    (r) => (r.types[0] === typeA && r.types[1] === typeB) || (r.types[0] === typeB && r.types[1] === typeA)
  );
  return rule?.result;
}

// Fuses two materials whose types are a recognized pairing (checked via
// `hybridResultType` -- callers must not call this for an invalid pair,
// this doesn't re-validate) into a new hybrid `Material`. maxHp scales off
// max(a, b), not avg(a, b), so a hybrid is never a downgrade from its
// stronger parent -- "multiplies your attributes by 1.5" should never read
// as a trap. Not looked up by findMaterialByName (that only searches
// WORLD_CRYSTALS, real compounds) -- callers must set playerForm to the
// returned object directly, the same way OverworldScene.transmuteInto sets
// it for an ordinary crystal.
export function combineMaterials(a: Material, b: Material): Material {
  const resultType = hybridResultType(a.type, b.type);
  // Sorted so picking Aluminum-then-Lead and Lead-then-Aluminum name (and
  // therefore dedupe against) the same hybrid, regardless of pick order.
  const [first, second] = [a, b].sort((x, y) => x.name.localeCompare(y.name));
  return {
    name: `${first.name} × ${second.name}`,
    type: resultType ?? 'topological',
    color: blendColor(a.color, b.color),
    variant: TYPE_LOOK[resultType ?? 'topological'].variant,
    maxHp: Math.round(Math.max(a.maxHp, b.maxHp) * 1.5),
    moves: Array.from(new Set([...a.moves, ...b.moves])),
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
