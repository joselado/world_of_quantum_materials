import Phaser from 'phaser';
import { shade } from './colors';
import type { CrystalVariant } from '../data/types';

// A single faceted gem, drawn centered on (0,0) in the Graphics object's own
// local space -- callers position/rotate it via the Graphics object's own
// transform rather than doing point-rotation math by hand.
function drawShardShape(g: Phaser.GameObjects.Graphics, size: number, color: number) {
  const top = { x: 0, y: -size };
  const upperLeft = { x: -size * 0.55, y: -size * 0.25 };
  const upperRight = { x: size * 0.55, y: -size * 0.25 };
  const bottom = { x: 0, y: size * 0.9 };
  const lowerLeft = { x: -size * 0.32, y: size * 0.55 };
  const lowerRight = { x: size * 0.32, y: size * 0.55 };
  const core = { x: 0, y: -size * 0.05 };

  g.fillStyle(shade(color, 45), 1);
  g.fillTriangle(top.x, top.y, upperLeft.x, upperLeft.y, core.x, core.y);

  g.fillStyle(shade(color, 15), 1);
  g.fillTriangle(top.x, top.y, core.x, core.y, upperRight.x, upperRight.y);

  g.fillStyle(shade(color, -15), 1);
  g.fillPoints([core, upperLeft, lowerLeft, bottom], true);

  g.fillStyle(shade(color, -35), 1);
  g.fillPoints([core, bottom, lowerRight, upperRight], true);

  g.lineStyle(2, shade(color, -55), 1);
  g.strokePoints([top, upperRight, lowerRight, bottom, lowerLeft, upperLeft], true);
}

// A layered hexagonal prism -- hex top face + two shaded side faces -- meant to
// read as "geometric, topological" rather than a single organic gem.
function drawPrismShape(g: Phaser.GameObjects.Graphics, size: number, color: number) {
  const s = size;
  const topPts: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = Phaser.Math.DegToRad(60 * i - 90);
    topPts.push({ x: Math.cos(ang) * s * 0.55, y: -s * 0.25 + Math.sin(ang) * s * 0.32 });
  }
  g.fillStyle(shade(color, 35), 1);
  g.fillPoints(topPts, true);
  g.lineStyle(2, shade(color, -45), 1);
  g.strokePoints(topPts, true);

  const frontPts = [
    { x: -s * 0.45, y: -s * 0.05 },
    { x: s * 0.05, y: -s * 0.05 },
    { x: s * 0.05, y: s * 0.75 },
    { x: -s * 0.45, y: s * 0.6 },
  ];
  g.fillStyle(shade(color, -5), 1);
  g.fillPoints(frontPts, true);
  g.lineStyle(2, shade(color, -50), 1);
  g.strokePoints(frontPts, true);

  const sidePts = [
    { x: s * 0.05, y: -s * 0.05 },
    { x: s * 0.5, y: 0 },
    { x: s * 0.5, y: s * 0.7 },
    { x: s * 0.05, y: s * 0.75 },
  ];
  g.fillStyle(shade(color, -30), 1);
  g.fillPoints(sidePts, true);
  g.lineStyle(2, shade(color, -55), 1);
  g.strokePoints(sidePts, true);
}

// Builds a shiny crystal (a Container so it can be positioned/tweened as one
// unit) matching a material's `variant`: a single shard, a jagged cluster of
// three shards, or a layered prism -- plus a specular highlight and a few
// twinkling sparkles for the "shiny" look.
export function makeCrystal(
  scene: Phaser.Scene,
  size: number,
  color: number,
  variant: CrystalVariant
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);

  if (variant === 'cluster') {
    const left = scene.add.graphics();
    drawShardShape(left, size * 0.55, color);
    left.setPosition(-size * 0.4, size * 0.3);
    left.setRotation(Phaser.Math.DegToRad(-18));
    container.add(left);

    const right = scene.add.graphics();
    drawShardShape(right, size * 0.55, color);
    right.setPosition(size * 0.4, size * 0.32);
    right.setRotation(Phaser.Math.DegToRad(16));
    container.add(right);

    const main = scene.add.graphics();
    drawShardShape(main, size * 0.8, color);
    container.add(main);
  } else if (variant === 'prism') {
    const g = scene.add.graphics();
    drawPrismShape(g, size, color);
    container.add(g);
  } else {
    const g = scene.add.graphics();
    drawShardShape(g, size, color);
    container.add(g);
  }

  const highlight = scene.add.ellipse(-size * 0.18, -size * 0.4, size * 0.32, size * 0.16, 0xffffff, 0.55);
  highlight.setRotation(-0.4);
  container.add(highlight);

  const sparkleOffsets = [
    { x: size * 0.55, y: -size * 0.65 },
    { x: -size * 0.6, y: size * 0.1 },
    { x: size * 0.15, y: size * 0.8 },
  ];
  sparkleOffsets.forEach((p, i) => {
    const star = scene.add
      .text(p.x, p.y, '✦', { fontSize: `${Math.round(size * 0.3)}px`, color: '#ffffff' })
      .setOrigin(0.5);
    container.add(star);
    scene.tweens.add({
      targets: star,
      alpha: { from: 0.15, to: 1 },
      duration: 650 + i * 200,
      yoyo: true,
      repeat: -1,
      delay: i * 220,
    });
  });

  return container;
}
