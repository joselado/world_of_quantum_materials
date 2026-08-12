import Phaser from 'phaser';
import { makeCrystal } from '../art/crystals';
import { CANVAS_W, CANVAS_H } from '../art/perspective';
import { getPlayerMaterial, allCrystals, TYPE_LOOK, materialDisplayName } from '../data/materials';
import { materialBlurb } from '../data/materialdex';
import { persistFromRegistry } from '../data/save';
import type { DiscoveredMaterial } from '../data/save';
import type { Material, MaterialType } from '../data/types';
import { TUTORIAL_TIPS, hasSeenTip, markTipSeen } from '../data/tutorial';
import { music } from '../audio/music';
import { fontPx, fontScale } from '../ui/text';
import { BUILT_WORLDS } from './OverworldScene';
import { labPanelColumns, LAB_TITLE_COLOR, LAB_STATIONS } from './panels/hubStations';
import { makeSavePointMotif } from '../art/labMotifs';

// World 0, "The Lab" (DESIGN.md's world table) -- boot destination from
// TitleScene and the return point from Overworld (press H or Enter). Unlike
// the numbered worlds it isn't a walkable procedural map: it's a single
// static room with up to nine stations -- three that always exist (Qumatex,
// a save point, the door onward) plus six reference/settings stations
// (Moves, Stats, Abilities, Guardians, Tutorial, Settings, built in
// scenes/panels/hubStations.ts's `LAB_STATIONS`) -- since none of the hub's
// jobs need overworld movement or wild encounters of their own, and none of
// those six stations' own content is tied to being mid-world. Abilities and
// Guardians only actually appear once the player has learned a first
// passive or met a first guardian (`LAB_STATIONS`' own `visible` checks) --
// a fresh save has nothing to check or revisit there yet.

// Every real compound in the game (`allCrystals()`), not just discovered
// ones -- an undiscovered entry still occupies a slot in the index, masked
// down to "???" (renderMaterialdexList), so Qumatex reads as a checklist of
// the whole game rather than only growing entries a player has already
// found.
interface MaterialdexEntry {
  material: Material;
  discovered: boolean;
}

// Fixed-px art for the small motif every station plants beside its own
// button in the room (see art/labMotifs.ts) -- small enough to sit inline
// with a compact text button rather than the much larger scale a motif
// drawn inside a full panel would use. Never scaled by the Text Size
// setting, same "art, not text" reasoning as every other motif builder.
const STATION_MOTIF_SIZE = 22;
const STATION_MOTIF_GAP = 8;

export class HubScene extends Phaser.Scene {
  // Public, not private -- scenes/panels/hubStations.ts's Moves/Stats/
  // Abilities/Guardians/Tutorial/Settings stations live outside this class
  // and need to read/replace the currently-open panel, same tradeoff
  // OverworldScene's own dialogue plumbing makes for its guardian panel
  // files (see CODEMAP.md's "Guardian panels").
  dialogueContainer?: Phaser.GameObjects.Container;
  private materialdexTypeFilter: MaterialType | 'all' = 'all';
  // Which page of the left-column name list is showing (renderMaterialdexPanel),
  // reset to 0 whenever the station is (re)opened or the type filter changes.
  private materialdexListPage = 0;
  // The currently-selected compound's own name (not a list/page index) --
  // stable across a type-filter change or list-page flip since it identifies
  // one compound directly rather than a position in whichever subset is
  // currently visible; the right-hand detail pane always renders whichever
  // entry this points at, even if that entry isn't on the list's current
  // page or has been filtered out of it.
  private materialdexSelectedName: string | null = null;

  constructor() {
    super('Hub');
  }

