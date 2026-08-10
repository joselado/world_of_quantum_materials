import Phaser from 'phaser';
import { makeCrystal } from '../art/crystals';
import { CANVAS_W, CANVAS_H } from '../art/perspective';
import { getPlayerMaterial, WORLD_NAMES } from '../data/materials';
import { materialBlurb } from '../data/materialdex';
import { persistFromRegistry } from '../data/save';
import type { DiscoveredMaterial } from '../data/save';
import type { CrystalVariant } from '../data/types';
import { music } from '../audio/music';

// World 0, "The Lab" (DESIGN.md's world table) -- boot destination from
// TitleScene and the return point from Overworld (press H). Unlike the
// numbered worlds it isn't a walkable procedural map: it's a single static
// room with three fixed hotspots (Materialdex, a save point, the door
// onward), since none of the hub's jobs -- catalog, save, launch -- need
// overworld movement or wild encounters of their own.
export class HubScene extends Phaser.Scene {
  private dialogueContainer?: Phaser.GameObjects.Container;

  constructor() {
    super('Hub');
  }

  create() {
    music.play('overworld:1');
    this.dialogueContainer = undefined;
    this.drawRoom();

    this.add
      .text(CANVAS_W / 2, 30, 'World 0 -- The Lab', {
        fontSize: '16px',
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
        { fontSize: '12px', fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: 480 } }
      )
      .setOrigin(0.5, 0);

    const playerMaterial = getPlayerMaterial(this.game.registry);
    const player = makeCrystal(this, 46, playerMaterial.color, playerMaterial.variant);
    player.setPosition(CANVAS_W / 2, 230);
    this.tweens.add({ targets: player, y: 220, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.addHotspot(150, 300, 0x9a6ad9, 'prism', 'Materialdex', () => this.showMaterialdex());
    this.addHotspot(CANVAS_W / 2, 300, 0xffe066, 'shard', 'Save Point', () => this.showSavePoint());
    this.addHotspot(CANVAS_W - 150, 300, 0x4ad9a0, 'cluster', this.doorLabel(), () => this.enterWorld());

    this.add
      .text(CANVAS_W / 2, 410, 'Click a station to interact.', { fontSize: '12px', color: '#8fa0c9' })
      .setOrigin(0.5);
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
        fontSize: '12px',
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

  private isDebugMode(): boolean {
    return !!this.game.registry.get('debugMode');
  }

  private doorLabel(): string {
    return this.isDebugMode() ? 'Debug: Warp' : `Enter World ${this.highestUnlockedWorld()}`;
  }

  private enterWorld() {
    if (this.isDebugMode()) {
      this.showWorldSelectPanel();
      return;
    }
    this.scene.start('Overworld', { world: this.highestUnlockedWorld() });
  }

  // Debug-mode-only alternative to the normal door: jumps straight to any of
  // the 10 worlds regardless of rivalDefeated progress, since debug mode is
  // about testing/exploring every world rather than earning access to it.
  // OverworldScene.create() re-levels the player's stats/moves/HP for
  // whichever world is entered (see its applyDebugLeveling).
  private showWorldSelectPanel() {
    if (this.dialogueContainer) return;
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const rowCount = 10;
    const panelHeight = 90 + rowCount * 30;
    const panelY = CANVAS_H / 2;
    const panel = this.add
      .rectangle(CANVAS_W / 2, panelY, 360, panelHeight, 0x10101c, 0.96)
      .setStrokeStyle(2, 0xff4fd8);
    container.add(panel);

    const title = this.add
      .text(CANVAS_W / 2, panelY - panelHeight / 2 + 14, 'Debug: Warp to World', {
        fontSize: '14px',
        color: '#ff8fe0',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);
    container.add(title);

    const rowsTop = panelY - panelHeight / 2 + 46;
    for (let w = 1; w <= rowCount; w++) {
      const name = WORLD_NAMES[w] ?? `World ${w}`;
      const row = this.addButton(CANVAS_W / 2, rowsTop + (w - 1) * 30, `World ${w} -- ${name}`, () => {
        this.scene.start('Overworld', { world: w, regenerate: true });
      });
      container.add(row);
    }

    const close = this.addButton(CANVAS_W / 2, rowsTop + rowCount * 30 + 8, '[ Close ]', () => this.closeDialogue());
    container.add(close);
  }

  private addButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, label, {
        fontSize: '12px',
        color: '#ffff88',
        backgroundColor: '#222244',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
  }

  private showSavePoint() {
    persistFromRegistry(this.game.registry);
    this.showPanel('Save Point', "Your progress hums into the Lab's memory. Game saved.");
  }

  private showMaterialdex() {
    const discovered = (this.game.registry.get('discoveredMaterials') as DiscoveredMaterial[]) ?? [];
    if (discovered.length === 0) {
      this.showPanel('Materialdex', 'No crystals catalogued yet -- go meet some out in the field.');
      return;
    }

    const body = discovered.map((m) => `${m.name} -- ${materialBlurb(m)}`).join('\n\n');
    this.showPanel('Materialdex', body);
  }

  private showPanel(title: string, body: string) {
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panel = this.add.rectangle(CANVAS_W / 2, CANVAS_H / 2, 560, 340, 0x10101c, 0.95).setStrokeStyle(2, 0x9a6ad9);
    container.add(panel);

    const titleText = this.add
      .text(CANVAS_W / 2, CANVAS_H / 2 - 155, title, { fontSize: '15px', color: '#ffe066', fontStyle: 'bold' })
      .setOrigin(0.5, 0);
    container.add(titleText);

    const bodyText = this.add
      .text(CANVAS_W / 2, CANVAS_H / 2 - 120, body, {
        fontSize: '12px',
        color: '#cfd8ff',
        align: 'left',
        wordWrap: { width: 500 },
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);
    container.add(bodyText);

    const closeBtn = this.add
      .text(CANVAS_W / 2, CANVAS_H / 2 + 130, '[ Close ]', {
        fontSize: '13px',
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
