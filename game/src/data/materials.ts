import { shade, darken, blend, hueShift } from '../art/colors';
import type { Material, Move, MoveClass, MaterialType, CrystalVariant, Stats } from './types';
// Every pure stat/economy formula (BASE_STAT, enemyStatsForWorld,
// statUpgradeCost, shopCost, Feynman's move-leveling multipliers/cost) lives
// in balance.ts, kept Phaser-free so game/scripts/balance-sim.mjs can load it
// directly -- imported here for this file's own internal use, then
// re-exported below so every existing `import { shopCost, ... } from
// '../data/materials'` call site keeps working unchanged.
import {
  BASE_STAT,
  MAX_STAT,
  DEFAULT_STATS,
  enemyStatsForWorld,
  statUpgradeCost,
  shopCost,
  MOVE_LEVEL_MULTIPLIERS,
  MOVE_LEVEL_STREAKS,
  feynmanLevelCost,
} from './balance';
export { BASE_STAT, MAX_STAT, DEFAULT_STATS, enemyStatsForWorld, statUpgradeCost, shopCost, MOVE_LEVEL_MULTIPLIERS, MOVE_LEVEL_STREAKS, feynmanLevelCost };

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
// class's own comment below). Landau's Analytic moves (skyfallBeam/
// groundEruption below) and Skłodowska-Curie's Ultimate moves
// (ultimateMeteor/ultimateNova) each name a quasiparticle like any other
// move too, but a dynamic one -- `tunedMoveDisplayName` renders each as
// "<quasiparticle> Lance"/"<quasiparticle> Eruption"/"<quasiparticle>
// Meteor"/"<quasiparticle> Nova", the quasiparticle word being whichever
// class the player has tuned it to via the owning guardian's picker
// (default 'phonon', so e.g. "Phonon Lance" until tuned). Their static `name`
// below is just that default. skyfallBeam's own display name reads "Lance,"
// not "Beam," so it never collides with thermalFluctuation's own static
// "Phonon Beam" (the free starting move) once both default to 'phonon'.
//
// Power climbs with how unconventional the underlying physics is -- an
// ordinary lattice vibration or band electron is weak, a topological/
// non-Abelian excitation is strong -- so every move a player buys from
// Noether outpowers the free starting Phonon Beam. Six tiers, matching
// `data/TAXONOMY.txt`'s own quasiparticle roster:
//   6  phonon (Phonon Beam) -- every crystal has a lattice
//   7  electron (Electron Pulse) -- an ordinary band electron
//   8  magnon (Magnon Pulse) / plasmon (Plasmon Pulse) / ferron (Ferron
//      Pulse) -- tied: an ordinary collective mode of a magnet, a metal, or
//      a ferroelectric respectively, none more exotic than the others
//   9  electromagnon (Electromagnon Pulse) /
//      triplon (Triplon Surge) -- tied: a lattice-dressed carrier, a
//      magnon-phonon hybrid, and a dimer magnet's own confined triplet mode
//   10 spinon (Spinon Swap) / vison (Vison Loop) / chiral (Chiral Current) /
//      helical (Helical Current) / higgs (Higgs Oscillation) / heavyFermion
//      (Heavy Fermion Pulse) -- tied: fractionalized or topologically
//      protected, but none of them non-Abelian
//   11 chargedAnyon (Anyon Braid) / majorana (Majorana Split) -- tied for
//      the most exotic tier the course covers: fractional braiding
//      statistics and non-Abelian zero modes
export const MOVES: Record<string, Move> = {
  tunnelStrike: { id: 'tunnelStrike', name: 'Electron Pulse', class: 'electron', power: 7 },
  magneticField: { id: 'magneticField', name: 'Magnon Pulse', class: 'magnon', power: 8 },
  thermalFluctuation: {
    id: 'thermalFluctuation',
    name: 'Phonon Beam',
    class: 'phonon',
    power: 6,
  },
  // 'chargedAnyon' rather than a generic topological/edge class -- braiding
  // fractional-charge excitations is specifically a fractional-Chern-state
  // phenomenon, not something an ordinary (non-fractionalized) chiral or
  // helical edge channel does.
  fluxTwist: { id: 'fluxTwist', name: 'Anyon Braid', class: 'chargedAnyon', power: 11 },
  entanglementSwap: { id: 'entanglementSwap', name: 'Spinon Swap', class: 'spinon', power: 10 },
  decoherenceWave: { id: 'decoherenceWave', name: 'Majorana Split', class: 'majorana', power: 11 },
  // A metal's own collective charge oscillation -- session 9's RPA treatment
  // names this "a new quasiparticle" in exactly those words. Only 'metal'
  // hosts it today.
  plasmonPulse: { id: 'plasmonPulse', name: 'Plasmon Pulse', class: 'plasmon', power: 8 },
  // A dimer/valence-bond quantum paramagnet's own confined S=1 mode --
  // distinct from (and conceptually the opposite of) spinon's
  // fractionalization, but both live on 'quantumSpinLiquid' (see that
  // type's own comment in types.ts).
  triplonSurge: { id: 'triplonSurge', name: 'Triplon Surge', class: 'triplon', power: 9 },
  // One-way, no-backscattering edge/surface current -- a Chern band's own
  // signature, time-reversal broken.
  chiralCurrent: { id: 'chiralCurrent', name: 'Chiral Current', class: 'chiral', power: 10 },
  // Counter-propagating, spin-momentum-locked edge/surface pair -- a Kramers
  // pair, protected by time reversal rather than by broken symmetry.
  helicalCurrent: { id: 'helicalCurrent', name: 'Helical Current', class: 'helical', power: 10 },
  // The amplitude mode of an ordered/paired condensate -- needs genuine
  // long-range order (Cooper pairing here), not just a gap.
  higgsOscillation: { id: 'higgsOscillation', name: 'Higgs Oscillation', class: 'higgs', power: 10 },
  // The Kondo-lattice hybridization quasiparticle -- a conduction electron
  // mass-renormalized by entangling with a local f-moment.
  heavyFermionPulse: { id: 'heavyFermionPulse', name: 'Heavy Fermion Pulse', class: 'heavyFermion', power: 10 },
  // The polarization order parameter's own quantum -- the ferroelectric
  // analog of a magnon, distinct from electromagnon (which needs magnetic
  // order to hybridize with in the first place).
  ferronPulse: { id: 'ferronPulse', name: 'Ferron Pulse', class: 'ferron', power: 8 },
  // A Z2 gauge-flux (vortex) excitation -- spinon's topological-order
  // companion in a Z2 quantum spin liquid.
  visonLoop: { id: 'visonLoop', name: 'Vison Loop', class: 'vison', power: 10 },

  // The golems' own moves (GOLEM_MOVE_IDS below). Same quasiparticle class
  // and same power as the move each one corrupts, so nothing about the
  // type-interaction rule or the damage curve changes: what a rival throws
  // is still its world's own excitation, and still lands double on a
  // defender whose physics cannot host that class. What changed is the
  // excitation itself. A golem's coherence was ground out of it, and the
  // quasiparticle it carries came out the other side decohered, which is
  // why it is named for what it used to be. Opponent-only, in the same way
  // Analytic and Ultimate moves are player-only: no shop sells these and no
  // wild crystal carries one.
  decoheredMagnon: { id: 'decoheredMagnon', name: 'Decohered Magnon Pulse', class: 'magnon', power: 8 },
  decoheredSpinon: { id: 'decoheredSpinon', name: 'Decohered Spinon Swap', class: 'spinon', power: 10 },
  decoheredTriplon: { id: 'decoheredTriplon', name: 'Decohered Triplon Surge', class: 'triplon', power: 9 },
  decoheredChiral: { id: 'decoheredChiral', name: 'Decohered Chiral Current', class: 'chiral', power: 10 },
  decoheredHelical: { id: 'decoheredHelical', name: 'Decohered Helical Current', class: 'helical', power: 10 },
  decoheredHiggs: { id: 'decoheredHiggs', name: 'Decohered Higgs Oscillation', class: 'higgs', power: 10 },
  decoheredVison: { id: 'decoheredVison', name: 'Decohered Vison Loop', class: 'vison', power: 10 },
  // Landau's quiz-gated Analytic moves (§5, World 4, ANALYTIC_MOVE_IDS
  // below) -- power sits below the other exotic-tier moves since their real
  // payoff is the answer-gated 2x/0.5x multiplier BattleScene applies, not
  // raw power. Never listed in any material's `moves` array (wild/rival
  // movesets) -- only the player can ever be asked one of these questions,
  // and an opponent using one would bypass the quiz gate entirely (it lives
  // in the player-only move-menu click handler, not the damage formula).
  // Each starts at the universal 'phonon' class (so it's usable/
  // never-mismatched before the player ever tunes it) -- Landau's picker
  // (TUNABLE_MOVE_CLASSES, getTunedMoveClass) lets the player assign it any
  // quasiparticle their current form hosts instead.
  skyfallBeam: { id: 'skyfallBeam', name: 'Phonon Lance', class: 'phonon', power: 10 },
  groundEruption: { id: 'groundEruption', name: 'Phonon Eruption', class: 'phonon', power: 10 },
  // Skłodowska-Curie's Ultimate moves (§5, World 10, ULTIMATE_MOVE_IDS
  // below) -- power is 10x an Analytic move's (100 vs 10), well above every
  // other move in the game, matching the "ultimate" framing; the payoff for
  // that power is a binary 3-questions-in-a-row gate (any wrong answer
  // whiffs for 0 damage) rather than Analytic's continuous 2x/0.5x
  // multiplier. Never listed in any material's `moves` array, same reasoning
  // as skyfallBeam/groundEruption above -- only the player can ever use one.
  // Priced completely differently from every other move too: not via
  // shopCost, but a flat 1000-qumatessence unlock per (move, quasiparticle
  // class) pair (ULTIMATE_CLASS_UNLOCK_COST, Skłodowska-Curie's own panel).
  // 'phonon' as the default class for the same always-hostable reason as
  // skyfallBeam/groundEruption above.
  ultimateMeteor: { id: 'ultimateMeteor', name: 'Phonon Meteor', class: 'phonon', power: 100 },
  ultimateNova: { id: 'ultimateNova', name: 'Phonon Nova', class: 'phonon', power: 100 },
  // The multiferroic type's signature quasiparticle -- a spin wave that
  // picks up electric-dipole activity through magnon-phonon hybridization
  // (the magnetoelectric coupling itself), sitting alongside ordinary
  // magnons rather than replacing them (MOVE_COMPATIBILITY still grants
  // multiferroics 'magnon' too).
  electromagnonPulse: { id: 'electromagnonPulse', name: 'Electromagnon Pulse', class: 'electromagnon', power: 9 },
  // Kondo's three moves (§5, World 8) -- self-buffs, not attacks: casting
  // one applies a 3-turn buff to the caster's own side (BattleScene's
  // resolveSelfBuff) instead of dealing damage, so `power` here is never
  // read as damage -- it only feeds shopCost, the same pricing role it
  // plays for every other move. Never listed in any wild/rival material's
  // `moves` array -- only the player can currently learn them, and only
  // one of the three is ever active in battle at a time (registry/save
  // `kondoActiveMove`, switched only by talking to Kondo again --
  // OverworldScene.showKondoPanel/getBattleMoves). Named generically rather
  // than after the specific heavy-fermion/Kondo-lattice physics that
  // inspired them, since a self-buff isn't gated by MOVE_COMPATIBILITY at
  // all -- these are usable from any form, not just a Kondo-lattice or
  // defect state. Screening Pulse re-forms the caster's own screening
  // cloud, damping incoming damage (Shielded); Scattering Drag randomizes
  // the caster's own scattering trajectory, giving incoming hits a chance
  // to miss entirely (Evasive); Coherence Cascade re-forms the caster's own
  // Kondo singlet turn by turn, restoring coherence and healing it over
  // time (Regenerating) -- named for that coherence-building process, not
  // "breakdown," since a literal Kondo breakdown is the opposite (the
  // heavy-fermion composite's own hybridization collapsing at a quantum
  // critical point). None of the three buff names doubles as a MoveClass --
  // 'majorana' is separately Majorana Split's own class, unrelated
  // quasiparticle physics, so a buff name matching it would read as if this
  // generic technique were tied to that specific move instead.
  screeningCloud: {
    id: 'screeningCloud',
    name: 'Screening Pulse',
    class: 'screening',
    power: 7,
    description: 'Re-forms your own screening cloud: reduces damage you take for 3 turns.',
  },
  scatteringDrag: {
    id: 'scatteringDrag',
    name: 'Scattering Drag',
    class: 'screening',
    power: 7,
    description: 'Randomizes your own scattering trajectory: a chance to evade an incoming hit entirely for 3 turns.',
  },
  kondoBreakdown: {
    id: 'kondoBreakdown',
    name: 'Coherence Cascade',
    class: 'screening',
    power: 7,
    description: 'Re-forms your own Kondo singlet: restores coherence and heals you each turn for 3 turns.',
  },
};

