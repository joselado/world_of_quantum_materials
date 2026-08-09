import Phaser from 'phaser';
import { makeCrystal } from '../art/crystals';
import { CANVAS_W, CANVAS_H } from '../art/perspective';
import { PLAYER_MATERIAL } from '../data/materials';
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
    music.play('overworld');
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

    const player = makeCrystal(this, 46, PLAYER_MATERIAL.color, PLAYER_MATERIAL.variant);
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

  private doorLabel(): string {
    return this.rivalDefeated()[1] ? 'Enter World 2' : 'Enter World 1';
  }

  private enterWorld() {
    const world = this.rivalDefeated()[1] ? 2 : 1;
    this.scene.start('Overworld', { world });
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
