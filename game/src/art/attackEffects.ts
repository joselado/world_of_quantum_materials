import Phaser from 'phaser';
import type { MoveClass } from '../data/types';
import { playAttackSfx, playImpactSfx, playFizzleSfx, type AttackShape } from '../audio/sfx';
import { music } from '../audio/music';

interface Point {
  x: number;
  y: number;
}

// Each move class gets a distinct particle-effect silhouette (not just a
// color swap) so different quasiparticles read differently in battle:
// bolt = a fast, focused shot (Phonon Beam, Electron Pulse, Spinon Swap,
// Triplon Surge, Chiral Current); ring = an expanding wave pulse (Magnon
// Pulse, Polaron Drag, Electromagnon Pulse, Plasmon Pulse, Ferron Pulse,
// Higgs Oscillation, Helical Current, Screening Pulse); burst = many small
// particles converging/scattering (Anyon Braid, Majorana Split, Heavy
// Fermion Pulse, Vison Loop). 'beam'/'eruption' are never picked from here
// -- they're only ever reached via ANALYTIC_SHAPES' per-move-id override
// below (BattleScene's resolveHit always supplies one for Laughlin's two
// moves), so no class needs its own `shape: 'beam' | 'eruption'` entry.
const EFFECT_STYLE: Record<MoveClass, { color: number; shape: AttackShape }> = {
  electron: { color: 0x4a90d9, shape: 'bolt' },
  magnon: { color: 0xd94a4a, shape: 'ring' },
  phonon: { color: 0xff8844, shape: 'bolt' },
  polaron: { color: 0x8a6ad9, shape: 'ring' },
  spinon: { color: 0x5ad9c9, shape: 'bolt' },
  // A dimer magnet's confined triplet mode -- a fast, focused shot like
  // Spinon Swap, tinted a distinct rose rather than spinon's teal.
  triplon: { color: 0xd94a8a, shape: 'bolt' },
  // Electromagnon Pulse -- a magnon-family excitation, so it shares
  // Magnon Pulse's expanding-ring silhouette, tinted the multiferroic
  // type's own magenta rather than magnon's red.
  electromagnon: { color: 0xc94ac0, shape: 'ring' },
  // A one-way edge current -- a fast, focused shot, golden rather than
  // Electron Pulse's blue.
  chiral: { color: 0xd9c14a, shape: 'bolt' },
  // A counter-propagating (two-way) edge pair -- an expanding ring rather
  // than chiral's single bolt, violet.
  helical: { color: 0x8a4ad9, shape: 'ring' },
  // A condensate's own amplitude oscillation -- an expanding ring, pale icy
  // blue (the superconductor family's own hue, lighter than plasmon's).
  higgs: { color: 0xbfe8ff, shape: 'ring' },
  // Fractional braiding statistics -- many small particles
  // converging/scattering.
  chargedAnyon: { color: 0xd9a24a, shape: 'burst' },
  majorana: { color: 0x333333, shape: 'burst' },
  // A mass-renormalized composite -- dense, converging/scattering particles,
  // tinted the kondoHeavyFermion type's own amber.
  heavyFermion: { color: 0xd9962a, shape: 'burst' },
  // The polarization order's own quantum -- an expanding ring like magnon's,
  // tinted the ferroelectric type's own rose.
  ferron: { color: 0xd96a8a, shape: 'ring' },
  // A Z2 gauge-flux vortex -- converging/scattering particles, teal-green.
  vison: { color: 0x4ac9a0, shape: 'burst' },
  // A collective charge oscillation reads as an expanding wave like Magnon
  // Pulse's ring, tinted an electric cyan instead of magnon's red.
  plasmon: { color: 0x4ad9ff, shape: 'ring' },
  // Kondo's three moves (Screening Pulse, Scattering Drag, Breakdown
  // Cascade) share one look -- an expanding ring reads as a screening
  // cloud enveloping the target, tinted Kondo's own rust-orange
  // (WORLD_GUARDIANS[8].strokeColor). Three distinct move names and
  // status-effect log lines already read as three different moves without
  // three different silhouettes too, so unlike Laughlin's/Skłodowska-Curie's
  // moves they need no per-move-id shape override.
  screening: { color: 0xe86a44, shape: 'ring' },
};

// Per-move-id shape overrides for Laughlin's two Analytic moves -- the one pair where
// both moves (`skyfallBeam`, `groundEruption`) want two distinct silhouettes
// (a falling beam, a ground eruption) rather than sharing whichever
// ordinary EFFECT_STYLE shape their currently-tuned quasiparticle carries.
export const ANALYTIC_SHAPES: Record<string, AttackShape> = {
  skyfallBeam: 'beam',
  groundEruption: 'eruption',
};

