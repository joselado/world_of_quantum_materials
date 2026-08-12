// Every pure battle/economy formula in the game, kept deliberately free of
// any Phaser import (or anything that transitively imports Phaser) so it can
// be loaded straight into a plain Node script -- unlike materials.ts (which
// pulls in Phaser via art/colors.ts at module scope, needing `navigator`/
// `window` Node doesn't have), this module only ever imports plain types
// from ./types. `game/scripts/balance-sim.mjs` transpiles this file with the
// TypeScript compiler API and imports it directly, so the difficulty-curve
// simulator always runs the exact same math the game does, never a
// hand-copied duplicate. `data/materials.ts` and `scenes/BattleScene.ts`
// import from here rather than defining any of this locally; materials.ts
// re-exports the stat/economy exports so every existing call site
// (`import { shopCost, ... } from '../data/materials'`) keeps working
// unchanged.
import type { Move, Stats } from './types';

// --- Stats (DESIGN.md §3) --------------------------------------------------

export const BASE_STAT = 10;

export const DEFAULT_STATS: Stats = { quantumness: BASE_STAT, velocity: BASE_STAT, correlation: BASE_STAT };

// Enemy-stat growth is a two-phase curve, gentle through worlds 1-3 and
// steeper from world 4 on, rather than one flat per-world rate -- worlds 1-3
// teach the controls and the type system before the player has had a real
// chance to shop/transmute/level up, so they stay close to BASE_STAT; worlds
// 4-10 assume a player who has met the early guardians and can draw on their
// systems (Dresselhaus's transmutation, Laughlin's Analytic moves, Feynman's
// leveling, ...), so the gap that opens from there is meant to require
// actually using them, staying genuinely hard for a near-optimal build all
// the way to world 10. Correlation still gets the smaller share in both
// phases since its effect (defense = BASE_STAT / correlation) is already
// nonlinear, so each point there goes further than a flat point of
// Quantumness/Velocity.
const EARLY_PHASE_MAX_STEP = 2; // worlds 2-3 (steps 1-2 past world 1) grow at EARLY_GROWTH_PER_STEP
const EARLY_GROWTH_PER_STEP: Stats = { quantumness: 1, velocity: 1, correlation: 0.5 };
const LATE_GROWTH_PER_STEP: Stats = { quantumness: 3.5, velocity: 3.5, correlation: 2.2 };

// An opponent's stats are computed fresh from the world number at battle
// start rather than baked per-species, so difficulty climbs with the world
// rather than needing 30 hand-tuned stat blocks. Rounded to whole numbers at
// the end (the two growth rates above are fractional so the early/late slopes
// land where they do) -- Superposition Mode (OverworldScene's
// applySuperpositionLeveling) levels the player's own `playerStats` straight
// off this function's return value, and that stat trio is rendered as plain
// numbers in Noether's shop panel, so a fractional result would show up as a
// decimal stat there.
export function enemyStatsForWorld(world: number): Stats {
  const steps = Math.max(0, world - 1);
  const earlySteps = Math.min(steps, EARLY_PHASE_MAX_STEP);
  const lateSteps = Math.max(0, steps - EARLY_PHASE_MAX_STEP);
  return {
    quantumness: Math.round(BASE_STAT + earlySteps * EARLY_GROWTH_PER_STEP.quantumness + lateSteps * LATE_GROWTH_PER_STEP.quantumness),
    velocity: Math.round(BASE_STAT + earlySteps * EARLY_GROWTH_PER_STEP.velocity + lateSteps * LATE_GROWTH_PER_STEP.velocity),
    correlation: Math.round(BASE_STAT + earlySteps * EARLY_GROWTH_PER_STEP.correlation + lateSteps * LATE_GROWTH_PER_STEP.correlation),
  };
}

// Cost to raise a stat by 1 point from its current value, steepening as the
// player buys more (the same "priced to keep buying meaningful" shape as
// shopCost for moves).
export function statUpgradeCost(currentValue: number): number {
  return (currentValue - BASE_STAT + 1) * 50;
}

