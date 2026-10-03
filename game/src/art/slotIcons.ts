import Phaser from 'phaser';
import { REFERENCE_BLUE_GREY } from '../ui/theme';

// Franklin's passive slots drawn as icons (data/passives.ts, DESIGN.md §5):
// one small diamond per slot, in Franklin's own lavender. The same icon says
// both things a player needs to read about slots -- how many an ability
// takes (a row of filled diamonds beside it) and how the crystal's own
// slots stand (one diamond per slot it could ever own, PASSIVE_MAX_SLOTS):
//
// - **filled** -- a slot an ability takes, or one an active ability is using
// - **open** -- a slot the crystal owns that nothing is using yet
// - **locked** -- a slot not bought yet, a faint blue-grey outline
//
// Shared by Franklin's panel (scenes/panels/franklin.ts) and the Lab's
// Abilities station (scenes/panels/hubStations.ts), so the two can never
// draw a slot two different ways.
export type SlotPipState = 'filled' | 'open' | 'locked';

const SLOT_COLOR = 0xc9a8e0;

// Half-diagonal of one diamond at a given text scale: big enough to read
// beside a list row's label, capped so three of them stay a short group in
// the 200px list column at the largest preset.
export function slotPipRadius(textScale: number): number {
  return Math.round(4 * Math.min(textScale, 1.5));
}

function pipGap(r: number): number {
  return Math.max(3, Math.round(r * 0.9));
}

// The width a row of `count` diamonds of half-diagonal `r` occupies.
export function slotPipsWidth(count: number, r: number): number {
  return count <= 0 ? 0 : count * 2 * r + (count - 1) * pipGap(r);
}

// One diamond per entry of `states`, left to right, drawn centered on the
// returned Graphics' own origin -- the caller positions it with setPosition.
export function makeSlotPips(scene: Phaser.Scene, states: SlotPipState[], r: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const gap = pipGap(r);
  const total = slotPipsWidth(states.length, r);
  states.forEach((state, i) => {
    const cx = -total / 2 + r + i * (2 * r + gap);
    const pts = [
      new Phaser.Math.Vector2(cx, -r),
      new Phaser.Math.Vector2(cx + r, 0),
      new Phaser.Math.Vector2(cx, r),
      new Phaser.Math.Vector2(cx - r, 0),
    ];
    if (state === 'filled') {
      g.fillStyle(SLOT_COLOR, 1);
      g.fillPoints(pts, true);
    } else if (state === 'open') {
      g.lineStyle(1.5, SLOT_COLOR, 0.95);
      g.strokePoints(pts, true);
    } else {
      g.lineStyle(1, REFERENCE_BLUE_GREY, 0.5);
      g.strokePoints(pts, true);
    }
  });
  return g;
}

// The crystal's whole slot ladder for an owner: `used` filled, the rest of
// the `owned` ones open, and the ones not bought yet locked.
export function slotMeterStates(used: number, owned: number, max: number): SlotPipState[] {
  return Array.from({ length: max }, (_, i) => (i < used ? 'filled' : i < owned ? 'open' : 'locked'));
}
