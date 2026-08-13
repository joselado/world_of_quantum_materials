// Every pure battle/economy formula in the game, kept deliberately free of
// any Phaser import (or anything that transitively imports Phaser) so it can
// be loaded straight into a plain Node script -- unlike materials.ts (which
// pulls in Phaser via art/colors.ts at module scope, needing `navigator`/
// `window` Node doesn't have), this module only imports plain types from
// ./types and ./settings (also Phaser-free). `game/scripts/balance-sim.mjs`
// transpiles this file with the TypeScript compiler API and imports it
// directly, so the difficulty-curve simulator always runs the exact same
// math the game does, never a hand-copied duplicate. `data/materials.ts` and
// `scenes/BattleScene.ts` import from here rather than defining any of this
// locally; materials.ts re-exports the stat/economy exports so every
// existing call site (`import { shopCost, ... } from '../data/materials'`)
// keeps working unchanged.
import type { Move, Stats } from './types';
import type { DifficultyTier } from './settings';

// --- Stats (DESIGN.md §3) --------------------------------------------------

export const BASE_STAT = 1;

// Noether's stat shop (panels/noether.ts's renderShopStats) refuses to sell
// a stat past this -- the one hard ceiling in the stat system, everything
// else (crit chance, the multi-hit ratio) is shaped to make full use of the
// entire BASE_STAT-to-MAX_STAT range rather than plateauing early within it.
export const MAX_STAT = 100;

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
// phases -- its own effect on defense (defenseFactor below) isn't a flat
// per-point rate the way a raw stat difference is, so it's weighted lighter
// here to keep the overall climb balanced (`npm run balance-sim`-verified,
// not derived in closed form). Scaled to a tenth of BASE_STAT itself
// (0.1/0.35 per step rather than 1/3.5) so the curve's overall shape stays
// the same relative size it was before BASE_STAT moved to 1 -- unscaled, a
// whole-point-per-step growth would swing every world's difficulty far more
// violently against a BASE_STAT of 1 than it used to against 10 (see
// enemyStatsForWorld's own comment on why the result stays fractional
// rather than rounding here, which is what makes a sub-1 per-step rate
// actually register instead of vanishing under Math.round).
const EARLY_PHASE_MAX_STEP = 2; // worlds 2-3 (steps 1-2 past world 1) grow at EARLY_GROWTH_PER_STEP
const EARLY_GROWTH_PER_STEP: Stats = { quantumness: 0.1, velocity: 0.1, correlation: 0.05 };
const LATE_GROWTH_PER_STEP: Stats = { quantumness: 0.35, velocity: 0.35, correlation: 0.22 };

// The Lab's Settings station (data/settings.ts's DifficultyTier/
// DIFFICULTY_TIER_PRESETS) scales the whole curve above by one of these,
// rather than offering a second hand-tuned curve -- M.Sc. is "the intended
// default" every other constant in this file is written and `npm run
// balance-sim`-verified against, so it's the one tier that leaves the curve
// untouched. B.Sc. and Ph.D.'s own values are themselves balance-sim-
// verified: B.Sc.'s simulated archetype (50% quiz accuracy, never
// transmutes) can clear all 10 worlds at its own multiplier where it
// couldn't at 1, and Ph.D.'s (always answers right, transmutes for type
// advantage) stays under real pressure at its own multiplier where margins
// at 1 had grown too comfortable by the late game.
export const DIFFICULTY_MULTIPLIERS: Record<DifficultyTier, number> = {
  bsc: 0.6,
  msc: 1,
  phd: 1.4,
};

// An opponent's stats are computed fresh from the world number (and the
// active difficulty tier's multiplier, read live off the registry by every
// caller so a mid-playthrough Settings change applies to the player's very
// next fight) at battle start rather than baked per-species, so difficulty
// climbs with the world rather than needing 30 hand-tuned stat blocks per
// tier. Left fractional rather than rounded here -- unlike the player's own
// `playerStats` (always a whole number, since Noether's shop displays and
// sells them one point at a time), an opponent's stats are never shown to
// the player as a number at all, only felt through hit chance/damage/turn
// order, so there's nothing for fractional precision to look wrong in and
// every bit of it stays available to the two-phase growth curve (and the
// difficulty multiplier on top of it). BattleScene.create still rounds an
// ordinary wild's own +/-15% `rollEncounterFactor` roll on top of this (a
// specimen's HP bar-relative toughness has to be a whole number), and
// Superposition Mode's `OverworldScene.applySuperpositionLeveling` rounds
// separately when it copies this function's result into the player's own
// `playerStats` -- this function itself is the one shared source both round
// from, so neither rounding rule has to duplicate the other's math.
export function enemyStatsForWorld(world: number, difficultyMultiplier = 1): Stats {
  const steps = Math.max(0, world - 1);
  const earlySteps = Math.min(steps, EARLY_PHASE_MAX_STEP);
  const lateSteps = Math.max(0, steps - EARLY_PHASE_MAX_STEP);
  return {
    quantumness: (BASE_STAT + earlySteps * EARLY_GROWTH_PER_STEP.quantumness + lateSteps * LATE_GROWTH_PER_STEP.quantumness) * difficultyMultiplier,
    velocity: (BASE_STAT + earlySteps * EARLY_GROWTH_PER_STEP.velocity + lateSteps * LATE_GROWTH_PER_STEP.velocity) * difficultyMultiplier,
    correlation: (BASE_STAT + earlySteps * EARLY_GROWTH_PER_STEP.correlation + lateSteps * LATE_GROWTH_PER_STEP.correlation) * difficultyMultiplier,
  };
}