// Per-move-id shape overrides for Skłodowska-Curie's two Ultimate moves
// (§5, World 10) -- same pattern as ANALYTIC_SHAPES above, one entry per
// move id rather than per quasiparticle class, since `ultimateMeteor`/
// `ultimateNova` want their own multi-phase "summon" silhouettes (playMeteor/
// playNova below) regardless of whichever class each is currently tuned to.
export const ULTIMATE_SHAPES: Record<string, AttackShape> = {
  ultimateMeteor: 'meteor',
  ultimateNova: 'nova',
};

const WINDUP_MS = 90;
// meteor/nova entries exist here purely so this Record type-checks against
// AttackShape (TypeScript forces every shape to have an entry) -- neither
// value is actually read: playMeteor/playNova (below) manage their own
// internal multi-phase timeline (summon -> charge -> impact -> aftermath,
// see METEOR_TOTAL_MS/NOVA_TOTAL_MS) rather than the flat
// WINDUP_MS + TRAVEL_MS[shape] + IMPACT_MS formula every other shape uses,
// since that formula doesn't scale to a multi-second sequence.
const TRAVEL_MS: Record<AttackShape, number> = {
  bolt: 340,
  ring: 460,
  burst: 400,
  beam: 520,
  eruption: 480,
  meteor: 5200,
  nova: 4800,
};
const IMPACT_MS = 260;

// Plays the full attack beat: a quick windup flash at the attacker, the
// travelling effect itself, and a shockwave burst on arrival -- alongside
// its sound (attack sfx on launch, an impact thud scaled by `powerRatio` on
// arrival) and a matching dip in the music so the hit reads clearly over the
// score. `onImpact` fires the moment the travelling effect lands (in time
// for BattleScene's HP-bar update/flashHit), not after the shockwave finishes
// decaying -- the shockwave itself is fire-and-forget. `shapeOverride` lets a
// caller pick a specific silhouette regardless of moveClass's usual one
// (BattleScene passes ANALYTIC_SHAPES[move.id] for Laughlin's two moves, or
// ULTIMATE_SHAPES[move.id] for Skłodowska-Curie's two, so those four read
// differently regardless of whichever quasiparticle each is currently tuned
// to). `onComplete`/`whiff` only matter for the meteor/nova shapes below --
// every other shape ignores them, since its tail (win/lose check, opponent's
// turn) is already synchronous with resolveHit's own caller rather than
// needing a completion callback of its own.
export function playAttackEffect(
  scene: Phaser.Scene,
  moveClass: MoveClass,
  from: Point,
  to: Point,
  onImpact?: () => void,
  powerRatio = 1,
  shapeOverride?: AttackShape,
  onComplete?: () => void,
  whiff = false
) {
  const style = EFFECT_STYLE[moveClass];
  const shape = shapeOverride ?? style.shape;

  // The Ultimate tier (Skłodowska-Curie's two moves, §5) runs its own
  // multi-phase summon->charge->impact->aftermath sequence (playMeteor/
  // playNova below) instead of the shared windup/travel/impact beat every
  // other shape uses -- `onImpact` fires mid-sequence (at the impact phase's
  // own strike beat) and `onComplete` only once the full sequence (including
  // the aftermath decay) has finished, which is what lets BattleScene defer
  // the win/lose check and the opponent's turn until the animation is
  // actually done rather than seconds early.
  if (shape === 'meteor' || shape === 'nova') {
    const play = shape === 'meteor' ? playMeteor : playNova;
    const totalMs = shape === 'meteor' ? METEOR_TOTAL_MS : NOVA_TOTAL_MS;
    music.duck(totalMs);
    playAttackSfx(shape);
    play(
      scene,
      style.color,
      to,
      whiff,
      () => {
        if (whiff) {
          playFizzleSfx();
        } else {
          playImpactShockwave(scene, style.color, to);
          playImpactSfx(powerRatio);
        }
        onImpact?.();
      },
      () => onComplete?.()
    );
    return;
  }

  const totalMs = WINDUP_MS + TRAVEL_MS[shape] + IMPACT_MS;
  music.duck(totalMs);
  playAttackSfx(shape);

  playWindup(scene, style.color, from, () => {
    const land = () => {
      playImpactShockwave(scene, style.color, to);
      playImpactSfx(powerRatio);
      onImpact?.();
    };
    if (shape === 'ring') playRing(scene, style.color, from, to, land);
    else if (shape === 'burst') playBurst(scene, style.color, from, to, land);
    else if (shape === 'beam') playBeam(scene, style.color, to, land);
    else if (shape === 'eruption') playEruption(scene, style.color, to, land);
    else playBolt(scene, style.color, from, to, land);
  });
}

