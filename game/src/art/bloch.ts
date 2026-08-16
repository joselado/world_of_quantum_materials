import Phaser from 'phaser';

// Bloch's own avatar -- world 2's guardian (Bloch's theorem: in a periodic
// potential the eigenstates are psi_k(r) = e^(ik.r) u_k(r), a travelling
// plane wave times an envelope with the period of the lattice, which is what
// world 2's band-structure topic is built out of). In place of a head he
// carries that state, drawn as its two factors at once: a fixed row of ion
// sites one lattice constant apart, a luminous envelope whose corrugation
// repeats exactly with that spacing and piles amplitude onto the sites, and
// inside it the bright state itself with its crests marching steadily
// through the array, each crest carrying a bead of light along the curve.
// The carrier's wavelength is deliberately not a multiple of the lattice
// constant, so the phase really does advance by e^(ik.a) from one cell to
// the next instead of the two periods collapsing into one. Below the wave
// there is no solid body at all: the torso is the crystal itself, a tapered
// open outline holding the deeper rows of the same lattice -- columns of ion
// sites continuing straight down from the row the state lives on, fading
// with depth -- so the whole figure is the periodic solid his theorem is
// about. Own file/builder per the convention set by art/noether.ts's
// makeNoetherAvatar -- not a shared parameterized guardian builder.
//
// Drawn in local space centered on the chest/torso (0,0), same convention
// as makeNoetherAvatar: an internal sway tween is baked in, so callers are
// free to layer their own position/bob tween on top.
export function makeBlochAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const teal = 0x4adde0;
  const bright = 0xbdf6ff;

  const outer = scene.add.container(0, 0);

  // Ambient radiance -- concentric additive fills whose alpha falls off
  // outward, fading into the backdrop instead of ending at a disc edge.
  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    glow.fillStyle(teal, 0.018 + 0.02 * t);
    glow.fillCircle(0, -S * 0.1, S * (0.95 - 0.6 * t));
  }
  outer.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.6, to: 1 },
    scaleX: { from: 0.92, to: 1.08 },
    scaleY: { from: 0.92, to: 1.08 },
    duration: 1900,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const sway = scene.add.container(0, 0);
  outer.add(sway);
  scene.tweens.add({ targets: sway, angle: { from: -2, to: 2 }, duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // The lattice's top row: five ion sites one lattice constant `a` apart on
  // a fixed baseline, each with its own small halo, and a cell wall rising
  // off each one so the envelope's repeat can be read straight off the
  // spacing it belongs to.
  const a = S * 0.38;
  const halfW = S * 0.88;
  const bandY = -S * 0.62;
  const amp = S * 0.3;
  const ionY = bandY + amp * 1.3;
  const lattice = scene.add.graphics();
  for (let n = -2; n <= 2; n++) {
    const x = n * a;
    lattice.lineStyle(1, teal, 0.22);
    lattice.lineBetween(x, bandY - amp * 1.15, x, ionY);
    lattice.fillStyle(teal, 0.28);
    lattice.fillCircle(x, ionY, Math.max(2, S * 0.16));
    lattice.fillStyle(bright, 0.95);
    lattice.fillCircle(x, ionY, Math.max(1.2, S * 0.08));
  }
  lattice.lineStyle(1, teal, 0.25);
  lattice.lineBetween(-halfW, ionY, halfW, ionY);
  sway.add(lattice);

  // The body: an open tapered outline -- no fill beyond a faint additive
  // wash -- with the crystal's deeper rows inside it. The interior sites sit
  // directly below the top row's, one lattice constant apart in both
  // directions (a square lattice), dimming with depth, with faint lattice
  // planes joining the columns downward; the taper simply cuts the lattice
  // off, the way a crystal ends at its surface.
  const taper: { x: number; y: number }[] = [
    { x: -S * 0.48, y: -S * 0.1 },
    { x: S * 0.48, y: -S * 0.1 },
    { x: S * 0.3, y: S * 0.6 },
    { x: 0, y: S * 0.85 },
    { x: -S * 0.3, y: S * 0.6 },
  ];
  const bodyHalfW = (y: number) => {
    if (y <= S * 0.6) return S * (0.48 + ((0.3 - 0.48) * (y / S + 0.1)) / 0.7);
    return S * ((0.3 * (0.85 - y / S)) / 0.25);
  };
  const body = scene.add.graphics();
  body.fillStyle(teal, 0.07);
  body.fillPoints(taper, true);
  body.lineStyle(1.5, teal, 0.7);
  body.strokePoints(taper, true);
  const rows = [
    { y: ionY + a, alpha: 0.85, r: S * 0.07 },
    { y: ionY + a * 2, alpha: 0.45, r: S * 0.055 },
  ];
  for (let n = -1; n <= 1; n++) {
    const x = n * a;
    let deepest = ionY;
    for (const row of rows) {
      if (Math.abs(x) > bodyHalfW(row.y) * 0.95) continue;
      body.fillStyle(teal, row.alpha * 0.35);
      body.fillCircle(x, row.y, row.r * 2);
      body.fillStyle(bright, row.alpha);
      body.fillCircle(x, row.y, Math.max(1, row.r));
      deepest = row.y;
    }
    body.lineStyle(1, teal, 0.16);
    body.lineBetween(x, ionY, x, deepest);
  }
  sway.add(body);
  scene.tweens.add({ targets: body, alpha: { from: 0.75, to: 1 }, duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // psi = e^(ikx) u(x), redrawn each frame off a phase the tween below
  // advances: only the carrier moves, while u -- pinned to the ions, peaking
  // on them and thinning between -- stays exactly where the lattice puts it.
  const k = (Math.PI * 2) / (a * 2.5);
  const u = (x: number) => 0.62 + 0.38 * Math.cos((Math.PI * 2 * x) / a);
  const steps = 72;

  const wave = scene.add.graphics() as Phaser.GameObjects.Graphics & { phase: number };
  wave.phase = 0;
  sway.add(wave);

  const redraw = () => {
    const phase = wave.phase;
    wave.clear();

    const top: Phaser.Types.Math.Vector2Like[] = [];
    const bottom: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i <= steps; i++) {
      const x = -halfW + (2 * halfW * i) / steps;
      const e = amp * u(x);
      top.push({ x, y: bandY - e });
      bottom.push({ x, y: bandY + e });
    }
    wave.fillStyle(teal, 0.16);
    wave.fillPoints(top.concat(bottom.slice().reverse()), true);
    wave.lineStyle(1, teal, 0.5);
    wave.strokePoints(top, false);
    wave.strokePoints(bottom, false);

    // The plane wave's own crest planes, marching through the fixed array,
    // each carrying a bead of light where it meets the state's curve.
    wave.lineStyle(1, bright, 0.3);
    for (let n = -3; n <= 3; n++) {
      const xc = (phase + Math.PI * 2 * n) / k;
      if (xc < -halfW || xc > halfW) continue;
      wave.lineBetween(xc, bandY - amp * 1.1, xc, bandY + amp * 1.1);
      const yc = bandY - amp * u(xc);
      wave.fillStyle(bright, 0.4);
      wave.fillCircle(xc, yc, Math.max(2, S * 0.09));
      wave.fillStyle(0xffffff, 0.95);
      wave.fillCircle(xc, yc, Math.max(1.2, S * 0.045));
    }

    wave.lineStyle(2.2, bright, 0.95);
    wave.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = -halfW + (2 * halfW * i) / steps;
      const y = bandY - amp * u(x) * Math.cos(k * x - phase);
      if (i === 0) wave.moveTo(x, y);
      else wave.lineTo(x, y);
    }
    wave.strokePath();
  };
  redraw();
  scene.tweens.add({
    targets: wave,
    phase: { from: 0, to: Math.PI * 2 },
    duration: 2400,
    repeat: -1,
    ease: 'Linear',
    onUpdate: redraw,
  });

  return outer;
}
