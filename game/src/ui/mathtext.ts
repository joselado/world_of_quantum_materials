import Phaser from 'phaser';

// Formula rendering for the physics questions. Quiz prompts and answers
// (data/quiz.ts) mark their formulas with `$...$`; inside those delimiters a
// small math grammar is typeset properly -- subscripts drop, superscripts
// rise, a square root gets a real radical sign with a bar over its radicand --
// instead of being read as literal punctuation. Everything outside the
// delimiters is ordinary prose, laid out word by word in the same face and at
// the same line spacing a plain Phaser Text would give it, so a question that
// happens to carry a formula reads as the same kind of text as one that does
// not.
//
// The grammar is deliberately only as wide as the question data needs (see
// data/quiz.ts): `_x`/`_{xy}` subscripts, `^x`/`^{xy}` superscripts, `√(...)`,
// `(...)`/`|...|` as literal fences, and the two shorthands the authored text
// already uses -- a trailing `†` and Unicode script digits (`²`, `₂`) attach
// as scripts to the glyph before them. Fractions stay inline as `a / b`: a
// stacked fraction doubles a line's height, and these panels render at 12px
// inside a shrink-to-fit budget where that height is the scarce resource.
//
// Strings with no `$` in them never come through here at all -- call sites
// check `hasMath()` and keep using a plain Phaser Text, so the overwhelming
// majority of question text is untouched by this module.

// Two faces, one per kind of run. Prose is set in the face a plain Phaser
// Text uses, so the words around a formula are indistinguishable from the
// words of a question that carries no formula at all; that has to be the
// literal default Phaser falls back to when a style names no family, not a
// stack that merely resembles it. Math spans get their own monospace stack:
// the default face has no Greek coverage on common platforms, so a Δ or ξ
// inside an expression would come from a per-glyph fallback and sit
// hairline-thin beside its own Latin, where every family in this stack
// covers Greek and the angle brackets, ships a real oblique for the leaning
// variables, and the generic tail keeps a machine with none of the named
// faces on a consistent monospace. Setting the math in a face of its own is
// the ordinary typographic convention anyway.
//
// Two faces meet on one line because the layout below is baseline-relative:
// every run is placed by its own ascent, so a formula and the words on
// either side of it share a baseline instead of a top edge.
const PROSE_FONT_FAMILY = 'Courier';
const MATH_FONT_FAMILY = 'Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';

// A run's own text is drawn by a Phaser Text object; scripts are the same
// object at a smaller size, its baseline shifted off the base run's. The
// offsets are fractions of the size being scripted, so they hold at every
// FONT_SCALE_PRESETS setting (ui/text.ts) rather than only at the default.
// Scripts are set larger than the 0.7 of the text size real typesetting uses.
// The game's smallest text-size preset puts a prompt at 13px, and a 0.7
// script off that is 9px, which in a monospace face is a blur rather than a
// readable letter. The floor holds that line for any caller smaller still.
const SCRIPT_RATIO = 0.8;
const SCRIPT_MIN_PX = 10;
const SUB_DROP = 0.19;
const SUP_RAISE = 0.45;
// Gap between the top of a radicand and the bar drawn over it, and the
// radical sign's own width, both as fractions of the size being rooted.
const RADICAL_GAP = 0.16;
const RADICAL_WIDTH = 0.55;

// Multi-letter names that are upright in real math typesetting (LaTeX's
// \cos, \ln, ...) rather than italic like a single-letter variable. Anything
// not listed is a variable and leans.
const UPRIGHT_WORDS = new Set([
  'cos', 'sin', 'tan', 'exp', 'ln', 'log', 'sgn', 'const', 'max', 'min',
  'det', 'Tr', 'tr', 'Re', 'Im', 'sech', 'tanh', 'mod',
]);

// Letters that lean in math: ASCII plus lowercase Greek. Uppercase Greek
// (Δ, Γ, Ω) stays upright, as it does in LaTeX.
const ITALIC_LETTER = /[A-Za-zα-ω]/;

