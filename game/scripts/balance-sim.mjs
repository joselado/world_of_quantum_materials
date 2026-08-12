// Difficulty-curve simulator: walks three reference player builds (B.Sc.,
// M.Sc., Ph.D. -- see BUILDS below) through worlds 1-10 and reports, per
// (build, world), how their qumatessence economy and battle stats stack up
// against that world's ordinary wilds and gating rival. Built to answer one
// question: does move/guardian progression (Feynman leveling, quiz bonuses,
// Franklin passives, Dresselhaus's transmutation, Skłodowska-Curie's
// Ultimates, ...) actually keep pace with `enemyStatsForWorld`'s two-phase
// stat curve (gentle through worlds 1-3, steeper from world 4 on -- see that
// function's own comment in data/balance.ts for the exact rates), or does the
// gap widen past what a reasonably-played character can close.
//
// Two data sources, both read live from the actual game code rather than
// hand-copied, so this script can't silently drift from the game it's
// modeling:
//   1. Static tables (MOVES, MOVE_COMPATIBILITY, WORLD_CRYSTALS,
//      WORLD_RIVALS, PASSIVES, the flat guardian-ability costs) -- read via
//      the TypeScript compiler API's AST-literal parsing, the same approach
//      (and several of the same helpers) as `gen-docs.mjs` uses, since
//      materials.ts pulls in Phaser (art/colors.ts) at module scope and
//      can't be imported directly into Node.
//   2. Live formulas (stat growth, shop/leveling costs, battle stakes, the
//      core damage formula) -- `data/balance.ts` is plain TypeScript with no
//      Phaser dependency, so it's transpiled with `ts.transpileModule` and
//      imported for real, so this script always runs the exact math the
//      game runs, never a hand-copied duplicate.
//
// Run via `npm run balance-sim` (game/package.json) or `node
// scripts/balance-sim.mjs` directly.
//
// ---------------------------------------------------------------------
// MODELING ASSUMPTIONS (read this before trusting a number below)
// ---------------------------------------------------------------------
// - B.Sc. stays in its starting Silicon ('semiconductor') form for the
//   entire run (`transmutes: false`, BUILDS below) -- a deliberate choice,
//   not an accident of a Silicon-locked model: a "low effort" character
//   never spends a guardian visit on Dresselhaus's transmutation panel at
//   all. Silicon only hosts 'electron'/'phonon', so the only ordinary shop
//   move it ever buys is Tunnel Strike (Electron Pulse); its Analytic/
//   Ultimate moves (it never owns any in practice) would tune to whichever
//   TUNABLE_MOVE_CLASSES entry Silicon can host mismatches the most of the
//   current world's wild pool (`bestMismatchClass` below -- for Silicon this
//   always resolves to 'electron', since 'phonon' is universally hostable
//   and never mismatches anything).
// - M.Sc. and Ph.D. both transmute-and-shop (`transmutes: true`): from
//   world 3 onward (the world Dresselhaus is first met), `maybeTransmuteAndShop`
//   is the central "transmute into a form that hosts a class this world's
//   opponents don't, then buy that class from Noether's own form-gated
//   shop" play (DESIGN.md's Dresselhaus section) -- treated as ordinary,
//   expected-tier play for M.Sc., not something only Ph.D.-level
//   optimization would bother with. It searches every non-hybrid crystal
//   from worlds 1 through min(world, 9) -- everything a build reaching this
//   world has already fought its way past -- plus staying in its current
//   form, crossed with every not-yet-owned SHOP_MOVE_IDS entry that
//   candidate form can host (plus "buy nothing new"), and commits to
//   whichever affordable (form, purchase) combination maximizes summed
//   wild-pool-plus-rival margin *against this world's own opponents*, using
//   each candidate's own `maxHp` as the player's maxHp while wearing it
//   (transmuting is a full swap, not a reskin) and free-retuning every
//   owned Analytic move (paying ULTIMATE_CLASS_UNLOCK_COST again per
//   Ultimate move whose new class isn't already unlocked for it) to
//   whichever TUNABLE_MOVE_CLASSES entry that candidate can host mismatches
//   the most of that world's own wild pool. A newly-bought shop move stays
//   owned forever after (mirrors the real game's global `unlockedMoves`)
//   even once the build later transmutes elsewhere -- it just goes back to
//   being unusable until a form that hosts its class again is worn (see the
//   next bullet). World 10's own wild pool is entirely hybrid-recipe
//   results, which Dresselhaus never offers (matches the real panel's own
//   `!isHybridMaterial` filter), so the accumulation stops at world 9 and
//   never draws candidates from world 10 itself. This idealizes away the
//   real panel's "last 3 defeated" candidate window (it offers every member
//   of the accumulated pool, not just the 3 most recently beaten) on the
//   assumption that a build grinding wins across many worlds can
//   selectively re-fight whichever species it wants into that window before
//   visiting Dresselhaus -- a reasonable idealization for a build that
//   actively uses this strategy, not a realistic one for a build that never
//   bothers (B.Sc.).
// - A build's actually-usable attack moves are its owned moves intersected
//   with what its *current* form's own MOVE_COMPATIBILITY entry hosts
//   (mirrors `getBattleMoves`'s own intersection, keyed off each move's
//   static `class`, not whatever an Analytic/Ultimate move happens to be
//   tuned to -- tuning only changes the mismatch check, never usability).
//   This is a no-op for Silicon-locked B.Sc. (Tunnel Strike's fixed
//   'electron' class stays hostable throughout), but matters for a
//   transmuted M.Sc./Ph.D.: wearing a form with no 'electron' channel
//   (insulator/classicalMagnet/quantumSpinLiquid/ferroelectric/multiferroic)
//   makes Tunnel Strike unusable until it transmutes somewhere that hosts
//   it again -- Phonon Beam-based Analytic/Ultimate moves stay usable
//   regardless of form (their static class is 'phonon', hosted everywhere),
//   and a class-specific shop move bought while wearing one form (e.g.
//   Magnon Pulse, bought as a classicalMagnet) goes the same way: usable
//   only while the current form still hosts that class.
// - Opponent Stats (Quantumness/Velocity/Correlation) come from
//   `enemyStatsForWorld(world)` alone, identical for an ordinary wild and
//   that world's rival (confirmed in BattleScene.create: `this.enemyStats =
//   enemyStatsForWorld(this.world)` regardless of `isRival`) -- only maxHp/
//   type/moveset differ between a wild and its world's rival.
// - "An ordinary wild fight" for a world is the average over that world's
//   *entire* wild pool (`getWildPool`'s own worlds-1-9 merge rule is
//   replicated below), not one hand-picked species -- both the player's
//   chosen move's damage and the enemy's own average damage are averaged
//   across every pool member, weighted equally per crystal (matching
//   `Phaser.Utils.Array.GetRandom` picking uniformly among a crystal's own
//   moves).
// - World 9's rival has no fixed type (`getRival(9, ...)` rolls one of
//   `RIVAL_9_TYPES` uniformly at battle time) -- its maxHp/moveset are fixed
//   (`rivalImpurityResonance`), so only the player's own outgoing-mismatch
//   term is averaged across `RIVAL_9_TYPES`' 7 members.
// - The final reported figures (the per-build tables) are *expected
//   values*, not one stochastic playthrough: each hit is run through the
//   real `resolveHitDamage` HIT_SAMPLES times with the seeded RNG and
//   averaged, rather than rolled once, and the pre-battle quiz / Analytic
//   2x-or-0.5x / Ultimate 3-for-3-or-nothing gates are folded in as their
//   accuracy-weighted expected multiplier (`quizAttackMult`/
//   `analyticBonusMult`/`ultimateBonusMult` below) rather than simulated as
//   individual pass/fail rolls. Feynman-leveling attempts are charged their
//   *expected* cost to succeed (`feynmanLevelCost(...) / accuracy^streak`)
//   rather than modeling individual failed attempts. Two other things run
//   the same `resolveHitDamage` formula but through a frozen, non-random hit
//   (`frozenHitDamage`: crit never lands, since crit chance is capped at 0.5
//   and the frozen crit roll is 1; damage variance resolves to exactly its
//   1.0 midpoint) instead of the seeded RNG -- Dresselhaus's own
//   transmutation search above, and the per-world "how many wins does this
//   build need" search below. Neither one ever advances the seeded RNG
//   stream, so re-running this script reproduces the same final table
//   regardless of how many candidate forms/win-counts either search tries
//   along the way.
// - "Rounds-to-kill"/"rounds-to-die" come from each side's average
//   per-hit damage times its hits-per-round (the Velocity-ratio rule,
//   `floor(ratio)` capped at [1,3]), not a turn-by-turn battle log.
//   "Margin" is roundsToDie - roundsToKill: positive means the model
//   expects a win with that many rounds of slack, negative means the
//   model expects the enemy to win first.
// - Each build's "wins needed" for a world is solved for, not a fixed
//   input: starting from that world's carryover qumatessence balance, the
//   simulator grinds ordinary-wild wins (`battleStakeForWorld(world)`
//   qumatessence each) one at a time, re-running that build's own purchase
//   logic after each one, until the rival's expected margin turns
//   non-negative or a 50-win-per-world cap (`GRIND_CAP`) is hit. If the
//   rival becomes beatable within the cap, that many wins' worth of income
//   is applied for real (through the seeded, Monte-Carlo hit function)
//   before the reported wild/rival figures are computed. A world where even
//   the cap isn't enough gets *zero* applied income instead of the cap's
//   worth of it -- a build that can't clear the rival doesn't get to bank a
//   50-win windfall into worlds it didn't actually grind -- and is reported
//   as grind-capped, a direct signal that build would actually stall there
//   in real play rather than just take a costly loss and move on.
// - A rival fight's stake is double that world's ordinary stake, applied
//   symmetrically (win: +2x, lose: -2x floored at 0) -- confirmed against
//   `BattleScene.endBattle`'s actual `stake`/`newTokens` logic, not just
//   DESIGN.md's prose (which reads ambiguously enough to suggest an
//   unconditional payout on its own). Beating a world's rival is what
//   actually unlocks the way to the next world (same method, "Beating the
//   world's gating rival crystal is what actually unlocks... the way to the
//   next world"), so a build the model robustly expects to lose a rival
//   (a LOSE verdict, not just a fragile INCONCLUSIVE) is never walked past
//   that world -- `simulateBuild` stops there and every later world is
//   reported as unreached rather than simulated as if progress continued.
// - Only one Franklin passive and one Kondo self-buff can ever be *active*
//   in battle at a time, even once several are owned. Every build that buys
//   Franklin passives keeps Diffraction Shadow (flat incoming-damage
//   reduction) active rather than switching per fight -- the simplest
//   defensive baseline, and a deliberate undercount of Ph.D.'s real ceiling
//   (a human could switch to Satellite Reflection or Amorphous Halo when
//   more valuable). Kondo's Screening Pulse (also flat incoming-damage
//   reduction) is treated the same way, held active for the whole battle
//   rather than re-cast/ticked down turn by turn.
// - A printed WIN/LOSE verdict is only trusted at face value when it's
//   robust: each fight's margin is recomputed twice more, once with the
//   player's best hit at -15%/the enemy's average hit at +15% (the model's
//   own worst case for the player) and once with the mirrored +15%/-15%
//   (its best case) -- the same ±15% band `resolveHitDamage`'s own damage
//   variance draws from every hit, and roughly the size of a single crit
//   swinging one hit in a short fight. If that swing flips which side the
//   margin favors, the row prints INCONCLUSIVE instead of a flat call.

