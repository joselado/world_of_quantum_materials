import Phaser from 'phaser';
import {
  playFlightEffect,
  playTargetEffect,
  resolveAttackShape,
  travelsAcrossField,
  attackEffectTotalDurationMs,
  targetEffectTotalDurationMs,
  cancelPreviewFx,
  type EffectAnchor,
} from './attackEffects';
import { setPreviewClip, clearPreviewClip, type PreviewClipRect } from './attackFx';
export type { PreviewClipRect };
import type { AttackShape } from '../audio/sfx';
import type { MoveClass } from '../data/types';
import type { MoveLevel } from '../data/materials';

// Loops a move's own real battle-effect animation -- the literal effect
// BattleScene fires when the move is cast in a fight, sound and all, not a
// separate static icon or a stripped-down copy -- inside a guardian panel's
// detail pane (STYLE.md's "List+detail panels" and "Landau in the
// overworld"/"Skłodowska-Curie in the overworld"; Noether's/Kondo's/
// Landau's/Skłodowska-Curie's own panels, scenes/panels/noether.ts,
// kondo.ts, landau.ts, sklodowskaCurie.ts, via scenes/panels/listDetail.ts's
// renderMoveDetailHeader/renderSelfBuffMoveDetailHeader).
//
// A move whose real cast crosses the field (attackEffects.ts's
// `travelsAcrossField` -- everything but the four that summon themselves
// where they land and Kondo's self-buffs) demonstrates that whole flight:
// the caster's windup on one side of the stage, the silhouette's travel, the
// impact on the other side (attackEffects.ts's playFlightEffect), laid out
// across the caller's own `clip` rectangle by FLIGHT_* below. The rest play
// on the single point the caller supplies (`at`, normally the centre of its
// own pane) -- a summon arrives there on its own, and a self-buff is cast on
// the crystal standing there (attackEffects.ts's playTargetEffect). The two
// ground-anchored Analytic shapes are the one place the stage adapts the
// effect rather than only framing it: they are composed against a defender's
// body and the floor at its feet, neither of which a stage has, so they play
// on the stage's own floor line instead (GROUND_LINE_Y below).
//
// Either way the preview uses whichever class/shape override that move
// actually plays with in a real fight (Landau's/Curie's ANALYTIC_SHAPES/
// ULTIMATE_SHAPES overrides, resolved by the caller the same way BattleScene
// itself does) and, optionally, the player's own current Feynman level for
// that move (`getMoveLevel`) so the preview escalates into the same
// multi-trigger, growing-size cascade a real leveled cast plays instead of
// always showing the flat unleveled loop.
//
// The real effect's own Graphics render at depth 58-61 (tuned for
// BattleScene's own background) -- well below a dialogue panel's own
// container (depth 100, OverworldScene.ts/HubScene.ts's showXPanel
// convention), which would otherwise draw over (hide) it entirely, since a
// Container is one atomic compositing unit at its own depth and the
// panel's own background rectangle is nearly opaque. PREVIEW_DEPTH_OFFSET
// pushes every Graphics object the effect creates comfortably above
// that so the preview actually renders on top of the pane instead of
// silently underneath it. That same nonzero offset is what marks these
// objects as a detached preview for art/attackFx.ts, which is how stopping a
// chain can wipe whatever is mid-flight.
//
// Each simultaneously-running chain gets its own offset off this base, spaced
// far enough apart (PREVIEW_DEPTH_STRIDE, wider than the 58-61 band a single
// effect layers itself across) that two chains never interleave. The offset
// doubles as that chain's identity in art/attackFx.ts, which is what lets two
// previews on screen at once each be clipped to their own stage.
const PREVIEW_DEPTH_OFFSET = 150;
const PREVIEW_DEPTH_STRIDE = 10;

// Pause between one play settling and the next one starting, so the preview
// reads as a repeating demonstration rather than one unbroken strobe. It is a
// *ceiling* rather than a fixed wait: a demonstration should spend most of its
// time demonstrating, and a flat pause spent the same half-second after a
// 260ms bolt as after a five-second meteor, which left the short effects --
// Noether's Electron Pulse above all -- showing a flash in a mostly dead
// stage. Scaled to the effect's own length instead, with a floor so the
// quickest ones still read as separate plays rather than a strobe.
const LOOP_PAUSE_MAX_MS = 500;
const LOOP_PAUSE_MIN_MS = 170;
const LOOP_PAUSE_FRACTION = 0.5;

function loopPauseMs(playedMs: number): number {
  return Math.max(LOOP_PAUSE_MIN_MS, Math.min(LOOP_PAUSE_MAX_MS, Math.round(playedMs * LOOP_PAUSE_FRACTION)));
}

