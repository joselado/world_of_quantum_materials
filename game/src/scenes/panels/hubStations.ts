import Phaser from 'phaser';
import type { HubScene } from '../HubScene';
import { CANVAS_W, CANVAS_H } from '../../art/perspective';
import { fontPx, fontScale, fitProseToBudget } from '../../ui/text';
import {
  PANEL_BG,
  GOLD_ACCENT_HEX,
  REFERENCE_BLUE_GREY,
  REFERENCE_BLUE_GREY_HEX,
  STORY_LAVENDER,
  STORY_LAVENDER_HEX,
  TUTORIAL_CYAN,
  TUTORIAL_CYAN_HEX,
} from '../../ui/theme';
import { visibleTutorialPages } from '../../data/tutorial';
import { storyLogIndex } from '../../data/storyLog';
import {
  LIST_DETAIL_PANEL_W,
  listDetailColumns,
  renderListColumn,
  insertColumnDivider,
  renderListColumnFooter,
  destroyPanel,
} from './listDetail';
import { PASSIVES, PASSIVE_OWNERS, PASSIVE_OWNER_LABELS } from '../../data/passives';
import type { PassiveOwner } from '../../data/passives';
import {
  DENSITY_PRESETS,
  DEFAULT_ENCOUNTER_DENSITY,
  FONT_SCALE_PRESETS,
  DEFAULT_FONT_SCALE,
  MUSIC_STYLE_PRESETS,
  DEFAULT_MUSIC_STYLE,
  DIFFICULTY_TIER_PRESETS,
  DEFAULT_DIFFICULTY_TIER,
} from '../../data/settings';
import { STAT_LABELS } from '../../data/balance';
import { persistFromRegistry } from '../../data/save';
import { music } from '../../audio/music';
import { getBattleMoves, effectiveMovePower, moveDisplayName, getPlayerStats, getPlayerMaterial } from '../../data/materials';
import {
  makeMovesMotif,
  makeStatsMotif,
  makeAbilitiesMotif,
  makeTutorialMotif,
  makeStoryMotif,
  makeSettingsMotif,
  makeTitleScreenMotif,
} from '../../art/labMotifs';

// Every panel below (and HubScene's own Qumatex) shares this gold for its
// fixed "panel name" heading. Tutorial's own page heading is content-specific
// (a different topic's title every time, not a fixed panel name) and keeps
// its own cyan stroke instead.
export const LAB_TITLE_COLOR = GOLD_ACCENT_HEX;

// Every Lab panel's text/button content lays out centered within its own
// panel width, margined in from both edges. A panel's themed motif
// (art/labMotifs.ts) isn't drawn inside the panel -- it sits beside that
// station's own button out in the Lab room instead (HubScene.addStationRow),
// so the panel gets its full width for content rather than sharing it with a
// left-side icon column.
const CONTENT_MARGIN = 30;

export interface LabPanelColumns {
  contentCenterX: number;
  contentWrapW: number;
}

export function labPanelColumns(panelWidth: number): LabPanelColumns {
  return { contentCenterX: CANVAS_W / 2, contentWrapW: panelWidth - CONTENT_MARGIN * 2 };
}

// The seven stations the Lab (HubScene, World 0) offers alongside Qumatex and
// the door onward -- Moves, Stats, Abilities, Tutorial, Story, Settings, Title
// Screen. Each
// function here is what a station's `onClick` calls directly; every one is a
// pure function of registry/save state (player stats/moves/passives/
// settings), not of anything tied to being mid-world, so none of it needs to
// live on OverworldScene -- these only ever run from the Lab. Takes `scene:
// HubScene` as the first param, same shape every scenes/panels/<guardian>.ts
// file takes `scene: OverworldScene`, since HubScene is now this module's
// only caller.
export function showMovesPanel(scene: HubScene) {
  const lines = getBattleMoves(scene.game.registry).map((id) => {
    const power = Math.round(effectiveMovePower(scene.game.registry, id));
    return `${moveDisplayName(scene.game.registry, id)} -- Pwr ${power}`;
  });
  showInfoPanel(scene, 'Your Moves', lines.join('\n'));
}

