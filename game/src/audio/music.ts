// Small procedural chiptune player -- no external audio assets, just
// oscillators/noise scheduled through the Web Audio API. Two looping scores:
// a relaxed major-key overworld theme (Pokemon-style town/route music) and a
// driving minor-key battle theme (Golden Sun-style boss riff).

type Wave = OscillatorType;

interface ToneNote {
  midi: number | null; // null = rest
  beats: number;
}

interface ToneTrack {
  kind: 'tone';
  wave: Wave;
  gain: number;
  notes: ToneNote[];
  unison?: boolean; // two detuned voices instead of one, for a bigger/wider "brass" sound
  drive?: boolean; // route through a soft-clip waveshaper for grit
}

interface PercNote {
  hit: boolean;
  beats: number;
}

interface PercTrack {
  kind: 'kick' | 'snare' | 'hat' | 'crash';
  gain: number;
  notes: PercNote[];
}

type Track = ToneTrack | PercTrack;

interface Score {
  bpm: number;
  loopBeats: number;
  tracks: Track[];
}

const NOTE_INDEX: Record<string, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
};

// e.g. n('A4') -> 69 (MIDI note number, standard A440 tuning)
function n(name: string): number {
  const match = /^([A-G]#?)(\d)$/.exec(name);
  if (!match) throw new Error(`bad note name: ${name}`);
  const [, pitch, octave] = match;
  return NOTE_INDEX[pitch] + (parseInt(octave, 10) + 1) * 12;
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// A held root note plus its octave -- the arpeggiated-bass shape used under
// every bar of the overworld theme.
function padBassBar(rootName: string): ToneNote[] {
  const r = n(rootName);
  return [
    { midi: r, beats: 2 },
    { midi: r + 12, beats: 1 },
    { midi: r, beats: 1 },
  ];
}

// A whole note on the chord's fifth (rootName given at the pad's own
// octave) -- a soft sustained upper voice under the lead.
function padFifthBar(rootName: string): ToneNote[] {
  return [{ midi: n(rootName) + 7, beats: 4 }];
}

// Gentle I-V-vi-IV verse, a ii-V-I-vi bridge for contrast, then the verse
// again -- three 4-bar sections (12 bars/48 beats, ~27s at 108bpm) so the
// loop point is far enough apart to not read as a short repeating jingle.
// Warm triad pad, arpeggiated bass, and a skipping stepwise lead, aiming for
// an unhurried Pokemon-route feel.
const OVERWORLD_BASS_ROOTS = ['C3', 'G2', 'A2', 'F2', 'D3', 'G2', 'C3', 'A2', 'C3', 'G2', 'A2', 'F2'];
const OVERWORLD_PAD_ROOTS = ['C3', 'G3', 'A3', 'F3', 'D3', 'G3', 'C3', 'A3', 'C3', 'G3', 'A3', 'F3'];

// Verse (I-V-vi-IV): bars 1-4, reused as bars 9-12 to close the loop.
const OVERWORLD_VERSE_MELODY: ToneNote[] = [
  { midi: n('E4'), beats: 0.5 }, { midi: n('G4'), beats: 0.5 }, { midi: n('A4'), beats: 1 },
  { midi: n('G4'), beats: 0.5 }, { midi: n('E4'), beats: 0.5 }, { midi: n('D4'), beats: 1 },

  { midi: n('D4'), beats: 0.5 }, { midi: n('E4'), beats: 0.5 }, { midi: n('F4'), beats: 1 },
  { midi: n('D4'), beats: 0.5 }, { midi: n('B3'), beats: 0.5 }, { midi: n('C4'), beats: 1 },

  { midi: n('E4'), beats: 0.5 }, { midi: n('G4'), beats: 0.5 }, { midi: n('A4'), beats: 1 },
  { midi: n('G4'), beats: 0.5 }, { midi: n('E4'), beats: 0.5 }, { midi: n('C4'), beats: 1 },

  { midi: n('F4'), beats: 0.5 }, { midi: n('A4'), beats: 0.5 }, { midi: n('G4'), beats: 1 },
  { midi: n('F4'), beats: 0.5 }, { midi: n('D4'), beats: 0.5 }, { midi: n('C4'), beats: 1 },
];

// Bridge (ii-V-I-vi): bars 5-8, a higher, more skipping contrast section.
const OVERWORLD_BRIDGE_MELODY: ToneNote[] = [
  { midi: n('A4'), beats: 0.5 }, { midi: n('F4'), beats: 0.5 }, { midi: n('D4'), beats: 1 },
  { midi: n('F4'), beats: 0.5 }, { midi: n('A4'), beats: 0.5 }, { midi: n('C5'), beats: 1 },

  { midi: n('B4'), beats: 0.5 }, { midi: n('G4'), beats: 0.5 }, { midi: n('D4'), beats: 1 },
  { midi: n('G4'), beats: 0.5 }, { midi: n('B4'), beats: 0.5 }, { midi: n('D5'), beats: 1 },

  { midi: n('C5'), beats: 0.5 }, { midi: n('A4'), beats: 0.5 }, { midi: n('G4'), beats: 1 },
  { midi: n('E4'), beats: 0.5 }, { midi: n('G4'), beats: 0.5 }, { midi: n('C5'), beats: 1 },

  { midi: n('E5'), beats: 0.5 }, { midi: n('C5'), beats: 0.5 }, { midi: n('A4'), beats: 1 },
  { midi: n('C5'), beats: 0.5 }, { midi: n('E5'), beats: 0.5 }, { midi: n('A4'), beats: 1 },
];

const OVERWORLD_SCORE: Score = {
  bpm: 108,
  loopBeats: OVERWORLD_BASS_ROOTS.length * 4,
  tracks: [
    { kind: 'tone', wave: 'triangle', gain: 0.16, notes: OVERWORLD_BASS_ROOTS.flatMap(padBassBar) },
    { kind: 'tone', wave: 'sine', gain: 0.07, notes: OVERWORLD_PAD_ROOTS.flatMap(padFifthBar) },
    {
      kind: 'tone',
      wave: 'sine',
      gain: 0.2,
      notes: [...OVERWORLD_VERSE_MELODY, ...OVERWORLD_BRIDGE_MELODY, ...OVERWORLD_VERSE_MELODY],
    },
  ],
};

// A "root,root,3rd,5th" x2 eighth-note vamp -- the driving ostinato shape
// used for every bar of the battle bassline.
function vampBar(rootName: string, quality: 'maj' | 'min'): ToneNote[] {
  const root = n(rootName);
  const third = root + (quality === 'maj' ? 4 : 3);
  const fifth = root + 7;
  return [
    { midi: root, beats: 0.5 }, { midi: root, beats: 0.5 }, { midi: third, beats: 0.5 }, { midi: fifth, beats: 0.5 },
    { midi: root, beats: 0.5 }, { midi: root, beats: 0.5 }, { midi: third, beats: 0.5 }, { midi: fifth, beats: 0.5 },
  ];
}

// A "root-third-fifth, rest, fifth-octave" stab, two octaves above the bass
// root -- the punchy call-and-response lead over the battle vamp.
function stabBar(rootName: string, quality: 'maj' | 'min'): ToneNote[] {
  const root = n(rootName) + 24;
  const third = root + (quality === 'maj' ? 4 : 3);
  const fifth = root + 7;
  return [
    { midi: root, beats: 0.5 }, { midi: third, beats: 0.5 }, { midi: fifth, beats: 1 },
    { midi: null, beats: 0.5 }, { midi: fifth, beats: 0.5 }, { midi: root + 12, beats: 1 },
  ];
}

// The same shape as stabBar but one octave down -- doubles the lead an
// octave below itself, the classic orchestration trick for turning a single
// synth line into a "brass section" stack.
function stabBarLow(rootName: string, quality: 'maj' | 'min'): ToneNote[] {
  const root = n(rootName) + 12;
  const third = root + (quality === 'maj' ? 4 : 3);
  const fifth = root + 7;
  return [
    { midi: root, beats: 0.5 }, { midi: third, beats: 0.5 }, { midi: fifth, beats: 1 },
    { midi: null, beats: 0.5 }, { midi: fifth, beats: 0.5 }, { midi: root + 12, beats: 1 },
  ];
}

// A sustained whole note an octave below the vamp's own root -- felt more
// than heard, for low-end weight under everything else.
function subBassBar(rootName: string): ToneNote[] {
  return [{ midi: n(rootName) - 12, beats: 4 }];
}

function kickPulse(bars: number): PercNote[] {
  return Array.from({ length: bars * 4 }, (_, i) => ({ hit: i % 2 === 0, beats: 1 }));
}

// Backbeat on 2 and 4, alongside the kick on 1 and 3 -- turns the vamp into
// a driving march rather than a flat eighth-note pulse.
function snarePulse(bars: number): PercNote[] {
  return Array.from({ length: bars * 4 }, (_, i) => ({ hit: i % 2 === 1, beats: 1 }));
}

function hatPulse(bars: number): PercNote[] {
  return Array.from({ length: bars * 8 }, (_, i) => ({ hit: i % 2 === 1, beats: 0.5 }));
}

function octaveDown(notes: ToneNote[]): ToneNote[] {
  return notes.map((note) => (note.midi === null ? note : { midi: note.midi - 12, beats: note.beats }));
}

// Runs `gen` over a chord progression bar-by-bar, except for any bar index
// present in `overrides`, which plays that fixed lick instead -- used to
// drop a melodic transition lick into a section's last bar without
// disturbing the rest of its generated shape.
function sectionBars(
  chords: [string, 'maj' | 'min'][],
  gen: (root: string, quality: 'maj' | 'min') => ToneNote[],
  overrides: Record<number, ToneNote[]> = {}
): ToneNote[] {
  return chords.flatMap(([root, quality], i) => overrides[i] ?? gen(root, quality));
}

// A (i-VII vamp, then a brighter bVI-bVII lift) and B (a longer i-bVI-bIII-
// bVII riff a fourth up, in G minor) are the same length family and keep
// the full band playing throughout -- same instrumentation, same driving
// energy -- so B reads as a genuine second riff in A's spirit rather than a
// hushed breakdown. bpm 160, 20 bars/80 beats (~30s) total.
const BATTLE_MAIN_A: [string, 'maj' | 'min'][] = [
  ['D2', 'min'], ['C2', 'maj'], ['D2', 'min'], ['C2', 'maj'],
];
const BATTLE_MAIN_B: [string, 'maj' | 'min'][] = [
  ['A#2', 'maj'], ['C2', 'maj'], ['A#2', 'maj'], ['C2', 'maj'],
];
const BATTLE_A_PROGRESSION = [...BATTLE_MAIN_A, ...BATTLE_MAIN_B];

const BATTLE_B_PROGRESSION: [string, 'maj' | 'min'][] = [
  ['G2', 'min'], ['D#2', 'maj'], ['A#2', 'maj'], ['F2', 'maj'],
  ['G2', 'min'], ['D#2', 'maj'], ['A#2', 'maj'], ['F2', 'maj'],
];

const BATTLE_REPRISE = BATTLE_MAIN_A;

const BATTLE_FULL_PROGRESSION = [...BATTLE_A_PROGRESSION, ...BATTLE_B_PROGRESSION, ...BATTLE_REPRISE];
const BATTLE_LOOP_BEATS = BATTLE_FULL_PROGRESSION.length * 4;

// Melodic pivots that replace the lead's last bar of A and of B -- a real
// bridge into the next section's key instead of a hard cut into silence.
const BATTLE_TO_B_TRANSITION: ToneNote[] = [
  { midi: n('C5'), beats: 1 }, { midi: n('B4'), beats: 1 }, { midi: n('A4'), beats: 1 }, { midi: n('G4'), beats: 1 },
];
const BATTLE_TO_A_TRANSITION: ToneNote[] = [
  { midi: n('G4'), beats: 1 }, { midi: n('A4'), beats: 1 }, { midi: n('C5'), beats: 1 }, { midi: n('D5'), beats: 1 },
];

// A quick rising fanfare flourish that fires once at the top of the loop --
// the "call to battle" sting classic Final Fantasy-style battle themes open
// on -- then stays silent through the rest of the progression.
const BATTLE_INTRO_STING: ToneNote[] = [
  { midi: n('D4'), beats: 0.25 }, { midi: n('F4'), beats: 0.25 }, { midi: n('A4'), beats: 0.25 }, { midi: n('D5'), beats: 0.25 },
  { midi: n('A4'), beats: 0.5 }, { midi: n('D5'), beats: 0.5 },
  { midi: null, beats: BATTLE_LOOP_BEATS - 2 },
];

// Square-wave ostinato with grit, a sub-bass double running straight
// through, a unison-detuned + octave-doubled sawtooth "brass" lead (with a
// melodic pivot bridging A into B and B back into A), a kick/snare march
// and hats that never drop out, and an opening crash + fanfare sting plus a
// second crash marking the reprise -- a fuller, Final Fantasy-style battle
// theme where B is a proper second riff, connected by real voice-leading
// rather than a silence-and-crash cut.
const BATTLE_SCORE: Score = {
  bpm: 160,
  loopBeats: BATTLE_LOOP_BEATS,
  tracks: [
    { kind: 'tone', wave: 'square', gain: 0.13, drive: true, notes: BATTLE_FULL_PROGRESSION.flatMap(([r, q]) => vampBar(r, q)) },
    {
      kind: 'tone',
      wave: 'sine',
      gain: 0.11,
      notes: BATTLE_FULL_PROGRESSION.flatMap(([root]) => subBassBar(root)),
    },
    {
      kind: 'tone',
      wave: 'sawtooth',
      gain: 0.15,
      unison: true,
      drive: true,
      notes: [
        ...sectionBars(BATTLE_A_PROGRESSION, stabBar, { [BATTLE_A_PROGRESSION.length - 1]: BATTLE_TO_B_TRANSITION }),
        ...sectionBars(BATTLE_B_PROGRESSION, stabBar, { [BATTLE_B_PROGRESSION.length - 1]: BATTLE_TO_A_TRANSITION }),
        ...BATTLE_REPRISE.flatMap(([r, q]) => stabBar(r, q)),
      ],
    },
    {
      kind: 'tone',
      wave: 'sawtooth',
      gain: 0.08,
      drive: true,
      notes: [
        ...sectionBars(BATTLE_A_PROGRESSION, stabBarLow, {
          [BATTLE_A_PROGRESSION.length - 1]: octaveDown(BATTLE_TO_B_TRANSITION),
        }),
        ...sectionBars(BATTLE_B_PROGRESSION, stabBarLow, {
          [BATTLE_B_PROGRESSION.length - 1]: octaveDown(BATTLE_TO_A_TRANSITION),
        }),
        ...BATTLE_REPRISE.flatMap(([r, q]) => stabBarLow(r, q)),
      ],
    },
    { kind: 'tone', wave: 'sawtooth', gain: 0.18, drive: true, notes: BATTLE_INTRO_STING },
    { kind: 'kick', gain: 0.9, notes: kickPulse(BATTLE_FULL_PROGRESSION.length) },
    { kind: 'snare', gain: 0.5, notes: snarePulse(BATTLE_FULL_PROGRESSION.length) },
    { kind: 'hat', gain: 0.22, notes: hatPulse(BATTLE_FULL_PROGRESSION.length) },
    {
      kind: 'crash',
      gain: 0.32,
      notes: [
        { hit: true, beats: 4 },
        { hit: false, beats: (BATTLE_A_PROGRESSION.length + BATTLE_B_PROGRESSION.length) * 4 - 4 },
        { hit: true, beats: 4 },
        { hit: false, beats: BATTLE_REPRISE.length * 4 - 4 },
      ],
    },
  ],
};

const SCORES: Record<'overworld' | 'battle', Score> = {
  overworld: OVERWORLD_SCORE,
  battle: BATTLE_SCORE,
};

// Fades between the previous track's session gain and a new one instead of
// hard-cutting, so a long pad note doesn't ring on top of the next scene's
// track and switching tracks never clicks.
class MusicEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private driveCurve: Float32Array<ArrayBuffer> | null = null;
  private activeGain: GainNode | null = null;
  private current: 'overworld' | 'battle' | null = null;
  private stopToken = 0;
  private timer: number | null = null;
  private muted = false;

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      // A gentle bus compressor so the busier battle mix (several layers
      // stacking on the downbeat) stays punchy without clipping.
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;
      this.master.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  // A mild tanh soft-clip curve -- used to give square/sawtooth voices a
  // gritty, driven edge instead of a clean synth tone.
  private getDriveCurve(): Float32Array<ArrayBuffer> {
    if (!this.driveCurve) {
      const size = 256;
      const curve = new Float32Array(size);
      const amount = 3;
      for (let i = 0; i < size; i++) {
        const x = (i / (size - 1)) * 2 - 1;
        curve[i] = Math.tanh(amount * x) / Math.tanh(amount);
      }
      this.driveCurve = curve;
    }
    return this.driveCurve;
  }

  play(which: 'overworld' | 'battle') {
    if (this.current === which) return;
    const ctx = this.ensureCtx();
    const now = ctx.currentTime;

    if (this.activeGain) {
      const prevGain = this.activeGain;
      prevGain.gain.cancelScheduledValues(now);
      prevGain.gain.setValueAtTime(prevGain.gain.value, now);
      prevGain.gain.linearRampToValueAtTime(0, now + 0.15);
    }

    const sessionGain = ctx.createGain();
    sessionGain.gain.value = 0;
    sessionGain.connect(this.master!);
    sessionGain.gain.linearRampToValueAtTime(1, now + 0.15);
    this.activeGain = sessionGain;
    this.current = which;

    const score = SCORES[which];
    const secPerBeat = 60 / score.bpm;
    const loopMs = score.loopBeats * secPerBeat * 1000;
    const token = ++this.stopToken;

    const scheduleLoop = () => {
      if (token !== this.stopToken) return;
      const startAt = ctx.currentTime + 0.05;
      for (const track of score.tracks) {
        this.scheduleTrack(ctx, track, startAt, secPerBeat, sessionGain);
      }
      this.timer = window.setTimeout(scheduleLoop, loopMs);
    };
    scheduleLoop();
  }

  stop() {
    this.stopToken++;
    this.current = null;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.activeGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.activeGain.gain.cancelScheduledValues(now);
      this.activeGain.gain.setValueAtTime(this.activeGain.gain.value, now);
      this.activeGain.gain.linearRampToValueAtTime(0, now + 0.15);
      this.activeGain = null;
    }
  }

  resume() {
    this.ctx?.resume();
  }

  // Dips the currently-playing track's volume (not the master bus, so it
  // stacks correctly under toggleMute) and brings it back up, so the score
  // visibly "gets out of the way" while an attack effect's sound plays.
  // Re-entrant: cancels any duck already in flight and reschedules the full
  // envelope from the current value, so back-to-back attacks (player then
  // opponent, ~700ms apart) each land cleanly instead of one's restore
  // stomping the next duck.
  duck(ms: number, depth = 0.35) {
    if (!this.activeGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    const gain = this.activeGain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(depth, now + 0.08);
    gain.setValueAtTime(depth, now + ms / 1000 - 0.12);
    gain.linearRampToValueAtTime(1, now + ms / 1000);
  }

  // Shared context/bus for one-shot sound effects (sfx.ts) -- downstream of
  // duck() (so an effect's own sound isn't swallowed by its own duck) and
  // upstream of toggleMute() (so muting silences sfx too). Also hands back
  // the same cached noise buffer/drive curve the music tracks use, so sfx
  // doesn't need its own copies.
  getSfxBus(): {
    ctx: AudioContext;
    dest: GainNode;
    noiseBuffer: AudioBuffer;
    driveCurve: Float32Array<ArrayBuffer>;
  } {
    const ctx = this.ensureCtx();
    return { ctx, dest: this.master!, noiseBuffer: this.getNoiseBuffer(ctx), driveCurve: this.getDriveCurve() };
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) {
      const ctx = this.ensureCtx();
      const now = ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 1, now + 0.08);
    }
    return this.muted;
  }

  private scheduleTrack(ctx: AudioContext, track: Track, startAt: number, secPerBeat: number, dest: GainNode) {
    let t = startAt;
    if (track.kind === 'tone') {
      for (const note of track.notes) {
        const dur = note.beats * secPerBeat;
        if (note.midi !== null) {
          if (track.unison) {
            this.scheduleTone(ctx, track.wave, track.gain * 0.6, note.midi, t, dur, dest, -7, !!track.drive);
            this.scheduleTone(ctx, track.wave, track.gain * 0.6, note.midi, t, dur, dest, 7, !!track.drive);
          } else {
            this.scheduleTone(ctx, track.wave, track.gain, note.midi, t, dur, dest, 0, !!track.drive);
          }
        }
        t += dur;
      }
    } else if (track.kind === 'kick') {
      for (const note of track.notes) {
        const dur = note.beats * secPerBeat;
        if (note.hit) this.scheduleKick(ctx, track.gain, t, dest);
        t += dur;
      }
    } else if (track.kind === 'snare') {
      for (const note of track.notes) {
        const dur = note.beats * secPerBeat;
        if (note.hit) this.scheduleSnare(ctx, track.gain, t, dest);
        t += dur;
      }
    } else if (track.kind === 'crash') {
      for (const note of track.notes) {
        const dur = note.beats * secPerBeat;
        if (note.hit) this.scheduleCrash(ctx, track.gain, t, dest);
        t += dur;
      }
    } else {
      for (const note of track.notes) {
        const dur = note.beats * secPerBeat;
        if (note.hit) this.scheduleHat(ctx, track.gain, t, dest);
        t += dur;
      }
    }
  }

  private scheduleTone(
    ctx: AudioContext,
    wave: Wave,
    vol: number,
    midi: number,
    time: number,
    dur: number,
    dest: GainNode,
    detuneCents: number,
    drive: boolean
  ) {
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = midiToFreq(midi);
    osc.detune.value = detuneCents;

    const g = ctx.createGain();
    const attack = Math.min(0.02, dur * 0.3);
    const release = Math.min(0.05, dur * 0.3);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + attack);
    g.gain.setValueAtTime(vol, Math.max(time + attack, time + dur - release));
    g.gain.linearRampToValueAtTime(0, time + dur);

    osc.connect(g);
    if (drive) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = this.getDriveCurve();
      shaper.oversample = '2x';
      g.connect(shaper);
      shaper.connect(dest);
    } else {
      g.connect(dest);
    }
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private scheduleKick(ctx: AudioContext, vol: number, time: number, dest: GainNode) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    osc.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + 0.25);
  }

  // Bandpassed noise crack plus a short triangle "body" thump underneath,
  // for a punchier snare hit than the hat's plain noise burst.
  private scheduleSnare(ctx: AudioContext, vol: number, time: number, dest: GainNode) {
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1800;
    bandpass.Q.value = 0.8;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    src.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(dest);
    src.start(time);
    src.stop(time + 0.13);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, time);
    osc.frequency.exponentialRampToValueAtTime(120, time + 0.08);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(vol * 0.6, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.12);
  }

  private scheduleHat(ctx: AudioContext, vol: number, time: number, dest: GainNode) {
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(time);
    src.stop(time + 0.06);
  }

  // A bright, slowly-decaying noise wash -- a cymbal crash for dramatic
  // punctuation at the top of the battle loop.
  private scheduleCrash(ctx: AudioContext, vol: number, time: number, dest: GainNode) {
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 3000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 1.4);
    src.connect(highpass);
    highpass.connect(g);
    g.connect(dest);
    src.start(time);
    src.stop(time + 1.5);
  }
}

export const music = new MusicEngine();

// Browsers create AudioContext in a 'suspended' state until a user gesture;
// play() is called from Scene.create() (page load, before any gesture), so
// resume() there is a no-op. Retry on the first keypress/click anywhere.
window.addEventListener('keydown', () => music.resume(), { once: true });
window.addEventListener('pointerdown', () => music.resume(), { once: true });
