import Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { killTweensDeep, makeCrystal } from '../../art/crystals';
import { CANVAS_H } from '../../art/perspective';
import { startMoveEffectPreview, type PreviewClipRect } from '../../art/moveEffectPreview';
import { materialDisplayName } from '../../data/materials';
import type { MoveLevel } from '../../data/materials';
import type { Material, MoveClass } from '../../data/types';
import type { AttackShape } from '../../audio/sfx';
import { fontPx, fontScale } from '../../ui/text';
import { GOLD_ACCENT_HEX, REFERENCE_BLUE_GREY, REFERENCE_BLUE_GREY_HEX } from '../../ui/theme';

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
// block an attack move-picking guardian's detail pane opens with),
// and renderSelfBuffMoveDetailHeader (the same idea over a rendered player
// crystal, for a self-buff move -- Kondo's
// panel) are three shared detail-pane openers, and renderStatusAndConfirm
// is the shared cost/status-line-plus-confirm-button tail every guardian
// panel's pane closes with -- reused outside the paginated-
// list shape too: Landau's/Skłodowska-Curie's own panels
// (scenes/panels/landau.ts/sklodowskaCurie.ts) call renderMoveDetailHeader
// from a bespoke, always-both-visible two-column layout (sideBySideColumns
// below) rather than a browsed single detail pane, since each guardian only
// ever has exactly two fixed moves worth showing, never a candidate list
// worth paging through -- they don't import renderListColumn/
// listDetailColumns at all.
//
// A browsed panel's preview click is a *scoped update*, not a panel
// rebuild: the caller keeps its avatar/intro/list rows on screen, moves the
// highlight with renderListColumn's own setSelectedId (below), and
// re-renders only its detail pane and the divider/footer/panel-background
// chrome whose height depends on it. Committing (a purchase, a
// transmutation, a page flip) still tears the panel down and calls
// showXPanel again, since those change what the list itself shows.

export const LIST_DETAIL_PANEL_W = 720;

// Tears down whichever panel container is currently open, ahead of a
// showXPanel() call that rebuilds it (a page flip, a purchase, a
// transmutation). Phaser's own destroy() reclaims the GameObjects but
// leaves every tween still targeting them running, and a panel is full of
// infinitely-repeating ones -- the guardian avatar's bob, makeCrystal's
// per-shard sparkles, a hybrid halo's glow, Bloch's selection-ring pulse --
// so a plain `dialogueContainer?.destroy(true)` leaks one more set of them
// on every rebuild, forever. Every panel rebuild goes through here instead.
export function destroyPanel(scene: GuardianPanelHost) {
  if (!scene.dialogueContainer) return;
  killTweensDeep(scene, scene.dialogueContainer);
  scene.dialogueContainer.destroy(true);
  scene.dialogueContainer = undefined;
}

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

// Landau's and Skłodowska-Curie's own panels (scenes/panels/landau.ts/
// sklodowskaCurie.ts) each have exactly two fixed moves, always both visible
// side by side rather than a browsed left-hand candidate list -- wider than
// LIST_DETAIL_PANEL_W since two full animation-stage-plus-inline-picker
// columns need more room than the ordinary list+detail split's narrower
// right column ever did (STYLE.md's own reasoning for the wider width).
export const TWO_UP_PANEL_W = 800;

// The detail pane's own art block -- a crystal render, a looping battle-effect
// animation, or a player crystal with a self-buff ring around it -- is a fixed
// height regardless of the text-size setting ("art, not text", STYLE.md), so
// every detail-pane opener below reserves the same one and a pane's height
// stays predictable across presets. Sized against the vertical budget a
// list+detail panel has with its escape buttons inside the left column
// (renderListColumnFooter below) rather than in a full-width row under both
// columns.
export const DETAIL_STAGE_H = 104;
// The crystal drawn inside that block, and the cap on the name text beneath
// it. Both are shared across the three openers so a crystal-browsing pane and
// a move-browsing pane read at the same weight.
export const DETAIL_CRYSTAL_SIZE = 44;
// Font-scale ceiling for a detail pane's own name heading, shared by the
// openers below and by a pane that renders its heading itself because it has
// no art block to open with (Noether's Stats tab, scenes/panels/noether.ts).
export const DETAIL_NAME_CAP = 1.45;

