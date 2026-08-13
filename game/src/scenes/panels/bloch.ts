import Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { BUILT_WORLDS } from '../OverworldScene';
import { makeBlochAvatar } from '../../art/bloch';
import { buildQumatuomiMap } from '../../art/qumatuomiMap';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W, CANVAS_H } from '../../art/perspective';
import { fontPx, fontScale } from '../../ui/text';
import { PANEL_BG, REFERENCE_BLUE_GREY_HEX, GOLD_ACCENT } from '../../ui/theme';
import { WORLD_NAMES, BLOCH_DESTINATION_COST } from '../../data/materials';
import { WORLD_FLAVOR } from '../../data/worldFlavor';
import { persistFromRegistry } from '../../data/save';
import { LIST_DETAIL_PANEL_W, listDetailColumns, renderListColumn, insertColumnDivider } from './listDetail';

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
// in the confirm button and dims if unaffordable (like every other
// guardian's buy row) -- there's no separate "unlock, then travel later"
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
// (art/qumatuomiMap.ts), rendered once showing all 10 worlds at once and
// never swapped, sits above the actual detail content -- the previewed
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
// travels (`advanceToWorld`). The currently *previewed* world has no
// confirm button at all in two cases: it's the world the player is already
// standing in (`scene.world`, 0 on HubScene so this never triggers there --
// its own status line still names it, "You are standing in World N --
// <name>."), or it hasn't been discovered yet ("You haven't mapped
// anywhere else yet." -- the same copy an earlier, whole-panel-replacing
// empty state used before every world got its own row).
export function showBlochHub(scene: GuardianPanelHost) {
  scene.dialogueActive = true;

  const superposition = scene.isSuperpositionMode();
  // Superposition Mode reads BUILT_WORLDS directly rather than the
  // persisted `visitedWorlds` list -- same isSuperpositionMode() short-
  // circuit Dresselhaus/Majorana/Anderson use for their own candidate
  // pools. `visitedWorlds` only actually gets pre-seeded with every built
  // world by OverworldScene's applySuperpositionLeveling, which runs on
  // world entry, not on opening the Lab -- a fresh Superposition save
  // still starts in the Lab (TitleScene always starts 'Hub'), so reading
  // the persisted list here would treat every world as undiscovered until
  // the player had already stepped through a world door once.
  const discoveredWorlds = new Set<number>(
    superposition ? BUILT_WORLDS : scene.getVisitedWorlds().filter((w) => BUILT_WORLDS.includes(w))
  );
  const unlockedWorlds = (scene.game.registry.get('blochUnlockedWorlds') as number[]) ?? [];
  const isUnlocked = (world: number) => superposition || unlockedWorlds.includes(world);

  const panelWidth = LIST_DETAIL_PANEL_W;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const avatarY = y + 42;
  const avatar = makeBlochAvatar(scene);
  avatar.setPosition(CANVAS_W / 2, avatarY);
  container.add(avatar);
  scene.tweens.add({ targets: avatar, y: avatarY + 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  y = avatarY + 48;
  playGuardianChime();

  // Kept short, like Majorana's own intro -- this panel carries more content
  // below than almost any other guardian panel, and an uncapped quote grows
  // uncapped at larger text-size presets the same way every guardian's
  // intro does (STYLE.md), so a short sentence here is part of what keeps
  // worst-case content (largest preset) inside the canvas.
  const intro = scene.add
    .text(
      CANVAS_W / 2,
      y,
      superposition
        ? '"I am Bloch. In superposition every world is already within reach -- name any of them."'
        : '"I am Bloch. Name a world you have already touched, and I will fold you there."',
      { fontSize: fontPx(scene, 11), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: panelWidth - 80 } }
    )
    .setOrigin(0.5, 0);
  container.add(intro);
  // Deliberately not trimmed tighter than other guardian panels' own
  // intro-to-columns gap: shaving even a couple more px here pushes
  // columnsTop up just enough to flip renderListColumn's own fit-per-page
  // count by a whole extra row (a ~28px jump, not a small one), which costs
  // far more height than this gap could ever save. The margin below is
  // reclaimed downstream instead (the right column's own blurb/status/
  // button gaps, and the footer's).
  y += intro.height + 6;

  const panelLeft = CANVAS_W / 2 - panelWidth / 2;
  const columns = listDetailColumns(panelLeft);
  const columnsTop = y;

  const items = BUILT_WORLDS;
  const isTravelable = (w: number) => discoveredWorlds.has(w) && w !== scene.world;
  const firstTravelable = items.find(isTravelable);
  const effectivePreview = items.includes(scene.blochPreview ?? -1) ? (scene.blochPreview as number) : firstTravelable ?? items[0];

  const listResult = renderListColumn({
    scene,
    container,
    x: columns.leftX,
    y: columnsTop,
    width: columns.leftColW,
    items,
    idFor: (w) => String(w),
    labelFor: (w) => (discoveredWorlds.has(w) ? WORLD_NAMES[w] ?? `World ${w}` : '???'),
    colorFor: (w) => (discoveredWorlds.has(w) ? '#cfd8ff' : '#6a7396'),
    selectedId: String(effectivePreview),
    page: scene.blochPage,
    onPageChange: (page) => {
      scene.blochPage = page;
      scene.dialogueContainer?.destroy(true);
      showBlochHub(scene);
    },
    onSelect: (w) => {
      scene.blochPreview = w;
      scene.dialogueContainer?.destroy(true);
      showBlochHub(scene);
    },
  });
  scene.blochPage = listResult.page;

  // Right column: the persistent Qumatuomi map (all 10 worlds, every visit
  // -- not swapped per selection), then the previewed destination's own
  // blurb, cost/status line, and confirm button.
  let rightY = columnsTop;
  const mapBuild = buildQumatuomiMap(scene, { width: columns.rightColW, height: 78, discoveredWorlds });
  // buildQumatuomiMap does uniform scale-to-fit -- its returned width/height
  // are usually smaller than the requested budget on one axis, so the real
  // rendered size (not the request) drives the rest of this column's math.
  // Height is deliberately the tight side of the budget -- this is the
  // densest guardian panel in the game (table + map + blurb + status/button
  // + footer all in one), so the map stays legible rather than large.
  mapBuild.container.setPosition(columns.rightColCenterX, rightY + mapBuild.height / 2);
  container.add(mapBuild.container);
  rightY += mapBuild.height + 4;

  // Each marker previews its own world on click (same effect as its table
  // row), with a generous invisible hit circle since the marker itself is
  // only a few px across. The previewed world's own marker gets a pulsing
  // gold ring so the map and table can never disagree about the current
  // selection.
  mapBuild.markers.forEach(({ world, marker }) => {
    marker.setInteractive(new Phaser.Geom.Circle(0, 0, 12), Phaser.Geom.Circle.Contains).on('pointerdown', () => {
      scene.blochPreview = world;
      scene.dialogueContainer?.destroy(true);
      showBlochHub(scene);
    });
  });
  const selectedMarker = mapBuild.markers.find((m) => m.world === effectivePreview);
  if (selectedMarker) {
    const ring = scene.add.circle(selectedMarker.marker.x, selectedMarker.marker.y, 8, 0x000000, 0).setStrokeStyle(2, GOLD_ACCENT, 1);
    mapBuild.container.add(ring);
    scene.tweens.add({ targets: ring, scale: 1.8, alpha: { from: 1, to: 0 }, duration: 900, repeat: -1, ease: 'Sine.easeOut' });
  }

  const isCurrent = effectivePreview === scene.world;
  const discovered = discoveredWorlds.has(effectivePreview);
  const name = WORLD_NAMES[effectivePreview] ?? `World ${effectivePreview}`;

  // The previewed destination's own physics blurb -- masked to a short fixed
  // line for an undiscovered world (the table row already reads "???" and
  // the map marker is already shrouded; a full paragraph of course content
  // for a world never visited would leak more than either of those does).
  // Shrinks in whole-px steps (floor 9, same technique Majorana's own
  // hybrid-fusion-lore description uses) -- reservedBelow covers everything
  // still to come below it (status line, confirm button, footer) the same
  // way Majorana's own reservedBelow does.
  const descScale = Math.min(fontScale(scene), 1.1);
  let descBase = 11;
  const descText = scene.add
    .text(columns.rightColCenterX, rightY, discovered ? WORLD_FLAVOR[effectivePreview] : 'Mist covers this land -- you have not walked it yet.', {
      fontSize: `${Math.round(descBase * descScale)}px`,
      color: '#cfd8ff',
      align: 'left',
      wordWrap: { width: columns.rightColW },
      lineSpacing: 3,
    })
    .setOrigin(0.5, 0);
  container.add(descText);
  const reservedBelow = 100;
  while (rightY + descText.height + reservedBelow > CANVAS_H - 10 && descBase > 9) {
    descBase -= 1;
    descText.setFontSize(`${Math.round(descBase * descScale)}px`);
  }
  rightY += descText.height + 4;

  const statusScale = Math.min(fontScale(scene), 1.2);
  const statusLabel = isCurrent
    ? `You are standing in World ${effectivePreview} -- ${name}.`
    : !discovered
    ? "You haven't mapped anywhere else yet."
    : isUnlocked(effectivePreview)
    ? 'Already unlocked -- free to travel.'
    : `Costs ${BLOCH_DESTINATION_COST} qumatessence to unlock (one-time; free after).`;
  const statusText = scene.add
    .text(columns.rightColCenterX, rightY, statusLabel, {
      fontSize: `${Math.round(11 * statusScale)}px`,
      color: REFERENCE_BLUE_GREY_HEX,
      align: 'center',
      wordWrap: { width: columns.rightColW },
    })
    .setOrigin(0.5, 0);
  container.add(statusText);
  rightY += statusText.height + 4;

  if (!isCurrent && discovered) {
    const unlocked = isUnlocked(effectivePreview);
    const tokens = (scene.game.registry.get('qumatessence') as number) || 0;
    const affordable = unlocked || tokens >= BLOCH_DESTINATION_COST;
    const buttonScale = Math.min(fontScale(scene), 1.3);
    const confirmBtn = scene.addDialogueButtonAt(
      container,
      columns.rightColCenterX,
      rightY,
      unlocked ? `Travel to World ${effectivePreview} -- ${name}` : `Travel to World ${effectivePreview} -- ${name} (${BLOCH_DESTINATION_COST} qumatessence)`,
      () => travelTo(scene, effectivePreview, unlocked, unlockedWorlds),
      columns.rightColW,
      `${Math.round(13 * buttonScale)}px`
    );
    if (!affordable) confirmBtn.setAlpha(0.5);
    rightY += confirmBtn.height;
  }

  const columnsBottom = Math.max(listResult.bottom, rightY);
  insertColumnDivider(scene, container, columns.dividerX, columnsTop, columnsBottom);
  y = columnsBottom + 6;

  y = scene.renderFarewellFooter(container, y);
  y += 2;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.94)
    .setStrokeStyle(2, 0x4adde0);
  container.addAt(panel, 0);
}

function travelTo(scene: GuardianPanelHost, world: number, isUnlocked: boolean, unlockedWorlds: number[]) {
  if (isUnlocked) {
    scene.advanceToWorld(world);
    return;
  }
  if ((scene.game.registry.get('qumatessence') as number) < BLOCH_DESTINATION_COST) return;
  scene.qumatessence -= BLOCH_DESTINATION_COST;
  scene.game.registry.set('qumatessence', scene.qumatessence);
  scene.tokenText.setText(`Qumatessence: ${scene.qumatessence}`);
  scene.game.registry.set('blochUnlockedWorlds', [...unlockedWorlds, world]);
  persistFromRegistry(scene.game.registry);
  scene.advanceToWorld(world);
}