// Landau is the sole seller of these two quiz-gated Analytic moves
// (scenes/panels/landau.ts, panels/tunableMoveShop.ts, mirroring
// Noether's showNoetherShop) -- kept out of SHOP_MOVE_IDS so Noether's own
// shop never offers them too. Named explicitly by id rather than filtered
// by class -- unlike Kondo's screening moves, these don't share a
// distinguishing class of their own (each carries whatever ordinary
// quasiparticle class the player has tuned it to, see getTunedMoveClass
// below), so "is this one of Landau's moves" is a fact about the move's
// identity, not something derivable from `class`.
//
// Never add these ids (or ULTIMATE_MOVE_IDS below) to any material's
// `moves` array in WORLD_CRYSTALS/WORLD_RIVALS -- an opponent using one
// would bypass the quiz gate entirely, since that gate lives in the
// player-only move-menu click handler (BattleScene.ts's addMoveButton), not
// in the damage formula itself.
export const ANALYTIC_MOVE_IDS = ['skyfallBeam', 'groundEruption'];

// Skłodowska-Curie is the sole seller of these two quiz-gated Ultimate
// moves (scenes/panels/sklodowskaCurie.ts) -- kept out of SHOP_MOVE_IDS
// same as ANALYTIC_MOVE_IDS above. See MOVES.ultimateMeteor/ultimateNova's
// own comment for the power/pricing rationale, and ANALYTIC_MOVE_IDS's
// comment just above for why these can never appear in an opponent's
// `moves` array either.
export const ULTIMATE_MOVE_IDS = ['ultimateMeteor', 'ultimateNova'];

// The rival golems' decohered moves -- opponent-only, the mirror image of
// ANALYTIC_MOVE_IDS/ULTIMATE_MOVE_IDS above. A player never obtains one:
// they are kept out of SHOP_MOVE_IDS so Noether cannot sell them, out of
// every wild crystal's moveset, and out of the generated move table in
// docs/quasiparticles.md, since a player-facing move list should only list
// moves a player can actually end up holding.
export const GOLEM_MOVE_IDS = [
  'decoheredMagnon',
  'decoheredSpinon',
  'decoheredTriplon',
  'decoheredChiral',
  'decoheredHelical',
  'decoheredHiggs',
  'decoheredVison',
];

// Qumatessence cost to unlock one quasiparticle class for one Ultimate move
// (Skłodowska-Curie's panel, registry/save `ultimateClassesUnlocked`) --
// paid once per (move, class) pair, not per purchase like shopCost; once
// paid, retuning back to that class is free forever.
export const ULTIMATE_CLASS_UNLOCK_COST = 1000;

// Qumatessence cost to unlock one specific *option* of each of the four
// repeatable-action guardians' signature abilities -- one Bloch
// destination world, one Dresselhaus crystal to transmute into, one
// Anderson host to dope in, one Majorana fusion result -- paid the first
// time that specific option is picked, free forever after (registry/save
// `blochUnlockedWorlds`/`dresselhausUnlockedCrystals`/
// `andersonUnlockedHosts`/`majoranaUnlockedResults`, each a list of
// already-paid-for option keys rather than a single whole-ability flag,
// since every option is its own separate purchase). The same
// pay-once-then-free-forever shape Franklin's flat per-passive
// `cost` and Skłodowska-Curie's `ULTIMATE_CLASS_UNLOCK_COST` already use,
// just keyed per candidate rather than per passive/class. Priced well
// below Franklin's 40-50 whole-passive band and Noether's/
// Landau's/Kondo's ~35-55 `shopCost` moves, since a single option here is
// a narrower purchase than a whole passive or move -- unlocking every
// option of an ability (e.g. every world Bloch can reach) costs
// meaningfully more in total than the old flat per-ability price did, by
// design, since the player is now paying per destination/crystal/host/
// result rather than once for unlimited access. Same relative ordering as
// before: Bloch (world 2) is pure convenience -- it grants no new battle
// power, only skips walking to one already-reachable world -- so it's
// priced lowest; Dresselhaus (world 3) commits to becoming one specific
// crystal (its own look/type/moveset -- HP stays driven by the current
// world regardless of form), a bigger capability swing per option than
// pure travel; Anderson (world 6) permanently opens one
// specific dopant's move channel and sits later in the world progression,
// so it costs more still; Majorana (world 5) is priced highest of the
// four -- above even Noether's/Landau's/Kondo's ordinary `shopCost` top
// end (~55) -- despite sitting earlier than Anderson, since unlocking one
// specific hybrid result is comparable in value to learning a whole new
// move, and fusing at all only reaches HYBRID_RECIPES' curated results, an
// additional content category rather than a reshaping of an existing one.
export const BLOCH_DESTINATION_COST = 15;
export const DRESSELHAUS_TRANSMUTE_COST = 25;
export const ANDERSON_DOPE_COST = 35;
export const MAJORANA_FUSE_COST = 60;

// The full roster of ordinary quasiparticle classes a tunable move's
// picker can ever offer (scenes/panels/tunableMoveShop.ts's
// showMoveClassPicker, scenes/panels/sklodowskaCurie.ts's own picker) --
// every ordinary Attacks-section class, i.e. everything except 'screening'
// itself (Kondo's, not an assignable quasiparticle). Each picker filters
// this down further, to only the classes the player's *current* form can
// actually host (`canHost(playerMaterial.type, cls)`) -- so a class as
// narrow as 'ferron' (only 'ferroelectric'/'multiferroic' host it) only
// ever shows up while the player is wearing one of those forms, rather than
// being freely pickable as an easy "always mismatch nearly every opponent"
// choice.
export const TUNABLE_MOVE_CLASSES: MoveClass[] = [
  'electron',
  'magnon',
  'phonon',
  'spinon',
  'triplon',
  'electromagnon',
  'chiral',
  'helical',
  'higgs',
  'chargedAnyon',
  'majorana',
  'heavyFermion',
  'ferron',
  'vison',
  'plasmon',
];

// The bare quasiparticle noun a tunable move's picker shows for each class
// ('Electron', 'Heavy Fermion', 'Anyon' for 'chargedAnyon', ...) -- not the
// matching ordinary move's own display name ('Electron Pulse'), so a picker
// row reads "Electron -- 1000 qumatessence" rather than "Electron Pulse --
// 1000 qumatessence", and tunedMoveDisplayName below can prefix it straight
// onto a move's shape word ('Meteor', 'Nova', ...) to get "Electron Meteor"/
// "Heavy Fermion Meteor" without needing to parse it back out of a move
// name's first word(s).
const QUASIPARTICLE_NAMES: Partial<Record<MoveClass, string>> = {
  electron: 'Electron',
  magnon: 'Magnon',
  phonon: 'Phonon',
  spinon: 'Spinon',
  triplon: 'Triplon',
  electromagnon: 'Electromagnon',
  chiral: 'Chiral',
  helical: 'Helical',
  higgs: 'Higgs',
  chargedAnyon: 'Anyon',
  majorana: 'Majorana',
  heavyFermion: 'Heavy Fermion',
  ferron: 'Ferron',
  vison: 'Vison',
  plasmon: 'Plasmon',
};

export function quasiparticleLabel(moveClass: MoveClass): string {
  return QUASIPARTICLE_NAMES[moveClass] ?? moveClass;
}

// Kondo is the sole seller of the three screening-class moves
// (OverworldScene.showKondoPanel) -- kept out of SHOP_MOVE_IDS so Noether
// never also offers them. Unlike ANALYTIC_MOVE_IDS, buying one of these
// doesn't make it usable on its own -- see getBattleMoves below for the
// only-one-active-at-a-time special case (registry/save `kondoActiveMove`).
export const KONDO_MOVE_IDS = Object.values(MOVES)
  .filter((m) => m.class === 'screening')
  .map((m) => m.id);

// Every move Noether can eventually teach, priced by raw power
// (`OverworldScene.shopCost`) -- everything except the player's starting
// Phonon Beam, Landau's quiz-gated Analytic moves (ANALYTIC_MOVE_IDS,
// sold only by him), Skłodowska-Curie's quiz-gated Ultimate moves
// (ULTIMATE_MOVE_IDS, sold only by her, and priced completely differently
// besides -- see her panel), and Kondo's screening moves (KONDO_MOVE_IDS,
// sold only by him). What actually shows up in her shop (and what actually
// appears as a battle button) is this list filtered down to
// `compatibleMoves(currentPlayerForm)`, so a semiconductor-type player is
// only ever offered Electron Pulse until they transmute into a form whose
// physics supports the rest (see MOVE_COMPATIBILITY/compatibleMoves).
export const SHOP_MOVE_IDS = Object.keys(MOVES).filter(
  (id) =>
    id !== 'thermalFluctuation' &&
    !ANALYTIC_MOVE_IDS.includes(id) &&
    !ULTIMATE_MOVE_IDS.includes(id) &&
    !GOLEM_MOVE_IDS.includes(id) &&
    !KONDO_MOVE_IDS.includes(id)
);

