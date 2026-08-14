import Phaser from 'phaser';
import { playTargetEffect, resolveAttackShape, targetEffectTotalDurationMs, cancelPreviewFx, type EffectAnchor } from './attackEffects';
import type { AttackShape } from '../audio/sfx';
import type { MoveClass } from '../data/types';
import type { MoveLevel } from '../data/materials';

// Loops a move's own real battle-effect animation -- the literal effect
// BattleScene fires when the move is cast in a fight, sound and all, not a
// separate static icon or a stripped-down copy -- inside a guardian panel's
// detail pane (STYLE.md's "List+detail panels" and "Laughlin in the
// overworld"/"Skłodowska-Curie in the overworld"; Noether's/Kondo's/
// Laughlin's/Skłodowska-Curie's own panels, scenes/panels/noether.ts,
// kondo.ts, laughlin.ts, sklodowskaCurie.ts, via scenes/panels/listDetail.ts's
// renderMoveDetailHeader/renderSelfBuffMoveDetailHeader).
//
// A caller supplies one point (`at`) -- the centre of its own pane -- and the
// preview plays the *target's* half of the beat there (attackEffects.ts's
// playTargetEffect: what the move does where it lands, with the attacker's
// windup and its flight across the field dropped), plus whichever class/shape
// override that move actually plays with in a real fight (Laughlin's/Curie's
// ANALYTIC_SHAPES/ULTIMATE_SHAPES overrides, resolved by the caller the same
// way BattleScene itself does) and, optionally, the player's own current
// Feynman level for that move (`getMoveLevel`) so the preview escalates into
// the same multi-trigger, growing-size cascade a real leveled cast plays
// instead of always showing the flat unleveled loop.
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
const PREVIEW_DEPTH_OFFSET = 150;

// Pause between one play settling and the next one starting, so the preview
// reads as a repeating demonstration rather than one unbroken strobe.
const LOOP_PAUSE_MS = 500;

export interface MoveEffectPreviewParams {
  scene: Phaser.Scene;
  moveClass: MoveClass;
  // Where the effect lands -- the centre of the caller's own preview stage.
  at: EffectAnchor;
  shapeOverride?: AttackShape;
  level?: MoveLevel;
}

// A preview "chain" is a single looping play, tracked independently of every
// other chain by its own caller-supplied `key`. Laughlin's/Skłodowska-Curie's
// two-column panels (scenes/panels/laughlin.ts/sklodowskaCurie.ts) run two
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
}

const chains = new Map<string, PreviewChain>();

// Starts (or retargets) the preview chain identified by `key`. If a play is
// already in flight for this same chain, this call does NOT fire a second,
// overlapping play on top of it -- it just updates the chain's own `current`,
// and the in-flight play's own settle callback (afterSettled below) picks up
// whatever `current` is by the time it fires. The previously-selected move
// finishes its own cycle, then the newly selected one starts, never both
// drawing at once. A caller doesn't need to call stopMoveEffectPreview itself
// before retargeting a chain (e.g. Laughlin's panel rebuilding after a
// retune), just before tearing the chain down for good (Farewell/close) with
// nothing new to preview in its place.
export function startMoveEffectPreview(params: MoveEffectPreviewParams, key: string = DEFAULT_KEY) {
  const existing = chains.get(key);
  const alreadyRunning = !!existing && existing.scene === params.scene;
  if (existing) {
    existing.current = params;
    existing.scene = params.scene;
  } else {
    chains.set(key, { scene: params.scene, current: params, generation: 0, pendingTimer: null });
  }
  if (alreadyRunning) return;
  const chain = chains.get(key)!;
  chain.generation++;
  playNext(key, chain.generation);
}

function playNext(key: string, myGen: number) {
  const chain = chains.get(key);
  if (!chain || myGen !== chain.generation) return;
  const { scene, moveClass, at, shapeOverride, level } = chain.current;
  const shape = resolveAttackShape(moveClass, shapeOverride);
  const isUltimate = shape === 'meteor' || shape === 'nova';

  // Fires once this play has fully settled (Ultimate's own onComplete for
  // meteor/nova -- already correct for any level, since only the last of a
  // leveled cascade's repeats is ever wired to it, see
  // attackEffects.ts's playUltimateRepeats -- or a timed proxy off
  // targetEffectTotalDurationMs for every other shape, since
  // playTargetEffect never calls onComplete for those) -- schedules the next
  // cycle after a short pause, re-reading this chain's own `current` fresh
  // rather than closing over these params, so a preview retarget mid-flight
  // takes effect on the very next cycle instead of being silently dropped.
  const afterSettled = () => {
    const c = chains.get(key);
    if (!c || myGen !== c.generation) return;
    c.pendingTimer = scene.time.delayedCall(LOOP_PAUSE_MS, () => playNext(key, myGen));
  };

  playTargetEffect(scene, moveClass, at, shapeOverride, isUltimate ? afterSettled : undefined, PREVIEW_DEPTH_OFFSET, level ?? 0);

  if (!isUltimate) {
    chain.pendingTimer = scene.time.delayedCall(targetEffectTotalDurationMs(shape, level ?? 0), afterSettled);
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
    }
    chains.clear();
    cancelPreviewFx();
    return;
  }
  const chain = chains.get(key);
  if (!chain) return;
  chain.generation++;
  if (chain.pendingTimer) chain.scene.time.removeEvent(chain.pendingTimer);
  chains.delete(key);
  // Per-key stops only ever happen when nothing else is previewing (a single
  // chain's own panel closing), so this clears the same screen either way.
  if (chains.size === 0) cancelPreviewFx();
}
