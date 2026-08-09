import Phaser from 'phaser';
import { hasSave, loadSave } from '../data/save';
import { music } from '../audio/music';
import { CANVAS_W, CANVAS_H } from '../art/perspective';
import { makeCrystal } from '../art/crystals';
import { PLAYER_MATERIAL } from '../data/materials';

// The game's actual boot scene (main.ts lists this first) -- also where the
// one localStorage save slot (data/save.ts) gets loaded into the Phaser
// registry, the runtime source of truth every later scene reads/writes.
// Every other scene assumes these registry keys already exist, so this load
// has to happen before any of them can run.
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const save = loadSave();
    const registry = this.game.registry;
    registry.set('qumatokens', save.qumatokens);
    registry.set('unlockedMoves', save.unlockedMoves);
    registry.set('playerHp', save.playerHp);
    registry.set('rivalDefeated', save.rivalDefeated);
    registry.set('discoveredMaterials', save.discoveredMaterials);

    music.play('overworld');

    const g = this.add.graphics();
    g.fillGradientStyle(0x0c1030, 0x0c1030, 0x241a44, 0x241a44, 1);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const crystal = makeCrystal(this, 60, PLAYER_MATERIAL.color, PLAYER_MATERIAL.variant);
    crystal.setPosition(CANVAS_W / 2, 170);
    this.tweens.add({ targets: crystal, y: 160, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add
      .text(CANVAS_W / 2, 250, 'QUANTUM MATERIALS', { fontSize: '30px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);
    this.add
      .text(CANVAS_W / 2, 288, 'a crystal RPG', { fontSize: '14px', fontStyle: 'italic', color: '#cfd8ff' })
      .setOrigin(0.5);

    const label = hasSave() ? 'Continue' : 'New Game';
    const startButton = this.add
      .text(CANVAS_W / 2, 360, `[ ${label} ]`, {
        fontSize: '18px',
        color: '#ffff88',
        backgroundColor: '#222244',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.start());
    this.tweens.add({ targets: startButton, alpha: { from: 0.7, to: 1 }, duration: 700, yoyo: true, repeat: -1 });

    this.add
      .text(CANVAS_W / 2, 410, 'Press SPACE or click to begin', { fontSize: '12px', color: '#8fa0c9' })
      .setOrigin(0.5);

    this.input.keyboard!.once('keydown-SPACE', () => this.start());
  }

  private start() {
    this.scene.start('Hub');
  }
}
