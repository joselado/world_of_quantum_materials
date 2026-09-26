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
// overworld"/"Skłodowska-Curie in the overworld"; Noether's/Feynman's/
// Kondo's/Landau's/Skłodowska-Curie's own panels, scenes/panels/noether.ts,
// feynman.ts, kondo.ts, landau.ts, sklodowskaCurie.ts, and the Lab's Qumatex
// station, via scenes/panels/listDetail.ts's
// renderMoveDetailHeader/renderSelfBuffMoveDetailHeader). The loop follows
// the pane: pick another move, quasiparticle or level and the play in flight
// is cut that instant and the new one starts from its first frame
// (startMoveEffectPreview below).
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

// The stage's own floor, as a fraction of its height, for the shapes that
// are staged against a floor: Landau's beam and eruption, and
// Skłodowska-Curie's meteor. Each is composed in a battle against a
// defender's body *and* the arena floor at its feet (art/attackShapes.ts's
// GROUND_DROP): the beam's column stops at the defender's centre with its
// pool of light spreading on the floor below, the eruption's crack opens in
// that floor under the same body, the meteor's rune lies on it and its ball
// hangs a fixed height above it. A stage has neither, so the anchor handed
// to playTargetEffect for these is this floor line rather than the caller's
// own centre point, and attackEffects.ts's TARGET_ONLY_GROUND_DROP drops
// the extra offset: the beam lands on the line instead of ending flat in
// mid-air where a defender would have been, and the eruption's expanding
// floor rings spread along it with room to grow inside the stage instead of
// out through its bottom edge. Low enough for the rings, high enough that
// the geyser's own column still stands inside a stage at
// TUNED_MOVE_STAGE_H. The meteor's floor sits lower still, since what it
// needs room for is above the floor: the ball condenses METEOR_HOVER over
// it, and on the higher line most of the ball would hang above the stage.
const GROUND_LINE_Y: Partial<Record<AttackShape, number>> = { beam: 0.76, eruption: 0.76, meteor: 0.86 };

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
  // What the pane says it is demonstrating -- the move's own display name,
  // as the caption under the stage reads it. Two moves can share a class
  // and so a look (Kondo's three self-buffs all play the one screening
  // ring), and the caption is what still tells them apart: a chain handed a
  // different subject restarts even when nothing it would draw has changed,
  // since the player picked a different move and expects to see that move
  // demonstrated from its first frame.
  subject?: string;
}

// A preview "chain" is a single looping play, tracked independently of every
// other chain by its own caller-supplied `key`. Every guardian pane shows
// one move at a time, so every caller (listDetail.ts's two detail-header
// openers, which Noether's, Feynman's, Kondo's, Landau's and
// Skłodowska-Curie's panels and the Lab's Qumatex station all go through)
// leaves `key` unset and lands on DEFAULT_KEY below; a caller that ever
// keeps two stages live at once keys each separately, and a key no other
// caller shares behaves as a single independent chain regardless of how
// many other chains exist. `generation` invalidates any settle callback
// left over from a chain that's been stopped or restarted (bumped by both
// stop() and a start() call that restarts an already-registered key) so a
// stale timer can never resurrect playback after the panel has moved on.
const DEFAULT_KEY = 'default';

interface PreviewChain {
  scene: Phaser.Scene;
  current: MoveEffectPreviewParams;
  generation: number;
  pendingTimer: Phaser.Time.TimerEvent | null;
  // Fixed for as long as this key has a chain, so restarting one (Landau
  // retuning a move, which rebuilds the panel) reuses its own depth band and
  // its own clip registration rather than leaking a new one per rebuild.
  depthOffset: number;
}

