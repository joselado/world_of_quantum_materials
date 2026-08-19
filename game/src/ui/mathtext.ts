import Phaser from 'phaser';

// Formula rendering for the physics questions. Quiz prompts and answers
// (data/quiz.ts) mark their formulas with `$...$`; inside those delimiters a
// small math grammar is typeset properly -- subscripts drop, superscripts
// rise, a square root gets a real radical sign with a bar over its radicand --
// instead of being read as literal punctuation. Everything outside the
// delimiters is ordinary prose and is laid out exactly like the surrounding
// UI text.
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

// A run's own text is drawn by a Phaser Text object; scripts are the same
// object at a smaller size, offset from the base run's top edge. The offsets
// are fractions of the size being scripted, so they hold at every
// FONT_SCALE_PRESETS setting (ui/text.ts) rather than only at the default.
const SCRIPT_RATIO = 0.72;
const SUB_SHIFT = 0.36;
const SUP_SHIFT = 0.28;
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
  | { t: 'run'; text: string; italic: boolean }
  | { t: 'script'; base: Node; sub?: Node; sup?: Node }
  | { t: 'sqrt'; inner: Node }
  | { t: 'row'; items: Node[] };

// One entry in the flat stream the line-wrapper works on: a break
// opportunity, a forced newline, or a piece of typeset content.
type Item = { t: 'space' } | { t: 'break' } | { t: 'node'; node: Node };

function row(items: Node[]): Node {
  return items.length === 1 ? items[0] : { t: 'row', items: mergeRuns(items) };
}

// Adjacent single-character runs of the same slant collapse into one Text
// object, so a formula costs a handful of game objects rather than one per
// glyph. Scripts and radicals are their own nodes, so nothing merges across
// them.
function mergeRuns(items: Node[]): Node[] {
  const out: Node[] = [];
  for (const item of items) {
    const prev = out[out.length - 1];
    if (item.t === 'run' && prev && prev.t === 'run' && prev.italic === item.italic) {
      out[out.length - 1] = { t: 'run', text: prev.text + item.text, italic: prev.italic };
    } else {
      out.push(item);
    }
  }
  return out;
}

class MathParser {
  private i = 0;
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
      if (this.src[this.i] === ' ') {
        this.i += 1;
        flush();
        items.push({ t: 'space' });
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
    return parts.length ? row(parts) : { t: 'run', text: '', italic: false };
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
        sup = { t: 'run', text: c, italic: false };
      } else if (c !== undefined && SUP_CHARS[c] !== undefined) {
        sup = { t: 'run', text: this.takeMapped(SUP_CHARS), italic: false };
      } else if (c !== undefined && SUB_CHARS[c] !== undefined) {
        sub = { t: 'run', text: this.takeMapped(SUB_CHARS), italic: false };
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
      return { t: 'run', text: word[0], italic: /^[A-Za-z]+$/.test(word[0]) && !UPRIGHT_WORDS.has(word[0]) };
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
        return { t: 'run', text: word, italic: false };
      }
    }
    this.i += 1;
    return { t: 'run', text: c ?? '', italic: c !== undefined && ITALIC_LETTER.test(c) };
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
      else if (/^[ \t]+$/.test(part)) items.push({ t: 'space' });
      else items.push({ t: 'node', node: { t: 'run', text: part, italic: false } });
    }
  });
  return items;
}

// ---------------------------------------------------------------- layout

// A laid-out piece of a formula. `above`/`below` are ink extents measured
// from the box's own top edge -- the line a plain run's Text object sits on --
// so a superscript reports `above > 0` and pushes its whole line down, and a
// subscript reports a `below` past the run's own height.
interface Box {
  width: number;
  above: number;
  below: number;
  draw(x: number, top: number): void;
}

