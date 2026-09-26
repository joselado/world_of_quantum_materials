import Phaser from 'phaser';

// Object creation for the battle-effect shapes (art/attackShapes.ts,
// art/attackAnalytics.ts, art/attackUltimates.ts), routed through one place
// so a *preview* of an effect can be torn down mid-flight.
//
// A real cast in BattleScene is fire-and-forget: every phase destroys its own
// objects in its own tween's onComplete, and nothing outside ever needs to
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
//
// What a shape can create: an additive Graphics (the ordinary silhouettes,
// runes and cracks), a tinted image or tile sprite of one of
// art/fxTextures.ts's painted textures (a beam's shaft, a meteor's rock, a
// shockwave), and a particle emitter of one (sparks, embers, smoke, dust,
// debris). All of them come through here, so every one of them is masked to
// its preview stage and swept up by cancelPreviewFx alike.
const previewObjects: Phaser.GameObjects.GameObject[] = [];
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
// object it creates is masked to that rectangle, so an effect is a
// demonstration running on its own little stage instead of something loose
// on the screen.
//
// Keyed by `depthOffset` because that number is already each preview chain's
// own identity here: art/moveEffectPreview.ts hands every simultaneously
// running chain a distinct one (Landau's and Skłodowska-Curie's panels each
// run two at once, one per column, and each is confined to its own column),
// and it is the one value already threaded down to every shape-drawing call
// site. A real cast passes 0, finds no entry, and is masked by nothing.
//
// The mask source is a `make.graphics` -- built but never added to the
// display list, since a geometry mask uses a shape rather than a rendering --
// and is tracked apart from `previewObjects` so cancelling can never destroy
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
// object already on screen holds a reference to that mask object --
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

// Everything an effect draws with has a depth, a blend mode and can take a
// mask -- which is all this module needs of it.
type FxObject = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Depth &
  Phaser.GameObjects.Components.BlendMode &
  Phaser.GameObjects.Components.Mask;

// Places any effect object at its depth and blend, and -- for a preview --
// tracks it for cancelPreviewFx and clips it to its stage.
function place<T extends FxObject>(obj: T, depth: number, depthOffset: number, blend: Phaser.BlendModes): T {
  obj.setDepth(depth + depthOffset);
  obj.setBlendMode(blend);
  if (isPreview(depthOffset)) {
    previewObjects.push(obj);
    const clip = previewClips.get(depthOffset);
    if (clip) obj.setMask(clip.mask);
  }
  return obj;
}

// The additive-blended Graphics object a shape draws itself into.
export function fxGraphics(scene: Phaser.Scene, depth: number, depthOffset: number): Phaser.GameObjects.Graphics {
  return place(scene.add.graphics(), depth, depthOffset, Phaser.BlendModes.ADD);
}

// An image of one of art/fxTextures.ts's textures, at (0, 0) until its
// effect positions it. Additive by default (light); a rock or a puff of
// smoke asks for NORMAL, a ground shadow for MULTIPLY.
export function fxImage(
  scene: Phaser.Scene,
  depth: number,
  depthOffset: number,
  key: string,
  frame?: string,
  blend: Phaser.BlendModes = Phaser.BlendModes.ADD
): Phaser.GameObjects.Image {
  return place(scene.add.image(0, 0, key, frame), depth, depthOffset, blend);
}

// A tile sprite of one of those textures, for something that scrolls (the
// turbulence running along a beam).
export function fxTileSprite(
  scene: Phaser.Scene,
  depth: number,
  depthOffset: number,
  key: string,
  width: number,
  height: number,
  blend: Phaser.BlendModes = Phaser.BlendModes.ADD
): Phaser.GameObjects.TileSprite {
  return place(scene.add.tileSprite(0, 0, width, height, key), depth, depthOffset, blend);
}

// A particle emitter of one of those textures. Emitters here sit at the
// origin and never move: particles are emitted at explicit world points
// (emitParticleAt / explode / FxSpout), so a plume trailing a falling mass
// stays where it was left in the air rather than being dragged along with
// the emitter -- an emitter's particles live in its own local space.
export function fxEmitter(
  scene: Phaser.Scene,
  depth: number,
  depthOffset: number,
  key: string,
  config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
  blend: Phaser.BlendModes = Phaser.BlendModes.ADD
): Phaser.GameObjects.Particles.ParticleEmitter {
  return place(scene.add.particles(0, 0, key, config), depth, depthOffset, blend);
}

// Ends an emitter's part in an effect without cutting off what it has
// already thrown: emission stops now and the emitter is destroyed once its
// longest-lived particle can have died. A preview's cancel destroys the
// emitter itself at once (it is tracked like every other object), and the
// timer then finds an already-destroyed object, which destroy() ignores.
export function fxRetire(scene: Phaser.Scene, depthOffset: number, emitter: Phaser.GameObjects.Particles.ParticleEmitter, afterMs: number) {
  emitter.stop();
  fxDelayedCall(scene, depthOffset, afterMs, () => emitter.destroy());
}

// A steady stream of particles from a moving point: call emit() every frame
// with the scene clock and it integrates the rate over the time elapsed, so
// the stream is the same density at any frame rate and a point that moves
// between frames leaves no gaps in what it trails.
export class FxSpout {
  private acc = 0;
  private last = -1;
  constructor(private readonly emitter: Phaser.GameObjects.Particles.ParticleEmitter) {}

  emit(now: number, x: number, y: number, perSecond: number) {
    const n = this.take(now, perSecond);
    if (n > 0) this.emitter.emitParticleAt(x, y, n);
  }

  // The same stream with each particle at a point of its own (a swarm
  // falling in from all around a core, dust rising off a whole floor).
  emitEach(now: number, perSecond: number, at: () => { x: number; y: number }) {
    const n = this.take(now, perSecond);
    for (let i = 0; i < n; i++) {
      const p = at();
      this.emitter.emitParticleAt(p.x, p.y, 1);
    }
  }

  // How many particles the elapsed time has earned at this rate.
  private take(now: number, perSecond: number): number {
    if (this.last < 0) this.last = now;
    const dt = Math.min(100, now - this.last);
    this.last = now;
    this.acc += (dt / 1000) * perSecond;
    const n = Math.floor(this.acc);
    if (n > 0) this.acc -= n;
    return n;
  }
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

// The stagger between a leveled move's repeats (art/attackEffects.ts), and
// an emitter's deferred teardown (fxRetire).
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
  for (const obj of previewObjects) obj.destroy();
  previewTweens.length = 0;
  previewTimers.length = 0;
  previewObjects.length = 0;
  for (const depthOffset of [...previewClips.keys()]) clearPreviewClip(depthOffset);
}
