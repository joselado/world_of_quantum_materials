import type { AccentDraw, OffPathKind } from '../types';
import { drawRockAccent } from './rock';
import { drawForestAccent } from './forest';
import { drawColumnsAccent } from './columns';
import { drawDeadFloorAccent } from './deadFloor';
import { drawChargedAccent } from './charged';
import { drawLavaAccent, drawLavaDrum } from './lava';
import { drawIceAccent } from './ice';
import { drawCoastAccent, drawCoastBoulder } from './coast';
import { drawBogAccent, drawBogReeds } from './bog';
import { drawConsumingAccent } from './consuming';

// One off-path material per module, reached through this table. Every
// impassable tile is flat ground in its biome's own off-path color, sitting in
// the same plane as the walkable floor; what its material decides is only the
// accent laid over that fill, so each world's impassable terrain still reads
// as its own substance. A material that is bare ground has neither part and
// pays nothing per tile beyond its fill.
//
// An accent has two parts, and a material may have either or both. `flat` is
// what lies on the tile's ground: a wash, a crack, a light on the water. It is
// drawn with the tile, from the tile's outline as the ground fill draws it and
// about the tile's centre, which is a point of the ground (`cx`/`cy`).
// `standing` is what rises off the ground: a tree, a column, a
// boulder, a clump of reeds, the rubble. It stands on a ground point of its
// own, found from the tile's `lane`/`ahead` with no clamp at the camera's
// plane (../standing.ts), and the paint pass (../paint.ts) treats it two ways
// apart from a flat part. It holds a row's standing parts until the row's
// sweep ends (drawRowStanding), so the ground of the tiles beside an object is
// down before the object that reaches over it. And it still draws them on a
// row whose ground has passed under the camera (drawRowPastCamera), where the
// foot is below the frame and the top is not. Something that stands but is
// drawn in the flat part is cut by the ground of the tile beside it and is
// removed with its tile's ground, while still in view, so a new standing
// object belongs in `standing`. A tall one also asks ../standing.ts which
// layer it goes in, since it can stand in front of the player's crystal.
//
// Adding a material means adding a module here and a `wallTheme` in
// art/biomes.ts (plus the matching TerrainKind in ../types.ts) -- nothing in
// the paint pass itself has to change.
export interface TerrainMaterial {
  flat: AccentDraw | null;
  standing: AccentDraw | null;
}

export const TERRAIN_MATERIALS: Record<OffPathKind, TerrainMaterial> = {
  solid: { flat: drawRockAccent, standing: null },
  forest: { flat: null, standing: drawForestAccent },
  columns: { flat: null, standing: drawColumnsAccent },
  deadFloor: { flat: null, standing: drawDeadFloorAccent },
  charged: { flat: drawChargedAccent, standing: null },
  lava: { flat: drawLavaAccent, standing: drawLavaDrum },
  ice: { flat: drawIceAccent, standing: null },
  coast: { flat: drawCoastAccent, standing: drawCoastBoulder },
  bog: { flat: drawBogAccent, standing: drawBogReeds },
  consuming: { flat: drawConsumingAccent, standing: null },
};

// The whole accent of each material as one draw, its flat part and then its
// standing part: what the battle arena's stand draws (BattleScene's
// drawSurroundStand), tile by tile, with no row to hold anything back for.
function whole({ flat, standing }: TerrainMaterial): AccentDraw | null {
  if (!flat || !standing) return flat ?? standing;
  return (g, tile) => {
    flat(g, tile);
    standing(g, tile);
  };
}

export const TERRAIN_ACCENTS = Object.fromEntries(
  Object.entries(TERRAIN_MATERIALS).map(([kind, material]) => [kind, whole(material)])
) as Record<OffPathKind, AccentDraw | null>;
