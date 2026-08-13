import Phaser from 'phaser';
import { makeCrystal } from '../../art/crystals';
import { CANVAS_H } from '../../art/perspective';
import { materialDisplayName } from '../../data/materials';
import type { Material } from '../../data/types';
import { fontPx, fontScale } from '../../ui/text';
import { GOLD_ACCENT_HEX, REFERENCE_BLUE_GREY_HEX } from '../../ui/theme';

// Shared two-column "list+detail" scaffolding (STYLE.md's "List+detail
// panels"): a left column of paginated, clickable candidate-name rows and a
// right column showing whichever row is currently selected in more detail.
// Originally Qumatex's own layout (HubScene.renderMaterialdexPanel, which
// now calls into renderListColumn/listDetailColumns/fitListLabel here rather
// than keeping its own copy), reused by Dresselhaus's transmute step,
// Anderson's host-pick step, and Majorana's own browse-by-hybrid-result step
// (scenes/panels/dresselhaus.ts, anderson.ts, majorana.ts). The right/detail
// column stays a per-call-site
// render everywhere -- Qumatex's own pane additionally masks an undiscovered
// entry and appends a physics blurb, while a guardian's pane shows a
// cost/status line and a commit button -- only renderDetailCrystalHeader
// below (the crystal-render-plus-name block every guardian panel's detail
// pane opens with) is shared across the three guardian panels specifically.

export const LIST_DETAIL_PANEL_W = 720;

export interface ListDetailColumns {
  leftX: number;
  leftColW: number;
  dividerX: number;
  rightColLeft: number;
  rightColRight: number;
  rightColW: number;
  rightColCenterX: number;
}

// Column geometry for a LIST_DETAIL_PANEL_W-wide panel whose left edge sits
// at `panelLeft` -- one fixed set of margins shared by every list+detail
// panel rather than each caller hand-tuning its own.
export function listDetailColumns(panelLeft: number): ListDetailColumns {
  const leftX = panelLeft + 18;
  const leftColW = 200;
  const dividerX = leftX + leftColW + 16;
  const rightColLeft = dividerX + 16;
  const rightColRight = panelLeft + LIST_DETAIL_PANEL_W - 18;
  const rightColW = rightColRight - rightColLeft;
  const rightColCenterX = rightColLeft + rightColW / 2;
  return { leftX, leftColW, dividerX, rightColLeft, rightColRight, rightColW, rightColCenterX };
}

// Trims a row's already-rendered label down to `maxWidth` (appending an
// ellipsis) rather than wrapping it -- wrapping would make row heights
// uneven, breaking the uniform-row-height page-fit math renderListColumn
// relies on. Checked against the text object's own measured `.width` (so it
// accounts for the current font-scale preset) rather than a fixed character
// count.
export function fitListLabel(rowText: Phaser.GameObjects.Text, label: string, maxWidth: number) {
  if (rowText.width <= maxWidth) return;
  let trimmed = label;
  while (trimmed.length > 1 && rowText.width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
    rowText.setText(`${trimmed}…`);
  }
}

// Same small text-button look every dialogue button in the game uses
// (OverworldScene.addDialogueButtonAt/HubScene.addButton) -- its own tiny
// copy here rather than a dependency on GuardianPanelHost, since this module
// is called with a plain Phaser.Scene (Qumatex's own left column predates
// that interface).
function addColumnButton(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  onClick: () => void
): Phaser.GameObjects.Text {
  const btn = scene.add
    .text(x, y, label, {
      fontSize: fontPx(scene, 10),
      color: '#ffff88',
      backgroundColor: '#222244',
      padding: { x: 8, y: 4 },
      align: 'center',
    })
    .setOrigin(0.5, 0)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', onClick);
  container.add(btn);
  return btn;
}

export interface RenderListColumnParams<T> {
  scene: Phaser.Scene;
  container: Phaser.GameObjects.Container;
  x: number;
  y: number;
  width: number;
  items: T[];
  idFor: (item: T) => string;
  labelFor: (item: T) => string;
  // Unselected-row text color -- defaults to the ordinary list blue-grey;
  // Qumatex's own undiscovered rows dim further via this hook.
  colorFor?: (item: T) => string;
  selectedId: string | null;
  page: number;
  onPageChange: (page: number) => void;
  onSelect: (item: T) => void;
  emptyText?: string;
}

export interface RenderListColumnResult {
  bottom: number;
  page: number;
}

