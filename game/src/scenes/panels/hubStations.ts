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
  renderMoveDetailHeader,
  renderSelfBuffMoveDetailHeader,
  destroyPanel,
} from './listDetail';
import { ANALYTIC_SHAPES, ULTIMATE_SHAPES } from '../../art/attackEffects';
import { stopMoveEffectPreview } from '../../art/moveEffectPreview';
import { killTweensDeep } from '../../art/crystals';
import { MOVE_CLASS_LORE } from '../../data/moveLore';
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
  WORLD_SIZE_PRESETS,
  DEFAULT_WORLD_SIZE,
  TOUCH_CONTROLS_PRESETS,
  DEFAULT_TOUCH_CONTROLS,
  SETTINGS_CATEGORIES,
  ON_OFF_PRESETS,
  tutorialTipsEnabled,
  storyScreensEnabled,
  isTouchDevice,
} from '../../data/settings';
import type { WorldSizeId, TouchControlsMode, SettingsCategoryId } from '../../data/settings';
import { STAT_LABELS } from '../../data/balance';
import { persistFromRegistry } from '../../data/save';
import { music } from '../../audio/music';
import {
  getBattleMoves,
  effectiveMovePower,
  moveDisplayName,
  getPlayerStats,
  getPlayerMaterial,
  getMoveLevel,
  getTunedMoveClass,
  quasiparticleLabel,
  MOVES,
  ANALYTIC_MOVE_IDS,
  ULTIMATE_MOVE_IDS,
} from '../../data/materials';
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
// Every move the player could actually pick in a fight right now
// (data/materials.ts's getBattleMoves: unlocked, hostable by the current form
// or its dopant, and for Kondo's screenings only the one currently made
// active), in the order the panel reads them: the ordinary attacks by power,
// then Landau's tunable Analytic pair, then whichever cloud Kondo's is
// holding, then Skłodowska-Curie's Ultimates last. Power ascending inside each
// group, so reading down the column is reading up the escalation, and the
// three groups that carry a guardian's own machinery sit past the plain
// strikes rather than interleaved with them by raw number.
function browsableBattleMoves(scene: HubScene): string[] {
  const rank = (id: string): number => {
    if (ULTIMATE_MOVE_IDS.includes(id)) return 3;
    if (MOVES[id].class === 'screening') return 2;
    if (ANALYTIC_MOVE_IDS.includes(id)) return 1;
    return 0;
  };
  return [...getBattleMoves(scene.game.registry)].sort(
    (a, b) => rank(a) - rank(b) || MOVES[a].power - MOVES[b].power || MOVES[a].name.localeCompare(MOVES[b].name)
  );
}

