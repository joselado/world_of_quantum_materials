import Phaser from 'phaser';

// The plate behind a label. A Text with a `backgroundColor` is how the game
// draws a button, a HUD readout, a list row and a prompt: Phaser fills the
// Text's own canvas with the colour before drawing the glyphs, so the plate
// is exactly as large as the text and its padding, moves with it, and is its
// hit area. Phaser fills it as a hard rectangle; here the same fill gets
// rounded corners, which is the one change that makes a label read as a
// drawn control rather than as highlighted text.
//
// Done where Phaser draws it rather than at each call site, so every plate in
// the game has the same corner and a new label gets it without asking: the
// fill Phaser issues for the background is replaced, for the length of that
// one updateText, by a rounded path over the Text's own box. Nothing about
// the Text's size, origin or hit area changes.
//
// A plate drawn some other way (ui/mathtext.ts's formula answer button, a
// rounded path behind a typeset label) takes PLATE_RADIUS for its corners, so
// it sits beside a plain answer button as an equal.
export const PLATE_RADIUS = 4;

type UpdateText = (this: Phaser.GameObjects.Text) => Phaser.GameObjects.Text;

export function installTextPlates(): void {
  const proto = Phaser.GameObjects.Text.prototype as unknown as { updateText: UpdateText };
  const updateText = proto.updateText;
  proto.updateText = function () {
    if (!this.style.backgroundColor) return updateText.call(this);
    const text = this;
    const ctx = this.context;
    // Phaser calls fillRect once in updateText, for the background, after
    // scaling the context by the Text's resolution -- so the path is laid
    // out in the Text's own units, whatever it is rasterized at.
    ctx.fillRect = () => {
      const w = text.width;
      const h = text.height;
      const r = Math.min(PLATE_RADIUS, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.arcTo(w, 0, w, h, r);
      ctx.arcTo(w, h, 0, h, r);
      ctx.arcTo(0, h, 0, 0, r);
      ctx.arcTo(0, 0, w, 0, r);
      ctx.closePath();
      ctx.fill();
    };
    try {
      return updateText.call(this);
    } finally {
      // Back to the context's own method, which the assignment above shadowed.
      delete (ctx as { fillRect?: unknown }).fillRect;
    }
  };
}
