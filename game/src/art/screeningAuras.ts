import Phaser from 'phaser';
import type { ScreeningChannel } from '../data/materials';
import { shade } from './colors';
import { killTweensDeep } from './crystals';

// Persistent battle auras for Kondo's three screening self-buffs (§5,
// data/materials.ts's KONDO_MOVE_IDS) -- the cloud a cast raises stays
// visibly wrapped around the carrying crystal for as long as the buff is
// active (BattleScene.syncScreeningAura, driven off setStatus), added inside
// the crystal's own container so idle bob and hit squash carry it for free,
// the same free ride addBoostHalo's aura gets. All three stay in Kondo's own
// rust-orange family (the status pill's one color already carries that
// contract; the label names the channel) and are told apart by silhouette,
// each drawing the physics of what its cloud actually screens:
//
// - **spin** is the Kondo effect proper: circulating conduction electrons
//   binding the screened moment into a singlet. It extends art/kondo.ts's
//   own screening-cloud vocabulary -- two shells of open electron arcs, each
//   trailing a mote, counter-rotating -- with a still ring of small
//   downward spin arrows: the orbital motion circulates, but the cloud's
//   spins stay pinned antialigned against the moment they screen.
// - **charge** is Thomas-Fermi screening: mobile charge piling up radially
//   around the disturbance, densest at the center and decaying outward,
//   ringed by the faint alternating Friedel oscillations the induced
//   density carries. Nothing circulates -- a static charge profile that
//   only breathes.
// - **symmetry** is the restored order-parameter manifold: the degenerate
//   circle a broken continuous symmetry leaves (the Mexican hat's brim),
//   drawn as one ring crossed by evenly spaced radial ticks in slow uniform
//   rotation -- every orientation visited, none preferred.
//
// Additive-blended like every battle effect, with small bright structure
// and low-alpha falloff carrying the glow (STYLE.md's wash-toward-white
// note), and the bright structure kept at or under the crystal's own
// painted head-rise so the nameplate stack above never sits inside it.

const AURA_COLOR = 0xe86a44;
const AURA_LIGHT = 0xff8f6a;
const FADE_IN_MS = 650;
const FADE_OUT_MS = 280;

// Builds the aura for `channel` sized to wrap a crystal whose painted body
// reaches roughly `r` from its center, mounts it behind the crystal's own
// art (index 0 of `crystal`) at a local y of `cy` (0 for a crystal whose
// anchor is its body center; the boss golem's anchor is a ground reference,
// so its caller passes the body's measured midpoint), and fades it in --
// the cast's ring pulse plays over the swell, so the aura reads as what the
// cast leaves behind. Returns the container; the caller owns removal via
// removeScreeningAura.
export function addScreeningAura(
  scene: Phaser.Scene,
  crystal: Phaser.GameObjects.Container,
  channel: ScreeningChannel,
  r: number,
  cy = 0
): Phaser.GameObjects.Container {
  const aura = scene.add.container(0, cy);

  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(AURA_COLOR, 0.08);
  glow.fillCircle(0, 0, r);
  aura.add(glow);

  if (channel === 'spin') buildSpinAura(scene, aura, r);
  else if (channel === 'charge') buildChargeAura(scene, aura, r);
  else buildSymmetryAura(scene, aura, r);

  aura.setAlpha(0);
  scene.tweens.add({ targets: aura, alpha: 1, duration: FADE_IN_MS, ease: 'Sine.easeOut' });
  crystal.addAt(aura, 0);
  return aura;
}

// Fades an aura out and reclaims it (its own tweens included) once the fade
// lands. A scene shutdown mid-fade reclaims everything anyway, so the
// onComplete not firing then leaks nothing.
export function removeScreeningAura(scene: Phaser.Scene, aura: Phaser.GameObjects.Container): void {
  scene.tweens.killTweensOf(aura);
  scene.tweens.add({
    targets: aura,
    alpha: 0,
    duration: FADE_OUT_MS,
    ease: 'Sine.easeIn',
    onComplete: () => {
      killTweensDeep(scene, aura);
      aura.destroy(true);
    },
  });
}

// One shell of open conduction-electron arcs, each trailing a mote -- the
// same shell art/kondo.ts's avatar cloud is built from, at battle scale.
function makeArcShell(
  scene: Phaser.Scene,
  specs: { r: number; start: number; sweep: number; alpha: number }[],
  moteR: number
): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.setBlendMode(Phaser.BlendModes.ADD);
  specs.forEach((s) => {
    g.lineStyle(2, shade(AURA_COLOR, 10), s.alpha);
    g.beginPath();
    g.arc(0, 0, s.r, Phaser.Math.DegToRad(s.start), Phaser.Math.DegToRad(s.start + s.sweep), false);
    g.strokePath();
    const end = Phaser.Math.DegToRad(s.start + s.sweep);
    g.fillStyle(shade(AURA_COLOR, 25), Math.min(1, s.alpha + 0.15));
    g.fillCircle(Math.cos(end) * s.r, Math.sin(end) * s.r, moteR);
  });
  c.add(g);
  return c;
}