// The two-up panels' stage is shorter, because their height budget is
// tighter: with no left column their Farewell button occupies a full-width row
// below both columns, and their columns carry an inline quasiparticle picker
// beneath the status line that a browsed detail pane doesn't. At the largest
// text-size preset Skłodowska-Curie's column reaches within ~25px of the
// bottom of the canvas even at this height, so it has no room for the taller
// one.
export const TWO_UP_STAGE_H = 84;

// A move preview is a real battle effect, composed against the whole arena: a
// beam falls in from above the top of the field, an eruption throws debris
// well past where it lands. Played inside a panel it would reach across the
// panel and the room behind it, so the stage block above is a *stage* in the
// literal sense -- the effect is clipped to it (art/attackFx.ts's
// `setPreviewClip`) and the block is drawn as a recessed, bordered pane so
// the clip reads as a screen the demonstration is playing on rather than art
// cut off at nothing. Inset from the column's full width so the two columns of
// a two-up panel keep a visible gap between their stages.
const STAGE_INSET_X = 8;
const STAGE_BG = 0x0b0b16;
const STAGE_BG_ALPHA = 0.55;
const STAGE_BORDER_ALPHA = 0.5;

// The rectangle a pane's preview plays inside, in canvas coordinates, plus the
// frame drawn around it. Returned so the caller can hand the same rect to
// `startMoveEffectPreview` -- one source of truth for where the stage is, so
// the frame the player sees and the clip the effect obeys can never disagree.
function drawPreviewStage(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  centerX: number,
  y: number,
  colW: number,
  stageH: number
): PreviewClipRect {
  const width = Math.max(40, colW - STAGE_INSET_X * 2);
  const rect = { x: centerX - width / 2, y, width, height: stageH };
  const frame = scene.add
    .rectangle(centerX, y + stageH / 2, width, stageH, STAGE_BG, STAGE_BG_ALPHA)
    .setStrokeStyle(1, REFERENCE_BLUE_GREY, STAGE_BORDER_ALPHA);
  container.add(frame);
  return rect;
}

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
  // Moves the gold-on-purple highlight to a different row by restyling the
  // rows already on screen, without rebuilding the column. A preview-only
  // row click uses this together with a scoped detail-pane re-render (see
  // CODEMAP's "scoped update" convention) rather than tearing the whole
  // panel down and running showXPanel again. Row heights are fixed
  // (setFixedSize below), so nothing above or below needs re-measuring.
  setSelectedId: (id: string | null) => void;
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

  const rows: { id: string; text: Phaser.GameObjects.Text; baseColor: string }[] = [];
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
    const baseColor = colorFor?.(item) ?? '#cfd8ff';
    const rowText = scene.add
      .text(x, rowY, label, {
        fontSize: fontPx(scene, 12),
        color: selected ? GOLD_ACCENT_HEX : baseColor,
        backgroundColor: selected ? '#3a2a5c' : '#1c1c30',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0, 0);
    rows.push({ id, text: rowText, baseColor });
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
  const setSelectedId = (id: string | null) => {
    for (const row of rows) {
      const selected = row.id === id;
      row.text.setColor(selected ? GOLD_ACCENT_HEX : row.baseColor);
      row.text.setBackgroundColor(selected ? '#3a2a5c' : '#1c1c30');
    }
  };
  return { bottom: rowY, page: clampedPage, setSelectedId };
}