const SUP_CHARS: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6',
  '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-', '⁽': '(', '⁾': ')',
  'ⁿ': 'n', 'ⁱ': 'i',
};
const SUB_CHARS: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6',
  '₇': '7', '₈': '8', '₉': '9', '₊': '+', '₋': '-', '₍': '(', '₎': ')',
  'ₐ': 'a', 'ₑ': 'e', 'ₒ': 'o', 'ₓ': 'x', 'ₕ': 'h', 'ₖ': 'k', 'ₗ': 'l',
  'ₘ': 'm', 'ₙ': 'n', 'ₚ': 'p', 'ₛ': 's', 'ₜ': 't', 'ᵢ': 'i', 'ⱼ': 'j',
  'ᵣ': 'r', 'ᵤ': 'u', 'ᵥ': 'v',
};

// ---------------------------------------------------------------- parsing

type Node =
  | { t: 'run'; text: string; italic: boolean; math: boolean }
  | { t: 'script'; base: Node; sub?: Node; sup?: Node }
  | { t: 'sqrt'; inner: Node }
  | { t: 'angle'; open: boolean }
  | { t: 'row'; items: Node[] };

// One entry in the flat stream the line-wrapper works on: a break
// opportunity, a forced newline, or a piece of typeset content.
type Item = { t: 'space'; math: boolean } | { t: 'break' } | { t: 'node'; node: Node };

function row(items: Node[]): Node {
  return items.length === 1 ? items[0] : { t: 'row', items: mergeRuns(items) };
}

// Adjacent single-character runs of the same face and slant collapse into one
// Text object, so a formula costs a handful of game objects rather than one
// per glyph. Scripts and radicals are their own nodes, so nothing merges
// across them.
function mergeRuns(items: Node[]): Node[] {
  const out: Node[] = [];
  for (const item of items) {
    const prev = out[out.length - 1];
    if (item.t === 'run' && prev && prev.t === 'run' && prev.italic === item.italic && prev.math === item.math) {
      out[out.length - 1] = { t: 'run', text: prev.text + item.text, italic: prev.italic, math: prev.math };
    } else {
      out.push(item);
    }
  }
  return out;
}

class MathParser {
  private i = 0;
  // How many literal fences deep the cursor is, and whether it sits between a
  // pair of `|` bars. A space inside either is part of the expression being
  // fenced, not a place to break a line, so `⟨c_i c_j⟩` and `|r − r₀|` each
  // wrap as a unit instead of splitting down the middle. Bars are tracked
  // apart from brackets because the same glyph opens and closes them, and a
  // Dirac `⟨ψ|H|ψ⟩` would otherwise read its own separators as fence closers.
  private depth = 0;
  private inBars = false;
  constructor(private readonly src: string) {}

  // The top level of a `$...$` span: content plus the spaces between it,
  // which are the only places the wrapper may break a formula across lines.
  parseSpan(): Item[] {
    const items: Item[] = [];
    let group: Node[] = [];
    const flush = () => {
      if (group.length) {
        items.push({ t: 'node', node: row(group) });
        group = [];
      }
    };
    while (this.i < this.src.length) {
      if (this.src[this.i] === ' ' && this.depth === 0 && !this.inBars) {
        this.i += 1;
        flush();
        items.push({ t: 'space', math: true });
        continue;
      }
      group.push(this.parseItem());
    }
    flush();
    return items;
  }

  // Everything up to `end`, spaces included as literal glyphs -- a group
  // never offers the wrapper a break, so `√(ε(k)² + |Δ(k)|²)` stays whole.
  // Nesting is counted, so an inner `ε(k)` does not close an outer group.
  private parseUntil(end: string): Node {
    const open = end === ')' ? '(' : '{';
    const parts: Node[] = [];
    let depth = 0;
    while (this.i < this.src.length) {
      const c = this.src[this.i];
      if (c === end && depth === 0) break;
      if (c === open) depth += 1;
      else if (c === end) depth -= 1;
      parts.push(this.parseItem());
    }
    this.i += 1; // consume the closer (absent at end of input, harmless)
    return parts.length ? row(parts) : { t: 'run', text: '', italic: false, math: true };
  }