// Renders the left "candidate name" column: as many rows as fit above the
// panel's own trailing content (reserving two rows' worth of tail for it,
// plus two more for this function's own Prev/Next/Page-N/M row, whether or
// not that row ends up rendering) -- same fixed-reservation, sample-row-
// measurement technique HubScene.renderMaterialdexPanel's own left column
// always used. A selected row highlights gold-on-purple; Prev/Next/Page-N/M
// controls appear only once the filtered list outgrows one page.
// `selectedId`/`idFor` identify the current selection by the item's own
// stable id (a crystal's name) rather than a list/page index, so the
// highlighted row survives a page flip.
export function renderListColumn<T>(params: RenderListColumnParams<T>): RenderListColumnResult {
  const { scene, container, x, y: columnsTop, width, items, idFor, labelFor, colorFor, selectedId, page, onPageChange, onSelect, emptyText } =
    params;

  const sampleRow = scene.add.text(-1000, -1000, 'Sample', { fontSize: fontPx(scene, 12), padding: { x: 8, y: 4 } });
  const rowH = sampleRow.height + 4;
  sampleRow.destroy();
  const reservedTail = rowH * 2;
  const reservedControls = rowH * 2;
  const available = CANVAS_H - columnsTop - reservedTail - reservedControls;
  const fitPerPage = Math.max(1, Math.floor(available / rowH));
  const totalPages = Math.max(1, Math.ceil(items.length / fitPerPage));
  const clampedPage = Phaser.Math.Clamp(page, 0, totalPages - 1);
  const pageItems = items.slice(clampedPage * fitPerPage, clampedPage * fitPerPage + fitPerPage);

  let rowY = columnsTop;
  if (pageItems.length === 0) {
    const empty = scene.add
      .text(x, rowY, emptyText ?? 'Nothing to show.', { fontSize: fontPx(scene, 11), color: REFERENCE_BLUE_GREY_HEX })
      .setOrigin(0, 0);
    container.add(empty);
    rowY += empty.height + 4;
  }
  for (const item of pageItems) {
    const id = idFor(item);
    const selected = id === selectedId;
    const label = labelFor(item);
    const rowText = scene.add
      .text(x, rowY, label, {
        fontSize: fontPx(scene, 12),
        color: selected ? GOLD_ACCENT_HEX : colorFor?.(item) ?? '#cfd8ff',
        backgroundColor: selected ? '#3a2a5c' : '#1c1c30',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0, 0);
    // Trim against the text's own natural (unfixed) width first --
    // setFixedSize below pins .width to the row's uniform box size, which
    // would make every row (even a short one) read as overflowing.
    fitListLabel(rowText, label, width - 4);
    rowText
      .setFixedSize(width, rowH - 4)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => onSelect(item));
    container.add(rowText);
    rowY += rowH;
  }
  if (totalPages > 1) {
    const centerX = x + width / 2;
    const prev = addColumnButton(scene, container, centerX - width / 4, rowY, '<- Prev', () => {
      if (clampedPage > 0) onPageChange(clampedPage - 1);
    });
    if (clampedPage === 0) prev.setAlpha(0.35);
    const next = addColumnButton(scene, container, centerX + width / 4, rowY, 'Next ->', () => {
      if (clampedPage < totalPages - 1) onPageChange(clampedPage + 1);
    });
    if (clampedPage === totalPages - 1) next.setAlpha(0.35);
    rowY += Math.max(prev.height, next.height) + 6;
    const pageLabel = scene.add
      .text(centerX, rowY, `Page ${clampedPage + 1}/${totalPages}`, { fontSize: fontPx(scene, 10), color: REFERENCE_BLUE_GREY_HEX })
      .setOrigin(0.5, 0);
    container.add(pageLabel);
    rowY += pageLabel.height + 4;
  }
  return { bottom: rowY, page: clampedPage };
}

// Draws the vertical divider between the two columns, spanning from just
// above the columns' shared top down to the taller of their two measured
// bottoms -- inserted at container index 0 (below every row/button already
// added, above the panel background inserted afterward), same order Qumatex
// always used.
export function insertColumnDivider(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  dividerX: number,
  columnsTop: number,
  columnsBottom: number
) {
  const divider = scene.add.graphics();
  divider.lineStyle(1, 0x3a3a5c, 0.6);
  divider.lineBetween(dividerX, columnsTop - 4, dividerX, columnsBottom);
  container.addAt(divider, 0);
}

// Crystal-render-plus-name header for a guardian panel's detail pane --
// identical across Dresselhaus/Anderson/Majorana's crystal-pick steps (a
// real makeCrystal render, size 36, plus the compound's own display name),
// factored here rather than tripled across their three files. Font size
// capped the same way Franklin's own passive rows are (STYLE.md) -- these
// panels already stack an avatar/intro/step-label/two columns/footer, and an
// uncapped name at the largest text-size preset risks pushing the footer off
// the canvas. Qumatex's own detail pane (HubScene.renderMaterialdexPanel)
// stays separate since it additionally masks an undiscovered entry to "???"
// with a flat silhouette color and appends its own physics blurb --
// genuinely different content from a guardian's cost/status/commit-button
// pane.
export function renderDetailCrystalHeader(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  material: Material,
  centerX: number,
  y: number,
  rightColW: number
): number {
  const crystal = makeCrystal(scene, 36, material.color, material.variant, { seed: material.name, hybrid: material.hybridParents });
  const crystalBlockH = 84; // fixed regardless of text-size setting -- art, not text (see STYLE.md)
  crystal.setPosition(centerX, y + crystalBlockH / 2);
  container.add(crystal);
  let ny = y + crystalBlockH;

  const nameScale = Math.min(fontScale(scene), 1.3);
  const nameText = scene.add
    .text(centerX, ny, materialDisplayName(material), {
      fontSize: `${Math.round(14 * nameScale)}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: rightColW },
    })
    .setOrigin(0.5, 0);
  container.add(nameText);
  return ny + nameText.height + 6;
}
