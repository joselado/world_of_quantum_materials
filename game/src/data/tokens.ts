// Qumatessence economy: each pickup is worth 1, 5, or 10, colored per tier so
// the value reads at a glance before the player even reaches it. Higher
// values are rarer, rewarding the longer/deeper dead-end branches without
// guaranteeing a big payout on every one.

export interface TokenTier {
  value: number;
  color: number;
  weight: number;
}

export const TOKEN_TIERS: TokenTier[] = [
  { value: 1, color: 0x8fe8ff, weight: 0.6 },
  { value: 5, color: 0xffe066, weight: 0.3 },
  { value: 10, color: 0xff7ce0, weight: 0.1 },
];

export function pickTokenValue(): number {
  const total = TOKEN_TIERS.reduce((sum, t) => sum + t.weight, 0);
  let r = Math.random() * total;
  for (const tier of TOKEN_TIERS) {
    if (r < tier.weight) return tier.value;
    r -= tier.weight;
  }
  return TOKEN_TIERS[TOKEN_TIERS.length - 1].value;
}

export function tokenColorForValue(value: number): number {
  return TOKEN_TIERS.find((t) => t.value === value)?.color ?? TOKEN_TIERS[0].color;
}
