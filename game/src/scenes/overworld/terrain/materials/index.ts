import type { AccentDraw, OffPathKind } from '../types';
import { drawRockAccent } from './rock';
import { drawForestAccent } from './forest';
import { drawLavaAccent } from './lava';
import { drawWaterAccent } from './water';
import { drawVoidAccent } from './void';

// One off-path material per module, reached through this table. Every
// impassable tile is flat ground in its biome's own off-path color, sitting in
// the same plane as the walkable floor; what its material decides is only the
// accent laid over that fill, so each world's impassable terrain still reads
// as its own substance. A material that is bare ground maps to null and pays
// nothing per tile beyond its fill.
//
// Adding a material means adding a module here and a `wallTheme` in
// art/biomes.ts (plus the matching TerrainKind in ../types.ts) -- nothing in
// the paint pass itself has to change.
export const TERRAIN_ACCENTS: Record<OffPathKind, AccentDraw | null> = {
  solid: drawRockAccent,
  forest: drawForestAccent,
  lava: drawLavaAccent,
  water: drawWaterAccent,
  void: drawVoidAccent,
};
