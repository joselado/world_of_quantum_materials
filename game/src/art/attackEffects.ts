import Phaser from 'phaser';
import type { MoveClass } from '../data/types';
import { playAttackSfx, playImpactSfx, playFizzleSfx, type AttackShape } from '../audio/sfx';
import { music } from '../audio/music';
import type { EffectAnchor } from './attackAnchors';
import { EFFECT_STYLE } from './attackStyles';
import {
  WINDUP_MS,
  TRAVEL_MS,
  IMPACT_MS,
  playWindup,
  playBolt,
  playRing,
  playBurst,
  playBeam,
  playEruption,
  playImpactShockwave,
} from './attackShapes';
import { playMeteor, playNova, METEOR_TOTAL_MS, NOVA_TOTAL_MS } from './attackUltimates';

// The battle-effect engine: which shape a move plays, how long the beat
// lasts, and how Feynman's move-leveling escalates it into several repeats.
// The pieces it drives live alongside it -- art/attackAnchors.ts (where an
// effect draws, and the rule keeping the attacker's and target's sides
// independent), art/attackStyles.ts (per-class color/silhouette and the
// per-move-id overrides), art/attackShapes.ts (the single-beat silhouettes),
// art/attackUltimates.ts (Skłodowska-Curie's multi-phase summon sequences).
// This module is also the single public entry point every caller imports
// from, so a caller never has to know which of those files a given piece
// currently lives in.
export type { EffectAnchor } from './attackAnchors';
export { followAnchor, fixedAnchor } from './attackAnchors';
export { ANALYTIC_SHAPES, ULTIMATE_SHAPES, resolveAttackShape } from './attackStyles';

// How long one full play of a given shape takes, start to finish --
// including the trailing impact shockwave for an ordinary shape, or the full
// summon->charge->impact->aftermath sequence for meteor/nova. Exported for
// art/moveEffectPreview.ts's looping detail-pane preview, which schedules
// each loop's next play off this rather than guessing at (or duplicating) a
// fixed pause.
export function attackEffectDurationMs(shape: AttackShape): number {
  if (shape === 'meteor') return METEOR_TOTAL_MS;
  if (shape === 'nova') return NOVA_TOTAL_MS;
  return WINDUP_MS + TRAVEL_MS[shape] + IMPACT_MS;
}

// Feynman's move-leveling (§5, World 7) escalates a leveled move's own
// animation into several overlapping, growing repeats of the same single
// hit, purely as presentation -- the real power bump (MOVE_LEVEL_MULTIPLIERS,
// data/materials.ts) is already folded into a single hit's damage math
// upstream of this file (BattleScene.resolveHit's own `power`/`dmg`), so
// repeating the animation here never touches damage. `LEVEL_TRIGGER_COUNTS`
// (Double=2/Triple=3/Infinite=4 -- "Infinite" is flavor, not a literal loop)
// is how many times the effect fires; `LEVEL_TRIGGER_SCALES` is each
// successive repeat's own visual size multiplier, growing so the cascade
// reads as escalating rather than as N identical copies. Only the LAST
// repeat is wired to the real `onImpact`/`onComplete` a caller passed in --
// every earlier repeat is fire-and-forget decoration (its own onImpact is a
// no-op, or omitted for the ordinary/Analytic shapes below, which never call
// back into BattleScene through onImpact/onComplete for real state in the
// first place -- see playAttackEffect's own doc comment). The stagger
// between repeat starts differs by shape family: an ordinary/Analytic shape
// (bolt/ring/burst/beam/eruption) staggers at `LEVEL_STAGGER_FRACTION` of
// its own `TRAVEL_MS` (so a fast bolt cascades quickly, a slower beam more
// deliberately); meteor/nova use a fixed real-world delay instead
// (`ULTIMATE_LEVEL_STAGGER_MS`), since `TRAVEL_MS.meteor`/`.nova` describe a
// whole multi-second summon->charge->impact->aftermath sequence, not a
// single silhouette's travel time -- a fraction of it would stagger repeats
// by seconds. A leveled Ultimate genuinely runs its full multi-phase
// sequence once per repeat (each one growing), so a level-3 Ultimate takes
// noticeably longer than an unleveled one; there is no shorter fallback for
// that tier, by design (see this file's own comment on `playUltimateRepeats`
// for the measured total).
const LEVEL_TRIGGER_COUNTS: Record<number, number> = { 0: 1, 1: 2, 2: 3, 3: 4 };
const LEVEL_TRIGGER_SCALES = [1, 1.25, 1.5, 3.5];
const LEVEL_STAGGER_FRACTION = 0.4;
const ULTIMATE_LEVEL_STAGGER_MS = 650;