// Whether two starts on the same chain ask for the same demonstration on
// the same stage. A panel rebuilds itself whole on every click (scenes/
// panels/*.ts's full-rebuild-per-click convention), so most starts a chain
// sees are for the very move it is already looping -- a purchase, a page
// turn of the list beside it -- and those leave the play in flight alone.
// Anything else (a different move, quasiparticle or Feynman level, or the
// same move on a stage that has moved) is a new demonstration.
function sameDemonstration(a: MoveEffectPreviewParams, b: MoveEffectPreviewParams): boolean {
  return (
    a.subject === b.subject &&
    a.moveClass === b.moveClass &&
    a.shapeOverride === b.shapeOverride &&
    (a.level ?? 0) === (b.level ?? 0) &&
    a.at.x === b.at.x &&
    a.at.y === b.at.y &&
    a.clip.x === b.clip.x &&
    a.clip.y === b.clip.y &&
    a.clip.width === b.clip.width &&
    a.clip.height === b.clip.height
  );
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

// Starts (or retargets) the preview chain identified by `key`. A chain
// already looping the same demonstration (sameDemonstration above -- the
// panel rebuilt itself for a reason that changed nothing on the stage)
// keeps its play in flight and this call only re-declares its clip. A chain
// asked for a different demonstration restarts: whatever it has on screen
// is wiped that instant (attackFx.ts's cancelPreviewFx, this chain's own
// batch only, its tweens stopped before any onComplete can chain a further
// phase), its scheduled next cycle is dropped, and the new move plays from
// its first frame. Picking another move, another quasiparticle or another
// Feynman level in a pane therefore cuts straight to that choice rather
// than sitting through the rest of the previous move's cycle. A sound the
// cut play had already launched finishes on its own (audio/sfx.ts's
// oscillators are fire-and-forget), which is at most a second of overlap
// on a rapid switch. Two plays never draw at once on the same chain. A
// caller doesn't call stopMoveEffectPreview itself before retargeting a
// chain -- that would restart the loop on every rebuild, changed or not --
// only before tearing the chain down for good (Farewell/close) with nothing
// new to preview in its place.
export function startMoveEffectPreview(params: MoveEffectPreviewParams, key: string = DEFAULT_KEY) {
  let chain = chains.get(key);
  if (chain && chain.scene === params.scene && sameDemonstration(chain.current, params)) {
    chain.current = params;
    // Re-declared on every call: the clip follows the stage rather than
    // being registered once when the chain is born.
    setPreviewClip(params.scene, chain.depthOffset, params.clip);
    return;
  }
  if (chain) {
    if (chain.pendingTimer) chain.scene.time.removeEvent(chain.pendingTimer);
    chain.pendingTimer = null;
    cancelPreviewFx(chain.depthOffset);
    chain.scene = params.scene;
    chain.current = params;
  } else {
    chain = { scene: params.scene, current: params, generation: 0, pendingTimer: null, depthOffset: nextDepthOffset() };
    chains.set(key, chain);
  }
  setPreviewClip(params.scene, chain.depthOffset, params.clip);
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
  // the next cycle after a short pause. That cycle reads this chain's own
  // `current` afresh rather than closing over these params, and runs only
  // while this play's generation is still the chain's: a restart in the
  // meantime has already wiped this play and bumped the generation, so the
  // pause it scheduled dies with it.
  const playedMs = flight ? attackEffectTotalDurationMs(shape, level ?? 0) : targetEffectTotalDurationMs(shape, level ?? 0);
  const afterSettled = () => {
    const c = chains.get(key);
    if (!c || myGen !== c.generation) return;
    c.pendingTimer = scene.time.delayedCall(loopPauseMs(playedMs), () => playNext(key, myGen));
  };

  const groundLine = GROUND_LINE_Y[shape];
  const target = groundLine !== undefined ? { x: at.x, y: clip.y + clip.height * groundLine } : at;
  // An Ultimate's stage beyond its target is the pane itself: the meteor
  // comes in from the stage's top-left corner and the nova draws its energy
  // up from a floor along the stage's bottom.
  const stage = isUltimate
    ? { far: { x: clip.x + clip.width * 0.05, y: clip.y + clip.height * 0.08 }, floor: { x0: clip.x, x1: clip.x + clip.width, y1: clip.y + clip.height * 0.92 } }
    : undefined;

  if (flight) playFlightEffect(scene, moveClass, flight.from, flight.to, shapeOverride, chain.depthOffset, level ?? 0);
  else playTargetEffect(scene, moveClass, target, shapeOverride, isUltimate ? afterSettled : undefined, chain.depthOffset, level ?? 0, stage);

  if (!isUltimate) {
    chain.pendingTimer = scene.time.delayedCall(playedMs, afterSettled);
  }
}

// Stops one chain (by `key`), or -- called with no key -- every chain at
// once, and wipes whatever the stopped chain(s) currently have on screen
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
  cancelPreviewFx(chain.depthOffset);
  clearPreviewClip(chain.depthOffset);
  chains.delete(key);
}
