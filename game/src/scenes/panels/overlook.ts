import Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { BUILT_WORLDS } from '../OverworldScene';
import { killTweensDeep } from '../../art/crystals';
import { buildQumatuomiMap } from '../../art/qumatuomiMap';
import { CANVAS_W, CANVAS_H } from '../../art/perspective';
import { fontScale } from '../../ui/text';
import { PANEL_BG, GOLD_ACCENT, GOLD_ACCENT_HEX, REFERENCE_BLUE_GREY_HEX, BOSS_RED_HEX } from '../../ui/theme';
import { WORLD_RIVALS, worldName } from '../../data/materials';
import { getEpoch, getEpochUnlocked, allRivalsFallen, canBeginNextEpoch, beginNextEpoch } from '../../data/epochs';
import {
  MAX_EPOCH,
  epochStatMultiplier,
  epochHpMultiplier,
  epochStakeMultiplier,
  rivalAnalyticChance,
  QUANTUM_ULTIMATE_EPOCH,
} from '../../data/balance';
import type { Epoch } from '../../data/balance';
import { persistFromRegistry } from '../../data/save';
import {
  LIST_DETAIL_PANEL_W,
  DETAIL_NAME_CAP,
  destroyPanel,
  listDetailColumns,
  renderListColumn,
  insertColumnDivider,
  renderListColumnFooter,
  renderStatusAndConfirm,
} from './listDetail';

// The menu the land below the Devouring Mirror's cliff opens (WORLDS.md
// section 4's "The Qumatuomi map below"): every world, and for each one the
// rival that held its pass, with the one thing the map lets the player do
// about it -- stand a fallen rival back up. Resetting a rival clears its
// `rivalDefeated` entry and nothing else, so that world is exactly as it was
// before the fight: the golem stands in the throat, the pass is shut, and the
// fight (and its stake) is there to be taken again.
//
// Laid out like Bloch's panel, which is the other place the player reads this
// map: a list+detail table (scenes/panels/listDetail.ts) of the ten worlds on
// the left, and on the right the Qumatuomi map with the selected world ringed,
// above that world's rival, its state, and the reset button. Picking a row or
// a marker is a preview and a scoped update; the button is the only thing that
// changes the save.
//
// Resetting the rival of the world the player is standing in -- which can only
// be The Adapted, since the cliff is in World 10 -- changes that world under
// their feet: the cliff, and the view this panel was opened from, exist only
// while The Adapted is beaten. The world is re-entered from its far end
// (`advanceToWorld(world, 'goal')`), which puts the player at the pass mouth
// facing a rival that stands again.
//
// The row above the ten worlds is the epoch (data/balance.ts's Epoch,
// data/epochs.ts), the same act at the scale of the whole map: once all ten
// rivals of the latest epoch have fallen it begins the next pass over the
// worlds, in which every one of them stands again, stronger, and the worlds
// are walked in order from the first. All ten, because Bloch folds the player
// to any world reached in the epoch and The Adapted can be brought down with
// other passes still held. The epoch being left stays as it is, and Bloch
// folds the player back to it; what begins here is only ever the next one.
const EPOCH_ROW = 0;
const MAP_H = 146;
const PANEL_STROKE = GOLD_ACCENT;

function rivalDefeatedMap(scene: GuardianPanelHost): Record<number, boolean> {
  return (scene.game.registry.get('rivalDefeated') as Record<number, boolean>) ?? {};
}

// World 9's rival is rolled afresh on every arrival there (data/materials.ts's
// rollRival9Type), so seen from here it has no one name.
function rivalName(world: number): string {
  if (world === 9) return 'A polycrystalline golem';
  return WORLD_RIVALS[world]?.name ?? 'Its rival';
}

// What an epoch does, in the terms the player reads on the row that begins
// it: its multipliers and what the rivals throw.
function epochSummary(epoch: Epoch): string {
  const chance = rivalAnalyticChance(epoch);
  const analytic =
    chance >= 1
      ? "rivals' Analytic moves always land at full power"
      : `rivals throw Analytic moves, at full power ${Math.round(chance * 100)}% of the time`;
  const ultimate = epoch >= QUANTUM_ULTIMATE_EPOCH ? ', and The Quantum Adapted casts Ultimates' : '';
  return `every opponent's stats x${epochStatMultiplier(epoch)} and HP x${epochHpMultiplier(epoch)}, stakes x${epochStakeMultiplier(epoch)}, ${analytic}${ultimate}.`;
}