// Same idea as attackEffectDurationMs above, but accounting for the
// leveling repeats just described -- the real wall-clock time from the
// first repeat's launch to the last repeat settling, longer than
// attackEffectDurationMs alone once level > 0 staggers two or more copies
// of the same beat. Exported for art/moveEffectPreview.ts's looping
// detail-pane preview, which needs this (not the single-play duration) to
// schedule its next loop for a leveled ordinary shape without cutting off
// the tail of an in-flight cascade -- meteor/nova previews don't need this,
// since their own real onComplete (only ever fired once, by the last
// repeat -- see playUltimateRepeats) already accounts for the full cascade.
export function attackEffectTotalDurationMs(shape: AttackShape, level: 0 | 1 | 2 | 3 = 0): number {
  const triggerCount = LEVEL_TRIGGER_COUNTS[level] ?? 1;
  const stagger = shape === 'meteor' || shape === 'nova' ? ULTIMATE_LEVEL_STAGGER_MS : TRAVEL_MS[shape] * LEVEL_STAGGER_FRACTION;
  return (triggerCount - 1) * stagger + attackEffectDurationMs(shape);
}

function triggerScaleFor(index: number): number {
  return LEVEL_TRIGGER_SCALES[Math.min(index, LEVEL_TRIGGER_SCALES.length - 1)];
}

// Plays the full attack beat: a quick windup flash at the attacker, the
// travelling effect itself, and a shockwave burst on arrival -- alongside
// its sound (attack sfx on launch, an impact thud scaled by `powerRatio` on
// arrival) and a matching dip in the music so the hit reads clearly over the
// score. `onImpact` fires the moment the travelling effect lands (in time
// for BattleScene's HP-bar update/flashHit), not after the shockwave finishes
// decaying -- the shockwave itself is fire-and-forget.
//
// `from`/`to` are `EffectAnchor`s (art/attackAnchors.ts), not fixed points:
// each side of the effect resolves its own anchor as it draws, so the
// attacker's windup follows the attacker and everything at the target
// follows the target, with no shared position either side depends on.
// BattleScene passes one anchor per crystal; a caller with no game object to
// follow (art/moveEffectPreview.ts's panel previews) passes fixed points.
//
// `shapeOverride` lets a caller pick a specific silhouette regardless of
// moveClass's usual one (BattleScene passes ANALYTIC_SHAPES[move.id] for
// Laughlin's two moves, or ULTIMATE_SHAPES[move.id] for Skłodowska-Curie's
// two, so those four read differently regardless of whichever quasiparticle
// each is currently tuned to). `onComplete`/`whiff` only matter for the
// meteor/nova shapes -- every other shape ignores them, since its tail
// (win/lose check, opponent's turn) is already synchronous with resolveHit's
// own caller rather than needing a completion callback of its own.
// `depthOffset` (default 0, so every BattleScene call site -- none of which
// pass it -- renders at the shape modules' own hardcoded 58-61) shifts every
// Graphics object this effect creates by a fixed amount;
// art/moveEffectPreview.ts's looping detail-pane preview passes a large
// positive offset so the real battle effect draws above a guardian panel's
// own dialogue container (depth 100, OverworldScene.ts/HubScene.ts's
// showXPanel convention) instead of underneath its background. `level`
// (default 0, Feynman's MoveLevel, data/materials.ts) is
// BattleScene.resolveHit's own isPlayer-gated read of the player's save
// state (an opponent's copy of the same move id never carries one) -- see
// the escalation comment above for what a level above 0 actually does.
export function playAttackEffect(
  scene: Phaser.Scene,
  moveClass: MoveClass,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact?: () => void,
  powerRatio = 1,
  shapeOverride?: AttackShape,
  onComplete?: () => void,
  whiff = false,
  depthOffset = 0,
  level: 0 | 1 | 2 | 3 = 0
) {
  const style = EFFECT_STYLE[moveClass];
  const shape = shapeOverride ?? style.shape;
  const triggerCount = LEVEL_TRIGGER_COUNTS[level] ?? 1;

  // The Ultimate tier (Skłodowska-Curie's two moves, §5) runs its own
  // multi-phase summon->charge->impact->aftermath sequence
  // (art/attackUltimates.ts) instead of the shared windup/travel/impact beat
  // every other shape uses -- `onImpact` fires mid-sequence (at the impact
  // phase's own strike beat) and `onComplete` only once the full sequence
  // (including the aftermath decay) has finished, which is what lets
  // BattleScene defer the win/lose check and the opponent's turn until the
  // animation is actually done rather than seconds early.
  if (shape === 'meteor' || shape === 'nova') {
    playUltimateRepeats(scene, shape, style.color, to, whiff, onImpact, powerRatio, onComplete, depthOffset, triggerCount);
    return;
  }

  playOrdinaryRepeats(scene, shape, style.color, from, to, onImpact, powerRatio, depthOffset, triggerCount);
}

