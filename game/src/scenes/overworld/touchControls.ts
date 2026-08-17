import Phaser from 'phaser';
import { CANVAS_H } from '../../config/screen';
import { REFERENCE_BLUE_GREY } from '../../ui/theme';

// The overworld's on-screen walking arrows: the one control a player without
// a keyboard would otherwise have no way to press. Everything else the game
// asks for is already a click target (stations, guardians, panel buttons,
// answers, moves, the pass prompt, the Lab hint), so this file is the whole
// of what a phone or a tablet needs to play.
//
// Built as a small handle rather than a per-frame render function (the shape
// the rest of scenes/overworld/ uses): the pad holds the one piece of state
// nothing else can derive, which direction is currently being held, and
// OverworldScene.update() reads it beside the cursor keys.
//
// Interface, not scenery: fixed on screen at the bottom-left corner, drawn
// over the world at a depth below the dialogue panels (which sit at 100), and
// unaffected by the camera the world itself is projected through.

export interface TouchPadHeld {
  dx: number;
  dy: number;
}

export interface TouchPad {
  // The direction being held right now, {0,0} when nothing is pressed.
  held(): TouchPadHeld;
  setVisible(visible: boolean): void;
  destroy(): void;
}

// Sized for a finger on a phone held in landscape, where the 854x480 canvas
// is letterboxed to roughly 0.8 of its authored size: a 62px plate lands at
// about 50 real pixels, which is the size a touch target needs to be to be
// hit reliably. The arrows are what the corner is for, so PAD_KEEPOUT (the
// full width the pad claims, used by OverworldScene to keep the pass prompt
// out of both bottom corners) is the pad's own span plus a margin.
const PLATE = 62;
const GAP = 4;
const ARROW = 18;
const PAD_CENTER_X = 8 + PLATE * 1.5 + GAP;
const PAD_CENTER_Y = CANVAS_H - 8 - PLATE * 1.5 - GAP;
export const PAD_KEEPOUT = PAD_CENTER_X + PLATE * 1.5 + GAP + 12;

// Same dark-plate-over-the-world treatment the other two pieces of overworld
// interface use (the Lab hint and the pass prompt): a black wash the world
// reads through, brightening under a finger so a held arrow is visibly held.
const PLATE_FILL = 0x000000;
const PLATE_ALPHA = 0.45;
const PLATE_ALPHA_HELD = 0.72;

interface PadButton {
  dx: number;
  dy: number;
  plate: Phaser.GameObjects.Rectangle;
}

export function createTouchPad(scene: Phaser.Scene, depth: number): TouchPad {
  const container = scene.add.container(0, 0).setDepth(depth);
  const step = PLATE + GAP;
  const buttons: PadButton[] = [];
  let heldPlate: Phaser.GameObjects.Rectangle | null = null;

  const add = (dx: number, dy: number) => {
    const x = PAD_CENTER_X + dx * step;
    const y = PAD_CENTER_Y + dy * step;

    const plate = scene.add.rectangle(x, y, PLATE, PLATE, PLATE_FILL, PLATE_ALPHA);
    plate.setStrokeStyle(2, REFERENCE_BLUE_GREY, 0.7);
    plate.setInteractive({ useHandCursor: true });
    container.add(plate);

    // The arrow itself points the way the plate walks. Drawn as its own
    // triangle above the plate and left non-interactive, so the whole plate
    // stays the hit area rather than just the glyph.
    const tip = { x: dx * ARROW, y: dy * ARROW };
    const baseL = { x: -dx * ARROW * 0.5 - dy * ARROW * 0.8, y: -dy * ARROW * 0.5 - dx * ARROW * 0.8 };
    const baseR = { x: -dx * ARROW * 0.5 + dy * ARROW * 0.8, y: -dy * ARROW * 0.5 + dx * ARROW * 0.8 };
    const arrow = scene.add.triangle(x, y, tip.x, tip.y, baseL.x, baseL.y, baseR.x, baseR.y, REFERENCE_BLUE_GREY, 0.95);
    arrow.setOrigin(0, 0);
    container.add(arrow);

    const press = () => {
      if (heldPlate && heldPlate !== plate) heldPlate.setFillStyle(PLATE_FILL, PLATE_ALPHA);
      heldPlate = plate;
      plate.setFillStyle(PLATE_FILL, PLATE_ALPHA_HELD);
    };
    const release = () => {
      if (heldPlate !== plate) return;
      heldPlate = null;
      plate.setFillStyle(PLATE_FILL, PLATE_ALPHA);
    };

    // Held rather than tapped: a press starts walking and holds it until the
    // finger lifts or slides off, so crossing a world is one gesture instead
    // of one tap per tile. OverworldScene's own `moving` gate already paces
    // the steps.
    plate.on('pointerdown', press);
    plate.on('pointerup', release);
    plate.on('pointerout', release);

    buttons.push({ dx, dy, plate });
  };

  add(0, -1);
  add(-1, 0);
  add(1, 0);
  add(0, 1);

  // A finger lifted anywhere else (over a panel, off the canvas) still ends
  // the press: without this the pad could be left holding a direction that
  // no plate will ever hear a pointerup for.
  const clearAll = () => {
    if (!heldPlate) return;
    heldPlate.setFillStyle(PLATE_FILL, PLATE_ALPHA);
    heldPlate = null;
  };
  scene.input.on(Phaser.Input.Events.POINTER_UP, clearAll);
  scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, clearAll);

  return {
    held() {
      if (!heldPlate || !container.visible) return { dx: 0, dy: 0 };
      const btn = buttons.find((b) => b.plate === heldPlate);
      return btn ? { dx: btn.dx, dy: btn.dy } : { dx: 0, dy: 0 };
    },
    setVisible(visible: boolean) {
      if (container.visible === visible) return;
      container.setVisible(visible);
      if (!visible) clearAll();
    },
    destroy() {
      scene.input.off(Phaser.Input.Events.POINTER_UP, clearAll);
      scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, clearAll);
      container.destroy(true);
    },
  };
}
