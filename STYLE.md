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
  superconductor, topological), not tied to the player's own save/current form, since this is a "world full
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

- A single static room, not a walkable map: dark blue-purple gradient background with a
  lighter "floor" band (from y=340 down) ruled into vertical panel lines for a bit of
  architectural texture. No perspective/camera machinery -- everything is laid out at fixed
  canvas coordinates.
- Three hotspots in a row on the floor band (`addHotspot`), each a small `makeCrystal` icon
  bobbing in place with a label underneath, in the same gold-on-black label treatment as
  overworld encounters/tokens: a purple prism for "Materialdex", a gold shard for "Save
  Point", and a green cluster for the door, whose label switches between "Enter World 1" and
  "Enter World N+1" depending on how far `rivalDefeated` has progressed -- or, in Superposition
  Mode, reads "Enter World 2 (Bloch)" and drops the player straight into World 2, where Bloch's
  own teleport hub (already pre-seeded with every world as visited) is the sole way
  to reach any other world -- there is no separate warp/world-select panel. Clicking a
  hotspot while another panel is already open is a no-op (one panel at a time).
- Save Point reuses the same dark rounded-rectangle-with-stroke treatment as overworld
  dialogues (`showPanel`), stroked in purple (`0x9a6ad9`) to match the Materialdex icon,
  with a single "Close" button.
- **Materialdex** (`HubScene.renderMaterialdexPage`) is a one-entry-per-page index over
  every real compound in the game (`data/materials.ts`'s `allCrystals()`, alphabetical by
  name), not just ones the player has found -- an undiscovered entry still gets a slot,
  masked to a "???" name, a generic "Not yet discovered" blurb, and a flat dim-grey
  (`0x33394a`) silhouette in place of the compound's own rendered look, rather than the
  index only ever growing as the player finds things. Panel stroked purple (`0x9a6ad9`,
  matching the Materialdex icon) same as Save Point's. Each page shows the compound's own
  crystal render (`makeCrystal`, size `36`), name, and physics blurb (`materialdex.ts`'s
  `materialBlurb`) together, with an `Entry i/N` counter and `<- Back`/`Next ->` (also
  Left/Right keys) to step one entry at a time. A **search box** (`Search: <query>_`, type
  to filter -- captured by a scene-wide keydown handler gated on `materialdexOpen` so
  typing elsewhere in the Hub is unaffected) narrows the index to compounds whose name
  contains the query, case-insensitive and regardless of discovery state; a **type
  filter** button (`Type: <MaterialType | All> ▸`) cycles through every `MaterialType`
  plus "All". Both reset the page to the first match and persist until the panel is
  reopened. Content is laid out top-down with each element's own measured height
  advancing a running `y` (same pattern as `OverworldScene.showInfoPanel`), and the
  blurb's font shrinks in whole-px steps (floor `9`) if a long entry would otherwise push
  the counter/footer off the panel -- the panel's own background rectangle is sized and
  inserted behind everything only once the real content height is known, rather than a
  fixed panel size, since blurb length varies a lot from one compound to the next.

## Overworld path

- The grid is `GRID_W = 27` columns wide (`OverworldScene.ts`), but the walkable corridor
  itself is narrow relative to that -- `CORRIDOR_HALF_WIDTH = 3` in `world/mapgen.ts`, so
  7 tiles wide. The corridor's center drifts left/right (by 1, occasionally 2, tiles at a
  time) as it climbs toward the goal row, and drifts often/far enough that walking straight
  (holding one direction) runs off the edge of the corridor -- reaching the goal requires
  actually tracking the bend sideways, not just holding "forward."
- Short (3-6 tile) dead-end branches fork off the corridor's edges at random rows. Exactly
  one route (the corridor itself) reaches the goal row; branches never reconnect to it.
