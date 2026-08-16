import type { GuardianPanelHost } from '../OverworldScene';
import { TUNABLE_MOVE_CLASSES, canHost } from '../../data/materials';
import type { MoveClass } from '../../data/types';

// Which quasiparticles a tunable move can be told to carry, for the two
// guardians who sell tunable moves (Landau's Analytic pair,
// scenes/panels/landau.ts; Skłodowska-Curie's Ultimate pair,
// scenes/panels/sklodowskaCurie.ts). Each lists these as the entries under
// whichever of its moves is open in the panel's own two-level left column
// (listDetail.ts's renderTreeHeading). Only offers
// classes the player's *current* form can actually host (TUNABLE_MOVE_CLASSES
// filtered through canHost) -- "which quasiparticle should this carry" is
// meant to be a real physics choice grounded in what the player's own
// crystal can host right now, not a free pick from every class in the game
// regardless of how little sense it makes for the current form; retuning
// later (after transmuting into a different form) just re-renders this same
// filtered list. 'phonon' is on every MOVE_COMPATIBILITY list, so the
// filtered list is never empty.
export function hostableClasses(scene: GuardianPanelHost): MoveClass[] {
  return TUNABLE_MOVE_CLASSES.filter((cls) => canHost(scene.playerMaterial.type, cls));
}
