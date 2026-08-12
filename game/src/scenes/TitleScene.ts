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
const SHOWCASE_CENTER = CANVAS_W / 2;
const SHOWCASE: { type: MaterialType; size: number; x: number; y: number; duration: number; delay: number }[] = [
  { type: 'metal', size: 24, x: SHOWCASE_CENTER - 221, y: 120, duration: 1300, delay: 0 },
  { type: 'quantumSpinLiquid', size: 26, x: SHOWCASE_CENTER + 228, y: 115, duration: 1450, delay: 120 },
  { type: 'classicalMagnet', size: 34, x: SHOWCASE_CENTER - 120, y: 147, duration: 1150, delay: 260 },
  { type: 'superconductor', size: 34, x: SHOWCASE_CENTER + 124, y: 147, duration: 1250, delay: 60 },
  { type: 'quantumSpinHall', size: 48, x: SHOWCASE_CENTER, y: 130, duration: 1100, delay: 0 },
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
    registry.set('qumatessence', save.qumatessence);
    registry.set('unlockedMoves', save.unlockedMoves);
    registry.set('playerHp', save.playerHp);
    registry.set('rivalDefeated', save.rivalDefeated);
    registry.set('discoveredMaterials', save.discoveredMaterials);
    registry.set('playerStats', save.playerStats);
    registry.set('visitedWorlds', save.visitedWorlds);
    registry.set('defeatedMaterials', save.defeatedMaterials);
    registry.set('playerForm', save.playerForm);
    registry.set('metGuardians', save.metGuardians);
    registry.set('tutorialTipsSeen', save.tutorialTipsSeen);
    registry.set('superpositionMode', save.superpositionMode);
    registry.set('encounterDensity', save.encounterDensity);
    registry.set('fontScale', save.fontScale);
    registry.set('kondoActiveMove', save.kondoActiveMove);
    registry.set('passivesUnlocked', save.passivesUnlocked);
    registry.set('activePassiveByOwner', save.activePassiveByOwner);
    registry.set('moveClassTuning', save.moveClassTuning);
    registry.set('ultimateClassesUnlocked', save.ultimateClassesUnlocked);
    registry.set('andersonDopant', save.andersonDopant);
    registry.set('musicStyle', save.musicStyle);
    registry.set('blochUnlockedWorlds', save.blochUnlockedWorlds);
    registry.set('dresselhausUnlockedCrystals', save.dresselhausUnlockedCrystals);
    registry.set('andersonUnlockedHosts', save.andersonUnlockedHosts);
    registry.set('majoranaUnlockedResults', save.majoranaUnlockedResults);

    music.setStyle(save.musicStyle);
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

    // Mode picker before the SPACE hint, not after -- it's an actual
    // control (vs. the hint's passive reminder), so it's the one that should
    // stay on-screen if a big text-size setting plus the extra "erase save"
    // line (a returning player only) leaves no room for both above the fold.
    y = this.addModeSelector(registry, y);
    y += 6;

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
  // wiping on a single click. Content laid out top-down first (running `y`,
  // wordWrap on the confirm text) with the panel sized/inserted behind and
  // the whole container re-centered afterward -- same pattern every other
  // panel in the game uses -- rather than the earlier fixed 380x150 box at
  // fixed text/button offsets, which overflowed its own border once a
  // larger Text Size preset grew the confirm text past what the fixed
  // layout had room for.
  private confirmNewGame() {
    const panelWidth = 420;
    const top = 20;
    const container = this.add.container(0, 0).setDepth(200);

    let y = top;

    const text = this.add
      .text(CANVAS_W / 2, y, 'Erase your current save and start over?\nThis cannot be undone.', {
        fontSize: fontPx(this, 13),
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: panelWidth - 40 },
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);
    container.add(text);
    y += text.height + 20;

    // Positioned by measured width (button width grows with the Text Size
    // preset) rather than a fixed +/-70 offset, which let the two buttons
    // touch/overlap at the larger presets.
    const yes = this.add
      .text(0, y, '[ Erase ]', {
        fontSize: fontPx(this, 14),
        color: '#ff8fa0',
        backgroundColor: '#222244',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        clearSave();
        this.scene.restart();
      });
    container.add(yes);
    const no = this.add
      .text(0, y, '[ Cancel ]', {
        fontSize: fontPx(this, 14),
        color: '#cfd8ff',
        backgroundColor: '#222244',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => container.destroy());
    container.add(no);
    const buttonGap = 16;
    const buttonsTotalW = yes.width + no.width + buttonGap;
    yes.setX(CANVAS_W / 2 - buttonsTotalW / 2 + yes.width / 2);
    no.setX(CANVAS_W / 2 + buttonsTotalW / 2 - no.width / 2);
    y += Math.max(yes.height, no.height) + top;

    const panelHeight = y - top;
    const bg = this.add
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, 0x10101c, 0.96)
      .setStrokeStyle(2, 0xff5a7a);
    container.addAt(bg, 0);

    container.y = Math.max(0, Math.round((CANVAS_H - panelHeight) / 2)) - top;
  }

  // Two mutually exclusive starting modes, both backed by the same
  // data/save.ts `superpositionMode` boolean (Story Mode is just its
  // `false` state, not a separate field). Story Mode is the normal
  // progression: start at World 1, defeat each world's rival to open the
  // next one, meet each guardian in turn. Superposition Mode is a testing/
  // exploration mode: OverworldScene re-levels the player to match every
  // world it enters, every world counts as already visited so Bloch's
  // teleport hub can fold the player to any of them immediately (no
  // separate warp UI needed -- Bloch already does that job), and
  // Dresselhaus/Majorana/Anderson's panels offer every crystal/hybrid pairing rather than
  // only ones actually defeated. Picked here rather than mid-run so it's a
  // deliberate choice made before starting, not something stumbled into
  // during play. Returns the y position just past the whole control (label,
  // two buttons, and the description line), for the caller's running `y`.
  private addModeSelector(registry: Phaser.Data.DataManager, y: number): number {
    const heading = this.add
      .text(CANVAS_W / 2, y, 'Choose your mode:', {
        fontSize: fontPx(this, 12),
        color: '#cfd8ff',
      })
      .setOrigin(0.5, 0);
    y += heading.height + 4;

    const isSuperposition = () => !!registry.get('superpositionMode');

    const storyBtn = this.add
      .text(0, y, 'Story Mode', {
        fontSize: fontPx(this, 12),
        backgroundColor: '#1a1a2e',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });
    const superBtn = this.add
      .text(0, y, 'Superposition Mode', {
        fontSize: fontPx(this, 12),
        backgroundColor: '#1a1a2e',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });

    const refresh = () => {
      const superposition = isSuperposition();
      storyBtn.setColor(superposition ? '#8fa0c9' : '#ffff88').setBackgroundColor(superposition ? '#1a1a2e' : '#33335a');
      superBtn.setColor(superposition ? '#ff8fa0' : '#8fa0c9').setBackgroundColor(superposition ? '#33335a' : '#1a1a2e');
    };
    refresh();

    const gap = 12;
    const totalW = storyBtn.width + superBtn.width + gap;
    storyBtn.setX(CANVAS_W / 2 - totalW / 2 + storyBtn.width / 2);
    superBtn.setX(CANVAS_W / 2 + totalW / 2 - superBtn.width / 2);

    storyBtn.on('pointerdown', () => {
      registry.set('superpositionMode', false);
      persistFromRegistry(registry);
      refresh();
    });
    superBtn.on('pointerdown', () => {
      registry.set('superpositionMode', true);
      persistFromRegistry(registry);
      refresh();
    });
    y += Math.max(storyBtn.height, superBtn.height) + 4;

    const hint = this.add
      .text(
        CANVAS_W / 2,
        y,
        'Story Mode: start at World 1 and progress in order. Superposition Mode: every guardian, transmutation, and hybrid material is available right away.',
        { fontSize: fontPx(this, 10), color: '#6f7ea8', align: 'center', wordWrap: { width: CANVAS_W - 60 } }
      )
      .setOrigin(0.5, 0);
    y += hint.height;

    return y;
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
