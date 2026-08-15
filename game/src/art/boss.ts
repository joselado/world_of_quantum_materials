import Phaser from 'phaser';
import { drawCubicShape, drawShardShape, makeCrystal } from './crystals';
import { shade } from './colors';
import type { CrystalVariant } from '../data/types';

// How far the golem's art reaches above and below its own center, in
// multiples of the `size` passed to `makeBossCrystal` -- the silhouette is
// deliberately taller than it is wide and asymmetric about its center, so
// callers placing something directly above or below it (the overworld name
// label in OverworldScene.spawnBossSprite, the pre-fight taunt panel's own
// top-down layout in OverworldScene.renderRivalTauntPage) offset by these
// rather than by a bare `size`. TOP covers the head plus the rim-light
// outline and the rising heat sparks; BOTTOM covers the planted feet plus
// the contact shadow pooled under them.
export const BOSS_SILHOUETTE_TOP = 1.4;
export const BOSS_SILHOUETTE_BOTTOM = 1.11;
// Half the golem's widest span, at the outstretched fists -- what
// OverworldScene sizes the boss from, so its silhouette spans the pass it
// holds rather than a number chosen against the screen (WORLDS.md section 4).
export const BOSS_SILHOUETTE_HALF_WIDTH = 1.1;
// Where the golem plants its feet and pools its contact shadow, in the same
// units -- the point a caller standing it on a tile lands on that tile's
// ground (OverworldScene.spawnBossSprite's `foot`).
export const BOSS_FOOT = 0.98;

// The golem's outline, traced once in units of `size` (y positive downward,
// center at the origin) and drawn as a single dark polygon under every
// shard: a small sunken head between shoulders that peak higher than it,
// long arms hanging to oversized fists, a waist that tapers in, and short
// planted legs. Drawing the humanoid read as one guaranteed shape means the
// grain shards on top are free to be as angular and noisy as the
// "polycrystalline" theme wants without the creature dissolving into a pile
// of gems -- and the dark fill doubles as a hard edge that keeps the
// silhouette legible against a bright daylight biome as well as a dark one.
// Traced down the right side, around the right arm and leg, then back up
// the mirrored left side.
const SILHOUETTE: [number, number][] = [
  [-0.16, -1.3],
  [0.16, -1.3],
  [0.22, -1.0],
  [0.46, -1.02],
  [0.84, -0.92],
  [0.98, -0.48],
  [0.86, -0.3],
  [1.0, 0.04],
  [1.1, 0.34],
  [0.9, 0.62],
  [0.76, 0.3],
  [0.64, -0.14],
  [0.44, -0.22],
  [0.34, 0.18],
  [0.56, 0.44],
  [0.56, 0.96],
  [0.16, 0.96],
  [0.1, 0.48],
  [-0.1, 0.48],
  [-0.16, 0.96],
  [-0.56, 0.96],
  [-0.56, 0.44],
  [-0.34, 0.18],
  [-0.44, -0.22],
  [-0.64, -0.14],
  [-0.76, 0.3],
  [-0.9, 0.62],
  [-1.1, 0.34],
  [-1.0, 0.04],
  [-0.86, -0.3],
  [-0.98, -0.48],
  [-0.84, -0.92],
  [-0.46, -1.02],
  [-0.22, -1.0],
];

// Body shards, in units of `size`, fused around the torso core added after
// them (its own bulk overlaps and fuses their inner edges). Limbs are always
// a solid habit -- an angular shard or a blocky cube -- rather than the
// material's own `variant`: the monolayer plates are translucent
// floating sheets, which read as flimsy on an arm, so the compound's own
// habit lives in the torso core instead, where it stays the golem's chest
// and is still what the eye lands on first.
type Habit = 'shard' | 'cubic';
const LIMBS: { dx: number; dy: number; scale: number; shadeStep: number; rot: number; habit: Habit }[] = [
  { dx: -0.34, dy: 0.6, scale: 0.38, shadeStep: -1, rot: -0.05, habit: 'shard' }, // left leg
  { dx: 0.34, dy: 0.6, scale: 0.38, shadeStep: 1, rot: 0.05, habit: 'shard' }, // right leg
  { dx: 0, dy: 0.34, scale: 0.34, shadeStep: -2, rot: 0, habit: 'cubic' }, // pelvis block
  { dx: -0.72, dy: -0.2, scale: 0.32, shadeStep: -2, rot: -0.28, habit: 'shard' }, // left upper arm
  { dx: 0.72, dy: -0.2, scale: 0.32, shadeStep: 2, rot: 0.26, habit: 'shard' }, // right upper arm
  { dx: -0.6, dy: -0.6, scale: 0.38, shadeStep: -1, rot: -0.5, habit: 'shard' }, // left pauldron
  { dx: 0.6, dy: -0.6, scale: 0.38, shadeStep: 1, rot: 0.5, habit: 'shard' }, // right pauldron
  { dx: 0, dy: -0.7, scale: 0.26, shadeStep: 1, rot: 0, habit: 'cubic' }, // collar block
];