// Qumatessence price for a shop move, scaled off its own power -- the
// stronger the quasiparticle, the more it costs, the same "priced to keep
// buying meaningful" shape as statUpgradeCost. Shared by every guardian who
// sells moves for qumatessence (Noether, Laughlin, Kondo) --
// Skłodowska-Curie's Ultimate moves are the one exception, priced via
// ULTIMATE_CLASS_UNLOCK_COST instead (data/materials.ts).
export function shopCost(move: Move): number {
  return move.power * 5;
}

// --- Feynman's move-leveling (DESIGN.md §5, World 7) ------------------------

// Index 0 is the unleveled base case (1x power, no streak to clear); indices
// 1-3 are Double/Triple/Infinite -- a flat 1.5x/2x/3x multiplier, read by
// data/materials.ts's effectiveMovePower for an ordinary attack move and,
// separately, by BattleScene's kondoMitigationFraction for one of Kondo's
// three self-buffs, whose own `power` is never read as damage in the first
// place -- there it scales that buff's own mitigation strength instead.
export const MOVE_LEVEL_MULTIPLIERS: readonly number[] = [1, 1.5, 2, 3];

// How many of Feynman's own quiz questions the player must answer correctly
// in a row to land that tier -- missing even one loses the attempt (the
// qumatessence already spent per feynmanLevelCost below included) without
// changing the move's level.
export const MOVE_LEVEL_STREAKS: readonly number[] = [0, 2, 4, 8];

// Qumatessence cost to attempt leveling a move up to `level` (1, 2, or 3) --
// follows the same "priced off the move's own raw power" shape shopCost
// uses for an ordinary purchase (power x5), scaled again by the tier being
// attempted so a deeper tier costs proportionally more. Paid whether the
// attempt lands or not -- there is no refund on a miss.
export function feynmanLevelCost(move: Move, level: 1 | 2 | 3): number {
  return move.power * 5 * level;
}

// --- Battle stakes (DESIGN.md §4) -------------------------------------------

// Ordinary-battle qumatessence stake for a given world (1-10): won on a win,
// lost (floored at 0) on a loss. Scales linearly from 50 at world 1 to 200 at
// world 10 so the late game pays out meaningfully more than the early game,
// rounded to the nearest 10 for a clean progression. A rival fight pays out
// double this, win or lose -- see the call site, which derives it from this
// same function rather than a separate table, so the two can't drift apart.
export function battleStakeForWorld(world: number): number {
  const clamped = Math.min(10, Math.max(1, world));
  const raw = 50 + ((200 - 50) * (clamped - 1)) / 9;
  return Math.round(raw / 10) * 10;
}

// --- Franklin's passives (DESIGN.md §5, World 9) ----------------------------

// Diffraction Shadow (id fractionalGuard): incoming damage taken by the
// holder is multiplied down by this for the whole battle.
export const FRACTIONAL_GUARD_DAMAGE_MULT = 0.85;
// Satellite Reflection (id anyonEcho): bonus follow-up tick on a crit, as a
// fraction of the crit that triggered it.
export const ANYON_ECHO_FRACTION = 0.3;
// Amorphous Halo (id edgeCurrent): softened quasiparticle-mismatch
// multiplier for whichever side has it active as the defender (normally
// MISMATCH_MULTIPLIER, 2x).
export const EDGE_CURRENT_MISMATCH_MULT = 1.5;

// The ordinary quasiparticle-mismatch multiplier (DESIGN.md §3/§4) -- a
// defender whose own physics can't host the attacking move's class at all
// takes that hit at double force. Franklin's Amorphous Halo (above) softens
// this to EDGE_CURRENT_MISMATCH_MULT for whichever side has it active as the
// defender; every other hit uses this flat value.
export const MISMATCH_MULTIPLIER = 2;

