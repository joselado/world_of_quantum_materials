import Phaser from 'phaser';
import { blend } from '../../../../art/colors';
import { HORIZON_Y, LANE_PX } from '../../../../art/perspective';
import { ellipseSteps } from '../../../../art/shapes';
import { CAMERA_BACK_TILES, DRAW_DISTANCE_TILES, gridH, gridW, projectTile, TILE_SCALE } from '../../projection';
import { hazeTarget } from '../../sky';
import type { AccentTile, TerrainPlan, TerrainView } from '../types';

// 'consuming' (the Devouring Mirror, world 10): the surround is the model
// itself, laid on the ground, and the thing it feeds stands behind the pass.
//
// The sky has been assembling a network since World 7 (art/stars.ts) -- nodes
// and the weights between them, a picture of the final enemy -- and in the
// last world it has come down: the impassable ground is near-black and
// carries the same kind of network, glowing nodes joined by weighted links,
// and it is running. Activation sweeps through it away from the player toward
// the pass, so every step the player takes is fed forward; links spark
// continuously; the net thickens toward the pass as the model converges, and
// its last layers take the player's own colour.
//
// Behind the pass hangs the event horizon: a black disc with the network's
// last links streaming into it. It is the mirror. What falls in carries the
// player's colour, the disc's rim and its accretion take that colour the
// nearer the player comes, and inside the disc the player's own crystal shows
// back, inverted and faint (OverworldScene places it, masked to the disc) --
// the hole absorbs the player and becomes them at once, which is what a
// trained model is. When The Adapted falls the horizon is gone, and what lies
// past the edge is the map of everything it consumed (sky.ts's overlook).
//
// The network is one connected object rather than a tile texture, so the
// overworld draws it in its own pass (drawGroundNetwork) from a graph built
// once per terrain plan -- a link between two tiles cannot be drawn by either
// tile alone. The per-tile accent (drawConsumingAccent) draws a lone node and
// is what the battle arena's surround stand uses, where there is no grid to
// link across.
//
// Everything on the ground lies flat: nodes are foreshortened discs and links
// are lines on the plane. Nothing stands up -- the Mirror's surround is a
// surface phenomenon (WORLDS.md section 2).
const TILE_PX = TILE_SCALE * LANE_PX;

// Node density along the corridor: dense where the player enters, denser at
// the pass. The model converges as the player approaches it.
const NODE_DENSITY_NEAR = 0.27;
const NODE_DENSITY_FAR = 0.5;
// How many rows short of the pass the output layer begins: nodes in this band
// take the player's own colour, strongest at the pass itself.
const MIRROR_ROWS = 12;
// Links reach this many tiles (Chebyshev) and a node keeps at most this many
// forward links, nearest first, so the graph reads as a net rather than as
// hair.
const LINK_REACH = 2;
const MAX_LINKS = 4;
// Lanes past the grid's side edges that still carry nodes, so the network
// runs to the frame edge with the margin ground it lies on.
const SIDE_MARGIN = 9;

// The activation: a train of fronts moving away from the player toward the
// pass, one every SWEEP_MS, each SWEEP_SPAN rows apart, and each node's glow
// decaying over GLOW_DECAY rows once a front has passed it. Nothing behind
// the player fires -- the network ahead is what is reading them.
const SWEEP_MS = 2400;
const SWEEP_SPAN = 12;
const GLOW_DECAY = 1.6;
// Per-node scatter of the front's arrival, in rows, so it crosses the net
// raggedly rather than as a ruled line.
const FRONT_JITTER = 0.9;

// Sparks: a link discharges for one time slice at a time, rolled per link per
// slice, more often where a front is passing and nearer the pass.
const SPARK_SLICE_MS = 130;
const SPARK_BASE = 0.045;

