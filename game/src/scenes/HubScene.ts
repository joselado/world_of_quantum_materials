import Phaser from 'phaser';
import { makeCrystal } from '../art/crystals';
import { CANVAS_W, CANVAS_H } from '../art/perspective';
import { getPlayerMaterial, allCrystals, TYPE_LOOK, materialDisplayName } from '../data/materials';
import { materialBlurb } from '../data/materialdex';
import { persistFromRegistry } from '../data/save';
import type { DiscoveredMaterial } from '../data/save';
import type { CrystalVariant, Material, MaterialType } from '../data/types';
import { TUTORIAL_TIPS, hasSeenTip, markTipSeen } from '../data/tutorial';
import { music } from '../audio/music';
import { fontPx, fontScale } from '../ui/text';

// World 0, "The Lab" (DESIGN.md's world table) -- boot destination from
// TitleScene and the return point from Overworld (press H). Unlike the
// numbered worlds it isn't a walkable procedural map: it's a single static
// room with three fixed hotspots (Materialdex, a save point, the door
// onward), since none of the hub's jobs -- catalog, save, launch -- need
// overworld movement or wild encounters of their own.

// Every real compound in the game (`allCrystals()`), not just discovered
// ones -- an undiscovered entry still occupies a slot in the index, masked
// down to "???" (renderMaterialdexPage), so the Materialdex reads as a
// checklist of the whole game rather than only growing entries a player has
// already found. Longest reasonable free-text search query -- past this,
// typing further can't narrow the match set any further than the compound's
// own (longest) name already would.
const MATERIALDEX_QUERY_MAX_LEN = 24;

interface MaterialdexEntry {
  material: Material;
  discovered: boolean;
}

export class HubScene extends Phaser.Scene {
  private dialogueContainer?: Phaser.GameObjects.Container;
  // Which entry of the *filtered* index is showing -- one entry per page
  // now (renderMaterialdexPage), reset to 0 every time the hotspot is
  // (re)opened or the search/filter changes, mirroring OverworldScene's
  // tutorialIndex pattern.
  private materialdexPage = 0;
  private materialdexQuery = '';
  private materialdexTypeFilter: MaterialType | 'all' = 'all';
  // Gates the free-text keydown handler below (registered once in create(),
  // since Hub has no other global keyboard use to conflict with) so typing
  // only edits the search query while the Materialdex panel is actually the
  // one open -- closeDialogue() clears this along with every other panel.
  private materialdexOpen = false;

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

    this.addHotspot(115, 300, 0x9a6ad9, 'prism', 'Materialdex', () => this.showMaterialdex());
    this.addHotspot(CANVAS_W / 2, 300, 0xffe066, 'shard', 'Save Point', () => this.showSavePoint());
    this.addHotspot(CANVAS_W - 115, 300, 0x4ad9a0, 'cluster', this.doorLabel(), () => this.enterWorld());

    this.add
      .text(CANVAS_W / 2, 410, 'Click a station to interact.', { fontSize: fontPx(this, 12), color: '#8fa0c9' })
      .setOrigin(0.5);