export function showOverlookPanel(scene: GuardianPanelHost, selected?: number, page = 0) {
  scene.dialogueActive = true;

  const superposition = scene.isSuperpositionMode();
  const discoveredWorlds = new Set<number>(
    superposition ? BUILT_WORLDS : scene.getVisitedWorlds().filter((w) => BUILT_WORLDS.includes(w))
  );
  const defeated = rivalDefeatedMap(scene);
  const epoch = getEpoch(scene.game.registry);

  const panelWidth = LIST_DETAIL_PANEL_W;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  // Added first so everything below (divider, footer, panel background)
  // renders beneath every row/button added to `container` afterward.
  const chromeBlock = scene.add.container(0, 0);
  container.add(chromeBlock);

  let y = top + 14;
  const headScale = Math.min(fontScale(scene), 1.5);
  const title = scene.add
    .text(CANVAS_W / 2, y, 'The worlds below', {
      fontSize: `${Math.round(15 * headScale)}px`,
      color: GOLD_ACCENT_HEX,
      fontStyle: 'bold',
      align: 'center',
    })
    .setOrigin(0.5, 0);
  container.add(title);
  y += title.height + 4;
  const intro = scene.add
    .text(CANVAS_W / 2, y, 'Every pass you opened is on the record. Choose a world to stand its rival up again.', {
      fontSize: `${Math.round(11 * Math.min(fontScale(scene), 1.2))}px`,
      color: REFERENCE_BLUE_GREY_HEX,
      align: 'center',
      wordWrap: { width: panelWidth - 60 },
    })
    .setOrigin(0.5, 0);
  container.add(intro);
  y += intro.height + 12;

  const panelLeft = CANVAS_W / 2 - panelWidth / 2;
  const columns = listDetailColumns(panelLeft);
  const columnsTop = y;

  const items = [EPOCH_ROW, ...BUILT_WORLDS];
  let preview =
    selected !== undefined && items.includes(selected) ? selected : BUILT_WORLDS.find((w) => defeated[w]) ?? BUILT_WORLDS[0];

  const selectWorld = (w: number) => {
    preview = w;
    listResult.setSelectedId(String(w));
    renderDetail();
  };

  const listResult = renderListColumn({
    scene,
    container,
    x: columns.leftX,
    y: columnsTop,
    width: columns.leftColW,
    items,
    idFor: (w) => String(w),
    labelFor: (w) => (w === EPOCH_ROW ? `Epoch ${epoch} of ${MAX_EPOCH}` : discoveredWorlds.has(w) ? worldName(w) : '???'),
    // A world whose rival stands is dimmed: there is nothing here to do to it.
    colorFor: (w) => (w === EPOCH_ROW ? GOLD_ACCENT_HEX : discoveredWorlds.has(w) && defeated[w] ? '#cfd8ff' : '#6a7396'),
    selectedId: String(preview),
    page,
    onPageChange: (next) => {
      destroyPanel(scene);
      showOverlookPanel(scene, preview, next);
    },
    onSelect: (w) => selectWorld(w),
  });

  // Right column: the map, built once per panel open, then the selected
  // world's rival, its state, and the reset button.
  const mapTop = columnsTop;
  const mapBuild = buildQumatuomiMap(scene, { width: columns.rightColW, height: MAP_H, discoveredWorlds });
  mapBuild.container.setPosition(columns.rightColCenterX, mapTop + mapBuild.height / 2);
  container.add(mapBuild.container);
  const detailTop = mapTop + mapBuild.height + 6;

  // A marker selects its world, the same as its row; the hit circle is far
  // larger than the marker, which is only a few px across.
  mapBuild.markers.forEach(({ world, marker }) => {
    marker.setInteractive(new Phaser.Geom.Circle(0, 0, 12), Phaser.Geom.Circle.Contains).on('pointerdown', () => selectWorld(world));
  });

  // Lives inside the map's own container, since the ring is positioned in the
  // map's local coordinates.
  const ringBlock = scene.add.container(0, 0);
  mapBuild.container.add(ringBlock);

  const detailBlock = scene.add.container(0, 0);
  container.add(detailBlock);

  const renderDetail = () => {
    killTweensDeep(scene, ringBlock);
    ringBlock.removeAll(true);
    detailBlock.removeAll(true);
    chromeBlock.removeAll(true);

    const selectedMarker = mapBuild.markers.find((m) => m.world === preview);
    if (selectedMarker) {
      const ring = scene.add.circle(selectedMarker.marker.x, selectedMarker.marker.y, 8, 0x000000, 0).setStrokeStyle(2, GOLD_ACCENT, 1);
      ringBlock.add(ring);
      scene.tweens.add({ targets: ring, scale: 1.8, alpha: { from: 1, to: 0 }, duration: 900, repeat: -1, ease: 'Sine.easeOut' });
    }

    if (preview === EPOCH_ROW) {
      renderEpochDetail();
      return;
    }

    const discovered = discoveredWorlds.has(preview);
    const fallen = !!defeated[preview];
    const rival = rivalName(preview);

    const nameText = scene.add
      .text(columns.rightColCenterX, detailTop, discovered ? rival : '???', {
        fontSize: `${Math.round(13 * Math.min(fontScale(scene), DETAIL_NAME_CAP))}px`,
        color: fallen ? '#cfd8ff' : BOSS_RED_HEX,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: columns.rightColW },
      })
      .setOrigin(0.5, 0);
    detailBlock.add(nameText);

    const status = !discovered
      ? 'Mist covers this land. You have not walked it yet.'
      : !fallen
      ? `It stands in the pass of ${worldName(preview)}, unbeaten. There is nothing to reset.`
      : preview === scene.world
      ? `Fallen. Reset it and it stands in the pass again: the edge closes, and this view with it, until you beat it once more.`
      : `Fallen. Reset it and it stands in the pass of ${worldName(preview)} again: the way on is shut until you beat it once more.`;

    const rightY = renderStatusAndConfirm({
      scene,
      container: detailBlock,
      centerX: columns.rightColCenterX,
      y: detailTop + nameText.height + 6,
      colW: columns.rightColW,
      maxBottom: CANVAS_H - 16,
      status,
      confirm: discovered && fallen ? { label: 'Reset this rival', onClick: () => resetRival(scene, preview, listResult.page) } : undefined,
    });
    closePanel(rightY);
  };

  // The epoch row's own detail: which pass over the worlds this is, how many
  // of its rivals have fallen, and -- once all ten have -- the button that
  // begins the next.
  const renderEpochDetail = () => {
    const nameText = scene.add
      .text(columns.rightColCenterX, detailTop, `Epoch ${epoch} of ${MAX_EPOCH}`, {
        fontSize: `${Math.round(13 * Math.min(fontScale(scene), DETAIL_NAME_CAP))}px`,
        color: GOLD_ACCENT_HEX,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: columns.rightColW },
      })
      .setOrigin(0.5, 0);
    detailBlock.add(nameText);

    const fallenCount = BUILT_WORLDS.filter((w) => defeated[w]).length;
    const cleared = allRivalsFallen(scene.game.registry);
    const next = (epoch + 1) as Epoch;
    const fallenLine = `${fallenCount} of ${BUILT_WORLDS.length} rivals ${fallenCount === 1 ? 'has' : 'have'} fallen.`;
    // An epoch already begun is Bloch's to fold the player to, not this
    // row's to begin again.
    const status =
      epoch >= MAX_EPOCH
        ? cleared
          ? 'The last epoch, and every rival of it has fallen.'
          : `The last epoch. ${fallenLine}`
        : epoch < getEpochUnlocked(scene.game.registry)
        ? `${fallenLine} Epoch ${next} is already begun: Bloch folds you to it.`
        : cleared
        ? `All ten have fallen. Epoch ${next} starts again from ${worldName(1)}, every pass shut: ${epochSummary(next)}`
        : `${fallenLine} All ten open Epoch ${next}: ${epochSummary(next)}`;

    const rightY = renderStatusAndConfirm({
      scene,
      container: detailBlock,
      centerX: columns.rightColCenterX,
      y: detailTop + nameText.height + 6,
      colW: columns.rightColW,
      maxBottom: CANVAS_H - 16,
      status,
      confirm: canBeginNextEpoch(scene.game.registry) ? { label: `Begin Epoch ${next}`, onClick: () => beginEpoch(scene) } : undefined,
    });
    closePanel(rightY);
  };

  // The footer, the divider and the panel behind everything, sized to
  // whichever column runs lower.
  const closePanel = (rightY: number) => {
    const leftBottom = renderListColumnFooter(scene, chromeBlock, columns, listResult.bottom + 10, 'Step back', () => scene.closeDialogue());
    const columnsBottom = Math.max(leftBottom, rightY);
    insertColumnDivider(scene, chromeBlock, columns.dividerX, columnsTop, columnsBottom);

    const panelHeight = columnsBottom + 14 - top;
    const panel = scene.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
      .setStrokeStyle(2, PANEL_STROKE);
    chromeBlock.addAt(panel, 0);
  };
  renderDetail();
}

// Begins the next epoch (data/epochs.ts's beginNextEpoch) and puts the
// player where that epoch starts: World 1, with nothing in it reached and no
// rival fallen.
function beginEpoch(scene: GuardianPanelHost) {
  const registry = scene.game.registry;
  if (!beginNextEpoch(registry)) return;
  persistFromRegistry(registry);
  scene.advanceToWorld(1);
}

function resetRival(scene: GuardianPanelHost, world: number, page: number) {
  const next = { ...rivalDefeatedMap(scene) };
  if (!next[world]) return;
  delete next[world];
  scene.game.registry.set('rivalDefeated', next);
  persistFromRegistry(scene.game.registry);

  if (world === scene.world) {
    scene.advanceToWorld(world, 'goal');
    return;
  }
  destroyPanel(scene);
  showOverlookPanel(scene, world, page);
}
