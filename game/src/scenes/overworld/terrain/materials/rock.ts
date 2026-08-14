import type { AccentDraw } from '../types';

// 'rock' (every world whose off-path terrain is plain ground, and every
// region-tinted mapgen domain regardless of biome): bare ground with nothing
// laid over its fill, so a domain's own color stays clean and the "you cannot
// walk here" read comes entirely from the color break plus the contact shadow
// and rim light at the boundary -- which every material gets alike.
export const drawRockAccent: AccentDraw | null = null;
