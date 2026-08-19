// Flavor text for wild-crystal encounters and battle outcomes. Purely
// cosmetic (no gameplay effect), but tied to a real property of the
// material -- its main `type` -- rather than being fully generic, so a
// magnet and a superconductor don't say the same thing. `{name}` is
// replaced with the wild material's display name.

import type { Material, MaterialType } from './types';

const ENCOUNTER_GREETINGS: Record<MaterialType, string> = {
  metal: '{name} shrugs. "No topological protection here. Ordinary as it gets."',
  insulator: '{name} doesn\'t budge. Its gap is wide enough that nothing crosses it easily.',
  semiconductor: '{name} sits behind its own modest gap, waiting for you to cross it.',
  metallicMagnet: '{name} snaps its moments into line and runs a current straight through them, aimed your way.',
  insulatingMagnet: '{name} locks its moments into line behind a gap no carrier crosses.',
  quantumSpinLiquid: '{name} refuses to settle down, on principle.',
  kondoHeavyFermion: '{name} moves like it weighs a thousand times what it should.',
  superconductor: '{name} glides in with zero resistance and zero manners.',
  chernSuperconductor: '{name} pairs up and braids a knot you cannot easily untie.',
  chernInsulator: '{name} circles you at a suspiciously quantized conductance.',
  quantumSpinHall: '{name} refuses to be perturbed. "Try the edge, if you dare. It runs both ways."',
  fractionalChern: '{name} splits its own charge into pieces you cannot recombine.',
  ferroelectric: '{name} points the same way no matter how you look at it.',
  multiferroic: '{name} hums with a polarization that shouldn\'t line up with its spins, and does anyway.',
};

const VICTORY_LINES: Record<MaterialType, string> = {
  metal: "The {name} runs out of ordinary tricks. Victory!",
  insulator: "The {name}'s gap finally works against it. Victory!",
  semiconductor: 'The {name} runs dry of carriers to cross its own gap. Victory!',
  metallicMagnet: "The {name}'s moments scatter and its current dies away. Victory!",
  insulatingMagnet: "The {name}'s ordered moments fall out of line. Victory!",
  quantumSpinLiquid: 'The {name} finally, reluctantly, orders itself. You win!',
  kondoHeavyFermion: "The {name}'s heavy quasiparticles finally break apart. Victory!",
  superconductor: 'The {name} quenches, resistance and all. Victory!',
  chernSuperconductor: "The {name}'s pairs come undone. Victory!",
  chernInsulator: "The {name} drops out of its quantized state. Victory!",
  quantumSpinHall: "The {name}'s helical edge finally scatters. Victory!",
  fractionalChern: "The {name}'s fractional pieces finally recombine. Victory!",
  ferroelectric: "The {name}'s polarization finally flips out of your favor. Victory!",
  multiferroic: "The {name}'s polarization and spins fall out of lock. Victory!",
};

const DEFEAT_LINES: Record<MaterialType, string> = {
  metal: 'You run out of ordinary tricks first. The {name} wins.',
  insulator: "The {name}'s gap shrugs off everything you throw at it. Defeat.",
  semiconductor: 'The {name} outlasts you from behind its own gap.',
  metallicMagnet: "The {name}'s moments crush your resolve, current and all.",
  insulatingMagnet: "The {name}'s moments hold their line while yours breaks. Defeat.",
  quantumSpinLiquid: 'The {name} outlasts you without ever settling down.',
  kondoHeavyFermion: "The {name}'s heavy quasiparticles grind you down. Defeat.",
  superconductor: 'The {name} freezes you out at zero resistance.',
  chernSuperconductor: "The {name}'s braided pairs are impossible to untangle. Defeat.",
  chernInsulator: 'The {name} circles back around and wins.',
  quantumSpinHall: "The {name}'s helical edge carries it straight past you. Defeat.",
  fractionalChern: "The {name}'s fractional pieces slip through every hit. Defeat.",
  ferroelectric: "The {name} never wavers from its own polarization. Defeat.",
  multiferroic: 'The {name} locks its polarization to your every move. Defeat.',
};

function fill(template: string, name: string): string {
  return template.replace('{name}', name);
}

export function encounterGreeting(material: Material): string {
  return fill(ENCOUNTER_GREETINGS[material.type], material.name);
}

export function victoryLine(material: Material): string {
  return fill(VICTORY_LINES[material.type], material.name);
}

export function defeatLine(material: Material): string {
  return fill(DEFEAT_LINES[material.type], material.name);
}
