// Where a battle effect draws.
//
// An anchor is a *live* position, not a copied pair of numbers: every draw
// function in art/attackShapes.ts / art/attackUltimates.ts reads `.x`/`.y`
// off one of these on every tween tick, so whatever the anchor points at is
// where that part of the effect renders that frame. This is what keeps the
// attacker's side of an effect and the target's side fully independent of
// each other: a windup flash resolves only the attacker's anchor, an impact
// shockwave (or a falling beam, a ground eruption, a summon circle) resolves
// only the target's, and neither has to know -- or stay in step with --
// where the other crystal currently is. Move either crystal and its own side
// of the effect follows it on its own.
//
// The one place information legitimately crosses sides is *aim*: a
// travelling projectile has to be launched from somewhere toward something.
// That crossing is a single launch-time sample (`latchAnchor` below), not an
// ongoing dependency -- once a bolt is in flight its origin is fixed where
// it was fired from, while its destination keeps tracking the target's live
// anchor so it still lands on the crystal rather than on empty field.
export interface EffectAnchor {
  readonly x: number;
  readonly y: number;
}

// An anchor that re-reads a game object's position every time it's sampled.
// `get` returns the object rather than the caller passing the object itself,
// so an owner that *replaces* the object mid-effect keeps being tracked --
// BattleScene's `transmuteAdapted` destroys and rebuilds `opponentCrystal`
// from inside `checkEndOrContinue`, which for an ordinary move runs while
// that move's own effect is still on screen, and a thunk to the field picks
// the new crystal up instead of pointing at a destroyed one.
export function followAnchor(get: () => { x: number; y: number }): EffectAnchor {
  return {
    get x() {
      return get().x;
    },
    get y() {
      return get().y;
    },
  };
}

// An anchor fixed at a point that never moves -- what a caller with no game
// object to follow uses (art/moveEffectPreview.ts's guardian-panel previews,
// which lay their effects out against a detail pane's own local coordinates).
export function fixedAnchor(x: number, y: number): EffectAnchor {
  return { x, y };
}

// One sample of an anchor, frozen -- a launch-time aim, per this file's own
// header. Used for a travelling shape's origin so a projectile already in
// flight isn't dragged around by an attacker that has since moved.
export function latchAnchor(anchor: EffectAnchor): EffectAnchor {
  return { x: anchor.x, y: anchor.y };
}