import ts from 'typescript';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(__dirname, '..');

// --- AST parsing helpers (mirrors gen-docs.mjs's own, see that file's own
// header comment for why this reads source text instead of importing it) ---

function parseFile(relPath) {
  const filePath = path.join(gameDir, relPath);
  const text = fs.readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return sf;
}

function findTopLevelConst(sf, name) {
  for (const stmt of sf.statements) {
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (decl.name.getText(sf) === name && decl.initializer) return decl.initializer;
      }
    }
  }
  throw new Error(`const ${name} not found in ${sf.fileName}`);
}

function evalNode(node, sf) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((el) => evalNode(el, sf));
  if (ts.isObjectLiteralExpression(node)) {
    const out = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key = prop.name.getText(sf).replace(/^['"]|['"]$/g, '');
      out[key] = evalNode(prop.initializer, sf);
    }
    return out;
  }
  if (ts.isCallExpression(node)) {
    return { __call: node.expression.getText(sf), args: node.arguments.map((a) => evalNode(a, sf)) };
  }
  if (ts.isNewExpression(node)) {
    return { __new: node.expression.getText(sf), args: (node.arguments ?? []).map((a) => evalNode(a, sf)) };
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) return evalNode(node.expression, sf);
  if (ts.isIdentifier(node) && node.text === 'undefined') return undefined;
  throw new Error(`balance-sim: don't know how to read a ${ts.SyntaxKind[node.kind]} node: ${node.getText(sf)}`);
}

function crystalFromCall(call) {
  const [name, type, maxHp, moves] = call.args;
  return { name, type, maxHp, moves };
}

// WORLD_RIVALS entries are normally a crystal(...) call like every
// WORLD_CRYSTALS entry (crystalFromCall handles that shape), but
// WORLD_RIVALS[10] ("The Adapted") is a plain object literal instead (its own
// comment in materials.ts explains why: a placeholder type/color that isn't
// meant to run through crystal()'s TYPE_LOOK-derived look). Only {name, type,
// maxHp, moves} are ever read by this script either way.
function materialFromEvaluated(val) {
  if (val && val.__call) return crystalFromCall(val);
  return { name: val.name, type: val.type, maxHp: val.maxHp, moves: val.moves };
}

// --- Static data: materials.ts -------------------------------------------

const materialsSf = parseFile('src/data/materials.ts');

const MOVES = evalNode(findTopLevelConst(materialsSf, 'MOVES'), materialsSf);
const ANALYTIC_MOVE_IDS = evalNode(findTopLevelConst(materialsSf, 'ANALYTIC_MOVE_IDS'), materialsSf);
const ULTIMATE_MOVE_IDS = evalNode(findTopLevelConst(materialsSf, 'ULTIMATE_MOVE_IDS'), materialsSf);
const MOVE_COMPATIBILITY = evalNode(findTopLevelConst(materialsSf, 'MOVE_COMPATIBILITY'), materialsSf);
const PLAYER_MATERIAL = evalNode(findTopLevelConst(materialsSf, 'PLAYER_MATERIAL'), materialsSf);
const RIVAL_9_TYPES = evalNode(findTopLevelConst(materialsSf, 'RIVAL_9_TYPES'), materialsSf);
const TUNABLE_MOVE_CLASSES = evalNode(findTopLevelConst(materialsSf, 'TUNABLE_MOVE_CLASSES'), materialsSf);