- Off-path tiles read as unambiguously "you cannot walk here," but not always the same way --
  `OverworldScene.drawOffPathTile` dispatches on the current biome's `wallTheme`
  (`art/biomes.ts`, see the Biomes table below):
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
  - **'void'** (Floating Islands, world 3): no ground fill at all -- the static sky/hill
    gradient `drawSky()` paints once behind `worldGfx` shows through, so stepping off the
    island reads as open air rather than a solid tile in a different color
    (`OverworldScene.drawVoidTile`). Only the edge shared with a walkable neighbor gets a
    glowing rail marking the drop-off; a void tile with no walkable neighbor draws nothing at
    all, which is also why this is the cheapest theme per frame, not the most expensive.
  A ground-tile fill itself (walkable or 'rock' off-path) is a single flat color per tile,
  not a per-tile diagonal-facet/gradient shading -- floors read better flat; don't add such
  shading without asking first.
- Decoration (flowers / crystal glints) is placed in the off-path terrain only, not on
  walkable tiles -- those are reserved for wild encounters (on the corridor) and
  qumatessence pickups (at branch dead ends).
- Map regenerates fresh (new `Math.random` layout) on first load and on an explicit world
  change (Hub door, Bloch's teleport, a debug warp). A round trip through a battle restores
  the exact same layout and player position instead of regenerating
  (`OverworldScene.saveMapState`/`restoreMap`); the
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
- Value tiers, color-coded, weighted toward the common tier (`data/tokens.ts`):
  - `1` -- cyan `0x8fe8ff`, weight 0.6 (common)
  - `5` -- gold `0xffe066`, weight 0.3 (uncommon)
  - `10` -- pink `0xff7ce0`, weight 0.1 (rare)
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
  render. Purely decorative, non-`Material` crystals (UI hotspot icons, background outcrops,
  `boss.ts`'s own satellite shards, the title screen's `TYPE_LOOK`-only showcase) omit `seed`
  and keep their exact hand-tuned look.
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
  `#ffe066`, if the material has a `data/quiz.ts` entry -- one question drawn at random
  from that material's pool of at least 6, via `getMaterialQuestion`, so the same material
  doesn't always ask the same thing) with two shuffled answer buttons plus "Let me pass," or
  a plain "Fight!" / "Let me pass" choice if it doesn't. Buttons use
  the same `[ #222244 background / #ffff88 text ]` treatment `BattleScene`'s move buttons
  use, for visual continuity between the map and the battle screen. Question, answer, and
  greeting text are all kept short (one line each) so the panel reads at a glance.
- Choosing to fight (via a correct/wrong answer or the no-question "Fight!" button) starts
  `BattleScene`; "Let me pass" just closes the panel with no scene change and no
  win/loss consequence.

## Guardians in the overworld (`OverworldScene.spawnGuardianSprite`)

- Every guardian (Noether included) stands floating at their world's *middle* tile
  (`WORLD_GUARDIANS`' `tile: 'middle'`, `mid.x`/`mid.y` from `world/mapgen.ts` --
  roughly the corridor's halfway row), not the goal -- the goal tile
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
  (`art/bloch.ts`, `art/bohr.ts`, ...) even though the surrounding panel shape is shared.
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
  current world, labeled `Travel to World N -- <name>`; clicking teleports there instantly
  (`advanceToWorld`, no battle). Empty state: "You haven't mapped anywhere else yet."
  Destinations paginate (see "Paginated candidate lists" below) once there are more than
  fit on one page -- routine in Superposition Mode, which pre-seeds every built world as
  visited and makes Bloch's hub the *sole* way to move between worlds (there is no separate
  warp panel).

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
  `allCrystals()` filtered through `isHybridMaterial`) gets a button (`Become <name>`,
  or a dimmed `<name> (current form)` for whichever the player is already wearing) that
  transmutes the player's own crystal into that form (`transmuteInto`) -- swaps
  color/variant/max HP and clamps current HP down if needed, and immediately redraws the
  overworld avatar (`redrawPlayerCrystal`). Empty state: "You haven't defeated any
  crystals yet -- there is nothing to become." Paginates once the list is longer than one
  page (see "Paginated candidate lists" below) -- the common case in Superposition Mode --
  ending in a single "Farewell" button, no separate footer row.

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
  "`<name>` -- tuned to `<quasiparticle>`, reverted to Phonon Beam (this form can't host it --
  retune)", or "`<name>` -- untuned (pick a quasiparticle)" if never assigned -- `<name>` here
  is `tunedMoveDisplayName`, so a tuned move's own row already reads like "Magnon Beam --
  tuned to Magnon Pulse (retune)" rather than the untuned default "Phonon Beam." Empty state once
  both are bought: "You already carry every analytic technique I can teach." Clicking either
  an unbought move's buy row or a learned move's tune/retune row opens
  `showMoveClassPicker`, a sub-panel titled "Which quasiparticle should `<name>` carry?"
  listing `TUNABLE_MOVE_CLASSES` filtered down to whatever the player's *current* form can
  host (`canHost`) as its own column of buttons (same button styling as the shop list, just
  a different button set) -- each labeled with the ordinary move name that class already
  carries (`quasiparticleLabel`, e.g. "Magnon Pulse" for `'magnon'`) rather than the class
  id. Picking one on an unbought move completes the purchase; on an already-bought move it
  just re-saves the assignment, free.
