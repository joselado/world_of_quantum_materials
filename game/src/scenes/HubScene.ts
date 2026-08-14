import Phaser from 'phaser';
import { makeCrystal } from '../art/crystals';
import { CANVAS_W, CANVAS_H } from '../art/perspective';
import { getPlayerMaterial, allCrystals, TYPE_LOOK, materialDisplayName, materialTypeLabel } from '../data/materials';
import { wildHpForWorld } from '../data/balance';
import { materialBlurb } from '../data/materialdex';
import { persistFromRegistry } from '../data/save';
import type { DiscoveredMaterial } from '../data/save';
import type { Material, MaterialType } from '../data/types';
import { TUTORIAL_TIPS, hasSeenTip, markTipSeen } from '../data/tutorial';
import { music } from '../audio/music';
import { fontPx, fontScale } from '../ui/text';
import { PANEL_BG, GOLD_ACCENT_HEX, REFERENCE_BLUE_GREY_HEX } from '../ui/theme';
import { BUILT_WORLDS, OverworldScene, applySuperpositionUnlocks } from './OverworldScene';
import type { GuardianPanelHost, GuardianRosterEntry } from './OverworldScene';
import { LAB_TITLE_COLOR, LAB_STATIONS } from './panels/hubStations';
import { LIST_DETAIL_PANEL_W, listDetailColumns, renderListColumn, insertColumnDivider } from './panels/listDetail';
import { makeQumatexMotif } from '../art/labMotifs';
import { stopMoveEffectPreview } from '../art/moveEffectPreview';

// World 0, "The Lab" (DESIGN.md's world table) -- boot destination from
// TitleScene and the return point from Overworld (press H or Enter). Unlike
// the numbered worlds it isn't a walkable procedural map: it's a single
// static room with up to eight stations -- Qumatex and the door onward,
// which always exist, plus six reference/settings stations (Moves, Stats,
// Abilities, Guardians, Tutorial, Settings, built in
// scenes/panels/hubStations.ts's `LAB_STATIONS`) -- since none of the hub's
// jobs need overworld movement or wild encounters of their own, and none of
// those six stations' own content is tied to being mid-world. Abilities and
// Guardians only actually appear once the player has learned a first
// passive or met a first guardian (`LAB_STATIONS`' own `visible` checks) --
// a fresh save has nothing to check or revisit there yet. Progress
// autosaves silently after every meaningful state change (data/save.ts's
// `persistFromRegistry`), so the room has no manual save station of its own.

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
const STATION_MOTIF_SIZE = 26;
const STATION_MOTIF_GAP = 9;

// The guardian gallery: every guardian the player has met stands in the room
// as their own avatar (spawnGuardianAvatars), five per cluster in the two
// upper corners, each cluster stacked one-over-two-over-two. Slots are keyed
// to the guardian's own world (worlds 1-5 fill the left cluster top-down,
// 6-10 the right), so a guardian never moves between visits as the roster
// grows -- an unmet guardian simply leaves their slot empty, and the corners
// fill in as the player progresses. The corners are the only part of the wall
// wide enough for this: the room's quote sits between them, the instrument
// panels and the player's own crystal hold the middle, and the counter below
// `GUARDIAN_ROW_TOP + 2 * GUARDIAN_ROW_PITCH` is where the station rows start.
const GUARDIAN_SLOT_W = 88;
const GUARDIAN_SLOT_H = 64;
const GUARDIAN_ROW_PITCH = 68;
const GUARDIAN_ROW_TOP = 96;
const GUARDIAN_CLUSTER_CX = 96;
const GUARDIAN_AVATAR_SCALE = 0.45;
// Where the short name sits relative to the avatar's own origin (its chest),
// and where the slot's click plate is centered between the two.
const GUARDIAN_LABEL_DROP = 22;
const GUARDIAN_LABEL_BASE_PX = 9;
const GUARDIAN_LABEL_MIN_PX = 9;
const GUARDIAN_PLATE_DROP = 6;
// The click plate is invisible at rest and a faint wash under the pointer.
// Never fully transparent: a Phaser game object with alpha 0 stops rendering,
// and an unrendered object is skipped by hit-testing too, which would make
// every avatar a dead click target.
const GUARDIAN_PLATE_REST_ALPHA = 0.001;
const GUARDIAN_PLATE_HOVER_ALPHA = 0.14;