export function showStatsPanel(scene: HubScene) {
  const stats = getPlayerStats(scene.game.registry);
  const qumatessence = (scene.game.registry.get('qumatessence') as number) || 0;
  const playerMaterial = getPlayerMaterial(scene.game.registry);
  const body =
    `${STAT_LABELS.quantumness}: ${stats.quantumness} -- raises your crit chance\n` +
    `${STAT_LABELS.velocity}: ${stats.velocity} -- higher goes first each round\n` +
    `${STAT_LABELS.correlation}: ${stats.correlation} -- higher takes less damage\n\n` +
    `Qumatessence: ${qumatessence}\nCurrent form: ${playerMaterial.name}\n\n` +
    "Raise any of these with qumatessence at Noether's shop.";
  showInfoPanel(scene, 'Your Stats', body);
}

// Shared body for View Moves/View Stats -- a title, a wrapped/shrink-to-fit
// text block, and a Close button, same shrink-to-fit pattern the Qumatex's
// blurb pane uses.
function showInfoPanel(scene: HubScene, title: string, body: string) {
  scene.dialogueContainer?.destroy(true);

  const panelWidth = 560;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const titleText = scene.add
    .text(CANVAS_W / 2, y, title, { fontSize: fontPx(scene, 15), color: LAB_TITLE_COLOR, fontStyle: 'bold' })
    .setOrigin(0.5, 0);
  container.add(titleText);
  y += titleText.height + 14;

  const columns = labPanelColumns(panelWidth);

  const scale = fontScale(scene);
  let bodyBase = 13;
  const bodyText = scene.add
    .text(columns.contentCenterX, y, body, {
      fontSize: `${Math.round(bodyBase * scale)}px`,
      color: '#cfd8ff',
      align: 'center',
      wordWrap: { width: columns.contentWrapW },
      lineSpacing: 6,
    })
    .setOrigin(0.5, 0);
  container.add(bodyText);
  const reservedBelow = 18 + 46 + 12; // gap + close-button estimate + bottom margin
  while (y + bodyText.height + reservedBelow > CANVAS_H - 10 && bodyBase > 9) {
    bodyBase -= 1;
    bodyText.setFontSize(`${Math.round(bodyBase * scale)}px`);
  }
  y += bodyText.height + 18;

  const closeBtn = scene.addDialogueButtonAt(container, CANVAS_W / 2, y, 'Close', () => scene.closeDialogue(), 260);
  y += closeBtn.height + 12;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.95)
    .setStrokeStyle(2, REFERENCE_BLUE_GREY);
  container.addAt(panel, 0);
}

