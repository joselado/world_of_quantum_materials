import Phaser from 'phaser';
import { shade } from './colors';

// Landau's avatar -- world 4's guardian (Landau quantization: a perpendicular
// magnetic field turns a two-dimensional electron gas into a shifted harmonic
// oscillator, so its continuous band collapses into discrete, equally spaced,
// completely flat levels E_n = hbar*omega_c*(n + 1/2), world 4's own topic).
// Not a robed figure at all: the body is that spectrum itself. Five equal-length
// horizontal rungs, evenly spaced -- equal length because a Landau level is
// dispersionless, the energy independent of momentum; evenly spaced because the
// oscillator ladder puts every gap at the same hbar*omega_c. The lowest rung is
// brightest and they dim upward, the filled levels sitting below the empty
// ones. Behind them a single faint parabola is the free p^2/2m band the field
// quantizes, so the silhouette reads as a continuum caught mid-collapse into
// rungs. One bright electron climbs the ladder in discrete jumps (a stepped
// tween, never a slide -- there is no energy between two levels to slide
// through). Orbit glyphs read 'hbar*omega', the level spacing.
//
// Drawn in local space centered on the chest/torso (0,0), same convention
// as every other avatar builder: an internal sway tween is baked in, so
// callers are free to layer their own position/bob tween on top.
export function makeLandauAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const navy = 0x6a7fff;
  const rungColor = 0x9fb0ff;

  const outer = scene.add.container(0, 0);

  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(navy, 0.16);
  glow.fillCircle(0, -S * 0.05, S * 0.85);
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

  // The zero-field band, drawn first so the rungs sit over it: one thin
  // parabola through the same span the ladder occupies.
  const band = scene.add.graphics();
  band.lineStyle(1, rungColor, 0.22);
  band.beginPath();
  for (let i = 0; i <= 24; i++) {
    const t = -1 + (2 * i) / 24;
    const bx = t * S * 0.82;
    const by = S * 0.68 - t * t * S * 1.4;
    if (i === 0) band.moveTo(bx, by);
    else band.lineTo(bx, by);
  }
  band.strokePath();
  sway.add(band);

  // The ladder itself. Half-width and gap are constant across rungs -- the
  // step edges are the silhouette, so they stay coarse enough to survive the
  // Lab's 0.55 scale.
  const rungCount = 5;
  const halfW = S * 0.62;
  const gap = S * 0.31;
  const rungH = S * 0.13;
  const rungY = (n: number) => (n - (rungCount - 1) / 2) * -gap;
  const ladder = scene.add.graphics();
  for (let n = 0; n < rungCount; n++) {
    ladder.fillStyle(shade(rungColor, -n * 9), 1);
    ladder.fillRoundedRect(-halfW, rungY(n) - rungH / 2, halfW * 2, rungH, rungH / 2);
  }
  sway.add(ladder);

  // The electron, jumping rung to rung rather than sliding between them.
  const electron = scene.add.graphics();
  electron.fillStyle(0xffffff, 0.95);
  electron.fillCircle(0, 0, S * 0.1);
  electron.lineStyle(1.2, rungColor, 0.8);
  electron.strokeCircle(0, 0, S * 0.16);
  electron.setPosition(0, rungY(0));
  sway.add(electron);
  scene.tweens.add({
    targets: electron,
    y: { from: rungY(0), to: rungY(rungCount - 1) },
    duration: 2600,
    yoyo: true,
    repeat: -1,
    ease: 'Stepped',
    easeParams: [rungCount - 1],
  });

  // Orbit glyphs read the level spacing rather than a generic '±' -- one
  // fixed quantum of energy between any two rungs is the whole of Landau
  // quantization.
  const orbit = scene.add.container(0, 0);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    const spark = scene.add
      .text(Math.cos(ang) * S * 0.98, Math.sin(ang) * S * 0.98, 'ħω', {
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
