import Phaser from 'phaser';
import { shade } from './colors';

// Einstein's avatar -- world 7's mentor (entanglement/tensor networks,
// fittingly the physicist whose own objection to entanglement -- the EPR
// paradox -- made it a central problem). Own file, same convention as every
// other mentor (glow -> sway -> cloak -> head-motif -> orbit ring). Head
// motif: a warped spacetime grid in place of a face, grey/white rather than
// any other mentor's palette.
export function makeEinsteinAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const grey = 0xdfe6ec;
  const cloakColor = 0x2a2e36;
  const skin = 0xe6d2b8;

  const outer = scene.add.container(0, 0);

  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(grey, 0.14);
  glow.fillCircle(0, -S * 0.15, S * 0.85);
  outer.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.55, to: 1 },
    scaleX: { from: 0.9, to: 1.1 },
    scaleY: { from: 0.9, to: 1.1 },
    duration: 2100,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const sway = scene.add.container(0, 0);
  outer.add(sway);
  scene.tweens.add({ targets: sway, angle: { from: -2.2, to: 2.2 }, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

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
  cloak.lineStyle(1.5, shade(grey, -40), 0.6);
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

  // A small warped grid -- straight lines that dip toward a central mass,
  // the classic "rubber sheet" spacetime-curvature picture, drawn small
  // enough to sit where a face would go.
  const grid = scene.add.graphics();
  grid.lineStyle(1, grey, 0.7);
  const dip = (x: number) => (x * x) / (S * 0.5);
  for (let gx = -2; gx <= 2; gx++) {
    const x = gx * S * 0.1;
    grid.beginPath();
    grid.moveTo(x, headY - S * 0.2);
    grid.lineTo(x, headY - S * 0.02 + dip(x) * 0.4);
    grid.strokePath();
  }
  for (let gy = -1; gy <= 1; gy++) {
    grid.beginPath();
    for (let gx = -2; gx <= 2; gx++) {
      const x = gx * S * 0.1;
      const y = headY - S * 0.02 + gy * S * 0.09 + dip(x) * 0.4;
      if (gx === -2) grid.moveTo(x, y);
      else grid.lineTo(x, y);
    }
    grid.strokePath();
  }
  sway.add(grid);

  const orbit = scene.add.container(0, 0);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    const spark = scene.add
      .text(Math.cos(ang) * S * 0.95, Math.sin(ang) * S * 0.95 - S * 0.1, '⚭', {
        fontSize: `${Math.round(S * 0.3)}px`,
        color: '#dfe6ec',
      })
      .setOrigin(0.5);
    orbit.add(spark);
  }
  sway.add(orbit);
  scene.tweens.add({ targets: orbit, angle: 360, duration: 5600, repeat: -1, ease: 'Linear' });

  return outer;
}
