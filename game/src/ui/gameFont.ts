import Phaser from 'phaser';
import regularUrl from './fonts/game-regular.woff2';
import italicUrl from './fonts/game-italic.woff2';
import boldUrl from './fonts/game-bold.woff2';

// The face every word in the game is set in, carried by the game itself.
//
// A Text that names no family is drawn in whatever the machine calls
// "Courier", which is a different face on every operating system, thin on
// most of them, and absent on some. So the game ships one monospace face and
// makes it the default: the same glyphs, the same widths and the same line
// heights on every machine a player opens it on.
//
// The face is JetBrains Mono NL 2.304 (the cut without ligatures, so `->` and
// `!=` stay the characters that were typed), regular, italic and bold, under
// the SIL Open Font License (fonts/OFL.txt; the files carry the same notice
// in their own name table). Each file is a subset holding the characters the
// game's text can contain -- Latin with its accents, Greek, the super- and
// subscripts of a chemical formula, arrows, the mathematical operators -- at
// about 30 kB a style; DEVELOPMENT.md's "The game's typeface" says how the
// subset is made. A character the face lacks (the sparkle glyphs and the
// star, the proportional-to sign, the superscript minus of an anion, the
// subscript and superscript letters) falls through to the rest of the stack
// and is drawn by whatever the machine has behind it.
//
// It stays a monospace on purpose: panels pad columns with spaces and
// measure wraps by the character, and the advance is the same 0.6 em
// Courier's is before the adjustment below.
//
// Size. Every font size in the game is written for Courier's proportions,
// which is also the fallback, and at the same nominal size this face is much
// larger on the body (an x-height of 0.55 em against about 0.43). So it is
// drawn at SIZE_ADJUST of the size a style asks for: a line comes out as
// tall as a Courier line to within a pixel, a string a little narrower than
// the same string in Courier rather than wider, and the letters still larger
// than Courier's.
//
// Vertical metrics. Phaser measures a font's ascent and descent by asking
// the browser for the bounding box of a test string, and that answer moves:
// by a pixel between operating systems, and in Chrome by a pixel on one
// machine depending on whether the canvas has been resized. Every panel
// stacks its content by those numbers. Since the face is known, they are
// computed from it instead (ASCENT and DESCENT, in em of the size asked
// for), so a panel that fits here fits everywhere.
const FACE = 'WQM Mono';
const SIZE_ADJUST = 0.88;
// How far the face's ASCII reaches above and below the baseline once
// adjusted: brackets and the bar are its tallest characters (0.87 em of the
// face), `g`/`y`/`|` its lowest (0.18 em).
const ASCENT = 0.77;
const DESCENT = 0.16;

// The family a Text gets when its style names none, and the one ui/mathtext.ts
// sets the prose around a formula in so the two are the same face. Courier
// stays behind it for the characters the face lacks, and for a browser that
// could not load it at all.
export const GAME_FONT_FAMILY = `"${FACE}", Courier, monospace`;

let loaded = false;

// Registers the face with the page and waits until it can be drawn with.
// Awaited before the game exists (main.ts): a Text created before its font
// is ready is measured and rasterized in the fallback, and stays that way.
// A browser that cannot scale a face (no `size-adjust`) or that fails to
// load it keeps Courier and Phaser's own measured metrics, which is the game
// as it looks without this module.
export async function loadGameFont(): Promise<void> {
  if (typeof FontFace === 'undefined' || !document.fonts || !('sizeAdjust' in FontFace.prototype)) return;
  // `sizeAdjust` is newer than the DOM typings the project compiles against.
  const face = (url: string, weight: string, style: string) =>
    new FontFace(FACE, `url(${url}) format('woff2')`, { weight, style, sizeAdjust: `${SIZE_ADJUST * 100}%` } as FontFaceDescriptors);
  const faces = [face(regularUrl, '400', 'normal'), face(italicUrl, '400', 'italic'), face(boldUrl, '700', 'normal')];
  try {
    const all = Promise.all(faces.map((f) => f.load()));
    const late = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('font load timed out')), 4000));
    await Promise.race([all, late]);
    for (const f of faces) document.fonts.add(f);
    loaded = true;
  } catch {
    loaded = false;
  }
}

// Before any Text exists: the default family, and the metrics of a Text set
// in it.
export function installGameFont(): void {
  const proto = Phaser.GameObjects.TextStyle.prototype as unknown as StylePrototype;

  // A style that names no family gets the game's. Only where Phaser applies
  // its own defaults (a Text being created), so a later setStyle that leaves
  // the family alone still leaves it alone.
  const setStyle = proto.setStyle;
  proto.setStyle = function (style, updateText, setDefaults) {
    if (setDefaults && (!style || (style.fontFamily === undefined && style.font === undefined))) {
      style = { ...(style ?? {}), fontFamily: GAME_FONT_FAMILY };
    }
    return setStyle.call(this, style, updateText, setDefaults);
  };

  // Phaser assigns `metrics` wherever it has measured the font (a style being
  // set, a size or a family changing), always after the size and family are
  // in place. Assigning it for a Text in the game's face stores the face's
  // own numbers at that size instead of the browser's measurement.
  Object.defineProperty(proto, 'metrics', {
    configurable: true,
    get(this: StyleInstance) {
      return this._gameMetrics;
    },
    set(this: StyleInstance, measured: FontMetrics) {
      const px = loaded && this.fontFamily === GAME_FONT_FAMILY ? parseFloat(String(this.fontSize)) : NaN;
      if (!Number.isFinite(px) || !/px$/.test(String(this.fontSize))) {
        this._gameMetrics = measured;
        return;
      }
      const ascent = Math.ceil(px * ASCENT);
      const descent = Math.ceil(px * DESCENT);
      this._gameMetrics = { ascent, descent, fontSize: ascent + descent };
    },
  });
}

interface FontMetrics {
  ascent: number;
  descent: number;
  fontSize: number;
}

interface StyleInstance {
  fontFamily: string;
  fontSize: string | number;
  _gameMetrics: FontMetrics;
}

interface StyleConfig {
  fontFamily?: string;
  font?: string;
  [key: string]: unknown;
}

interface StylePrototype {
  setStyle: (this: unknown, style: StyleConfig | null | undefined, updateText?: boolean, setDefaults?: boolean) => unknown;
}
