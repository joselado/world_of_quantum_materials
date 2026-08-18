import Phaser from 'phaser';
import { clearSave, hasSave, loadSave } from '../data/save';
import { music } from '../audio/music';
import { CANVAS_W, CANVAS_H } from '../art/perspective';
import { makeCrystal } from '../art/crystals';
import { buildQumatuomiMap } from '../art/qumatuomiMap';
import { drawStarNetwork } from '../art/stars';
import { TYPE_LOOK } from '../data/materials';
import type { MaterialType } from '../data/types';
import { fontPx, fontScale } from '../ui/text';
import { PANEL_BG, REFERENCE_BLUE_GREY_HEX } from '../ui/theme';

type ShowcaseEntry = { type: MaterialType; size: number; dx: number; dy: number; duration: number; delay: number };

// How the two framing elements -- the finished star network above and the
// Qumatuomi map below -- sit around the showcase/title/buttons stack. One
// line to flip:
//
//   'a' emblems: the network as a wide, faint field across the top behind the
//       showcase crystals; the map small and fully lit at the bottom, below
//       the hint, with the stack centered in the space above it.
//   'b' watermark: the network as a tighter, brighter figure at the top; the
//       map huge and very faint behind the whole stack, a land the buttons
//       float over.
//   'c' panorama: the network as a wide faint field reaching further down the
//       frame; the map mid-size and half-lit as a bottom panorama that the
//       mode picker and hint overlap.
//
// The network is always the *finished* stage (art/stars.ts's World 10 form),
// drawn faint: meaningless as anything but a constellation until the player
// has walked Worlds 7-10, and a recognition afterwards. The map always shows
// all ten worlds discovered -- like the showcase, this is a "world full of
// places" branding image, not a reflection of the player's own save.
const TITLE_LAYOUT: 'a' | 'b' | 'c' = 'b';

// Per-layout geometry for the two elements. `horizonY` feeds drawStarNetwork's
// band math (stars fill from just below the top down toward it); `scale`
// shrinks the whole star Graphics toward the top center for the tight-figure
// variant. `reserveFrac` is how much of the map's own height is claimed as
// bottom space the content stack centers above rather than into -- 1 keeps
// the stack fully clear of the map, 0 lets it overlap freely, and a fraction
// lets only the last line or two reach into the map's upper coast.
// `topReserve` is the band at the top of the screen the constellation claims
// for itself, which the content stack then centers *below* rather than
// through. Only the tight-figure layout needs one: drawn small and bright
// above the crystals it is a thing in its own right, and centering the stack
// in the whole canvas as if it were not there leaves the composition riding
// high with the bottom of the screen empty. The wide faint variants sit
// behind the crystals instead and claim nothing.
const TITLE_STARS: Record<'a' | 'b' | 'c', { horizonY: number; alpha: number; scale: number; topReserve: number }> = {
  a: { horizonY: 132, alpha: 0.4, scale: 1, topReserve: 0 },
  b: { horizonY: 176, alpha: 0.75, scale: 0.5, topReserve: 62 },
  c: { horizonY: 250, alpha: 0.3, scale: 1, topReserve: 0 },
};
const TITLE_MAP: Record<'a' | 'b' | 'c', { width: number; alpha: number; reserveFrac: number }> = {
  a: { width: 168, alpha: 1, reserveFrac: 1 },
  b: { width: 560, alpha: 0.17, reserveFrac: 0 },
  c: { width: 280, alpha: 0.38, reserveFrac: 0.5 },
};
// The gradient's own top color, which the star network's light is blended
// toward so the constellation sits in this screen's air rather than on top
// of it.
const TITLE_SKY = 0x0c1030;