// Where the caster and the target stand on a preview stage, as fractions of
// the stage's own rectangle -- a battle's own low-left-to-high-right
// diagonal (BattleScene's PLAYER_POS -> OPPONENT_POS), flattened to the
// slope a stage a few hundred pixels wide by one hundred tall can hold. The
// margins left around both ends are what keeps the windup flash and the
// landing shockwave inside the stage rather than half-clipped at its edges,
// and the line sits low enough that a shape's up-bowed arc clears the top
// while the one shape that sags below its line (mass) still lands on the
// stage. A move at one of Feynman's levels does reach the frame: its last
// repeat draws at several times normal size, more than a stage this size can
// hold whatever the layout -- the same as an Ultimate's own whiteout impact,
// which the stage has always clipped.
const FLIGHT_FROM_X = 0.18;
const FLIGHT_TO_X = 0.78;
const FLIGHT_FROM_Y = 0.68;
const FLIGHT_TO_Y = 0.44;

// The stage's own floor, as a fraction of its height -- where Landau's two
// ground-anchored Analytic shapes (beam, eruption) play. Both are composed
// in a battle against a defender's body *and* the arena floor at its feet
// (art/attackShapes.ts's GROUND_DROP): the beam's column stops at the
// defender's centre with its pool of light spreading on the floor below,
// the eruption's crack opens in that floor under the same body. A stage has
// neither, so the anchor handed to playTargetEffect for these two is this
// floor line rather than the caller's own centre point, and
// attackEffects.ts's TARGET_ONLY_GROUND_DROP drops the extra offset: the
// beam lands on the line instead of ending flat in mid-air where a defender
// would have been, and the eruption's expanding floor rings spread along it
// with room to grow inside the stage instead of out through its bottom edge.
// Low enough for the rings, high enough that the geyser's own column still
// stands inside a stage at TUNED_MOVE_STAGE_H.
const GROUND_LINE_Y = 0.76;
const GROUND_ANCHORED = new Set<AttackShape>(['beam', 'eruption']);

function flightAnchors(clip: PreviewClipRect): { from: EffectAnchor; to: EffectAnchor } {
  return {
    from: { x: clip.x + clip.width * FLIGHT_FROM_X, y: clip.y + clip.height * FLIGHT_FROM_Y },
    to: { x: clip.x + clip.width * FLIGHT_TO_X, y: clip.y + clip.height * FLIGHT_TO_Y },
  };
}

export interface MoveEffectPreviewParams {
  scene: Phaser.Scene;
  moveClass: MoveClass;
  // Where a move that arrives on one point plays -- normally the centre of
  // the caller's own preview stage, or the crystal a self-buff is cast on. A
  // move that crosses the field ignores this and lays its own caster and
  // target points out across `clip` instead.
  at: EffectAnchor;
  // The stage the effect is confined to, in canvas coordinates -- normally
  // the pane's own stage block, which the caller has already laid out and
  // drawn a frame around (scenes/panels/listDetail.ts's drawPreviewStage).
  // A battle effect is composed against the whole arena and would otherwise
  // reach far outside the panel it is being demonstrated in; see
  // art/attackFx.ts's own note.
  clip: PreviewClipRect;
  shapeOverride?: AttackShape;
  level?: MoveLevel;
}

// A preview "chain" is a single looping play, tracked independently of every
// other chain by its own caller-supplied `key`. Landau's/Skłodowska-Curie's
// two-column panels (scenes/panels/landau.ts/sklodowskaCurie.ts) run two
// chains at once, one per column, since both of a guardian's fixed two moves
// are always visible side by side rather than browsed one at a time through
// a shared detail pane. Every other caller (Noether's shop, Kondo's self-buff
// preview) only ever wants one chain at a time and doesn't pass a `key`,
// landing on DEFAULT_KEY below -- a key no other caller shares behaves as a
// single independent chain regardless of how many other chains exist.
// `generation` invalidates any settle callback left over from a chain that's
// been stopped or retargeted to different params (bumped by both stop() and
// a fresh start() call on an already-registered key) so a stale timer can
// never resurrect playback after the panel has moved on.
const DEFAULT_KEY = 'default';

interface PreviewChain {
  scene: Phaser.Scene;
  current: MoveEffectPreviewParams;
  generation: number;
  pendingTimer: Phaser.Time.TimerEvent | null;
  // Fixed for as long as this key has a chain, so retargeting one (Landau
  // retuning a move, which rebuilds the panel) reuses its own depth band and
  // its own clip registration rather than leaking a new one per rebuild.
  depthOffset: number;
}

const chains = new Map<string, PreviewChain>();

// The lowest depth band not currently spoken for, so a second chain starting
// while a first is live lands on its own.
function nextDepthOffset(): number {
  const taken = new Set([...chains.values()].map((c) => c.depthOffset));
  let offset = PREVIEW_DEPTH_OFFSET;
  while (taken.has(offset)) offset += PREVIEW_DEPTH_STRIDE;
  return offset;
}

