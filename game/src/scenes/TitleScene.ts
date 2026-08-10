import Phaser from 'phaser';
import { hasSave, loadSave, persistFromRegistry } from '../data/save';
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
    registry.set('playerStats', save.playerStats);
    registry.set('visitedWorlds', save.visitedWorlds);
    registry.set('defeatedMaterials', save.defeatedMaterials);
    registry.set('playerForm', save.playerForm);
    registry.set('metMentors', save.metMentors);
    registry.set('tutorialSeen', save.tutorialSeen);
    registry.set('debugMode', save.debugMode);

    music.play('overworld:1');

    const g = this.add.graphics();
    g.fillGradientStyle(0x0c1030, 0x0c1030, 0x241a44, 0x241a44, 1);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const playerMaterial = save.playerForm ?? PLAYER_MATERIAL;
    const crystal = makeCrystal(this, 60, playerMaterial.color, playerMaterial.variant);
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

    this.addDebugToggle(registry);

    this.input.keyboard!.once('keydown-SPACE', () => this.start());
  }

  // Debug mode (data/save.ts's `debugMode`) is a testing/exploration aid,
  // not part of the normal progression: while on, OverworldScene re-levels
  // the player to match every world it enters and both the Hub's door and
  // the Enter-menu gain a "Warp" option that jumps straight to any world.
  // Toggled here rather than mid-run so it's a deliberate choice made before
  // starting, not something stumbled into during play.
  private addDebugToggle(registry: Phaser.Data.DataManager) {
    const label = () => (registry.get('debugMode') ? 'Debug Mode: ON' : 'Debug Mode: OFF');
    const colorFor = () => (registry.get('debugMode') ? '#ff8fa0' : '#8fa0c9');

    const toggle = this.add
      .text(CANVAS_W / 2, 444, label(), {
        fontSize: '12px',
        color: colorFor(),
        backgroundColor: '#1a1a2e',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        registry.set('debugMode', !registry.get('debugMode'));
        persistFromRegistry(registry);
        toggle.setText(label()).setColor(colorFor());
      });
  }

  private start() {
    this.scene.start('Hub');
  }
}
