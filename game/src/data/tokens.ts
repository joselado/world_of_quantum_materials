// Qumatessence economy: ten ascending value tiers, each with its own
// distinct color, form one global ladder from World 1's trickle to World
// 10's jackpot. Which tiers a given world can roll is a window of tiers
// centered on the world number (World W draws from tiers [W-1, W, W+1],
// clamped to [1, 10]) -- so World 1 only ever pays tiers 1-2, World 10 only
// ever pays tiers 9-10, and the window slides smoothly through the ladder
// in between (World 5 -> tiers 4-6). Within a window the lower tier is
// weighted more common and the upper tier rarer, mirroring the shape of a
// simple common/uncommon/rare split, sized to however many tiers are
// actually in the window -- rewarding the longer/deeper dead-end branches
// without guaranteeing a big payout on every one.
//
// Every tier's value is unique across the whole ladder, so a pickup's
// color is a flat, world-independent lookup from its value alone --
// tokenColorForValue doesn't need to know which world it was found in.

export interface EssenceTier {
  value: number;
  color: number;
}

// Ascending value ladder, tier 1 (World 1's low end) to tier 10 (World
// 10's high end); colors sweep from cool blue through green/yellow/orange
// to violet at the top -- violet rather than a literal hot red/white so
// World 10's jackpot echoes that world's own violet biome palette and
// Skłodowska-Curie's lavender -- so a pickup's rough tier reads at a glance
// before the "+<value>" label spells out the exact payout. Since a world's
// window is at most 3 tiers wide (adjacent indices in this array), hue
// alone isn't enough to keep neighbors apart at the small on-screen sprite
// size -- saturation and lightness also step between tiers so every
// adjacent pair differs on more than one channel.
const TIERS: EssenceTier[] = [
  { value: 1, color: 0x84d1eb }, // sky blue
  { value: 2, color: 0x54dea5 }, // teal
  { value: 3, color: 0x3cdd3c }, // green
  { value: 5, color: 0x8ce633 }, // lime
  { value: 8, color: 0xf2e236 }, // yellow
  { value: 12, color: 0xf68f28 }, // orange
  { value: 18, color: 0xf44434 }, // red-orange
  { value: 25, color: 0xef3976 }, // rose
  { value: 35, color: 0xea2ec5 }, // magenta
  { value: 50, color: 0xdb8bee }, // violet
];

// A 3-tier window's weights (lower tier most common, upper tier rarest); a
// 2-tier window -- World 1's and World 10's clamped ends -- gets its own
// split rather than reusing a 3-weight curve with an empty slot.
const WEIGHTS_BY_WINDOW_SIZE: Record<number, number[]> = {
  2: [0.65, 0.35],
  3: [0.6, 0.3, 0.1],
};

function windowForWorld(world: number): EssenceTier[] {
  // Clamped so a world index past the built range (e.g. Hub's
  // highestUnlockedWorld() reporting one past the last-built world right
  // after its rival falls, before the player has advanced into it) still
  // resolves to a valid window instead of an empty one.
  const w = Math.min(Math.max(world, 1), TIERS.length);
  const lo = Math.max(1, w - 1);
  const hi = Math.min(TIERS.length, w + 1);
  return TIERS.slice(lo - 1, hi);
}

export function pickTokenValue(world: number): number {
  const tierWindow = windowForWorld(world);
  const weights = WEIGHTS_BY_WINDOW_SIZE[tierWindow.length];
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < tierWindow.length; i++) {
    if (r < weights[i]) return tierWindow[i].value;
    r -= weights[i];
  }
  return tierWindow[tierWindow.length - 1].value;
}

export function tokenColorForValue(value: number): number {
  return TIERS.find((t) => t.value === value)?.color ?? TIERS[0].color;
}
