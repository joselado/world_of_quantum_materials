// Franklin (world 9) teaches passive abilities instead of selling moves --
// an always-on battle-wide effect rather than something picked from the
// move menu each turn. Every passive below can be bought independently
// (registry/save `passivesUnlocked`), but a passive is only ever *active*
// while it has room: the crystal's passive slots (registry/save
// `passiveSlotsByOwner`, none to start with, up to PASSIVE_MAX_SLOTS bought
// one at a time from Franklin at PASSIVE_SLOT_COSTS), and every passive
// takes up a fixed number of them (`Passive.slots` -- one for most, all
// three for Last Scattering and Full Reflection). Which ones are active
// lives in registry/save `activePassivesByOwner` (keyed by PassiveOwner, in
// the order they were equipped), switched only from Franklin's own panel
// (scenes/panels/franklin.ts). Unlike Kondo's moves, there's no per-turn
// choice and no duration/tick-down -- a passive is simply on for the whole
// battle it's active for, hooked directly into
// BattleScene.resolveHit/applyDamage as flat always-on terms (see
// BattleScene's own comments for exactly where each one hooks in).
// `PassiveOwner` stays a keyed type rather than Franklin's ids living
// unkeyed, since `activePassivesByOwner`/`passiveSlotsByOwner`/
// `passivesUnlocked` are written generically against whichever owners exist.
//
// A second kind of passive lives further down: BUILT_IN_PASSIVES, the
// abilities a crystal has by what it *is* rather than by what a guardian
// taught it (today just every hybrid material's Hybrid Aura). Those have no
// owner, no cost and no slot, are never persisted, and are derived from the
// material at the start of each battle (builtInPassiveIds) -- so they never
// enter the slot/unlock bookkeeping above at all.
import type { Material } from './types';
import { isHybridMaterial } from './materials';

export type PassiveOwner = 'franklin';

// Every current owner of a passive kit, in guardian order -- consumed by
// OverworldScene.applySuperpositionUnlocks (one loop instead of one
// duplicated block per owner) and by the Lab's Abilities station
// (scenes/panels/hubStations.ts's showAbilitiesPanel).
export const PASSIVE_OWNERS: PassiveOwner[] = ['franklin'];

// Display name for each owner, used anywhere a passive's owner needs a
// human-readable label instead of a literal guardian name hardcoded at the
// call site (scenes/panels/hubStations.ts's showAbilitiesPanel).
export const PASSIVE_OWNER_LABELS: Record<PassiveOwner, string> = {
  franklin: 'Franklin',
};

// The slot ladder: a crystal starts with no passive slot at all, and
// Franklin sells them one at a time, PASSIVE_SLOT_COSTS[n] for the (n+1)th,
// up to PASSIVE_MAX_SLOTS. Each step costs four times the one before, so
// the ladder reads as three different purchases rather than one price paid
// thrice: the first slot is about one world-9 battle stake
// (data/balance.ts's battleStakeForWorld, ~180 there) and is what makes any
// passive active at all; the second is a real late-game saving; the third
// -- the only way to hold Last Scattering or Full Reflection -- costs more
// than three of Skłodowska-Curie's per-class Ultimate unlocks
// (data/materials.ts's ULTIMATE_CLASS_UNLOCK_COST), a finale-scale goal
// rather than a world-9 shopping trip. A one-slot passive costs about what a
// first slot does (a 200-225 band, `cost` below), so learning a lesson and
// making room for it are purchases of the same size. A passive that takes
// all three slots is priced at ten times that band (2500-2750), since each
// one is a whole loadout by itself.
export const PASSIVE_MAX_SLOTS = 3;
export const PASSIVE_SLOT_COSTS: readonly number[] = [200, 800, 3200];