  // An atom plus every script that attaches to it.
  private parseItem(): Node {
    let node = this.parseAtom();
    let sub: Node | undefined;
    let sup: Node | undefined;
    for (;;) {
      const c = this.src[this.i];
      if (c === '_') {
        this.i += 1;
        sub = this.parseScriptArg();
      } else if (c === '^') {
        this.i += 1;
        sup = this.parseScriptArg();
      } else if (c === '†' || c === '′' || c === '*') {
        this.i += 1;
        sup = { t: 'run', text: c, italic: false, math: true };
      } else if (c !== undefined && SUP_CHARS[c] !== undefined) {
        sup = { t: 'run', text: this.takeMapped(SUP_CHARS), italic: false, math: true };
      } else if (c !== undefined && SUB_CHARS[c] !== undefined) {
        sub = { t: 'run', text: this.takeMapped(SUB_CHARS), italic: false, math: true };
      } else {
        break;
      }
    }
    if (sub || sup) node = { t: 'script', base: node, sub, sup };
    return node;
  }

  private takeMapped(table: Record<string, string>): string {
    let out = '';
    while (this.i < this.src.length && table[this.src[this.i]] !== undefined) {
      out += table[this.src[this.i]];
      this.i += 1;
    }
    return out;
  }

  // A script's argument. Braces and parentheses both group and are dropped
  // (`T^(3/2)`, `c_{n+1}`); otherwise the run of alphanumerics after the
  // marker is taken whole, since the question text writes multi-character
  // scripts bare (`v_F`, `σ_xy`, `H_KS`) rather than bracing them.
  private parseScriptArg(): Node {
    if (this.src[this.i] === '{') {
      this.i += 1;
      return this.parseUntil('}');
    }
    if (this.src[this.i] === '(') {
      this.i += 1;
      return this.parseUntil(')');
    }
    const word = /^[A-Za-z0-9]+/.exec(this.src.slice(this.i));
    if (word) {
      this.i += word[0].length;
      return {
        t: 'run',
        text: word[0],
        italic: /^[A-Za-z]+$/.test(word[0]) && !UPRIGHT_WORDS.has(word[0]),
        math: true,
      };
    }
    return this.parseAtom();
  }

  // A single glyph or a radical. Every fence is literal here -- `ε(k)` keeps
  // its parentheses and the anticommutator `{c_i, c_j†}` keeps its braces --
  // since only a script argument or a radicand groups (parseScriptArg,
  // parseRadicand), and those consume their own fences.
  private parseAtom(): Node {
    const c = this.src[this.i];
    if (c === '√') {
      this.i += 1;
      return { t: 'sqrt', inner: this.parseRadicand() };
    }
    if (c !== undefined && /[A-Za-z]/.test(c)) {
      const word = /^[A-Za-z]+/.exec(this.src.slice(this.i))![0];
      if (UPRIGHT_WORDS.has(word)) {
        this.i += word.length;
        return { t: 'run', text: word, italic: false, math: true };
      }
    }
    this.i += 1;
    if (c === '|') this.inBars = !this.inBars;
    else if (c !== undefined && '([{⟨'.includes(c)) this.depth += 1;
    else if (c !== undefined && ')]}⟩'.includes(c)) this.depth = Math.max(0, this.depth - 1);
    // The bra-ket angles are drawn rather than set. They are the one character
    // the formulas use that sits outside the blocks a stock monospace face is
    // reliably built to cover (Consolas, what the stack resolves to on Windows,
    // carries the Greek and the operators but not these), and a single glyph
    // falling back to some other face is exactly the two-typefaces-in-one-
    // expression look the font stack exists to prevent.
    if (c === '⟨' || c === '⟩') return { t: 'angle', open: c === '⟨' };
    return { t: 'run', text: c ?? '', italic: c !== undefined && ITALIC_LETTER.test(c), math: true };
  }

  // What sits under the bar: a parenthesised or braced group loses its
  // fences to the radical, anything else roots just the next item (`√B`).
  private parseRadicand(): Node {
    const c = this.src[this.i];
    if (c === '(') {
      this.i += 1;
      return this.parseUntil(')');
    }
    if (c === '{') {
      this.i += 1;
      return this.parseUntil('}');
    }
    return this.parseItem();
  }
}