// A "character-select roster" branding image -- all 13 of data/materials.ts's
// TYPE_LOOK entries shown at once (purely a "world full of different
// materials" image, independent of the player's own save/current form; the
// Hub is where the player's own crystal gets its own moment), arranged as
// two rows rather than one big cluster so the whole thing stays a shallow
// band instead of eating vertical space the title/buttons below need. `dx`/
// `dy` are offsets from drawShowcaseCrystals's own `(centerX, topY)`
// origin, not absolute canvas coordinates.
//
// Every entry in a row is the same size. A roster image is a comparison, and
// a comparison whose members are drawn at different sizes says one specimen
// matters more than another -- which is not a claim this game makes about its
// materials. Depth is carried by the two rows being different sizes from each
// other, not by ranking within a row.
//
// Back row: smaller, more numerous, spread across most of the canvas width
// -- reads as a shelf of specimens rather than a decorative cluster.
const FAR_SHOWCASE: ShowcaseEntry[] = [
  { type: 'metal', size: 15, dx: -360, dy: 14, duration: 1300, delay: 0 },
  { type: 'insulator', size: 15, dx: -257, dy: 20, duration: 1400, delay: 140 },
  { type: 'semiconductor', size: 15, dx: -154, dy: 10, duration: 1250, delay: 260 },
  { type: 'quantumSpinLiquid', size: 15, dx: -51, dy: 18, duration: 1500, delay: 60 },
  { type: 'kondoHeavyFermion', size: 15, dx: 51, dy: 12, duration: 1350, delay: 200 },
  { type: 'chernInsulator', size: 15, dx: 154, dy: 20, duration: 1200, delay: 100 },
  { type: 'ferroelectric', size: 15, dx: 257, dy: 10, duration: 1450, delay: 40 },
  { type: 'multiferroic', size: 15, dx: 360, dy: 16, duration: 1300, delay: 220 },
];
// Front row: fewer and nearer, so bigger than the back row -- and uniform
// within itself, for the reason above. The centre entry is still drawn last,
// so where the row's own bobbing brings two together the middle one passes in
// front.
const NEAR_SHOWCASE: ShowcaseEntry[] = [
  { type: 'classicalMagnet', size: 32, dx: -280, dy: 58, duration: 1150, delay: 260 },
  { type: 'superconductor', size: 32, dx: -140, dy: 54, duration: 1250, delay: 60 },
  { type: 'quantumSpinHall', size: 32, dx: 0, dy: 58, duration: 1100, delay: 0 },
  { type: 'chernSuperconductor', size: 32, dx: 140, dy: 54, duration: 1300, delay: 120 },
  { type: 'fractionalChern', size: 32, dx: 280, dy: 58, duration: 1400, delay: 180 },
];

// The game's actual boot scene (main.ts lists this first) -- also where one
// of the two localStorage save slots (data/save.ts, one per starting mode)
// gets loaded into the Phaser registry, the runtime source of truth every
// later scene reads/writes. Every other scene assumes these registry keys
// already exist, so this load has to happen before any of them can run.
export class TitleScene extends Phaser.Scene {
  // The on-screen content (showcase, title, buttons, mode picker, hint) --
  // torn down and rebuilt by redrawContent() every time the mode picker
  // switches, since the "Continue"/"New Game" label, the "erase save" line,
  // and the mode picker's own highlight all depend on which mode is
  // currently selected.
  private root?: Phaser.GameObjects.Container;
  // The star network's Graphics, redrawn every frame by update() so the
  // finished network twinkles the same way it does in World 10's sky. Lives
  // outside root: the framing elements don't depend on mode/save state, so a
  // mode switch never rebuilds them.
  private starsG?: Phaser.GameObjects.Graphics;
  // Bottom space the map claims (TITLE_MAP's reserveFrac), which
  // redrawContent centers the content stack above rather than into.
  private mapReserve = 0;

  constructor() {
    super('Title');
  }

  create() {
    const registry = this.game.registry;

    // Which mode is preselected the moment the title screen first loads,
    // before the player has touched the mode picker: whichever mode has an
    // existing save if only one of the two does, so a returning player
    // lands directly on their own "Continue" instead of an empty picker.
    // Story Mode is the tiebreak when both or neither have a save yet,
    // since it's the primary progression and Superposition Mode is an
    // explicit testing/exploration extra layered on top of it.
    const storySaved = hasSave(false);
    const superpositionSaved = hasSave(true);
    const initialSuperposition = !storySaved && superpositionSaved;
    this.loadIntoRegistry(initialSuperposition);

    music.play('overworld:1');

    const g = this.add.graphics();
    g.fillGradientStyle(TITLE_SKY, TITLE_SKY, 0x241a44, 0x241a44, 1);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // The star network at the top -- the machine already lurking over the
    // title, before the game has said a word about it. update() below
    // redraws it each frame for the twinkle.
    const stars = TITLE_STARS[TITLE_LAYOUT];
    this.starsG = this.add.graphics();
    this.starsG.setScale(stars.scale);
    this.starsG.setX((CANVAS_W * (1 - stars.scale)) / 2);
    this.starsG.setAlpha(stars.alpha);

    this.addTitleMap();
    this.redrawContent(registry);

    this.input.keyboard!.once('keydown-SPACE', () => this.start());
  }