    // Materialdex free-text search plus Left/Right entry paging -- a no-op
    // whenever the Materialdex isn't the open panel (materialdexOpen), so
    // this one listener can stay registered for the scene's whole life
    // instead of being added/removed with the panel itself.
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (!this.materialdexOpen) return;
      if (event.key === 'ArrowLeft') {
        this.stepMaterialdexPage(-1);
      } else if (event.key === 'ArrowRight') {
        this.stepMaterialdexPage(1);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        this.materialdexQuery = this.materialdexQuery.slice(0, -1);
        this.materialdexPage = 0;
        this.renderMaterialdexPage();
      } else if (event.key.length === 1 && /[a-z0-9 ₀-₉'-]/i.test(event.key)) {
        if (this.materialdexQuery.length >= MATERIALDEX_QUERY_MAX_LEN) return;
        event.preventDefault();
        this.materialdexQuery += event.key;
        this.materialdexPage = 0;
        this.renderMaterialdexPage();
      }
    });

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

  // Every real compound in the game (allCrystals()), each paired with
  // whether the player has actually discovered it (registry
  // discoveredMaterials, set by OverworldScene.recordDiscovery) -- an
  // undiscovered entry still has a slot in this list, masked down to "???"
  // by renderMaterialdexPage, so the index reads as a checklist of the
  // whole game rather than only ever growing entries already found.
  // Alphabetical by the compound's real name regardless of discovery state,
  // so the index has one stable order a player can navigate/search by
  // rather than reshuffling as more crystals are found.
  private materialdexIndex(): MaterialdexEntry[] {
    const discoveredNames = new Set(
      ((this.game.registry.get('discoveredMaterials') as DiscoveredMaterial[]) ?? []).map((m) => m.name)
    );
    return allCrystals()
      .map((material) => ({ material, discovered: discoveredNames.has(material.name) }))
      .sort((a, b) => a.material.name.localeCompare(b.material.name));
  }

  // materialdexIndex() narrowed by the current search query (substring
  // match against the compound's real name, case-insensitive -- matches
  // regardless of discovery state, since a player typing out an exact
  // compound name already knows what they're looking for) and type filter.
  private filteredMaterialdexIndex(): MaterialdexEntry[] {
    const query = this.materialdexQuery.trim().toLowerCase();
    return this.materialdexIndex().filter(({ material }) => {
      if (this.materialdexTypeFilter !== 'all' && material.type !== this.materialdexTypeFilter) return false;
      if (query && !material.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }

  private stepMaterialdexPage(delta: number) {
    if (!this.materialdexOpen) return;
    const total = this.filteredMaterialdexIndex().length;
    if (total <= 1) return;
    this.materialdexPage = (this.materialdexPage + delta + total) % total;
    this.renderMaterialdexPage();
  }

  private showMaterialdex() {
    this.materialdexPage = 0;
    this.materialdexQuery = '';
    this.materialdexTypeFilter = 'all';
    this.materialdexOpen = true;
    this.renderMaterialdexPage();
  }

  // One entry per page (name, physics blurb, and the compound's own
  // rendered crystal) rather than several stacked at once -- a long-run
  // save's discovered list plus every not-yet-found compound easily reaches
  // 50+ entries, and stacking even two full blurbs plus crystal art each
  // ran well past the panel's own bottom edge. Search/filter (above) is the
  // primary way to navigate a list this size; Back/Next and the Left/Right
  // keys (stepMaterialdexPage) step one entry at a time for browsing.
  private renderMaterialdexPage() {
    this.closeDialogue();
    this.materialdexOpen = true; // closeDialogue() above just cleared it
    const container = this.add.container(0, 0).setDepth(100);
    this.dialogueContainer = container;

    const entries = this.filteredMaterialdexIndex();
    const totalAll = this.materialdexIndex().length;
    const discoveredAll = this.materialdexIndex().filter((e) => e.discovered).length;

    // Content laid out top-down first (running `y`, each element's own
    // actual measured height advancing it), panel sized/inserted behind
    // everything once the real height is known -- same pattern
    // OverworldScene.showInfoPanel uses. A blurb's wrapped length varies a
    // lot (one line for a short entry, half a dozen for a longer one) and
    // stacks underneath a crystal render and a search/filter row this panel
    // didn't have before, so a fixed panel height clipped or overlapped its
    // own footer on longer entries, especially at the larger text-size
    // presets -- verified against a live browser render (headless-Chromium
    // harness, DEVELOPMENT.md) at every preset.
    const panelW = 600;
    const top = 16;
    const bottomMargin = 14;
    let y = top;

    const titleText = this.add
      .text(CANVAS_W / 2, y, `Materialdex -- ${discoveredAll}/${totalAll} discovered`, {
        fontSize: fontPx(this, 14),
        color: '#ffe066',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);
    container.add(titleText);
    y += titleText.height + 8;

    // Search + type filter row -- click the type button to cycle through
    // every MaterialType (TYPE_LOOK's own keys) plus "All"; type to filter
    // by name (captured by create()'s keydown handler while this panel is
    // open, appended to materialdexQuery). Search text is left-anchored
    // with the Clear button positioned dynamically right after its actual
    // measured width (rather than both fixed at hand-picked x offsets) so a
    // query near MATERIALDEX_QUERY_MAX_LEN can't grow into/behind the
    // button -- caught by an actual browser render, not just eyeballed.
    const panelLeft = CANVAS_W / 2 - panelW / 2;
    const searchLabel = this.materialdexQuery ? `Search: ${this.materialdexQuery}_` : 'Search: (type to filter)_';
    const searchText = this.add
      .text(panelLeft + 20, y, searchLabel, {
        fontSize: fontPx(this, 11),
        color: '#cfd8ff',
      })
      .setOrigin(0, 0);
    container.add(searchText);
    let clearBtn: Phaser.GameObjects.Text | null = null;
    if (this.materialdexQuery) {
      clearBtn = this.addButton(
        0,
        y - 2,
        '[ Clear ]',
        () => {
          this.materialdexQuery = '';
          this.materialdexPage = 0;
          this.renderMaterialdexPage();
        },
        fontPx(this, 10)
      );
      clearBtn.setPosition(searchText.x + searchText.width + 14 + clearBtn.width / 2, y - 2);
      container.add(clearBtn);
    }
    y += Math.max(searchText.height, clearBtn?.height ?? 0) + 6;

    const filterBtn = this.addButton(
      CANVAS_W / 2,
      y,
      `Type: ${this.materialdexTypeFilter === 'all' ? 'All' : this.materialdexTypeFilter} ▸`,
      () => {
        const types = Object.keys(TYPE_LOOK) as MaterialType[];
        const options: (MaterialType | 'all')[] = ['all', ...types];
        const currentIndex = options.indexOf(this.materialdexTypeFilter);
        this.materialdexTypeFilter = options[(currentIndex + 1) % options.length];
        this.materialdexPage = 0;
        this.renderMaterialdexPage();
      },
      fontPx(this, 10)
    );
    container.add(filterBtn);
    y += filterBtn.height + 10;

    if (entries.length === 0) {
      const empty = this.add
        .text(CANVAS_W / 2, y, 'No crystals match this search/filter.', {
          fontSize: fontPx(this, 12),
          color: '#cfd8ff',
          align: 'center',
          wordWrap: { width: panelW - 80 },
        })
        .setOrigin(0.5, 0);
      container.add(empty);
      y += empty.height + 16;

      const closeBtn = this.addButton(CANVAS_W / 2, y, '[ Close ]', () => this.closeDialogue());
      container.add(closeBtn);
      y += closeBtn.height + bottomMargin;

      this.insertMaterialdexPanelBg(container, panelW, top, y - top);
      return;
    }

    const page = Phaser.Math.Clamp(this.materialdexPage, 0, entries.length - 1);
    this.materialdexPage = page;
    const { material, discovered } = entries[page];

    const crystal = makeCrystal(
      this,
      36,
      discovered ? material.color : 0x33394a,
      material.variant,
      discovered ? { seed: material.name, hybrid: material.hybridParents } : undefined
    );
    const crystalBlockH = 84; // fixed regardless of text-size setting -- art, not text (see STYLE.md)
    crystal.setPosition(CANVAS_W / 2, y + crystalBlockH / 2);
    container.add(crystal);
    y += crystalBlockH;

    const nameText = this.add
      .text(CANVAS_W / 2, y, discovered ? materialDisplayName(material) : '???', {
        fontSize: fontPx(this, 14),
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);
    container.add(nameText);
    y += nameText.height + 8;

    // Blurb length varies a lot (one line for a short entry, half a dozen
    // for a longer one) -- shrink the font in whole-px steps, floor 9,
    // rather than letting a long blurb push the counter/footer off the
    // panel (OverworldScene.showInfoPanel's own body uses this same loop).
    const blurb = discovered
      ? materialBlurb(material)
      : 'Not yet discovered -- find and battle this crystal out in the field to catalogue it.';
    const scale = fontScale(this);
    let blurbBase = 12;
    const blurbText = this.add
      .text(CANVAS_W / 2, y, blurb, {
        fontSize: `${Math.round(blurbBase * scale)}px`,
        color: '#cfd8ff',
        align: 'left',
        wordWrap: { width: panelW - 80 },
        lineSpacing: 5,
      })
      .setOrigin(0.5, 0);
    container.add(blurbText);
    const reservedBelow = 8 + 16 + 8 + 30 + bottomMargin; // gap + counter + gap + footer-button estimate + margin
    while (y + blurbText.height + reservedBelow > CANVAS_H - 10 && blurbBase > 9) {
      blurbBase -= 1;
      blurbText.setFontSize(`${Math.round(blurbBase * scale)}px`);
    }
    y += blurbText.height + 8;

    const counterText = this.add
      .text(CANVAS_W / 2, y, `Entry ${page + 1}/${entries.length}`, {
        fontSize: fontPx(this, 10),
        color: '#8fa0c9',
      })
      .setOrigin(0.5, 0);
    container.add(counterText);
    y += counterText.height + 8;

    const closeBtn = this.addButton(CANVAS_W / 2, y, '[ Close ]', () => this.closeDialogue());
    container.add(closeBtn);
    if (entries.length > 1) {
      container.add(this.addButton(CANVAS_W / 2 - 170, y, '<- Back', () => this.stepMaterialdexPage(-1)));
      container.add(this.addButton(CANVAS_W / 2 + 170, y, 'Next ->', () => this.stepMaterialdexPage(1)));
    }
    y += closeBtn.height + bottomMargin;

    this.insertMaterialdexPanelBg(container, panelW, top, y - top);
  }

  // Background rectangle for the Materialdex panel, inserted behind
  // everything once renderMaterialdexPage above knows the real content
  // height -- factored out since both the empty-state and normal-entry
  // paths through that method need it.
  private insertMaterialdexPanelBg(container: Phaser.GameObjects.Container, panelW: number, top: number, height: number) {
    const panel = this.add
      .rectangle(CANVAS_W / 2, top + height / 2, panelW, height, 0x10101c, 0.95)
      .setStrokeStyle(2, 0x9a6ad9);
    container.addAt(panel, 0);
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
    // Also cleared here (not just by whichever panel-specific logic closes
    // the Materialdex) so every other panel this scene opens -- Save Point,
    // the Lab tip -- can share this same close path without leaking
    // keystrokes into the search query afterward. renderMaterialdexPage
    // calls closeDialogue() to clear its own previous container on a
    // redraw and immediately re-sets this true right after, so a
    // search/filter/page change while the Materialdex is open doesn't
    // flicker this off.
    this.materialdexOpen = false;
  }
}