export class HubScene extends Phaser.Scene implements GuardianPanelHost {
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
  // The hover readout floating under whichever guardian avatar the pointer is
  // currently over (spawnGuardianAvatars), destroyed the moment it leaves --
  // at most one exists at a time.
  private guardianTooltip?: Phaser.GameObjects.Container;
  // Same shape as materialdexSelectedName above, for the
  // Tutorial station's own list+detail panel (scenes/panels/hubStations.ts's
  // showTutorialTopics) -- also Lab-only. `tutorialPage` is which page of
  // the topic list is showing; `tutorialSelectedIndex` is the previewed
  // topic's own index into data/tutorial.ts's TUTORIAL_PAGES, stable across
  // a page flip the same way materialdexSelectedName survives a type-filter
  // change.
  tutorialPage = 0;
  tutorialSelectedIndex = 0;

  // GuardianPanelHost implementation (see OverworldScene.ts's GuardianPanelHost
  // and CODEMAP.md's "Guardian panels") -- lets any guardian's own panel
  // (shop/teleport hub/transmutation) render directly in the Lab, opened from
  // the Guardians station, with no scene transition. `world` is fixed at 0
  // (World 0, the Lab itself, is never a BUILT_WORLDS entry) so Bloch's own
  // "exclude the world I'm currently in" destination filter excludes nothing
  // here, listing every visited world instead. `qumatessence`/`playerMaterial`
  // mirror the registry the same way `OverworldScene.create()` does, kept in
  // sync by the same guardian-panel code paths (buy/spend, transmute/fuse)
  // that already write straight through to the registry.
  world = 0;
  dialogueActive = false;
  qumatessence = 0;
  playerMaterial!: Material;
  tokenText!: Phaser.GameObjects.Text;
  shopTab: 'moves' | 'stats' = 'moves';
  blochPage = 0;
  dresselhausPage = 0;
  majoranaPage = 0;
  andersonPage = 0;
  andersonSelection: string | null = null;
  andersonMovePage = 0;
  feynmanPage = 0;
  dresselhausPreview: string | null = null;
  andersonHostPreview: string | null = null;
  majoranaPreview: string | null = null;
  noetherMovePreview: string | null = null;
  noetherMovePage = 0;
  kondoMovePreview: string | null = null;
  kondoMovePage = 0;
  // Same reset rules as dresselhausPreview/majoranaPreview above -- see
  // GuardianPanelHost's own comment on this field.
  blochPreview: number | null = null;
  // The room's one floating crystal preview (STYLE.md's "the only crystal
  // render drawn anywhere in the room itself") -- `playerPreview` is the
  // stable tween target (the continuous bob), `playerCrystalGfx` the
  // swappable inner render `applyPlayerForm` destroys/rebuilds after a
  // guardian panel transmutes or fuses the player's crystal, mirroring
  // OverworldScene's own player/playerCrystalGfx split.
  private playerPreview!: Phaser.GameObjects.Container;
  private playerCrystalGfx!: Phaser.GameObjects.Container;

  constructor() {
    super('Hub');
  }

  create() {
    // Applied before `playerMaterial` is read a few lines down (and before
    // any guardian panel can open from this scene) -- Superposition Mode
    // stands every guardian's avatar in the room regardless of
    // `metGuardians`, so a save that has never yet stepped through a world
    // door still needs this same blanket "already unlocked" grant
    // OverworldScene.applySuperpositionLeveling applies on world entry -- see
    // applySuperpositionUnlocks's own comment.
    applySuperpositionUnlocks(this.game.registry);
    this.guardianTooltip = undefined;
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
        // Wrapped narrow enough to stay clear of the guardian clusters
        // standing in the two upper corners (spawnGuardianAvatars).
        { fontSize: fontPx(this, 12), fontStyle: 'italic', color: '#cfd8ff', align: 'center', wordWrap: { width: 420 } }
      )
      .setOrigin(0.5, 0);