const ULTIMATE_CLASS_UNLOCK_COST = evalNode(findTopLevelConst(materialsSf, 'ULTIMATE_CLASS_UNLOCK_COST'), materialsSf);
const BLOCH_DESTINATION_COST = evalNode(findTopLevelConst(materialsSf, 'BLOCH_DESTINATION_COST'), materialsSf);
const DRESSELHAUS_TRANSMUTE_COST = evalNode(findTopLevelConst(materialsSf, 'DRESSELHAUS_TRANSMUTE_COST'), materialsSf);
const ANDERSON_DOPE_COST = evalNode(findTopLevelConst(materialsSf, 'ANDERSON_DOPE_COST'), materialsSf);
const MAJORANA_FUSE_COST = evalNode(findTopLevelConst(materialsSf, 'MAJORANA_FUSE_COST'), materialsSf);
// Not spent by any modeled build (no build fuses/dopes -- Ph.D. transmutes
// via Dresselhaus only, see the header comment), extracted anyway since the
// task calls out all five guardian-option costs as required static data and
// it costs nothing to keep them alongside DRESSELHAUS_TRANSMUTE_COST for
// reference/future use.
void BLOCH_DESTINATION_COST;
void ANDERSON_DOPE_COST;
void MAJORANA_FUSE_COST;

const WORLD_CRYSTALS_RAW = evalNode(findTopLevelConst(materialsSf, 'WORLD_CRYSTALS'), materialsSf);
const WORLD_CRYSTALS = Object.fromEntries(
  Object.entries(WORLD_CRYSTALS_RAW).map(([world, calls]) => [Number(world), calls.map(crystalFromCall)])
);

const WORLD_RIVALS_RAW = evalNode(findTopLevelConst(materialsSf, 'WORLD_RIVALS'), materialsSf);
const WORLD_RIVALS = Object.fromEntries(
  Object.entries(WORLD_RIVALS_RAW).map(([world, val]) => [Number(world), materialFromEvaluated(val)])
);

// Kondo's three self-buff moves and Noether's shop list are computed in
// materials.ts (`Object.values(MOVES).filter(...)`), not literal arrays --
// re-derive them from the already-parsed MOVES table the same way, rather
// than trying to AST-parse a filter expression.
const KONDO_MOVE_IDS = Object.values(MOVES)
  .filter((m) => m.class === 'screening')
  .map((m) => m.id);
const SHOP_MOVE_IDS = Object.keys(MOVES).filter(
  (id) => id !== 'thermalFluctuation' && !ANALYTIC_MOVE_IDS.includes(id) && !ULTIMATE_MOVE_IDS.includes(id) && !KONDO_MOVE_IDS.includes(id)
);

// getWildPool(world)'s own merge rule (data/materials.ts): world 9 also
// spawns every non-hybrid material from worlds 1-8, deduped by name. No
// world 1-8 crystal is ever a hybrid-recipe result (every one of those lives
// only in WORLD_CRYSTALS[10], per that table's own comment), so the
// isHybridMaterial exclusion getWildPool itself applies is a no-op for this
// merge and can be skipped without parsing HYBRID_RECIPES at all. World 10's
// own pool (below) *is* exactly the hybrid-recipe set, so it stays
// unmerged -- and is never offered by Dresselhaus (see `transmuteCandidates`).
function getWildPool(world) {
  const own = WORLD_CRYSTALS[world] ?? [];
  if (world !== 9) return own;
  const seen = new Set(own.map((m) => m.name));
  const fromEarlier = [];
  for (let w = 1; w <= 8; w++) {
    for (const m of WORLD_CRYSTALS[w] ?? []) {
      if (seen.has(m.name)) continue;
      seen.add(m.name);
      fromEarlier.push(m);
    }
  }
  return [...own, ...fromEarlier];
}

// Dresselhaus's own candidate pool for a world: every non-hybrid crystal
// from worlds 1 through min(world, 9) -- a build reaching world W has, by
// definition, already fought its way through every earlier world's own
// wilds, so all of them are fair game for the "last 3 defeated" window (see
// header comment on that idealization), not just the current world's own
// roster. World 10's own pool is entirely hybrid-recipe results Dresselhaus
// never offers (`!isHybridMaterial`), so it's excluded from the
// accumulation entirely rather than parsing HYBRID_RECIPES -- a build
// arriving at world 10 keeps drawing from worlds 1-9's own accumulated set.
function transmuteCandidates(world) {
  const upto = Math.min(world, 9);
  const seen = new Set();
  const out = [];
  for (let w = 1; w <= upto; w++) {
    for (const m of WORLD_CRYSTALS[w] ?? []) {
      if (seen.has(m.name)) continue;
      seen.add(m.name);
      out.push(m);
    }
  }
  return out;
}

function canHost(type, moveClass) {
  return (MOVE_COMPATIBILITY[type] ?? []).includes(moveClass);
}

// --- Static data: passives.ts ---------------------------------------------

const passivesSf = parseFile('src/data/passives.ts');
const PASSIVES = evalNode(findTopLevelConst(passivesSf, 'PASSIVES'), passivesSf);

// --- Live formulas: data/balance.ts, transpiled and actually imported ----
// (never a hand-copied duplicate -- see this file's own header comment).

const balanceSrc = fs.readFileSync(path.join(gameDir, 'src/data/balance.ts'), 'utf8');
const { outputText } = ts.transpileModule(balanceSrc, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  fileName: 'balance.ts',
});
// balance.ts's only import is `import type { Move, Stats } from './types'`,
// a type-only import the compiler always elides regardless of module
// settings -- so the transpiled output has no runtime imports left to
// resolve, and can be written to a standalone temp file and imported
// directly rather than needing a data: URL's escaping/size concerns.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwm-balance-sim-'));
const tmpFile = path.join(tmpDir, 'balance.mjs');
fs.writeFileSync(tmpFile, outputText);
const balance = await import(pathToFileURL(tmpFile).href);
fs.rmSync(tmpDir, { recursive: true, force: true });

const {
  BASE_STAT,
  enemyStatsForWorld,
  statUpgradeCost,
  shopCost,
  MOVE_LEVEL_MULTIPLIERS,
  MOVE_LEVEL_STREAKS,
  feynmanLevelCost,
  battleStakeForWorld,
  resolveHitDamage,
  MISMATCH_MULTIPLIER,
  EDGE_CURRENT_MISMATCH_MULT,
  FRACTIONAL_GUARD_DAMAGE_MULT,
} = balance;

// --- Seeded RNG (mulberry32) -- deterministic so re-running this script
// reproduces the same table, rather than a fresh Monte-Carlo sample every
// run. ----------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HIT_SAMPLES = 120; // Monte-Carlo samples per (move, defender) pair averaged into one expected-damage figure

// One hit's damage, run through the real `resolveHitDamage` -- a "hit
// function" with this exact signature is threaded through every fight
// evaluation below instead of an `rng` parameter, so the same evaluation
// code can be driven either by the seeded Monte-Carlo sampler (the reported
// figures) or by a frozen, non-random hit (every search: Dresselhaus's
// transmutation choice, the per-world "how many wins" grind search, and the
// ±15% robustness check) without duplicating the fight-evaluation math for
// each. `makeMonteCarloHitFn` below is `avgHitDamage` folded into this
// shape; `frozenHitDamage` is the non-random one.
function makeMonteCarloHitFn(rng) {
  return (attackerStats, defenderStats, power, mismatch, mismatchMultiplier, attackMult, bonusMultiplier, shieldedMult, fractionalGuardMult) => {
    let total = 0;
    for (let i = 0; i < HIT_SAMPLES; i++) {
      const { damage } = resolveHitDamage({
        attackerStats,
        defenderStats,
        power,
        mismatch,
        mismatchMultiplier,
        attackMult,
        bonusMultiplier,
        shieldedMult,
        fractionalGuardMult,
        critRng: rng,
        varianceRng: rng,
      });
      total += damage;
    }
    return total / HIT_SAMPLES;
  };
}

