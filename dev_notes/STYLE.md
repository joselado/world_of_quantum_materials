# Style Notes

Living record of current visual/style decisions for the game (`game/src/art/`,
`game/src/world/`, `game/src/scenes/OverworldScene.ts`, `game/src/scenes/BattleScene.ts`).
Companion to `DESIGN.md` (mechanics/content) and `CODEMAP.md` (where things live in the
code); this file covers "how things currently look" -- sizes, colors, shapes. Edit in place
as choices change; when a new decision replaces an old one, remove the old entry rather
than appending a changelog, so this always reflects current reality.

## Player-facing writing

**No em dashes, and no `--` dash punctuation, in anything a player reads.** That is
`README.md`, `docs/*.md`, the built `guide.pdf`, and every string a player sees on screen:
materialdex blurbs, quiz prompts and explanations, guardian dialogue, world lore, story
beats, tutorial pages, settings labels, battle log lines. Use a comma, a colon,
parentheses, bold/italic, or a sentence split instead, whichever reads best in that line.
Rewrite the sentence rather than swapping the character: a blind replacement leaves comma
splices behind.

The line is drawn by audience, not by file. A string literal in `game/src/` is player-facing
and in scope; the comment above it is not. Code comments, `dev_notes/**` (this file
included) and `game/scripts/**` keep the repo's existing `--` style, and most `--` in the
repo lives there.

**No paper citations in anything a player reads.** No author names as attribution, no
`et al.`, no journal, volume or year, no arXiv number, in Materialdex blurbs, quiz prompts
and options, guardian dialogue, world lore, story beats, tutorial pages, `README.md`,
`docs/*.md` or the built `guide.pdf`. A blurb states the physics on its own authority; the
player is here to learn what a compound does, and a reference they cannot follow mid-battle
only crowds the sentence. Drop the bibliographic part and keep the physics claim, rewriting
the sentence so it still reads: "the largest quantum spin Hall gap anyone has measured, close
to 0.8 eV" says everything the citation after it did.

