// Mirrors the shape of ../../../data/materials.json (the design-time reference
// for the full 10-type roster) -- this file is what the running game actually
// imports and type-checks against.

export type MoveClass =
  | 'disorder'
  | 'trivial'
  | 'magnetic'
  | 'thermal'
  | 'localization'
  | 'gauge'
  | 'entanglement'
  | 'decoherence';

export type MaterialType =
  | 'trivial'
  | 'magnet'
  | 'topological'
  | 'qhe'
  | 'supercon'
  | 'classicalmag'
  | 'tensornet'
  | 'spinliquid'
  | 'defect'
  | 'adaptive';

export type CrystalVariant = 'shard' | 'cluster' | 'prism';

export interface Move {
  id: string;
  name: string;
  class: MoveClass;
  power: number;
}

export interface Material {
  name: string;
  type: MaterialType;
  color: number;
  variant: CrystalVariant;
  maxHp: number;
  moves: string[];
}