// Splits a whole string on its `$` delimiters and returns the flat stream of
// prose words, spaces and formula pieces the wrapper lays out.
function tokenize(source: string): Item[] {
  const items: Item[] = [];
  const chunks = source.split('$');
  chunks.forEach((chunk, index) => {
    if (index % 2 === 1) {
      items.push(...new MathParser(chunk).parseSpan());
      return;
    }
    // Prose: words are atoms, whitespace is a break opportunity.
    const parts = chunk.split(/(\n|[ \t]+)/);
    for (const part of parts) {
      if (part === '') continue;
      if (part === '\n') items.push({ t: 'break' });
      else if (/^[ \t]+$/.test(part)) items.push({ t: 'space', math: false });
      else items.push({ t: 'node', node: { t: 'run', text: part, italic: false, math: false } });
    }
  });
  return items;
}

// ---------------------------------------------------------------- layout

// A laid-out piece of a formula. `above`/`below` are its extents measured
// from the baseline it will be drawn on, so a superscript reports an `above`
// past its base run's ascent and a subscript a `below` past that run's
// descent, and the line they sit on grows to hold them. Every box is placed
// by its baseline rather than its top edge, which is what lets a run of prose
// and a run of math -- two faces with two different ascents -- sit on the
// same line without stepping.
interface Box {
  width: number;
  above: number;
  below: number;
  draw(x: number, baseline: number): void;
}

// Run widths are measured on a shared canvas context, which reports the
// browser's real fractional advance. A Phaser Text's own `width` is its
// canvas texture's width, rounded up to a whole pixel -- read run-by-run
// that pads every run boundary, and a formula built from several runs comes
// out visibly looser than the same characters in one Text. Vertical metrics
// still come from a Phaser probe, since it is Phaser's own numbers that
// decide where a Text puts its baseline, but only once per font rather than
// per string. Both caches live for the life of the page; the panels that use
// this module re-render the same strings repeatedly while shrinking to fit
// (BattleScene.renderQuestionPanel), and the key set is bounded by the
// authored question text.
let measureCtx: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();
const metricsCache = new Map<string, { ascent: number; descent: number }>();

export interface MathTextStyle {
  // Already scaled by the caller (ui/text.ts's fontScale), in px.
  fontSizePx: number;
  color: string;
  wrapWidth: number;
  // 'center' matches a Phaser Text with setOrigin(0.5, 0); 'left' matches
  // setOrigin(0, 0).
  origin?: 'center' | 'left';
  fontStyle?: string;
}