// Scales one of Kondo's three buffs' base mitigation strength by the
// caster's own current move-level multiplier (MOVE_LEVEL_MULTIPLIERS),
// capped at `cap` so even an Infinite-tier buff leaves real risk on the
// table. The isPlayer-gating (`moveLevels` is the player's own save state,
// and no wild ever casts a Kondo move) stays in BattleScene.kondoMitigationFraction,
// which reads the registry for the level and calls this with the resolved
// multiplier -- this half is just the capped-scaling arithmetic.
export function mitigationFraction(levelMultiplier: number, base: number, cap: number): number {
  return Math.min(base * levelMultiplier, cap);
}

// --- Core damage resolution (BattleScene.resolveHit) ------------------------

// Quantumness -> crit ("coherent hit") chance (DESIGN.md §3).
export function critChance(attackerQuantumness: number): number {
  return clamp((attackerQuantumness - BASE_STAT) * 0.02, 0, 0.5);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Mirrors Phaser.Math.FloatBetween(min, max) (`min + rng() * (max - min)`) --
// reimplemented here rather than imported so this module stays Phaser-free.
function floatBetween(min: number, max: number, rng: () => number): number {
  return min + rng() * (max - min);
}

export interface ResolveHitParams {
  attackerStats: Stats;
  defenderStats: Stats;
  // The attacking move's own power -- callers pass effectiveMovePower's
  // result for the player's side (Feynman's leveling) or the move's raw
  // `power` for an opponent's.
  power: number;
  // Whether the defender's own physics can't host the attacking move's
  // quasiparticle class at all (data/materials.ts's canHost) -- gates
  // whether `mismatchMultiplier` below applies at all.
  mismatch: boolean;
  // The multiplier to apply when `mismatch` is true -- MISMATCH_MULTIPLIER
  // normally, EDGE_CURRENT_MISMATCH_MULT when the defender has Franklin's
  // Amorphous Halo active.
  mismatchMultiplier: number;
  // The pre-battle quiz's attack multiplier (1.5x/0.6x/1) for the player's
  // side, 1 for an opponent's.
  attackMult: number;
  // Laughlin's Analytic moves' answer-gated 2x/0.5x, or Skłodowska-Curie's
  // Ultimate moves' all-or-nothing 1x/0x -- 1 for every ordinary move.
  bonusMultiplier: number;
  // Kondo's Shielded buff on the defender's side (statusShieldMultiplier) --
  // 1 when not shielded.
  shieldedMult: number;
  // Franklin's Diffraction Shadow on the defender's side -- 1 when inactive.
  fractionalGuardMult: number;
  // Injectable RNGs (default Math.random) so a caller (the balance
  // simulator, a future test) can drive deterministic or repeated rolls
  // instead of one live Math.random() sample per hit. Two separate RNGs,
  // called in the same order resolveHit always has (crit roll first, then
  // damage-variance roll), matching Phaser.Math.FloatBetween's own single
  // Math.random() draw.
  critRng?: () => number;
  varianceRng?: () => number;
}

export interface ResolveHitOutcome {
  damage: number;
  crit: boolean;
}

// The exact math BattleScene.resolveHit runs to turn one hit's inputs into a
// damage number and whether it crit -- crit chance from the attacker's
// Quantumness, a defense factor from the defender's Correlation
// (BASE_STAT / correlation), the quasiparticle-mismatch multiplier, every
// other multiplicative term (quiz/Analytic/Ultimate bonus, Kondo Shielded,
// Franklin Diffraction Shadow), a 1.5x crit bonus, and +/-15% damage
// variance, all multiplied together and rounded once at the end.
export function resolveHitDamage(params: ResolveHitParams): ResolveHitOutcome {
  const chance = critChance(params.attackerStats.quantumness);
  const crit = (params.critRng ?? Math.random)() < chance;
  const variance = floatBetween(0.85, 1.15, params.varianceRng ?? Math.random);
  const mismatchMult = params.mismatch ? params.mismatchMultiplier : 1;
  const defenseFactor = BASE_STAT / params.defenderStats.correlation;
  const damage = Math.round(
    params.power *
      mismatchMult *
      params.attackMult *
      params.bonusMultiplier *
      params.shieldedMult *
      params.fractionalGuardMult *
      defenseFactor *
      (crit ? 1.5 : 1) *
      variance
  );
  return { damage, crit };
}