  update(time: number) {
    if (!this.starsG) return;
    this.starsG.clear();
    drawStarNetwork({ g: this.starsG, world: 10, horizonY: TITLE_STARS[TITLE_LAYOUT].horizonY, target: TITLE_SKY, now: time });
  }

  // The world map at the bottom, built once at create() (it shows all ten
  // worlds regardless of save state, so no mode switch ever needs to rebuild
  // it) and kept beneath root in the display list, so the content stack
  // always draws over it where the two meet.
  private addTitleMap() {
    const cfg = TITLE_MAP[TITLE_LAYOUT];
    const build = buildQumatuomiMap(this, {
      width: cfg.width,
      height: Math.ceil(cfg.width * 0.52),
      discoveredWorlds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    });
    build.container.setAlpha(cfg.alpha);
    if (TITLE_LAYOUT === 'b') {
      build.container.setPosition(CANVAS_W / 2, CANVAS_H / 2 + 30);
    } else {
      build.container.setPosition(CANVAS_W / 2, CANVAS_H - build.height / 2 - 6);
    }
    this.mapReserve = cfg.reserveFrac > 0 ? Math.round(build.height * cfg.reserveFrac) + 12 : 0;
  }

  // Loads one mode's save slot into the registry wholesale -- every field,
  // not just `superpositionMode` -- called both at boot and every time the
  // mode picker switches, so switching modes never leaves the *other*
  // mode's qumatessence/unlockedMoves/playerForm/etc. sitting in the
  // registry under the newly-selected mode's flag (which is exactly the
  // save-mixing bug this two-slot split exists to prevent). The in-progress
  // map snapshot (`mapState`, OverworldScene's SavedMapState) belongs to one
  // run rather than to a save slot, so it is dropped rather than reloaded:
  // whichever run is picked from this screen starts by laying out its own
  // world, not by resuming the corridor the previous one left standing.
  private loadIntoRegistry(superposition: boolean) {
    const save = loadSave(superposition);
    const registry = this.game.registry;
    registry.remove('mapState');
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
    registry.set('worldLoreSeen', save.worldLoreSeen);
    registry.set('superpositionMode', save.superpositionMode);
    registry.set('encounterDensity', save.encounterDensity);
    registry.set('fontScale', save.fontScale);
    registry.set('kondoActiveMove', save.kondoActiveMove);
    registry.set('passivesUnlocked', save.passivesUnlocked);
    registry.set('activePassiveByOwner', save.activePassiveByOwner);
    registry.set('moveClassTuning', save.moveClassTuning);
    registry.set('ultimateClassesUnlocked', save.ultimateClassesUnlocked);
    registry.set('rival9Type', save.rival9Type);
    registry.set('andersonDopant', save.andersonDopant);
    registry.set('musicStyle', save.musicStyle);
    registry.set('difficultyTier', save.difficultyTier);
    registry.set('worldSize', save.worldSize);
    registry.set('touchControls', save.touchControls);
    registry.set('blochUnlockedWorlds', save.blochUnlockedWorlds);
    registry.set('dresselhausUnlockedCrystals', save.dresselhausUnlockedCrystals);
    registry.set('andersonUnlockedHosts', save.andersonUnlockedHosts);
    registry.set('majoranaUnlockedResults', save.majoranaUnlockedResults);
    registry.set('moveLevels', save.moveLevels);
    registry.set('carriedMoveLevels', save.carriedMoveLevels);
    music.setStyle(save.musicStyle);
  }

