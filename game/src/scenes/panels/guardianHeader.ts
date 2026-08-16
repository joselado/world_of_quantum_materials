import type Phaser from 'phaser';
import type { GuardianPanelHost } from '../OverworldScene';
import { playGuardianChime } from '../../audio/sfx';
import { CANVAS_W } from '../../art/perspective';

// The block every guardian panel opens with: that guardian's own avatar,
// large, with their opening line beside it.
//
// One helper rather than the same dozen lines copied into all eleven panels
// (the ten bespoke ones in this folder plus OverworldScene's showGuardianLore
// fallback), so a guardian panel never needs an avatar/quote positioning pass
// of its own and the roster reads as one cast rather than eleven layouts. The
// panel that opens when the player walks up to a guardian mid-corridor and the
// one that opens when they click that guardian's avatar in the Lab are the
// same function (`GuardianDef.open`), so both get this by construction.
//
// **Portrait beside the line, not above it.** The avatar is the guardian --
// the roster is deliberately ten figures of light rather than ten faces, and
// at the size a stacked layout could afford, several of them read as an icon
// of a figure rather than the figure. Standing it in its own column and
// letting the quote take the room next to it buys the portrait roughly twice
// the size while costing the panel *less* height than stacking did, because
// the tall header and the tall quote now overlap instead of adding. That
// matters: these are the densest panels in the game (a list, a detail pane, a
// footer under this block), and the tightest of them clears the canvas floor
// by a couple of dozen pixels at the Large text preset.
const PORTRAIT_SCALE = 2;
// How far the widest-reaching guardian's art actually paints from its own
// origin, per unit of scale -- measured from a live headless render the same
// way battle/hud.ts's crystal offsets are (every builder draws pure light with
// a glow around it, so a nominal size would understate all ten). Skłodowska-
// Curie is the reach in every direction: RISE up, SPAN top to bottom, HALF_W
// to either side. Sized off the worst of the roster rather than per guardian
// so the ten read as one cast standing at one size, and so a new guardian
// drops into the same box without a layout pass.
const PORTRAIT_RISE = 44;
const PORTRAIT_SPAN = 77;
const PORTRAIT_HALF_W = 39;
// The column the portrait stands in, with a little air either side of the
// widest of them.
const PORTRAIT_BOX_W = Math.round(PORTRAIT_HALF_W * 2 * PORTRAIT_SCALE) + 14;
// Panel edge to portrait column, portrait column to quote, and header block to
// whatever the panel lays out under it.
const EDGE_PAD = 20;
const PORTRAIT_TO_QUOTE = 14;
const BELOW_HEADER = 12;
// The idle float, kept smaller than the stacked layout's since the portrait it
// moves is twice the size -- the same travel would read as drifting rather
// than breathing.
const FLOAT_TRAVEL = 6;

// Lays the header out from a running `y` (the panel's own top) and returns the
// `y` the panel's next element starts at. `introPx` is passed in rather than
// derived here because several panels cap their own intro font below the
// text-size setting (a guardian with a long opening line would otherwise own
// the whole panel at the Large preset) and this block must not quietly
// override that.
export function renderGuardianHeader(
  scene: GuardianPanelHost,
  container: Phaser.GameObjects.Container,
  opts: {
    y: number;
    panelWidth: number;
    avatar: (scene: Phaser.Scene, scale?: number) => Phaser.GameObjects.Container;
    quote: string;
    introPx: string;
  }
): number {
  const left = CANVAS_W / 2 - opts.panelWidth / 2;
  const portraitX = left + EDGE_PAD + PORTRAIT_BOX_W / 2;
  const quoteLeft = left + EDGE_PAD + PORTRAIT_BOX_W + PORTRAIT_TO_QUOTE;
  const quoteWidth = left + opts.panelWidth - EDGE_PAD - quoteLeft;

  // Left-aligned rather than centered: a centered block beside a portrait
  // leaves a ragged left edge running down the middle of the panel, where the
  // eye expects the line to start where the figure stops.
  const intro = scene.add
    .text(quoteLeft, 0, opts.quote, {
      fontSize: opts.introPx,
      fontStyle: 'italic',
      color: '#cfd8ff',
      align: 'left',
      wordWrap: { width: quoteWidth },
    })
    .setOrigin(0, 0.5);
  container.add(intro);

  // The band is as tall as whichever of the two needs more: the portrait's own
  // painted span, or a long opening line running past it. The shorter one
  // centres against the band -- a short line floating level with the
  // portrait's middle, a tall column of text with the portrait centred in it.
  const portraitHeight = PORTRAIT_SPAN * PORTRAIT_SCALE + FLOAT_TRAVEL;
  const bandHeight = Math.max(portraitHeight, intro.height);
  // The avatar's own origin is not the middle of what it paints -- every one
  // of them reaches further up than down -- so it is hung from the top of the
  // band by the measured rise rather than centred on the band's middle. That
  // is what keeps the tallest of them off the panel's own top edge while the
  // band stays only as deep as the art actually needs.
  const portraitY = opts.y + Math.max(PORTRAIT_RISE * PORTRAIT_SCALE + FLOAT_TRAVEL / 2, bandHeight / 2);

  const avatar = opts.avatar(scene, PORTRAIT_SCALE);
  avatar.setPosition(portraitX, portraitY - FLOAT_TRAVEL / 2);
  container.add(avatar);
  scene.tweens.add({
    targets: avatar,
    y: portraitY + FLOAT_TRAVEL / 2,
    duration: 1400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  intro.setY(opts.y + bandHeight / 2);

  playGuardianChime();
  return opts.y + bandHeight + BELOW_HEADER;
}