// Superposition Mode's own flat, world-independent opponent baseline
// (BattleScene.create's own isSuperpositionMode branch) -- once every player
// stat is pinned to MAX_STAT (OverworldScene's applySuperpositionUnlocks),
// there's no "this world is harder than the last" progression left to track
// on the opponent's side either, so every fight in this mode draws from this
// single representative value instead of enemyStatsForWorld's own per-world
// climb. Deliberately NOT an average of enemyStatsForWorld's own (small,
// BASE_STAT-anchored) curve -- a maxed-out player's own Correlation already
// floors incoming damage (defenseFactor above) regardless of how strong a
// small-numbered opponent is, so an averaged opponent (worked out to ~1-3)
// was a one-hit stomp in practice. SUPERPOSITION_BASE_ENEMY_STAT is picked
// (and `npm run balance-sim`-adjacent hand math-verified, not derived in
// closed form) so that MAX_STAT reduces to a genuinely close fight -- k/d
// close to the low single digits, the same shape a real Story Mode fight
// has, not a 60+ round grind -- with the difficulty tier's own multiplier
// on top giving real separation between tiers (M.Sc.'s `1` sits right at
// that close-fight value; Ph.D.'s `1.4` pushes past MAX_STAT, where
// Quantumness/Correlation's own plateau keeps it merely tighter rather than
// unwinnable; B.Sc.'s `0.6` sits comfortably below it).
const SUPERPOSITION_BASE_ENEMY_STAT = 80;
export function superpositionEnemyStats(difficultyMultiplier = 1): Stats {
  const stat = SUPERPOSITION_BASE_ENEMY_STAT * difficultyMultiplier;
  return { quantumness: stat, velocity: stat, correlation: stat };
}

// Correlation prices the same as Quantumness/Velocity -- all three now share
// the same "full range stays meaningful, then plateaus" shape (critChance,
// the multi-hit ratio, and defenseFactor's own concave climb below), so
// there's no longer a reason for Correlation to cost more per point the way
// it did when `defenseFactor` was a bare, never-plateauing `BASE_STAT /
// correlation` hyperbola. Kept as its own named constant (rather than
// deleting the differential-pricing machinery below) since re-introducing a
// per-stat multiplier is one constant away if a future formula change
// reopens the gap -- checked against `npm run balance-sim`'s difficulty
// curve, not derived in closed form (see that script's own header for what
// it simulates).
const CORRELATION_COST_MULTIPLIER = 1;

// Cost to raise a stat by 1 point from its current value, steepening as the
// player buys more (the same "priced to keep buying meaningful" shape as
// shopCost for moves). `stat` is required, not defaulted -- a call site that
// forgot which stat it was buying would otherwise silently charge the wrong
// rate if CORRELATION_COST_MULTIPLIER above ever moves off 1 again, rather
// than failing loudly.
export function statUpgradeCost(currentValue: number, stat: keyof Stats): number {
  const base = (currentValue - BASE_STAT + 1) * 50;
  return stat === 'correlation' ? base * CORRELATION_COST_MULTIPLIER : base;
}

// --- Max HP (BattleScene.create, no material carries its own intrinsic HP) -

// No `Material` (wild, rival, or the player's own current form) carries an
// intrinsic HP number at all -- max HP is purely a function of which world
// the fight is happening in, read live by `BattleScene.create` rather than
// stored anywhere in `data/materials.ts`. Two separate curves below: an
// ordinary wild's (gentle, randomized per encounter) and a rival's (steeper,
// fixed) -- transmuting/fusing into a different crystal form never changes
// max HP by itself, only look/type/moveset do.

