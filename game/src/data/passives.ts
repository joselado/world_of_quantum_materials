// Franklin (world 9) and Bohr (world 7) each teach three passive abilities
// instead of selling moves -- an always-on battle-wide effect rather than
// something picked from the move menu each turn, mirroring how Kondo's three
// screening moves are learned independently but only one is ever *usable* at
// a time (data/materials.ts's KONDO_MOVE_IDS/kondoActiveMove): every passive
// below can be bought independently (registry/save `passivesUnlocked`, a
// flat list shared across both owners since passive ids are globally
// unique), but only one per owner is ever active in battle (registry/save
// `activePassiveByOwner`, keyed by PassiveOwner), switched only by
// revisiting that guardian's panel (OverworldScene.showFranklinPanel/
// showBohrPanel). Unlike Kondo's moves, there's no per-turn choice and no
// duration/tick-down -- a passive is simply on for the whole battle it's
// active for, hooked directly into BattleScene.resolveHit's crit/turn-order/
// damage terms as flat always-on modifiers (see BattleScene's own comments
// for exactly where each one hooks in).
export type PassiveOwner = 'franklin' | 'bohr';

// Every current owner of a passive kit, in guardian order -- consumed by
// OverworldScene.applySuperpositionLeveling (one loop instead of one
// duplicated block per owner) and by showAbilitiesPanel (the "View
// Abilities" pause-menu list).
export const PASSIVE_OWNERS: PassiveOwner[] = ['franklin', 'bohr'];

// Display name for each owner, used anywhere a passive's owner needs a
// human-readable label instead of a literal guardian name hardcoded at the
// call site (OverworldScene.showAbilitiesPanel).
export const PASSIVE_OWNER_LABELS: Record<PassiveOwner, string> = {
  franklin: 'Franklin',
  bohr: 'Bohr',
};

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

// Descriptions are kept to one short clause each on purpose -- Franklin's/
// Bohr's panels (OverworldScene.showFranklinPanel/showBohrPanel) print one
// under every still-unbought passive's buy button, on top of an already
// full-height guardian panel (avatar, intro quote, three buy rows, a
// Farewell footer), and that panel has no shrink-to-fit safety net the way
// showInfoPanel does, and a longer, multi-line description per passive
// pushed the whole panel's Farewell button off the bottom of the canvas the
// first time this was tried at the default preset already. Both sections
// pass `buttonPx` explicitly (addDialogueButtonAt, not the uncapped
// addDialogueButton convenience wrapper) for exactly this reason.
export const PASSIVES: Record<string, Passive> = {
  // Franklin (world 9, X-ray diffraction of defect-riddled/porous carbon --
  // the real-world tie between Rosalind Franklin and "excitations and
  // defects"). Ids stay as originally minted (fractionalGuard/anyonEcho/
  // edgeCurrent) -- they were never guardian-named, only the display text
  // and underlying owner change here; BattleScene's hooks read these same
  // ids unmodified.
  fractionalGuard: {
    id: 'fractionalGuard',
    name: 'Diffraction Shadow',
    owner: 'franklin',
    description: 'A defect-riddled lattice scatters and attenuates an incoming blow, the way porous carbon attenuates an X-ray beam.',
    cost: 40,
  },
  anyonEcho: {
    id: 'anyonEcho',
    name: 'Satellite Reflection',
    owner: 'franklin',
    description: 'A critical hit throws off a secondary diffraction peak -- a bonus follow-up damage tick.',
    cost: 45,
  },
  edgeCurrent: {
    id: 'edgeCurrent',
    name: 'Amorphous Halo',
    owner: 'franklin',
    description: 'A diffuse, defect-broadened halo softens the quasiparticle-mismatch double damage to a smaller multiplier.',
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

export const FRANKLIN_PASSIVE_IDS = Object.values(PASSIVES)
  .filter((p) => p.owner === 'franklin')
  .map((p) => p.id);

export const BOHR_PASSIVE_IDS = Object.values(PASSIVES)
  .filter((p) => p.owner === 'bohr')
  .map((p) => p.id);