// The "checkable anytime" surface for a passive owner's current loadout
// (data/passives.ts, DESIGN.md §5) -- one name+description block per owner,
// each its own pair of Text objects with explicitly capped font sizes
// rather than folding both full descriptions into showInfoPanel's single
// wrapped body, since that body's shrink-to-fit only lowers font size and
// never truncates.
export function showAbilitiesPanel(scene: HubScene) {
  scene.dialogueContainer?.destroy(true);

  const panelWidth = 560;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;
  const title = scene.add
    .text(CANVAS_W / 2, y, 'Your Abilities', { fontSize: fontPx(scene, 15), color: LAB_TITLE_COLOR, fontStyle: 'bold' })
    .setOrigin(0.5, 0);
  container.add(title);
  y += title.height + 14;

  const columns = labPanelColumns(panelWidth);

  const nameScale = Math.min(fontScale(scene), 1.3);
  const namePx = `${Math.round(13 * nameScale)}px`;
  const descScale = Math.min(fontScale(scene), 1.2);
  const descPx = `${Math.round(10 * descScale)}px`;

  const activeByOwner = (scene.game.registry.get('activePassiveByOwner') as Partial<Record<PassiveOwner, string>>) ?? {};
  const loadout: { guardian: string; activeId: string | null }[] = PASSIVE_OWNERS.map((owner) => ({
    guardian: PASSIVE_OWNER_LABELS[owner],
    activeId: activeByOwner[owner] ?? null,
  }));
  loadout.forEach(({ guardian, activeId }) => {
    const nameLine = scene.add
      .text(columns.contentCenterX, y, `${guardian}: ${activeId ? PASSIVES[activeId].name : 'None equipped'}`, {
        fontSize: namePx,
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: columns.contentWrapW },
      })
      .setOrigin(0.5, 0);
    container.add(nameLine);
    y += nameLine.height + 3;
    if (activeId) {
      const descLine = scene.add
        .text(columns.contentCenterX, y, PASSIVES[activeId].description, {
          fontSize: descPx,
          color: REFERENCE_BLUE_GREY_HEX,
          align: 'center',
          wordWrap: { width: columns.contentWrapW },
        })
        .setOrigin(0.5, 0);
      container.add(descLine);
      y += descLine.height;
    }
    y += 14;
  });

  const footer = scene.add
    .text(
      columns.contentCenterX,
      y,
      `Switch which one's active by revisiting ${PASSIVE_OWNERS.map((o) => PASSIVE_OWNER_LABELS[o]).join('/')}.`,
      {
        fontSize: fontPx(scene, 11),
        color: REFERENCE_BLUE_GREY_HEX,
        align: 'center',
        wordWrap: { width: columns.contentWrapW },
      }
    )
    .setOrigin(0.5, 0);
  container.add(footer);
  y += footer.height + 18;

  const closeBtn = scene.addDialogueButtonAt(container, CANVAS_W / 2, y, 'Close', () => scene.closeDialogue(), 260);
  y += closeBtn.height + 12;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.95)
    .setStrokeStyle(2, REFERENCE_BLUE_GREY);
  container.addAt(panel, 0);
}