// Measuring a run means building a Phaser Text and reading it back, which is
// far and away the expensive part of this module -- and the panels that use
// it re-render the same strings repeatedly while shrinking to fit
// (BattleScene.renderQuestionPanel). Sizes are cached across every build for
// the life of the page; the key set is bounded by the authored question text.
const measureCache = new Map<string, { w: number; h: number }>();

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

  private textStyle(px: number, italic: boolean) {
    const weight = this.style.fontStyle ?? '';
    const slant = italic ? 'italic' : '';
    const fontStyle = [slant, weight].filter(Boolean).join(' ');
    return {
      fontSize: `${px}px`,
      color: this.style.color,
      ...(fontStyle ? { fontStyle } : {}),
    };
  }

  private measure(text: string, px: number, italic: boolean) {
    const key = `${px}|${italic}|${this.style.fontStyle ?? ''}|${text}`;
    const hit = measureCache.get(key);
    if (hit) return hit;
    const probe = this.scene.add.text(0, 0, text, this.textStyle(px, italic)).setVisible(false);
    const size = { w: probe.width, h: probe.height };
    probe.destroy();
    measureCache.set(key, size);
    return size;
  }

  box(node: Node, px: number): Box {
    switch (node.t) {
      case 'run': {
        const { w, h } = this.measure(node.text, px, node.italic);
        return {
          width: w,
          above: 0,
          below: h,
          draw: (x, top) => {
            if (node.text === '') return;
            this.container.add(
              this.scene.add.text(x, top, node.text, this.textStyle(px, node.italic)).setOrigin(0, 0)
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
          draw: (x, top) => {
            let cursor = x;
            for (const b of boxes) {
              b.draw(cursor, top);
              cursor += b.width;
            }
          },
        };
      }
      case 'script': {
        const base = this.box(node.base, px);
        const scriptPx = Math.max(7, Math.round(px * SCRIPT_RATIO));
        const sub = node.sub ? this.box(node.sub, scriptPx) : null;
        const sup = node.sup ? this.box(node.sup, scriptPx) : null;
        const subDy = px * SUB_SHIFT;
        const supDy = -px * SUP_SHIFT;
        return {
          width: base.width + Math.max(sub?.width ?? 0, sup?.width ?? 0),
          above: Math.max(base.above, sup ? sup.above - supDy : 0),
          below: Math.max(base.below, sub ? sub.below + subDy : 0),
          draw: (x, top) => {
            base.draw(x, top);
            sup?.draw(x + base.width, top + supDy);
            sub?.draw(x + base.width, top + subDy);
          },
        };
      }
      case 'sqrt': {
        const inner = this.box(node.inner, px);
        const signW = px * RADICAL_WIDTH;
        const gap = px * RADICAL_GAP;
        const lw = Math.max(1, Math.round(px / 11));
        // A little air after the radicand so the bar does not stop flush
        // against the last glyph.
        const tail = Math.max(2, px * 0.12);
        return {
          width: signW + inner.width + tail,
          above: inner.above + gap + lw,
          below: inner.below,
          draw: (x, top) => {
            const barY = top - inner.above - gap;
            const bottom = top + inner.below;
            const g = this.scene.add.graphics();
            g.lineStyle(lw, Phaser.Display.Color.HexStringToColor(this.style.color).color, 1);
            g.beginPath();
            g.moveTo(x, top + inner.below * 0.55);
            g.lineTo(x + signW * 0.22, top + inner.below * 0.42);
            g.lineTo(x + signW * 0.52, bottom);
            g.lineTo(x + signW * 0.82, barY);
            g.lineTo(x + signW + inner.width + tail, barY);
            g.strokePath();
            this.container.add(g);
            inner.draw(x + signW, top);
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
  // measurement can report as zero width.
  const spaceWidth =
    layout.box({ t: 'run', text: 'm m', italic: false }, px).width -
    layout.box({ t: 'run', text: 'mm', italic: false }, px).width;
  const plainHeight = layout.box({ t: 'run', text: 'Mg', italic: false }, px).below;

  // Greedy line breaking, with a formula's own top-level spaces as the only
  // places it may split.
  type Placed = { box: Box; x: number };
  type Line = { placed: Placed[]; width: number; above: number; below: number };
  const lines: Line[] = [];
  let line: Line = { placed: [], width: 0, above: 0, below: plainHeight };
  const newLine = () => {
    lines.push(line);
    line = { placed: [], width: 0, above: 0, below: plainHeight };
  };

  let pendingSpace = false;
  for (const item of tokenize(source)) {
    if (item.t === 'break') {
      newLine();
      pendingSpace = false;
      continue;
    }
    if (item.t === 'space') {
      if (line.placed.length) pendingSpace = true;
      continue;
    }
    const box = layout.box(item.node, px);
    const lead = pendingSpace ? spaceWidth : 0;
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
    pendingSpace = false;
  }
  if (line.placed.length || lines.length === 0) lines.push(line);

  const totalWidth = Math.max(0, ...lines.map((l) => l.width));
  let cursorY = 0;
  for (const l of lines) {
    const originX = style.origin === 'left' ? 0 : -l.width / 2;
    const top = cursorY + l.above;
    for (const p of l.placed) p.box.draw(originX + p.x, top);
    cursorY = top + l.below;
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
// majority of question text.

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
  const w = content.width + style.padX * 2;
  const h = content.height + style.padY * 2;
  content.setPosition(0, -h / 2 + style.padY);

  const plate = scene.add.rectangle(0, 0, w, h, style.backgroundColor);
  const button = scene.add.container(x, y + h / 2, [plate, content]);
  button.setSize(w, h);
  button.setInteractive({
    hitArea: new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
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