export interface Passive {
  id: string;
  name: string;
  owner: PassiveOwner;
  description: string;
  // Priced flat per passive rather than derived from a Move's `power` the
  // way data/balance.ts's shopCost() works -- a passive isn't a
  // quasiparticle with a power rating, so reusing shopCost would mean
  // inventing a fake power number just to feed it back in.
  cost: number;
  // How many of the crystal's passive slots this one takes up while active
  // (1..PASSIVE_MAX_SLOTS) -- the passive's weight in the loadout, sized by
  // how much of a fight it decides: a flat multiplier is one; a guaranteed
  // survival and three hits in ten bounced back whole are all three.
  slots: number;
}

// Descriptions are kept to one or two short clauses each on purpose --
// Franklin's panel (scenes/panels/franklin.ts) prints the selected one in
// its detail pane under a fixed-height art stage, and that pane has to
// close with a status line and a confirm button inside the canvas at the
// largest text-size preset (the same budget Kondo's own pane lives in).
export const PASSIVES: Record<string, Passive> = {
  // Franklin (world 9, X-ray diffraction of defect-riddled/porous carbon --
  // the real-world tie between Rosalind Franklin and "excitations and
  // defects"). The first three ids stay as originally minted
  // (fractionalGuard/anyonEcho/edgeCurrent) -- they were never
  // guardian-named, only the display text and underlying owner are
  // Franklin's; BattleScene's hooks read these same ids unmodified.
  fractionalGuard: {
    id: 'fractionalGuard',
    name: 'Diffraction Shadow',
    owner: 'franklin',
    description: 'A defect-riddled lattice scatters and attenuates an incoming blow, the way porous carbon attenuates an X-ray beam.',
    cost: 200,
    slots: 1,
  },
  anyonEcho: {
    id: 'anyonEcho',
    name: 'Satellite Reflection',
    owner: 'franklin',
    description: 'Coherent hits come twice as often, and each one throws off a secondary diffraction peak: a bonus follow-up damage tick.',
    cost: 225,
    slots: 1,
  },
  edgeCurrent: {
    id: 'edgeCurrent',
    name: 'Amorphous Halo',
    owner: 'franklin',
    description: 'A diffuse, defect-broadened halo softens the quasiparticle-mismatch double damage to a smaller multiplier.',
    cost: 225,
    slots: 1,
  },
  // Beer-Lambert attenuation: however thick and defect-riddled the sample,
  // the transmitted beam falls off exponentially and never reaches zero.
  // Takes every slot the crystal can have -- surviving one more hit than
  // the numbers allow is the strongest single thing a passive here does,
  // so it is the one lesson that is held alone.
  lastScattering: {
    id: 'lastScattering',
    name: 'Last Scattering',
    owner: 'franklin',
    description: 'An attenuated beam never drops to nothing: a blow that would finish you leaves one point of life, as long as you had more than one.',
    cost: 2750,
    slots: 3,
  },
  // Total external reflection: below the critical angle a grazing X-ray beam
  // reflects entirely off the surface and never enters the crystal at all.
  // Takes every slot too: bouncing three hits in ten back whole
  // (FULL_REFLECTION_CHANCE) decides a fight on its own.
  fullReflection: {
    id: 'fullReflection',
    name: 'Full Reflection',
    owner: 'franklin',
    description: 'Below the critical angle a beam reflects entirely off the surface: three incoming attacks in ten bounce back at the attacker, and you take nothing.',
    cost: 2500,
    slots: 3,
  },
};

export const FRANKLIN_PASSIVE_IDS = Object.values(PASSIVES)
  .filter((p) => p.owner === 'franklin')
  .map((p) => p.id);

// A passive a crystal carries by what it is: no owner, no cost, no slot,
// nothing bought and nothing to set aside. Read off the material itself
// (builtInPassiveIds below) rather than off any registry/save key, so a
// wild hybrid met in World 10 carries it exactly as a fused player does,
// and it can never go stale in a save. Kept out of PASSIVES on purpose:
// everything that reads PASSIVES (Franklin's panel, the slot math, the
// Superposition unlock grant, the halo dispatch, content-lint's per-passive
// checks) is about a passive that is bought and slotted, and none of that
// applies here. The battle hooks read these ids through the same
// activePassives() sets as Franklin's (BattleScene.create seeds both sides'
// sets with them), so a built-in passive is "active" in exactly the sense a
// Franklin one is -- just for a reason the player never chose.
export interface BuiltInPassive {
  id: string;
  name: string;
  description: string;
}