// List+detail layout (scenes/panels/listDetail.ts, STYLE.md's "List+detail
// panels") over data/tutorial.ts's `visibleTutorialPages` -- the topics this
// save has reached, in the order the game reveals them (Story Mode; every
// topic in Superposition Mode) -- the same shape a guardian's own browsed
// panel uses, just with no crystal/move art to preview: the left column
// names each topic (its own `listLabel` if it has one, its `title`
// otherwise), paginated once the set outgrows one page; the right column
// shows the selected topic's full title and body. The list is read once per
// panel build and closed over, so a topic discovered while this panel is
// open can't shift the rows out from under a click.
// Selecting a row is a scoped update (CODEMAP's "scoped
// update" convention), not a panel rebuild: `renderListColumn`'s own
// `setSelectedId` restyles the row in place and only `detailBlock`/
// `chromeBlock` re-render. A page flip still tears the panel down via
// `destroyPanel` and rebuilds, since that changes which rows the list
// itself shows -- the same split every other list+detail panel in the game
// uses. Identifies a topic by its own index into that visible list
// (stringified for `idFor`/`selectedId`) rather than by title, since two
// topics could in principle share a shortened `listLabel`.
export function showTutorialTopics(scene: HubScene) {
  destroyPanel(scene);
  scene.dialogueActive = true;

  const panelWidth = LIST_DETAIL_PANEL_W;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  // Added first so everything below (divider, footer, panel background)
  // renders beneath every row/button added to `container` afterward -- same
  // ordering every guardian's own list+detail panel uses.
  const chromeBlock = scene.add.container(0, 0);
  container.add(chromeBlock);

  let y = top;
  const title = scene.add
    .text(CANVAS_W / 2, y, 'Tutorial', { fontSize: fontPx(scene, 15), color: TUTORIAL_CYAN_HEX, fontStyle: 'bold' })
    .setOrigin(0.5, 0);
  container.add(title);
  y += title.height + 6;

  const hint = scene.add
    .text(CANVAS_W / 2, y, 'Pick a topic to read it.', { fontSize: fontPx(scene, 11), color: REFERENCE_BLUE_GREY_HEX })
    .setOrigin(0.5, 0);
  container.add(hint);
  y += hint.height + 10;

  const panelLeft = CANVAS_W / 2 - panelWidth / 2;
  const columns = listDetailColumns(panelLeft);
  const columnsTop = y;

  const pages = visibleTutorialPages(scene.game.registry);
  const items = pages.map((page, index) => ({ page, id: String(index) }));
  let selected = items.some((it) => it.id === String(scene.tutorialSelectedIndex)) ? String(scene.tutorialSelectedIndex) : items[0].id;

  const listResult = renderListColumn({
    scene,
    container,
    x: columns.leftX,
    y: columnsTop,
    width: columns.leftColW,
    items,
    idFor: (it) => it.id,
    labelFor: (it) => it.page.listLabel ?? it.page.title,
    selectedId: selected,
    page: scene.tutorialPage,
    onPageChange: (page) => {
      scene.tutorialPage = page;
      destroyPanel(scene);
      showTutorialTopics(scene);
    },
    onSelect: (it) => {
      scene.tutorialSelectedIndex = Number(it.id);
      selected = it.id;
      listResult.setSelectedId(it.id);
      renderDetail();
    },
  });
  scene.tutorialPage = listResult.page;

  const detailBlock = scene.add.container(0, 0);
  container.add(detailBlock);

  const renderDetail = () => {
    detailBlock.removeAll(true);
    chromeBlock.removeAll(true);

    const page = pages[Number(selected)];
    let rightY = columnsTop;

    const titleText = scene.add
      .text(columns.rightColCenterX, rightY, page.title, {
        fontSize: fontPx(scene, 15),
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: columns.rightColW },
      })
      .setOrigin(0.5, 0);
    detailBlock.add(titleText);
    rightY += titleText.height + 10;

    // Shrink-only fitting (ui/text.ts's fitProseToBudget with the whole body
    // as one entry): unlike the tutorial tip popup, this pane has no
    // continue button of its own to carry a topic onto a second screen --
    // the only button in the panel is the list column's shared "Close" --
    // so a long topic has to be made to fit where it stands. The right
    // column is narrower than the panel-width bodies elsewhere in the Lab,
    // which is what makes the longest topics need this at all. Nothing sits
    // under this column but the 14px gap and the panel's own bottom pad;
    // the Close button is in the left column's footer, so it isn't reserved
    // for here.
    const bodyText = scene.add
      .text(columns.rightColCenterX, rightY, '', {
        fontSize: `${Math.round(12 * fontScale(scene))}px`,
        color: '#cfd8ff',
        align: 'center',
        wordWrap: { width: columns.rightColW },
        lineSpacing: 5,
      })
      .setOrigin(0.5, 0);
    detailBlock.add(bodyText);
    fitProseToBudget(bodyText, [page.body], CANVAS_H - 16 - 14 - 14 - rightY);
    rightY += bodyText.height + 14;

    const leftBottom = renderListColumnFooter(scene, chromeBlock, columns, listResult.bottom + 10, 'Close', () => scene.closeDialogue());
    const columnsBottom = Math.max(leftBottom, rightY);
    insertColumnDivider(scene, chromeBlock, columns.dividerX, columnsTop, columnsBottom);

    const panelHeight = columnsBottom + 14 - top;
    const panel = scene.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.95)
      .setStrokeStyle(2, TUTORIAL_CYAN);
    chromeBlock.addAt(panel, 0);
  };
  renderDetail();
}

