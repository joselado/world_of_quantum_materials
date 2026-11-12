// What an open panel does to the screen behind it, for the two scenes that
// host panels (OverworldScene, HubScene) and the one that borrows only the
// scrim (BattleScene).
//
// A panel is modal, so the screen says so. One full-canvas dark layer, the
// scrim, sits directly under the panel and dims everything else. The HUD
// labels are off for as long as the panel is up: they are placed for the open
// screen, where they run under a panel's edges. The qumatessence counter goes
// with them over a panel that is only read (a question, lore, a tip, a Lab
// station) and stays over one where qumatessence is spent, a guardian's,
// since such a panel shows no balance of its own (showBalanceOver): there it
// rides above the panel on an opaque plate, in its own corner while that
// corner is clear of what the panel has laid out and in a clear one otherwise.
// One more label can ride the same way: the overworld's way back to the Lab
// when it is a touchscreen's only one (PanelChrome's `tapTarget`).
import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H } from '../../config/screen';

// Directly under every panel container, which all sit at depth 100.
export const SCRIM_DEPTH = 99;
// The scrim's name on the display list, so a script can ask whether one is up.
export const SCRIM_NAME = 'panelScrim';
const SCRIM_COLOR = 0x04040a;
const SCRIM_ALPHA = 0.6;
const RIDER_DEPTH = 101;
// The clear band kept between the counter's plate and anything in the panel.
const COUNTER_CLEARANCE = 4;
// A label's plate while it rides above a panel. Over the open world it is a
// translucent readout; over a panel's border, or over a dimmed label left in
// a corner of the Lab, a translucent plate lets both read through the text.
const RIDER_PLATE = 'rgba(4,4,10,0.92)';
const SHOWS_BALANCE = 'showsBalance';
const WORLD_STAYS_LIT = 'worldStaysLit';

// Marks `panel` as one where qumatessence is spent, so the counter stays
// readable above it. Called by the block every guardian's panel opens with
// (guardianHeader.ts), which is every place in the game a purchase is made;
// a panel that rebuilds itself is marked again by building that block again.
export function showBalanceOver(panel: Phaser.GameObjects.Container) {
  panel.setData(SHOWS_BALANCE, true);
}

// Marks `panel` as one that takes no scrim, for a panel whose words are about
// what lies behind it: the finale is read at the cliff's edge, over the worlds
// it speaks of. Called on the container before it is assigned to
// `dialogueContainer`, since that write is where the scrim is decided.
export function keepWorldLit(panel: Phaser.GameObjects.Container) {
  panel.setData(WORLD_STAYS_LIT, true);
}

// Not interactive: what lies under a panel is already inert (each scene
// guards its own world input while one is open), and a scrim that took
// clicks would be a second, competing rule.
export function addScrim(scene: Phaser.Scene): Phaser.GameObjects.Rectangle {
  return scene.add
    .rectangle(0, 0, CANVAS_W, CANVAS_H, SCRIM_COLOR, SCRIM_ALPHA)
    .setOrigin(0, 0)
    .setDepth(SCRIM_DEPTH)
    .setName(SCRIM_NAME);
}

// One per scene run, built once the HUD exists. The scene's own
// `dialogueContainer` setter hands every write to `sync`, so no panel opens,
// rebuilds, or closes without passing through here.
export class PanelChrome {
  private scrim?: Phaser.GameObjects.Rectangle;
  private panel?: Phaser.GameObjects.Container;
  private covered = false;
  private readonly tapPlate?: string;
  private readonly tapDepth: number = 0;
  private readonly homeX: number;
  private readonly homeY: number;
  private readonly homeDepth: number;
  private readonly homePlate: string;
  private readonly measured = new Phaser.Geom.Rectangle();
  // Left, top, right, bottom of every measurable piece of the open panel.
  private boxes: number[] = [];

