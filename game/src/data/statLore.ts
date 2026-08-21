import type { Stats } from './types';

// What each of the three stats *is*, in physics, and why that makes it do what
// it does in a fight -- shown in the detail pane of Noether's Stats list
// (scenes/panels/noether.ts's renderShopStats).
//
// The three player-facing names (data/balance.ts's STAT_LABELS: Energy,
// Momentum, Lifetime) are not decoration. They are the three numbers that
// define a quasiparticle: where it sits in energy, where it sits in momentum,
// and how long it survives before scattering. A dispersion relation E(k) plus a
// lifetime tau is the whole of what a quasiparticle *is*, so the stat sheet a
// player raises at Noether's is literally the crystal's own excitation spectrum
// (DESIGN.md section 3 for the numbers each one drives).
//
// Written plainly on purpose. The physics has to be right and it has to be
// readable at a glance in a panel, so each entry is one short paragraph: what
// the quantity means in a real material, then the line that ties it to what the
// number does in battle. No em dashes and no "--" anywhere here: this is text a
// player reads (STYLE.md's "Player-facing writing").
export const STAT_LORE: Record<keyof Stats, string> = {
  quantumness:
    'How high your excitations sit above the quiet ground state. Energy is the first of the three numbers that name a quasiparticle, and it sets the size of the quantum you carry. A low-lying excitation arrives with very little to deposit. A high one arrives carrying a great deal, and the crystal it lands on has to absorb all of it. Raise your Energy and every blow you land deposits more.',
  velocity:
    'How fast news travels through you. Momentum is the second number, and in a fight what matters is how quickly energy changes as momentum changes. That slope is the speed an excitation really moves at. A steep band carries a signal across the crystal at close to a million metres a second, the way a Dirac cone does in graphene. A flat band barely carries it at all, and a heavy electron in one crawls. The faster crystal reaches the other one first, and if it is fast enough it strikes again before the slow one has answered once.',
  correlation:
    'How long an excitation survives in you before it scatters away. Lifetime is the third number, and it is set by how strongly your electrons act together. When they move as one screened, collective state instead of one at a time, there is no cheap way to disturb just one of them, and a blow is soaked up by the whole rather than spent on a part. Raise your Lifetime and incoming damage is divided down. Nothing is untouchable, so damage always gets through, but a long-lived crystal is very hard to hurt.',
};
