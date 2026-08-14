import Phaser from 'phaser';
import { shade } from './colors';

// Majorana's avatar -- world 5's guardian (superconductivity/Majorana
// pairs, and the fusion mechanic that joins two crystals into one). The
// figure is split clean down the middle: two mirrored half-cloaks and two
// half-heads with a gap of dark between them, held together only by a thin
// thread of pulsing motes running down the seam -- one fermion carried as
// two spatially separated Majorana halves, the shared nonlocal state the
// visible link. The halves breathe apart and back together, never quite
// separating. Orbit glyphs read 'γ', the Majorana operator.
//
// Drawn in local space centered on the chest/torso (0,0), same convention
// as every other avatar builder: an internal sway tween is baked in, so
// callers are free to layer their own position/bob tween on top.
export function makeMajoranaAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const green = 0x9fffb0;
  const cloakColor = 0x123322;
  const skin = 0xe0d0c0;
  const headY = -S * 0.55;

  const outer = scene.add.container(0, 0);

  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(green, 0.16);
  glow.fillCircle(0, -S * 0.15, S * 0.85);
  outer.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.55, to: 1 },
    scaleX: { from: 0.9, to: 1.1 },
    scaleY: { from: 0.9, to: 1.1 },
    duration: 2000,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const sway = scene.add.container(0, 0);
  outer.add(sway);
  scene.tweens.add({ targets: sway, angle: { from: -2.4, to: 2.4 }, duration: 2700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // One half of the figure: a half-cloak with a straight inner edge at the
  // seam, and a half-head above it. Built once and mirrored, so the two
  // halves can never drift out of shape with each other.
  const buildHalf = (flip: number) => {
    const half = scene.add.container(0, 0);
    const g = scene.add.graphics();
    const inner = flip * S * 0.09;
    g.fillStyle(cloakColor, 1);
    g.fillPoints(
      [
        { x: inner, y: -S * 0.3 },
        { x: flip * S * 0.48, y: -S * 0.26 },
        { x: flip * S * 0.3, y: S * 0.56 },
        { x: inner, y: S * 0.82 },
      ],
      true
    );
    g.lineStyle(1.5, shade(green, -30), 0.7);
    g.strokePoints(
      [
        { x: inner, y: -S * 0.3 },
        { x: flip * S * 0.48, y: -S * 0.26 },
        { x: flip * S * 0.3, y: S * 0.56 },
        { x: inner, y: S * 0.82 },
      ],
      true
    );
    g.fillStyle(shade(skin, 4), 1);
    g.beginPath();
    g.arc(inner, headY, S * 0.28, Phaser.Math.DegToRad(flip > 0 ? -90 : 90), Phaser.Math.DegToRad(flip > 0 ? 90 : 270), false);
    g.fillPath();
    half.add(g);
    return half;
  };
  const halfL = buildHalf(-1);
  const halfR = buildHalf(1);
  sway.add(halfL);
  sway.add(halfR);
  const drift = S * 0.05;
  scene.tweens.add({ targets: halfL, x: { from: 0, to: -drift }, duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  scene.tweens.add({ targets: halfR, x: { from: 0, to: drift }, duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // The seam: three motes of the shared state, strung down the gap -- the
  // one whole fermion the two halves still add up to.
  const thread = scene.add.graphics();
  thread.setBlendMode(Phaser.BlendModes.ADD);
  [headY, 0, S * 0.45].forEach((y) => {
    thread.fillStyle(green, 0.9);
    thread.fillCircle(0, y, S * 0.045);
  });
  sway.add(thread);
  scene.tweens.add({
    targets: thread,
    alpha: { from: 0.35, to: 1 },
    duration: 1400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const orbit = scene.add.container(0, 0);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    const spark = scene.add
      .text(Math.cos(ang) * S * 0.95, Math.sin(ang) * S * 0.95 - S * 0.1, 'γ', {
        fontSize: `${Math.round(S * 0.3)}px`,
        color: '#9fffb0',
      })
      .setOrigin(0.5);
    orbit.add(spark);
  }
  sway.add(orbit);
  scene.tweens.add({ targets: orbit, angle: -360, duration: 5400, repeat: -1, ease: 'Linear' });

  return outer;
}
