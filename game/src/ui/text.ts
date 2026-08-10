import type Phaser from 'phaser';
import { DEFAULT_FONT_SCALE } from '../data/settings';

// Every readable UI/dialogue font size in the game (titles, buttons, hints,
// labels, logs) is authored as a base px number and passed through this
// helper rather than a literal 'Npx' string, so the Enter-menu's Settings
// panel (OverworldScene.showSettingsPanel/data/settings.ts's
// FONT_SCALE_PRESETS) can scale all of it consistently by multiplying the
// current registry setting in. Decorative glyph sizes that scale off an art
// asset's own size (crystal/token sparkles, mentor-avatar orbiting motes)
// deliberately do NOT go through this -- those aren't reading text, and
// scaling them independently of the art around them would look broken.
export function fontPx(scene: Phaser.Scene, basePx: number): string {
  return `${Math.round(basePx * fontScale(scene))}px`;
}

// The raw multiplier, for the handful of call sites (BattleScene's move
// menu) that need to do their own layout math -- e.g. clamping a font size
// to whatever a geometrically fixed box can actually fit -- rather than
// just handing a px string straight to a text style.
export function fontScale(scene: Phaser.Scene): number {
  return (scene.game.registry.get('fontScale') as number) ?? DEFAULT_FONT_SCALE;
}
