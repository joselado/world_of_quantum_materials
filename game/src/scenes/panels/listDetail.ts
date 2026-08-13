import Phaser from 'phaser';
import { makeCrystal } from '../../art/crystals';
import { CANVAS_H } from '../../art/perspective';
import { startMoveEffectPreview } from '../../art/moveEffectPreview';
import { materialDisplayName } from '../../data/materials';
import type { MoveLevel } from '../../data/materials';
import type { Material, MoveClass } from '../../data/types';
import type { AttackShape } from '../../audio/sfx';
import { fontPx, fontScale } from '../../ui/text';
import { GOLD_ACCENT_HEX, REFERENCE_BLUE_GREY_HEX } from '../../ui/theme';

// Shared two-column "list+detail" scaffolding (STYLE.md's "List+detail
// panels"): a left column of paginated, clickable candidate-name rows and a
// right column showing whichever row is currently selected in more detail.
// Originally Qumatex's own layout (HubScene.renderMaterialdexPanel, which
// now calls into renderListColumn/listDetailColumns/fitListLabel here rather
// than keeping its own copy), reused by Dresselhaus's transmute step,
// Anderson's host-pick step, Majorana's own browse-by-hybrid-result step, and
// Noether's Moves tab (scenes/panels/dresselhaus.ts, anderson.ts,
// majorana.ts, noether.ts). The right/detail column stays a per-call-site
// render everywhere -- Qumatex's own pane additionally masks an undiscovered
// entry and appends a physics blurb, while a guardian's pane shows a
// cost/status line and a commit button -- renderDetailCrystalHeader below
// (the crystal-render-plus-name block a crystal-picking guardian's detail
// pane opens with), renderMoveDetailHeader (the looping-animation-plus-name
// block a travelling-attack move-picking guardian's detail pane opens with),
// and renderSelfBuffMoveDetailHeader (the same idea for a self-buff move
// whose real effect centers on the caster rather than traveling -- Kondo's
// panel) are three shared detail-pane openers every guardian panel's own
// cost/status/confirm content sits below -- reused outside the paginated-
// list shape too: Laughlin's/Skłodowska-Curie's own panels
// (scenes/panels/laughlin.ts/sklodowskaCurie.ts) call renderMoveDetailHeader
// from a bespoke, always-both-visible two-column layout (sideBySideColumns
// below) rather than a browsed single detail pane, since each guardian only
// ever has exactly two fixed moves worth showing, never a candidate list
// worth paging through -- they don't import renderListColumn/
// listDetailColumns at all.

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

// Laughlin's and Skłodowska-Curie's own panels (scenes/panels/laughlin.ts/
// sklodowskaCurie.ts) each have exactly two fixed moves, always both visible
// side by side rather than a browsed left-hand candidate list -- wider than
// LIST_DETAIL_PANEL_W since two full animation-stage-plus-inline-picker
// columns need more room than the ordinary list+detail split's narrower
// right column ever did (STYLE.md's own reasoning for the wider width).
export const TWO_UP_PANEL_W = 800;

export interface SideBySideColumns {
  colW: number;
  leftCenterX: number;
  rightCenterX: number;
  dividerX: number;
}

