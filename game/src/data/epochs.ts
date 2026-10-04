import { clampEpoch, MAX_EPOCH } from './balance';
import type { Epoch } from './balance';
import { WORLD_NAMES } from './materials';

// The state side of the epochs (data/balance.ts's Epoch holds the numbers).
// An epoch is one pass over the ten worlds, and each one keeps its own
// progress: which rivals have fallen in it and which worlds the player has
// reached in it. A newly begun epoch therefore starts where the game itself
// did, in World 1 with every pass shut, and the worlds are walked in order
// again; going back to an earlier epoch finds it as it was left.
//
// The registry keys every scene already reads, `rivalDefeated` and
// `visitedWorlds`, always hold the *current* epoch's progress, so nothing
// that reads them needs to know epochs exist. The other epochs' progress
// waits in `epochProgress`, keyed by epoch, and switchEpoch swaps the two.
// `epochUnlocked` is the highest epoch ever begun: the map below World 10's
// cliff raises it (beginNextEpoch), and Bloch folds the player between the
// epochs up to it (scenes/panels/bloch.ts).
export interface EpochProgress {
  rivalDefeated: Record<number, boolean>;
  visitedWorlds: number[];
}

export type EpochProgressMap = Partial<Record<number, EpochProgress>>;

interface RegistryLike {
  get: (key: string) => unknown;
}

interface WritableRegistry extends RegistryLike {
  set: (key: string, value: unknown) => unknown;
  remove: (key: string) => unknown;
}

export function getEpoch(registry: RegistryLike): Epoch {
  return clampEpoch(registry.get('epoch'));
}

// Never below the epoch the save is on, whatever was stored.
export function getEpochUnlocked(registry: RegistryLike): Epoch {
  return Math.max(clampEpoch(registry.get('epochUnlocked')), getEpoch(registry)) as Epoch;
}

// One epoch's progress: the live registry keys for the epoch the save is on,
// the stash for any other. An epoch never entered reads as untouched.
export function epochProgressOf(registry: RegistryLike, epoch: Epoch): EpochProgress {
  if (epoch === getEpoch(registry)) {
    return {
      rivalDefeated: (registry.get('rivalDefeated') as Record<number, boolean>) ?? {},
      visitedWorlds: (registry.get('visitedWorlds') as number[]) ?? [],
    };
  }
  const stashed = ((registry.get('epochProgress') as EpochProgressMap) ?? {})[epoch];
  return { rivalDefeated: stashed?.rivalDefeated ?? {}, visitedWorlds: stashed?.visitedWorlds ?? [] };
}

// Whether every world's rival has fallen in an epoch (the one the save is on
// unless another is named). This is what the cliff's map asks for before it
// begins the next epoch, and what the after-story waits for (data/story.ts's
// AFTER_STORY). All ten, not the last alone: Bloch folds the player to any
// world already reached in the epoch, so The Adapted can be met with other
// passes still held.
export function allRivalsFallen(registry: RegistryLike, epoch: Epoch = getEpoch(registry)): boolean {
  const defeated = epochProgressOf(registry, epoch).rivalDefeated;
  return Object.keys(WORLD_NAMES).every((world) => !!defeated[Number(world)]);
}

// Every world the player has set foot in, in any epoch. What decides which
// course topics a question may draw on (Landau's Analytic question,
// Feynman's streak): a topic once met stays met when a new epoch sends the
// player back to World 1.
export function everVisitedWorlds(registry: RegistryLike): number[] {
  const seen = new Set<number>();
  for (let epoch = 1; epoch <= getEpochUnlocked(registry); epoch++) {
    for (const world of epochProgressOf(registry, epoch as Epoch).visitedWorlds) seen.add(world);
  }
  return [...seen];
}

// Moves the save onto another unlocked epoch: the current epoch's progress
// goes into the stash and the target's comes out of it. The map in progress
// (`mapState`, registry-only) belongs to the epoch being left, so it is
// dropped rather than resumed under the other epoch's rules. Does not
// persist; the caller does, with whatever else it changed.
export function switchEpoch(registry: WritableRegistry, target: Epoch): void {
  const current = getEpoch(registry);
  if (target === current || target > getEpochUnlocked(registry)) return;
  const stash: EpochProgressMap = { ...((registry.get('epochProgress') as EpochProgressMap) ?? {}) };
  stash[current] = epochProgressOf(registry, current);
  const next = epochProgressOf(registry, target);
  delete stash[target];
  registry.set('epochProgress', stash);
  registry.set('epoch', target);
  registry.set('rivalDefeated', next.rivalDefeated);
  registry.set('visitedWorlds', next.visitedWorlds);
  registry.remove('mapState');
}

// Whether the cliff's map can begin a new epoch from here: the save is on
// the latest one it has unlocked, that one is cleared, and there is one left.
export function canBeginNextEpoch(registry: RegistryLike): boolean {
  const epoch = getEpoch(registry);
  return epoch < MAX_EPOCH && epoch === getEpochUnlocked(registry) && allRivalsFallen(registry);
}

// Unlocks the next epoch and moves the save onto it, untouched: no rival
// fallen, no world reached. Returns whether it did. Does not persist.
export function beginNextEpoch(registry: WritableRegistry): boolean {
  if (!canBeginNextEpoch(registry)) return false;
  const next = (getEpoch(registry) + 1) as Epoch;
  registry.set('epochUnlocked', next);
  switchEpoch(registry, next);
  return true;
}
