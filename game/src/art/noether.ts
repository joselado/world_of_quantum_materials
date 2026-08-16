import Phaser from 'phaser';
import { shade } from './colors';
import { GOLD_ACCENT } from '../ui/theme';

// Noether's own avatar -- world 1's guardian (Noether's theorem: every
// continuous symmetry of the action carries a conserved current, which is
// what world 1's spontaneous-symmetry-breaking topic is measured against).
// Not a figure at all, the same licence art/landau.ts takes: the body is the
// conserved current itself, drawn as pure light with no solid fill anywhere.
// Two offset circulation cells, each a nested family of closed streamlines
// around a blazing vortex core, turning in opposite senses the way two
// adjacent cells of a divergence-free flow must. Each streamline is a ring
// of fine arc segments whose brightness ramps up toward a leading edge, so
// spinning it reads as luminous flow sweeping round rather than a rotating
// dashed donut, and every one of them closes on itself: whatever the current
// carries comes back around and none of it leaves. The arcs run at the same
// speed on every streamline, so an outer one takes longer to come round than
// an inner one, and a fixed set of brighter motes rides the middle
// streamline forever -- the count never changes, which is the conservation
// law made visible. The two cores are the brightest points in the figure and
// pulse on different timings so the pair never beats in unison. Silhouette:
// two offset hollow rings of running gold, no head, no face, no robe.
// Later guardians follow the same rule: their own builder in their own file
// (art/bloch.ts's makeBlochAvatar, art/franklin.ts's makeFranklinAvatar, and
// any future ones per DESIGN.md §5) rather than reusing this one.
//
// Drawn in local space centered on the chest/torso (0,0); the returned
// container also wraps a slow rotation sway internally, so callers are free
// to layer their own position/bob tween on top (as OverworldScene already
// does for the panel-intro float) without the two tweens fighting.
export function makeNoetherAvatar(scene: Phaser.Scene, scale = 1): Phaser.GameObjects.Container {
  const S = 30 * scale;
  const gold = GOLD_ACCENT;
  const hot = 0xfff6d8;

  const outer = scene.add.container(0, 0);

  // Ambient radiance behind everything -- concentric additive fills whose
  // alpha falls off outward, so the light fades into the backdrop instead of
  // ending at a disc edge.
  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    glow.fillStyle(gold, 0.018 + 0.02 * t);
    glow.fillCircle(0, -S * 0.05, S * (0.95 - 0.6 * t));
  }
  outer.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.6, to: 1 },
    scaleX: { from: 0.92, to: 1.08 },
    scaleY: { from: 0.92, to: 1.08 },
    duration: 1800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  // Everything below sways gently, like a flow adrift rather than a fixed
  // sprite -- a slow rotation, independent of any position/bob tween a
  // caller adds to `outer`.
  const sway = scene.add.container(0, 0);
  outer.add(sway);
  scene.tweens.add({ targets: sway, angle: { from: -2.5, to: 2.5 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // One circulation cell: three nested closed streamlines of graduated arc
  // segments, a blazing vortex core, and a set of motes carried round the
  // middle one. `spin` is +1/-1 for the sense of circulation; the two cells
  // below are handed opposite signs.
  const addCell = (cx: number, cy: number, R: number, spin: number, motes: number, pulseDur: number, pulseDelay: number) => {
    const cell = scene.add.container(cx, cy);
    // Squashed a little: the cells are seen from slightly above their plane,
    // so a closed streamline projects as an ellipse rather than a disc.
    cell.setScale(1, 0.86);

    // A streamline as `cycles` comet sweeps: fine arc segments whose alpha
    // and width both ramp toward a leading edge, so the spin below reads as
    // flow with a bright front and a fading wake. Each bright arc rides on a
    // slightly wider dark under-arc, keeping the flow legible over world 1's
    // pale daytime terrain as well as over dark panel backdrops. Drawn about
    // the Graphics' own origin and spun about that origin, so a whole
    // streamline's worth of motion costs one tween. Duration scales with
    // radius: the same speed along every streamline, a longer one simply
    // taking longer.
    const dark = shade(gold, -70);
    const streamline = (r: number, segs: number, cycles: number, width: number, alphaMax: number) => {
      const g = scene.add.graphics();
      const step = (Math.PI * 2) / segs;
      const per = segs / cycles;
      const seg = (i: number, w: number, color: number, alpha: number) => {
        g.lineStyle(w, color, alpha);
        g.beginPath();
        g.arc(0, 0, r, spin * i * step, spin * (i * step + step * 0.88), spin < 0);
        g.strokePath();
      };
      for (let i = 0; i < segs; i++) {
        const t = (i % per) / (per - 1);
        const ramp = 0.12 + 0.88 * Math.pow(t, 1.6);
        seg(i, width * (0.55 + 0.45 * t) * 1.9, dark, alphaMax * ramp * 0.55);
      }
      for (let i = 0; i < segs; i++) {
        const t = (i % per) / (per - 1);
        const ramp = 0.12 + 0.88 * Math.pow(t, 1.6);
        seg(i, width * (0.55 + 0.45 * t), t > 0.9 ? hot : gold, alphaMax * ramp);
      }
      cell.add(g);
      scene.tweens.add({ targets: g, angle: spin * 360, duration: (4200 * r) / R, repeat: -1, ease: 'Linear' });
      return g;
    };
    streamline(R, 26, 2, Math.max(1.4, R * 0.13), 0.95);
    streamline(R * 0.72, 20, 2, Math.max(1.1, R * 0.1), 0.75);
    streamline(R * 0.44, 14, 1, Math.max(1, R * 0.08), 0.55);

    const carried = scene.add.graphics();
    for (let i = 0; i < motes; i++) {
      const ang = (i * Math.PI * 2) / motes;
      const mx = Math.cos(ang) * R * 0.72;
      const my = Math.sin(ang) * R * 0.72;
      carried.fillStyle(dark, 0.4);
      carried.fillCircle(mx, my, Math.max(2.2, R * 0.24));
      carried.fillStyle(gold, 0.55);
      carried.fillCircle(mx, my, Math.max(1.8, R * 0.19));
      carried.fillStyle(hot, 1);
      carried.fillCircle(mx, my, Math.max(1.2, R * 0.12));
    }
    cell.add(carried);
    scene.tweens.add({ targets: carried, angle: spin * 360, duration: 4200 * 0.72, repeat: -1, ease: 'Linear' });

    // The vortex core: the brightest point of the cell, a hot centre inside
    // its own falloff halo, pulsing on this cell's own timing.
    const core = scene.add.graphics();
    core.fillStyle(dark, 0.35);
    core.fillCircle(0, 0, R * 0.36);
    core.fillStyle(gold, 0.45);
    core.fillCircle(0, 0, R * 0.19);
    core.fillStyle(hot, 1);
    core.fillCircle(0, 0, Math.max(1.4, R * 0.11));
    cell.add(core);
    scene.tweens.add({
      targets: core,
      alpha: { from: 0.65, to: 1 },
      scaleX: { from: 0.85, to: 1.18 },
      scaleY: { from: 0.85, to: 1.18 },
      duration: pulseDur,
      delay: pulseDelay,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    sway.add(cell);
  };

  // Offset from each other rather than stacked on one axis, so the pair
  // reads as two cells of one flow instead of a body with a head. Core
  // pulses at 1500ms and 1700ms with a 300ms offset so they never sync.
  addCell(S * 0.14, -S * 0.52, S * 0.36, 1, 3, 1500, 0);
  addCell(-S * 0.08, S * 0.34, S * 0.55, -1, 4, 1700, 300);

  return outer;
}