// Never crits (crit chance is capped at 0.5, and `1 < chance` is always
// false) and always resolves damage variance to its exact 1.0 midpoint
// (`floatBetween(0.85, 1.15, 0.5) === 1.0`) -- runs the real
// `resolveHitDamage` like the Monte-Carlo path above, just with the RNG
// frozen so it can be called thousands of times (candidate forms x wins
// counts) without ever advancing the seeded stream the reported figures
// depend on for reproducibility.
function frozenHitDamage(attackerStats, defenderStats, power, mismatch, mismatchMultiplier, attackMult, bonusMultiplier, shieldedMult, fractionalGuardMult) {
  return resolveHitDamage({
    attackerStats,
    defenderStats,
    power,
    mismatch,
    mismatchMultiplier,
    attackMult,
    bonusMultiplier,
    shieldedMult,
    fractionalGuardMult,
    critRng: () => 1,
    varianceRng: () => 0.5,
  }).damage;
}

// Velocity-ratio multi-attack rule (DESIGN.md §4/BattleScene.currentHitOrder):
// the faster side swings floor(ratio) times, capped at 3; the slower side
// always swings exactly once.
function roundHits(playerVelocity, enemyVelocity) {
  if (playerVelocity >= enemyVelocity) {
    const ratio = playerVelocity / enemyVelocity;
    return { playerHits: Math.min(3, Math.max(1, Math.floor(ratio))), enemyHits: 1 };
  }
  const ratio = enemyVelocity / playerVelocity;
  return { playerHits: 1, enemyHits: Math.min(3, Math.max(1, Math.floor(ratio))) };
}

// --- Quiz/Analytic/Ultimate accuracy-weighted expected multipliers --------
// (OverworldScene.ts's QUIZ_CORRECT_MULTIPLIER/QUIZ_WRONG_MULTIPLIER = 1.5/
// 0.6, BattleScene.ts's ANALYTIC_CORRECT_MULTIPLIER/ANALYTIC_WRONG_MULTIPLIER
// = 2/0.5 -- both plain scene-local consts, not part of this task's
// balance.ts extraction scope, so mirrored here as literals rather than
// imported.)

const QUIZ_CORRECT_MULTIPLIER = 1.5;
const QUIZ_WRONG_MULTIPLIER = 0.6;
const ANALYTIC_CORRECT_MULTIPLIER = 2;
const ANALYTIC_WRONG_MULTIPLIER = 0.5;

function quizAttackMult(accuracy) {
  return accuracy * QUIZ_CORRECT_MULTIPLIER + (1 - accuracy) * QUIZ_WRONG_MULTIPLIER;
}
function analyticBonusMult(accuracy) {
  return accuracy * ANALYTIC_CORRECT_MULTIPLIER + (1 - accuracy) * ANALYTIC_WRONG_MULTIPLIER;
}
function ultimateBonusMult(accuracy) {
  return Math.pow(accuracy, 3); // all 3 questions correct or the hit whiffs for 0
}

// --- Player build state -----------------------------------------------

function newState(accuracy) {
  return {
    qumatessence: 0,
    earnedTotal: 0,
    spentTotal: 0, // purchases only (moves, stat points, Dresselhaus/Ultimate retunes) -- rival-loss forfeitures are tracked separately, see lostToRivals
    lostToRivals: 0, // qumatessence forfeited on a lost rival fight (2x that world's stake, floored at the pre-loss balance)
    stats: { quantumness: BASE_STAT, velocity: BASE_STAT, correlation: BASE_STAT },
    statRotation: 0, // round-robins quantumness/velocity/correlation for builds that spend leftover currency on stats
    ownedMoves: new Set(['thermalFluctuation']),
    moveLevels: new Map(),
    tunedClass: new Map(), // ANALYTIC_MOVE_IDS/ULTIMATE_MOVE_IDS id -> MoveClass
    kondoOwned: false,
    kondoActive: false,
    franklinOwned: new Set(),
    franklinActive: null,
    accuracy,
    // The player's current crystal form (Dresselhaus's transmutation --
    // see header comment). Starts as Silicon/PLAYER_MATERIAL for every
    // build; only a `transmutes: true` build ever changes these.
    playerType: PLAYER_MATERIAL.type,
    playerMaxHp: PLAYER_MATERIAL.maxHp,
    playerFormName: PLAYER_MATERIAL.name,
    dresselhausUnlocked: new Set([PLAYER_MATERIAL.name]), // crystal names already paid DRESSELHAUS_TRANSMUTE_COST for (free to re-wear)
    ultimateClassUnlocked: new Map(), // ULTIMATE_MOVE_IDS id -> Set<MoveClass> already paid ULTIMATE_CLASS_UNLOCK_COST for
  };
}

// Deep-enough copy for the "what if" trials the grind-size search and
// Dresselhaus's transmutation search both run -- every mutable collection on
// `state` gets its own copy so a discarded trial can never leak a mutation
// into the real run.
function cloneState(state) {
  return {
    ...state,
    stats: { ...state.stats },
    ownedMoves: new Set(state.ownedMoves),
    moveLevels: new Map(state.moveLevels),
    tunedClass: new Map(state.tunedClass),
    franklinOwned: new Set(state.franklinOwned),
    dresselhausUnlocked: new Set(state.dresselhausUnlocked),
    ultimateClassUnlocked: new Map([...state.ultimateClassUnlocked].map(([id, classes]) => [id, new Set(classes)])),
  };
}

function moveLevel(state, moveId) {
  return state.moveLevels.get(moveId) ?? 0;
}
function effectivePower(state, moveId) {
  return MOVES[moveId].power * MOVE_LEVEL_MULTIPLIERS[moveLevel(state, moveId)];
}
// A tunable move's *mismatch* class -- falls back to 'phonon' if the class
// it's tuned to isn't hostable by the player's *current* form (mirrors
// materials.ts's getTunedMoveClass, e.g. after transmuting away from
// whatever form it was tuned under without retuning).
function moveClassFor(state, moveId) {
  if (ANALYTIC_MOVE_IDS.includes(moveId) || ULTIMATE_MOVE_IDS.includes(moveId)) {
    const assigned = state.tunedClass.get(moveId);
    return assigned && canHost(state.playerType, assigned) ? assigned : 'phonon';
  }
  return MOVES[moveId].class;
}
function bonusMultiplierFor(state, moveId) {
  if (ANALYTIC_MOVE_IDS.includes(moveId)) return analyticBonusMult(state.accuracy);
  if (ULTIMATE_MOVE_IDS.includes(moveId)) return ultimateBonusMult(state.accuracy);
  return 1;
}
// Attack-capable, currently-*usable* owned moves: excludes Kondo's
// self-buffs (deal no damage, never gated by MOVE_COMPATIBILITY at all) and,
// mirroring `getBattleMoves`'s own intersection, any move whose *static*
// class (MOVES[id].class -- always 'phonon' for an Analytic/Ultimate move,
// regardless of what it's tuned to) the player's current form can't host.
// A no-op for Silicon-locked B.Sc.; for a transmuted M.Sc./Ph.D. this is
// what makes Tunnel Strike (or any other class-specific shop move) drop out
// of the usable set in a form that doesn't host its class.
function ownedAttackMoves(state) {
  return [...state.ownedMoves].filter((id) => !KONDO_MOVE_IDS.includes(id) && canHost(state.playerType, MOVES[id].class));
}

const STAT_ROTATION = ['quantumness', 'velocity', 'correlation'];
function buyStatPoint(state) {
  const stat = STAT_ROTATION[state.statRotation % STAT_ROTATION.length];
  const cost = statUpgradeCost(state.stats[stat]);
  if (state.qumatessence < cost) return false;
  state.qumatessence -= cost;
  state.spentTotal += cost;
  state.stats[stat] += 1;
  state.statRotation += 1;
  return true;
}

