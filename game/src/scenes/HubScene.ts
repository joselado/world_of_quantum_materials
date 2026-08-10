import Phaser from 'phaser';
import { makeCrystal } from '../art/crystals';
import { CANVAS_W, CANVAS_H } from '../art/perspective';
import { getPlayerMaterial } from '../data/materials';
import { materialBlurb } from '../data/materialdex';
import { persistFromRegistry } from '../data/save';
import type { DiscoveredMaterial } from '../data/save';
import type { CrystalVariant } from '../data/types';
import { TUTORIAL_TIPS, hasSeenTip, markTipSeen } from '../data/tutorial';
import { music } from '../audio/music';
import { fontPx } from '../ui/text';

// World 0, "The Lab" (DESIGN.md's world table) -- boot destination from
// TitleScene and the return point from Overworld (press H). Unlike the
// numbered worlds it isn't a walkable procedural map: it's a single static
// room with three fixed hotspots (Materialdex, a save point, the door
// onward), since none of the hub's jobs -- catalog, save, launch -- need
// overworld movement or wild encounters of their own.
const MATERIALDEX_ENTRIES_PER_PAGE = 2;

export class HubScene extends Phaser.Scene {
  private dialogueContainer?: Phaser.GameObjects.Container;
  // Which page of the Materialdex is showing -- reset to 0 every time the
  // hotspot is (re)opened, mirroring OverworldScene's tutorialIndex pattern.
  private materialdexPage = 0;

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
    const player = makeCrystal(this, 46, playerMaterial.color, playerMaterial.variant);
    player.setPosition(CANVAS_W / 2, 230);
    this.tweens.add({ targets: player, y: 220, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.addHotspot(115, 300, 0x9a6ad9, 'prism', 'Materialdex', () => this.showMaterialdex());
    this.addHotspot(CANVAS_W / 2, 300, 0xffe066, 'shard', 'Save Point', () => this.showSavePoint());
    this.addHotspot(CANVAS_W - 115, 300, 0x4ad9a0, 'cluster', this.doorLabel(), () => this.enterWorld());

    this.add
      .text(CANVAS_W / 2, 410, 'Click a station to interact.', { fontSize: fontPx(this, 12), color: '#8fa0c9' })
      .setOrigin(0.5);

    this.maybeShowLabTip();
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

  private drawRoom() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x2a2a44, 0x2a2a44, 1);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);
    g.fillStyle(0x14142a, 1);
    g.fillRect(0, 340, CANVAS_W, CANVAS_H - 340);
    g.lineStyle(2, 0x3a3a5c, 0.6);
    for (let x = 0; x <= CANVAS_W; x += 80) g.lineBetween(x, 340, x, CANVAS_H);
  }

  private addHotspot(
    x: number,
    y: number,
    color: number,
    variant: CrystalVariant,
    label: string,
    onClick: () => void
  ) {
    const icon = makeCrystal(this, 30, color, variant);
    icon.setPosition(x, y);
    icon.setInteractive(new Phaser.Geom.Circle(0, 0, 30), Phaser.Geom.Circle.Contains);
    icon.on('pointerdown', () => {
      if (this.dialogueContainer) return; // one panel at a time
      onClick();
    });
    this.tweens.add({ targets: icon, y: y - 6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add
      .text(x, y + 44, label, {
        fontSize: fontPx(this, 12),
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.45)',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 0);
  }

  private rivalDefeated(): Record<number, boolean> {
    return (this.game.registry.get('rivalDefeated') as Record<number, boolean>) ?? {};
  }

  // The furthest world the player has unlocked: world 1 until its rival
  // falls, then world 2, and so on -- each world's own rival being beaten is
  // what opens the next one, so this just walks the chain rather than
  // hardcoding a fixed handful of worlds.
  private highestUnlockedWorld(): number {
    const defeated = this.rivalDefeated();
    let world = 1;
    while (defeated[world]) world += 1;
    return world;
  }

  private isSuperpositionMode(): boolean {
    return !!this.game.registry.get('superpositionMode');
  }

  // Superposition Mode drops the player straight into World 2 -- Bloch's
  // world -- rather than the normal `highestUnlockedWorld()` gate. Bloch's
  // own teleport hub (OverworldScene.showBlochHub) then offers every world
  // as a destination, since superposition mode also pre-seeds `visitedWorlds`
  // with all of BUILT_WORLDS (see OverworldScene.create) -- no separate
  // warp UI needed, Bloch already does that job.
  private doorLabel(): string {
    return this.isSuperpositionMode() ? 'Enter World 2 (Bloch)' : `Enter World ${this.highestUnlockedWorld()}`;
  }

  private enterWorld() {
    if (this.isSuperpositionMode()) {
      this.scene.start('Overworld', { world: 2, regenerate: true });
      return;
    }
    this.scene.start('Overworld', { world: this.highestUnlockedWorld() });
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

  private showSavePoint() {
    persistFromRegistry(this.game.registry);
    this.showPanel('Save Point', "Your progress hums into the Lab's memory. Game saved.");
  }

  // Paginated rather than one long scrolling block -- a long-run save can
  // easily discover 20+ materials, and a flat wordWrap'd list of every
  // blurb at once ran well past the panel's (and the canvas's) bottom edge.
  // Same paging shape as OverworldScene's tutorial popup: a page index field
  // plus Back/Next buttons that re-render in place.
  private showMaterialdex() {
    const discovered = (this.game.registry.get('discoveredMaterials') as DiscoveredMaterial[]) ?? [];
    if (discovered.length === 0) {
      this.showPanel('Materialdex', 'No crystals catalogued yet -- go meet some out in the field.');
      return;
    }
    this.materialdexPage = 0;
    this.renderMaterialdexPage(discovered);
  }

  private renderMaterialdexPage(discovered: DiscoveredMaterial[]) {
    this.closeDialogue();
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panelW = 600;
    const panelH = 420;
    const panelY = CANVAS_H / 2;
    const top = panelY - panelH / 2;
    const panel = this.add.rectangle(CANVAS_W / 2, panelY, panelW, panelH, 0x10101c, 0.95).setStrokeStyle(2, 0x9a6ad9);
    container.add(panel);

    const totalPages = Math.max(1, Math.ceil(discovered.length / MATERIALDEX_ENTRIES_PER_PAGE));
    const page = Phaser.Math.Clamp(this.materialdexPage, 0, totalPages - 1);

    const titleText = this.add
      .text(CANVAS_W / 2, top + 16, `Materialdex -- ${discovered.length} discovered (page ${page + 1}/${totalPages})`, {
        fontSize: fontPx(this, 14),
        color: '#ffe066',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);
    container.add(titleText);

    const entries = discovered.slice(
      page * MATERIALDEX_ENTRIES_PER_PAGE,
      page * MATERIALDEX_ENTRIES_PER_PAGE + MATERIALDEX_ENTRIES_PER_PAGE
    );
    const entryTop = top + 50;
    const entryH = (panelH - 100) / MATERIALDEX_ENTRIES_PER_PAGE;
    entries.forEach((m, i) => {
      const entryText = this.add
        .text(CANVAS_W / 2, entryTop + i * entryH, `${m.name} -- ${materialBlurb(m)}`, {
          fontSize: fontPx(this, 12),
          color: '#cfd8ff',
          align: 'left',
          wordWrap: { width: panelW - 60 },
          lineSpacing: 5,
        })
        .setOrigin(0.5, 0);
      container.add(entryText);
    });

    const footerY = panelY + panelH / 2 - 30;
    if (page > 0) {
      container.add(
        this.addButton(CANVAS_W / 2 - 170, footerY, '<- Back', () => {
          this.materialdexPage = page - 1;
          this.renderMaterialdexPage(discovered);
        })
      );
    }
    container.add(this.addButton(CANVAS_W / 2, footerY, '[ Close ]', () => this.closeDialogue()));
    if (page < totalPages - 1) {
      container.add(
        this.addButton(CANVAS_W / 2 + 170, footerY, 'Next ->', () => {
          this.materialdexPage = page + 1;
          this.renderMaterialdexPage(discovered);
        })
      );
    }
  }

  private showPanel(title: string, body: string) {
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panel = this.add.rectangle(CANVAS_W / 2, CANVAS_H / 2, 560, 340, 0x10101c, 0.95).setStrokeStyle(2, 0x9a6ad9);
    container.add(panel);

    const titleText = this.add
      .text(CANVAS_W / 2, CANVAS_H / 2 - 155, title, { fontSize: fontPx(this, 15), color: '#ffe066', fontStyle: 'bold' })
      .setOrigin(0.5, 0);
    container.add(titleText);

    const bodyText = this.add
      .text(CANVAS_W / 2, CANVAS_H / 2 - 120, body, {
        fontSize: fontPx(this, 12),
        color: '#cfd8ff',
        align: 'left',
        wordWrap: { width: 500 },
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);
    container.add(bodyText);

    const closeBtn = this.add
      .text(CANVAS_W / 2, CANVAS_H / 2 + 130, '[ Close ]', {
        fontSize: fontPx(this, 13),
        color: '#ffff88',
        backgroundColor: '#222244',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.closeDialogue());
    container.add(closeBtn);
  }

  private closeDialogue() {
    this.dialogueContainer?.destroy(true);
    this.dialogueContainer = undefined;
  }
}