const WILD_HP_BASE = 23;
// Linear rather than enemyStatsForWorld's own two-phase curve -- a wild's HP
// is a much smaller part of a fight's difficulty than its Quantumness/
// Velocity/Correlation (which still follow that two-phase ramp), so it only
// needs a gentle, steady climb: +10 total from World 1 to World 10, landing
// near World 1's own historical ~23 baseline.
const WILD_HP_GROWTH_PER_WORLD = 10 / 9;

// An ordinary wild's (and the player's own) base max HP for a given world --
// shared by every crystal in that world's WORLD_CRYSTALS list, so a compound
// appearing in more than one world's list (e.g. Iron in World 1 and World 6)
// still comes out independently leveled per world purely because `world`
// differs at each read site, not because of anything about the compound
// itself. There is deliberately no per-compound term at all -- an exotic-
// tier crystal is no tougher, HP-wise, than a plain one from the same world;
// power/exoticism is expressed entirely through its own move's `power`.
// `BattleScene.create` scales this by `rollEncounterFactor` for an ordinary
// wild opponent's actual battle HP (sample-to-sample specimen variance); the
// player's own max HP uses this same un-rolled value for whichever world
// they're currently in, no roll (their own body isn't a specimen with
// variance). Rivals use `rivalHpForWorld` below instead, not this.
export function wildHpForWorld(world: number): number {
  return Math.round(WILD_HP_BASE + WILD_HP_GROWTH_PER_WORLD * (world - 1));
}