// The Decoherence arc, re-readable in the order a playthrough delivers it
// (data/storyLog.ts's `storyLogIndex`) -- the same list+detail layout the
// Tutorial station above uses, with Qumatex's checklist masking over it: the
// whole arc is always listed, and a chapter the save hasn't reached yet keeps
// its slot as a dimmed "???" row whose detail pane says only that the player
// hasn't walked that far, rather than being absent from the list or spelling
// out what is coming. The list is read once per panel build and closed over,
// so nothing can shift the rows out from under a click.
// Selecting a row is a scoped update (CODEMAP's "scoped update" convention),
// not a panel rebuild: `renderListColumn`'s own `setSelectedId` restyles the
// row in place and only `detailBlock`/`chromeBlock` re-render. A page flip
// still tears the panel down via `destroyPanel` and rebuilds, since that
// changes which rows the list itself shows. Identifies a chapter by its own
// index into STORY_LOG (stringified for `idFor`/`selectedId`), which is
// stable: the list is the whole arc at every point in a playthrough, so a
// row never moves as chapters are reached.
export function showStoryLog(scene: HubScene) {
  destroyPanel(scene);
  scene.dialogueActive = true;

  const panelWidth = LIST_DETAIL_PANEL_W;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  // Added first so everything below (divider, footer, panel background)
  // renders beneath every row/button added to `container` afterward -- same
  // ordering every guardian's own list+detail panel uses.
  const chromeBlock = scene.add.container(0, 0);
  container.add(chromeBlock);

  let y = top;
  const title = scene.add
    .text(CANVAS_W / 2, y, 'Story', { fontSize: fontPx(scene, 15), color: STORY_LAVENDER_HEX, fontStyle: 'bold' })
    .setOrigin(0.5, 0);
  container.add(title);
  y += title.height + 6;

  const hint = scene.add
    .text(CANVAS_W / 2, y, 'Pick a chapter to read it.', { fontSize: fontPx(scene, 11), color: REFERENCE_BLUE_GREY_HEX })
    .setOrigin(0.5, 0);
  container.add(hint);
  y += hint.height + 10;

  const panelLeft = CANVAS_W / 2 - panelWidth / 2;
  const columns = listDetailColumns(panelLeft);
  const columnsTop = y;

  const rows = storyLogIndex(scene.game.registry);
  const items = rows.map((row, index) => ({ row, id: String(index) }));
  let selected = items.some((it) => it.id === String(scene.storySelectedIndex)) ? String(scene.storySelectedIndex) : items[0].id;

  const listResult = renderListColumn({
    scene,
    container,
    x: columns.leftX,
    y: columnsTop,
    width: columns.leftColW,
    items,
    idFor: (it) => it.id,
    labelFor: (it) => (it.row.reached ? it.row.entry.listLabel ?? it.row.entry.title : '???'),
    colorFor: (it) => (it.row.reached ? '#cfd8ff' : '#6a7396'),
    selectedId: selected,
    page: scene.storyPage,
    onPageChange: (page) => {
      scene.storyPage = page;
      destroyPanel(scene);
      showStoryLog(scene);
    },
    onSelect: (it) => {
      scene.storySelectedIndex = Number(it.id);
      selected = it.id;
      listResult.setSelectedId(it.id);
      renderDetail();
    },
  });
  scene.storyPage = listResult.page;

  const detailBlock = scene.add.container(0, 0);
  container.add(detailBlock);

  const renderDetail = () => {
    detailBlock.removeAll(true);
    chromeBlock.removeAll(true);

    const { entry, reached } = rows[Number(selected)];
    let rightY = columnsTop;

    const titleText = scene.add
      .text(columns.rightColCenterX, rightY, reached ? entry.title : '???', {
        fontSize: fontPx(scene, 15),
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: columns.rightColW },
      })
      .setOrigin(0.5, 0);
    detailBlock.add(titleText);
    rightY += titleText.height + 10;

    // Shrink-only fitting, same as the Tutorial station's own pane: this
    // panel's only button is the list column's shared "Close," so a long
    // chapter has to be made to fit where it stands. An unreached chapter
    // shows one short line in place of its body -- a masked row's pane owes
    // the player the fact that there is more road, not a pane of question
    // marks (the same treatment Bloch's own table gives an unvisited world).
    const bodyText = scene.add
      .text(columns.rightColCenterX, rightY, '', {
        fontSize: `${Math.round(12 * fontScale(scene))}px`,
        color: '#cfd8ff',
        align: 'center',
        wordWrap: { width: columns.rightColW },
        lineSpacing: 5,
      })
      .setOrigin(0.5, 0);
    detailBlock.add(bodyText);
    fitProseToBudget(
      bodyText,
      [reached ? entry.body : 'You have not walked this far down the road yet.'],
      CANVAS_H - 16 - 14 - 14 - rightY
    );
    rightY += bodyText.height + 14;

    const leftBottom = renderListColumnFooter(scene, chromeBlock, columns, listResult.bottom + 10, 'Close', () => scene.closeDialogue());
    const columnsBottom = Math.max(leftBottom, rightY);
    insertColumnDivider(scene, chromeBlock, columns.dividerX, columnsTop, columnsBottom);

    const panelHeight = columnsBottom + 14 - top;
    const panel = scene.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.95)
      .setStrokeStyle(2, STORY_LAVENDER);
    chromeBlock.addAt(panel, 0);
  };
  renderDetail();
}