  create() {
    music.play('overworld:1');
    this.dialogueContainer = undefined;
    this.drawRoom();

    this.add
      .text(CANVAS_W / 2, 30, 'World 0 -- The Lab', {
        fontSize: fontPx(this, 16),
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 0);

    this.add
      .text(
        CANVAS_W / 2,
        62,
        '"A Decoherence is spreading through the material worlds. Master each phase of matter to stabilize it." -- a voice, deep in the Lab',
        { fontSize: fontPx(this, 12), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: 480 } }
      )
      .setOrigin(0.5, 0);

    const playerMaterial = getPlayerMaterial(this.game.registry);
    const player = makeCrystal(this, 46, playerMaterial.color, playerMaterial.variant, {
      seed: playerMaterial.name,
      hybrid: playerMaterial.hybridParents,
    });
    player.setPosition(CANVAS_W / 2, 230);
    this.tweens.add({ targets: player, y: 220, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Margin is a fraction of CANVAS_W, not a flat pixel count, so the three
    // station columns stay proportionally inset from the walls at any canvas
    // width. Rounded so a station's motif+label pair lands on whole pixels.
    const stationMargin = Math.round(CANVAS_W * 0.18);
    const stationX = [stationMargin, CANVAS_W / 2, CANVAS_W - stationMargin];

    // Row 1: the three stations that exist regardless of progress --
    // cataloguing, saving, leaving. Plain text buttons like every other
    // station's; Save Point carries its own gold spire/rune motif
    // (`makeSavePointMotif`) beside its label, while Qumatex and the door
    // have no `art/labMotifs.ts` builder of their own (Qumatex's detail pane
    // already renders the selected compound's own crystal; the door just
    // needs to read as an exit).
    const row1Y = 300;
    const row1Buttons = [
      this.addStationRow(stationX[0], row1Y, 'Qumatex', () => this.showMaterialdex()),
      this.addStationRow(stationX[1], row1Y, 'Save Point', () => this.showSavePoint(), makeSavePointMotif),
      this.addStationRow(stationX[2], row1Y, this.doorLabel(), () => this.enterWorld()),
    ];
    const row1Height = Math.max(...row1Buttons.map((b) => b.height));

    // Rows 2+: the reference/settings stations (scenes/panels/hubStations.ts's
    // LAB_STATIONS), filtered down to whichever the player has actually
    // unlocked -- Abilities needs a first passive learned, Guardians a first
    // guardian met (LAB_STATIONS' own `visible` checks) -- and packed into
    // rows of three with no gaps, rather than reserving a fixed grid slot
    // for a station that isn't visible yet. Always at least Moves/Stats/
    // Tutorial/Settings (4), so this is always exactly two rows regardless
    // of how many of the two gated stations have unlocked.
    const visibleStations = LAB_STATIONS.filter((station) => station.visible(this));
    let y = row1Y + row1Height + 8;
    for (let i = 0; i < visibleStations.length; i += 3) {
      const rowStations = visibleStations.slice(i, i + 3);
      let rowHeight = 0;
      rowStations.forEach((station, col) => {
        const btn = this.addStationRow(stationX[col], y, station.label, () => station.onClick(this), station.motif);
        rowHeight = Math.max(rowHeight, btn.height);
      });
      y += rowHeight + 8;
    }

    // Reverse direction of OverworldScene's own keydown-ENTER (which sends
    // the player *to* the Hub) -- pressing Enter while standing in the Lab
    // sends them back *out*, to whichever world the door itself would
    // resume into. Same one-panel-at-a-time guard the door station's own
    // click handler uses, and the same canResumeWorld() eligibility the
    // door's label is built from, so a fresh save with nothing in progress
    // yet (no built `mapState` to resume) leaves Enter a no-op here rather
    // than launching a world the player never actually chose to start.
    this.input.keyboard!.on('keydown-ENTER', () => {
      if (this.dialogueContainer) return;
      if (!this.canResumeWorld(this.highestUnlockedWorld())) return;
      this.enterWorld();
    });

    this.maybeShowLabTip();
  }

  // Shared row builder for every Lab station -- a button in the same
  // gold-on-dark-blue look every dialogue button in the game uses
  // (`addButton`, gated by the shared "one panel at a time"
  // `dialogueContainer` check), with an optional small fixed-px motif
  // (`art/labMotifs.ts`) planted just to its left so the pair reads as
  // centered at `x` -- the motif is a decorative echo of the station's own
  // panel, not a second interactive target, so only the button text itself
  // is interactive.
  private addStationRow(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    makeMotif?: (scene: Phaser.Scene, size: number) => Phaser.GameObjects.Container
  ): Phaser.GameObjects.Text {
    const btn = this.addButton(x, y, label, () => {
      if (this.dialogueContainer) return;
      onClick();
    });
    if (makeMotif) {
      const pairWidth = STATION_MOTIF_SIZE + STATION_MOTIF_GAP + btn.width;
      const pairLeft = x - pairWidth / 2;
      btn.setX(pairLeft + STATION_MOTIF_SIZE + STATION_MOTIF_GAP + btn.width / 2);
      const motif = makeMotif(this, STATION_MOTIF_SIZE);
      motif.setPosition(pairLeft + STATION_MOTIF_SIZE / 2, y + btn.height / 2);
    }
    return btn;
  }

  // First contextual tutorial tip (data/tutorial.ts): the Lab is always the
  // very first scene a new save ever sees (TitleScene hands off here before
  // the player has left for World 1), so it's the natural place for a
  // one-time "welcome, here's this room" popup -- the rest of the tutorial
  // tips fire contextually in OverworldScene as each later feature comes up.
  private maybeShowLabTip() {
    if (this.dialogueContainer) return;
    if (hasSeenTip(this.game.registry, 'lab')) return;
    markTipSeen(this.game.registry, 'lab');
    persistFromRegistry(this.game.registry);
    const tip = TUTORIAL_TIPS.lab;
    this.showPanel(tip.title, tip.body);
  }

  // Builds the Lab as an actual room -- ceiling, back wall with built-in
  // furniture/machinery, and a tiled floor -- rather than one undifferentiated
  // gradient from top to bottom. Static (drawn once here, never redrawn in an
  // `update()` -- this scene has none), so the extra shape count is free.
  private drawRoom() {
    const floorTop = 340; // matches the station row (y=300) and its labels underneath
    const g = this.add.graphics();
    const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);

    // Ceiling band, visually distinct from the wall below it (a seam line at
    // the boundary) so the room reads as having actual architecture instead
    // of one flat gradient -- a few recessed light panels along it read as
    // overhead lab lighting.
    const ceilingH = 46;
    g.fillStyle(0x0d0d1f, 1);
    g.fillRect(0, 0, CANVAS_W, ceilingH);
    // Evenly spaced across the ceiling as a fraction of CANVAS_W, so the
    // light panels stay symmetric at any canvas width.
    for (const cx of [CANVAS_W * 0.25, CANVAS_W * 0.5, CANVAS_W * 0.75]) {
      g.fillStyle(0x2a3a5c, 0.6);
      g.fillRect(cx - 40, 14, 80, 9);
      glow.fillStyle(0xcfe8ff, 0.35);
      glow.fillRect(cx - 34, 16, 68, 4);
    }
    g.lineStyle(2, 0x3a3a5c, 0.7);
    g.lineBetween(0, ceilingH, CANVAS_W, ceilingH);

    // Back wall -- the same dark blue-purple gradient the room always had,
    // now confined between the ceiling seam and the floor instead of running
    // the full canvas height.
    g.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x242440, 0x242440, 1);
    g.fillRect(0, ceilingH, CANVAS_W, floorTop - ceilingH);

    // Conduit pipes running the width of the wall, with rivets at regular
    // intervals -- machinery implied without drawing an actual machine.
    g.lineStyle(3, 0x2a2a48, 0.6);
    g.lineBetween(0, 92, CANVAS_W, 92);
    g.lineBetween(0, 100, CANVAS_W, 100);
    g.fillStyle(0x1e1e36, 0.85);
    for (let x = 18; x < CANVAS_W; x += 46) {
      g.fillCircle(x, 92, 2.4);
      g.fillCircle(x, 100, 2.4);
    }

    // Two wall-mounted instrument panels, dark screens with a faint glow and
    // a couple of scanlines -- readable as lab monitors without drawing an
    // actual UI on them. Symmetric about the room's center.
    for (const px of [CANVAS_W / 2 - 145, CANVAS_W / 2 + 145]) {
      g.fillStyle(0x1c1c34, 1);
      g.fillRect(px - 45, 176, 90, 56);
      g.lineStyle(2, 0x3a3a5c, 0.8);
      g.strokeRect(px - 45, 176, 90, 56);
      glow.fillStyle(0x5ad9c9, 0.14);
      glow.fillRect(px - 39, 182, 78, 44);
      g.lineStyle(1, 0x3a4a6c, 0.5);
      g.lineBetween(px - 39, 196, px + 39, 196);
      g.lineBetween(px - 39, 212, px + 39, 212);
    }

    // Workbench/counter along the base of the wall, with cabinet-door seams
    // and a lit countertop edge -- the stations (added after this, in
    // `create()`) stand in front of it rather than floating in empty space.
    const counterY = 272;
    g.fillStyle(0x14142a, 1);
    g.fillRect(0, counterY, CANVAS_W, floorTop - counterY);
    g.lineStyle(2, 0x4a4a7c, 0.6);
    g.lineBetween(0, counterY, CANVAS_W, counterY);
    g.lineStyle(1, 0x2a2a48, 0.7);
    for (let x = 40; x < CANVAS_W; x += 80) g.lineBetween(x, counterY, x, floorTop);

    // Floor: a tiled/grating look (alternating tile shading plus a grid of
    // seam lines) rather than a flat fill with only vertical rules -- each
    // tile is still a single flat color (no per-tile diagonal shading; floors
    // read better flat, per the overworld's own ground tiles).
    const tileW = 40;
    const tileH = 35;
    for (let ty = floorTop; ty < CANVAS_H; ty += tileH) {
      for (let tx = 0; tx < CANVAS_W; tx += tileW) {
        const parity = (Math.round((tx - 0) / tileW) + Math.round((ty - floorTop) / tileH)) % 2;
        g.fillStyle(parity === 0 ? 0x14142a : 0x18182f, 1);
        g.fillRect(tx, ty, tileW, tileH);
      }
    }
    g.lineStyle(1, 0x3a3a5c, 0.35);
    for (let tx = 0; tx <= CANVAS_W; tx += tileW) g.lineBetween(tx, floorTop, tx, CANVAS_H);
    for (let ty = floorTop; ty <= CANVAS_H; ty += tileH) g.lineBetween(0, ty, CANVAS_W, ty);

    // Soft ambient glow on the floor beneath where the player's crystal
    // floats (positioned in `create()` right after this call), so the room
    // doesn't read as uniformly flat-lit.
    for (let r = 90; r >= 30; r -= 20) {
      glow.fillStyle(0x8fa0ff, 0.05);
      glow.fillCircle(CANVAS_W / 2, 250, r);
    }
  }