// Grain boundaries lit from inside -- the seams where the fused grains meet,
// which is what most of the rivals' own intro lines point at ("a mosaic of
// grains with a faint glow at every seam," "a thousand distinct crystalline
// grains stitched edge to edge," "edges lit where the two phases disagree").
// Each path is drawn twice: once dark, as the crack itself, and once offset
// and additive, as the light coming through it.
const SEAMS: [number, number][][] = [
  [
    [-0.3, -0.62],
    [-0.1, -0.3],
    [-0.24, 0.02],
    [-0.06, 0.34],
  ],
  [
    [0.3, -0.55],
    [0.1, -0.18],
    [0.26, 0.14],
  ],
  [
    [-0.66, -0.42],
    [-0.8, -0.06],
    [-0.72, 0.18],
  ],
  [
    [0.56, -0.9],
    [0.74, -0.62],
  ],
  [
    [-0.4, 0.48],
    [-0.3, 0.86],
  ],
];

// The seams' own hot light, and the embers venting off the body -- one fixed
// ember-orange for every golem regardless of its compound's color, so
// "something hostile is burning inside this thing" stays the boss family's
// shared signature and still contrasts against every base hue.
const EMBER = 0xffcf6a;
const SEAM_GLOW = 0xffb347;

// A world's rival/boss crystal, rendered as a golem -- a humanoid silhouette
// (head, torso, two arms, two legs) fused from many angular grain shards,
// literalizing "polycrystalline" (each rival's own name, WORLD_RIVALS in
// data/materials.ts, names a real compound's polycrystalline form) as many
// grains fused into one mass. Distinct from the single shared makeCrystal()
// silhouette every ordinary wild/rival crystal uses elsewhere. Purely a
// visual landmark where it stands in the throat of a world's forward pass
// (OverworldScene.spawnBossSprite); it doesn't add its own click handler --
// the fight is reached by pressing at the pass mouth
// (OverworldScene.confirmGate -> showRivalEncounter).
//
// Everything that breathes lives in an inner container pivoted at the
// golem's feet, never on the returned container itself: all three call sites
// already own the outer transform (the overworld re-positions and re-scales
// it every frame, the taunt panel and BattleScene each bob it), so an idle
// tween on the root would be silently overwritten.
export function makeBossCrystal(
  scene: Phaser.Scene,
  size: number,
  color: number,
  variant: CrystalVariant
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  const feetY = size * BOSS_FOOT;
  const poly = (k: number) => SILHOUETTE.map(([x, y]) => ({ x: x * size * k, y: y * size * k }));

  // A plain dark contact shadow, normal-blended rather than additive: mass
  // is what makes this read as heavy, and a shadow pooled under the feet
  // does more for that than any glow can. It also plants the golem on the
  // ground instead of leaving it floating.
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.34);
  shadow.fillEllipse(0, feetY, size * 1.9, size * 0.24);
  container.add(shadow);

  // The danger glow, kept low and behind the legs so it reads as the ground
  // scorching under the thing rather than a halo around it -- a halo is the
  // visual language of a benevolent guardian, and an additive one large
  // enough to surround the whole body washes out to near-white over a
  // daylight biome and erases the silhouette's own edge.
  const pool = scene.add.graphics();
  pool.setBlendMode(Phaser.BlendModes.ADD);
  pool.fillStyle(color, 0.3);
  pool.fillEllipse(0, feetY * 0.97, size * 1.7, size * 0.32);
  pool.fillStyle(shade(color, 60), 0.2);
  pool.fillEllipse(0, feetY * 0.97, size * 1.0, size * 0.2);
  container.add(pool);
  scene.tweens.add({ targets: pool, alpha: { from: 0.5, to: 1 }, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // `body` pivots at the feet so the idle motion below scales and leans the
  // golem from the ground up rather than ballooning it about its middle;
  // `art` cancels that offset back out so every shape below can be placed in
  // plain center-relative coordinates.
  const body = scene.add.container(0, feetY);
  const art = scene.add.container(0, -feetY);
  body.add(art);
  container.add(body);

  // Rim light: the same outline a touch larger and additive, so only the
  // sliver protruding past the dark silhouette shows -- a bright edge in a
  // dark biome, invisibly subtle in a bright one, where the dark outline is
  // already doing the separating.
  const rim = scene.add.graphics();
  rim.setBlendMode(Phaser.BlendModes.ADD);
  rim.fillStyle(shade(color, 70), 0.32);
  rim.fillPoints(poly(1.04), true);
  art.add(rim);

  const outline = scene.add.graphics();
  outline.fillStyle(shade(color, -62), 1);
  outline.fillPoints(poly(1), true);
  outline.lineStyle(3, shade(color, -75), 1);
  outline.strokePoints(poly(1), true);
  art.add(outline);

  const fists: Phaser.GameObjects.Graphics[] = [];
  LIMBS.forEach((s) => {
    const g = scene.add.graphics();
    const limbColor = shade(color, s.shadeStep * 14 - 20);
    if (s.habit === 'cubic') drawCubicShape(g, size * s.scale, limbColor);
    else drawShardShape(g, size * s.scale, limbColor);
    g.setPosition(size * s.dx, size * s.dy);
    g.setRotation(s.rot);
    art.add(g);
  });

  const torso = makeCrystal(scene, size * 0.74, shade(color, -14), variant, { plain: true });
  torso.setPosition(0, -size * 0.14);
  art.add(torso);

  // Oversized fists hanging past the knees, drawn after the torso so they
  // stay in front of it -- top-heavy proportions plus low, heavy hands are
  // most of what separates "looming" from "standing there."
  [-1, 1].forEach((sideSign) => {
    const g = scene.add.graphics();
    drawCubicShape(g, size * 0.3, shade(color, sideSign * 18 - 26));
    g.setPosition(sideSign * size * 0.92, size * 0.34);
    g.setRotation(sideSign * 0.17);
    art.add(g);
    fists.push(g);
  });

  const head = scene.add.graphics();
  drawShardShape(head, size * 0.26, shade(color, 12));
  head.setPosition(0, -size * 1.06);
  head.setRotation(0.04);
  art.add(head);

  // The brightest seam of all, cut across the head: a dark socket so it
  // still reads as a hard slot over a pale biome, with the hot light inset
  // inside it. One slit rather than a pair of eyes -- it stays a lit
  // fracture in the head grain instead of turning the golem into a face.
  const slit = (inset: number) => [
    { x: -size * (0.12 - inset), y: -size * (1.14 - inset * 0.4) },
    { x: size * (0.12 - inset), y: -size * (1.12 - inset * 0.4) },
    { x: size * (0.12 - inset), y: -size * (1.07 + inset * 0.4) },
    { x: -size * (0.12 - inset), y: -size * (1.09 + inset * 0.4) },
  ];
  const socket = scene.add.graphics();
  socket.fillStyle(0x140b06, 0.95);
  socket.fillPoints(slit(0), true);
  art.add(socket);
  const glare = scene.add.graphics();
  glare.setBlendMode(Phaser.BlendModes.ADD);
  glare.fillStyle(EMBER, 1);
  glare.fillPoints(slit(0.02), true);
  art.add(glare);
  scene.tweens.add({ targets: glare, alpha: { from: 0.55, to: 1 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  const cracks = scene.add.graphics();
  cracks.lineStyle(3, shade(color, -70), 0.9);
  SEAMS.forEach((path) => {
    cracks.strokePoints(path.map(([x, y]) => ({ x: x * size, y: y * size })), false);
  });
  art.add(cracks);

  // One Graphics per seam, so each pulses on its own clock -- a body whose
  // every seam brightens in lockstep reads as a single looping animation,
  // where staggered ones read as something alive straining inside.
  SEAMS.forEach((path, i) => {
    const glow = scene.add.graphics();
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.lineStyle(1.5, SEAM_GLOW, 0.85);
    glow.strokePoints(path.map(([x, y]) => ({ x: x * size + 1, y: y * size + 1 })), false);
    art.add(glow);
    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.35, to: 0.9 },
      duration: 1300 + i * 180,
      delay: i * 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  });

  // Heat venting off the body: sparks rising from the waist and fading out
  // above the head, each on its own duration and delay so they never march
  // in step.
  [-0.6, -0.2, 0.15, 0.45, 0.75].forEach((dx, i) => {
    const spark = scene.add.circle(dx * size, size * 0.3, size * 0.045, EMBER, 0.95);
    spark.setBlendMode(Phaser.BlendModes.ADD);
    container.add(spark);
    scene.tweens.add({
      targets: spark,
      y: -size * 1.35,
      alpha: { from: 0.95, to: 0 },
      scale: { from: 1, to: 0.4 },
      duration: 1600 + i * 270,
      delay: i * 380,
      repeat: -1,
      ease: 'Sine.easeOut',
    });
  });

  // Four idle rhythms on deliberately unrelated periods (900ms slit, 2300ms
  // breath, 3100ms weight shift, 3400ms head) so the loop never visibly
  // resets: a slow breath that squashes as it rises, a weight shift rocking
  // over the planted feet, a head panning as if scanning, and two fists
  // drifting out of phase with each other so the body never looks mirrored.
  scene.tweens.add({
    targets: body,
    scaleY: { from: 1, to: 1.03 },
    scaleX: { from: 1, to: 0.992 },
    duration: 2300,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  scene.tweens.add({
    targets: body,
    angle: { from: -0.7, to: 0.7 },
    duration: 3100,
    delay: 500,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  scene.tweens.add({ targets: head, angle: { from: -2, to: 2 }, duration: 3400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  fists.forEach((fist, i) => {
    scene.tweens.add({
      targets: fist,
      y: fist.y + size * 0.025,
      duration: 1750 + i * 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  });

  return container;
}

// The same golem reduced to what still reads at HUD-icon scale -- the battle
// turn-order preview's 32px row (scenes/battle/hud.ts's drawTurnPreview),
// where the opponent's icon has to be tellable from the player's ordinary
// `makeCrystal` gem beside it. `makeBossCrystal` can't just be called with a
// small `size` for this: its grain shards, seams and head slit are only a
// pixel or two across there, its contact shadow spans 1.9x its size and its
// heat sparks tween out to 1.35x above it (both of which would reach into the
// neighbouring icons of a 36px-spaced row), and its ~15 idle tweens would be
// rebuilt per icon every time the row redraws. What survives here is only
// what carries the distinction: the humanoid outline, against the single
// faceted shape every ordinary crystal is, plus the lit head slit. Filled in
// the material's own color rather than the arena golem's much darker
// `shade(color, -62)` silhouette fill, since at this size the fill is all the
// color there is to read the boss's type off. Static, with no tweens of its
// own -- a row that rebuilds every round shouldn't pay for idle animation.
export function makeBossIcon(scene: Phaser.Scene, size: number, color: number): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  // Half of `size`, so the widest span (BOSS_SILHOUETTE_HALF_WIDTH) lands on
  // the same 0.55x half-width art/crystals.ts's own shapes have at that size
  // -- a boss icon drops into a row laid out for crystal icons without
  // needing spacing of its own. `art` re-centers the silhouette, which
  // reaches further above its own center than below it.
  const k = size * 0.5;
  const art = scene.add.container(0, k * 0.17);
  container.add(art);

  const poly = SILHOUETTE.map(([x, y]) => ({ x: x * k, y: y * k }));
  const body = scene.add.graphics();
  body.fillStyle(color, 1);
  body.fillPoints(poly, true);
  body.lineStyle(2, shade(color, -55), 1);
  body.strokePoints(poly, true);
  art.add(body);

  // A round ember dot rather than the full-size art's cut slit: a 4x1px
  // sliver would vanish, where a dot of the boss family's own ember color
  // survives and still reads as one lit eye in the head.
  const eye = scene.add.circle(0, -k * 1.06, Math.max(1.5, k * 0.13), EMBER, 1);
  eye.setBlendMode(Phaser.BlendModes.ADD);
  art.add(eye);

  return container;
}