// Wild-encounter density (data/settings.ts's DENSITY_PRESETS, read by
// OverworldScene.generateMap via encounterChance()), text size
// (FONT_SCALE_PRESETS, read live by every fontPx() call), music style
// (MUSIC_STYLE_PRESETS, which of audio/music.ts's SCORES/SCORES_MODERN
// tables MusicEngine draws from), and difficulty tier (DIFFICULTY_TIER_PRESETS,
// data/balance.ts's DIFFICULTY_MULTIPLIERS applied to enemyStatsForWorld).
// Each is a button that cycles through its presets in place (same
// rebuild-the-panel pattern as Noether's shop), rather than a slider, since
// all four have only a handful of discrete steps. Difficulty is the one
// meant to be revisited mid-playthrough rather than set once -- Battle/
// OverworldScene both read it live, so a change here lands on the player's
// very next fight, not just future maps/panels.
export function showSettingsPanel(scene: HubScene) {
  scene.dialogueContainer?.destroy(true);

  const panelWidth = CANVAS_W - 60;
  const top = 14;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const title = scene.add
    .text(CANVAS_W / 2, y, 'Settings', { fontSize: fontPx(scene, 15), color: LAB_TITLE_COLOR, fontStyle: 'bold' })
    .setOrigin(0.5, 0);
  container.add(title);
  y += title.height + 8;

  const columns = labPanelColumns(panelWidth);
  const contentWidth = columns.contentWrapW;

  const registry = scene.game.registry;

  const densityIndex = encounterDensityIndex(registry);
  const densityPreset = DENSITY_PRESETS[densityIndex];
  const densityBtn = scene.addDialogueButtonAt(
    container,
    columns.contentCenterX,
    y,
    `Enemy Density: ${densityPreset.label}`,
    () => {
      const next = DENSITY_PRESETS[(densityIndex + 1) % DENSITY_PRESETS.length];
      registry.set('encounterDensity', next.value);
      persistFromRegistry(registry);
      showSettingsPanel(scene);
    },
    contentWidth
  );
  y += densityBtn.height + 4;

  const densityHint = scene.add
    .text(columns.contentCenterX, y, 'Takes effect on the next map.', {
      fontSize: fontPx(scene, 11),
      color: REFERENCE_BLUE_GREY_HEX,
      align: 'center',
      wordWrap: { width: contentWidth },
      lineSpacing: 4,
    })
    .setOrigin(0.5, 0);
  container.add(densityHint);
  y += densityHint.height + 10;

  const fontIndex = fontScaleIndex(registry);
  const fontPreset = FONT_SCALE_PRESETS[fontIndex];
  const fontBtn = scene.addDialogueButtonAt(
    container,
    columns.contentCenterX,
    y,
    `Text Size: ${fontPreset.label}`,
    () => {
      const next = FONT_SCALE_PRESETS[(fontIndex + 1) % FONT_SCALE_PRESETS.length];
      registry.set('fontScale', next.value);
      persistFromRegistry(registry);
      showSettingsPanel(scene);
    },
    contentWidth
  );
  y += fontBtn.height + 4;

  const fontHint = scene.add
    .text(columns.contentCenterX, y, 'Applies immediately.', {
      fontSize: fontPx(scene, 11),
      color: REFERENCE_BLUE_GREY_HEX,
      align: 'center',
      wordWrap: { width: contentWidth },
      lineSpacing: 4,
    })
    .setOrigin(0.5, 0);
  container.add(fontHint);
  y += fontHint.height + 10;

  const styleIndex = musicStyleIndex(registry);
  const stylePreset = MUSIC_STYLE_PRESETS[styleIndex];
  const styleBtn = scene.addDialogueButtonAt(
    container,
    columns.contentCenterX,
    y,
    `Music Style: ${stylePreset.label}`,
    () => {
      const next = MUSIC_STYLE_PRESETS[(styleIndex + 1) % MUSIC_STYLE_PRESETS.length];
      registry.set('musicStyle', next.value);
      persistFromRegistry(registry);
      music.setStyle(next.value);
      showSettingsPanel(scene);
    },
    contentWidth
  );
  y += styleBtn.height + 4;

  const styleHint = scene.add
    .text(columns.contentCenterX, y, 'Applies immediately.', {
      fontSize: fontPx(scene, 11),
      color: REFERENCE_BLUE_GREY_HEX,
      align: 'center',
      wordWrap: { width: contentWidth },
      lineSpacing: 4,
    })
    .setOrigin(0.5, 0);
  container.add(styleHint);
  y += styleHint.height + 10;

  const tierIndex = difficultyTierIndex(registry);
  const tierPreset = DIFFICULTY_TIER_PRESETS[tierIndex];
  const tierBtn = scene.addDialogueButtonAt(
    container,
    columns.contentCenterX,
    y,
    `Difficulty: ${tierPreset.label}`,
    () => {
      const next = DIFFICULTY_TIER_PRESETS[(tierIndex + 1) % DIFFICULTY_TIER_PRESETS.length];
      registry.set('difficultyTier', next.value);
      persistFromRegistry(registry);
      showSettingsPanel(scene);
    },
    contentWidth
  );
  y += tierBtn.height + 4;

  const tierHint = scene.add
    .text(columns.contentCenterX, y, `"${tierPreset.blurb}" -- applies to your very next battle.`, {
      fontSize: fontPx(scene, 11),
      color: REFERENCE_BLUE_GREY_HEX,
      align: 'center',
      wordWrap: { width: contentWidth },
      lineSpacing: 4,
    })
    .setOrigin(0.5, 0);
  container.add(tierHint);
  y += tierHint.height + 14;

  const closeBtn = scene.addDialogueButtonAt(container, CANVAS_W / 2, y, 'Close', () => scene.closeDialogue(), 260);
  y += closeBtn.height + 8;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.95)
    .setStrokeStyle(2, REFERENCE_BLUE_GREY);
  container.addAt(panel, 0);
}

