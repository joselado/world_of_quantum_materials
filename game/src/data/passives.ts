// Laughlin (world 4) and Bohr (world 7) each teach three passive abilities
// instead of selling moves -- an always-on battle-wide effect rather than
// something picked from the move menu each turn, mirroring how Kondo's three
// screening moves are learned independently but only one is ever *usable* at
// a time (data/materials.ts's KONDO_MOVE_IDS/kondoActiveMove): every passive
// below can be bought independently (registry/save
// `laughlinPassivesUnlocked`/`bohrPassivesUnlocked`), but only one per
// guardian is ever active in battle (`laughlinActivePassive`/
// `bohrActivePassive`), switched only by revisiting that guardian's panel
// (OverworldScene.showLaughlinPanel/showBohrPanel). Unlike Kondo's moves,
// there's no per-turn choice and no duration/tick-down -- a passive is
// simply on for the whole battle it's active for, hooked directly into
// BattleScene.resolveHit's crit/turn-order/damage terms as flat always-on
// modifiers (see BattleScene's own comments for exactly where each one
// hooks in).
export type PassiveOwner = 'laughlin' | 'bohr';

export interface Passive {
  id: string;
  name: string;
  owner: PassiveOwner;
  description: string;
  // Priced flat per passive rather than derived from a Move's `power` the
  // way OverworldScene's shopCost() works -- a passive isn't a
  // quasiparticle with a power rating, so reusing shopCost would mean
  // inventing a fake power number just to feed it back in.
  cost: number;
}

// Descriptions are kept to one short clause each on purpose -- Laughlin's/
// Bohr's panels (OverworldScene.showLaughlinPanel/showBohrPanel) print one
// under every still-unbought passive's buy button, on top of an already
// full-height guardian panel (avatar, intro quote, three buy rows, a
// Farewell footer), and that panel has no shrink-to-fit safety net the way
// BattleScene's move menu does -- a longer, multi-line description per
// passive pushed the whole panel past the canvas once tried.
export const PASSIVES: Record<string, Passive> = {
  // Laughlin (world 4, fractional quantum Hall / anyons).
  fractionalGuard: {
    id: 'fractionalGuard',
    name: 'Fractional Guard',
    owner: 'laughlin',
    description: 'Incoming damage is multiplied down for the whole battle.',
    cost: 40,
  },
  anyonEcho: {
    id: 'anyonEcho',
    name: 'Anyon Echo',
    owner: 'laughlin',
    description: 'A critical hit triggers a bonus follow-up damage tick.',
    cost: 45,
  },
  edgeCurrent: {
    id: 'edgeCurrent',
    name: 'Edge Current',
    owner: 'laughlin',
    description: 'Softens the quasiparticle-mismatch double damage to a smaller multiplier.',
    cost: 45,
  },
  // Bohr (world 7, entanglement / EPR).
  correlatedResponse: {
    id: 'correlatedResponse',
    name: 'Correlated Response',
    owner: 'bohr',
    description: "An opponent's crit against you guarantees your own next move crits.",
    cost: 40,
  },
  nonlocalCorrelation: {
    id: 'nonlocalCorrelation',
    name: 'Nonlocal Correlation',
    owner: 'bohr',
    description: "Boosts your Correlation by a share of the opponent's Quantumness.",
    cost: 45,
  },
  sharedState: {
    id: 'sharedState',
    name: 'Shared State',
    owner: 'bohr',
    description: 'A share of damage you deal returns to you as healing.',
    cost: 50,
  },
};

export const LAUGHLIN_PASSIVE_IDS = Object.values(PASSIVES)
  .filter((p) => p.owner === 'laughlin')
  .map((p) => p.id);

export const BOHR_PASSIVE_IDS = Object.values(PASSIVES)
  .filter((p) => p.owner === 'bohr')
  .map((p) => p.id);