// Which quasiparticle classes a given main type can physically host --
// Phonon Beam ('phonon') is on every list since every crystal has a
// lattice, but e.g. Magnon Pulse only appears for types with actual
// magnetic order ('classicalMagnet', 'multiferroic'), never for a plain band
// insulator/semiconductor like Silicon. This is what makes "Si doesn't have
// magnons" a rule the game enforces, not just flavor text -- both the
// battle move list (getBattleMoves) and Noether's shop filter through this.
// Kondo's three self-buff moves (class 'screening', §5) are left off every
// list here entirely rather than added to all of them -- they're not
// attacks, so canHost/the quasiparticle-mismatch rule never applies to them
// in the first place (BattleScene.resolveHit routes them to
// resolveSelfBuff instead), and getBattleMoves surfaces the currently-active
// one directly rather than through this table. Adding a new *attack*
// MoveClass here always means deciding this on purpose, not by omission: a
// class left off every list would make its moves *always* mismatch
// (canHost) against every defender -- a silent 2x on top of whatever bonus
// BattleScene itself applies for that class, not a neutral default.
//
// Mirrors `data/TAXONOMY.txt`'s CLASSES section exactly -- that file is the
// hand-edited design spec, this table is its implementation; a mismatch
// between the two is a bug, not a stylistic difference.
const MOVE_COMPATIBILITY: Record<MaterialType, MoveClass[]> = {
  // 'plasmon' is 'metal''s own addition on top of the ordinary electron/
  // phonon baseline -- a partially filled band is what lets a free electron
  // gas support a plasmon at all, so it's deliberately not shared with
  // 'semiconductor'/'insulator' below.
  metal: ['electron', 'phonon', 'plasmon'],
  // Phonon alone. The gap is wide enough that no ordinary band electron
  // propagates, and there is no order of any kind to carry a collective
  // mode, so what is left is the one excitation every solid has: its own
  // lattice, vibrating. The narrowest row in this table, and the reason an
  // insulator is the least quantum thing a player can wear or fight.
  insulator: ['phonon'],
  semiconductor: ['electron', 'phonon'],
  classicalMagnet: ['magnon', 'phonon'],
  // Hosts spinon (the fractionalized excitation itself), vison (its
  // topological-order companion), and triplon (a dimer/valence-bond
  // quantum-paramagnet's own confined mode, grouped in here rather than a
  // separate class -- see types.ts's comment on this type).
  quantumSpinLiquid: ['spinon', 'phonon', 'vison', 'triplon'],
  // 'spinon' as well as 'heavyFermion' -- Kondo-breakdown/fractionalized-
  // Fermi-liquid physics at the quantum critical point YbRh₂Si₂ itself sits
  // at, on top of the class's own defining heavy-fermion composite.
  kondoHeavyFermion: ['electron', 'phonon', 'heavyFermion', 'spinon'],
  // Ordinary (non-topological) Cooper pairing -- 'higgs' (the condensate's
  // own amplitude mode) rather than 'majorana': a plain s-wave
  // pairing alone doesn't host a Majorana zero mode, that needs genuine
  // topological pairing (see 'chernSuperconductor').
  superconductor: ['electron', 'phonon', 'higgs'],
  // A chiral/topological superconductor -- 'majorana' lives here, not on
  // plain 'superconductor' or a bare 'quantumSpinHall' surface: a Majorana
  // zero mode needs genuine topological pairing (vortices/edges of a chiral
  // SC, or a superconductor-proximitized topological surface), not just an
  // ordinary s-wave condensate or a helical boundary state with no pairing
  // in the picture at all.
  chernSuperconductor: ['electron', 'phonon', 'higgs', 'chiral', 'majorana'],
  // An (integer) Chern insulator's edge is a single chiral channel, whether
  // field-driven (world 4's Landau levels) or zero-field (world 10's
  // anomalous-Hall compounds) -- both the same topological invariant, see
  // types.ts's comment on this type.
  chernInsulator: ['electron', 'phonon', 'chiral'],
  // 'helical' (a Kramers pair, time-reversal-protected), not 'chiral' -- a
  // bulk 3D topological insulator's own surface Dirac cone (Bi₂Te₃), a
  // bulk-derived monolayer's own quantum spin Hall state (Monolayer WTe₂),
  // and an engineered quantum well (HgTe/CdTe) all share this boundary
  // physics regardless of dimensionality, see types.ts's comment on this
  // type. No 'majorana', since none of them have superconducting proximity
  // in the picture.
  quantumSpinHall: ['electron', 'phonon', 'helical'],
  // Unlike ordinary 'chernInsulator', a fractional Chern insulator's edge is
  // itself a fractionalized chiral mode whose quanta are charged anyons
  // with genuine braiding statistics -- 'chargedAnyon' rather than 'chiral'.
  fractionalChern: ['electron', 'phonon', 'chargedAnyon'],
  // No magnetic order at all -- 'ferron' (the polarization order's own
  // quantum) rather than 'magnon'/'electromagnon'.
  ferroelectric: ['phonon', 'ferron'],
  // Both 'electromagnon' (the ME-hybridized magnon) and 'ferron' (the
  // polarization order's own excitation) on top of an ordinary 'magnon' --
  // distinct modes, not redundant: a multiferroic genuinely has all three.
  multiferroic: ['magnon', 'phonon', 'electromagnon', 'ferron'],
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

// Reverse lookup of MOVE_COMPATIBILITY -- every MaterialType that genuinely
// hosts a given quasiparticle class. Backs World 10 rival's live
// transmutation mechanic (BattleScene's own comment on `adaptedForm`/
// `transmuteAdapted`): after a hit, it picks a new type at random from among
// the types that actually host the class the player just attacked with,
// rather than an arbitrary one.
export function typesHosting(moveClass: MoveClass): MaterialType[] {
  return (Object.keys(MOVE_COMPATIBILITY) as MaterialType[]).filter((type) => MOVE_COMPATIBILITY[type].includes(moveClass));
}

// Battle stats (DESIGN.md §3): every crystal starts at the same baseline
// (BASE_STAT/DEFAULT_STATS, balance.ts) -- the player's own stats live in
// the save/registry (`playerStats`, grown by spending qumatessence with
// Noether -- OverworldScene.renderShopStats), while an opponent's stats are
// computed fresh from the world number at battle start (enemyStatsForWorld,
// balance.ts) rather than baked per-species, so difficulty climbs with the
// world rather than needing 30 hand-tuned stat blocks.

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
// (compatibleMoves), plus whatever classes their currently doped-in impurity
// (registry `andersonDopant`, set via Anderson's panel) additionally hosts --
// an impurity's excitation channel is real for as long as the impurity
// itself is doped in, not just while the player's own bare form happens to
// carry it. Transmuting into a new form (or doping in a different impurity)
// doesn't erase anything learned -- it just changes which of those learned
// moves are currently usable, so switching back later restores the rest for
// free.
//
// One narrow special case: Kondo's three self-buff moves (KONDO_MOVE_IDS)
// can all be *learned* independently, but only one is ever *usable* at a
// time -- the registry/save `kondoActiveMove` id, switched only by talking
// to Kondo again (OverworldScene.showKondoPanel), not per-turn like every
// other learned move (only one buff channel can be tuned at a time). A
// bought-but-inactive Kondo move stays in `unlockedMoves` (still "learned")
// -- it just never passes this filter until it's made active. Checked
// before (not intersected with) `allowed` -- a self-buff isn't gated by
// MOVE_COMPATIBILITY at all (see that table's own comment), so it's usable
// regardless of the player's current form the moment it's the active one.
export function getBattleMoves(registry: RegistryLike): string[] {
  const unlocked = (registry.get('unlockedMoves') as string[]) ?? [...PLAYER_MATERIAL.moves];
  const allowed = new Set(compatibleMoves(getPlayerMaterial(registry)));
  const dopantName = (registry.get('andersonDopant') as string | null) ?? null;
  const dopant = dopantName ? findMaterialByName(dopantName) : null;
  if (dopant) {
    for (const id of compatibleMoves(dopant)) allowed.add(id);
  }
  const activeKondoMove = (registry.get('kondoActiveMove') as string | null) ?? null;
  return unlocked.filter((id) => {
    if (KONDO_MOVE_IDS.includes(id)) return id === activeKondoMove;
    return allowed.has(id);
  });
}

// The quasiparticle class BattleScene's mismatch check should use for a
// given move -- ordinarily just that move's own fixed `class`, except for a
// tunable move (Landau's two Analytic moves, Skłodowska-Curie's two
// Ultimate moves) once the player has tuned it via the owning guardian's
// picker (registry/save `moveClassTuning`): the mismatch check reads the
// player-assigned quasiparticle instead of the move's default 'phonon', so a
// tuned move can mismatch a defender like any ordinary attack would. An
// untuned move (never visited the picker, or an older save from before this
// existed) falls back to its own default 'phonon' class, the same "never
// mismatches" behavior it starts with.
function assignedMoveClass(registry: RegistryLike, moveId: string): MoveClass | undefined {
  return (registry.get('moveClassTuning') as Partial<Record<string, MoveClass>> | undefined)?.[moveId];
}

// A tuned assignment is picked against whatever form the player was
// wearing at the guardian's shop, but the player can transmute afterward --
// if the form they're wearing *now* can no longer host that class (e.g.
// tuned to 'ferron' as a multiferroic, then transmuted into Silicon), this
// falls back to 'phonon' (Phonon Beam) rather than keeping an assignment the
// current form can't actually carry: 'phonon' is on every
// MOVE_COMPATIBILITY list, so it's always a safe, always-hostable landing
// spot. An untuned move (never visited the picker) falls back to its own
// default 'phonon' class instead, the same "never mismatches" behavior.
export function getTunedMoveClass(registry: RegistryLike, moveId: string): MoveClass {
  const assigned = assignedMoveClass(registry, moveId);
  if (!assigned) return MOVES[moveId].class;
  const currentType = getPlayerMaterial(registry).type;
  return canHost(currentType, assigned) ? assigned : 'phonon';
}

// A tunable move (Landau's Analytic pair, Skłodowska-Curie's Ultimate
// pair) always displays whichever quasiparticle it's currently carrying,
// tuned or not (e.g. skyfallBeam tuned to 'magnon' reads as "Magnon Lance";
// untuned reads as "Phonon Lance", the same default `getTunedMoveClass`
// falls back to) -- so unlike a static move name, this one never goes stale
// relative to what the move actually mismatches with. The move's own fixed
// shape (Lance vs. Eruption vs. Meteor vs. Nova) is read off its static
// `name` with that move's own quasiparticle label stripped from the front,
// rather than from a second hand-authored word list, so a future MOVES
// rename stays in sync automatically; only the quasiparticle word in front
// of it changes -- QUASIPARTICLE_NAMES's bare noun (not the raw move name)
// so a multi-word quasiparticle like 'heavyFermion' still reads as "Heavy
// Fermion Meteor", not a truncated "Heavy Meteor". Stripping the label
// rather than a fixed one word is what makes that work in both directions:
// 'heavyFermion' is two words, so "Heavy Fermion Pulse" has to yield the
// shape "Pulse" and not a stray "Fermion Pulse". A name that does not begin
// with its own class's label falls back to dropping the first word; the one
// class with no quasiparticle noun, Kondo's 'screening', never reaches here
// at all, since moveDisplayName routes it to its static name instead.
// Reads getTunedMoveClass
// rather than the raw assignment, so if the current form can't host the
// tuned class anymore the name reverts to its Phonon form too, matching what
// the mismatch check actually uses.
export function tunedMoveDisplayName(registry: RegistryLike, moveId: string): string {
  const move = MOVES[moveId];
  const active = getTunedMoveClass(registry, moveId);
  const ownLabel = `${quasiparticleLabel(move.class)} `;
  const shape = move.name.startsWith(ownLabel)
    ? move.name.slice(ownLabel.length)
    : move.name.split(' ').slice(1).join(' ');
  return `${quasiparticleLabel(active)} ${shape}`;
}

// Feynman's move-leveling ("Feynman Diagrammatics," §5, World 7) -- three
// tiers above a move's own base level, unlocked one at a time in sequence
// (a move must already hold tier N-1 before tier N can be attempted).
// Index 0 is the unleveled base case (empty name prefix, 1x power, no
// streak to clear); indices 1-3 are Double/Triple/Infinite. The tier names
// are escalating-power flavor labels -- "Infinite" is hyperbole, not a
// claim the move's power is actually unbounded: the real bump is
// MOVE_LEVEL_MULTIPLIERS (balance.ts), a flat 1.5x/2x/3x, read by
// effectiveMovePower below for an ordinary attack move and, separately, by
// BattleScene.kondoMitigationFraction for one of Kondo's three self-buffs
// (whose own `power` is never read as damage in the first place, see
// KONDO_MOVE_IDS' own comment) -- there it scales that buff's own
// mitigation strength instead, capped well under 100% so even an
// Infinite-tier buff leaves real risk on the table. MOVE_LEVEL_STREAKS
// (balance.ts) is how many of Feynman's own quiz questions (data/quiz.ts's
// getAnalyticQuestions) the player must answer correctly in a row to land
// that tier -- missing even one loses the attempt (the qumatessence
// already spent per feynmanLevelCost included) without changing the move's
// level, same no-partial-credit shape Skłodowska-Curie's Ultimate-move gate
// uses, generalized to a variable streak length instead of a fixed 3.
export type MoveLevel = 0 | 1 | 2 | 3;
export const MOVE_LEVEL_NAMES: readonly string[] = ['', 'Double', 'Triple', 'Infinite'];

// Which level a given move is currently leveled to -- registry/save
// `moveLevels` (moveId -> level), missing entry defaults to 0 (never
// attempted). Leveling is per move id, not per-crystal-form or per-run --
// once a move is leveled up it stays leveled up forever, the same
// permanent "first time costs, permanent afterward" shape every other
// guardian's one-time unlock already uses.
export function getMoveLevel(registry: RegistryLike, moveId: string): MoveLevel {
  const levels = (registry.get('moveLevels') as Partial<Record<string, MoveLevel>> | undefined) ?? {};
  return levels[moveId] ?? 0;
}

// The move's own base `power`, scaled by its current level's multiplier --
// what BattleScene's damage formula reads in place of a raw `move.power`
// for the *player's* own moves only (an opponent's copy of the same move id
// is never affected -- move levels are the player's own save state, not a
// property of the move itself).
export function effectiveMovePower(registry: RegistryLike, moveId: string): number {
  return MOVES[moveId].power * MOVE_LEVEL_MULTIPLIERS[getMoveLevel(registry, moveId)];
}

// The display name every rendering site (battle move buttons/log, every
// guardian shop, Feynman's own panel) should show for a move -- folds in
// both Feynman's level prefix (Double/Triple/Infinite, empty at level 0) and,
// for an ordinary attack move, whichever quasiparticle it's currently tuned
// to (tunedMoveDisplayName). Kondo's three 'screening'-class self-buffs are
// the one exception: they have no quasiparticle to tune, so
// tunedMoveDisplayName would read back the untuned 'screening' class's own
// bare label instead of a real name (see that function's own comment) --
// this falls back to the move's own static name for those instead, then
// applies the same level prefix on top.
export function moveDisplayName(registry: RegistryLike, moveId: string): string {
  const base = MOVES[moveId].class === 'screening' ? MOVES[moveId].name : tunedMoveDisplayName(registry, moveId);
  const prefix = MOVE_LEVEL_NAMES[getMoveLevel(registry, moveId)];
  return prefix ? `${prefix} ${base}` : base;
}

// The player is a crystal too -- just one entry out of this same roster, not a
// separate species. Silicon: the semiconductor/tutorial-baseline type from
// DESIGN.md's crystal database (topic 1) -- narrow enough a gap to dope, so
// it doesn't host Plasmon Pulse the way a true 'metal' does. `moves` here is
// just the starting loadout (Phonon Beam only) -- which moves are actually
// available in battle is tracked separately in the Phaser registry's
// `unlockedMoves` entry, since that grows as the player buys more from
// Noether.
export const PLAYER_MATERIAL: Material = {
  name: 'Silicon',
  shortName: 'Si',
  type: 'semiconductor',
  color: 0x4a90d9,
  // Diamond-cubic, like its type's default.
  variant: 'octahedral',
  moves: ['thermalFluctuation'],
};

// One base look per main type, shaded a little differently per compound
// within that type so siblings (e.g. Iron vs. Cobalt) read as a family
// rather than being indistinguishable. Exported so a purely decorative
// showcase (TitleScene's crystal cluster) can pull real per-type looks
// instead of duplicating color literals that would drift out of sync.
export const TYPE_LOOK: Record<MaterialType, { color: number; variant: CrystalVariant }> = {
  // The elemental metals here are fcc/bcc and the semimetal is zinc blende --
  // all cubic.
  metal: { color: 0x7a8a99, variant: 'cubic' },
  // Pale, inert grey-white -- MgO's wide-gap ionic-insulator character. Its
  // rock-salt lattice is cubic, as is diamond's own.
  insulator: { color: 0xb8c4cc, variant: 'cubic' },
  // Diamond structure and zinc blende: the tetrahedrally-bonded cubic family,
  // whose habit is the {111} octahedron.
  semiconductor: { color: 0x5a7ca6, variant: 'octahedral' },
  classicalMagnet: { color: 0xc97a3a, variant: 'cluster' },
  quantumSpinLiquid: { color: 0x5ad9c9, variant: 'cluster' },
  // Deep amber/gold -- "heavy," dense, mass-renormalized carriers.
  kondoHeavyFermion: { color: 0xd9962a, variant: 'cluster' },
  // The one type with no characteristic lattice of its own -- elemental
  // cubic, layered cuprate, hydride and TMD superconductors share nothing
  // structurally -- so it keeps the generic faceted habit and each member
  // states its own structure via `variantOverride`.
  superconductor: { color: 0x7fd1e8, variant: 'shard' },
  // Superconductor blue shifted toward violet -- reads as that type's own
  // exotic cousin rather than an unrelated hue.
  chernSuperconductor: { color: 0x4a7fd9, variant: 'prism' },
  // 'rhombohedral' for the R-3m tetradymites the type's own members are
  // built on -- MnBi₂Te₄ (both the World 4 wild and the golems named for it)
  // and the Cr-doped (Bi,Sb)₂Te₃ host. A member that isn't one of those, like
  // Graphene under a strong field, states its own habit instead.
  chernInsulator: { color: 0xc9d94a, variant: 'rhombohedral' },
  // 'layer' is the default variant since most members are quantum wells/
  // monolayers -- a bulk 3D member like Bi₂Te₃ overrides back to 'prism' on
  // its own crystal() call instead (see WORLD_CRYSTALS[3]).
  quantumSpinHall: { color: 0x6a4ad9, variant: 'layer' },
  // Warmer than chernInsulator's yellow-green -- distinct but visibly
  // related, and 'layer' since every member is a stack of honeycomb
  // monolayers (Twisted Bilayer MoTe₂, pentalayer graphene on hBN).
  fractionalChern: { color: 0xe8c94a, variant: 'layer' },
  // Rose -- contrasts multiferroic's magenta, evokes electric polarization
  // rather than magnetism. 'tetragonal' since the type's archetypes (BaTiO₃'s
  // room-temperature P4mm perovskite, KDP) both polarize along a four-fold
  // axis, which is the distortion the order parameter lives on.
  ferroelectric: { color: 0xd96a8a, variant: 'tetragonal' },
  multiferroic: { color: 0xc94ac0, variant: 'layer' },
};

// The player-facing name for each MaterialType -- its own identifier spaced
// out into words, never shown as a raw camelCase string (Qumatex's type
// filter, gen-docs.mjs's crystals.md/quasiparticles.md tables). Mirrors
// QUASIPARTICLE_NAMES's role for MoveClass above.
const MATERIAL_TYPE_NAMES: Record<MaterialType, string> = {
  metal: 'Metal',
  insulator: 'Insulator',
  semiconductor: 'Semiconductor',
  classicalMagnet: 'Classical Magnet',
  quantumSpinLiquid: 'Quantum Spin Liquid',
  kondoHeavyFermion: 'Kondo Heavy Fermion',
  superconductor: 'Superconductor',
  chernSuperconductor: 'Chern Superconductor',
  chernInsulator: 'Chern Insulator',
  quantumSpinHall: 'Quantum Spin Hall Insulator',
  fractionalChern: 'Fractional Chern Insulator',
  ferroelectric: 'Ferroelectric',
  multiferroic: 'Multiferroic',
};

export function materialTypeLabel(type: MaterialType): string {
  return MATERIAL_TYPE_NAMES[type] ?? type;
}

// A crystal database row: real compound name + main type (which fixes its
// look and its move compatibility). `shadeStep` just separates same-type
// siblings visually (e.g. Iron vs. Cobalt) using TYPE_LOOK's base color.
// `variantOverride` states a compound's own crystal habit where its structure
// differs from the one its type's `TYPE_LOOK` entry assumes -- a lattice is a
// property of the compound, and a main type groups compounds by their physics
// rather than by their symmetry, so the two part company often (wurtzite GaN
// among the zinc-blende semiconductors, rhombohedral Bi₂Te₃, monolayer CrI₃
// among the bulk magnets). Only ever set from the compound's real structure,
// never for visual variety; a compound whose structure is low-symmetry enough
// to have no characteristic habit takes 'shard'.
// `colorOverride` skips the `shadeStep` formula entirely and uses the given
// color as-is -- every rival golem (WORLD_RIVALS[1-8] and World 9's
// `rivalImpurityResonance`) takes this route, since a golem's tarnished,
// desaturated look doesn't reduce to "TYPE_LOOK's base color, brightened by
// a multiple of 18%." No HP
// here -- a crystal's max HP in battle is never intrinsic to the compound,
// only to which world it's fought in (an ordinary wild's `wildHpForWorld`,
// a rival's `rivalHpForWorld`, both `data/balance.ts`, read live by
// `BattleScene.create` rather than stored on `Material` at all).
function crystal(
  name: string,
  type: MaterialType,
  moves: string[],
  shadeStep = 0,
  variantOverride?: CrystalVariant,
  shortName?: string,
  colorOverride?: number
): Material {
  const look = TYPE_LOOK[type];
  return {
    name,
    shortName,
    type,
    color: colorOverride ?? shade(look.color, shadeStep * 18),
    variant: variantOverride ?? look.variant,
    moves,
  };
}

// The Materialdex's "Name (ShortName)" display -- the one place
// `Material.shortName` is read today. Falls back to the plain name for the
// majority of compounds that don't carry one (types.ts's own comment on the
// field explains why not every entry has one).
export function materialDisplayName(material: Material): string {
  return material.shortName ? `${material.name} (${material.shortName})` : material.name;
}

// Per-world (course-topic) wild-crystal pools, keyed by world number --
// matches the "Wild material archetypes" column of the world table in
// DESIGN.md, drawn from the fuller candidate list in that doc's "Crystal
// database" section. Each scene pulls its own world's pool via
// `getWildPool()` rather than sharing one global list, so later worlds can
// each have their own specials without touching the encounter logic.
// World 10's own pool (below) hosts exactly the game's named hybrid-recipe
// results (HYBRID_RECIPES further down) and nothing else -- worlds 1-9 never
// spawn a hybrid-recipe result as an ordinary wild, so a compound reachable
// by fusion is reachable only by fusion until World 10.
// WORLD_RIVALS[10] (the finale boss "The Adapted") has no fixed type/look of
// its own at all -- see that table's own comment.
export const WORLD_CRYSTALS: Partial<Record<number, Material[]>> = {
  1: [
    // Real graphene plasmonics (tunable, mid-IR) is its own well-known field
    // -- Plasmon Pulse rather than Electron Pulse, so 'metal''s signature
    // move is actually reachable by fighting/discovering a wild crystal, not
    // just buyable in the abstract.
    crystal('Graphene', 'metal', ['plasmonPulse', 'thermalFluctuation'], 0, 'layer'),
    crystal('Nickel Oxide', 'classicalMagnet', ['thermalFluctuation', 'magneticField'], 0, undefined, 'NiO'),
    // Elemental Cr is an itinerant (metallic) antiferromagnet -- the SDW
    // mean-field/Stoner-criterion counterpart to NiO's Mott-insulating
    // picture above (Manganese Oxide, the same Mott-insulating family, is a
    // World 6 wild). Also HYBRID_RECIPES' magnetic-dopant parent for
    // Cr-doped (Bi,Sb)₂Te₃ (world 3's Bi₂Te₃ + this).
    crystal('Chromium', 'classicalMagnet', ['thermalFluctuation', 'magneticField'], 1, undefined, 'Cr'),
    // Same classicalMagnet SSB family as NiO/Chromium above, not a new
    // type for this world -- Iron and Cobalt are itinerant ferromagnets,
    // textbook mean-field-broken-symmetry examples in their own right, also
    // spawning in World 6 (magnons) since a compound isn't pinned to a
    // single world once more than one topic legitimately motivates it.
    crystal('Iron', 'classicalMagnet', ['thermalFluctuation', 'magneticField'], 2, undefined, 'Fe'),
    crystal('Cobalt', 'classicalMagnet', ['thermalFluctuation', 'magneticField'], 3, undefined, 'Co'),
    // Europium oxide's half-filled Eu²⁺ 4f⁷ shell gives it well-isolated
    // localized moments coupled by (indirect) exchange -- the actual
    // material Weiss/mean-field theory's own Brillouin-function prediction
    // is classically tested against (its magnetization-vs-temperature curve
    // is a textbook mean-field-theory-vs-experiment figure), a genuinely
    // different mean-field derivation (localized-moment Weiss theory) from
    // Iron/Cobalt's itinerant Stoner picture above, even though both land on
    // the same classicalMagnet order.
    crystal('Europium Oxide', 'classicalMagnet', ['thermalFluctuation', 'magneticField'], 4, undefined, 'EuO'),
    // A simple ionic (ligand-mediated superexchange) local-moment
    // antiferromagnet, its own strong single-ion anisotropy making it the
    // real-material realization of the mean-field Ising antiferromagnet
    // model -- a third distinct route to classicalMagnet order alongside
    // NiO's Mott-insulating Hubbard-U picture and Chromium's itinerant SDW
    // above.
    crystal('Manganese Fluoride', 'classicalMagnet', ['thermalFluctuation', 'magneticField'], 5, undefined, 'MnF₂'),
    // Spontaneous symmetry breaking isn't only magnetic -- Barium Titanate's
    // off-center Ti⁴⁺ ion breaking inversion symmetry into a switchable
    // polarization is the same SSB physics this world teaches, just a
    // ferroelectric order parameter instead of a magnetic one. Also spawns
    // in World 9 (see that pool's own comment on types without a session of
    // their own).
    crystal('Barium Titanate', 'ferroelectric', ['ferronPulse', 'thermalFluctuation'], 5, undefined, 'BaTiO₃'),
    // An order-disorder-type ferroelectric (proton tunneling/hopping between
    // two off-center sites in an O-H...O bond, described by a pseudospin
    // mean-field/Ising model) rather than BaTiO₃'s displacive-type (an ion
    // continuously sliding off-center) -- the same rotational/inversion-
    // symmetry-breaking SSB, reached by a genuinely different microscopic
    // mechanism, and an even more literal mean-field-theory teaching example
    // than BaTiO₃'s own soft-phonon-mode picture.
    crystal('Potassium Dihydrogen Phosphate', 'ferroelectric', ['ferronPulse', 'thermalFluctuation'], 0, undefined, 'KH₂PO₄'),
    // A charge density wave is exactly the broken-continuous-translational-
    // symmetry case session1's own first worked mean-field example (the
    // spinless 1D chain) builds -- 1T-TiSe₂'s own CDW transition (~200 K)
    // opens a small gap via a frozen (softened) lattice/charge modulation,
    // the textbook real-material CDW compound. Stays 'metal' rather than
    // needing a dedicated type -- session1 itself notes only the phonon is
    // guaranteed gapless in every material (unlike a magnon or the Higgs
    // mode), and a CDW's own low-energy fluctuation is exactly that lattice
    // phonon branch, not a distinct quasiparticle of its own -- so it keeps
    // 'metal''s ordinary Electron Pulse/Phonon Beam moveset (its own
    // "translational symmetry breaking" story lives in this comment and its
    // materialdex.ts blurb, not in a separate move).
    crystal('Titanium Diselenide', 'metal', ['tunnelStrike', 'thermalFluctuation'], 6, 'prism', 'TiSe₂'),
    // Session1's own third worked mean-field example, alongside the charge
    // density wave and magnetism above, is superconductivity's own broken
    // gauge symmetry -- cross-listed from World 5 (same type/moveset as that
    // entry) the same deliberate way Iron/Cobalt/Barium Titanate already
    // are, rather than invented fresh for this world.
    crystal('Aluminum', 'superconductor', ['higgsOscillation', 'thermalFluctuation'], 0, 'cubic', 'Al'),
  ],
  // Topic 2 (symmetries, tight-binding) has no dedicated main type of its
  // own in the type system -- it mixes the metal/semiconductor/insulator
  // baselines, just with "lattice" flavor compounds instead of world 1's
  // tutorial picks. Graphene, Silver, and Tungsten stay 'metal' (a zero-gap
  // semimetal, the archetypal plasmonic conductor, and an ordinary d-band
  // conductor respectively); Gallium Nitride, Indium Arsenide, and the
  // semiconducting MoTe₂ phase are narrow-gap dopable semiconductors, same
  // category as Silicon; Magnesium Oxide, Diamond, and Monolayer Boron
  // Nitride are gapped too wide for that instead, true insulators, left with
  // their own lattice vibration and nothing else (see
  // MOVE_COMPATIBILITY.insulator).
  2: [
    // Plasmon Pulse moveset -- see world 1's Graphene entry above.
    crystal('Graphene', 'metal', ['plasmonPulse', 'thermalFluctuation'], 0, 'layer'),
    // Ag's half-filled 5s conduction band gives it the sharpest free-electron
    // plasmon of any elemental metal -- real plasmonics/nanophotonics
    // overwhelmingly runs on silver (and gold) rather than graphene.
    crystal('Silver', 'metal', ['plasmonPulse', 'thermalFluctuation'], 1, undefined, 'Ag'),
    crystal('Gallium Nitride', 'semiconductor', ['tunnelStrike', 'thermalFluctuation'], 2, 'prism', 'GaN'),
    crystal('Magnesium Oxide', 'insulator', ['thermalFluctuation'], 0, undefined, 'MgO'),
    // Diamond's ~5.5 eV indirect gap is far too wide for doping or thermal
    // excitation to put a carrier in the conduction band -- the textbook
    // wide-gap covalent insulator, pristine (no nitrogen-vacancy or other
    // defect dressing).
    crystal('Diamond', 'insulator', ['thermalFluctuation'], 1, 'octahedral', 'C'),
    // ~5.9 eV gap, the other half (with Graphene) of the HYBRID_RECIPES
    // pairing below -- real graphene devices are almost always built on or
    // encapsulated in hBN specifically because its own lattice is nearly
    // commensurate with graphene's, letting an aligned stack open a moiré
    // superlattice rather than just inert dielectric support.
    crystal('Monolayer Boron Nitride', 'insulator', ['thermalFluctuation'], 2, 'layer', 'hBN'),
    // HYBRID_RECIPES parents (below) -- InAs's own role is providing the
    // strong spin-orbit coupling a Majorana wire needs; the 2H
    // (semiconducting) MoTe₂ monolayer is the untwisted parent that becomes
    // Twisted Bilayer MoTe₂ once fused with itself -- distinct from the
    // already-topological 1T′ monolayer phase (world 3's Monolayer WTe₂
    // sibling).
    crystal('Indium Arsenide', 'semiconductor', ['tunnelStrike', 'thermalFluctuation'], 1, undefined, 'InAs'),
    crystal('Monolayer MoTe₂ (2H)', 'semiconductor', ['tunnelStrike', 'thermalFluctuation'], 3, 'layer'),
    // HgTe's own bulk band structure is inverted -- Γ8/Γ6 touch at zero gap,
    // the same gapless character Graphene's own 'metal' entry above already
    // uses this type for, not an "ordinary gapped semiconductor" the way
    // CdTe genuinely is. That inversion is exactly why sandwiching HgTe
    // between CdTe barriers into a thin quantum well produces a protected
    // edge state (see World 10's HgTe/CdTe Quantum Well, the HYBRID_RECIPES
    // result of fusing this pair) -- the well's topology comes from HgTe's
    // own inverted bulk order, not from two ordinary semiconductors somehow
    // becoming special only once thinned.
    crystal('HgTe', 'metal', ['tunnelStrike', 'thermalFluctuation'], 4),
    crystal('CdTe', 'semiconductor', ['tunnelStrike', 'thermalFluctuation'], 5),
    // Tungsten's partially filled 5d bands make it an ordinary band
    // conductor -- its own interband transitions damp any plasmon response,
    // so it carries Electron Pulse rather than Silver's Plasmon Pulse, the
    // d-band conductor counterpart to that world's own free-electron metals.
    crystal('Tungsten', 'metal', ['tunnelStrike', 'thermalFluctuation'], 7, undefined, 'W'),
  ],
  3: [
    // Undoped host -- world 1's Chromium fuses into this to make Cr-doped
    // (Bi,Sb)₂Te₃ (HYBRID_RECIPES below), the quantum-anomalous-Hall state
    // that only appears once magnetism is doped in. A 3D bulk TI, so it
    // overrides back to 'prism' (quantumSpinHall's own default 'layer' is
    // sized for its quantum-well/monolayer members instead) -- its own
    // surface Dirac cone is genuinely helical (spin-momentum-locked,
    // time-reversal protected), the same boundary physics every other
    // 'quantumSpinHall' member hosts regardless of bulk dimensionality (see
    // types.ts's comment on that type).
    crystal('Bi₂Te₃', 'quantumSpinHall', ['helicalCurrent', 'tunnelStrike'], 0, 'rhombohedral'),
    // A bulk-derived monolayer's own quantum spin Hall state, same helical
    // boundary physics as Bi₂Te₃ above and the engineered HgTe/CdTe Quantum
    // Well (world 2's HgTe + CdTe fused, a World 10 wild -- see that pool's
    // own comment).
    crystal('Monolayer WTe₂', 'quantumSpinHall', ['helicalCurrent', 'thermalFluctuation'], 1, 'layerSquare'),
  ],
  // 'chernInsulator' rather than a dedicated field-driven-only type -- the
  // ordinary quantum Hall effect's quantized conductance is itself a Chern
  // number (the TKNN invariant), the same topological invariant this
  // world's own zero-field members carry, so both live under one type (see
  // types.ts's comment on it).
  4: [
    // Plain bulk Gallium Arsenide is an ordinary direct-gap III-V
    // semiconductor -- the integer quantum Hall effect this world's
    // zero-field chernInsulator members carry needs a clean 2D electron gas
    // confined at a GaAs/AlGaAs heterostructure interface under strong
    // field, a specific engineered device, not a property of bulk GaAs
    // itself, so it doesn't carry that type here.
    crystal('Gallium Arsenide', 'semiconductor', ['tunnelStrike', 'thermalFluctuation'], 0, undefined, 'GaAs'),
    crystal('Graphene (strong field)', 'chernInsulator', ['chiralCurrent', 'thermalFluctuation'], 1, 'layer'),
    // Real intrinsic magnetic topological insulator -- the actual zero-field
    // QAHE/Chern-insulator material, its magnetism built into the crystal
    // itself rather than doped in (contrast Cr-doped (Bi,Sb)₂Te₃, a World 10
    // hybrid-recipe result of doping Chromium into world 3's Bi₂Te₃).
    crystal('MnBi₂Te₄', 'chernInsulator', ['chiralCurrent', 'tunnelStrike'], 2, 'layer'),
  ],
  5: [
    crystal('Aluminum', 'superconductor', ['higgsOscillation', 'thermalFluctuation'], 0, 'cubic', 'Al'),
    crystal('Lead', 'superconductor', ['higgsOscillation', 'thermalFluctuation'], 1, 'cubic', 'Pb'),
    crystal('YBCO', 'superconductor', ['higgsOscillation', 'thermalFluctuation'], 2, 'tetragonal'),
    // Record near-room-temperature Tc (~250 K at ~170 GPa) -- still ordinary
    // (if spectacular) phonon-mediated BCS pairing, extreme electron-phonon
    // coupling from light hydrogen phonons in the hydride's clathrate cage,
    // not any topological mechanism.
    crystal('Lanthanum Decahydride', 'superconductor', ['higgsOscillation', 'thermalFluctuation'], 3, 'cubic', 'LaH₁₀'),
    // Niobium: the highest-Tc elemental BCS superconductor at ambient
    // pressure, same conventional family as Aluminum/Lead above. Tantalum
    // Disulfide's 1H phase is a standalone metallic/superconducting TMD
    // monolayer in its own right -- distinct from the 1T phase (world 8),
    // and the other half of the 1T/1H-TaS₂ heterostructure hybrid recipe.
    crystal('Niobium', 'superconductor', ['higgsOscillation', 'thermalFluctuation'], 4, 'cubic', 'Nb'),
    crystal('Tantalum Disulfide (1H)', 'superconductor', ['higgsOscillation', 'thermalFluctuation'], 5, 'layer', 'TaS₂ (1H)'),
    // Leading spin-triplet/chiral superconductor candidate -- huge
    // beyond-Pauli-limit critical fields and (contested) reports of
    // time-reversal-symmetry-breaking, chiral in-gap surface states.
    // A real intrinsic compound rather than a HYBRID_RECIPES result, so it
    // gets its topic's own world the same way world 4's MnBi₂Te₄ does -- kept
    // 'chernSuperconductor' rather than plain 'superconductor' since that
    // candidate topological pairing (not settled) is the entire reason it's
    // a research flagship, but honestly still a candidate, not confirmed.
    crystal('Uranium Ditelluride', 'chernSuperconductor', ['decoherenceWave', 'higgsOscillation'], 0, undefined, 'UTe₂'),
  ],
  6: [
    crystal('Iron', 'classicalMagnet', ['thermalFluctuation', 'magneticField'], 0, undefined, 'Fe'),
    crystal('Cobalt', 'classicalMagnet', ['thermalFluctuation', 'magneticField'], 1, undefined, 'Co'),
    // Mott-insulating antiferromagnet -- its magnetism comes from localized
    // moments and Hubbard U rather than Iron/Cobalt's itinerant band picture
    // above, but it's still ordinary (non-topological) magnon-carrying
    // classicalMagnet order, the same family as this world's other members.
    crystal('Manganese Oxide', 'classicalMagnet', ['thermalFluctuation', 'magneticField'], 2, undefined, 'MnO'),
    crystal('Chromium Triiodide', 'classicalMagnet', ['thermalFluctuation', 'magneticField'], 3, 'layer', 'CrI₃'),
    // Same van der Waals ferromagnet family as Chromium Triiodide above, the
    // other half of the NbSe₂/CrBr₃ topological-superconductor recipe.
    crystal('Chromium Tribromide', 'classicalMagnet', ['thermalFluctuation', 'magneticField'], 4, 'layer', 'CrBr₃'),
    // The magnonics workhorse -- lowest known magnon damping of any material,
    // the substrate real spin-wave-transport/magnon-BEC experiments actually
    // run on. Ferrimagnetic (two antiparallel sublattices with unequal
    // moment), but that's still magnon-carrying magnetic order, the same
    // 'classicalMagnet' slot Iron/Cobalt's itinerant ferromagnetism fills.
    crystal('Yttrium Iron Garnet', 'classicalMagnet', ['thermalFluctuation', 'magneticField'], 5, undefined, 'YIG'),
    // Type-II multiferroic from noncollinear/helimagnetic order down to the
    // monolayer limit (Song et al., Nature 2022) -- hosts genuine
    // electromagnons, 'multiferroic''s flagship. Same session (classical
    // magnetism/magnons) as the classicalMagnet compounds above, just a
    // distinct type once the noncollinear order starts coupling to electric
    // polarization.
    crystal('Monolayer NiI₂', 'multiferroic', ['electromagnonPulse', 'magneticField'], 1, 'layerTriangle'),
    // The flagship room-temperature single-phase multiferroic -- large
    // switchable polarization (Ti⁴⁺-analog off-centering, but from the Bi³⁺
    // lone pair) coexisting with G-type antiferromagnetic order carrying a
    // spin cycloid, with electromagnons directly observed in its THz/Raman
    // response (unlike Twisted CrI₃'s still-theoretical coupling below). A
    // bulk perovskite, not a 2D sheet, so it overrides back to 'prism' the
    // same way Bi₂Te₃ overrides quantumSpinHall's own 'layer' default.
    crystal('Bismuth Ferrite', 'multiferroic', ['electromagnonPulse', 'magneticField'], 0, 'rhombohedral', 'BiFeO₃'),
  ],
  7: [
    crystal('Herbertsmithite', 'quantumSpinLiquid', ['entanglementSwap', 'thermalFluctuation']),
    // Shastry-Sutherland dimerized/entangled ground state -- a textbook
    // triplon host, not just a generic spinon-carrying spin liquid.
    crystal('Strontium Copper Borate', 'quantumSpinLiquid', ['entanglementSwap', 'triplonSurge'], 1, undefined, 'SrCu₂(BO₃)₂'),
    // Quantum spin-dimer compound -- another textbook triplon example.
    crystal('Thallium Copper Chloride', 'quantumSpinLiquid', ['entanglementSwap', 'triplonSurge'], 2, undefined, 'TlCuCl₃'),
    // S=1 Haldane spin chain -- its ground state is closely related to the
    // AKLT state, the textbook exactly-solvable example matrix product
    // states/tensor networks are introduced with in the first place.
    crystal('Y₂BaNiO₅', 'quantumSpinLiquid', ['entanglementSwap', 'thermalFluctuation'], 3),
  ],
  8: [
    // A Kitaev spin liquid candidate -- α-RuCl₃'s Z2 topological order makes
    // it a genuine vison host, not just a generic spinon carrier.
    crystal('α-Ruthenium Trichloride', 'quantumSpinLiquid', ['entanglementSwap', 'visonLoop'], 0, undefined, 'RuCl₃'),
    // A Z2-spin-liquid candidate in its own right -- same vison flavor as
    // RuCl₃ above.
    crystal('Herbertsmithite', 'quantumSpinLiquid', ['entanglementSwap', 'visonLoop'], 1),
    crystal('YbMgGaO₄', 'quantumSpinLiquid', ['entanglementSwap', 'thermalFluctuation'], 2),
    // The star-of-David CDW Mott insulator / spin-liquid candidate phase --
    // the other half of the 1T/1H-TaS₂ heterostructure hybrid recipe (world
    // 5's 1H phase above).
    crystal('Tantalum Disulfide (1T)', 'quantumSpinLiquid', ['entanglementSwap', 'visonLoop'], 3, undefined, 'TaS₂ (1T)'),
    // Pyrochlore quantum-spin-ice candidate -- no magnetic order or freezing
    // down to ~20 mK, with a continuum interpreted as evidence for a U(1)
    // quantum spin liquid (emergent photon, gapped spinons). Its gauge
    // structure is U(1), not the Z2 the type's vison nominally models --
    // grouped in here anyway as spinon-carrying and never-ordering, the same
    // kind of deliberate simplification the taxonomy already makes for
    // triplon.
    crystal('Cerium Zirconate Pyrochlore', 'quantumSpinLiquid', ['entanglementSwap', 'thermalFluctuation'], 4, undefined, 'Ce₂Zr₂O₇'),
    // The flagship heavy-fermion/Kondo-lattice quantum-critical-point
    // material -- gives Kondo's own world a genuine Kondo-lattice compound
    // (none of the frustrated-magnet spin-liquid candidates above actually
    // are one).
    crystal('YbRh₂Si₂', 'kondoHeavyFermion', ['heavyFermionPulse', 'tunnelStrike'], 0),
    // A second Kondo-lattice flagship -- Ce 4f moments hybridizing with
    // conduction electrons into ~100-electron-mass quasiparticles, heavy-
    // fermion coherence right next to an antiferromagnetic quantum critical
    // point. (Its own T→0 ground state is actually a d-wave superconductor
    // built from those heavy quasiparticles -- kept 'kondoHeavyFermion'
    // rather than 'superconductor' since the Kondo-lattice physics is what
    // defines the compound, the same call YbRh₂Si₂ above already makes for
    // this type.)
    crystal('Cerium Cobalt Indide', 'kondoHeavyFermion', ['heavyFermionPulse', 'tunnelStrike'], 1, undefined, 'CeCoIn₅'),
  ],
  // World 9 hosts Yu-Shiba-Rusinov/vortex-bound (Majorana) defect states and
  // Friedel-oscillation impurity resonances, both textbook phenomena of a
  // superconductor's own disorder physics -- Fe(Te,Se) genuinely hosts
  // vortex-core Majorana bound states (Zhang et al., Science 2018), so it's
  // 'chernSuperconductor' rather than plain 'superconductor'; Niobium
  // Diselenide's Friedel oscillations are ordinary (non-topological)
  // impurity-resonance physics, so it stays plain 'superconductor'. Barium
  // Titanate/GeTe below aren't defect physics at all -- they're here because
  // ferroelectric has no course topic of its own, and this "any type" world
  // is where every homeless type ends up (see WORLD_CRYSTALS' own top
  // comment).
  9: [
    crystal('Fe(Te,Se)', 'chernSuperconductor', ['decoherenceWave', 'higgsOscillation'], 1, 'tetragonal'),
    crystal('Niobium Diselenide', 'superconductor', ['higgsOscillation', 'thermalFluctuation'], 2, 'prism', 'NbSe₂'),
    // Elemental Mn's own complex itinerant antiferromagnetism (same
    // "classicalMagnet" liberty already taken with Chromium) is beside the
    // point here -- it's the textbook itinerant local-moment magnet for this
    // topic.
    crystal('Manganese', 'classicalMagnet', ['thermalFluctuation', 'magneticField'], 3, undefined, 'Mn'),
    // The textbook ferroelectric -- its Ti⁴⁺ ion sits off-center below
    // ~120°C, giving the lattice a spontaneous switchable polarization. No
    // course topic covers ferroelectricity specifically, so like every other
    // type without a session of its own, it lives in this "any type" world
    // rather than being shoehorned into a topic that doesn't teach it.
    crystal('Barium Titanate', 'ferroelectric', ['ferronPulse', 'thermalFluctuation'], 0, undefined, 'BaTiO₃'),
    // Robust room-temperature ferroelectric Rashba semiconductor -- a
    // stronger, more switchable ferroelectric than BaTiO₃'s own ~120°C
    // transition, same type.
    crystal('GeTe', 'ferroelectric', ['ferronPulse', 'thermalFluctuation'], 1, 'rhombohedral'),
    // The CMOS-compatible ferroelectric behind real FeRAM/FeFET devices --
    // pristine, undoped epitaxial thin films switch too (Cheema et al.,
    // Nature 2020, strain rather than a dopant stabilizing the polar
    // orthorhombic Pca2₁ phase); bulk, un-strained HfO₂ is the ordinary
    // centrosymmetric monoclinic phase and not ferroelectric at all, so this
    // entry specifically means the thin-film phase.
    crystal('Hafnium Oxide', 'ferroelectric', ['ferronPulse', 'thermalFluctuation'], 2, 'shard', 'HfO₂'),
  ],
  // The Devouring Mirror's wilds are exactly the game's named hybrid materials --
  // every HYBRID_RECIPES result and nothing else -- so the corridor plays
  // back the player's own fusions/discoveries literally, not just as flavor
  // text. Worlds 1-9 never spawn a hybrid-recipe result as an ordinary wild
  // (see isHybridMaterial/getWildPool below); a compound reachable by fusion
  // is reachable *only* by fusion until the player reaches here.
  // WORLD_RIVALS[10] ("The Adapted") has no fixed type/look of its own at
  // all -- see that table's own comment.
  //
  // Every entry here draws as its two parents fused (the `hybridParents`
  // stamped on below HYBRID_RECIPES, rendered by art/crystals.ts's
  // drawHybridCrystal), which is the one thing in the game drawn from two
  // separate pieces -- every `CrystalVariant` habit is a single body, so two
  // shapes in one crystal always read as a fusion. Each entry still states
  // the habit its own lattice grows in, keeping the row a true description
  // of the compound even though the fused render is what a player sees.
  10: [
    crystal('Twisted Bilayer Graphene', 'superconductor', ['higgsOscillation', 'thermalFluctuation'], 0, 'layer'),
    // Majorana-nanowire platform -- engineered from an ordinary s-wave
    // superconductor (Aluminum) proximitizing a strong-spin-orbit
    // semiconductor (InAs), not an intrinsically chiral pairing, so it gets
    // Higgs alongside its Majorana Split rather than a Chiral Current.
    crystal('InAs/Al Majorana Wire', 'chernSuperconductor', ['decoherenceWave', 'higgsOscillation'], 1),
    crystal('CrI₃/NbSe₂ Topological-SC Heterostructure', 'chernSuperconductor', ['chiralCurrent', 'decoherenceWave'], 0, 'layer'),
    crystal('NbSe₂/CrBr₃ Topological-SC Heterostructure', 'chernSuperconductor', ['chiralCurrent', 'decoherenceWave'], 1, 'layer'),
    crystal('Twisted CrI₃', 'multiferroic', ['electromagnonPulse', 'magneticField'], 0),
    crystal('1T/1H-TaS₂ Heterostructure', 'kondoHeavyFermion', ['entanglementSwap', 'heavyFermionPulse'], 4, 'layer'),
    // Quantum anomalous Hall effect -- zero-field Chern insulator, from
    // doping magnetism into Bi₂Te₃ (world 3) -- 'chernInsulator', not
    // 'quantumSpinHall', since the Cr doping is specifically what breaks
    // time-reversal symmetry and turns the helical surface state into a
    // single chiral edge channel.
    crystal('Cr-doped (Bi,Sb)₂Te₃', 'chernInsulator', ['chiralCurrent', 'tunnelStrike'], 2),
    // The original 2D topological insulator (Bernevig-Hughes-Zhang model,
    // König et al., Science 2007) -- only the engineered quantum well is
    // topological, not either bulk parent (world 2's HgTe + CdTe) alone.
    crystal('HgTe/CdTe Quantum Well', 'quantumSpinHall', ['helicalCurrent', 'tunnelStrike'], 2, 'layerSquare'),
    // Twisted Bilayer MoTe₂'s zero-field *fractional* quantum Hall state
    // genuinely fractionalizes into charged anyons, unlike world 4's
    // ordinary integer-Landau-level members, so it lives under
    // 'fractionalChern' instead of 'chernInsulator' -- world 4's own
    // untwisted 2H monolayer parent fuses with itself to make this.
    crystal('Twisted Bilayer MoTe₂', 'fractionalChern', ['fluxTwist', 'thermalFluctuation'], 2),
    // Zero-field fractional quantum anomalous Hall (2023-2024), from
    // rhombohedral-stacked pentalayer graphene aligned to a hBN substrate --
    // fractionally quantized Hall plateaus at moiré filling, no applied
    // field needed, the same fractionalized-anyon-edge physics as Twisted
    // Bilayer MoTe₂ above by a different route (an aligned heterostructure
    // rather than a twist angle). HYBRID_RECIPES result of world 2's
    // Graphene + Monolayer Boron Nitride -- like every other recipe here,
    // narrative rather than literal 1:1 stoichiometry (this is five
    // graphene layers, not one).
    crystal('Rhombohedral Pentalayer Graphene/hBN Moiré', 'fractionalChern', ['fluxTwist', 'thermalFluctuation'], 4),
    // Fe chains on Pb (Nadj-Perge et al. 2014) -- topological
    // superconductivity from a magnetic chain on an s-wave SC, genuinely
    // 'chernSuperconductor' rather than plain 'superconductor': the whole
    // point is the Majorana zero modes at the chain's ends.
    crystal('Fe/Pb Majorana Chain', 'chernSuperconductor', ['decoherenceWave', 'chiralCurrent'], 2),
  ],
};

// World 9's rival -- an impurity/defect-bound resonance that can form in any
// host crystal -- has no single fixed type the way every other rival does,
// so its type (and, via RIVAL_9_NAMES below, its name) is rolled at random
// rather than authored. OverworldScene re-rolls it every time the player
// reaches World 9 and caches the result in the registry/save (`rival9Type`)
// for the rest of that visit, so the goal-tile boss preview and the actual
// battle still agree on which crystal it turned out to be.
export const RIVAL_9_TYPES: MaterialType[] = [
  'metal',
  'quantumSpinHall',
  'superconductor',
  'classicalMagnet',
  'quantumSpinLiquid',
  'multiferroic',
  'chernInsulator',
];

export function rollRival9Type(): MaterialType {
  return RIVAL_9_TYPES[Math.floor(Math.random() * RIVAL_9_TYPES.length)];
}

// A per-type polycrystalline-golem name (same "real compound, polycrystalline
// form" naming WORLD_RIVALS[1-8] uses, since an impurity/defect-bound
// resonance can form in any host crystal -- world 9's own rolled type just
// picks which host). Each entry is grounded in a real compound genuinely
// studied in polycrystalline form, matching the rolled MaterialType:
// - metal: polycrystalline silver -- screen-printed Ag paste is the ordinary
//   polycrystalline contact metal in real silicon solar cells.
// - quantumSpinHall: polycrystalline Bi₂Te₃ again (see WORLD_RIVALS[3]'s own
//   comment) -- the same host crystal defect physics can form in.
// - superconductor: polycrystalline niobium -- the actual engineering
//   superconductor (as Nb/NbTi) wound into MRI and accelerator magnets.
// - classicalMagnet: polycrystalline manganese (world 9's own Mn wild).
// - quantumSpinLiquid: polycrystalline Ce₂Zr₂O₇ -- inelastic neutron
//   scattering on this pyrochlore spin-liquid candidate was done on a
//   polycrystalline powder sample.
// - multiferroic: polycrystalline bismuth ferrite -- sintered BiFeO₃ ceramic
//   pellets are the standard bulk form multiferroics research runs on.
// - chernInsulator: polycrystalline MnBi₂Te₄ again (see WORLD_RIVALS[4]'s own
//   comment) -- deliberately not polycrystalline GaAs: GaAs only earns
//   `chernInsulator` here as an ultra-high-mobility single-crystal 2DEG
//   hosting field-driven Landau levels, so grain boundaries would broaden
//   away the exact physics that makes it this type. MnBi₂Te₄'s own intrinsic
//   magnetic order is what makes it a Chern insulator, and that's the same
//   order its neutron-powder-diffraction structure solve measured, so the
//   polycrystalline claim and the type-defining physics agree.
// Only ever looked up for RIVAL_9_TYPES' 7 members (the only types
// rivalImpurityResonance below is ever called with) -- covers those 7 and no
// others on purpose, rather than a full Record<MaterialType, string>, since
// the other 6 MaterialType members can never reach this lookup and inventing
// placeholder names for them would just be dead weight.
const RIVAL_9_NAMES: Partial<Record<MaterialType, string>> = {
  metal: 'Polycrystalline Silver Golem',
  quantumSpinHall: 'Polycrystalline Bismuth Telluride Golem',
  superconductor: 'Polycrystalline Niobium Golem',
  classicalMagnet: 'Polycrystalline Manganese Golem',
  quantumSpinLiquid: 'Polycrystalline Cerium Zirconate Pyrochlore Golem',
  multiferroic: 'Polycrystalline Bismuth Ferrite Golem',
  chernInsulator: 'Polycrystalline Manganese Bismuth Telluride Golem',
};

// The neutral "tarnished polycrystalline" grey the rolled type's own base
// color is pulled halfway toward below -- the same desaturation WORLD_RIVALS
// [3]/[4]/[6] reach for by hand, which is what marks a color as a golem's
// rather than a pristine wild crystal's.
const RIVAL_9_TARNISH = 0x6e737a;

// A fixed, broadly-compatible moveset (Electron Pulse + Phonon Beam) rather
// than one tailored per rolled type -- no single 2-move set could match
// every one of RIVAL_9_TYPES' seven very different classes anyway, and wild/
// rival movesets were never validated against MOVE_COMPATIBILITY (only the
// player's own moveset is, via getBattleMoves).
function rivalImpurityResonance(type: MaterialType): Material {
  // Every caller (rollRival9Type, and the cached rival9Type resolved from
  // it) only ever produces a RIVAL_9_TYPES member, which RIVAL_9_NAMES
  // covers completely -- see its own comment above.
  //
  // The color is derived from the rolled type's own base rather than picked
  // per type by hand the way WORLD_RIVALS[1-8]'s are: the roll is the whole
  // point of this rival -- the player reads which phase it turned out to be
  // off the golem's color -- so the color has to track TYPE_LOOK by
  // construction instead of through a parallel per-type table that could
  // drift from it. Reading `TYPE_LOOK[type].color` is fine here where
  // WORLD_RIVALS' own entries have to repeat the hex as a literal: only that
  // object literal's AST is reduced by scripts/content-lint.mjs and
  // scripts/gen-docs.mjs, never this function.
  return crystal(
    RIVAL_9_NAMES[type]!,
    type,
    ['tunnelStrike', 'thermalFluctuation'],
    0,
    undefined,
    undefined,
    blend(TYPE_LOOK[type].color, RIVAL_9_TARNISH, 0.5)
  );
}

// The single "beat this to unlock the guardian and the way onward" gate per
// world (DESIGN.md's world table, "Gate to next world" column) -- distinct
// from WORLD_CRYSTALS' ordinary wild encounters, which never block
// progress. World 9 has no static entry here -- see rivalImpurityResonance/
// getRival above and below.
export const WORLD_RIVALS: Partial<Record<number, Material>> = {
  // Every rival 1-8 is named for a real compound's polycrystalline form --
  // "many grains fused into one mass," the same theme art/boss.ts's golem
  // silhouette literalizes -- rather than a generic RPG monster name, so the
  // boss reads as an escalation of the physics the world already taught
  // rather than an unrelated label. Poly-Si is the textbook baseline: one of
  // the most common real polycrystalline materials (solar cells,
  // semiconductor manufacturing). Color: brightened toward a pale, cool
  // silvery-blue -- "the color of scoured silicon" (real polysilicon reads
  // as a light silvery grey with a cool cast). Each rival below sets its
  // color explicitly via `colorOverride` rather than `shadeStep` -- see
  // `crystal()`'s own comment above -- with a raw TYPE_LOOK hex repeated as
  // a literal rather than read via `TYPE_LOOK[type].color`: this object is
  // walked as literal AST nodes by scripts/content-lint.mjs and
  // scripts/gen-docs.mjs, and neither script's literal-reducer handles a
  // PropertyAccessExpression.
  1: crystal(
    'Polycrystalline Silicon Golem',
    'semiconductor',
    ['thermalFluctuation', 'tunnelStrike'],
    0,
    undefined,
    undefined,
    shade(0x5a7ca6, 32)
  ),
  // Polycrystalline silica -- quartz in grains, each grain its own small
  // perfect lattice, with a film of amorphous glass at every boundary
  // between them. Bloch's theorem needs its repetition to reach the edge of
  // the solid and here it stops at the edge of a grain, which makes it this
  // world's own 'insulator'-type answer to "what a band structure needs to
  // exist at all". Color: the type's pale grey-blue darkened to clouded
  // stone. Kept shy of true black (rather than a stronger `darken()`) so
  // art/boss.ts's own per-shard shadow-side darkening still leaves the
  // torso and lit-side limbs a visibly dark grey instead of crushing to
  // flat (0,0,0) once its offsets stack on top of this base.
  2: crystal(
    'Polycrystalline Silica Golem',
    'insulator',
    ['thermalFluctuation'],
    0,
    'prism',
    undefined,
    darken(0xb8c4cc, 48)
  ),
  // Bi₂Te₃ (world 3's own Bi₂Te₃ wild) is engineered polycrystalline on
  // purpose in real thermoelectric devices -- grain boundaries scatter
  // phonons and suppress thermal conductivity while preserving electrical
  // conductivity, boosting its thermoelectric figure of merit. Color:
  // `blend()`s the type's saturated purple most of the way toward a neutral
  // silver-grey for "tarnished silver," keeping a faint violet cast --
  // `hueShift()` alone can't desaturate a color, only rotate its hue, so it
  // can't reach a genuinely neutral tone the way this needs.
  3: crystal(
    'Polycrystalline Bismuth Telluride Golem',
    'quantumSpinHall',
    ['decoheredHelical', 'tunnelStrike'],
    0,
    'rhombohedral',
    undefined,
    blend(0x6a4ad9, 0x8f8f96, 0.68)
  ),
  // MnBi₂Te₄'s own magnetic structure was solved by neutron powder
  // diffraction on a polycrystalline sample -- the real intrinsic
  // zero-field Chern insulator world 4's own roster already hosts. Color:
  // `blend()`s the type's yellow-green almost entirely toward a dark
  // blue-grey slate tone, for "slate-dark layers."
  4: crystal(
    'Polycrystalline Manganese Bismuth Telluride Golem',
    'chernInsulator',
    ['decoheredChiral', 'tunnelStrike'],
    0,
    undefined,
    undefined,
    blend(0xc9d94a, 0x38424c, 0.85)
  ),
  // Polycrystalline YBCO's grain boundaries act as weak-link Josephson
  // junctions that cap its critical current -- the textbook example of
  // polycrystallinity mattering physically for a superconductor, not just
  // cosmetically. Color: darkened toward black ceramic with a teal cast --
  // as dark as the base color goes while still leaving art/boss.ts's torso
  // and lit-side limbs visibly non-black once their own darkening stacks on
  // top (see World 2's comment above for why this stops short of true
  // black).
  5: crystal(
    'Polycrystalline YBCO Golem',
    'superconductor',
    ['decoheredHiggs', 'tunnelStrike'],
    0,
    'tetragonal',
    undefined,
    darken(0x7fd1e8, 46)
  ),
  // Polycrystalline iron (grain-oriented electrical steel) is the classic
  // engineering ferromagnet -- domain structure and Hall-Petch strengthening
  // in bulk iron are both textbook polycrystalline-magnet topics. Color:
  // `blend()`s the type's orange-brown toward a neutral iron grey.
  6: crystal(
    'Polycrystalline Iron Golem',
    'classicalMagnet',
    ['decoheredMagnon', 'thermalFluctuation'],
    0,
    undefined,
    undefined,
    blend(0xc97a3a, 0x86898d, 0.88)
  ),
  // Herbertsmithite (world 7's own flagship, the one real compound its
  // lecture names) was first characterized as a polycrystalline powder --
  // large single crystals came only later. Color: brightened slightly past
  // the ordinary wild Herbertsmithite (which renders at the type's base
  // color exactly) for "pale green mineral," and left as this world's only
  // brighten-toward-base rival so it stays clearly distinct from World 8's
  // dark brown-black despite sharing the same `quantumSpinLiquid` base.
  7: crystal(
    'Polycrystalline Herbertsmithite Golem',
    'quantumSpinLiquid',
    ['decoheredSpinon', 'decoheredVison'],
    0,
    undefined,
    undefined,
    shade(0x5ad9c9, 8)
  ),
  // alpha-RuCl3 (world 8's own Kitaev-candidate wild) is routinely
  // characterized via polycrystalline powder susceptibility/specific-heat
  // measurements alongside single crystals. Color: rotates the same
  // `quantumSpinLiquid` base's cyan-green hue around to brown before
  // darkening, for "brown-black layers" -- distinct from World 7's pale
  // green despite the shared TYPE_LOOK base. `hueShift(x, 210)` rather than
  // `hueShift(x, -150)` (the equivalent rotation, since hue is circular) so
  // this stays a positive-only numeric-literal call -- see `darken()`'s own
  // comment in art/colors.ts for why a unary-minus literal argument here
  // would break content-lint/gen-docs.
  8: crystal(
    'Polycrystalline Ruthenium Trichloride Golem',
    'quantumSpinLiquid',
    ['decoheredSpinon', 'decoheredTriplon'],
    0,
    undefined,
    undefined,
    darken(hueShift(0x5ad9c9, 210), 50)
  ),
  // The finale: no real compound (see DESIGN.md §5's plot hook), and no
  // fixed type either -- "a model of you," decided live every fight
  // (BattleScene's own `adaptedForm`/`transmuteAdapted`): it starts the
  // battle mirroring the player's own current type, then transmutes into a
  // real compound's disguise every time the player lands a hit, reactively
  // taking on whichever quasiparticle class was just used against it. `type`
  // below is only a placeholder to satisfy Material's shape for the
  // pre-battle overworld/dialogue preview (OverworldScene's
  // spawnBossSprite/showRivalEncounter, both purely visual before the fight
  // actually starts) -- BattleScene never reads it once a battle begins.
  // Not built with crystal() (unlike every other entry here) since that
  // derives color/variant from TYPE_LOOK[type], which would tie this
  // placeholder type to a look that means something for every other
  // material; color/variant are set directly instead, for the featureless
  // dark-prism look a "no fixed identity" entity should have at rest. Its
  // color is the one fully unsaturated grey in the whole roster: every other
  // crystal's hue names its phase, and this thing has none of its own until
  // it takes the player's. Dark, but lifted off near-black so art/boss.ts's
  // own per-shard darkening still leaves the torso and head readable (the
  // same floor Worlds 2 and 5 above stop at). Excluded from gen-docs.mjs's
  // generated rivals table the same way World 9's rival already is (see
  // docs/crystals.md).
  10: {
    name: 'The Adapted',
    type: 'metal',
    color: 0x4a4a4a,
    variant: 'prism',
    moves: ['tunnelStrike', 'magneticField', 'fluxTwist', 'decoherenceWave'],
  },
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
// world's wild pool, not WORLD_RIVALS, since rivals are gate encounters, not
// collectible materials (matches OverworldScene.recordDiscovery's own rule)
// and so are never offered as a form to become.
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
// WORLD_CRYSTALS entry -- all of them live in World 10, see that pool's own
// comment -- reused as-is rather than duplicated, so a hybrid a player fuses
// and the same hybrid encountered wild are the exact same crystal.
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
  // superconductivity (Cao et al. 2018) -- a same-type (metal + metal)
  // fusion, deliberately allowed here since a named recipe covers it.
  { parents: ['Graphene', 'Graphene'], result: namedResult('Twisted Bilayer Graphene') },
  { parents: ['Chromium Triiodide', 'Niobium Diselenide'], result: namedResult('CrI₃/NbSe₂ Topological-SC Heterostructure') },
  // Cr doped into an undoped topological-insulator host breaks time-reversal
  // symmetry and induces the quantum anomalous Hall effect -- the actual
  // mechanism the compound's own name describes, unlike MnBi₂Te₄'s intrinsic
  // (undoped) magnetism above.
  { parents: ['Chromium', 'Bi₂Te₃'], result: namedResult('Cr-doped (Bi,Sb)₂Te₃') },
  // Literalizes the mechanic's own original worked example -- Fe chains on
  // a Pb superconductor (Nadj-Perge et al. 2014), the experiment the whole
  // Majorana-chain picture comes from. Like every other recipe result, it
  // lives only in World 10's pool.
  { parents: ['Iron', 'Lead'], result: namedResult('Fe/Pb Majorana Chain') },
  // Twisted CrI₃'s multiferroicity (electromagnons from noncollinear moiré
  // spin textures) is a theoretical proposal, not yet an established
  // experimental result -- see materialdex.ts's blurb for the honest framing.
  { parents: ['Chromium Triiodide', 'Chromium Triiodide'], result: namedResult('Twisted CrI₃') },
  // Fuses the untwisted 2H (semiconducting) monolayer into the *existing*
  // Twisted Bilayer MoTe₂ fractionalChern entry rather than a second,
  // redundant result -- that entry's own "zero-field fractional quantum Hall
  // from topological flat bands" already *is* the fractional Chern insulator
  // state.
  { parents: ['Monolayer MoTe₂ (2H)', 'Monolayer MoTe₂ (2H)'], result: namedResult('Twisted Bilayer MoTe₂') },
  // Kezilebieke et al., Nature 588, 424 (2020) -- CrBr₃/NbSe₂ topological
  // superconductivity with chiral Majorana edge modes.
  { parents: ['Niobium Diselenide', 'Chromium Tribromide'], result: namedResult('NbSe₂/CrBr₃ Topological-SC Heterostructure') },
  { parents: ['Tantalum Disulfide (1T)', 'Tantalum Disulfide (1H)'], result: namedResult('1T/1H-TaS₂ Heterostructure') },
  // König et al., Science 318, 766 (2007) -- neither parent is topological on
  // its own; only the thinned HgTe/CdTe quantum well is.
  { parents: ['HgTe', 'CdTe'], result: namedResult('HgTe/CdTe Quantum Well') },
  // Real graphene/hBN moiré devices are built by aligning graphene to a hBN
  // substrate specifically because their lattices are nearly commensurate --
  // the 2023-2024 zero-field FQAH result literalizes that same pairing, just
  // with pentalayer rhombohedral graphene rather than a single sheet.
  { parents: ['Graphene', 'Monolayer Boron Nitride'], result: namedResult('Rhombohedral Pentalayer Graphene/hBN Moiré') },
];

// Every HYBRID_RECIPES result also spawns as an ordinary wild in World 10
// (see WORLD_CRYSTALS[10]'s own comment) -- give it the same fused
// two-parent look a player gets from combineMaterials *before* any player
// ever fuses it, sorted the same order-independent way, so a wild encounter
// and a player-made hybrid of the same name render identically. Mutates the
// shared WORLD_CRYSTALS entry `namedResult` returned (not a copy), so every
// other reference to it -- Materialdex, world-10 spawns -- picks this up
// too; combineMaterials's own spread just recomputes the same values.
for (const { parents, result } of HYBRID_RECIPES) {
  const [a, b] = parents.map((n) => findMaterialByName(n)!);
  const [first, second] = [a, b].sort((x, y) => x.name.localeCompare(y.name));
  result.hybridParents = {
    colorA: first.color,
    variantA: first.variant,
    colorB: second.color,
    variantB: second.variant,
  };
}

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

export interface HybridCombo {
  result: Material;
  parentA: Material;
  parentB: Material;
}

// Every HYBRID_RECIPES result reachable from `pool` (materials the player
// could supply both parents of) -- Majorana's panel lists hybrids by result
// rather than walking a two-step ingredient pick, so it needs the whole
// reachable set at once rather than one pair resolved at a time. A
// same-name recipe (e.g. Graphene + Graphene) is reachable from a single
// pool entry of that name, since fusing doesn't consume the original
// crystal; a distinct-parent recipe needs both names present.
export function combinableHybridResults(pool: { name: string }[]): HybridCombo[] {
  const names = new Set(pool.map((m) => m.name));
  const out: HybridCombo[] = [];
  for (const { parents, result } of HYBRID_RECIPES) {
    const [nameA, nameB] = parents;
    const reachable = nameA === nameB ? names.has(nameA) : names.has(nameA) && names.has(nameB);
    if (!reachable) continue;
    out.push({ result, parentA: findMaterialByName(nameA)!, parentB: findMaterialByName(nameB)! });
  }
  return out;
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
// the old type-derived hybrid, the result's own name/type/moves are
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
  1: 'The Mean Fields',
  2: 'The Stone Lattice',
  3: 'The Edge Cliffs',
  4: 'The Storm Flats',
  5: 'The Vortex Glacier',
  6: 'The Iron Steppe',
  7: 'The Entangled Web',
  8: 'The Screened Swamp',
  9: 'The Defect Scars',
  10: 'The Devouring Mirror',
};

// The player-facing name of a world, for every place one is shown by name --
// the Lab's door station, Bloch's destination rows, a world's own entry
// banner. Falls back to "World N" for a number with no entry above.
export function worldName(world: number): string {
  return WORLD_NAMES[world] ?? `World ${world}`;
}

// World 9 (defects/excitations) additionally spawns every non-hybrid
// material from worlds 1-8 on top of its own dedicated defect compounds --
// the same "an impurity/defect-bound resonance can form in any host
// crystal" reasoning RIVAL_9_TYPES/rollRival9Type already use for its rival,
// literalized for its ordinary wild encounters too, and the reason World 9
// can host any type rather than a single course-topic type the way worlds
// 1-8 do. Hybrid-recipe results are excluded -- a fused state isn't "a
// defect in an earlier crystal," it's a different mechanic (Majorana's own
// panel, §5), and every one of them already lives only in World 10 (see
// WORLD_CRYSTALS[10]'s own comment), so none can appear in worlds 1-8 for
// this loop to inherit in the first place. Deduped by name so a compound
// that already repeats across worlds (Graphene, Herbertsmithite, ...)
// doesn't show up twice in world 9's own pool.
export function getWildPool(world: number): Material[] {
  const own = WORLD_CRYSTALS[world] ?? [];
  if (world !== 9) return own;
  const seen = new Set(own.map((m) => m.name));
  const fromEarlierWorlds: Material[] = [];
  for (let w = 1; w <= 8; w++) {
    for (const m of WORLD_CRYSTALS[w] ?? []) {
      if (isHybridMaterial(m.name) || seen.has(m.name)) continue;
      seen.add(m.name);
      fromEarlierWorlds.push(m);
    }
  }
  return [...own, ...fromEarlierWorlds];
}
