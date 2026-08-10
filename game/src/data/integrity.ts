import { MOVES, PLAYER_MATERIAL, WORLD_CRYSTALS, WORLD_RIVALS, getRival } from './materials';
import { BIOMES } from '../art/biomes';

// Dev-only cross-reference checks, run once from main.ts. The database
// (crystal roster, moves, biomes) is hand-typed and growing, and nothing
// stops one table drifting out of sync with another it points at by id --
// that's exactly what happened when the disorderPulse move was retired
// from MOVES while an old save's unlockedMoves still named it, crashing
// the Moves panel only for players who'd bought it. These checks turn that
// class of bug into a thrown error on the very next `npm run dev` instead
// of a runtime crash a specific save/player stumbles into later.
export function checkDataIntegrity(builtWorlds: number[]): void {
  const problems: string[] = [];

  const allMaterials = [
    PLAYER_MATERIAL,
    ...Object.values(WORLD_CRYSTALS).flat(),
    ...Object.values(WORLD_RIVALS),
  ].filter((material): material is NonNullable<typeof material> => !!material);
  for (const material of allMaterials) {
    for (const moveId of material.moves) {
      if (!(moveId in MOVES)) {
        problems.push(`Material "${material.name}" lists unknown move id "${moveId}" (not in MOVES)`);
      }
    }
  }

  for (const world of builtWorlds) {
    if (!(world in BIOMES)) {
      problems.push(`World ${world} is in BUILT_WORLDS but has no biomes.ts entry`);
    }
    if (!getRival(world)) {
      problems.push(`World ${world} is in BUILT_WORLDS but has no WORLD_RIVALS entry -- its gate can't open`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Data integrity check failed:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  }
}