// Starts (or retargets) the preview chain identified by `key`. If a play is
// already in flight for this same chain, this call does NOT fire a second,
// overlapping play on top of it -- it just updates the chain's own `current`,
// and the in-flight play's own settle callback (afterSettled below) picks up
// whatever `current` is by the time it fires. The previously-selected move
// finishes its own cycle, then the newly selected one starts, never both
// drawing at once. A caller doesn't need to call stopMoveEffectPreview itself
// before retargeting a chain (e.g. Landau's panel rebuilding after a
// retune), just before tearing the chain down for good (Farewell/close) with
// nothing new to preview in its place.
export function startMoveEffectPreview(params: MoveEffectPreviewParams, key: string = DEFAULT_KEY) {
  const existing = chains.get(key);
  const alreadyRunning = !!existing && existing.scene === params.scene;
  if (existing) {
    existing.current = params;
    existing.scene = params.scene;
  } else {
    chains.set(key, { scene: params.scene, current: params, generation: 0, pendingTimer: null, depthOffset: nextDepthOffset() });
  }
  const chain = chains.get(key)!;
  // Re-declared on every call, retarget included: a panel rebuild lays its
  // pane out afresh and the stage can land somewhere else (a longer move
  // name above it, a different text-size preset), so the clip follows the
  // stage rather than being registered once when the chain is born.
  setPreviewClip(params.scene, chain.depthOffset, params.clip);
  if (alreadyRunning) return;
  chain.generation++;
  playNext(key, chain.generation);
}

function playNext(key: string, myGen: number) {
  const chain = chains.get(key);
  if (!chain || myGen !== chain.generation) return;
  const { scene, moveClass, at, clip, shapeOverride, level } = chain.current;
  const shape = resolveAttackShape(moveClass, shapeOverride);
  const isUltimate = shape === 'meteor' || shape === 'nova';
  const flight = travelsAcrossField(shape) ? flightAnchors(clip) : null;

  // Fires once this play has fully settled (Ultimate's own onComplete for
  // meteor/nova -- already correct for any level, since only the last of a
  // leveled cascade's repeats is ever wired to it, see
  // attackEffects.ts's playUltimateRepeats -- or a timed proxy off this
  // play's own total duration for every other shape, since neither
  // playFlightEffect nor playTargetEffect calls back for those) -- schedules
  // the next cycle after a short pause, re-reading this chain's own `current` fresh
  // rather than closing over these params, so a preview retarget mid-flight
  // takes effect on the very next cycle instead of being silently dropped.
  const playedMs = flight ? attackEffectTotalDurationMs(shape, level ?? 0) : targetEffectTotalDurationMs(shape, level ?? 0);
  const afterSettled = () => {
    const c = chains.get(key);
    if (!c || myGen !== c.generation) return;
    c.pendingTimer = scene.time.delayedCall(loopPauseMs(playedMs), () => playNext(key, myGen));
  };

  const target = GROUND_ANCHORED.has(shape) ? { x: at.x, y: clip.y + clip.height * GROUND_LINE_Y } : at;

  if (flight) playFlightEffect(scene, moveClass, flight.from, flight.to, shapeOverride, chain.depthOffset, level ?? 0);
  else playTargetEffect(scene, moveClass, target, shapeOverride, isUltimate ? afterSettled : undefined, chain.depthOffset, level ?? 0);

  if (!isUltimate) {
    chain.pendingTimer = scene.time.delayedCall(playedMs, afterSettled);
  }
}

// Stops one chain (by `key`), or -- called with no key -- every chain at
// once, and wipes whatever any preview currently has on screen
// (art/attackFx.ts's cancelPreviewFx: mid-flight Graphics destroyed, their
// tweens stopped before any onComplete can chain a further phase). Closing a
// panel takes its animation with it, including partway through one of
// Skłodowska-Curie's own multi-second Ultimate sequences. The no-key form is
// called from a showXPanel rebuild that lands on a state with nothing left to
// preview (Noether's empty-shop branch), and from
// OverworldScene.closeDialogue()/HubScene.closeDialogue() so Farewell/leaving
// the panel for good stops every chain rather than leaving one scheduled
// against a scene the player has walked away from. A no-op if the given key
// (or, for the no-key form, every chain) isn't running.
export function stopMoveEffectPreview(key?: string) {
  if (key === undefined) {
    for (const chain of chains.values()) {
      chain.generation++;
      if (chain.pendingTimer) chain.scene.time.removeEvent(chain.pendingTimer);
      clearPreviewClip(chain.depthOffset);
    }
    chains.clear();
    cancelPreviewFx();
    return;
  }
  const chain = chains.get(key);
  if (!chain) return;
  chain.generation++;
  if (chain.pendingTimer) chain.scene.time.removeEvent(chain.pendingTimer);
  clearPreviewClip(chain.depthOffset);
  chains.delete(key);
  // Per-key stops only ever happen when nothing else is previewing (a single
  // chain's own panel closing), so this clears the same screen either way.
  if (chains.size === 0) cancelPreviewFx();
}
