// World 10 (ML for quantum materials, the Devouring Mirror): the map shape
// isn't its own motif -- it's dispatched by the player's *current* crystal's
// own main type, reusing whichever of worlds 1-8's own generator matches
// that type family's physics, so the world literally mirrors the
// player's own form back at them (DESIGN.md's "a model of you"). A player
// whose type doesn't resolve to one of the eight (no form yet) gets a fresh
// random pick among all eight every time.
//
// OverworldScene.applyPlayerForm re-triggers map generation immediately
// whenever the player transmutes/fuses while standing in World 10, so this
// dispatch is re-evaluated live, not just on first entry.

import type { MaterialType } from '../../data/types';
import { GeneratedMap, GridPoint } from './shared';
import { generateWorld1Map } from './world1';
import { generateWorld2Map } from './world2';
import { generateWorld3Map } from './world3';
import { generateWorld4Map } from './world4';
import { generateWorld5Map } from './world5';
import { generateWorld6Map } from './world6';
import { generateWorld7Map } from './world7';
import { generateWorld8Map } from './world8';

type SubGenerator = (gridW: number, gridH: number, start: GridPoint) => GeneratedMap;

const ALL_SUB_GENERATORS: SubGenerator[] = [
  generateWorld1Map,
  generateWorld2Map,
  generateWorld3Map,
  generateWorld4Map,
  generateWorld5Map,
  generateWorld6Map,
  generateWorld7Map,
  generateWorld8Map,
];

// Ordinary band physics (metal/semiconductor/insulator) all key off world 2
// (Bloch/tight-binding) -- the topic that actually distinguishes the three
// by band filling/gap width in the first place, rather than world 1's
// mean-field symmetry-breaking, which is about how *ordered* phases emerge
// from this baseline, not the baseline types themselves.
const TYPE_TO_GENERATOR: Partial<Record<MaterialType, SubGenerator>> = {
  metal: generateWorld2Map,
  semiconductor: generateWorld2Map,
  insulator: generateWorld2Map,
  classicalMagnet: generateWorld6Map,
  multiferroic: generateWorld6Map,
  ferroelectric: generateWorld6Map,
  quantumSpinLiquid: generateWorld7Map,
  kondoHeavyFermion: generateWorld8Map,
  superconductor: generateWorld5Map,
  chernSuperconductor: generateWorld5Map,
  quantumSpinHall: generateWorld3Map,
  chernInsulator: generateWorld4Map,
  fractionalChern: generateWorld4Map,
};

export function generateWorld10Map(gridW: number, gridH: number, start: GridPoint, playerType: MaterialType | undefined): GeneratedMap {
  const generator = (playerType && TYPE_TO_GENERATOR[playerType]) ?? ALL_SUB_GENERATORS[Math.floor(Math.random() * ALL_SUB_GENERATORS.length)];
  return generator(gridW, gridH, start);
}