  // (Re)builds the whole visible screen from the registry's current state,
  // destroying whatever this.root held before -- called at boot and again
  // after every mode-picker switch/erase, so the label, the "erase save"
  // line, and the picker's own highlight always reflect whichever mode is
  // currently loaded rather than a value captured once at create() time.
  // Old children are destroyed explicitly, not left to Container.destroy()
  // (which only detaches its children by default, not destroy()s them), and
  // their tweens are killed first since Phaser doesn't auto-stop a running
  // tween just because its target GameObject is destroyed -- otherwise every
  // mode switch would leak the previous screen's ~14 crystals/buttons and
  // their tweens.
  private redrawContent(registry: Phaser.Data.DataManager) {
    if (this.root) {
      const oldChildren = this.root.list.slice() as Phaser.GameObjects.GameObject[];
      this.tweens.killTweensOf(oldChildren);
      oldChildren.forEach((child) => child.destroy());
      this.root.destroy();
    }

    // Everything below (showcase, title, buttons, mode picker, hint) is laid
    // out top-down in this container's local coordinates first, then the
    // container itself is offset so the *whole composition* centers
    // vertically in the canvas -- the same measure-then-center pattern
    // confirmNewGame below uses for its own popup, needed here because the
    // title's own line count (and whether the "erase save" line is present)
    // depends on the Settings panel's text-size setting and the save state,
    // so the total height isn't a fixed number to hand-center against.
    const root = this.add.container(0, 0);
    this.root = root;

    let y = this.drawShowcaseCrystals(root, 8);

    // Font size is capped at the "Normal" (1.5x) text-size preset rather
    // than scaling all the way to "Large" (2x) like most of this screen's
    // other text -- at an uncapped 2x this line would wrap to two lines and
    // roughly double its own height, which the mode picker and hint below
    // don't have the spare vertical room to absorb (same reasoning
    // OverworldScene's own fixed-geometry text applies via
    // `Math.min(fontScale(this), 1.5)`).
    const titleScale = Math.min(fontScale(this), 1.5);
    const title = this.add
      .text(CANVAS_W / 2, y, 'WORLD OF QUANTUM MATERIALS', {
        fontSize: `${Math.round(30 * titleScale)}px`,
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: CANVAS_W - 40 },
      })
      .setOrigin(0.5, 0);
    root.add(title);
    y = title.y + title.height + 14;

    const superposition = !!registry.get('superpositionMode');
    const existingSave = hasSave(superposition);
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
    root.add(startButton);
    this.tweens.add({ targets: startButton, alpha: { from: 0.7, to: 1 }, duration: 700, yoyo: true, repeat: -1 });
    y += startButton.height + 8;

    // A save already exists for the currently selected mode, so "Continue"
    // above resumes it -- this is the only path to actually start over,
    // since there is otherwise no way to discard progress once a save has
    // been written once.
    if (existingSave) {
      const erase = this.add
        .text(CANVAS_W / 2, y, 'New Game (erase save)', {
          fontSize: fontPx(this, 12),
          color: '#ff8fa0',
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.confirmNewGame());
      root.add(erase);
      y += erase.height + 6;
    }

    // Mode picker before the SPACE hint, not after -- it's an actual
    // control (vs. the hint's passive reminder), so it's the one that should
    // stay on-screen if a big text-size setting plus the extra "erase save"
    // line (a returning player only) leaves no room for both above the fold.
    y = this.addModeSelector(root, registry, y);
    y += 6;

    const hint = this.add
      .text(CANVAS_W / 2, y, 'Press SPACE or click Continue to begin', {
        fontSize: fontPx(this, 12),
        color: REFERENCE_BLUE_GREY_HEX,
      })
      .setOrigin(0.5, 0);
    root.add(hint);
    y += hint.height;

    // Centered in the space left between what the constellation claims at the
    // top and what the map claims at the bottom (either can be zero, for a
    // framing element the stack is allowed to overlap). Clamped so a tall
    // stack -- an existing save's erase line at the Large text preset -- runs
    // off neither end rather than being centered off the bottom of the screen.
    const stars = TITLE_STARS[TITLE_LAYOUT];
    const centered = stars.topReserve + Math.round((CANVAS_H - stars.topReserve - this.mapReserve - y) / 2);
    root.y = Phaser.Math.Clamp(centered, 6, Math.max(6, CANVAS_H - y - 6));
  }