export const BUILT_IN_PASSIVES: Record<string, BuiltInPassive> = {
  // Every hybrid-recipe material (data/materials.ts's isHybridMaterial). An
  // engineered interface is more than either of its parents -- proximity
  // coupling across the seam lends each phase what the other has, which is
  // the whole point of building a heterostructure -- so a fused crystal
  // both hits harder and takes less, by HYBRID_AURA_ATTACK_MULT/
  // HYBRID_AURA_DAMAGE_MULT (data/balance.ts). No art of its own: the
  // additive glow every hybrid already wears (art/crystals.ts's
  // drawHybridCrystal) is the aura.
  hybridAura: {
    id: 'hybridAura',
    name: 'Hybrid Aura',
    description: 'Two phases coupled across one interface lend each other what neither has alone: your hits land 30% harder and every hit you take is softened by 30%. Built into every hybrid crystal, it takes no slot and is never set aside.',
  },
};

// The built-in passives a material carries -- today ['hybridAura'] for a
// hybrid-recipe result and [] for everything else. Judged by name, the same
// way Dresselhaus/Anderson/Majorana tell a hybrid apart, so a hybrid
// `playerForm` restored from an old save and a wild World 10 hybrid answer
// identically.
export function builtInPassiveIds(material: Pick<Material, 'name'>): string[] {
  return isHybridMaterial(material.name) ? ['hybridAura'] : [];
}

// Display name for any passive id, Franklin's or built-in -- undefined for
// a stale id left in an old save by a since-renamed passive, which callers
// (BattleScene's pill, the Lab's Abilities panel) simply skip.
export function passiveName(id: string): string | undefined {
  return PASSIVES[id]?.name ?? BUILT_IN_PASSIVES[id]?.name;
}

// Minimal structural registry type (same shape data/save.ts uses) so these
// readers stay Phaser-free and usable from any scene or panel.
interface RegistryLike {
  get: (key: string) => unknown;
}

export type ActivePassivesByOwner = Partial<Record<PassiveOwner, string[]>>;
export type PassiveSlotsByOwner = Partial<Record<PassiveOwner, number>>;

// The passives an owner currently has active, in the order they were
// equipped (oldest first) -- the order Franklin's panel uses to decide
// which ones a new pick takes the place of when there is no room left.
export function activePassiveIds(registry: RegistryLike, owner: PassiveOwner): string[] {
  const byOwner = (registry.get('activePassivesByOwner') as ActivePassivesByOwner | undefined) ?? {};
  return byOwner[owner] ?? [];
}

// Every active passive across every owner -- what a battle reads once at
// its start (BattleScene.create).
export function allActivePassiveIds(registry: RegistryLike): string[] {
  return PASSIVE_OWNERS.flatMap((owner) => activePassiveIds(registry, owner));
}

// How many passive slots this save has bought for an owner's kit
// (0..PASSIVE_MAX_SLOTS).
export function passiveSlotCount(registry: RegistryLike, owner: PassiveOwner): number {
  const byOwner = (registry.get('passiveSlotsByOwner') as PassiveSlotsByOwner | undefined) ?? {};
  return Math.min(PASSIVE_MAX_SLOTS, Math.max(0, byOwner[owner] ?? 0));
}

// How many slots a set of passive ids takes up together. A stale id from an
// old save (no PASSIVES entry) weighs nothing, the same way BattleScene's
// pill simply doesn't name it.
export function passiveSlotsUsed(ids: string[]): number {
  return ids.reduce((n, id) => n + (PASSIVES[id]?.slots ?? 0), 0);
}
