// Small procedural music player -- no external audio assets, just
// oscillators/noise scheduled through the Web Audio API. Both the overworld
// and battle scenes get one looping score per world, all 20 built from the
// same handful of chord/pattern generators below.
//
// The ten overworld scores are one arc, not ten moods. dev_notes/WORLDS.md's
// light rule has the sequence darkening from morning to no-sky-at-all as
// coherence is lost, so the music darkens with it, and its structure is that
// rule's structure: Worlds 1-6 all sit on a C tonic while the *mode* drains
// (Ionian, Lydian, Mixolydian, Aeolian, Phrygian), so it is one light going
// out rather than six unrelated keys; World 6 returns to World 1's own key
// as the false calm; and World 7 moves a tritone to F# and stays there,
// because after World 7 the sun does not come back. That tritone is planted
// twice before it takes over -- as World 2's raised fourth and World 6's
// aurora drone -- and C returns inside it as World 10's raised fourth, the
// dead sun seen in the mirror. See the per-world comments below.
//
// The battle scores deliberately do *not* follow that arc: they stay bright,
// fast and driving in every world, because a fight is the player's own
// coherence pushing back against a world losing its own.
//
// A second arrangement
// reuses each world's own key/tempo through its own pair of generators
// instead of retuning anything: "Modern" (SCORES_MODERN) is an ambient
// orchestral-pad style -- sustained extended-chord string pads, a melodic
// phrase generator that spans whole sections instead of repeating a single
// bar, and a thirds-below harmony voice, with no percussion at all.
// MusicEngine.setStyle() picks which table play() reads from; the Settings
// panel is the player-facing toggle, backed by data/settings.ts's
// MUSIC_STYLE_PRESETS.

import type { MusicStyle } from '../data/settings';

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
  unisonSpread?: number; // detune cents for the unison pair; defaults to 7
  drive?: boolean; // route through a soft-clip waveshaper for grit
  attack?: number; // seconds; overrides the default fast min(0.02, dur*0.3) attack for a slow string-pad swell
  release?: number; // seconds; overrides the default fast min(0.05, dur*0.3) release
  wet?: number; // 0-1, portion of this voice sent to the session's ambience/delay bus (see createAmbienceBus)
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

// The pad alternates between the fifth above the root and the fifth below
// it, bar by bar: two voicings of the same chord, equally correct, the world
// settling into one or the other. World 1's map splits into the two
// degenerate symmetry-broken ground states, and this is that in the harmony.
function padAlternatingFifthBar(rootName: string, bar: number): ToneNote[] {
  return [{ midi: n(rootName) + (bar % 2 === 0 ? 7 : -5), beats: 4 }];
}

const OVERWORLD_SCORE: Score = {
  bpm: 96,
  loopBeats: OVERWORLD_BASS_ROOTS.length * 4,
  tracks: [
    { kind: 'tone', wave: 'triangle', gain: 0.16, notes: OVERWORLD_BASS_ROOTS.flatMap(padBassBar) },
    {
      kind: 'tone',
      wave: 'sine',
      gain: 0.075,
      attack: 0.6,
      release: 1.2,
      notes: OVERWORLD_PAD_ROOTS.flatMap(padAlternatingFifthBar),
    },
    {
      kind: 'tone',
      wave: 'sine',
      gain: 0.2,
      notes: [...OVERWORLD_VERSE_MELODY, ...OVERWORLD_BRIDGE_MELODY, ...OVERWORLD_VERSE_MELODY],
    },
  ],
};

// --- Worlds 2-10's overworld themes -----------------------------------
//
// World 1 keeps its own hand-written OVERWORLD_SCORE above untouched. Worlds
// 2-10 are built from a small shape-based melody generator instead of
// hand-placing every note a second time -- the same spirit as vampBar/
// stabBar above (derive a bar's notes from a chord root+quality), just with
// a choice of melodic contour ("shape") so different worlds still sound
// distinct rather than sharing one generated line. Each world gets its own
// key/mode, tempo, chord progression, shape sequence, and lead timbre to
// match its biome's mood (see DESIGN.md §2's biome column).

type MelodyShape =
  | 'skipUp'
  | 'skipDown'
  | 'arpUpDown'
  | 'arch'
  | 'zigzag'
  | 'sparse'
  | 'glitch'
  | 'cellsA'
  | 'cellsB'
  | 'race'
  | 'lilt'
  | 'liltUp'
  | 'still'
  | 'stillRest';

// One bar (always 4 beats) of melody derived purely from a chord's root +
// quality, the same "no per-note hand authoring" idea as vampBar/stabBar --
// `shape` picks which chord tones it visits and in what order/rhythm.
function melodyBar(rootName: string, quality: 'maj' | 'min', shape: MelodyShape, octave = 12): ToneNote[] {
  const root = n(rootName) + octave;
  const third = root + (quality === 'maj' ? 4 : 3);
  const fifth = root + 7;
  const sixth = root + (quality === 'maj' ? 9 : 8);
  const second = root + 2;
  const seventh = root + (quality === 'maj' ? 11 : 10);
  const fourth = root + 5;
  const sharpFourth = root + 6;

  switch (shape) {
    case 'skipUp':
      return [
        { midi: third, beats: 0.5 }, { midi: fifth, beats: 0.5 }, { midi: sixth, beats: 1 },
        { midi: fifth, beats: 0.5 }, { midi: third, beats: 0.5 }, { midi: second, beats: 1 },
      ];
    case 'skipDown':
      return [
        { midi: sixth, beats: 0.5 }, { midi: fifth, beats: 0.5 }, { midi: third, beats: 1 },
        { midi: root, beats: 0.5 }, { midi: second, beats: 0.5 }, { midi: root, beats: 1 },
      ];
    case 'arpUpDown':
      return [
        { midi: root, beats: 0.5 }, { midi: third, beats: 0.5 }, { midi: fifth, beats: 1 },
        { midi: third, beats: 0.5 }, { midi: root, beats: 0.5 }, { midi: root - 12, beats: 1 },
      ];
    case 'arch':
      return [
        { midi: fifth, beats: 0.5 }, { midi: seventh, beats: 0.5 }, { midi: root + 12, beats: 1 },
        { midi: seventh, beats: 0.5 }, { midi: fifth, beats: 0.5 }, { midi: third, beats: 1 },
      ];
    case 'zigzag':
      return [
        { midi: root, beats: 0.5 }, { midi: fifth, beats: 0.5 }, { midi: third, beats: 0.5 }, { midi: sixth, beats: 0.5 },
        { midi: second, beats: 1 }, { midi: root, beats: 1 },
      ];
    case 'sparse':
      // Long held tones with real silence between them -- a cold, unhurried
      // line for a "drone" world rather than a running melody.
      return [
        { midi: root, beats: 2 }, { midi: null, beats: 1 }, { midi: fifth, beats: 1 },
      ];
    case 'glitch':
      // Irregular subdivisions and mid-bar rests -- a line that stumbles
      // rather than runs, for a world whose whole terrain is glitching.
      return [
        { midi: root, beats: 0.25 }, { midi: null, beats: 0.25 }, { midi: third, beats: 0.5 },
        { midi: fifth, beats: 0.25 }, { midi: null, beats: 0.25 }, { midi: root + 12, beats: 0.5 },
        { midi: sixth, beats: 0.5 }, { midi: null, beats: 0.5 }, { midi: third, beats: 1 },
      ];
    case 'cellsA':
    case 'cellsB':
      // Two short fixed motifs that alternate bar by bar instead of one
      // contour repeating -- a built, periodic tune for a built, periodic
      // world, with the raised fourth in cell A carrying the Lydian colour.
      return shape === 'cellsA'
        ? [
            { midi: third, beats: 1 }, { midi: fifth, beats: 1 },
            { midi: sharpFourth, beats: 1 }, { midi: third, beats: 1 },
          ]
        : [
            { midi: root, beats: 1 }, { midi: third, beats: 1 },
            { midi: fifth, beats: 0.5 }, { midi: third, beats: 0.5 }, { midi: root, beats: 1 },
          ];
    case 'race':
      // Eight unbroken eighth-notes, stepwise and never resting -- wind
      // moving fast over ground that cannot move at all.
      return [
        { midi: root, beats: 0.5 }, { midi: second, beats: 0.5 }, { midi: third, beats: 0.5 }, { midi: fifth, beats: 0.5 },
        { midi: sixth, beats: 0.5 }, { midi: fifth, beats: 0.5 }, { midi: third, beats: 0.5 }, { midi: second, beats: 0.5 },
      ];
    case 'lilt':
      // A 3+3+2 swing across the bar -- the ground's own ripple, pleasant
      // enough to relax into.
      return [
        { midi: third, beats: 1.5 }, { midi: second, beats: 1.5 }, { midi: root, beats: 1 },
      ];
    case 'liltUp':
      return [
        { midi: fifth, beats: 1.5 }, { midi: fourth, beats: 1.5 }, { midi: third, beats: 1 },
      ];
    case 'still':
      // One held tone per bar, on the bare fifth so a phrase can end without
      // ever arriving on the tonic, and 'stillRest' gives back whole bars of
      // real silence. Cold and unresolved rather than merely slow.
      return [{ midi: fifth, beats: 4 }];
    case 'stillRest':
      return [{ midi: null, beats: 4 }];
  }
}

// Rotates a looping voice later in time by `beats`: the tail that falls off
// the end wraps around to the front. A canon built this way keeps the
// score's exact loopBeats and still lines up correctly across the loop seam,
// which a leading rest plus a truncated tail would not.
function rotateNotes(notes: ToneNote[], beats: number): ToneNote[] {
  const total = notes.reduce((sum, note) => sum + note.beats, 0);
  const shift = ((beats % total) + total) % total;
  if (shift === 0) return notes.map((note) => ({ ...note }));
  const body = notes.map((note) => ({ ...note }));
  const head: ToneNote[] = [];
  let remaining = shift;
  while (remaining > 0) {
    const last = body[body.length - 1];
    if (last.beats <= remaining) {
      remaining -= last.beats;
      head.unshift(body.pop()!);
    } else {
      last.beats -= remaining;
      head.unshift({ midi: last.midi, beats: remaining });
      remaining = 0;
    }
  }
  return [...head, ...body];
}

// A fixed pitch held across the whole loop, as its own voice -- used where a
// world needs something that never changes with the harmony underneath it
// (World 6's aurora, World 10's tritone). `gaps` breaks the hold into two
// long notes with a beat of silence between them, so the drone stutters.
function droneTrack(
  midi: number,
  loopBeats: number,
  opts: { gain: number; attack?: number; wave?: Wave; wet?: number; stutter?: boolean }
): Track {
  const notes: ToneNote[] = opts.stutter
    ? [
        { midi, beats: loopBeats / 2 - 1 },
        { midi: null, beats: 1 },
        { midi, beats: loopBeats / 2 - 1 },
        { midi: null, beats: 1 },
      ]
    : [{ midi, beats: loopBeats }];
  return {
    kind: 'tone',
    wave: opts.wave ?? 'sine',
    gain: opts.gain,
    attack: opts.attack,
    wet: opts.wet,
    notes,
  };
}

type ChordStep = [string, 'maj' | 'min'];