- **The move's displayed name always leads with its current quasiparticle**
  (`data/materials.ts`'s `tunedMoveDisplayName`) everywhere a move name shows up in battle
  too -- the move-menu button, the analytic-question panel's title, the battle log's "X used
  `<name>`!" line -- built from the quasiparticle's own label (`quasiparticleLabel`, e.g.
  `"Magnon Pulse"` → `Magnon`) plus each move's fixed shape word ("Beam"/"Eruption") rather
  than a second hand-authored word list, so `skyfallBeam` tuned to `'magnon'` reads as
  "Magnon Beam," `groundEruption` tuned to `'chargedAnyon'` as "Anyon Eruption," and so on. An
  untuned move defaults to `'phonon'`, reading as "Phonon Beam"/"Phonon Eruption."

## Majorana in the overworld (`OverworldScene.showMajoranaPanel`)

- World 5 only, standing at the middle tile like every other guardian. Green (`0x4fd97a`)
  name label and panel stroke; his avatar (`art/majorana.ts`'s `makeMajoranaAvatar`) is
  unchanged by this mechanic.
- His panel reuses the paginated-list shape Dresselhaus's panel uses, but with a
  two-step flow instead of one screen: every defeated wild material (or, in Superposition
  Mode, every crystal in the game) *that pairs with at least one of the others* gets a
  button (any pairing with no matching entry in `data/materials.ts`'s `HYBRID_RECIPES` --
  keyed by parent name, not main type, so a same-type pair can still be valid if a named
  recipe covers it -- is filtered out before it ever renders), picking one asks "Combine
  `<first>` with..." and re-lists only the remaining candidates that pair with it
  specifically (plus a "Never mind" to back out) rather than showing every possible pair at
  once. Both steps paginate (see "Paginated candidate lists" below) once the filtered list is
  longer than one page. Picking the second immediately transmutes the player into the
  recipe's own named result (`data/materials.ts`'s `combineMaterials` -- name/type/maxHp all
  fixed on the recipe, not computed at combine time) the same way Dresselhaus's
  transmutation does -- no separate "confirm" step, and no memory of earlier fusions to
  instantly re-become either -- every visit starts the two-step pick fresh. Empty state (no
  valid pairing among the
  candidates -- including having fewer than 2 total): "None of the crystals you've defeated
  pair into a known hybrid recipe yet -- Majorana only knows specific real pairings (e.g.
  Aluminum + Indium Arsenide, or two Graphenes together)."

## Anderson in the overworld (`OverworldScene.showAndersonPanel`)

- World 6 only, standing at the middle tile like every other guardian. Rust/amber
  (`0xc9884a`) name label and panel stroke; his avatar (`art/anderson.ts`'s
  `makeAndersonAvatar`) swaps the head for a scattered, irregular lattice of dim dots with
  one bright point pulsing at the center -- Anderson localization's own picture, a wave
  trapped by disorder instead of spreading freely -- rather than any other guardian's motif,
  plus four orbiting `×` glyphs instead of Noether's `✦` or Bloch's `◇`.