    // Corner readout, same top-right placement/look as OverworldScene's own
    // qumatessence HUD -- a guardian's shop panel (Noether/Laughlin/Majorana/
    // Anderson/Kondo/Feynman/Skłodowska-Curie/Bloch's per-destination unlock)
    // can now open and spend directly from the Lab, so the balance it reads
    // and deducts from needs to be visible here too, not just mid-world.
    this.qumatessence = (this.game.registry.get('qumatessence') as number) || 0;
    this.tokenText = this.add
      .text(CANVAS_W - 8, 8, `Qumatessence: ${this.qumatessence}`, {
        fontSize: fontPx(this, 14),
        color: GOLD_ACCENT_HEX,
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(1, 0)
      .setDepth(50);

    this.playerMaterial = getPlayerMaterial(this.game.registry);
    this.playerPreview = this.add.container(CANVAS_W / 2, 230);
    this.playerCrystalGfx = makeCrystal(this, 46, this.playerMaterial.color, this.playerMaterial.variant, {
      seed: this.playerMaterial.name,
      hybrid: this.playerMaterial.hybridParents,
    });
    this.playerPreview.add(this.playerCrystalGfx);
    this.tweens.add({ targets: this.playerPreview, y: 220, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.spawnGuardianAvatars();

    // Margin is a fraction of CANVAS_W, not a flat pixel count, so the three
    // station columns stay proportionally inset from the walls at any canvas
    // width. Rounded so a station's motif+label pair lands on whole pixels.
    const stationMargin = Math.round(CANVAS_W * 0.18);
    const stationX = [stationMargin, CANVAS_W / 2, CANVAS_W - stationMargin];

    // Every station in the room -- Qumatex and the door (which always
    // exist), then the reference/settings stations (scenes/panels/
    // hubStations.ts's LAB_STATIONS) filtered down to whichever the player
    // has actually unlocked, Abilities needing a first passive learned
    // (LAB_STATIONS' own `visible` checks) --
    // packed together into one grid of rows of three with no gaps, rather
    // than reserving a fixed grid slot for a station that isn't visible yet
    // or special-casing Qumatex/the door into their own row. Qumatex carries
    // its own small crystal-grid motif (`makeQumatexMotif`) beside its
    // label, same as every reference/settings station below -- the door has
    // no `art/labMotifs.ts` builder of its own, plain text being enough to
    // read as an exit.
    const stations: { label: string; onClick: () => void; motif?: (scene: Phaser.Scene, size: number) => Phaser.GameObjects.Container }[] = [
      { label: 'Qumatex', onClick: () => this.showMaterialdex(), motif: makeQumatexMotif },
      { label: this.doorLabel(), onClick: () => this.enterWorld() },
      ...LAB_STATIONS.filter((station) => station.visible(this)).map((station) => ({
        label: station.label,
        onClick: () => station.onClick(this),
        motif: station.motif,
      })),
    ];
    let y = 300;
    for (let i = 0; i < stations.length; i += 3) {
      const rowStations = stations.slice(i, i + 3);
      let rowHeight = 0;
      rowStations.forEach((station, col) => {
        const btn = this.addStationRow(stationX[col], y, station.label, station.onClick, station.motif);
        rowHeight = Math.max(rowHeight, btn.height);
      });
      y += rowHeight + 8;
    }

    // Reverse direction of OverworldScene's own keydown-ENTER (which sends
    // the player *to* the Hub, always via returnToHub()'s saveMapState()) --
    // pressing Enter while standing in the Lab sends them back *out*, to
    // exactly the world and position they left (resumeWorld() above), not
    // necessarily the door station's own frontier-world target -- so opening
    // and closing the Lab from *any* world (not just the player's furthest
    // one) always lands them back exactly where they were. Same one-panel-
    // at-a-time guard the door station's own click handler uses. A fresh
    // save with nothing in progress yet (no resumable `mapState`) leaves
    // Enter a no-op here, same as before.
    this.input.keyboard!.on('keydown-ENTER', () => {
      if (this.dialogueContainer) return;
      const world = this.resumeWorld();
      if (world === undefined) return;
      this.scene.start('Overworld', { world, regenerate: false });
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

  // Where the guardian of world `world` stands: worlds 1-5 fill the left
  // cluster, 6-10 the right, each cluster read top-down as one avatar over a
  // pair over a pair. A guardian's slot is fixed by their world, so it never
  // shifts as other guardians are met.
  private guardianSlot(world: number): { x: number; y: number } {
    const index = (world - 1) % 5;
    const row = index === 0 ? 0 : index <= 2 ? 1 : 2;
    const centerX = world <= 5 ? GUARDIAN_CLUSTER_CX : CANVAS_W - GUARDIAN_CLUSTER_CX;
    const x = row === 0 ? centerX : centerX + ((index - 1) % 2 === 0 ? -GUARDIAN_SLOT_W / 2 : GUARDIAN_SLOT_W / 2);
    return { x, y: GUARDIAN_ROW_TOP + row * GUARDIAN_ROW_PITCH };
  }

  // The Lab's guardian gallery: every guardian the player has met (every
  // guardian at all in Superposition Mode) stands in the room as their own
  // avatar -- the same `art/<guardian>.ts` builder their overworld sprite and
  // their panel's own header use -- and clicking one opens that guardian's
  // panel directly, with no roster list in between. An unmet guardian leaves
  // their slot empty (guardianSlot), so the corners fill in as the player
  // works through the worlds.
  private spawnGuardianAvatars() {
    const met = (this.game.registry.get('metGuardians') as string[]) ?? [];
    const superposition = this.isSuperpositionMode();

    for (const guardian of OverworldScene.guardianRoster()) {
      if (!superposition && !met.includes(guardian.id)) continue;
      const slot = this.guardianSlot(guardian.world);

      // The whole slot -- avatar plus label -- is one click target. It lives
      // on a plain rectangle rather than on the avatar container itself
      // because a Phaser Container has no hit area of its own, so making one
      // interactive without an explicit geometry is exactly the dead target
      // this is meant to avoid.
      const plate = this.add
        .rectangle(slot.x, slot.y + GUARDIAN_PLATE_DROP, GUARDIAN_SLOT_W - 4, GUARDIAN_SLOT_H, 0x8fa0ff, GUARDIAN_PLATE_REST_ALPHA)
        .setInteractive({ useHandCursor: true });

      const avatar = guardian.avatar(this, GUARDIAN_AVATAR_SCALE);
      avatar.setPosition(slot.x, slot.y);

      const label = this.add
        .text(slot.x, slot.y + GUARDIAN_LABEL_DROP, guardian.shortName, {
          fontSize: fontPx(this, GUARDIAN_LABEL_BASE_PX),
          color: REFERENCE_BLUE_GREY_HEX,
        })
        .setOrigin(0.5, 0);
      // A long surname is stepped down in whole pixels until it fits its own
      // slot rather than wrapped or trimmed, so neighbouring slots' labels
      // never touch. Stepped on the *rendered* size rather than the base one,
      // since the same base px is 1.5x wider at the Large text-size preset --
      // the widest name only fits every preset at the floor.
      let labelPx = Math.round(GUARDIAN_LABEL_BASE_PX * fontScale(this));
      while (label.width > GUARDIAN_SLOT_W - 6 && labelPx > GUARDIAN_LABEL_MIN_PX) {
        labelPx -= 1;
        label.setFontSize(`${labelPx}px`);
      }

      plate.on('pointerover', () => {
        plate.setFillStyle(0x8fa0ff, GUARDIAN_PLATE_HOVER_ALPHA);
        label.setColor(guardian.labelColor);
        avatar.setScale(1.12);
        this.showGuardianTooltip(guardian, slot);
      });
      plate.on('pointerout', () => {
        plate.setFillStyle(0x8fa0ff, GUARDIAN_PLATE_REST_ALPHA);
        label.setColor(REFERENCE_BLUE_GREY_HEX);
        avatar.setScale(1);
        this.hideGuardianTooltip();
      });
      plate.on('pointerdown', () => {
        // Same one-panel-at-a-time guard every station click uses.
        if (this.dialogueContainer) return;
        this.hideGuardianTooltip();
        guardian.open?.(this);
      });
    }
  }

  // Full name plus the one-line "what they teach" blurb, floating just under
  // the hovered avatar and clamped to stay on canvas -- the room itself only
  // has width for a surname, so this is where a guardian says what they
  // actually offer before the player commits a click to finding out.
  private showGuardianTooltip(guardian: GuardianRosterEntry, slot: { x: number; y: number }) {
    this.hideGuardianTooltip();

    const width = 200;
    const padding = 6;
    const container = this.add.container(0, 0).setDepth(60);
    this.guardianTooltip = container;

    const name = this.add
      .text(0, 0, guardian.name, { fontSize: fontPx(this, 10), color: guardian.labelColor, fontStyle: 'bold', wordWrap: { width: width - padding * 2 } })
      .setOrigin(0.5, 0);
    const blurb = this.add
      .text(0, 0, guardian.blurb, { fontSize: fontPx(this, 9), color: '#cfd8ff', align: 'center', wordWrap: { width: width - padding * 2 } })
      .setOrigin(0.5, 0);

    const height = name.height + 3 + blurb.height + padding * 2;
    const centerX = Phaser.Math.Clamp(slot.x, width / 2 + 4, CANVAS_W - width / 2 - 4);
    const below = slot.y + GUARDIAN_LABEL_DROP + 18;
    // Flips above the avatar rather than running off the bottom of the room.
    const top = below + height > CANVAS_H - 6 ? slot.y - 34 - height : below;

    const bg = this.add.rectangle(centerX, top + height / 2, width, height, PANEL_BG, 0.95).setStrokeStyle(1, 0x8fa0c9);
    name.setPosition(centerX, top + padding);
    blurb.setPosition(centerX, top + padding + name.height + 3);
    container.add([bg, name, blurb]);
  }

  private hideGuardianTooltip() {
    this.guardianTooltip?.destroy(true);
    this.guardianTooltip = undefined;
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

  // Public, not private -- part of GuardianPanelHost (see the class-level
  // comment above), read by guardian panel files the same way they read
  // OverworldScene's own copy.
  isSuperpositionMode(): boolean {
    return !!this.game.registry.get('superpositionMode');
  }

  // Whether stepping through the door into `world` actually resumes the
  // player's in-progress position there rather than generating a fresh map.
  // `visitedWorlds` alone isn't enough to promise that -- it's part of the
  // persisted save (data/save.ts), but the map snapshot it would resume from
  // (OverworldScene's `mapState` registry key, written by its own
  // saveMapState()/returnToHub()) is deliberately registry-only and does not
  // survive a page reload -- so this checks both, the same two facts
  // OverworldScene.create() itself checks (`saved.world === this.world &&
  // !this.regenerate`) before deciding whether to restoreMap() or
  // generateMap(). Shared by doorLabel()/enterWorld() (both keyed on
  // `highestUnlockedWorld()`, the door's own frontier-world affordance) and
  // resumeWorld() below (keyed on whatever world `mapState` actually holds,
  // the Enter *key*'s own "go back to exactly where I was" affordance) --
  // see resumeWorld()'s own comment for why those two aren't the same thing.
  // Superposition Mode resumes in place through both of them too, same as
  // Story Mode -- it pre-seeds `visitedWorlds` with all of BUILT_WORLDS (see
  // OverworldScene.create), so this reduces to just the `mapState` check.
  private canResumeWorld(world: number): boolean {
    const visited = (this.game.registry.get('visitedWorlds') as number[]) ?? [];
    if (!visited.includes(world)) return false;
    const mapState = this.game.registry.get('mapState') as { world: number } | undefined;
    return mapState?.world === world;
  }

  // Superposition Mode has no fixed frontier world to fall back on the way
  // Story Mode's `highestUnlockedWorld()` does (every world unlocks at once),
  // so its own affordance is "back to wherever I was" (resumeWorld() below),
  // falling back to a fresh World 1 only when there's genuinely nowhere to
  // resume yet -- a fresh save that has never left the Lab in this mode.
  private doorLabel(): string {
    if (this.isSuperpositionMode()) {
      const world = this.resumeWorld();
      return world !== undefined ? `Back to World ${world}` : 'Enter World 1';
    }
    const world = this.highestUnlockedWorld();
    return this.canResumeWorld(world) ? `Back to World ${world}` : `Enter World ${world}`;
  }

  // The door station's own affordance: in Story Mode, always the player's
  // frontier world (`highestUnlockedWorld()`), resuming in place there if
  // it's genuinely in progress or generating a fresh map otherwise -- "take
  // me to my furthest world." Superposition Mode has no such frontier, so it
  // mirrors resumeWorld()'s own "take me back to exactly where I was"
  // instead, only falling back to a fresh World 1 when there's nothing to
  // resume.
  private enterWorld() {
    if (this.isSuperpositionMode()) {
      const world = this.resumeWorld();
      this.scene.start('Overworld', { world: world ?? 1, regenerate: world === undefined });
      return;
    }
    const world = this.highestUnlockedWorld();
    this.scene.start('Overworld', { world, regenerate: !this.canResumeWorld(world) });
  }

  // The world (and, via canResumeWorld's own mapState check, exact
  // position) the player actually left from when OverworldScene's own
  // keydown-ENTER sent them here (returnToHub -- always saveMapState()
  // first) -- not necessarily their highest-unlocked world. A player who
  // opens the Lab from an earlier world (Bloch's teleport hub, or walking
  // back through an earlier world's own door, both of which land somewhere
  // other than the frontier) needs the Enter key to hand them back that
  // exact world, not `highestUnlockedWorld()` -- using the door's own
  // frontier-world target here would silently generate a fresh map on a
  // world the player never actually chose to (re)start. Undefined only when
  // there's genuinely nowhere to return to: a fresh save that has never left
  // the Lab, or (mapState being registry-only) after a page reload.
  private resumeWorld(): number | undefined {
    const mapState = this.game.registry.get('mapState') as { world: number } | undefined;
    return mapState && this.canResumeWorld(mapState.world) ? mapState.world : undefined;
  }

  // GuardianPanelHost state accessors -- identical bodies to OverworldScene's
  // own (both just read the registry), duplicated rather than shared per
  // CODEMAP.md's "Guardian panels" tradeoff.
  getUnlockedMoves(): string[] {
    return (this.game.registry.get('unlockedMoves') as string[]) ?? [];
  }

  getVisitedWorlds(): number[] {
    return (this.game.registry.get('visitedWorlds') as number[]) ?? [];
  }

  getDefeatedMaterials(): DiscoveredMaterial[] {
    return (this.game.registry.get('defeatedMaterials') as DiscoveredMaterial[]) ?? [];
  }

  // Bloch's own explicit travel action (his destination rows) -- the one
  // deliberate way a guardian panel can move the player, whether opened by
  // walking up to Bloch mid-world or from the Lab's Guardians station. Always
  // a fresh map (`regenerate: true`), matching OverworldScene's own
  // `advanceToWorld` -- picking a destination is a genuine, first-class trip
  // there, not a "resume" the way the Hub door's own `enterWorld` is.
  advanceToWorld(world: number, enterFrom: 'start' | 'goal' = 'start') {
    this.closeDialogue();
    this.scene.start('Overworld', { world, regenerate: true, enterFrom });
  }

  // Sets the player's current crystal form and persists it -- HubScene's
  // counterpart to OverworldScene.applyPlayerForm, called by the same
  // Dresselhaus/Majorana panel code (transmuteInto/becomeHybrid) regardless
  // of which scene's Guardians station opened them. Redraws the Lab's own
  // floating crystal preview in place rather than an overworld sprite; skips
  // OverworldScene.applyPlayerForm's World 10 map-regeneration branch since
  // the Lab is never World 10. HP is never intrinsic to a crystal form (see
  // that function's own comment) -- capped by `wildHpForWorld` for whichever
  // world the player will actually land in when they next leave the Lab,
  // mirroring enterWorld()'s own mode branching exactly (Story Mode always
  // goes to the frontier `highestUnlockedWorld()`, not wherever `mapState`
  // happens to hold; only Superposition Mode -- which has no frontier --
  // resumes via `resumeWorld()`) so a player who transmutes after Bloch-
  // teleporting or walking back to an earlier world doesn't get an HP cap
  // for a world the door won't actually take them to.
  applyPlayerForm(material: Material) {
    this.game.registry.set('playerForm', material);
    const world = this.isSuperpositionMode() ? this.resumeWorld() ?? 1 : this.highestUnlockedWorld();
    const worldMaxHp = wildHpForWorld(world);
    const clampedHp = Math.min((this.game.registry.get('playerHp') as number) ?? worldMaxHp, worldMaxHp);
    this.game.registry.set('playerHp', clampedHp);
    persistFromRegistry(this.game.registry);

    this.playerMaterial = material;
    this.playerCrystalGfx.destroy();
    this.playerCrystalGfx = makeCrystal(this, 46, material.color, material.variant, {
      seed: material.name,
      hybrid: material.hybridParents,
    });
    this.playerPreview.add(this.playerCrystalGfx);
  }

  // Farewell-only footer (no Face-the-Rival/Continue action) -- every
  // guardian panel but the rival gate's own showGatePanel (OverworldScene-only,
  // never opened from the Lab) uses this, so it's the only footer variant
  // GuardianPanelHost needs to provide.
  renderFarewellFooter(container: Phaser.GameObjects.Container, footerY: number): number {
    const btn = this.addDialogueButtonAt(container, CANVAS_W / 2, footerY, 'Farewell', () => this.closeDialogue(), 260);
    return footerY + btn.height;
  }

  // See OverworldScene.renderCancelFarewellFooter for the rationale --
  // duplicated rather than shared, same tradeoff as every other cross-cutting
  // dialogue helper both GuardianPanelHost implementers provide.
  renderCancelFarewellFooter(
    container: Phaser.GameObjects.Container,
    footerY: number,
    cancelLabel: string,
    onCancel: () => void
  ): number {
    const a = this.addDialogueButtonAt(container, CANVAS_W / 2 - 118, footerY, cancelLabel, onCancel, 210);
    const b = this.addDialogueButtonAt(container, CANVAS_W / 2 + 118, footerY, 'Farewell', () => this.closeDialogue(), 210);
    return footerY + Math.max(a.height, b.height);
  }

  addDialogueButton(container: Phaser.GameObjects.Container, y: number, label: string, onClick: () => void) {
    return this.addDialogueButtonAt(container, CANVAS_W / 2, y, label, onClick, 480);
  }

  // Shared pager for candidate-crystal lists -- identical to OverworldScene's
  // own renderPagedButtons (see that method's own comment for the
  // measure-real-row-height-and-pack rationale), duplicated per
  // CODEMAP.md's "Guardian panels" tradeoff rather than shared.
  renderPagedButtons<T extends { name: string }>(
    container: Phaser.GameObjects.Container,
    y: number,
    items: T[],
    page: number,
    maxPerPage: number,
    labelFor: (item: T) => string,
    onPick: (item: T) => void,
    onPageChange: (page: number) => void,
    isDim?: (item: T) => boolean
  ): number {
    const sample = this.add.text(-1000, -1000, 'Sample', { fontSize: fontPx(this, 13), padding: { x: 10, y: 5 } });
    const rowH = sample.height + 6;
    sample.destroy();
    const reservedTail = rowH * 2;
    const reservedControls = rowH;

    const measureRowHeight = (label: string) => {
      const t = this.add.text(-2000, -2000, label, {
        fontSize: fontPx(this, 13),
        padding: { x: 10, y: 5 },
        align: 'center',
        wordWrap: { width: 480 },
      });
      const h = t.height + 6;
      t.destroy();
      return h;
    };
    const rowHeights = items.map((item) => measureRowHeight(labelFor(item)));
    const pack = (available: number): T[][] => {
      const result: T[][] = [];
      let current: T[] = [];
      let used = 0;
      items.forEach((item, i) => {
        const h = rowHeights[i];
        if (current.length > 0 && (current.length >= maxPerPage || used + h > available)) {
          result.push(current);
          current = [];
          used = 0;
        }
        current.push(item);
        used += h;
      });
      result.push(current);
      return result;
    };
    const withoutControls = pack(CANVAS_H - y - reservedTail);
    const pages = withoutControls.length <= 1 ? withoutControls : pack(CANVAS_H - y - reservedTail - reservedControls);

    const totalPages = pages.length;
    const clampedPage = Phaser.Math.Clamp(page, 0, totalPages - 1);
    const pageItems = pages[clampedPage];
    pageItems.forEach((item) => {
      const btn = this.addDialogueButton(container, y, labelFor(item), () => onPick(item));
      if (isDim?.(item)) btn.setAlpha(0.5);
      y += btn.height + 6;
    });
    if (totalPages > 1) {
      const prev = this.addDialogueButtonAt(
        container,
        CANVAS_W / 2 - 170,
        y,
        '<- Prev',
        () => {
          if (clampedPage > 0) onPageChange(clampedPage - 1);
        },
        120
      );
      if (clampedPage === 0) prev.setAlpha(0.35);
      const next = this.addDialogueButtonAt(
        container,
        CANVAS_W / 2 + 170,
        y,
        'Next ->',
        () => {
          if (clampedPage < totalPages - 1) onPageChange(clampedPage + 1);
        },
        120
      );
      if (clampedPage === totalPages - 1) next.setAlpha(0.35);
      const controlsRowH = Math.max(prev.height, next.height);
      const pageLabel = this.add
        .text(CANVAS_W / 2, y, `Page ${clampedPage + 1}/${totalPages}`, { fontSize: fontPx(this, 11), color: REFERENCE_BLUE_GREY_HEX })
        .setOrigin(0.5, 0);
      pageLabel.setY(y + (controlsRowH - pageLabel.height) / 2);
      container.add(pageLabel);
      y += controlsRowH + 6;
    }
    return y;
  }

  private addButton(x: number, y: number, label: string, onClick: () => void, fontSizePxOverride?: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, label, {
        fontSize: fontSizePxOverride ?? fontPx(this, 14),
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

    const panelW = LIST_DETAIL_PANEL_W;
    const top = 16;
    const bottomMargin = 14;
    const panelLeft = CANVAS_W / 2 - panelW / 2;
    let y = top;

    const titleText = this.add
      .text(CANVAS_W / 2, y, `Qumatex -- ${discoveredAll}/${totalAll} discovered`, {
        fontSize: fontPx(this, 14),
        color: GOLD_ACCENT_HEX,
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
      `Type: ${this.materialdexTypeFilter === 'all' ? 'All' : materialTypeLabel(this.materialdexTypeFilter)} ▸`,
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
    const { leftX, leftColW, dividerX, rightColW, rightColCenterX } = listDetailColumns(panelLeft);

    // Left column: as many name rows as fit (renderListColumn, STYLE.md's
    // "List+detail panels") -- reserves space for this column's own
    // Prev/Next+page-label row and the panel's shared Close-button footer
    // whether or not either ends up showing, so a page that happens to fit
    // exactly doesn't get a taller neighbor once one of them appears.
    const listResult = renderListColumn({
      scene: this,
      container,
      x: leftX,
      y: columnsTop,
      width: leftColW,
      items: entries,
      idFor: (e) => e.material.name,
      labelFor: (e) => (e.discovered ? materialDisplayName(e.material) : '???'),
      colorFor: (e) => (e.discovered ? '#cfd8ff' : '#6a7396'),
      selectedId: this.materialdexSelectedName,
      page: this.materialdexListPage,
      onPageChange: (page) => {
        this.materialdexListPage = page;
        this.renderMaterialdexPanel();
      },
      onSelect: (e) => {
        this.materialdexSelectedName = e.material.name;
        this.renderMaterialdexPanel();
      },
      emptyText: 'No crystals\nof this type.',
    });
    this.materialdexListPage = listResult.page;
    const leftY = listResult.bottom;

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
    insertColumnDivider(this, container, dividerX, columnsTop, columnsBottom);

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
      .rectangle(CANVAS_W / 2, top + height / 2, panelW, height, PANEL_BG, 0.95)
      .setStrokeStyle(2, 0x9a6ad9);
    container.addAt(panel, 0);
  }

  // The Lab's one-off welcome tip (maybeShowLabTip) is this method's only
  // caller -- Qumatex builds its own panel (renderMaterialdexPanel) since it
  // isn't one of scenes/panels/hubStations.ts's six stations. Kept on the
  // same measured-top-down-layout/shrink-to-fit pattern as those anyway, so
  // a one-off popup doesn't look like a different panel era.
  private showPanel(title: string, body: string) {
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const panelWidth = 560;
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
      .rectangle(CANVAS_W / 2, top + panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.95)
      .setStrokeStyle(2, 0x9a6ad9);
    container.addAt(panel, 0);
  }

  // Public, not private -- see the dialogueContainer field comment above.
  // Shared by every panel this scene opens -- the Lab tip, Qumatex, and
  // scenes/panels/hubStations.ts's six stations --
  // renderMaterialdexPanel/hubStations.ts's own panels call this first to
  // clear their own previous container on a redraw (filter change, row
  // pick, list paging, settings change) before rebuilding.
  closeDialogue() {
    stopMoveEffectPreview();
    this.dialogueContainer?.destroy(true);
    this.dialogueContainer = undefined;
    // Same per-guardian session-field reset as OverworldScene.closeDialogue()
    // -- without it, walking away mid-pick (Farewell rather than Never mind)
    // from Anderson's two-step panel left the stale host pick in place for
    // the rest of the session, since this scene is long-lived and never
    // re-runs its class field initializers.
    this.dresselhausPage = 0;
    this.majoranaPage = 0;
    this.andersonSelection = null;
    this.andersonPage = 0;
    this.andersonMovePage = 0;
    this.blochPage = 0;
    this.feynmanPage = 0;
    this.tutorialPage = 0;
    this.tutorialSelectedIndex = 0;
    this.dresselhausPreview = null;
    this.andersonHostPreview = null;
    this.majoranaPreview = null;
    this.noetherMovePreview = null;
    this.noetherMovePage = 0;
    this.kondoMovePreview = null;
    this.kondoMovePage = 0;
    this.blochPreview = null;
  }
}