// A quick expanding/fading glow at the attacker's own position, right
// before the effect launches -- gives every attack a beat of anticipation
// instead of firing instantly.
function playWindup(scene: Phaser.Scene, color: number, at: Point, onDone: () => void) {
  const g = scene.add.graphics().setDepth(59).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: WINDUP_MS,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      g.fillStyle(color, 0.5 * (1 - t));
      g.fillCircle(at.x, at.y, 4 + t * 22);
      g.lineStyle(2, 0xffffff, 0.85 * (1 - t));
      g.strokeCircle(at.x, at.y, 4 + t * 22);
    },
    onComplete: () => {
      g.destroy();
      onDone();
    },
  });
}

function playBolt(scene: Phaser.Scene, color: number, from: Point, to: Point, onImpact?: () => void) {
  const g = scene.add.graphics().setDepth(60).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: TRAVEL_MS.bolt,
    ease: 'Cubic.easeIn',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const x = Phaser.Math.Linear(from.x, to.x, t);
      const y = Phaser.Math.Linear(from.y, to.y, t);
      g.clear();
      g.lineStyle(8, color, 0.3);
      g.lineBetween(
        Phaser.Math.Linear(from.x, to.x, Math.max(0, t - 0.55)),
        Phaser.Math.Linear(from.y, to.y, Math.max(0, t - 0.55)),
        x,
        y
      );
      g.lineStyle(4, color, 0.9);
      g.lineBetween(
        Phaser.Math.Linear(from.x, to.x, Math.max(0, t - 0.3)),
        Phaser.Math.Linear(from.y, to.y, Math.max(0, t - 0.3)),
        x,
        y
      );
      g.fillStyle(color, 1);
      g.fillCircle(x, y, 8);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(x, y, 3.5);
    },
    onComplete: () => {
      g.destroy();
      onImpact?.();
    },
  });
}

function playRing(scene: Phaser.Scene, color: number, from: Point, to: Point, onImpact?: () => void) {
  const g = scene.add.graphics().setDepth(60).setBlendMode(Phaser.BlendModes.ADD);
  const originX = Phaser.Math.Linear(from.x, to.x, 0.12);
  const originY = Phaser.Math.Linear(from.y, to.y, 0.12);
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: TRAVEL_MS.ring,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      g.lineStyle(4, color, 1 - t * 0.85);
      g.strokeCircle(originX, originY, 12 + t * 58);
      g.lineStyle(3, color, (1 - t) * 0.7);
      g.strokeCircle(originX, originY, 4 + t * 34);
      g.lineStyle(2, 0xffffff, (1 - t) * 0.5);
      g.strokeCircle(originX, originY, 20 + t * 46);
    },
    onComplete: () => {
      g.destroy();
      onImpact?.();
    },
  });
}

function playBurst(scene: Phaser.Scene, color: number, from: Point, to: Point, onImpact?: () => void) {
  const g = scene.add.graphics().setDepth(60).setBlendMode(Phaser.BlendModes.ADD);
  const n = 12;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: TRAVEL_MS.burst,
    ease: 'Cubic.easeIn',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      const cx = Phaser.Math.Linear(from.x, to.x, t);
      const cy = Phaser.Math.Linear(from.y, to.y, t);
      const spread = (1 - t) * 32 + t * 14;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + t * 3;
        g.fillStyle(color, 0.5 + t * 0.5);
        g.fillCircle(cx + Math.cos(ang) * spread, cy + Math.sin(ang) * spread, 3.5);
      }
    },
    onComplete: () => {
      g.destroy();
      onImpact?.();
    },
  });
}