What is *not* a citation, and stays: eponymous physics vocabulary (the Bernevig-Hughes-Zhang
model, Kane-Mele, Haldane, Stoner, Kramers' theorem, Yu-Shiba-Rusinov states), the guardians'
own names, and a bare era when the timing is the point ("a 2023-2024 result", "the first
experimental confirmation") as long as no paper is being pointed at.

The same audience line applies as for dashes: code comments, `dev_notes/**` (`DESIGN.md`'s
roster tables included) and `game/scripts/**` keep their citations, and should, since that is
where a compound's provenance is recorded for whoever has to check the physics later. Removing
a citation from a player string is not a reason to remove it from the comment above it.

**Say "quantum material" where it fits, and "crystal" where it doesn't.** The player is a
quantum material, and that is the phrase to reach for first, in the game as well as in the
docs: it is the term the audience arrives with and the one the course is named for. "Crystal"
stays available and is the right word wherever the full phrase runs long or lands twice in a
sentence, and it remains the game's own everyday noun for the things you meet and fight.

`README.md`'s opening paragraph carries the punchline in its first lines rather than building
to it: you are a quantum material, fighting real compounds with the quasiparticles your own
lattice can host. A visitor deciding in three seconds should meet that, not a description of
the course it teaches.

## The cost rule

**Speed beats spectacle. Every visual must stay affordable to simulate, and an
effect that is not affordable does not ship.** This outranks how good an effect
looks: a frame the game renders quickly is worth more than one that impresses,
and there is no visual in this game important enough to be paid for in frame
time.

**Lag during gameplay is not acceptable.** This is a requirement, not a
preference, and it is not tradeable against any visual. The game must hold a
steady frame while the player is *playing* — walking the overworld, taking a
turn in battle, opening a panel. A hitch is as disqualifying as a low average:
one long frame when a scene loads, a world regenerates, or an effect first fires
is a defect, not a cost of doing business, because it lands exactly where the
player is acting.

Judge it where it is felt. A static frame that renders quickly proves nothing —
measure while walking, mid-battle, and across a scene transition, since that is
where the work actually happens. Per-step and per-frame code paths are the ones
to watch: anything that runs on every player step is on the critical path for
lag even though it is not, strictly, rendering.

What this means in practice:

- **Measure, don't estimate.** An effect's cost is a number obtained by timing
  frames with and without it on the same seed, not a judgement that it "should
  be cheap". Claims about performance without a measurement are not claims.
- **Draw distance is not optional.** Anything drawn per tile rides the existing
  falloff (`AccentTile`'s `depth`, `haze` and `detail`) and stops being drawn
  before the horizon. The overworld trees are the precedent: their falloff
  exists because drawing them all the way out was not affordable.
- **Prefer the cheap suggestion to the real simulation.** Suggest a reflection
  with a few soft shapes rather than mirroring a scene; suggest depth with
  shading rather than geometry. The engine draws flat ground for the same
  reason.
- **Per-frame work is the budget; build-once work is nearly free.** An effect
  computed once when a scene or panel is built costs almost nothing; the same
  effect recomputed every frame is what ends up being cut.
- **Know what a Phaser draw call costs before reaching for it.** Phaser
  re-tessellates a Graphics object's whole command list on every frame it
  renders, and three of its convenience calls carry a price their signature
  does not show:
  - **A filled path runs through a general polygon triangulator**, so a shape
    whose triangles are already known should say so. `art/shapes.ts`'s
    `fillPolygon` fills a four-point convex shape (every projected tile) as two
    triangles instead, and `drawSilhouette`-style ribbons are drawn as a strip
    of quads.
  - **A path that touches itself is far worse than one that does not** -- the
    triangulator drops to a recovery path quadratic in the point count. An
    outline whose two sides can meet (a crest line clamped against its own
    floor) is the case to watch.
  - **`fillCircle` tessellates to about a hundred segments whatever its
    radius.** Use `art/shapes.ts`'s `fillDot`, which sizes the count off the
    radius the way `ellipseSteps` does for every other round shape.
- **When an effect cannot be made affordable, cut it and say so.** Shipping a
  cost quietly is the failure mode this rule exists to prevent.

## The contact rule

**Anything with feet stands on the ground, and nothing lifts it off.** A gem
hovers, a qumatessence cloud drifts, a guardian may be adrift on purpose -- but
a figure the player reads as *standing* (a rival's golem above all) has to meet
the floor and stay met. Two things break it, and both are easy to do by
accident:

- **Never tween the root `y` of a sprite that carries its own contact shadow.**
  The shadow lives inside that container, so lifting the root lifts the shadow
  with it and the whole assembly slides over the ground -- the exact signature
  of hovering. The golem is excluded from the overworld's wander/bob
  (`WorldSprite.still`), from `BattleScene.bobCrystal`, and from any idle tween
  on the taunt page for this reason. Idle life comes from *inside* instead:
  `makeBossCrystal`'s rig is pivoted at the feet, so it breathes, leans and
  shifts its weight without the contact point ever moving.
- **The darkest pixel must be the contact point.** A contact shadow drawn
  *under* an additive glow gets washed into a bright disc, and a bright disc
  beneath a figure reads as the pad it is hovering over. Ground glow first,
  dark shadow on top of it, art on top of that.

Where a scene has its own floor line, the feet meet *that* line rather than
approximately near it: in battle the arena floor at a combatant's spot is
`GROUND_DROP` below its anchor (the same line every ground-anchored attack
effect lands on), so the golem is built with `footDrop: SHADOW_DROP` and its
feet, its own shadow, the arena's painted shadow and any impact rune all
coincide. One shadow, one line. Two ellipses at slightly different heights
under one figure reads as floating even when neither is wrong on its own.

## Title screen (`scenes/TitleScene.ts`)

- Dark indigo gradient (`0x0c1030` → `0x241a44`), no biome/perspective machinery involved --
  this screen exists to load the save (see DESIGN.md §7) and hand off to the Hub, not to be a
  world of its own. The mode-dependent content (showcase, title, button, mode picker, hint)
  is built inside one container, laid out top-down in the container's own local coordinates
  first; only once the whole stack's real height is known does the container get offset
  (`root.y = Math.max(6, Math.round((CANVAS_H - this.mapReserve - y) / 2))`) so the *whole
  composition* centers vertically in the space above the bottom map, the same
  measure-then-center pattern `confirmNewGame` below uses
  for its own popup -- needed here because the stack's real height depends on both the save
  state (an existing save adds an "erase save" line) and the Settings panel's text-size preset.
- Two framing elements sit outside that container (they depend on neither mode nor save, so a
  mode switch never rebuilds them), both beneath it in the display list so the content always
  draws over them where they meet:
  - **The finished star network** (`art/stars.ts`'s `drawStarNetwork` with `world: 10`) as a
    tight figure at half scale (alpha `0.75`) across the top of the screen, above the showcase
    crystals, blended toward the gradient's own top colour and redrawn each frame in `update()`
    for its twinkle. Deliberately the *finished* network: to a new player it reads as a
    constellation; to anyone who has walked Worlds 7-10 it is the Devouring Mirror's model,
    already lurking over the title. Drawn tight rather than spread, so it reads as one figure
    with a shape rather than as scattered links -- which is the whole point, since the thing it
    is a picture of is a network. Earlier stages would say less. That showing the completed
    network here is not the reveal it would be inside a world is what the title screen's
    position buys: it sits outside the four-world progression the star arc runs across
    (`WORLDS.md` section 1), so "the stages only ever add" is untouched by it.
  - **The Qumatuomi map** (`art/qumatuomiMap.ts`, `560`px wide at alpha `0.17`) as a ghost
    landmass behind the whole content stack. It always shows all ten worlds discovered -- like
    the showcase it is a "world full of places" branding image, not a reflection of the
    player's own save. Held at that alpha because it sits *under* the title, buttons and mode
    picker rather than beside them: it is there to be recognised on a second look, and text
    legibility wins wherever the two compete.
- Title text reads "WORLD OF QUANTUM MATERIALS" (`30px` bold, white), the screen's visual
  anchor -- big enough and high enough in the stack that the showcase and mode picker below
  read as framing it rather than the other way around. Its font size is capped at the
  "Normal"/1.5x text-size preset (`Math.min(fontScale(this), 1.5)`) rather than scaling all the
  way to "Large"/2x like most of this screen's other text: at an uncapped 2x it would wrap to
  two lines and roughly double its own height, which the mode picker and hint below don't have
  spare vertical room to absorb (same reasoning `OverworldScene`'s own fixed-geometry text
  applies). Button label reads "Continue" if a save exists for the currently selected mode
  (`data/save.ts`'s `hasSave(superposition)`) or "New Game" otherwise, updating live if the
  mode picker below is switched; both SPACE and a click on the button start the Hub.
- Above the title text, a "character-select roster" showcase (`drawShowcaseCrystals`, the
  module-level `FAR_SHOWCASE`/`NEAR_SHOWCASE` arrays) covering all 13 of `data/materials.ts`'s
  `TYPE_LOOK` entries at once, not tied to the player's own save/current form, since this is a
  "world full of different materials" branding image rather than a "welcome back" one (the Hub
  is where the player's own crystal gets its own moment). Two rows rather than one cluster, so
  the whole thing stays a shallow band instead of competing with the title/mode picker for
  vertical space: a back row of 8 smaller crystals spread across most of the canvas width, and a
  front row of 5 bigger ones closer to center with a biggest centered "hero" (`quantumSpinHall`,
  drawn last so it renders on top) flanked by two decreasing-size pairs. Each crystal bobs on
  its own independent duration/delay so the roster reads as alive rather than a single
  synchronized animation.
- The **mode picker** (`addModeSelector`) sits between the button/erase-save line above and the
  "Press SPACE..." hint below -- two text buttons, "Story Mode" and "Superposition Mode", both
  backed by the same `superpositionMode` boolean (Story Mode is just its `false` state),
  separated by a noticeably wide `50`px gap (not the two buttons' own padding) so each button
  plus its own caption reads as a self-contained choice rather than two options crammed
  together. The active one highlights (`#ffff88` yellow for Story, `#ff8fa0` warning pink for
  Superposition, each with a lighter `#33335a` background) while the inactive one dims to
  `#8fa0c9`/`#1a1a2e`. Each button has its own one-line dim caption directly beneath it (not a
  single caption centered under the pair) spelling out what that mode does ("Trace the
  Decoherence." under Story, "Everything, unlocked." under Superposition); each caption's own
  `wordWrap` width is derived from how far apart the two buttons actually rendered
  (`superBtn.x - storyBtn.x - 40`, floored at `140`) rather than a fixed constant, so the two
  caption boxes never meet in the middle regardless of text-size preset. The captions (not the
  button labels themselves, which keep the same uncapped scale as the rest of this screen's
  controls) are capped at the same 1.5x scale as the title, for the same fixed-geometry reason.
  Deliberately placed on the title screen, as a choice made before starting a run, rather than
  toggleable mid-run.

## The Hub (`scenes/HubScene.ts`, world 0)

- A single static room, not a walkable map, built entirely from `drawRoom()`'s one-time
  Graphics calls (no `update()` on this scene, so the extra detail below costs nothing per
  frame): a dark band ceiling (`y` 0-46) with three recessed light-panel glows and a seam line
  marking where it meets the back wall; the wall itself the same dark blue-purple gradient the
  room always had (`0x1a1a2e` → `0x242440`), now confined between that ceiling seam and the
  floor rather than spanning the whole canvas, carrying a pair of conduit pipes with rivets and
  two dark wall-mounted instrument panels with a faint glow and scanlines (purely decorative --
  neither is a station); a workbench/counter band along the wall's base (cabinet-door seams, a
  lit top edge) that the stations stand in front of; and a tiled/grating floor (alternating
  flat-color tiles plus a full grid of seam lines -- each tile still a single flat color, no
  per-tile diagonal shading, same "floors read better flat" rule as the overworld's own ground
  tiles). A soft additive-blended glow pools on the floor beneath where the player's own
  floating crystal (`makeCrystal`) sits -- the only crystal render drawn anywhere in the room
  itself, so the room reads as *the player's* space rather than a shelf of specimens. No
  perspective/camera machinery -- everything is laid out at fixed canvas coordinates. The two
  upper corners hold the guardian gallery (see "The Lab's guardian gallery" below).
- **Up to nine stations, packed into rows of three, no crystal icons.** Every station is a
  plain gold-on-dark-blue text button (`HubScene.addStationRow`, same look every dialogue
  button in the game uses), not an icon a player clicks -- there is no `makeCrystal` render
  anywhere in the station rows. Qumatex and the door onward always exist and always lead the
  grid, in that order. The door's label names its destination (`data/materials.ts`'s
  `worldName()`, the same names Bloch's rows and each world's own entry banner use) rather than
  its number: "Enter `<name>`" for
  `HubScene.highestUnlockedWorld()` (walking `rivalDefeated` from world 1 until it finds one
  not yet beaten) the first time that world is ever stepped into, or "Back to `<name>`" once it
  is -- `HubScene.canResumeWorld()` is
  the single predicate both the label and the door's own click/Enter-key navigation read,
  checking that the world is in the persisted `visitedWorlds` *and* that the registry's own
  `mapState` (`OverworldScene`'s in-progress map/position snapshot, written by
  `saveMapState()`/`returnToHub()` -- see "Overworld path" below) still belongs to that exact
  world, since `mapState` is registry-only and doesn't survive a page reload the way
  `visitedWorlds` does; sharing one predicate is what keeps the label and the actual
  resume-or-regenerate outcome from ever disagreeing. "Back to `<name>`" always resumes the
  player's exact saved position in that world; "Enter `<name>`" always generates a fresh map. In
  Superposition Mode the door always reads "Enter `<World 1's name>`" and always drops the player straight
  into a fresh World 1, same as Story Mode's own first entry -- `canResumeWorld()` never
  returns true in this mode, since the mode's own teleport-anywhere design (below) makes a
  single "resume where I left off" door meaningless once Bloch's hub can jump to any visited
  world instead. Pressing Enter while standing in the Lab is the reverse of `OverworldScene`'s
  own Enter/H (which send the player *to* the Hub, saving `mapState` as they leave): it sends
  the player back to exactly the world and position `mapState` holds (`HubScene.resumeWorld()`),
  which is not necessarily the door station's own frontier-world target -- opening the Lab from
  an earlier world (Bloch's teleport hub, or walking back through an earlier world's own door)
  and pressing Enter again lands the player back in that same earlier world, not the door's
  "Back to `<name>`." A no-op when there's nothing resumable (a fresh save with nothing in
  progress yet has nothing to send Enter back to), and never fires while a Lab panel is open,
  matching every station's own one-panel-at-a-time guard. From there the player can
  walk to World 2 to reach Bloch, or click Bloch's own avatar in the Lab once he's been met
  once -- either way, in Superposition Mode his teleport hub
  offers every built world immediately, with no separate warp/world-select panel, though
  every world also has its own walkable doors back to the Hub/previous world and
  onward to the next one. Right after Qumatex and the door, in the
  same grid, come the seven reference/settings stations (`scenes/panels/hubStations.ts`'s
  `LAB_STATIONS` -- Moves, Stats, Abilities, Tutorial, Story, Settings, Title Screen), filtered down to
  whichever the player has actually unlocked: Abilities only appears once the player has
  learned a first passive (`passivesUnlocked` non-empty) -- Superposition Mode treats it as
  unlocked from the start, since it already grants every passive regardless. Moves,
  Stats, Tutorial, Story, Settings and Title Screen are never gated, so a fresh save always shows
  those six alongside Qumatex and the door (eight stations total, two full rows of three and a
  trailing row of two) even with the gated station not visible yet. The full station list --
  Qumatex, the door, then whichever of the seven `LAB_STATIONS` are visible -- is packed into
  rows of three with no gaps, rather than reserving a fixed grid slot for a station that isn't
  visible yet or giving Qumatex/the door a row of their own; a count that doesn't divide evenly
  by three (eight stations, or nine with the gated station unlocked) just trails off short on
  its last row rather than every row being forced full. Every station (Qumatex, the door, and all seven `LAB_STATIONS` entries) gets its own small
  `art/labMotifs.ts` icon planted just to the left of its button label (`HubScene.addStationRow`,
  `STATION_MOTIF_SIZE = 26`, fixed-px, never scaled by the Text Size setting) -- much smaller
  than the same builder would draw inside a full panel, since here it sits inline with a
  compact button; Qumatex's own icon (`makeQumatexMotif`, a small 2x2 grid of tiny faceted
  gems reading as "an indexed catalog") is distinct from the panel's own detail pane, which
  renders one full-size real crystal for whichever compound is currently selected. The door's
  (`makeDoorMotif`) is a small freestanding frame -- lightly rounded so it still reads as a
  doorway rather than one more gem, with a dark inset and a lit opening inside it, slowly
  pulsing, the one Lab motif that animates -- its additive halo spilling past the frame on
  every side: an opening out in the worlds is a notch in terrain leading to one fixed
  neighbour, and an opening standing in nothing is the Lab's, which leads anywhere
  (WORLDS.md §4's "the same aperture grammar, unbound"). What the opening shows is wherever
  the player is currently going: `setDoorMotifDestination` tints both opening and halo with
  that world's own walkable ground lifted toward its low sky (`blend(path, skyBottom, 0.3)`,
  the same pair the pass aperture out in the worlds reads), and `HubScene.refreshDoorPreview`
  re-points it live as Bloch's travel panel moves its selection, so changing your mind
  re-colours the door in the same gesture. The opening shows a palette, never scenery -- a
  visible far end would imply an exterior the Lab must not have. The grid is laid out from
  `STATION_ROW_TOP` (`330`) and lifted as a whole by however much it overshoots a `10`px bottom
  margin, since a long door label wraps to two or three lines at the Large text size. Every
  station is a no-op while another panel is already open (one panel at a time).
- **Every one of the Lab's seven non-door panels reads as one coherent design** -- dark
  rounded-rectangle-with-stroke chrome and a bold gold (`#ffe066`) heading -- rather than
  several visually separate eras bolted together. Panel content is always laid out top-down
  first (a running `y`, each element's own measured height advancing it) and centered within
  the panel's own width, margined in from both edges (`scenes/panels/hubStations.ts`'s
  `labPanelColumns`), with the background rectangle sized and inserted behind everything
  (`container.addAt(..., 0)`) only once the real final height is known, the same pattern this
  file's own "Paginated candidate lists" section documents for row-based panels. A panel's own
  themed motif (Moves' jagged orange energy bolt, Stats' small ascending bar chart, Abilities'
  shield with a white emblem, Tutorial's small open book,
  Settings' meshed pair of gears -- all in `art/labMotifs.ts`) is never drawn inside the panel
  itself; it sits beside that station's own button out in the room instead (previous bullet),
  so panel content gets the panel's full width rather than sharing it with a left-side icon
  column.
- **Qumatex** (`HubScene.renderMaterialdexPanel`) is a two-column index over every real
  compound in the game (`data/materials.ts`'s `allCrystals()`, alphabetical by name), not just
  ones the player has found -- an undiscovered entry still gets a slot, masked to a "???" name
  in both columns, a generic "Not yet discovered" blurb, and a flat dim-grey (`0x33394a`)
  silhouette in place of the compound's own rendered look, rather than the index only ever
  growing as the player finds things. Panel (`720` wide) stroked purple (`0x9a6ad9`). Its title
  line carries a small purple prism icon of its own (`makeCrystal(this, 16, 0x9a6ad9, 'prism')`)
  since its two-column list/detail layout has no room for a full left-side motif column and its
  right-column crystal render (below) already reads as a themed motif in its own right. The
  **left column** (`scenes/panels/listDetail.ts`'s `renderListColumn`, see "List+detail panels"
  below) lists every (filtered) entry's own name as its own clickable row -- as many as fit on
  one screen at the current text-size preset, a selected row highlighted gold-on-purple, with
  `<- Prev`/`Next ->` and a `Page N/M` label appearing only once the full list outgrows one
  page. A row whose own label would run past the column's width is trimmed to an ellipsis
  (`fitListLabel`, measured against the text's actual rendered width at the current font-scale
  preset) rather than wrapped, since wrapping would make row heights uneven and break the
  page-fit math. The **right column** stays this panel's own render (list+detail's shared
  scaffolding covers the left column only, since a detail pane's content genuinely differs
  panel to panel): whichever row is currently selected, shown as the compound's own crystal
  render (`makeCrystal` at the shared `DETAIL_CRYSTAL_SIZE`, `44`), name, and physics blurb
  (`materialdex.ts`'s `materialBlurb`) -- the blurb's font shrinks in whole-px steps (floor `9`) if a long entry
  would otherwise push the panel's footer off the canvas. A **type filter** button (`Type:
  <MaterialType | All> ▸`) cycles through every `MaterialType` plus "All," narrowing which rows
  appear in the left column and resetting the list to its first page and first matching row. A
  single "Close" button sits in the left column beneath its rows ("List+detail panels" below).
  Every element is laid out top-down with its
  own measured height advancing a running `y` (same pattern as `hubStations.ts`'s
  `showInfoPanel`), the panel's own background rectangle sized and inserted behind everything
  only once the taller of the two columns' real height is known.
- **List+detail panels** (`scenes/panels/listDetail.ts`) are the shared two-column scaffolding
  Qumatex above, seven guardian panels' own browse steps, and the Lab's own Tutorial station build
  on, rather than each hand-rolling its own copy of the same left-column pagination math: three
  browse by *crystal* (Dresselhaus's single transmute step, Anderson's host-pick step, Majorana's
  browse-by-hybrid-result step -- see their own entries below), five browse by *move*
  (Noether's Moves section, Kondo's, Feynman's move-leveling list, and Landau's and
  Skłodowska-Curie's own two-move lists -- also below), Noether's Stats section
  browses by *stat* (also below, its pane opening on the stat's own name, effect line and
  physics since a stat has no art of its own), Bloch's own
  destination table browses by *world number* ("Bloch in the overworld" below) -- its detail pane
  opens with the Qumatuomi map (`art/qumatuomiMap.ts`) fixed at the top, rendered once showing all
  10 worlds regardless of which row is selected, with the previewed destination's own physics
  blurb/cost/status/confirm content stacked beneath it, in place of the crystal-render-plus-name
  block a crystal-browsing panel's own detail pane opens with -- and Tutorial browses by *topic*
  ("Full tutorial recap" below), the one user of this scaffolding whose detail pane is *only*
  text and has no commit button either: just the selected topic's own title and body, since
  browsing a topic is the whole interaction.
  The panel's own escape button ("Farewell" for a guardian, "Close" in the Lab) sits **in the
  left column, directly beneath its rows** (`renderListColumnFooter`), not in a full-width row
  under both columns. The left column is the shorter of the two in every one of these panels,
  so a footer inside it costs the panel no height, and the vertical budget a full-width footer
  row would take goes to the detail pane instead -- which is why the pane can afford its
  `DETAIL_STAGE_H` (`104`) art block and `DETAIL_CRYSTAL_SIZE` (`44`) crystal. **A guardian with
  only two things to sell is read this way too** (Landau's and Skłodowska-Curie's own panels,
  below): two rows and one full-width pane cost far less height than two half-width panes side
  by side, and neither half was ever wide enough for a full animation stage with an inline
  quasiparticle picker under it. Those two panels run their stage at the taller
  `TUNED_MOVE_STAGE_H` (`144`) instead: their left column is a move heading, that move's hostable
  quasiparticles, a second heading and the footer, which is the taller of the two columns and
  already reserves the room, so the animation is drawn as large as the panel's own worst case
  allows rather than as large as the shorter shared block. A panel that
  needs a *second* escape button ("Never mind" alongside "Farewell", on Anderson's pending
  two-step pick) is not one of these layouts -- that step is a flat centered move list, and its
  two buttons share one full-width row (`renderCancelFarewellFooter`).
  `LIST_DETAIL_PANEL_W`
  (`720`) is the panel width every list+detail panel uses -- wide enough for the two columns
  plus a real crystal render (or, for a move-browsing panel, its animation preview, or for
  Bloch's own panel, the map) side by
  side, unlike the narrower `600`px width a plain single-column panel (Feynman's own
  question-streak sub-panel) uses; Franklin's own panel (below) is wider still
  (`760`) for its own, differently-shaped two-column crystal-beside-list layout, distinct from both.
  `listDetailColumns(panelLeft)` returns the one fixed set of column margins/widths
  every list+detail panel shares (left column `200`px wide, a divider, then the right column
  filling the rest). `renderListColumn` draws the left column exactly the way Qumatex's own
  left column above works (sample-row-measurement fit-per-page, `fitListLabel` ellipsis-trim,
  gold-on-purple selected-row highlight, Prev/Next/Page-N/M once the list outgrows one page) --
  a caller passes its own item list, `idFor`/`labelFor`, which id is currently selected, and an
  `onSelect` callback; nothing about *committing* to a selection lives in this shared piece. The
  right/detail column is always a per-call-site render (`insertColumnDivider` just draws the
  line between the two once both columns' real heights are known) since its content differs
  panel to panel -- Qumatex's own pane (crystal + name + physics blurb, above), a
  crystal-browsing guardian's (crystal + name + cost/status text + a commit button, via the
  shared `renderDetailCrystalHeader` crystal-plus-name block those three panels each build
  their own status text and confirm button on top of), an attack move-browsing
  guardian's (the move's own real battle-effect animation, looping centered in the
  pane, in place of a crystal render + name + cost/status text + a commit button, via the shared
  `renderMoveDetailHeader` block -- "Attack effects" below has the animation's own details), and
  Kondo's own self-buff move-browsing step (the same centered loop, but *over a rendered player
  crystal* -- a self-buff has to be seen buffing something -- via the shared
  `renderSelfBuffMoveDetailHeader` block, "Kondo in the overworld" below). **A move preview
  plays inside its own stage and nowhere else.** The art block those two blocks reserve is drawn
  as a recessed, bordered pane (`drawPreviewStage`: a dark fill at `0.55` and a hairline
  `REFERENCE_BLUE_GREY` border at `0.5`, inset `8`px from the column so two stages side by side
  keep a visible gap), and the effect is clipped to exactly that rectangle. It has to be: the
  preview is the *real* battle effect, composed against a whole arena, so a beam falls in from
  above the top of the field and an eruption throws debris well past where it lands. Unclipped
  at panel scale it covers the guardian's own portrait, their opening line, and the room behind
  the panel. The frame is what makes the clip read as a screen the demonstration is playing on
  rather than art cut off at nothing, and the same rectangle feeds both, so the border the
  player sees and the boundary the effect obeys can never disagree. A guardian's
  list+detail step is a **preview-then-confirm** flow, distinct from the plain shop-row style
  used elsewhere (Anderson's own second step, picking a *move* rather than a crystal, still the
  right choice when there's no crystal/move art worth previewing), from Franklin's own
  crystal-beside-list layout (below), which previews a passive's
  ground halo on an always-visible crystal rather than swapping between candidate rows, and from
  Landau's/Skłodowska-Curie's own bespoke two-column panels ("Landau in the overworld"/
  "Skłodowska-Curie in the overworld" below), which show both of a guardian's fixed two moves at
  once rather than browsing a candidate list at all: clicking a
  left-column row only changes which candidate is previewed in the right
  column, at no cost and no effect, so a player can browse freely before deciding; the actual
  action (transmute/dope-in/fuse/learn/travel, cost check and deduction included) only fires
  from the right column's own explicit button ("Become `<name>`," "Dope in `<name>`," "Fuse,"
  "Learn `<name>`," "Make `<name>` active," "Travel to `<name>`"). A button names the action and
  its object only -- the cost/status line directly above it carries the price and the unlock
  state, so the button never restates them.
  Each such panel keeps its own
  transient "which row is currently previewed" field (`GuardianPanelHost`'s
  `dresselhausPreview`/`andersonHostPreview`/`majoranaPreview`/`noetherMovePreview`/
  `kondoMovePreview`/`blochPreview`), separate from the
  persisted
  "which row is committed to" field the two-step guardian (Anderson) already has
  (`andersonSelection`) -- a preview is free to change or abandon, a commit is the one action
  that actually spends anything. Majorana/Kondo/Bloch have no such
  committed-choice field: each is a single browse step, so its own preview field alone (holding
  the previewed *hybrid result's*/*move's*/*world number's* name) drives its whole detail
  pane -- Kondo's actual
  commit (which of its three moves is usable in battle) lives in registry/save
  `kondoActiveMove` instead, written only by the detail pane's own "Make active" button.
  `blochPreview` is `number | null` (a world number), not a string, since Bloch's own rows/markers
  identify a destination by world number rather than by a crystal/move name. Landau and
  Skłodowska-Curie have no preview/pagination field of their own at all -- each has exactly two
  fixed moves, always both rendered at once, so there is no candidate list to browse in the first
  place; see their own entries below for their bespoke layout and its own "Retune"/per-class-unlock
  buttons.
- **Tutorial** (`scenes/panels/hubStations.ts`'s `showTutorialTopics`, stroked cyan `0x5ad9ff`,
  `LIST_DETAIL_PANEL_W` wide) is a list+detail panel ("List+detail panels" below) over
  `data/tutorial.ts`'s `visibleTutorialPages` -- the same two-column shape a guardian's own
  browsed panel uses, just with no crystal/move art to preview. The left column names each topic
  the save has reached (its own short `listLabel` where a topic has one, its full `title`
  otherwise), paginated once the set outgrows one page; the right column shows the selected
  topic's full title and body, fitted with `ui/text.ts`'s `fitProseToBudget`. That pane has no
  continue button of its own -- the panel's only button is the list column's shared "Close" --
  so a long topic is fitted by shrinking in place (floor `9`px) rather than continued on a
  second screen, and its budget reserves only the 14px gap, the panel's bottom pad and a 16px
  margin, since the "Close" button sits in the left column, not under this one. Every
  listed topic is visible up front rather than reachable only by paging through the rest, and
  the list grows as the playthrough does -- Story Mode lists only discovered topics, in the
  order the game reveals them, so the panel is three rows tall on a fresh save and fills out
  to all eighteen; Superposition Mode lists all eighteen from the start.
  Selecting a row is a scoped update (see "A preview click is a scoped update" further below),
  not a panel rebuild -- only the detail pane and panel chrome re-render, the list rows stay on
  screen.

## Overworld path

- The grid is 27 columns wide and 50 tall at the default Meso world size, and that
  size times its own factor at Nano/Macro (`data/settings.ts`'s `WORLD_SIZE_PRESETS`,
  DESIGN.md §2). The dimensions the renderer draws to are read through
  `scenes/overworld/projection.ts`'s `gridW()`/`gridH()`, which `OverworldScene` sets
  from the grid it is about to draw. Each of the 10 worlds has its own map *shape*
  (`world/mapgen.ts` dispatching to
  `world/generators/world1.ts` .. `world10.ts`, see CODEMAP.md) -- a wandering corridor is
  only world 2/6/9's own base motif, not a look shared by all ten. Every shape still
  obeys the same two rules regardless: no walkable segment is ever narrower than 2 tiles (so
  a wild-encounter tile spawned on the path can never fully block it), and the world's
  guardian tile (`mid`) is a forced, verified articulation point -- every route from the
  start tile to the goal is provably routed through it (`world/generators/shared.ts`'s
  `forceChokepoint`/`verifyChokepoint`), not just placed near the geometric middle of one of
  several possible routes.
- Two per-tile overlays a generator can paint on top of its own shape, both consumed
  generically by `OverworldScene`'s terrain rendering: `regionColor` tints a tile toward a fixed hex
  color (world 1's two broken-symmetry branches, world 3's Voronoi domains, both blended into
  the tile's ordinary fill via `art/colors.ts`'s `blend`, at a strength that holds across the range
  the domain is read at and then drowns with everything else -- the tint sits over already-hazed
  ground, so a fixed strength would stand a raw saturated hue up against the mist at the horizon)
  and `biomeOverride` swaps which
  world's whole `art/biomes.ts` entry a tile renders with instead of the current world's own
  (world 9's patches, each independently borrowing one of worlds 1-8's look). An off-path
  `regionColor` tile renders in that tint *and* carries its biome's terrain accent, and world
  3 needs both at once: the tint says which bulk phase the tile belongs to, and the accent
  ('deadFloor', see below) is what says the tile cannot be walked on. Its rubble takes its own
  colour from the tint rather than fighting it, and reads the domain's topological invariant
  back out of it (`world3.ts`'s `invariantOfTint`) to decide how many slabs stand proud there.
- **The walkable floor is one flat colour.** Nothing keyed to a tile's own `gx`/`gy` is drawn
  on the route the player walks, in any world: a floor carrying its own pattern competes with
  the walkable/impassable boundary for exactly the attention that boundary needs, and "where
  can I walk" is the question the ground has to answer first. Depth-driven variation is not
  within-row variation and stays -- the depth fog and the Storm Flats' band ramp are uniform
  across a row and read as distance rather than as texture. A world's own character is carried
  by its palette and by the impassable surround beside the route (`terrain/materials/`), not by
  what the floor is painted with. The per-world floor motifs stay written behind
  `terrain/decoration.ts`'s default-off `GROUND_MOTIFS_ENABLED`. The one thing that may vary
  within a row on the floor is a *gameplay signal* rather than texture -- the chokepoint glow
  immediately below.
- The guardian's own tile (and its immediate neighbors) gets a soft pulsing glow overlaid on
  the ordinary path fill, in that world's own guardian color (`WORLD_GUARDIANS`'
  `strokeColor` -- the same per-guardian color coding panels/pills already use,
  `terrain/paint.ts`'s `drawMidHighlight`) -- the forced chokepoint reads as a deliberate gate the
  player is walking through, not an arbitrary narrow spot.
- Off-path tiles read as unambiguously "you cannot walk here." The **ground plane itself is
  always flat** -- impassable ground lies in the same plane as the walkable floor, and is told
  apart by color and by the boundary treatment below, never by the terrain rising into a
  wall. What a material may do is stand *objects* on that flat ground: the Mean Fields' trees,
  the Stone Lattice's columns, the Iron Steppe's shards, the Screened Swamp's reeds. Those are
  sprites on a tile, the same as a guardian or a door, not extruded terrain -- there is no
  height field, no occlusion pass and no elevation anywhere in the collision grid. They get
  their occlusion free, because the terrain sweep paints far-to-near and anything drawn upward
  from its own tile covers the rows beyond it. A world whose surround is a *place* rather than
  a surface needs this: a canopy that never leaves the floor is not a wood, and reeds that never
  leave the water are not reeds. `terrain/paint.ts`'s `drawOffPathTile`
  paints the tile in that biome's own `ground` color (hazed for depth, tinted toward a
  `regionColor` domain where the tile belongs to one) and then lays on the accent the terrain
  kind resolved from that tile's own biome's `wallTheme` calls for (`art/biomes.ts`, resolved
  per-tile via `biomeOverride` above; see the Biomes table below). Every accent is skipped past
  `depthRatio 0.75` so distant tiles stay a cheap flat fill:
  - **'rock'** (the Entangled Web, world 7): bare ground with nothing laid over its fill.
    In that world bare means black -- the surround is true void, and there is nothing out
    there to draw.
  - **'forest'** (the Mean Fields, world 1): dense summer canopy, drawn as a wood rather than
    a hazard -- no glow, no motion. Its tree sprites are the game's one shared terrain sprite
    (`art/trees.ts`). A tree keeps its full three-lobe crown for as long as it is drawn at full
    strength, and sheds crown detail only as the depth fade takes it -- a lit cap over the shaded
    mass once the fade has started, a single blob near the end of it. The wood stays at full
    density throughout: what recedes is how much shape each far crown is given, never how many
    trees there are.
  - **'columns'** (the Stone Lattice, world 2): rows of identical sandstone columns, lit from
    one fixed direction with deep cast shadow between them. Two strict lattices, and the
    regularity is the point in both -- a colonnade is a lattice, and jitter here draws a ruin.
    The column field the hall is cut out of carries one every second tile in both directions;
    the columns standing in the hall itself are the generator's own periodic array
    (`world/generators/world2.ts`), which arrive tagged as feature cores and carry a column
    wherever it put one.
  - **'deadFloor'** (the Winding Borders, world 3): the sunken bulk one storey down, drawn as
    fields of dead rubble -- low blunt broken blocks, each with a hard cast shadow thrown the
    same way by a fixed afternoon sun, tinted by the domain they lie in. **The shadow is what
    does the work**: it is the hard light/dark boundary that reads as relief, and without it
    the bulk measures a local contrast of 0.03 against 0.8-2.1 for every other world's
    surround, which is a surface-less expanse and reads as walkable floor. Three rules hold:
    obtuse shapes only and no glint (facets and sparkle belong to the crystals, and the player
    and every wild encounter is one); nothing animates, since wind races over this world while
    its ground stays perfectly still; and every phase keeps its rubble, including the trivial
    one. The piece count thins with distance rather than the pieces fading, which is where the
    material's cost lives. A domain's topological invariant is countable in it -- one slab
    standing proud of the bed per unit -- so the label survives the colour being drained.
  - **'charged'** (the Storm Flats, world 4): the ground the storm strikes. The tile accent is
    the burn left behind -- a short forked scorch, fixed per tile and static, so the field
    reads as ground that has been hit many times. The strike itself is a separate pass drawn
    *after* the atmosphere (`terrain/materials/charged.ts`'s `drawStormStrikes`), because a
    bolt crosses the air as well as the ground and one painted under the haze is one the haze
    puts out. Three rules bind it. A strike **only ever lands on an impassable tile** -- that
    is the world's entire message, and the column is searched along the chosen row rather than
    picked outright, so the constraint costs no cadence where the corridor is wide. It is
    **occasional** -- two slots on incommensurate cycles, each alive for a twentieth of its
    own, which is about one flash every three seconds with the frame dark between them. And
    its light is **local to the tile it hits** (nested ground pools, a sheathed bolt), never a
    wash over the frame: a strike is momentarily the brightest thing on screen and gameplay
    owns the extremes, so the route and the player's crystal keep their values through one.
  - **'ice'** (the Vortex Glacier, world 5): the frozen lake, still and faceted, plus the
    vortex pits inside it -- a dark rim and a slow, cold glow of trapped flux, drawn on each
    tile the generator placed as a vortex core and kept blocked while the sheet parted
    around it. The field is expelled everywhere else in this world, so the pits are the only
    place it can be, and the glow is that field made visible where the physics puts it.
  - **'shards'** (the Iron Steppe, world 6): leaning iron blades, all tilted the same way and
    flipping across a domain wall that drifts, so shards reverse while the player watches.
    Their lit edge is aurora green -- the only light this world has, and emitted rather than
    received.
  - **'bog'** (the Screened Swamp, world 8): near-black open water under a mist wash that is
    the actual hazard and gathers with distance until the pool is barely readable as a surface,
    with clumps of dark reed stalks standing out of it. A lone bright point burning in the water
    is a local moment, ringed by small cool counter-lights that draw inward and brighten as the
    screening cloud closes -- wide and faint with the moment still burning near the world's
    entrance, shut tight with the point out deeper in, driven off the tile's own grid row. The
    generator marks the middle of each pool the shelf parts around as a feature core, so a moment
    is always burning inside a split. An occasional pool wavers with the player's own crystal
    colour. Everything in this surround is a line, a small circle or a short ellipse and nothing
    is a sprite, which is what keeps the world cheaper to draw than a wood at the same tile
    count (the cost rule at the top of this file).
  - **'lava'** (the Defect Scars, world 9): a glowing molten crust -- a warm overlay, a bright
    fissure and a hot core, animating off the scene clock. The overlay's pulse phase varies by
    only a fraction of a radian between neighboring tiles, so the glow drifts across the crust
    as broad slow waves; a steeper phase step makes adjacent tiles pulse against each other
    and the crust read as a checkerboard of the tile grid. Its alpha is held dim enough that
    the crust never climbs toward the value of the walkable clay route it must be told apart
    from. A rare tile also carries a half-sunk drum from the Stone Lattice's fallen colonnade.
  - **'consuming'** (the Devouring Mirror, world 10): facets that re-cut themselves on a slow
    cycle, tinted toward the player's own crystal color -- the world is built out of them.
  A ground-tile fill itself (walkable or off-path, accented or `regionColor`-tinted) is a
  single flat color per tile, not a per-tile diagonal-facet/gradient shading -- floors read
  better flat; don't add such shading without asking first.
- Each biome's `ground` and `path` colors must hold a wide enough break between them to carry
  the whole walkable/impassable read on their own, since nothing else in the scene marks it:
  telling at a glance where the player may walk is a gameplay requirement, not a matter of
  taste. Hue alone is enough where it is unambiguous (world 1's tan trail through green
  meadow); the dark, hazy biomes lean on value instead (world 8's peat bank held far lighter
  than its near-black water, world 9's scorched
  clay route held several times lighter than the molten crust and its deliberately dim glow).
- **Smoothed ground.** Every world's ground plane is drawn this way. The rule above is about a
  tile's *interior*, and this treatment leaves it intact -- every fill is still one flat color.
  What it decides is the *shape* of the fills and what is laid over the scene as a whole:
  - The walkable/impassable boundary is traced on the tile lattice and redrawn as a curve
    (`art/contours.ts`, "Overworld terrain rendering" in CODEMAP.md), so a region edge that
    turns reads as an organic shoreline rather than a stair-step of axis-aligned quads. The
    curve carries no bias to either side: it starts on the grid lines themselves and bends
    only where the boundary turns, so along a straight run the drawn edge lands exactly on the
    tile edge movement collides against, and a diagonal staircase smooths into a diagonal
    rather than a scallop. No corner travels more than `sqrt(2)/4` of a tile from the lattice,
    which leaves the curve at least that far clear of every tile centre -- the margin an
    entity standing on a tile gets, since entities stand at tile centres (see "Standing on a
    tile" below).
  - There is no per-tile seam stroke, so a run of same-kind tiles reads as one continuous
    region rather than a grid.
  - A **contact shadow** -- two translucent black bands on the walkable side of the boundary
    and one on the impassable side, faded out past 70% of draw distance -- seats the floor
    into what it meets instead of letting the two butt flat together. Immediately inside it
    runs a thin **rim light** in a pale tint of the biome's path color, the classic light edge
    against a darker mass, which also keeps the walkable region's own shape readable further
    into the distance than its fill alone manages. Together they are what marks the boundary
    in place of a seam.
  - **Depth haze** is leaned on hard: the per-tile fog blend is deepened, distant walkable
    ground hazes toward a lighter target than its surroundings do (so the route stays visible
    at the range the player plans it from), and a whole-screen wash of the biome's haze color
    over the top of the ground plane turns the far distance into continuous atmosphere. Every
    such wash is painted as *abutting one-pixel rows*, never as overlapping bands: two
    translucent rects sharing a scanline blend twice there and draw a bright line at every
    seam, which is invisible while the wash color sits close to the ground under it and
    stripes the whole far distance as soon as it does not.
  - **The ground plane always reaches the horizon** (`dev_notes/WORLDS.md` §4 is the spec).
    Terrain is repeated in depth past the grid's far edge the same way it is repeated sideways
    past the left and right edges, so a world never visibly terminates. Two bounds keep that
    honest: the repetition stops where the depth fog saturates, beyond which nothing is
    distinguishable anyway, and it stops on any row whose projected thickness has fallen under
    a pixel, since such rows only alias and crawl as the camera moves. A **painted band** in
    the world's haze color takes over the far distance: opaque from the horizon line down to
    where the terrain runs out -- the strip the projection puts out of the ground plane's reach,
    since rows approach the horizon asymptotically and never arrive -- then thinning over the
    deepest rows from there toward the camera and running out about a third of the draw
    distance in (`HORIZON_BAND_FROM`, `FOG_CLOSE * 0.65`). The terrain dissolves into pure
    atmosphere instead of ending on the edge of a final row. Both ends are fixed depths rather
    than tracked off the deepest row actually drawn, so the band never slides out from under
    the rows as the camera creeps, and the thinning is smoothstepped so the band leaves full
    strength with its slope already flat -- a ramp that starts falling the instant the opaque
    stretch ends puts a readable line there instead of at the horizon.
  - **The ground reaches both frame edges at every depth.** How wide the ground has to be
    painted depends on how far away it is: the projection shrinks a tile-width toward the
    vanishing point, so a lane window that fills the frame up close covers a narrowing wedge in
    the distance. Painting the width the frame actually needs, per row, is what keeps the far
    corners of the screen off the bare backdrop -- a distant wedge of terrain on flat fill
    reads as a world that stops, however far back the stopping point is.
  - **The repeated road is intentional.** Repeating the far edge row repeats the walkable path
    with it, so a road runs on past the world's own end -- the one detail that says the ten
    worlds are one road rather than ten rooms. It is scenery, not passage: movement still
    collides against the real grid, and the player leaves through the goal tile.
  - **The air ahead becomes the next world's air.** As the player nears a world's goal end the
    haze target lerps toward the next world's own haze color, reaching four-fifths of the way
    at the goal row itself. The fog is applied in proportion to depth, so this recolors the
    distance and leaves the ground underfoot alone. It is **gated on gate state**: while that
    world's rival still stands the gate is shut, and a shut gate shows nothing of what is
    beyond it. World 10 has no next world and keeps its own air the whole way.
  - The guardian chokepoint's glow falls off radially from the guardian's own tile and carries
    no outline, so the gate reads as a pool of light rather than a hard rectangle laid over a
    floor whose every other edge curves.
  - Where the camera stands close enough to the grid's left/right edge that the visible lane
    window reaches past it, **margin columns** (`terrain/paint.ts`'s `drawMarginColumns`) continue
    each row's edge tile off-grid -- same biome, same `regionColor` tint, same terrain accent,
    but always as impassable ground -- so the world runs to the frame edge instead of stopping
    on a stair-stepped strip of bare backdrop. The grid-edge boundary of a walkable edge tile
    is already part of the traced contour (the trace treats out-of-grid as impassable), so the
    floor side keeps its usual curve, shadow and rim against those columns. **Margin rows**
    (`drawMarginRows`) are the same idea in depth, with one deliberate difference: they repeat
    the far edge row's terrain *kind* as well as its color, so the path repeats with it, and
    the trace is fed the far edge row's walkability for every row beyond it so no boundary
    curve, shadow or rim is drawn across a road that continues.
  A `regionColor` domain's own boundary is not part of the traced contour -- only the
  walkable/impassable line is -- so where two domains meet inside impassable ground the color
  break there still follows the tile lattice (world 3 keeps its domains apart with walkable
  boundary strips almost everywhere, so this surfaces mainly where perspective foreshortening
  hides such a strip behind the domain in front of it; world 9's `biomeOverride` patch edges
  are tile-quantized the same way, which suits that world's glitch identity).
- **Standing on a tile.** Everything in the world -- the player's own avatar, wild crystals,
  the boss golem, guardians, doors, pickups -- is placed by its *ground contact* (the point its
  shadow is drawn at, `foot` in `OverworldScene`'s `WorldSprite`), and that contact lands on the
  projected centre of the tile it occupies, never on a tile edge. Together with the unbiased
  boundary curve above, that is what keeps a crystal walked flush against terrain reading as
  standing *next to* it rather than in it, at every distance. Art that deliberately hovers with
  no contact of its own -- a qumatessence cloud, a guardian adrift -- uses a zero offset, which
  hangs it over the tile centre instead. The player's avatar is drawn at one fixed on-screen
  spot, so the camera sits a fixed distance behind the player's tile
  (`CAMERA_BACK_TILES`) and that spot is derived from the projection rather than picked by eye;
  the ground the player has already walked over is what fills the bottom of the frame.
- Decoration (flowers / crystal glints) is placed in the off-path terrain only, not on
  walkable tiles -- those are reserved for wild encounters and qumatessence pickups.
- Qumatessence tokens are scattered across a handful of walkable tiles per map
  (`world/generators/shared.ts`'s `scatterTokens`), preferring an actual dead-end tile (a
  branch/spur tip, degree 1 in the walkable graph) when that world's shape has any, falling
  back to any other tile on the route otherwise -- so the original "reward sits at the end of a detour"
  read survives for the worlds that still build literal dead ends, without requiring every
  shape to have one.
- Nothing ever materializes in frame. Wild crystals and qumatessence both come back as a
  world is walked (DESIGN.md §2's "Respawning"), and every one of them is placed beyond the
  far edge of the drawn world, ahead of the player, so the only way to meet one is to watch
  it come out of the fog -- the same "seen coming rather than sprung from nowhere" read the
  guardian and boss landmarks are placed for.
- Corner HUD: the world name (top-left, white on translucent black) and the qumatessence
  counter (top-right, gold `#ffe066` on translucent black) sit on the same row at `y = 8` --
  the same spot `HubScene`'s own counter uses, so the Lab and the overworld put it in the same
  corner. The counter's column is reserved as a right-side gutter, sized once from the widest
  qumatessence string this text style could ever show rather than measured live off the
  current value, and the world name's word-wrap width is narrowed to stop short of that
  gutter -- a long name (e.g. world 10's "The Devouring Mirror") or a large text-size
  setting wraps down onto a second line instead of running wide enough to collide with the
  counter. The bottom-right corner carries one small always-on hint, "Press Enter to go to the
  Lab" (muted blue-grey `#8fa0c9` on translucent black, matching the Settings station's hint-line
  color) -- the one persistent on-screen key reminder on this screen, since the world<->Lab
  shuttle is used far more often than the other keys; movement/M/H aren't repeated here and
  stay covered only by the Lab's Tutorial station, so a fixed line for every key wouldn't stack
  up against this corner's overflow risk.
- Map regenerates fresh (new `Math.random` layout, retried internally up to 10 times against
  the two invariants above before falling back to a plain wide corridor) on first load and on
  an explicit world change that's genuinely new ground -- Bloch's teleport, a backward pass, a
  debug warp, the Hub door/Lab Enter-key into a world never yet visited, or (World 10 only)
  transmuting/fusing into a new form while standing there, since World 10's shape is keyed off
  the player's own current type. A round trip through a battle, or leaving to the Hub and
  coming back (Enter from the world, the Hub door, or the Lab's own Enter key), instead
  restores the exact same layout and player position (`OverworldScene.saveMapState`/
  `restoreMap`) -- every path back to the Hub goes through `OverworldScene.returnToHub()`,
  which snapshots the current map/position into the registry's `mapState` first, so the next
  entry into that same world (`HubScene.canResumeWorld()`, above) resumes exactly where the
  player left off rather than regenerating; the
  pre-battle encounter dialogue itself never leaves the overworld scene, so passing on it
  needs no round trip at all.

## Biomes (`art/biomes.ts`)

Per-world skin: sky/ceiling gradient, distant self (`hillColor`/`hillAlpha`, see "The horizon"
below), off-path ground color, on-path
trail color, which floor motif the world would carry and how much of the route would show it
(behind `GROUND_MOTIFS_ENABLED`, off by default -- see "Overworld path" above), fog blend target,
whether clouds render and how fast they drift, the Storm Flats' flat-band ramp, and (see
"Overworld path" above) what the off-path terrain actually *is* -- `wallTheme`.

### The three rules every world is judged against first

`WORLDS.md` is the authority on what each world is; these are the visual rules that generate
those decisions, and a new world or a revision to an old one is checked against them before
anything else.

**The naming law.** No name promises anything the texture doesn't show. Every world name is a
physics word plus a terrain word and both halves must be visible on screen. Two corollaries:
**no physicists** (the guardians are the people, and the only human presence in the game) and
**no quasiparticles** (those are the moves and the creatures, with their own namespace). Both
push names away from proper nouns, which cannot be drawn, and toward phenomena, which can. The
vocabulary stays short and plain: the rule polices obscurity, not intensity.

**The light rule.** The sequence is one long day dying, and the day is coherence -- morning,
midday, afternoon, stormy dusk, overcast twilight, night, **no sky at all**, fog, firelight,
shimmer. **After World 7 the sun never returns**: every light in Worlds 8-10 is emitted by the
world itself, never received from above. World 6 is the hinge, the first world lit by
something it emits (the aurora) while a sky is still there. This costs nothing but palette
discipline and it is the premise made visible, so it is not negotiable for atmosphere's sake.

**The two escalation spines.** Both must be legible in a screenshot cropped to the player's
feet. What the impassable terrain *is*, from "you just wouldn't walk there" to "it would kill
you": forest, stone, a drop, ground the storm strikes, ice and pits, iron shards, nothing at all, fog
that takes you, molten crust, terrain that consumes. What the walkable ground *is*, from
ground built for walking (a field path, a tiled aisle) through ground that merely happens to
be traversable (ice, iron sand) to ground that isn't ground at all (filaments over void,
scorched crust, a surface that dissolves behind you). A world where neither spine holds will
read as placeholder art.

Three constraints every entry has to satisfy, all consequences of treatments every world uses
rather than free style choices:

- `ground` and `path` must hold a wide break (see "Overworld path" above) -- they carry the
  whole walkable/impassable read by themselves.
- `fogTarget` has to stay near the value range `ground` and `path` already span. Each grid row
  is one flat color, so a wide gap between a tile's own color and what the haze pulls it toward
  turns a strong depth haze into visible horizontal stripes across the floor, where a small one
  lets the same falloff read as continuous air. In the enclosed biomes that means a target
  sitting in or just past the range the two floor colors span (world 5's `0x7e939e` between its
  lake and its ice, world 2's `0xe0d3ba` just above its lit sandstone aisle). The open-sky
  worlds (`clouds: true`) instead haze toward their own bright sky, above both -- correct
  there, because that is the horizon their
  ground actually meets. Near a world's goal end the haze target is deliberately carried
  toward the *next* world's `fogTarget` (see "Overworld path" above), which is the one place
  it leaves that range on purpose -- the reason every haze wash is painted overlap-free.
- `hillColor` and `hillAlpha` are this world's distant self, and are budgeted against the fog
  the *neighbour* who can see it will drown them in (see "The horizon" below).

| World | Biome | Sky/ceiling | Off-path ground | Path | Decoration | Clouds | Wall theme |
|---|---|---|---|---|---|---|---|
| 1 | The Mean Fields | pale morning blue (`0x8fd0ff`→`0xe8f6ff`) | dark canopy `0x16341c` | pale wheat `0xd9d295` | flowers | yes | **forest** |
| 2 | The Stone Lattice | hard midday blue (`0x5aa6e0`→`0xd6e6f0`) | deep cast shadow `0x4a3427` | sandstone floor `0xdcc9a8` | mosaic (every tile) | no | **columns** |
| 3 | The Winding Borders | bright afternoon (`0x4f9fd8`→`0xcfe6f2`) | dim slate `0x394349` under dead teal/ochre domain tints | lit ledge `0xdfe6e2` | edge flow (every tile) | yes, drifting | **deadFloor** |
| 4 | The Storm Flats | stormy dusk (`0x151a3a`→`0x3a4270`) | struck ground `0x1b2044` | banded indigo `0x6272b8` | orbit rings | no | **charged** |
| 5 | The Vortex Glacier | overcast twilight (`0x3c4a56`→`0x6e808c`) | frozen lake `0x54707e` | swept ice `0xa8c8d4` | flow lines (every tile) | no | **ice** |
| 6 | The Iron Steppe | night (`0x050a14`→`0x0d1622`) under a green aurora | near-black `0x121517` | iron sand `0x3a3f40` | ripples | no | **shards** |
| 7 | The Entangled Web | none -- black (`0x000000`) | true void `0x000000` | white-gold filament `0xefdaa4` | lanes and rungs (every tile) | no | rock (black, no accent) |
| 8 | The Screened Swamp | dark above, pale mist at the horizon (`0x1c231e`→`0x616d60`) | near-black water `0x121815` | peat bank `0x625f50` | mist motes | no | **bog** |
| 9 | The Defect Scars | scorched red-black (`0x1a0808`→`0x3a1414`) | charred `0x2a0e0a` | scorched clay `0x9c6a52` | cracks | no | **lava** |
| 10 | The Devouring Mirror | silver-violet shimmer (`0x2a1a3a`→`0x6a4a8a`) | reconfiguring `0x2e2044` | dissolving silver `0xd8c8ee` | dissolve (every tile) | no | **consuming** |

Every world owns a hue, because unassigned colours are where collisions breed. Violet belongs
to the Devouring Mirror by right, as the finale, which is why the Storm Flats are indigo
rather than storm-violet and the Iron Steppe's aurora is pure green rather than green-violet.

The Mean Fields are the one world whose value break runs the way a field runs rather than the
way a track does: pale wheat underfoot and dark canopy around it, so the walkable route is the
*bright* thing on screen. World 9 stays entirely inside its warm red family -- the walkable
route is scorched clay told apart from the molten crust by value alone, with the crust's own
glow held dim (see the lava accent notes above) so that value gap never closes. World 3's
Voronoi domain tints (`world/generators/world3.ts`'s `DOMAIN_PALETTE`) are two families of
dead teal and dead ochre, interleaved so adjacent domains reliably differ -- the walkable seam
only exists where two disagree -- and all held well darker than the pale lit ledge: the
domain-vs-domain hue contrast is the world's physics made visible, and the value gap to the
path is what keeps a bulk from ever reading as walkable ground.

## The horizon

`dev_notes/WORLDS.md` §4 is the spec; this is the visual rule it comes out as.

**The horizon line sits high in the frame** (`HORIZON_Y`, roughly a quarter of the way down): the
camera looks *down* onto the ground plane, which owns the rest, and the sky is the strip above it.
That is a frame budget, not a free constant -- the mist band, the clouds and any overhead motif
have to fit in the sky that is left, so each is sized as a share of it rather than in fixed
pixels. It is also not the whole of what a player reads as sky: the horizon band below the line
(next paragraph) is painted atmosphere too, so the ground resolves into visible terrain some way
below the line rather than at it.

Sky, mist and ground are **one atmosphere**, and the horizon line is a location inside it rather
than a boundary between two pictures. The ground's depth fog arrives at the fog color exactly where the last row
is drawn; the sky's own bottom arrives at the same color from above, at full strength across the
lowest stretch of sky and feathered out over the stretch above that. Nothing in the frame paints
its own idea of what color the air is -- every pass reads the one live haze target, which is what
lets the target move (toward the next world's air, near an open gate) without anything tearing.

Two rules keep that stretch of air from reading as a panel laid across the picture, and both are
about what a flat fill gives away:

- **The mist is never one colour.** It holds the fog colour where the sightline through it is
  longest -- the horizon line and the ground just below it -- and drifts back toward the world's
  own high sky as it climbs. A hundred rows of one exact value is the single thing real air never
  is, and the eye finds the place where a gradient *stops changing* as readily as it finds an edge.
  Every falloff in the system is smoothstepped for the same reason, so each one leaves and reaches
  its limits with its slope already flat.
- **Near an open gate the whole sky goes with the mist, clouds included.** The air ahead becoming
  the next world's air is not a band across the middle of the frame; a bank of this world's
  untouched daylight clouds hanging over the next world's mist announces the colour below them as
  an overlay louder than any edge could. The wash runs to the top of the frame — one that stops
  anywhere the eye can find it has only moved the edge it was meant to remove. It is absent with
  the gate shut, so a world in its own air is untouched by it.

A note on where a gradient is allowed to be steep, since something always must be. Every grid row
of ground paints as one flat fill, so how fast a colour moves *per row* is exactly how visibly the
distance terraces — and the depth fog has to cross from nothing to the full fog colour across one
draw distance regardless. The resolution is to keep the near and middle distance gentle and spend
the steepness late, where the horizon band's own wash is already painting over those rows — so the
band has to reach *nearer* the camera than the steep stretch begins, not merely meet it. What
survives is the step times however much of the wash is not over it, and the step itself grows with
the distance between a world's ground colour and the air it is hazing into. The widest such gap in
the game is the Stone Lattice at an open gate, deep cast shadow under the Winding Borders' bright
afternoon air, and it is the case the whole arrangement has to be sized against.

**Distant selves.** Just above the line stands the *next* world's silhouette, composed from that
world's own `hillColor` (base) and `hillAlpha` (swallow) on its `Biome` entry plus its profile in
`art/horizons.ts` -- a world states how it looks from outside itself, once, and its neighbour
renders that statement. Each profile is that world's own impassable surround restated at horizon
scale: column teeth for the Stone Lattice, low stepped plateaus for the Winding Borders, random
vertical pressure ridges for the Vortex Glacier, a uniformly leaning sawtooth for the Iron Steppe,
a notched glow-veined ridge for the Defect Scars. A generic hill in ten colours fails this rule --
it is the theming *not* made visible at distance. Profiles are authored as explicit polylines, not
sampled from a height function, so a hard-edged surround stays hard at a handful of points where
uniform sampling would need hundreds to stop chamfering it. No crest may exceed `MAX_CREST`, which
is what the mist band's full-strength stretch is sized to clear.

A world may also carry a **sky extra** on the same entry, for a distant self a filled outline
cannot state -- the Storm Flats' arc-flashes, and, as entire distant selves at swallow zero, the
Entangled Web's filament glints and the Screened Swamp's flat band of mist-lit standing water with
dark reed clumps in it. A drowned silhouette carries one value; the swamp needs two, its band
lighter than the air and its reeds darker, so neither half can be that fill. Distinct from an **overhead motif**
(`OVERHEAD_SKIES`), which is read from the world the player is *standing in* rather than from its
neighbour: the Iron Steppe's aurora. The Storm Flats' own storm is not in that table, because it
is not a sky motif -- it is an event that lands, drawn with the terrain it strikes ("Struck
ground" below).

**The adjacency rule: adjacent distant selves must differ in shape-language or sky-activity, never
in hue alone.** Haze inheritance already guarantees hue shifts; this catches the case where hue is
*all* that shifts, and it is checked by looking at each world's forward horizon from mid-corridor.
Two pairs are settled and are requirements rather than suggestions. **Winding Borders to Storm Flats**
cannot differ on shape, both worlds being flat by locked identity, so the differentiator is the
sky: arc-flashes over a dead-flat line against stepped plateaus under racing cloud. **Vortex
Glacier to Iron Steppe** are both jagged, cold-dark and under failing light, so the physics
separates them -- the Steppe's shards lean *uniformly*, with the lean flipping at one point along
the horizon (the domain wall, visible from a world away), where the glacier's pressure ridges are
random and vertical.

Three rules govern how one is painted, and they are what keep it from reading as a slab:

- **Drowned, not painted.** The base color is carried most of the way into the live fog target,
  so what remains is a narrow excursion from the mist rather than a shape laid over it. It reads
  the *blended* target, never the neighbour's own `fogTarget` -- band and mist then move together
  and no seam can open between them, even across a hard hue jump like grey into red.
- **Continuous at the base, soft at the top.** Alpha ramps from zero at the foot of the silhouette
  up to the authored swallow at its crest, measured against each column's *own* height so a
  shallow dip is swallowed whole while the crest beside it still clears the fog. The crest itself
  carries a couple of pixels of softness against the sky.
- **A tight value budget.** The whole band stays inside a narrow excursion from the fog color, and
  the budget is tighter than an own-palette band would need, because the horizon is always wearing
  a *foreign* hue and a foreign hue is more legible than an own-palette one at equal contrast. The
  budget binds hardest with the gate shut, when the mist has none of the neighbour's color in it
  yet. **It binds from the other side too, and that is the easier one to get wrong:** at an open
  gate the mist is most of the way to the depicted world's *own* fog, so a base colour picked
  from that world's own palette lands on top of the very air it is drowned into and the horizon
  simply is not there. What survives is roughly `|hillLum - ownFogLum| x (1 - DISTANT_DROWN) x
  hillAlpha`, and under about 3 luminance is invisible. Every distant self is therefore lit by
  whatever that world emits rather than coloured like its ground -- the Vortex Glacier's pale
  ice-cyan pressure ridges, the Storm Flats' storm-lit strip, the Iron Steppe's aurora-green
  shard field, the Defect Scars' crust-lit ridge. **A world whose base color cannot stay inside the budget at any
  swallow worth drawing goes to zero and shows no silhouette at all** -- an emptied-out horizon
  beats a slab, every time.

Judged **gate-open, at the goal end**: that is where the mist carries the most of the next world's
color, and a horizon treatment that only settles with the gate shut has been checked against the
world's own air, which everything already agrees with.

## Qumatuomi map (`art/qumatuomiMap.ts`)

A standalone map-art module drawing a simplified Finland coastline -- a flat-filled polygon whose
every vertex is a real border/coastline landmark pushed through one affine lat/lon-to-native
mapping (documented in the module; the two axis scales approximate equal ground distance per px at
Finland's latitudes), rotated so north is the left edge and south is the right. That construction
carries the landmarks that make the silhouette read as "Finland" at a glance: the northwestern
"arm" protruding past a deep border notch, the Gulf of Bothnia bay corner indenting a waist, the
wide southern half with the easternmost bulge, the slanted southeast border and south coast, and a
trail of separate skerry circles off the southwest corner thinning out to the archipelago's large
main island. `buildQumatuomiMap` places one small circle marker per world (1-10) along a purely
aesthetic left-to-right zigzag, with one deliberate exception: World 10's marker is a real
south-coast place's actual coordinates through that same mapping rather than placed by eye --
never labeled or surfaced to the player, the position alone is the reference.
The landmass is painted as ten regions -- a nearest-world partition of the coastline's interior
(point-in-polygon clipped, with soft blended borders where two regions meet) -- so the map reads
as ten kinds of country rather than ten labelled dots. Each discovered world's region is
flat-filled with that world's own terrain colour (its `art/biomes.ts` `ground` lifted toward its
`path`, via `colors.ts`'s `blend()`) and scattered with small deterministic texture marks built
from the world's own surround: tree crowns for the Mean Fields, sandstone flecks for the Stone
Lattice, terrace lines, band stripes, flow streaks, leaning shards, gold web nodes, pools and
reeds, cracks with embers, pale facets. Region cells are painted only fully inside the
silhouette, leaving a thin rim of the shared land colour along every coast that reads as
shoreline. An undiscovered world's whole region is instead the flat dim grey (the same `0x33394a`
the Materialdex's own undiscovered-crystal treatment uses) plus a few soft,
deterministically-jittered light-grey mist puffs, so it reads as shrouded rather than merely a
different color. Every fill stays flat -- no per-tile diagonal shading -- matching every other
ground/floor fill in the game (`MAP_STYLE` in the module is the one line that picks this region
treatment). The partition itself is resolved once for the whole module and shared by both builds
(`regionRuns`), as horizontal runs of same-coloured cells rather than cell-by-cell: the overlook
below is scenery redrawn every frame, so classifying the country cannot be per-draw work.
The module wires no
interactivity of its own -- Bloch's panel ("Bloch in the overworld" below) is the one consumer of
that build, attaching its own `setInteractive`/`pointerdown` handling to each returned marker and
reading back the module's actual rendered `width`/`height` (uniform scale-to-fit can make either
one smaller than the caller's requested budget) for its own layout math.

### The Qumatuomi map below (World 10's cliff)

The same asset, drawn as scenery rather than as a panel. World 10's road ends at
a cliff once The Adapted falls, and what lies below the edge is *every* world at
once, seen from above — precisely the view a trained model has of its training
data.

- **Ground far below, never an image pasted flat to the screen**: it lies in the
  gap between the cliff lip and the horizon, with the cliff's shadow under the
  lip, self-luminous per the light rule (the record glows, nothing shines on
  it).
- **Fixed in the world, not fitted to the screen.** The land's near and far
  coasts are two ground rows a fixed number of tiles past the lip
  (`OVERLOOK_NEAR_TILES`/`OVERLOOK_FAR_TILES` in `scenes/overworld/sky.ts`),
  projected exactly like every other row of ground, and it is centred on the
  goal column's own lane rather than on the middle of the frame. So the country
  lies at a fixed place in the world: walking toward the edge brings it up and
  opens it out by as much as ground at that distance opens out, walking along
  the edge slides it with the ground, and standing still leaves it still. The
  near offset clears the last row the terrain sweep actually draws, which is
  what leaves the stretch of unseen ground a cliff puts between a standing
  figure and what is below. Both lines drawn on the land -- its coast and the
  route trace -- carry widths in the map's own native px, so they thin as it
  recedes instead of staying a fixed width on the glass.
- **The same land as the panel build.** One uniform scale for both axes, the
  panel's own land colours, and the same ten painted regions with the same
  texture marks, so the country below is recognisably the map Bloch's panel
  shows; the only concession to the viewing angle is a mild vertical squash.
  Recognition is what the view is for, and it outranks perspective. Every
  region colour is lifted toward the record's own light and drowned into the
  live fog on the way in, the texture marks included -- they are the most
  saturated ink on the map, and undrowned they are the first thing that would
  read as an interface.
- **The haze is load-bearing.** The land is drowned into the same live fog target
  every distant thing is drowned into, graded across its own depth so the far
  coast dissolves and the near one does not. Fog is the cheapest signal that
  something is scenery, and an interface element is never fogged; unhazed this
  reads as a misrendered minimap and players try to click it.
- **The gap must actually be empty.** Past a cliff there is no repeated road and
  no repeated surround — the terrain sweep draws nothing there, which is what
  leaves room for the drop and the land below to be seen at all.
- **Every interactive affordance is stripped** — no markers, no labels, nothing
  to click. Those belong to the clickable panel build of the same asset and stay
  there. The regions are not an affordance: they are what the country looks like
  from above, and the shroud over an undiscovered one is, so nothing below the
  cliff is shrouded — the view is of every world at once.
- **The route trace** is a dim luminous line through the worlds the player has
  actually walked, in the order they walked them. It is the one thing no other
  copy of this map carries. No marker sits at either end of it: a marker is an
  affordance, and this is a record.

### The star network (Worlds 7-10's sky)

One network assembling itself across the last four worlds (`art/stars.ts`,
`dev_notes/WORLDS.md` §1's "The stars"): scattered points in World 7, the first
strange links in World 8, drifting cloud occluding part of the pattern in World
9, every point joined in World 10.

- **Authored, never rolled.** Positions and links are a fixed table, so the sky
  a player looks up at in World 10 is the one they saw in World 7, finished.
- **The stages only add.** A link drawn in World 8 is still there in World 10;
  World 9 hides part of the pattern by covering it, never by unbuilding it.
- **Drawn under the mist band**, so how far a star fades is the atmosphere's
  answer and the field can use the whole sky rather than the strip above the
  mist.
- **The finished network carries visibly more light** — brighter nodes, haloed,
  with heavier links — because the reveal has to land at a glance.
- **The title screen carries the finished form faint** (see "Title screen"
  above): the same authored pattern, present before the player has met any of
  it, readable as an ordinary constellation until Worlds 7-10 teach them
  otherwise.

## The Lab's two signals (`HubScene`, `art/labMotifs.ts`)

`dev_notes/WORLDS.md` §4's "The Lab" is the spec. The Lab is not a location — it
is reachable from every world and returns the player exactly where they left —
so it is a functional hub, not a diorama, and it carries **two signals and no
more**:

- **Its door is the aperture grammar unbound.** Out in the worlds an opening
  can only ever show the one fixed neighbour; the Lab's shows wherever the
  player is currently going, and re-tints live as the travel panel's selection
  moves. Its opening carries the destination world's own walkable ground lifted
  toward that world's low sky — the same pair the pass aperture reads — so the
  two are recognisably one grammar. A door that changes its view when the
  player changes their mind reads as a teleporter with no word of explanation,
  and it teaches itself, because the player has already learned to read
  apertures out in the worlds.
- **Its accent lighting is the player's current crystal.** Everything in the
  room that reads as *light* — the ceiling panels, the instrument screens, the
  pool on the floor under the player's own crystal — takes that crystal's
  colour and changes with it. Structure (wall, counter, bezels, floor tiles)
  keeps its own colours, so this reads as lighting rather than as a repaint.

Everything else the room says by **absence**: no window, no sky, nothing
implying an outside. Every world has a horizon; the Lab has none, and that only
reads as deliberate if nothing in the room accidentally supplies an exterior.
This is *interior-without-outside*, not void — void belongs to the Entangled
Web. The door's opening therefore shows a palette, never scenery, and the
station motifs are deliberately not tunnels with a visible far end.

## Qumatessence pickups (`art/tokens.ts`, `data/tokens.ts`)

- Placed by `world/generators/shared.ts`'s `scatterTokens`, which prefers dead-end tiles
  (degree 1 in the walkable graph) and falls back to any other tile on the route for a world
  whose shape has too few of them -- the same rule "Overworld path" above states. Both cases
  draw only from ground connected to the entry point (`reachableGround`), so a pickup is
  never left on a branch the guardian's chokepoint cut off from the route.
- Rendered as a "shiny cloud" (cluster of soft overlapping circles + bright core + halo +
  sparkles), `makeToken()` -- deliberately different silhouette from the faceted
  crystal/prism look used for wild encounters and the player, so pickups read as
  collectibles rather than creatures at a glance.
- Size: `TOKEN_SIZE = 26` in `OverworldScene.ts` (bigger than the `CRYSTAL_SIZE = 22` wild
  encounters, since a pickup should stand out).
- Color-coded by value tier, ten tiers ascending a cool-blue-to-violet hue sweep through
  green/yellow/orange/magenta (`data/tokens.ts`) -- violet at the top echoes World 10's own
  violet biome palette and Skłodowska-Curie's lavender rather than running the ramp into a
  literal hot red/white -- saturation/lightness stepping alongside hue so adjacent tiers
  (the only ones a world's window can ever put side by side) stay visually distinct at the
  small on-screen sprite size, not just hue-distinct on paper:
  - `1` sky blue `0x84d1eb`
  - `2` teal `0x54dea5`
  - `3` green `0x3cdd3c`
  - `5` lime `0x8ce633`
  - `8` yellow `0xf2e236`
  - `12` orange `0xf68f28`
  - `18` red-orange `0xf44434`
  - `25` rose `0xef3976`
  - `35` magenta `0xea2ec5`
  - `50` violet `0xdb8bee`
- Each tier's value is unique across the whole ladder, so its color is a fixed value-to-color
  lookup regardless of world. Which tiers actually spawn is world-dependent (a sliding
  three-tier window, two at the ladder's ends -- see DESIGN.md's overworld map generation
  section), weighted toward the window's lower tier; the `+<value>` label is what tells the
  player the exact payout.
- Each pickup shows a `+<value>` label underneath, same treatment as wild-encounter name
  labels.

## Crystal sprites (player + wild encounters)

- Shared `makeCrystal()` builder (`art/crystals.ts`): one faceted silhouette per material,
  colored per its main type (`TYPE_LOOK` in `data/materials.ts`), plus a highlight and
  twinkling sparkles. **`size` means the same thing to every habit**: each solid is drawn in
  whatever proportions it actually has, which left a quarter's spread between the largest and
  smallest at the same `size`, so `drawSolidShape` evens the largest dimension out through
  `HABIT_SCALE` -- measured off rendered pixels, and deliberately small, since past about a
  tenth it would be redrawing a shape rather than scaling it. Two specimens shown side by
  side should differ in *shape*, never in importance. **The silhouette is the compound's real crystal habit, read off its
  lattice, never picked for variety** -- `art/crystals.ts`'s `drawSolidShape` is the single
  place a `CrystalVariant` becomes a shape, so `makeCrystal`'s ordinary render and
  `drawVariantShape`'s hybrid halves can't disagree about what a variant looks like.
  **Every habit is a single body, without exception** -- a crystal drawn from two separate
  pieces means a Majorana fusion and nothing else (the **Hybrid materials** bullet below), so
  the player can read "this is a fused state" straight off the silhouette. Ten habits:
  - **Solids.** `cubic` (`drawCubicShape`, a blocky isometric cube) for the cubic systems --
    rock salt, bcc/fcc metals, zinc blende, the cubic hydride. `octahedral`
    (`drawOctahedralShape`, two square pyramids meeting at a girdle) for the tetrahedrally
    bonded diamond family whose habit is the {111} octahedron. `rhombohedral`
    (`drawRhombohedralShape`, a leaning block with no right angle in it) for the R-3m/R3c
    trigonal compounds. `tetragonal` (`drawTetragonalShape`, a square prism under a
    bipyramidal cap -- the KDP habit) for the four-fold families: ThCr₂Si₂ heavy fermions,
    PbO-type iron chalcogenides, tetragonal perovskite ferroelectrics, layered cuprates.
    `prism` (`drawPrismShape`, a hexagonal column) for hexagonal/wurtzite/hcp/trigonal-layered
    compounds. `shard` (`drawShardShape`, a plain faceted gem) is both a habit in its own
    right and the fallback: it is what a compound gets when its structure is low-symmetry
    enough to have no characteristic habit (HfO₂'s ferroelectric orthorhombic phase).
    Each solid is lit from the upper left, the same direction `addHighlightAndSparkles`
    puts its specular highlight.
  - **`spire`** (`drawSpireShape`; quantumSpinLiquid, kondoHeavyFermion)
    is the one entry that states a *growth* habit rather than a lattice symmetry -- a body
    grown tall and brought to a point -- which is why it sits over those two types
    regardless of their members' individual lattices. One prismatic body rises into a
    pointed termination: the silhouette is filled dark first and the facets painted into
    it, so the outline stays a single closed shape. It is **one body**, like every other
    habit here -- a crystal drawn from separate pieces means a Majorana fusion and nothing
    else, so a habit spending several pieces on itself takes a word the visual language has
    already given to something more important. What distinguishes it from `prism` is the
    termination: `prism` is a flat-topped column, `spire` comes to a point.
  - **Monolayers.** `layer` (`drawLayerShape`) is one thin flattened hexagonal sheet with a
    soft *detached* shadow underneath it (not touching the sheet) so it reads as floating
    rather than resting on the ground -- for honeycomb/hexagonal monolayers (Graphene, hBN,
    the 2H TMDs, CrI₃). `layerTriangle` and `layerSquare` (`drawPlateShape`) are the same
    plate grammar -- detached shadow, thin rim, lit top face -- cut to a triangular
    (Monolayer NiI₂) or four-sided (1T′ WTe₂, the HgTe/CdTe quantum well) in-plane cell.
    All three are one plate: a twisted or moiré-stacked compound is a hybrid, and draws as
    its two parents fused rather than as a habit of its own.
- Both `TYPE_LOOK` and `data/materials.ts`'s `crystal()` `variantOverride` param set the
  habit, and neither is a shortcut for the other: `TYPE_LOOK` states the structure the type's
  members typically share (`cubic` for metal/insulator, `octahedral` for semiconductor,
  `tetragonal` for ferroelectric, `layer` for quantumSpinHall/multiferroic/fractionalChern,
  `rhombohedral` for chernInsulator's R-3m tetradymites, `shard` for superconductor, whose
  members share no lattice at all), and `variantOverride` states an individual compound's
  own where it differs
  (wurtzite GaN among the zinc-blende semiconductors, rhombohedral Bi₂Te₃ and BiFeO₃,
  tetragonal YBCO and Fe(Te,Se), cubic Al/Pb/Nb/LaH₁₀, monolayer CrI₃ among the bulk magnets).
  A main type groups compounds by their physics rather than their symmetry, so the two part
  company often.
- Sizes: player `PLAYER_CRYSTAL_SIZE = 34` (largest, always on-screen), wild encounters
  `CRYSTAL_SIZE = 22`. Out on the map both carry a flat contact shadow one `size` below the
  container origin -- the same convention the boss golem's own pooled shadow follows, and what
  "Standing on a tile" above places on the tile centre.
- **Per-compound identity.** `TYPE_LOOK` fixes one habit + base color per `MaterialType`
  (and `variantOverride` the habit per compound), but individual compounds of the same type each
  get their own visual variation rather than rendering as that same silhouette in only a
  different brightness. Two mechanisms stack, and both move hue rather than brightness.
  **Stored on the `Material`:** `crystal()`'s `hueStep` rotates `TYPE_LOOK`'s base color around
  the hue wheel at fixed saturation and value, alternating sides and widening by 12° each pair
  (0, +12°, −12°, +24°, −24°, …, ±48° at step 7 — `hueStepDegrees`, `data/materials.ts`). It
  rotates rather than brightens because a family can run to seven or eight members and an
  additive brightness ladder clamps every channel to 255 long before that, leaving the far end
  of a long family as white crystals with no type color left; alternating sides is what keeps
  the widest step inside its own hue's neighborhood instead of sliding into an unrelated one.
  **Applied at render:** every call site that has an actual `Material` passes `makeCrystal()`'s
  `opts.seed` (the material's own name);
  `art/crystals.ts`'s `jitterFor` hashes that name into a small deterministic PRNG
  (`hashSeed`/`seededRandom`, `art/colors.ts`) and derives a hue shift (`hueShift`, ±35°), a
  shape rotation (±18°), a non-uniform x/y stretch (0.76-1.28, applied inside the shape-drawing
  functions themselves via a `Stretch` param so it survives whatever a caller does to the
  returned *container* afterward -- world-sprite depth scaling, etc.), and a sparkle
  glyph/count pick -- all baked into the inner `Graphics` object(s), not the container, and
  stable across reloads since it's re-derived from the same name every time, not re-rolled per
  render. Purely decorative, non-`Material` crystals (background outcrops, `boss.ts`'s own limb
  shards, the title screen's `TYPE_LOOK`-only showcase) omit `seed` and keep their exact
  hand-tuned look.
- **Hybrid materials** (Majorana's fuse mechanic, DESIGN.md §5) render as an actual mixture of
  both parents, not one flat blended color -- **the one crystal in the game drawn from two
  separate pieces**, which is what makes a fused state readable at a glance against a roster
  of single-body habits. `data/materials.ts`'s `combineMaterials` carries
  each parent's own `color`/`variant` forward as the new `Material`'s `hybridParents`, and
  each `HYBRID_RECIPES` result carries the same field before any player fuses it, so a wild
  hybrid met in World 10 and a player-made one render identically;
  `makeCrystal()`'s `opts.hybrid` routes to `drawHybridCrystal` instead of the
  ordinary single-shape path: both parents' own habits (`drawVariantShape`, which is
  `drawSolidShape` at hybrid scale with 'spire' collapsed to a plain shard so it doesn't crowd
  a shape already sharing space with a second parent's own) render off-center at a slight opposing tilt, the
  second layered on top at less than full opacity so the overlap region genuinely blends both
  parent colors via normal alpha compositing -- **not** `Phaser.BlendModes.ADD` on the shapes
  themselves, since that washes out to solid white against anything but a black
  background (the overworld sky never is). A soft additive-blended glow (their averaged color)
  and a jagged white-gold seam down the middle *do* use `ADD`, since those are meant to read as
  light/energy rather than solid material. Finished with sparkles tinted in both parents' own
  colors (`hexColor`) instead of the plain-white default. A hybrid `playerForm` restored from a
  save that predates `hybridParents` gets the field back from the roster entry of the same
  name on load (`data/save.ts`), so a hybrid is never drawn as a single shape.

## Wild encounter dialogue (`OverworldScene.showEncounter`)

- Appears as an overlay panel inside the overworld itself (dark `0x10101c` rectangle, `600`
  wide with its height sized to the content laid out inside it, stroked in `0x444466`)
  rather than switching to a separate scene --
  asking a question or offering a fight shouldn't feel like leaving the map. Movement is
  frozen (`dialogueActive`) while it's open.
- One screen at the default text size, no click-through: the wild crystal bobs at the top (`makeCrystal()`, size
  30), directly below it an italic greeting line keyed to the material's main type
  (`data/greetings.ts`'s `encounterGreeting`, in muted blue-grey `#cfd8ff`), and directly
  below that -- already visible, no "Continue" step -- either the physics question (gold
  `#ffe066`, if the current world has a `data/quiz.ts` pool -- one question drawn at random
  from that world's own pool via `getWorldQuestion`, so the same
  encounter doesn't always ask the same thing) with two shuffled answer buttons plus "Let me
  pass," or a plain "Fight!" / "Let me pass" choice if it doesn't. Buttons use
  the same `[ #222244 background / #ffff88 text ]` treatment `BattleScene`'s move buttons
  use, for visual continuity between the map and the battle screen. Question, answer and
  greeting text all wrap to the panel's own content width and the panel sizes itself to
  what they come to, so a long question reads as a wrapped block rather than pushing the
  buttons off the bottom.
- Any formula inside the question or an answer is typeset rather than spelled out --
  subscripts drop, superscripts rise, a square root gets a radical sign with a bar over its
  radicand, variables lean and function names stay upright (`ui/mathtext.ts`, CODEMAP.md's
  "Formulas in question text"). An answer button carrying one draws its own plate in the same
  `[ #222244 background / #ffff88 text ]` treatment rather than using a text background, so
  it is indistinguishable from a plain answer button beside it.
- At the largest text-size presets a long question and two long answers together outgrow the
  canvas, so the panel splits in two rather than shrinking the text back down or spilling off
  screen. `renderEncounterPage` measures three layouts and takes the first whose every page
  fits: everything on one page (what almost every encounter gets, and the only layout at the
  default text size); question on page 1, question repeated above the answers on page 2; or,
  for a question too long to share a page with the answers at all, question on page 1 and the
  answers alone on page 2. The pages are joined by the same `'<- Prev'` / `'Page N/M'` /
  `'Next ->'` row at +/-170 from centre that every paginated list uses
  (`renderPagedButtons`), with the unavailable arrow dimmed to `0.35`. The question and the
  shuffled answer order are drawn once when the encounter opens, so paging back and forth
  re-shows the same question with the answers in the same places.
- Choosing to fight (via a correct/wrong answer or the no-question "Fight!" button) starts
  `BattleScene`; "Let me pass" just closes the panel with no scene change and no
  win/loss consequence.

## Guardians in the overworld (`OverworldScene.spawnGuardianSprite`)

- Every guardian (Noether included) stands floating at their world's *middle* tile
  (`WORLD_GUARDIANS`' `tile: 'middle'`, `mid.x`/`mid.y` from `world/mapgen.ts` -- a forced,
  verified chokepoint every route is routed through, not just a point near the geometric
  middle of one of several possible routes; see "Overworld path" above), not the goal -- the goal tile
  belongs to that world's boss avatar (see below). One shared `spawnGuardianSprite`
  builds all of them from the `WORLD_GUARDIANS` table (avatar builder, scale `1.1`,
  name label in the guardian's own `labelColor`) rather than a bespoke function per
  guardian. Reuses the crystal/token `WorldSprite` projection/wander/bob machinery
  (`updateWorldSprites`) rather than a bespoke sprite path, so a guardian scrolls,
  fades with distance, and idly wanders exactly like every other world sprite --
  the player sees and walks up to them instead of them only materializing once
  their dialogue fires. Depth `20`/`22` (container/label), matching wild-encounter
  crystals. Permanent -- unlike encounter/token sprites a guardian is never removed,
  since reaching their row still opens their panel on top of (not instead of) them
  standing there.
- **Approach, read, press**, the same way a pass offers itself ("Gates as passes" below).
  Standing on a met guardian's tile or any of the eight around it raises the same HUD plate
  the pass prompt uses, in the same place and in the same words ("Press Space to talk with
  X", "Tap here" with the walking arrows up), and Space or a click on the plate opens that
  guardian's own panel. Its own object (`OverworldScene.guardianPrompt`), so each offer owns
  its text, its hit area and its visibility; a pass offer wins if both are ever live at once.
  Only *after* the guardian has been met: the first meeting is the walk onto their row, which
  is the introduction, and this is the deliberate way back to someone already introduced.

## Guardian panel headers (`scenes/panels/guardianHeader.ts`)

- **Every guardian panel opens with that guardian's own avatar, large, and their
  opening line beside it.** One `renderGuardianHeader` call rather than the same
  block copied into eleven panels (the ten bespoke ones in `scenes/panels/` plus
  `OverworldScene.showGuardianLore`), so the roster reads as one cast rather than
  eleven layouts and a new guardian's panel inherits the shape for free. The
  panel that opens when the player walks up to a guardian mid-corridor and the
  one that opens when they click that guardian's avatar in the Lab are the same
  function (`GuardianDef.open`), so both get this by construction.
- **Portrait beside the line, not stacked above it.** The avatar *is* the
  guardian -- the roster is deliberately ten figures of light rather than ten
  faces -- and standing it in its own column with the quote taking the room next
  to it buys the portrait roughly twice the size while costing the panel *less*
  height than stacking did, because the tall portrait and the tall quote now
  overlap instead of adding. These are the densest panels in the game (a list, a
  detail pane, a footer under this block), and the tightest of them clears the
  canvas floor by only a couple of dozen pixels at the Large text preset.
- **Sized off the widest of the roster, not per guardian**, so the ten stand at
  one size and a new one drops in without a layout pass: `PORTRAIT_SCALE = 2`
  against the measured reach of the biggest of them (Skłodowska-Curie, `44` up /
  `77` top-to-bottom / `39` either side per unit of scale, measured from a live
  headless render the same way `battle/hud.ts`'s crystal offsets are -- every
  builder draws pure light with a glow around it, so a nominal size would
  understate all ten).
- **Hung from the top of the band by that measured rise, not centred on its
  middle.** Every one of these avatars reaches further above its own origin than
  below it, so centring the origin would either push the tallest past the panel's
  top edge or force a deeper band than the art needs.
- The band is as tall as whichever needs more -- the portrait's own painted span,
  or a long opening line running past it -- and the shorter of the two centres
  against it. A `6`px idle float, deliberately smaller than a stacked layout's
  since the portrait it moves is twice the size: the same travel would read as
  drifting rather than breathing.
- The quote is **left-aligned**, not centred: a centred block beside a portrait
  leaves a ragged left edge running down the middle of the panel, where the eye
  expects the line to start where the figure stops. Its font size is passed in by
  each panel rather than derived in the header, since several panels cap their own
  intro font below the text-size setting (see Landau's/Kondo's/Skłodowska-Curie's
  own sections) and the shared block must not quietly override that.

## Noether's shop (`OverworldScene.showNoetherShop`)

- Same panel treatment as a wild encounter, but stroked in gold (`0xffe066`) instead of
  blue-grey, and fronted by Noether's own avatar (`art/noether.ts`'s `makeNoetherAvatar`)
  instead of a crystal -- not a figure at all but the conserved current her theorem is
  about, made visible: two offset circulation cells, each a nested family of closed
  streamlines around a hot vortex core, the two turning in opposite senses the way two
  adjacent cells of a divergence-free flow must. Each streamline is a ring of fine arc
  segments whose brightness ramps into a leading edge (each bright arc riding a slightly
  wider dark under-arc, so the flow stays legible over world 1's pale daytime terrain as
  well as over dark panel backdrops), so its spin reads as luminous flow sweeping round
  rather than a rotating dashed ring. Every streamline closes on itself, the flow runs at
  the same speed on all of them (so an outer one takes longer to come round), and a fixed
  set of brighter motes rides the middle streamline of each cell forever -- an unchanging
  count is the conservation law itself. The two cores are the brightest points in the
  figure and pulse on different timings (1500ms/1700ms, 300ms offset) so the pair never
  beats in unison.
  Silhouette: two hollow rings of running gold, no head, face or robe, deliberately neither
  a person nor another faceted crystal. An inner container sways gently on its own
  (independent of the panel's own bob tween on the outer container) so the flow reads as
  adrift rather than fixed in place; a soft additive glow behind it -- concentric fills
  fading outward, never a hard-edged disc -- pulses slowly for a
  "presence" that thin streamlines wouldn't give on their own. A short layered-bell chime (`audio/sfx.ts`'s `playGuardianChime`,
  shared by every guardian panel) plays whenever the shop opens. Content is laid out top-down
  from a running `y` starting at `top = 20`, opening with the shared guardian header
  (`scenes/panels/guardianHeader.ts`'s `renderGuardianHeader`, "Guardian panel headers" below)
  -- the same call every one of the other nine guardian panels makes, including the fallback
  `showGuardianLore` a future guardian without a bespoke panel lands on, so no panel needs its
  own avatar/quote-positioning tuning pass -- each guardian still gets its own avatar builder
  in its own file
  (`art/bloch.ts`, `art/franklin.ts`, ...) even though the surrounding panel shape is shared.
  Appears automatically every time the Overworld scene is (re)created with this world's
  middle row already reached (`OverworldScene.maybeAutoOpenMiddleDialogue`) -- first on
  stepping onto that row, then again after every later round trip through `BattleScene`,
  so the panel stays revisitable instead of a single one-shot popup. Panel height is sized to
  the content laid out above it (the same running-`y`-then-size-the-background idiom the
  wild-encounter panel uses), so whichever footer that tab carries always has room.
- Below the intro line, the panel is one list+detail layout ("List+detail panels" above) at
  `LIST_DETAIL_PANEL_W` (`720`), and its left column is **two levels deep**: the two things
  Noether deals in stand as headings (**MOVES**, **STATS**), and pressing one opens that
  heading's own entries indented beneath it while the other stays closed
  (`OverworldScene.shopTab`, reset to `'moves'` on every scene create). The open heading is
  gold-on-slate and marked `v`, the closed one dim blue-grey and marked `>`, the same
  click-to-rebuild-the-panel pattern as buying itself. A heading with its entries under it says
  once what a row of tabs above a list said twice, and reading down the column is the whole
  navigation.
  - **The headings are chrome, not list rows** (`listDetail.ts`'s `renderTreeHeading`, shared
    with Landau's and Skłodowska-Curie's own panels). They are drawn by the panel itself and only
    the open heading's entries go through `renderListColumn`'s pagination. A heading paginated as
    an item would land on page 2 at the largest text-size preset, where a page holds three or four
    rows, and the way to the other category would be a page flip away with nothing on screen
    saying so. An open list is told how much room a heading below it still needs
    (`reserveBelow`), and a heading longer than the column is ellipsis-trimmed to it the same way
    a row's own label is.
  - **Moves**: the entries name every still-unbought move the player's *current crystal
    form* can physically carry (`data/materials.ts`'s `SHOP_MOVE_IDS` filtered through
    `compatibleMoves`), no cost suffix -- that lives in the detail pane instead. Clicking a row
    only *previews* it (`scene.noetherMovePreview`); the right column shows that move's own
    real battle-effect animation looping on its stage (`renderMoveDetailHeader`, "List+detail
    panels" above and "Attack effects" below -- the move's own static class, no shape override,
    since an ordinary move's battle look never changes), its name, a `Costs <cost>
    qumatessence.` line, and a `Learn <name>` confirm button (dimmed if unaffordable)
    that's the one action actually checking/spending the cost and adding the move to
    `unlockedMoves` -- browsing costs nothing regardless of how many moves are looked at. With
    nothing left to sell the heading reads "Nothing left to teach." and the pane says so at
    length; the Stats heading is still right there, so the panel never collapses to a dead end.
  - **Stats**: the entries name the three stats (Energy/Momentum/Lifetime, `data/balance.ts`'s
    `STAT_LABELS`), no value or cost suffix, and clicking a row only *previews* it
    (`scene.noetherStatPreview`). A stat has no art to open its detail pane
    with, so the pane leads with the stat's own name (bold, capped at the shared
    `DETAIL_NAME_CAP`), then a one-line effect gloss in gold ("Raises your crit chance.",
    "Higher goes first each round.", "Higher takes less damage."), then **what the stat
    actually is in physics** (`data/statLore.ts`'s `STAT_LORE`, one short paragraph, capped
    tighter than anything else in the pane since it is the longest text in the panel), then a
    `Now at <value>. Raising it to <value+1> costs <cost> qumatessence.` status line and a
    `Raise <stat>` confirm button (dimmed if unaffordable) that is the one action
    checking/spending the cost. The three names are not decoration: energy, momentum and
    lifetime are the three numbers that define a quasiparticle, so the stat sheet a player
    raises here is the crystal's own excitation spectrum, and the pane says so. A stat already
    at `MAX_STAT` (all three of them in Superposition Mode, which pins them there) still
    selects and reads; its pane says `Already at <MAX_STAT>, as high as I can raise it.` and
    offers no button, the same nothing-to-commit convention Feynman's fully-leveled moves use.
- Every guardian panel but the rival gate's own ends in a single "Farewell" button -- Noether's
  own panel never offers a way onward; leaving a world is something the player walks to the
  pass and presses at (see "Gates as passes" below), since the pass is where that world's boss
  actually stands. Where the panel is a list+detail layout (both of Noether's own tabs, and
  Bloch's panel below) that button sits in the left column beneath its rows
  ("List+detail panels" above), which on Noether's own panel means beneath whichever heading is
  open and its entries.

## Bloch in the overworld (`OverworldScene.showBlochHub`)

- World 2 only, standing at the middle tile like every other guardian -- same
  landmark/wander/re-open pattern as Noether (see above), just with `art/bloch.ts`'s
  `makeBlochAvatar` and a cyan
  (`0x8fe8ff`) name label. In place of a head he carries a
  **Bloch state** -- world 2's own band-structure subject, psi_k(r) = e^(ik.r) u_k(r),
  drawn as its two factors at once: a fixed row of five haloed ion sites one lattice
  constant apart, a faint teal envelope whose corrugation repeats exactly with that
  spacing and piles amplitude onto the sites, and inside it the bright state itself,
  redrawn every frame off a phase a `repeat: -1` tween advances, with its crests marching
  steadily through the array, each crest carrying a bead of light along the curve. Only
  the carrier moves; the envelope stays pinned to the lattice. The
  carrier's wavelength is deliberately not a multiple of the lattice constant, so the phase
  really does advance by e^(ik.a) from one cell to the next instead of the two periods
  collapsing into one. Below the wave there is no solid body at all: the torso is the
  crystal itself, a tapered open outline holding the lattice's deeper rows -- sites
  directly below the top row's, one lattice constant apart in both directions, dimming
  with depth, the taper cutting the lattice off the way a crystal ends at its surface.
  Silhouette: a broad wave band over a tapered open lattice body.
- His panel (`showBlochHub`) is stroked teal (`0x4adde0`), `LIST_DETAIL_PANEL_W` (`720`) wide,
  and is a table+map layout -- the most content-dense guardian panel in the game (avatar/intro, a
  10-row destination table, the Qumatuomi map, a physics blurb, a status/confirm block, and the
  Farewell footer, all in one). The **left column** is a list+detail table
  (`scenes/panels/listDetail.ts`'s `renderListColumn`, "List+detail panels" above) listing every
  built world (`BUILT_WORLDS`, all 10, not filtered to only visited ones) -- a world not yet
  visited (Story Mode only; see the Superposition Mode note below) shows `???` in place of its
  real name, dimmed the same blue-grey (`#6a7396`) Qumatex's own undiscovered rows use. The
  **right side** is not a plain per-selection detail pane the way Dresselhaus'/Majorana's own
  right columns are: the Qumatuomi map (`art/qumatuomiMap.ts`, "Qumatuomi map" above) sits fixed
  at the top, rendered once showing all 10 worlds at once and never swapped, given a height budget
  (`146`px requested) well past the silhouette's own `110`px native height, so it draws scaled up
  and its painted regions and texture marks are large enough to read as terrain -- the map's
  *width* budget is generous (the right column's own width) so height, not width, is always the
  binding side of its uniform scale-to-fit. That is as large as this panel can carry it: at the
  largest text-size preset the right column is the taller of the two and ends with the same margin
  below it that the left column already ends on at the smallest, checked on the longest world
  entry (World 9's) with a confirm button present.
  Each of the map's 10
  markers gets its own `setInteractive` circle hit area (larger than the marker's own few-px
  radius) and `pointerdown` handler, so clicking a marker previews that world exactly like
  clicking its table row does. Beneath the (unmoving) map sits the actual detail content for
  whichever world is currently previewed -- a physics blurb (`data/worldFlavor.ts`'s
  `WORLD_FLAVOR`, in the same epic-plus-physics voice every guardian's own intro quote uses,
  shrinking in whole-px steps down to floor `9` the same way Majorana's own hybrid-fusion-lore
  description does if a long entry would otherwise overflow), then a status line, then (unless the
  previewed world is either the one the player is already standing in or one not yet discovered,
  see below) a confirm button reading
  `Travel to <name>` (dimmed if unaffordable while the destination is not yet in registry/save
  `blochUnlockedWorlds`; the status line above it carries the 15-qumatessence price, and one
  already in that list travels for free) -- the same crystal-render-then-name-then-status-then-button shape
  every other list+detail detail pane uses, just with the fixed map standing in for the crystal
  render. Clicking either input (a table row or a map marker) only *previews*
  that world (`blochPreview`, "List+detail panels" above) -- highlighting the row gold-on-purple
  and drawing a pulsing gold ring around the matching marker, updating the blurb/status/button
  beneath the map in the same click, so the two inputs can never
  disagree about the current selection -- at no cost; the confirm button is the one action that
  actually checks/spends the cost, adds the world to `blochUnlockedWorlds`, and teleports
  (`advanceToWorld`, no battle). Previewing the world currently stood in (`scene.world`; never
  triggers on `HubScene`, whose `world` is always `0`) still shows that world's own blurb, with a
  status line naming it directly ("You are standing in World N -- `<name>`.") instead of a
  button; previewing an undiscovered `???` world shows a short fixed line in place of its blurb
  ("Mist covers this land -- you have not walked it yet.") and, in place of its status, Bloch
  saying why there's no button ("You have never walked this land -- I cannot fold you where you
  have not been."). Superposition Mode's own
  `BUILT_WORLDS`-as-discovered special case (the persisted `visitedWorlds` list only gets
  pre-seeded with every built world on world entry, not on opening the Lab, so a fresh
  Superposition save still needs every world to read as discovered immediately) means no row ever
  shows `???` there, and every destination reads as already unlocked, so a fresh Superposition
  save can still teleport anywhere with zero qumatessence -- Bloch's hub is the *sole* way to move
  between worlds in that mode (there is no separate warp panel).

## Dresselhaus in the overworld (`OverworldScene.showDresselhausPanel`)

- World 3 only, standing at the middle tile like every other guardian, and her panel
  auto-opens on reaching that row (`maybeAutoOpenMiddleDialogue`), same as every
  other guardian. Teal-green (`#6ee8ba` label / `0x4ad9a0` stroke and avatar accents) name
  label; her avatar (`art/dresselhaus.ts`'s `makeDresselhausAvatar`) is a figure caught
  mid-transmutation -- Mildred Dresselhaus's own science made visual: from the waist down
  she *is* a point-down faceted crystal, shaded facet by facet in the same vocabulary as
  the game's wild-crystal shards (`art/crystals.ts`), its facet edges lit from a hot core
  and a few sparkle points twinkling on their own timings, with a dark bust above it that
  the crystallization is still climbing -- small hexagonal bond fragments growing up from
  the waist and thinning out as they rise -- and, in place of a face, a slowly rotating
  hexagonal carbon ring of haloed sites -- the unit every
  nanostructure she mapped (graphite, graphene, nanotube, fullerene) is assembled from --
  with a single bright mote riding the ring itself: the delocalized pi electron such a
  ring shares among all six bonds.
  Silhouette: a wide angular diamond under a narrow bust, the roster's only bottom-heavy
  angular outline.
- Her panel is a list+detail layout (`scenes/panels/listDetail.ts`, "List+detail panels"
  above), not the tab-content/footer shop shape -- every defeated wild material
  (`defeatedMaterials`, or in Superposition Mode every crystal in the game --
  `data/materials.ts`'s `allCrystals()`), in both modes filtered through `isHybridMaterial`
  so no hybrid-recipe result is ever offered, gets a left-column row naming it only, no cost
  suffix. Clicking a row only *previews* it (`scene.dresselhausPreview`) -- the right column shows that candidate's
  own crystal render, name, and a status line ("This is your current form" for whichever
  crystal the player is already wearing, "Already unlocked -- free to become" for one already
  paid for, or "Costs 25 qumatessence to unlock (one-time; free after)" otherwise), plus a
  "Become `<name>`" confirm button (hidden for the current form) that's the one action
  actually checking/spending the cost, adding the crystal to `registry`/save
  `dresselhausUnlockedCrystals` if it wasn't already there, and transmuting
  (`transmuteInto`) -- browsing candidates in the left column costs nothing regardless of how
  many are looked at. Transmuting swaps color/variant/moveset only -- HP is never intrinsic to
  a crystal form, it's `wildHpForWorld` for whichever world the player will actually resume
  into -- and immediately redraws the overworld avatar (`redrawPlayerCrystal`). Empty state
  (no candidates at all, rendered as plain centered text with no columns): "You haven't
  defeated any crystals yet -- there is nothing to become." The left column paginates once
  the list is longer than one page -- the common case in Superposition Mode, which also
  treats every crystal as already unlocked -- with the panel's single "Farewell" button in the
  left column beneath those rows ("List+detail panels" above).

## Landau in the overworld (`OverworldScene.showLandauPanel`)

- World 4 only, standing at the middle tile like every other guardian. Blue-violet
  (`#8fa0ff` label / `0x6a7fff` stroke and avatar accents) name label; his avatar
  (`art/landau.ts`'s `makeLandauAvatar`) is not a robed figure at all: the whole body
  is the Landau-quantized spectrum itself, drawn as five equal-length horizontal rungs at
  even spacing (a Landau level is flat, and the oscillator ladder puts every gap at the
  same `ħω_c`), brightest at the bottom and dimming upward, over a single faint parabola
  standing for the free band the field quantizes. One bright electron jumps rung to rung
  on a stepped tween -- never a slide, since there is no energy between two levels -- and
  the orbit glyphs read 'ħω'. Silhouette: a stack of horizontal bars, the roster's only
  rung ladder.
- **List+detail layout** (`scenes/panels/landau.ts`, "List+detail panels" above, at the shared
  `LIST_DETAIL_PANEL_W`): his two quiz-gated Analytic moves (`data/materials.ts`'s
  `ANALYTIC_MOVE_IDS`, a hardcoded pair, `skyfallBeam`/`groundEruption`) are two rows in the left
  column, and whichever is selected (`scene.landauMovePreview`) fills one full-width detail pane.
  Those two headings name the move by its bare shape word alone, "Lance" and "Eruption"
  (`data/materials.ts`'s `moveShapeName`), with no quasiparticle in front: the quasiparticle is
  what the entries nested under the open heading are for, so putting one in the heading too
  would state it twice and read as fixed while the player is mid-change. The detail pane beside
  them still carries the full resolved name (`moveDisplayName`, quasiparticle and Feynman tier
  prefix included), and so does everywhere the move is actually swung.
  It also means every guardian who sells a move is read the same way. **The quasiparticle choice
  is the second level of that column**, not a strip of pills in the pane: the open move's
  hostable classes (`tunableMoveShop.ts`'s `hostableClasses`) are its entries, indented under it,
  exactly the shape Noether's panel uses. Picking one only *previews* it
  (`scene.landauClassPreview`); the pane's own button is what spends anything, which is the
  preview-then-confirm rule every other list+detail panel already follows. The pane
  (`renderAnalyticColumn`) opens with that move's own real battle-effect
  animation looping on its stage (`renderMoveDetailHeader`, "List+detail panels" above and
  "Attack effects" below),
  overriding the plain per-class bolt/ring/burst shape via `ANALYTIC_SHAPES` (each Analytic move
  is `'beam'`/`'eruption'`) the same way `BattleScene` itself does, still colored by whichever
  quasiparticle class the move is currently tuned to (`getTunedMoveClass` -- a not-yet-tuned move
  falls back to its own default `'phonon'`, same fallback the real fight uses) and escalated to
  the player's real Feynman level for that move (`getMoveLevel`) the same way every
  `renderMoveDetailHeader` caller now can. The column's own name text is `moveDisplayName`, not
  the bare `tunedMoveDisplayName` -- it folds in both the current quasiparticle (below) and
  Feynman's own Double/Triple/Infinite level prefix, so a leveled tuned move's preview title and
  its real battle-menu name always read identically. Below that: a status line -- for a
  still-unbought move, "Costs `<cost>` qumatessence to learn." (reusing `shopCost`); for an
  already-bought one, "Tuned to `<quasiparticle>`." (or, if the player has since transmuted into
  a form that can no longer host the saved assignment, "Tuned to `<quasiparticle>`, reverted to
  Phonon (this form can't host it)." -- the fallback reads the bare quasiparticle noun,
  `quasiparticleLabel`, not the move's own shape word -- or "Untuned -- pick a quasiparticle." if
  never assigned, Superposition Mode's own edge case), naming the previewed quasiparticle and
  what it costs -- and the one button that spends anything: `Learn <name>` on a still-unbought
  move (`buyLandauMove`, checking/spending `shopCost`, adding the move to `unlockedMoves`, and
  recording the class, all three at once, with no separate "buy" step before picking a class), or
  `Tune to <quasiparticle>` on an already-bought one, free among any hostable class with no
  per-class cost (`retuneLandauMove`). A move already tuned to the previewed class offers no
  button at all, the same nothing-to-commit convention every other pane uses. Committing
  re-renders the whole panel, this panel's own established full-rebuild-per-click convention.
  Skłodowska-Curie's own panel below does *not*
  reuse `buyLandauMove`/`retuneLandauMove`, her per-class-unlock pricing is different enough
  that her own commit logic is bespoke, though both panels share the same `hostableClasses`
  filter and the same two-level column.
- **The move's displayed name always leads with its current quasiparticle**
  (`data/materials.ts`'s `tunedMoveDisplayName`, folded into `moveDisplayName` above) everywhere
  a move name shows up in battle too -- the move-menu button, the analytic-question panel's
  title, the battle log's "X used `<name>`!" line -- built from the quasiparticle's own bare
  label (`quasiparticleLabel`, e.g. `Magnon` for `'magnon'`) plus each move's fixed shape word
  ("Lance"/"Eruption") rather than a second hand-authored word list, so `skyfallBeam` tuned to
  `'magnon'` reads as "Magnon Lance," `groundEruption` tuned to `'chargedAnyon'` as "Anyon
  Eruption," and so on. An untuned move defaults to `'phonon'`, reading as "Phonon
  Lance"/"Phonon Eruption." The name updates as soon as a pick is committed, reading directly off
  the class that was chosen.

## Quasiparticle picker (`scenes/panels/tunableMoveShop.ts`)

- **The choice of quasiparticle is the second level of the left column**, on both panels that
  sell a tunable move (Landau's above, Skłodowska-Curie's below): each of that guardian's two
  moves is a heading, and the open one's hostable classes are its entries, indented under it
  (`listDetail.ts`'s `renderTreeHeading`, the same two-level column Noether's own panel uses).
  Reading down one column beats a strip of small pills docked under the pane: it is the shape the
  rest of the game already uses, the rows are ordinary full-size list rows rather than a denser
  control of their own, and picking one is a *preview*, not a purchase.
  `hostableClasses(scene)` is `TUNABLE_MOVE_CLASSES` filtered through `canHost` against the
  player's *current* form, shared by both callers so "which quasiparticle should this carry" stays
  grounded in what the crystal can actually host right now rather than a free pick from every
  class in the game. Entries read as the class's own bare name (`quasiparticleLabel`, e.g.
  "Magnon" for `'magnon'`) plus " (current)" on whichever one the move is presently tuned to; the
  cost lives in the pane's status line, not on the row, like every other list+detail panel.
- **Picking never spends.** The row only sets that panel's own preview field
  (`landauClassPreview`/`curieClassPreview`); the pane's button commits. Skłodowska-Curie's
  unlock is the largest single price in the game, and one stray click should never be able to
  spend it.
- **How many classes fit.** The most any current form hosts is five (`chernSuperconductor`), and
  five show whole at the Compact and Normal text-size presets. At Large the list pages two at a
  time through `renderListColumn`'s own Prev/Next controls, with both headings and Farewell still
  on screen, so nothing becomes unreachable. Six would behave the same way: whole at Compact and
  Normal, paged at Large.

## Majorana in the overworld (`OverworldScene.showMajoranaPanel`)

- World 5 only, standing at the middle tile like every other guardian. Green (`0x4fd97a`)
  name label and panel stroke; his avatar (`art/majorana.ts`'s `makeMajoranaAvatar`) is a
  figure split clean down the middle -- two mirrored half-cloaks and half-heads with a gap
  of dark between them, held together only by a thread of pulsing motes down the seam (one
  fermion carried as two spatially separated Majorana halves, the shared nonlocal state the
  visible link), the halves breathing apart and back together without ever separating, with
  'γ' orbit glyphs. Silhouette: the roster's only bisected outline.
- His panel is a single list+detail step (`scenes/panels/listDetail.ts`, "List+detail panels"
  above), browsed by *hybrid result* rather than by ingredient: the left column lists every
  named `data/materials.ts` `HYBRID_RECIPES` result reachable from the player's defeated wild
  materials (or, in Superposition Mode, every crystal in the game) via
  `combinableHybridResults` -- a same-name recipe (e.g. Graphene + Graphene) is reachable from a
  single crystal of that name, a distinct-parent recipe needs both. Clicking a row only
  previews it (`scene.majoranaPreview`, holding the previewed *result's* name); browsing costs
  nothing regardless of how many hybrids are looked at. The right column shows, top to bottom:
  the two original component crystals rendered small and side by side (`makeCrystal`, size
  `14`) with a single caption line naming both (`<A> + <B>`, or `<A> ×2` for a self-paired
  recipe, which keeps the caption short for this panel's longest self-paired name); the
  resulting hybrid's own full-size crystal render and name below them
  (`renderDetailCrystalHeader`, the same crystal-plus-name block Dresselhaus's/Anderson's own
  detail panes use); an epic-narrative-plus-physics description of the fusion
  (`materialdex.ts`'s `HYBRID_FUSION_LORE`, one entry per `HYBRID_RECIPES` result, shrinking in
  whole-px steps floor `9` the same way Qumatex's own blurb does if a long entry risks pushing
  the footer off the canvas); and finally a cost/status line and confirm button. Each result is
  its own one-time unlock: a result not yet in `registry`/save `majoranaUnlockedResults` shows
  "Costs 60 qumatessence to unlock (one-time; free after)" with a "Fuse" confirm button, dimmed
  if unaffordable; an already-unlocked result shows "Already unlocked -- free to fuse" with the
  same "Fuse" button, undimmed. Confirming is the
  one action that actually checks/spends the cost, adds the result's name to the list, and
  transmutes the player into the recipe's own named result (`data/materials.ts`'s
  `combineMaterials` -- name/type/moves all fixed on the recipe, not computed at combine time)
  the same way Dresselhaus's transmutation does -- no memory of earlier fusions to instantly
  re-become one, every visit starts the browse fresh. The left column paginates once the
  reachable-result list is longer than one page. Empty state (no reachable result at all,
  rendered as plain centered text with no columns): "None of the crystals you've defeated pair
  into a known hybrid recipe yet -- Majorana only knows specific real pairings (e.g. Aluminum +
  Indium Arsenide, or two Graphenes together)." Superposition Mode treats every result as
  already unlocked.

## Anderson in the overworld (`OverworldScene.showAndersonPanel`)

- World 6 only, standing at the middle tile like every other guardian. Rust/amber
  (`0xc9884a`) name label and panel stroke; his avatar (`art/anderson.ts`'s
  `makeAndersonAvatar`) has no outline at all: the figure is a loose scatter of chunky
  disconnected fragments -- densest through the torso, thinning toward the edges like a
  localized wave's decaying envelope -- with one bright site pulsing at the heart where the
  amplitude is trapped, plus four orbiting `×` impurity glyphs. Nothing connects the
  fragments (deliberately unlike Feynman's propagator lattice beside him in the Lab):
  disorder has no bonds, only sites. Silhouette: the roster's only fragmented outline.
- The panel is a two-step flow, but only the first step (picking which host to dope in) is a
  list+detail layout (`scenes/panels/listDetail.ts`, "List+detail panels" above) -- the second
  step (which specific move to learn) stays a plain paginated
  button list (`renderPagedButtons`, below), since a move has no crystal art of its own to
  preview. Every defeated wild material (or, in Superposition Mode, every crystal in the
  game) that isn't a hybrid (`isHybridMaterial`) gets a left-column row under "Dope in which
  crystal?"; clicking one only previews it (`scene.andersonHostPreview`) -- the right column
  shows that candidate's own crystal render, name, a status line ("Already unlocked -- free
  to learn its moves" or "Costs 35 qumatessence to unlock (one-time, host-wide)"), and a
  "Dope in `<name>`" confirm button that records it as the chosen host
  (`scene.andersonSelection`) and advances to the second step -- still free, just like
  browsing was; the ANDERSON_DOPE_COST charge itself only ever happens on the second step.
  That second step asks "Learn which move from `<host>`?"; each learnable row is priced by
  whether the *host* is unlocked, not the move: while `<host>` isn't yet in `registry`/save
  `andersonUnlockedHosts`, every one of its rows reads `<move name> (Pwr N) (35
  qumatessence)`, dimmed if unaffordable; picking one while affordable deducts the cost,
  adds the host's name to the list, and learns that move in the same click. Once a host is
  unlocked, its rows drop the cost suffix -- `<move name> (Pwr N)` -- and learning any of its
  moves (now or later) is free. A "Never mind" (to back out to the first step) shares one row
  with the panel's own Farewell button at this second step (side by side, the same
  convention) rather than stacking two
  separate footer rows. Picking a move appends it to the ordinary `unlockedMoves` list
  (`learnImpurityMove`) -- no form change, no HP change, unlike Dresselhaus/Majorana. Empty
  states (rendered as plain centered text with no columns): "You haven't defeated any
  original crystals yet -- there is nothing to dope in" (no host candidates) or "You already
  carry every move `<host>` has to offer" (host picked, but every one of its moves is already
  learned). Superposition Mode treats every host as already unlocked.

## Feynman in the overworld (`OverworldScene.showFeynmanPanel`)

- World 7 only, standing at the middle tile like every other guardian. Amber (`#ffa64a`
  label / `0xffa64a` stroke) name label -- the same amber the world's earlier guardian
  used, free to reuse once nothing else in the roster claims it. His avatar
  (`art/feynman.ts`'s `makeFeynmanAvatar`) has no cloak/robe fill at all: a loose
  humanoid lattice of bright vertex points connected by straight propagator lines, two
  small pulsing loop-insertion circles along the torso/hip lines (the diagrammatic mark
  of a higher-order correction), and four small vertex dots orbiting in place of another
  guardian's orbiting glyphs. Silhouette: the roster's only connected line-lattice
  outline -- Anderson beside him in the Lab is the scatter with no connecting lines at
  all, this is the construct that is nothing but connections.
- A list+detail panel (`LIST_DETAIL_PANEL_W`, "List+detail panels" above). The left column
  lists every move the player has ever unlocked (`getUnlockedMoves`, not `getBattleMoves`: a
  move currently unusable in the player's present form is still worth leveling for later),
  each row showing the move's tuned name without its level prefix -- the prefix is the same
  word on every row once a save is well leveled, and it alone fills the column at the largest
  text-size preset. Selecting a row previews that move in the right pane at the tier it is
  currently *carried* at, over a status line reading `Level to "<next tier>": <N> questions in
  a row, <cost> qumatessence paid whether it lands or not` and a confirm button. Between the
  preview and that status line sits the tier picker: a "Swing it at:" caption over one small
  button per tier the move has already unlocked (Base / Double / Triple / Infinite), laid
  across the pane's full width as a plain fixed row rather than a paged list, since there are
  never more than four. The carried tier is the dimmed no-op, the same "already the active
  choice" treatment every confirm button uses. The whole block renders only once a move is
  past tier 0 -- with nothing unlocked there is no choice to offer -- so the pane keeps its
  shortest form until the player's first tier lands, and its tallest case (largest text-size
  preset, two tiers unlocked, confirm button still present) still clears the bottom of the
  canvas. A move already at tier 3 still previews -- its cascade at full level is the reward
  for having leveled it -- with a status line saying so and no confirm button, the picker
  above it still live; an unaffordable one dims the confirm, not the row. Owning no moves at
  all leaves the panel a single line and a Farewell button.
- Confirming deducts `feynmanLevelCost` immediately (the qumatessence is
  spent the instant the attempt starts, not on a successful outcome) and opens the
  question streak in its own sub-panel -- same amber stroke as the main panel, one
  question at a time (`data/quiz.ts`'s `getAnalyticQuestions`), two shuffled answer
  buttons per question, the same shape `OverworldScene.showEncounter`'s pre-battle quiz
  and BattleScene's own Analytic/Ultimate question panels use. Answering the whole
  streak correctly writes the new tier and carries it (a tier just paid and answered for is
  the one the player walks away swinging) before returning to the main panel; missing any
  single question also returns to the main panel, level unchanged -- the qumatessence
  already spent is never refunded either way, so this sub-panel offers no "cancel": once
  started, the payment is already made.

## Kondo in the overworld (`OverworldScene.showKondoPanel`)

- World 8 only, standing at the middle tile like every other guardian. Rust-orange
  (`0xe86a44`) name label and panel stroke -- distinct from Anderson's own rust/amber
  (`0xc9884a`) above; his avatar (`art/kondo.ts`'s `makeKondoAvatar`) is the Kondo effect
  drawn whole: a deliberately small dark figure (the local moment) carrying one bold
  pulsing spin arrow, wrapped inside a much larger screening cloud of open
  conduction-electron arcs in two counter-rotating shells -- the same enclosing shape,
  and the same arc-shell vocabulary, as the persistent aura his self-buff moves wrap
  around a crystal in battle (`art/screeningAuras.ts`). The arcs are the avatar's outer
  edge; there is no robe under them. Silhouette: the roster's only round, enclosing outline.
- List+detail layout (`scenes/panels/listDetail.ts`, "List+detail panels" above), the same shape
  Noether's Moves tab and Feynman's own move-leveling list use: the left column names all
  three of `data/materials.ts`'s `KONDO_MOVE_IDS` (Spin Screening, Charge Screening, Symmetry
  Cloud) via `moveDisplayName`. Clicking a row only *previews* it (`scene.kondoMovePreview`),
  free regardless of how many moves are looked at. A Kondo move is a self-buff rather than a
  travelling attack -- `BattleScene.resolveSelfBuff` plays its real effect centered on the
  caster's own position (`from === to === pos`), not flying from attacker to target the way an
  ordinary move does -- so the right column shows the player's own current crystal, rendered
  by the shared `renderSelfBuffMoveDetailHeader` (`scenes/panels/listDetail.ts`) at the shared
  `DETAIL_CRYSTAL_SIZE` (`44`) with the player material's own `seed`/`hybridParents`,
  standing on a ground-shadow ellipse, with the
  move's `'screening'`-class ring effect (`art/attackStyles.ts`'s `EFFECT_STYLE`, tinted
  `0xe86a44`) looping *centered on the crystal itself* rather than travelling across the pane --
  the self-buff sibling of the ordinary `renderMoveDetailHeader` that Noether's, Feynman's,
  Landau's and Skłodowska-Curie's own panes use. Like that
  sibling, it plays the move at the player's real Feynman level, so a leveled Kondo move previews
  the same escalating multi-trigger cascade a real cast plays. Below that:
  the move's own one-line `description` (`data/materials.ts`'s `Move.description`, only Kondo's
  three moves carry one), then a cost/status line and a confirm button -- "Learn `<name>`"
  for a still-unbought move (dimmed if unaffordable, priced by `shopCost`),
  "Make `<name>` active" for an already-bought but inactive move, or a dimmed "`<name>` (active)"
  tag (no-op click) for whichever one is currently active (registry/save `kondoActiveMove`) --
  the confirm button is the one action that actually checks/spends the cost. Buying the first
  Kondo move activates it immediately (still shows the dimmed "(active)" tag right away, no
  separate click needed); buying a second or third afterward doesn't, and switching which one is
  active always requires reopening this panel and clicking "Make active," not a per-turn choice
  in the battle move menu. None of the three self-buff moves is gated by a crystal's own physics
  at all, so all three are always for sale until bought -- no empty/wrong-form state to render
  here, unlike Noether's shop.

## Franklin in the overworld (`OverworldScene.showFranklinPanel`)

- World 9 only, standing at the middle tile like every other guardian. Lavender
  (`#c9a8e0` label / `0xa878c9` stroke and avatar accents) name label; her avatar
  (`art/franklin.ts`'s `makeFranklinAvatar`) is a slim experimenter holding her detector
  plate out in front of her like a shield -- which is what her always-on defensive
  passives are. The plate is a dark upright sheet of film -- the rectangular format these
  images are exposed on -- gripped by two hands at its edges and printed
  with the diffuse Debye-Scherrer ring pattern porous/amorphous carbon scatters an X-ray
  beam into: concentric rings pulsing on offset timings around a dim central beam spot,
  with scattered pore sites between them -- a dusty amethyst/lavender palette distinct
  from Anderson's rust/amber despite the shared defect/disorder theme. Silhouette: a head
  and narrow shoulders over one hard-edged upright slab. The rectangle is load-bearing at
  Lab scale, where the guardians stand small and side by side: Kondo's screening shells
  are a disc by necessity, since an enclosing cloud is that physics, so a round plate here
  would leave the two sharing one outline and separable only by colour.
- Qumatex-like: below the avatar/quote, the panel (`scenes/panels/franklin.ts`, `760` wide)
  splits into two columns -- a fixed-size crystal-preview block on the left, the passive shop
  list on the right, divided by the same thin vertical line every list+detail panel uses
  (`scenes/panels/listDetail.ts`'s `insertColumnDivider`, drawn beneath every row and button).
  Putting the crystal beside the list rather than above it means the
  crystal block adds no extra height beyond whichever column is already taller, since this panel
  has no shrink-to-fit safety net and was already close to `CANVAS_H` at the largest text-size
  preset before the crystal existed.
- The **crystal block** renders the player's own current crystal (`makeCrystal(scene, 34,
  scene.playerMaterial.color, scene.playerMaterial.variant, { seed: scene.playerMaterial.name,
  hybrid: scene.playerMaterial.hybridParents })`, the same call convention `BattleScene` uses)
  standing on a plain `0x000000`-at-`0.3`-alpha ground-shadow ellipse (no biome here to shade it
  off the way `BattleScene`'s own shadow is), fixed-size regardless of the text-size setting
  ("art, not text," same reasoning as Qumatex's own `crystalBlockH`). Whichever passive is
  currently being looked at gets its own ground halo drawn around that shadow
  (`art/passiveHalos.ts`, see "Battle status effects" below for what each of the three looks
  like) plus a small status label underneath: full alpha and "`<name>` (active)" for the passive
  actually active in battle, `0.45` alpha and "`<name>` (preview)" for any other passive, or "No
  passive active" if none is active yet and nothing's been clicked. The label's own reserved
  height is measured up front from the longest possible `<name> (preview)` string so a later
  preview swap can never grow the block past what the panel was first sized for.
- Buy-list-plus-switch shape (`renderPassiveList`, Franklin's own thin wrapper around
  `scenes/panels/passiveList.ts`'s `renderChoiceList` engine), laid out in the right column via
  `ChoiceListRenderOptions`' `centerX`/`wrapWidth` (which default to full-canvas-centered when a
  caller passes neither): a still-unbought passive (`data/passives.ts`'s
  `FRANKLIN_PASSIVE_IDS` -- Diffraction Shadow, Satellite Reflection, Amorphous Halo)
  gets a `<name> -- <cost> qumatessence` buy button plus a one-line description
  underneath, both capped at a lower font-scale ceiling than every other guardian
  panel's buttons (`Math.min(fontScale(this), 1.3)` for the label, `1.2` for the
  description) rather than scaling all the way to the Lab's Settings station's
  uncapped 'Large' text-size preset -- this panel has no shrink-to-fit safety net the
  way the Lab's info panels do, and three buy rows each carrying their own
  description, on top of the avatar/intro/Farewell footer every guardian panel already
  has, pushed the Farewell button off the bottom of the canvas at the default
  text-size preset the first time this was tried uncapped. An already-bought passive
  gets a clickable "Make `<name>` active" button, or a dimmed "`<name>` (active)" tag
  for whichever one currently is. Buying the first passive activates it immediately,
  same reasoning as Kondo's first move; buying a second or third doesn't, and switching
  which one is active always requires reopening this panel. No "wrong form" empty
  state -- like Kondo's own self-buff moves, a passive is never gated by a crystal's
  own physics at all, so all three are always purchasable. Clicking any row's own
  description (not its buy/activate button) previews that passive's ground halo on the crystal
  block instead (`ChoiceListRenderOptions.onSelect`, reassigning a plain closure variable local
  to `showFranklinPanel`, never the registry) -- the same "look costs nothing, only committing
  does" convention every other guardian panel's own preview-vs-commit split already follows,
  extended here to a passive's own look rather than just its cost. Buying or activating a passive
  always reopens this panel from scratch, so the crystal falls back to whatever is now actually
  active rather than a preview click from before that purchase surviving stale.

## Skłodowska-Curie in the overworld (`OverworldScene.showSklodowskaCuriePanel`)

- World 10 only, standing at the middle tile like every other guardian -- the last one the
  player reaches. Olive (`0xc9d84a`) name label and panel stroke, carried over from the
  Curie identity's own palette; her avatar (`art/sklodowskaCurie.ts`'s
  `makeSklodowskaCurieAvatar`) is a radiant source: the tallest, narrowest figure in the
  roster, a spire-like gown tapering to a single point below every other guardian's hem,
  crowned by a pulsing fan of seven straight rays streaming off the head -- emission from
  a radioactive source, and the shape of the Nova/Meteor ultimates she teaches -- with a
  small crystal shard inside a pulsing ring at her chest (a Curie-temperature transition,
  order turning on and off). The finale-only outer halo ring and the eight-point starburst
  orbit (double the usual four) mark her as the guardians' capstone rather than a mid-game
  stop. Silhouette: the roster's only tall spike-with-ray-crown outline.
- **List+detail layout** (`scenes/panels/sklodowskaCurie.ts`, the same shape Landau's
  own panel above uses): her two Ultimate moves
  (`data/materials.ts`'s `ULTIMATE_MOVE_IDS` -- `ultimateMeteor`/`ultimateNova`) are two rows in
  the left column, headed by their bare shape word alone, "Meteor" and "Nova"
  (`moveShapeName`, same reasoning as Landau's own two headings above), and whichever is
  selected (`scene.curieMovePreview`) fills one full-width detail pane carrying the full
  resolved name. Her own intro quote is the longest in the game (it names all ten
  guardians), capped at the same `1.15`x text-size scale Landau's own intro is, since the
  animation-stage pane below it is the tallest any guardian has; see this
  panel's own worst-case-content note below for how tight that budget is. Her quasiparticle
  choice is the second level of the left column, the same as Landau's above, and
  preview-then-confirm matters more here than anywhere else in the game: an unlock costs
  `ULTIMATE_CLASS_UNLOCK_COST`, by far the largest single price a player ever pays, and it
  should never be one stray click away. The pane
  (`renderUltimateColumn`) opens with that move's own real
  battle-effect animation looping on its stage (`renderMoveDetailHeader`), overriding
  the plain per-class shape via `ULTIMATE_SHAPES` to the longer, multi-phase `playMeteor`/
  `playNova` sequences (below), still colored by whichever quasiparticle class the move is
  currently tuned to, and escalated to the player's real Feynman level for that move
  (`getMoveLevel`) -- a leveled Ultimate's preview genuinely runs its own full multi-phase
  cascade once per repeat, same as a real leveled cast (see "Attack effects" below). The column's
  name text is `moveDisplayName` (level prefix folded in), not the bare `tunedMoveDisplayName`.
  Below that: a status line -- "Not yet unlocked -- pick a quasiparticle to unlock it." if the
  move isn't in `unlockedMoves` yet, or "Carrying `<quasiparticle>`." (or the same "reverted to
  Phonon" fallback wording Landau's own status line uses, or "Unlocked, but untuned -- pick a
  quasiparticle." in Superposition Mode's own edge case), naming what the *previewed* class
  costs: free if that class is already paid for on this move (registry/save
  `ultimateClassesUnlocked[moveId]`), else `ULTIMATE_CLASS_UNLOCK_COST` qumatessence. Her pricing
  is per class per move rather than Landau's single flat move purchase, so the status line reads
  off the previewed class rather than one cost for the whole move. Below it, the one button that
  spends: `Unlock <quasiparticle>` for a class not yet paid for on this move (dimmed if the
  player can't afford that class right now), or `Carry <quasiparticle>` for one already paid
  for, which is free. `pickUltimateClass` is what both run, and on a move's very first-ever class
  pick it also adds the move id to `unlockedMoves`. A move already carrying the previewed class
  offers no button. The Farewell button in the left column is always present regardless of
  affordability, so a too-poor player is never left with nothing clickable and `dialogueActive`
  stuck true. In Superposition Mode every hostable class reads and behaves as already unlocked, same
  blanket-grant treatment every other guardian's gated content gets.
- Using an Ultimate move in battle opens `BattleScene.showUltimateQuestions` instead of
  `showAnalyticQuestion` -- up to three sequential question panels, same visual family as
  the Analytic question panel below, tagged `★★★` in the move menu instead of `★`, with
  its own "3/3 correct or it whiffs" legend line. Landing a 3-for-3 hit plays a
  multi-phase "summon" animation dramatically longer than any other move's effect (see
  "Attack effects" below) rather than the shared windup/travel/impact beat every other
  move uses.
- **Worst-case layout budget.** This panel (and Landau's own above) carries more content than
  any other guardian panel -- a full-height animation stage plus an inline quasiparticle picker,
  below her own especially long intro quote -- so the vertical fit is verified against the actual
  worst case rather than assumed: a `chernSuperconductor` crystal (the type with the most
  hostable classes, at five, so the left column's own entry list is at its longest and
  paginates) at the largest (`2x`) text-size preset, with the longest status line the pane can
  show. Measured content bottom stays under `CANVAS_H` (`480`) with real margin (roughly 45px),
  and the left column is what sets it -- the detail pane, taller stage included, still ends
  above the Farewell button beneath the rows. Confirmed via a headless render rather than by
  inspection alone.

## Paginated candidate lists (`OverworldScene.renderPagedButtons`)

- Shared by every plain single-column candidate list that can outgrow one screen -- Anderson's
  second step (picking which move to learn from an already-chosen host) is its only caller.
  Superposition Mode is what makes this routine rather than a rare edge
  case: its candidate pool is every crystal/move in the game, commonly far more entries than the
  equivalent Story Mode list. Dresselhaus's transmute list, Majorana's browse-by-hybrid-result
  list, Anderson's own first (host-pick) step, Feynman's own move-leveling list,
  Noether's/Landau's/Skłodowska-Curie's own move lists, and Bloch's own destination table
  instead use the two-column list+detail layout ("List+detail panels" above) for the same reason -- its
  own left column paginates the same candidate-pool-can-outgrow-one-screen way, just via
  `renderListColumn` rather than this function.
- One button per row, same treatment as every other dialogue button, followed -- only
  once the list is longer than one page -- by a single shared row holding `<- Prev`
  (left), a small blue-grey `Page N/M` label (centered, vertically centered against the
  buttons' own height), and `Next ->` (right), rather than a button row with the page
  label on a separate line beneath it: `<- Prev`/`Next ->` each dim to 35% alpha and go
  inert at the start/end of the list.
- The actual row count per page isn't a fixed number: each candidate's own label is
  measured for real at the current Settings-panel text-size preset (`ui/text.ts`'s
  `fontScale`) -- not assumed to be a single line -- and a page fills only as many rows as
  actually fit above the panel's own trailing Farewell/Close button, since a long,
  multi-word label (a crystal name, or a guardian-shop label with a cost suffix) can
  word-wrap to two lines at a large preset while a short one stays on one. A fixed
  per-page cap risks overflowing a guardian's own panel at the *default* text-size preset
  (1.5x, not 1x) once Superposition Mode makes a long candidate list the common case rather
  than a rare one; sharing one row
  for Prev/Next/the page label (above) reclaims the vertical room a two-row layout spent
  on chrome rather than content, margin that matters most for a guardian whose avatar/
  intro text already leaves little slack at the largest preset. Packing itself runs
  twice: once assuming the whole list fits on a single page (no Prev/Next row needed at
  all), and only if that doesn't hold does a second pass reserve room for that row too --
  a short candidate list that genuinely fits together on one page shouldn't be split in
  two just because a reservation assumed controls it turns out not to need -- verified
  with no overflow at every font-scale preset via the headless-Chromium harness (see
  DEVELOPMENT.md's "Verifying UI changes" section).
- Anderson's second step (this function's own plain paginated list) also renders a "Never
  mind" cancel row to back out to the first (host-pick) step -- this shares one row with the
  panel's own Farewell button (side by side, the same left/right convention every other
  own Farewell/Continue footer uses) rather than stacking as two separate rows, since this
  step already carries more chrome (avatar, intro, a second-step label, the candidate list
  itself) than any single-step panel does.

## Boss avatars (`OverworldScene.spawnBossSprite`, `art/boss.ts`)

- Every built world's rival, while still undefeated, stands in the throat of
  that world's forward pass and bars it, as a purely visual landmark. **It is
  sized to the aperture, not to the screen**: `BOSS_CRYSTAL_SIZE` is derived so
  that the golem's widest span (`BOSS_SILHOUETTE_HALF_WIDTH`) covers the
  throat's full walkable width, leaving no gap showing from the approach tile
  and staying fully visible from the tile in front. Projection scale cancels
  out of that ratio, so it holds at every distance. Scale is read against the
  opening -- a figure filling a narrow notch reads larger than a giant in an
  open field, and the narrowing carries the menace. Since
  the silhouette reaches `BOSS_SILHOUETTE_TOP`/`BOSS_SILHOUETTE_BOTTOM`
  (`1.4`/`1.16`, exported from `art/boss.ts`) multiples of that above and below
  its own center, the rendered golem stands over 2.5x that tall, dwarfing both a
  wild crystal (`22`) and the player's own on-map size (`34`) -- and
  rendered by `makeBossCrystal` rather than the shared `makeCrystal` every
  wild/rival crystal otherwise uses: a golem silhouette that literalizes each
  rival's own name (rivals 1-8 and World 9's per-type lookup, `WORLD_RIVALS`/
  `RIVAL_9_NAMES` in `data/materials.ts`, each name a real compound's
  *polycrystalline* form -- "many grains fused into one mass"). Its build,
  bottom to top:
  - **One dark humanoid outline polygon** (`art/boss.ts`'s `SILHOUETTE`, traced
    once in units of `size`) filled in `shade(color, -62)` and stroked at 3px,
    drawn under every shard. Guaranteeing the creature read as one shape is what
    lets the grains on top be as angular and noisy as the polycrystalline theme
    wants, and the dark fill doubles as the hard edge that keeps the golem
    legible over a daylight biome as well as a dark one. The same polygon at
    `1.04` scale, additive in `shade(color, 70)`, sits behind it as a rim light --
    a bright sliver in a dark biome, invisibly subtle in a bright one.
  - **Top-heavy proportions**: shoulders that peak higher than the small sunken
    head, long arms hanging to oversized boulder fists past the knees, a waist
    that tapers in, short planted legs. Six limb shards (two legs, two upper
    arms, two pauldrons) plus a pelvis and a collar block, each a shaded sibling
    of the base color (via `shade`, and each darkened relative to it so the boss
    reads heavier than an ordinary wild of the same compound), fused around one
    oversized torso core, with the two oversized fists drawn after that core so
    they hang in front of it. Limbs are always a
    solid habit (`drawShardShape`/`drawCubicShape`) rather than the material's own
    `variant` -- the translucent monolayer plates read as flimsy on an
    arm -- so the compound's own habit lives in the torso core instead.
  - **Grain-boundary seams**: five jagged polylines drawn twice, once dark as the
    crack and once offset and additive as the light coming through it, each on its
    own Graphics so it pulses on its own clock. The brightest of them is a slit cut
    across the head, a dark socket with hot ember-orange inset inside it -- one
    slit, not a pair of eyes, so it stays a lit fracture rather than a face.
  - **Ground staging** instead of a body halo: a normal-blended dark contact
    shadow pooled under the feet in three nested ellipses, tight and dark where
    the golem touches and spreading out into a wide faint penumbra, with the
    danger glow relegated to a low additive ellipse behind the legs that pulses
    its alpha. The shadow goes **over** that glow and under the legs: the darkest
    point on screen has to be the point the golem touches, and an additive glow
    painted on top of the contact patch turns it into the lit disc a hovering
    thing stands on. A halo big enough to surround the whole body is the visual
    language of a benevolent guardian, and an additive one washes out to
    near-white over a daylight biome, erasing the silhouette's own edge.
  - **Motion on four unrelated periods** so the idle loop never visibly resets:
    a 900ms head-slit pulse, a 2300ms breath that squashes as it rises, a 3100ms
    weight shift, a 3400ms head pan, plus two fists drifting out of phase with each
    other and five heat sparks rising off the waist and fading above the head.
    All of it lives on an inner container pivoted at the feet, never on the
    returned container -- all three call sites already own the outer transform.
  Name label in
  a bold, warning-toned pink-red (`#ff8f8f`), distinct from any guardian's own
  label color, and offset by `BOSS_SILHOUETTE_TOP` multiples of the size rather
  than a bare one, so it clears the head. Reuses the
  `WorldSprite` projection machinery, so it scrolls and fades with
  distance like everything else standing on the map -- it doesn't add its own
  click handler, the fight is still only reached by pressing at the pass mouth.
  It sets `WorldSprite.still` to opt out of that machinery's wander and bob:
  the golem stands on its own two feet, and its life comes from the rig inside
  it ("The contact rule" above). `makeBossCrystal`'s core/limb color and variant
  come from the boss `Material`'s own `color`/`variant` (`TYPE_LOOK[type]`), so
  World 9's boss -- the one rival with no fixed type, DESIGN.md §2 -- looks
  different depending on which `MaterialType` got rolled for that playthrough,
  same as every other world's boss reads off its own fixed type. Once that
  world's rival is beaten this avatar stops spawning, and the pass simply
  clearing is the whole of what "the way is open" looks like.

## Gates as passes (`OverworldScene.spawnGateSprites`, `art/passBoard.ts`)

`dev_notes/WORLDS.md` §4's "Gates as passes" is the spec. One grammar throughout:
**a palette seen through an opening is where you are going.** A gate is not an
object standing on a tile -- it is the corridor narrowing into a pass, which is
permanent geography and stays once the rival is beaten. Both ends of every
world are shaped, since world N's start is world N-1's exit.

- **Two objects, two duties.** The **board** is scenery: world-space,
  depth-scaled, its name painted *into* the sprite (a `Text` inside the
  container, not a `WorldSprite.label`) so it resolves into a caption only on
  approach and is unreadably small from far off. That is what keeps it a
  signpost rather than an interface element, and what stops it competing with
  the horizon reveal -- the horizon resolves first, the name later. The
  **prompt** is interface: HUD, centred low on screen, obeying every text-size
  preset, and it is what carries the choice.
- **Scenery never spawns in.** A board is present from the moment its pass is,
  at whatever size distance gives it. What arrives at the threshold is
  *interactivity*, not the object.
- **A board is planted, not alive.** `WorldSprite.still` suppresses the
  wander/bob a loose hovering crystal carries; a signboard nailed to two posts
  that drifts around its tile reads as a prop. (The rival's golem is planted
  too, for a different reason -- "The contact rule" above.)
- **Approach, read, press.** Both gate states share one interaction. A prompt
  appears a tile out and the keypress commits -- challenging the guard while
  the gate is shut, crossing once it is open. **Arrival alone never transitions
  or starts a fight**: a pass is the most interesting object in a world and
  players walk into it to look. Clicking the prompt is identical to pressing
  the key, and the prompt is interactive exactly while it is on screen, so the
  affordance and the hit area are the same object.
- **Shut** -- the rival fills the throat and the throat row cannot be walked
  onto. Nothing else marks the state: a body in the way is a plainer statement
  than any weather over the gap. No aperture, no forward palette bleed, and the
  repeated road stops rather than promising passage past the guard.
- **Open** -- the pass clears, the next world's palette shows through the notch
  above where the road runs out (light through a doorway, and diegetic: what is
  visible through the gap is the destination), a board names the destination,
  and the next world's walkable colour bleeds back across the last few tiles as
  a seam the player visibly steps over.
- **The backward exit is a pass with a board and no guard**, carrying no state
  -- the way back is open from the moment the player arrives, having walked in
  through it. **World 1's carries nothing at all**: it leads to the Lab, which
  is not a place, so there is no world there for a board to name, and it is the
  one boundary that never narrows into a pass. Nothing in this game hovers over
  the ground except a crystal, which is what a crystal *is*, so a structure
  standing at the world's edge read as a misplaced creature rather than as a way
  out. The prompt the approach raises is what says the Lab is back there, and
  the asymmetry is the ontology made visible -- by an absence, which is the
  honest shape for a way out of the world. **World 10 gets no forward board** --
  the grammar means "another world lies beyond", and the finale's meaning is
  that there is not one.
- A board wears the same lavender (`STORY_LAVENDER`/`#d9a5ff`) the story beat
  and the world-entry lore screen wear: the colour of connective tissue between
  worlds.

## On-screen walking arrows (`scenes/overworld/touchControls.ts`)

- Interface, not scenery, in the same sense the Lab hint and the pass prompt are: fixed at the
  bottom-left corner of the screen, drawn over the world at depth `60` (under the dialogue
  panels' `100`), and untouched by the camera the world is projected through. Present only when
  the Settings station's Touch Controls row resolves to on, and hidden outright for as long as a
  dialogue panel is open.
- Four square plates in a cross, `62` on a side with a `4` gap, each a black wash (alpha `0.45`,
  `0.72` while held) the world still reads through, stroked in the reference blue-grey
  (`0x8fa0c9`) and carrying a single blue-grey triangle pointing the way that plate walks. The
  wash matches what the Lab hint and the pass prompt already put over the world; the brightening
  under a finger is what makes a held arrow visibly held.
- `62` is a finger, not a guess: the canvas is letterboxed to roughly `0.8` on a phone held in
  landscape, which puts the plate at about 50 real pixels. Anything much smaller stops being
  reliably hittable, so the plate size is a floor rather than a taste.
- The corner belongs to the arrows: the pass prompt wraps itself out of both bottom corners
  (`PAD_KEEPOUT`) while they are up, growing upward instead of sideways, so an offer can never
  lie across an arrow the player is holding. The Lab hint, in the opposite corner, grows its own
  padding to finger size and says "Tap here for the Lab".

## The between-worlds story beat (`OverworldScene.showStoryBeat`)

- One line of `data/story.ts`'s `STORY_BEATS` on a single small panel, shown after a
  world's rival falls and before `advanceToWorld` moves the player on. A world with no beat
  of its own, and every world with the Settings station's Story Screens row off ("Settings
  station" below), falls straight through to `advanceToWorld` instead. `560` wide,
  height sized to the content (30px padding, the beat wrapped to 500px, 18px gap, the
  "Onward" button, 30px padding) and then centered on `y = 260` with the top clamped to
  a 16px margin, rather than a fixed box the text is trusted to fit. Stroked lavender
  (`0xd9a5ff`), the color shared with the world-entry lore screen and with the boards and
  door out in the worlds for "connective tissue between worlds." Body and button font are
  capped at `Math.min(fontScale(this), 1.5)`, the same cap the lore screen's prose uses -- at the
  uncapped 2x "Large" preset these beats wrap to several more lines than at the default.

## The world-entry lore screen (`OverworldScene.showWorldLore`/`renderWorldLorePage`)

- The first time a save enters a world, before the player can otherwise interact with
  it (right after `recordVisit` in `create()`, ahead of the goal/middle auto-dialogues
  and the `'controls'` tutorial tip if more than one is due on the same entry -- it's
  the more establishing content), a two-page history panel plays from
  `data/worldLore.ts`'s `WORLD_LORE`, gated by `hasSeenWorldLore`/`markWorldLoreSeen`
  against its own `worldLoreSeen` save field. With the Settings station's Story Screens row
  off ("Settings station" below), that entry point marks `worldLoreSeen` and hands straight
  to whatever it was gating, so the Lab's Story station unmasks this world's chapters on the
  same schedule and keeps the text. Same dark rounded-rectangle-with-stroke
  treatment as every other overworld dialogue, near-full-canvas width (`CANVAS_W - 40`),
  stroked lavender (`0xd9a5ff`) to match `showStoryBeat`'s own "connective tissue between
  worlds" convention. Heading is the world's name (`WORLD_NAMES`); each screen is laid out top-down (title, then body, then a button) with
  the panel's background sized to the real content height afterward, the same idiom
  `renderTutorialTipPopup` uses. The title and body font sizes are capped at
  `Math.min(fontScale(this), 1.5)` rather than scaling all the way to the Settings
  panel's 2x "Large" preset -- the same fixed-budget problem `BattleScene.drawMoveMenu`'s
  own `chromeScale`/`headerScale` caps solve.
- The two authored pages are each rendered across **as many screens as the fixed
  `CANVAS_H` needs**, so a page longer than the canvas is never trusted to fit one
  screen. `renderWorldLorePage` takes a paragraph list (the authored page `split('\n\n')`),
  measures its own continue button first so the fit budget uses the button's real height,
  and hands both to `ui/text.ts`'s `fitProseToBudget` against `CANVAS_H` minus the title, the
  button and a 16px bottom margin; whatever is left over continues on a further screen.
  Breaks therefore only ever fall on a paragraph boundary and never bridge the
  page-1/page-2 boundary. Any screen that isn't the last one for its authored page reads
  "Next ->"; the last screen of page 1 also reads "Next ->", and the last screen of page 2
  reads "Onward," which marks the world seen, persists, and closes the dialogue. A single
  paragraph taller than the canvas on its own has no break left to take, and falls back to
  that helper's floor-`9`px shrink. With the current `WORLD_LORE` copy every world plays two screens except World
  10, whose page 2 is three paragraphs and plays as two screens at the "Normal"/"Large"
  presets and one at "Compact."

## The rival gate (`OverworldScene.showRivalEncounter`/`renderRivalTauntPage`)

- Triggered by the confirm keypress at a shut pass's mouth (`confirmGate`), not
  automatically on reaching the goal and not from any guardian's own panel -- so the player
  can walk past the goal to shop with Noether or any other guardian before ever facing the
  fight they're being gated on. Same 600-wide panel treatment as a wild encounter (centered
  crystal, italic line beneath), but stroked in red (`0xff6666`) instead of blue-grey or
  gold. The taunt is two pages, chained the same destroy-and-rebuild way the world-entry
  lore screen above is: `data/worldLore.ts`'s `RIVAL_TAUNTS` supplies `part1` (rendered with
  a "Next ->" button) and `part2` (rendered with the mandatory "Battle!" button -- no "let me
  pass," since a gate that can be skipped isn't a gate); a world with no `RIVAL_TAUNTS` entry
  falls back to a single generic line instead. With Story Screens off the confirm goes
  straight into the fight: the taunt pages carry only forward buttons, so they are pacing
  rather than a second confirmation, and the story log unmasks that world's chapter on the win
  itself. The boss crystal is redrawn on both pages
  (`art/boss.ts`'s `makeBossCrystal`, at whatever height the page has left over once the
  button and taunt are placed, clamped between `MIN_BOSS_SIZE` and `OverworldScene.ts`'s own
  aperture-derived `BOSS_CRYSTAL_SIZE`), the same golem silhouette the rival renders as standing at the goal tile
  (`spawnBossSprite`) and as the battle opponent (`scenes/BattleScene.ts`'s own
  `BOSS_CRYSTAL_SIZE`) -- not the plain faceted `makeCrystal` an ordinary wild encounter uses,
  so the rival never reverts to looking like an ordinary crystal just because this dialogue is
  open. Both the headroom above the crystal and the gap down to the taunt text come off
  `art/boss.ts`'s exported `BOSS_SILHOUETTE_TOP`/`BOSS_SILHOUETTE_BOTTOM` rather than a bare
  `BOSS_CRYSTAL_SIZE`, since the golem is taller than it is wide and asymmetric about its own
  center -- so its head clears the panel's top border and the contact shadow under its feet
  clears the first line of text. It stands still on the page, as it does everywhere else
  ("The contact rule"). The taunt text's own font size is capped the same way
  the world-entry lore screen's is, for the same reason (worlds 9/10's longer taunts would
  otherwise overflow the canvas at the Settings panel's 2x preset). Losing doesn't set anything
  back except the token stake (see Stakes in DESIGN.md §4): the pass is still shut, its guard
  still standing in it, and the prompt still offers the challenge to retry.

## Battle backdrop (`BattleScene.drawRealisticBackdrop`)

- The arena backdrop is drawn once per battle entry (in `create()`, never per-frame) and
  shows **the place on the map the fight started in**: the same ground, the same
  impassable surround, the same skyline the player was just walking through, seen from
  ground level. Which place that is comes from `BattleInitData.locale` (sampled by
  `scenes/overworld/terrain/plan.ts`'s `sampleBattleLocale` over a 5x5 window around the
  tile the player stood on): the tile's own biome supplies the palette, the dominant
  off-path material around it decides which surround stands beyond the floor, the tile's
  grid coordinates seed the arena and are handed to the material as its own `gx`/`gy`,
  and the dominant domain tint is blended into the ground at 0.15. The world's own biome
  answers all of it when a battle is entered without a locale.
- Because it is painted once, it can afford to be a picture rather than a wash. Two
  things carry it:
  - **One projection for everything below the horizon.** Screen y = `R_HORIZON_Y` +
    `R_FLOOR_K` / d, so a mark's size, the lateral spacing between marks and how many
    fall in a row are all one over the same distance. That is a texture gradient, and it
    is the depth cue a stack of vertical gradients cannot fake. `R_HORIZON_Y = 124` is
    where the furthest ground meets the sky; `R_FLOOR_EDGE_Y = 172` is the walkable
    floor's far edge, set above both fighters' ground contact (a crystal's shadow sits at
    its own y + `SHADOW_DROP`, the wild opponent's lowest at 208) so both crystals stand
    on walkable ground.
  - **Air between the layers.** One `air` colour (`fogTarget` blended 0.4 toward
    `skyBottom`) is what every distance converges on, so the ground arrives at the horizon
    in the colour the sky arrives at and the horizon is a place inside one atmosphere
    rather than a seam between two. `drownAt(d)` is the single curve that answers how much
    air stands in front of anything, floor, surround and stand alike. Mist is drawn as
    veils *between* the receding rows, never as one coat over the finished picture: what
    is behind a veil has to be dimmer than what is in front of it, or the mist is paint
    rather than depth. No mist layer ever has an edge -- a hard horizontal line across the
    full width is the highest-contrast thing that can be in the frame, higher than either
    crystal.
- Layers, back to front:
  - **Sky**: a three-stop wash (`skyTop` → a mid stop → `skyBottom` blended 0.75 into the
    air) whose brightening accelerates downward the way scattering does, ending in the air
    colour at the horizon line itself. Sun and clouds on daylight (`clouds: true`) worlds.
  - **Distant self**: the world's **own** profile from `art/horizons.ts`, in two passes --
    a far echo at half height drowned 0.92 into the air, and the profile itself drowned
    `R_DROWN_FAR`. A distant self is how a world looks from a world away, and what is a
    world away across the world being stood in is more of the same world; the arena has no
    forward direction for a neighbour to sit in, which is why this reads world N where
    the overworld's horizon reads world N+1. Filled as nested copies each starting a step
    higher up its own local height, so alpha accumulates from nothing at the base to the
    full swallow at the crest -- mist pooling at the foot of a ridge. `hillAlpha` is the
    overworld's swallow knob and is not read here; the arena sets its own. The profile's
    sky extra runs too, frozen: the Storm Flats' arcs, the Entangled Web's filament
    glints, the Screened Swamp's reed beds, the Defect Scars' burning notches. Worlds
    whose profile is empty (the Entangled Web, the Screened Swamp, the Devouring Mirror)
    get nothing there, which is their identity rather than a gap to fill.
  - **Ground plane** (`drawGroundPlane`, called for the impassable surround and the
    walkable floor alike): strips at constant world spacing rather than a vertical
    gradient, each drowned by its own distance and stepped onto the world's flat band
    where the world has one (`art/biomes.ts`'s `bands`, on the same row numbering
    `terrain/paint.ts`'s `bandBase` uses). The bands are a property of the world rather
    than of the route through it, so the Storm Flats' Landau levels stratify the whole
    arena and the glowing channel between two filled levels is the subject, not trim. The
    plane's distance is capped rather than run to the vanishing point: past that the
    strips are thinner than a pixel and a banded world stacks a ladder of channels into
    the last rows.
  - **The surround standing on it** (`drawSurroundStand`): the world's own material from
    `scenes/overworld/terrain/materials/` -- the Mean Fields' wood, the Stone Lattice's
    colonnade, the Winding Borders' rubble, the Iron Steppe's blades, the Screened Swamp's
    reeds, the Defect Scars' crust -- in five rows beyond the floor's far edge, each
    further row smaller, more densely packed, deeper in the air, drawn into its own layer
    at its own opacity and separated from the row in front by a veil of that air. Drawn
    back to front, so nearer rows occlude further ones. The `AccentTile`s are synthesised
    for a flat near view (the arena has no projection of its own), but their grid
    coordinates come from the encounter's own tile, so whatever a material anchors to the
    map -- which way the Iron Steppe's blades lean, where the Screened Swamp's moments
    burn -- is what it was where the fight started. `R_MATERIALS` converts the arena's
    per-row perspective scale into each material's own units, since a material sizes its
    feature either as u = 90·s pixels or in raw `s` pixels and those two conventions are
    orders of magnitude apart. Bare ground (`solid`) draws nothing, which is the Entangled
    Web's whole surround: there is nothing out there, and the arena says so.
  - **The floor's far edge**: a Catmull-Rom polyline meandering a few pixels around
    `R_FLOOR_EDGE_Y`, seeded off the encounter tile so the same spot always draws the same
    edge. Drawn over the stand, so the near row of the surround stands behind the lip
    rather than on it, with a stacked contact shadow under the stand and a thin lit lip on
    the walkable side. A boundary ruled straight across the whole frame reads as
    stagecraft, not terrain.
  - **Floor surface** (`drawFloorTexture`): grain -- small marks on the same
    one-over-distance rows, growing and thinning out as they come forward -- plus a few
    scuffed lanes converging on the vanishing point (the route itself, running away from
    the player), plus near-field clutter with the bit of shadow that puts it *on* the
    ground. Nothing here is a shape the eye is meant to find; the depth is in the
    *gradient* of it. All of it is held a few values off the floor it lies on, and it
    fades out well before the floor's far end.
  - **Value compression**: the walkable colour is pulled 0.3 toward the surround's before
    anything else happens to it. Several worlds paint their route far brighter than the
    ground around it (the Entangled Web's gold thread over true black), and a value break
    that wide across the whole frame is louder than either crystal standing on it.
  - **Haze**: two wide, faint air-coloured ellipses at the horizon on slow (21s/26s)
    infinite yoyo drift tweens. The only thing in the backdrop that moves: still air over
    a still landscape reads as a painting of one.
  - **Vignette**: corner-only -- four gradient rects whose alpha peaks at 0.2 in the frame
    corner and fades to zero toward center, in a near-black blended from `skyTop`. Drawn
    before the crystals/UI so it only ever dims the backdrop.
- **Freezing.** The backdrop is painted at scene creation, so every animated material and
  sky extra is handed one fixed clock (`R_FROZEN_NOW`) rather than whatever millisecond
  the battle happened to start on -- chosen so the Defect Scars' embers land bright and
  the Storm Flats' arcs are mid-flash rather than in the nine tenths of their cycle they
  are dark for. A storm caught between two flashes is a colour change.
- **What keeps it legible.** Richness is bought at high spatial frequency and spent
  nowhere at low frequency: the arena's legibility gate (`npm run greyscale-check`)
  squints at an 8x downscale, where fine grain averages away to nothing and only
  large-scale value breaks compete with the crystals. So detail is fine, dense and close
  in value to what it sits on; contrast is paid out through aerial perspective, which
  costs contrast at exactly the distances the crystals are not standing at. Two earlier
  treatments are kept switchable on `BACKDROP_MODE` for comparison on the same encounter:
  `'layered'` (sky wash, seeded Catmull-Rom ridgelines, two flat ground bands) and
  `'bands'` (four gradient bands meeting in the fog).

## Boss opponent in battle (`scenes/BattleScene.ts`)

- A rival fight's opponent renders with `art/boss.ts`'s `makeBossCrystal` at
  `BOSS_CRYSTAL_SIZE = 64` -- bigger than an ordinary wild encounter's plain
  `makeCrystal` at `WILD_CRYSTAL_SIZE = 50` -- positioned at `BOSS_OPPONENT_POS`
  (`{ x: 644, y: 184 }`, shifted left and down from the wild encounter's
  `OPPONENT_POS` of `{ x: 674, y: 162 }`) so the golem's silhouette (which reaches
  well past the bare `BOSS_CRYSTAL_SIZE` footprint -- `BOSS_SILHOUETTE_TOP`/
  `BOSS_SILHOUETTE_BOTTOM` multiples of it above and below that anchor) sits
  comfortably inside the field.
- **A rival's anchor is a ground reference, not a body centre** ("The contact
  rule" above). The arena floor at a combatant's spot is `GROUND_DROP` below its
  anchor -- the line the painted floor shadow and every ground-anchored attack
  effect already land on -- so the golem is built with `footDrop: SHADOW_DROP`
  and its art rides `BOSS_GROUND_LIFT` higher inside its own container to put
  its feet exactly there. `BOSS_OPPONENT_POS` is chosen so that the golem still
  lands where the composition wants it, one shadow under one pair of feet. It is
  also the one combatant that never gets `bobCrystal`'s idle lift: a gem hovers,
  a golem stands.
- Every layout bound that has to clear the golem is **derived from measured
  offsets rather than hand-tuned literals** (`scenes/battle/hud.ts`'s
  `BOSS_HEAD_RISE = 108`/`BOSS_FOOT_DROP = 57`, and `WILD_HEAD_RISE = 45`/
  `PLAYER_HEAD_RISE = 57` for the other two crystals): how far each crystal's
  actually-painted art reaches above and below its own anchor point, measured
  from a live headless-Chromium render by hiding every other object in the
  scene, putting a flat mid-grey behind it (so a dark contact shadow counts as
  painted as much as a bright rim does) and scanning several seconds of frames
  for any pixel that differs from it, so the full idle extent is included. At
  its current anchor the golem paints 76-241 vertically and 570-717
  horizontally. Its nameplate floats off `BOSS_HEAD_RISE` and the move menu's
  own ceiling (`MENU_MIN_TOP`, below) is `BOSS_OPPONENT_POS.y + BOSS_FOOT_DROP +
  7`, so moving the boss can never silently leave either one overlapping it.
- Same look the boss already has standing at its world's goal tile in the
  overworld (`OverworldScene.spawnBossSprite`), carried into the fight itself
  rather than switching to the plain crystal look every wild battle uses.
  Attack effects follow the boss crystal itself rather than any fixed coordinate
  (`playAttackEffect`'s `from`/`to` are live anchors, "Attack effects" below), so
  bolts/rings/bursts travel to and from wherever it actually is, at whichever of
  the two positions that fight placed it.

## Battle HUD frame and nameplates (`scenes/battle/hud.ts`)

- The battle screen splits into **two classes of element, and that split is what
  makes it read as one composition**: a combatant's own readouts travel with the
  combatant, and everything else is seated on a shared margin frame. The frame is
  one set of rails (`LEFT_RAIL = 16`, `RIGHT_RAIL = 838`, `TOP_RAIL = 10`,
  `BOTTOM_RAIL = 464`) that the turn-order widget, the move menu and the combat
  log all sit on, rather than each corner carrying its own margin.
- **Nameplates.** Both sides get the same floating name-over-bar plate
  (`drawNameplate`), never a screen-corner HP row: a bottom-anchored stack of
  the optional quiz-result note, the name, the HP bar, the status pill and the
  passive pill, whose bottom edge sits `8`px above that crystal's own painted
  head (its `*_HEAD_RISE` above), clamped so a tall stack rides down onto the top
  rail instead of running off the field. The name and bar sit on a rounded
  translucent chip sized to the name it actually holds (floored at the bar's own
  width, capped by the rails), so a short name gets a small plate rather than
  every plate stretching into a banner. The name shrinks in whole-px steps
  (floor `9`) when the head above it leaves too little room -- which only bites
  for a long rival name at a large text-size preset, where the golem's head
  reaches highest. HP bars are `140x10` with a dark stroked track behind a
  `134x6` fill, so a bar at full health still reads as a gauge. Because the chip
  is fitted to the name's rendered width and the bar sits under its measured
  height, the plate is a one-shot layout: a side whose name changes mid-battle
  (World 10's Adapted) rebuilds its plate whole via the `destroy()` the plate
  hands back, so the new name gets a chip and a shrink-to-fit measured against
  it rather than overflowing one fitted to the old name.
- **Gold means "the player."** The player's plate chip is stroked gold
  (`GOLD_ACCENT`), the opponent's dim blue-grey (`REFERENCE_BLUE_GREY`) --
  the same code the turn-order rings and the move menu's own gold chrome
  already use, carried across every piece of chrome so a glance at any of it
  says whose it is.
- Room for the Kondo status pill is reserved in the stack only for a side that
  can actually cast one (the player, when the battle's move list carries a Kondo
  move; no wild ever does). Reserved rather than measured live because the plate
  is bottom-anchored -- an unreserved pill appearing mid-fight would shove the
  name and bar upward on the turn it lands.
- **Ground shadows and ground-anchored effects share one offset.** Each
  crystal's shadow ellipse is drawn `SHADOW_DROP` below its own anchor, which
  *is* `art/attackShapes.ts`'s `GROUND_DROP` (imported, not a copy), so the
  floor a meteor's rune or an impact shockwave lands on and the floor the
  crystal visibly stands on are the same line by construction, at whichever
  position a fight placed either crystal.

## Battle status effects (`scenes/BattleScene.ts`)

- Answering the pre-encounter question correctly wraps the player's crystal in a "super
  saiyan"-style golden aura: a soft additive-blended glow fill, two pulsing rings, a ring of
  ten radiant spikes slowly rotating around the crystal, and small embers rising and fading
  above it. All pieces use `Phaser.BlendModes.ADD` so they actually glow (brighten what's
  behind them) instead of reading as flat gold shapes. Answering wrong instead droops a
  small grey raincloud (`addFailCloud`) just above the crystal, bobbing gently. Everything
  is added directly to the player crystal's container so it moves with the existing
  idle-bob tween for free.
- Kondo's three screening self-buffs (DESIGN.md §4) present as two pieces for as long
  as a cloud is active. The bookkeeping is a plain text pill (`playerStatusLabel`/
  `opponentStatusLabel`) sitting as the next row down that side's own floating nameplate
  (see "Battle HUD frame and nameplates" above), reading `"<Cloud> (<turns left>)"`
  (e.g. `"Spin Screening (3)"`) in Kondo's own rust-orange
  (`#ff8f6a`, matching his guardian label/panel stroke and the `'screening'` attack-effect
  color below) over the same translucent-black tag background every HP-bar name label
  already uses. Empty (no active buff) by default on both sides -- the pill only ever
  reads as chrome that appears when relevant, not a permanent fixture of the HP-bar area.
  The cloud itself is a persistent aura (`art/screeningAuras.ts`, driven by
  `BattleScene.syncScreeningAura` off `setStatus`) wrapped around the carrying crystal for
  the buff's whole duration, on either side -- mounted inside the crystal's own container
  behind its body so idle bob and hit squash carry it for free, fading in under the cast's
  ring pulse and fading out on expiry or on replacement by another channel. All three
  auras stay in the same rust-orange family (the pill's label is what names the channel)
  and are told apart by silhouette, each drawing the physics of what its cloud screens:
  **Spin Screening** extends `art/kondo.ts`'s avatar-cloud vocabulary -- two
  counter-rotating shells of open conduction-electron arcs, each trailing a mote -- plus a
  still ring of small downward spin arrows: the orbital motion circulates while the
  cloud's spins stay pinned antialigned against the moment they screen (the Kondo
  singlet). **Charge Screening** is a static Thomas-Fermi profile that only breathes --
  piled-up glow densest at the center, ringed by faint closed Friedel rings decaying
  outward; nothing circulates. **Symmetry Cloud** is the restored order-parameter
  manifold: one ring crossed by evenly spaced radial ticks in slow uniform rotation --
  every orientation visited, none preferred. Each aura's bright structure stays at or
  under its crystal's own measured painted extent (sized off hud.ts's
  `*_HEAD_RISE`/`BOSS_FOOT_DROP` offsets; the boss golem's is centered on its body's
  measured midpoint, since its anchor is a ground reference), so the nameplate stack above
  never sits inside it, and additive alphas are kept low so all three silhouettes survive
  the greyscale squint test.
- Franklin's active passive (DESIGN.md §5) gets its own pill as the last row of the
  same nameplate stack, directly below that side's status pill, same size/background
  as the status pill but in a muted
  blue-violet (`PASSIVE_PILL_COLOR`, `#8fa0ff` -- its own fixed constant, not derived from
  her own label color) rather than Kondo's
  rust-orange, so an always-on passive reads as visually distinct from a ticking status at a
  glance. Reads as the joined name(s) of whichever passive(s) are active (`·`-separated,
  ready for a future second passive owner to stack onto the same line), and is simply not
  drawn at all when no passive is active -- the plate floats in open field rather than in a
  crowded corner, so it needs no clamping or drop-it-if-there's-no-room fallback of its own.
- Franklin's active passive also gets a **ground halo** around the player's own ground-shadow
  ellipse (`BattleScene.drawBackground`'s
  `this.add.ellipse(PLAYER_POS.x, PLAYER_POS.y + SHADOW_DROP, 130, 30, ...)`),
  drawn once in `create()` (not per-turn) by `art/passiveHalos.ts`'s
  `drawFranklinPassiveHalo(scene, container, x, y, passiveId, rx, ry, alpha?)`, keyed off
  whichever id is in `playerActivePassives` -- never for the opponent, since no wild/rival ever
  has an active passive. Anchored to the shadow's own position rather than wrapped around the
  crystal body, and deliberately calmer than `addBoostHalo`'s energetic "temporary bonus" aura
  (no rotating spikes/rising embers) since a passive is an always-on trait, not a per-turn boost.
  Each of the three reads distinctly, grounded in its own physics: **Diffraction Shadow**
  (`fractionalGuard`) is a static ring of small dim scattered spots, the spotty rings a
  powder/polycrystalline sample's own diffraction pattern gives; **Satellite Reflection**
  (`anyonEcho`) is a static, fainter ring offset to one side, echoing a diffraction pattern's own
  secondary spot beside the main one; **Amorphous Halo** (`edgeCurrent`) is the only one that
  moves, a soft additive-blended glow breathing on a slow 3.2s pulse -- an amorphous solid's own
  diffuse halo, literally that term in X-ray diffraction. All three stay within Franklin's own
  lavender/purple family and never gold, so they can't be confused with `addBoostHalo`'s gold
  aura if both happen to be on screen at once (a passive can be active during a boosted turn).
  The same builder previews each halo in Franklin's own panel (see "Franklin in the overworld"
  above) at reduced alpha unless the passive shown is the one actually active.
- The "A wild X appeared!" opener and the win/lose closing line are flavor text from
  `data/greetings.ts` (`victoryLine`/`defeatLine`), keyed to the wild material's type the
  same way the overworld encounter greeting is. A rival fight swaps the opener for "X blocks
  the way onward!" (no "wild") but reuses the same victory/defeat lines.
- Every combat-log update goes through `BattleScene.setLogText`, which keeps the text
  inside the band the frame leaves free at the bottom-left (`LOG_MIN_TOP` down to
  `BOTTOM_RAIL`) -- the strip below the player's own ground shadow, which the player's
  cluster leaves free now that its readouts float above its head instead of below it. A
  line too tall for that band shrinks in whole-px steps (floor `10`, the same
  shrink-to-fit every other fixed-budget text block in the game uses) rather than climbing
  up into the player's crystal and nameplate, so a one-line per-turn message renders at
  the full text-size preset and only a genuinely long wrapped one trades size for lines.
  The end-of-battle summary reuses the same helper with a much higher ceiling (`150`) and a
  wider wrap, since it runs several lines longer once the physics blurb
  (`data/materialdex.ts`'s `materialBlurb`) is appended after the flavor/token lines, and
  the move menu it would otherwise have to stay clear of is already destroyed by then.
- Per-turn log text appends "No natural defense against this!" when the quasiparticle
  mismatch multiplier fires (`BattleScene.resolveHit`, the sole type-interaction rule in
  battle -- see DESIGN.md §3/§4), then "A coherent critical hit!" for a crit -- up to two
  clauses can stack on one line, in that fixed order.

## Turn-order preview (`BattleScene.drawTurnPreview`)

- A small widget docked on the frame's top-left rails (`TURN_PREVIEW_X = 16`,
  `TURN_PREVIEW_Y = 10`), clear of both nameplates and the log text further down: a bold dim
  blue-grey (`#8fa0c9`) "TURNS" label over the usual translucent-black
  tag background, with a row of five 32px crystal icons (`makeCrystal`, 36px spacing) below
  it, one per predicted hit: the player's own current crystal or the opponent's, each using
  that side's real `color`/`variant`/`seed`/`hybridParents`. Each icon also carries a ring
  behind the crystal shapes marking whose hit it is, independent of crystal color -- a bold
  full-opacity gold ring (`0xffe066`, 3px stroke, this project's established active/highlighted
  accent color) for the player's hits, a faint blue-grey ring (`0x8fa0c9`, 1.5px stroke, 45%
  alpha -- the same dim "inactive" tone the shop's inactive tab uses) for the opponent's, so the
  row still reads at a glance in a same-material matchup (routine from world 9 onward) where
  the crystal colors themselves are identical. In a rival fight the opponent's icons instead
  carry `art/boss.ts`'s `makeBossIcon` -- the same humanoid golem outline the on-field
  opponent has (see "Boss opponent in battle" below), cut down to what survives at 32px: the
  silhouette polygon at half scale (so its widest span matches an ordinary icon's), filled in
  the material's own color rather than the arena golem's much darker silhouette fill, with one
  additive ember dot for the head slit, and no grain shards, seams, sparks, contact shadow or
  idle tweens. The outline against a faceted gem is the whole distinction at that size, so the
  row shows the same two fighters the arena does.
- The row previews the next five hits in order (DESIGN.md §4's velocity multi-hit rule):
  the faster side's icons repeated `fasterHits` times, then the slower side's icon once,
  tiled out to five. It's a best-effort look-ahead, not a guarantee -- it assumes ordinary
  moves keep getting picked, so an Ultimate/Analytic pick (exempt from the multi-hit scaling)
  or one of Kondo's self-buff moves (always resolves as a single action for its round, see
  `playerAttack`) can make the actual round diverge from what it showed; the widget carries no
  disclaimer text for this, since it's still an accurate read of "if nothing changes."
- Built whole (label included) by `scenes/battle/hud.ts`'s `drawTurnPreview` -- once in
  `create()` and again every time a round actually finishes (right where `turnLock`
  releases), the previous row destroyed each time.

## Battle move menu (`BattleScene.drawMoveMenu`)

- A docked panel on the frame's bottom-right rails (`width = MENU_WIDTH = 284`, `x = MENU_X =
  RIGHT_RAIL - MENU_WIDTH`), same dark rounded-rectangle-with-stroke treatment as the
  overworld's dialogue panels, stroked gold (`0xffe066`) to match Noether's own panel color.
  The section header itself is the panel's title (bold gold, below) -- there is no separate
  "MOVES" line above it, since the header already names what the panel holds and a fourth
  chrome line would come straight out of the row budget. Its bottom edge is fixed
  (`MENU_BOTTOM`) and
  its top edge (`menuTop`) is derived fresh on every draw from however tall the current
  page's content actually is, so the panel visibly grows *upward* from that fixed bottom
  rather than down from a fixed top -- it reads as bottom-right-docked at every page/section
  instead of just starting high and getting taller. `MENU_MIN_TOP` floors how far up that
  growth is ever allowed to reach, comfortably below the opponent's crystal in every case
  (including a rival fight's bigger, taller boss golem, whose painted bounds reach a
  measured ~225px including its contact shadow and ground glow) so the panel and the opponent's
  cluster can never collide regardless of how tall a page's content gets at the largest
  text-size preset.
- **Grouped into up to four move-kind sections (`ATTACKS`/`ANALYTIC`/`ULTIMATE`/`BUFFS`),
  shown one
  page at a time** (DESIGN.md §4): a bold gold (`#ffe066`) header line reading the
  section's label sits above that page's own rows as the panel's own title, with a `(i/N)` page count appended once
  there's more than one page. `BUFFS` carries its own legend line under the header the same
  way `ANALYTIC`/`ULTIMATE` do ("self-buff, no damage, 3 turns"), and each of its buttons
  shows the move's own name plus "3-turn buff" instead of the `Pwr <n>`/`!!2x` chrome an
  ordinary attack button shows, since a self-buff never deals damage or mismatches. A section
  that has no usable move in it never becomes a page at
  all (a player with no analytic/ultimate moves bought, or no Kondo move active, never sees an
  empty
  one). Every page holds at most `MOVE_MENU_MAX_ROWS` (3) moves -- a section with more than
  that (`BattleScene.moveMenuPages`) splits into several same-label pages instead of
  cramming more rows onto one page, so every page's row budget (and so its font size) stays
  close to identical regardless of how many moves a section has in total. `ATTACKS` for a
  `chernSuperconductor`-type form (`electron`/`phonon`/`higgs`/`chiral`/`majorana`, the broadest
  single main type's own `MOVE_COMPATIBILITY` list) that's learned every one of its 5 attack
  classes is the section that needs this today, splitting into two pages (3 + 2) rather than
  one page carrying all of them at illegibly small text. Each move is still a `#222244`-background
  button, same
  treatment used everywhere else (overworld dialogue buttons), stacked vertically
  under the header -- text is the usual `#ffff88`, except a `BUFFS`-section button (Kondo's
  currently-active self-buff move), which reads in `STATUS_PILL_COLOR` (`#ff8f6a`, Kondo's own
  rust-orange) instead, tying the button back to the status pill the buff itself renders as
  once cast. A form with zero currently-usable moves (shouldn't normally happen, since
  Phonon Beam is universal) shows "No usable moves" instead of an empty panel. Landau's two
  Analytic moves (`skyfallBeam`/`groundEruption`) get a gold `★` tag appended to their own
  label, with a "right=2x wrong=½x" legend living as its own dim sub-line directly under the
  `ANALYTIC` header instead of in the panel's top legend; Skłodowska-Curie's two Ultimate
  moves (`ultimateMeteor`/`ultimateNova`) get a `★★★` tag the same way, with a "3/3 correct
  or it whiffs" legend under the `ULTIMATE` header -- that top legend (`!! no natural
  defense (2x)`) only ever has the one mismatch symbol to explain, kept deliberately terse
  since its wrapped height eats directly into the space every row gets.
- **Pager**: when more than one page exists, a bold gold `◀` and `▶` (`Text`, hand cursor,
  same `#ffe066` as the panel stroke/title) flank the header, at the panel's left/right inner
  edges (`x = MENU_X + 14` / `MENU_X + MENU_WIDTH - 14`) -- clicking either, or pressing the
  Left/Right keys anywhere in the scene, advances/retreats `movePageIndex` and redraws.
  Hidden entirely (no arrows, no `(i/N)`) once there's only one page, so a player who never
  bought an analytic move or a Kondo self-buff sees a plain `ATTACKS` header with nothing to
  switch to.
- Header text is deliberately capped at a lower text-size ceiling than the panel's own
  title/legend (`headerScale = Math.min(fontScale, 1.15)`, 12px label / 8px legend sub-line
  at that scale), and the pager arrows render a size above that (`14 * headerScale`) --
  letting either scale all the way to the Lab's Settings station's uncapped 'Large' preset
  the way the title does would eat directly into the row budget below, and the header row's
  own height is taken from whichever of the label/arrows is actually taller so the arrows
  never bleed into the first move row. The panel's own title/legend are capped the same way
  (`chromeScale = Math.min(fontScale, 1.35)`, matching the row-height budget's own cap below)
  so neither eats into the row budget at the largest preset either.
- Row height is a hard geometric budget: the fixed vertical band the panel is allowed to grow
  into (`MENU_MIN_TOP` down to `FIELD_H - MENU_BOTTOM_MARGIN`), minus the title/legend/header
  chrome above, divided across however many moves the *current page* has (never more than
  `MOVE_MENU_MAX_ROWS`) -- with a `20`px minimum floor so rows never shrink to illegible, and
  a scale-dependent ceiling (`maxRowH`) so a short page (e.g. a single-move `BUFFS` page)
  doesn't grow rows past a sensible size just because the budget has slack. Each button is
  centered in its own row band rather than pinned to the band's top edge, so a page with
  slack reads as evenly spaced rather than as one dead gap under the first button. Because the page
  cap is fixed at 3 rather than growing with content, every page's budget stays close to
  identical, which is what keeps each button's font size (`btnPx`) close to its scale-scaled
  ceiling on every page rather than collapsing on whichever ones happen to have more moves.
- Move labels are a single wordWrap-friendly line ("`<name> — Pwr <n> ★★★ !!2x`") rather than
  a forced two-line split, so a short label (e.g. "Phonon Beam — Pwr 6") renders on one line
  and only a genuinely long one (a long tuned quasiparticle name plus an Ultimate's `★★★` and
  a mismatch `!!2x` tag, all at once) wraps to a second. `btnPx` is checked against every
  label on the current page with a throwaway `Text` object (`getWrappedText()`) and shrunk in
  whole-pixel steps, uniformly across the page, until none of them wrap past 2 lines -- the
  row-height budget above only ever assumes 2 lines, so a 3rd would run into the row below it.
  Verified against a live browser render (headless-Chromium harness, DEVELOPMENT.md) at every
  text-size preset with a form carrying every attack class at once (the worst case any
  `MOVE_COMPATIBILITY` entry can reach) and with Skłodowska-Curie's Ultimate moves tuned to
  their longest quasiparticle name (`heavyFermion`, "Heavy Fermion") while mismatched against
  the opponent -- no page overflows the field, and no label reaches a 3rd line, at any preset.

## Analytic question panel (`BattleScene.showAnalyticQuestion`)

- The one dialogue-style overlay that lives in `BattleScene` rather than `OverworldScene` --
  opened by clicking an analytic move's button, before that move resolves. Same dark
  rounded-rectangle-with-stroke family as every overworld panel (520 wide, height grown to
  fit), stroked gold (`0xffe066`, matching the move menu's own border and the `★` tag rather
  than Landau's own blue-violet shop stroke). Move name in
  bold gold above the question prompt (white, center-aligned, matching the wild-encounter
  quiz's tone), then two shuffled answer buttons in the same `[ #222244 / #ffff88 ]`
  treatment every other button uses. No "let me pass" -- picking an analytic move already
  commits to using it; both answers lead to the hit resolving, just at a different
  multiplier.
- Locks the move menu (`BattleScene.turnLock`) for the panel's duration so no other move can
  be queued underneath it, released the instant an answer is picked -- the panel itself has
  no other exit.
- Skłodowska-Curie's Ultimate moves reuse this same panel shape via
  `BattleScene.showUltimateQuestions`, stroked magenta (`0xff66ff`) instead of gold to read
  as its own distinct tier, and titled with a `question <i>/3` counter -- up to three of
  these appear in sequence, stopping at the first wrong answer since a miss already decides
  the outcome (a whiff).

## The Lab's Moves/Stats/Abilities stations (`scenes/panels/hubStations.ts`'s `showMovesPanel`/`showStatsPanel`/`showAbilitiesPanel`)

- All three use the same dark rounded-rectangle-with-stroke panel treatment as everywhere else,
  stroked blue-grey (`0x8fa0c9`, distinct from every guardian/encounter panel's own stroke
  color). Each is its own station button on the Lab floor (see
  "The Hub" above), not a row in a shared menu -- clicking one is a no-op while another panel
  is already open.
- "Moves"/"Stats" share a generic info panel (`showInfoPanel`, `560` wide, same blue-grey
  stroke). Moves lists only the moves actually usable right now (`getBattleMoves` -- learned
  moves intersected with what the current crystal form's physics can host, §3) as plain
  `<name> -- Pwr N` lines (name and power both reflecting any Feynman level via
  `moveDisplayName`/`effectiveMovePower`), no move-class label and no "incompatible" entries
  cluttering the list; Stats lists Energy/Momentum/Lifetime plus qumatessence and
  current form name. Both end in a single "Close" button.
- "Abilities" is its own dedicated panel (`showAbilitiesPanel`, `560` wide, same blue-grey
  stroke) rather than a third `showInfoPanel` body -- one name+description block
  per passive owner (`data/passives.ts`'s `PASSIVE_OWNERS`, currently just Franklin),
  each its own pair of `Text` objects with explicitly capped
  font sizes (`nameScale`/`descScale`, same capping `renderPassiveList` already uses) rather
  than folding both full descriptions into `showInfoPanel`'s single wrapped body, since that
  body's shrink-to-fit only lowers font size and never truncates -- two full passive
  descriptions back to back could still overflow the canvas at that panel's largest text-size
  preset even at the shrink loop's own floor.
## The Lab's guardian gallery (`HubScene.spawnGuardianAvatars`/`guardianSlot`)

- **Every guardian the player has met stands in the Lab as their own avatar, and clicking one
  opens that guardian's panel directly.** The avatar is the same `art/<guardian>.ts` builder
  their overworld sprite and their panel's own header portrait use, drawn at scale `0.55` --
  small enough to sit in an `88x72` slot, still distinct enough that ten of them read as ten
  different figures. Registry `metGuardians` decides who is present; Superposition Mode stands
  all ten regardless.
- **Ten fixed slots, five per cluster, in the two upper corners.** Each cluster is stacked one
  avatar over a pair over a pair (`GUARDIAN_ROW_TOP` `96`, `GUARDIAN_ROW_PITCH` `78`, cluster
  centers `96` in from either wall), each pair read left-to-right. `GUARDIAN_LEFT_CLUSTER`
  and `GUARDIAN_RIGHT_CLUSTER` state which world stands in which slot: worlds 1-5 down the
  left cluster, and 10 over 8-9 over 6-7 down the right. The two run the worlds anticlockwise
  around the room -- 1 at the top of the left corner, down the left side, across the bottom and
  back up the right to Skłodowska-Curie, who leads the circle of guardians, crowning her own
  corner. The right cluster is the left one mirrored and walked in reverse, so the corners read
  as one loop rather than two stacks. A slot belongs to its world, so a guardian
  never moves between visits as the roster grows -- an unmet guardian simply leaves their slot
  empty, and the corners fill in as the player works through the worlds. The corners are the
  only part of the wall wide enough: the room's quote sits between them (wrapped `420` to stay
  clear), the instrument panels and the player's own floating crystal hold the middle, and the
  station rows start below the counter.
- **A surname under each avatar, the full name and blurb on hover.** The label is that
  guardian's `shortName` ("Noether," "Skłodowska-Curie") in reference blue-grey, stepped down in
  whole pixels from `9`px-at-the-current-text-scale to a `9`px floor until it fits its own slot
  (measured on the rendered size, not the base one, so the Large preset can't push a long name
  into its neighbour). Hovering a slot washes it faintly blue, turns the label that guardian's
  own `labelColor`, lifts the avatar to `1.12` scale, and floats a `200`-wide readout under it
  with the guardian's full name and their one-line `blurb` -- clamped horizontally to the canvas,
  its two lines' font scale capped at `1.3` (a full name is one long unbreakable word that word
  wrap can't split), so a player can see what each figure offers
  before spending a click on finding out.
- **The click target is a rectangle covering the whole slot**, not the avatar container (a
  Phaser Container has no hit area of its own). It is invisible at rest rather than fully
  transparent, since a game object at alpha 0 stops rendering and an unrendered object is
  skipped by hit-testing too. Clicking is a no-op while another panel is open, the same
  one-panel-at-a-time guard every station uses.
- Opening a guardian this way renders that guardian's own bespoke panel (shop/teleport hub/
  transmutation, in that guardian's own stroke color per CODEMAP.md's panel-color list) right
  there in the Lab -- the same panel the player would see by walking up to them mid-world (see
  "Guardians, economy, and story arc" in DESIGN.md §5). The player's world/scene/position never
  changes just from opening a guardian's panel this way; Bloch's own panel is the one guardian
  panel with an explicit travel action (its destination rows), which still moves the player like
  any other deliberate warp.

## Settings station (`scenes/panels/hubStations.ts`'s `showSettingsPanel`)

- Same blue-grey (`0x8fa0c9`) stroke as the Lab's other reference stations, sized
  `(CANVAS_W - 60)` wide with height grown to fit. A table: one row per setting, the setting's
  name and a muted blue-grey line saying when a change to it lands ("On the next map.",
  "Immediately.", "On your next battle.", "On the next world.") in a `220`-wide left column,
  and every value that setting can take as its own small plate along the row. The current
  value reads gold-on-purple (`#ffe066` on `#3a2a5c`), the others blue-grey on `#1c1c30` --
  the same selected/unselected pair a list+detail panel's rows use. Clicking a value picks it
  and rebuilds the panel in place, the same click-to-rebuild pattern Noether's shop tabs use,
  so a setting's whole range is readable at a glance rather than cycled through one step at a
  time. A hairline rule (`0x4a4a70`, alpha `0.85`) separates each row from the next, and a
  single "Close" button closes the panel.
- The table shows one category at a time (`data/settings.ts`'s `SETTINGS_CATEGORIES` --
  Gameplay, Story, Presentation), picked from a strip of category plates between the title and
  the first row, with the same hairline rule under the strip that separates the rows. A
  category plate is bold and the strip is centered, where the value plates are left-aligned in
  their own column, so the two never read as one longer row of values. The open category is
  `HubScene.settingsCategory`, panel state rather than a preference: not persisted, and reset
  to the first category whenever the Lab is entered.
- Eight rows, each backed by its own preset list in `data/settings.ts`. Gameplay: Difficulty
  (`DIFFICULTY_TIER_PRESETS`, B.Sc./M.Sc./Ph.D.), Enemy Density (`DENSITY_PRESETS`,
  Low/Normal/High/Very High), World Size (`WORLD_SIZE_PRESETS`, Nano/Meso/Macro). Story: Story
  Screens and Tutorial Tips (`ON_OFF_PRESETS`). Presentation: Text Size (`FONT_SCALE_PRESETS`,
  Compact/Normal/Large), Music Style (`MUSIC_STYLE_PRESETS`, Classic/Modern/Mute), Touch
  Controls (`TOUCH_CONTROLS_PRESETS`, Auto/On/Off).
- The category strip, the name column and its "when" line are capped at the 1.5x text preset
  (the same cap tutorial popups use); the value plates themselves, the part that is clicked,
  keep the player's full chosen size. A value plate is ~43px tall at the Large preset, so no
  row is shorter than ~55px there, and the whole roster on one screenful does not fit the
  canvas -- which is what the categories buy. Measured at Large, the tallest category
  (Presentation, whose Touch Controls row carries a three-line "when") reaches 345 of the
  canvas's 480 pixels, so a category is safe up to about five rows; past that, re-measure
  rather than append.
- Turning the music off lives here as the `MUSIC_STYLE_PRESETS` "Mute" value rather than as
  a key: it is a preference a player sets once, so it belongs with the other preferences and
  persists with them. It silences the score only. Sound effects sit on the master bus rather
  than inside a score's session gain (`audio/sfx.ts`) and keep playing.

## Contextual tutorial tips (`OverworldScene.showTutorialTip`/`renderTutorialTipPopup`, `HubScene.maybeShowLabTip`)

- Same dark rounded-rectangle-with-stroke panel family as everywhere else (`520` wide, height
  grown to fit), stroked the same cyan (`0x5ad9ff`) the full tutorial recap panel below also
  uses -- title (bold white) above body text (muted blue-grey `#cfd8ff`, center-aligned, matching the
  wild-encounter greeting's tone), a single "Got it" button beneath. No page counter or
  Back/Next -- each popup is one tip, not a sequence, so paging chrome would be pure noise.
  Title, body and button are all capped at `Math.min(fontScale(this), 1.5)`, the same cap the
  world-entry lore screen and the between-worlds story beat put on their own prose, and the
  body is then fitted to the canvas with `ui/text.ts`'s `fitProseToBudget` against a budget
  measured from the popup's own title and button plus a 16px bottom margin. Every current tip
  is a single paragraph, so that fitting only ever shrinks; a tip written with a paragraph
  break would instead continue on a further screen whose button reads "Next ->", and `onClose`
  fires only once the last screen is dismissed.
  The Lab's version (`HubScene.maybeShowLabTip`) reuses `HubScene.showPanel` instead (purple
  `0x9a6ad9` stroke, the same gold-title/measured-top-down-layout convention "The Hub" above
  describes for the Lab's other seven panels, just without a left motif of its own -- it's a
  one-off popup, not one of those stations) rather than duplicating this one, since it's a
  single one-off popup there too.
- Fires automatically the first time its own feature becomes relevant (`tutorialTipsSeen`,
  data/tutorial.ts's `TutorialTipId`) -- walking into the Lab, taking your first steps in a
  world, bumping into your first wild crystal, and so on -- never more than one on screen at a
  time, and never several shown in a row. Seven of `TUTORIAL_TIPS`' entries have a contextual
  trigger like this (the ones with an obvious "first time this becomes relevant" moment,
  `unlock: { kind: 'tip' }`); the rest -- a guardian's own repeatable ability, the Lab's
  Settings station, the Story/Superposition Mode choice already made at the Title screen --
  carry no trigger of their own and are only ever read through the Tutorial station itself
  ("Full tutorial recap" below).
- With the Settings station's Tutorial Tips row off ("Settings station" below), a trigger still
  marks its tip seen and runs whatever it was gating; only the popup is skipped. The station's
  own list therefore fills in on exactly the schedule it otherwise would, and holds every tip
  the player was not stopped by.

## Full tutorial recap (`scenes/panels/hubStations.ts`'s `showTutorialTopics`)

- A list+detail panel ("List+detail panels" above), not a linear pager: `LIST_DETAIL_PANEL_W`
  wide, same cyan `0x5ad9ff` stroke the station has always used, with a "Pick a topic to read
  it" hint above the two columns. The left column lists each topic `data/tutorial.ts`'s
  `visibleTutorialPages` returns as its own row (`renderListColumn`, paginated once the set
  outgrows one page -- routine at the eighteen topics a finished Story save or any
  Superposition save lists), so the player sees what's covered before opening anything and can
  jump straight to one topic instead of stepping through the rest to reach it. A row shows its own short `listLabel` where `TutorialPage` carries one (a handful of
  topics whose full `title` would collapse to a near-identical trimmed prefix at the left
  column's `200`px width -- `fitListLabel` ellipsis-trims, doesn't wrap), its full `title`
  otherwise.
- The right column shows the selected topic's full title and body (shrink-only
  `fitProseToBudget`, floor `9`px -- see "Tutorial" under "The Hub" above), no crystal/move art
  and no commit button --
  reading the body is the whole interaction. A single `Close` button sits in the left column
  beneath its rows ("List+detail panels" above);
  there's no separate "back to the topic list" step, since the list column is always on screen
  beside the detail pane rather than a full-panel view swapped out for another.
- Selecting a row is a scoped update (`renderListColumn`'s own `setSelectedId` plus a
  `detailBlock`/`chromeBlock` re-render, "A preview click is a scoped update" below) -- the list
  stays on screen, only the detail pane and panel chrome change. A page flip still tears the
  panel down and rebuilds it, since that changes which rows the list itself shows.
- The list is what the save has reached, in the order the game reveals it (`TUTORIAL_TIPS`'
  declaration order): in Story Mode a topic appears once its own contextual tip has fired or
  its guardian has been met, absent rather than shown locked until then, so the panel opens
  three rows tall on a fresh save and grows through the playthrough; Superposition Mode lists
  all eighteen from the start, like everything else that mode unlocks up front. Reading a
  topic here never counts as discovering it.
- Doesn't trigger automatically -- see "Contextual tutorial tips" above for what
  a new save actually sees; this is opt-in only, always opening on the topic list.

## Story station (`scenes/panels/hubStations.ts`'s `showStoryLog`)

- The Decoherence arc, re-readable in the order a playthrough delivers it. Same list+detail
  panel shape as the full tutorial recap above (`LIST_DETAIL_PANEL_W` wide, a "Pick a chapter to
  read it" hint over two columns, the selected chapter's full title and body in the right
  column, a single `Close` in the left column's footer), stroked the story lavender `0xd9a5ff`
  the between-worlds story beat already uses.
- **The list is the whole arc at every point in a playthrough, with Qumatex's checklist masking
  over it.** `data/storyLog.ts`'s `storyLogIndex` returns all of `STORY_LOG` in declaration
  order -- the premise, then each world's chapters (its entry history, the Decoherence's
  attack on it, and its pass: goal line, the rival's two-part boast, the beat that follows the
  win; World 10's reveal is split across two chapters, its lore page 2 being too long for this
  pane's shrink-only fit), then the ending -- each paired with whether the save has reached it. A chapter not yet
  reached keeps its row and reads `'???'` in the dimmer `#6a7396`, exactly as an undiscovered
  crystal does in Qumatex and an unvisited world does in Bloch's table (`renderListColumn`'s own
  `labelFor`/`colorFor` hooks; there is no separate masking renderer). Its detail pane shows
  `'???'` over one short line rather than a pane of question marks, the same way Bloch's pane
  gives an unwalked world a single "mist covers this land" line in place of its blurb. So the
  station reads as a checklist of the arc: how much road is left is visible, what is on it is
  not. Superposition Mode reads everything unmasked, like everything else that mode unlocks up
  front.
- **A row is `<world>. <chapter>` with the leading article dropped** ("1. Mean Fields", "1.
  Decoherence", "1. Pass"), since the left column is only `200`px wide and `fitListLabel`
  ellipsis-trims rather than wrapping; the detail pane's own title carries the full name ("The
  Mean Fields: The Pass") so a chapter still names its world where there is room for it. Thirty-
  two chapters page at every text-size preset, the same pager every other list+detail panel uses.
- The body is shrink-only `fitProseToBudget` (floor `9`px) like the tutorial recap's -- the
  panel's only button is the shared `Close`, so a long chapter is made to fit where it stands.
  The longest, World 10's own reveal at ~1450 characters, reaches that floor and still fits.
- Reading a chapter never marks it reached: nothing on this path writes `tutorialTipsSeen` or
  `worldLoreSeen`, so opening the premise can't suppress the Lab's own welcome popup.

## Attack effects (`art/attackEffects.ts` + `art/attackAnchors.ts`/`attackStyles.ts`/`attackShapes.ts`/`attackUltimates.ts`, `audio/sfx.ts`, `scenes/BattleScene.ts`)

- **Each side of an effect is anchored to its own crystal, live.** The attacker's half (the
  windup flash) and the target's half (the impact shockwave, the falling beam, the ground
  eruption, an Ultimate's whole summon sequence) each resolve one crystal's current position
  every frame they draw, with no shared coordinate and no dependence on where the other crystal
  is -- so either crystal can move and its own half of the effect follows it. The only
  information that crosses sides is *aim*, sampled once at launch: a travelling bolt/burst
  fixes its origin where it was fired from while still homing on the target's live position,
  and a ring places its origin once, a little way from the caster toward whatever it was aimed
  at. `BattleScene`'s `PLAYER_POS`/`OPPONENT_POS`/`BOSS_OPPONENT_POS` lay out the static field
  furniture (where each crystal is first placed, its HP-bar column, its ground shadow); effects
  follow the crystals themselves, which include their own idle bob.
- **Curves and falloff over hard geometry**, the same direction the battle backdrop and the
  overworld's contour-smoothed terrain take. Every shape is built from a small shared drawing
  vocabulary in `art/attackShapes.ts` rather than from bare strokes: `drawGlow` fakes a soft
  radial falloff as four concentric discs whose radii grow geometrically while their alphas
  roughly halve (a Graphics fill is flat, so this is how a gradient gets faked); `drawBloom` is
  its two-layer counterpart for something that already has a body of its own, since drawGlow's
  wide falloff at a radius of tens of pixels would wash out the backdrop; `drawAnnulus` draws a
  wavefront as three bell-weighted concentric strokes so its edge falls off either side of the
  crest instead of reading as a wire circle; `drawArcRing` builds a runic ring from
  counter-rotating arc fragments, ticks and orbiting motes rather than a closed polygon with
  spokes; `drawTaperedRays` and the impact debris draw as slivers that narrow to a point rather
  than lines of constant width; `drawColumn`/`drawJet` build a falling beam and a rising geyser
  as sampled filled paths whose width varies along their length, with a slow travelling waist,
  rather than as axis-aligned rectangles. Anything drawn on the floor is squashed to
  `GROUND_ASPECT` and planted `GROUND_DROP` below its anchor -- the same ground plane the
  crystals' own shadows sit on, so a summon circle or a ground shockwave lies on the floor
  under the crystal instead of wrapping around its middle.
- Every move renders a distinct particle effect keyed by its move class, not just a color
  swap: a fast focused **bolt** -- a glowing head trailing a tapering comet tail of its own
  recent positions, thrown on a shallow upward arc rather than a ruled straight line (Phonon
  Beam, Electron Pulse, Spinon Swap); an **expanding ring** pulse, one soft-edged wavefront
  with a fainter white echo chasing it (Magnon Pulse, Polaron Drag); or a loose cluster of
  small particles that **converge/scatter** near the target, each keeping its own radius and
  size so the swarm never collapses into an evenly spaced wheel (Anyon Braid, Majorana Split).
  Each class also has its own color (e.g. orange for Phonon Beam, red for Magnon Pulse). All
  shapes render additive-blended (`Phaser.BlendModes.ADD`) so they glow instead of reading as
  flat shapes -- which does mean a bright class color over a bright sky washes toward white;
  the fix used here is to keep white cores small and let the colored falloff carry the hue,
  since a second, normally-blended Graphics per effect would cost an object per shape.
- Kondo's three self-buff moves (Spin Screening, Charge Screening, Symmetry Cloud) share
  the `'screening'` class's one cast look, unlike Landau's/Skłodowska-Curie's moves below --
  an expanding ring (the same silhouette
  Magnon Pulse/Polaron Drag use, reading as an effect enveloping the caster) tinted Kondo's
  own rust-orange (`0xe86a44`), played with the caster's own anchor as both `from` and `to`
  (`BattleScene.resolveSelfBuff`) so it centers on them instead of traveling toward the
  opponent, and paired with a plain squash-bounce on the caster's own crystal
  (`flashHit`) rather than the camera shake/flash an ordinary hit's `impactPunch` adds, so
  casting a buff doesn't read as the caster taking damage. The ring is only the cast's
  beat: what it leaves behind is the persistent per-channel aura wrapped around the
  caster's crystal for the buff's duration (`art/screeningAuras.ts`, "Battle status
  effects" above), which is also what tells the three moves apart visually, so the shared
  cast ring needs no `ANALYTIC_SHAPES`-style per-move override for this class.
- Landau's two Analytic moves break the "one shape per class" rule on purpose, each with
  its own silhouette rather than sharing whichever ordinary
  `EFFECT_STYLE` shape their currently-tuned quasiparticle carries (`art/attackStyles.ts`'s
  `ANALYTIC_SHAPES`, keyed by move id, not class), and each substantially more elaborate than
  the three base bolt/ring/burst shapes -- deliberately reading as clearly stronger than an
  ordinary hit, not just a
  bigger bolt/ring/burst. **The beam move** (`skyfallBeam`, `playBeam`) drops a multi-layer
  column of light from off the top of the screen straight down onto the target: a wide pulsing
  telegraph halo fades in first (ramped in early enough to have arrived well before the beam
  lands), then a white-hot core inside a brighter, wider outer column falls the rest of the
  way, flanked by two side-rays that wrap around it, trailed by a chain of sparks, and closed
  out by a pool of light spreading across the ground where the column meets it with a few licks
  curling back up. Every layer is a sampled path that narrows at the sky end and flares toward
  the ground, so the shaft reads as light with air in it. Meanwhile a radiant sun grows at the
  point of origin as the beam charges. **The eruption move** (`groundEruption`, `playEruption`)
  opens a crack in the floor under the target: shockwave rings spreading out across the ground
  plane, a tapered wavering geyser that rises and collapses within the beat rather than
  freezing at full height, and nearly twice the ordinary burst's debris count (18 vs. 12)
  thrown up and out as streaks, seeded per cast so no two casts spray alike, with the heavier
  pieces arcing over and falling back. Neither takes an attacker anchor at all -- a beam falling
  from the sky and a crack opening in the ground don't originate there. Each
  still renders in whichever color its own currently-tuned quasiparticle class carries
  (`EFFECT_STYLE`), same as an ordinary move -- only the silhouette is overridden.
- Skłodowska-Curie's two Ultimate moves (`ultimateMeteor`/`ultimateNova`) get the same
  per-move-id shape-override treatment (`ULTIMATE_SHAPES`), but run their own multi-phase
  summon→charge→impact→aftermath sequence (`playMeteor`/`playNova`) rather than the shared
  windup/travel/impact beat every other shape (including Landau's beam/eruption) uses --
  4-6 seconds total, dramatically longer than any other move's effect, with `onImpact` firing
  at the sequence's own strike beat and `onComplete` only once the full aftermath decay
  finishes (see `BattleScene`'s "Ultimate moves defer damage/turn-handoff" in `CODEMAP.md`).
  A whiff (any wrong answer in `showUltimateQuestions`) still plays the same windup/charge
  phases, but swaps the final impact/aftermath beat for a distinct fizzle cue instead of a
  hit. The meteor's rune is inscribed flat on the ground under the target and its mass punches
  into frame fast, then *brakes* into a straining, trembling hover for the last stretch before
  it drops -- the arrival is shaped inside the phase rather than by easing the phase's own
  counter, which would spend most of the charge with the mass still off-screen. The nova's
  rune stands upright around the target instead, and its charge pulls motes inward on their own
  individual clocks, each respawning further out as it reaches the core, so it reads as matter
  accreting rather than as one ring contracting.
- The full beat, in order: a ~90ms windup at the attacker's own position -- sparks pulled
  *inward* to a brightening core, an inhale, so brightness peaks exactly on the frame the shot
  is released -- the travelling effect itself (`art/attackShapes.ts`'s `TRAVEL_MS`, 340-520ms
  depending on shape -- beam is the longest at 520ms), then a fire-and-forget impact shockwave
  (~260ms) at the target: a soft flash, a wavefront, and ten tapering debris slivers seeded per
  impact so none of them reads as an evenly spoked asterisk. When the landing shape knows which
  way it came in (a bolt/burst hands over its own arrival heading, a beam comes down, an
  eruption comes up) the debris throws into the hemisphere away from it, ±70°; a ring or a
  self-buff supplies no direction and stays evenly radial. On top of that
  `BattleScene.impactPunch` layers the target crystal's scale-squash (`flashHit`), a small
  camera shake (`0.006`, kept subtle since the field's background is solid black right up to
  the canvas edge), and a brief pale lift of the whole field -- deliberately dim and short
  (`flash(70, 110, 118, 140)`), since a full-brightness white flash washes the field out for
  long enough to swallow whichever silhouette just landed, and costs most on exactly the
  flashiest moves. `BattleScene`'s `TURN_GAP_MS` (850ms) covers
  every other shape's ~810-830ms worst case comfortably but sits ~20ms under the beam move's
  own 870ms total -- in practice an imperceptible overlap with the very start of the next
  turn's own windup flash, not worth chasing given how minor it is, but worth knowing if
  `TRAVEL_MS`/`TURN_GAP_MS` are ever retuned together. A leveled move (below) runs
  noticeably longer than this single-trigger budget, since it repeats the beat several times --
  `TURN_GAP_MS` is not retuned for that case; the tail end of a leveled cascade is left to
  overlap the very start of the next turn's own windup, the same way the beam move's own 20ms
  overrun already does, just larger.
  Drawn fresh each frame with a `Graphics` object cleared and redrawn every tween tick (same
  pattern as the overworld's per-frame ground mesh) rather than a sprite, then destroyed on
  arrival/decay.
- **A leveled move (Feynman's move-leveling, §5, World 7) escalates its own animation into
  several overlapping, growing repeats of the same single hit** -- purely presentational, since
  the real power bump (`MOVE_LEVEL_MULTIPLIERS`, a flat 1.5x/2x/3x) is already folded into the
  hit's own damage math upstream of the animation; repeating the animation never repeats the
  damage. Applies uniformly across every shape family bolt/ring/burst/beam/eruption/meteor/nova
  -- nothing is exempted. Trigger count scales with level: Double=2, Triple=3, Infinite=4 (a
  finite cap that reads as "a cascade, too many to track" rather than a literal unbounded loop).
  Each successive repeat renders visibly bigger than the last (`LEVEL_TRIGGER_SCALES`, `1,
  1.25, 1.5, 3.5` -- a real multiplier on every shape's own stroke widths/radii/lengths, not
  just impact-sfx volume) and starts a bit after the previous one begins rather than after it
  finishes, so the repeats visibly overlap instead of playing back-to-back with gaps. The
  stagger differs by shape family: an ordinary/Analytic shape (bolt/ring/burst/beam/eruption)
  staggers at 40% of its own `TRAVEL_MS`, so a fast bolt cascades quickly and a slower beam more
  deliberately; meteor/nova instead use a fixed 650ms real-world delay between repeat starts,
  since their own `TRAVEL_MS` describes a whole multi-second summon->charge->impact->aftermath
  sequence rather than a single silhouette's travel time -- a percentage of it would stagger
  repeats by seconds. A leveled Ultimate plays its full multi-phase sequence once per repeat
  (each one bigger than the last) rather than a cheaper single-bigger-impact substitute, so a
  level-3 Ultimate takes noticeably longer than an unleveled one (measured: roughly 7s for a
  4-repeat meteor, versus ~5.2s unleveled) -- accepted as a deliberate tradeoff for Skłodowska-
  Curie's own flashiest tier rather than something to shorten. Only the LAST repeat is wired to
  the real `onImpact`/`onComplete` a caller passed in (BattleScene's actual damage/log/win-lose-
  check/turn-release); every earlier repeat is fire-and-forget decoration, so the escalation
  never multiplies real damage or fires `checkEndOrContinue` more than once regardless of
  trigger count. Only the *player's* own leveled moves escalate -- an opponent's copy of the
  same move id never carries a level (Feynman's leveling is the player's own save state), so a
  wild/rival casting the same move always plays the plain, single-trigger animation.
- Each attack also plays a procedural one-shot sound keyed to the same bolt/ring/burst shape
  (`audio/sfx.ts`'s `playAttackSfx`) on launch and an impact thump scaled by the
  quasiparticle-mismatch multiplier (`playImpactSfx`, 2x on a mismatched hit, 1x otherwise)
  on arrival, and dips the currently-playing
  music track's volume for the beat's duration (`audio/music.ts`'s `MusicEngine.duck`) so the
  hit reads clearly over the score before the music comes back up.
- **Noether's/Kondo's/Landau's/Skłodowska-Curie's own detail panes loop this same real effect**
  (`art/moveEffectPreview.ts`, "List+detail panels" above and "Landau in the overworld"/
  "Skłodowska-Curie in the overworld" below) rather than a static icon, at a small
  fixed local `from`/`to` span sized to the pane -- a detail pane has no crystals of its own to
  follow, and a fixed point is a perfectly good anchor, it just never moves. `playAttackEffect`'s own Graphics normally draw at depth 58-61 (tuned for
  `BattleScene`'s background); a guardian panel's own dialogue container sits at depth `100`
  (`OverworldScene.ts`/`HubScene.ts`'s `showXPanel` convention), which would otherwise draw over
  (hide) the preview entirely, so `playAttackEffect`'s own `depthOffset` parameter (default `0`,
  every `BattleScene` call site unaffected) shifts the preview's Graphics comfortably above it.
  Each preview also carries the player's own real `MoveLevel` for that move (`getMoveLevel`) into
  `playAttackEffect`'s own `level` parameter, so a leveled move's preview escalates into the same
  multi-trigger, growing-size cascade a real leveled cast plays (the escalation rules above)
  instead of always showing the flat unleveled loop -- a still-unbought move (Noether's own rows)
  is simply never above level 0, since leveling requires already owning the move.
  A preview leaves the music alone, whatever shape it plays: the dip belongs to a real cast,
  and one fired every few seconds for as long as a panel is open would read as a fault in the
  score rather than emphasis on a hit.
  `moveEffectPreview.ts` tracks any number of independent, simultaneously-looping preview
  *chains* at once, each identified by its own caller-supplied string key (default `'default'`,
  what every single-preview caller -- Noether, Kondo -- implicitly lands on, unaffected by this):
  Landau's and Skłodowska-Curie's own two-column panels (below) are the one case with two
  chains genuinely running at once, one per move id, so retuning one column's own move never
  disturbs the other column's already-looping chain. `stopMoveEffectPreview()` with no key stops
  every chain at once (every guardian panel's own Farewell/close path); passed a key, it stops
  only that one chain.