// Defensive multipliers the *player* carries into a fight as the defender
// (an opponent never has Kondo/Franklin -- see DESIGN.md §5/CODEMAP.md).
function playerShieldedMult(state) {
  return state.kondoActive ? 1 - 0.2 : 1; // Screening Pulse base reduction (SHIELD_BASE_REDUCTION), unleveled -- see header comment on why buffs aren't leveled in this model
}
function playerFractionalGuardMult(state) {
  return state.franklinActive === 'fractionalGuard' ? FRACTIONAL_GUARD_DAMAGE_MULT : 1;
}
function playerMismatchMultiplierAsDefender(state) {
  return state.franklinActive === 'edgeCurrent' ? EDGE_CURRENT_MISMATCH_MULT : MISMATCH_MULTIPLIER;
}

// The single TUNABLE_MOVE_CLASSES entry a given form can host that
// mismatches the most of a defender pool -- every other term in the damage
// formula (power/attackMult/bonusMultiplier/defenseFactor) is identical
// across every hostable class for a fixed move against a fixed pool, so
// maximizing mismatch *count* is exactly maximizing expected damage, not
// just a proxy for it. Backs both Dresselhaus's own choice of which class to
// retune into and Laughlin's/Skłodowska-Curie's own purchase-time tuning
// pick below. 'phonon' (never mismatches anything, but always hostable) is
// the guaranteed floor if nothing scores better.
function bestMismatchClass(type, pool) {
  let best = 'phonon';
  let bestCount = -1;
  for (const cls of TUNABLE_MOVE_CLASSES) {
    if (!canHost(type, cls)) continue;
    const count = pool.reduce((n, d) => n + (canHost(d.type, cls) ? 0 : 1), 0);
    if (count > bestCount) {
      bestCount = count;
      best = cls;
    }
  }
  return best;
}

// --- Fight evaluation --------------------------------------------------

// Player's best average damage-per-hit against one defender {type},
// maximized over every owned, currently-usable attack move.
function bestPlayerHit(hitFn, state, playerStats, enemyStats, defenderType) {
  let best = 0;
  for (const moveId of ownedAttackMoves(state)) {
    const cls = moveClassFor(state, moveId);
    const mismatch = !canHost(defenderType, cls);
    const dmg = hitFn(
      playerStats,
      enemyStats,
      effectivePower(state, moveId),
      mismatch,
      MISMATCH_MULTIPLIER, // player is always the attacker here -- the opponent never softens mismatch (Amorphous Halo is player-only)
      quizAttackMult(state.accuracy),
      bonusMultiplierFor(state, moveId),
      1,
      1
    );
    if (dmg > best) best = dmg;
  }
  return best;
}

// Enemy's average damage-per-hit against the player, averaged uniformly
// across the defender's own moveset (Phaser.Utils.Array.GetRandom picks
// uniformly), factoring in whatever defensive buffs/passives the player
// currently holds and whichever form the player currently wears (mismatch
// as the defender).
function avgEnemyHit(hitFn, state, playerStats, enemyStats, enemyMoves) {
  let total = 0;
  for (const moveId of enemyMoves) {
    const move = MOVES[moveId];
    const mismatch = !canHost(state.playerType, move.class);
    total += hitFn(
      enemyStats,
      playerStats,
      move.power,
      mismatch,
      playerMismatchMultiplierAsDefender(state),
      1,
      1,
      playerShieldedMult(state),
      playerFractionalGuardMult(state)
    );
  }
  return total / enemyMoves.length;
}

// One fight's full evaluation against a single defender {type, maxHp, moves}.
function evaluateFight(hitFn, state, world, defender) {
  const playerStats = state.stats;
  const enemyStats = enemyStatsForWorld(world);
  const playerHitDmg = bestPlayerHit(hitFn, state, playerStats, enemyStats, defender.type);
  const enemyHitDmg = avgEnemyHit(hitFn, state, playerStats, enemyStats, defender.moves);
  const { playerHits, enemyHits } = roundHits(playerStats.velocity, enemyStats.velocity);
  const playerDmgPerRound = playerHitDmg * playerHits;
  const enemyDmgPerRound = enemyHitDmg * enemyHits;
  const roundsToKill = playerDmgPerRound > 0 ? Math.ceil(defender.maxHp / playerDmgPerRound) : Infinity;
  const roundsToDie = enemyDmgPerRound > 0 ? Math.ceil(state.playerMaxHp / enemyDmgPerRound) : Infinity;
  return { roundsToKill, roundsToDie, margin: roundsToDie - roundsToKill };
}

// Averages evaluateFight's own numeric fields across several defenders
// (a world's whole wild pool, or World 9's 7 possible rival types).
function averageFights(fights) {
  const n = fights.length;
  const sum = (key) => fights.reduce((acc, f) => acc + (Number.isFinite(f[key]) ? f[key] : 999), 0) / n;
  return { roundsToKill: sum('roundsToKill'), roundsToDie: sum('roundsToDie'), margin: sum('margin') };
}

// The defender(s) a wild/rival fight is evaluated against for a world --
// shared by evaluateWildFight/evaluateRivalFight below and by the ±15%
// robustness check, so the two can't drift apart.
function defendersFor(world, isRival) {
  if (!isRival) return getWildPool(world);
  if (world === 9) {
    // No fixed WORLD_RIVALS[9] entry -- getRival(9, t) rolls t uniformly
    // from RIVAL_9_TYPES at battle time (rollRival9Type); average over all 7.
    const base = WORLD_RIVALS[9] ?? { maxHp: 66, moves: ['tunnelStrike', 'thermalFluctuation'] };
    return RIVAL_9_TYPES.map((type) => ({ ...base, type }));
  }
  return [WORLD_RIVALS[world]];
}

function evaluateWildFight(hitFn, state, world) {
  return averageFights(defendersFor(world, false).map((d) => evaluateFight(hitFn, state, world, d)));
}

function evaluateRivalFight(hitFn, state, world) {
  return averageFights(defendersFor(world, true).map((d) => evaluateFight(hitFn, state, world, d)));
}

// The ±15%-variance/single-crit robustness check (see header comment):
// recomputes a defender-pool's average margin with the player's best hit and
// the enemy's average hit each independently scaled, using the frozen hit
// function throughout (this is a decision/classification aid, not a
// reported figure, so it never touches the seeded RNG).
function marginWithMultipliers(state, world, defenders, playerMult, enemyMult) {
  const playerStats = state.stats;
  const enemyStats = enemyStatsForWorld(world);
  const { playerHits, enemyHits } = roundHits(playerStats.velocity, enemyStats.velocity);
  const fights = defenders.map((d) => {
    const playerDmgPerRound = bestPlayerHit(frozenHitDamage, state, playerStats, enemyStats, d.type) * playerMult * playerHits;
    const enemyDmgPerRound = avgEnemyHit(frozenHitDamage, state, playerStats, enemyStats, d.moves) * enemyMult * enemyHits;
    const roundsToKill = playerDmgPerRound > 0 ? Math.ceil(d.maxHp / playerDmgPerRound) : Infinity;
    const roundsToDie = enemyDmgPerRound > 0 ? Math.ceil(state.playerMaxHp / enemyDmgPerRound) : Infinity;
    return { roundsToKill, roundsToDie, margin: roundsToDie - roundsToKill };
  });
  return averageFights(fights).margin;
}