  // "New Game (erase save)" is destructive and irreversible (localStorage,
  // no undo), so it goes through an inline yes/no confirm rather than
  // wiping on a single click. Erases only the currently selected mode's own
  // save slot, never both. Content laid out top-down first (running `y`,
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
        // Reload (rather than this.scene.restart()) so the picker stays on
        // the mode the player was just looking at -- a restart would rerun
        // create()'s own initial-mode tiebreak, which could flip the picker
        // to the *other* mode if that one happens to still have a save,
        // right after the player asked to erase this one.
        const registry = this.game.registry;
        const superposition = !!registry.get('superpositionMode');
        clearSave(superposition);
        container.destroy();
        this.loadIntoRegistry(superposition);
        this.redrawContent(registry);
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
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.96)
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
  // two buttons, and each button's own caption line), for the caller's
  // running `y`.
  private addModeSelector(root: Phaser.GameObjects.Container, registry: Phaser.Data.DataManager, y: number): number {
    const heading = this.add
      .text(CANVAS_W / 2, y, 'Choose your mode:', {
        fontSize: fontPx(this, 12),
        color: '#cfd8ff',
      })
      .setOrigin(0.5, 0);
    root.add(heading);
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
    root.add(storyBtn);
    root.add(superBtn);

    const refresh = () => {
      const superposition = isSuperposition();
      storyBtn.setColor(superposition ? REFERENCE_BLUE_GREY_HEX : '#ffff88').setBackgroundColor(superposition ? '#1a1a2e' : '#33335a');
      superBtn.setColor(superposition ? '#ff8fa0' : REFERENCE_BLUE_GREY_HEX).setBackgroundColor(superposition ? '#33335a' : '#1a1a2e');
    };
    refresh();

    // A noticeably wider gap than the two buttons' own internal padding
    // (unlike the old 12px gap, which read as one combined control) so each
    // button plus its own caption below it reads as its own self-contained
    // choice rather than two options crammed together.
    const gap = 50;
    const totalW = storyBtn.width + superBtn.width + gap;
    storyBtn.setX(CANVAS_W / 2 - totalW / 2 + storyBtn.width / 2);
    superBtn.setX(CANVAS_W / 2 + totalW / 2 - superBtn.width / 2);

    // Switching modes reloads that mode's own save slot wholesale (see
    // loadIntoRegistry) and rebuilds the whole screen from it, rather than
    // just flipping the `superpositionMode` flag in place -- otherwise the
    // registry would still be carrying the *other* mode's qumatessence/
    // unlockedMoves/playerForm/etc. under the newly-selected mode's flag.
    // Deliberately doesn't call persistFromRegistry() here (unlike this
    // control's other write sites elsewhere in the game): nothing has
    // actually changed yet for a mode with no save of its own, so writing
    // here would create a save file -- and show "Continue" plus an "erase
    // save" line -- for a slot the player has never actually played.
    // Real progress in the newly-selected mode persists itself the moment
    // it happens, via the same ~40 persistFromRegistry() call sites every
    // other scene already uses.
    storyBtn.on('pointerdown', () => {
      if (!isSuperposition()) return;
      this.loadIntoRegistry(false);
      this.redrawContent(registry);
    });
    superBtn.on('pointerdown', () => {
      if (isSuperposition()) return;
      this.loadIntoRegistry(true);
      this.redrawContent(registry);
    });
    y += Math.max(storyBtn.height, superBtn.height) + 4;

    // Each caption sits under its own button rather than centered under the
    // pair, and wraps to a width derived from how far apart the two buttons
    // actually landed (not a fixed constant) so the two caption boxes never
    // meet in the middle regardless of text-size preset or how wide
    // "Superposition Mode" itself renders.
    const captionScale = Math.min(fontScale(this), 1.5);
    const captionWrap = Math.max(140, superBtn.x - storyBtn.x - 40);
    const storyCaption = this.add
      .text(storyBtn.x, y, 'Trace the Decoherence.', {
        fontSize: `${Math.round(10 * captionScale)}px`,
        color: '#6f7ea8',
        align: 'center',
        wordWrap: { width: captionWrap },
      })
      .setOrigin(0.5, 0);
    const superCaption = this.add
      .text(superBtn.x, y, 'Everything, unlocked.', {
        fontSize: `${Math.round(10 * captionScale)}px`,
        color: '#6f7ea8',
        align: 'center',
        wordWrap: { width: captionWrap },
      })
      .setOrigin(0.5, 0);
    root.add(storyCaption);
    root.add(superCaption);
    y += Math.max(storyCaption.height, superCaption.height);

    return y;
  }

  // Draws both showcase rows (FAR_SHOWCASE/NEAR_SHOWCASE above) into `root`,
  // each crystal bobbing on its own independent duration/delay so the whole
  // roster reads as alive rather than a single synchronized animation.
  // Returns the y position just past the showcase, for the caller's running
  // `y`.
  private drawShowcaseCrystals(root: Phaser.GameObjects.Container, topY: number): number {
    const centerX = CANVAS_W / 2;
    let maxBottom = topY;
    [...FAR_SHOWCASE, ...NEAR_SHOWCASE].forEach((entry) => {
      const look = TYPE_LOOK[entry.type];
      const crystal = makeCrystal(this, entry.size, look.color, look.variant);
      const entryY = topY + entry.dy;
      crystal.setPosition(centerX + entry.dx, entryY);
      root.add(crystal);
      this.tweens.add({
        targets: crystal,
        y: entryY - 10,
        duration: entry.duration,
        delay: entry.delay,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      maxBottom = Math.max(maxBottom, entryY + entry.size * 0.9);
    });
    return maxBottom + 12;
  }

  private start() {
    this.scene.start('Hub');
  }
}
