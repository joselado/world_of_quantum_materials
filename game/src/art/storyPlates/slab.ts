import Phaser from 'phaser';
import { bakeLayers } from '../bake';
import { hashSeed, seededRandom } from '../colors';
import { jitter } from './brush';
import type { G, PlatePainter, Rnd } from './brush';

// The slab of rock wall a story plate is painted on, and the wear over the
// paint (art/storyPlates/index.ts has the style and its rules).

// Fixed whatever the text-size preset, like every detail pane's art block
// ("art, not text", STYLE.md), so the height left for the chapter's text is
// the same for every chapter.
export const STORY_PLATE_W = 440;
export const STORY_PLATE_H = 104;

// How far the painting keeps from the slab's edge.
const MARGIN = 9;

// The rock, in the light of the first world.
const STONE = 0x75644e;
const STONE_LIGHT = 0x917e65;
const STONE_DARK = 0x4f4336;

// How much of the first world's light the rock keeps, for a plate of each
// world: the wall is seen by that world's own light, and the light dies along
// the road (WORLDS.md's light rule). It falls through the day to its lowest
// in World 7, where the sky goes out, and what little the last three worlds
// have is their own: fog-glow, magma, the network. Index 0 is the Lab, where
// the premise is told. The ending and the after-story are told from World
// 10's cliff and take its rock. On the dark slabs chalk and the world's own
// pigment carry the line work, since charcoal no longer shows.
const SLAB_LIGHT = [1, 1, 1, 0.87, 0.62, 0.5, 0.4, 0.32, 0.35, 0.35, 0.4];

export function slabLightFor(world: number): number {
  return SLAB_LIGHT[Math.max(0, Math.min(SLAB_LIGHT.length - 1, world))];
}

// A colour of the rock at a fraction of its light, channel by channel.
function dim(color: number, light: number): number {
  const channel = (shift: number) => Math.round(((color >> shift) & 0xff) * light) << shift;
  return channel(16) | channel(8) | channel(0);
}

// The slab's outline: the plate's rectangle with its edge broken, every
// point pulled a little inward and the four corners chipped off.
function slabOutline(rnd: Rnd, w: number, h: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const chip = 6;
  const edge = (x1: number, y1: number, x2: number, y2: number, inX: number, inY: number) => {
    const steps = Math.round(Math.hypot(x2 - x1, y2 - y1) / 11);
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const pull = rnd() * rnd() * 3.2;
      pts.push({ x: x1 + (x2 - x1) * t + inX * pull, y: y1 + (y2 - y1) * t + inY * pull });
    }
  };
  edge(chip, 0, w - chip, 0, 0, 1);
  edge(w, chip, w, h - chip, -1, 0);
  edge(w - chip, h, chip, h, 0, -1);
  edge(0, h - chip, 0, chip, 1, 0);
  return pts;
}

// A crack: a jagged line from a point on the slab's edge some way into it,
// dark, with a thin lit lip beside it.
function crack(g: G, rnd: Rnd, lip: number, x: number, y: number, dx: number, dy: number, length: number) {
  const pts: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(x, y)];
  let cx = x;
  let cy = y;
  for (let travelled = 0; travelled < length; travelled += 6) {
    cx += dx * 6 + jitter(rnd, 2.6);
    cy += dy * 6 + jitter(rnd, 2.6);
    pts.push(new Phaser.Math.Vector2(cx, cy));
  }
  g.lineStyle(1, lip, 0.35);
  g.strokePoints(
    pts.map((p) => new Phaser.Math.Vector2(p.x + 0.8, p.y + 0.8)),
    false
  );
  g.lineStyle(1.1, 0x231a14, 0.7);
  g.strokePoints(pts, false);
}

