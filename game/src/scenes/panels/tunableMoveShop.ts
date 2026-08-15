import type Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { fontScale } from '../../ui/text';
import { TUNABLE_MOVE_CLASSES, canHost } from '../../data/materials';
import type { MoveClass } from '../../data/types';

// The quasiparticle picker every tunable move's own column renders directly
// beneath itself (Landau's Analytic pair, scenes/panels/landau.ts;
// Skłodowska-Curie's Ultimate pair, scenes/panels/sklodowskaCurie.ts) --
// inline in that same panel, not a separate full-panel sub-view. Only offers
// classes the player's *current* form can actually host (TUNABLE_MOVE_CLASSES
// filtered through canHost) -- "which quasiparticle should this carry" is
// meant to be a real physics choice grounded in what the player's own
// crystal can host right now, not a free pick from every class in the game
// regardless of how little sense it makes for the current form; retuning
// later (after transmuting into a different form) just re-renders this same
// filtered list. 'phonon' is on every MOVE_COMPATIBILITY list, so the
// filtered list is never empty.
export function hostableClasses(scene: GuardianPanelHost): MoveClass[] {
  return TUNABLE_MOVE_CLASSES.filter((cls) => canHost(scene.playerMaterial.type, cls));
}

export interface QuasiparticleOption {
  cls: MoveClass;
  label: string;
  dim: boolean;
}

// Renders one small pill button per option, packed left-to-right and
// wrapped onto as many rows as the column actually needs -- not a fixed
// one-row-per-class vertical list, since a form like chernSuperconductor
// hosts as many as five classes, and both this panel and Skłodowska-Curie's
// own already have two of these pickers plus two full animation stages to
// fit above the canvas's bottom edge (STYLE.md's own robustness note for
// these two panels). Deliberately smaller/denser than the game's ordinary
// dialogue-button style (fontPx 10, tight padding, capped at the Compact
// text-size preset's own scale even at Normal/Large -- see below) since this
// is a dense strip of many small optional controls, not body text a Large-
// text player needs magnified the way the status line just above it already
// is. Each caller (Landau/Curie) formats its own row label and afford/dim
// state, since the two pricing models differ (a flat one-time move purchase
// vs. a per-class unlock cost, see each panel's own comment) and this module
// has no opinion on either. `onPick` is the one action that actually runs --
// buying, retuning, or unlocking a class, whichever the caller's own label/
// cost logic decided this row means.
export function renderInlineClassPicker(
  scene: GuardianPanelHost,
  container: Phaser.GameObjects.Container,
  centerX: number,
  y: number,
  colW: number,
  options: QuasiparticleOption[],
  onPick: (cls: MoveClass) => void
): number {
  const gapX = 6;
  const gapY = 4;
  // Capped at the Compact preset's own scale (1x) regardless of the
  // player's actual Normal/Large setting -- see this file's own top comment
  // for why a dense options strip stays flat here while the status line just
  // above it keeps scaling normally.
  const pickerFontPx = `${Math.round(10 * Math.min(fontScale(scene), 1))}px`;

  const buttons = options.map((opt) => {
    const btn = scene.add
      .text(-1000, -1000, opt.label, {
        fontSize: pickerFontPx,
        color: '#ffff88',
        backgroundColor: '#222244',
        padding: { x: 7, y: 3 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => onPick(opt.cls));
    if (opt.dim) btn.setAlpha(0.5);
    container.add(btn);
    return btn;
  });

  // Pack left-to-right within the column's own width, wrapping to a new row
  // once the next button would run past its right edge.
  const rows: { btns: Phaser.GameObjects.Text[]; width: number; height: number }[] = [];
  let row: Phaser.GameObjects.Text[] = [];
  let rowWidth = 0;
  let rowHeight = 0;
  buttons.forEach((btn) => {
    const w = btn.width;
    if (row.length > 0 && rowWidth + gapX + w > colW) {
      rows.push({ btns: row, width: rowWidth, height: rowHeight });
      row = [];
      rowWidth = 0;
      rowHeight = 0;
    }
    rowWidth += (row.length > 0 ? gapX : 0) + w;
    rowHeight = Math.max(rowHeight, btn.height);
    row.push(btn);
  });
  if (row.length > 0) rows.push({ btns: row, width: rowWidth, height: rowHeight });

  let rowY = y;
  rows.forEach(({ btns, width, height }) => {
    let x = centerX - width / 2;
    btns.forEach((btn) => {
      btn.setPosition(x + btn.width / 2, rowY);
      x += btn.width + gapX;
    });
    rowY += height + gapY;
  });

  return rowY;
}