// The Moves station: what the player is currently carrying, browsed one move
// at a time. Same list+detail layout (scenes/panels/listDetail.ts, STYLE.md's
// "List+detail panels") every guardian who deals in moves is read through, so
// a move looks the same in the Lab as it does in the shop it came from, and
// the same layout the Tutorial and Story stations beside it use.
//
// The pane opens with that move's own real battle-effect animation looping on
// a stage (renderMoveDetailHeader), at the tier the move is actually carried
// at (getMoveLevel), so a leveled move demonstrates the same cascade a real
// cast plays rather than a plain single strike. Kondo's screening cloud is the
// one that is not thrown at anybody: it is raised on the caster, so it shows
// over the player's own crystal instead (renderSelfBuffMoveDetailHeader), the
// same way Kondo's own panel shows it. A tunable move (Landau's Analytic pair,
// Skłodowska-Curie's Ultimates) is drawn in whichever quasiparticle it is
// currently tuned to and keeps its own lance/eruption/meteor/nova silhouette
// (ANALYTIC_SHAPES/ULTIMATE_SHAPES), the same override BattleScene itself
// passes.
//
// Under the animation: what the move carries and how hard it lands, then what
// that quasiparticle *is* in physics (data/moveLore.ts's MOVE_CLASS_LORE,
// keyed by the class the move currently carries). A screening cloud says what
// the cloud does for the player first, since that is the move's own effect
// text, and the physics of screening under it.
//
// A row click is a scoped update, not a panel rebuild (CODEMAP's "scoped
// update" convention): the title and list rows stay, `setSelectedId` restyles
// the highlighted row, and only `detailBlock`/`chromeBlock` re-render. A page
// flip still rebuilds, since that changes which rows the list shows.
export function showMovesPanel(scene: HubScene) {
  destroyPanel(scene);
  scene.dialogueActive = true;

  const panelWidth = LIST_DETAIL_PANEL_W;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  // Added first so everything below (divider, footer, panel background)
  // renders beneath every row/button added to `container` afterward.
  const chromeBlock = scene.add.container(0, 0);
  container.add(chromeBlock);

  let y = top;
  const title = scene.add
    .text(CANVAS_W / 2, y, 'Your Moves', { fontSize: fontPx(scene, 15), color: LAB_TITLE_COLOR, fontStyle: 'bold' })
    .setOrigin(0.5, 0);
  container.add(title);
  y += title.height + 6;

  const hint = scene.add
    .text(CANVAS_W / 2, y, 'Pick a move to watch it and read what it carries.', {
      fontSize: fontPx(scene, 11),
      color: REFERENCE_BLUE_GREY_HEX,
    })
    .setOrigin(0.5, 0);
  container.add(hint);
  y += hint.height + 10;

  const panelLeft = CANVAS_W / 2 - panelWidth / 2;
  const columns = listDetailColumns(panelLeft);
  const columnsTop = y;

  // Read once per panel build and closed over, so nothing can shift the rows
  // out from under a click.
  const ids = browsableBattleMoves(scene);
  let selected = ids.includes(scene.movesSelectedId ?? '') ? (scene.movesSelectedId as string) : ids[0] ?? null;

  const listResult = renderListColumn({
    scene,
    container,
    x: columns.leftX,
    y: columnsTop,
    width: columns.leftColW,
    items: ids,
    idFor: (id) => id,
    labelFor: (id) => moveDisplayName(scene.game.registry, id),
    selectedId: selected,
    page: scene.movesPage,
    emptyText: 'Your current form can carry no move at all.',
    onPageChange: (page) => {
      scene.movesPage = page;
      destroyPanel(scene);
      showMovesPanel(scene);
    },
    onSelect: (id) => {
      scene.movesSelectedId = id;
      selected = id;
      listResult.setSelectedId(id);
      renderDetail();
    },
  });
  scene.movesPage = listResult.page;

  const detailBlock = scene.add.container(0, 0);
  container.add(detailBlock);

  const renderDetail = () => {
    // The self-buff pane draws a real crystal, whose own sparkle tweens
    // outlive a plain removeAll (listDetail.ts's destroyPanel comment).
    killTweensDeep(scene, detailBlock);
    detailBlock.removeAll(true);
    chromeBlock.removeAll(true);

    let rightY = columnsTop;
    if (selected === null) {
      // Nothing to demonstrate, so stop the loop outright rather than leaving
      // the previous move's effect playing on a stage that is gone.
      stopMoveEffectPreview();
    } else {
      const move = MOVES[selected];
      const moveClass = getTunedMoveClass(scene.game.registry, selected);
      const level = getMoveLevel(scene.game.registry, selected);
      const displayName = moveDisplayName(scene.game.registry, selected);

      rightY =
        move.class === 'screening'
          ? renderSelfBuffMoveDetailHeader(
              scene,
              detailBlock,
              getPlayerMaterial(scene.game.registry),
              displayName,
              move.class,
              columns.rightColCenterX,
              rightY,
              columns.rightColW,
              level
            )
          : renderMoveDetailHeader(
              scene,
              detailBlock,
              displayName,
              moveClass,
              ANALYTIC_SHAPES[selected] ?? ULTIMATE_SHAPES[selected],
              columns.rightColCenterX,
              rightY,
              columns.rightColW,
              level
            );

      const factLine =
        move.class === 'screening'
          ? move.description ?? ''
          : `${quasiparticleLabel(moveClass)} carrier. Power ${Math.round(effectiveMovePower(scene.game.registry, selected))}.`;
      const factText = scene.add
        .text(columns.rightColCenterX, rightY, factLine, {
          fontSize: `${Math.round(11 * Math.min(fontScale(scene), 1.2))}px`,
          color: GOLD_ACCENT_HEX,
          align: 'center',
          wordWrap: { width: columns.rightColW },
        })
        .setOrigin(0.5, 0);
      detailBlock.add(factText);
      rightY += factText.height + 8;

      // Shrink-only fitting, same budget arithmetic the Tutorial station's own
      // pane uses: the only button in the panel is the left column's Close, so
      // nothing under this column has to be reserved for, and a long blurb at
      // the largest text-size preset has to be made to fit where it stands.
      const loreText = scene.add
        .text(columns.rightColCenterX, rightY, '', {
          fontSize: `${Math.round(12 * fontScale(scene))}px`,
          color: '#cfd8ff',
          align: 'center',
          wordWrap: { width: columns.rightColW },
          lineSpacing: 4,
        })
        .setOrigin(0.5, 0);
      detailBlock.add(loreText);
      fitProseToBudget(loreText, [MOVE_CLASS_LORE[moveClass]], CANVAS_H - 16 - 14 - 14 - rightY);
      rightY += loreText.height + 14;
    }

    const leftBottom = renderListColumnFooter(scene, chromeBlock, columns, listResult.bottom + 10, 'Close', () => scene.closeDialogue());
    const columnsBottom = Math.max(leftBottom, rightY);
    insertColumnDivider(scene, chromeBlock, columns.dividerX, columnsTop, columnsBottom);

    const panelHeight = columnsBottom + 14 - top;
    const panel = scene.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.95)
      .setStrokeStyle(2, REFERENCE_BLUE_GREY);
    chromeBlock.addAt(panel, 0);
  };
  renderDetail();
}