interface OverworldScoreConfig {
  bpm: number;
  verse: ChordStep[];
  bridge: ChordStep[];
  verseShapes: MelodyShape[];
  bridgeShapes: MelodyShape[];
  leadWave?: Wave;
  leadGain?: number;
  leadUnison?: boolean;
  leadUnisonSpread?: number;
  leadOctave?: number; // semitones above the chord root's own register; defaults to 12
  leadDrive?: boolean;
  leadAttack?: number;
  leadWet?: number;
  padWave?: Wave;
  padGain?: number;
  padAttack?: number;
  padRelease?: number;
  padWet?: number;
  padMode?: 'fifth' | 'none';
  bassWave?: Wave;
  bassGain?: number;
  // 'arp' is the walking root-octave-root figure; 'whole' holds one note per
  // bar; 'slow' holds one across every two bars; 'none' removes the bass
  // entirely, for a world standing on nothing.
  bassMode?: 'arp' | 'whole' | 'slow' | 'none';
  bassAttack?: number;
  counterShapes?: MelodyShape[]; // an optional second, quieter interlocking voice
  // An optional canon: a second copy of the lead entering this many beats
  // later, answering it with its own line.
  mirrorDelayBeats?: number;
  mirrorGain?: number;
  extraTracks?: Track[];
}

function makeOverworldScore(cfg: OverworldScoreConfig): Score {
  const chords = [...cfg.verse, ...cfg.bridge];
  const bassRoots = chords.map(([r]) => r);
  const loopBeats = chords.length * 4;
  const leadOctave = cfg.leadOctave ?? 12;
  const shapeFor = (shapes: MelodyShape[], i: number) => shapes[i % shapes.length];
  const lead = [
    ...cfg.verse.flatMap(([r, q], i) => melodyBar(r, q, shapeFor(cfg.verseShapes, i), leadOctave)),
    ...cfg.bridge.flatMap(([r, q], i) => melodyBar(r, q, shapeFor(cfg.bridgeShapes, i), leadOctave)),
  ];

  const tracks: Track[] = [];

  const bassMode = cfg.bassMode ?? 'arp';
  if (bassMode !== 'none') {
    let bassNotes: ToneNote[];
    if (bassMode === 'arp') bassNotes = bassRoots.flatMap(padBassBar);
    else if (bassMode === 'whole') bassNotes = bassRoots.map((r) => ({ midi: n(r), beats: 4 }));
    else bassNotes = bassRoots.filter((_, i) => i % 2 === 0).map((r) => ({ midi: n(r), beats: 8 }));
    tracks.push({
      kind: 'tone',
      wave: cfg.bassWave ?? 'triangle',
      gain: cfg.bassGain ?? 0.15,
      attack: cfg.bassAttack,
      notes: bassNotes,
    });
  }

  if ((cfg.padMode ?? 'fifth') !== 'none') {
    tracks.push({
      kind: 'tone',
      wave: cfg.padWave ?? 'sine',
      gain: cfg.padGain ?? 0.07,
      attack: cfg.padAttack,
      release: cfg.padRelease,
      wet: cfg.padWet,
      notes: bassRoots.flatMap(padFifthBar),
    });
  }

  tracks.push({
    kind: 'tone',
    wave: cfg.leadWave ?? 'sine',
    gain: cfg.leadGain ?? 0.19,
    unison: cfg.leadUnison,
    unisonSpread: cfg.leadUnisonSpread,
    drive: cfg.leadDrive,
    attack: cfg.leadAttack,
    wet: cfg.leadWet,
    notes: lead,
  });

  if (cfg.mirrorDelayBeats) {
    tracks.push({
      kind: 'tone',
      wave: cfg.leadWave ?? 'sine',
      gain: cfg.mirrorGain ?? (cfg.leadGain ?? 0.19) * 0.8,
      unison: true,
      unisonSpread: cfg.leadUnisonSpread,
      wet: cfg.leadWet,
      notes: rotateNotes(lead, cfg.mirrorDelayBeats),
    });
  }

  if (cfg.counterShapes) {
    const counter = [
      ...cfg.verse.flatMap(([r, q], i) => melodyBar(r, q, shapeFor(cfg.counterShapes!, i), 0)),
      ...cfg.bridge.flatMap(([r, q], i) => melodyBar(r, q, shapeFor(cfg.counterShapes!, i), 0)),
    ];
    tracks.push({ kind: 'tone', wave: cfg.leadWave ?? 'sine', gain: (cfg.leadGain ?? 0.19) * 0.5, notes: counter });
  }

  if (cfg.extraTracks) tracks.push(...cfg.extraTracks);

  return { bpm: cfg.bpm, loopBeats, tracks };
}

// World 2 (symmetries/tight-binding): C Lydian, the raised fourth making
// hard midday light out of the same tonic World 1 sits on. Two short fixed
// motifs alternate bar by bar rather than one contour repeating -- a built,
// periodic world gets a built, periodic tune, and the two motifs are the
// two-atom basis. The F# in that raised fourth is also the first sounding of
// the pitch Worlds 7-10 eventually move to permanently.
const OVERWORLD_SCORE_2 = makeOverworldScore({
  bpm: 100,
  verse: [['C3', 'maj'], ['D3', 'maj'], ['C3', 'maj'], ['D3', 'maj']],
  bridge: [['E2', 'min'], ['D3', 'maj'], ['C3', 'maj'], ['D3', 'maj']],
  verseShapes: ['cellsA', 'cellsB'],
  bridgeShapes: ['cellsB', 'cellsA'],
  leadWave: 'triangle',
  bassMode: 'whole',
  padGain: 0.06,
});

// World 3 (topological band theory): C Mixolydian -- the flat seventh takes
// the first real step down from World 1's bright major without darkening
// into a minor key. Eight unbroken eighth-notes over a bass that holds one
// note per bar and never moves: wind racing across ground that cannot move
// at all, which is the world's whole picture.
const OVERWORLD_SCORE_3 = makeOverworldScore({
  bpm: 104,
  verse: [['C3', 'maj'], ['A#2', 'maj'], ['C3', 'maj'], ['F2', 'maj']],
  bridge: [['G2', 'min'], ['A#2', 'maj'], ['C3', 'maj'], ['F2', 'maj']],
  verseShapes: ['race'],
  bridgeShapes: ['race'],
  leadGain: 0.16,
  bassMode: 'whole',
});

// World 4 (QHE/Landau levels): C Aeolian, the first genuinely minor world.
// The circular arpeggio stands for the quantised orbits, and a crash on the
// first beat of every fourth bar is the storm overhead -- the first
// percussion anywhere in the overworld, and the reason it registers as
// weather rather than as a drum kit.
const OVERWORLD_SCORE_4 = makeOverworldScore({
  bpm: 132,
  verse: [['C3', 'min'], ['G#2', 'maj'], ['D#3', 'maj'], ['A#2', 'maj']],
  bridge: [['F2', 'min'], ['C3', 'min'], ['G#2', 'maj'], ['A#2', 'maj']],
  verseShapes: ['arpUpDown'],
  bridgeShapes: ['arpUpDown'],
  leadWave: 'triangle',
  leadGain: 0.16,
  extraTracks: [
    {
      kind: 'crash',
      gain: 0.1,
      notes: [
        { hit: true, beats: 16 },
        { hit: true, beats: 16 },
      ],
    },
  ],
});

// World 5 (superconductivity/Majorana): C Phrygian. The flat second is the
// coldest degree available and it is the world's whole colour, sounded as a
// Db chord the harmony keeps falling onto. One held tone per bar on the bare
// fifth, whole bars of real silence, and a bass moving once every two bars
// -- nothing here ever arrives on the tonic.
const OVERWORLD_SCORE_5 = makeOverworldScore({
  bpm: 84,
  verse: [['C3', 'min'], ['C#3', 'maj'], ['C3', 'min'], ['C#3', 'maj']],
  bridge: [['G#2', 'maj'], ['C#3', 'maj'], ['C3', 'min'], ['C#3', 'maj']],
  verseShapes: ['still', 'still', 'stillRest', 'still'],
  bridgeShapes: ['still', 'still', 'stillRest', 'still'],
  leadWave: 'sine',
  leadGain: 0.14,
  padWave: 'triangle',
  padAttack: 0.9,
  padRelease: 1.4,
  bassMode: 'slow',
  bassAttack: 0.5,
});

// World 6 (classical magnetism/magnons): the false calm. The mode goes all
// the way back to C Ionian -- World 1's own key and its own I-V-vi-IV -- so
// the relief is real rather than implied, which is what makes this the one
// world the player relaxes into. The tell is a single F#5 that holds right
// through the loop and stutters twice, exactly like the aurora it stands
// for. Against C and G it is a bright raised fourth; against F it is a
// semitone grind that never resolves, and it is the pitch the back half of
// the game is about to move to permanently. The danger is audible before it
// is nameable.
const OVERWORLD_SCORE_6 = makeOverworldScore({
  bpm: 116,
  verse: [['C3', 'maj'], ['G2', 'maj'], ['A2', 'min'], ['F2', 'maj']],
  bridge: [['A2', 'min'], ['F2', 'maj'], ['C3', 'maj'], ['G2', 'maj']],
  verseShapes: ['lilt', 'liltUp'],
  bridgeShapes: ['liltUp', 'lilt'],
  extraTracks: [droneTrack(n('F#5'), 32, { gain: 0.055, attack: 2, stutter: true })],
});

// World 7 (entanglement/tensor networks) -- the hard turn, and the one place
// in the game where the arrangement itself breaks rather than darkens.
//
// The tonic moves a tritone, from the C that carried Worlds 1-6 to the F#
// that holds for the rest of the game; a tritone is the one interval with no
// pull back home, which is the point. Several things change at once, because
// the light rule (dev_notes/WORLDS.md) puts a discontinuity here rather than
// another step down: the bass and the pad are *deleted*, so nothing supports
// the music from below or fills the space around it -- no ground, no sky,
// only the network; the ambience send switches on for the first time
// anywhere in the game, so the only thing answering the melody is the room
// itself, which is what "all light from here on is emitted by the world
// rather than received from above" sounds like; and there is no chord
// progression at all.
//
// The pitch collection is whole-tone: no leading tone and no tonic, six
// pitches all equally far apart, so the ear cannot decide where home is. It
// is also closed under transposition by a major third, so the canon below
// moves its cell up and down the collection without ever leaving it --
// geometry that continues in every direction and never arrives, which is a
// tensor network drawn in pitch.
const WORLD7_CELL: ToneNote[] = [
  { midi: n('F#4'), beats: 1 },
  { midi: n('A#4'), beats: 1 },
  { midi: n('D5'), beats: 1.5 },
  { midi: n('C5'), beats: 0.5 },
];
// Even semitone offsets only -- every one lands back inside the collection.
const WORLD7_OFFSETS = [0, 2, 4, 2, 0, -2, -4, -2];
const WORLD7_LEAD: ToneNote[] = WORLD7_OFFSETS.flatMap((offset) =>
  WORLD7_CELL.map((note) => ({ midi: note.midi! + offset, beats: note.beats }))
);

const OVERWORLD_SCORE_7: Score = {
  bpm: 76,
  loopBeats: 32,
  tracks: [
    { kind: 'tone', wave: 'triangle', gain: 0.19, attack: 0.15, wet: 0.5, notes: WORLD7_LEAD },
    // The answering strand: the same cell a major third away, entering two
    // beats later. Two parts of one structure rather than a tune and its
    // backing, since the network is all there is here.
    {
      kind: 'tone',
      wave: 'triangle',
      gain: 0.145,
      attack: 0.15,
      wet: 0.5,
      notes: rotateNotes(
        WORLD7_LEAD.map((note) => ({ midi: note.midi! + 4, beats: note.beats })),
        2
      ),
    },
  ],
};

// World 8 (quantum magnetism/spinons/Kondo) -- the loss beat.
//
// The world reuses World 1's own tree sprites, dead and grey, and the score
// does the same thing to World 1's own tune: the Mean Fields melody moved to the
// tritone pole and bent into F# Phrygian, at little over half the speed. The
// player is meant to almost recognise it. A quote earns its place here and
// nowhere else, because this is the only world built out of an earlier
// world's material -- what is taken from the player is specifically the
// thing they were given first.
const F_SHARP_PHRYGIAN = [6, 7, 9, 11, 1, 2, 4]; // F# G A B C# D E, as pitch classes

