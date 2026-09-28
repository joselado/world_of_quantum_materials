import Phaser from 'phaser';
import { drawCrystalSilhouette, makeCrystal } from './crystals';
import { blend } from './colors';
import { drawNetDisc, SPARK_SLICE_MS } from '../scenes/overworld/terrain/materials/consuming';
import type { Material } from '../data/types';

// The Model of You -- World 10's second finale stage (DESIGN.md §6): the
// finished record of the player, which is the Devouring Mirror's reflection
// stepped out of the horizon and set upright. A network of nodes and links
// in the player's own colour (the same drawing the horizon shows,
// consuming.ts's drawNetDisc), clipped to the exact silhouette of the
// player's own crystal habit (drawCrystalSilhouette, seeded the way the
// avatar is, so a transmuted player's new habit and a fused player's two
// bodies both come through), sparking on the clock the reflection and the
// ground share. Not a crystal: no facets, no highlight, no sparkles -- a body
// assembled out of samples. Still, with no bob and no sway: a record does
// not move.
//
// Anchored like the golem (art/boss.ts): the returned container's origin is
// a ground reference, the figure stands `footDrop` below it on a dark
// contact shadow, and nothing on the root is ever tweened.
//
// The silhouette is a geometry mask, and a Graphics used as a mask is drawn
// in world space whatever container its target sits in, so it is never on
// the display list and is positioned from `at`, the world point the caller
// will place the container at. The caller owns the container; destroying it
// reclaims the mask and the redraw timer through the DESTROY hook below.

// How tall the record stands, as a multiple of the caller's `size`: the
// habit is drawn at this scale so the figure reaches roughly the golem's own
// height rather than an ordinary crystal's.
const HABIT_SCALE = 1.55;
// The habit's centre this far above the contact line: every habit in
// art/crystals.ts spans about this much of its size below its own centre.
const CENTRE_LIFT = 0.62;
const DARK = 0x0a0612;

export function makeModelOfYou(
  scene: Phaser.Scene,
  size: number,
  form: Material,
  at: { x: number; y: number },
  opts: { footDrop?: number } = {}
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  const S = size * HABIT_SCALE;
  const footY = opts.footDrop ?? 0;
  const centreY = footY - S * CENTRE_LIFT;
  const color = form.color;

  // A dark contact shadow first, under everything: the record stands where
  // the golem stood, and the darkest pixel is still the point it touches.
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.2);
  shadow.fillEllipse(0, footY, S * 1.3, S * 0.26);
  shadow.fillStyle(0x000000, 0.42);
  shadow.fillEllipse(0, footY, S * 0.8, S * 0.15);
  container.add(shadow);

  // The silhouette, off the display list, in world space.
  const silhouette = scene.make.graphics({ x: at.x, y: at.y + centreY }, false);
  const rotation = drawCrystalSilhouette(silhouette, S, form.variant, {
    seed: form.name,
    hybrid: form.hybridParents,
  });
  silhouette.setRotation(rotation);
  const mask = silhouette.createGeometryMask();

  // The body: a near-black fill the silhouette cuts to shape, so the outline
  // reads where the lattice is sparse, then the network over it. One
  // Graphics, redrawn on the spark clock.
  const net = scene.add.graphics();
  net.setMask(mask);
  container.add(net);
  const R = S * 0.72;
  const draw = () => {
    if (!net.active) return;
    net.clear();
    net.fillStyle(blend(color, DARK, 0.85), 0.9);
    net.fillCircle(0, centreY, R * 1.4);
    drawNetDisc(net, 0, centreY, R, 0.95, color, scene.time.now);
  };
  draw();
  const clock = scene.time.addEvent({ delay: SPARK_SLICE_MS, loop: true, callback: draw });

  // A faint lit rim outside the mask -- the only thing drawn past the
  // silhouette's edge -- so the figure has an edge against the arena the way
  // the horizon's disc gives the reflection one. Additive and dim: the
  // player's own crystal keeps the highest contrast on screen.
  const rim = scene.add.graphics();
  rim.setBlendMode(Phaser.BlendModes.ADD);
  rim.fillStyle(blend(color, 0xffffff, 0.3), 0.08);
  rim.fillCircle(0, centreY, R * 1.05);
  container.addAt(rim, 1);
  scene.tweens.add({ targets: rim, alpha: { from: 0.7, to: 1 }, duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  container.once(Phaser.GameObjects.Events.DESTROY, () => {
    clock.remove(false);
    net.clearMask(false);
    silhouette.destroy();
  });
  return container;
}

// The turn row's icon for the record (scenes/battle/hud.ts's
// drawTurnPreview): the player's own habit, filled near-black with none of a
// crystal's sparkle (makeCrystal's `plain`) and a handful of lit nodes and
// links over it in the network's light -- the record reduced to what reads
// at this size, and unmistakably not the player's own icon beside it.
// Static like makeBossIcon: a row that rebuilds every round pays for no idle
// animation.
export function makeModelIcon(scene: Phaser.Scene, size: number, form: Material): Phaser.GameObjects.Container {
  const container = makeCrystal(scene, size, blend(form.color, DARK, 0.8), form.variant, {
    seed: form.name,
    hybrid: form.hybridParents,
    plain: true,
  });
  const light = blend(form.color, 0xffffff, 0.45);
  const g = scene.add.graphics();
  const r = size * 0.28;
  const nodes = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const d = i === 0 ? 0 : r * (0.55 + 0.45 * ((i * 7) % 3) / 2);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d * 1.15 };
  });
  g.lineStyle(1, light, 0.7);
  for (let i = 1; i < nodes.length; i++) g.lineBetween(nodes[0].x, nodes[0].y, nodes[i].x, nodes[i].y);
  g.fillStyle(light, 1);
  for (const n of nodes) g.fillCircle(n.x, n.y, size * 0.05);
  container.add(g);
  return container;
}