- Two-step flow like Majorana's: every defeated wild material (or, in Superposition Mode,
  every crystal in the game) that isn't a hybrid (`isHybridMaterial`) gets a
  button under "Dope in which crystal?" (paginated, see below); picking one asks "Learn
  which move from `<host>`?" and lists whichever of that host's own moves the player hasn't
  already learned (`<move name> (Pwr N)`), plus a "Never mind" to back out. Picking a move
  just appends it to the ordinary `unlockedMoves` list (`learnImpurityMove`) -- no form
  change, no HP change, unlike Dresselhaus/Majorana. Empty states: "You haven't defeated any
  original crystals yet -- there is nothing to dope in" (no host candidates) or "You already
  carry every move `<host>` has to offer" (host picked, but every one of its moves is
  already learned).

## Bohr in the overworld (`OverworldScene.showBohrPanel`)

- World 7 only, standing at the middle tile like every other guardian. Amber (`#ffa64a`
  label / `0xffa64a` stroke) name label; his avatar (`art/bohr.ts`'s `makeBohrAvatar`) is
  unchanged by this mechanic.
- Same buy-list-plus-switch shape as Kondo's panel below (`renderPassiveList`, shared with
  Franklin's panel below him): a still-unbought passive (`data/passives.ts`'s
  `BOHR_PASSIVE_IDS` -- Correlated Response, Nonlocal Correlation, Shared State) gets a
  `<name> -- <cost> qumatessence` buy button plus a one-line description underneath in a
  dimmer, smaller blue-grey; an already-bought passive gets a clickable "Make `<name>`
  active" button, or a dimmed "`<name>` (active)" tag with no click handler for whichever
  one currently is -- same dimmed-current convention every other guardian panel uses.
  Buying the first passive for this guardian activates it immediately, same reasoning as
  Kondo's first move; buying a second or third doesn't, and switching which one is active
  always requires reopening this panel. No "wrong form" empty state -- unlike Kondo's
  moves, a passive is never gated by a crystal's own physics (the same "player-learned
  technique, not physics a crystal has to host" reasoning that puts `'screening'` on
  every type's list), so all three are always purchasable.
- The buy button's label and its description line are both capped at a lower font-scale
  ceiling than every other guardian panel's buttons (`Math.min(fontScale(this), 1.3)` for
  the label, `1.2` for the description) rather than scaling all the way to the Enter-menu
  Settings panel's uncapped 'Large' text-size preset -- this panel has no shrink-to-fit
  safety net the way the Enter-menu's info panels do, and three buy rows each carrying
  their own description, on top of the avatar/intro/Farewell footer every guardian panel
  already has, pushed the Farewell button off the bottom of the canvas at the default
  text-size preset the first time this was tried uncapped.

## Kondo in the overworld (`OverworldScene.showKondoPanel`)

- World 8 only, standing at the middle tile like every other guardian. Rust-orange
  (`0xe86a44`) name label and panel stroke -- distinct from Anderson's own rust/amber
  (`0xc9884a`) above; his avatar (`art/kondo.ts`'s `makeKondoAvatar`) is unchanged by this
  mechanic.
- Same two-runs-of-rows shape as Laughlin's panel above: still-
  unbought moves from `data/materials.ts`'s `KONDO_MOVE_IDS` (Screening Pulse, Scattering
  Drag, Breakdown Cascade), usable from any form, same `<move name> -- <cost>
  qumatessence` label and afford/dim treatment as Laughlin's/Noether's shops (reusing `shopCost`),
  followed by one row per already-bought Kondo move -- a bought-and-inactive move reads
  "Make `<name>` active" as a clickable button, the currently active one (registry/save
  `kondoActiveMove`) reads "`<name>` (active)" dimmed to 50% alpha with no click handler,
  the same dimmed-current treatment Dresselhaus's "`<name>` (current form)" row uses. Buying
  the first Kondo move activates it immediately (still shows the dimmed "(active)" tag right
  away, no separate click needed); buying a second or third afterward doesn't, and switching
  which one is active always requires reopening this panel and clicking "Make active," not a
  per-turn choice in the battle move menu. `'screening'` sits on every type's
  `MOVE_COMPATIBILITY` list, so all three are always for sale until bought -- no empty/
  wrong-form state to render here, unlike Noether's shop.

