import Phaser from 'phaser';
import { blend } from './colors';
import { drawGlow } from './attackShapes';
import { FX_TEX, ensureFxTextures } from './fxTextures';
import { drawNetDisc, SPARK_SLICE_MS } from '../scenes/overworld/terrain/materials/consuming';

// The Quantum Adapted -- World 10's third and last finale stage (DESIGN.md
// §6): not a copy of the player but the environment that measured
// them. A smoke that does not rise, lit from inside, with sparks running
// through it and the record -- the network in the player's colour, the same
// drawing the horizon's reflection and the Model of You carry
// (consuming.ts's drawNetDisc) -- still burning in it like a filament. Its
// colour is whichever real compound the environment is answering as this
// round (BattleScene.rollQuantumForm), taken through `retint` without
// rebuilding: new smoke comes in the new colour and the old smoke fades on
// its own lifespan, so a form change crossfades rather than cuts.
//
// Blend follows what a thing is (STYLE.md): the smoke is NORMAL at a mid
// value so it reads against the dark arena and survives the greyscale
// squint; the sparks, the core and the network are ADD, kept dim so the
// player's own crystal keeps the highest contrast on screen. A cloud
// hovers, so no contact shadow -- a faint lit pool on the floor under it
// instead, the way the golem's scorch reads the ground under a lit thing.
//
// The particle budget is capped by count, not rate: the *_ALIVE constants
// bound what is ever drawn per frame however the emitters are fed.
// Everything that drifts is tweened together as a group; nothing on the
// returned root is tweened (the caller owns that transform, and squashes it
// on a hit). Anchored like the golem: the root's origin is a ground
// reference and the cloud's centre hangs CLOUD_LIFT above it.
//
// Every child sits directly in the returned container, and the three
// emitters come last: under Phaser 3.90's WebGL renderer a particle emitter
// inside a container draws only when nothing follows it in that container's
// list (a Graphics after it, even one wrapped in a sub-container, loses the
// emitter's whole batch), so the cloud has no inner rig the way the golem
// does, and the smoke is drawn over the network rather than behind it --
// which is the picture anyway: a filament burning inside smoke is seen
// through the smoke. The body layer is kept thin for that reason.

const CLOUD_LIFT = 0.8;
const BODY_ALIVE = 24;
const GAS_ALIVE = 18;
const SPARKS_ALIVE = 10;
// The texture sizes the scales below are relative to (art/fxTextures.ts).
const SMOKE_PX = 128;
const SPARK_PX = 32;
// The body layer's dark and the gas layer's light, blended toward from the
// compound's colour: the arena floor here is pale, so the cloud needs mass
// darker than the floor to read as smoke at all, and light above it to read
// as lit from inside.
const SMOKE_DARK = 0x2a1a3a;