// A thick column of light dropping straight down onto the target from off
// the top of the screen -- deliberately ignores `from` (the attacker's own
// position) since a beam falling out of the sky doesn't originate there.
// Telegraphs first (a faint, full-height column fades in before the bright
// head starts falling) so the "incoming" beat reads clearly, then the head
// travels the height of the field to land. Substantially flashier than the
// other move classes on purpose -- Laughlin's own request was "a beam falling
// from the sky," clearly reading as stronger than an ordinary hit: a pair of
// swirling side-rays orbit the main column, a radiant sun expands at the
// point of origin as the beam charges, and a trail of falling sparks chases
// the head down.
function playBeam(scene: Phaser.Scene, color: number, to: Point, onImpact?: () => void) {
  const g = scene.add.graphics().setDepth(60).setBlendMode(Phaser.BlendModes.ADD);
  const sun = scene.add.graphics().setDepth(59).setBlendMode(Phaser.BlendModes.ADD);
  const originY = -40;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: TRAVEL_MS.beam,
    ease: 'Cubic.easeIn',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const headY = Phaser.Math.Linear(originY, to.y, Math.min(1, t * 1.3));
      const pulse = 0.75 + 0.25 * Math.sin(t * 46);
      const swirl = Math.sin(t * 20) * 12;
      g.clear();
      // Wide, pulsing telegraph halo.
      g.fillStyle(color, 0.24 * t * pulse);
      g.fillRect(to.x - 34, originY, 68, to.y - originY);
      // Two side-rays swirling around the main column.
      g.fillStyle(color, 0.55 * t);
      g.fillRect(to.x - 24 + swirl, originY, 9, headY - originY);
      g.fillRect(to.x + 15 - swirl, originY, 9, headY - originY);
      // Main column, brighter/wider than the original.
      g.fillStyle(color, 0.97);
      g.fillRect(to.x - 15, originY, 30, headY - originY);
      // White-hot core.
      g.fillStyle(0xffffff, 1);
      g.fillRect(to.x - 5, originY, 10, headY - originY);
      // Falling sparks trailing the head.
      for (let i = 0; i < 7; i++) {
        const sy = headY - i * 16;
        if (sy < originY) continue;
        const sx = to.x + Math.sin(t * 34 + i * 1.7) * (14 - i);
        g.fillStyle(i % 2 === 0 ? 0xffffff : color, 0.85 - i * 0.11);
        g.fillCircle(sx, sy, 3.2 - i * 0.22);
      }
      // Radiant sun expanding at the point of origin as the beam charges.
      sun.clear();
      sun.fillStyle(0xffffff, 0.65 * (1 - t));
      sun.fillCircle(to.x, originY, 12 + t * 46);
      sun.lineStyle(2, color, 0.75 * (1 - t));
      sun.strokeCircle(to.x, originY, 18 + t * 58);
    },
    onComplete: () => {
      g.destroy();
      sun.destroy();
      onImpact?.();
    },
  });
}

// Shards bursting up and outward from a crack in the ground under the
// target -- also ignores `from`, since the eruption comes up from beneath
// the defender rather than travelling from the attacker. Substantially
// flashier than the other move classes on purpose (Laughlin's own request):
// an expanding double shockwave ring on the ground, a bright geyser core
// punching straight up through the shards, and nearly double the shard
// count spread wider than an ordinary burst.
function playEruption(scene: Phaser.Scene, color: number, to: Point, onImpact?: () => void) {
  const g = scene.add.graphics().setDepth(60).setBlendMode(Phaser.BlendModes.ADD);
  const n = 18;
  const groundY = to.y + 18;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: TRAVEL_MS.eruption,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      // Expanding double shockwave ring on the ground.
      g.lineStyle(3, color, 0.85 * (1 - t));
      g.strokeCircle(to.x, groundY, 16 + t * 76);
      g.lineStyle(2, 0xffffff, 0.55 * (1 - t));
      g.strokeCircle(to.x, groundY, 10 + t * 54);
      // Brighter, wider crack glow.
      g.fillStyle(color, 0.65 * (1 - t));
      g.fillEllipse(to.x, groundY, 74 + t * 54, 22);
      // Bright geyser core punching straight up through the shards.
      const coreH = 96 * Math.min(1, t * 1.6);
      g.fillStyle(color, 0.55 * (1 - t * 0.5));
      g.fillRect(to.x - 11, groundY - coreH * 0.8, 22, coreH * 0.8);
      g.fillStyle(0xffffff, 0.9 * (1 - t * 0.5));
      g.fillRect(to.x - 4, groundY - coreH, 8, coreH);
      // Shards, nearly double the ordinary burst count and spread wider.
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + ((i / (n - 1)) - 0.5) * 2.3;
        const dist = t * 100;
        const px = to.x + Math.cos(ang) * dist * 0.6;
        const py = groundY + Math.sin(ang) * dist;
        g.fillStyle(i % 2 === 0 ? color : 0xffffff, 0.95 * (1 - t * 0.6));
        g.fillCircle(px, py, 5 - t * 1.6);
      }
    },
    onComplete: () => {
      g.destroy();
      onImpact?.();
    },
  });
}