// A list+detail panel's own escape button ("Farewell", or "Close" in the
// Lab), placed in the left column directly beneath its rows rather than in a
// full-width row below both columns. The left column is the shorter of the
// two in every one of these panels, so a footer living inside it costs the
// panel no height at all, and the vertical budget a full-width footer row
// would take goes to the detail pane's own art stage and text instead.
// Callers pass this the left column's own measured bottom, and take the
// larger of what it returns and their detail pane's bottom as the panel's
// real content height -- the same `Math.max` both columns already went
// through before the divider is drawn.
export function renderListColumnFooter(
  scene: GuardianPanelHost,
  container: Phaser.GameObjects.Container,
  columns: ListDetailColumns,
  y: number,
  label: string,
  onClick: () => void
): number {
  const btn = scene.addDialogueButtonAt(
    container,
    columns.leftX + columns.leftColW / 2,
    y,
    label,
    onClick,
    columns.leftColW
  );
  return y + btn.height;
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
  const crystal = makeCrystal(scene, DETAIL_CRYSTAL_SIZE, material.color, material.variant, {
    seed: material.name,
    hybrid: material.hybridParents,
  });
  const crystalBlockH = DETAIL_STAGE_H;
  crystal.setPosition(centerX, y + crystalBlockH / 2);
  container.add(crystal);
  let ny = y + crystalBlockH;

  const nameScale = Math.min(fontScale(scene), DETAIL_NAME_CAP);
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
// startMoveEffectPreview), looping on the centre of this block: the target's
// half of the beat, landing on the spot, rather than the full attacker-to-
// target flight a real battle plays across the whole field (a pane this size
// has no room for the crossing, and the half worth showing is what the move
// does when it arrives). Shared by
// Noether's Moves tab and Landau's/Skłodowska-Curie's own bespoke
// two-column panels (scenes/panels/noether.ts, landau.ts,
// sklodowskaCurie.ts -- Kondo's own self-buff moves use the sibling
// renderSelfBuffMoveDetailHeader below instead, since a self-buff needs a
// crystal rendered underneath the effect to read as buffing anything): each resolves its own
// move's current class/shape override (Noether: the move's own static
// class, no override; Landau/Curie: getTunedMoveClass plus
// ANALYTIC_SHAPES/ULTIMATE_SHAPES) and passes it in here rather than this
// module reaching into materials.ts/attackEffects.ts's per-move-id override
// tables itself. `level` (default 0) is the player's actual Feynman
// MoveLevel for this move (`getMoveLevel`) -- Noether's own unbought-move
// rows never carry one above 0 (leveling requires already owning the move),
// Landau's/Curie's pass their move's real level so a leveled Analytic/
// Ultimate move's preview escalates into the same multi-trigger cascade a
// real cast plays instead of always showing the flat unleveled loop.
// `previewKey` (default 'default', see art/moveEffectPreview.ts)
// distinguishes one call site's own preview chain from another's -- every
// caller here has exactly one detail pane open at a time and so never needs
// to pass one, except Landau's/Curie's own two-column panels, which have
// two live simultaneously and key each by its own move id.
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
  stageH: number = DETAIL_STAGE_H
): number {
  const clip = drawPreviewStage(scene, container, centerX, y, rightColW, stageH);
  startMoveEffectPreview(
    {
      scene,
      moveClass,
      shapeOverride,
      level,
      at: { x: centerX, y: y + stageH / 2 },
      clip,
    },
    previewKey
  );
  let ny = y + stageH;

  const nameScale = Math.min(fontScale(scene), DETAIL_NAME_CAP);
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

export interface StatusAndConfirmParams {
  scene: GuardianPanelHost;
  container: Phaser.GameObjects.Container;
  centerX: number;
  y: number;
  colW: number;
  // The cost/state line: what this row costs, that it's already unlocked,
  // that it's the form/world/technique the player is already on, etc.
  status: string;
  // Omitted when the previewed row has nothing to commit to -- Dresselhaus's
  // current form, Bloch's current or still-undiscovered world -- in which
  // case the status line stands alone.
  confirm?: {
    label: string;
    onClick: () => void;
    // Half-alpha "you can't do this right now" treatment: unaffordable, or
    // already the active choice. Never blocks the click itself -- the
    // handler's own guard does that, same as every other buy row.
    dimmed?: boolean;
  };
  // Font-scale ceiling for the status line. 1.2 everywhere except Anderson's
  // host-pick pane, which sits under two extra header lines of its own and
  // buys the room back here.
  statusCap?: number;
  // Gap between the status line and the confirm button. 6 everywhere except
  // Bloch's, the densest pane in the game (table + map + blurb + status +
  // button + footer), where the 2px matters.
  gapAfterStatus?: number;
}

// The cost/status line plus its confirm button -- the tail every guardian's
// list+detail pane ends with, below whichever detail header (crystal, move,
// self-buff move) that pane opens with. Shared by Dresselhaus/Anderson/
// Majorana/Noether/Kondo/Bloch (scenes/panels/), which differ only in the
// wording, the affordability check, and what the button actually commits --
// none of which belongs here. Returns the y the pane continues at.
export function renderStatusAndConfirm(params: StatusAndConfirmParams): number {
  const { scene, container, centerX, y, colW, status, confirm, statusCap = 1.2, gapAfterStatus = 6 } = params;

  const statusScale = Math.min(fontScale(scene), statusCap);
  const statusText = scene.add
    .text(centerX, y, status, {
      fontSize: `${Math.round(11 * statusScale)}px`,
      color: REFERENCE_BLUE_GREY_HEX,
      align: 'center',
      wordWrap: { width: colW },
    })
    .setOrigin(0.5, 0);
  container.add(statusText);
  let ny = y + statusText.height + gapAfterStatus;

  if (confirm) {
    const buttonScale = Math.min(fontScale(scene), 1.3);
    const confirmBtn = scene.addDialogueButtonAt(
      container,
      centerX,
      ny,
      confirm.label,
      confirm.onClick,
      colW,
      `${Math.round(13 * buttonScale)}px`
    );
    if (confirm.dimmed) confirmBtn.setAlpha(0.5);
    ny += confirmBtn.height;
  }
  return ny;
}

// Self-buff variant of renderMoveDetailHeader above -- Kondo's three
// self-buff moves (scenes/panels/kondo.ts) never travel from an attacker to
// a target the way an ordinary move does: BattleScene.resolveSelfBuff plays
// the real battle effect centered on the caster's own position, so the
// centred ring the preview draws is the whole effect rather than one half of
// it. What a self-buff pane needs
// beyond that is a crystal to center the ring *on* -- renderMoveDetailHeader
// above has no crystal render at all -- so this renders the player's own
// current crystal standing on a ground-shadow ellipse (the same makeCrystal
// call and shadow geometry Franklin's panel already established, see
// scenes/panels/franklin.ts's showFranklinPanel) with the move's effect
// looping around it, before the same name-text tail every detail header
// here uses. Not named after Kondo specifically so a future self-buff
// guardian's panel can reuse it. `level` (default 0) is the player's actual
// Feynman MoveLevel for this move (`getMoveLevel`), threaded through the
// same way renderMoveDetailHeader above threads its own, so a leveled
// self-buff previews the escalating multi-trigger cascade a real cast plays
// rather than the flat unleveled loop.
export function renderSelfBuffMoveDetailHeader(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  material: Material,
  displayName: string,
  moveClass: MoveClass,
  centerX: number,
  y: number,
  rightColW: number,
  level: MoveLevel = 0
): number {
  const stageH = DETAIL_STAGE_H;
  const crystalSize = DETAIL_CRYSTAL_SIZE;
  const crystalCenterY = y + crystalSize;
  const shadowY = crystalCenterY + crystalSize * 0.85;
  const shadowRx = crystalSize * 1.18;
  const shadowRy = crystalSize * 0.27;

  // Stage first, so the crystal it is cast on stands inside it rather than
  // behind its backing.
  const clip = drawPreviewStage(scene, container, centerX, y, rightColW, stageH);

  container.add(scene.add.ellipse(centerX, shadowY, shadowRx * 2, shadowRy * 2, 0x000000, 0.3));

  const crystal = makeCrystal(scene, crystalSize, material.color, material.variant, { seed: material.name, hybrid: material.hybridParents });
  crystal.setPosition(centerX, crystalCenterY);
  container.add(crystal);

  startMoveEffectPreview({
    scene,
    moveClass,
    level,
    at: { x: centerX, y: crystalCenterY },
    clip,
  });

  let ny = y + stageH;

  const nameScale = Math.min(fontScale(scene), DETAIL_NAME_CAP);
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
