import Phaser from 'phaser';
import { shade } from './colors';

// Anderson's avatar -- world 6's guardian (disorder and localization, and
// the doping mechanic that embeds an impurity's move in the player). The
// figure has no outline at all: it is a loose scatter of chunky disordered
// fragments -- densest through the torso, thinning toward the edges like a
// localized wave's decaying envelope -- with one bright site pulsing at the
// heart where the amplitude is trapped. Nothing connects the fragments
// (unlike Feynman's propagator lattice next to him in the Lab): disorder
// has no bonds, only sites. Orbit glyphs read '×', the impurity marks.
//
// Drawn in local space centered on the chest/torso (0,0), same convention
// as every other avatar builder: an internal sway tween is baked in, so
// callers are free to layer their own position/bob tween on top.
export function makeAndersonAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const rust = 0xc9884a;

  const outer = scene.add.container(0, 0);

  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(rust, 0.16);
  glow.fillCircle(0, -S * 0.15, S * 0.85);
  outer.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.55, to: 1 },
    scaleX: { from: 0.9, to: 1.1 },
    scaleY: { from: 0.9, to: 1.1 },
    duration: 1600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const sway = scene.add.container(0, 0);
  outer.add(sway);
  scene.tweens.add({ targets: sway, angle: { from: -2.7, to: 2.7 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // The fragments: each a small rotated quad, hand-placed so the scatter
  // still suggests a standing figure -- a head-cluster, shoulders, a dense
  // torso, a flaring hem -- while every piece stays disconnected. `spread`
  // is the fragment's half-size; pieces stay chunky (>= 0.07*S) so the
  // scatter survives the Lab's 0.55 scale instead of dissolving into dust.
  const fragments: { x: number; y: number; r: number; rot: number; tint: number; alpha: number }[] = [
    // head cluster
    { x: -0.08, y: -0.62, r: 0.13, rot: 0.4, tint: 10, alpha: 0.95 },
    { x: 0.12, y: -0.52, r: 0.1, rot: 1.1, tint: -5, alpha: 0.9 },
    { x: -0.02, y: -0.4, r: 0.09, rot: 2.0, tint: 0, alpha: 0.85 },
    // shoulders
    { x: -0.32, y: -0.22, r: 0.12, rot: 0.9, tint: -10, alpha: 0.9 },
    { x: 0.3, y: -0.26, r: 0.11, rot: 2.4, tint: -10, alpha: 0.9 },
    // torso, dense around the localized core
    { x: -0.14, y: -0.06, r: 0.11, rot: 1.6, tint: 5, alpha: 0.95 },
    { x: 0.16, y: 0.02, r: 0.12, rot: 0.2, tint: 5, alpha: 0.95 },
    { x: 0.0, y: 0.18, r: 0.1, rot: 2.8, tint: 0, alpha: 0.9 },
    { x: -0.24, y: 0.16, r: 0.09, rot: 1.2, tint: -15, alpha: 0.85 },
    // hem, flaring wider and fading
    { x: -0.36, y: 0.48, r: 0.12, rot: 0.7, tint: -20, alpha: 0.75 },
    { x: -0.1, y: 0.6, r: 0.13, rot: 1.9, tint: -15, alpha: 0.8 },
    { x: 0.18, y: 0.54, r: 0.11, rot: 2.6, tint: -20, alpha: 0.75 },
    { x: 0.4, y: 0.42, r: 0.09, rot: 0.3, tint: -25, alpha: 0.65 },
    // stray far sites -- the envelope's decaying tail
    { x: -0.56, y: 0.06, r: 0.07, rot: 1.4, tint: -30, alpha: 0.5 },
    { x: 0.54, y: 0.2, r: 0.07, rot: 2.2, tint: -30, alpha: 0.5 },
  ];
  const body = scene.add.graphics();
  fragments.forEach((f) => {
    const cx = f.x * S;
    const cy = f.y * S;
    const r = f.r * S;
    body.fillStyle(shade(rust, f.tint), f.alpha);
    body.fillPoints(
      [
        { x: cx + Math.cos(f.rot) * r, y: cy + Math.sin(f.rot) * r },
        { x: cx + Math.cos(f.rot + 1.8) * r * 0.8, y: cy + Math.sin(f.rot + 1.8) * r * 0.8 },
        { x: cx + Math.cos(f.rot + Math.PI) * r * 1.1, y: cy + Math.sin(f.rot + Math.PI) * r * 1.1 },
        { x: cx + Math.cos(f.rot + 4.6) * r * 0.9, y: cy + Math.sin(f.rot + 4.6) * r * 0.9 },
      ],
      true
    );
  });
  sway.add(body);

  // The localized site: one bright point at the heart of the scatter, with
  // an additive halo, pulsing in place -- amplitude trapped by disorder
  // rather than spreading. The only bright thing in the whole figure.
  const core = scene.add.graphics();
  core.setBlendMode(Phaser.BlendModes.ADD);
  core.fillStyle(rust, 0.35);
  core.fillCircle(0, S * 0.02, S * 0.2);
  core.fillStyle(0xffffff, 0.95);
  core.fillCircle(0, S * 0.02, S * 0.085);
  sway.add(core);
  scene.tweens.add({
    targets: core,
    alpha: { from: 0.6, to: 1 },
    duration: 900,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const orbit = scene.add.container(0, 0);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    const spark = scene.add
      .text(Math.cos(ang) * S * 0.95, Math.sin(ang) * S * 0.95 - S * 0.1, '×', {
        fontSize: `${Math.round(S * 0.34)}px`,
        color: '#c9884a',
      })
      .setOrigin(0.5);
    orbit.add(spark);
  }
  sway.add(orbit);
  scene.tweens.add({ targets: orbit, angle: 360, duration: 4600, repeat: -1, ease: 'Linear' });

  return outer;
}