  // `counter` is anchored by its top-right corner (origin 1, 0) in the
  // canvas's top-right; `labels` are the HUD texts that stand on screen
  // whenever no panel is open. `tapTarget` is a label that is also the only
  // way to do what it says (the overworld's "Tap here for the Lab" with the
  // touch controls up, where no Enter key exists): it stays where it is,
  // above the panel, for as long as nothing the panel lays out reaches it,
  // and goes with the other labels otherwise.
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly counter: Phaser.GameObjects.Text,
    private readonly labels: Phaser.GameObjects.Text[],
    private readonly tapTarget?: Phaser.GameObjects.Text
  ) {
    this.homeX = counter.x;
    this.homeY = counter.y;
    this.homeDepth = counter.depth;
    this.homePlate = counter.style.backgroundColor as string;
    if (tapTarget) {
      this.tapPlate = tapTarget.style.backgroundColor as string;
      this.tapDepth = tapTarget.depth;
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.release, this);
  }

  // `covered` is for a panel opening over something that already blanks the
  // whole canvas (the pass crossing's fade): a second dark layer over it
  // would double, and there is no world left for the counter to sit over.
  sync(panel: Phaser.GameObjects.Container | undefined, covered = false) {
    const wasOpen = !!this.panel;
    this.panel = panel;
    if (panel && !wasOpen) this.open(covered);
    else if (!panel && wasOpen) this.close();
    // On every write, not only the first: one panel can hand over to another
    // without the screen ever being bare between them, and the two need not
    // agree on the scrim.
    if (panel) this.setScrim(!this.covered && !panel.data?.get(WORLD_STAYS_LIT));
  }

  private setScrim(on: boolean) {
    if (on === !!this.scrim) return;
    if (on) this.scrim = addScrim(this.scene);
    else {
      this.scrim?.destroy();
      this.scrim = undefined;
    }
  }

  private open(covered: boolean) {
    this.covered = covered;
    this.labels.forEach((label) => label.setVisible(false));
    // Both off until the panel under them has been looked at (place).
    this.counter.setVisible(false);
    this.tapTarget?.setVisible(false);
    if (covered) return;
    this.counter.setDepth(RIDER_DEPTH).setBackgroundColor(RIDER_PLATE);
    this.tapTarget?.setDepth(RIDER_DEPTH).setBackgroundColor(RIDER_PLATE);
    // After the scene's own update and before the frame is drawn: a panel is
    // filled in after its container is assigned, and most rebuild part of
    // themselves in place on every row picked, so the riders are placed
    // against whatever the panel holds at the moment it is drawn.
    this.scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.place, this);
  }

  private close() {
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.place, this);
    this.setScrim(false);
    this.labels.forEach((label) => label.setVisible(true));
    this.counter
      .setVisible(true)
      .setDepth(this.homeDepth)
      .setPosition(this.homeX, this.homeY)
      .setBackgroundColor(this.homePlate);
    this.tapTarget?.setVisible(true).setDepth(this.tapDepth).setBackgroundColor(this.tapPlate as string);
  }

  // A scene left with a panel still open takes every object here down with
  // it; only the listener, which outlives a shutdown, is this class's to drop.
  private release() {
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.place, this);
    this.panel = undefined;
    this.scrim = undefined;
  }

  // Home first, then the two bottom corners, which the hidden HUD leaves
  // empty: at the counter's own margin from the canvas floor, and failing
  // that flush against it, which is what the tallest panels leave. The
  // top-left corner is not a candidate: a guardian's portrait stands there,
  // and it is drawn rather than measurable. A panel that leaves none of
  // these clear takes the counter off rather than wearing it across its own
  // text, and so does a panel nothing is bought in. The tap target is looked
  // at first and, where it stays, counts as one more piece the counter has to
  // keep clear of: both would otherwise want the bottom-right corner under a
  // tall panel.
  private place() {
    const panel = this.panel;
    if (!panel || !panel.active) return;
    this.boxes.length = 0;
    this.collect(panel);
    const backdrop = this.largestBox();
    if (this.tapTarget) {
      const b = this.tapTarget.getBounds(this.measured);
      const stays = this.isClear(b.x, b.y, b.width, b.height, backdrop);
      this.tapTarget.setVisible(stays);
      if (stays) this.boxes.push(b.x, b.y, b.right, b.bottom);
    }
    if (!panel.data?.get(SHOWS_BALANCE)) {
      this.counter.setVisible(false);
      return;
    }
    const w = this.counter.width;
    const h = this.counter.height;
    const margin = CANVAS_W - this.homeX;
    const low = CANVAS_H - margin - h;
    const floor = CANVAS_H - h;
    const left = margin + w;
    const spots = [this.homeX, this.homeY, this.homeX, low, left, low, this.homeX, floor, left, floor];
    for (let i = 0; i < spots.length; i += 2) {
      if (this.isClear(spots[i] - w, spots[i + 1], w, h, backdrop)) {
        this.counter.setPosition(spots[i], spots[i + 1]).setVisible(true);
        return;
      }
    }
    this.counter.setVisible(false);
  }

  private collect(node: Phaser.GameObjects.Container) {
    for (const child of node.list) {
      if (!(child as unknown as Phaser.GameObjects.Components.Visible).visible) continue;
      if (child instanceof Phaser.GameObjects.Container) {
        this.collect(child);
        continue;
      }
      const piece = child as unknown as Partial<Phaser.GameObjects.Components.GetBounds>;
      if (typeof piece.getBounds !== 'function') continue;
      const b = piece.getBounds(this.measured);
      if (b.width <= 0 || b.height <= 0) continue;
      this.boxes.push(b.x, b.y, b.right, b.bottom);
    }
  }

  // The panel's own background is the one piece that encloses all the
  // others, which makes it the largest: the counter may lie over it, and
  // over nothing else.
  private largestBox(): number {
    let best = -1;
    let bestArea = 0;
    for (let i = 0; i < this.boxes.length; i += 4) {
      const area = (this.boxes[i + 2] - this.boxes[i]) * (this.boxes[i + 3] - this.boxes[i + 1]);
      if (area > bestArea) {
        bestArea = area;
        best = i;
      }
    }
    return best;
  }

  private isClear(x: number, y: number, w: number, h: number, skip: number): boolean {
    const left = x - COUNTER_CLEARANCE;
    const top = y - COUNTER_CLEARANCE;
    const right = x + w + COUNTER_CLEARANCE;
    const bottom = y + h + COUNTER_CLEARANCE;
    for (let i = 0; i < this.boxes.length; i += 4) {
      if (i === skip) continue;
      if (this.boxes[i] < right && this.boxes[i + 2] > left && this.boxes[i + 1] < bottom && this.boxes[i + 3] > top) return false;
    }
    return true;
  }
}