// The event horizon. It is not there from the entrance: it comes in with the
// boss, fading up over the rows between HOLE_REVEAL_ROWS and HOLE_FULL_ROWS
// short of the pass -- the same stretch over which The Adapted's own sprite
// comes out of the fog -- so the player sees the thing standing in the pass
// and what stands behind it together. Its radius grows from HOLE_R_FAR at
// the reveal to HOLE_R_NEAR at the pass, and that same approach is how far
// the mirror has come. It hangs above the horizon line behind the throat,
// HOLE_BEYOND_ROWS past it in lane terms, so it stands still against the pass
// as the player walks. HOLE_R_NEAR is capped where the disc's top edge still
// clears the world-name plate in the top-left corner at the pass.
const HOLE_REVEAL_ROWS = 16;
const HOLE_FULL_ROWS = 10;
const HOLE_R_FAR = 44;
const HOLE_R_NEAR = 62;
const HOLE_BEYOND_ROWS = 3;
const HOLE_LIFT = 0.2;
// Nodes in the last part of the corridor whose links stream up into the hole.
const TRUNK_FROM = 0.72;
const TRUNK_SHARE = 0.5;

// Depth past which the network stops being drawn, and the stretch before it
// over which it fades (paint.ts's DETAIL_MAX_DEPTH / DETAIL_FADE_FROM).
const NET_MAX_DEPTH = 0.75;
const NET_FADE_FROM = NET_MAX_DEPTH * 0.62;
// The projection packs the far rows into a few pixels, where a full-density
// net is a blur that still costs a draw per node and per link. Past
// THIN_FROM_DEPTH a node is drawn only if its hash falls under a share that
// runs down to THIN_TO_SHARE at the cutoff, and a link only if both its ends
// are -- the world's draw budget (scripts/perf-check.mjs) is the reason.
const THIN_FROM_DEPTH = 0.42;
const THIN_TO_SHARE = 0.3;
// A halo is a second fill per node; the far ones are too small to show one.
const HALO_MAX_DEPTH = 0.55;

const NODE_LIGHT = 0xe6dcff;
const LINK_LIGHT = 0xa08ce0;
const SPARK_LIGHT = 0xffffff;
const HOLE_GLOW = 0x7a58c0;
const HOLE_DISC = 0xf0e6ff;
const HOLE_RING = 0xf8f2ff;

interface NetNode {
  x: number;
  y: number;
  // Two independent hashes: one sizes and jitters the node, one weights its
  // links and picks the trunks.
  hash: number;
  hash2: number;
  // Forward links only (toward the pass, or along the row to the right), so
  // every link is stored once.
  links: NetNode[];
  weights: number[];
  // Per-frame scratch, valid while `frame` matches the current frame.
  frame: number;
  sx: number;
  sy: number;
  scale: number;
  depth: number;
  glow: number;
  spark: number;
}

interface NetGraph {
  rows: Map<number, NetNode[]>;
  minRow: number;
  // The pass throat's column, which the event horizon hangs behind.
  throatX: number;
}

// Where the event horizon is on screen this frame, for the pass that draws it
// and for the scene placing the player's reflection inside it. `mirror` is
// how far the approach has come, 0 at the entrance and 1 at the pass.
export interface EventHorizon {
  x: number;
  y: number;
  r: number;
  mirror: number;
  // How far in the reveal is, 0 as the boss first comes into view and 1 once
  // the hole stands fully; everything drawn takes it as an alpha.
  reveal: number;
}