// A plate: `paint` on a slab, drawn with its top-left corner at the
// container's origin. `seed` names the plate, so its rock and every wobble of
// its paint come out the same each time. `world` picks the rock's light.
export function makeSlabPlate(scene: Phaser.Scene, seed: string, paint: PlatePainter, world: number): Phaser.GameObjects.Container {
  const w = STORY_PLATE_W;
  const h = STORY_PLATE_H;
  const rnd = seededRandom(hashSeed(`story-plate-${seed}`));
  const light = slabLightFor(world);
  const tone = (color: number) => dim(color, light);
  const stone = tone(STONE);
  const stoneLight = tone(STONE_LIGHT);
  const stoneDark = tone(STONE_DARK);
  const container = scene.add.container(0, 0);
  // An unfilled Rectangle the size of the plate, drawing nothing: a Graphics
  // has no size, and a container holding nothing else reports its bounds
  // from the scene's origin, which would stretch the bounds of the whole
  // panel the plate sits in.
  container.add(scene.add.rectangle(0, 0, w, h).setOrigin(0, 0));
  const g = scene.add.graphics();
  container.add(g);

  // The rock: the slab, then lighter and darker mottling kept clear of its
  // broken edge, then grit.
  const outline = slabOutline(rnd, w, h);
  g.fillStyle(stone, 1);
  g.fillPoints(outline, true);
  for (let i = 0; i < 46; i++) {
    const rx = 10 + rnd() * 26;
    const ry = 5 + rnd() * 10;
    const x = 6 + rx + rnd() * (w - 12 - 2 * rx);
    const y = 6 + ry + rnd() * (h - 12 - 2 * ry);
    g.fillStyle(rnd() < 0.55 ? stoneLight : stoneDark, 0.1 + rnd() * 0.1);
    g.fillEllipse(x, y, rx * 2, ry * 2);
  }
  for (let i = 0; i < 150; i++) {
    g.fillStyle(rnd() < 0.5 ? stoneLight : stoneDark, 0.35);
    g.fillCircle(8 + rnd() * (w - 16), 8 + rnd() * (h - 16), 0.5 + rnd() * 0.7);
  }

  // The painting draws from a generator of its own, so that a change to one
  // painter leaves the rock and the wear of its plate as they were.
  paint(g, { x: MARGIN, y: MARGIN, w: w - 2 * MARGIN, h: h - 2 * MARGIN }, seededRandom(hashSeed(`story-paint-${seed}`)));

  // Wear, over the paint: flakes where the pigment has come off down to the
  // rock, and cracks running in from the edge.
  for (let i = 0; i < 9; i++) {
    const rx = 5 + rnd() * 9;
    const ry = 2.5 + rnd() * 4;
    g.fillStyle(stone, 0.5);
    g.fillEllipse(12 + rx + rnd() * (w - 24 - 2 * rx), 10 + ry + rnd() * (h - 20 - 2 * ry), rx * 2, ry * 2);
  }
  for (let i = 0; i < 110; i++) {
    g.fillStyle(rnd() < 0.7 ? stone : stoneLight, 0.6);
    g.fillCircle(8 + rnd() * (w - 16), 8 + rnd() * (h - 16), 0.5 + rnd() * 0.9);
  }
  crack(g, rnd, stoneLight, w * 0.17, 1, 0.25, 1, 34);
  crack(g, rnd, stoneLight, w * 0.71, h - 1, -0.35, -1, 40);
  crack(g, rnd, stoneLight, w - 1, h * 0.3, -1, 0.2, 30);
  crack(g, rnd, stoneLight, 1, h * 0.72, 1, -0.15, 22);

  // The broken edge: a dark rim, and the rock a shade darker just inside it.
  g.lineStyle(4, stoneDark, 0.3);
  g.strokePoints(outline, true);
  g.lineStyle(1.5, 0x1c1510, 0.9);
  g.strokePoints(outline, true);

  // A plate is a few thousand small fills painted once and never touched
  // again, so it is flattened into one texture (art/bake.ts) and shown as a
  // single image: left as a Graphics it would be tessellated again on every
  // frame the panel is open. The key carries the plate's name, so two plates
  // on screen at once would not share a texture.
  bakeLayers(scene, `story-plate-${seed}`, [g], { x: 0, y: 0, w, h });
  return container;
}
