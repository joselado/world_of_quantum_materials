// World 1 (mean-field theory, spontaneous symmetry breaking): open field,
// hemmed in by forest, with a hedgerow running down the middle of it for a
// stretch. The hedgerow opens out of nothing, widens, and closes again, and
// while it stands the field is two fields -- one on each side of it, tinted
// distinctly -- which is the pair of degenerate symmetry-broken ground states
// a mean-field/Hubbard-U treatment can settle into.
//
// The symmetry breaking is drawn as the thing dividing the ground rather than
// as two thin lanes: before the hedgerow there is one field and no reason to
// prefer a side, while it stands there is no way across, and after it the two
// are one field again. The player picks a state by picking a side, and cannot
// unpick it until the hedgerow ends.
//
// Noether (conservation laws) stands in the single field past the hedgerow,
// where the symmetry is whole again.

import {
  GeneratedMap,
  GridPoint,
  NullableNumberGrid,
  WorldScale,
  WanderBand,
  clamp,
  makeColorGrid,
  makeGrid,
  paintBands,
  punchIslands,
  wanderBands,
  widestRunCenter,
} from './shared';

const FIELD_WIDTH = 15;
// The hedgerow at its thickest. What is left either side of it is a half-field
// the player walks the length of, so this is bounded by the field's own width
// rather than chosen freely.
const HEDGE_WIDTH = 6;
const HEDGE_RAMP_ROWS = 3;
const LEFT_COLOR = 0x5ad9ff; // cool blue -- one broken-symmetry ground state
const RIGHT_COLOR = 0xff6a6a; // warm coral -- the other

export function generateWorld1Map(gridW: number, gridH: number, start: GridPoint, scale: WorldScale): GeneratedMap {
  const goalY = 1;
  const bands = wanderBands(gridW, start.x, start.y, goalY, { width: scale.tiles(FIELD_WIDTH), scale });

  const walkable = makeGrid(gridW, gridH);
  paintBands(walkable, gridW, bands);

  const regionColor = makeColorGrid(gridW, gridH);
  const hedgeStart = Math.round(bands.length * 0.24);
  const hedgeEnd = Math.min(bands.length - 1, Math.round(bands.length * 0.56));
  const hedge = hedgeTiles(bands, hedgeStart, hedgeEnd, scale, regionColor);
  punchIslands(walkable, gridW, gridH, [hedge]);

  const goalBand = bands[bands.length - 1];
  const goal = { x: widestRunCenter(walkable, gridW, goalBand.y) ?? goalBand.center, y: goalBand.y };

  // Comfortably past the hedgerow and comfortably before the goal: the
  // guardian belongs in whole field, and its chokepoint must not land on a row
  // the pass taper also wants.
  const midIdx = clamp(Math.round((hedgeEnd + bands.length) / 2), hedgeEnd + 1, bands.length - 1 - scale.tiles(3));
  const midBand = bands[midIdx] ?? goalBand;
  const mid = { x: widestRunCenter(walkable, gridW, midBand.y) ?? midBand.center, y: midBand.y };

  return { walkable, start, goal, mid, regionColor, biomeOverride: makeColorGrid(gridW, gridH), featureCores: [] };
}

// The hedgerow's own tiles, and the tint either side of it. Both come off the
// same centre line, so the colour boundary and the thing causing it can never
// disagree: a tile is tinted for the state it is on the side of.
//
// The hedgerow is punched as a single island, all of it or none -- a gap in it
// would be a way across, and a way across is the player unpicking a choice the
// world has already made them make. So it is placed against the ground the
// field is guaranteed to hold for a few rows either side rather than against
// the row it sits on: the field wanders, and a hedgerow centred row by row on
// a drifting field can reach past what the neighbouring rows actually cover.
function hedgeTiles(
  bands: WanderBand[],
  from: number,
  to: number,
  scale: WorldScale,
  regionColor: NullableNumberGrid
): GridPoint[] {
  const tiles: GridPoint[] = [];
  const ramp = scale.tiles(HEDGE_RAMP_ROWS, 1);
  const reach = 2; // the clearance punchIslands will ask for on every side

  for (let i = from; i <= to; i++) {
    const band = bands[i];
    let windowLeft = band.left;
    let windowRight = band.right;
    for (let j = Math.max(0, i - reach); j <= Math.min(bands.length - 1, i + reach); j++) {
      windowLeft = Math.max(windowLeft, bands[j].left);
      windowRight = Math.min(windowRight, bands[j].right);
    }

    const t = clamp(Math.min(i - from, to - i) / ramp, 0, 1);
    const room = windowRight - windowLeft + 1 - 2 * reach;
    const width = Math.min(Math.round(t * scale.tiles(HEDGE_WIDTH)), Math.max(0, room));
    if (width <= 0) continue;

    const center = Math.round((windowLeft + windowRight) / 2);
    const left = center - Math.floor(width / 2);
    const right = left + width - 1;
    for (let x = left; x <= right; x++) tiles.push({ x, y: band.y });

    // The two states, and only while there are two: the ramp rows at either
    // end carry no hedgerow, so the field there is one field and takes no
    // colour.
    for (let x = band.left; x < left; x++) regionColor[band.y][x] = LEFT_COLOR;
    for (let x = right + 1; x <= band.right; x++) regionColor[band.y][x] = RIGHT_COLOR;
  }

  return tiles;
}