class Layout {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly container: Phaser.GameObjects.Container,
    private readonly style: MathTextStyle
  ) {}

  private textStyle(px: number, italic: boolean, math: boolean) {
    const weight = this.style.fontStyle ?? '';
    const slant = italic ? 'italic' : '';
    const fontStyle = [slant, weight].filter(Boolean).join(' ');
    return {
      fontFamily: math ? MATH_FONT_FAMILY : PROSE_FONT_FAMILY,
      fontSize: `${px}px`,
      color: this.style.color,
      ...(fontStyle ? { fontStyle } : {}),
    };
  }

  // The same face, size and slant as a CSS font shorthand, for the canvas
  // context to measure with. It must select exactly the font the Phaser Text
  // will draw with, or the fractional widths describe a different face.
  private font(px: number, italic: boolean, math: boolean) {
    const weight = this.style.fontStyle ?? '';
    const slant = italic ? 'italic' : '';
    const family = math ? MATH_FONT_FAMILY : PROSE_FONT_FAMILY;
    return [slant, weight, `${px}px`, family].filter(Boolean).join(' ');
  }

  // How far a face's ink reaches above and below its baseline at a given
  // size. Phaser puts a Text object's first baseline exactly `ascent` below
  // its top edge and advances every further line by `ascent + descent`, so
  // taking the same two numbers from a throwaway Text is what makes a run
  // placed here land where the same characters in a plain Text would.
  metrics(px: number, italic: boolean, math: boolean) {
    const font = this.font(px, italic, math);
    let m = metricsCache.get(font);
    if (!m) {
      const probe = this.scene.add.text(0, 0, '', this.textStyle(px, italic, math)).setVisible(false);
      const tm = probe.getTextMetrics();
      m = { ascent: tm.ascent, descent: tm.fontSize - tm.ascent };
      probe.destroy();
      metricsCache.set(font, m);
    }
    return m;
  }

  private measure(text: string, px: number, italic: boolean, math: boolean) {
    const font = this.font(px, italic, math);
    const widthKey = `${font}|${text}`;
    let w = widthCache.get(widthKey);
    if (w === undefined) {
      if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')!;
      measureCtx.font = font;
      w = measureCtx.measureText(text).width;
      widthCache.set(widthKey, w);
    }
    const { ascent, descent } = this.metrics(px, italic, math);
    return { w, ascent, descent };
  }

  box(node: Node, px: number): Box {
    switch (node.t) {
      case 'run': {
        const { w, ascent, descent } = this.measure(node.text, px, node.italic, node.math);
        return {
          width: w,
          above: ascent,
          below: descent,
          draw: (x, baseline) => {
            if (node.text === '') return;
            // Whole pixels: a Phaser Text is a canvas texture, and drawing one
            // at a fractional offset resamples every glyph in it. Script
            // offsets and baselines are both fractions of a font size, so
            // without this most of a formula would sit off the pixel grid
            // while the prose around it sits on it.
            this.container.add(
              this.scene.add
                .text(Math.round(x), Math.round(baseline - ascent), node.text, this.textStyle(px, node.italic, node.math))
                .setOrigin(0, 0)
            );
          },
        };
      }
      case 'row': {
        const boxes = node.items.map((item) => this.box(item, px));
        return {
          width: boxes.reduce((sum, b) => sum + b.width, 0),
          above: Math.max(0, ...boxes.map((b) => b.above)),
          below: Math.max(0, ...boxes.map((b) => b.below)),
          draw: (x, baseline) => {
            let cursor = x;
            for (const b of boxes) {
              b.draw(cursor, baseline);
              cursor += b.width;
            }
          },
        };
      }
      case 'script': {
        const base = this.box(node.base, px);
        const scriptPx = Math.max(SCRIPT_MIN_PX, Math.round(px * SCRIPT_RATIO));
        const sub = node.sub ? this.box(node.sub, scriptPx) : null;
        const sup = node.sup ? this.box(node.sup, scriptPx) : null;
        const subDy = px * SUB_DROP;
        const supDy = -px * SUP_RAISE;
        return {
          width: base.width + Math.max(sub?.width ?? 0, sup?.width ?? 0),
          above: Math.max(base.above, sup ? sup.above - supDy : 0),
          below: Math.max(base.below, sub ? sub.below + subDy : 0),
          draw: (x, baseline) => {
            base.draw(x, baseline);
            sup?.draw(x + base.width, baseline + supDy);
            sub?.draw(x + base.width, baseline + subDy);
          },
        };
      }
      case 'angle': {
        // A chevron drawn to the height of an ordinary glyph, so it sits in a
        // line of text the way the character it stands for would.
        const { ascent, descent } = this.metrics(px, false, true);
        const h = ascent + descent;
        const w = Math.max(3, Math.round(px * 0.34));
        const lw = Math.max(1, Math.round(px / 9));
        const pad = Math.max(1, Math.round(px * 0.08));
        return {
          width: w + pad,
          above: ascent,
          below: descent,
          draw: (x, baseline) => {
            const top = baseline - ascent;
            const x0 = Math.round(x) + (node.open ? pad : 0);
            const t = Math.round(top + h * 0.12);
            const b = Math.round(top + h * 0.88);
            const mid = Math.round(top + h * 0.5);
            const g = this.scene.add.graphics();
            g.lineStyle(lw, Phaser.Display.Color.HexStringToColor(this.style.color).color, 1);
            g.beginPath();
            if (node.open) {
              g.moveTo(x0 + w, t);
              g.lineTo(x0, mid);
              g.lineTo(x0 + w, b);
            } else {
              g.moveTo(x0, t);
              g.lineTo(x0 + w, mid);
              g.lineTo(x0, b);
            }
            g.strokePath();
            this.container.add(g);
          },
        };
      }
      case 'sqrt': {
        const inner = this.box(node.inner, px);
        const signW = Math.round(px * RADICAL_WIDTH);
        const gap = Math.round(px * RADICAL_GAP);
        // Matched to the weight of the glyphs it sits beside -- a hairline
        // radical reads as a stray mark next to 19px text.
        const lw = Math.max(1, Math.round(px / 9));
        // A little air after the radicand so the bar does not stop flush
        // against the last glyph.
        const tail = Math.max(2, px * 0.12);
        return {
          width: signW + inner.width + tail,
          above: inner.above + gap + lw,
          below: inner.below,
          draw: (x, baseline) => {
            const x0 = Math.round(x);
            const inkTop = baseline - inner.above;
            const inkHeight = inner.above + inner.below;
            const barY = Math.round(inkTop - gap);
            const bottom = Math.round(baseline + inner.below);
            const g = this.scene.add.graphics();
            g.lineStyle(lw, Phaser.Display.Color.HexStringToColor(this.style.color).color, 1);
            g.beginPath();
            // The four strokes of a radical: a short entry tick, the deep
            // descent to its point, the rise to the bar, and the bar itself
            // over the whole radicand.
            g.moveTo(x0, Math.round(inkTop + inkHeight * 0.52));
            g.lineTo(x0 + Math.round(signW * 0.3), Math.round(inkTop + inkHeight * 0.42));
            g.lineTo(x0 + Math.round(signW * 0.55), bottom);
            g.lineTo(x0 + Math.round(signW * 0.85), barY);
            g.lineTo(x0 + Math.round(signW + inner.width + tail), barY);
            g.strokePath();
            this.container.add(g);
            inner.draw(x0 + signW, baseline);
          },
        };
      }
    }
  }
}

