import Phaser from 'phaser';
import type { HubScene } from '../HubScene';
import { OverworldScene } from '../OverworldScene';
import { CANVAS_W, CANVAS_H } from '../../art/perspective';
import { fontPx, fontScale } from '../../ui/text';
import { TUTORIAL_PAGES } from '../../data/tutorial';
import { PASSIVES, PASSIVE_OWNERS, PASSIVE_OWNER_LABELS } from '../../data/passives';
import type { PassiveOwner } from '../../data/passives';
import {
  DENSITY_PRESETS,
  DEFAULT_ENCOUNTER_DENSITY,
  FONT_SCALE_PRESETS,
  DEFAULT_FONT_SCALE,
  MUSIC_STYLE_PRESETS,
  DEFAULT_MUSIC_STYLE,
} from '../../data/settings';
import { persistFromRegistry } from '../../data/save';
import { music } from '../../audio/music';
import { getBattleMoves, effectiveMovePower, moveDisplayName, getPlayerStats, getPlayerMaterial } from '../../data/materials';
import { makeMovesMotif, makeStatsMotif, makeAbilitiesMotif, makeGuardiansMotif, makeTutorialMotif, makeSettingsMotif } from '../../art/labMotifs';

// Every panel below (and HubScene's own Save Point) shares this gold for its
// fixed "panel name" heading -- Qumatex/Save Point/Moves/Stats/Abilities
// already used it; Guardians/Settings are brought in line with it here too.
// Tutorial's own page heading is content-specific (a different topic's title
// every time, not a fixed panel name) and keeps its own cyan stroke instead.
export const LAB_TITLE_COLOR = '#ffe066';

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

// The six stations the Lab (HubScene, World 0) offers alongside its three
// physical stations (Qumatex/Save/Door) -- Moves, Stats, Abilities,
// Guardians, Tutorial, Settings. Each function here is what a station's
// `onClick` calls directly; every one is a pure function of registry/save
// state (player stats/moves/passives/settings, which guardians have been
// met), not of anything tied to being mid-world, so none of it needs to
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
    `Quantumness: ${stats.quantumness} -- raises your crit chance\n` +
    `Velocity: ${stats.velocity} -- higher goes first each round\n` +
    `Correlation: ${stats.correlation} -- higher takes less damage\n\n` +
    `Qumatessence: ${qumatessence}\nCurrent form: ${playerMaterial.name}\n\n` +
    "Raise any of these with qumatessence at Noether's shop.";
  showInfoPanel(scene, 'Your Stats', body);
}

// Shared body for View Moves/View Stats -- a title, a wrapped/shrink-to-fit
// text block, and a Close button, same shrink-to-fit pattern the Qumatex's
// blurb pane uses.
function showInfoPanel(scene: HubScene, title: string, body: string) {
  scene.dialogueContainer?.destroy(true);

  const panelWidth = 440;
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
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.95)
    .setStrokeStyle(2, 0x8fa0c9);
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

  const panelWidth = 440;
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
          color: '#8fa0c9',
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
        color: '#8fa0c9',
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
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.95)
    .setStrokeStyle(2, 0x8fa0c9);
  container.addAt(panel, 0);
}

