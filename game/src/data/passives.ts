// Franklin (world 9) teaches three passive abilities instead of selling
// moves -- an always-on battle-wide effect rather than something picked
// from the move menu each turn, mirroring how Kondo's three screening moves
// are learned independently but only one is ever *usable* at a time
// (data/materials.ts's KONDO_MOVE_IDS/kondoActiveMove): every passive below
// can be bought independently (registry/save `passivesUnlocked`), but only
// one is ever active in battle (registry/save `activePassiveByOwner`, keyed
// by PassiveOwner), switched only by revisiting Franklin's panel
// (OverworldScene.showFranklinPanel). Unlike Kondo's moves, there's no
// per-turn choice and no duration/tick-down -- a passive is simply on for
// the whole battle it's active for, hooked directly into
// BattleScene.resolveHit's crit/turn-order/damage terms as flat always-on
// modifiers (see BattleScene's own comments for exactly where each one
// hooks in). `PassiveOwner` stays a keyed type rather than Franklin's ids
// living unkeyed, since `activePassiveByOwner`/`passivesUnlocked` are
// written generically against whichever owners exist.
export type PassiveOwner = 'franklin';

// Every current owner of a passive kit, in guardian order -- consumed by
// OverworldScene.applySuperpositionLeveling (one loop instead of one
// duplicated block per owner) and by the Lab's Abilities station
// (scenes/panels/hubStations.ts's showAbilitiesPanel).
export const PASSIVE_OWNERS: PassiveOwner[] = ['franklin'];

// Display name for each owner, used anywhere a passive's owner needs a
// human-readable label instead of a literal guardian name hardcoded at the
// call site (scenes/panels/hubStations.ts's showAbilitiesPanel).
export const PASSIVE_OWNER_LABELS: Record<PassiveOwner, string> = {
  franklin: 'Franklin',
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

// Descriptions are kept to one short clause each on purpose -- Franklin's
// panel (OverworldScene.showFranklinPanel) prints one under every
// still-unbought passive's buy button, on top of an already full-height
// guardian panel (avatar, intro quote, three buy rows, a Farewell footer),
// and that panel has no shrink-to-fit safety net the way showInfoPanel
// does, and a longer, multi-line description per passive pushed the whole
// panel's Farewell button off the bottom of the canvas the first time this
// was tried at the default preset already. Its own section
// passes `buttonPx` explicitly (addDialogueButtonAt, not the uncapped
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
    description: 'Coherent hits come twice as often, and each one throws off a secondary diffraction peak: a bonus follow-up damage tick.',
    cost: 45,
  },
  edgeCurrent: {
    id: 'edgeCurrent',
    name: 'Amorphous Halo',
    owner: 'franklin',
    description: 'A diffuse, defect-broadened halo softens the quasiparticle-mismatch double damage to a smaller multiplier.',
    cost: 45,
  },
};

export const FRANKLIN_PASSIVE_IDS = Object.values(PASSIVES)
  .filter((p) => p.owner === 'franklin')
  .map((p) => p.id);
