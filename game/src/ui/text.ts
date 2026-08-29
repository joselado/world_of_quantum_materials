import type Phaser from 'phaser';
import { defaultFontScale } from '../data/settings';

// Every readable UI/dialogue font size in the game (titles, buttons, hints,
// labels, logs) is authored as a base px number and passed through this
// helper rather than a literal 'Npx' string, so the Lab's Settings station
// (scenes/panels/hubStations.ts's showSettingsPanel/data/settings.ts's
// FONT_SCALE_PRESETS) can scale all of it consistently by multiplying the
// current registry setting in. Decorative glyph sizes that scale off an art
// asset's own size (crystal/token sparkles, guardian-avatar orbiting motes)
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
  return (scene.game.registry.get('fontScale') as number) ?? defaultFontScale();
}

// Fits a block of authored prose into a fixed vertical budget, for the
// panels that render per-world/per-topic copy whose length the layout can't
// assume anything about (the world-entry lore screen, the tutorial tip
// popup, the Lab's Tutorial station). Two mechanisms, in order of how much
// they cost the reader: first drop trailing paragraphs, which the caller
// continues on a further screen, so the text a reader does see stays at
// full size; then, once only one paragraph is left and there's no break to
// take, shrink the font down to `minPx`.
//
// `budget` is the height the body actually has -- the caller measures its
// own title and continue button rather than estimating them, since an
// estimate that drifts is exactly how a panel ends up off the canvas. The
// floor is an absolute px value, not a base size the caller's text scale is
// re-applied to afterwards, so it stays a real floor at every
// FONT_SCALE_PRESETS setting rather than one that rises with the preset.
//
// Returns the paragraphs that did not fit, in order; empty when everything
// fit. A caller with nowhere to continue to (a fixed detail pane) passes
// the whole body as a single-element list and gets shrink-only behavior.
export function fitProseToBudget(
  text: Phaser.GameObjects.Text,
  paragraphs: string[],
  budget: number,
  minPx = 9
): string[] {
  let shown = paragraphs.length;
  text.setText(paragraphs.join('\n\n'));
  while (shown > 1 && text.height > budget) {
    shown -= 1;
    text.setText(paragraphs.slice(0, shown).join('\n\n'));
  }

  let px = parseInt(String(text.style.fontSize), 10);
  while (text.height > budget && px > minPx) {
    px -= 1;
    text.setFontSize(`${px}px`);
  }

  return paragraphs.slice(shown);
}
