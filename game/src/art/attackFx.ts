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

// Where a preview is allowed to draw.
//
// A battle effect is composed against the whole arena -- a beam falls from
// above the top of the field, an eruption throws debris well past its own
// impact point -- so played at panel scale it covers the panel and the room
// behind it rather than the pane it belongs to. Each preview declares the
// rectangle it plays inside (STYLE.md's "Move preview stages") and every
// Graphics it creates is masked to that rectangle, so an effect is a
// demonstration running on its own little stage instead of something loose
// on the screen.
//
// Keyed by `depthOffset` because that number is already each preview chain's
// own identity here: art/moveEffectPreview.ts hands every simultaneously
// running chain a distinct one (Landau's and Skłodowska-Curie's panels each
// run two at once, one per column, and each is confined to its own column),
// and it is the one value already threaded down to every shape-drawing call
// site in art/attackShapes.ts / art/attackUltimates.ts. A real cast passes 0,
// finds no entry, and is masked by nothing.
//
// The mask source is a `make.graphics` -- built but never added to the
// display list, since a geometry mask uses a shape rather than a rendering --
// and is tracked apart from `previewGraphics` so cancelling can never destroy
// one twice.
const previewClips = new Map<number, { scene: Phaser.Scene; mask: Phaser.Display.Masks.GeometryMask; source: Phaser.GameObjects.Graphics }>();

export interface PreviewClipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Declares (or moves) the rectangle the chain drawing at `depthOffset` plays
// inside. A chain already registered for this scene keeps its existing mask
// and just has its source redrawn: a panel re-renders its whole pane on any
// state change, which can happen with a play still in flight, and every
// Graphics already on screen holds a reference to that mask object --
// swapping in a new one would leave them pointing at a destroyed mask. The
// mask *is* rebuilt when the scene changes, since the same guardian panel
// opens from both the Overworld and the Lab and a mask whose source belongs
// to a stopped scene draws nothing.
export function setPreviewClip(scene: Phaser.Scene, depthOffset: number, rect: PreviewClipRect) {
  const existing = previewClips.get(depthOffset);
  if (existing && existing.scene === scene) {
    existing.source.clear();
    existing.source.fillStyle(0xffffff);
    existing.source.fillRect(rect.x, rect.y, rect.width, rect.height);
    return;
  }
  clearPreviewClip(depthOffset);
  const source = scene.make.graphics({}, false);
  source.fillStyle(0xffffff);
  source.fillRect(rect.x, rect.y, rect.width, rect.height);
  previewClips.set(depthOffset, { scene, mask: source.createGeometryMask(), source });
}

export function clearPreviewClip(depthOffset: number) {
  const existing = previewClips.get(depthOffset);
  if (!existing) return;
  existing.mask.destroy();
  existing.source.destroy();
  previewClips.delete(depthOffset);
}

// The additive-blended Graphics object every shape draws itself into.
export function fxGraphics(scene: Phaser.Scene, depth: number, depthOffset: number): Phaser.GameObjects.Graphics {
  const g = scene.add
    .graphics()
    .setDepth(depth + depthOffset)
    .setBlendMode(Phaser.BlendModes.ADD);
  if (isPreview(depthOffset)) {
    previewGraphics.push(g);
    const clip = previewClips.get(depthOffset);
    if (clip) g.setMask(clip.mask);
  }
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
  for (const depthOffset of [...previewClips.keys()]) clearPreviewClip(depthOffset);
}