// A rival's own max HP, a separate and much steeper curve than an ordinary
// wild's -- "many grains fused into one boss-scale mass" (WORLD_RIVALS' own
// polycrystalline-golem framing) is meant to read as a genuine wall relative
// to that world's ordinary wilds, not just a slightly bigger one. Loosely
// calibrated to the golems' own historical 30/38/42/46/50/54/58/62 (worlds
// 1-8) rather than reproducing it exactly -- linear growth landing on that
// same 30 at World 1 and 62 at World 8, extended sensibly through World 9
// (the rolled impurity resonance) and World 10 ("The Adapted"). No random
// roll, unlike an ordinary wild -- a rival is a fixed, known, repeatable
// challenge, the same boss every time it's fought.
const RIVAL_HP_BASE = 30;
const RIVAL_HP_GROWTH_PER_WORLD = 4.5;
export function rivalHpForWorld(world: number): number {
  return Math.round(RIVAL_HP_BASE + RIVAL_HP_GROWTH_PER_WORLD * (world - 1));
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

// --- Kondo's self-buffs (DESIGN.md §5, World 8) -----------------------------

// How many turns one of Kondo's three buffs (BattleScene's StatusKind) lasts
// once cast, counted down in BattleScene.tickStatuses.
export const STATUS_DURATION = 3;
// Each of Kondo's three buffs has a base mitigation strength (at move level
// 0, i.e. before Feynman's leveling, §5 World 7) and a hard cap it can never
// reach/exceed regardless of level, so even an "Infinite"-tier buff leaves
// real risk on the table rather than reaching full immunity/certainty -- see
// mitigationFraction below, which scales the base by the caster's own
// MOVE_LEVEL_MULTIPLIERS the same way effectiveMovePower scales an ordinary
// attack's power.
export const SHIELD_BASE_REDUCTION = 0.2; // Shielded: base fraction of incoming damage reduced
export const SHIELD_MAX_REDUCTION = 0.6; // level 3 (Infinite, 3x multiplier): 0.2 * 3 = 0.6 exactly, the cap doesn't actually bind
export const EVASION_BASE_CHANCE = 0.2; // Evasive: base chance an incoming hit against the buffed side deals zero damage instead -- same magnitude family as Shielded's own base reduction, deliberately modest so an unleveled buff is a meaningful-but-not-dominant mitigation
export const EVASION_MAX_CHANCE = 0.6; // same reasoning as SHIELD_MAX_REDUCTION
export const REGEN_BASE_HEAL_FRACTION = 0.1; // Regenerating: base fraction of the buffed side's own max HP healed on each tick (3 ticks over the buff's life, spread out rather than landing in one hit)
export const REGEN_MAX_HEAL_FRACTION = 0.3; // level 3: 0.1 * 3 = 0.3 exactly, the cap doesn't actually bind either -- kept defensively in case tiers/multipliers ever change

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

// Quantumness -> crit ("coherent hit") chance (DESIGN.md §3): linear from 1%
// at BASE_STAT to a flat 100% right at MAX_STAT, so every point of
// Quantumness in the sellable range keeps pulling its weight instead of
// crit chance saturating partway through it, and a maxed-out Quantumness
// crystal genuinely never rolls a non-crit. The clamp is defensive only --
// Noether's shop never sells past MAX_STAT, so it never actually binds.
const MIN_CRIT_CHANCE = 0.01;
const MAX_CRIT_CHANCE = 1;
export function critChance(attackerQuantumness: number): number {
  return clamp(
    MIN_CRIT_CHANCE + ((attackerQuantumness - BASE_STAT) * (MAX_CRIT_CHANCE - MIN_CRIT_CHANCE)) / (MAX_STAT - BASE_STAT),
    MIN_CRIT_CHANCE,
    MAX_CRIT_CHANCE
  );
}

// Correlation -> defense: concave (square-root) climb from 0% damage
// reduction at BASE_STAT to a flat MAX_DEFENSE_REDUCTION (90%) right at
// MAX_STAT -- like critChance/the multi-hit ratio, the full range stays
// meaningful and then plateaus, but unlike a straight line this front-loads
// most of the benefit into the first several points (an early, cheap,
// meaningful defensive buy stays available, the same property the old
// unbounded `BASE_STAT / correlation` hyperbola had) while a straight line
// would spread that benefit too thin to matter until many points in --
// checked against `npm run balance-sim`: a straight-line version left the
// B.Sc. archetype (which can only ever afford a handful of Correlation
// points) unable to clear even World 1, since its first few points barely
// moved the needle. A maxed-out Correlation crystal is very hard to hurt,
// not literally unhittable, so there's always some real damage getting
// through regardless of how defensive either side gets. The clamp guards
// both directions: below BASE_STAT (never happens in practice, stats bottom
// out there) `sqrt` of a negative input would be NaN, and above MAX_STAT (an
// opponent's own stats, difficulty-tier-scaled, can genuinely exceed it --
// see enemyStatsForWorld/superpositionEnemyStats) it would keep climbing
// past the intended floor.
const MAX_DEFENSE_REDUCTION = 0.9;
export function defenseFactor(defenderCorrelation: number): number {
  const progress = clamp((defenderCorrelation - BASE_STAT) / (MAX_STAT - BASE_STAT), 0, 1);
  return 1 - MAX_DEFENSE_REDUCTION * Math.sqrt(progress);
}

// Velocity's own ceiling (DESIGN.md §4, BattleScene.currentHitOrder): the
// faster side's hit count this round is `clamp(floor(velocityRatio), 1,
// MAX_MULTI_HIT)` -- Velocity has no standalone formula the way Quantumness/
// Correlation do, since the multi-hit bonus is a ratio between both sides'
// stats, not a function of one side's absolute value alone.
export const MAX_MULTI_HIT = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Mirrors Phaser.Math.FloatBetween(min, max) (`min + rng() * (max - min)`) --
// reimplemented here rather than imported so this module stays Phaser-free.
function floatBetween(min: number, max: number, rng: () => number): number {
  return min + rng() * (max - min);
}

// One shared +/-15% roll for a wild encounter's whole stat block (HP,
// Quantumness, Velocity, Correlation together, not four independent rolls)
// -- BattleScene.create calls this once per non-rival battle and applies the
// same factor to all four, so the fight reads as "this particular specimen
// is somewhat tougher/weaker than its world's average" (real sample-to-
// sample variation between specimens of the same compound), one coherent
// trait rather than an arbitrary per-stat RNG bolt-on. Deliberately reuses
// resolveHitDamage's own per-hit damage-variance range (`floatBetween(0.85,
// 1.15, ...)`) rather than a separate range, for internal consistency.
// Rivals never call this -- see `rivalHpForWorld`'s own comment.
export function rollEncounterFactor(rng: () => number = Math.random): number {
  return floatBetween(0.85, 1.15, rng);
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
// Quantumness (critChance), a defense factor from the defender's Correlation
// (defenseFactor), the quasiparticle-mismatch multiplier, every other
// multiplicative term (quiz/Analytic/Ultimate bonus, Kondo Shielded,
// Franklin Diffraction Shadow), a 1.5x crit bonus, and +/-15% damage
// variance, all multiplied together and rounded once at the end.
export function resolveHitDamage(params: ResolveHitParams): ResolveHitOutcome {
  const chance = critChance(params.attackerStats.quantumness);
  const crit = (params.critRng ?? Math.random)() < chance;
  const variance = floatBetween(0.85, 1.15, params.varianceRng ?? Math.random);
  const mismatchMult = params.mismatch ? params.mismatchMultiplier : 1;
  const defense = defenseFactor(params.defenderStats.correlation);
  const damage = Math.round(
    params.power *
      mismatchMult *
      params.attackMult *
      params.bonusMultiplier *
      params.shieldedMult *
      params.fractionalGuardMult *
      defense *
      (crit ? 1.5 : 1) *
      variance
  );
  return { damage, crit };
}
