import Phaser from 'phaser';

// Object creation for the battle-effect shapes (art/attackShapes.ts,
// art/attackUltimates.ts), routed through one place so a *preview* of an
// effect can be torn down mid-flight.
//
// A real cast in BattleScene is fire-and-forget: every phase destroys its own
// Graphics in its own tween's onComplete, and nothing outside ever needs to
// interrupt it. A guardian panel's looping preview
// (art/moveEffectPreview.ts) is the opposite case -- the player can close the
// panel at any frame, including halfway through a 5-second Ultimate
// sequence, and whatever is on screen has to go with it rather than keep
// drawing over the room for another several seconds.
//
// `depthOffset` is what tells the two apart: it is 0 for every BattleScene
// call site and a large positive number for a preview (the offset that lifts
// the effect above a dialogue panel's own container), so a nonzero offset
// means "detached preview" and is the single condition for tracking anything
// here. A real cast allocates and tracks nothing extra.
const previewGraphics: Phaser.GameObjects.Graphics[] = [];
const previewTweens: Phaser.Tweens.Tween[] = [];
const previewTimers: Phaser.Time.TimerEvent[] = [];

function isPreview(depthOffset: number): boolean {
  return depthOffset > 0;
}

// The additive-blended Graphics object every shape draws itself into.
export function fxGraphics(scene: Phaser.Scene, depth: number, depthOffset: number): Phaser.GameObjects.Graphics {
  const g = scene.add
    .graphics()
    .setDepth(depth + depthOffset)
    .setBlendMode(Phaser.BlendModes.ADD);
  if (isPreview(depthOffset)) previewGraphics.push(g);
  return g;
}

// The counter tween every shape animates itself from. Cancelling stops these
// before their own onComplete runs, which is what keeps a multi-phase
// sequence (a meteor's summon -> charge -> impact -> aftermath) from
// spawning its next phase after the panel is gone.
export function fxCounter(scene: Phaser.Scene, depthOffset: number, config: Phaser.Types.Tweens.NumberTweenBuilderConfig): Phaser.Tweens.Tween {
  const tween = scene.tweens.addCounter(config);
  if (isPreview(depthOffset)) previewTweens.push(tween);
  return tween;
}

// The stagger between a leveled move's repeats (art/attackEffects.ts).
export function fxDelayedCall(scene: Phaser.Scene, depthOffset: number, delay: number, callback: () => void): Phaser.Time.TimerEvent {
  const timer = scene.time.delayedCall(delay, callback);
  if (isPreview(depthOffset)) previewTimers.push(timer);
  return timer;
}

// Wipes every in-flight preview effect at once. Tweens stop first: a Phaser
// tween's stop() fires onStop, never onComplete, so no phase chained off an
// onComplete gets a chance to draw anything new after this returns.
export function cancelPreviewFx() {
  for (const tween of previewTweens) tween.stop();
  for (const timer of previewTimers) timer.remove(false);
  for (const g of previewGraphics) g.destroy();
  previewTweens.length = 0;
  previewTimers.length = 0;
  previewGraphics.length = 0;
}