export function showStatsPanel(scene: HubScene) {
  const stats = getPlayerStats(scene.game.registry);
  const qumatessence = (scene.game.registry.get('qumatessence') as number) || 0;
  const playerMaterial = getPlayerMaterial(scene.game.registry);
  const body =
    `${STAT_LABELS.quantumness}: ${stats.quantumness} (raises your crit chance)\n` +
    `${STAT_LABELS.velocity}: ${stats.velocity} (higher goes first each round)\n` +
    `${STAT_LABELS.correlation}: ${stats.correlation} (higher takes less damage)\n\n` +
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

// The Lab's preferences, laid out as a table: one row per setting, its name
// (and when a change to it lands) on the left, every value it can take on the
// right, with the current one highlighted gold-on-purple the same way a
// selected row reads in every list+detail panel (panels/listDetail.ts). A
// value is picked by clicking it directly, and the panel rebuilds in place
// around the new selection (the same click-to-rebuild pattern Noether's shop
// tabs use) -- so a setting's whole range is readable at a glance rather than
// something the player has to click through one step at a time.
//
// The table shows one category at a time (data/settings.ts's
// SETTINGS_CATEGORIES), picked from a strip of category plates between the
// title and the first row. The whole roster does not fit one screenful at the
// largest text-size preset -- a value plate is ~43px tall there, so no row is
// shorter than ~55px, and the canvas has room for about five once the title,
// the Close button and the margins are paid for. Splitting by category buys
// that room without giving up the direct-click table: a list+detail panel
// would scale further but would hide every unselected setting's current value
// behind a row, which is the one thing this panel exists to show.
//
// The eight settings and what reads them -- Gameplay: difficulty tier
// (DIFFICULTY_TIER_PRESETS, data/balance.ts's DIFFICULTY_MULTIPLIERS applied
// to enemyStatsForWorld), wild-encounter density (DENSITY_PRESETS, read by
// OverworldScene.generateMap via encounterChance()), world size
// (WORLD_SIZE_PRESETS). Story: story screens and tutorial tips (ON_OFF_PRESETS,
// read by OverworldScene's lore/taunt/beat screens and showTutorialTip, and by
// HubScene.maybeShowLabTip). Presentation: text size (FONT_SCALE_PRESETS, read
// live by every fontPx() call), music style (MUSIC_STYLE_PRESETS, which of
// audio/music.ts's SCORES/SCORES_MODERN tables MusicEngine draws from), touch
// controls (TOUCH_CONTROLS_PRESETS, the overworld's on-screen walking arrows).
//
// Difficulty is the one meant to be revisited mid-playthrough rather than set
// once -- Battle/OverworldScene both read it live, so a change here lands on
// the player's very next fight, not just future maps/panels.
//
// The category strip, the name column and the "when" line under it are capped
// at the 1.5x text preset (the same cap tutorial popups use, STYLE.md), while
// the values themselves -- the part that is clicked -- keep the player's full
// chosen size.
interface SettingsOption {
  label: string;
  selected: boolean;
  onPick: () => void;
}

interface SettingsRow {
  category: SettingsCategoryId;
  label: string;
  when: string;
  options: SettingsOption[];
}

const SETTINGS_NAME_COL_W = 220;
const SETTINGS_COL_GAP = 16;
const SETTINGS_OPTION_GAP = 6;
const SETTINGS_TAB_GAP = 8;

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
  const registry = scene.game.registry;
  const contentLeft = columns.contentCenterX - columns.contentWrapW / 2;
  const contentRight = columns.contentCenterX + columns.contentWrapW / 2;
  const optionsLeft = contentLeft + SETTINGS_NAME_COL_W + SETTINGS_COL_GAP;

  const labelScale = Math.min(fontScale(scene), 1.5);
  const namePx = `${Math.round(13 * labelScale)}px`;
  const whenPx = `${Math.round(11 * labelScale)}px`;

  // The category strip, centered above the table and separated from it by the
  // same hairline the rows use between themselves. Bold, centered and capped
  // where the value plates below are left-aligned in their own column and
  // uncapped, so the two never read as one longer row of values.
  const tabs = SETTINGS_CATEGORIES.map((category) =>
    scene.add
      .text(0, y, category.label, {
        fontSize: `${Math.round(14 * labelScale)}px`,
        color: category.id === scene.settingsCategory ? GOLD_ACCENT_HEX : REFERENCE_BLUE_GREY_HEX,
        backgroundColor: category.id === scene.settingsCategory ? '#3a2a5c' : '#1c1c30',
        fontStyle: 'bold',
        padding: { x: 14, y: 6 },
      })
      .setOrigin(0, 0)
  );
  const tabsWidth = tabs.reduce((sum, tab) => sum + tab.width, 0) + SETTINGS_TAB_GAP * (tabs.length - 1);
  let tabX = CANVAS_W / 2 - tabsWidth / 2;
  tabs.forEach((tab, index) => {
    tab.setPosition(tabX, y);
    tab.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      scene.settingsCategory = SETTINGS_CATEGORIES[index].id;
      showSettingsPanel(scene);
    });
    container.add(tab);
    tabX += tab.width + SETTINGS_TAB_GAP;
  });
  y += (tabs[0]?.height ?? 0) + 14;
  const stripRule = scene.add.graphics();
  stripRule.lineStyle(1, 0x4a4a70, 0.85);
  stripRule.lineBetween(contentLeft, y - 6, contentRight, y - 6);
  container.add(stripRule);

  // Every row is written the same way: pick a value, write it to the
  // registry, save, and rebuild the panel so the highlight follows.
  const choose = (key: string, value: unknown, after?: () => void) => () => {
    registry.set(key, value);
    persistFromRegistry(registry);
    after?.();
    showSettingsPanel(scene);
  };

  const density = DENSITY_PRESETS[encounterDensityIndex(registry)].value;
  const font = FONT_SCALE_PRESETS[fontScaleIndex(registry)].value;
  const style = MUSIC_STYLE_PRESETS[musicStyleIndex(registry)].value;
  const tier = DIFFICULTY_TIER_PRESETS[difficultyTierIndex(registry)].value;
  const size = WORLD_SIZE_PRESETS[worldSizeIndex(registry)].value;
  const touch = TOUCH_CONTROLS_PRESETS[touchControlsIndex(registry)].value;

  const tips = tutorialTipsEnabled(registry);
  const storyScreens = storyScreensEnabled(registry);

  const allRows: SettingsRow[] = [
    {
      category: 'gameplay',
      label: 'Difficulty',
      when: 'On your next battle.',
      options: DIFFICULTY_TIER_PRESETS.map((p) => ({
        label: p.label,
        selected: p.value === tier,
        onPick: choose('difficultyTier', p.value),
      })),
    },
    {
      category: 'gameplay',
      label: 'Enemy Density',
      when: 'On the next map.',
      options: DENSITY_PRESETS.map((p) => ({
        label: p.label,
        selected: p.value === density,
        onPick: choose('encounterDensity', p.value),
      })),
    },
    {
      category: 'presentation',
      label: 'Text Size',
      when: 'Immediately.',
      options: FONT_SCALE_PRESETS.map((p) => ({
        label: p.label,
        selected: p.value === font,
        onPick: choose('fontScale', p.value),
      })),
    },
    {
      category: 'presentation',
      label: 'Music Style',
      when: 'Immediately.',
      options: MUSIC_STYLE_PRESETS.map((p) => ({
        label: p.label,
        selected: p.value === style,
        onPick: choose('musicStyle', p.value, () => music.setStyle(p.value)),
      })),
    },
    {
      category: 'gameplay',
      label: 'World Size',
      when: 'On the next world.',
      options: WORLD_SIZE_PRESETS.map((p) => ({
        label: p.label,
        selected: p.value === size,
        onPick: choose('worldSize', p.value),
      })),
    },
    {
      category: 'presentation',
      label: 'Touch Controls',
      // Auto says what it resolved to on this machine, so the row is never
      // just a word whose effect the player has to guess.
      when: `Walking arrows on screen. Auto is ${isTouchDevice() ? 'on' : 'off'} here. On the next world.`,
      options: TOUCH_CONTROLS_PRESETS.map((p) => ({
        label: p.label,
        selected: p.value === touch,
        onPick: choose('touchControls', p.value),
      })),
    },
    // Both Story rows suppress a screen, never its text: an Off trigger still
    // marks itself seen on the way past, so the Lab's Story and Tutorial
    // stations fill in on the same schedule and keep what was skipped.
    {
      category: 'story',
      label: 'Story Screens',
      when: 'The lore, taunts and beats between worlds. Immediately.',
      options: ON_OFF_PRESETS.map((p) => ({
        label: p.label,
        selected: p.value === storyScreens,
        onPick: choose('storyScreensEnabled', p.value),
      })),
    },
    {
      category: 'story',
      label: 'Tutorial Tips',
      when: 'The popups explaining a feature. Immediately.',
      options: ON_OFF_PRESETS.map((p) => ({
        label: p.label,
        selected: p.value === tips,
        onPick: choose('tutorialTipsEnabled', p.value),
      })),
    },
  ];

  // One category's rows at a time; the strip above is how the player reaches
  // the rest. Declaration order within a category is the order it reads in.
  const rows = allRows.filter((row) => row.category === scene.settingsCategory);

  rows.forEach((row, index) => {
    if (index > 0) {
      const rule = scene.add.graphics();
      rule.lineStyle(1, 0x4a4a70, 0.85);
      rule.lineBetween(contentLeft, y - 6, contentRight, y - 6);
      container.add(rule);
    }

    const name = scene.add
      .text(contentLeft, y, row.label, { fontSize: namePx, color: '#ffffff', wordWrap: { width: SETTINGS_NAME_COL_W } })
      .setOrigin(0, 0);
    container.add(name);
    const when = scene.add
      .text(contentLeft, y + name.height + 2, row.when, {
        fontSize: whenPx,
        color: REFERENCE_BLUE_GREY_HEX,
        wordWrap: { width: SETTINGS_NAME_COL_W },
        lineSpacing: 2,
      })
      .setOrigin(0, 0);
    container.add(when);

    // Values run along the row and wrap to a second line if this preset's
    // text is wide enough to need it, so no value is ever pushed off the
    // panel's right edge.
    let cx = optionsLeft;
    let cy = y;
    let lineHeight = 0;
    row.options.forEach((option) => {
      const chip = scene.add
        .text(cx, cy, option.label, {
          fontSize: fontPx(scene, 13),
          color: option.selected ? GOLD_ACCENT_HEX : REFERENCE_BLUE_GREY_HEX,
          backgroundColor: option.selected ? '#3a2a5c' : '#1c1c30',
          padding: { x: 10, y: 5 },
        })
        .setOrigin(0, 0);
      if (cx > optionsLeft && cx + chip.width > contentRight) {
        cx = optionsLeft;
        cy += lineHeight + SETTINGS_OPTION_GAP;
        lineHeight = 0;
        chip.setPosition(cx, cy);
      }
      chip.setInteractive({ useHandCursor: true }).on('pointerdown', option.onPick);
      container.add(chip);
      cx += chip.width + SETTINGS_OPTION_GAP;
      lineHeight = Math.max(lineHeight, chip.height);
    });

    y = Math.max(when.y + when.height, cy + lineHeight) + 12;
  });

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

function touchControlsIndex(registry: Phaser.Data.DataManager): number {
  const value = (registry.get('touchControls') as TouchControlsMode) ?? DEFAULT_TOUCH_CONTROLS;
  const idx = TOUCH_CONTROLS_PRESETS.findIndex((p) => p.value === value);
  if (idx !== -1) return idx;
  return TOUCH_CONTROLS_PRESETS.findIndex((p) => p.value === DEFAULT_TOUCH_CONTROLS);
}

function worldSizeIndex(registry: Phaser.Data.DataManager): number {
  const value = (registry.get('worldSize') as WorldSizeId) ?? DEFAULT_WORLD_SIZE;
  const idx = WORLD_SIZE_PRESETS.findIndex((p) => p.value === value);
  if (idx !== -1) return idx;
  return WORLD_SIZE_PRESETS.findIndex((p) => p.value === DEFAULT_WORLD_SIZE);
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
