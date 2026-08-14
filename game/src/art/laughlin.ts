import Phaser from 'phaser';
import { shade } from './colors';
import { ellipseSteps } from './shapes';

// Laughlin's avatar -- world 4's guardian (the fractional quantum Hall
// wavefunction: a strong-field electron liquid that condenses into an
// incompressible state whose excitations carry a fraction of an electron's
// charge, world 4's own topic). Not a robed figure at all: the whole body is
// the electron liquid itself, drawn as the stepped "wedding-cake" density
// profile an incompressible quantum Hall droplet actually takes -- flat
// plateaus at quantized filling separated by sharp steps -- stacked as four
// elliptical tiers narrowing upward. One hollow quasihole floats lifted
// above the top tier on a faint line: the fractionally charged excitation
// pulled out of the liquid. Orbit glyphs read '1/3', the Laughlin filling.
//
// Drawn in local space centered on the chest/torso (0,0), same convention
// as every other avatar builder: an internal sway tween is baked in, so
// callers are free to layer their own position/bob tween on top.
export function makeLaughlinAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const navy = 0x6a7fff;
  const liquidColor = 0x1c2050;

  const outer = scene.add.container(0, 0);

  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(navy, 0.16);
  glow.fillCircle(0, -S * 0.15, S * 0.85);
  outer.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.6, to: 1 },
    scaleX: { from: 0.92, to: 1.08 },
    scaleY: { from: 0.92, to: 1.08 },
    duration: 1900,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const sway = scene.add.container(0, 0);
  outer.add(sway);
  scene.tweens.add({ targets: sway, angle: { from: -2.2, to: 2.2 }, duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // The droplet, bottom tier first so each higher plateau overlaps the one
  // below it. Widths shrink in visible steps -- the step edges are the
  // silhouette, so they stay coarse enough to survive the Lab's 0.55 scale.
  const tiers = [
    { halfW: 0.78, y: 0.64 },
    { halfW: 0.58, y: 0.32 },
    { halfW: 0.4, y: 0.0 },
    { halfW: 0.24, y: -0.32 },
  ];
  const droplet = scene.add.graphics();
  tiers.forEach((tier, i) => {
    const w = tier.halfW * 2 * S;
    const h = S * 0.38;
    droplet.fillStyle(shade(liquidColor, i * 10), 1);
    droplet.fillEllipse(0, tier.y * S, w, h, ellipseSteps(w, h));
    droplet.lineStyle(1.3, shade(navy, -12 + i * 8), 0.75);
    droplet.strokeEllipse(0, tier.y * S, w, h, ellipseSteps(w, h));
  });
  sway.add(droplet);

  // The quasihole: a hollow dot lifted clear of the liquid on a faint
  // extraction line -- a fraction of an electron, leaving the droplet.
  const hole = scene.add.graphics();
  hole.lineStyle(1, 0xffffff, 0.35);
  hole.beginPath();
  hole.moveTo(S * 0.14, -S * 0.45);
  hole.lineTo(S * 0.14, -S * 0.68);
  hole.strokePath();
  hole.lineStyle(1.4, 0xffffff, 0.9);
  hole.strokeCircle(S * 0.14, -S * 0.76, S * 0.08);
  sway.add(hole);
  scene.tweens.add({
    targets: hole,
    y: { from: 0, to: -S * 0.08 },
    alpha: { from: 0.7, to: 1 },
    duration: 1600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  // Orbit glyphs read '1/3' rather than a generic '±' -- the fractional
  // charge is the whole point of the fractional quantum Hall effect.
  const orbit = scene.add.container(0, 0);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    const spark = scene.add
      .text(Math.cos(ang) * S * 0.95, Math.sin(ang) * S * 0.95 - S * 0.1, '⅓', {
        fontSize: `${Math.round(S * 0.3)}px`,
        color: '#8fa0ff',
      })
      .setOrigin(0.5);
    orbit.add(spark);
  }
  sway.add(orbit);
  scene.tweens.add({ targets: orbit, angle: 360, duration: 5200, repeat: -1, ease: 'Linear' });

  return outer;
}