// Fires `triggerCount` staggered, growing copies of the ordinary/Analytic
// windup+shape+impact-shockwave beat -- see playAttackEffect's own escalation
// comment for the trigger-count/scale/stagger rules. Every repeat plays the
// full beat (its own windup, travel, impact shockwave + impact sfx, launch
// sfx) since that IS the decoration; only the real `onImpact` callback is
// withheld from every repeat but the last, so BattleScene's synchronous
// applyResult()/checkEndOrContinue() (already called right after this
// function returns, not gated on any callback -- see resolveHit's own
// comment) can never be affected by how many times this fires.
function playOrdinaryRepeats(
  scene: Phaser.Scene,
  shape: AttackShape,
  color: number,
  from: EffectAnchor,
  to: EffectAnchor,
  onImpact: (() => void) | undefined,
  powerRatio: number,
  depthOffset: number,
  triggerCount: number
) {
  const singleMs = WINDUP_MS + TRAVEL_MS[shape] + IMPACT_MS;
  const stagger = TRAVEL_MS[shape] * LEVEL_STAGGER_FRACTION;
  music.duck((triggerCount - 1) * stagger + singleMs);

  const playOnce = (scale: number, isLast: boolean) => {
    playAttackSfx(shape);
    playWindup(
      scene,
      color,
      from,
      () => {
        // `dir` is whichever direction the landing shape was travelling in
        // (a bolt/burst hands over its own arrival heading, a beam comes
        // down, an eruption comes up, a ring supplies none) -- it only
        // aims the impact's debris spray, and BattleScene's own `onImpact`
        // takes no arguments, so nothing downstream of the animation sees it.
        const land = (dir?: { x: number; y: number }) => {
          playImpactShockwave(scene, color, to, depthOffset, scale, dir);
          playImpactSfx(powerRatio);
          if (isLast) onImpact?.();
        };
        if (shape === 'ring') playRing(scene, color, from, to, land, depthOffset, scale);
        else if (shape === 'burst') playBurst(scene, color, from, to, land, depthOffset, scale);
        else if (shape === 'beam') playBeam(scene, color, to, land, depthOffset, scale);
        else if (shape === 'eruption') playEruption(scene, color, to, land, depthOffset, scale);
        else playBolt(scene, color, from, to, land, depthOffset, scale);
      },
      depthOffset,
      scale
    );
  };

  for (let i = 0; i < triggerCount; i++) {
    const startDelay = i * stagger;
    const scale = triggerScaleFor(i);
    const isLast = i === triggerCount - 1;
    if (startDelay === 0) playOnce(scale, isLast);
    else scene.time.delayedCall(startDelay, () => playOnce(scale, isLast));
  }
}

// Fires `triggerCount` staggered, growing copies of a full Ultimate
// summon->charge->impact->aftermath sequence (`ULTIMATE_LEVEL_STAGGER_MS`
// between repeat starts, not a fraction of `TRAVEL_MS.meteor`/`.nova` --
// see playAttackEffect's own escalation comment for why). `whiff` is the
// same all-or-nothing outcome for every repeat (Skłodowska-Curie's Ultimate
// gate is answered once, before any of this plays -- BattleScene's
// showUltimateQuestions/resolveHit), so a failed cascade reads as every
// repeat fizzling together rather than a mix. Only the LAST repeat's own
// `onImpact`/`onComplete` are forwarded to the real callbacks BattleScene
// passed in -- every earlier repeat gets a no-op for both, which is what
// keeps `checkEndOrContinue` (folded into `onComplete` for an Ultimate move,
// resolveHit) firing exactly once regardless of `triggerCount`: two or more
// firings would release `turnLock` more than once and could schedule the
// opponent's counter-swing (or call `endBattle`) repeatedly. A measured
// level-3 (4-trigger) meteor: 3 * 650ms stagger + one full 5200ms sequence
// for the last repeat ≈ 7.15s wall-clock before turnLock releases -- long,
// but this is Skłodowska-Curie's own flashiest tier already (4-6s
// unleveled), and the coordinator's own call was that a leveled Ultimate
// should still play its full sequence per repeat rather than a cheaper
// single-impact-only treatment.
function playUltimateRepeats(
  scene: Phaser.Scene,
  shape: 'meteor' | 'nova',
  color: number,
  to: EffectAnchor,
  whiff: boolean,
  onImpact: (() => void) | undefined,
  powerRatio: number,
  onComplete: (() => void) | undefined,
  depthOffset: number,
  triggerCount: number
) {
  const play = shape === 'meteor' ? playMeteor : playNova;
  const singleMs = shape === 'meteor' ? METEOR_TOTAL_MS : NOVA_TOTAL_MS;
  const stagger = ULTIMATE_LEVEL_STAGGER_MS;
  music.duck((triggerCount - 1) * stagger + singleMs);

  const playOnce = (scale: number, isLast: boolean) => {
    playAttackSfx(shape);
    play(
      scene,
      color,
      to,
      whiff,
      () => {
        if (whiff) {
          playFizzleSfx();
        } else {
          playImpactShockwave(scene, color, to, depthOffset, scale);
          playImpactSfx(powerRatio);
        }
        if (isLast) onImpact?.();
      },
      () => {
        if (isLast) onComplete?.();
      },
      depthOffset,
      scale
    );
  };

  for (let i = 0; i < triggerCount; i++) {
    const startDelay = i * stagger;
    const scale = triggerScaleFor(i);
    const isLast = i === triggerCount - 1;
    if (startDelay === 0) playOnce(scale, isLast);
    else scene.time.delayedCall(startDelay, () => playOnce(scale, isLast));
  }
}