// The way out of the game, asked before it is taken. The Lab is where a run
// sits between worlds, so it is where a player who is finished stops -- and
// the confirm step is here because this station sits in the same grid as
// Qumatex and the door, where every other click opens something rather than
// leaving.
//
// The save is written before the scene switches: TitleScene.create() reloads
// a mode's whole save slot into the registry, so anything still only in the
// registry at that moment would be dropped on the way out.
export function showTitleScreenPanel(scene: HubScene) {
  scene.dialogueContainer?.destroy(true);

  const panelWidth = 520;
  const top = 90;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top + 14;

  const title = scene.add
    .text(CANVAS_W / 2, y, 'Title Screen', { fontSize: fontPx(scene, 15), color: LAB_TITLE_COLOR, fontStyle: 'bold' })
    .setOrigin(0.5, 0);
  container.add(title);
  y += title.height + 10;

  const body = scene.add
    .text(CANVAS_W / 2, y, 'Leave the lab and return to the title screen? Your progress is saved.', {
      fontSize: fontPx(scene, 12),
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: panelWidth - 60 },
      lineSpacing: 4,
    })
    .setOrigin(0.5, 0);
  container.add(body);
  y += body.height + 14;

  const goBtn = scene.addDialogueButtonAt(
    container,
    CANVAS_W / 2,
    y,
    'Return to Title Screen',
    () => {
      persistFromRegistry(scene.game.registry);
      scene.closeDialogue();
      scene.scene.start('Title');
    },
    300
  );
  y += goBtn.height + 6;

  const stayBtn = scene.addDialogueButtonAt(container, CANVAS_W / 2, y, 'Stay in the Lab', () => scene.closeDialogue(), 300);
  y += stayBtn.height + 14;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.95)
    .setStrokeStyle(2, STORY_LAVENDER);
  container.addAt(panel, 0);
}