// Every guardian the player has met so far (registry `metGuardians`, grown
// by OverworldScene.openGuardian as middle tiles are reached) -- in
// Superposition Mode every guardian lists immediately regardless of
// `metGuardians`, matching that mode's "access to every guardian from the
// beginning." A guardian's own panel (shop/teleport hub/transmutation/lore)
// only makes sense inside their own world -- Noether's shop needs the
// overworld's qumatessence HUD, Bloch's teleport hub needs a world to
// teleport *from*, and so on -- so a row here warps into that guardian's
// world (a fresh map, same as Bloch's own teleport) and reopens their panel
// once it's built (OverworldScene.create()'s `openGuardian` init flag)
// rather than trying to render their bespoke shop UI inside the Lab itself.
export function showGuardiansPanel(scene: HubScene) {
  scene.dialogueContainer?.destroy(true);

  const panelWidth = 520;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;

  const title = scene.add
    .text(CANVAS_W / 2, y, 'Guardians', { fontSize: fontPx(scene, 15), color: LAB_TITLE_COLOR, fontStyle: 'bold' })
    .setOrigin(0.5, 0);
  container.add(title);
  y += title.height + 14;

  const columns = labPanelColumns(panelWidth);

  // Capped rather than a shrink-to-fit loop -- same "row list that can grow
  // long (up to every guardian in Superposition Mode) doesn't get to eat the
  // whole Large text-size preset" tradeoff renderPassiveList/showAbilitiesPanel
  // already make.
  const rowScale = Math.min(fontScale(scene), 1.3);
  const rowPx = `${Math.round(13 * rowScale)}px`;

  const met = (scene.game.registry.get('metGuardians') as string[]) ?? [];
  const superposition = !!scene.game.registry.get('superpositionMode');
  const guardians = OverworldScene.guardianRoster().filter((g) => superposition || met.includes(g.id));

  if (guardians.length === 0) {
    const text = scene.add
      .text(columns.contentCenterX, y, "You haven't met any guardians yet.", {
        fontSize: rowPx,
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: columns.contentWrapW },
      })
      .setOrigin(0.5, 0);
    container.add(text);
    y += text.height + 14;
  } else {
    guardians.forEach((guardian) => {
      const btn = scene.addDialogueButtonAt(
        container,
        columns.contentCenterX,
        y,
        guardian.name,
        () => {
          scene.closeDialogue();
          scene.scene.start('Overworld', { world: guardian.world, regenerate: true, openGuardian: true });
        },
        columns.contentWrapW,
        rowPx
      );
      y += btn.height + 6;
    });
  }

  y += 12;

  const closeBtn = scene.addDialogueButtonAt(container, CANVAS_W / 2, y, 'Close', () => scene.closeDialogue(), 440);
  y += closeBtn.height + 12;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.95)
    .setStrokeStyle(2, 0xb98fea);
  container.addAt(panel, 0);
}

// A menu of every topic (data/tutorial.ts's TUTORIAL_PAGES, the same seven
// tips the contextual popups fire once each elsewhere) rather than one
// linear pager -- lets the player see what's covered before opening
// anything, and jump straight to one topic instead of stepping through the
// rest to reach it. Picking a row opens that topic's own single page
// (showTutorialTopic), which has its own "<- Topics" button back to this
// menu instead of a Back/Next pager between topics.
export function showTutorialTopics(scene: HubScene) {
  scene.dialogueContainer?.destroy(true);

  const panelWidth = 460;
  const top = 20;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;
  const title = scene.add
    .text(CANVAS_W / 2, y, 'Tutorial', { fontSize: fontPx(scene, 15), color: '#5ad9ff', fontStyle: 'bold' })
    .setOrigin(0.5, 0);
  container.add(title);
  y += title.height + 6;

  const hint = scene.add
    .text(CANVAS_W / 2, y, 'Pick a topic to revisit.', { fontSize: fontPx(scene, 11), color: '#8fa0c9' })
    .setOrigin(0.5, 0);
  container.add(hint);
  y += hint.height + 12;

  const columns = labPanelColumns(panelWidth);
  TUTORIAL_PAGES.forEach((page, index) => {
    const btn = scene.addDialogueButtonAt(
      container,
      columns.contentCenterX,
      y,
      page.title,
      () => showTutorialTopic(scene, index),
      columns.contentWrapW
    );
    y += btn.height + 6;
  });
  y += 6;

  const closeBtn = scene.addDialogueButtonAt(container, CANVAS_W / 2, y, 'Close', () => scene.closeDialogue(), 260);
  y += closeBtn.height + 12;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.95)
    .setStrokeStyle(2, 0x5ad9ff);
  container.addAt(panel, 0);
}

