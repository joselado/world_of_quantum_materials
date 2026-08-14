import Phaser from 'phaser';
import { shade } from './colors';

// Kondo's avatar -- world 8's guardian (quantum magnetism/Kondo physics, a
// direct namesake match, and the self-buff screening moves he sells). The
// Kondo effect drawn whole: a small, dark figure -- the local moment --
// carrying one bold spin arrow, wrapped inside a much larger swirling cloud
// of conduction-electron arcs that screen it. The cloud is the silhouette:
// round and enclosing rather than tall and tapered, the same shape as the
// shield his moves cast on the player. Two arc shells counter-rotate so the
// cloud reads as circulating rather than painted on.
//
// Drawn in local space centered on the chest/torso (0,0), same convention
// as every other avatar builder: an internal sway tween is baked in, so
// callers are free to layer their own position/bob tween on top.
export function makeKondoAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const red = 0xff8f6a;
  const cloakColor = 0x3a1a14;

  const outer = scene.add.container(0, 0);

  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(red, 0.15);
  glow.fillCircle(0, -S * 0.15, S * 0.85);
  outer.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.55, to: 1 },
    scaleX: { from: 0.9, to: 1.1 },
    scaleY: { from: 0.9, to: 1.1 },
    duration: 1800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const sway = scene.add.container(0, 0);
  outer.add(sway);
  scene.tweens.add({ targets: sway, angle: { from: -2.5, to: 2.5 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // The local moment: a deliberately small dark figure at the center of the
  // cloud -- less than half the height of the other guardians, since being
  // dwarfed by its own screening cloud is the point.
  const cy = -S * 0.12;
  const figure = scene.add.graphics();
  figure.fillStyle(cloakColor, 1);
  figure.fillPoints(
    [
      { x: -S * 0.2, y: cy + S * 0.02 },
      { x: S * 0.2, y: cy + S * 0.02 },
      { x: S * 0.13, y: cy + S * 0.4 },
      { x: 0, y: cy + S * 0.52 },
      { x: -S * 0.13, y: cy + S * 0.4 },
    ],
    true
  );
  figure.lineStyle(1.2, shade(red, -30), 0.7);
  figure.strokePoints(
    [
      { x: -S * 0.2, y: cy + S * 0.02 },
      { x: S * 0.2, y: cy + S * 0.02 },
      { x: S * 0.13, y: cy + S * 0.4 },
      { x: 0, y: cy + S * 0.52 },
      { x: -S * 0.13, y: cy + S * 0.4 },
    ],
    true
  );
  figure.fillStyle(shade(cloakColor, 20), 1);
  figure.fillCircle(0, cy - S * 0.12, S * 0.15);
  sway.add(figure);

  // The moment's spin: one bold arrow rising straight through the figure,
  // pulsing -- what the whole cloud is here to screen.
  const spin = scene.add.graphics();
  spin.lineStyle(2, red, 0.95);
  spin.beginPath();
  spin.moveTo(0, cy + S * 0.34);
  spin.lineTo(0, cy - S * 0.34);
  spin.strokePath();
  spin.fillStyle(red, 0.95);
  spin.fillTriangle(0, cy - S * 0.44, -S * 0.07, cy - S * 0.3, S * 0.07, cy - S * 0.3);
  sway.add(spin);
  scene.tweens.add({
    targets: spin,
    alpha: { from: 0.6, to: 1 },
    duration: 1100,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  // The screening cloud: two shells of open conduction-electron arcs, each
  // arc trailing a mote, counter-rotating around the moment. The arcs are
  // the avatar's outer edge -- there is no robe under them at all.
  const shell = (specs: { r: number; start: number; sweep: number; alpha: number }[]) => {
    const c = scene.add.container(0, cy);
    const g = scene.add.graphics();
    specs.forEach((s) => {
      g.lineStyle(1.8, shade(red, 10), s.alpha);
      g.beginPath();
      g.arc(0, 0, s.r, Phaser.Math.DegToRad(s.start), Phaser.Math.DegToRad(s.start + s.sweep), false);
      g.strokePath();
      const end = Phaser.Math.DegToRad(s.start + s.sweep);
      g.fillStyle(shade(red, 25), Math.min(1, s.alpha + 0.15));
      g.fillCircle(Math.cos(end) * s.r, Math.sin(end) * s.r, S * 0.05);
    });
    c.add(g);
    return c;
  };
  const innerShell = shell([
    { r: S * 0.58, start: -30, sweep: 200, alpha: 0.85 },
    { r: S * 0.66, start: 170, sweep: 130, alpha: 0.6 },
  ]);
  const outerShell = shell([
    { r: S * 0.82, start: 80, sweep: 170, alpha: 0.55 },
    { r: S * 0.9, start: -80, sweep: 120, alpha: 0.4 },
  ]);
  sway.add(innerShell);
  sway.add(outerShell);
  scene.tweens.add({ targets: innerShell, angle: 360, duration: 3200, repeat: -1, ease: 'Linear' });
  scene.tweens.add({ targets: outerShell, angle: -360, duration: 5200, repeat: -1, ease: 'Linear' });

  return outer;
}
