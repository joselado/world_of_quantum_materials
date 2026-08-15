import type { GuardianPanelHost } from '../OverworldScene';
import { makeFranklinAvatar } from '../../art/franklin';
import { killTweensDeep, makeCrystal } from '../../art/crystals';
import { drawFranklinPassiveHalo } from '../../art/passiveHalos';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';
import { fontPx, fontScale } from '../../ui/text';
import { PANEL_BG } from '../../ui/theme';
import { FRANKLIN_PASSIVE_IDS, PASSIVES } from '../../data/passives';
import type { PassiveOwner } from '../../data/passives';
import { renderPassiveList } from './passiveList';
import { insertColumnDivider } from './listDetail';

// Franklin stands at world 9's middle tile (WORLD_GUARDIANS) and sells
// three passive abilities (data/passives.ts's FRANKLIN_PASSIVE_IDS --
// Diffraction Shadow, Satellite Reflection, Amorphous Halo) instead of
// moves: a whole-battle always-on modifier picked once by visiting Franklin,
// not something chosen from the move menu each turn. Uses renderPassiveList
// below, a thin wrapper around the same renderChoiceList engine
// showKondoPanel's shop uses -- see renderChoiceList's own comment for the
// shared "buy several, only one active" shape both guardians sell.
//
// Qumatex-like: beside the list sits the player's own current crystal
// (makeCrystal, the same convention BattleScene renders it with) standing on
// its own ground shadow, since Franklin's whole pitch is teaching *your*
// crystal a new trick. The shadow starts out showing whichever passive's
// ground halo (art/passiveHalos.ts) is actually active (or nothing if none
// is), and clicking any passive's description below (renderPassiveList's own
// onSelect hook) swaps the preview in place -- a plain closure variable
// (renderCrystalBlock below), never persisted state, so a commit made from
// the list (buy/activate, both of which call reopen()) always redraws this
// panel from scratch and the crystal falls back to whatever is now actually
// active rather than a preview click from before that commit surviving
// stale. Matches every other guardian panel's "look costs nothing, only
// committing does" convention. The previewed halo renders at reduced alpha
// with a "(preview)" tag unless it's the one actually active in battle, so
// browsing never reads as having already changed something.
export function showFranklinPanel(scene: GuardianPanelHost) {
  scene.dialogueActive = true;

  const panelWidth = 760;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 42;
  const avatar = makeFranklinAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  playGuardianChime();
  y = avatarY + 48;

  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      '"Fire X-rays through a defect-riddled crystal and the sharp spots blur into rings: every pore and dislocation leaves its signature in how the beam scatters. I can teach your crystal to scatter a blow the same way. Only one lesson holds at a time."',
      { fontSize: fontPx(scene, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 14;

  const columnsTop = y;
  const panelLeft = CANVAS_W / 2 - panelWidth / 2;
  const innerMargin = 20;
  const leftColW = 170;
  const gapCols = 20;
  const leftColCenterX = panelLeft + innerMargin + leftColW / 2;
  const rightColLeft = panelLeft + innerMargin + leftColW + gapCols;
  const rightColRight = panelLeft + panelWidth - innerMargin;
  const rightColCenterX = rightColLeft + (rightColRight - rightColLeft) / 2;

  const activeByOwner = (scene.game.registry.get('activePassiveByOwner') as Partial<Record<PassiveOwner, string>>) ?? {};
  const activeId = activeByOwner.franklin ?? null;

  // Fixed-size art block (crystal + ground shadow + halo), not scaled by the
  // text-size setting -- same "art, not text" reasoning HubScene's own
  // Qumatex detail pane uses for its crystalBlockH. Only the status label
  // below it is real text and scales (capped, same reasoning renderChoiceList's
  // own descriptions are capped -- this panel has no shrink-to-fit net).
  const crystalSize = 34;
  const crystalCenterY = columnsTop + crystalSize;
  const shadowY = crystalCenterY + crystalSize * 0.85;
  const shadowRx = crystalSize * 1.18;
  const shadowRy = crystalSize * 0.27;

  // Reserves room for the tallest possible label ("<longest passive name>
  // (preview)") up front, same sample-measurement technique
  // renderPagedButtons/Qumatex's own list use for a paginated row, so a
  // later preview click can never make the crystal block taller than the
  // panel was originally sized for.
  const labelScale = Math.min(fontScale(scene), 1.2);
  const labelPx = `${Math.round(10 * labelScale)}px`;
  const longestLabel = FRANKLIN_PASSIVE_IDS.map((id) => `${PASSIVES[id].name} (preview)`).sort((a, b) => b.length - a.length)[0];
  const sampleLabel = scene.add.text(-1000, -1000, longestLabel, { fontSize: labelPx, align: 'center', wordWrap: { width: leftColW } });
  const reservedLabelH = sampleLabel.height;
  sampleLabel.destroy();
  const crystalBlockBottom = shadowY + shadowRy + 6 + reservedLabelH;

  const crystalBlock = scene.add.container(0, 0);
  container.add(crystalBlock);

  const renderCrystalBlock = (previewId: string | null) => {
    killTweensDeep(scene, crystalBlock);
    crystalBlock.removeAll(true);

    crystalBlock.add(scene.add.ellipse(leftColCenterX, shadowY, shadowRx * 2, shadowRy * 2, 0x000000, 0.3));
    if (previewId) {
      const alpha = previewId === activeId ? 1 : 0.45;
      drawFranklinPassiveHalo(scene, crystalBlock, leftColCenterX, shadowY, previewId, shadowRx, shadowRy, alpha);
    }

    const crystal = makeCrystal(scene, crystalSize, scene.playerMaterial.color, scene.playerMaterial.variant, {
      seed: scene.playerMaterial.name,
      hybrid: scene.playerMaterial.hybridParents,
    });
    crystal.setPosition(leftColCenterX, crystalCenterY);
    crystalBlock.add(crystal);

    const labelText = previewId
      ? previewId === activeId
        ? `${PASSIVES[previewId].name} (active)`
        : `${PASSIVES[previewId].name} (preview)`
      : 'No passive active';
    const label = scene.add
      .text(leftColCenterX, shadowY + shadowRy + 6, labelText, {
        fontSize: labelPx,
        color: previewId && previewId !== activeId ? '#c9a8ff' : '#cfd8ff',
        align: 'center',
        wordWrap: { width: leftColW },
      })
      .setOrigin(0.5, 0);
    crystalBlock.add(label);
  };
  renderCrystalBlock(activeId);

  const listBottom = renderPassiveList(scene, container, columnsTop, FRANKLIN_PASSIVE_IDS, 'franklin', () => showFranklinPanel(scene), {
    centerX: rightColCenterX,
    wrapWidth: rightColRight - rightColLeft - 16,
    onSelect: (id) => renderCrystalBlock(id),
  });

  const columnsBottom = Math.max(crystalBlockBottom, listBottom);
  // Vertical divider between the crystal preview and the list -- the same
  // shared helper every list+detail panel uses (scenes/panels/listDetail.ts),
  // drawn after both columns so the real height is known.
  insertColumnDivider(scene, container, rightColLeft - gapCols / 2, columnsTop, columnsBottom);

  y = columnsBottom + 8;
  y = scene.renderFarewellFooter(container, y);
  y += 8;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
    .setStrokeStyle(2, 0xa878c9);
  container.addAt(panel, 0);
}
