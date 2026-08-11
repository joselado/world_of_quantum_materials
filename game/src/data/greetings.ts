// Flavor text for wild-crystal encounters and battle outcomes. Purely
// cosmetic (no gameplay effect), but tied to a real property of the
// material -- its main `type` -- rather than being fully generic, so a
// magnet and a superconductor don't say the same thing. `{name}` is
// replaced with the wild material's display name.

import type { Material, MaterialType } from './types';

const ENCOUNTER_GREETINGS: Record<MaterialType, string> = {
  trivial: '{name} shrugs. "No topological protection here. Ordinary as it gets."',
  magnet: '{name} bristles, every spin pointing straight at you out of spite.',
  topological: '{name} refuses to be perturbed. "Try the edge, if you dare."',
  qhe: '{name} circles you at a suspiciously quantized radius.',
  supercon: '{name} glides in with zero resistance and zero manners.',
  classicalmag: '{name} snaps all its domains into line, aimed your way.',
  spinliquid: '{name} refuses to settle down, on principle.',
  adaptive: '{name} has already seen your last three moves.',
  multiferroic: '{name} hums with a polarization that shouldn\'t line up with its spins -- and does anyway.',
  chernInsulator: '{name} conducts along its own edge, no field required, thank you.',
};

const VICTORY_LINES: Record<MaterialType, string> = {
  trivial: "The {name} runs out of ordinary tricks. Victory!",
  magnet: "The {name}'s spins flip in defeat.",
  topological: "The {name}'s edge state gives out. You win!",
  qhe: "The {name} drops out of its quantized orbit. Victory!",
  supercon: 'The {name} quenches, resistance and all. Victory!',
  classicalmag: "The {name}'s domains scatter and retreat.",
  spinliquid: 'The {name} finally, reluctantly, orders itself. You win!',
  adaptive: 'The {name} runs out of counter-strategies. Victory!',
  multiferroic: "The {name}'s polarization and spins fall out of lock. Victory!",
  chernInsulator: "The {name}'s edge current finally stalls. Victory!",
};

const DEFEAT_LINES: Record<MaterialType, string> = {
  trivial: 'You run out of ordinary tricks first. The {name} wins.',
  magnet: "The {name}'s spins overwhelm you in unison.",
  topological: "The {name}'s edge states shrug off everything. Defeat.",
  qhe: 'The {name} circles back around and wins.',
  supercon: 'The {name} freezes you out at zero resistance.',
  classicalmag: "The {name}'s domains crush your resolve.",
  spinliquid: 'The {name} outlasts you without ever settling down.',
  adaptive: 'The {name} adapts faster than you can. Defeat.',
  multiferroic: 'The {name} locks its polarization to your every move. Defeat.',
  chernInsulator: "The {name}'s edge current sweeps you off the path. Defeat.",
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
