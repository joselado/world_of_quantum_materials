// Procedural one-shot sound effects (Web Audio API, no external assets),
// mirroring music.ts's synthesis style. Shares its AudioContext/noise
// buffer/drive curve via music.getSfxBus() rather than opening a second
// context, so these effects land on the same output graph -- downstream of
// music.duck() and upstream of music.toggleMute().

import { music } from './music';

// Same silhouettes art/attackEffects.ts uses per move class -- bolt/ring/
// burst for the original seven classes, plus beam/eruption for Curie's
// analytic moves (a flashier, per-move rather than per-class pair: Skyfall
// Beam gets 'beam', Ground Eruption gets 'eruption').
export type AttackShape = 'bolt' | 'ring' | 'burst' | 'beam' | 'eruption';

// A fast upward-sweeping, high-passed sawtooth "zap" -- bolt moves (a
// focused shot: Phonon Beam, Electron Pulse, Spinon Swap).
function playBoltSfx(ctx: AudioContext, dest: GainNode, t: number) {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(1500, t + 0.14);

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 350;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

  osc.connect(filter);
  filter.connect(g);
  g.connect(dest);
  osc.start(t);
  osc.stop(t + 0.22);
}

// A bandpassed noise sweep plus a low sine "whomp" underneath -- ring moves
// (an expanding wave pulse: Magnon Pulse, Polaron Drag).
function playRingSfx(ctx: AudioContext, dest: GainNode, noiseBuffer: AudioBuffer, t: number) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(500, t);
  bandpass.frequency.exponentialRampToValueAtTime(2400, t + 0.3);
  bandpass.Q.value = 1.1;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.001, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.26, t + 0.05);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
  src.connect(bandpass);
  bandpass.connect(noiseGain);
  noiseGain.connect(dest);
  src.start(t);
  src.stop(t + 0.36);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(65, t + 0.3);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.001, t);
  og.gain.exponentialRampToValueAtTime(0.28, t + 0.03);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  osc.connect(og);
  og.connect(dest);
  osc.start(t);
  osc.stop(t + 0.34);
}

// A scatter of short bandpassed noise clicks at randomized pitches/offsets
// -- burst moves (particles converging/scattering: Anyon Braid, Majorana
// Split).
function playBurstSfx(ctx: AudioContext, dest: GainNode, noiseBuffer: AudioBuffer, t: number) {
  const hits = 6;
  for (let i = 0; i < hits; i++) {
    const st = t + (i / hits) * 0.22 + Math.random() * 0.03;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + Math.random() * 1400;
    bp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, st);
    g.gain.exponentialRampToValueAtTime(0.2, st + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, st + 0.09);
    src.connect(bp);
    bp.connect(g);
    g.connect(dest);
    src.start(st);
    src.stop(st + 0.1);
  }
}

// A descending high whistle (something falling from a height) plus a
// high-passed noise trail -- Skyfall Beam.
function playBeamSfx(ctx: AudioContext, dest: GainNode, noiseBuffer: AudioBuffer, t: number) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(2200, t);
  osc.frequency.exponentialRampToValueAtTime(300, t + 0.32);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(0.24, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
  osc.connect(g);
  g.connect(dest);
  osc.start(t);
  osc.stop(t + 0.36);

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1200;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.001, t);
  ng.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  src.connect(hp);
  hp.connect(ng);
  ng.connect(dest);
  src.start(t);
  src.stop(t + 0.32);
}

// A rising, low-passed rumble (the ground itself building up) followed by a
// scatter of noise cracks (shards bursting up out of it) -- Ground Eruption.
function playEruptionSfx(ctx: AudioContext, dest: GainNode, noiseBuffer: AudioBuffer, t: number) {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(50, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.28);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
  osc.connect(filter);
  filter.connect(g);
  g.connect(dest);
  osc.start(t);
  osc.stop(t + 0.36);

  const hits = 5;
  for (let i = 0; i < hits; i++) {
    const st = t + 0.18 + (i / hits) * 0.16 + Math.random() * 0.02;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700 + Math.random() * 1200;
    bp.Q.value = 2.5;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.001, st);
    ng.gain.exponentialRampToValueAtTime(0.22, st + 0.01);
    ng.gain.exponentialRampToValueAtTime(0.001, st + 0.1);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(dest);
    src.start(st);
    src.stop(st + 0.11);
  }
}

export function playAttackSfx(shape: AttackShape) {
  const { ctx, dest, noiseBuffer } = music.getSfxBus();
  const t = ctx.currentTime;
  if (shape === 'ring') playRingSfx(ctx, dest, noiseBuffer, t);
  else if (shape === 'burst') playBurstSfx(ctx, dest, noiseBuffer, t);
  else if (shape === 'beam') playBeamSfx(ctx, dest, noiseBuffer, t);
  else if (shape === 'eruption') playEruptionSfx(ctx, dest, noiseBuffer, t);
  else playBoltSfx(ctx, dest, t);
}

// A punchy pitch-dropping thump plus a short high-passed noise crack, on
// arrival -- scaled by the hit's relative power so a big move lands heavier
// than a weak one. `power` is the move's damage relative to a "typical" hit
// (1 = average).
export function playImpactSfx(power = 1) {
  const { ctx, dest, noiseBuffer } = music.getSfxBus();
  const t = ctx.currentTime;
  const p = Math.min(1.6, Math.max(0.6, power));

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150 * p, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.16);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.001, t);
  og.gain.exponentialRampToValueAtTime(0.5 * p, t + 0.008);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc.connect(og);
  og.connect(dest);
  osc.start(t);
  osc.stop(t + 0.22);

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 900;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.001, t);
  ng.gain.exponentialRampToValueAtTime(0.3 * p, t + 0.005);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  src.connect(hp);
  hp.connect(ng);
  ng.connect(dest);
  src.start(t);
  src.stop(t + 0.12);
}

// A warm layered bell (three detuned sines decaying at slightly different
// rates) for a guardian's shop/panel opening -- a small "divine" flourish to
// go with their floating, god-like avatars (Noether, Bloch, Bohr, ...).
export function playGuardianChime() {
  const { ctx, dest } = music.getSfxBus();
  const t = ctx.currentTime;
  const partials = [660, 990, 1320];
  partials.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    const start = t + i * 0.07;
    g.gain.setValueAtTime(0.001, start);
    g.gain.exponentialRampToValueAtTime(0.22 / (i + 1), start + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, start + 1.1);
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(start + 1.15);
  });
}
