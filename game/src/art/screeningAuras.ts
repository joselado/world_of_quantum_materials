import Phaser from 'phaser';
import type { KondoCloud } from '../data/materials';
import { shade } from './colors';
import { killTweensDeep } from './crystals';

// Persistent battle auras for Kondo's five self-buff clouds (§5,
// data/materials.ts's KONDO_MOVE_IDS) -- the cloud a cast raises stays
// visibly wrapped around the carrying crystal for as long as the buff is
// active (BattleScene.syncScreeningAura, driven off setStatus), added inside
// the crystal's own container so idle bob and hit squash carry it for free,
// the same free ride addBoostHalo's aura gets. All five stay in Kondo's own
// rust-orange family (the status pill's one color already carries that
// contract; the label names the cloud) and are told apart by silhouette,
// each drawing the physics of what its cloud actually is:
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
// - **restoring** is the screened moment's ground state: the conduction sea
//   settling back into a Fermi liquid around the singlet. One still, sharp
//   circle -- the Fermi surface, crisp again -- with ripples that start on
//   it and converge inward onto the crystal, fading as they close: a
//   scattered wave run backward, the sea calming rather than being stirred.
// - **anomalous** is a quantum critical point, where fluctuations have no
//   characteristic size. Short arcs on geometrically spaced shells, each
//   arc's length and weight in proportion to its shell so the pattern looks
//   the same at every scale, flickering in and out independently and coming
//   back at a fresh orientation each time -- patches of order forming and
//   dissolving at every scale at once.
//
// Additive-blended like every battle effect, with small bright structure
// and low-alpha falloff carrying the glow (STYLE.md's wash-toward-white
// note), and the bright structure kept at or under the crystal's own
// painted head-rise so the nameplate stack above never sits inside it.

const AURA_COLOR = 0xe86a44;
const AURA_LIGHT = 0xff8f6a;
const FADE_IN_MS = 650;
const FADE_OUT_MS = 280;

// Builds the aura for `cloud` sized to wrap a crystal whose painted body
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
  cloud: KondoCloud,
  r: number,
  cy = 0
): Phaser.GameObjects.Container {
  const aura = scene.add.container(0, cy);

  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.fillStyle(AURA_COLOR, 0.08);
  glow.fillCircle(0, 0, r);
  aura.add(glow);

  if (cloud === 'spin') buildSpinAura(scene, aura, r);
  else if (cloud === 'charge') buildChargeAura(scene, aura, r);
  else if (cloud === 'symmetry') buildSymmetryAura(scene, aura, r);
  else if (cloud === 'restoring') buildRestoringAura(scene, aura, r);
  else buildAnomalousAura(scene, aura, r);

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

function buildRestoringAura(scene: Phaser.Scene, aura: Phaser.GameObjects.Container, r: number) {
  // The Fermi surface, sharp again: one still circle.
  const surface = scene.add.graphics();
  surface.setBlendMode(Phaser.BlendModes.ADD);
  surface.lineStyle(2, shade(AURA_COLOR, 15), 0.5);
  surface.strokeCircle(0, 0, r * 0.9);
  aura.add(surface);

  // The sea settling: ripples leave the surface and converge onto the
  // crystal, fading out just short of its body so the closing stays in
  // view, staggered evenly so one is always on its way in.
  const rippleCount = 3;
  const period = 2400;
  for (let i = 0; i < rippleCount; i++) {
    const ripple = scene.add.graphics();
    ripple.setBlendMode(Phaser.BlendModes.ADD);
    ripple.lineStyle(2, AURA_LIGHT, 1);
    ripple.strokeCircle(0, 0, r * 0.9);
    ripple.setAlpha(0);
    aura.add(ripple);
    scene.tweens.add({
      targets: ripple,
      scale: { from: 1, to: 0.66 },
      alpha: { from: 0.8, to: 0 },
      duration: period,
      delay: (i * period) / rippleCount,
      repeat: -1,
      ease: 'Sine.easeIn',
    });
  }
}

function buildAnomalousAura(scene: Phaser.Scene, aura: Phaser.GameObjects.Container, r: number) {
  // Geometrically spaced shells (each 1.2x the last, the innermost just
  // clear of the crystal's body) with arcs of one angular sweep, so an arc's
  // length -- and its weight -- grow with its shell: the same pattern at
  // every scale.
  const shells = [0.56, 0.67, 0.8, 0.96];
  const arcsPerShell = 4;
  const sweep = Phaser.Math.DegToRad(48);
  shells.forEach((f) => {
    for (let i = 0; i < arcsPerShell; i++) {
      const arc = scene.add.graphics();
      arc.setBlendMode(Phaser.BlendModes.ADD);
      arc.lineStyle(1 + 1.6 * f, shade(AURA_COLOR, 20), 1);
      arc.beginPath();
      arc.arc(0, 0, r * f, -sweep / 2, sweep / 2, false);
      arc.strokePath();
      arc.setAngle(Phaser.Math.Between(0, 359));
      arc.setAlpha(0);
      aura.add(arc);
      // Each patch flickers on its own clock and comes back somewhere new.
      scene.tweens.add({
        targets: arc,
        alpha: { from: 0, to: 0.35 + 0.35 * f },
        duration: Phaser.Math.Between(260, 720),
        delay: Phaser.Math.Between(0, 900),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onRepeat: () => arc.setAngle(Phaser.Math.Between(0, 359)),
      });
    }
  });
}
