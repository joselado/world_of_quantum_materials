import Phaser from 'phaser';
import { clearSave, hasSave, loadSave, persistFromRegistry } from '../data/save';
import { music } from '../audio/music';
import { CANVAS_W, CANVAS_H } from '../art/perspective';
import { makeCrystal } from '../art/crystals';
import { TYPE_LOOK } from '../data/materials';
import type { MaterialType } from '../data/types';
import { fontPx } from '../ui/text';

// A curated handful of main types (not all 10, to keep the cluster
// readable) showing off the variety of looks TYPE_LOOK defines -- purely a
// "world full of different materials" branding image for the title screen,
// independent of the player's own save/current form (the Hub is where that
// gets its own moment). One "hero" entry (biggest, drawn last so it's on
// top and centered) plus two near and two far flanking crystals, each
// bobbing on its own independent timing so the cluster reads as alive
// rather than a single synchronized animation.
const SHOWCASE: { type: MaterialType; size: number; x: number; y: number; duration: number; delay: number }[] = [
  { type: 'trivial', size: 24, x: 150, y: 120, duration: 1300, delay: 0 },
  { type: 'tensornet', size: 26, x: 495, y: 115, duration: 1450, delay: 120 },
  { type: 'magnet', size: 34, x: 228, y: 147, duration: 1150, delay: 260 },
  { type: 'supercon', size: 34, x: 415, y: 147, duration: 1250, delay: 60 },
  { type: 'topological', size: 48, x: 320, y: 130, duration: 1100, delay: 0 },
];

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
    registry.set('tutorialTipsSeen', save.tutorialTipsSeen);
    registry.set('debugMode', save.debugMode);
    registry.set('encounterDensity', save.encounterDensity);
    registry.set('fontScale', save.fontScale);

    music.play('overworld:1');

    const g = this.add.graphics();
    g.fillGradientStyle(0x0c1030, 0x0c1030, 0x241a44, 0x241a44, 1);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);

    this.drawShowcaseCrystals();

    // Laid out top-down with a running `y` (each element's own height
    // advancing it) rather than fixed pixel positions, since the title's
    // own font size -- and therefore how many lines it wraps to -- depends
    // on the Settings panel's text-size setting (see OverworldScene
    // .showSettingsPanel for the same pattern).
    const title = this.add
      .text(CANVAS_W / 2, 165, 'WORLD OF QUANTUM MATERIALS', {
        fontSize: fontPx(this, 20),
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: CANVAS_W - 40 },
      })
      .setOrigin(0.5, 0);
    let y = title.y + title.height + 14;

    const existingSave = hasSave();
    const label = existingSave ? 'Continue' : 'New Game';
    const startButton = this.add
      .text(CANVAS_W / 2, y, `[ ${label} ]`, {
        fontSize: fontPx(this, 16),
        color: '#ffff88',
        backgroundColor: '#222244',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.start());
    this.tweens.add({ targets: startButton, alpha: { from: 0.7, to: 1 }, duration: 700, yoyo: true, repeat: -1 });
    y += startButton.height + 8;

    // A save already exists, so "Continue" above resumes it -- this is the
    // only path to actually start over, since there is otherwise no way to
    // discard progress once a save has been written once.
    if (existingSave) {
      const erase = this.add
        .text(CANVAS_W / 2, y, 'New Game (erase save)', {
          fontSize: fontPx(this, 12),
          color: '#ff8fa0',
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.confirmNewGame());
      y += erase.height + 6;
    }

    // Debug Mode before the SPACE hint, not after -- it's an actual control
    // (vs. the hint's passive reminder), so it's the one that should stay
    // on-screen if a big text-size setting plus the extra "erase save" line
    // (a returning player only) leaves no room for both above the fold.
    const toggle = this.addDebugToggle(registry, y);
    y += toggle.height + 6;

    this.add
      .text(CANVAS_W / 2, y, 'Press SPACE or click Continue to begin', {
        fontSize: fontPx(this, 12),
        color: '#8fa0c9',
      })
      .setOrigin(0.5, 0);

    this.input.keyboard!.once('keydown-SPACE', () => this.start());
  }

  // "New Game (erase save)" is destructive and irreversible (localStorage,
  // no undo), so it goes through an inline yes/no confirm rather than
  // wiping on a single click.
  private confirmNewGame() {
    const panel = this.add.container(0, 0).setDepth(200);
    const bg = this.add.rectangle(CANVAS_W / 2, CANVAS_H / 2, 380, 150, 0x10101c, 0.96).setStrokeStyle(2, 0xff5a7a);
    const text = this.add
      .text(CANVAS_W / 2, CANVAS_H / 2 - 36, 'Erase your current save and start over?\nThis cannot be undone.', {
        fontSize: fontPx(this, 13),
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5);
    const yes = this.add
      .text(CANVAS_W / 2 - 70, CANVAS_H / 2 + 30, '[ Erase ]', {
        fontSize: fontPx(this, 14),
        color: '#ff8fa0',
        backgroundColor: '#222244',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        clearSave();
        this.scene.restart();
      });
    const no = this.add
      .text(CANVAS_W / 2 + 70, CANVAS_H / 2 + 30, '[ Cancel ]', {
        fontSize: fontPx(this, 14),
        color: '#cfd8ff',
        backgroundColor: '#222244',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => panel.destroy());
    panel.add([bg, text, yes, no]);
  }

  // Debug mode (data/save.ts's `debugMode`) is a testing/exploration aid,
  // not part of the normal progression: while on, OverworldScene re-levels
  // the player to match every world it enters and both the Hub's door and
  // the Enter-menu gain a "Warp" option that jumps straight to any world.
  // Toggled here rather than mid-run so it's a deliberate choice made before
  // starting, not something stumbled into during play.
  private addDebugToggle(registry: Phaser.Data.DataManager, y: number) {
    const label = () => (registry.get('debugMode') ? 'Debug Mode: ON' : 'Debug Mode: OFF');
    const colorFor = () => (registry.get('debugMode') ? '#ff8fa0' : '#8fa0c9');

    const toggle = this.add
      .text(CANVAS_W / 2, y, label(), {
        fontSize: fontPx(this, 12),
        color: colorFor(),
        backgroundColor: '#1a1a2e',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        registry.set('debugMode', !registry.get('debugMode'));
        persistFromRegistry(registry);
        toggle.setText(label()).setColor(colorFor());
      });
    return toggle;
  }

  private drawShowcaseCrystals() {
    SHOWCASE.forEach((entry) => {
      const look = TYPE_LOOK[entry.type];
      const crystal = makeCrystal(this, entry.size, look.color, look.variant);
      crystal.setPosition(entry.x, entry.y);
      this.tweens.add({
        targets: crystal,
        y: entry.y - 10,
        duration: entry.duration,
        delay: entry.delay,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  private start() {
    this.scene.start('Hub');
  }
}
