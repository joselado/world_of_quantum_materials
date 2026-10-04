import Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { renderGuardianHeader } from './guardianHeader';
import { BUILT_WORLDS } from '../OverworldScene';
import { makeBlochAvatar } from '../../art/bloch';
import { killTweensDeep } from '../../art/crystals';
import { buildQumatuomiMap } from '../../art/qumatuomiMap';
import { CANVAS_W, CANVAS_H } from '../../art/perspective';
import { fontScale, fontPx } from '../../ui/text';
import { PANEL_BG, GOLD_ACCENT, GOLD_ACCENT_HEX, REFERENCE_BLUE_GREY_HEX } from '../../ui/theme';
import { worldName, BLOCH_DESTINATION_COST } from '../../data/materials';
import { worldFlavorFor } from '../../data/worldFlavor';
import { guardianQuoteFor } from '../../data/guardianQuotes';
import { storyLength } from '../../data/settings';
import { persistFromRegistry } from '../../data/save';
import { getEpoch, getEpochUnlocked, epochProgressOf, switchEpoch } from '../../data/epochs';
import type { Epoch } from '../../data/balance';
import {
  LIST_DETAIL_PANEL_W,
  destroyPanel,
  listDetailColumns,
  renderListColumn,
  insertColumnDivider,
  renderListColumnFooter,
  renderStatusAndConfirm,
} from './listDetail';

// Bloch stands at world 2's middle tile (see spawnGuardianSprite/
// WORLD_GUARDIANS) and folds the player to any other world they've already
// visited and that actually has a built map (BUILT_WORLDS) -- offering an
// unbuilt world would teleport the player somewhere with no map to stand
// on. Ends in the plain "Farewell"-only renderFarewellFooter, not the
// Face-the-Rival/Continue footer -- that stays exclusive to the goal
// panel now that Bloch stands mid-corridor rather than at the goal.
// Each individual destination is its own one-time BLOCH_DESTINATION_COST
// qumatessence unlock (registry/save `blochUnlockedWorlds`, a list of
// world numbers already paid for), not a single flat unlock for the whole
// hub: traveling to a world for the first time costs qumatessence and
// records that world as unlocked in the same click, every later trip to
// that same world is free. A destination not yet unlocked shows its cost
// in the status line and dims its confirm button if unaffordable (like
// every other guardian's buy row) -- there's no separate "unlock, then travel later"
// step since confirming a destination is itself the only thing there is to
// do with it. Superposition Mode bypasses this per-destination cost
// entirely and relies on Bloch's hub being the *sole* way to move between
// worlds (there is no separate warp panel), so a fresh Superposition save
// with no qumatessence must still be able to teleport anywhere immediately
// -- including from the Lab itself, before ever stepping through a world
// door.
//
// Layout: a list+detail-shaped table (scenes/panels/listDetail.ts,
// STYLE.md's "List+detail panels") on the left, listing every built world
// (BUILT_WORLDS, all 10) rather than only ones already visited -- a world
// not yet visited (Story Mode; Superposition Mode's own BUILT_WORLDS-as-
// discovered special case below means this never triggers there) shows
// "???" in place of its real name, the same masked-row treatment Qumatex's
// own undiscovered-crystal rows use (HubScene.renderMaterialdexPanel). The
// right column is not a plain per-selection detail pane the way Dresselhaus'/
// Majorana's own right columns are: a persistent Qumatuomi map
// (art/qumatuomiMap.ts), showing all 10 worlds at once and never swapped,
// sits above the actual detail content -- the previewed
// destination's own physics blurb (data/worldFlavor.ts's WORLD_FLAVOR, in
// the same epic-plus-physics voice every guardian's own intro quote uses,
// masked to a short "unmapped" line for an undiscovered world the same way
// its table row and map marker are already masked/shrouded), cost/status
// line, and confirm button -- the same crystal-render-then-name-then-
// status-then-button shape every other list+detail detail pane uses, just
// with the map standing in for the crystal render. Clicking a table row OR
// a map marker only *previews* that world (`scene.blochPreview`) --
// highlighting the row gold-on-purple and pulsing a gold ring around the
// matching marker -- at no cost, updating the blurb/status/button
// underneath the (otherwise unmoving) map in the same click; the confirm
// button is the one action that actually checks/spends the unlock cost and
// travels (`advanceToWorld`). A preview click is a scoped update, not a
// panel rebuild (CODEMAP's "scoped update" convention), which matters more
// here than in any other panel: the map's whole coastline, islands and
// markers are built once per panel open, and a click only moves the
// selection ring (`ringBlock`, inside the map's own container so it shares
// the map's local coordinates) and re-renders `detailBlock`/`chromeBlock`.
// The currently *previewed* world has no
// confirm button at all in two cases: it's the world the player is already
// standing in (`scene.world`, 0 on HubScene so this never triggers there --
// its own status line still names it, "You are standing in World N --
// <name>."), or it hasn't been discovered yet, in which case the status
// line says so in Bloch's own voice instead.
//
// Once a second epoch is unlocked (data/epochs.ts) the table is of one epoch
// at a time, picked on a row of numbered tabs above it: each epoch keeps its
// own record of which worlds the player has reached in it, so the same world
// can be a destination in one epoch and mist in another. The tabs only
// change what the table and map show (`scene.blochEpoch`, a panel rebuild);
// travelling to a world of another epoch is what moves the save onto that
// epoch (switchEpoch), in the same click that folds the player there. The
// world the player stands in is a destination in every epoch but the one
// they are on.
// The height budget the Qumatuomi map is drawn into, above the blurb/status/
// button that share the right column with it. Well past the map's own 110px
// native height, so the coastline draws scaled up and its painted regions and
// texture marks (art/qumatuomiMap.ts) are large enough to read as terrain --
// as much as this panel, the densest in the game (table + map + blurb +
// status/button + footer all in one), can carry: at the largest text-size
// preset the right column is the taller of the two and reaches the bottom of
// the canvas with the same margin the left column already ends on at the
// smallest.
const MAP_H = 146;