## Franklin in the overworld (`OverworldScene.showFranklinPanel`)

- World 9 only, standing at the middle tile like every other guardian. Lavender
  (`#c9a8e0` label / `0xa878c9` stroke and avatar accents) name label; her avatar
  (`art/franklin.ts`'s `makeFranklinAvatar`) swaps the head for a disordered lattice of
  scattered sites surrounded by concentric diffraction rings -- porous/amorphous carbon's
  own X-ray diffraction pattern made literal -- in a dusty amethyst/lavender palette
  distinct from Anderson's rust/amber despite the shared defect/disorder theme.
- Same buy-list-plus-switch shape as Bohr's panel above (`renderPassiveList`, shared
  between them): a still-unbought passive (`data/passives.ts`'s `FRANKLIN_PASSIVE_IDS` --
  Diffraction Shadow, Satellite Reflection, Amorphous Halo) gets a `<name> -- <cost>
  qumatessence` buy button plus a one-line description underneath, same capped-font-scale
  treatment Bohr's panel uses; an already-bought passive gets a clickable "Make `<name>`
  active" button, or a dimmed "`<name>` (active)" tag for whichever one currently is. Same
  "buying the first activates it, no wrong-form empty state" behavior as Bohr's panel.

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
- One button per row, same treatment as every other dialogue button, followed by a
  `<- Prev` / `Next ->` row (each dimmed to 35% alpha and inert at the start/end of the
  list) and a small blue-grey `Page N/M` label beneath -- only rendered at all once the
  list is longer than one page.