// WIN/LOSE/INCONCLUSIVE for one fight, given its already-computed base
// margin -- INCONCLUSIVE whenever the ±15% swing (see header comment) flips
// which side the margin favors, and always INCONCLUSIVE at an exact 0.00
// margin (dies the same round it kills -- the definitional coin flip,
// regardless of what either perturbed margin happens to land on).
function verdictFor(state, world, isRival, baseMargin) {
  if (baseMargin === 0) return 'INCONCLUSIVE';
  const defenders = defendersFor(world, isRival);
  const pessimistic = marginWithMultipliers(state, world, defenders, 0.85, 1.15);
  const optimistic = marginWithMultipliers(state, world, defenders, 1.15, 0.85);
  if (pessimistic >= 0 !== optimistic >= 0) return 'INCONCLUSIVE';
  return baseMargin >= 0 ? 'WIN' : 'LOSE';
}

// --- Dresselhaus's transmutation + Noether's form-gated shop -------------
// (M.Sc. and Ph.D. -- both `transmutes: true` builds)

function markUltimateClassUnlocked(state, moveId, cls) {
  const set = state.ultimateClassUnlocked.get(moveId) ?? new Set();
  set.add(cls);
  state.ultimateClassUnlocked.set(moveId, set);
}

// Retunes every currently-owned Analytic/Ultimate move to `cls` on `state`
// directly (no cost bookkeeping -- callers charge whatever's needed before
// calling this).
function retuneOwnedTunableMoves(state, cls) {
  for (const moveId of [...ANALYTIC_MOVE_IDS, ...ULTIMATE_MOVE_IDS]) {
    if (state.ownedMoves.has(moveId)) state.tunedClass.set(moveId, cls);
  }
}

// The central transmute-for-mismatch play (DESIGN.md's Dresselhaus section):
// pick a crystal form whose type hosts a class the target opponents don't,
// pay Dresselhaus once to wear it, and -- since Noether's own shop is
// filtered to whatever the *current* form can host (`noether.ts`'s
// `compatibleMoves` intersection) -- that new form can also unlock buying a
// brand-new attack class outright, not just re-tuning an Analytic/Ultimate
// move already owned. Searches every reachable crystal form (plus staying
// put) crossed with every not-yet-owned SHOP_MOVE_IDS entry that form can
// host (plus "buy nothing new"), and commits to whichever affordable
// (form, shop purchase) combination maximizes summed wild-pool-plus-rival
// margin against this world's own opponents. Costs: DRESSELHAUS_TRANSMUTE_COST
// once per never-before-worn crystal *name* (free forever after), `shopCost`
// for a newly-bought move (a normal Noether purchase, priced the same as
// anywhere else), and ULTIMATE_CLASS_UNLOCK_COST per owned Ultimate move
// whose new tuned class isn't already unlocked for it. A no-op before
// world 3 (Dresselhaus hasn't been met yet); after that, always evaluates
// (even "stay put, buy nothing") so a stray beneficial Ultimate retune for
// the current form isn't missed just because the form itself didn't change.
function maybeTransmuteAndShop(state, world) {
  if (world < 3) return;
  const pool = getWildPool(world);
  const stayOption = { name: state.playerFormName, type: state.playerType, maxHp: state.playerMaxHp };
  const options = [stayOption, ...transmuteCandidates(world)];

  let best = null;
  for (const c of options) {
    const isStay = c === stayOption;
    const tunedClass = bestMismatchClass(c.type, pool);
    const transmuteCost = isStay || state.dresselhausUnlocked.has(c.name) ? 0 : DRESSELHAUS_TRANSMUTE_COST;
    let ultimateRetuneCost = 0;
    for (const moveId of ULTIMATE_MOVE_IDS) {
      if (!state.ownedMoves.has(moveId)) continue;
      const unlocked = state.ultimateClassUnlocked.get(moveId) ?? new Set();
      if (!unlocked.has(tunedClass)) ultimateRetuneCost += ULTIMATE_CLASS_UNLOCK_COST;
    }

    // Every not-yet-owned ordinary shop move this candidate form can host,
    // plus `null` ("don't buy anything new") -- mirrors noether.ts's own
    // `forSale = SHOP_MOVE_IDS.filter(id => !unlocked.includes(id) &&
    // compatible.has(id))`.
    const shopPicks = [null, ...SHOP_MOVE_IDS.filter((id) => !state.ownedMoves.has(id) && canHost(c.type, MOVES[id].class))];

    for (const shopPick of shopPicks) {
      const shopPickCost = shopPick ? shopCost(MOVES[shopPick]) : 0;
      const totalCost = transmuteCost + ultimateRetuneCost + shopPickCost;
      if (totalCost > state.qumatessence) continue; // can't currently afford this combination

      const trial = cloneState(state);
      trial.playerType = c.type;
      trial.playerMaxHp = c.maxHp;
      if (shopPick) trial.ownedMoves.add(shopPick);
      retuneOwnedTunableMoves(trial, tunedClass);
      const score = evaluateWildFight(frozenHitDamage, trial, world).margin + evaluateRivalFight(frozenHitDamage, trial, world).margin;
      if (!best || score > best.score) best = { c, shopPick, tunedClass, transmuteCost, ultimateRetuneCost, shopPickCost, score };
    }
  }

  if (!best) return; // nothing (not even the zero-cost status quo) was affordable/applicable

  const totalCost = best.transmuteCost + best.ultimateRetuneCost + best.shopPickCost;
  state.qumatessence -= totalCost;
  state.spentTotal += totalCost;
  state.dresselhausUnlocked.add(best.c.name);
  state.playerType = best.c.type;
  state.playerMaxHp = best.c.maxHp;
  state.playerFormName = best.c.name;
  if (best.shopPick) state.ownedMoves.add(best.shopPick);
  for (const moveId of ULTIMATE_MOVE_IDS) {
    if (state.ownedMoves.has(moveId)) markUltimateClassUnlocked(state, moveId, best.tunedClass);
  }
  retuneOwnedTunableMoves(state, best.tunedClass);
}

// --- Builds --------------------------------------------------------------
// Every purchase-priority ruleset below is a modeling assumption, not
// derived from anything -- see the task brief's own framing of the three
// reference builds and this file's header comment for what each is meant to
// represent. `spend(state, world, hitFn)` runs once per world, after that
// world's grind income has already landed, and keeps re-scanning its own
// priority list from the top after every successful purchase (so a build
// always buys its single highest-priority still-affordable thing next)
// until nothing on the list is affordable/applicable anymore.

function mainMoveId(state) {
  // Whichever move is worth leveling at Feynman's panel -- prefers an
  // Analytic move once owned (higher base power, and always usable
  // regardless of the player's current form, since its static class is
  // 'phonon' -- unlike Tunnel Strike's fixed 'electron', which a
  // transmuted M.Sc./Ph.D. can lose access to) over the shop's own Tunnel
  // Strike.
  if (state.ownedMoves.has('skyfallBeam')) return 'skyfallBeam';
  if (state.ownedMoves.has('tunnelStrike')) return 'tunnelStrike';
  return 'thermalFluctuation';
}

// Charges the *expected* qumatessence cost to land the next Feynman tier
// (feynmanLevelCost / accuracy^streak -- see header comment) and applies it
// if affordable. Returns whether a level-up happened.
function tryFeynmanLevel(state) {
  const moveId = mainMoveId(state);
  const level = moveLevel(state, moveId);
  if (level >= 3) return false;
  const nextLevel = level + 1;
  const streak = MOVE_LEVEL_STREAKS[nextLevel];
  const rawCost = feynmanLevelCost(MOVES[moveId], nextLevel);
  const expectedCost = rawCost / Math.pow(state.accuracy, streak);
  if (state.qumatessence < expectedCost) return false;
  state.qumatessence -= expectedCost;
  state.spentTotal += expectedCost;
  state.moveLevels.set(moveId, nextLevel);
  return true;
}