  private rivalDefeated(): Record<number, boolean> {
    return (this.game.registry.get('rivalDefeated') as Record<number, boolean>) ?? {};
  }

  // The furthest world the player has unlocked: world 1 until its rival
  // falls, then world 2, and so on -- each world's own rival being beaten is
  // what opens the next one, so this just walks the chain rather than
  // hardcoding a fixed handful of worlds. Capped at the last built world
  // (BUILT_WORLDS's own max) so a player who beats World 10's rival and
  // returns to the Hub before the finale panel fires lands back in World 10
  // itself, rather than a nonexistent World 11 no world data/wild pool/rival/
  // guardian is ever defined for.
  private highestUnlockedWorld(): number {
    const defeated = this.rivalDefeated();
    const maxWorld = Math.max(...BUILT_WORLDS);
    let world = 1;
    while (defeated[world] && world < maxWorld) world += 1;
    return world;
  }

  private isSuperpositionMode(): boolean {
    return !!this.game.registry.get('superpositionMode');
  }

  // Whether stepping through the door (or pressing Enter, see create()) into
  // `world` actually resumes the player's in-progress position there rather
  // than generating a fresh map. `visitedWorlds` alone isn't enough to
  // promise that -- it's part of the persisted save (data/save.ts), but the
  // map snapshot it would resume from (OverworldScene's `mapState` registry
  // key, written by its own saveMapState()/returnToHub()) is deliberately
  // registry-only and does not survive a page reload -- so this checks both,
  // the same two facts OverworldScene.create() itself checks
  // (`saved.world === this.world && !this.regenerate`) before deciding
  // whether to restoreMap() or generateMap(). One shared predicate for
  // doorLabel()/enterWorld()/the Enter-key handler so the label shown and
  // the navigation that actually happens can never disagree. Superposition
  // Mode never resumes in place through this door at all (below).
  private canResumeWorld(world: number): boolean {
    if (this.isSuperpositionMode()) return false;
    const visited = (this.game.registry.get('visitedWorlds') as number[]) ?? [];
    if (!visited.includes(world)) return false;
    const mapState = this.game.registry.get('mapState') as { world: number } | undefined;
    return mapState?.world === world;
  }

