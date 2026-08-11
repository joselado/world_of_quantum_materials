import Phaser from 'phaser';
import { shade } from './colors';

// A shiny little cloud rather than a faceted gem -- a cluster of soft
// overlapping lobes plus a bright core, halo and sparkles -- so a qumatessence
// pickup reads as distinct from the faceted wild-encounter/player crystals
// at a glance, in addition to its tier color.
export function makeToken(scene: Phaser.Scene, size: number, color: number): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);

  const halo = scene.add.circle(0, 0, size * 1.25, color, 0.2);
  container.add(halo);

  const lobes = [
    { dx: 0, dy: 0.1, r: 0.68 },
    { dx: -0.52, dy: 0.22, r: 0.5 },
    { dx: 0.52, dy: 0.22, r: 0.5 },
    { dx: -0.26, dy: -0.28, r: 0.46 },
    { dx: 0.26, dy: -0.28, r: 0.46 },
    { dx: 0, dy: -0.42, r: 0.4 },
  ];
  lobes.forEach((l) => {
    const c = scene.add.circle(l.dx * size, l.dy * size, l.r * size, shade(color, -5), 0.92);
    container.add(c);
  });

  const core = scene.add.circle(0, -size * 0.02, size * 0.4, shade(color, 45), 1);
  container.add(core);

  const highlight = scene.add.ellipse(-size * 0.2, -size * 0.32, size * 0.36, size * 0.2, 0xffffff, 0.75);
  highlight.setRotation(-0.4);
  container.add(highlight);

  const sparkleOffsets = [
    { x: size * 0.6, y: -size * 0.5 },
    { x: -size * 0.62, y: size * 0.05 },
    { x: size * 0.05, y: size * 0.55 },
  ];
  sparkleOffsets.forEach((p, i) => {
    const star = scene.add
      .text(p.x, p.y, '✦', { fontSize: `${Math.round(size * 0.34)}px`, color: '#ffffff' })
      .setOrigin(0.5);
    container.add(star);
    scene.tweens.add({
      targets: star,
      alpha: { from: 0.15, to: 1 },
      duration: 600 + i * 180,
      yoyo: true,
      repeat: -1,
      delay: i * 200,
    });
  });

  return container;
}