function buildSpinAura(scene: Phaser.Scene, aura: Phaser.GameObjects.Container, r: number) {
  const inner = makeArcShell(
    scene,
    [
      { r: r * 0.62, start: -30, sweep: 200, alpha: 0.55 },
      { r: r * 0.7, start: 170, sweep: 130, alpha: 0.4 },
    ],
    r * 0.045
  );
  const outer = makeArcShell(
    scene,
    [
      { r: r * 0.86, start: 80, sweep: 170, alpha: 0.35 },
      { r: r * 0.94, start: -80, sweep: 120, alpha: 0.25 },
    ],
    r * 0.04
  );
  aura.add(inner);
  aura.add(outer);
  scene.tweens.add({ targets: inner, angle: 360, duration: 3600, repeat: -1, ease: 'Linear' });
  scene.tweens.add({ targets: outer, angle: -360, duration: 5800, repeat: -1, ease: 'Linear' });

  // The cloud's spins: small arrows on a still layer, all pointing down --
  // pinned antialigned against the moment they screen (the singlet), while
  // the orbital arcs circulate underneath them.
  const spins = scene.add.graphics();
  spins.setBlendMode(Phaser.BlendModes.ADD);
  const arrowCount = 4;
  const len = r * 0.2;
  for (let i = 0; i < arrowCount; i++) {
    const ang = ((i + 0.5) / arrowCount) * Math.PI * 2;
    const ax = Math.cos(ang) * r * 0.78;
    const ay = Math.sin(ang) * r * 0.78;
    spins.lineStyle(1.6, AURA_LIGHT, 0.8);
    spins.lineBetween(ax, ay - len / 2, ax, ay + len / 2);
    spins.fillStyle(AURA_LIGHT, 0.8);
    spins.fillTriangle(ax, ay + len * 0.72, ax - len * 0.24, ay + len * 0.36, ax + len * 0.24, ay + len * 0.36);
  }
  aura.add(spins);
  scene.tweens.add({ targets: spins, alpha: { from: 0.65, to: 1 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

function buildChargeAura(scene: Phaser.Scene, aura: Phaser.GameObjects.Container, r: number) {
  const cloud = scene.add.graphics();
  cloud.setBlendMode(Phaser.BlendModes.ADD);
  // The piled-up screening charge, densest at the center: stacked fills
  // standing in for the Thomas-Fermi falloff.
  cloud.fillStyle(AURA_COLOR, 0.1);
  cloud.fillCircle(0, 0, r * 0.55);
  cloud.fillStyle(AURA_COLOR, 0.12);
  cloud.fillCircle(0, 0, r * 0.32);
  // The induced density's Friedel oscillations: closed rings decaying
  // outward, the even ones brighter -- an alternating radial profile, not
  // anything that circulates.
  const rings: [number, number][] = [
    [0.42, 0.5],
    [0.62, 0.3],
    [0.82, 0.2],
    [1.0, 0.12],
  ];
  rings.forEach(([f, a]) => {
    cloud.lineStyle(2, shade(AURA_COLOR, 15), a);
    cloud.strokeCircle(0, 0, r * f);
  });
  aura.add(cloud);
  scene.tweens.add({
    targets: cloud,
    scaleX: { from: 0.97, to: 1.05 },
    scaleY: { from: 0.97, to: 1.05 },
    alpha: { from: 0.85, to: 1 },
    duration: 2400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

function buildSymmetryAura(scene: Phaser.Scene, aura: Phaser.GameObjects.Container, r: number) {
  const manifold = scene.add.graphics();
  manifold.setBlendMode(Phaser.BlendModes.ADD);
  // The degenerate circle itself, with a fainter inner echo.
  manifold.lineStyle(2, shade(AURA_COLOR, 15), 0.5);
  manifold.strokeCircle(0, 0, r * 0.85);
  manifold.lineStyle(1.4, AURA_COLOR, 0.22);
  manifold.strokeCircle(0, 0, r * 0.55);
  // Radial ticks: the order parameter's candidate orientations, evenly
  // spaced and carried around by one uniform rotation.
  const tickCount = 10;
  for (let i = 0; i < tickCount; i++) {
    const ang = (i / tickCount) * Math.PI * 2;
    manifold.lineStyle(1.8, AURA_LIGHT, 0.6);
    manifold.lineBetween(
      Math.cos(ang) * r * 0.74,
      Math.sin(ang) * r * 0.74,
      Math.cos(ang) * r * 0.96,
      Math.sin(ang) * r * 0.96
    );
  }
  aura.add(manifold);
  scene.tweens.add({ targets: manifold, angle: 360, duration: 9000, repeat: -1, ease: 'Linear' });
}