  // Superposition Mode drops the player into World 1, same as Story Mode's
  // door, rather than gating on the normal `highestUnlockedWorld()` progress
  // check. Superposition mode pre-seeds `visitedWorlds` with all of
  // BUILT_WORLDS (see OverworldScene.create), so once the player reaches
  // Bloch's world (World 2, reachable via the walkable world doors) his
  // teleport hub (OverworldScene.showBlochHub) already offers every world as
  // a destination -- no separate warp UI needed.
  private doorLabel(): string {
    if (this.isSuperpositionMode()) return 'Enter World 1';
    const world = this.highestUnlockedWorld();
    return this.canResumeWorld(world) ? `Back to World ${world}` : `Enter World ${world}`;
  }

  private enterWorld() {
    if (this.isSuperpositionMode()) {
      this.scene.start('Overworld', { world: 1, regenerate: true });
      return;
    }
    const world = this.highestUnlockedWorld();
    this.scene.start('Overworld', { world, regenerate: !this.canResumeWorld(world) });
  }

  private addButton(x: number, y: number, label: string, onClick: () => void, fontSizePxOverride?: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, label, {
        fontSize: fontSizePxOverride ?? fontPx(this, 12),
        color: '#ffff88',
        backgroundColor: '#222244',
        padding: { x: 8, y: 4 },
        align: 'center',
        wordWrap: { width: 320 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
  }

  // Same button look as addButton above, but taking an explicit container
  // (so a panel's content can be built top-down, each button appended to
  // that panel's own container) and wrap width -- the shape
  // scenes/panels/hubStations.ts's ported panels need, mirroring
  // OverworldScene's own addDialogueButtonAt exactly (same cross-cutting
  // dialogue-infrastructure tradeoff CODEMAP.md's "Guardian panels" section
  // documents for that scene).
  addDialogueButtonAt(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    wrapWidth = 230,
    fontSizePxOverride?: string
  ): Phaser.GameObjects.Text {
    const btn = this.add
      .text(x, y, label, {
        fontSize: fontSizePxOverride ?? fontPx(this, 13),
        color: '#ffff88',
        backgroundColor: '#222244',
        padding: { x: 10, y: 5 },
        align: 'center',
        wordWrap: { width: wrapWidth },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
    container.add(btn);
    return btn;
  }

  // Its own panel (not a generic showPanel() call) so it can carry the same
  // gold ("panel name") heading and centered-content layout the Lab's other
  // seven panels use -- its own rune/beacon motif (makeSavePointMotif) sits
  // beside its station button out in the room, not inside this panel.
  private showSavePoint() {
    persistFromRegistry(this.game.registry);
    this.closeDialogue();

    const panelWidth = 440;
    const top = 20;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    let y = top;
    const titleText = this.add
      .text(CANVAS_W / 2, y, 'Save Point', { fontSize: fontPx(this, 15), color: LAB_TITLE_COLOR, fontStyle: 'bold' })
      .setOrigin(0.5, 0);
    container.add(titleText);
    y += titleText.height + 14;

    const columns = labPanelColumns(panelWidth);

    const bodyText = this.add
      .text(columns.contentCenterX, y, "Your progress hums into the Lab's memory. Game saved.", {
        fontSize: fontPx(this, 13),
        color: '#cfd8ff',
        align: 'center',
        wordWrap: { width: columns.contentWrapW },
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);
    container.add(bodyText);
    y += bodyText.height + 18;

    const closeBtn = this.addDialogueButtonAt(container, CANVAS_W / 2, y, 'Close', () => this.closeDialogue(), 260);
    y += closeBtn.height + 12;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.95)
      .setStrokeStyle(2, 0x9a6ad9);
    container.addAt(panel, 0);
  }

  // Every real compound in the game (allCrystals()), each paired with
  // whether the player has actually discovered it (registry
  // discoveredMaterials, set by OverworldScene.recordDiscovery) -- an
  // undiscovered entry still has a slot in this list, masked down to "???"
  // by renderMaterialdexPanel, so the index reads as a checklist of the
  // whole game rather than only ever growing entries already found.
  // Alphabetical by the compound's real name regardless of discovery state,
  // so the left-column list has one stable order rather than reshuffling as
  // more crystals are found.
  private materialdexIndex(): MaterialdexEntry[] {
    const discoveredNames = new Set(
      ((this.game.registry.get('discoveredMaterials') as DiscoveredMaterial[]) ?? []).map((m) => m.name)
    );
    return allCrystals()
      .map((material) => ({ material, discovered: discoveredNames.has(material.name) }))
      .sort((a, b) => a.material.name.localeCompare(b.material.name));
  }

  // materialdexIndex() narrowed by the current type filter.
  private filteredMaterialdexIndex(): MaterialdexEntry[] {
    return this.materialdexIndex().filter(
      ({ material }) => this.materialdexTypeFilter === 'all' || material.type === this.materialdexTypeFilter
    );
  }

  private showMaterialdex() {
    this.materialdexListPage = 0;
    this.materialdexTypeFilter = 'all';
    this.materialdexSelectedName = this.materialdexIndex()[0]?.material.name ?? null;
    this.renderMaterialdexPanel();
  }

  // Trims a row's already-rendered label down to `maxWidth` (appending an
  // ellipsis) rather than wrapping it -- a handful of real compound names
  // (e.g. "Rhombohedral Pentalayer Graphene/hBN Moiré") run well past the
  // narrow left-column width, and wrapping would make row heights uneven,
  // breaking the uniform-row-height math the page-fit calculation below
  // relies on. Checked against the text object's own measured `.width` (so
  // it accounts for the current font-scale preset) rather than a fixed
  // character count.
  private fitListLabel(rowText: Phaser.GameObjects.Text, label: string, maxWidth: number) {
    if (rowText.width <= maxWidth) return;
    let trimmed = label;
    while (trimmed.length > 1 && rowText.width > maxWidth) {
      trimmed = trimmed.slice(0, -1);
      rowText.setText(`${trimmed}…`);
    }
  }

  // Two-column layout: every compound's name as its own clickable row in a
  // left column (as many as fit on one screen, paginated only once the full
  // list outgrows that), and a right-hand detail pane (crystal render, name,
  // physics blurb) for whichever row is currently selected
  // (materialdexSelectedName) -- lets a player scan ~90+ compound names at
  // once instead of stepping through them one at a time.
  private renderMaterialdexPanel() {
    this.closeDialogue();
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const totalAll = this.materialdexIndex().length;
    const discoveredAll = this.materialdexIndex().filter((e) => e.discovered).length;
    const entries = this.filteredMaterialdexIndex();

    const panelW = 620;
    const top = 16;
    const bottomMargin = 14;
    const panelLeft = CANVAS_W / 2 - panelW / 2;
    let y = top;

    const titleText = this.add
      .text(CANVAS_W / 2, y, `Qumatex -- ${discoveredAll}/${totalAll} discovered`, {
        fontSize: fontPx(this, 14),
        color: '#ffe066',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);
    container.add(titleText);
    // A small purple prism by the title -- this panel's detail pane already
    // renders the selected compound's own real crystal (below), which
    // already carries the "themed motif" STYLE.md's Lab-panels section asks
    // for, so the title only gets this flourish rather than a second full
    // left-side motif column competing with the two-column list/detail
    // layout. The Qumatex station's own room button has no motif of its
    // own to echo (art/labMotifs.ts has no builder for it, same reason).
    const titleIcon = makeCrystal(this, 16, 0x9a6ad9, 'prism');
    titleIcon.setPosition(titleText.x - titleText.width / 2 - 16, titleText.y + titleText.height / 2);
    container.add(titleIcon);
    y += titleText.height + 8;

    // Type filter -- cycles through every MaterialType (TYPE_LOOK's own
    // keys) plus "All," narrowing which rows appear in the left column.
    const filterBtn = this.addButton(
      CANVAS_W / 2,
      y,
      `Type: ${this.materialdexTypeFilter === 'all' ? 'All' : this.materialdexTypeFilter} ▸`,
      () => {
        const types = Object.keys(TYPE_LOOK) as MaterialType[];
        const options: (MaterialType | 'all')[] = ['all', ...types];
        const currentIndex = options.indexOf(this.materialdexTypeFilter);
        this.materialdexTypeFilter = options[(currentIndex + 1) % options.length];
        this.materialdexListPage = 0;
        const filtered = this.filteredMaterialdexIndex();
        this.materialdexSelectedName = filtered[0]?.material.name ?? null;
        this.renderMaterialdexPanel();
      },
      fontPx(this, 10)
    );
    container.add(filterBtn);
    y += filterBtn.height + 10;

    const columnsTop = y;
    const leftX = panelLeft + 18;
    const leftColW = 200;
    const dividerX = leftX + leftColW + 16;
    const rightColLeft = dividerX + 16;
    const rightColRight = panelLeft + panelW - 18;
    const rightColW = rightColRight - rightColLeft;
    const rightColCenterX = rightColLeft + rightColW / 2;

    // Left column: as many name rows as fit, same sample-row-measurement
    // approach OverworldScene.renderPagedButtons uses (STYLE.md's
    // "Paginated candidate lists") -- reserve space for this column's own
    // Prev/Next+page-label row and the panel's shared Close-button footer
    // whether or not either ends up showing, so a page that happens to fit
    // exactly doesn't get a taller neighbor once one of them appears.
    const sampleRow = this.add.text(-1000, -1000, 'Sample', { fontSize: fontPx(this, 12), padding: { x: 8, y: 4 } });
    const rowH = sampleRow.height + 4;
    sampleRow.destroy();
    const reservedTail = rowH * 2;
    const reservedControls = rowH * 2;
    const available = CANVAS_H - columnsTop - reservedTail - reservedControls;
    const fitPerPage = Math.max(1, Math.floor(available / rowH));
    const totalPages = Math.max(1, Math.ceil(entries.length / fitPerPage));
    const listPage = Phaser.Math.Clamp(this.materialdexListPage, 0, totalPages - 1);
    this.materialdexListPage = listPage;
    const pageEntries = entries.slice(listPage * fitPerPage, listPage * fitPerPage + fitPerPage);

    let leftY = columnsTop;
    if (pageEntries.length === 0) {
      const empty = this.add
        .text(leftX, leftY, 'No crystals\nof this type.', {
          fontSize: fontPx(this, 11),
          color: '#8fa0c9',
        })
        .setOrigin(0, 0);
      container.add(empty);
      leftY += empty.height + 4;
    }
    for (const { material, discovered } of pageEntries) {
      const selected = material.name === this.materialdexSelectedName;
      const label = discovered ? materialDisplayName(material) : '???';
      const rowText = this.add
        .text(leftX, leftY, label, {
          fontSize: fontPx(this, 12),
          color: selected ? '#ffe066' : discovered ? '#cfd8ff' : '#6a7396',
          backgroundColor: selected ? '#3a2a5c' : '#1c1c30',
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0, 0);
      // Trim against the text's own natural (unfixed) width first --
      // `setFixedSize` below pins `.width` to the row's uniform box size,
      // which would make every row (even a short one) read as overflowing.
      this.fitListLabel(rowText, label, leftColW - 4);
      rowText
        .setFixedSize(leftColW, rowH - 4)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.materialdexSelectedName = material.name;
          this.renderMaterialdexPanel();
        });
      container.add(rowText);
      leftY += rowH;
    }
    if (totalPages > 1) {
      const leftColCenterX = leftX + leftColW / 2;
      const prev = this.addButton(
        leftColCenterX - leftColW / 4,
        leftY,
        '<- Prev',
        () => {
          if (listPage > 0) {
            this.materialdexListPage = listPage - 1;
            this.renderMaterialdexPanel();
          }
        },
        fontPx(this, 10)
      );
      if (listPage === 0) prev.setAlpha(0.35);
      const next = this.addButton(
        leftColCenterX + leftColW / 4,
        leftY,
        'Next ->',
        () => {
          if (listPage < totalPages - 1) {
            this.materialdexListPage = listPage + 1;
            this.renderMaterialdexPanel();
          }
        },
        fontPx(this, 10)
      );
      if (listPage === totalPages - 1) next.setAlpha(0.35);
      container.add(prev);
      container.add(next);
      leftY += Math.max(prev.height, next.height) + 6;
      const pageLabel = this.add
        .text(leftColCenterX, leftY, `Page ${listPage + 1}/${totalPages}`, {
          fontSize: fontPx(this, 10),
          color: '#8fa0c9',
        })
        .setOrigin(0.5, 0);
      container.add(pageLabel);
      leftY += pageLabel.height + 4;
    }

    // Vertical divider between the two columns, spanning the taller of the
    // two -- drawn after the left column so its real height is known, and
    // extended at least to the right column's own crystal/name/blurb block
    // below.
    const divider = this.add.graphics();
    divider.lineStyle(1, 0x3a3a5c, 0.6);

    // Right column: the selected compound's crystal render, name, and
    // physics blurb, driven by materialdexSelectedName.
    const selectedEntry =
      this.materialdexIndex().find((e) => e.material.name === this.materialdexSelectedName) ?? entries[0] ?? null;

    let rightY = columnsTop;
    if (selectedEntry) {
      const { material, discovered } = selectedEntry;
      const crystal = makeCrystal(
        this,
        36,
        discovered ? material.color : 0x33394a,
        material.variant,
        discovered ? { seed: material.name, hybrid: material.hybridParents } : undefined
      );
      const crystalBlockH = 84; // fixed regardless of text-size setting -- art, not text (see STYLE.md)
      crystal.setPosition(rightColCenterX, rightY + crystalBlockH / 2);
      container.add(crystal);
      rightY += crystalBlockH;

      const nameText = this.add
        .text(rightColCenterX, rightY, discovered ? materialDisplayName(material) : '???', {
          fontSize: fontPx(this, 14),
          color: '#ffffff',
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: rightColW },
        })
        .setOrigin(0.5, 0);
      container.add(nameText);
      rightY += nameText.height + 8;

      // Blurb length varies a lot (one line for a short entry, half a dozen
      // for a longer one) -- shrink the font in whole-px steps, floor 9,
      // rather than letting a long blurb push the panel's shared footer off
      // the bottom of the canvas (hubStations.ts's showInfoPanel's own body
      // uses this same loop).
      const blurb = discovered
        ? materialBlurb(material)
        : 'Not yet discovered -- find and battle this crystal out in the field to catalogue it.';
      const scale = fontScale(this);
      let blurbBase = 12;
      const blurbText = this.add
        .text(rightColCenterX, rightY, blurb, {
          fontSize: `${Math.round(blurbBase * scale)}px`,
          color: '#cfd8ff',
          align: 'left',
          wordWrap: { width: rightColW },
          lineSpacing: 5,
        })
        .setOrigin(0.5, 0);
      container.add(blurbText);
      const reservedBelow = 8 + 30 + bottomMargin; // gap + footer-button estimate + margin
      while (rightY + blurbText.height + reservedBelow > CANVAS_H - 10 && blurbBase > 9) {
        blurbBase -= 1;
        blurbText.setFontSize(`${Math.round(blurbBase * scale)}px`);
      }
      rightY += blurbText.height + 8;
    }

    const columnsBottom = Math.max(leftY, rightY);
    divider.lineBetween(dividerX, columnsTop - 4, dividerX, columnsBottom);
    container.addAt(divider, 0);

    y = columnsBottom + 10;
    const closeBtn = this.addButton(CANVAS_W / 2, y, '[ Close ]', () => this.closeDialogue());
    container.add(closeBtn);
    y += closeBtn.height + bottomMargin;

    this.insertMaterialdexPanelBg(container, panelW, top, y - top);
  }

  // Background rectangle for the Qumatex panel, inserted behind
  // everything once renderMaterialdexPanel above knows the real content
  // height.
  private insertMaterialdexPanelBg(container: Phaser.GameObjects.Container, panelW: number, top: number, height: number) {
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + height / 2, panelW, height, 0x10101c, 0.95)
      .setStrokeStyle(2, 0x9a6ad9);
    container.addAt(panel, 0);
  }

  // The Lab's one-off welcome tip (maybeShowLabTip) is this method's only
  // caller now -- Save Point and Qumatex build their own panels
  // (showSavePoint/renderMaterialdexPanel) since neither is one of
  // scenes/panels/hubStations.ts's six stations. Kept on the same
  // measured-top-down-layout/shrink-to-fit pattern as those anyway, so a
  // one-off popup doesn't look like a different panel era.
  private showPanel(title: string, body: string) {
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panelWidth = 440;
    const top = 20;
    let y = top;

    const titleText = this.add
      .text(CANVAS_W / 2, y, title, {
        fontSize: fontPx(this, 15),
        color: LAB_TITLE_COLOR,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: panelWidth - 60 },
      })
      .setOrigin(0.5, 0);
    container.add(titleText);
    y += titleText.height + 14;

    const scale = fontScale(this);
    let bodyBase = 12;
    const bodyText = this.add
      .text(CANVAS_W / 2, y, body, {
        fontSize: `${Math.round(bodyBase * scale)}px`,
        color: '#cfd8ff',
        align: 'center',
        wordWrap: { width: panelWidth - 60 },
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

    const closeBtn = this.addDialogueButtonAt(container, CANVAS_W / 2, y, 'Close', () => this.closeDialogue(), 260);
    y += closeBtn.height + 12;

    const panelHeight = y - top;
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.95)
      .setStrokeStyle(2, 0x9a6ad9);
    container.addAt(panel, 0);
  }

  // Public, not private -- see the dialogueContainer field comment above.
  // Shared by every panel this scene opens -- Save Point, the Lab tip,
  // Qumatex, and scenes/panels/hubStations.ts's six stations --
  // renderMaterialdexPanel/hubStations.ts's own panels call this first to
  // clear their own previous container on a redraw (filter change, row
  // pick, list paging, settings change) before rebuilding.
  closeDialogue() {
    this.dialogueContainer?.destroy(true);
    this.dialogueContainer = undefined;
  }
}