const BUILDS = [
  {
    id: 'B.Sc.',
    label: 'B.Sc. (low effort)',
    accuracy: 0.5, // not specified by the task brief for B.Sc.; modeled as chance-level guessing, consistent with "low effort"
    transmutes: false, // low effort: never visits Dresselhaus at all, let alone the "last 3 defeated" grinding this model's own transmutation search assumes -- see header comment
    // Reactive only: buys Tunnel Strike the first time it's needed and
    // affordable, otherwise only patches a losing matchup with the
    // cheapest available fix (one Correlation point), capped so a single
    // world can't spend unboundedly. Never touches Laughlin/Feynman/Kondo/
    // Franklin/Skłodowska-Curie/Dresselhaus.
    spend(state, world, hitFn) {
      for (let i = 0; i < 5; i++) {
        const { margin } = evaluateWildFight(hitFn, state, world);
        if (margin >= 0) break; // not currently losing -- B.Sc. stops touching the wallet
        if (!state.ownedMoves.has('tunnelStrike') && state.qumatessence >= shopCost(MOVES.tunnelStrike)) {
          state.qumatessence -= shopCost(MOVES.tunnelStrike);
          state.spentTotal += shopCost(MOVES.tunnelStrike);
          state.ownedMoves.add('tunnelStrike');
          continue;
        }
        if (state.qumatessence >= statUpgradeCost(state.stats.correlation)) {
          const cost = statUpgradeCost(state.stats.correlation);
          state.qumatessence -= cost;
          state.spentTotal += cost;
          state.stats.correlation += 1;
          continue;
        }
        break; // losing and can't afford a fix -- B.Sc. just goes in anyway
      }
    },
  },
  {
    id: 'M.Sc.',
    label: 'M.Sc. (intended default)',
    accuracy: 0.75, // "answers the pre-battle quiz correctly ~75% of the time"
    transmutes: true, // transmuting into a mismatch-hosting form (and buying whatever it newly unlocks from Noether) is treated as ordinary, expected-tier play, not Ph.D.-only optimization -- see maybeTransmuteAndShop
    spend(state, world) {
      maybeTransmuteAndShop(state, world);
      let statsBoughtThisWorld = 0;
      for (let guard = 0; guard < 50; guard++) {
        if (!state.ownedMoves.has('tunnelStrike') && state.qumatessence >= shopCost(MOVES.tunnelStrike)) {
          state.qumatessence -= shopCost(MOVES.tunnelStrike);
          state.spentTotal += shopCost(MOVES.tunnelStrike);
          state.ownedMoves.add('tunnelStrike');
          continue;
        }
        if (world >= 4) {
          const laughlinMove = ANALYTIC_MOVE_IDS.find((id) => !state.ownedMoves.has(id));
          if (laughlinMove && state.qumatessence >= shopCost(MOVES[laughlinMove])) {
            state.qumatessence -= shopCost(MOVES[laughlinMove]);
            state.spentTotal += shopCost(MOVES[laughlinMove]);
            state.ownedMoves.add(laughlinMove);
            state.tunedClass.set(laughlinMove, bestMismatchClass(state.playerType, getWildPool(world)));
            continue;
          }
        }
        // Balanced spend: up to 2 stat points per world, round-robin.
        if (statsBoughtThisWorld < 2 && state.qumatessence >= statUpgradeCost(state.stats[STAT_ROTATION[state.statRotation % 3]])) {
          if (buyStatPoint(state)) {
            statsBoughtThisWorld += 1;
            continue;
          }
        }
        if (world >= 7 && tryFeynmanLevel(state)) continue;
        if (world >= 9 && !state.franklinOwned.has('fractionalGuard') && state.qumatessence >= PASSIVES.fractionalGuard.cost) {
          state.qumatessence -= PASSIVES.fractionalGuard.cost;
          state.spentTotal += PASSIVES.fractionalGuard.cost;
          state.franklinOwned.add('fractionalGuard');
          state.franklinActive = 'fractionalGuard';
          continue;
        }
        if (world >= 10 && !state.ownedMoves.has('ultimateMeteor') && state.qumatessence >= ULTIMATE_CLASS_UNLOCK_COST) {
          const cls = bestMismatchClass(state.playerType, getWildPool(world));
          state.qumatessence -= ULTIMATE_CLASS_UNLOCK_COST;
          state.spentTotal += ULTIMATE_CLASS_UNLOCK_COST;
          state.ownedMoves.add('ultimateMeteor');
          state.tunedClass.set('ultimateMeteor', cls);
          markUltimateClassUnlocked(state, 'ultimateMeteor', cls);
          continue;
        }
        break;
      }
    },
  },
  {
    id: 'Ph.D.',
    label: 'Ph.D. (high optimization)',
    accuracy: 1.0, // "answers all quizzes correctly"
    transmutes: true, // near-optimal, aggressive: chases the same transmute-and-shop play as M.Sc. -- see maybeTransmuteAndShop -- plus everything else this build's own priority list below adds on top
    spend(state, world) {
      maybeTransmuteAndShop(state, world);
      for (let guard = 0; guard < 100; guard++) {
        if (!state.ownedMoves.has('tunnelStrike') && state.qumatessence >= shopCost(MOVES.tunnelStrike)) {
          state.qumatessence -= shopCost(MOVES.tunnelStrike);
          state.spentTotal += shopCost(MOVES.tunnelStrike);
          state.ownedMoves.add('tunnelStrike');
          continue;
        }
        if (world >= 4) {
          const laughlinMove = ANALYTIC_MOVE_IDS.find((id) => !state.ownedMoves.has(id));
          if (laughlinMove && state.qumatessence >= shopCost(MOVES[laughlinMove])) {
            state.qumatessence -= shopCost(MOVES[laughlinMove]);
            state.spentTotal += shopCost(MOVES[laughlinMove]);
            state.ownedMoves.add(laughlinMove);
            state.tunedClass.set(laughlinMove, bestMismatchClass(state.playerType, getWildPool(world)));
            continue;
          }
        }
        if (world >= 8 && !state.kondoOwned && state.qumatessence >= shopCost(MOVES.screeningCloud)) {
          state.qumatessence -= shopCost(MOVES.screeningCloud);
          state.spentTotal += shopCost(MOVES.screeningCloud);
          state.kondoOwned = true;
          state.kondoActive = true;
          continue;
        }
        if (world >= 9) {
          const nextPassive = Object.keys(PASSIVES).find((id) => !state.franklinOwned.has(id));
          if (nextPassive && state.qumatessence >= PASSIVES[nextPassive].cost) {
            state.qumatessence -= PASSIVES[nextPassive].cost;
            state.spentTotal += PASSIVES[nextPassive].cost;
            state.franklinOwned.add(nextPassive);
            // Kept active for the whole battle regardless of which one was
            // bought most recently -- see header comment on why Diffraction
            // Shadow specifically is the one modeled as always-active.
            state.franklinActive = 'fractionalGuard';
            continue;
          }
        }
        if (world >= 7 && tryFeynmanLevel(state)) continue;
        if (world >= 10 && !state.ownedMoves.has('ultimateMeteor') && state.qumatessence >= ULTIMATE_CLASS_UNLOCK_COST) {
          const cls = bestMismatchClass(state.playerType, getWildPool(world));
          state.qumatessence -= ULTIMATE_CLASS_UNLOCK_COST;
          state.spentTotal += ULTIMATE_CLASS_UNLOCK_COST;
          state.ownedMoves.add('ultimateMeteor');
          state.tunedClass.set('ultimateMeteor', cls);
          markUltimateClassUnlocked(state, 'ultimateMeteor', cls);
          continue;
        }
        if (world >= 10 && !state.ownedMoves.has('ultimateNova') && state.qumatessence >= ULTIMATE_CLASS_UNLOCK_COST) {
          const cls = bestMismatchClass(state.playerType, getWildPool(world));
          state.qumatessence -= ULTIMATE_CLASS_UNLOCK_COST;
          state.spentTotal += ULTIMATE_CLASS_UNLOCK_COST;
          state.ownedMoves.add('ultimateNova');
          state.tunedClass.set('ultimateNova', cls);
          markUltimateClassUnlocked(state, 'ultimateNova', cls);
          continue;
        }
        // Near-optimal ordering exhausted -- anything left over goes into
        // stats rather than sitting idle.
        if (buyStatPoint(state)) continue;
        break;
      }
    },
  },
];