// The same deterministic per-tile hash the Iron Steppe's shards use, so a
// node stands still in the world rather than on the screen.
function hash01(x: number, y: number): number {
  return Math.abs((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1);
}

function isNodeAt(x: number, y: number, density: number): boolean {
  return hash01(x, y) < density;
}

// Where the corridor stands between its entrance and its pass, 0 at the
// bottom row and 1 at the goal row and beyond.
function convergence(y: number, farEdgeRow: number): number {
  const rows = gridH() - 1 - farEdgeRow;
  return rows <= 0 ? 1 : Phaser.Math.Clamp((gridH() - 1 - y) / rows, 0, 1);
}

function densityAt(y: number, farEdgeRow: number): number {
  return NODE_DENSITY_NEAR + (NODE_DENSITY_FAR - NODE_DENSITY_NEAR) * convergence(y, farEdgeRow);
}

function mirrorAt(y: number, farEdgeRow: number): number {
  return Phaser.Math.Clamp(1 - (y - farEdgeRow) / MIRROR_ROWS, 0, 1);
}

// The graph is a property of the grid, so it is built once per plan and
// looked up by the plan itself.
const graphs = new WeakMap<TerrainPlan, NetGraph>();

function graphFor(plan: TerrainPlan): NetGraph {
  const cached = graphs.get(plan);
  if (cached) return cached;
  const graph = buildGraph(plan);
  graphs.set(plan, graph);
  return graph;
}

// Nodes go on impassable ground only. Rows past the far edge repeat the far
// edge row's walkability, the way the depth margin draws them (paint.ts's
// drawMarginRows), so the pass throat stays clear of nodes whether or not the
// road runs on; lanes past the side edges are always impassable. A tile the
// generator built its shape around, or one standing alone in the floor (the
// Stone Lattice's columns, when the map takes that shape), is always a node:
// the network has punched through the road there.
function buildGraph(plan: TerrainPlan): NetGraph {
  const cols = gridW();
  const rows = gridH();
  const farEdgeRow = plan.farEdgeRow;
  const minRow = farEdgeRow - DRAW_DISTANCE_TILES;
  const isPath = (x: number, y: number): boolean => {
    if (x < 0 || x >= cols || y >= rows) return false;
    const row = plan.tiles[Math.max(farEdgeRow, y)];
    return row?.[x]?.kind === 'path';
  };
  const alwaysNode = (x: number, y: number): boolean => {
    if (x < 0 || x >= cols || y < 0 || y >= rows) return false;
    if (plan.tiles[y][x].featureCore) return true;
    return isPath(x - 1, y) && isPath(x + 1, y) && isPath(x, y - 1) && isPath(x, y + 1);
  };

  let throatSum = 0;
  let throatCount = 0;
  for (let x = 0; x < cols; x++) {
    if (isPath(x, farEdgeRow)) {
      throatSum += x;
      throatCount++;
    }
  }
  const throatX = throatCount ? throatSum / throatCount : cols / 2;

  const byKey = new Map<string, NetNode>();
  const rowsMap = new Map<number, NetNode[]>();
  for (let y = minRow; y < rows; y++) {
    const density = densityAt(y, farEdgeRow);
    for (let x = -SIDE_MARGIN; x < cols + SIDE_MARGIN; x++) {
      if (isPath(x, y) || !(isNodeAt(x, y, density) || alwaysNode(x, y))) continue;
      const node: NetNode = {
        x,
        y,
        hash: hash01(x * 3 + 1, y * 7 + 2),
        hash2: hash01(x * 5 + 3, y * 11 + 4),
        links: [],
        weights: [],
        frame: -1,
        sx: 0,
        sy: 0,
        scale: 0,
        depth: 0,
        glow: 0,
        spark: 0,
      };
      byKey.set(`${x},${y}`, node);
      let row = rowsMap.get(y);
      if (!row) rowsMap.set(y, (row = []));
      row.push(node);
    }
  }

  // A link never crosses the corridor: the network is the surround, and a
  // line drawn over the floor would put it on the road.
  const crossesPath = (a: NetNode, b: NetNode): boolean => {
    for (const t of [0.25, 0.5, 0.75]) {
      if (isPath(Math.round(a.x + (b.x - a.x) * t), Math.round(a.y + (b.y - a.y) * t))) return true;
    }
    return false;
  };

  rowsMap.forEach((row) => {
    for (const a of row) {
      const candidates: { node: NetNode; d2: number }[] = [];
      for (let dy = -LINK_REACH; dy <= 0; dy++) {
        for (let dx = -LINK_REACH; dx <= LINK_REACH; dx++) {
          if (dy === 0 && dx <= 0) continue;
          const b = byKey.get(`${a.x + dx},${a.y + dy}`);
          if (!b || crossesPath(a, b)) continue;
          candidates.push({ node: b, d2: dx * dx + dy * dy });
        }
      }
      candidates.sort((p, q) => p.d2 - q.d2);
      for (const { node } of candidates.slice(0, MAX_LINKS)) {
        a.links.push(node);
        const w = hash01(a.x * 7 + node.x * 13 + 5, a.y * 17 + node.y * 19 + 6);
        // Mostly thin, a few heavy: weights, not wiring. Three grades rather
        // than a continuum, so links share line styles (see `line`).
        a.weights.push(w < 0.55 ? 0.65 : w < 0.85 ? 1.1 : 2.1);
      }
    }
  });

  return { rows: rowsMap, minRow, throatX };
}

function netFade(depth: number): number {
  return Phaser.Math.Clamp((NET_MAX_DEPTH - depth) / (NET_MAX_DEPTH - NET_FADE_FROM), 0, 1);
}

// A node's glow from the activation train: how far the nearest front behind
// it has travelled past it, decayed. `ahead` is the node's depth from the
// player in rows; nothing behind the player fires.
function activation(ahead: number, front: number): number {
  if (ahead < 0) return 0;
  const since = (((front - ahead) % SWEEP_SPAN) + SWEEP_SPAN) % SWEEP_SPAN;
  return Math.exp(-since / GLOW_DECAY);
}

let frameCounter = 0;
// The nodes whose links run up into the hole this frame, handed from the
// ground pass to the horizon pass drawn after the atmosphere.
let trunkNodes: NetNode[] = [];

// A style change is a draw op like any other (scripts/perf-check.mjs counts
// them), and a row of nodes at one depth mostly wants the same one, so a
// style is only pushed when it differs from the last. Glow and alpha are
// quantised to steps the eye cannot tell apart to make them repeat; the
// caches are reset at the top of each pass, since other code paints between.
let lastFill = -1;
let lastFillAlpha = -1;
let lastLine = -1;
let lastLineAlpha = -1;
let lastLineWidth = -1;

function resetStyles() {
  lastFill = lastFillAlpha = lastLine = lastLineAlpha = lastLineWidth = -1;
}

function fill(g: Phaser.GameObjects.Graphics, color: number, alpha: number) {
  const a = Math.round(alpha * 40) / 40;
  if (color === lastFill && a === lastFillAlpha) return;
  g.fillStyle(color, a);
  lastFill = color;
  lastFillAlpha = a;
}

function line(g: Phaser.GameObjects.Graphics, width: number, color: number, alpha: number) {
  const a = Math.round(alpha * 40) / 40;
  const w = Math.round(width * 4) / 4;
  if (color === lastLine && a === lastLineAlpha && w === lastLineWidth) return;
  g.lineStyle(w, color, a);
  lastLine = color;
  lastLineAlpha = a;
  lastLineWidth = w;
}

function quantGlow(glow: number): number {
  return Math.round(glow * 8) / 8;
}

// Where the event horizon hangs this frame, or null once The Adapted has
// fallen and the world ends at its cliff instead.
export function eventHorizonAt(view: TerrainView): EventHorizon | null {
  if (view.overlook) return null;
  const rows = view.camY - view.plan.farEdgeRow;
  if (rows >= HOLE_REVEAL_ROWS) return null;
  const graph = graphFor(view.plan);
  const reveal = Phaser.Math.Clamp((HOLE_REVEAL_ROWS - rows) / (HOLE_REVEAL_ROWS - HOLE_FULL_ROWS), 0, 1);
  const approach = Phaser.Math.Clamp((HOLE_REVEAL_ROWS - rows) / (HOLE_REVEAL_ROWS - 2), 0, 1);
  const mirror = Math.pow(approach, 1.2);
  const r = HOLE_R_FAR + (HOLE_R_NEAR - HOLE_R_FAR) * approach;
  const p = projectTile(graph.throatX - view.camX, rows + HOLE_BEYOND_ROWS);
  return { x: p.x, y: HORIZON_Y - HOLE_LIFT * r, r, mirror, reveal };
}

// The overworld's own pass for this material, drawn after the ground sweep
// and before the atmosphere (paint.ts's drawTerrain), so the network lies on
// the ground and the far reach of it hazes out with the ground it lies on.
export function drawGroundNetwork(view: TerrainView) {
  const g = view.gfx;
  const plan = view.plan;
  const graph = graphFor(plan);
  const camX = view.camX;
  const camY = view.camY;
  const frame = ++frameCounter;
  const haze = hazeTarget(view, view.biome);
  const front = ((view.now % SWEEP_MS) / SWEEP_MS) * SWEEP_SPAN;
  const slice = Math.floor(view.now / SPARK_SLICE_MS);
  trunkNodes = [];
  resetStyles();

  // Past the cliff there is nothing, not even this.
  const minRow = Math.max(view.overlook ? plan.farEdgeRow : graph.minRow, Math.floor(camY - DRAW_DISTANCE_TILES));
  const maxRow = Math.min(gridH() - 1, Math.floor(camY) + 2);

  // Project every node in the window first: a link needs both its ends, and
  // its far end may sit in a row this pass has not reached yet.
  const visible: NetNode[] = [];
  for (let y = minRow; y <= maxRow; y++) {
    const row = graph.rows.get(y);
    if (!row) continue;
    const depthFar = camY - y + 0.5;
    if (depthFar + CAMERA_BACK_TILES <= 0) continue;
    const depthRatio = Phaser.Math.Clamp(depthFar / DRAW_DISTANCE_TILES, 0, 1);
    if (depthRatio > NET_MAX_DEPTH) continue;
    const trunkBand = convergence(y, plan.farEdgeRow) >= TRUNK_FROM;
    const keep = depthRatio <= THIN_FROM_DEPTH ? 1 : 1 - (1 - THIN_TO_SHARE) * ((depthRatio - THIN_FROM_DEPTH) / (NET_MAX_DEPTH - THIN_FROM_DEPTH));
    for (const n of row) {
      if (n.hash2 > keep) {
        n.frame = -1;
        continue;
      }
      const p = projectTile(n.x - camX, camY - n.y);
      n.frame = frame;
      n.sx = p.x;
      n.sy = p.y;
      n.scale = p.scale;
      n.depth = depthRatio;
      n.glow = quantGlow(activation(camY - n.y + (n.hash - 0.5) * FRONT_JITTER, front));
      n.spark = 0;
      visible.push(n);
      if (trunkBand && n.hash2 < TRUNK_SHARE) trunkNodes.push(n);
    }
  }

  // Links first, then the signals travelling on them, then the nodes on top
  // of everything that reaches them -- a network is points joined by
  // weights, not lines with points buried under them.
  for (const a of visible) {
    const conv = convergence(a.y, plan.farEdgeRow);
    a.links.forEach((b, i) => {
      if (b.frame !== frame) return;
      const depth = (a.depth + b.depth) / 2;
      const fade = netFade(depth);
      if (fade <= 0) return;
      const lit = Math.max(a.glow, b.glow);
      const w = a.weights[i];
      const color = blend(blend(LINK_LIGHT, NODE_LIGHT, lit * 0.6), haze, a.depth * 0.7);
      line(g, Math.max(0.7, w * 1.8 * a.scale), color, (0.26 + 0.16 * (w - 0.6)) * (0.5 + 0.5 * lit) * fade);
      g.lineBetween(a.sx, a.sy, b.sx, b.sy);

      // The discharge: rolled per link per slice, so a spark holds for one
      // slice and is gone, and the net crackles rather than blinks.
      const roll = hash01(a.x * 31 + b.x * 7 + slice * 0.618, a.y * 13 + b.y * 3 + slice * 0.382);
      if (roll < SPARK_BASE * (0.35 + 1.4 * lit + 0.8 * conv)) {
        drawSpark(g, a, b, roll, fade);
        a.spark = 1;
        b.spark = 1;
      }
    });
  }

  const pulse = blend(SPARK_LIGHT, view.playerColor, 0.45);
  for (const a of visible) {
    const aheadA = camY - a.y + (a.hash - 0.5) * FRONT_JITTER;
    a.links.forEach((b) => {
      if (b.frame !== frame) return;
      const aheadB = camY - b.y + (b.hash - 0.5) * FRONT_JITTER;
      const span = aheadB - aheadA;
      // A link along the row carries no forward signal.
      if (span < 0.2 || aheadA < 0) return;
      const since = (((front - aheadA) % SWEEP_SPAN) + SWEEP_SPAN) % SWEEP_SPAN;
      if (since > span) return;
      const t = since / span;
      const fade = netFade(a.depth + (b.depth - a.depth) * t);
      if (fade <= 0) return;
      const x = a.sx + (b.sx - a.sx) * t;
      const y = a.sy + (b.sy - a.sy) * t;
      const s = a.scale + (b.scale - a.scale) * t;
      const r = 0.055 * TILE_PX * s;
      fill(g, pulse, 0.85 * fade);
      g.fillEllipse(x, y, r * 2.4, r * 1.4);
    });
  }

  for (const n of visible) {
    drawNode(g, n.sx, n.sy, n.scale, n.depth, haze, n.hash, Math.max(n.glow, n.spark), mirrorAt(n.y, plan.farEdgeRow), view.playerColor);
  }
}

// A discharge along a link: a jagged white thread with a soft glow under it.
function drawSpark(g: Phaser.GameObjects.Graphics, a: NetNode, b: NetNode, roll: number, fade: number) {
  const dx = b.sx - a.sx;
  const dy = b.sy - a.sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const pts: { x: number; y: number }[] = [{ x: a.sx, y: a.sy }];
  for (let k = 1; k < 4; k++) {
    const t = k / 4;
    const off = (hash01(roll * 977 + k * 3.1, k * 7.7 + a.x) - 0.5) * 0.3 * len;
    pts.push({ x: a.sx + dx * t + nx * off, y: a.sy + dy * t + ny * off });
  }
  pts.push({ x: b.sx, y: b.sy });
  line(g, 3.2 * a.scale + 1, blend(SPARK_LIGHT, LINK_LIGHT, 0.4), 0.3 * fade);
  g.strokePoints(pts, false);
  line(g, 1.2, SPARK_LIGHT, 0.95 * fade);
  g.strokePoints(pts, false);
}

// One node: a foreshortened disc with a halo, its colour the network's own
// silver-violet tinted toward the player's where the output layer begins,
// and lit up white-hot while a front or a spark is passing it.
function drawNode(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  scale: number,
  depth: number,
  haze: number,
  hash: number,
  glow: number,
  mirror: number,
  playerColor: number
) {
  const fade = netFade(depth);
  if (fade <= 0) return;
  const air = depth * 0.7;
  const u = TILE_PX * scale;
  const r = (0.1 + 0.07 * hash) * u * (1 + 0.45 * mirror);
  const base = blend(NODE_LIGHT, playerColor, Math.round(mirror * 8) * 0.1);
  const lit = blend(base, blend(SPARK_LIGHT, playerColor, 0.35), glow);
  const color = blend(lit, haze, air);

  if (depth < HALO_MAX_DEPTH || glow > 0.3) {
    const haloW = r * 5.2;
    const haloH = r * 2.9;
    fill(g, color, (0.08 + 0.3 * glow + 0.06 * mirror) * fade);
    g.fillEllipse(x, y, haloW, haloH, ellipseSteps(haloW, haloH));
  }
  fill(g, color, (0.7 + 0.3 * glow) * fade);
  g.fillEllipse(x, y, r * 2, r * 1.1);
  if (glow > 0.25) {
    fill(g, SPARK_LIGHT, (glow - 0.25) * 0.9 * fade);
    g.fillEllipse(x, y, r * 0.9, r * 0.5);
  }
}

// Points along an ellipse arc, screen-space angles (y down, so the upper
// half of the ring is the arc from PI to 2*PI).
function arcPoints(cx: number, cy: number, rx: number, ry: number, from: number, to: number, steps: number): { x: number; y: number; a: number }[] {
  const out: { x: number; y: number; a: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    out.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, a });
  }
  return out;
}