export function showBlochHub(scene: GuardianPanelHost) {
  scene.dialogueActive = true;

  const superposition = scene.isSuperpositionMode();
  const registry = scene.game.registry;
  const currentEpoch = getEpoch(registry);
  const epochsUnlocked = getEpochUnlocked(registry);
  const viewEpoch = (
    scene.blochEpoch !== null && scene.blochEpoch >= 1 && scene.blochEpoch <= epochsUnlocked ? scene.blochEpoch : currentEpoch
  ) as Epoch;
  // Superposition Mode reads BUILT_WORLDS directly rather than the
  // persisted `visitedWorlds` list -- same isSuperpositionMode() short-
  // circuit Dresselhaus/Majorana/Anderson use for their own candidate
  // pools. `visitedWorlds` only actually gets pre-seeded with every built
  // world by OverworldScene's applySuperpositionLeveling, which runs on
  // world entry, not on opening the Lab -- a fresh Superposition save
  // still starts in the Lab (TitleScene always starts 'Hub'), so reading
  // the persisted list here would treat every world as undiscovered until
  // the player had already stepped through a world door once.
  // The worlds reached in the epoch being shown. An epoch other than the
  // current one always counts its first world, where beginning it put the
  // player.
  const reached = viewEpoch === currentEpoch ? scene.getVisitedWorlds() : [1, ...epochProgressOf(registry, viewEpoch).visitedWorlds];
  const discoveredWorlds = new Set<number>(superposition ? BUILT_WORLDS : reached.filter((w) => BUILT_WORLDS.includes(w)));
  const unlockedWorlds = (scene.game.registry.get('blochUnlockedWorlds') as number[]) ?? [];
  const isUnlocked = (world: number) => superposition || unlockedWorlds.includes(world);

  const panelWidth = LIST_DETAIL_PANEL_W;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  // Added first so everything below (divider, footer, panel background)
  // renders beneath every row/button added to `container` afterward.
  const chromeBlock = scene.add.container(0, 0);
  container.add(chromeBlock);

  let y = top;

  // Kept short, like Majorana's own intro -- this panel carries more content
  // below than almost any other guardian panel, and an uncapped quote grows
  // uncapped at larger text-size presets the same way every guardian's
  // intro does (STYLE.md), so a short sentence here is part of what keeps
  // worst-case content (largest preset) inside the canvas.
  y = renderGuardianHeader(scene, container, {
    y,
    panelWidth,
    avatar: makeBlochAvatar,
    quote: guardianQuoteFor('bloch', storyLength(scene.game.registry), superposition),
  });

  const panelLeft = CANVAS_W / 2 - panelWidth / 2;
  const columns = listDetailColumns(panelLeft);
  const columnsTop = y;

  // The epoch tabs, at the head of the left column: a muted "Epoch" and one
  // numbered tab per unlocked epoch, the shown one in the selected row's
  // gold-on-purple. They take their height out of the table below them, which
  // pages, and leave the right column's map where it is.
  let listTop = columnsTop;
  if (epochsUnlocked > 1) {
    const tabPx = fontPx(scene, 12);
    const label = scene.add.text(columns.leftX, columnsTop, 'Epoch', { fontSize: tabPx, color: REFERENCE_BLUE_GREY_HEX, padding: { x: 0, y: 4 } });
    container.add(label);
    let tabX = columns.leftX + label.width + 8;
    let tabBottom = columnsTop + label.height;
    for (let epoch = 1; epoch <= epochsUnlocked; epoch++) {
      const shown = epoch === viewEpoch;
      const tab = scene.add
        .text(tabX, columnsTop, String(epoch), {
          fontSize: tabPx,
          color: shown ? GOLD_ACCENT_HEX : '#cfd8ff',
          backgroundColor: shown ? '#3a2a5c' : '#1c1c30',
          padding: { x: 8, y: 4 },
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          if (shown) return;
          scene.blochEpoch = epoch;
          scene.blochPreview = null;
          scene.blochPage = 0;
          destroyPanel(scene);
          showBlochHub(scene);
        });
      container.add(tab);
      tabX += tab.width + 4;
      tabBottom = Math.max(tabBottom, columnsTop + tab.height);
    }
    listTop = tabBottom + 6;
  }

  const items = BUILT_WORLDS;
  const isStandingIn = (w: number) => w === scene.world && viewEpoch === currentEpoch;
  const isTravelable = (w: number) => discoveredWorlds.has(w) && !isStandingIn(w);
  const firstTravelable = items.find(isTravelable);
  let preview = items.includes(scene.blochPreview ?? -1) ? (scene.blochPreview as number) : firstTravelable ?? items[0];

  const selectWorld = (w: number) => {
    scene.blochPreview = w;
    preview = w;
    listResult.setSelectedId(String(w));
    renderDetail();
  };

  const listResult = renderListColumn({
    scene,
    container,
    x: columns.leftX,
    y: listTop,
    width: columns.leftColW,
    items,
    idFor: (w) => String(w),
    labelFor: (w) => (discoveredWorlds.has(w) ? worldName(w) : '???'),
    colorFor: (w) => (discoveredWorlds.has(w) ? '#cfd8ff' : '#6a7396'),
    selectedId: String(preview),
    page: scene.blochPage,
    onPageChange: (page) => {
      scene.blochPage = page;
      destroyPanel(scene);
      showBlochHub(scene);
    },
    onSelect: (w) => selectWorld(w),
  });
  scene.blochPage = listResult.page;

  // Right column: the persistent Qumatuomi map (all 10 worlds, built once
  // per panel open and never swapped or redrawn on a preview click -- only
  // the selection ring inside it moves), then the previewed destination's
  // own blurb, cost/status line, and confirm button.
  const mapTop = columnsTop;
  const mapBuild = buildQumatuomiMap(scene, { width: columns.rightColW, height: MAP_H, discoveredWorlds });
  // buildQumatuomiMap does uniform scale-to-fit -- its returned width/height
  // are usually smaller than the requested budget on one axis, so the real
  // rendered size (not the request) drives the rest of this column's math.
  // Height is the binding side of the budget: the right column's own width is
  // far more room than the silhouette's proportions need, so MAP_H alone sets
  // how large the map draws.
  mapBuild.container.setPosition(columns.rightColCenterX, mapTop + mapBuild.height / 2);
  container.add(mapBuild.container);
  const detailTop = mapTop + mapBuild.height + 4;

  // Each marker previews its own world on click (same effect as its table
  // row), with a generous invisible hit circle since the marker itself is
  // only a few px across.
  mapBuild.markers.forEach(({ world, marker }) => {
    marker.setInteractive(new Phaser.Geom.Circle(0, 0, 12), Phaser.Geom.Circle.Contains).on('pointerdown', () => selectWorld(world));
  });

  // The previewed world's own marker gets a pulsing gold ring so the map and
  // table can never disagree about the current selection. Lives in its own
  // container *inside* the map's, since the ring is positioned in the map's
  // local coordinates -- redrawn on every preview click while the map's own
  // coastline/islands/markers stay put.
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

    const isCurrent = isStandingIn(preview);
    const discovered = discoveredWorlds.has(preview);
    const name = worldName(preview);

    // The previewed destination's own physics blurb -- masked to a short
    // fixed line for an undiscovered world (the table row already reads
    // "???" and the map marker is already shrouded; a full paragraph of
    // course content for a world never visited would leak more than either
    // of those does). Shrinks in whole-px steps (floor 9, same technique
    // Majorana's own hybrid-fusion-lore description uses) -- reservedBelow
    // covers everything still to come below it (status line, confirm
    // button, footer) the same way Majorana's own reservedBelow does.
    const descScale = Math.min(fontScale(scene), 1.1);
    let descBase = 11;
    const descText = scene.add
      .text(columns.rightColCenterX, detailTop, discovered ? worldFlavorFor(preview, storyLength(scene.game.registry)) : 'Mist covers this land. You have not walked it yet.', {
        fontSize: `${Math.round(descBase * descScale)}px`,
        color: '#cfd8ff',
        align: 'left',
        wordWrap: { width: columns.rightColW },
        lineSpacing: 3,
      })
      .setOrigin(0.5, 0);
    detailBlock.add(descText);
    // Status line (two lines at Large), the confirm button at its full
    // dialogue-button size (renderStatusAndConfirm), and the panel's own
    // bottom margin: what the longest Detailed blurb has to leave room for
    // with every world listed (Superposition Mode) at the Large preset.
    const reservedBelow = 120;
    while (detailTop + descText.height + reservedBelow > CANVAS_H - 10 && descBase > 9) {
      descBase -= 1;
      descText.setFontSize(`${Math.round(descBase * descScale)}px`);
    }

    const unlocked = isUnlocked(preview);
    const tokens = (scene.game.registry.get('qumatessence') as number) || 0;
    // Travelling to another epoch's world moves the save onto that epoch, so
    // the status line names the epoch ahead of the price. Kept to the one
    // line the status has at the default text size: this pane has no spare
    // row to wrap into.
    const crossing = viewEpoch !== currentEpoch;
    const rightY = renderStatusAndConfirm({
      scene,
      container: detailBlock,
      centerX: columns.rightColCenterX,
      y: detailTop + descText.height + 4,
      colW: columns.rightColW,
      // 4 rather than the usual 6: this is the densest guardian panel in the
      // game and the 2px is worth reclaiming here.
      gapAfterStatus: 4,
      // This pane's height is set by its own content (table, map, blurb,
      // status, button), not by the column beside it, so the button is the
      // one part still free to give: it shrinks toward its floor until it
      // clears the canvas floor less the panel's own bottom margin. Binds
      // only with every world listed (Superposition Mode), the longest
      // Detailed blurb and the Large preset all at once.
      maxBottom: CANVAS_H - 16,
      status: isCurrent
        ? `You are standing in World ${preview}: ${name}.`
        : !discovered
        ? viewEpoch === currentEpoch
          ? 'You have never walked this land. I cannot fold you where you have not been.'
          : `You have not walked this land in Epoch ${viewEpoch}. I cannot fold you where you have not been.`
        : crossing
        ? unlocked
          ? `Epoch ${viewEpoch}: already unlocked, free to travel.`
          : `Epoch ${viewEpoch}: costs ${BLOCH_DESTINATION_COST} qumatessence to unlock (one-time).`
        : unlocked
        ? 'Already unlocked, free to travel.'
        : `Costs ${BLOCH_DESTINATION_COST} qumatessence to unlock (one-time; free after).`,
      // No confirm button for the world the player is already standing in,
      // or for one they have not discovered yet -- neither is a destination
      // Bloch can fold them to.
      confirm:
        isCurrent || !discovered
          ? undefined
          : {
              label: `Travel to ${name}`,
              onClick: () => travelTo(scene, preview, viewEpoch, unlocked, unlockedWorlds),
              dimmed: !unlocked && tokens < BLOCH_DESTINATION_COST,
            },
    });

    const leftBottom = renderListColumnFooter(scene, chromeBlock, columns, listResult.bottom + 10, 'Farewell', () => scene.closeDialogue());
    const columnsBottom = Math.max(leftBottom, rightY);
    insertColumnDivider(scene, chromeBlock, columns.dividerX, columnsTop, columnsBottom);

    const panelHeight = columnsBottom + 14 - top;
    const panel = scene.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
      .setStrokeStyle(2, 0x4adde0);
    chromeBlock.addAt(panel, 0);
  };
  renderDetail();
}

// Folds the player to `world` as it stands in `epoch`. A destination is
// paid for once, whichever epoch it is first travelled to in. Going to
// another epoch's world moves the save onto that epoch first (switchEpoch),
// so the world is entered under its rules and with its passes.
function travelTo(scene: GuardianPanelHost, world: number, epoch: Epoch, isUnlocked: boolean, unlockedWorlds: number[]) {
  const registry = scene.game.registry;
  if (!isUnlocked) {
    if ((registry.get('qumatessence') as number) < BLOCH_DESTINATION_COST) return;
    scene.qumatessence -= BLOCH_DESTINATION_COST;
    registry.set('qumatessence', scene.qumatessence);
    scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
    registry.set('blochUnlockedWorlds', [...unlockedWorlds, world]);
  }
  if (epoch !== getEpoch(registry)) switchEpoch(registry, epoch);
  persistFromRegistry(registry);
  scene.advanceToWorld(world);
}