export function makeQuantumAdapted(
  scene: Phaser.Scene,
  size: number,
  tint: number,
  playerColor: number,
  opts: { footDrop?: number } = {}
): Phaser.GameObjects.Container {
  ensureFxTextures(scene);
  const container = scene.add.container(0, 0);
  const footY = opts.footDrop ?? 0;
  const cy = footY - size * CLOUD_LIFT;
  const cloudR = size * 1.0;

  // The lit pool on the floor, under everything. Retinted with the cloud.
  const pool = scene.add.graphics();
  pool.setBlendMode(Phaser.BlendModes.ADD);
  const drawPool = (c: number) => {
    pool.clear();
    pool.fillStyle(c, 0.22);
    pool.fillEllipse(0, footY, size * 1.6, size * 0.3);
    pool.fillStyle(blend(c, 0xffffff, 0.5), 0.12);
    pool.fillEllipse(0, footY, size * 0.9, size * 0.17);
  };
  drawPool(tint);
  container.add(pool);
  scene.tweens.add({ targets: pool, alpha: { from: 0.55, to: 1 }, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // The core: a small bright heart the smoke is lit from, breathing.
  const core = scene.add.graphics();
  core.setPosition(0, cy);
  core.setBlendMode(Phaser.BlendModes.ADD);
  const drawCore = (c: number) => {
    core.clear();
    drawGlow(core, blend(c, 0xffffff, 0.55), 0, 0, size * 0.16, 0.4);
  };
  drawCore(tint);
  container.add(core);
  scene.tweens.add({ targets: core, alpha: { from: 0.6, to: 1 }, scale: { from: 0.92, to: 1.08 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // The record inside the bath: the network in the player's colour, wandering
  // slowly through the cloud, redrawn on the spark clock.
  const net = scene.add.graphics();
  net.setPosition(0, cy);
  net.setBlendMode(Phaser.BlendModes.ADD);
  const netR = size * 0.5;
  const draw = () => {
    if (!net.active) return;
    const now = scene.time.now;
    net.clear();
    drawNetDisc(net, Math.sin(now / 1300) * size * 0.08, Math.cos(now / 1700) * size * 0.06, netR, 0.8, playerColor, now);
  };
  draw();
  const clock = scene.time.addEvent({ delay: SPARK_SLICE_MS, loop: true, callback: draw });
  container.add(net);

  // The smoke, in two layers born throughout the cloud's volume, growing as
  // they fade and turning a little: a dark body (NORMAL) that gives the cloud
  // mass against the pale floor, and a lit gas (ADD) over it.
  const bodyTint = (c: number) => blend(c, SMOKE_DARK, 0.6);
  const gasTint = (c: number) => blend(c, 0xffffff, 0.35);
  const k = (size * 1.25) / SMOKE_PX;
  const puffs = (tintValue: number, alive: number, alpha: number, frequency: number) =>
    scene.add.particles(0, cy, FX_TEX.smoke, {
      x: { min: -cloudR * 0.75, max: cloudR * 0.75 },
      y: { min: -cloudR * 0.5, max: cloudR * 0.5 },
      lifespan: { min: 1600, max: 2800 },
      speed: { min: 4, max: 16 },
      angle: { min: 0, max: 360 },
      rotate: { min: 0, max: 360 },
      scale: { start: 0.45 * k, end: 1.05 * k },
      alpha: { start: alpha, end: 0 },
      tint: tintValue,
      frequency,
      maxAliveParticles: alive,
    });
  const body = puffs(bodyTint(tint), BODY_ALIVE, 0.42, 95);
  body.setBlendMode(Phaser.BlendModes.NORMAL);
  container.add(body);
  const gas = puffs(gasTint(tint), GAS_ALIVE, 0.34, 120);
  gas.setBlendMode(Phaser.BlendModes.ADD);
  container.add(gas);

  // Sparks: short, bright, sparse, born anywhere in the cloud.
  const sk = (size * 0.22) / SPARK_PX;
  const sparks = scene.add.particles(0, cy, FX_TEX.spark, {
    x: { min: -cloudR * 0.7, max: cloudR * 0.7 },
    y: { min: -cloudR * 0.5, max: cloudR * 0.5 },
    lifespan: { min: 260, max: 560 },
    speed: { min: 20, max: 70 },
    angle: { min: 0, max: 360 },
    scale: { start: sk, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [0xffffff, blend(playerColor, 0xffffff, 0.5)],
    frequency: 170,
    maxAliveParticles: SPARKS_ALIVE,
  });
  sparks.setBlendMode(Phaser.BlendModes.ADD);
  container.add(sparks);

  // The drift: the whole cloud wanders about its ground point, as one group.
  const drifting = [body, gas, core, net, sparks];
  scene.tweens.add({ targets: drifting, x: { from: -size * 0.1, to: size * 0.1 }, duration: 2700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  scene.tweens.add({ targets: drifting, y: { from: cy - size * 0.06, to: cy + size * 0.06 }, duration: 3400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // A form change: the smoke to come, the core and the pool take the new
  // colour; the smoke already in the air keeps the old one and fades.
  container.setData('retint', (c: number) => {
    body.particleTint = bodyTint(c);
    gas.particleTint = gasTint(c);
    drawCore(c);
    drawPool(c);
  });

  container.once(Phaser.GameObjects.Events.DESTROY, () => clock.remove(false));
  return container;
}

// Recolours a cloud built above for the compound it is answering as now.
export function retintQuantumAdapted(container: Phaser.GameObjects.Container, tint: number) {
  const fn = container.getData('retint') as ((c: number) => void) | undefined;
  fn?.(tint);
}

// The turn row's icon for the environment (scenes/battle/hud.ts's
// drawTurnPreview): a soft lit dot in the round's compound colour with a
// spark of the player's colour at its heart -- the cloud reduced to what
// reads at this size. Static, like makeBossIcon.
export function makeQuantumIcon(scene: Phaser.Scene, size: number, tint: number, playerColor: number): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.setBlendMode(Phaser.BlendModes.ADD);
  drawGlow(g, blend(tint, 0xffffff, 0.35), 0, 0, size * 0.16, 0.85);
  g.fillStyle(blend(playerColor, 0xffffff, 0.5), 1);
  g.fillCircle(0, 0, size * 0.07);
  container.add(g);
  return container;
}
