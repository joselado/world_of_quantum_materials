# Style Notes

Living record of current visual/style decisions for the game (`game/src/art/`,
`game/src/world/`, `game/src/scenes/OverworldScene.ts`, `game/src/scenes/BattleScene.ts`).
Companion to `DESIGN.md` (mechanics/content) and `CODEMAP.md` (where things live in the
code); this file covers "how things currently look" -- sizes, colors, shapes. Edit in place
as choices change; when a new decision replaces an old one, remove the old entry rather
than appending a changelog, so this always reflects current reality.

## Title screen (`scenes/TitleScene.ts`)

- Dark indigo gradient (`0x0c1030` → `0x241a44`), no biome/perspective machinery involved --
  this screen exists to load the save (see DESIGN.md §7) and hand off to the Hub, not to be a
  world of its own. Title text reads "WORLD OF QUANTUM MATERIALS" (`26px` bold) over "a
  crystal RPG" in muted italic blue-grey. Button label reads "Continue" if a save exists
  (`data/save.ts`'s `hasSave`) or "New Game" otherwise; both SPACE and a click on the button
  start the Hub.
- Above the title text, a small showcase cluster of five crystals (`drawShowcaseCrystals`,
  the module-level `SHOWCASE` array) rather than a single crystal -- a curated handful of
  `data/materials.ts`'s `TYPE_LOOK` entries (metal, quantumSpinLiquid, classicalMagnet,
  superconductor, quantumSpinHall), not tied to the player's own save/current form, since this is a "world full
  of different materials" branding image rather than a "welcome back" one (the Hub is where
  the player's own crystal gets its own moment). One centered "hero" crystal (biggest,
  drawn last so it renders on top) flanked by two nearer and two further/smaller ones, each
  bobbing on its own independent duration/delay so the cluster reads as alive rather than a
  single synchronized animation.
- Below the "Press SPACE..." hint, a **mode picker** (`addModeSelector`) rather than a single
  toggle switch -- two side-by-side text buttons, "Story Mode" and "Superposition Mode", both
  backed by the same `superpositionMode` boolean (Story Mode is just its `false` state). The
  active one highlights (`#ffff88` yellow for Story, `#ff8fa0` warning pink for Superposition,
  each with a lighter `#33335a` background) while the inactive one dims to `#8fa0c9`/`#1a1a2e`.
  A one-line dim caption underneath spells out what each mode actually does (start at World 1
  in order, vs. every guardian/transmutation/hybrid available immediately). Deliberately placed
  on the title screen, as a choice made before starting a run, rather than toggleable mid-run.

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
  perspective/camera machinery -- everything is laid out at fixed canvas coordinates.
- **Up to nine stations, one row at a time, no crystal icons.** Every station is a plain
  gold-on-dark-blue text button (`HubScene.addStationRow`, same look every dialogue button in
  the game uses), not an icon a player clicks -- there is no `makeCrystal` render anywhere in
  the station rows. Row 1 always shows all three of Qumatex, Save Point, and the door onward,
  in that column order. Its label reads "Enter World N" for `HubScene.highestUnlockedWorld()`
  (walking `rivalDefeated` from world 1 until it finds one not yet beaten) the first time that
  world is ever stepped into, or "Back to World N" once it is -- `HubScene.canResumeWorld()` is
  the single predicate both the label and the door's own click/Enter-key navigation read,
  checking that the world is in the persisted `visitedWorlds` *and* that the registry's own
  `mapState` (`OverworldScene`'s in-progress map/position snapshot, written by
  `saveMapState()`/`returnToHub()` -- see "Overworld path" below) still belongs to that exact
  world, since `mapState` is registry-only and doesn't survive a page reload the way
  `visitedWorlds` does; sharing one predicate is what keeps the label and the actual
  resume-or-regenerate outcome from ever disagreeing. "Back to World N" always resumes the
  player's exact saved position in that world; "Enter World N" always generates a fresh map. In
  Superposition Mode the door always reads "Enter World 1" and always drops the player straight
  into a fresh World 1, same as Story Mode's own first entry -- `canResumeWorld()` never
  returns true in this mode, since the mode's own teleport-anywhere design (below) makes a
  single "resume where I left off" door meaningless once Bloch's hub can jump to any visited
  world instead. Pressing Enter while standing in the Lab is the reverse of `OverworldScene`'s
  own Enter/H (which send the player *to* the Hub, saving `mapState` as they leave): it sends
  the player back to exactly the world and position `mapState` holds (`HubScene.resumeWorld()`),
  which is not necessarily the door station's own frontier-world target -- opening the Lab from
  an earlier world (Bloch's teleport hub, or walking back through an earlier world's own door)
  and pressing Enter again lands the player back in that same earlier world, not the door's
  "Back to World N." A no-op when there's nothing resumable (a fresh save with nothing in
  progress yet has nothing to send Enter back to), and never fires while a Lab panel is open,
  matching every station's own one-panel-at-a-time guard. From there the player can
  walk to World 2 to reach Bloch, whose teleport hub (already pre-seeded with every world as
  visited) can jump to any other world immediately -- there is no separate warp/world-select
  panel, though every world also has its own walkable doors back to the Hub/previous world and
  onward to the next one (see "World doors" below). Below row 1, the six reference/settings
  stations (`scenes/panels/hubStations.ts`'s `LAB_STATIONS` -- Moves, Stats, Abilities,
  Guardians, Tutorial, Settings) are filtered down to whichever the player has actually
  unlocked and packed into rows of three with no gaps: Abilities only appears once the player
  has learned a first passive (`passivesUnlocked` non-empty), Guardians only once they've met a
  first guardian (`metGuardians` non-empty) -- Superposition Mode treats both as unlocked from
  the start, since it already grants every passive and lists every guardian regardless. Moves,
  Stats, Tutorial, and Settings are never gated, so a fresh save always shows at least those
  four (two rows of up to three) even with neither gated station visible yet. Every station
  except the door (Qumatex, Save Point, and all six `LAB_STATIONS` entries) gets its own small
  `art/labMotifs.ts` icon planted just to the left of its button label (`HubScene.addStationRow`,
  `STATION_MOTIF_SIZE = 26`, fixed-px, never scaled by the Text Size setting) -- much smaller
  than the same builder would draw inside a full panel, since here it sits inline with a
  compact button; Qumatex's own icon (`makeQumatexMotif`, a small 2x2 grid of tiny faceted
  gems reading as "an indexed catalog") is distinct from the panel's own detail pane, which
  renders one full-size real crystal for whichever compound is currently selected. The door has
  no motif of its own -- plain text is enough to read as an exit. Every station is a
  no-op while another panel is already open (one panel at a time).
- **Every one of the Lab's eight non-door panels reads as one coherent design** -- dark
  rounded-rectangle-with-stroke chrome and a bold gold (`#ffe066`) heading -- rather than
  several visually separate eras bolted together. Panel content is always laid out top-down
  first (a running `y`, each element's own measured height advancing it) and centered within
  the panel's own width, margined in from both edges (`scenes/panels/hubStations.ts`'s
  `labPanelColumns`), with the background rectangle sized and inserted behind everything
  (`container.addAt(..., 0)`) only once the real final height is known, the same pattern this
  file's own "Paginated candidate lists" section documents for row-based panels. A panel's own
  themed motif (Save Point's glowing gold spire with an etched rune ring, Moves' jagged orange
  energy bolt, Stats' small ascending bar chart, Abilities' shield with a white emblem,
  Guardians' small haloed robed figure, Tutorial's small open book, Settings' meshed pair of
  gears -- all in `art/labMotifs.ts`) is never drawn inside the panel itself; it sits beside
  that station's own button out in the room instead (previous bullet), so panel content gets
  the panel's full width rather than sharing it with a left-side icon column.
- **Save Point** (`HubScene.showSavePoint`) is its own panel (not folded into a generic helper)
  so it can carry its own gold heading distinctly from a Close button below a single centered
  message.