function encounterDensityIndex(registry: Phaser.Data.DataManager): number {
  const value = (registry.get('encounterDensity') as number) ?? DEFAULT_ENCOUNTER_DENSITY;
  const idx = DENSITY_PRESETS.findIndex((p) => p.value === value);
  if (idx !== -1) return idx;
  return DENSITY_PRESETS.findIndex((p) => p.value === DEFAULT_ENCOUNTER_DENSITY);
}

function fontScaleIndex(registry: Phaser.Data.DataManager): number {
  const value = (registry.get('fontScale') as number) ?? DEFAULT_FONT_SCALE;
  const idx = FONT_SCALE_PRESETS.findIndex((p) => p.value === value);
  if (idx !== -1) return idx;
  return FONT_SCALE_PRESETS.findIndex((p) => p.value === DEFAULT_FONT_SCALE);
}

function musicStyleIndex(registry: Phaser.Data.DataManager): number {
  const value = (registry.get('musicStyle') as 'classic' | 'modern') ?? DEFAULT_MUSIC_STYLE;
  const idx = MUSIC_STYLE_PRESETS.findIndex((p) => p.value === value);
  if (idx !== -1) return idx;
  return MUSIC_STYLE_PRESETS.findIndex((p) => p.value === DEFAULT_MUSIC_STYLE);
}

function difficultyTierIndex(registry: Phaser.Data.DataManager): number {
  const value = (registry.get('difficultyTier') as 'bsc' | 'msc' | 'phd') ?? DEFAULT_DIFFICULTY_TIER;
  const idx = DIFFICULTY_TIER_PRESETS.findIndex((p) => p.value === value);
  if (idx !== -1) return idx;
  return DIFFICULTY_TIER_PRESETS.findIndex((p) => p.value === DEFAULT_DIFFICULTY_TIER);
}

function isSuperpositionMode(scene: HubScene): boolean {
  return !!scene.game.registry.get('superpositionMode');
}

// Abilities starts out absent from the Lab room entirely on a fresh save
// (HubScene.create() filters LAB_STATIONS by `visible` below) -- there's
// nothing to check until the player has actually learned a passive.
// Superposition Mode (a testing/exploration aid, DESIGN.md §5) always treats
// it as visible: it grants every passive unconditionally the first time an
// Overworld scene runs (OverworldScene.applySuperpositionLeveling), which
// wouldn't cover the very first Lab visit of a fresh Superposition save.
function hasLearnedAnyAbility(scene: HubScene): boolean {
  return isSuperpositionMode(scene) || ((scene.game.registry.get('passivesUnlocked') as string[]) ?? []).length > 0;
}

export interface LabStation {
  label: string;
  motif: (scene: Phaser.Scene, size: number) => Phaser.GameObjects.Container;
  onClick: (scene: HubScene) => void;
  visible: (scene: HubScene) => boolean;
}

// The Lab's seven reference/settings stations, each paired with its own
// `art/labMotifs.ts` icon (planted beside its button in the room by
// HubScene.addStationRow, see labPanelColumns' own comment above) and a
// `visible` check -- HubScene.create() filters this list down to whichever
// stations currently pass and packs the result into rows of three with no
// gaps, rather than reserving a fixed grid slot for a station that isn't
// visible yet.
export const LAB_STATIONS: LabStation[] = [
  { label: 'Moves', motif: makeMovesMotif, onClick: showMovesPanel, visible: () => true },
  { label: 'Stats', motif: makeStatsMotif, onClick: showStatsPanel, visible: () => true },
  { label: 'Abilities', motif: makeAbilitiesMotif, onClick: showAbilitiesPanel, visible: hasLearnedAnyAbility },
  { label: 'Tutorial', motif: makeTutorialMotif, onClick: showTutorialTopics, visible: () => true },
  { label: 'Story', motif: makeStoryMotif, onClick: showStoryLog, visible: () => true },
  { label: 'Settings', motif: makeSettingsMotif, onClick: showSettingsPanel, visible: () => true },
  { label: 'Title Screen', motif: makeTitleScreenMotif, onClick: showTitleScreenPanel, visible: () => true },
];