// --- Simulation ------------------------------------------------------------

// How many ordinary-wild wins (each worth battleStakeForWorld(world)
// qumatessence) this build needs to grind in this world, on top of its
// carryover balance, before its own purchase logic makes the rival's
// expected margin non-negative -- solved for by trying 0, 1, 2, ... wins on
// a disposable clone of `state` (never mutating the real run), using the
// frozen hit function throughout (fast, and never touches the seeded RNG).
// Capped at GRIND_CAP: a world that isn't beatable even at the cap comes
// back with `capped: true` rather than an unbounded search.
const GRIND_CAP = 50;
function findWinsNeeded(build, state, world) {
  const stake = battleStakeForWorld(world);
  for (let wins = 0; wins <= GRIND_CAP; wins++) {
    const trial = cloneState(state);
    trial.qumatessence += wins * stake;
    build.spend(trial, world, frozenHitDamage);
    if (evaluateRivalFight(frozenHitDamage, trial, world).margin >= 0) return { winsNeeded: wins, capped: false };
  }
  return { winsNeeded: GRIND_CAP, capped: true };
}

function simulateBuild(build) {
  const rng = mulberry32(0xb0ba1a); // fixed seed -- same seed reused per world/build so the whole table is reproducible run to run
  const state = newState(build.accuracy);
  const rows = [];
  for (let world = 1; world <= 10; world++) {
    const stake = battleStakeForWorld(world);
    const { winsNeeded, capped } = findWinsNeeded(build, state, world);

    // A capped world (the rival never became beatable, even at the cap)
    // gets zero applied income, not the cap's worth of it -- a build that
    // can't clear the rival doesn't get to bank a 50-win windfall into
    // later worlds it didn't actually grind. `winsNeeded` still reports the
    // cap for visibility, it just isn't paid out.
    const income = capped ? 0 : winsNeeded * stake;
    state.qumatessence += income;
    state.earnedTotal += income;

    const hitFn = makeMonteCarloHitFn(rng);
    build.spend(state, world, hitFn);

    const wild = evaluateWildFight(hitFn, state, world);
    const rival = evaluateRivalFight(hitFn, state, world);
    const wildVerdict = verdictFor(state, world, false, wild.margin);
    const rivalVerdict = verdictFor(state, world, true, rival.margin);

    const rivalStake = 2 * stake;
    const rivalWon = rival.margin >= 0;
    const balanceBeforeRival = state.qumatessence;
    if (rivalWon) {
      state.qumatessence = balanceBeforeRival + rivalStake;
      state.earnedTotal += rivalStake;
    } else {
      state.qumatessence = Math.max(0, balanceBeforeRival - rivalStake);
      // Currency actually removed, floored at 0 -- capped at the
      // pre-loss balance rather than the full rivalStake, since a loss can
      // never remove more than the player actually had. Tracked separately
      // from `spentTotal` (which is purchases only, see newState) so the
      // report can't misread a forfeited stake as a shop purchase.
      state.lostToRivals += Math.min(rivalStake, balanceBeforeRival);
    }

    rows.push({
      world,
      earnedTotal: state.earnedTotal,
      spentTotal: state.spentTotal,
      lostToRivals: state.lostToRivals,
      qumatessence: state.qumatessence,
      winsNeeded,
      capped,
      playerFormName: state.playerFormName,
      wild,
      rival,
      wildVerdict,
      rivalVerdict,
      rivalWon,
    });

    // Beating a world's rival is what unlocks the way to the next world
    // (BattleScene.endBattle) -- a build the model robustly expects to lose
    // the rival (verdict LOSE, not just a fragile INCONCLUSIVE) would
    // actually be stuck at this world in real play, never reaching the
    // next one. Stop simulating rather than printing a full 1-10 table that
    // implies progress a real playthrough could never make; remaining
    // worlds are reported as unreached instead (see printBuildTable).
    if (rivalVerdict === 'LOSE') break;
  }
  return rows;
}

// --- Report -----------------------------------------------------------

function fmt(n, digits = 1) {
  if (!Number.isFinite(n)) return '∞';
  return n.toFixed(digits);
}

function printBuildTable(build, rows) {
  console.log(`\n=== ${build.label} -- quizAccuracy=${build.accuracy}, transmutes=${build.transmutes} ===`);
  const header = [
    'W',
    'Earned(cum)',
    'SpentOnPurchases(cum)',
    'LostToRivals(cum)',
    'Balance',
    'Wins',
    'Form',
    'Wild k/d/margin/verdict',
    'Rival k/d/margin/verdict',
  ];
  console.log(header.join('\t'));
  for (const r of rows) {
    console.log(
      [
        r.world,
        Math.round(r.earnedTotal),
        Math.round(r.spentTotal),
        Math.round(r.lostToRivals),
        Math.round(r.qumatessence),
        r.capped ? `${r.winsNeeded}+ (CAPPED)` : r.winsNeeded,
        r.playerFormName,
        `${fmt(r.wild.roundsToKill)}/${fmt(r.wild.roundsToDie)}/${fmt(r.wild.margin, 2)}/${r.wildVerdict}`,
        `${fmt(r.rival.roundsToKill)}/${fmt(r.rival.roundsToDie)}/${fmt(r.rival.margin, 2)}/${r.rivalVerdict}`,
      ].join('\t')
    );
  }
  // simulateBuild stops at the first world this build robustly loses its
  // rival in (see its own comment) -- every world after that is never
  // actually reached in real play, so it's reported as such rather than
  // silently omitted or, worse, simulated as if the walk had continued.
  for (let world = rows.length + 1; world <= 10; world++) {
    console.log([world, '-', '-', '-', '-', '-', '-', 'UNREACHABLE (blocked at world ' + rows.length + ')', 'UNREACHABLE'].join('\t'));
  }
}

console.log('Difficulty-curve simulation -- k=rounds-to-kill, d=rounds-to-die, margin=d-k (positive=player favored).');
console.log('All figures are expected values (Monte-Carlo averaged through the real resolveHitDamage, seeded for reproducibility), not one stochastic playthrough. See this file\'s own header comment for every modeling assumption before reading these as literal predictions.');

const allResults = BUILDS.map((build) => ({ build, rows: simulateBuild(build) }));
for (const { build, rows } of allResults) {
  printBuildTable(build, rows);
}

console.log('\n=== Summary: rival-fight margin by world (positive = model expects a win) ===');
console.log(['World', ...BUILDS.map((b) => b.id)].join('\t'));
for (let i = 0; i < 10; i++) {
  const world = i + 1;
  console.log(
    [world, ...allResults.map(({ rows }) => (rows[i] ? `${fmt(rows[i].rival.margin, 2)} (${rows[i].rivalVerdict})` : 'UNREACHABLE'))].join('\t')
  );
}

console.log('\n=== Summary: ordinary-wild-fight margin by world (positive = model expects a win) ===');
console.log(['World', ...BUILDS.map((b) => b.id)].join('\t'));
for (let i = 0; i < 10; i++) {
  const world = i + 1;
  console.log(
    [world, ...allResults.map(({ rows }) => (rows[i] ? `${fmt(rows[i].wild.margin, 2)} (${rows[i].wildVerdict})` : 'UNREACHABLE'))].join('\t')
  );
}