- **Qumatex** (`HubScene.renderMaterialdexPanel`) is a two-column index over every real
  compound in the game (`data/materials.ts`'s `allCrystals()`, alphabetical by name), not just
  ones the player has found -- an undiscovered entry still gets a slot, masked to a "???" name
  in both columns, a generic "Not yet discovered" blurb, and a flat dim-grey (`0x33394a`)
  silhouette in place of the compound's own rendered look, rather than the index only ever
  growing as the player finds things. Panel (`720` wide) stroked purple (`0x9a6ad9`). Its title
  line carries a small purple prism icon of its own (`makeCrystal(this, 16, 0x9a6ad9, 'prism')`)
  since its two-column list/detail layout has no room for a full left-side motif column and its
  right-column crystal render (below) already reads as a themed motif in its own right. The
  **left column** lists every (filtered) entry's own name as its own clickable row -- as many
  as fit on one screen at the current text-size preset (same sample-row-measurement technique
  as "Paginated candidate lists" below), a selected row highlighted gold-on-purple, with `<-
  Prev`/`Next ->` and a `Page N/M` label appearing only once the full list outgrows one page. A
  row whose own label would run past the column's width is trimmed to an ellipsis (measured
  against the text's actual rendered width at the current font-scale preset) rather than
  wrapped, since wrapping would make row heights uneven and break the page-fit math. The
  **right column** shows whichever row is currently selected: the compound's own crystal render
  (`makeCrystal`, size `36`), name, and physics blurb (`materialdex.ts`'s `materialBlurb`) --
  the blurb's font shrinks in whole-px steps (floor `9`) if a long entry would otherwise push
  the panel's footer off the canvas. A **type filter** button (`Type: <MaterialType | All> ▸`)
  cycles through every `MaterialType` plus "All," narrowing which rows appear in the left
  column and resetting the list to its first page and first matching row. A single "Close"
  button sits below both columns. Every element is laid out top-down with its own measured
  height advancing a running `y` (same pattern as `hubStations.ts`'s `showInfoPanel`), the
  panel's own background rectangle sized and inserted behind everything only once the taller of
  the two columns' real height is known.
- **Tutorial** (`scenes/panels/hubStations.ts`'s `showTutorialTopics`/`showTutorialTopic`,
  stroked cyan `0x5ad9ff`) opens to a menu listing every topic by its own title
  (`data/tutorial.ts`'s `TUTORIAL_PAGES`) rather than paging through them linearly -- the whole
  set is visible up front. Picking a row opens that topic's own single page (title, body, a
  `<- Topics` button back to the menu, and Close), rather than stepping through every other
  topic to reach it.

## Overworld path

- The grid is `GRID_W = 27` columns wide (`OverworldScene.ts`, `GRID_H = 50` tall). Each of
  the 10 worlds has its own map *shape* (`world/mapgen.ts` dispatching to
  `world/generators/world1.ts` .. `world10.ts`, see CODEMAP.md) -- a wandering corridor is
  only world 2/6/9's own base motif now, not a look shared by all ten. Every shape still
  obeys the same two rules regardless: no walkable segment is ever narrower than 2 tiles (so
  a wild-encounter tile spawned on the path can never fully block it), and the world's
  guardian tile (`mid`) is a forced, verified articulation point -- every route from the
  start tile to the goal is provably routed through it (`world/generators/shared.ts`'s
  `forceChokepoint`/`verifyChokepoint`), not just placed near the geometric middle of one of
  several possible routes.
- Two per-tile overlays a generator can paint on top of its own shape, both consumed
  generically by `OverworldScene.drawWorld`: `regionColor` tints a tile toward a fixed hex
  color (world 1's two broken-symmetry branches, world 3's Voronoi domains, both blended into
  the tile's ordinary fill via `art/colors.ts`'s `blend`) and `biomeOverride` swaps which
  world's whole `art/biomes.ts` entry a tile renders with instead of the current world's own
  (world 9's patches, each independently borrowing one of worlds 1-8's look). A `regionColor`
  tile always renders as solid extruded ground in that tint regardless of `wallTheme` --
  world 3's own biome is `wallTheme: 'void'` (see below), which would otherwise paint every
  domain interior as empty sky rather than a colored region.
- The guardian's own tile (and its immediate neighbors) gets a soft pulsing glow overlaid on
  the ordinary path fill, in that world's own guardian color (`WORLD_GUARDIANS`'
  `strokeColor` -- the same per-guardian color coding panels/pills already use,
  `OverworldScene.drawMidHighlight`) -- the forced chokepoint reads as a deliberate gate the
  player is walking through, not an arbitrary narrow spot.
- Off-path tiles read as unambiguously "you cannot walk here," but not always the same way --
  `OverworldScene.drawOffPathTile` dispatches on that tile's own biome's `wallTheme`
  (`art/biomes.ts`, resolved per-tile via `biomeOverride` above; see the Biomes table below):
  - **'rock'** (most biomes): a raised, solid-looking wall block, not just
    differently-colored flat ground -- every edge a non-walkable tile shares with a walkable
    neighbor gets an extruded vertical face (`OverworldScene.drawWallFaces`, `WALL_HEIGHT_PX =
    30`), shaded darker than the tile's own top color and shaded differently per facing (near/
    far/left/right) for a bit of pseudo-3D shading. Each face also gets a darker mortar line
    partway up and a brighter rim along its top edge (as if lit from above), so it reads as a
    stacked stone block rather than a flat colored card.
  - **'lava'** (Defect Wastes, world 9): a flat, glowing molten crust flush with the ground --
    no extruded block, since lava is a hazard you'd sink into, not a wall you'd bump into
    (`OverworldScene.drawLavaTile`). A pulsing warm overlay, a bright crack line, and a hot
    core dot animate per-tile off `this.time.now`, skipped past `depthRatio 0.75` (same gate
    `decorateTile` uses) so distant tiles stay a cheap flat fill.
  - **'water'** (Frozen Caverns, world 5): a dark, rippling frozen lake, likewise flush with
    the ground (`OverworldScene.drawWaterTile`) -- animated shimmer streaks rather than a
    crack/glow overlay, same depth gate as lava.
  - **'void'** (Floating Islands, world 3's own biome): no ground fill at all -- the static
    sky/hill gradient `drawSky()` paints once behind `worldGfx` shows through, so a tile reads
    as open air rather than solid ground in a different color (`OverworldScene.drawVoidTile`).
    Only the edge shared with a walkable neighbor gets a glowing rail marking the drop-off; a
    void tile with no walkable neighbor draws nothing at all. World 3's own off-path tiles are
    almost always covered by a `regionColor` domain tint instead (see above), which always
    wins over this theme -- this path mainly renders now when a world 9 patch borrows world
    3's biome look for a tile that has no `regionColor` of its own.
  A ground-tile fill itself (walkable, 'rock' off-path, or a `regionColor`-tinted tile) is a
  single flat color per tile, not a per-tile diagonal-facet/gradient shading -- floors read
  better flat; don't add such shading without asking first.
- Decoration (flowers / crystal glints) is placed in the off-path terrain only, not on
  walkable tiles -- those are reserved for wild encounters and qumatessence pickups.
- Qumatessence tokens are scattered across a handful of walkable tiles per map
  (`world/generators/shared.ts`'s `scatterTokens`), preferring an actual dead-end tile (a
  branch/spur tip, degree 1 in the walkable graph) when that world's shape has any, falling
  back to any walkable tile otherwise -- so the original "reward sits at the end of a detour"
  read survives for the worlds that still build literal dead ends, without requiring every
  shape to have one.
- Corner HUD: the world name (top-left, white on translucent black) and the qumatessence
  counter (top-right, gold `#ffe066` on translucent black) sit on the same row at `y = 8` --
  the same spot `HubScene`'s own counter uses, so the Lab and the overworld put it in the same
  corner. The counter's column is reserved as a right-side gutter, sized once from the widest
  qumatessence string this text style could ever show rather than measured live off the
  current value, and the world name's word-wrap width is narrowed to stop short of that
  gutter -- a long name (e.g. world 5's "Frozen Zero-Resistance Caverns") or a large text-size
  setting wraps down onto a second line instead of running wide enough to collide with the
  counter. The bottom-right corner carries one small always-on hint, "Press Enter to go to the
  Lab" (muted blue-grey `#8fa0c9` on translucent black, matching the Settings station's hint-line
  color) -- the one persistent on-screen key reminder on this screen, since the world<->Lab
  shuttle is used far more often than the other keys; movement/M/H aren't repeated here and
  stay covered only by the Lab's Tutorial station, so a fixed line for every key wouldn't stack
  up against this corner's overflow risk.
- Map regenerates fresh (new `Math.random` layout, retried internally up to 10 times against
  the two invariants above before falling back to a plain wide corridor) on first load and on
  an explicit world change that's genuinely new ground -- Bloch's teleport, a world door, a
  debug warp, the Hub door/Lab Enter-key into a world never yet visited, or (World 10 only)
  transmuting/fusing into a new form while standing there, since World 10's shape is keyed off
  the player's own current type. A round trip through a battle, or leaving to the Hub and
  coming back (H/Enter from the world, the Hub door, or the Lab's own Enter key), instead
  restores the exact same layout and player position (`OverworldScene.saveMapState`/
  `restoreMap`) -- every path back to the Hub goes through `OverworldScene.returnToHub()`,
  which snapshots the current map/position into the registry's `mapState` first, so the next
  entry into that same world (`HubScene.canResumeWorld()`, above) resumes exactly where the
  player left off rather than regenerating; the
  pre-battle encounter dialogue itself never leaves the overworld scene, so passing on it
  needs no round trip at all.

## Biomes (`art/biomes.ts`)

Per-world skin: sky/ceiling gradient, hill/ceiling silhouette, wall-block color (off-path),
on-path trail color, ambient decoration style, fog blend target, whether clouds render, and
(see "Overworld path" above) what the off-path terrain actually *is* -- `wallTheme`.

| World | Biome | Sky/ceiling | Walls (off-path) | Path | Decoration | Clouds | Wall theme |
|---|---|---|---|---|---|---|---|
| 1 | Tutorial Meadow | pale blue gradient (`0x8fd0ff`→`0xe8f6ff`) | grass `0x2e7d32` | dirt `0xb08d57` | flowers | yes | rock |
| 2 | Crystalline Caves | dark purple gradient (`0x1a1730`→`0x362f5c`) | stone `0x2b2b3a` | cave floor `0x585073` | crystal glints (cyan) | no | rock |
| 3 | Floating Islands | deep-to-pale blue gradient (`0x2a3d6b`→`0x8fb8e8`) | slate blue `0x35507a` | pale sky-blue walkway `0x9ac0e0` | crystal glints (cyan) | yes | **void** -- open sky/chasm, matches "one-way edge paths" |
| 4 | Landau Level Terrain | deep electric-blue gradient (`0x081428`→`0x1f4d8f`) | field-line blue `0x2a5ca8` | glowing blue `0x3a7fd4` | field lines | no | rock |
| 5 | Frozen Caverns | icy dark gradient (`0x0d1b2a`→`0x2a4858`) | icy slate `0x24404f` | pale ice-blue `0x8fdcff` | crystal glints (cyan) | no | **water** -- a frozen lake, "zero-resistance" made literal underfoot |
| 6 | Magnon Plains | pale blue-green gradient (`0x9fd8ff`→`0xdff3ff`) | olive-gold `0x8fae5c` | warm gold `0xd4c07a` | ripples | yes | rock |
| 7 | Tensor-Network World | dark violet gradient (`0x120a24`→`0x2c1a4a`) | deep purple `0x3a2560` | violet bond-path `0x8a5cd9` | network nodes | no | rock |
| 8 | Spinon Forest | muted grey-green gradient (`0x2a2f28`→`0x4a5248`) | low-contrast green `0x3a4238` | muted sage `0x5a6a58` | mist motes | no | rock |
| 9 | Defect Wastes | scorched red-black gradient (`0x1a0808`→`0x3a1414`) | charred red `0x4a1c1c` | cracked red `0x8a2a2a` | cracks | no | **lava** -- the world's own "scorched" theme made literal |
| 10 | Adaptive Meta-World | shimmering violet gradient (`0x2a1a3a`→`0x6a4a8a`) | violet `0x5a3a7a` | lavender `0xc9a8f0` | crystal glints (cyan) | yes | rock |

## Qumatessence pickups (`art/tokens.ts`, `data/tokens.ts`)

- One token sits at the dead end of each branch (not scattered along it).
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

- Shared `makeCrystal()` builder (`art/crystals.ts`): faceted `shard` / `cluster` / `prism`
  silhouette per material, colored per its main type (`TYPE_LOOK` in `data/materials.ts`),
  plus a highlight and twinkling sparkles. `cluster` (classicalMagnet, quantumSpinLiquid,
  kondoHeavyFermion) draws three genuinely different real crystal habits intergrown
  together rather than one shape repeated at three sizes: a narrow prismatic needle
  (`drawShardShape` with its `widthScale` param narrowed), a blocky isometric cube
  (`drawCubicShape`), and a hexagonal column (`drawPrismShape`, reused directly) -- so a
  "resting cluster" reads as an actual mineral specimen rather than duplicated gems.
- Two more variants exist for compounds whose actual dimensionality/stacking doesn't read
  as a solid gem: `layer` is a single thin, flattened hexagonal sheet with a soft
  *detached* shadow underneath it (not touching the sheet) so it reads as floating rather
  than resting on the ground — used for 2D/van der Waals compounds (Graphene, Monolayer
  WTe₂, Chromium Triiodide). `twisted` is two of those sheets stacked with a rotational
  offset between their hex outlines (the moiré mismatch is the point), both rendered
  semi-transparent so the offset is actually visible — used for twisted systems (Twisted
  Bilayer MoTe₂). Picked per-compound via `data/materials.ts`'s `crystal()`
  `variantOverride` param, not derived from `TYPE_LOOK`, since a compound's dimensionality
  doesn't track its main type.
- Sizes: player `PLAYER_CRYSTAL_SIZE = 34` (largest, always on-screen), wild encounters
  `CRYSTAL_SIZE = 22`.
- **Per-compound identity.** `TYPE_LOOK` fixes one shard/cluster/prism/layer/twisted
  silhouette + base color per `MaterialType`, but individual compounds of the same type each
  get their own visual variation rather than rendering as that same silhouette in only a
  different brightness. Every call site that has an actual `Material` passes `makeCrystal()`'s
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
  both parents, not one flat blended color. `data/materials.ts`'s `combineMaterials` carries
  each parent's own `color`/`variant` forward as the new `Material`'s `hybridParents`; when
  present, `makeCrystal()`'s `opts.hybrid` routes to `drawHybridCrystal` instead of the
  ordinary single-shape path: both parents' own shapes (`drawVariantShape`, one silhouette per
  variant, 'cluster' collapsing to a plain shard so it doesn't crowd a shape already sharing
  space with a second parent's own shape) render off-center at a slight opposing tilt, the
  second layered on top at less than full opacity so the overlap region genuinely blends both
  parent colors via normal alpha compositing -- **not** `Phaser.BlendModes.ADD` on the shapes
  themselves, since that washes out to solid white against anything but a black
  background (the overworld sky never is). A soft additive-blended glow (their averaged color)
  and a jagged white-gold seam down the middle *do* use `ADD`, since those are meant to read as
  light/energy rather than solid material. Finished with sparkles tinted in both parents' own
  colors (`hexColor`) instead of the plain-white default. A hybrid `playerForm` loaded from a
  save written before `hybridParents` existed simply has no `hybridParents` key and falls back
  to the ordinary single-shape render rather than throwing.

## Wild encounter dialogue (`OverworldScene.showEncounter`)

- Appears as an overlay panel inside the overworld itself (dark `0x10101c` rectangle,
  `600x300`, stroked in `0x444466`) rather than switching to a separate scene --
  asking a question or offering a fight shouldn't feel like leaving the map. Movement is
  frozen (`dialogueActive`) while it's open.
- Single screen, no click-through: the wild crystal bobs at the top (`makeCrystal()`, size
  30), directly below it an italic greeting line keyed to the material's main type
  (`data/greetings.ts`'s `encounterGreeting`, in muted blue-grey `#cfd8ff`), and directly
  below that -- already visible, no "Continue" step -- either the physics question (gold
  `#ffe066`, if the current world has a `data/quiz.ts` pool -- one question drawn at random
  from that world's own pool via `getWorldQuestion`, so the same
  encounter doesn't always ask the same thing) with two shuffled answer buttons plus "Let me
  pass," or a plain "Fight!" / "Let me pass" choice if it doesn't. Buttons use
  the same `[ #222244 background / #ffff88 text ]` treatment `BattleScene`'s move buttons
  use, for visual continuity between the map and the battle screen. Question, answer, and
  greeting text are all kept short (one line each) so the panel reads at a glance.
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
  their dialogue fires. Depth `20`/`21` (container/label), matching wild-encounter
  crystals. Permanent -- unlike encounter/token sprites a guardian is never removed,
  since reaching their row still opens their panel on top of (not instead of) them
  standing there.

## Noether's shop (`OverworldScene.showNoetherShop`)

- Same panel treatment as a wild encounter, but stroked in gold (`0xffe066`) instead of
  blue-grey, and fronted by Noether's own avatar (`art/noether.ts`'s `makeNoetherAvatar`)
  instead of a crystal -- a small cartoon deity floating in a flowing golden robe with wide
  welcoming sleeves, a haloed head, and four motes orbiting the whole figure, deliberately
  not another faceted crystal so a guardian reads as a distinct, benevolent presence rather
  than a wild encounter. An inner container sways gently on its own (independent of the
  panel's own bob tween on the outer container) so she reads as adrift rather than fixed in
  place; a soft additive glow behind her pulses slowly for a "presence" that a flat
  silhouette wouldn't give. A short layered-bell chime (`audio/sfx.ts`'s `playGuardianChime`,
  shared by every guardian panel) plays whenever the shop opens. Sized and positioned
  (`panelY - 105`, avatar top edge landing a few px inside the panel's own top edge, intro
  text pushed down to `panelY - 68`) to fit the same panel every later guardian panel
  (Bloch's) reuses -- each guardian still gets its own avatar builder in its own file
  (`art/bloch.ts`, `art/franklin.ts`, ...) even though the surrounding panel shape is shared.
  Appears automatically every time the Overworld scene is (re)created with this world's
  middle row already reached (`OverworldScene.maybeAutoOpenMiddleDialogue`) -- first on
  stepping onto that row, then again after every later round trip through `BattleScene`,
  so the panel stays revisitable instead of a single one-shot popup. Panel height `340`
  (taller than a wild encounter's `300`) to fit the fixed footer row below the content.
- Below the intro line, two small tab buttons (`renderShopTabs`, `panelY - 42`) switch the
  panel between a **Moves** list and a **Stats** list (`OverworldScene.shopTab`, reset to
  `'moves'` on every scene create) -- the active tab is highlighted gold-on-slate, the
  inactive one dim blue-grey, same click-to-rebuild-the-panel pattern as buying itself.
  - **Moves**: one button per still-unbought move the player's *current crystal form* can
    physically carry (`data/materials.ts`'s `SHOP_MOVE_IDS` filtered through
    `compatibleMoves`), labeled `<move name> -- <cost> qumatessence`; unaffordable buttons dim
    to 50% alpha rather than hide, so the shop still previews what's coming.
  - **Stats**: one button per stat (Quantumness/Velocity/Correlation), labeled
    `<stat> (<role>): <value> -> <value+1> -- <cost> qumatessence`, same afford/dim treatment.
  - Both tabs' rows start at `panelY - 8`, spaced `36`px apart, buying/upgrading rebuilds
    the whole panel so the list updates and the token total on display stays correct.
- Below the (variable-length) tab content, a single "Farewell" button
  (`renderFarewellFooter`) flowing right after the content rather than pinned to a fixed
  y -- Noether's own panel never offers "Face the Rival"/"Continue to World N+1"; that
  action lives only in the goal panel (see "The rival gate" below), since the goal tile is
  where that world's boss actually stands. Bloch's panel (below) reuses this same
  tab-content/single-footer layout.

## Bloch in the overworld (`OverworldScene.showBlochHub`)

- World 2 only, standing at the middle tile like every other guardian -- same
  landmark/wander/re-open pattern as Noether (see above), just with `art/bloch.ts`'s
  `makeBlochAvatar` and a cyan
  (`0x8fe8ff`) name label. His avatar swaps Noether's halo/head for a wireframe **Bloch
  sphere** (equator + two tilted meridian ellipses, additive-blended, slowly spinning) with
  a bright state-vector arrow pointing off-axis -- a superposition, not a pinned-down state,
  matching his teleport ability -- plus three small orbiting `◇` waypoint marks instead of
  Noether's `✦` motes.
- His panel (`showBlochHub`) is stroked teal (`0x4adde0`) and reuses the same tab-content/
  footer shape as Noether's shop, minus the tabs -- one button per world the player has
  visited (`visitedWorlds`) that also has a built map (`BUILT_WORLDS`), excluding the
  current world. Each destination is its own one-time unlock: a world not yet in
  `registry`/save `blochUnlockedWorlds` is labeled `Travel to World N -- <name> (15
  qumatessence)`, dimmed if unaffordable (same afford/dim treatment as every other
  guardian shop); clicking it while affordable deducts the cost, adds that world number
  to `blochUnlockedWorlds`, and teleports there in the same click (`advanceToWorld`, no
  battle). A world already in that list drops the cost suffix entirely -- `Travel to
  World N -- <name>` -- and teleports for free. Empty state: "You haven't mapped
  anywhere else yet." Destinations paginate (see "Paginated candidate lists" below) once
  there are more than fit on one page -- routine in Superposition Mode, which pre-seeds
  every built world as visited, makes Bloch's hub the *sole* way to move between worlds
  (there is no separate warp panel), and treats every destination as already unlocked so
  a fresh Superposition save can still teleport anywhere with zero qumatessence.

## Dresselhaus in the overworld (`OverworldScene.showDresselhausPanel`)

- World 3 only, standing at the middle tile like every other guardian, and his panel
  auto-opens on reaching that row (`maybeAutoOpenMiddleDialogue`), same as every
  other guardian. Teal-green (`#6ee8ba` label / `0x4ad9a0` stroke and avatar accents) name
  label; his avatar (`art/dresselhaus.ts`'s `makeDresselhausAvatar`) swaps the head motif
  for a ring of six small spin arrows, each rotated tangent to its own position on the
  ring (a hedgehog-like winding, the spin texture a Dresselhaus/Rashba-split band actually
  traces in momentum space) rather than a face, slowly rotating.
- His panel is a single paginated list, not the tab-content/footer shop shape -- every
  defeated wild material (`defeatedMaterials`, sliced to the most recent 3, or in
  Superposition Mode every non-hybrid crystal in the game -- `data/materials.ts`'s
  `allCrystals()` filtered through `isHybridMaterial`) gets a button. Each crystal is its
  own one-time unlock: one not yet in `registry`/save `dresselhausUnlockedCrystals` reads
  `Become <name> (25 qumatessence)`, dimmed if unaffordable; clicking it while affordable
  deducts the cost, adds that crystal's name to the list, and transmutes in the same
  click (`transmuteInto`). An already-unlocked crystal drops the cost suffix -- `Become
  <name>` -- and transmutes for free; whichever crystal the player is already wearing
  shows as a dimmed `<name> (current form)` instead, same as before. Transmuting swaps
  color/variant/moveset only -- HP is never intrinsic to a crystal form, it's `wildHpForWorld`
  for whichever world the player will actually resume into -- and immediately redraws the
  overworld avatar (`redrawPlayerCrystal`). Empty state: "You haven't
  defeated any crystals yet -- there is nothing to become." Paginates once the list is
  longer than one page (see "Paginated candidate lists" below) -- the common case in
  Superposition Mode, which also treats every crystal as already unlocked -- ending in a
  single "Farewell" button, no separate footer row.

## Laughlin in the overworld (`OverworldScene.showLaughlinPanel`)

- World 4 only, standing at the middle tile like every other guardian. Blue-violet
  (`#8fa0ff` label / `0x6a7fff` stroke and avatar accents) name label; his avatar
  (`art/laughlin.ts`'s `makeLaughlinAvatar`) is unchanged by this mechanic.
- No tabs, two runs of rows instead of one flat list (`panels/tunableMoveShop.ts`'s
  `renderTunableMoveShop` -- Skłodowska-Curie's shop below does *not* reuse this, her
  per-class-unlock pricing is different enough that her panel is bespoke) -- still-unbought
  quiz-gated moves
  (`data/materials.ts`'s `ANALYTIC_MOVE_IDS`, a hardcoded pair, `skyfallBeam`/`groundEruption`),
  same `<move name> -- <cost> qumatessence` label and afford/dim treatment as Noether's Moves
  tab (reusing `shopCost`), followed by one row per already-bought move showing which
  quasiparticle it's tuned to: "`<name>` -- tuned to `<quasiparticle>` (retune)", or if the
  player has since transmuted into a form that can no longer host the saved assignment,
  "`<name>` -- tuned to `<quasiparticle>`, reverted to Phonon (this form can't host it --
  retune)" -- the fallback reads the bare quasiparticle noun (`quasiparticleLabel`), not the
  move's own shape word, or "`<name>` -- untuned (pick a quasiparticle)" if never assigned --
  `<name>` here is `tunedMoveDisplayName`, so a tuned move's own row already reads like "Magnon
  Lance -- tuned to Magnon (retune)" rather than the untuned default "Phonon Lance." Empty state once
  both are bought: "You already carry every analytic technique I can teach." Clicking either
  an unbought move's buy row or a learned move's tune/retune row opens
  `showMoveClassPicker`, a sub-panel titled "Which quasiparticle should `<name>` carry?"
  listing `TUNABLE_MOVE_CLASSES` filtered down to whatever the player's *current* form can
  host (`canHost`) as its own column of buttons (same button styling as the shop list, just
  a different button set) -- each labeled with the quasiparticle's own bare name
  (`quasiparticleLabel`, e.g. "Magnon" for `'magnon'`) rather than the class id or the
  matching ordinary move's own full name. Picking one on an unbought move completes the
  purchase; on an already-bought move it just re-saves the assignment, free.
- **The move's displayed name always leads with its current quasiparticle**
  (`data/materials.ts`'s `tunedMoveDisplayName`) everywhere a move name shows up in battle
  too -- the move-menu button, the analytic-question panel's title, the battle log's "X used
  `<name>`!" line -- built from the quasiparticle's own bare label (`quasiparticleLabel`, e.g.
  `Magnon` for `'magnon'`) plus each move's fixed shape word ("Lance"/"Eruption") rather
  than a second hand-authored word list, so `skyfallBeam` tuned to `'magnon'` reads as
  "Magnon Lance," `groundEruption` tuned to `'chargedAnyon'` as "Anyon Eruption," and so on. An
  untuned move defaults to `'phonon'`, reading as "Phonon Lance"/"Phonon Eruption."

## Majorana in the overworld (`OverworldScene.showMajoranaPanel`)

- World 5 only, standing at the middle tile like every other guardian. Green (`0x4fd97a`)
  name label and panel stroke; his avatar (`art/majorana.ts`'s `makeMajoranaAvatar`) is
  unchanged by this mechanic.
- His panel reuses the paginated-list shape Dresselhaus's panel uses, but with a
  two-step flow instead of one screen: every defeated wild material (or, in Superposition
  Mode, every crystal in the game) *that pairs with at least one of the others* gets a
  button at the first step (any pairing with no matching entry in `data/materials.ts`'s
  `HYBRID_RECIPES` -- keyed by parent name, not main type, so a same-type pair can still
  be valid if a named recipe covers it -- is filtered out before it ever renders); picking
  one is always free (just a browse) and asks "Combine `<first>` with..." at the second
  step, re-listing only the remaining candidates that pair with it specifically. Each
  partner at this second step is its own one-time unlock, keyed by the *result* the pair
  would produce: a result not yet in `registry`/save `majoranaUnlockedResults` labels its
  row `<partner> (60 qumatessence)`, dimmed if unaffordable; picking it while affordable
  deducts the cost, adds the result's name to the list, and fuses in the same click. An
  already-unlocked result drops the cost suffix -- just `<partner>` -- and fuses for
  free. A "Never mind" (to back out to the first step) shares one row with the panel's
  own Farewell button at this second step (side by side, the same convention the goal
  panel's Farewell/Continue footer uses) rather than stacking two separate footer rows.
  Both steps paginate (see "Paginated candidate lists" below) once the filtered list is
  longer than one page. Picking a partner immediately transmutes the player into the
  recipe's own named result (`data/materials.ts`'s `combineMaterials` -- name/type/moves all
  fixed on the recipe, not computed at combine time) the same way Dresselhaus's
  transmutation does -- no separate "confirm" step, and no memory of earlier fusions to
  instantly re-become either -- every visit starts the two-step pick fresh. Empty state (no
  valid pairing among the
  candidates -- including having fewer than 2 total): "None of the crystals you've defeated
  pair into a known hybrid recipe yet -- Majorana only knows specific real pairings (e.g.
  Aluminum + Indium Arsenide, or two Graphenes together)." Superposition Mode treats every
  result as already unlocked.

## Anderson in the overworld (`OverworldScene.showAndersonPanel`)

- World 6 only, standing at the middle tile like every other guardian. Rust/amber
  (`0xc9884a`) name label and panel stroke; his avatar (`art/anderson.ts`'s
  `makeAndersonAvatar`) swaps the head for a scattered, irregular lattice of dim dots with
  one bright point pulsing at the center -- Anderson localization's own picture, a wave
  trapped by disorder instead of spreading freely -- rather than any other guardian's motif,
  plus four orbiting `×` glyphs instead of Noether's `✦` or Bloch's `◇`.
- The panel follows the same two-step flow as Majorana's: every defeated
  wild material (or, in Superposition Mode,
  every crystal in the game) that isn't a hybrid (`isHybridMaterial`) gets a
  button under "Dope in which crystal?" (paginated, see below); picking one is always
  free (just a browse) and asks "Learn
  which move from `<host>`?" at the second step. Each learnable move here is priced by
  whether the *host* is unlocked, not the move: while `<host>` isn't yet in
  `registry`/save `andersonUnlockedHosts`, every one of its rows reads `<move name> (Pwr
  N) (35 qumatessence)`, dimmed if unaffordable; picking one while affordable deducts the
  cost, adds the host's name to the list, and learns that move in the same click. Once a
  host is unlocked, its rows drop the cost suffix -- `<move name> (Pwr N)` -- and learning
  any of its moves (now or later) is free. A "Never mind" (to back out to the first step)
  shares one row with the panel's own Farewell button at this second step (side by side,
  the same convention the goal panel's Farewell/Continue footer uses) rather than
  stacking two separate footer rows. Picking a move
  appends it to the ordinary `unlockedMoves` list (`learnImpurityMove`) -- no form
  change, no HP change, unlike Dresselhaus/Majorana. Empty states: "You
  haven't defeated any original crystals yet -- there is nothing to dope in" (no host
  candidates) or "You already
  carry every move `<host>` has to offer" (host picked, but every one of its moves is
  already learned). Superposition Mode treats every host as already unlocked.

## Feynman in the overworld (`OverworldScene.showFeynmanPanel`)

- World 7 only, standing at the middle tile like every other guardian. Amber (`#ffa64a`
  label / `0xffa64a` stroke) name label -- the same amber the world's earlier guardian
  used, free to reuse once nothing else in the roster claims it. His avatar
  (`art/feynman.ts`'s `makeFeynmanAvatar`) breaks from every other guardian's
  floating-robed-figure silhouette on purpose: no cloak/robe fill at all, just a loose
  humanoid lattice of bright vertex points connected by straight propagator lines, two
  small pulsing loop-insertion circles along the torso/hip lines (the diagrammatic mark
  of a higher-order correction), and four small vertex dots orbiting in place of another
  guardian's orbiting glyphs.
- A single paginated move list (`renderPagedButtons`, `scene.feynmanPage`) rather than a
  fixed-row shape -- every move the player has ever unlocked (`getUnlockedMoves`, not
  `getBattleMoves`: a move currently unusable in the player's present form is still
  worth leveling for later) gets its own row reading `<name> -- level to "<next tier>"
  (streak <N>): <cost> qumatessence`, or `<name> -- max level` once already at
  tier 3; a maxed or unaffordable row dims and is a no-op, the same convention every
  other guardian's unaffordable/unusable row already uses.
- Clicking an eligible row deducts `feynmanLevelCost` immediately (the qumatessence is
  spent the instant the attempt starts, not on a successful outcome) and opens the
  question streak in its own sub-panel -- same amber stroke as the main panel, one
  question at a time (`data/quiz.ts`'s `getAnalyticQuestions`), two shuffled answer
  buttons per question, the same shape `OverworldScene.showEncounter`'s pre-battle quiz
  and BattleScene's own Analytic/Ultimate question panels use. Answering the whole
  streak correctly writes the new level and returns to the main panel; missing any
  single question also returns to the main panel, level unchanged -- the qumatessence
  already spent is never refunded either way, so this sub-panel offers no "cancel": once
  started, the payment is already made.

## Kondo in the overworld (`OverworldScene.showKondoPanel`)

- World 8 only, standing at the middle tile like every other guardian. Rust-orange
  (`0xe86a44`) name label and panel stroke -- distinct from Anderson's own rust/amber
  (`0xc9884a`) above; his avatar (`art/kondo.ts`'s `makeKondoAvatar`) is unchanged by this
  mechanic.
- Same two-runs-of-rows shape as Laughlin's panel above: still-
  unbought moves from `data/materials.ts`'s `KONDO_MOVE_IDS` (Screening Pulse, Scattering
  Drag, Coherence Cascade), usable from any form, same `<move name> -- <cost>
  qumatessence` label and afford/dim treatment as Laughlin's/Noether's shops (reusing `shopCost`),
  each followed by its own one-line `description` underneath in the same dimmer blue-grey
  Franklin's own passive rows use (`renderPassiveList`) -- then one row per already-bought
  Kondo move, its own description printed the same way. A bought-and-inactive move reads
  "Make `<name>` active" as a clickable button, the currently active one (registry/save
  `kondoActiveMove`) reads "`<name>` (active)" dimmed to 50% alpha with no click handler,
  the same dimmed-current treatment Dresselhaus's "`<name>` (current form)" row uses. Buying
  the first Kondo move activates it immediately (still shows the dimmed "(active)" tag right
  away, no separate click needed); buying a second or third afterward doesn't, and switching
  which one is active always requires reopening this panel and clicking "Make active," not a
  per-turn choice in the battle move menu. None of the three self-buff moves is gated by a
  crystal's own physics at all, so all three are always for sale until bought -- no empty/
  wrong-form state to render here, unlike Noether's shop.

## Franklin in the overworld (`OverworldScene.showFranklinPanel`)

- World 9 only, standing at the middle tile like every other guardian. Lavender
  (`#c9a8e0` label / `0xa878c9` stroke and avatar accents) name label; her avatar
  (`art/franklin.ts`'s `makeFranklinAvatar`) swaps the head for a disordered lattice of
  scattered sites surrounded by concentric diffraction rings -- porous/amorphous carbon's
  own X-ray diffraction pattern made literal -- in a dusty amethyst/lavender palette
  distinct from Anderson's rust/amber despite the shared defect/disorder theme.
- Buy-list-plus-switch shape (`renderPassiveList`, shared with Kondo's own panel above's
  buy/switch treatment): a still-unbought passive (`data/passives.ts`'s
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
  own physics at all, so all three are always purchasable.

## Skłodowska-Curie in the overworld (`OverworldScene.showSklodowskaCuriePanel`)

- World 10 only, standing at the middle tile like every other guardian -- the last one the
  player reaches. Olive (`0xc9d84a`) name label and panel stroke, carried over from the
  Curie identity's own palette; her avatar (`art/sklodowskaCurie.ts`'s
  `makeSklodowskaCurieAvatar`) keeps that identity's crystal-shard-with-a-pulsing-ring head
  motif but adds an outer halo ring and a denser eight-point starburst orbit (double the
  usual four) befitting the guardians' own capstone rather than a mid-game stop.
- One row always shown per Ultimate move (`data/materials.ts`'s `ULTIMATE_MOVE_IDS` --
  `ultimateMeteor`/`ultimateNova`), not a forSale/learned split the way Laughlin's shop
  renders -- there's no separate "buy the move" step here, since opening the class picker
  and paying for a class is itself what first unlocks the move. Each row names the move's
  current quasiparticle (`tunedMoveDisplayName`) or reads "not yet unlocked (pick a
  quasiparticle)" if the move isn't in `unlockedMoves` yet. Clicking a row opens the same
  "Which quasiparticle should `<name>` carry?" sub-panel Laughlin's shop uses, but each row's
  cost reads "Free (already unlocked)" for a class already paid for on that move, else
  "1000 qumatessence" for one that isn't -- unlike Laughlin's flat one-time move purchase, the
  cost here is per (move, quasiparticle class) pair.
- Using an Ultimate move in battle opens `BattleScene.showUltimateQuestions` instead of
  `showAnalyticQuestion` -- up to three sequential question panels, same visual family as
  the Analytic question panel below, tagged `★★★` in the move menu instead of `★`, with
  its own "3/3 correct or it whiffs" legend line. Landing a 3-for-3 hit plays a
  multi-phase "summon" animation dramatically longer than any other move's effect (see
  "Attack effects" below) rather than the shared windup/travel/impact beat every other
  move uses.

## Paginated candidate lists (`OverworldScene.renderPagedButtons`)

- Shared by every panel whose candidate pool can outgrow one screen -- Dresselhaus's transmute
  list, both steps of Majorana's and Anderson's combine/dope flows, and Bloch's destination
  list. Superposition Mode is what makes this routine rather than a rare edge case: its
  candidate pool is every crystal in the game (or, for Bloch, every built world pre-marked
  visited), commonly 8-30+ entries where the equivalent Story Mode list is a handful.
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
  per-page cap would overflow Bloch's hub at the *default* text-size preset (1.5x, not
  1x) once Superposition Mode made a 9-destination list the common case; sharing one row
  for Prev/Next/the page label (above) reclaims the vertical room a two-row layout spent
  on chrome rather than content, margin that matters most for a guardian whose avatar/
  intro text already leaves little slack at the largest preset. Packing itself runs
  twice: once assuming the whole list fits on a single page (no Prev/Next row needed at
  all), and only if that doesn't hold does a second pass reserve room for that row too --
  a short candidate list that genuinely fits together on one page shouldn't be split in
  two just because a reservation assumed controls it turns out not to need -- verified
  with no overflow at every font-scale preset via the headless-Chromium harness (see
  DEVELOPMENT.md's "Verifying UI changes" section).
- Majorana's and Anderson's second step (partner/move pick) also renders a "Never mind"
  cancel row to back out to the first step -- this shares one row with the panel's own
  Farewell button (side by side, the same left/right convention the goal panel's own
  Farewell/Continue footer uses) rather than stacking as two separate rows, since this
  step already carries more chrome (avatar, intro, a second-step label, the paginated
  list itself) than any single-step panel does.

## Boss avatars (`OverworldScene.spawnBossSprite`, `art/boss.ts`)

- Every built world's rival/boss, while still undefeated, stands at the goal
  tile as a purely visual landmark, sized `BOSS_CRYSTAL_SIZE = 70` -- roughly 2x
  a wild crystal (`22`) and 2x the player's own on-map size (`34`) -- and
  rendered by `makeBossCrystal` rather than the shared `makeCrystal` every
  wild/rival crystal otherwise uses: a golem silhouette that literalizes each
  rival's own name (rivals 1-8 and World 9's per-type lookup, `WORLD_RIVALS`/
  `RIVAL_9_NAMES` in `data/materials.ts`, each name a real compound's
  *polycrystalline* form -- "many grains fused into one mass") built from
  seven smaller limb shards (shaded siblings of the core's
  color, via `shade`) -- a head, two shoulder/arm shards, two smaller fist
  shards past them, and two planted leg shards -- fused around one oversized
  torso core, a two-layer additive aura that slowly pulses scale/alpha, and
  six hot-orange embers tracing a tall ring around the whole body (same
  orbiting-container-angle-tween trick as a guardian avatar's orbiting motes,
  just warmer/redder to read as hostile rather than benevolent). Name label in
  a bold, warning-toned pink-red (`#ff8f8f`), distinct from any guardian's own
  label color. Reuses the
  `WorldSprite` projection/wander/bob machinery, so it scrolls and fades with
  distance like everything else standing on the map -- it doesn't add its own
  click handler, the fight is still only reached through the goal panel's
  "Face the Rival" button. `makeBossCrystal`'s core/limb color and variant
  come from the boss `Material`'s own `color`/`variant` (`TYPE_LOOK[type]`), so
  World 9's boss -- the one rival with no fixed type, DESIGN.md §2 -- looks
  different depending on which `MaterialType` got rolled for that playthrough,
  same as every other world's boss reads off its own fixed type. Once that
  world's rival is beaten, this avatar stops spawning and a world door (below)
  takes over the goal tile instead.

## World doors (`OverworldScene.spawnDoorSprites`, `art/door.ts`)

- Every built world has a doorway landmark at its `startTile`, sized
  `DOOR_SPRITE_SIZE = 46` -- bigger than the player (`34`) so it reads as a real
  structure, well under the boss (`70`) it can share a world with. Rendered by
  `makeDoorSprite`: a genuinely rectangular stone archway (a small corner
  radius, not one close to the shape's own half-width, so it doesn't collapse
  into a pill/gem silhouette), a darker inset "opening" void, a lavender
  (`0xd9a5ff`) glowing portal filling that opening with a couple of orbiting
  white motes (the same "something is happening here" cue a guardian avatar's
  orbiting motes give), and a wide, faint additive halo behind the whole thing
  so it still reads as a colored beacon once shrunk small by distance -- the
  same trick the boss's own aura uses. Lavender matches `showStoryBeat`'s own
  between-worlds panel stroke, the color already established for "connective
  tissue between worlds." Once that world's rival is beaten, a second door of
  the same look spawns at `goalTile` too, replacing the boss avatar there.
  Reuses the `WorldSprite` machinery like every other landmark -- no click
  handler of its own; walking onto either tile is what opens the actual
  confirm/gate panel (`OverworldScene.showStartDoorPanel`/`showGatePanel`).
  Name label underneath reads "Door to the Lab" or "Door to World N" (start
  door) and "Door to World N" or "The way is open" for World 10 (goal door,
  matching `renderShopFooter`'s own last-world label), same small
  dark-background label treatment every other landmark uses, text in the same
  lavender (`#e6d9ff`) family as the portal glow rather than a guardian's own
  label color or the boss's warning pink-red. The start-door sprite itself
  stands one row north of its own trigger tile (`startTile`), not on top of
  it -- the forward-facing camera never renders anything behind the player's
  current row, so drawing it exactly on `startTile` would only ever be
  visible stacked under the player's own crystal; a row ahead puts it
  visibly in front of the player at spawn and again on every walk back down
  to the start row.

## The start-door confirm panel (`OverworldScene.showStartDoorPanel`)

- Walking onto the start-door tile (tile-exact, not "anywhere on that row" --
  `OverworldScene.maybeReachStartDoor`) opens a small panel rather than
  switching worlds immediately, so brushing the tile while exploring a
  dead-end branch near the south edge can't backtrack the player by accident.
  Same dark rounded-rectangle-with-stroke treatment as every other overworld
  dialogue (`480×`variable, sized to content), stroked lavender (`0xd9a5ff`) to
  match the door sprite and `showStoryBeat`'s panel. One line of flavor text
  ("A doorway leads back to World N-1"/"...to the Lab"), then two buttons side
  by side: "Not yet" (closes with no scene change, same as `closeDialogue`
  everywhere else) and "Return to World N-1"/"Return to the Lab", which calls
  `returnToPreviousWorld`. Never a one-shot -- walking onto the door always
  reopens this panel, since the confirm step itself (not a "seen it once"
  flag) is what keeps an accidental brush from becoming a real backtrack.

## The world-entry lore screen (`OverworldScene.showWorldLore`/`renderWorldLorePage`)

- The first time a save enters a world, before the player can otherwise interact with
  it (right after `recordVisit` in `create()`, ahead of the goal/middle auto-dialogues
  and the `'controls'` tutorial tip if more than one is due on the same entry -- it's
  the more establishing content), a two-page history panel plays from
  `data/worldLore.ts`'s `WORLD_LORE`, gated by `hasSeenWorldLore`/`markWorldLoreSeen`
  against its own `worldLoreSeen` save field. Same dark rounded-rectangle-with-stroke
  treatment as every other overworld dialogue, near-full-canvas width (`CANVAS_W - 40`),
  stroked lavender (`0xd9a5ff`) to match `showStoryBeat`'s and the start-door panel's
  own "connective tissue between worlds" convention. Heading is the world's name
  (`WORLD_NAMES`); each page is laid out top-down (title, then body, then a button) with
  the panel's background sized to the real content height afterward, the same idiom
  `renderTutorialTipPopup` uses. Page 1 ends in a "Next ->" button that destroys and
  rebuilds the panel showing page 2; page 2 ends in "Onward," which marks the world
  seen, persists, and closes the dialogue. The title and body font sizes are capped at
  `Math.min(fontScale(this), 1.5)` rather than scaling all the way to the Settings
  panel's 2x "Large" preset -- the same fixed-budget problem `BattleScene.drawMoveMenu`'s
  own `chromeScale`/`headerScale` caps solve, since this panel's multi-paragraph prose is
  long enough that uncapped 2x text overflows the canvas's fixed height on the longer
  entries (worlds 9/10).

## The rival gate (`OverworldScene.showRivalEncounter`/`renderRivalTauntPage`)

- Triggered by clicking "Face the Rival ->" in the goal panel (`showGatePanel`), not
  automatically on reaching the goal and not from any guardian's own panel -- so the player
  can walk past the goal to shop with Noether or any other guardian before ever facing the
  fight they're being gated on. Same 600-wide panel treatment as a wild encounter (centered
  crystal, italic line beneath), but stroked in red (`0xff6666`) instead of blue-grey or
  gold. The taunt is two pages, chained the same destroy-and-rebuild way the world-entry
  lore screen above is: `data/worldLore.ts`'s `RIVAL_TAUNTS` supplies `part1` (rendered with
  a "Next ->" button) and `part2` (rendered with the mandatory "Battle!" button -- no "let me
  pass," since a gate that can be skipped isn't a gate); a world with no `RIVAL_TAUNTS` entry
  falls back to a single generic line instead. The boss crystal is redrawn on both pages
  (`art/boss.ts`'s `makeBossCrystal` at `BOSS_CRYSTAL_SIZE`, `OverworldScene.ts`'s own copy
  of `70`), the same golem silhouette the rival already renders as standing at the goal tile
  (`spawnBossSprite`) and as the battle opponent (`scenes/BattleScene.ts`'s own
  `BOSS_CRYSTAL_SIZE`) -- not the plain faceted `makeCrystal` an ordinary wild encounter uses,
  so the rival never reverts to looking like an ordinary crystal just because this dialogue is
  open. The crystal's vertical position is set with enough headroom below the panel's top edge
  for `makeBossCrystal`'s translucent danger aura (which pulses out to `size*1.4*1.18`, well
  past the bare `BOSS_CRYSTAL_SIZE` footprint) to stay inside the panel through its full pulse,
  the same "decorative aura outgrows the crystal's own footprint" fact `BattleScene`'s boss
  placement below already accounts for. The taunt text's own font size is capped the same way
  the world-entry lore screen's is, for the same reason (worlds 9/10's longer taunts would
  otherwise overflow the canvas at the Settings panel's 2x preset). Losing doesn't set anything
  back except the token stake (see Stakes in DESIGN.md §4): the goal panel simply reopens and
  "Face the Rival ->" is still there to retry.

## Boss opponent in battle (`scenes/BattleScene.ts`)

- A rival fight's opponent renders with `art/boss.ts`'s `makeBossCrystal` at
  `BOSS_CRYSTAL_SIZE = 64` -- bigger than an ordinary wild encounter's plain
  `makeCrystal` at `50` -- positioned at `BOSS_OPPONENT_POS` (`{ x: 644, y: 155 }`,
  shifted left and slightly down from the wild encounter's `OPPONENT_POS`) so the
  wider multi-shard silhouette (plus its decorative halo/shard art, which renders
  well past the bare `BOSS_CRYSTAL_SIZE` footprint) sits comfortably inside the
  field, clear of the "Turns" preview widget in the opposite corner. The move
  menu (`MENU_MIN_TOP`, below) is floored well below this cluster regardless of
  page/text-size, so the two can never collide even though both occupy the
  field's right half. Same look the boss already has standing at its world's goal
  tile in the overworld (`OverworldScene.spawnBossSprite`), carried into the fight
  itself rather than switching to the plain crystal look every wild battle uses.
  Attack effects (`playAttackEffect`'s `from`/`to`) target this shifted position too
  (`BattleScene.opponentPos`), not the wild encounter's fixed `OPPONENT_POS`, so
  bolts/rings/bursts still travel to and from where the crystal actually is.

## Battle status effects (`scenes/BattleScene.ts`)

- Answering the pre-encounter question correctly wraps the player's crystal in a "super
  saiyan"-style golden aura: a soft additive-blended glow fill, two pulsing rings, a ring of
  ten radiant spikes slowly rotating around the crystal, and small embers rising and fading
  above it. All pieces use `Phaser.BlendModes.ADD` so they actually glow (brighten what's
  behind them) instead of reading as flat gold shapes. Answering wrong instead droops a
  small grey raincloud (`addFailCloud`) just above the crystal, bobbing gently. Everything
  is added directly to the player crystal's container so it moves with the existing
  idle-bob tween for free.
- Kondo's Shielded/Evasive/Regenerating self-buffs (DESIGN.md §4) get a much smaller
  treatment than the quiz aura/raincloud above -- a plain text pill (`playerStatusLabel`/
  `opponentStatusLabel`) docked just under that side's HP bar rather than anything layered
  onto the crystal itself, reading `"<Buff> (<turns left>)"` in Kondo's own rust-orange
  (`#ff8f6a`, matching his guardian label/panel stroke and the `'screening'` attack-effect
  color below) over the same translucent-black tag background every HP-bar name label
  already uses. Empty (no active buff) by default on both sides -- the pill only ever
  reads as chrome that appears when relevant, not a permanent fixture of the HP-bar area.
- Franklin's active passive (DESIGN.md §5) gets its own pill directly below that
  side's status pill, same size/background/depth as the status pill but in a muted
  blue-violet (`PASSIVE_PILL_COLOR`, `#8fa0ff` -- its own fixed constant, not derived from
  her own label color) rather than Kondo's
  rust-orange, so an always-on passive reads as visually distinct from a ticking status at a
  glance. Reads as the joined name(s) of whichever passive(s) are active (`·`-separated,
  ready for a future second passive owner to stack onto the same line), empty by default the same way the
  status pill is. Its horizontal position is clamped back onto the field if the joined text
  would otherwise run past the canvas edge at the largest text-size setting -- clamped
  against `MENU_X` rather than the canvas edge on the player's side, since the move menu is
  bottom-anchored and shares that side's vertical band for the whole battle (`MENU_MIN_TOP`,
  below); if the stack of rows above it (boost/fail note, the name+bar row, status pill)
  leaves no vertical room left for it at that same setting, it's simply omitted for that
  battle rather than drawn overlapping the
  status pill above it -- the status pill's own readability takes priority.
- The "A wild X appeared!" opener and the win/lose closing line are flavor text from
  `data/greetings.ts` (`victoryLine`/`defeatLine`), keyed to the wild material's type the
  same way the overworld encounter greeting is. A rival fight swaps the opener for "X blocks
  the way onward!" (no "wild") but reuses the same victory/defeat lines.
- Every combat-log update goes through `BattleScene.setLogText`, which clamps the text
  upward just enough to keep it on screen rather than sitting at a fixed y regardless of how
  many lines it wraps to. A one-line per-turn message rests at the usual bottom-anchored spot
  (`20, LOG_Y = 440`); a message that wraps to two lines (e.g. a quasiparticle-mismatch hit's
  "No natural defense against this!" suffix) gets nudged up just enough to keep its second
  line on screen. The end-of-battle summary reuses the same helper with a much higher ceiling
  (`20, 210`) since it runs several lines longer once the physics blurb (`data/materialdex.ts`'s
  `materialBlurb`) is appended after the flavor/token lines.
- Per-turn log text appends "No natural defense against this!" when the quasiparticle
  mismatch multiplier fires (`BattleScene.resolveHit`, the sole type-interaction rule in
  battle -- see DESIGN.md §3/§4), then "A coherent critical hit!" for a crit -- up to two
  clauses can stack on one line, in that fixed order.

## Turn-order preview (`BattleScene.drawTurnPreview`)

- A small "Turns" widget docked in the field's top-left corner (`x = 20, y = 8`), clear of
  both HP-bar columns and the log text further down: a dim blue-grey (`#8fa0c9`, matching
  the move menu's own section-header color) "Turns" label over the usual translucent-black
  tag background, with a row of five 24px crystal icons (`makeCrystal`, 28px spacing) below
  it, one per predicted hit: the player's own current crystal or the opponent's, each using
  that side's real `color`/`variant`/`seed`/`hybridParents`. Each icon also carries a ring
  behind the crystal shapes marking whose hit it is, independent of crystal color -- a bold
  full-opacity gold ring (`0xffe066`, 3px stroke, this project's established active/highlighted
  accent color) for the player's hits, a faint blue-grey ring (`0x8fa0c9`, 1.5px stroke, 45%
  alpha -- the same dim "inactive" tone the shop's inactive tab uses) for the opponent's, so the
  row still reads at a glance in a same-material matchup (routine from world 9 onward) where
  the crystal colors themselves are identical. Always the plain `makeCrystal` look on the
  opponent's side, even in a rival fight where the on-field opponent itself renders bigger via
  `makeBossCrystal` (see "Boss opponent in battle" below) -- a boss's wider multi-shard
  silhouette wouldn't read at 24px, so the icon
  stays the ordinary single-shape crystal look rather than trying to match the boss art.
- The row previews the next five hits in order (DESIGN.md §4's velocity multi-hit rule):
  the faster side's icons repeated `fasterHits` times, then the slower side's icon once,
  tiled out to five. It's a best-effort look-ahead, not a guarantee -- it assumes ordinary
  moves keep getting picked, so an Ultimate/Analytic pick (exempt from the multi-hit scaling)
  or one of Kondo's self-buff moves (always resolves as a single action for its round, see
  `playerAttack`) can make the actual round diverge from what it showed; the widget carries no
  disclaimer text for this, since it's still an accurate read of "if nothing changes."
- Redrawn once in `create()` and again every time a round actually finishes (right where
  `turnLock` releases).

## Battle move menu (`BattleScene.drawMoveMenu`)

- A docked panel at the field's bottom-right (`width = MENU_WIDTH = 226`, `x = MENU_X =
  FIELD_W - 8 - MENU_WIDTH`), same dark rounded-rectangle-with-stroke treatment as the
  overworld's dialogue panels, stroked gold (`0xffe066`) to match Noether's own panel color,
  titled "MOVES" in bold gold. Its bottom edge is fixed (`FIELD_H - MENU_BOTTOM_MARGIN`) and
  its top edge (`menuTop`) is derived fresh on every draw from however tall the current
  page's content actually is, so the panel visibly grows *upward* from that fixed bottom
  rather than down from a fixed top -- it reads as bottom-right-docked at every page/section
  instead of just starting high and getting taller. `MENU_MIN_TOP` floors how far up that
  growth is ever allowed to reach, comfortably below the opponent's crystal in every case
  (including a rival fight's bigger, wider boss silhouette, whose rendered bounds reach a
  measured ~223px including its decorative halo/shard art) so the panel and the opponent's
  cluster can never collide regardless of how tall a page's content gets at the largest
  text-size preset.
- **Grouped into up to four move-kind sections (`ATTACKS`/`ANALYTIC`/`ULTIMATE`/`BUFFS`),
  shown one
  page at a time** (DESIGN.md §4): a small bold blue-grey (`#8fa0c9`) header line reading the
  section's label sits above that page's own rows, with a `(i/N)` page count appended once
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
  Phonon Beam is universal) shows "No usable moves" instead of an empty panel. Laughlin's two
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
  title/legend (`headerScale = Math.min(fontScale, 1.15)`, 10px label / 8px legend sub-line
  at that scale), and the pager arrows render a size above that (`13 * headerScale`) --
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
  doesn't grow rows past a sensible size just because the budget has slack. Because the page
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
  than Laughlin's own blue-violet shop stroke). Move name in
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

## The Lab's Moves/Stats/Abilities/Guardians stations (`scenes/panels/hubStations.ts`'s `showMovesPanel`/`showStatsPanel`/`showAbilitiesPanel`/`showGuardiansPanel`)

- All four use the same dark rounded-rectangle-with-stroke panel treatment as everywhere else,
  stroked blue-grey (`0x8fa0c9`, distinct from every guardian/encounter panel's own stroke
  color) except Guardians (see below). Each is its own station button on the Lab floor (see
  "The Hub" above), not a row in a shared menu -- clicking one is a no-op while another panel
  is already open.
- "Moves"/"Stats" share a generic info panel (`showInfoPanel`, `560` wide, same blue-grey
  stroke). Moves lists only the moves actually usable right now (`getBattleMoves` -- learned
  moves intersected with what the current crystal form's physics can host, §3) as plain
  `<name> -- Pwr N` lines (name and power both reflecting any Feynman level via
  `moveDisplayName`/`effectiveMovePower`), no move-class label and no "incompatible" entries
  cluttering the list; Stats lists Quantumness/Velocity/Correlation plus qumatessence and
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
- "Guardians" (`showGuardiansPanel`, `600` wide, stroked lavender `0xb98fea`) lists every met
  guardian as its own row (`OverworldScene.guardianRoster()`, filtered by registry
  `metGuardians`, or every guardian at once in Superposition Mode); a row click opens that
  guardian's own bespoke panel (shop/teleport hub/transmutation, in that guardian's own stroke
  color per CODEMAP.md's panel-color list, not the Guardians list's lavender) directly in the
  Lab, replacing the lavender list panel in place -- the same panel the player would see by
  walking up to that guardian mid-world (see "Guardians, economy, and story arc" in DESIGN.md
  §5). The player's world/scene/position never changes just from opening a guardian's panel this
  way; Bloch's own panel is the one guardian panel with an explicit travel action (its
  destination rows), which still moves the player like any other deliberate warp.

## Settings station (`scenes/panels/hubStations.ts`'s `showSettingsPanel`)

- Same blue-grey (`0x8fa0c9`) stroke as the Lab's other reference stations, sized
  `(CANVAS_W - 60)` wide with height grown to fit. Three rows -- "Enemy Density: `<preset>`"
  (`data/settings.ts`'s `DENSITY_PRESETS`, Low/Normal/High/Very High), "Text Size: `<preset>`"
  (`FONT_SCALE_PRESETS`, Compact/Normal/Large), and "Music Style: `<preset>`"
  (`MUSIC_STYLE_PRESETS`) -- each cycling through its own presets on click and rebuilding the
  panel in place, same click-to-rebuild pattern Noether's shop tabs use, rather than a slider
  (each has only a handful of discrete steps). A muted blue-grey hint line sits beneath each
  row ("Takes effect on the next map"/"Applies immediately"/"Applies immediately"), then a
  single "Close" button.

## Contextual tutorial tips (`OverworldScene.showTutorialTip`/`renderTutorialTipPopup`, `HubScene.maybeShowLabTip`)

- Same dark rounded-rectangle-with-stroke panel family as everywhere else (`520` wide, height
  grown to fit), stroked the same cyan (`0x5ad9ff`) the full tutorial recap panel below also
  uses -- title (bold white) above body text (muted blue-grey `#cfd8ff`, center-aligned, matching the
  wild-encounter greeting's tone), a single "Got it" button beneath. No page counter or
  Back/Next -- each popup is one tip, not a sequence, so paging chrome would be pure noise.
  The Lab's version (`HubScene.maybeShowLabTip`) reuses `HubScene.showPanel` instead (purple
  `0x9a6ad9` stroke, the same gold-title/measured-top-down-layout convention "The Hub" above
  describes for the Lab's other eight panels, just without a left motif of its own -- it's a
  one-off popup, not one of those eight stations) rather than duplicating this one, since it's a
  single one-off popup there too.
- Fires automatically the first time its own feature becomes relevant (`tutorialTipsSeen`,
  data/tutorial.ts's `TutorialTipId`) -- walking into the Lab, taking your first steps in a
  world, bumping into your first wild crystal, and so on -- never more than one on screen at a
  time, and never several shown in a row.

## Full tutorial recap (`scenes/panels/hubStations.ts`'s `showTutorialTopics`/`showTutorialTopic`)

- A topic picker, not a linear pager: `showTutorialTopics` (`560` wide, same cyan `0x5ad9ff`
  stroke) lists every tip in `data/tutorial.ts`'s `TUTORIAL_PAGES` as its own row (a "Pick a
  topic to revisit" hint above the list), so the player sees what's covered before opening
  anything and can jump straight to one topic instead of stepping through the rest to reach it.
- Picking a row opens that topic's own single page (`showTutorialTopic`, `560` wide, same cyan
  stroke) -- title, body (same floor-9px shrink-to-fit loop every other Lab panel's body text
  uses), and a footer with `<- Topics` (back to the topic list) alongside `Close`, rather than a
  Back/Next pager between topics.
- Doesn't trigger automatically -- see "Contextual tutorial tips" above for what
  a new save actually sees; this is opt-in only, always opening on the topic list.

## Attack effects (`art/attackEffects.ts`, `audio/sfx.ts`, `scenes/BattleScene.ts`)

- Every move renders a distinct particle effect keyed by its move class, not just a color
  swap: a fast focused **bolt** with a glowing double-width trailing line (Phonon Beam,
  Electron Pulse, Spinon Swap), an **expanding ring** pulse with a bright inner rim (Magnon
  Pulse, Polaron Drag), or a cluster of small particles that **converge/scatter** near the
  target (Anyon Braid, Majorana Split). Each class also has its own color (e.g. orange for
  Phonon Beam, red for Magnon Pulse). All shapes render additive-blended
  (`Phaser.BlendModes.ADD`) so they glow instead of reading as flat shapes.
- Kondo's three self-buff moves (Screening Pulse, Scattering Drag, Coherence Cascade) share
  the `'screening'` class's one look, unlike Laughlin's/Skłodowska-Curie's moves below -- an
  expanding ring (the same silhouette
  Magnon Pulse/Polaron Drag use, reading as an effect enveloping the caster) tinted Kondo's
  own rust-orange (`0xe86a44`), played with the caster's own position as both `from` and `to`
  (`BattleScene.resolveSelfBuff`) so it centers on them instead of traveling toward the
  opponent, and paired with a plain squash-bounce on the caster's own crystal
  (`flashHit`) rather than the camera shake/flash an ordinary hit's `impactPunch` adds, so
  casting a buff doesn't read as the caster taking damage. Distinct move names and the buff
  log line each one produces already read as three different moves without three different
  silhouettes too, so there's no `ANALYTIC_SHAPES`-style per-move override for this class.
- Laughlin's two Analytic moves break the "one shape per class" rule on purpose, each with
  its own silhouette rather than sharing whichever ordinary
  `EFFECT_STYLE` shape their currently-tuned quasiparticle carries (`art/attackEffects.ts`'s
  `ANALYTIC_SHAPES`, keyed by move id, not class), and each substantially more elaborate than
  the three base bolt/ring/burst shapes -- deliberately reading as clearly stronger than an
  ordinary hit, not just a
  bigger bolt/ring/burst. **The beam move** (`skyfallBeam`, `playBeam`) drops a multi-layer
  column of light from off the top of the screen straight down onto the target: a wide pulsing
  telegraph halo fades in first, then a white-hot core inside a brighter/wider outer column
  falls the rest of the way, flanked by two side-rays that swirl around it and trailed by a
  chain of falling sparks, while a radiant sun (a bright circle plus an expanding ring) grows
  at the point of origin as the beam charges. **The eruption move** (`groundEruption`,
  `playEruption`) bursts a wide double shockwave ring (white inner rim, colored outer rim)
  plus a bright vertical geyser
  core straight up through nearly twice the shard count (18 vs. the ordinary burst's 12),
  spread wider than a normal burst. Both deliberately ignore the attacker's own position --
  a beam falling from the sky and a crack opening in the ground don't originate there. Each
  still renders in whichever color its own currently-tuned quasiparticle class carries
  (`EFFECT_STYLE`), same as an ordinary move -- only the silhouette is overridden.
- Skłodowska-Curie's two Ultimate moves (`ultimateMeteor`/`ultimateNova`) get the same
  per-move-id shape-override treatment (`ULTIMATE_SHAPES`), but run their own multi-phase
  summon→charge→impact→aftermath sequence (`playMeteor`/`playNova`) rather than the shared
  windup/travel/impact beat every other shape (including Laughlin's beam/eruption) uses --
  4-6 seconds total, dramatically longer than any other move's effect, with `onImpact` firing
  at the sequence's own strike beat and `onComplete` only once the full aftermath decay
  finishes (see `BattleScene`'s "Ultimate moves defer damage/turn-handoff" in `CODEMAP.md`).
  A whiff (any wrong answer in `showUltimateQuestions`) still plays the same windup/charge
  phases, but swaps the final impact/aftermath beat for a distinct fizzle cue instead of a
  hit.
- The full beat, in order: a ~90ms additive windup flash at the attacker's own position, the
  travelling effect itself (`art/attackEffects.ts`'s `TRAVEL_MS`, 340-520ms depending on
  shape -- beam is the longest at 520ms), then a fire-and-forget impact shockwave (a white
  flash plus 8 radiating shards, ~260ms) at the target -- on top of which
  `BattleScene.impactPunch` layers the target crystal's scale-squash (`flashHit`), a small
  camera shake (`0.006`, kept subtle since the field's background is solid black right up to
  the canvas edge), and a brief camera flash. `BattleScene`'s `TURN_GAP_MS` (850ms) covers
  every other shape's ~810-830ms worst case comfortably but sits ~20ms under the beam move's
  own 870ms total -- in practice an imperceptible overlap with the very start of the next
  turn's own windup flash, not worth chasing given how minor it is, but worth knowing if
  `TRAVEL_MS`/`TURN_GAP_MS` are ever retuned together.
  Drawn fresh each frame with a `Graphics` object cleared and redrawn every tween tick (same
  pattern as the overworld's per-frame ground mesh) rather than a sprite, then destroyed on
  arrival/decay.
- Each attack also plays a procedural one-shot sound keyed to the same bolt/ring/burst shape
  (`audio/sfx.ts`'s `playAttackSfx`) on launch and an impact thump scaled by the
  quasiparticle-mismatch multiplier (`playImpactSfx`, 2x on a mismatched hit, 1x otherwise)
  on arrival, and dips the currently-playing
  music track's volume for the beat's duration (`audio/music.ts`'s `MusicEngine.duck`) so the
  hit reads clearly over the score before the music comes back up.