// Two equal-width columns for a TWO_UP_PANEL_W-wide panel whose left edge
// sits at `panelLeft` -- the fixed-left-column-plus-detail-pane split
// listDetailColumns above gives every *browsed* panel doesn't fit here,
// since there's no list to browse, just two moves that both always render
// their own full detail pane at once.
export function sideBySideColumns(panelLeft: number, panelWidth: number): SideBySideColumns {
  const margin = 18;
  const gap = 24;
  const colW = (panelWidth - margin * 2 - gap) / 2;
  const leftCenterX = panelLeft + margin + colW / 2;
  const rightCenterX = panelLeft + panelWidth - margin - colW / 2;
  const dividerX = panelLeft + margin + colW + gap / 2;
  return { colW, leftCenterX, rightCenterX, dividerX };
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

// Same "art block + name" shape renderDetailCrystalHeader above gives a
// crystal-pick panel's detail pane, but for a *move* -- the "art" is the
// move's own real battle-effect animation (art/moveEffectPreview.ts's
// startMoveEffectPreview), looping between a short local from/to span sized
// to this block rather than a real battle's PLAYER_POS/opponentPos (a
// detail pane has no crystal positions of its own to borrow). Shared by
// Noether's Moves tab and Laughlin's/Skłodowska-Curie's own bespoke
// two-column panels (scenes/panels/noether.ts, laughlin.ts,
// sklodowskaCurie.ts -- Kondo's own self-buff moves use the sibling
// renderSelfBuffMoveDetailHeader below instead, since a self-buff's real
// effect centers on the caster rather than traveling): each resolves its own
// move's current class/shape override (Noether: the move's own static
// class, no override; Laughlin/Curie: getTunedMoveClass plus
// ANALYTIC_SHAPES/ULTIMATE_SHAPES) and passes it in here rather than this
// module reaching into materials.ts/attackEffects.ts's per-move-id override
// tables itself. `level` (default 0) is the player's actual Feynman
// MoveLevel for this move (`getMoveLevel`) -- Noether's own unbought-move
// rows never carry one above 0 (leveling requires already owning the move),
// Laughlin's/Curie's pass their move's real level so a leveled Analytic/
// Ultimate move's preview escalates into the same multi-trigger cascade a
// real cast plays instead of always showing the flat unleveled loop.
// `previewKey` (default 'default', see art/moveEffectPreview.ts)
// distinguishes one call site's own preview chain from another's -- every
// caller here has exactly one detail pane open at a time and so never needs
// to pass one, except Laughlin's/Curie's own two-column panels, which have
// two live simultaneously and key each by its own move id. `halfSpan`
// (default 55, i.e. a 110px-wide stage, unchanged from before this param
// existed) is how far the effect travels from `centerX` in each direction --
// Laughlin's/Curie's own wider two-up columns (listDetail.ts's
// sideBySideColumns) pass a larger value so the animation actually uses
// more of the extra room their bespoke layout frees up, rather than leaving
// the same fixed-pixel stage floating in a wider column.
export function renderMoveDetailHeader(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  displayName: string,
  moveClass: MoveClass,
  shapeOverride: AttackShape | undefined,
  centerX: number,
  y: number,
  rightColW: number,
  level: MoveLevel = 0,
  previewKey?: string,
  halfSpan = 55
): number {
  const stageH = 84; // same fixed "art, not text" block height renderDetailCrystalHeader uses above
  const stageCenterY = y + stageH / 2;
  startMoveEffectPreview(
    {
      scene,
      moveClass,
      shapeOverride,
      level,
      from: { x: centerX - halfSpan, y: stageCenterY + 14 },
      to: { x: centerX + halfSpan, y: stageCenterY - 14 },
    },
    previewKey
  );
  let ny = y + stageH;

  const nameScale = Math.min(fontScale(scene), 1.3);
  const nameText = scene.add
    .text(centerX, ny, displayName, {
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

// Self-buff variant of renderMoveDetailHeader above -- Kondo's three
// self-buff moves (scenes/panels/kondo.ts) don't travel from an attacker to
// a target the way an ordinary move does: BattleScene.resolveSelfBuff plays
// the real battle effect centered on the caster's own position (`from ===
// to === pos`), not flying across the field. startMoveEffectPreview itself
// needed no change to support this -- passing an identical from/to point
// already centers the ring on that single point (art/attackEffects.ts's
// playRing does `Phaser.Math.Linear(from, to, 0.12)` for its origin, which
// collapses to that same point when from equals to), exactly the call
// resolveSelfBuff already makes for a real cast. What a self-buff pane needs
// beyond that is a crystal to center the ring *on* -- renderMoveDetailHeader
// above has no crystal render at all -- so this renders the player's own
// current crystal standing on a ground-shadow ellipse (the same makeCrystal
// call and shadow geometry Franklin's panel already established, see
// scenes/panels/franklin.ts's showFranklinPanel) with the move's effect
// looping around it, before the same name-text tail every detail header
// here uses. Not named after Kondo specifically so a future self-buff
// guardian's panel can reuse it.
export function renderSelfBuffMoveDetailHeader(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  material: Material,
  displayName: string,
  moveClass: MoveClass,
  centerX: number,
  y: number,
  rightColW: number
): number {
  const stageH = 84; // same fixed "art, not text" block height renderMoveDetailHeader uses above
  const crystalSize = 34; // matches Franklin's own player-crystal render (art/franklin.ts)
  const crystalCenterY = y + crystalSize;
  const shadowY = crystalCenterY + crystalSize * 0.85;
  const shadowRx = crystalSize * 1.18;
  const shadowRy = crystalSize * 0.27;

  container.add(scene.add.ellipse(centerX, shadowY, shadowRx * 2, shadowRy * 2, 0x000000, 0.3));

  const crystal = makeCrystal(scene, crystalSize, material.color, material.variant, { seed: material.name, hybrid: material.hybridParents });
  crystal.setPosition(centerX, crystalCenterY);
  container.add(crystal);

  startMoveEffectPreview({
    scene,
    moveClass,
    from: { x: centerX, y: crystalCenterY },
    to: { x: centerX, y: crystalCenterY },
  });

  let ny = y + stageH;

  const nameScale = Math.min(fontScale(scene), 1.3);
  const nameText = scene.add
    .text(centerX, ny, displayName, {
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