// Skłodowska-Curie's Ultimate pair (§5, World 10, ULTIMATE_SHAPES) -- the
// flashiest tier, a 4-6s "Final-Fantasy-style summon" sequence rather than a
// single travelling effect: a runic summon circle (Summon) builds up,
// something gathers/intensifies at the target (Charge), the actual strike
// lands (Impact -- fires `onImpact` right as this phase *begins*, not at its
// end, mirroring every other shape's `land()`), then decays away (Aftermath
// -- fires `onComplete` once, at the very end). Each phase is its own
// `scene.tweens.addCounter`, chained via onComplete rather than one long
// tween, and each phase creates and destroys its own Graphics objects rather
// than reusing one across phases -- unlike every other shape here, which
// only ever needs one short tween and so never has to worry about that
// cleanup. `whiff` (set when an Ultimate move fails its 3-question gate,
// BattleScene's resolveHit) swaps the Impact/Aftermath phases for a smaller,
// desaturated, shrinking version that reads as "it didn't work" rather than
// as a weaker hit -- the Summon/Charge phases play identically either way, so
// the 3-question tension pays off the same regardless of the outcome.
const METEOR_SUMMON_MS = 1300;
const METEOR_CHARGE_MS = 2000;
const METEOR_IMPACT_MS = 900;
const METEOR_AFTERMATH_MS = 900;
export const METEOR_TOTAL_MS = METEOR_SUMMON_MS + METEOR_CHARGE_MS + METEOR_IMPACT_MS + METEOR_AFTERMATH_MS; // 5100ms

const NOVA_SUMMON_MS = 1200;
const NOVA_CHARGE_MS = 1900;
const NOVA_IMPACT_MS = 850;
const NOVA_AFTERMATH_MS = 850;
export const NOVA_TOTAL_MS = NOVA_SUMMON_MS + NOVA_CHARGE_MS + NOVA_IMPACT_MS + NOVA_AFTERMATH_MS; // 4800ms

// Summon (`ultimateMeteor`): an expanding runic/lattice circle on the ground
// under the target -- a rotating hexagonal lattice ring inside an outer
// glow ring, plus radiating spokes, all flattened to an ellipse for ground
// perspective (matching playEruption's own groundY/fillEllipse convention).
function playMeteorSummon(scene: Phaser.Scene, color: number, to: Point, onDone: () => void) {
  const g = scene.add.graphics().setDepth(58).setBlendMode(Phaser.BlendModes.ADD);
  const groundY = to.y + 18;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: METEOR_SUMMON_MS,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const r = 10 + t * 66;
      g.clear();
      g.lineStyle(3, color, 0.2 + t * 0.55);
      g.strokeEllipse(to.x, groundY, r * 2, r * 0.8);
      const rot = t * Math.PI * 1.3;
      g.lineStyle(2, 0xffffff, 0.15 + t * 0.5);
      g.beginPath();
      for (let i = 0; i <= 6; i++) {
        const ang = rot + (i / 6) * Math.PI * 2;
        const px = to.x + Math.cos(ang) * r * 0.7;
        const py = groundY + Math.sin(ang) * r * 0.7 * 0.4;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
      for (let i = 0; i < 10; i++) {
        const ang = rot * 0.6 + (i / 10) * Math.PI * 2;
        g.lineStyle(1.5, color, 0.15 + t * 0.35);
        g.lineBetween(to.x, groundY, to.x + Math.cos(ang) * r * 0.85, groundY + Math.sin(ang) * r * 0.85 * 0.4);
      }
    },
    onComplete: () => {
      g.destroy();
      onDone();
    },
  });
}