// A ring segment by segment, so its brightness can run around it: the
// approaching side of an accretion disc is the bright one (beaming), and the
// bright side turns with the disc.
function drawBeamedArc(g: Phaser.GameObjects.Graphics, pts: { x: number; y: number; a: number }[], width: number, color: number, alpha: number, bright: number) {
  for (let i = 1; i < pts.length; i++) {
    const a = (pts[i - 1].a + pts[i].a) / 2;
    const beam = 0.4 + 0.6 * (0.5 + 0.5 * Math.cos(a - bright));
    g.lineStyle(width, color, alpha * beam);
    g.lineBetween(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
  }
}

// The event horizon and what streams into it, drawn over the atmosphere
// (paint.ts's drawTerrain, beside the Storm Flats' strikes): a black disc is
// the one thing the mist may not soften. Its glow, its accretion and its rim
// all take the player's colour as the approach closes -- the hole is made of
// what it has eaten, and by the pass that is the player.
export function drawEventHorizon(view: TerrainView) {
  const hole = eventHorizonAt(view);
  if (!hole) return;
  const g = view.gfx;
  const { x, y, r, mirror, reveal } = hole;
  const player = view.playerColor;
  const now = view.now;
  const glowC = blend(HOLE_GLOW, player, 0.5 * mirror);
  const discC = blend(HOLE_DISC, player, 0.3 + 0.5 * mirror);
  const ringC = blend(HOLE_RING, player, 0.2 + 0.3 * mirror);
  const bright = now / 3200;

  // The last of the network runs up into it.
  const trunkC = blend(LINK_LIGHT, player, 0.5);
  for (const n of trunkNodes) {
    const fade = netFade(n.depth);
    if (fade <= 0) continue;
    g.lineStyle(1, trunkC, 0.18 * fade * reveal);
    g.lineBetween(n.sx, n.sy, x, y + r * 0.2);
    // What travels up a trunk falls in faster the nearer it gets.
    const t = Math.pow((now / 1800 + n.hash) % 1, 1.8);
    const px = n.sx + (x - n.sx) * t;
    const py = n.sy + (y + r * 0.2 - n.sy) * t;
    g.fillStyle(blend(player, SPARK_LIGHT, t * 0.6), (0.35 + 0.6 * t) * fade * reveal);
    g.fillEllipse(px, py, 3 + 2 * t, 2 + 1.4 * t);
  }

  // The glow the disc sits in.
  [
    [3.4, 2.0, 0.05],
    [2.7, 1.65, 0.07],
    [2.1, 1.35, 0.1],
  ].forEach(([fx, fy, a]) => {
    g.fillStyle(glowC, (a + 0.05 * mirror) * reveal);
    g.fillEllipse(x, y, r * fx * 2, r * fy * 2, ellipseSteps(r * fx * 2, r * fy * 2));
  });

  // The far side of the disc, lensed up over the top of the shadow, and the
  // back half of the disc itself behind it.
  drawBeamedArc(g, arcPoints(x, y - r * 0.05, r * 1.45, r * 1.3, Math.PI, Math.PI * 2, 40), Math.max(1.2, r * 0.06), discC, 0.4 * reveal, bright);
  drawBeamedArc(g, arcPoints(x, y, r * 2.4, r * 0.62, Math.PI, Math.PI * 2, 40), Math.max(1.5, r * 0.14), discC, 0.75 * reveal, bright);

  // The shadow. Black, then the mirror's glass over it: the player's colour
  // pooled at the centre, a highlight on the curve.
  g.fillStyle(0x000000, reveal);
  g.fillCircle(x, y, r);
  const glass = blend(0x000000, player, 0.35);
  [
    [0.97, 0.12],
    [0.7, 0.12],
    [0.42, 0.14],
  ].forEach(([f, a]) => {
    g.fillStyle(glass, (a + 0.16 * mirror) * (0.4 + 0.6 * mirror) * reveal);
    g.fillCircle(x, y, r * f);
  });
  g.fillStyle(HOLE_RING, (0.12 + 0.08 * mirror) * reveal);
  g.fillEllipse(x - r * 0.36, y - r * 0.42, r * 0.5, r * 0.26);

  // The photon ring, and outside it the ring that is the player's own light
  // bent round the hole -- the reflection, brightening as they close.
  g.lineStyle(Math.max(1.5, r * 0.05), ringC, 0.9 * reveal);
  g.strokeCircle(x, y, r * 1.04);
  g.lineStyle(Math.max(2, r * 0.1), ringC, 0.3 * reveal);
  g.strokeCircle(x, y, r * 1.1);
  g.lineStyle(Math.max(1, r * 0.03), blend(player, HOLE_RING, 0.3), (0.25 + 0.5 * mirror) * reveal);
  g.strokeCircle(x, y, r * 1.28);

  // The front half of the disc, across the shadow.
  drawBeamedArc(g, arcPoints(x, y, r * 2.4, r * 0.62, 0, Math.PI, 40), Math.max(1.5, r * 0.14), discC, 0.85 * reveal, bright);

  // Motes spiralling in along the disc: the player's colour, burning white
  // as it goes under. One that has crossed the shadow's edge is gone.
  for (let i = 0; i < 14; i++) {
    const phase = (now / 2800 + i * 0.173) % 1;
    const rad = r * (2.4 - 1.35 * phase);
    const a = now / 700 + i * 2.4 + phase * 4;
    const mx = x + Math.cos(a) * rad;
    const my = y + Math.sin(a) * rad * 0.26;
    if (Math.hypot(mx - x, my - y) < r * 1.02) continue;
    const size = (1.2 + 2.2 * phase) * Math.max(0.5, r / 60);
    g.fillStyle(blend(player, SPARK_LIGHT, phase * 0.8), (0.3 + 0.7 * phase) * reveal);
    g.fillEllipse(mx, my, size * 2, size * 1.3);
  }
}

// The reflection inside the horizon: not the player's crystal but a network
// in the player's shape -- the scene clips this to the avatar's own
// silhouette (OverworldScene's mirror ghost), inverted. A triangular lattice
// of nodes and links over the disc, in the player's colour, sparking on the
// same clock as the ground; a copy assembled out of samples, which is what
// the model holds of the player, and which never quite resolves into them.
const REFLECT_SPACING = 0.19;

export function drawReflectionNet(g: Phaser.GameObjects.Graphics, hole: EventHorizon, playerColor: number, now: number) {
  const { x, y, r, mirror, reveal } = hole;
  const alpha = reveal * (0.55 + 0.45 * mirror);
  const step = r * REFLECT_SPACING;
  const rowStep = step * 0.866;
  const nodeC = blend(playerColor, SPARK_LIGHT, 0.45);
  const linkC = blend(playerColor, SPARK_LIGHT, 0.2);
  const slice = Math.floor(now / SPARK_SLICE_MS);
  const rows = Math.ceil((r * 1.1) / rowStep);
  const cols = Math.ceil((r * 1.1) / step) + 1;
  const at = (i: number, j: number) => {
    const jx = (hash01(i * 3 + 11, j * 5 + 7) - 0.5) * step * 0.45;
    const jy = (hash01(i * 7 + 3, j * 11 + 5) - 0.5) * step * 0.45;
    return { x: x + (j + (i & 1) * 0.5) * step + jx, y: y + i * rowStep + jy };
  };
  const inside = (p: { x: number; y: number }) => Math.hypot(p.x - x, p.y - y) < r * 1.05;

  // Links: to the right neighbour and to the two below, which covers every
  // edge of the lattice once.
  for (let i = -rows; i <= rows; i++) {
    for (let j = -cols; j <= cols; j++) {
      const a = at(i, j);
      if (!inside(a)) continue;
      const odd = i & 1;
      [
        [i, j + 1],
        [i + 1, j - 1 + odd],
        [i + 1, j + odd],
      ].forEach(([bi, bj]) => {
        const b = at(bi, bj);
        if (!inside(b)) return;
        const w = hash01(i * 13 + bi * 17 + 1, j * 19 + bj * 23 + 2);
        const roll = hash01(i * 31 + bi * 7 + slice * 0.618, j * 13 + bj * 3 + slice * 0.382);
        const spark = roll < 0.06;
        g.lineStyle(spark ? 1.6 : 0.6 + 1.2 * w * w, spark ? SPARK_LIGHT : linkC, (spark ? 0.95 : 0.35 + 0.3 * w) * alpha);
        g.lineBetween(a.x, a.y, b.x, b.y);
      });
    }
  }
  // Nodes, breathing out of phase, on top of the links that reach them.
  for (let i = -rows; i <= rows; i++) {
    for (let j = -cols; j <= cols; j++) {
      const p = at(i, j);
      if (!inside(p)) continue;
      const h = hash01(i * 5 + 1, j * 3 + 2);
      const glow = 0.5 + 0.5 * Math.sin(now / 700 + h * Math.PI * 2);
      const nr = step * (0.13 + 0.1 * h);
      g.fillStyle(nodeC, (0.12 + 0.2 * glow) * alpha);
      g.fillCircle(p.x, p.y, nr * 2.6);
      g.fillStyle(blend(nodeC, SPARK_LIGHT, glow * 0.6), (0.75 + 0.25 * glow) * alpha);
      g.fillCircle(p.x, p.y, nr);
    }
  }
}

// The per-tile accent, for contexts with no grid to link across (the battle
// arena's surround stand): a lone node on the tiles that would carry one,
// breathing on the clock as if a front were passing.
export function drawConsumingAccent(g: Phaser.GameObjects.Graphics, { cx, cy, s, gx, gy, depth, haze, detail, playerColor, now }: AccentTile) {
  if (detail <= 0) return;
  if (!isNodeAt(gx, gy, NODE_DENSITY_FAR)) return;
  const hash = hash01(gx * 3 + 1, gy * 7 + 2);
  const glow = Math.max(0, Math.sin(now / 900 + hash * Math.PI * 2)) ** 3;
  drawNode(g, cx, cy, s, depth, haze, hash, glow, 0.3, playerColor);
}
