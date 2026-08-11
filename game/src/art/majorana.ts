import Phaser from 'phaser';
import { shade } from './colors';

// Majorana's avatar -- world 5's guardian (superconductivity/Majorana pairs).
// Own file, same convention as every other guardian (glow -> sway -> cloak ->
// head-motif -> orbit ring). Head motif: two pale half-particle glyphs
// orbiting each other in place of a face -- a fermion that is its own
// antiparticle, split into a pair.
export function makeMajoranaAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const green = 0x9fffb0;
  const cloakColor = 0x123322;
  const skin = 0xe0d0c0;

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

  const headY = -S * 0.55;

  const cloak = scene.add.graphics();
  cloak.fillStyle(cloakColor, 1);
  cloak.fillPoints(
    [
      { x: -S * 0.44, y: -S * 0.28 },
      { x: S * 0.44, y: -S * 0.28 },
      { x: S * 0.28, y: S * 0.58 },
      { x: 0, y: S * 0.85 },
      { x: -S * 0.28, y: S * 0.58 },
    ],
    true
  );
  cloak.lineStyle(1.5, shade(green, -30), 0.6);
  cloak.strokePoints(
    [
      { x: -S * 0.44, y: -S * 0.28 },
      { x: S * 0.44, y: -S * 0.28 },
      { x: S * 0.28, y: S * 0.58 },
      { x: 0, y: S * 0.85 },
      { x: -S * 0.28, y: S * 0.58 },
    ],
    true
  );
  sway.add(cloak);

  const head = scene.add.graphics();
  head.fillStyle(shade(skin, 4), 1);
  head.fillCircle(0, headY, S * 0.38);
  sway.add(head);

  // Two half-particle glyphs (open half-circles) orbiting a shared center in
  // place of a face -- always exactly opposite each other, since a Majorana
  // pair is one whole fermion split in two.
  const pair = scene.add.container(0, headY);
  const half = (flip: number) => {
    const g = scene.add.graphics();
    g.lineStyle(1.6, green, 0.95);
    g.beginPath();
    g.arc(flip * S * 0.16, 0, S * 0.14, Phaser.Math.DegToRad(flip > 0 ? -90 : 90), Phaser.Math.DegToRad(flip > 0 ? 90 : 270), false);
    g.strokePath();
    g.fillStyle(green, 0.5);
    g.fillCircle(flip * S * 0.16, 0, S * 0.03);
    return g;
  };
  pair.add([half(-1), half(1)]);
  sway.add(pair);
  scene.tweens.add({ targets: pair, angle: 360, duration: 3400, repeat: -1, ease: 'Linear' });

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