// Charge (`ultimateMeteor`): a heavy glowing mass, ringed by orbiting debris
// chunks and a fire trail, descending from off the top of the screen to hang
// just above the target -- a bigger, heavier silhouette than playBeam's thin
// falling column (a meteor reads as a mass, not a shot), with the summon
// circle from the prior phase redrawn underneath, still pulsing.
function playMeteorCharge(scene: Phaser.Scene, color: number, to: Point, onDone: () => void) {
  const mass = scene.add.graphics().setDepth(60).setBlendMode(Phaser.BlendModes.ADD);
  const circle = scene.add.graphics().setDepth(58).setBlendMode(Phaser.BlendModes.ADD);
  const groundY = to.y + 18;
  const originY = -60;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: METEOR_CHARGE_MS,
    ease: 'Cubic.easeIn',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const massY = Phaser.Math.Linear(originY, to.y - 34, t);
      const massR = 14 + t * 34;
      mass.clear();
      for (let i = 0; i < 8; i++) {
        const ty = massY - i * 14;
        if (ty < originY) continue;
        mass.fillStyle(i % 2 === 0 ? 0xffffff : color, Math.max(0, 0.5 - i * 0.06));
        mass.fillCircle(to.x + Math.sin(t * 22 + i) * (6 - i * 0.4), ty, Math.max(2, massR * 0.5 - i * 2));
      }
      for (let i = 0; i < 5; i++) {
        const ang = t * 9 + (i / 5) * Math.PI * 2;
        const orbR = massR * 1.6;
        mass.fillStyle(0x8a5a3a, 0.9);
        mass.fillCircle(to.x + Math.cos(ang) * orbR, massY + Math.sin(ang) * orbR * 0.6, 4);
      }
      mass.fillStyle(color, 0.85);
      mass.fillCircle(to.x, massY, massR);
      mass.fillStyle(0xffffff, 0.7);
      mass.fillCircle(to.x, massY, massR * 0.45);

      circle.clear();
      const pulse = 0.6 + 0.4 * Math.sin(t * 28);
      circle.lineStyle(3, color, 0.4 * pulse);
      circle.strokeEllipse(to.x, groundY, (58 + Math.sin(t * 10) * 4) * 2, (58 + Math.sin(t * 10) * 4) * 0.8);
      circle.lineStyle(2, 0xffffff, 0.3 * pulse);
      circle.strokeEllipse(to.x, groundY, 76, 30);
    },
    onComplete: () => {
      mass.destroy();
      circle.destroy();
      onDone();
    },
  });
}

// Impact (`ultimateMeteor`): calls `onImpact()` immediately, then plays
// either the full heavy slam (a blinding core flash, a wide shockwave ring,
// and radial ground cracks) or, on a whiff, a small desaturated version that
// just deflates in place without ever landing.
function playMeteorImpact(
  scene: Phaser.Scene,
  color: number,
  to: Point,
  whiff: boolean,
  onImpact: () => void,
  onDone: () => void
) {
  onImpact();
  const g = scene.add.graphics().setDepth(60).setBlendMode(Phaser.BlendModes.ADD);
  const groundY = to.y + 18;
  const drawColor = whiff ? 0x777777 : color;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: METEOR_IMPACT_MS,
    ease: whiff ? 'Sine.easeOut' : 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      if (whiff) {
        const r = Math.max(0, 34 * (1 - t));
        g.fillStyle(drawColor, 0.35 * (1 - t));
        g.fillCircle(to.x, to.y - 18 * (1 - t), r);
        g.lineStyle(2, 0x999999, 0.35 * (1 - t));
        g.strokeEllipse(to.x, groundY, 40 * (1 - t), 14 * (1 - t));
        return;
      }
      g.fillStyle(0xffffff, 0.9 * (1 - t));
      g.fillCircle(to.x, groundY, 20 + t * 42);
      g.lineStyle(5, color, 0.85 * (1 - t));
      g.strokeEllipse(to.x, groundY, (10 + t * 110) * 2, (10 + t * 110) * 0.5);
      g.fillStyle(color, 0.55 * (1 - t));
      g.fillEllipse(to.x, groundY, 90 + t * 60, 26);
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2;
        const len = 20 + t * 72;
        g.lineStyle(3, color, 0.7 * (1 - t));
        g.lineBetween(to.x, groundY, to.x + Math.cos(ang) * len, groundY + Math.sin(ang) * len * 0.5);
      }
    },
    onComplete: () => {
      g.destroy();
      onDone();
    },
  });
}

// Aftermath (`ultimateMeteor`): residual glow and rising embers/dissipating
// shards, ending by tearing down every Graphics object this phase created
// and firing `onComplete` exactly once.
function playMeteorAftermath(scene: Phaser.Scene, color: number, to: Point, whiff: boolean, onComplete: () => void) {
  const g = scene.add.graphics().setDepth(58).setBlendMode(Phaser.BlendModes.ADD);
  const groundY = to.y + 18;
  const emberColor = whiff ? 0x888888 : color;
  const spread = whiff ? 14 : 44;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: METEOR_AFTERMATH_MS,
    ease: 'Sine.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      g.fillStyle(emberColor, 0.35 * (1 - t));
      g.fillCircle(to.x, groundY, (whiff ? 10 : 30) * (1 - t));
      for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + (i - 2.5) * 0.35;
        const dist = t * spread;
        g.fillStyle(i % 2 === 0 ? 0xffffff : emberColor, (1 - t) * 0.75);
        g.fillCircle(to.x + Math.cos(ang) * dist, groundY - t * 26 + Math.sin(ang) * dist * 0.3, 2.5 * (1 - t * 0.6));
      }
    },
    onComplete: () => {
      g.destroy();
      onComplete();
    },
  });
}