// Builds a container of Phaser objects rendering `source` -- prose as
// ordinary text, `$...$` spans typeset -- wrapped to `wrapWidth`. The
// container reports its own `width`/`height`, so the panels that stack
// content with `y += element.height` treat it exactly like the Text object
// it stands in for.
export function makeMathText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  source: string,
  style: MathTextStyle
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const layout = new Layout(scene, container, style);
  const px = Math.round(style.fontSizePx);

  // Measured as a difference rather than from a lone space, which a text
  // measurement can report as zero width. One per face: the gaps between
  // words are prose, the gaps inside an expression are math.
  const spaceWidth = (math: boolean) =>
    layout.box({ t: 'run', text: 'm m', italic: false, math }, px).width -
    layout.box({ t: 'run', text: 'mm', italic: false, math }, px).width;
  const proseSpace = spaceWidth(false);
  const mathSpace = spaceWidth(true);
  // Every line starts out as tall as a line of plain prose, whatever it ends
  // up carrying, so a line of words inside a formula-bearing string advances
  // by exactly the line height a plain Phaser Text would give it.
  const prose = layout.metrics(px, false, false);

  // Greedy line breaking, with a formula's own top-level spaces as the only
  // places it may split.
  type Placed = { box: Box; x: number };
  type Line = { placed: Placed[]; width: number; above: number; below: number };
  const lines: Line[] = [];
  let line: Line = { placed: [], width: 0, above: prose.ascent, below: prose.descent };
  const newLine = () => {
    lines.push(line);
    line = { placed: [], width: 0, above: prose.ascent, below: prose.descent };
  };

  let pendingSpace = 0;
  for (const item of tokenize(source)) {
    if (item.t === 'break') {
      newLine();
      pendingSpace = 0;
      continue;
    }
    if (item.t === 'space') {
      if (line.placed.length) pendingSpace = item.math ? mathSpace : proseSpace;
      continue;
    }
    const box = layout.box(item.node, px);
    const lead = pendingSpace;
    if (line.placed.length && line.width + lead + box.width > style.wrapWidth) {
      newLine();
      line.placed.push({ box, x: 0 });
      line.width = box.width;
    } else {
      line.placed.push({ box, x: line.width + lead });
      line.width += lead + box.width;
    }
    line.above = Math.max(line.above, box.above);
    line.below = Math.max(line.below, box.below);
    pendingSpace = 0;
  }
  if (line.placed.length || lines.length === 0) lines.push(line);

  const totalWidth = Math.max(0, ...lines.map((l) => l.width));
  let cursorY = 0;
  for (const l of lines) {
    const originX = style.origin === 'left' ? 0 : -l.width / 2;
    const baseline = cursorY + l.above;
    for (const p of l.placed) p.box.draw(originX + p.x, baseline);
    cursorY = baseline + l.below;
  }

  container.setSize(totalWidth, cursorY);
  return container;
}