// Up a tritone, then any pitch landing outside the mode pushed *down* to the
// nearest degree inside it. Downward is what does the damage: it is what
// turns the Mean Fields' major thirds into minor ones, so the tune arrives
// already grieving rather than merely transposed.
function toPhrygianTritone(midi: number): number {
  const up = midi + 6;
  for (let drop = 0; drop < 12; drop++) {
    if (F_SHARP_PHRYGIAN.includes((((up - drop) % 12) + 12) % 12)) return up - drop;
  }
  return up;
}

// Each successive phrase loses one more note from its end, so the tune keeps
// trying to finish and keeps failing, and the loop's last bar is silence in
// every voice -- the fog, with only the delay tail left in it. World 1's
// verse is 4 phrases of 6 notes; at doubled note lengths that is 8 slow
// bars, and the truncations take 0, 2, 3 and 4 beats back as silence.
const WORLD8_PHRASE_TRUNCATION = [0, 1, 2, 3]; // notes dropped from each phrase's end

const WORLD8_LEAD: ToneNote[] = WORLD8_PHRASE_TRUNCATION.flatMap((drop, phrase) => {
  const source = OVERWORLD_VERSE_MELODY.slice(phrase * 6, phrase * 6 + 6);
  const kept = source.slice(0, source.length - drop);
  const rest = source.slice(source.length - drop).reduce((sum, note) => sum + note.beats * 2, 0);
  const notes: ToneNote[] = kept.map((note) => ({
    midi: note.midi === null ? null : toPhrygianTritone(note.midi),
    beats: note.beats * 2,
  }));
  if (rest > 0) notes.push({ midi: null, beats: rest });
  return notes;
});

// Seven bars of harmony and then nothing: the eighth bar is the fog.
const WORLD8_CHORDS: ChordStep[] = [
  ['F#2', 'min'], ['G2', 'maj'], ['F#2', 'min'], ['D2', 'maj'],
  ['B2', 'min'], ['G2', 'maj'], ['F#2', 'min'],
];

const OVERWORLD_SCORE_8: Score = {
  bpm: 58,
  loopBeats: 32,
  tracks: [
    {
      kind: 'tone',
      wave: 'triangle',
      gain: 0.1,
      attack: 0.8,
      release: 1.5,
      notes: [...WORLD8_CHORDS.map(([r]) => ({ midi: n(r), beats: 4 })), { midi: null, beats: 4 }],
    },
    {
      kind: 'tone',
      wave: 'sine',
      gain: 0.05,
      attack: 0.9,
      wet: 0.45,
      notes: [...WORLD8_CHORDS.flatMap(([r]) => padFifthBar(r)), { midi: null, beats: 4 }],
    },
    { kind: 'tone', wave: 'sine', gain: 0.13, attack: 0.2, wet: 0.45, notes: WORLD8_LEAD },
  ],
};

// World 9 (excitations and defects): F# Phrygian dominant -- a major third
// over a flat second, the most scorched mode available, and the F# and G
// chords grind a semitone against each other exactly as this world's healed
// scars sit against its open ones. Driven square lead, and a bare kick on
// the first beat of every bar: not a groove, a pulse under the crust.
const OVERWORLD_SCORE_9 = makeOverworldScore({
  bpm: 140,
  verse: [['F#2', 'maj'], ['G2', 'maj'], ['F#2', 'maj'], ['G2', 'maj']],
  bridge: [['B2', 'min'], ['G2', 'maj'], ['F#2', 'maj'], ['G2', 'maj']],
  verseShapes: ['glitch'],
  bridgeShapes: ['glitch'],
  leadWave: 'square',
  leadGain: 0.12,
  leadDrive: true,
  leadWet: 0.2,
  padGain: 0.05,
  extraTracks: [{ kind: 'kick', gain: 0.34, notes: kickPulseSparse(8) }],
});

// World 10 (ML for quantum materials): F# Lydian -- and its raised fourth is
// C, the tonic Worlds 1-6 were built on, returning as a colour inside the
// mirror rather than as a home that can be gone back to. The dead sun,
// reflected.
//
// The lead is answered by an exact copy of itself a bar later: not a harmony
// part, the same line, arriving after you. That is the world modelling the
// player, and it is the only voice in the game that plays what another voice
// has already played. A fixed F#-C tritone holds under everything, and the
// wettest send in the game puts the whole thing at a distance, as though
// heard from inside something else.
const OVERWORLD_SCORE_10 = makeOverworldScore({
  bpm: 158,
  verse: [['F#2', 'maj'], ['G#2', 'maj'], ['F#2', 'maj'], ['D#2', 'min']],
  bridge: [['G#2', 'maj'], ['D#2', 'min'], ['G#2', 'maj'], ['F#2', 'maj']],
  verseShapes: ['arpUpDown', 'arch'],
  bridgeShapes: ['arch', 'arpUpDown'],
  leadUnison: true,
  leadUnisonSpread: 16,
  leadGain: 0.15,
  leadWet: 0.6,
  padMode: 'none',
  bassMode: 'whole',
  bassGain: 0.12,
  mirrorDelayBeats: 4,
  mirrorGain: 0.12,
  extraTracks: [
    droneTrack(n('F#3'), 32, { gain: 0.05, attack: 1.5 }),
    droneTrack(n('C4'), 32, { gain: 0.045, attack: 1.5, wet: 0.4 }),
  ],
});

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

function octaveUp(notes: ToneNote[]): ToneNote[] {
  return notes.map((note) => (note.midi === null ? note : { midi: note.midi + 12, beats: note.beats }));
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

// --- Battle articulation --------------------------------------------------
//
// The battle theme's shape (vamp, stab lead, march, crashes) is what makes
// it exciting and is deliberately left alone. What these add is
// articulation: the places a live band would push or lean on the beat,
// which is the difference between a riff being played and a riff being
// sequenced. The rhythm section runs unbroken underneath -- these punctuate
// a groove rather than interrupting one. They are separate from the plain
// kickPulse/snarePulse/hatPulse patterns rather than changes to them,
// because the Modern arrangement's battle kit still uses those.

// Backbeat on 2 and 4, with beat 4 of `dragBar` broken into four sixteenths
// -- a fill that drags the music over the seam into the reprise instead of
// letting the section merely stop and restart.
function battleSnarePattern(bars: number, dragBar: number): PercNote[] {
  const notes: PercNote[] = [];
  for (let bar = 0; bar < bars; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      if (bar === dragBar && beat === 3) {
        for (let i = 0; i < 4; i++) notes.push({ hit: true, beats: 0.25 });
      } else {
        notes.push({ hit: beat % 2 === 1, beats: 1 });
      }
    }
  }
  return notes;
}

// Offbeat eighths throughout, with one exception: the "and" of beat 4 in a
// phrase-ending bar becomes two sixteenths, a lift that marks the phrase
// without spending a fill on it.
function battleHatPattern(bars: number, liftBars: number[]): PercNote[] {
  const notes: PercNote[] = [];
  for (let bar = 0; bar < bars; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      if (liftBars.includes(bar) && beat === 3) {
        notes.push({ hit: false, beats: 0.5 }, { hit: true, beats: 0.25 }, { hit: true, beats: 0.25 });
      } else {
        notes.push({ hit: false, beats: 0.5 }, { hit: true, beats: 0.5 });
      }
    }
  }
  return notes;
}

// Keeps only the opening `beats` of a bar, splitting a straddling note.
function keepOpening(bar: ToneNote[], beats: number): ToneNote[] {
  const out: ToneNote[] = [];
  let consumed = 0;
  for (const note of bar) {
    if (consumed >= beats) break;
    out.push({ midi: note.midi, beats: Math.min(note.beats, beats - consumed) });
    consumed += note.beats;
  }
  return out;
}

// 5 - b6 - b7 climbing into the tonic that is waiting at the loop point, so
// the seam sounds like an arrival rather than a restart. Two beats long.
function turnoverWalk(rootName: string, octave: number): ToneNote[] {
  const root = n(rootName) + octave;
  return [
    { midi: root + 7, beats: 0.5 },
    { midi: root + 8, beats: 0.5 },
    { midi: root + 10, beats: 1 },
  ];
}