// `ultimateMeteor` -- see the shared Ultimate-tier comment above for the
// phase/callback contract. Reads as a heavy mass falling from above and
// slamming the target, distinct from playNova's outward-building blast.
function playMeteor(
  scene: Phaser.Scene,
  color: number,
  to: Point,
  whiff: boolean,
  onImpact: () => void,
  onComplete: () => void
) {
  playMeteorSummon(scene, color, to, () => {
    playMeteorCharge(scene, color, to, () => {
      playMeteorImpact(scene, color, to, whiff, onImpact, () => {
        playMeteorAftermath(scene, color, to, whiff, onComplete);
      });
    });
  });
}

// Summon (`ultimateNova`): the same FF-style runic circle idea as
// playMeteorSummon, but centered on the target itself rather than
// ground-flattened -- two counter-rotating mandala rings (an octagon plus
// radiating spokes) building up around `to`, reading as a vertical mandala
// rather than a ground rune.
function playNovaSummon(scene: Phaser.Scene, color: number, to: Point, onDone: () => void) {
  const g = scene.add.graphics().setDepth(60).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: NOVA_SUMMON_MS,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const r = 8 + t * 52;
      g.clear();
      g.lineStyle(3, color, 0.3 + t * 0.5);
      g.strokeCircle(to.x, to.y, r);
      const rot1 = t * Math.PI * 1.6;
      g.lineStyle(2, 0xffffff, 0.2 + t * 0.5);
      g.beginPath();
      for (let i = 0; i <= 8; i++) {
        const ang = rot1 + (i / 8) * Math.PI * 2;
        const px = to.x + Math.cos(ang) * r * 0.75;
        const py = to.y + Math.sin(ang) * r * 0.75;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
      const rot2 = -t * Math.PI * 1.1;
      for (let i = 0; i < 10; i++) {
        const ang = rot2 + (i / 10) * Math.PI * 2;
        g.lineStyle(1.5, color, 0.2 + t * 0.4);
        g.lineBetween(
          to.x + Math.cos(ang) * r * 0.4,
          to.y + Math.sin(ang) * r * 0.4,
          to.x + Math.cos(ang) * r,
          to.y + Math.sin(ang) * r
        );
      }
    },
    onComplete: () => {
      g.destroy();
      onDone();
    },
  });
}

// Charge (`ultimateNova`): particles converging INWARD toward a brightening,
// pulsing core -- the inverse motion of playMeteorCharge's falling mass, so
// the two moves read as opposites (something arriving from outside vs.
// something collapsing inward before it blows back out) rather than variants
// of the same idea.
function playNovaCharge(scene: Phaser.Scene, color: number, to: Point, onDone: () => void) {
  const g = scene.add.graphics().setDepth(60).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: NOVA_CHARGE_MS,
    ease: 'Cubic.easeIn',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      const coreR = 6 + t * 20;
      g.clear();
      const n = 14;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + t * 6;
        const dist = (1 - t) * 70 + 10;
        g.fillStyle(i % 2 === 0 ? 0xffffff : color, 0.35 + t * 0.5);
        g.fillCircle(to.x + Math.cos(ang) * dist, to.y + Math.sin(ang) * dist, 3 + t * 2);
      }
      const pulse = 0.7 + 0.3 * Math.sin(t * 36);
      g.fillStyle(color, 0.45 + t * 0.4);
      g.fillCircle(to.x, to.y, coreR * pulse);
      g.fillStyle(0xffffff, 0.55 + t * 0.35);
      g.fillCircle(to.x, to.y, coreR * 0.5 * pulse);
      g.lineStyle(2 + t * 3, color, 0.25 + t * 0.5);
      g.strokeCircle(to.x, to.y, coreR * 2.4);
    },
    onComplete: () => {
      g.destroy();
      onDone();
    },
  });
}

