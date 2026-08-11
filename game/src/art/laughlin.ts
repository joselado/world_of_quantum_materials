import Phaser from 'phaser';
import { shade } from './colors';

// Laughlin's avatar -- world 4's guardian (the fractional quantum Hall
// wavefunction: a strong-field electron liquid that condenses into a state
// where the excitations carry a fraction of an electron's charge, world 4's
// own topic). Same structural convention as every other guardian (its own
// file, glow -> sway -> cloak -> head-motif -> orbit ring -- see
// art/mentor.ts), never a shared parameterized builder. Head motif: a row of
// filled Landau-level dots either side of a horizontal "filling" line, with
// one dot excited above it and a hollow gap left behind -- a fractionally
// charged quasihole, made literal (repurposed from an earlier Dirac-sea
// motif, which reads just as well as a row of occupied states with one
// excitation pulled out of it).
export function makeLaughlinAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const navy = 0x6a7fff;
  const cloakColor = 0x1c2050;
  const skin = 0xe0d0c0;

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

  const headY = -S * 0.55;

  // A simple dark cloak silhouette, no visible feet -- floats like Noether's
  // robe but plainer and narrower, matching Laughlin's austere reputation.
  const cloak = scene.add.graphics();
  cloak.fillStyle(cloakColor, 1);
  cloak.fillPoints(
    [
      { x: -S * 0.42, y: -S * 0.28 },
      { x: S * 0.42, y: -S * 0.28 },
      { x: S * 0.26, y: S * 0.6 },
      { x: 0, y: S * 0.85 },
      { x: -S * 0.26, y: S * 0.6 },
    ],
    true
  );
  cloak.lineStyle(1.5, shade(navy, -10), 0.7);
  cloak.strokePoints(
    [
      { x: -S * 0.42, y: -S * 0.28 },
      { x: S * 0.42, y: -S * 0.28 },
      { x: S * 0.26, y: S * 0.6 },
      { x: 0, y: S * 0.85 },
      { x: -S * 0.26, y: S * 0.6 },
    ],
    true
  );
  sway.add(cloak);

  const head = scene.add.graphics();
  head.fillStyle(shade(skin, 4), 1);
  head.fillCircle(0, headY, S * 0.38);
  sway.add(head);

  // The fractional filling row: a horizontal line of filled dots (occupied
  // Landau-level states at partial filling) with one hollow dot excited
  // above the line and a hollow gap left in the row below it -- a
  // fractionally charged quasihole and the quasiparticle it left behind.
  const sea = scene.add.graphics();
  sea.lineStyle(1, navy, 0.6);
  sea.lineBetween(-S * 0.32, headY, S * 0.32, headY);
  for (let i = -2; i <= 2; i++) {
    const x = i * S * 0.13;
    if (i === 0) continue; // the gap the excited dot left behind
    sea.fillStyle(navy, 0.9);
    sea.fillCircle(x, headY + S * 0.08, S * 0.045);
  }
  sea.lineStyle(1, 0xffffff, 0.85);
  sea.strokeCircle(0, headY - S * 0.18, S * 0.05);
  sea.lineStyle(1, 0xffffff, 0.4);
  sea.beginPath();
  sea.moveTo(0, headY);
  sea.lineTo(0, headY - S * 0.13);
  sea.strokePath();
  sway.add(sea);

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