// A crash track from a list of beat positions within the loop.
function crashTrack(loopBeats: number, gain: number, at: number[]): Track {
  const notes: PercNote[] = [];
  let cursor = 0;
  for (let i = 0; i < at.length; i++) {
    if (at[i] > cursor) {
      notes.push({ hit: false, beats: at[i] - cursor });
      cursor = at[i];
    }
    const next = Math.min(at[i + 1] ?? loopBeats, loopBeats);
    notes.push({ hit: true, beats: next - cursor });
    cursor = next;
  }
  if (cursor < loopBeats) notes.push({ hit: false, beats: loopBeats - cursor });
  return { kind: 'crash', gain, notes };
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
// and hats, and an opening crash + fanfare sting plus a crash marking the
// reprise -- a Final Fantasy-style battle theme where B is a proper second
// riff, connected by real voice-leading rather than a silence-and-crash cut.
//
// Articulated the same way every other world's battle is (see the
// "Battle articulation" helpers above): the band plays through every section
// seam, a crash marks each 8-bar boundary on its downbeat, the snare drags
// the music over the seam into the reprise, hats lift at phrase ends, and
// the loop's last two beats walk up into the tonic waiting at the loop
// point. Contrast comes from new material over an engine that keeps
// running, never from taking voices away: the theme loops dozens of times
// per session, and a gap that thrills once wears badly by the tenth pass.
const BATTLE_DROP_BAR = BATTLE_A_PROGRESSION.length;
const BATTLE_DRAG_BAR = BATTLE_A_PROGRESSION.length + BATTLE_B_PROGRESSION.length - 1;
const BATTLE_LAST_BAR = BATTLE_FULL_PROGRESSION.length - 1;
const BATTLE_LIFT_BARS = [3, 7, 11];

const BATTLE_SCORE: Score = {
  bpm: 160,
  loopBeats: BATTLE_LOOP_BEATS,
  tracks: [
    {
      kind: 'tone',
      wave: 'square',
      gain: 0.13,
      drive: true,
      notes: BATTLE_FULL_PROGRESSION.flatMap(([r, q], bar) => {
        const plain = vampBar(r, q);
        if (bar === BATTLE_LAST_BAR) return [...keepOpening(plain, 2), ...turnoverWalk(BATTLE_REPRISE[0][0], 0)];
        return plain;
      }),
    },
    {
      kind: 'tone',
      wave: 'sine',
      gain: 0.11,
      notes: BATTLE_FULL_PROGRESSION.flatMap(([root], bar) =>
        bar === BATTLE_LAST_BAR
          ? [{ midi: n(root) - 12, beats: 2 }, ...turnoverWalk(BATTLE_REPRISE[0][0], -12)]
          : subBassBar(root)
      ),
    },
    {
      kind: 'tone',
      wave: 'sawtooth',
      gain: 0.15,
      unison: true,
      drive: true,
      notes: [
        ...sectionBars(BATTLE_A_PROGRESSION, stabBar, { [BATTLE_A_PROGRESSION.length - 1]: BATTLE_TO_B_TRANSITION }),
        ...sectionBars(BATTLE_B_PROGRESSION, stabBar, {
          [BATTLE_B_PROGRESSION.length - 1]: BATTLE_TO_A_TRANSITION,
        }),
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
    { kind: 'snare', gain: 0.5, notes: battleSnarePattern(BATTLE_FULL_PROGRESSION.length, BATTLE_DRAG_BAR) },
    { kind: 'hat', gain: 0.22, notes: battleHatPattern(BATTLE_FULL_PROGRESSION.length, BATTLE_LIFT_BARS) },
    crashTrack(BATTLE_LOOP_BEATS, 0.32, [0, BATTLE_DROP_BAR * 4, (BATTLE_A_PROGRESSION.length + BATTLE_B_PROGRESSION.length) * 4]),
  ],
};

// --- Worlds 2-10's battle themes ---------------------------------------
//
// World 1 keeps its own hand-written BATTLE_SCORE above untouched. Worlds
// 2-10 are built from a small battle-shaped generator instead, the same
// spirit as makeOverworldScore above: each world still gets the same
// architecture (i-bVII vamp lifting to a bVI-bVII section, a contrasting
// riff a fourth up, a reprise, a fanfare sting, an ever-present kick/snare/
// hat march, two crash hits) but its own key, tempo, oscillator choices,
// and (for a few worlds) its own bar-generator/percussion shapes, so battle
// tracks read as part of the same soundtrack family as the overworld themes
// without literally repeating world 1's D-minor riff ten times over.

// Circular root-third-fifth-octave-fifth-third-root-third motion -- a
// "quantized orbit" vamp shape for the Storm Flats's battle track,
// standing in for vampBar's straight eighth-note ostinato.
function vampBarOrbit(rootName: string, quality: 'maj' | 'min'): ToneNote[] {
  const root = n(rootName);
  const third = root + (quality === 'maj' ? 4 : 3);
  const fifth = root + 7;
  return [
    { midi: root, beats: 0.5 }, { midi: third, beats: 0.5 }, { midi: fifth, beats: 0.5 }, { midi: root + 12, beats: 0.5 },
    { midi: fifth, beats: 0.5 }, { midi: third, beats: 0.5 }, { midi: root, beats: 0.5 }, { midi: third, beats: 0.5 },
  ];
}

// A held root, then a held fifth -- half the note density of vampBar, for a
// frozen/hazy battle vamp (the Vortex Glacier, the Screened Swamp)
// instead of a running eighth-note ostinato.
function vampBarSparse(rootName: string, _quality: 'maj' | 'min'): ToneNote[] {
  const root = n(rootName);
  const fifth = root + 7;
  return [{ midi: root, beats: 2 }, { midi: fifth, beats: 2 }];
}

// A single stab, real silence, then a closing fifth -- stabBar's sparse
// counterpart for the same cold/hazy worlds.
function stabBarSparse(rootName: string, _quality: 'maj' | 'min'): ToneNote[] {
  const root = n(rootName) + 24;
  const fifth = root + 7;
  return [{ midi: root, beats: 1 }, { midi: null, beats: 2 }, { midi: fifth, beats: 1 }];
}

// The same irregular-subdivision stumble as melodyBar's 'glitch' shape,
// built from a chord's own root/third/fifth/sixth instead of scale degrees
// -- the Defect Scars' battle vamp never quite locks into a steady groove.
function vampBarGlitch(rootName: string, quality: 'maj' | 'min'): ToneNote[] {
  const root = n(rootName);
  const third = root + (quality === 'maj' ? 4 : 3);
  const fifth = root + 7;
  const sixth = root + (quality === 'maj' ? 9 : 8);
  return [
    { midi: root, beats: 0.25 }, { midi: null, beats: 0.25 }, { midi: third, beats: 0.5 },
    { midi: fifth, beats: 0.25 }, { midi: null, beats: 0.25 }, { midi: root + 12, beats: 0.5 },
    { midi: sixth, beats: 0.5 }, { midi: null, beats: 0.5 }, { midi: third, beats: 1 },
  ];
}

// Kick hits with a syncopated double dropped into every other bar instead
// of a straight backbeat -- a stumbling groove for the Defect Scars rather
// than the march every other battle track uses.
function kickPulseGlitch(bars: number): PercNote[] {
  const notes: PercNote[] = [];
  for (let bar = 0; bar < bars; bar++) {
    if (bar % 2 === 0) {
      notes.push({ hit: true, beats: 1 }, { hit: false, beats: 0.5 }, { hit: true, beats: 0.5 }, { hit: true, beats: 1 }, { hit: false, beats: 1 });
    } else {
      notes.push({ hit: true, beats: 1 }, { hit: false, beats: 1 }, { hit: true, beats: 1 }, { hit: false, beats: 1 });
    }
  }
  return notes;
}

// One kick on beat 1 of every bar only -- the sparse worlds' half-time feel.
function kickPulseSparse(bars: number): PercNote[] {
  return Array.from({ length: bars * 4 }, (_, i) => ({ hit: i % 4 === 0, beats: 1 }));
}

// One snare on beat 3 of every bar only -- pairs with kickPulseSparse.
function snarePulseSparse(bars: number): PercNote[] {
  return Array.from({ length: bars * 4 }, (_, i) => ({ hit: i % 4 === 2, beats: 1 }));
}

// One hat on beats 2 and 4 -- half the hits hatPulse places, thinning the
// texture the same way vampBarSparse/stabBarSparse do.
function hatPulseSparse(bars: number): PercNote[] {
  return Array.from({ length: bars * 4 }, (_, i) => ({ hit: i % 2 === 1, beats: 1 }));
}

// A short scalar lick outlining the *upcoming* section's chord, two octaves
// up (the lead's own register) -- the generator's counterpart to
// BATTLE_TO_B_TRANSITION/BATTLE_TO_A_TRANSITION above, so every world's A/B
// bridge is real voice-leading into that world's own key rather than a
// fixed pitch sequence borrowed from world 1's D minor.
function battleTransitionLick(targetRoot: string, targetQuality: 'maj' | 'min', descending: boolean): ToneNote[] {
  const root = n(targetRoot) + 24;
  const third = root + (targetQuality === 'maj' ? 4 : 3);
  const fifth = root + 7;
  const top = root + 12;
  const pitches = descending ? [top, fifth, third, root] : [third, fifth, top, top + (targetQuality === 'maj' ? 4 : 3)];
  return pitches.map((midi) => ({ midi, beats: 1 }));
}

// The rising fanfare + trailing rest shape BATTLE_INTRO_STING hand-writes
// for D minor, generalized to any key/loop length.
function battleIntroSting(loopBeats: number, rootName: string, quality: 'maj' | 'min'): ToneNote[] {
  const root = n(rootName) + 24;
  const third = root + (quality === 'maj' ? 4 : 3);
  const fifth = root + 7;
  return [
    { midi: root, beats: 0.25 }, { midi: third, beats: 0.25 }, { midi: fifth, beats: 0.25 }, { midi: root + 12, beats: 0.25 },
    { midi: fifth, beats: 0.5 }, { midi: root + 12, beats: 0.5 },
    { midi: null, beats: loopBeats - 2 },
  ];
}

interface BattleScoreConfig {
  bpm: number;
  mainA: ChordStep[]; // 4 chords -- the i-bVII vamp (also the reprise)
  mainB: ChordStep[]; // 4 chords -- the brighter bVI-bVII lift, completes the 8-bar A section
  bProgression: ChordStep[]; // 8 chords -- the contrasting riff a fourth up
  vampGen?: (root: string, quality: 'maj' | 'min') => ToneNote[];
  vampWave?: Wave;
  vampGain?: number;
  vampDrive?: boolean;
  leadGen?: (root: string, quality: 'maj' | 'min') => ToneNote[];
  leadWave?: Wave;
  leadGain?: number;
  leadUnison?: boolean;
  leadDrive?: boolean;
  // The brass pickup into each downbeat. On by default, and turned off for
  // the worlds whose lead is deliberately sparse, where an extra note before
  // every bar would fill in exactly the silence that gives them their
  // character.
  subBassGain?: number;
  // 'holdTonic' sustains the loop's opening root the whole way through
  // instead of following each bar's chord -- for worlds whose harmony
  // deliberately clashes by a semitone (the Defect Scars), where a moving
  // sub-bass would just double the mud.
  subBassMode?: 'followChords' | 'holdTonic';
  kickGen?: (bars: number) => PercNote[];
  snareGen?: (bars: number) => PercNote[];
  hatGen?: (bars: number) => PercNote[];
  kickGain?: number;
  snareGain?: number;
  hatGain?: number;
  crashGain?: number;
  // An optional quiet interlocking second voice riding on top of the vamp
  // (the Entangled Web's "bonds as paths").
  extraVoice?: { wave: Wave; gain: number; gen: (root: string, quality: 'maj' | 'min') => ToneNote[] };
  // An optional quiet octave-up unison doubling of the lead (The Adaptive
  // the Devouring Mirror's shimmer).
  shimmer?: boolean;
}

function makeBattleScore(cfg: BattleScoreConfig): Score {
  const aProgression = [...cfg.mainA, ...cfg.mainB];
  const bProgression = cfg.bProgression;
  const reprise = cfg.mainA;
  const fullProgression = [...aProgression, ...bProgression, ...reprise];
  const loopBeats = fullProgression.length * 4;

  const vampGen = cfg.vampGen ?? vampBar;
  const leadGen = cfg.leadGen ?? stabBar;
  const leadGenLow = (r: string, q: 'maj' | 'min') => octaveDown(leadGen(r, q));

  const toB = battleTransitionLick(bProgression[0][0], bProgression[0][1], true);
  const toA = battleTransitionLick(reprise[0][0], reprise[0][1], false);

  // Bar landmarks the articulation hangs off: B's first bar (crashed on its
  // downbeat), B's last bar (the drag into the reprise), the loop's last bar
  // (the turnover) and every phrase-ending bar in between (the hat lift).
  const dropBar = aProgression.length;
  const dragBar = aProgression.length + bProgression.length - 1;
  const lastBar = fullProgression.length - 1;
  const liftBars: number[] = [];
  for (let bar = 3; bar < fullProgression.length; bar += 4) {
    if (bar !== dragBar && bar !== lastBar) liftBars.push(bar);
  }

  const leadNotes = [
    ...sectionBars(aProgression, leadGen, { [aProgression.length - 1]: toB }),
    ...sectionBars(bProgression, leadGen, { [bProgression.length - 1]: toA }),
    ...reprise.flatMap(([r, q]) => leadGen(r, q)),
  ];
  const leadLowNotes = [
    ...sectionBars(aProgression, leadGenLow, { [aProgression.length - 1]: octaveDown(toB) }),
    ...sectionBars(bProgression, leadGenLow, { [bProgression.length - 1]: octaveDown(toA) }),
    ...reprise.flatMap(([r, q]) => leadGenLow(r, q)),
  ];

  const subBassRoot = (root: string) => (cfg.subBassMode === 'holdTonic' ? cfg.mainA[0][0] : root);
  const subBassNotes = fullProgression.flatMap(([root], bar) =>
    bar === lastBar
      ? [{ midi: n(subBassRoot(root)) - 12, beats: 2 }, ...turnoverWalk(reprise[0][0], -12)]
      : subBassBar(subBassRoot(root))
  );

  const kickGen = cfg.kickGen ?? kickPulse;
  const snareGen = cfg.snareGen ?? ((bars: number) => battleSnarePattern(bars, dragBar));
  const hatGen = cfg.hatGen ?? ((bars: number) => battleHatPattern(bars, liftBars));

  const tracks: Track[] = [
    {
      kind: 'tone',
      wave: cfg.vampWave ?? 'square',
      gain: cfg.vampGain ?? 0.13,
      drive: cfg.vampDrive ?? true,
      notes: fullProgression.flatMap(([r, q], bar) => {
        const plain = vampGen(r, q);
        if (bar === lastBar) return [...keepOpening(plain, 2), ...turnoverWalk(reprise[0][0], 0)];
        return plain;
      }),
    },
    { kind: 'tone', wave: 'sine', gain: cfg.subBassGain ?? 0.11, notes: subBassNotes },
    {
      kind: 'tone',
      wave: cfg.leadWave ?? 'sawtooth',
      gain: cfg.leadGain ?? 0.15,
      unison: cfg.leadUnison ?? true,
      drive: cfg.leadDrive ?? true,
      notes: leadNotes,
    },
    {
      kind: 'tone',
      wave: cfg.leadWave ?? 'sawtooth',
      gain: (cfg.leadGain ?? 0.15) * 0.53,
      drive: cfg.leadDrive ?? true,
      notes: leadLowNotes,
    },
    { kind: 'tone', wave: 'sawtooth', gain: 0.18, drive: true, notes: battleIntroSting(loopBeats, cfg.mainA[0][0], cfg.mainA[0][1]) },
    { kind: 'kick', gain: cfg.kickGain ?? 0.9, notes: kickGen(fullProgression.length) },
    { kind: 'snare', gain: cfg.snareGain ?? 0.5, notes: snareGen(fullProgression.length) },
    { kind: 'hat', gain: cfg.hatGain ?? 0.22, notes: hatGen(fullProgression.length) },
    crashTrack(loopBeats, cfg.crashGain ?? 0.32, [0, dropBar * 4, (aProgression.length + bProgression.length) * 4]),
  ];
  if (cfg.extraVoice) {
    const extraVoice = cfg.extraVoice;
    tracks.push({
      kind: 'tone',
      wave: extraVoice.wave,
      gain: extraVoice.gain,
      notes: fullProgression.flatMap(([r, q]) => extraVoice.gen(r, q)),
    });
  }
  if (cfg.shimmer) {
    tracks.push({ kind: 'tone', wave: 'sine', gain: (cfg.leadGain ?? 0.15) * 0.3, unison: true, notes: octaveUp(leadNotes) });
  }

  return { bpm: cfg.bpm, loopBeats, tracks };
}

// World 2, the Stone Lattice: echoing minor arpeggios, no drive/grit on either
// voice for a hollow cave-echo timbre -- A minor, moderate-fast.
const BATTLE_SCORE_2 = makeBattleScore({
  bpm: 150,
  mainA: [['A2', 'min'], ['G2', 'maj'], ['A2', 'min'], ['G2', 'maj']],
  mainB: [['F2', 'maj'], ['G2', 'maj'], ['F2', 'maj'], ['G2', 'maj']],
  bProgression: [
    ['D2', 'min'], ['A#2', 'maj'], ['F2', 'maj'], ['C2', 'maj'],
    ['D2', 'min'], ['A#2', 'maj'], ['F2', 'maj'], ['C2', 'maj'],
  ],
  vampWave: 'triangle',
  vampDrive: false,
  leadWave: 'triangle',
  leadDrive: false,
  leadUnison: false,
  leadGain: 0.16,
  crashGain: 0.26,
});

// World 3, the Winding Borders: airy and bright even at battle tempo -- no
// drive on either voice, wide unison lead -- C# minor.
const BATTLE_SCORE_3 = makeBattleScore({
  bpm: 148,
  mainA: [['C#2', 'min'], ['B2', 'maj'], ['C#2', 'min'], ['B2', 'maj']],
  mainB: [['A2', 'maj'], ['B2', 'maj'], ['A2', 'maj'], ['B2', 'maj']],
  bProgression: [
    ['F#2', 'min'], ['D2', 'maj'], ['A2', 'maj'], ['E2', 'maj'],
    ['F#2', 'min'], ['D2', 'maj'], ['A2', 'maj'], ['E2', 'maj'],
  ],
  vampDrive: false,
  leadDrive: false,
  leadUnison: true,
  leadGain: 0.16,
  crashGain: 0.3,
});

// World 4, the Storm Flats: the circular vampBarOrbit ostinato for
// quantized orbits, fast and driving -- E minor.
const BATTLE_SCORE_4 = makeBattleScore({
  bpm: 172,
  mainA: [['E2', 'min'], ['D2', 'maj'], ['E2', 'min'], ['D2', 'maj']],
  mainB: [['C2', 'maj'], ['D2', 'maj'], ['C2', 'maj'], ['D2', 'maj']],
  bProgression: [
    ['A2', 'min'], ['F2', 'maj'], ['C2', 'maj'], ['G2', 'maj'],
    ['A2', 'min'], ['F2', 'maj'], ['C2', 'maj'], ['G2', 'maj'],
  ],
  vampGen: vampBarOrbit,
  leadUnison: true,
  crashGain: 0.34,
});

// World 5, the Vortex Glacier: the sparse held-note vamp/stab
// and half-time percussion, sine/triangle only, no drive -- F minor, the
// slowest battle tempo of the ten.
const BATTLE_SCORE_5 = makeBattleScore({
  bpm: 110,
  mainA: [['F2', 'min'], ['D#2', 'maj'], ['F2', 'min'], ['D#2', 'maj']],
  mainB: [['C#2', 'maj'], ['D#2', 'maj'], ['C#2', 'maj'], ['D#2', 'maj']],
  bProgression: [
    ['A#2', 'min'], ['F#2', 'maj'], ['C#2', 'maj'], ['G#2', 'maj'],
    ['A#2', 'min'], ['F#2', 'maj'], ['C#2', 'maj'], ['G#2', 'maj'],
  ],
  vampGen: vampBarSparse,
  vampWave: 'sine',
  vampGain: 0.1,
  vampDrive: false,
  leadGen: stabBarSparse,
  leadWave: 'sine',
  leadUnison: false,
  leadDrive: false,
  leadGain: 0.13,
  subBassGain: 0.09,
  kickGen: kickPulseSparse,
  snareGen: snarePulseSparse,
  hatGen: hatPulseSparse,
  kickGain: 0.6,
  snareGain: 0.32,
  crashGain: 0.16,
});

// World 6, the Iron Steppe: bright and driving, a touch faster than the
// default battle feel -- G minor.
const BATTLE_SCORE_6 = makeBattleScore({
  bpm: 164,
  mainA: [['G2', 'min'], ['F2', 'maj'], ['G2', 'min'], ['F2', 'maj']],
  mainB: [['D#2', 'maj'], ['F2', 'maj'], ['D#2', 'maj'], ['F2', 'maj']],
  bProgression: [
    ['C2', 'min'], ['G#2', 'maj'], ['D#2', 'maj'], ['A#2', 'maj'],
    ['C2', 'min'], ['G#2', 'maj'], ['D#2', 'maj'], ['A#2', 'maj'],
  ],
  leadGain: 0.17,
  crashGain: 0.34,
});

// World 7, the Entangled Web: a quiet extraVoice riding the vampBarOrbit
// shape an octave above the vamp -- a second interlocking voice for "bonds
// as paths," matching the overworld theme's own interlocking counter-melody
// -- B minor.
const BATTLE_SCORE_7 = makeBattleScore({
  bpm: 158,
  mainA: [['B2', 'min'], ['A2', 'maj'], ['B2', 'min'], ['A2', 'maj']],
  mainB: [['G2', 'maj'], ['A2', 'maj'], ['G2', 'maj'], ['A2', 'maj']],
  bProgression: [
    ['E2', 'min'], ['C2', 'maj'], ['G2', 'maj'], ['D2', 'maj'],
    ['E2', 'min'], ['C2', 'maj'], ['G2', 'maj'], ['D2', 'maj'],
  ],
  leadUnison: true,
  extraVoice: { wave: 'triangle', gain: 0.06, gen: (r, q) => octaveUp(vampBarOrbit(r, q)) },
});

// World 8, the Screened Swamp: hazy and low-contrast like its overworld theme --
// the same sparse vamp/stab/percussion as world 5, quieter still, no drive
// -- C minor, slow.
const BATTLE_SCORE_8 = makeBattleScore({
  bpm: 108,
  mainA: [['C2', 'min'], ['A#2', 'maj'], ['C2', 'min'], ['A#2', 'maj']],
  mainB: [['G#2', 'maj'], ['A#2', 'maj'], ['G#2', 'maj'], ['A#2', 'maj']],
  bProgression: [
    ['F2', 'min'], ['C#2', 'maj'], ['G#2', 'maj'], ['D#2', 'maj'],
    ['F2', 'min'], ['C#2', 'maj'], ['G#2', 'maj'], ['D#2', 'maj'],
  ],
  vampGen: vampBarSparse,
  vampWave: 'triangle',
  vampGain: 0.09,
  vampDrive: false,
  leadGen: stabBarSparse,
  leadWave: 'sine',
  leadUnison: false,
  leadDrive: false,
  leadGain: 0.11,
  subBassGain: 0.08,
  kickGen: kickPulseSparse,
  snareGen: snarePulseSparse,
  hatGen: hatPulseSparse,
  kickGain: 0.55,
  snareGain: 0.28,
  crashGain: 0.14,
});

// World 9, the Defect Scars: the glitchy vamp/kick shapes, square wave with
// heavy drive, and a harmony that deliberately clashes a semitone against
// itself (D/D# and A/A#) instead of the clean diatonic bVII every other
// world uses -- scorched and dissonant, the fastest tempo of the ten. The
// sub-bass holds the loop's D root throughout (subBassMode: 'holdTonic')
// rather than following the clashing chords, so the low end doesn't turn
// to mud.
const BATTLE_SCORE_9 = makeBattleScore({
  bpm: 176,
  mainA: [['D2', 'min'], ['D#2', 'maj'], ['D2', 'min'], ['D#2', 'maj']],
  mainB: [['A2', 'maj'], ['A#2', 'maj'], ['A2', 'maj'], ['A#2', 'maj']],
  bProgression: [
    ['G2', 'min'], ['G#2', 'maj'], ['D2', 'min'], ['D#2', 'maj'],
    ['G2', 'min'], ['G#2', 'maj'], ['D2', 'min'], ['D#2', 'maj'],
  ],
  vampGen: vampBarGlitch,
  leadUnison: false,
  leadGain: 0.17,
  subBassMode: 'holdTonic',
  kickGen: kickPulseGlitch,
  crashGain: 0.4,
});

// World 10, the Devouring Mirror: a shimmering octave-up unison doubling
// of the lead (shimmer: true) over the same unison-detuned brass, no drive
// for a cleaner reflective tone -- F# minor, sharing its tonic with the
// overworld theme's F# Lydian.
const BATTLE_SCORE_10 = makeBattleScore({
  bpm: 150,
  mainA: [['F#2', 'min'], ['E2', 'maj'], ['F#2', 'min'], ['E2', 'maj']],
  mainB: [['D2', 'maj'], ['E2', 'maj'], ['D2', 'maj'], ['E2', 'maj']],
  bProgression: [
    ['B2', 'min'], ['G2', 'maj'], ['D2', 'maj'], ['A2', 'maj'],
    ['B2', 'min'], ['G2', 'maj'], ['D2', 'maj'], ['A2', 'maj'],
  ],
  vampDrive: false,
  leadDrive: false,
  leadUnison: true,
  leadGain: 0.16,
  shimmer: true,
  crashGain: 0.3,
});

// --- The "Modern" style: an ambient orchestral-pad second arrangement of
// all 20 worlds ---------------------------------------------------------
//
// Reuses each world's own key and tempo (the same ChordStep progressions the
// classic scores above use, given again as literals here rather than
// exported/shared, so nothing above this point is touched) through a
// different pair of generators: a sustained, swelling extended-chord pad
// standing in for a string section instead of a single arpeggiated
// bass+fifth; a lead that's one composed phrase spanning a whole 4-bar
// section (modernPhraseCell's four distinct cells: rise, reach a 9th, peak
// and turn, resolve) instead of a single shape repeating bar after bar; and
// a genuine harmony voice a third below the lead (harmonizeThird) instead of
// classic's octave-doubling. A handful of tracks lean on the shared
// ambience/delay bus (ToneTrack.wet) for a soft, hall-like tail. There is no
// percussion at all in either scene kind -- pure melodic pads.

interface ChordToneSet {
  root: number;
  second: number;
  third: number;
  fourth: number;
  fifth: number;
  sixth: number;
  seventh: number;
  ninth: number;
  octave: number;
}

// Every scale-degree/extension modernPhraseCell and padVoiceBar draw from,
// computed once per chord the same way melodyBar/vampBar compute their own
// root/third/fifth locally -- `octave` is a semitone offset applied to the
// bare root (0 = the root name's own register, 12/24 = one/two octaves up),
// matching the convention the classic generators already use.
function chordTones(rootName: string, quality: 'maj' | 'min', octave: number): ChordToneSet {
  const root = n(rootName) + octave;
  return {
    root,
    second: root + 2,
    third: root + (quality === 'maj' ? 4 : 3),
    fourth: root + 5,
    fifth: root + 7,
    sixth: root + (quality === 'maj' ? 9 : 8),
    seventh: root + (quality === 'maj' ? 11 : 10),
    ninth: root + 14,
    octave: root + 12,
  };
}

// Three phrase characters, echoing the classic style's shape variety
// (skip/arch vs. sparse-drone vs. wide-and-shimmering) but each spanning a
// whole bar with longer note values and passing/extended tones rather than
// six eighth-notes of chord-tone skips. Every branch's four cases still sum
// to exactly 4 beats, the same per-bar discipline melodyBar/vampBar keep, so
// a section built from them always lands on the section's own loopBeats.
type PhraseVariant = 'lyrical' | 'sparse' | 'soaring';

function modernPhraseCell(
  rootName: string,
  quality: 'maj' | 'min',
  cell: 0 | 1 | 2 | 3,
  variant: PhraseVariant,
  octave: number
): ToneNote[] {
  const c = chordTones(rootName, quality, octave);
  if (variant === 'sparse') {
    // Long held tones with real silence -- the cold/hazy worlds' phrasing,
    // still one composed arc (reach the 9th in cell 1, resolve in cell 3)
    // rather than a repeating shape.
    switch (cell) {
      case 0: return [{ midi: c.third, beats: 3 }, { midi: null, beats: 1 }];
      case 1: return [{ midi: c.ninth, beats: 3 }, { midi: null, beats: 1 }];
      case 2: return [{ midi: c.sixth, beats: 3 }, { midi: null, beats: 1 }];
      case 3: return [{ midi: c.root, beats: 4 }];
    }
  }
  if (variant === 'soaring') {
    // Wider register jumps and an octave-plus peak -- the airy/major and
    // shimmering-finale worlds.
    switch (cell) {
      case 0: return [{ midi: c.fifth, beats: 1 }, { midi: c.octave, beats: 1.5 }, { midi: c.seventh, beats: 1.5 }];
      case 1: return [{ midi: c.ninth, beats: 2 }, { midi: c.octave, beats: 1 }, { midi: c.seventh, beats: 1 }];
      case 2: return [{ midi: c.octave + 5, beats: 1.5 }, { midi: c.octave, beats: 1 }, { midi: c.fifth, beats: 1.5 }];
      case 3: return [{ midi: c.third, beats: 2 }, { midi: c.second, beats: 1 }, { midi: c.root, beats: 1 }];
    }
  }
  // 'lyrical' (the default): rise, reach the 9th, peak and turn, resolve.
  switch (cell) {
    case 0: return [{ midi: c.third, beats: 1.5 }, { midi: c.fifth, beats: 1 }, { midi: c.sixth, beats: 1.5 }];
    case 1: return [{ midi: c.seventh, beats: 1 }, { midi: c.ninth, beats: 2 }, { midi: c.seventh, beats: 1 }];
    case 2: return [{ midi: c.octave, beats: 1.5 }, { midi: c.sixth, beats: 1 }, { midi: c.fifth, beats: 1.5 }];
    case 3: return [{ midi: c.third, beats: 2 }, { midi: c.second, beats: 1 }, { midi: c.root, beats: 1 }];
  }
}

// A quiet second voice a third below the lead, derived from the lead's own
// resolved pitches (rather than a second pass over the chord) so it always
// lands correctly against whichever cell/variant produced the lead line.
function harmonizeThird(notes: ToneNote[], quality: 'maj' | 'min'): ToneNote[] {
  const interval = quality === 'maj' ? 4 : 3;
  return notes.map((note) => (note.midi === null ? note : { midi: note.midi - interval, beats: note.beats }));
}

// A whole-note chord tone held for the full bar -- one voice of a
// multi-voice sustained pad "section" (paired with attack/release swell
// overrides at the call site), the modern style's stand-in for classic's
// single arpeggiated bass + bare fifth.
function padVoiceBar(
  rootName: string,
  quality: 'maj' | 'min',
  voice: 'root' | 'third' | 'fifth' | 'seventh',
  octave: number
): ToneNote[] {
  const c = chordTones(rootName, quality, octave);
  return [{ midi: c[voice], beats: 4 }];
}

// vampBar's eighth-note ostinato, but touching the 7th on the "and" of beat
// 4 instead of repeating the 5th -- the same driving rhythm-section energy,
// just with the modern style's harmonic color.
function modernVampBar(rootName: string, quality: 'maj' | 'min'): ToneNote[] {
  const c = chordTones(rootName, quality, 0);
  return [
    { midi: c.root, beats: 0.5 }, { midi: c.root, beats: 0.5 }, { midi: c.third, beats: 0.5 }, { midi: c.fifth, beats: 0.5 },
    { midi: c.root, beats: 0.5 }, { midi: c.root, beats: 0.5 }, { midi: c.fifth, beats: 0.5 }, { midi: c.seventh, beats: 0.5 },
  ];
}

interface ModernOverworldScoreConfig {
  bpm: number;
  verse: ChordStep[];
  bridge: ChordStep[];
  variant?: PhraseVariant;
  leadWave?: Wave;
  leadGain?: number;
}

function makeModernOverworldScore(cfg: ModernOverworldScoreConfig): Score {
  const chords = [...cfg.verse, ...cfg.bridge];
  const loopBeats = chords.length * 4;
  const variant = cfg.variant ?? 'lyrical';
  const leadGain = cfg.leadGain ?? 0.14;
  const leadWave = cfg.leadWave ?? 'triangle';

  const lead = chords.flatMap(([r, q], i) => modernPhraseCell(r, q, (i % 4) as 0 | 1 | 2 | 3, variant, 12));
  const harmony = chords.flatMap(([r, q], i) =>
    harmonizeThird(modernPhraseCell(r, q, (i % 4) as 0 | 1 | 2 | 3, variant, 12), q)
  );

  const bass = chords.flatMap(([r, q]) => padVoiceBar(r, q, 'root', 0));
  const padThird = chords.flatMap(([r, q]) => padVoiceBar(r, q, 'third', 0));
  const padFifth = chords.flatMap(([r, q]) => padVoiceBar(r, q, 'fifth', 0));
  const padSeventh = chords.flatMap(([r, q]) => padVoiceBar(r, q, 'seventh', 0));

  return {
    bpm: cfg.bpm,
    loopBeats,
    tracks: [
      { kind: 'tone', wave: 'triangle', gain: 0.09, attack: 0.25, release: 0.4, notes: bass },
      { kind: 'tone', wave: 'sine', gain: 0.03, unison: true, unisonSpread: 5, attack: 0.35, release: 0.5, wet: 0.12, notes: padThird },
      { kind: 'tone', wave: 'sine', gain: 0.03, unison: true, unisonSpread: 5, attack: 0.35, release: 0.5, wet: 0.12, notes: padFifth },
      { kind: 'tone', wave: 'triangle', gain: 0.025, attack: 0.4, release: 0.55, wet: 0.12, notes: padSeventh },
      { kind: 'tone', wave: leadWave, gain: leadGain, unison: true, unisonSpread: 6, wet: 0.08, notes: lead },
      { kind: 'tone', wave: leadWave, gain: leadGain * 0.42, wet: 0.08, notes: harmony },
    ],
  };
}

interface ModernBattleScoreConfig {
  bpm: number;
  mainA: ChordStep[];
  mainB: ChordStep[];
  bProgression: ChordStep[];
  variant?: PhraseVariant;
  subBassMode?: 'followChords' | 'holdTonic';
  kickGen?: (bars: number) => PercNote[];
  snareGen?: (bars: number) => PercNote[];
  hatGen?: (bars: number) => PercNote[];
}

function makeModernBattleScore(cfg: ModernBattleScoreConfig): Score {
  const aProgression = [...cfg.mainA, ...cfg.mainB];
  const bProgression = cfg.bProgression;
  const reprise = cfg.mainA;
  const fullProgression = [...aProgression, ...bProgression, ...reprise];
  const loopBeats = fullProgression.length * 4;
  const variant = cfg.variant ?? 'lyrical';

  const lead = fullProgression.flatMap(([r, q], i) => modernPhraseCell(r, q, (i % 4) as 0 | 1 | 2 | 3, variant, 24));
  const harmony = fullProgression.flatMap(([r, q], i) =>
    harmonizeThird(modernPhraseCell(r, q, (i % 4) as 0 | 1 | 2 | 3, variant, 24), q)
  );

  const subBassNotes = cfg.subBassMode === 'holdTonic'
    ? fullProgression.flatMap(() => subBassBar(cfg.mainA[0][0]))
    : fullProgression.flatMap(([root]) => subBassBar(root));

  const padFifth = fullProgression.flatMap(([r, q]) => padVoiceBar(r, q, 'fifth', 12));
  const padSeventh = fullProgression.flatMap(([r, q]) => padVoiceBar(r, q, 'seventh', 12));

  const kickGen = cfg.kickGen ?? kickPulse;
  const snareGen = cfg.snareGen ?? snarePulse;
  const hatGen = cfg.hatGen ?? hatPulse;

  return {
    bpm: cfg.bpm,
    loopBeats,
    tracks: [
      { kind: 'tone', wave: 'sawtooth', gain: 0.1, drive: true, notes: fullProgression.flatMap(([r, q]) => modernVampBar(r, q)) },
      { kind: 'tone', wave: 'sine', gain: 0.1, notes: subBassNotes },
      { kind: 'tone', wave: 'triangle', gain: 0.03, attack: 0.3, release: 0.4, wet: 0.15, notes: padFifth },
      { kind: 'tone', wave: 'triangle', gain: 0.025, attack: 0.35, release: 0.45, wet: 0.15, notes: padSeventh },
      { kind: 'tone', wave: 'triangle', gain: 0.14, unison: true, unisonSpread: 6, wet: 0.1, notes: lead },
      { kind: 'tone', wave: 'triangle', gain: 0.063, wet: 0.1, notes: harmony },
      { kind: 'tone', wave: 'sawtooth', gain: 0.16, drive: true, notes: battleIntroSting(loopBeats, cfg.mainA[0][0], cfg.mainA[0][1]) },
      { kind: 'kick', gain: 0.85, notes: kickGen(fullProgression.length) },
      { kind: 'snare', gain: 0.45, notes: snareGen(fullProgression.length) },
      { kind: 'hat', gain: 0.2, notes: hatGen(fullProgression.length) },
      {
        kind: 'crash',
        gain: 0.3,
        notes: [
          { hit: true, beats: 4 },
          { hit: false, beats: (aProgression.length + bProgression.length) * 4 - 4 },
          { hit: true, beats: 4 },
          { hit: false, beats: reprise.length * 4 - 4 },
        ],
      },
    ],
  };
}

// One modern config per world, reusing that world's own key/tempo (the same
// progressions/bpm the classic scores above use, given again as literals)
// so a world's identity carries across styles while the arrangement itself
// -- pad texture, phrase shape, harmonization -- differs.
const MODERN_OVERWORLD_SCORE_1 = makeModernOverworldScore({
  bpm: 96,
  verse: [['C3', 'maj'], ['G2', 'maj'], ['A2', 'min'], ['F2', 'maj']],
  bridge: [['D2', 'min'], ['G2', 'maj'], ['C3', 'maj'], ['A2', 'min']],
});
const MODERN_OVERWORLD_SCORE_2 = makeModernOverworldScore({
  bpm: 100,
  verse: [['C3', 'maj'], ['D3', 'maj'], ['C3', 'maj'], ['D3', 'maj']],
  bridge: [['E2', 'min'], ['D3', 'maj'], ['C3', 'maj'], ['D3', 'maj']],
});
const MODERN_OVERWORLD_SCORE_3 = makeModernOverworldScore({
  bpm: 104,
  verse: [['C3', 'maj'], ['A#2', 'maj'], ['C3', 'maj'], ['F2', 'maj']],
  bridge: [['G2', 'min'], ['A#2', 'maj'], ['C3', 'maj'], ['F2', 'maj']],
  variant: 'soaring',
});
const MODERN_OVERWORLD_SCORE_4 = makeModernOverworldScore({
  bpm: 132,
  verse: [['C3', 'min'], ['G#2', 'maj'], ['D#3', 'maj'], ['A#2', 'maj']],
  bridge: [['F2', 'min'], ['C3', 'min'], ['G#2', 'maj'], ['A#2', 'maj']],
});
const MODERN_OVERWORLD_SCORE_5 = makeModernOverworldScore({
  bpm: 84,
  verse: [['C3', 'min'], ['C#3', 'maj'], ['C3', 'min'], ['C#3', 'maj']],
  bridge: [['G#2', 'maj'], ['C#3', 'maj'], ['C3', 'min'], ['C#3', 'maj']],
  variant: 'sparse',
});
const MODERN_OVERWORLD_SCORE_6 = makeModernOverworldScore({
  bpm: 116,
  verse: [['C3', 'maj'], ['G2', 'maj'], ['A2', 'min'], ['F2', 'maj']],
  bridge: [['A2', 'min'], ['F2', 'maj'], ['C3', 'maj'], ['G2', 'maj']],
});
// The classic arrangement's World 7 is a whole-tone canon with no harmony
// under it at all. Pads need chords to hold, so this states the same
// rootlessness the way a chord progression can: major triads whose roots
// climb in major thirds, an augmented cycle that never establishes a tonic.
const MODERN_OVERWORLD_SCORE_7 = makeModernOverworldScore({
  bpm: 76,
  verse: [['F#2', 'maj'], ['A#2', 'maj'], ['D3', 'maj'], ['A#2', 'maj']],
  bridge: [['D3', 'maj'], ['F#2', 'maj'], ['A#2', 'maj'], ['D3', 'maj']],
  variant: 'sparse',
});
const MODERN_OVERWORLD_SCORE_8 = makeModernOverworldScore({
  bpm: 58,
  verse: [['F#2', 'min'], ['G2', 'maj'], ['F#2', 'min'], ['D2', 'maj']],
  bridge: [['B2', 'min'], ['G2', 'maj'], ['F#2', 'min'], ['D2', 'maj']],
  variant: 'sparse',
});
const MODERN_OVERWORLD_SCORE_9 = makeModernOverworldScore({
  bpm: 140,
  verse: [['F#2', 'maj'], ['G2', 'maj'], ['F#2', 'maj'], ['G2', 'maj']],
  bridge: [['B2', 'min'], ['G2', 'maj'], ['F#2', 'maj'], ['G2', 'maj']],
});
const MODERN_OVERWORLD_SCORE_10 = makeModernOverworldScore({
  bpm: 158,
  verse: [['F#2', 'maj'], ['G#2', 'maj'], ['F#2', 'maj'], ['D#2', 'min']],
  bridge: [['G#2', 'maj'], ['D#2', 'min'], ['G#2', 'maj'], ['F#2', 'maj']],
  variant: 'soaring',
});

const MODERN_BATTLE_SCORE_1 = makeModernBattleScore({
  bpm: 160,
  mainA: [['D2', 'min'], ['C2', 'maj'], ['D2', 'min'], ['C2', 'maj']],
  mainB: [['A#2', 'maj'], ['C2', 'maj'], ['A#2', 'maj'], ['C2', 'maj']],
  bProgression: [
    ['G2', 'min'], ['D#2', 'maj'], ['A#2', 'maj'], ['F2', 'maj'],
    ['G2', 'min'], ['D#2', 'maj'], ['A#2', 'maj'], ['F2', 'maj'],
  ],
});
const MODERN_BATTLE_SCORE_2 = makeModernBattleScore({
  bpm: 150,
  mainA: [['A2', 'min'], ['G2', 'maj'], ['A2', 'min'], ['G2', 'maj']],
  mainB: [['F2', 'maj'], ['G2', 'maj'], ['F2', 'maj'], ['G2', 'maj']],
  bProgression: [
    ['D2', 'min'], ['A#2', 'maj'], ['F2', 'maj'], ['C2', 'maj'],
    ['D2', 'min'], ['A#2', 'maj'], ['F2', 'maj'], ['C2', 'maj'],
  ],
});
const MODERN_BATTLE_SCORE_3 = makeModernBattleScore({
  bpm: 148,
  mainA: [['C#2', 'min'], ['B2', 'maj'], ['C#2', 'min'], ['B2', 'maj']],
  mainB: [['A2', 'maj'], ['B2', 'maj'], ['A2', 'maj'], ['B2', 'maj']],
  bProgression: [
    ['F#2', 'min'], ['D2', 'maj'], ['A2', 'maj'], ['E2', 'maj'],
    ['F#2', 'min'], ['D2', 'maj'], ['A2', 'maj'], ['E2', 'maj'],
  ],
  variant: 'soaring',
});
const MODERN_BATTLE_SCORE_4 = makeModernBattleScore({
  bpm: 172,
  mainA: [['E2', 'min'], ['D2', 'maj'], ['E2', 'min'], ['D2', 'maj']],
  mainB: [['C2', 'maj'], ['D2', 'maj'], ['C2', 'maj'], ['D2', 'maj']],
  bProgression: [
    ['A2', 'min'], ['F2', 'maj'], ['C2', 'maj'], ['G2', 'maj'],
    ['A2', 'min'], ['F2', 'maj'], ['C2', 'maj'], ['G2', 'maj'],
  ],
});
const MODERN_BATTLE_SCORE_5 = makeModernBattleScore({
  bpm: 110,
  mainA: [['F2', 'min'], ['D#2', 'maj'], ['F2', 'min'], ['D#2', 'maj']],
  mainB: [['C#2', 'maj'], ['D#2', 'maj'], ['C#2', 'maj'], ['D#2', 'maj']],
  bProgression: [
    ['A#2', 'min'], ['F#2', 'maj'], ['C#2', 'maj'], ['G#2', 'maj'],
    ['A#2', 'min'], ['F#2', 'maj'], ['C#2', 'maj'], ['G#2', 'maj'],
  ],
  // Lead stays 'lyrical' (unlike this world's overworld theme) -- the cold,
  // sparse feel already comes from the half-time kick/snare/hat below, and
  // a battle needs the lead's full phrase rather than the overworld's rests
  // to still read as a fight rather than a pause.
  kickGen: kickPulseSparse,
  snareGen: snarePulseSparse,
  hatGen: hatPulseSparse,
});
const MODERN_BATTLE_SCORE_6 = makeModernBattleScore({
  bpm: 164,
  mainA: [['G2', 'min'], ['F2', 'maj'], ['G2', 'min'], ['F2', 'maj']],
  mainB: [['D#2', 'maj'], ['F2', 'maj'], ['D#2', 'maj'], ['F2', 'maj']],
  bProgression: [
    ['C2', 'min'], ['G#2', 'maj'], ['D#2', 'maj'], ['A#2', 'maj'],
    ['C2', 'min'], ['G#2', 'maj'], ['D#2', 'maj'], ['A#2', 'maj'],
  ],
});
const MODERN_BATTLE_SCORE_7 = makeModernBattleScore({
  bpm: 158,
  mainA: [['B2', 'min'], ['A2', 'maj'], ['B2', 'min'], ['A2', 'maj']],
  mainB: [['G2', 'maj'], ['A2', 'maj'], ['G2', 'maj'], ['A2', 'maj']],
  bProgression: [
    ['E2', 'min'], ['C2', 'maj'], ['G2', 'maj'], ['D2', 'maj'],
    ['E2', 'min'], ['C2', 'maj'], ['G2', 'maj'], ['D2', 'maj'],
  ],
});
const MODERN_BATTLE_SCORE_8 = makeModernBattleScore({
  bpm: 108,
  mainA: [['C2', 'min'], ['A#2', 'maj'], ['C2', 'min'], ['A#2', 'maj']],
  mainB: [['G#2', 'maj'], ['A#2', 'maj'], ['G#2', 'maj'], ['A#2', 'maj']],
  bProgression: [
    ['F2', 'min'], ['C#2', 'maj'], ['G#2', 'maj'], ['D#2', 'maj'],
    ['F2', 'min'], ['C#2', 'maj'], ['G#2', 'maj'], ['D#2', 'maj'],
  ],
  // Lead stays 'lyrical', same reasoning as world 5's battle above.
  kickGen: kickPulseSparse,
  snareGen: snarePulseSparse,
  hatGen: hatPulseSparse,
});
const MODERN_BATTLE_SCORE_9 = makeModernBattleScore({
  bpm: 176,
  mainA: [['D2', 'min'], ['D#2', 'maj'], ['D2', 'min'], ['D#2', 'maj']],
  mainB: [['A2', 'maj'], ['A#2', 'maj'], ['A2', 'maj'], ['A#2', 'maj']],
  bProgression: [
    ['G2', 'min'], ['G#2', 'maj'], ['D2', 'min'], ['D#2', 'maj'],
    ['G2', 'min'], ['G#2', 'maj'], ['D2', 'min'], ['D#2', 'maj'],
  ],
  subBassMode: 'holdTonic',
});
const MODERN_BATTLE_SCORE_10 = makeModernBattleScore({
  bpm: 150,
  mainA: [['F#2', 'min'], ['E2', 'maj'], ['F#2', 'min'], ['E2', 'maj']],
  mainB: [['D2', 'maj'], ['E2', 'maj'], ['D2', 'maj'], ['E2', 'maj']],
  bProgression: [
    ['B2', 'min'], ['G2', 'maj'], ['D2', 'maj'], ['A2', 'maj'],
    ['B2', 'min'], ['G2', 'maj'], ['D2', 'maj'], ['A2', 'maj'],
  ],
  variant: 'soaring',
});

const SCORES_MODERN: Record<string, Score> = {
  'overworld:1': MODERN_OVERWORLD_SCORE_1,
  'overworld:2': MODERN_OVERWORLD_SCORE_2,
  'overworld:3': MODERN_OVERWORLD_SCORE_3,
  'overworld:4': MODERN_OVERWORLD_SCORE_4,
  'overworld:5': MODERN_OVERWORLD_SCORE_5,
  'overworld:6': MODERN_OVERWORLD_SCORE_6,
  'overworld:7': MODERN_OVERWORLD_SCORE_7,
  'overworld:8': MODERN_OVERWORLD_SCORE_8,
  'overworld:9': MODERN_OVERWORLD_SCORE_9,
  'overworld:10': MODERN_OVERWORLD_SCORE_10,
  'battle:1': MODERN_BATTLE_SCORE_1,
  'battle:2': MODERN_BATTLE_SCORE_2,
  'battle:3': MODERN_BATTLE_SCORE_3,
  'battle:4': MODERN_BATTLE_SCORE_4,
  'battle:5': MODERN_BATTLE_SCORE_5,
  'battle:6': MODERN_BATTLE_SCORE_6,
  'battle:7': MODERN_BATTLE_SCORE_7,
  'battle:8': MODERN_BATTLE_SCORE_8,
  'battle:9': MODERN_BATTLE_SCORE_9,
  'battle:10': MODERN_BATTLE_SCORE_10,
};

// Keyed by world number for both scene kinds ('overworld:N'/'battle:N') so
// each of the 10 worlds gets its own theme for each scene; Hub/Title --
// which aren't tied to a specific world number -- use world 1's overworld
// theme as the game's "home" key.
const SCORES: Record<string, Score> = {
  'overworld:1': OVERWORLD_SCORE,
  'overworld:2': OVERWORLD_SCORE_2,
  'overworld:3': OVERWORLD_SCORE_3,
  'overworld:4': OVERWORLD_SCORE_4,
  'overworld:5': OVERWORLD_SCORE_5,
  'overworld:6': OVERWORLD_SCORE_6,
  'overworld:7': OVERWORLD_SCORE_7,
  'overworld:8': OVERWORLD_SCORE_8,
  'overworld:9': OVERWORLD_SCORE_9,
  'overworld:10': OVERWORLD_SCORE_10,
  'battle:1': BATTLE_SCORE,
  'battle:2': BATTLE_SCORE_2,
  'battle:3': BATTLE_SCORE_3,
  'battle:4': BATTLE_SCORE_4,
  'battle:5': BATTLE_SCORE_5,
  'battle:6': BATTLE_SCORE_6,
  'battle:7': BATTLE_SCORE_7,
  'battle:8': BATTLE_SCORE_8,
  'battle:9': BATTLE_SCORE_9,
  'battle:10': BATTLE_SCORE_10,
};

// A track's notes must sum to exactly its score's loopBeats -- scheduleLoop
// advances its own audio-clock cursor by exactly loopBeats*secPerBeat each
// iteration (see MusicEngine.play), so a mismatch isn't cumulative drift,
// it's a voice that cuts out early or overlaps itself at every loop seam.
// Checked once at module load over every score in both tables, since this
// is the one class of bug that typechecks clean and can't be caught by ear
// from a description of the notes.
function assertLoopBeats(key: string, score: Score) {
  for (const track of score.tracks) {
    const sum = track.notes.reduce((total, note) => total + note.beats, 0);
    if (Math.abs(sum - score.loopBeats) > 1e-6) {
      console.error(`music: "${key}" ${track.kind} track sums to ${sum} beats, expected loopBeats=${score.loopBeats}`);
    }
  }
}
for (const [key, score] of Object.entries(SCORES)) assertLoopBeats(key, score);
for (const [key, score] of Object.entries(SCORES_MODERN)) assertLoopBeats(`${key} (modern)`, score);

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
  private current: string | null = null;
  private style: MusicStyle = 'classic';
  private stopToken = 0;
  private timer: number | null = null;
  // The score the game last asked for, as opposed to `current`, the one
  // actually sounding. The two differ while the style is 'mute', which is
  // what lets un-muting resume the right track.
  private wanted: string | null = null;

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
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

  // A short slapback delay with a darkened feedback loop -- the modern
  // style's "hall" send (ToneTrack.wet routes a fraction of a voice's
  // signal here) for a soft reverb-like tail on its pads/lead without a
  // full convolution reverb. Built fresh per play() call and its wet output
  // routed into that same call's own `sessionGain` (`dest` here) rather
  // than straight to master -- crossfading away from a track (play() on a
  // new key, or setStyle() restarting the current one) ramps sessionGain to
  // 0, and since the delay's feedback loop only ever reaches the speakers
  // through that same gain, the outgoing track's echo tail is silenced
  // along with everything else instead of ringing on into the next track.
  // The same routing means duck() (which also only touches sessionGain)
  // ducks the wet tail along with the dry signal, as the player expects.
  private createAmbienceBus(ctx: AudioContext, dest: GainNode): GainNode {
    const input = ctx.createGain();
    input.gain.value = 1;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.19;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const darken = ctx.createBiquadFilter();
    darken.type = 'lowpass';
    darken.frequency.value = 3200;
    const wetOut = ctx.createGain();
    wetOut.gain.value = 0.5;

    input.connect(delay);
    delay.connect(darken);
    darken.connect(feedback);
    feedback.connect(delay);
    darken.connect(wetOut);
    wetOut.connect(dest);

    return input;
  }

  // Which score table play() reads from -- 'classic' (SCORES) or 'modern'
  // (SCORES_MODERN). Restarts whatever's currently playing under the new
  // table (bypassing play()'s own no-op guard, which otherwise treats a
  // style change on the *same* key as nothing happening) so the Settings
  // toggle takes effect immediately rather than on the next scene transition.
  setStyle(style: MusicStyle) {
    if (this.style === style) return;
    this.style = style;
    if (style === 'mute') {
      // `wanted` survives the stop, so picking Classic or Modern again picks
      // the score back up where the game currently is rather than leaving
      // silence until the next scene change happens to call play().
      this.stop();
      return;
    }
    if (this.wanted) {
      this.current = null;
      this.play(this.wanted);
    }
  }

  play(which: string) {
    // Tracked whatever the style is, so the engine always knows which score
    // the game is asking for even while muted.
    this.wanted = which;
    if (this.style === 'mute') {
      this.stop();
      return;
    }
    if (this.current === which) return;
    const table = this.style === 'modern' ? SCORES_MODERN : SCORES;
    const score = table[which] ?? SCORES[which];
    if (!score) {
      // Whatever's currently playing (if anything) is deliberately left
      // running rather than cut to silence -- an unknown key is a bug
      // elsewhere (e.g. a scene passing a world number with no score), and
      // silently keeping the old track audible is a smaller surprise than
      // silently killing the music entirely. Warn so the bug doesn't go
      // unnoticed.
      console.warn(`music.play: no score for "${which}", leaving current track playing`);
      return;
    }
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
    const ambience = this.createAmbienceBus(ctx, sessionGain);

    const secPerBeat = 60 / score.bpm;
    const loopBeatsSeconds = score.loopBeats * secPerBeat;
    const loopMs = loopBeatsSeconds * 1000;
    const token = ++this.stopToken;

    // nextLoopAt is this session's own audio-clock cursor, advanced by
    // exactly one loop's duration each time a batch is scheduled -- not
    // recomputed from ctx.currentTime on every call. ctx.currentTime stays
    // frozen while the AudioContext is suspended (e.g. before the page's
    // first user gesture) even though window.setTimeout keeps firing on its
    // own wall-clock schedule regardless, so a cursor read fresh from
    // ctx.currentTime each iteration would schedule a duplicate copy of the
    // whole score at the same stale audio time on every re-arm. The three
    // branches below are a standard lookahead scheduler: if the audio clock
    // hasn't reached the cursor yet, wait and recheck rather than schedule;
    // if the cursor has fallen behind the audio clock (a throttled
    // background tab's timer firing late), resync it forward first so a
    // catch-up doesn't dump every missed loop's notes at once with
    // start times in the past; otherwise schedule at the cursor and advance
    // it by exactly one loop.
    let nextLoopAt = ctx.currentTime + 0.05;
    const scheduleLoop = () => {
      if (token !== this.stopToken) return;
      if (ctx.currentTime + 0.2 < nextLoopAt) {
        this.timer = window.setTimeout(scheduleLoop, 200);
        return;
      }
      if (nextLoopAt < ctx.currentTime + 0.05) nextLoopAt = ctx.currentTime + 0.05;
      const startAt = nextLoopAt;
      for (const track of score.tracks) {
        this.scheduleTrack(ctx, track, startAt, secPerBeat, sessionGain, ambience);
      }
      nextLoopAt += loopBeatsSeconds;
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

  // Dips the currently-playing track's volume (its own session gain, not the
  // master bus the sfx share) and brings it back up, so the score
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
  // duck(), so an effect's own sound isn't swallowed by its own duck. Sfx sit
  // on the master bus rather than inside a score's session gain, so the
  // Settings panel's Mute style silences the music without silencing them.
  // Also hands back the same cached noise buffer/drive curve the music tracks
  // use, so sfx doesn't need its own copies.
  getSfxBus(): {
    ctx: AudioContext;
    dest: GainNode;
    noiseBuffer: AudioBuffer;
    driveCurve: Float32Array<ArrayBuffer>;
  } {
    const ctx = this.ensureCtx();
    return { ctx, dest: this.master!, noiseBuffer: this.getNoiseBuffer(ctx), driveCurve: this.getDriveCurve() };
  }

  private scheduleTrack(ctx: AudioContext, track: Track, startAt: number, secPerBeat: number, dest: GainNode, ambience: GainNode) {
    let t = startAt;
    if (track.kind === 'tone') {
      const envelope = { attack: track.attack, release: track.release, wet: track.wet };
      for (const note of track.notes) {
        const dur = note.beats * secPerBeat;
        if (note.midi !== null) {
          if (track.unison) {
            const spread = track.unisonSpread ?? 7;
            this.scheduleTone(ctx, track.wave, track.gain * 0.6, note.midi, t, dur, dest, -spread, !!track.drive, envelope, ambience);
            this.scheduleTone(ctx, track.wave, track.gain * 0.6, note.midi, t, dur, dest, spread, !!track.drive, envelope, ambience);
          } else {
            this.scheduleTone(ctx, track.wave, track.gain, note.midi, t, dur, dest, 0, !!track.drive, envelope, ambience);
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
    drive: boolean,
    envelope?: { attack?: number; release?: number; wet?: number },
    ambience?: GainNode
  ) {
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = midiToFreq(midi);
    osc.detune.value = detuneCents;

    const g = ctx.createGain();
    // A ToneTrack's own attack/release (e.g. a modern-style string pad's
    // slow swell) overrides the default fast synth envelope, clamped so a
    // long override can never eat the whole note on an unexpectedly short
    // beat.
    const attack = Math.min(envelope?.attack ?? Math.min(0.02, dur * 0.3), dur * 0.45);
    const release = Math.min(envelope?.release ?? Math.min(0.05, dur * 0.3), dur * 0.45);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + attack);
    g.gain.setValueAtTime(vol, Math.max(time + attack, time + dur - release));
    g.gain.linearRampToValueAtTime(0, time + dur);

    osc.connect(g);
    let outNode: AudioNode = g;
    if (drive) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = this.getDriveCurve();
      shaper.oversample = '2x';
      g.connect(shaper);
      outNode = shaper;
    }
    outNode.connect(dest);
    if (envelope?.wet && ambience) {
      const send = ctx.createGain();
      send.gain.value = envelope.wet;
      outNode.connect(send);
      send.connect(ambience);
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

// No scene ever calls music.stop() -- switching tracks crossfades via
// play() instead, which is right for scene transitions but leaves nothing
// that silences the score on teardown. pagehide covers tab close, reload,
// and navigating away (including cases the page survives in bfcache).
window.addEventListener('pagehide', () => music.stop());