// Impact (`ultimateNova`): calls `onImpact()` immediately, then either a full
// outward energy-nova blast (bright core flash, a double expanding ring, and
// radiating rays punching outward in every direction) or, on a whiff, a small
// desaturated core that just deflates without ever blowing outward.
function playNovaImpact(
  scene: Phaser.Scene,
  color: number,
  to: Point,
  whiff: boolean,
  onImpact: () => void,
  onDone: () => void
) {
  onImpact();
  const g = scene.add.graphics().setDepth(61).setBlendMode(Phaser.BlendModes.ADD);
  const drawColor = whiff ? 0x777777 : color;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: NOVA_IMPACT_MS,
    ease: whiff ? 'Sine.easeOut' : 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      if (whiff) {
        const r = Math.max(0, 26 * (1 - t));
        g.fillStyle(drawColor, 0.4 * (1 - t));
        g.fillCircle(to.x, to.y, r);
        g.lineStyle(2, 0x999999, 0.35 * (1 - t));
        g.strokeCircle(to.x, to.y, 14 * (1 - t));
        return;
      }
      g.fillStyle(0xffffff, 0.95 * (1 - t));
      g.fillCircle(to.x, to.y, 16 + t * 30);
      g.lineStyle(5, color, 0.85 * (1 - t));
      g.strokeCircle(to.x, to.y, 20 + t * 90);
      g.lineStyle(3, 0xffffff, 0.5 * (1 - t));
      g.strokeCircle(to.x, to.y, 10 + t * 60);
      const rays = 16;
      for (let i = 0; i < rays; i++) {
        const ang = (i / rays) * Math.PI * 2;
        const len = 24 + t * 80;
        g.lineStyle(3, color, 0.75 * (1 - t));
        g.lineBetween(to.x + Math.cos(ang) * 14, to.y + Math.sin(ang) * 14, to.x + Math.cos(ang) * len, to.y + Math.sin(ang) * len);
      }
    },
    onComplete: () => {
      g.destroy();
      onDone();
    },
  });
}

// Aftermath (`ultimateNova`): dissipating shards radiating outward from the
// center plus a fading core glow, ending by tearing down every Graphics
// object this phase created and firing `onComplete` exactly once.
function playNovaAftermath(scene: Phaser.Scene, color: number, to: Point, whiff: boolean, onComplete: () => void) {
  const g = scene.add.graphics().setDepth(58).setBlendMode(Phaser.BlendModes.ADD);
  const emberColor = whiff ? 0x888888 : color;
  const spread = whiff ? 16 : 50;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: NOVA_AFTERMATH_MS,
    ease: 'Sine.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      g.fillStyle(emberColor, 0.35 * (1 - t));
      g.fillCircle(to.x, to.y, (whiff ? 8 : 26) * (1 - t));
      const shards = 8;
      for (let i = 0; i < shards; i++) {
        const ang = (i / shards) * Math.PI * 2;
        const dist = t * spread;
        g.fillStyle(i % 2 === 0 ? 0xffffff : emberColor, (1 - t) * 0.75);
        g.fillCircle(to.x + Math.cos(ang) * dist, to.y + Math.sin(ang) * dist, 2.5 * (1 - t * 0.7));
      }
    },
    onComplete: () => {
      g.destroy();
      onComplete();
    },
  });
}

// `ultimateNova` -- see the shared Ultimate-tier comment above for the
// phase/callback contract. Reads as something collapsing inward then
// blowing back outward from the target's own position, distinct from
// playMeteor's mass falling in from above.
function playNova(
  scene: Phaser.Scene,
  color: number,
  to: Point,
  whiff: boolean,
  onImpact: () => void,
  onComplete: () => void
) {
  playNovaSummon(scene, color, to, () => {
    playNovaCharge(scene, color, to, () => {
      playNovaImpact(scene, color, to, whiff, onImpact, () => {
        playNovaAftermath(scene, color, to, whiff, onComplete);
      });
    });
  });
}

// A bright flash plus radiating shards on arrival, common to every move
// class -- fire-and-forget (destroys itself once decayed, doesn't gate
// onImpact) so it layers on top of whatever BattleScene does with the hit
// (HP bar update, flashHit squash, camera shake) without delaying any of it.
function playImpactShockwave(scene: Phaser.Scene, color: number, at: Point) {
  const g = scene.add.graphics().setDepth(61).setBlendMode(Phaser.BlendModes.ADD);
  const shards = 8;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: IMPACT_MS,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      g.clear();
      g.fillStyle(0xffffff, 0.55 * (1 - t));
      g.fillCircle(at.x, at.y, 6 + t * 12);
      g.lineStyle(3, color, 0.8 * (1 - t));
      g.strokeCircle(at.x, at.y, 10 + t * 40);
      for (let i = 0; i < shards; i++) {
        const ang = (i / shards) * Math.PI * 2;
        const r0 = 8 + t * 6;
        const r1 = 8 + t * 32;
        g.lineStyle(2, color, 0.7 * (1 - t));
        g.lineBetween(at.x + Math.cos(ang) * r0, at.y + Math.sin(ang) * r0, at.x + Math.cos(ang) * r1, at.y + Math.sin(ang) * r1);
      }
    },
    onComplete: () => g.destroy(),
  });
}