// Whether a string carries any formula markup at all. Call sites use this to
// keep every unmarked string on the plain Phaser Text path.
export function hasMath(source: string): boolean {
  return source.includes('$');
}

// The same string with its delimiters removed, for anywhere the raw
// characters are wanted rather than a typeset container.
export function stripMath(source: string): string {
  return source.replace(/\$/g, '');
}

// The two shapes a question panel needs, so the encounter panel
// (OverworldScene.showEncounter), the in-battle Analytic/Ultimate panel
// (BattleScene.renderQuestionPanel) and Feynman's upgrade streak
// (scenes/panels/feynman.ts) all typeset the same way rather than each
// growing its own copy. Both fall straight through to the plain Phaser
// object when the string carries no formula, which is the overwhelming
// majority of question text. Either way the prose is set in the game's
// default face at the game's default line height; MATH_FONT_FAMILY reaches
// only what sits between a pair of `$`.

// A prompt line. Returns something with the `width`/`height` a panel stacks
// its content by, positioned like a Text with setOrigin(0.5, 0).
export function makeQuestionText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  source: string,
  style: MathTextStyle
): Phaser.GameObjects.Text | Phaser.GameObjects.Container {
  if (!hasMath(source)) {
    return scene.add
      .text(x, y, source, {
        fontSize: `${Math.round(style.fontSizePx)}px`,
        color: style.color,
        ...(style.fontStyle ? { fontStyle: style.fontStyle } : {}),
        align: style.origin === 'left' ? 'left' : 'center',
        wordWrap: { width: style.wrapWidth },
      })
      .setOrigin(style.origin === 'left' ? 0 : 0.5, 0);
  }
  return makeMathText(scene, x, y, source, style);
}

export interface FormulaButtonStyle extends MathTextStyle {
  // Phaser fill color for the plate behind the label, matching the
  // `backgroundColor` a plain text button would carry.
  backgroundColor: number;
  padX: number;
  padY: number;
}

// An answer button whose label contains a formula: a drawn plate with the
// typeset label on it, and an explicit rectangular hit area, since a
// container has no text background or automatic input bounds of its own.
// Positioned like a Text button with setOrigin(0.5, 0).
export function makeFormulaButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  style: FormulaButtonStyle,
  onClick: () => void
): Phaser.GameObjects.Container {
  const content = makeMathText(scene, 0, 0, label, style);
  const w = Math.round(content.width + style.padX * 2);
  const h = Math.round(content.height + style.padY * 2);
  content.setPosition(0, Math.round(-h / 2 + style.padY));

  const plate = scene.add.rectangle(0, 0, w, h, style.backgroundColor);
  const button = scene.add.container(x, y + h / 2, [plate, content]);
  button.setSize(w, h);
  // The hit area is measured from the container's own top-left corner, not
  // from its centre where its children are placed: Phaser offsets the local
  // point it tests by the display origin before handing it to the callback.
  // A rectangle spanning -w/2..w/2 therefore covers only the quarter of the
  // button where the two ranges happen to overlap.
  button.setInteractive({
    hitArea: new Phaser.Geom.Rectangle(0, 0, w, h),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    useHandCursor: true,
  });
  button.on('pointerdown', onClick);
  // A container has no `text` of its own, and both headless harnesses
  // (scripts/component-check.mjs, scripts/playthrough-check.mjs) find a
  // clickable by looking for an interactive object with a string `text`.
  // Carrying the label's plain reading here keeps an answer with a formula
  // in it as findable -- and as clickable -- as any other button.
  (button as unknown as { text: string }).text = stripMath(label);
  return button;
}