// One topic's own page, opened from showTutorialTopics above -- title, body
// (same floor-9px shrink-to-fit loop every other Lab panel's body text
// uses), and a footer offering a way back to the topic menu alongside
// Close.
function showTutorialTopic(scene: HubScene, index: number) {
  scene.dialogueContainer?.destroy(true);

  const panelWidth = 460;
  const top = 24;
  const container = scene.add.container(0, 0).setDepth(100);
  scene.dialogueContainer = container;

  let y = top;
  const page = TUTORIAL_PAGES[index];
  const columns = labPanelColumns(panelWidth);

  const title = scene.add
    .text(columns.contentCenterX, y, page.title, {
      fontSize: fontPx(scene, 16),
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: columns.contentWrapW },
    })
    .setOrigin(0.5, 0);
  container.add(title);
  y += title.height + 12;

  const scale = fontScale(scene);
  let bodyBase = 12;
  const body = scene.add
    .text(columns.contentCenterX, y, page.body, {
      fontSize: `${Math.round(bodyBase * scale)}px`,
      color: '#cfd8ff',
      align: 'center',
      wordWrap: { width: columns.contentWrapW },
      lineSpacing: 5,
    })
    .setOrigin(0.5, 0);
  container.add(body);
  const reservedBelow = 14 + 46 + 14; // gap + footer-row estimate + bottom margin
  while (y + body.height + reservedBelow > CANVAS_H - 10 && bodyBase > 9) {
    bodyBase -= 1;
    body.setFontSize(`${Math.round(bodyBase * scale)}px`);
  }
  y += body.height + 14;

  const footerY = y;
  const backBtn = scene.addDialogueButtonAt(container, CANVAS_W / 2 - 90, footerY, '<- Topics', () => showTutorialTopics(scene), 150);
  const closeBtn = scene.addDialogueButtonAt(container, CANVAS_W / 2 + 90, footerY, 'Close', () => scene.closeDialogue(), 150);
  y = footerY + Math.max(backBtn.height, closeBtn.height) + 12;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.95)
    .setStrokeStyle(2, 0x5ad9ff);
  container.addAt(panel, 0);
}

// Wild-encounter density (data/settings.ts's DENSITY_PRESETS, read by
// OverworldScene.generateMap via encounterChance()), text size
// (FONT_SCALE_PRESETS, read live by every fontPx() call), and music style
// (MUSIC_STYLE_PRESETS, which of audio/music.ts's SCORES/SCORES_MODERN
// tables MusicEngine draws from). Each is a button that cycles through its
// presets in place (same rebuild-the-panel pattern as Noether's shop),
// rather than a slider, since all three have only a handful of discrete
// steps.
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
      color: '#8fa0c9',
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
      color: '#8fa0c9',
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
      color: '#8fa0c9',
      align: 'center',
      wordWrap: { width: contentWidth },
      lineSpacing: 4,
    })
    .setOrigin(0.5, 0);
  container.add(styleHint);
  y += styleHint.height + 14;

  const closeBtn = scene.addDialogueButtonAt(container, CANVAS_W / 2, y, 'Close', () => scene.closeDialogue(), 260);
  y += closeBtn.height + 8;

  const panelHeight = y - top;
  const panel = scene.add
    .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.95)
    .setStrokeStyle(2, 0x8fa0c9);
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

function isSuperpositionMode(scene: HubScene): boolean {
  return !!scene.game.registry.get('superpositionMode');
}

// Abilities/Guardians start out absent from the Lab room entirely on a
// fresh save (HubScene.create() filters LAB_STATIONS by `visible` below) --
// there's nothing to check/revisit until the player has actually learned a
// passive or met a guardian. Superposition Mode (a testing/exploration aid,
// DESIGN.md §5) always treats both as visible: it grants every passive
// unconditionally the first time an Overworld scene runs
// (OverworldScene.applySuperpositionLeveling), which wouldn't cover the
// very first Lab visit of a fresh Superposition save, and showGuardiansPanel
// already lists every guardian regardless of `metGuardians` in this mode, so
// hiding the station itself until `metGuardians` grows would disagree with
// what the station shows once opened.
function hasLearnedAnyAbility(scene: HubScene): boolean {
  return isSuperpositionMode(scene) || ((scene.game.registry.get('passivesUnlocked') as string[]) ?? []).length > 0;
}

function hasMetAnyGuardian(scene: HubScene): boolean {
  return isSuperpositionMode(scene) || ((scene.game.registry.get('metGuardians') as string[]) ?? []).length > 0;
}

export interface LabStation {
  label: string;
  motif: (scene: Phaser.Scene, size: number) => Phaser.GameObjects.Container;
  onClick: (scene: HubScene) => void;
  visible: (scene: HubScene) => boolean;
}

// The Lab's six reference/settings stations, each paired with its own
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
  { label: 'Guardians', motif: makeGuardiansMotif, onClick: showGuardiansPanel, visible: hasMetAnyGuardian },
  { label: 'Tutorial', motif: makeTutorialMotif, onClick: showTutorialTopics, visible: () => true },
  { label: 'Settings', motif: makeSettingsMotif, onClick: showSettingsPanel, visible: () => true },
];