- The actual row count per page isn't a fixed number: it's computed from one sample row
  measured at the current Settings-panel text-size preset (`ui/text.ts`'s `fontScale`),
  shrunk to whatever still fits above the panel's own trailing Farewell/Close button --
  a fixed per-page cap would overflow Bloch's hub at the *default* text-size preset (1.5x,
  not 1x) once Superposition Mode made a 9-destination list the common case -- verified with
  no overflow at every font-scale preset via the headless-Chromium harness (see
  DEVELOPMENT.md's "Verifying UI changes" section).

## Boss avatars (`OverworldScene.spawnBossSprite`, `art/boss.ts`)

- Every built world's rival/boss stands at the goal tile as a purely visual
  landmark, sized `BOSS_CRYSTAL_SIZE = 70` -- roughly 2x a wild crystal (`22`) and
  2x the player's own on-map size (`34`) -- and rendered by `makeBossCrystal`
  rather than the shared `makeCrystal` every wild/rival crystal otherwise uses:
  four smaller satellite shards (shaded siblings of the core's color, via `shade`)
  fused around one oversized core, a two-layer additive aura that slowly pulses
  scale/alpha, and six hot-orange embers orbiting the whole mass (same
  orbiting-container-angle-tween trick as a guardian avatar's orbiting motes, just
  warmer/redder to read as hostile rather than benevolent). Name label in a
  bold, warning-toned pink-red (`#ff8f8f`), distinct from any guardian's own label
  color. Reuses the `WorldSprite` projection/wander/bob machinery, so it scrolls
  and fades with distance like everything else standing on the map -- it doesn't
  add its own click handler, the fight is still only reached through the goal
  panel's "Face the Rival" button. `makeBossCrystal`'s core/satellite color and
  variant come from the boss `Material`'s own `color`/`variant` (`TYPE_LOOK[type]`),
  so World 9's boss -- the one rival with no fixed type, DESIGN.md §2 -- looks
  different depending on which `MaterialType` got rolled for that playthrough,
  same as every other world's boss reads off its own fixed type.

## The rival gate (`OverworldScene.showRivalEncounter`)

- Triggered by clicking "Face the Rival ->" in the goal panel (`showGatePanel`), not
  automatically on reaching the goal and not from any guardian's own panel -- so the player
  can walk past the goal to shop with Noether or any other guardian before ever facing the
  fight they're being gated on. Same panel treatment as a wild encounter (600×260,
  centered crystal, italic line beneath), but stroked in red (`0xff6666`) instead of
  blue-grey or gold, and with a single mandatory "Battle!" button -- no "let me pass,"
  since a gate that can be skipped isn't a gate. Losing doesn't set anything back except
  the token stake (see Stakes in DESIGN.md §4): the goal panel simply reopens and "Face
  the Rival ->" is still there to retry.

## Boss opponent in battle (`scenes/BattleScene.ts`)

- A rival fight's opponent renders with `art/boss.ts`'s `makeBossCrystal` at
  `BOSS_CRYSTAL_SIZE = 64` -- bigger than an ordinary wild encounter's plain
  `makeCrystal` at `50` -- positioned at `BOSS_OPPONENT_POS` (`{ x: 430, y: 155 }`,
  shifted left and slightly down from the wild encounter's `OPPONENT_POS`) so the
  wider multi-shard silhouette clears the move menu docked at `MENU_X = 456` instead
  of overlapping it. Same look the boss already has standing at its world's goal
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
- Kondo's Screened/Slowed/Weakened status effects (DESIGN.md §4) get a much smaller
  treatment than the quiz aura/raincloud above -- a plain text pill (`playerStatusLabel`/
  `opponentStatusLabel`) docked just under that side's HP bar rather than anything layered
  onto the crystal itself, reading `"<Status> (<turns left>)"` in Kondo's own rust-orange
  (`#ff8f6a`, matching his guardian label/panel stroke and the `'screening'` attack-effect
  color below) over the same translucent-black tag background every HP-bar name label
  already uses. Empty (no active status) by default on both sides -- the pill only ever
  reads as chrome that appears when relevant, not a permanent fixture of the HP-bar area.
- Franklin's/Bohr's active passives (DESIGN.md §5) get their own pill directly below that
  side's status pill, same size/background/depth as the status pill but in a muted
  blue-violet (`PASSIVE_PILL_COLOR`, `#8fa0ff` -- its own fixed constant, not derived from
  either guardian's own label color) rather than Kondo's
  rust-orange, so an always-on passive reads as visually distinct from a ticking status at a
  glance. Reads as the joined name(s) of whichever passive(s) are active (`·`-separated when
  both a Franklin and a Bohr passive are active at once), empty by default the same way the
  status pill is. Its horizontal position is clamped back onto the field if the joined text
  would otherwise run past the canvas edge at the largest text-size setting; if the stack of
  rows above it (boost/fail note, name, bar, status pill) leaves no vertical room left for it
  at that same setting, it's simply omitted for that battle rather than drawn overlapping the
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

## Battle move menu (`BattleScene.drawMoveMenu`)

- A docked panel on the right of the field (`x = 456`, `y = 190`, width `176`), same dark
  rounded-rectangle-with-stroke treatment as the overworld's dialogue panels, stroked gold
  (`0xffe066`) to match Noether's own panel color, titled "MOVES" in bold gold. Height grows
  with however many moves are on the current page rather than a fixed size, since that
  changes as the player learns moves, buys an analytic/screening kit, or transmutes into a
  form with a different physics-compatible set (§3 of DESIGN.md).
- **Grouped into up to four move-kind sections (`ATTACKS`/`ANALYTIC`/`ULTIMATE`/`SCREENING`),
  shown one
  page at a time** (DESIGN.md §4): a small bold blue-grey (`#8fa0c9`) header line reading the
  section's label sits above that page's own rows, with a `(i/N)` page count appended once
  there's more than one page. A section that has no usable move in it never becomes a page at
  all (a player with no analytic/ultimate moves bought, or no Kondo move active, never sees an
  empty
  one). A section with more moves than one page can hold at the row-height floor below
  (`BattleScene.moveMenuPages`) splits into several same-label pages instead of shrinking
  further or growing past the field's own bottom edge -- `ATTACKS` for an 'adaptive'-type form
  that's learned every attack class (14 moves) is the only section that currently gets this
  large, splitting into evenly-sized pages (e.g. two pages of 7) rather than one lopsided page
  and a near-empty second one. Each move is still a `[ #222244 background / #ffff88 text ]`
  button, same treatment used everywhere else (overworld dialogue buttons), stacked vertically
  under the header. A form with zero currently-usable moves (shouldn't normally happen, since
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
  bought an analytic/screening move sees a plain `ATTACKS` header with nothing to switch to.
- Header text is deliberately capped at a lower text-size ceiling than the panel's own
  title/legend (`headerScale = Math.min(fontScale, 1.15)`, 10px label / 8px legend sub-line
  at that scale), and the pager arrows render a size above that (`13 * headerScale`) --
  letting either scale all the way to the Enter-menu Settings panel's uncapped 'Large' preset
  the way the title does would eat directly into the row budget below, and the header row's
  own height is taken from whichever of the label/arrows is actually taller so the arrows
  never bleed into the first move row.
- Row height is a hard geometric budget (whatever vertical space is left below the
  title/legend/header, divided across however many moves the *current page* has -- not
  every section's total, since only one page renders at a time), with a minimum floor so
  rows never shrink to illegible -- `20`px for up to 7 moves on a page, `15`px for 8-9. A
  page can never have more rows than that floor allows without running the panel off the
  bottom of the field -- `BattleScene.maxMoveRowsPerPage` measures the actual title/legend/
  header height at the current text-size setting to compute the true row ceiling, and
  `moveMenuPages` (above) splits any oversized section down to that ceiling before a page
  ever reaches this row-height math, so the floor is a legibility limit here, not something
  this code also has to keep on screen. Below `rowH < 40` the row switches to smaller
  font/padding rather than clipping. Verified against a live browser render (headless-Chromium
  harness, DEVELOPMENT.md) at every text-size preset with an 'adaptive'-type form carrying
  every attack class at once, the worst case across every `MaterialType`'s
  `MOVE_COMPATIBILITY` entry -- no page overflows the field at any preset.

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

## Enter-key pause menu (`OverworldScene.showPauseMenu`/`showInfoPanel`/`showAbilitiesPanel`)

- Same dark rounded-rectangle-with-stroke panel treatment as everywhere else, stroked
  blue-grey (`0x8fa0c9`, distinct from every guardian/encounter panel's own stroke color). Rows
  are a data-driven list (`320` wide, height grows with row count, vertically centered on
  the canvas rather than a fixed `panelY`) rather than fixed buttons: Return to Lab (same
  destination as the `H` key), View Moves, View Stats, View Abilities, Guardians, Tutorial,
  Settings, then Close -- a fixed eight rows (world-to-world movement goes through Bloch's
  own panel instead, see above). Respects `dialogueActive`
  (won't open over an already-open panel) and only exists in `OverworldScene`, not mid-battle.
- "View Moves"/"View Stats" swap the pause menu for a second, generic info panel
  (`showInfoPanel`, `420x300`, same blue-grey stroke). View Moves lists only the moves
  actually usable right now (`getBattleMoves` -- learned moves intersected with what the
  current crystal form's physics can host, §3) as plain `<name> -- Pwr N` lines, no move-class
  label and no "incompatible" entries cluttering the list; View Stats lists
  Quantumness/Velocity/Correlation plus qumatessence and current form name. Both end in a
  single "Close" button.
- "View Abilities" is its own dedicated panel (`showAbilitiesPanel`, `440` wide, same
  blue-grey stroke) rather than a third `showInfoPanel` body -- one name+description block
  per passive owner (`data/passives.ts`'s `PASSIVE_OWNERS`, currently Franklin and Bohr),
  each its own pair of `Text` objects with explicitly capped
  font sizes (`nameScale`/`descScale`, same capping `renderPassiveList` already uses) rather
  than folding both full descriptions into `showInfoPanel`'s single wrapped body, since that
  body's shrink-to-fit only lowers font size and never truncates -- two full passive
  descriptions back to back could still overflow the canvas at that panel's largest text-size
  preset even at the shrink loop's own floor.

## Settings panel (`OverworldScene.showSettingsPanel`)

- Same blue-grey (`0x8fa0c9`) stroke as the pause menu it's opened from, sized
  `380x220`. Just one row so far -- "Enemy Density: `<preset>`" -- that cycles
  through `data/settings.ts`'s `DENSITY_PRESETS` (Low/Normal/High/Very High) on
  click and rebuilds the panel in place, same click-to-rebuild pattern Noether's
  shop tabs use, rather than a slider (only four discrete steps). A muted
  blue-grey hint line beneath explains it only affects maps generated after the
  change, then a single "Close" button.

## Contextual tutorial tips (`OverworldScene.showTutorialTip`/`renderTutorialTipPopup`, `HubScene.maybeShowLabTip`)

- Same dark rounded-rectangle-with-stroke panel family as everywhere else (`520` wide, height
  grown to fit), stroked the same cyan (`0x5ad9ff`) the full tutorial recap panel below also
  uses -- title (bold white) above body text (muted blue-grey `#cfd8ff`, center-aligned, matching the
  wild-encounter greeting's tone), a single "Got it" button beneath. No page counter or
  Back/Next -- each popup is one tip, not a sequence, so paging chrome would be pure noise.
  The Lab's version (`HubScene.maybeShowLabTip`) reuses `HubScene.showPanel` instead (purple
  `0x9a6ad9` stroke, that scene's own panel treatment) rather than duplicating this one, since
  it's a single one-off popup there too.
- Fires automatically the first time its own feature becomes relevant (`tutorialTipsSeen`,
  data/tutorial.ts's `TutorialTipId`) -- walking into the Lab, taking your first steps in a
  world, bumping into your first wild crystal, and so on -- never more than one on screen at a
  time, and never several shown in a row.

## Full tutorial recap (`OverworldScene.showTutorial`/`renderTutorialPage`)

- Same panel family, `560x300`, same cyan stroke -- this is the paged, multi-tip version, kept
  only for the Enter-menu's "Tutorial" button (replays every tip in `data/tutorial.ts`'s
  `TUTORIAL_PAGES`, in order, on demand). A small `TUTORIAL -- n / N` counter sits above the
  page title.
- Footer row: `<- Back` (hidden on the first page) and `Next ->` (hidden on the last page)
  flank a center button that reads "Skip" on every page except the last, where it becomes
  "Done" -- both close the panel either way, "Skip"/"Done" is just the honest label for what
  happens at that point in the sequence.
- Doesn't trigger automatically -- see "Contextual tutorial tips" above for what
  a new save actually sees; this is opt-in only, always restarting from page 1.

## Attack effects (`art/attackEffects.ts`, `audio/sfx.ts`, `scenes/BattleScene.ts`)

- Every move renders a distinct particle effect keyed by its move class, not just a color
  swap: a fast focused **bolt** with a glowing double-width trailing line (Phonon Beam,
  Electron Pulse, Spinon Swap), an **expanding ring** pulse with a bright inner rim (Magnon
  Pulse, Polaron Drag), or a cluster of small particles that **converge/scatter** near the
  target (Anyon Braid, Majorana Split). Each class also has its own color (e.g. orange for
  Phonon Beam, red for Magnon Pulse). All shapes render additive-blended
  (`Phaser.BlendModes.ADD`) so they glow instead of reading as flat shapes.
- Kondo's three moves (Screening Pulse, Scattering Drag, Breakdown Cascade) share the
  `'screening'` class's one look, unlike Laughlin's/Skłodowska-Curie's moves below -- an
  expanding ring (the same silhouette
  Magnon Pulse/Polaron Drag use, reading as a screening cloud enveloping the target) tinted
  Kondo's own rust-orange (`0xe86a44`). Distinct move names and the status-effect log line
  each one produces already read as three different moves without three different
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
